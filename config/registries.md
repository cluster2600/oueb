# Registres du commerce — enrichissement & validation des leads

Enrichir un lead via un registre **officiel** est plus fiable et plus conforme que
le scraping : on valide que l'entité existe et est **active**, on récupère la
**raison sociale exacte**, l'**identifiant fiscal** (pour la facturation) et le
**siège** (→ langue). Intégré au workflow Outreach pour la Suisse (node « Zefix
enrich (CH) »).

## 🇨🇭 Suisse — Zefix (intégré)

API REST publique JSON de la Confédération (index central des raisons de commerce).

- Base : `https://www.zefix.admin.ch/ZefixPublicREST/`
- Swagger : `https://www.zefix.admin.ch/ZefixPublicREST/swagger-ui/`
- Recherche : `POST /api/v1/firm/search`
  ```json
  { "name": "Cabinet Durand", "activeOnly": true }
  ```
  → liste d'objets `{ name, uid, chid, legalForm, legalSeat, canton, status, ... }`
- Détail : `GET /api/v1/firm/{uid}` → adresse, but, capital, statut.

Usage dans oueb :
- **Validation** : `activeOnly:true` écarte les entités radiées.
- **UID** (`CHE-xxx.xxx.xxx`) : requis sur les factures suisses → stocké dans le lead.
- **Canton → langue** : le Country Router route `GE/VD/VS/NE/JU/FR → ch_fr`,
  `TI → ch_it`, sinon `ch_de`. C'est ce qui rend le multilingue suisse automatique.

> Auth : l'accès public est en JSON sans clé, mais soumis à des quotas et aux
> conditions Zefix en vigueur. Si une authentification **Basic** est requise sur
> votre accès, ajoutez-la dans le node HTTP « Zefix enrich (CH) » (credential
> `httpBasicAuth`). Le node est en `onError: continueRegularOutput` : hors CH ou
> sans correspondance, le workflow continue sans enrichissement.

## 🇯🇵 Japon — 法人番号 (Corporate Number, 国税庁)

API officielle et gratuite de l'Agence nationale des impôts.

- Doc : `https://www.houjin-bangou.nta.go.jp/webapi/`
- Nécessite un **app_id** gratuit (inscription). Recherche par nom ou par numéro à
  13 chiffres → nom officiel, adresse, statut.
- Intérêt : valider l'entité JP et obtenir le **nom légal exact** (crucial pour un
  rendu keigo correct et une facturation propre). Même schéma d'intégration que
  Zefix (node HTTP avant le Country Router, branche JP).

## 🇸🇬 Singapour — ACRA via data.gov.sg

- Jeu de données « ACRA Information on Corporate Entities » exposé en API par
  `data.gov.sg` (gratuit). L'API ACRA BizFile officielle est payante.
- Valide l'UEN (Unique Entity Number) et le statut « live ».

## 🇱🇮 Liechtenstein — Handelsregister

- Portail `https://handelsregister.li` — recherche en ligne, **pas d'API JSON
  publique propre** à ce jour. Enrichissement manuel ou via prestataire.

## 🇲🇨 Monaco — Répertoire du Commerce et de l'Industrie (RCI)

- Consultable en ligne, **pas d'API ouverte**. Validation manuelle.

## 🇺🇸 États-Unis — pas de registre national

- L'enregistrement des sociétés est **par État** (Secretary of State) : aucune API
  fédérale unique et gratuite. Data.gov agrège partiellement, sans couverture fiable.
- Agrégateur commercial : **OpenCorporates** (`https://api.opencorporates.com`,
  `GET /v0.4/companies/search?q=...&api_token=...`) — **payant** au-delà d'un usage
  minimal. Node placeholder **désactivé** dans `1-outreach.json`
  (`OpenCorporates enrich (US) — PLACEHOLDER`, env `OPENCORPORATES_API_TOKEN`).
- En pratique pour les USA : s'appuyer sur les données Google Places (le lead a
  déjà nom/adresse) et valider au cas par cas ; l'enrichissement registre n'est pas
  bloquant côté cold-email (CAN-SPAM n'exige pas d'immatriculation vérifiée).

---

### Récapitulatif d'intégration

| Marché | Source officielle | API JSON | Auto dans oueb |
|--------|-------------------|:--------:|:--------------:|
| CH | Zefix | ✅ publique | ✅ (canton→langue, UID) |
| JP | 法人番号 NTA | ✅ (app_id gratuit) | à activer (même patron) |
| SG | ACRA / data.gov.sg | ✅ gratuite | à activer |
| LI | Handelsregister | ❌ | manuel |
| MC | RCI | ❌ | manuel |
| US | Secretary of State (par État) / OpenCorporates | ⚠️ payant | placeholder |
