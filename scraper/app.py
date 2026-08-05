#!/usr/bin/env python3
"""Scraper de leads Google Maps — cible : établissements SANS site web.

Service HTTP interne appelé par n8n :
    POST /scrape  {"query": "avocat", "location": "Genève", "country": "CH",
                   "limit": 40}  (header X-Scraper-Token)
    -> [{name, category, phone, address, country, maps_url, has_website:false}, ...]

On ne retient QUE les fiches sans site web (le prospect idéal). Le champ website
est absent du panneau latéral quand l'établissement n'en a pas déclaré.

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
app = FastAPI(title="oueb-scraper")


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
    return {"ok": True}


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
        browser = await p.chromium.launch(args=["--no-sandbox"])
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


if __name__ == "__main__":  # petit check hors-ligne de la logique de parsing labels
    assert _clean_label("Adresse: Rue X 3, 1200 Genève") == "Rue X 3, 1200 Genève"
    assert _clean_label("Téléphone: +41 22 000 00 00") == "+41 22 000 00 00"
    assert _clean_label(None) is None
    print("selfcheck: OK")
