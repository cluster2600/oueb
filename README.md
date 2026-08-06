# oueb — usine logicielle One-Page (100% Open Source, self-hosted)

Chaîne automatisée : **scraping de leads sans site → validation registre (Zefix) →
génération IA localisée → site statique déployé sur Cloudflare Pages → Payment Link
Stripe multi-devises (méthodes locales) → cold email Listmonk/SES**, avec **Twenty
CRM** et **Kanboard** pour le suivi. À l'encaissement : achat de domaine (Gandi) et
mise en ligne automatique.

Marchés cibles : 🇨🇭 Suisse · 🇱🇮 Liechtenstein · 🇲🇨 Monaco · 🇸🇬 Singapour · 🇯🇵 Japon · 🇺🇸 USA.
Prix : 500 CHF / EUR / SGD / USD et **79 800 JPY**. Paiements locaux : TWINT (CH/LI),
PayNow (SG), Konbini (JP), ACH/Link (US).

OSS self-hosted (LLM via **endpoint NVIDIA Nemotron**) : **n8n · Playwright · Cloudflare Pages · Listmonk · Twenty · Kanboard
· Caddy**. Le VPS n'héberge que le **control-plane** ; les sites clients vivent sur
l'edge Cloudflare (TLS + CDN mondial gratuits). Schémas : [`docs/architecture.md`](docs/architecture.md).

```mermaid
flowchart LR
  GM["Google Maps"] --> SCR["Scraper"] --> N8N["n8n"]
  N8N --> ZX["Zefix (CH)"] --> N8N --> OLL["NVIDIA Nemotron"] --> N8N
  N8N --> STR["Stripe"] --> N8N
  N8N --> SG["sitegen"] --> CFP["Cloudflare Pages"]
  N8N --> TW["Twenty"]
  N8N --> KB["Kanboard"]
  N8N --> LM["Listmonk"] --> SES["SES"] --> P["Prospect"]
  P --> STR --> N8N -->|"paid"| GD["Gandi"] --> CFP
```

## Arborescence

```
oueb/
├── docker-compose.yml   # caddy·postgres·redis·n8n·listmonk·twenty(+worker)·kanboard·sitegen·scraper (LLM = NVIDIA externe)
├── .env.example
├── docker/
│   ├── caddy/Caddyfile          # reverse proxy back-office (TLS Let's Encrypt)
│   └── postgres/init.sql        # bases n8n · listmonk · twenty · kanboard
├── sitegen/                     # one-page statique + déploiement Cloudflare Pages
│   ├── server.js · build.js · template.html · package.json · Dockerfile
├── scraper/                     # FastAPI + Playwright (leads Google Maps sans site)
├── n8n-workflows/               # 2 workflows importables (JSON) + README
├── config/
│   ├── country_matrix.yaml      # devise/locale/prompt/prix/paiement par pays
│   ├── prompts.md               # profils LLM (keigo JP, de LI, ch_fr/it, us_en…)
│   └── registries.md            # Zefix (CH) + registres JP/SG/LI/MC/US
├── listmonk/config.toml
└── docs/
    ├── architecture.md          # schémas Mermaid
    ├── hosting-registrar.md      # Cloudflare Pages + matrice registrars
    └── compliance.md            # SES, opt-in JP, RGPD/PDPA/nLPD/CAN-SPAM, scraping
```

## Démarrage

```bash
cp .env.example .env && $EDITOR .env          # secrets + MAIN_DOMAIN

docker compose up -d postgres redis
docker compose run --rm listmonk ./listmonk --install --yes   # schéma Listmonk (1x)
docker compose up -d

# LLM = endpoint NVIDIA (aucun modèle local). Mets NVIDIA_API_KEY dans .env
# (en prod : lu depuis OCI Vault au boot via instance principal).

# Comptes back-office (pointez MAIN_DOMAIN vers l'IP du VPS d'abord) :
#  - Twenty   : https://$MAIN_DOMAIN            -> créer le workspace, puis Settings > API (TWENTY_API_KEY)
#  - Kanboard : https://$MAIN_DOMAIN/kanboard    -> login admin/admin (à changer), créer un projet (project_id=1)
#               + activer l'API JSON-RPC (Settings > API) -> KANBOARD_API_TOKEN = base64("jsonrpc:<token>")
#  - Listmonk : https://$MAIN_DOMAIN/listmonk     -> Settings > SMTP (Amazon SES) + API token

# Cloudflare : créer un API token (scope Pages:Edit) + noter l'Account ID -> .env (sitegen)
# Reporter les tokens dans .env puis :
docker compose up -d n8n sitegen

# Importer n8n-workflows/1-outreach.json et 2-provisioning.json, assigner les
# credentials, activer les workflows.
```

## Hébergement des sites & domaines

Les one-pages sont **statiques** (service `sitegen`) et déployés sur **Cloudflare
Pages** (TLS + CDN mondial gratuits — un client JP est servi depuis Tokyo). Après
paiement, le workflow 2 achète le domaine (**Gandi**, couvre .ch/.li/.jp/.com),
`sitegen` le rattache au projet Pages, et un CNAME LiveDNS pointe le domaine vers
`<projet>.pages.dev`. Détails et matrice registrar : [`docs/hosting-registrar.md`](docs/hosting-registrar.md).

## Contrôles

```bash
python3 scraper/app.py            # selfcheck parsing (hors-ligne)
node sitegen/build.js             # selfcheck génération HTML (hors-ligne)
```

## ⚠️ Avant la production — [`docs/compliance.md`](docs/compliance.md)

Cold email strictement encadré (opt-in JP, nLPD/UWG CH, RGPD MC, PDPA SG, CAN-SPAM
US) et scraping Google Maps hors-CGU. SES : domaine vérifié + SPF/DKIM/DMARC +
warm-up + gestion bounces. Ciblez **B2B**, gardez l'opt-out actif, **excluez le JP
du cold-email pur**.
