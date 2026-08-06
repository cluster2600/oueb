# Workflows n8n

Deux workflows **importables** (JSON) — dans l'UI (`https://$MAIN_DOMAIN/n8n/`) :
*Workflows → Import from File*.

| Fichier | Workflow |
|---------|----------|
| [`1-outreach.json`](1-outreach.json) | Scraping → Zefix (CH) → Country Router → NVIDIA Nemotron → Stripe → **sitegen/Pages** → Twenty → Kanboard → Listmonk |
| [`2-provisioning.json`](2-provisioning.json) | Webhook Stripe → (paid) → Gandi (domaine) → attach Pages → DNS CNAME → Kanboard → Listmonk |

> Plus de workflow `tls-authorize` : les sites vivent sur **Cloudflare Pages**, qui
> gère le TLS. Le garde-fou On-Demand de Caddy n'existe plus.

Après import : assignez les credentials, activez chaque workflow, vérifiez
`WEBHOOK_URL = https://$MAIN_DOMAIN/`. Les secrets (Stripe, Cloudflare, Gandi,
sitegen, Twenty, Kanboard, Listmonk) arrivent par variables d'environnement du
conteneur n8n (`.env`), lues via `{{$env.XXX}}`.

---

## Workflow 1 — Outreach

| # | Node | Rôle |
|---|------|------|
| 1 | **Schedule Trigger** | quotidien, heures ouvrées |
| 2 | **Set — Query** | `query`, `location`, `country` |
| 3 | **HTTP → Scraper** | `POST scraper:8000/scrape` → leads sans site |
| 4 | **Loop** | itère lead par lead |
| 5 | **HTTP → Zefix (CH)** | `onError: continue` — valide l'entité CH, renvoie canton + UID |
| 6 | **Function — Country Router** | injecte devise, locale, `prompt_key`, `stripe_price_id`, `payment_methods`, TLD ; **canton Zefix → langue** (`GE/VD/VS/NE/JU/FR → ch_fr`, `TI → ch_it`) |
| 7 | **HTTP → NVIDIA Nemotron** | `nvidia/nemotron-3-ultra-550b-a55b` (OpenAI-compatible), contenu + SEO localisés (keigo JP, allemand LI, `us_en`…) ; clé Vault |
| 8 | **HTTP → Stripe** | Payment Link, devise + méthode locale (metadata: `slug`, `project`, `domain_target`, `country`) |
| 9 | **HTTP → sitegen** | `POST sitegen:8080/deploy` (slug, lang, seo, `pay_url`) → **Cloudflare Pages** preview, renvoie l'URL |
| 10 | **HTTP → Twenty** | crée l'opportunity (`stage: NEW`) |
| 11 | **HTTP → Kanboard** | `createTask` (JSON-RPC) — 1 carte = 1 site |
| 12 | **HTTP → Listmonk** | abonné + campagne perso (`preview_url`, `payment_url`) |

Nodes **placeholders désactivés** (non câblés) : `Houjin-Bango enrich (JP)`,
`OpenCorporates enrich (US)` — voir `config/registries.md`.

Le code exact du **Country Router** est dans `1-outreach.json` (node *Country
Router*), miroir de `config/country_matrix.yaml` + `config/prompts.md`.

---

## Workflow 2 — Provisioning (Stripe webhook)

Déclenché à l'encaissement. Abonner le webhook Stripe à `checkout.session.completed`
**+** `checkout.session.async_payment_succeeded`.

| # | Node | Rôle |
|---|------|------|
| 1 | **Webhook** `POST /webhook/stripe` | reçoit l'événement (raw body) |
| 2 | **Function — verify sig** | HMAC SHA-256 ; rejette si invalide |
| 3 | **IF** `data.object.payment_status == "paid"` | ne provisionne QUE si réellement payé |
| 4 | **HTTP → Gandi** | achat du domaine (`/v5/domain/domains`) |
| 5 | **HTTP → sitegen** | `attach-domain` : rattache le domaine au projet Pages, renvoie `cname_target` |
| 6 | **HTTP → Gandi LiveDNS** | CNAME `@ → <projet>.pages.dev` (Cloudflare émet le cert) |
| 7 | **HTTP → Kanboard** | carte "Livré" |
| 8 | **HTTP → Listmonk** | email de livraison |

---

## Paiements locaux (piloté par la devise)

Méthodes locales via les *automatic payment methods* Stripe (à activer une fois
dans le Dashboard) — la **devise** les déclenche :

| Marché | Méthode locale | Devise | Nature |
|--------|----------------|--------|--------|
| 🇨🇭 CH / 🇱🇮 LI | **TWINT** | CHF | immédiat |
| 🇸🇬 SG | **PayNow** (QR) | SGD | quasi-immédiat |
| 🇯🇵 JP | **Konbini** | JPY | **asynchrone** |
| 🇺🇸 US | **ACH** (`us_bank_account`), Link | USD | **ACH asynchrone** |
| 🇲🇨 MC | carte | EUR | immédiat |

> ⚠️ **Konbini et ACH sont asynchrones.** `checkout.session.completed` arrive
> d'abord `unpaid` (bon/mandat émis), puis `checkout.session.async_payment_succeeded`
> au paiement réel. Le Workflow 2 déclenche sur **`payment_status == "paid"`** →
> jamais de site livré avant encaissement. Gérez `async_payment_failed` pour purger.
