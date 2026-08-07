# Backends navigateur du scraper

Le service `scraper` pilote un navigateur via Playwright. Le backend est
commutable par la variable d'environnement `BROWSER_BACKEND`.

| Valeur | Navigateur | Où il tourne | Coût |
|---|---|---|---|
| `local` *(défaut)* | Chromium | dans le conteneur `scraper` (VPS) | CPU/RAM du VPS |
| `kitesurf` | [Kitesurf](https://blog.cloudflare.com/kitesurf/) | Cloudflare Browser Run (edge) | gratuit en bêta, quotas ci-dessous |

## Kitesurf, en deux mots

Kitesurf est le navigateur *agent-first* annoncé par Cloudflare le 6 août 2026 :
écrit en Rust, compilé en WebAssembly, exécuté dans des isolates V8 sur Workers.
Il abandonne ce qui ne sert qu'aux humains (onglets, extensions, rendu
pixel-perfect) au profit du coût et du passage à l'échelle : **3,1–3,8× moins de
CPU** et **4,7–7× moins de mémoire** que Chromium sur les tâches d'agent
typiques, en échange d'un temps de réponse ~1,8× plus lent sur le screenshot.

Il parle le **Chrome DevTools Protocol**, donc le code Playwright existant est
inchangé — seule la façon d'ouvrir le navigateur diffère (`connect_over_cdp`
au lieu de `launch`).

## Activation

```bash
# .env
BROWSER_BACKEND=kitesurf
CLOUDFLARE_ACCOUNT_ID=<account id>
CLOUDFLARE_API_TOKEN=<token>     # permission « Browser Rendering - Edit »
```

Le même token sert déjà à `sitegen` pour Cloudflare Pages ; il doit alors porter
**les deux** permissions (`Pages:Edit` + `Browser Rendering:Edit`).

Vérification :

```bash
curl -s http://scraper:8000/healthz
# {"ok":true,"browser_backend":"kitesurf","configured":true}
```

`configured:false` signale un backend `kitesurf` sans identifiants — la
mauvaise configuration est visible au déploiement, pas au premier `/scrape`.

Endpoint utilisé :

```
wss://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/browser-run/devtools/browser?browser=kitesurf
Authorization: Bearer <API_TOKEN>
```

## ⚠️ Google Maps : ne bascule pas à l'aveugle

Cloudflare documente explicitement que Kitesurf **ne négocie pas les challenges
anti-bot par empreinte TLS**, et ne gère ni WebGL ni les sessions authentifiées
longues. Or `/scrape` cible Google Maps, qui est massivement protégé et rend ses
résultats via un canvas/WebGL. **Il faut donc considérer que le scraping Google
Maps via Kitesurf échouera probablement**, et le valider avant tout basculement :

1. Tester l'URL réelle dans le playground : <https://kitesurf.cloudflare.app/>
2. Si le panneau `div[role="feed"]` ne se peuple pas, rester en `local`.

Kitesurf est en revanche un très bon candidat pour les usages où la page est du
HTML classique — enrichissement registre (Zefix, houjin bangō), vérification
qu'un prospect n'a effectivement pas de site, contrôle visuel d'un one-page
déployé. C'est là que le gain CPU/mémoire se matérialise sans se heurter aux
protections anti-bot.

Rappel : l'alternative durable au scraping reste l'**API Google Places**
(Text Search + Place Details, champ `website`) — cf. [`compliance.md`](compliance.md).

## Quotas Browser Run

| | Workers Free | Workers Paid |
|---|---|---|
| Usage navigateur / jour | 10 min | illimité (facturé) |
| Navigateurs concurrents | 3 / compte | 120 / compte |
| Nouvelles instances | 1 / 20 s | 1 / s |
| Timeout d'inactivité | 60 s | 60 s (jusqu'à 10 min via `keep_alive`) |
| Débit de requêtes | 1 / 10 s | 10 / s |

Le plan **Free (10 min/jour, 3 concurrents)** est insuffisant pour du scraping de
volume : compter sur le plan Payant si Kitesurf devient le backend principal.
Les dépassements renvoient un `HTTP 429` avec `Retry-After`.

Sources : [blog Cloudflare](https://blog.cloudflare.com/kitesurf/) ·
[docs Kitesurf](https://developers.cloudflare.com/browser-run/kitesurf/) ·
[limites Browser Run](https://developers.cloudflare.com/browser-run/limits/)
