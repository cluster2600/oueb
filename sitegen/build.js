// Construit le HTML statique d'un one-page à partir du JSON SEO/contenu de l'IA.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = readFileSync(join(HERE, "template.html"), "utf8");

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const WATERMARK_TEXT = "APERÇU · NON PAYÉ";
export const WATERMARK_CTA = "Activer ce site";

/* ------------------------------------------------------------------- thème */
// Couleurs reprises de l'enseigne du commerce. Elles viennent des données, donc
// elles sont validées en hexadécimal strict : sans ça, une valeur comme
// `red;}body{display:none` sortirait de la déclaration et injecterait du CSS.
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const expand = (h) => h.length === 4
  ? "#" + [...h.slice(1)].map((c) => c + c).join("") : h;

/** Assombrit une couleur vers le noir — évite d'exiger une seconde teinte de
 *  bleu dans les données alors qu'une enseigne n'en porte qu'une. */
export function darken(hex, ratio = 0.36) {
  const h = expand(hex);
  const n = parseInt(h.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((v) => Math.max(0, Math.round(v * (1 - ratio))));
  return "#" + ch.map((v) => v.toString(16).padStart(2, "0")).join("");
}

export function themeBlock(seo = {}) {
  const t = seo.theme || {};
  const decls = [];
  const put = (name, val) => { if (HEX.test(String(val || ""))) decls.push(`${name}:${val}`); };

  put("--brand", t.brand);
  put("--accent", t.accent);
  put("--paper", t.paper);
  put("--ink", t.ink);
  // Teinte foncée dérivée si elle n'est pas fournie explicitement.
  if (HEX.test(String(t.brand_deep || ""))) put("--brand-deep", t.brand_deep);
  else if (HEX.test(String(t.brand || ""))) put("--brand-deep", darken(t.brand));

  return decls.length ? `<style>:root{${decls.join(";")}}</style>` : "";
}

/* ------------------------------------------------------------------ icônes */
// Jeu réduit, trait uniforme : ce sont des repères de lecture, pas du décor.
const ICONS = {
  cog: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
  check: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9z"/><path d="M8.5 13l2.5 2.5 4.5-4.5"/>',
  tyre: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.4"/><path d="M12 3v5M12 16v5M3 12h5M16 12h5"/>',
  diag: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M6 13h3l2-4 2 7 2-3h2"/>',
  drop: '<path d="M12 3s6 6.6 6 10.4A6 6 0 0 1 6 13.4C6 9.6 12 3 12 3z"/>',
  car: '<path d="M3 14l2-5.5A2 2 0 0 1 6.9 7h10.2a2 2 0 0 1 1.9 1.5L21 14v4h-3v-2H6v2H3z"/><circle cx="7.5" cy="15.5" r="1.4"/><circle cx="16.5" cy="15.5" r="1.4"/>',
};
const icon = (k) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">${ICONS[k] || ICONS.cog}</svg>`;

/* ------------------------------------------------------------- utilitaires */
/** Lien tel: — `phone_href` explicite sinon on ne garde que les chiffres et
 *  le +. Le préfixe pays vient des données (produit multi-pays), jamais codé. */
export function telHref(seo = {}) {
  if (seo.phone_href) return String(seo.phone_href).replace(/[^\d+]/g, "");
  const raw = String(seo.phone || "").replace(/[^\d+]/g, "");
  if (!raw) return "";
  if (raw.startsWith("+")) return raw;
  if (raw.startsWith("00")) return "+" + raw.slice(2);
  if (raw.startsWith("0") && seo.dial_code)
    return String(seo.dial_code).replace(/[^\d+]/g, "") + raw.slice(1);
  return raw;
}

export function mapQuery(seo = {}) {
  return (seo.map_query ||
    [seo.address, seo.postal_code, seo.city].filter(Boolean).join(" ")).trim();
}

/* ------------------------------------------------------------------ blocs */
function heroBlock(seo) {
  const tel = telHref(seo);
  const photo = (seo.photos || [])[0];
  const media = photo
    ? `<div class="heromedia rise"><img src="${esc(photo.url)}" alt="${esc(photo.alt || "")}" loading="eager" width="1400" height="1050"></div>`
    : `<div class="heromedia empty rise" aria-hidden="true"></div>`;

  const telBlock = tel
    ? `<a class="telblock" href="tel:${esc(tel)}">
         <span class="lbl">${esc(seo.phone_label || "Appelez-nous")}</span>
         <span class="num">${esc(seo.phone || tel)}</span>
       </a>`
    : "";

  return `<section class="hero">
    <div class="rise">
      ${seo.eyebrow ? `<p class="eyebrow">${esc(seo.eyebrow)}</p>` : ""}
      <h1>${esc(seo.h1 || seo.title || "")}</h1>
      ${seo.hero_subtitle ? `<p class="sub">${esc(seo.hero_subtitle)}</p>` : ""}
      ${telBlock}
    </div>
    ${media}
  </section>`;
}

function servicesBlock(seo) {
  // Rétrocompatibilité : les anciens payloads n'ont que h2[]/sections[].
  const list = (seo.services && seo.services.length)
    ? seo.services
    : []
      .concat((seo.h2 || []).map((h) => ({ title: h })))
      .concat((seo.sections || []).map((s) => ({ title: s.heading, body: s.body })));
  if (!list.length) return "";

  const items = list.map((s) => `<li class="item">
      ${icon(s.icon)}
      ${s.title ? `<h3>${esc(s.title)}</h3>` : ""}
      ${s.body ? `<p>${esc(s.body)}</p>` : ""}
    </li>`).join("\n");

  return `<section class="sec"><div class="wrap">
    <div class="sechead">
      <h2>${esc(seo.services_heading || "Prestations")}</h2>
      <span class="tag">${esc(seo.services_tag || "Toutes marques")}</span>
    </div>
    <ul class="grid">${items}</ul>
  </div></section>`;
}

/** Crédit d'image. Obligatoire pour les licences à attribution (CC BY / BY-SA) :
 *  sans lui, la réutilisation n'est pas conforme. */
const creditLine = (c) => {
  if (!c) return "";
  const txt = c.url
    ? `<a href="${esc(c.url)}" rel="nofollow noopener">${esc(c.text)}</a>`
    : esc(c.text);
  return `<p class="credit">${txt}</p>`;
};

/** Marque de lubrifiant (ou tout partenaire) : un packshot et une ligne de
 *  contexte. Rendu seulement si les données le fournissent. */
function partnerBlock(seo) {
  const p = seo.partner;
  if (!p || !p.image) return "";
  return `<section class="sec"><div class="wrap"><div class="partner">
    <figure><img src="${esc(p.image)}" alt="${esc(p.alt || "")}" loading="lazy"></figure>
    <div>
      ${p.tag ? `<div class="cap">${esc(p.tag)}</div>` : ""}
      ${p.title ? `<h3>${esc(p.title)}</h3>` : ""}
      ${p.body ? `<p>${esc(p.body)}</p>` : ""}
      ${creditLine(p.credit)}
    </div>
  </div></div></section>`;
}

function galleryBlock(seo) {
  const rest = (seo.photos || []).slice(1);
  if (!rest.length) return "";
  const figs = rest.map((p) => `<figure><img src="${esc(p.url)}" alt="${esc(p.alt || "")}" loading="lazy" width="900" height="600"></figure>`).join("\n");
  return `<section class="sec"><div class="wrap"><div class="gallery">${figs}</div></div></section>`;
}

const panel = (caption, cls, title, src) =>
  `<div class="panel"><div class="cap">${esc(caption)}</div>
     <div class="frame ${cls}"><iframe title="${esc(title)}" loading="lazy"
       referrerpolicy="no-referrer-when-downgrade" src="${esc(src)}"></iframe></div>
   </div>`;

/** Panorama Street View du lieu réel. L'embed `output=svembed` ne demande pas
 *  de clé API, contrairement à Street View Static. `heading` oriente la caméra
 *  vers la façade — sans lui Google choisit un cap arbitraire. */
function streetview(seo) {
  const sv = seo.streetview;
  if (!sv || sv.lat == null || sv.lng == null) return "";
  const n = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const cbp = `11,${n(sv.heading, 0)},0,0,${n(sv.fov, 80)}`;
  const src = "https://www.google.com/maps?q=&layer=c" +
    `&cbll=${n(sv.lat, 0)},${n(sv.lng, 0)}&cbp=${cbp}&output=svembed`;
  return panel(sv.caption || "La devanture", "sv",
    sv.title || "Vue de la rue", src);
}

function contactBlock(seo, payUrl) {
  const tel = telHref(seo);
  const q = mapQuery(seo);
  const addr = [seo.address, [seo.postal_code, seo.city].filter(Boolean).join(" ")]
    .filter(Boolean).join(", ");

  const hours = (seo.hours || []).map((h) =>
    typeof h === "string"
      ? `<span>${esc(h)}</span>`
      : `<span>${esc(h.d || "")}<b>${esc(h.h || "")}</b></span>`).join("");

  const facts = [
    addr && `<div class="fact"><div class="k">Adresse</div><div class="v">${esc(addr)}</div></div>`,
    tel && `<div class="fact"><div class="k">Téléphone</div><div class="v"><a href="tel:${esc(tel)}">${esc(seo.phone || tel)}</a></div></div>`,
    hours && `<div class="fact"><div class="k">Horaires</div><div class="v hourlist">${hours}</div></div>`,
  ].filter(Boolean).join("\n");

  if (!facts && !q && !seo.streetview) return "";

  const map = q
    ? panel(seo.map_caption || "Plan d’accès", "plan",
        seo.map_title || "Plan d’accès",
        `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`)
    : "";

  const media = [streetview(seo), map].filter(Boolean).join("\n");

  const cta = payUrl
    ? `<a class="cta" href="${esc(payUrl)}">${esc(seo.cta || "Commander ce site")}</a>`
    : "";

  return `<section class="sec contact"><div class="wrap">
    <div class="sechead">
      <h2>${esc(seo.contact_heading || "Nous trouver")}</h2>
      <span class="tag">${esc(seo.contact_tag || "")}</span>
    </div>
    <div class="cols">
      <div><div class="facts">${facts}</div>${cta}</div>
      ${media ? `<div class="media">${media}</div>` : ""}
    </div>
  </div></section>`;
}

/* -------------------------------------------------------------- filigrane */
function watermarkMarkup(text, payUrl, ctaLabel) {
  const style =
    "<style>" +
    ".wm-tile{position:fixed;inset:0;z-index:9998;pointer-events:none;background-repeat:repeat}" +
    // Neutre volontairement : le thème du client étant variable, un bandeau
    // coloré risquerait de passer pour un élément de sa charte.
    ".wm-bar{position:sticky;top:0;z-index:9999;display:flex;flex-wrap:wrap;gap:12px;" +
    "align-items:center;justify-content:center;padding:10px 16px;background:#14181D;" +
    "color:#fff;font-size:14px;font-weight:800;text-align:center}" +
    ".wm-bar a{color:#fff;text-decoration:underline}" +
    "@media print{.wm-tile{display:none}}" +
    "</style>";
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200">' +
    '<text x="180" y="100" transform="rotate(-30 180 100)" text-anchor="middle" ' +
    'font-family="Archivo,Segoe UI,sans-serif" font-size="22" font-weight="700" ' +
    'fill="rgba(18,24,32,0.11)">' + esc(text) + "</text></svg>";
  const uri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  const cta = payUrl ? ` <a href="${esc(payUrl)}">${esc(ctaLabel)}</a>` : "";
  return style + `<div class="wm-bar">${esc(text)}${cta}</div>` +
    `<div class="wm-tile" aria-hidden="true" style="background-image:url('${uri}')"></div>`;
}

/* ------------------------------------------------------------------ build */
export function buildHtml(seo = {}, lang = "en", payUrl = "", opts = {}) {
  const {
    watermark = true,
    watermarkText = WATERMARK_TEXT,
    watermarkCta = WATERMARK_CTA,
  } = opts;

  const tel = telHref(seo);
  const photo = (seo.photos || [])[0];
  const brand = seo.brand || seo.h1 || seo.title || "";

  const fields = {
    __LANG__: esc(lang),
    __TITLE__: esc(seo.title || seo.h1 || ""),
    __META_DESC__: esc(seo.meta_description || ""),
    __OG_IMAGE__: photo ? `<meta property="og:image" content="${esc(photo.url)}">` : "",
    __BRAND__: esc(brand),
    __NAVTEL__: tel
      ? `<a class="navtel" href="tel:${esc(tel)}">${esc(seo.phone || tel)}</a>` : "",
    __HERO__: heroBlock(seo),
    __SERVICES__: servicesBlock(seo),
    __PARTNER__: partnerBlock(seo),
    __GALLERY__: galleryBlock(seo),
    __CONTACT__: contactBlock(seo, payUrl),
    __FOOTER__: `<span>${esc(brand)}</span><span>${esc(
      [seo.address, seo.city].filter(Boolean).join(" · "))}</span>`,
    // Une démo ne doit jamais être indexée : elle concurrencerait le vrai site
    // du client et resterait dans l'index après suppression.
    __THEME__: themeBlock(seo),
    __ROBOTS__: watermark ? "noindex,nofollow" : "index,follow",
    __WATERMARK__: watermark ? watermarkMarkup(watermarkText, payUrl, watermarkCta) : "",
  };

  // Remplacement par fonction : sinon les motifs `$&` / `$'` présents dans le
  // contenu (noms d'entreprise, texte IA) seraient réinterprétés par replaceAll.
  return Object.entries(fields).reduce(
    (html, [key, value]) => html.replaceAll(key, () => value), TEMPLATE);
}

/* -------------------------------------------------------------- selfcheck */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fail = (m) => { console.error("selfcheck FAIL:", m); process.exit(1); };
  const seo = {
    title: "Garage <Test>", meta_description: "Mécanique & pneus",
    h1: "Garage Test", hero_subtitle: "Toutes marques", eyebrow: "Crissier",
    phone: "021 635 22 73", dial_code: "+41",
    address: "Rue du Centre 9", postal_code: "1023", city: "Crissier",
    hours: [{ d: "Lundi – vendredi", h: "08:00 – 18:00" }],
    streetview: { lat: 46.5528545, lng: 6.5780216, heading: 120 },
    partner: {
      image: "https://example.com/barrel.jpg", alt: "Fût", title: "Huiles",
      credit: { text: "Auteur, CC BY-SA 4.0", url: "https://example.com/lic" },
    },
    theme: { brand: "#0E4C92", accent: "#FFC72C" },
    services: [{ title: "Service", body: "Entretien", icon: "cog" },
               { title: "Expertise", body: "Préparation", icon: "check" }],
    photos: [{ url: "https://example.com/1.jpg", alt: "Atelier" },
             { url: "https://example.com/2.jpg", alt: "Pneus" }],
    cta: "Commander",
  };

  // 1. Démo : structure complète, échappement, filigrane, noindex.
  const demo = buildHtml(seo, "fr", "https://buy.stripe.com/test_123");
  if (!demo.includes("Garage &lt;Test&gt;")) fail("titre non échappé");
  if (demo.includes("<Test>")) fail("HTML brut injecté");
  if (!demo.includes('href="tel:+41216352273"')) fail("lien tel: incorrect");
  if (!demo.includes("google.com/maps?q=")) fail("carte absente");
  if (!demo.includes("output=svembed")) fail("Street View absent");
  if (!demo.includes("cbll=46.5528545,6.5780216")) fail("coordonnées Street View perdues");
  if (!demo.includes("cbp=11,120,0,0,80")) fail("cap Street View non appliqué");
  if (!demo.includes("Rue%20du%20Centre%209")) fail("adresse non encodée dans la carte");
  if ((demo.match(/<li class="item">/g) || []).length !== 2) fail("prestations manquantes");
  if (!demo.includes("https://example.com/2.jpg")) fail("galerie absente");
  if (!demo.includes('property="og:image"')) fail("og:image absent");
  if (!demo.includes('class="partner"')) fail("bloc partenaire absent");
  if (!demo.includes("--brand:#0E4C92")) fail("thème non appliqué");
  if (!demo.includes("--brand-deep:#09315")) fail("teinte foncée non dérivée");
  if (!demo.includes("CC BY-SA 4.0")) fail("crédit d'image absent (licence à attribution)");
  if (!demo.includes('content="noindex,nofollow"')) fail("démo indexable");
  if (!demo.includes('class="wm-bar"')) fail("filigrane absent");
  if (demo.includes("__")) fail("placeholder non remplacé");

  // 2. Site payé : aucune trace de filigrane, indexable.
  const paid = buildHtml(seo, "fr", "", { watermark: false });
  if (paid.includes("wm-")) fail("filigrane non retiré");
  if (!paid.includes('content="index,follow"')) fail("site payé non indexable");
  if (!paid.includes("Garage Test")) fail("contenu perdu");

  // 3. Payload minimal (ancien format) : doit rester valide, sans bloc vide.
  const legacy = buildHtml(
    { h1: "Petit", h2: ["Un"], sections: [{ heading: "Deux", body: "b" }] }, "fr", "");
  if (legacy.includes("__")) fail("placeholder non remplacé (legacy)");
  if ((legacy.match(/<li class="item">/g) || []).length !== 2) fail("legacy h2/sections perdus");
  if (legacy.includes("class=\"gallery\"")) fail("galerie vide rendue");
  if (legacy.includes("google.com/maps")) fail("carte rendue sans adresse");
  if (legacy.includes("svembed")) fail("Street View rendu sans coordonnées");
  if (legacy.includes('class="partner"')) fail("bloc partenaire rendu sans données");

  // 4. Une couleur non valide ne doit jamais atteindre la feuille de style.
  const evil = buildHtml(
    { h1: "X", theme: { brand: "red;}body{display:none}/*", accent: "#FFC72C" } }, "fr", "");
  if (evil.includes("--brand:red")) fail("couleur invalide injectée");
  if (evil.includes("}body{")) fail("échappement de la déclaration CSS");
  if (!evil.includes("--accent:#FFC72C")) fail("couleur valide rejetée à tort");
  if (!buildHtml({ h1: "X" }, "fr", "").includes("<style>")) fail("styles de base perdus");

  // 5. Les motifs `$` du contenu ne doivent pas être réinterprétés.
  const dollar = buildHtml({ h1: "Bar $& Grill", title: "Bar $& Grill" }, "en", "");
  if (!dollar.includes("Bar $&amp; Grill")) fail("motif $& corrompu");

  console.log("selfcheck: OK");
}
