# Oueb — direction artistique du générateur

Oueb génère une composition éditoriale adaptée au métier, pas une succession de
cartes interchangeables. Le même HTML s’adapte grâce à quatre directions :

- `workshop` : typographie dense, géométrie franche, image découpée ; artisans,
  ateliers, garages et métiers de fabrication ;
- `editorial` : rythme de revue, sérif expressive, espaces généreux ; conseil,
  droit, finance et services professionnels ;
- `precision` : grille nette, contraste clinique, repères techniques ; santé,
  ingénierie, laboratoires et technologie ;
- `hospitality` : ouverture cinématographique, palette chaude, photographie
  dominante ; restauration, hôtellerie et bien-être.

Le générateur peut inférer cette direction depuis le secteur. La valeur
`art_direction` permet au contenu validé de l’imposer. Une valeur inconnue est
ignorée : le générateur réinfère la direction depuis le secteur, puis revient à
`editorial` si aucun métier ne correspond.

## Principes

- Le contenu réel détermine les sections rendues ; aucun bloc vide.
- Aucun témoignage, chiffre ou label n’est inventé pour remplir la composition.
- Un CTA commercial appartient au commerce (`primary_cta`). Le lien Stripe reste
  exclusivement dans le filigrane de l’aperçu.
- Les anciens payloads `h2[]` et `sections[]` restent compatibles.
- Couleurs, liens et images sont validés avant insertion ; le contraste du texte
  est dérivé des couleurs de marque.
- Le résultat est statique, sémantique, accessible au clavier et respecte
  `prefers-reduced-motion`.

## Contrôle visuel

`npm --prefix sitegen run preview -- <dossier>` génère quatre pages fictives.
Elles doivent être contrôlées au minimum en 375, 768, 1024 et 1440 pixels avant
une publication du générateur.
