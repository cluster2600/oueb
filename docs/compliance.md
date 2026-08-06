# Conformité & délivrabilité (à lire avant le premier envoi)

Ce n'est pas du juridisme : ce sont des contraintes qui **cassent l'usine** si
ignorées (comptes SES suspendus, domaine blacklisté, plaintes, sanctions).

## Cold email — le cadre est différent sur chaque marché

| Marché | Cadre | Règle pratique |
|--------|-------|----------------|
| **JP** 🇯🇵 | 特定電子メール法 (Act on Regulation of Transmission of Specified Electronic Mail) | **Opt-in préalable obligatoire.** Mention émetteur + adresse + opt-out à chaque envoi. Le cold email pur B2C est illégal. |
| **CH/LI** 🇨🇭🇱🇮 | LCD/UWG art. 3(1)(o) + nLPD | Publicité de masse **sans consentement = déloyale**. B2B toléré si lien pro réel + opt-out immédiat. |
| **MC** 🇲🇨 | RGPD (Monaco aligné) + loi 1.165 | Base légale + intérêt légitime documenté + désinscription. |
| **SG** 🇸🇬 | PDPA + Spam Control Act | Opt-out fonctionnel obligatoire, en-tête `<UNSUBSCRIBE>`, pas de numéro trompeur. |
| **US** 🇺🇸 | CAN-SPAM Act | **Le plus permissif** : modèle opt-**out**. En-têtes non trompeurs, objet honnête, **adresse postale physique** dans chaque email, opt-out honoré ≤ 10 jours ouvrés. Pas de consentement préalable requis. Attention **nexus fiscal par État** sur la vente. |

**Conséquence d'ingénierie :** ciblez **B2B uniquement** (établissements, pas
particuliers), gardez un opt-out Listmonk actif (ne jamais retirer `{{ UnsubscribeURL }}`),
tenez un registre des désinscriptions (Listmonk le fait), et **excluez le JP du
cold-email pur** — pour le Japon, passez par un canal opt-in (formulaire, salon,
partenaire) et réservez l'automatisation à la génération de contenu.

## Amazon SES — pré-requis délivrabilité

1. **Domaine d'envoi vérifié** dans SES (pas juste une adresse).
2. **SPF + DKIM + DMARC** publiés (DKIM via SES Easy DKIM ; DMARC `p=quarantine`).
3. **Sortie du sandbox SES** (quota de prod) via demande AWS.
4. **Warm-up** : montée en charge progressive (dizaines → centaines/jour). Un pic
   depuis une IP/domaine neufs = bounce + spam garanti.
5. **Bounces & plaintes** : brancher les notifications SNS de SES sur un webhook
   n8n qui purge les adresses dans Listmonk (sinon SES coupe le compte au-delà de
   ~5 % de bounces / 0,1 % de plaintes).

## Scraping Google Maps

Le scraping de Google Maps **viole les CGU de Google** et l'UI change sans préavis
(le module `scraper/` cassera périodiquement). Pour de la production :

- Préférez l'**API officielle Google Places** (Text Search → Place Details, champ
  `website` absent = pas de site). `scraper/app.py` isole la logique fragile
  derrière `/scrape` : remplacez son implémentation par un appel Places sans
  toucher aux workflows n8n.
- Respectez un rythme humain, un seul thread, et n'extrayez que des données
  professionnelles publiques.

## Domaines & marques

Avant d'acheter un domaine au nom d'un prospect (workflow Provisioning), vérifiez
l'absence de marque déposée et n'enregistrez le domaine **qu'après paiement**
(déjà le cas : achat déclenché par le webhook Stripe).
