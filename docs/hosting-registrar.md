# Hébergement (Cloudflare Pages) & registrars par localisation

## Hébergement — Cloudflare Pages (gratuit, mondial)

Les sites *one-page* sont **statiques** : générés par `sitegen` (template + JSON IA)
et déployés sur **Cloudflare Pages**. Cloudflare fournit **TLS + CDN mondial
gratuits** — un site pour un client suisse est servi depuis Zurich, un client
japonais depuis Tokyo, sans VPS par région. C'est ce qui remplace WordPress
MultiSite + Caddy On-Demand TLS.

- 1 projet Pages par site (`oueb-<slug>` → `oueb-<slug>.pages.dev` en preview).
- Après paiement : `sitegen /attach-domain` rattache le domaine client au projet,
  le workflow registrar pose le **CNAME** `@ → <projet>.pages.dev`, Cloudflare
  émet le certificat automatiquement.
- Déploiement via `wrangler` (dans le conteneur `sitegen`), auth par
  `CLOUDFLARE_API_TOKEN` (scope **Pages:Edit**) + `CLOUDFLARE_ACCOUNT_ID`.

> **Data residency** : une page vitrine statique ne contient pas de données
> personnelles clients → la localisation edge suffit. Si un jour un formulaire
> collecte des données (surtout CH/nLPD), activer la **Data Localization Suite**
> (payante) ou router ces requêtes vers un backend régional.
>
> **Limite projets** : Cloudflare Pages plafonne le nombre de projets par compte.
> À grande échelle, regrouper plusieurs domaines derrière un seul projet + Worker
> de routage, ou multi-comptes.

## Registrars par localisation (API)

Pas de registrar unique pour tous les ccTLD. Défaut : **Gandi API v5** (couvre
.ch/.li/.jp/.com), avec exceptions à présence locale.

| TLD | Marché | Registrar API | Contrainte |
|-----|--------|---------------|------------|
| `.ch` | 🇨🇭 CH | **Gandi** (`/v5/domain/domains`) | — |
| `.li` | 🇱🇮 LI | **Gandi** | — |
| `.mc` | 🇲🇨 MC | **NIC Monaco** | **présence monégasque requise, quasi pas d'API** → semi-manuel |
| `.sg` | 🇸🇬 SG | registrar accrédité SGNIC | contact admin local parfois requis |
| `.jp` | 🇯🇵 JP | Gandi / Namecheap | **`.co.jp` = présence locale** ; `.jp` général OK |
| `.com` `.us` | 🇺🇸 US | **Cloudflare Registrar** ou Gandi/Namecheap | .us : pas d'anonymisation WHOIS |

**Flux (workflow 2)** : `Gandi /v5/domain/domains` (achat) → `sitegen /attach-domain`
(Cloudflare Pages) → `Gandi LiveDNS` CNAME `@ → <projet>.pages.dev`.

> ⚠️ L'achat Gandi exige un **contact propriétaire** complet (`owner`) et des
> contraintes par TLD (WHOIS, éligibilité). Le node fournit un owner minimal via
> `REGISTRANT_EMAIL` — complétez-le selon vos contacts réels. Pour `.mc`, `.co.jp`
> et `.sg`, prévoyez une étape manuelle : ce sont des contraintes **légales**, pas
> un manque d'API.
