# Produire la démo d'un prospect

Mode opératoire complet, du prospect brut au site livré. Chaque étape a une
commande ou un critère vérifiable. L'exemple de référence est le
[Garage du Centre](../clients/garage-du-centre.json), à Crissier.

```
qualifier → collecter → géo → photos → charte → fiche → déployer → contrôler → envoyer
                                                                         ↓
                                                          paiement → livrer sans filigrane
```

Compter **30 à 45 minutes** pour un prospect soigné. Les étapes 3 à 5 sont
celles qui font la différence entre un gabarit et un site qu'il reconnaît.

---

## 1. Qualifier

Le prospect doit **ne pas avoir de site**. C'est le seul critère éliminatoire.

```bash
# La fiche annuaire indique-t-elle un site ?
#   local.ch  /  search.ch  /  moneyhouse.ch
```

Sur `local.ch`, le champ « site web » absent suffit. Vérifier quand même qu'il
n'a pas une page Facebook servant de site : dans ce cas l'argumentaire change
(« votre page n'apparaît pas dans Google »), il n'est pas perdu.

Noter aussi les **concurrents proches**. À Crissier, AMAG et Emil Frey sont à
quelques centaines de mètres : ça a dicté l'angle « vous parlez directement au
mécanicien », qui est l'avantage d'un indépendant face aux concessions.

## 2. Collecter les données réelles

Tout ce qui figurera sur le site doit venir d'une source, pas d'une supposition.

| Donnée | Où la trouver |
|---|---|
| Raison sociale exacte | moneyhouse.ch, registre du commerce |
| Adresse, téléphone | local.ch, search.ch |
| Horaires | local.ch |
| Prestations | fiche annuaire, enseigne, page Facebook |

Ce qui est déduit plutôt que constaté doit être **relu avant envoi**. Un
garagiste repère immédiatement une prestation qu'il ne propose pas.

## 3. Géolocaliser et cadrer Street View

```bash
node tools/prospect-geo.mjs "Rue du Centre 9, 1023 Crissier, Suisse"
```

Sort le bloc `streetview` prêt à coller. Le script écarte les chemins de
service et les trottoirs — souvent plus proches mais **sans couverture Street
View** — et calcule le cap depuis la voirie publique vers l'adresse.

Sans ce cap, Street View regarde plein nord et cadre le trottoir d'en face.

⚠️ **Contrôler le panorama à l'œil** avant envoi. Le calcul vise le point
d'adresse, pas la vitrine : sur un bâtiment en angle ou en retrait, il faut
corriger `heading` de 20 à 40°.

## 4. Photos

Par ordre de préférence :

1. **Photos prises sur place** — imbattable, et c'est déjà un argument de vente.
2. Photos de sa fiche Google Business — vérifier les droits avant industrialisation.
3. Street View seul, sans photo — acceptable, le site reste crédible.
4. Banque d'images — **dernier recours**. Un commerçant voit tout de suite que
   ce n'est pas chez lui.

Recadrer aux rapports attendus par le gabarit :

```bash
pwsh tools/crop-photo.ps1 -Image IMG_7714.jpeg -X 0 -Y 1500 -W 3213 -H 2410 `
     -Out clients/garage-du-centre/facade.jpg -TargetWidth 1400   # hero, 4/3
pwsh tools/crop-photo.ps1 -Image IMG_7715.jpeg -X 0 -Y 2100 -W 3213 -H 2142 `
     -Out clients/garage-du-centre/panda.jpg -TargetWidth 1200    # galerie, 3/2
```

Viser 100 à 200 Ko par image. Le rapport doit être respecté au recadrage, sinon
le navigateur rogne au centre et coupe l'enseigne.

**Ce qu'on ne publie pas** : le logement privé au-dessus du commerce, les
fenêtres d'habitation, les personnes identifiables. Un recadrage de la cour du
Garage du Centre tombait sur le balcon du propriétaire — écarté.

## 5. Reprendre sa charte

C'est l'étape qui transforme un gabarit en proposition personnelle. Le
commerçant doit reconnaître **ses** couleurs.

### Couleurs

```bash
pwsh tools/sign-colors.ps1 -Image IMG_7714.jpeg -X 885 -Y 1840 -W 1400 -H 1100
```

Donne le fond et le lettrage du panneau. Les valeurs sont celles de la photo :

- Un panneau **à l'ombre** sort terne. Remonter la luminosité en gardant la
  teinte. Relevé `#A49577` sur l'or du Garage du Centre → retenu `#DCC79B`.
- Vérifier ensuite le contraste. **Un accent clair n'est jamais lisible en
  petit texte sur fond clair** : il ne sert que sur aplat de la couleur
  dominante ou en fond de bouton. Sur fond clair, les libellés prennent la
  couleur dominante.

Reporter dans `seo.theme`. Seul `brand` et `accent` sont nécessaires, la teinte
foncée est dérivée par calcul.

### Police

Photographier le lettrage de près et l'agrandir. Les indices utiles :

- **fûts évasés** (extrémités élargies) → famille Optima
- petites amorces de serif → Copperplate, Albertus
- géométrie pure, O parfaitement rond → Futura, Avenir

Pour le Garage du Centre : fûts évasés, O et C très circulaires, contraste
modéré → **Optima**. Sur le web, `Julius Sans One` est l'approximation libre la
plus proche, avec `Optima` déclarée juste après dans la pile.

**Réserver cette police à la marque.** Composer tout le site dans un caractère
d'enseigne donne une allure de maison de mode. Le texte courant garde une
grotesque lisible — c'est ainsi que fonctionnent les vraies chartes.

### Pictogramme

Si l'enseigne porte un motif, le **redessiner** en SVG dans `MARKS`
(`sitegen/build.js`), puis référencer sa clé dans `seo.logo_mark`.

Ne pas vectoriser automatiquement : sur un filet fin photographié de biais,
avec des artefacts JPEG, un auto-traçage produit des doubles contours sales et
une perspective faussée. Un redessin propre vaut mieux qu'un calque sale.

⚠️ **Contrôler le tracé en le rasterisant avant publication.** La première
version du motif du Garage du Centre donnait une berline américaine des années
70 au lieu d'une berlinette basse. Vu seulement après rendu.

Les formes sont codées dans le générateur, jamais acceptées depuis les données :
injecter du SVG venu de l'extérieur ouvrirait une faille (script, gestionnaires
d'événements).

## 6. Rédiger la fiche

Copier [`clients/_modele.json`](../clients/_modele.json) et remplir.

Règles de rédaction :

- **Écrire du côté du client final**, pas du commerçant. « Vous repartez avec
  un véhicule de remplacement », pas « nous mettons à disposition ».
- **Un `h1` qui dit l'activité et la ville.** C'est la requête qu'on vise.
- **Le téléphone est la conversion.** Pas de formulaire : la clientèle d'un
  commerce de quartier appelle.
- Chercher **la spécificité du métier dans la région**. En Suisse romande, la
  préparation à l'expertise est ce qu'un garage vend vraiment — un gabarit
  générique l'ignore, et c'est ce qui fait dire « il connaît le métier ».
- Les `alt` décrivent ce qu'on voit, pas « photo du commerce ».

## 7. Déployer

```bash
export SITEGEN_TOKEN=...              # ou $env:SITEGEN_TOKEN sous Windows
docker compose up -d sitegen          # ou : cd sitegen && node server.js
node tools/deploy-client.mjs clients/garage-du-centre.json
```

Le filigrane est actif par défaut. Le projet Cloudflare Pages est créé
automatiquement au premier déploiement.

## 8. Contrôler

```bash
node tools/verify-live.mjs https://oueb-garage-du-centre-crissier.pages.dev
```

Le script vérifie la **structure** de la page, pas la présence de chaînes : une
démo a été publiée avec sa feuille de style coupée en deux alors que tous les
contrôles « la couleur est-elle là ? » passaient au vert. Il va aussi chercher
chaque image référencée.

Puis **ouvrir la page** et regarder. Ce qu'aucun script ne voit :

- [ ] Le panorama Street View cadre bien la devanture
- [ ] Le pictogramme ressemble à l'enseigne
- [ ] Les couleurs correspondent à ce qu'on voit sur la façade
- [ ] Aucune photo ne montre de logement privé ni de personne identifiable
- [ ] Le contenu ne prétend rien d'invérifié (marques, partenariats, prestations)

## 9. Envoyer

Le lien à communiquer est **`url`**, l'alias stable du projet — jamais
`deployment_url`, figée sur un déploiement : le prospect y verrait encore la
démo filigranée après avoir payé.

Cadre légal du démarchage : [`compliance.md`](compliance.md). B2B, opt-out
actif, et **pas de cold email pur vers le Japon**.

## 10. Livrer après paiement

```bash
node tools/deploy-client.mjs clients/garage-du-centre.json --paid
node tools/verify-live.mjs https://oueb-garage-du-centre-crissier.pages.dev --paid
```

Le filigrane disparaît sans laisser de trace dans le source, et la page repasse
en `index,follow`. **Même slug, donc même URL** : le lien envoyé en prospection
reste valide.

Achat du domaine et rattachement : [`hosting-registrar.md`](hosting-registrar.md).

---

## Ce qu'on ne fait pas

**Publier le portrait de l'exploitant.** Le visage d'une personne privée sur un
site qu'elle n'a pas commandé pose un problème de droit à l'image et de nLPD,
et se retourne contre l'expéditeur. Prévoir l'emplacement, qu'il remplira
lui-même après achat — c'est un argument de vente.

**Affirmer un partenariat non vérifié.** Le bloc lubrifiants du Garage du
Centre annonce Motorex sans preuve. Plausible pour un garage suisse, mais la
première remarque du garagiste sera « je ne suis pas chez eux ». À confirmer ou
à retirer avant envoi.

**Laisser une démo indexable.** Elle concurrencerait le vrai site du client et
resterait dans l'index Google après suppression. Le `noindex` est automatique
tant que le filigrane est actif — ne pas le contourner.

## Pièges déjà rencontrés

| Symptôme | Cause | Parade |
|---|---|---|
| Le CSS s'affiche en texte sur la page | Un marqueur de gabarit dans un commentaire CSS a fait injecter un bloc de style au milieu de la feuille | `checkStyleNesting`, lancé sur chaque sortie |
| Vignette de partage vide | `og:image` en chemin relatif | Rendue absolue par le serveur |
| `Project not found` au déploiement | `wrangler pages deploy` ne crée le projet qu'en interactif | Création préalable par l'API |
| `spawn npx ENOENT` / `EINVAL` | Node ≥ 20 refuse de lancer un `.cmd` sous Windows | Appel direct de l'entrypoint JS de wrangler |
| Le prospect voit encore le filigrane après paiement | Lien envoyé = URL de déploiement, figée | Toujours communiquer `url` |
| Nom de commerce contenant `$&` cassé | `replaceAll` réinterprète les motifs `$` | Remplacement par fonction |
| Couleur de charte cassant la page | Valeur non hexadécimale injectée dans le CSS | Validation hexadécimale stricte |
| Vignette Wikimedia en erreur 400 | Largeur de vignette non standard | Passer par l'API pour obtenir `thumburl` |
| Street View cadre le trottoir opposé | `heading` absent, ou calculé depuis un chemin de service | `prospect-geo.mjs`, puis contrôle visuel |
