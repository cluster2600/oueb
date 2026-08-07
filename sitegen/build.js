// Construit le HTML statique d'un one-page à partir du JSON SEO/contenu de l'IA.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = readFileSync(join(HERE, "template.html"), "utf8");

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Défauts du filigrane (démo non payée). Le workflow d'encaissement redéploie
// avec watermark:false pour livrer le site propre et indexable.
export const WATERMARK_TEXT = "APERÇU · NON PAYÉ";
export const WATERMARK_CTA = "Activer ce site";

/** Bandeau + motif diagonal répété. Purement CSS/SVG : aucun asset externe,
 *  compatible avec l'hébergement statique Cloudflare Pages. Le style est injecté
 *  ici (et pas dans template.html) pour qu'un site payé n'en garde aucune trace. */
function watermarkMarkup(text, payUrl, ctaLabel) {
  const style =
    "<style>" +
    ".wm-tile{position:fixed;inset:0;z-index:9998;pointer-events:none;" +
    "background-repeat:repeat}" +
    ".wm-bar{position:sticky;top:0;z-index:9999;display:flex;flex-wrap:wrap;gap:12px;" +
    "align-items:center;justify-content:center;padding:10px 16px;background:var(--accent);" +
    "color:#161a22;font-size:14px;font-weight:700;text-align:center}" +
    ".wm-bar a{color:#161a22;text-decoration:underline}" +
    "@media print{.wm-tile{display:none}}" +
    "</style>";
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200">' +
    '<text x="180" y="100" transform="rotate(-30 180 100)" text-anchor="middle" ' +
    'font-family="Segoe UI,Roboto,Helvetica,sans-serif" font-size="24" ' +
    'font-weight="700" fill="rgba(233,237,245,0.09)">' + esc(text) + "</text></svg>";
  // encodeURIComponent neutralise guillemets et chevrons -> sûr en attribut style.
  const uri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  const cta = payUrl ? ` <a href="${esc(payUrl)}">${esc(ctaLabel)}</a>` : "";
  return style + `<div class="wm-bar">${esc(text)}${cta}</div>` +
    `<div class="wm-tile" aria-hidden="true" style="background-image:url('${uri}')"></div>`;
}

export function buildHtml(seo = {}, lang = "en", payUrl = "", opts = {}) {
  const {
    watermark = true,                 // défaut sûr : une démo part filigranée
    watermarkText = WATERMARK_TEXT,
    watermarkCta = WATERMARK_CTA,
  } = opts;

  const sections = []
    .concat((seo.h2 || []).map((h) => ({ heading: h, body: "" })))
    .concat(seo.sections || [])
    .map((s) => {
      const h = s.heading ? `<h2>${esc(s.heading)}</h2>` : "";
      const b = s.body ? `<p>${esc(s.body)}</p>` : "";
      return h || b ? `<section class="card">${h}${b}</section>` : "";
    })
    .join("\n");

  const cta = payUrl
    ? `<a class="cta" href="${esc(payUrl)}">${esc(seo.cta || "Get this site — 500")}</a>`
    : "";

  const fields = {
    __LANG__: esc(lang),
    __TITLE__: esc(seo.title || seo.h1 || ""),
    __META_DESC__: esc(seo.meta_description || ""),
    __H1__: esc(seo.h1 || seo.title || ""),
    __HERO__: esc(seo.hero_subtitle || ""),
    __CTA__: cta,
    __SECTIONS__: sections,
    __FOOTER__: esc(seo.title || ""),
    // Une démo ne doit jamais être indexée : elle concurrencerait le vrai site
    // du client et resterait dans l'index après suppression.
    __ROBOTS__: watermark ? "noindex,nofollow" : "index,follow",
    __WATERMARK__: watermark ? watermarkMarkup(watermarkText, payUrl, watermarkCta) : "",
  };

  // Remplacement par fonction : sinon les motifs `$&` / `$'` présents dans le
  // contenu (noms d'entreprise, texte IA) seraient réinterprétés par replaceAll.
  return Object.entries(fields).reduce(
    (html, [key, value]) => html.replaceAll(key, () => value), TEMPLATE);
}

// Auto-test hors-ligne : node build.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const seo = {
    title: "Cabinet <Durand>", meta_description: "Conseil & audit",
    h1: "Cabinet Durand", hero_subtitle: "Avocats d'affaires",
    h2: ["Domaines"], sections: [{ heading: "Contact", body: "Genève" }],
    cta: "Commander",
  };
  const fail = (m) => { console.error("selfcheck FAIL:", m); process.exit(1); };

  // 1. Démo (défaut) : échappement, CTA de paiement, filigrane, noindex.
  const demo = buildHtml(seo, "fr", "https://buy.stripe.com/test_123");
  if (!demo.includes("Cabinet &lt;Durand&gt;")) fail("titre non échappé");
  if (!demo.includes('href="https://buy.stripe.com/test_123"')) fail("lien paiement absent");
  if (demo.includes("<Durand>")) fail("HTML brut injecté");
  if (!demo.includes("wm-bar") || !demo.includes("wm-tile")) fail("filigrane absent");
  if (!demo.includes('content="noindex,nofollow"')) fail("démo indexable");
  if (demo.includes("__")) fail("placeholder non remplacé");

  // 2. Site payé : plus de filigrane, indexable, contenu intact.
  const paid = buildHtml(seo, "fr", "", { watermark: false });
  if (paid.includes("wm-bar") || paid.includes("wm-tile")) fail("filigrane non retiré");
  if (!paid.includes('content="index,follow"')) fail("site payé non indexable");
  if (!paid.includes("Cabinet Durand")) fail("contenu perdu");

  // 3. Les motifs `$` du contenu ne doivent pas être réinterprétés.
  const dollar = buildHtml({ h1: "Bar $& Grill", title: "Bar $& Grill" }, "en", "");
  if (!dollar.includes("Bar $&amp; Grill")) fail("motif $& corrompu");

  console.log("selfcheck: OK");
}
