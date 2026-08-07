# Déployer un one-page sur Cloudflare Pages

Procédure **vérifiée de bout en bout** : deux sites ont été déployés et contrôlés
en ligne (démo filigranée en `noindex`, site livré en `index,follow`).

## 1. Créer le token

<https://dash.cloudflare.com/profile/api-tokens> → *Create Token* → *Custom token*.

| Permission | Portée | Nécessaire pour |
|---|---|---|
| `Cloudflare Pages` : **Edit** | Compte | déploiement des one-pages |
| `Browser Rendering` : **Edit** | Compte | uniquement si `BROWSER_BACKEND=kitesurf` |

L'**Account ID** se lit dans la barre latérale droite de n'importe quel domaine
du dashboard, ou via *Workers & Pages* → *Account details*.

## 2. Renseigner `.env`

```bash
CLOUDFLARE_API_TOKEN=<token>
CLOUDFLARE_ACCOUNT_ID=<account id>
```

`.env` est gitignoré — le secret ne part jamais dans le dépôt.

## 3. Déployer

### Via le service `sitegen` (voie normale, appelée par n8n)

```bash
docker compose up -d sitegen

# Démo filigranée pour un prospect
curl -X POST http://localhost:8080/deploy \
  -H "X-Sitegen-Token: $SITEGEN_TOKEN" -H 'content-type: application/json' \
  -d '{"slug":"cabinet-durand","lang":"fr",
       "pay_url":"https://buy.stripe.com/...",
       "seo":{"h1":"Cabinet Durand","title":"Cabinet Durand",
              "hero_subtitle":"Avocats d’affaires — Genève"}}'
# -> {"project":"oueb-cabinet-durand","url":"https://...pages.dev","watermark":true}
```

### Livraison après paiement

Même slug, filigrane retiré — le site devient propre et indexable :

```bash
curl -X POST http://localhost:8080/deploy \
  -H "X-Sitegen-Token: $SITEGEN_TOKEN" -H 'content-type: application/json' \
  -d '{"slug":"cabinet-durand","lang":"fr","watermark":false,
       "seo":{...}}'
# -> {"watermark":false}
```

⚠️ `watermark` doit valoir **exactement `false`** ; toute autre valeur (absente,
`null`, `"false"` en chaîne) laisse la démo protégée. C'est volontaire : l'oubli
doit produire un site filigrané, jamais un site livré gratuitement.

### Rattacher le domaine du client

```bash
curl -X POST http://localhost:8080/attach-domain \
  -H "X-Sitegen-Token: $SITEGEN_TOKEN" -H 'content-type: application/json' \
  -d '{"project":"oueb-cabinet-durand","domain":"cabinet-durand.ch"}'
# -> {"ok":true,"cname_target":"oueb-cabinet-durand.pages.dev"}
```

Puis pointer un CNAME du domaine vers `cname_target` (achat + DNS via Gandi :
cf. [`hosting-registrar.md`](hosting-registrar.md)).

### Sans Docker (test manuel)

```bash
cd sitegen && npm install
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... SITEGEN_TOKEN=... node server.js
```

## Vérifier un déploiement

```bash
curl -s https://<projet>.pages.dev | grep -o 'content="[a-z,]*follow"'
#   noindex,nofollow -> démo filigranée
#   index,follow     -> site payé, livré
```

## Notes

- `wrangler login` (OAuth navigateur) suffit pour un test manuel, mais les
  conteneurs `sitegen`/n8n ont besoin du **token dans `.env`** : ils tournent en
  environnement non interactif.
- **Le projet Pages n'est PAS créé automatiquement** en non-interactif :
  `wrangler pages deploy` échoue avec « Project not found ». `sitegen` le crée
  donc au préalable via l'API (`ensureProject`, idempotent).
- **Utilise toujours `url` (alias stable `<projet>.pages.dev`)** dans les cold
  emails, jamais `deployment_url`. Cette dernière est figée sur un déploiement :
  le prospect y verrait encore la démo filigranée après avoir payé. Son
  sous-domaine à deux niveaux n'est d'ailleurs pas couvert par le certificat
  `*.pages.dev` et échoue en TLS.
- Un token Cloudflare *account-scoped* (préfixe `cfat_`) renvoie `401` sur
  `/user/tokens/verify` tout en étant parfaitement valide : ce endpoint est
  user-level. Vérifie-le plutôt sur `/accounts/<id>/pages/projects`.
- `sitegen` invoque l'entrypoint JS de wrangler avec le node courant (pas `npx`) :
  Node ≥ 20 refuse de spawner un `.cmd` sans `shell: true` sous Windows, et un
  shell exposerait le nom de projet à une injection.
- `sitegen/package.json` épingle `wrangler ^3.80` ; la v4 est disponible et
  wrangler affiche un avertissement d'obsolescence. Montée de version à tester
  séparément (changements de rupture possibles sur `pages deploy`).
- npm bloque les postinstall de `workerd`/`esbuild` par défaut. Si `wrangler`
  refuse de démarrer : `npm approve-scripts --allow-scripts-pending` dans
  `sitegen/`.
