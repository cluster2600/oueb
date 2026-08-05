#!/usr/bin/env python3
"""Client de provisioning : crée un sous-site clone du template et injecte le SEO.

Appelle la route MU-plugin POST /wp-json/oueb/v1/sites (voir
wordpress-plugin/oueb-provisioner.php). Utilisé par n8n (node Execute Command ou
HTTP Request) après l'étape LLM.

Auth : Application Password WordPress d'un Super Admin (Réglages > Utilisateurs >
Mots de passe d'application). Basic Auth sur la REST API.

    WP_BASE_URL=https://oueb.example        \
    WP_APP_USER=admin WP_APP_PASSWORD='xxxx xxxx xxxx xxxx xxxx xxxx' \
    python3 inject_site.py --template-id 2 --slug cabinet-durand \
        --title "Cabinet Durand" --lang fr_FR --domain cabinet-durand.ch \
        --seo-file seo.json

    python3 inject_site.py --selftest      # check hors-ligne (aucune requête)
"""
from __future__ import annotations

import argparse
import json
import os
import sys

import requests


def build_payload(template_id: int, slug: str, title: str, lang: str,
                  domain: str | None, seo: dict) -> dict:
    """Construit et valide le corps de la requête de provisioning."""
    required = {"title", "meta_description", "h1"}
    missing = required - seo.keys()
    if missing:
        raise ValueError(f"SEO incomplet, champs manquants: {sorted(missing)}")
    payload = {
        "template_id": int(template_id),
        "slug": slug,
        "title": title,
        "lang": lang,
        "seo": seo,
    }
    if domain:
        payload["domain"] = domain.lower()
    return payload


def create_site(base_url: str, user: str, password: str, payload: dict,
                timeout: int = 60) -> dict:
    resp = requests.post(
        f"{base_url.rstrip('/')}/wp-json/oueb/v1/sites",
        json=payload,
        auth=(user, password),
        timeout=timeout,
    )
    if resp.status_code >= 400:
        raise RuntimeError(f"WP {resp.status_code}: {resp.text[:300]}")
    return resp.json()


def selftest() -> None:
    seo = {"title": "Cabinet Durand — Avocats", "meta_description": "Conseil...",
           "h1": "Cabinet Durand", "h2": ["Nos domaines", "Contact"],
           "sections": [{"heading": "Droit des affaires", "body": "..."}]}
    p = build_payload(2, "cabinet-durand", "Cabinet Durand", "fr_FR",
                      "Cabinet-Durand.CH", seo)
    assert p["template_id"] == 2 and p["domain"] == "cabinet-durand.ch", p
    assert p["seo"]["h1"] == "Cabinet Durand"
    try:
        build_payload(2, "x", "X", "en_US", None, {"title": "t"})
    except ValueError as e:
        assert "meta_description" in str(e), e
    else:
        raise AssertionError("validation SEO non déclenchée")
    print("selftest: OK")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Provisionne un site clone + SEO")
    ap.add_argument("--template-id", type=int)
    ap.add_argument("--slug")
    ap.add_argument("--title")
    ap.add_argument("--lang", default="en_US")
    ap.add_argument("--domain", default=None)
    ap.add_argument("--seo-file", help="JSON produit par le node LLM")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args(argv)

    if args.selftest:
        selftest()
        return 0

    for req in ("template_id", "slug", "title", "seo_file"):
        if getattr(args, req) in (None, ""):
            ap.error(f"--{req.replace('_', '-')} requis")

    with open(args.seo_file, encoding="utf-8") as f:
        seo = json.load(f)

    payload = build_payload(args.template_id, args.slug, args.title,
                            args.lang, args.domain, seo)
    result = create_site(
        os.environ["WP_BASE_URL"], os.environ["WP_APP_USER"],
        os.environ["WP_APP_PASSWORD"], payload)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
