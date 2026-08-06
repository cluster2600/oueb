// Construit le HTML statique d'un one-page à partir du JSON SEO/contenu de l'IA.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = readFileSync(join(HERE, "template.html"), "utf8");

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function buildHtml(seo = {}, lang = "en", payUrl = "") {
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

  return TEMPLATE
    .replaceAll("__LANG__", esc(lang))
    .replaceAll("__TITLE__", esc(seo.title || seo.h1 || ""))
    .replaceAll("__META_DESC__", esc(seo.meta_description || ""))
    .replaceAll("__H1__", esc(seo.h1 || seo.title || ""))
    .replaceAll("__HERO__", esc(seo.hero_subtitle || ""))
    .replaceAll("__CTA__", cta)
    .replaceAll("__SECTIONS__", sections)
    .replaceAll("__FOOTER__", esc(seo.title || ""));
}

// Auto-test hors-ligne : node build.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const html = buildHtml(
    { title: "Cabinet <Durand>", meta_description: "Conseil & audit",
      h1: "Cabinet Durand", hero_subtitle: "Avocats d'affaires",
      h2: ["Domaines"], sections: [{ heading: "Contact", body: "Genève" }],
      cta: "Commander" },
    "fr", "https://buy.stripe.com/test_123");
  const ok = html.includes("Cabinet &lt;Durand&gt;")   // titre échappé
    && html.includes('href="https://buy.stripe.com/test_123"')
    && !html.includes("<Durand>");
  if (!ok) { console.error("selfcheck FAIL"); process.exit(1); }
  console.log("selfcheck: OK");
}
