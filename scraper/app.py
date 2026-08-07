#!/usr/bin/env python3
"""Scraper de leads Google Maps — cible : établissements SANS site web.

Service HTTP interne appelé par n8n :
    POST /scrape  {"query": "avocat", "location": "Genève", "country": "CH",
                   "limit": 40}  (header X-Scraper-Token)
    -> [{name, category, phone, address, country, maps_url, has_website:false}, ...]

On ne retient QUE les fiches sans site web (le prospect idéal). Le champ website
est absent du panneau latéral quand l'établissement n'en a pas déclaré.

Le navigateur est commutable via BROWSER_BACKEND :
    local    (défaut) Chromium dans le conteneur — comportement historique.
    kitesurf          Cloudflare Browser Run (navigateur agent-first, CDP distant).

⚠️ Le scraping de Google Maps viole les CGU de Google et peut casser à chaque
changement d'UI. Pour de la production durable, préférez l'API officielle Google
Places (Text Search + Place Details, champ `website`) — voir docs/compliance.md.
Ce module isole toute la logique fragile derrière /scrape pour pouvoir le
remplacer sans toucher aux workflows n8n.
"""
from __future__ import annotations

import asyncio
import os
import re
import urllib.parse

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from playwright.async_api import async_playwright

SCRAPER_TOKEN = os.environ.get("SCRAPER_TOKEN", "")

# Backend navigateur : "local" (Chromium embarqué, défaut) ou "kitesurf"
# (Cloudflare Browser Run — navigateur agent-first, CDP distant, pas de Chromium
# dans l'image). Voir docs/architecture.md et docs/browser-backends.md.
BROWSER_BACKEND = os.environ.get("BROWSER_BACKEND", "local").strip().lower()
CF_ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
CF_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")

KITESURF_CDP_TEMPLATE = (
    "wss://api.cloudflare.com/client/v4/accounts/{account}"
    "/browser-run/devtools/browser?browser=kitesurf"
)

app = FastAPI(title="oueb-scraper")


def kitesurf_endpoint(account_id: str) -> str:
    """URL CDP Kitesurf pour un compte Cloudflare (pure, testable hors-ligne)."""
    if not account_id:
        raise RuntimeError(
            "CLOUDFLARE_ACCOUNT_ID est requis quand BROWSER_BACKEND=kitesurf")
    return KITESURF_CDP_TEMPLATE.format(account=urllib.parse.quote(account_id))


async def _open_browser(p):
    """Ouvre un navigateur selon BROWSER_BACKEND.

    - local    : Chromium lancé dans le conteneur (nécessite l'image Playwright).
    - kitesurf : connexion CDP à Cloudflare Browser Run. Kitesurf parle le
      Chrome DevTools Protocol, donc le reste du code Playwright est inchangé.
    """
    if BROWSER_BACKEND == "kitesurf":
        if not CF_API_TOKEN:
            raise RuntimeError(
                "CLOUDFLARE_API_TOKEN est requis quand BROWSER_BACKEND=kitesurf "
                "(token avec la permission « Browser Rendering - Edit »)")
        return await p.chromium.connect_over_cdp(
            kitesurf_endpoint(CF_ACCOUNT_ID),
            headers={"Authorization": f"Bearer {CF_API_TOKEN}"},
            timeout=60000,
        )
    if BROWSER_BACKEND != "local":
        raise RuntimeError(
            f"BROWSER_BACKEND inconnu : {BROWSER_BACKEND!r} (attendu: local|kitesurf)")
    return await p.chromium.launch(args=["--no-sandbox"])


class ScrapeRequest(BaseModel):
    query: str
    location: str
    country: str = Field(pattern=r"^[A-Z]{2}$")
    limit: int = Field(default=40, ge=1, le=120)


class Lead(BaseModel):
    name: str
    category: str | None = None
    phone: str | None = None
    address: str | None = None
    country: str
    maps_url: str
    has_website: bool = False


@app.get("/healthz")
async def healthz() -> dict:
    # `configured` signale un backend kitesurf sans credentials (mauvaise conf
    # visible au déploiement plutôt qu'au premier /scrape).
    configured = (bool(CF_ACCOUNT_ID and CF_API_TOKEN)
                  if BROWSER_BACKEND == "kitesurf" else True)
    return {"ok": True, "browser_backend": BROWSER_BACKEND, "configured": configured}


@app.post("/scrape", response_model=list[Lead])
async def scrape(req: ScrapeRequest,
                 x_scraper_token: str = Header(default="")) -> list[Lead]:
    if not SCRAPER_TOKEN or x_scraper_token != SCRAPER_TOKEN:
        raise HTTPException(status_code=401, detail="bad token")
    return await _collect(req)


async def _collect(req: ScrapeRequest) -> list[Lead]:
    url = ("https://www.google.com/maps/search/"
           + urllib.parse.quote(f"{req.query} {req.location}"))
    leads: list[Lead] = []

    async with async_playwright() as p:
        browser = await _open_browser(p)
        ctx = await browser.new_context(
            locale="en-US",
            user_agent=("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"),
        )
        page = await ctx.new_page()
        await page.goto(url, wait_until="domcontentloaded", timeout=45000)
        await _consent(page)

        feed = 'div[role="feed"]'
        try:
            await page.wait_for_selector(feed, timeout=15000)
        except Exception:
            await browser.close()
            return []

        seen: set[str] = set()
        for _ in range(20):  # défilement paresseux du panneau résultats
            cards = await page.query_selector_all(f'{feed} a[href*="/maps/place/"]')
            for card in cards:
                href = await card.get_attribute("href") or ""
                if href in seen:
                    continue
                seen.add(href)
                lead = await _parse_card(page, card, href, req.country)
                if lead and not lead.has_website:
                    leads.append(lead)
                    if len(leads) >= req.limit:
                        await browser.close()
                        return leads
            await page.mouse.wheel(0, 3000)
            await asyncio.sleep(1.2)

        await browser.close()
    return leads


async def _consent(page) -> None:
    """Clique le bandeau de consentement Google s'il apparaît (UE)."""
    for sel in ('button[aria-label*="Accept"]',
                'button[aria-label*="Tout accepter"]',
                'form[action*="consent"] button'):
        try:
            btn = await page.query_selector(sel)
            if btn:
                await btn.click()
                await asyncio.sleep(1)
                return
        except Exception:
            pass


async def _parse_card(page, card, href: str, country: str) -> Lead | None:
    """Ouvre la fiche et lit nom / catégorie / téléphone / adresse / présence site."""
    try:
        await card.click()
        await page.wait_for_selector('h1', timeout=8000)
    except Exception:
        return None

    name = await _text(page, "h1")
    if not name:
        return None

    category = await _text(page, 'button[jsaction*="category"]')
    address = await _attr(page, 'button[data-item-id="address"]', "aria-label")
    phone = await _attr(page, 'button[data-item-id^="phone"]', "aria-label")
    # Site web : présent uniquement si l'établissement en a déclaré un.
    website_el = await page.query_selector('a[data-item-id="authority"]')

    return Lead(
        name=name.strip(),
        category=(category or "").strip() or None,
        phone=_clean_label(phone),
        address=_clean_label(address),
        country=country,
        maps_url=("https://www.google.com" + href) if href.startswith("/") else href,
        has_website=website_el is not None,
    )


async def _text(page, sel: str) -> str | None:
    el = await page.query_selector(sel)
    return (await el.inner_text()) if el else None


async def _attr(page, sel: str, attr: str) -> str | None:
    el = await page.query_selector(sel)
    return (await el.get_attribute(attr)) if el else None


def _clean_label(v: str | None) -> str | None:
    if not v:
        return None
    # les labels sont du type "Adresse: Rue X 3, 1200 Genève"
    return re.sub(r"^[^:]+:\s*", "", v).strip() or None


if __name__ == "__main__":  # checks hors-ligne : parsing des labels + endpoint CDP
    assert _clean_label("Adresse: Rue X 3, 1200 Genève") == "Rue X 3, 1200 Genève"
    assert _clean_label("Téléphone: +41 22 000 00 00") == "+41 22 000 00 00"
    assert _clean_label(None) is None

    ep = kitesurf_endpoint("abc123")
    assert ep == ("wss://api.cloudflare.com/client/v4/accounts/abc123"
                  "/browser-run/devtools/browser?browser=kitesurf"), ep
    # un account_id absent doit échouer au démarrage, pas silencieusement
    try:
        kitesurf_endpoint("")
    except RuntimeError:
        pass
    else:
        raise AssertionError("kitesurf_endpoint('') aurait dû lever RuntimeError")

    print("selfcheck: OK")
