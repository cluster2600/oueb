// Génère un one-page statique à partir du contenu éditorial validé.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = readFileSync(join(HERE, "template.html"), "utf8");
const esc = (value) => String(value ?? "").replace(/[&<>"]/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
const hx = (name, value) => name + ":" + value;

export const WATERMARK_TEXT = "APERÇU · NON PAYÉ";
export const WATERMARK_CTA = "Activer ce site";

/* Sécurité et identité visuelle ------------------------------------------ */
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const DIRECTIONS = new Set(["workshop", "editorial", "precision", "hospitality"]);

export function safeUrl(value, options = {}) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (options.anchors && /^#[a-z][\w-]*$/i.test(raw)) return raw;
  if (options.email && /^mailto:[^@\s]+@[^@\s]+$/i.test(raw)) return raw;
  try {
    const parsed = new URL(raw);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

/** Rend absolue une URL servie depuis le site lui-même, notamment og:image. */
export function absoluteUrl(url, siteUrl) {
  const value = String(url || "");
  if (!value || /^[a-z]+:/i.test(value) || value.startsWith("//")) return value;
  if (!siteUrl) return value;
  return String(siteUrl).replace(/\/+$/, "") + "/" + value.replace(/^\.?\//, "");
}

const imageUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const path = raw.split(/[?#]/)[0];
  const relative = /^(?:\.\/|\/)?[a-z0-9][a-z0-9._/-]*(?:\?[^<>"\s]*)?$/i.test(raw);
  if (relative && !path.split("/").includes("..")) return raw;
  return safeUrl(raw);
};
const emailHref = (value) => {
  const email = String(value || "").trim();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? "mailto:" + email : "";
};
const expand = (hex) => hex.length === 4
  ? "#" + [...hex.slice(1)].map((char) => char + char).join("")
  : hex;

export function darken(hex, ratio = 0.36) {
  const normalized = expand(hex);
  const number = parseInt(normalized.slice(1), 16);
  const channels = [(number >> 16) & 255, (number >> 8) & 255, number & 255]
    .map((channel) => Math.max(0, Math.round(channel * (1 - ratio))));
  return "#" + channels.map((channel) => channel.toString(16).padStart(2, "0")).join("");
}

const readableText = (hex) => {
  const number = parseInt(expand(hex).slice(1), 16);
  const channels = [(number >> 16) & 255, (number >> 8) & 255, number & 255]
    .map((channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.42 ? "#171914" : "#ffffff";
};

export function themeBlock(seo = {}) {
  const theme = seo.theme || {};
  const declarations = [];
  const put = (name, value) => {
    if (HEX.test(String(value || ""))) declarations.push(hx(name, value));
  };
  put("--brand", theme.brand);
  put("--accent", theme.accent);
  put("--surface", theme.surface);
  put("--paper", theme.paper);
  put("--ink", theme.ink);
  const deep = HEX.test(String(theme.brand_dark || theme.brand_deep || ""))
    ? (theme.brand_dark || theme.brand_deep)
    : HEX.test(String(theme.brand || "")) ? darken(theme.brand) : "";
  put("--brand-dark", deep);
  if (HEX.test(String(theme.brand || ""))) put("--on-brand", readableText(theme.brand));
  if (HEX.test(String(theme.accent || ""))) put("--on-accent", readableText(theme.accent));
  return declarations.length ? ":root{" + declarations.join(";") + "}" : "";
}

export function artDirection(seo = {}) {
  const explicit = String(seo.art_direction || "").toLowerCase();
  if (DIRECTIONS.has(explicit)) return explicit;
  const category = [seo.category, seo.industry, seo.eyebrow, seo.title, seo.h1]
    .filter(Boolean).join(" ").toLowerCase();
  if (/(restaurant|hôtel|hotel|café|cafe|bistro|bar|boulanger|traiteur|spa)/.test(category))
    return "hospitality";
  if (/(médec|medic|dent|clinique|clinic|laboratoire|lab|ingén|engineer|tech|optique)/.test(category))
    return "precision";
  if (/(garage|atelier|artisan|menuis|mécan|mecanic|construction|carross|cycle)/.test(category))
    return "workshop";
  return "editorial";
}

/* Pictogrammes de marque internes, jamais acceptés comme SVG externe. */
const MARKS = {
  wedge: {
    viewBox: "0 0 300 78",
    bars: [[6, 33, 46], [2, 40, 50], [14, 47, 38]],
    body: "M63 57 L58 47 L96 43 C112 32 128 28 150 27 L182 27 " +
      "L214 40 L272 42 C284 43 292 46 296 50 L290 56 L272 56 " +
      "C268 40 238 40 234 56 L110 57 C106 42 78 42 74 57 Z",
    glass: "M102 42 C116 33 133 31 152 30 L180 30 L206 41 Z",
    details: "M118 48 L268 49 M176 42 L178 52 M278 45 L288 47",
    wheels: [[253, 56, 15, 7], [92, 57, 15, 7]],
  },
};

export function markSvg(key, cls = "mark") {
  const mark = MARKS[key];
  if (!mark) return "";
  const bars = mark.bars.map(([x, y, width]) =>
    '<rect x="' + x + '" y="' + y + '" width="' + width + '" height="3" class="bar"/>'
  ).join("");
  const wheels = mark.wheels.map(([cx, cy, radius, inner]) =>
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '"/>' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + inner + '"/>'
  ).join("");
  return '<svg class="' + esc(cls) + '" viewBox="' + mark.viewBox +
    '" aria-hidden="true" focusable="false">' + bars +
    '<g class="line"><path d="' + mark.body + '"/><path d="' + mark.glass +
    '"/><path d="' + mark.details + '"/>' + wheels + "</g></svg>";
}

/* Utilitaires ------------------------------------------------------------ */
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
  if (seo.map === false) return "";
  return String(seo.map_query ||
    [seo.address, seo.postal_code, seo.city].filter(Boolean).join(" ")).trim();
}

const addressText = (seo) =>
  [seo.address, [seo.postal_code, seo.city].filter(Boolean).join(" ")]
    .filter(Boolean).join(", ");
const photoObject = (value) => typeof value === "string" ? { url: value } : (value || {});
const renderImage = (photo, attrs = "") => {
  const item = photoObject(photo);
  const src = imageUrl(item.url);
  return src
    ? '<img src="' + esc(src) + '" alt="' + esc(item.alt || "") + '" ' + attrs + ">"
    : "";
};
const primaryAction = (seo) => {
  const configured = seo.primary_cta || {};
  const url = safeUrl(configured.url, { anchors: true, email: true });
  if (url) return { label: configured.label || seo.cta || "Nous contacter", url };
  const tel = telHref(seo);
  if (tel) return { label: seo.cta || seo.phone_label || "Appelez-nous", url: "tel:" + tel };
  const email = emailHref(seo.email);
  if (email) return { label: seo.cta || "Écrivez-nous", url: email };
  return { label: "", url: "" };
};
const serviceList = (seo) => Array.isArray(seo.services) && seo.services.length
  ? seo.services
  : [].concat((seo.h2 || []).map((title) => ({ title })))
    .concat((seo.sections || []).map((section) => ({
      title: section.heading,
      body: section.body,
    })));

/* Blocs ------------------------------------------------------------------ */
function heroBlock(seo) {
  const action = primaryAction(seo);
  const image = renderImage((seo.photos || [])[0], 'loading="eager" width="1400" height="1600"');
  const brand = seo.brand || seo.h1 || seo.title || "";
  const media = image
    ? '<div class="hero__media">' + image + "</div>"
    : '<div class="hero__media"><div class="hero__monogram" aria-hidden="true">' +
      esc(String(brand).trim().slice(0, 1).toUpperCase() || "•") + "</div></div>";
  return '<div class="hero__grid"><div class="hero__copy">' +
    (seo.eyebrow ? '<p class="eyebrow">' + esc(seo.eyebrow) + "</p>" : "") +
    "<h1>" + esc(seo.h1 || seo.title || "") + "</h1>" +
    (seo.hero_subtitle ? '<p class="hero__subtitle">' + esc(seo.hero_subtitle) + "</p>" : "") +
    (action.url ? '<div class="hero__actions"><a class="button" href="' +
      esc(action.url) + '">' + esc(action.label) + "</a>" +
      (seo.hero_note ? '<span class="hero__note">' + esc(seo.hero_note) + "</span>" : "") +
      "</div>" : "") +
    "</div>" + media + "</div>";
}

function proofBlock(seo) {
  const items = Array.isArray(seo.proof)
    ? seo.proof.filter((item) => item?.value || item?.label)
    : [];
  if (!items.length) return "";
  return '<section class="proof" aria-label="' + esc(seo.proof_label || "Repères") +
    '"><div class="shell proof__grid">' + items.map((item) =>
      '<div class="proof__item">' +
      (item.value ? '<strong class="proof__value">' + esc(item.value) + "</strong>" : "") +
      (item.label ? '<span class="proof__label">' + esc(item.label) + "</span>" : "") +
      "</div>").join("") + "</div></section>";
}

function servicesBlock(seo) {
  const items = serviceList(seo).filter((item) => item?.title || item?.body);
  if (!items.length) return "";
  return '<section class="section services" id="services"><div class="shell">' +
    '<div class="section__intro"><p class="eyebrow">' +
    esc(seo.services_tag || "Savoir-faire") + "</p><div><h2>" +
    esc(seo.services_heading || "Ce que nous faisons") + "</h2>" +
    (seo.services_intro ? '<p class="lead">' + esc(seo.services_intro) + "</p>" : "") +
    "</div></div><div>" + items.map((item, index) =>
      '<article class="service"><span class="service__number">' +
      String(index + 1).padStart(2, "0") + "</span>" +
      (item.title ? "<h3>" + esc(item.title) + "</h3>" : "<span></span>") +
      (item.body ? "<p>" + esc(item.body) + "</p>" : "<p></p>") +
      "</article>").join("") + "</div></div></section>";
}

const creditLine = (credit) => {
  if (!credit?.text) return "";
  const url = safeUrl(credit.url);
  const text = url
    ? '<a href="' + esc(url) + '" rel="nofollow noopener">' + esc(credit.text) + "</a>"
    : esc(credit.text);
  return '<p class="credit">' + text + "</p>";
};

function storyBlock(seo) {
  const about = seo.about || {};
  if (!about.title && !about.body && !about.quote && !about.image) return "";
  const image = renderImage(about.image, 'loading="lazy" width="1000" height="1200"');
  return '<section class="section story" id="story"><div class="shell story__grid">' +
    (image ? '<div class="story__media">' + image +
      creditLine(photoObject(about.image).credit) + "</div>" : "") +
    '<div class="story__copy">' +
    (about.eyebrow ? '<p class="eyebrow">' + esc(about.eyebrow) + "</p>" : "") +
    (about.title ? "<h2>" + esc(about.title) + "</h2>" : "") +
    (about.body ? '<p class="lead">' + esc(about.body) + "</p>" : "") +
    (about.quote ? "<blockquote>" + esc(about.quote) + "</blockquote>" : "") +
    "</div></div></section>";
}

function partnerBlock(seo) {
  const partner = seo.partner || {};
  const image = renderImage(partner.image, 'loading="lazy" width="1000" height="800"');
  if (!image && !partner.title && !partner.body) return "";
  return '<section class="section partner"><div class="shell partner__grid">' +
    (image ? "<figure>" + image +
      creditLine(photoObject(partner.image).credit || partner.credit) + "</figure>" : "") +
    "<div>" +
    (partner.tag ? '<p class="eyebrow">' + esc(partner.tag) + "</p>" : "") +
    (partner.title ? "<h2>" + esc(partner.title) + "</h2>" : "") +
    (partner.body ? '<p class="lead">' + esc(partner.body) + "</p>" : "") +
    "</div></div></section>";
}

function galleryBlock(seo) {
  const photos = (seo.photos || []).slice(1).map(photoObject)
    .filter((photo) => imageUrl(photo.url));
  if (!photos.length) return "";
  return '<section class="section gallery" id="gallery"><div class="shell">' +
    '<div class="section__intro"><p class="eyebrow">' +
    esc(seo.gallery_tag || "En images") + "</p><div><h2>" +
    esc(seo.gallery_heading || "Un aperçu du lieu") + "</h2></div></div>" +
    '<div class="gallery__grid">' + photos.map((photo) =>
      '<figure class="gallery__item">' +
      renderImage(photo, 'loading="lazy" width="1200" height="900"') +
      (photo.caption ? "<figcaption>" + esc(photo.caption) + "</figcaption>" : "") +
      creditLine(photo.credit) + "</figure>").join("") +
    "</div></div></section>";
}

function processBlock(seo) {
  const steps = Array.isArray(seo.process)
    ? seo.process.filter((step) => step?.title || step?.body)
    : [];
  if (!steps.length) return "";
  return '<section class="section process" id="process"><div class="shell">' +
    '<div class="section__intro"><p class="eyebrow">' +
    esc(seo.process_tag || "Comment ça marche") + "</p><div><h2>" +
    esc(seo.process_heading || "Simple, clair, humain") + "</h2></div></div>" +
    '<div class="process__grid">' + steps.map((step, index) =>
      '<article class="step"><span class="step__number">' +
      String(index + 1).padStart(2, "0") + "</span>" +
      (step.title ? "<h3>" + esc(step.title) + "</h3>" : "") +
      (step.body ? "<p>" + esc(step.body) + "</p>" : "") +
      "</article>").join("") + "</div></div></section>";
}

function streetviewFrame(seo) {
  const streetview = seo.streetview;
  if (!streetview || streetview.lat == null || streetview.lng == null) return "";
  const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const cbp = "11," + number(streetview.heading, 0) + ",0,0," + number(streetview.fov, 80);
  const src = "https://www.google.com/maps?q=&layer=c&cbll=" +
    number(streetview.lat, 0) + "," + number(streetview.lng, 0) +
    "&cbp=" + cbp + "&output=svembed";
  return '<iframe class="map" title="' + esc(streetview.title || "Vue de la rue") +
    '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="' +
    esc(src) + '"></iframe>';
}

function mapFrame(seo) {
  const query = mapQuery(seo);
  if (!query) return "";
  const src = "https://www.google.com/maps?q=" + encodeURIComponent(query) + "&output=embed";
  return '<iframe class="map" title="' + esc(seo.map_title || "Plan d’accès") +
    '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="' +
    esc(src) + '"></iframe>';
}

function contactBlock(seo) {
  const tel = telHref(seo);
  const email = emailHref(seo.email);
  const address = addressText(seo);
  const query = mapQuery(seo);
  const action = primaryAction(seo);
  const hours = (seo.hours || []).map((item) => typeof item === "string"
    ? esc(item)
    : [item.d, item.h].filter(Boolean).map(esc).join(" · ")).filter(Boolean);
  const links = [
    tel && '<a class="contact__link" href="tel:' + esc(tel) + '">' +
      esc(seo.phone || tel) + "</a>",
    email && '<a class="contact__link" href="' + esc(email) + '">' +
      esc(seo.email) + "</a>",
    address && query && '<a class="contact__link" href="https://www.google.com/maps/search/?api=1&amp;query=' +
      encodeURIComponent(query) + '" rel="noopener">' + esc(address) + "</a>",
  ].filter(Boolean);
  const media = [streetviewFrame(seo), mapFrame(seo)].filter(Boolean);
  if (!links.length && !media.length && !hours.length && !action.url) return "";
  return '<section class="section contact" id="contact"><div class="shell contact__grid"><div>' +
    '<p class="eyebrow">' + esc(seo.contact_tag || "Contact") + "</p><h2>" +
    esc(seo.contact_heading || "Parlons de votre projet") + "</h2>" +
    (seo.contact_intro ? '<p class="lead">' + esc(seo.contact_intro) + "</p>" : "") +
    (links.length ? '<div class="contact__links">' + links.join("") + "</div>" : "") +
    (hours.length ? "<p>" + hours.join("<br>") + "</p>" : "") +
    (action.url ? '<p><a class="button button--light" href="' + esc(action.url) + '">' +
      esc(action.label) + "</a></p>" : "") +
    "</div>" + (media.length ? '<div class="contact__media">' + media.join("") + "</div>" : "") +
    "</div></section>";
}

function footerBlock(seo, brand) {
  const links = (seo.legal_links || []).map((item) => {
    const url = safeUrl(item?.url, { anchors: true });
    return url && item?.label ? '<a href="' + esc(url) + '">' + esc(item.label) + "</a>" : "";
  }).filter(Boolean);
  const location = [seo.address, seo.city].filter(Boolean).join(" · ");
  return '<footer class="site-footer"><div class="shell site-footer__inner"><div><strong>' +
    esc(brand) + "</strong>" + (location ? "<p>" + esc(location) + "</p>" : "") + "</div>" +
    (links.length ? '<nav class="site-footer__links" aria-label="Informations légales">' +
      links.join("") + "</nav>" : "") + "</div></footer>";
}

function navLinks(seo) {
  const links = [];
  if (serviceList(seo).length) links.push(["Services", "#services"]);
  if (seo.about && (seo.about.title || seo.about.body || seo.about.image))
    links.push(["À propos", "#story"]);
  if ((seo.photos || []).length > 1) links.push(["Galerie", "#gallery"]);
  if ((seo.process || []).length) links.push(["Méthode", "#process"]);
  return links.map(([label, href]) => '<a href="' + href + '">' + esc(label) + "</a>").join("");
}

function jsonLd(seo, brand) {
  const data = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: brand || undefined,
    description: seo.meta_description || undefined,
    telephone: seo.phone || undefined,
    email: seo.email || undefined,
    image: imageUrl(photoObject((seo.photos || [])[0]).url) || undefined,
    address: addressText(seo) ? {
      "@type": "PostalAddress",
      streetAddress: seo.address || undefined,
      postalCode: seo.postal_code || undefined,
      addressLocality: seo.city || undefined,
      addressCountry: seo.country || undefined,
    } : undefined,
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/* Filigrane et assemblage ------------------------------------------------ */
function watermarkMarkup(text, payUrl, ctaLabel) {
  const safePayUrl = safeUrl(payUrl);
  const style = "<style>" +
    ".wm-tile{position:fixed;inset:0;z-index:9998;pointer-events:none;background-repeat:repeat}" +
    ".wm-bar{position:sticky;top:0;z-index:9999;display:flex;flex-wrap:wrap;gap:12px;" +
    "align-items:center;justify-content:center;padding:10px 16px;background:#14181d;" +
    "color:#fff;font-size:14px;font-weight:800;text-align:center}" +
    ".wm-bar a{color:#fff;text-decoration:underline}@media print{.wm-tile{display:none}}</style>";
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200">' +
    '<text x="180" y="100" transform="rotate(-30 180 100)" text-anchor="middle" ' +
    'font-family="Arial,sans-serif" font-size="22" font-weight="700" ' +
    'fill="rgba(18,24,32,0.11)">' + esc(text) + "</text></svg>";
  const uri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  const cta = safePayUrl ? ' <a href="' + esc(safePayUrl) + '">' + esc(ctaLabel) + "</a>" : "";
  return style + '<div class="wm-bar">' + esc(text) + cta + "</div>" +
    '<div class="wm-tile" aria-hidden="true" style="background-image:url(\'' +
    uri + "')\"></div>";
}

export function buildHtml(seo = {}, lang = "en", payUrl = "", opts = {}) {
  const watermark = opts.watermark !== false;
  const watermarkText = opts.watermarkText || WATERMARK_TEXT;
  const watermarkCta = opts.watermarkCta || WATERMARK_CTA;
  const brand = seo.brand || seo.h1 || seo.title || "";
  const tel = telHref(seo);
  const ogSource = imageUrl(photoObject((seo.photos || [])[0]).url);
  const ogImage = ogSource ? absoluteUrl(ogSource, seo.site_url) : "";
  const language = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/i.test(String(lang)) ? lang : "en";
  const themeColor = HEX.test(String(seo.theme?.brand_dark || seo.theme?.brand_deep || ""))
    ? (seo.theme.brand_dark || seo.theme.brand_deep)
    : HEX.test(String(seo.theme?.brand || "")) ? darken(seo.theme.brand) : "#0d1d2c";
  const fields = {
    __LANG__: esc(language),
    __TITLE__: esc(seo.title || seo.h1 || brand),
    __META_DESC__: esc(seo.meta_description || ""),
    __ROBOTS__: watermark ? "noindex,nofollow" : "index,follow",
    __THEME_COLOR__: esc(themeColor),
    __OG_IMAGE__: ogImage ? '<meta property="og:image" content="' + esc(ogImage) + '">' : "",
    __JSON_LD__: jsonLd(seo, brand),
    __THEME__: themeBlock(seo),
    __ART_DIRECTION__: artDirection(seo),
    __BRAND__: markSvg(seo.logo_mark) + '<span class="wordmark">' + esc(brand) + "</span>",
    __NAVLINKS__: navLinks(seo),
    __NAVTEL__: tel ? '<a class="nav__cta" href="tel:' + esc(tel) + '">' +
      esc(seo.phone_label || seo.phone || "Appeler") + "</a>" : "",
    __HERO__: heroBlock(seo),
    __PROOF__: proofBlock(seo),
    __SERVICES__: servicesBlock(seo),
    __STORY__: storyBlock(seo),
    __PARTNER__: partnerBlock(seo),
    __GALLERY__: galleryBlock(seo),
    __PROCESS__: processBlock(seo),
    __CONTACT__: contactBlock(seo),
    __FOOTER__: footerBlock(seo, brand),
    __WATERMARK__: watermark ? watermarkMarkup(watermarkText, payUrl, watermarkCta) : "",
  };
  return Object.entries(fields).reduce(
    (html, [key, value]) => html.replaceAll(key, () => value),
    TEMPLATE,
  );
}

/* Contrôles rapides ------------------------------------------------------ */
/** Détecte une feuille de style coupée ou une balise style imbriquée. */
export function checkStyleNesting(html) {
  let depth = 0;
  let max = 0;
  for (const token of html.matchAll(/<\/?style\b[^>]*>/gi)) {
    if (token[0].startsWith("</")) depth--;
    else {
      depth++;
      max = Math.max(max, depth);
    }
    if (depth < 0) return "</style> orphelin";
  }
  if (depth !== 0) return "<style> non fermé";
  if (max > 1) return "<style> imbriqué — la feuille sera coupée";
  return null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fail = (message) => {
    console.error("selfcheck FAIL:", message);
    process.exit(1);
  };
  const seo = {
    title: "Garage <Test>",
    meta_description: "Mécanique & pneus",
    h1: "Garage Test",
    hero_subtitle: "Un atelier indépendant pour les véhicules qui comptent.",
    eyebrow: "Crissier · depuis 1998",
    category: "garage",
    phone: "021 635 22 73",
    dial_code: "+41",
    email: "atelier@example.com",
    address: "Rue du Centre 9",
    postal_code: "1023",
    city: "Crissier",
    country: "CH",
    hours: [{ d: "Lundi – vendredi", h: "08:00 – 18:00" }],
    streetview: { lat: 46.5528545, lng: 6.5780216, heading: 120 },
    theme: { brand: "#0E4C92", accent: "#FFC72C" },
    logo_mark: "wedge",
    proof: [{ value: "25 ans", label: "d’expérience locale" }],
    services: [
      { title: "Service", body: "Entretien" },
      { title: "Expertise", body: "Préparation" },
    ],
    about: { title: "Un métier de confiance", body: "Du diagnostic à la route.", quote: "Le juste geste." },
    process: [{ title: "Écouter", body: "Comprendre le besoin." }],
    photos: [
      { url: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3", alt: "Atelier" },
      { url: "https://images.unsplash.com/photo-1503376780353-7e6692767b70", alt: "Pneus" },
    ],
    primary_cta: { label: "Prendre rendez-vous", url: "#contact" },
  };
  const demo = buildHtml(seo, "fr", "https://buy.stripe.com/test_123");
  if (!demo.includes("Garage &lt;Test&gt;") || demo.includes("<Test>")) fail("échappement HTML");
  if (!demo.includes('href="tel:+41216352273"')) fail("lien téléphone");
  if (!demo.includes("output=svembed") || !demo.includes("cbll=46.5528545,6.5780216"))
    fail("Street View");
  if (!demo.includes("cbp=11,120,0,0,80")) fail("orientation Street View");
  if ((demo.match(/class="service"/g) || []).length !== 2) fail("prestations");
  if (!demo.includes('property="og:image"')) fail("image sociale");
  const relative = buildHtml({
    ...seo,
    site_url: "https://x.pages.dev/",
    photos: [{ url: "./facade.jpg", alt: "Façade" }],
  }, "fr", "");
  if (!relative.includes('content="https://x.pages.dev/facade.jpg"'))
    fail("image sociale relative non absolue");
  if (!relative.includes('src="./facade.jpg"')) fail("source relative altérée");
  if (!demo.includes('class="mark"') || !demo.includes("<circle")) fail("pictogramme");
  if (!demo.includes('<span class="wordmark">')) fail("nom de marque");
  if (buildHtml({ ...seo, logo_mark: undefined }, "fr", "").includes('class="mark"'))
    fail("pictogramme rendu sans configuration");
  if (buildHtml({ ...seo, logo_mark: "inconnu" }, "fr", "").includes('class="mark"'))
    fail("pictogramme inconnu rendu");
  if (!demo.includes("--brand:#0E4C92") || !demo.includes("--brand-dark:#09315d"))
    fail("thème");
  if (!demo.includes("--on-accent:#171914")) fail("contraste");
  if (!demo.includes('class="art-workshop"')) fail("direction artistique");
  if (!demo.includes('content="noindex,nofollow"') || !demo.includes('class="wm-bar"'))
    fail("protection de la démo");
  if (!demo.includes('"@type":"LocalBusiness"')) fail("données structurées");
  if (/__[A-Z][A-Z_]+__/.test(demo)) fail("placeholder restant");

  const paid = buildHtml(seo, "fr", "", { watermark: false });
  if (paid.includes("wm-") || !paid.includes('content="index,follow"')) fail("site payé");
  const legacy = buildHtml(
    { h1: "Petit", h2: ["Un"], sections: [{ heading: "Deux", body: "b" }] },
    "fr",
    "",
  );
  if ((legacy.match(/class="service"/g) || []).length !== 2) fail("ancien schéma");
  if (legacy.includes('class="gallery__grid"') || legacy.includes("google.com/maps"))
    fail("bloc vide");
  const evil = buildHtml({
    h1: "X",
    theme: { brand: "red;}body{display:none}/*", accent: "#FFC72C" },
    primary_cta: { label: "Piège", url: "javascript:alert(1)" },
    photos: [{ url: "javascript:alert(2)" }],
  }, "fr", "");
  if (evil.includes("--brand:red") || evil.includes("}body{") || evil.includes("javascript:"))
    fail("injection");
  if (!evil.includes("--accent:#FFC72C")) fail("couleur valide");
  const script = buildHtml({ h1: "</script><script>alert(1)</script>" }, "fr", "");
  if (script.includes("</script><script>alert")) fail("JSON-LD");
  const dollar = buildHtml({ h1: "Bar $& Grill", title: "Bar $& Grill" }, "en", "");
  if (!dollar.includes("Bar $&amp; Grill")) fail("motif de remplacement");

  const expectedDirections = {
    workshop: { category: "menuiserie" },
    editorial: { category: "conseil" },
    precision: { category: "clinique" },
    hospitality: { category: "restaurant" },
  };
  for (const [direction, data] of Object.entries(expectedDirections)) {
    const inferred = buildHtml({ h1: "Direction", ...data }, "fr", "", { watermark: false });
    if (!inferred.includes('class="art-' + direction + '"'))
      fail("inférence " + direction);
    const explicit = buildHtml({ h1: "Direction", art_direction: direction }, "fr", "", {
      watermark: false,
    });
    if (!explicit.includes('class="art-' + direction + '"'))
      fail("direction explicite " + direction);
  }
  const invalidDirection = buildHtml({ h1: "Direction", art_direction: "inconnue" }, "fr", "");
  if (!invalidDirection.includes('class="art-editorial"')) fail("direction de repli");

  if (safeUrl("#contact", { anchors: true }) !== "#contact") fail("ancre sûre");
  if (safeUrl("mailto:test@example.com", { email: true }) !== "mailto:test@example.com")
    fail("adresse email sûre");
  if (!safeUrl("https://example.com/path").startsWith("https://example.com/path"))
    fail("URL https sûre");
  if (safeUrl("javascript:alert(1)") || safeUrl("#bad anchor", { anchors: true }))
    fail("URL dangereuse acceptée");
  if (absoluteUrl("/image.jpg", "") !== "/image.jpg") fail("URL sans origine");
  if (absoluteUrl("https://example.com/image.jpg", "https://x.pages.dev") !==
      "https://example.com/image.jpg") fail("URL absolue altérée");

  if (telHref({ phone_href: "+41 (0)21 555 01 01" }) !== "+410215550101")
    fail("téléphone explicite");
  if (telHref({ phone: "0041 21 555 01 01" }) !== "+41215550101")
    fail("téléphone international");
  if (telHref({ phone: "021 555 01 01", dial_code: "+41" }) !== "+41215550101")
    fail("téléphone local");

  const optional = buildHtml({
    h1: "Tous les blocs",
    email: "hello@example.com",
    map: false,
    theme: { brand: "#ffffff", accent: "#000000", brand_dark: "#123456" },
    proof: [{ value: "01", label: "repère" }, null],
    partner: {
      tag: "Partenaire",
      title: "Maison locale",
      body: "Une collaboration vérifiée.",
      image: { url: "/partner.jpg", alt: "Partenaire", credit: {
        text: "Photo partenaire",
        url: "https://example.com/credit",
      } },
    },
    about: {
      title: "Notre histoire",
      body: "Un texte court.",
      image: { url: "/story.jpg", alt: "Atelier" },
    },
    photos: [
      { url: "/hero.jpg", alt: "Accueil" },
      { url: "/gallery.jpg", alt: "Galerie", caption: "Un détail" },
    ],
    process: [{ title: "Écouter" }, { body: "Agir" }, null],
    legal_links: [
      { label: "Mentions légales", url: "https://example.com/legal" },
      { label: "Piège", url: "javascript:alert(1)" },
    ],
  }, "français", "", {
    watermarkText: "APERÇU PERSONNALISÉ",
    watermarkCta: "Commander",
  });
  if (!optional.includes('lang="en"')) fail("langue invalide");
  if (!optional.includes('href="mailto:hello@example.com"')) fail("CTA email de repli");
  if (!optional.includes("partner__grid") || !optional.includes("story__grid") ||
      !optional.includes("gallery__grid") || !optional.includes("process__grid"))
    fail("blocs optionnels");
  if (!optional.includes("Photo partenaire") || !optional.includes("Mentions légales"))
    fail("crédits et mentions");
  if (optional.includes("google.com/maps") || optional.includes("javascript:"))
    fail("carte ou lien dangereux rendu");
  if (!optional.includes("APERÇU PERSONNALISÉ") || !optional.includes("--brand-dark:#123456") ||
      !optional.includes("--on-brand:#171914") || !optional.includes("--on-accent:#ffffff"))
    fail("options de thème ou filigrane");

  const workflow = JSON.parse(readFileSync(
    join(HERE, "..", "n8n-workflows", "1-outreach.json"),
    "utf8",
  ));
  const llmNode = workflow.nodes?.find((node) => node.name === "NVIDIA Nemotron (contenu+SEO)");
  const llmBody = String(llmNode?.parameters?.jsonBody || "");
  for (const direction of DIRECTIONS) {
    if (!llmBody.includes(direction)) fail("contrat n8n : " + direction);
  }
  if (!llmBody.includes("Set primary_cta.url to #contact") ||
      !llmBody.includes("Do not add proof, photos, contact details or claims"))
    fail("contrat n8n : garde-fous");

  for (const [name, html] of [
    ["démo", demo],
    ["payé", paid],
    ["ancien schéma", legacy],
    ["injection", evil],
    ["remplacement", dollar],
    ["photo relative", relative],
    ["blocs optionnels", optional],
  ]) {
    const styleError = checkStyleNesting(html);
    if (styleError) fail(name + " : " + styleError);
  }
  console.log("selfcheck: OK");
}
