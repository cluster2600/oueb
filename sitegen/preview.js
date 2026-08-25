import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { buildHtml, checkStyleNesting } from "./build.js";

const out = resolve(process.argv[2] || ".artifacts/oueb-preview");
mkdirSync(out, { recursive: true });

const photos = {
  workshop: [
    "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1400&q=85",
    "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1497215842964-222b430dc094?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=1400&q=85",
  ],
  editorial: [
    "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1400&q=85",
    "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1400&q=85",
  ],
  precision: [
    "https://images.unsplash.com/photo-1551601651-2a8555f1a136?auto=format&fit=crop&w=1400&q=85",
    "https://images.unsplash.com/photo-1516841273335-e39b37888115?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1400&q=85",
  ],
  hospitality: [
    "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1400&q=85",
    "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=85",
  ],
};

const base = (direction, name, city) => ({
  title: name,
  brand: name,
  art_direction: direction,
  meta_description: "Démonstration visuelle fictive du générateur Oueb.",
  primary_cta: { label: "Prendre contact", url: "#contact" },
  legal_links: [{ label: "Mentions légales", url: "#contact" }],
  photos: photos[direction].slice(0, 3).map((url, index) => ({
    url,
    alt: index === 0 ? "Image principale du projet fictif" : "Ambiance du projet fictif",
    caption: index ? "Un détail du lieu" : undefined,
  })),
  address: "Adresse fictive",
  city,
  map: false,
  phone: "+41 21 555 01 01",
  email: "contact@example.test",
});

const previews = [
  {
    slug: "workshop",
    seo: {
      ...base("workshop", "Atelier Sillage", "Lausanne"),
      h1: "La matière, justement.",
      logo_mark: "wedge",
      eyebrow: "Menuiserie contemporaine · Lausanne",
      hero_subtitle: "Des pièces sur mesure pensées pour durer, dessinées et façonnées dans un même atelier.",
      theme: { brand: "#173f35", accent: "#f0a63a", surface: "#eee9dd" },
      services_heading: "Du dessin à la pose",
      services: [
        { title: "Agencement", body: "Bibliothèques, cuisines et rangements intégrés adaptés à chaque volume." },
        { title: "Mobilier", body: "Tables, assises et pièces singulières aux lignes simples." },
        { title: "Rénovation", body: "Réparer, adapter et prolonger l’usage de ce qui mérite de rester." },
      ],
      proof: [{ value: "01", label: "atelier, un seul interlocuteur" }, { value: "100%", label: "projets dessinés sur mesure" }],
      about: { eyebrow: "Le geste", title: "Faire moins, mais le faire bien.", body: "Chaque projet commence par le lieu et ses usages.", quote: "Le détail juste ne réclame pas l’attention.", image: photos.workshop[3] },
      process: [{ title: "Écouter", body: "Comprendre le lieu." }, { title: "Dessiner", body: "Mettre les choix à plat." }, { title: "Façonner", body: "Produire et ajuster." }],
    },
  },
  {
    slug: "editorial",
    seo: {
      ...base("editorial", "Étude Ardent", "Genève"),
      h1: "Décider avec clarté.",
      eyebrow: "Conseil juridique · Genève",
      hero_subtitle: "Une lecture précise des situations complexes, formulée dans un langage que vous pouvez utiliser.",
      theme: { brand: "#30263d", accent: "#c99b66", surface: "#f3efe9" },
      services_heading: "Conseil, négociation, résolution",
      services: [
        { title: "Contrats", body: "Clarifier les engagements, les risques et les points de décision." },
        { title: "Gouvernance", body: "Structurer les relations entre associés et direction." },
        { title: "Différends", body: "Préparer une stratégie proportionnée." },
      ],
      about: { eyebrow: "Notre approche", title: "La rigueur n’exclut pas la lisibilité.", body: "Une analyse utile rend le prochain choix plus clair.", quote: "Comprendre d’abord. Conseiller ensuite.", image: photos.editorial[3] },
      process: [{ title: "Cadre", body: "Identifier la question." }, { title: "Options", body: "Comparer les voies." }, { title: "Action", body: "Décider des étapes." }],
    },
  },
  {
    slug: "precision",
    seo: {
      ...base("precision", "Clinique Nova", "Neuchâtel"),
      h1: "Voir plus net.",
      eyebrow: "Centre d’optométrie · Neuchâtel",
      hero_subtitle: "Une consultation attentive, des mesures précises et des explications simples à chaque étape.",
      theme: { brand: "#174f5b", accent: "#66d4c7", surface: "#edf4f3" },
      services_heading: "Votre vision, dans son ensemble",
      services: [
        { title: "Bilan visuel", body: "Évaluer le confort, l’acuité et les usages." },
        { title: "Adaptation", body: "Comparer les solutions et ajuster l’équipement." },
        { title: "Suivi", body: "Observer les évolutions." },
      ],
      proof: [{ value: "45 min", label: "réservées à chaque bilan" }, { value: "01", label: "compte rendu clair" }],
      about: { eyebrow: "Précision humaine", title: "La mesure ne remplace pas l’écoute.", body: "Les résultats prennent leur sens avec vos habitudes.", image: photos.precision[3] },
      process: [{ title: "Échanger", body: "Comprendre les usages." }, { title: "Mesurer", body: "Réaliser le bilan." }, { title: "Expliquer", body: "Présenter les résultats." }],
    },
  },
  {
    slug: "hospitality",
    seo: {
      ...base("hospitality", "Maison Juniper", "Montreux"),
      h1: "La table au rythme des saisons.",
      eyebrow: "Cuisine de marché · Montreux",
      hero_subtitle: "Une cuisine vive, une salle intime et le lac jamais très loin.",
      theme: { brand: "#7a3428", accent: "#e8bd73", surface: "#f2e8da" },
      services_heading: "À table, simplement",
      services: [
        { title: "Déjeuner", body: "Une carte courte pensée pour le marché du jour." },
        { title: "Dîner", body: "Des assiettes à partager et des cuissons au feu." },
        { title: "Tables privées", body: "Un menu composé pour les moments qui rassemblent." },
      ],
      about: { eyebrow: "La maison", title: "Une cuisine précise, sans raideur.", body: "Les produits donnent le tempo.", quote: "Le goût d’abord, le geste juste derrière.", image: photos.hospitality[3] },
      process: [{ title: "Le marché", body: "Choisir les produits." }, { title: "Le feu", body: "Cuire avec franchise." }, { title: "La table", body: "Servir avec attention." }],
    },
  },
];

for (const preview of previews) {
  const html = buildHtml(preview.seo, "fr", "", { watermark: false });
  if (!html.includes('class="art-' + preview.slug + '"'))
    throw new Error("direction absente du rendu " + preview.slug);
  if (!html.includes("<h1>") || /__[A-Z][A-Z_]+__/.test(html))
    throw new Error("rendu incomplet " + preview.slug);
  if (html.includes("wm-") || !html.includes('content="index,follow"'))
    throw new Error("aperçu artistique indexable invalide " + preview.slug);
  const styleError = checkStyleNesting(html);
  if (styleError) throw new Error(preview.slug + " : " + styleError);
  writeFileSync(join(out, preview.slug + ".html"), html);
}

console.log("Previews written to " + out);
