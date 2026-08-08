#!/usr/bin/env node
// Contrôle une démo publiée. À lancer APRÈS chaque déploiement.
//
//   node tools/verify-live.mjs https://oueb-<slug>.pages.dev
//   node tools/verify-live.mjs https://... --paid   (site livré, sans filigrane)
//
// Sort en code 1 si un contrôle échoue, pour pouvoir être enchaîné en CI.
//
// Pourquoi ce script existe : chercher une chaîne dans le HTML ne prouve rien.
// Une démo a été publiée avec sa feuille de style coupée en deux alors que tous
// les contrôles « la couleur est-elle présente ? » passaient au vert. On vérifie
// donc la STRUCTURE de la page, puis on va chercher chaque ressource référencée.

import { checkStyleNesting } from "../sitegen/build.js";

const url = process.argv[2];
const paid = process.argv.includes("--paid");
if (!url) {
  console.error("usage : node tools/verify-live.mjs <url> [--paid]");
  process.exit(1);
}

const fails = [];
const ok = [];
const check = (label, pass, detail = "") =>
  (pass ? ok : fails).push(`${label}${detail ? " — " + detail : ""}`);

const html = await (await fetch(url, { cache: "no-store" })).text();

// 1. Structure : une feuille coupée fait s'afficher le CSS en texte.
const nest = checkStyleNesting(html);
check("feuille de style intègre", !nest, nest || "");

// 2. Aucun marqueur de gabarit non remplacé.
const left = html.match(/__[A-Z_]+__/g);
check("aucun marqueur résiduel", !left, left ? left.join(", ") : "");

// 3. Indexation : une démo ne doit jamais être indexable, un site livré si.
const robots = (html.match(/name="robots" content="([^"]+)"/) || [])[1];
check("robots", robots === (paid ? "index,follow" : "noindex,nofollow"), robots);

// 4. Filigrane : présent sur une démo, absent — sans aucune trace — sur un livré.
const wm = html.includes('class="wm-bar"');
check("filigrane", paid ? !wm && !html.includes("wm-") : wm,
  paid ? "doit être absent" : "doit être présent");

// 5. Contenu minimal vendable.
check("titre h1", /<h1>[^<]{3,}<\/h1>/.test(html));
check("téléphone cliquable", /href="tel:\+?\d{6,}"/.test(html));
check("plan d’accès", html.includes("google.com/maps?q="));

// 6. Toutes les ressources référencées doivent répondre.
// Uniquement les `src` : un lien de crédit peut pointer vers une page dont
// l'adresse finit par .jpg sans être une image.
const refs = [...html.matchAll(/src="([^"]+\.(?:jpg|jpeg|png|svg|webp))"/g)]
  .map((m) => new URL(m[1], url).href);
for (const ref of [...new Set(refs)]) {
  try {
    const r = await fetch(ref, { method: "GET" });
    check(`ressource ${ref.split("/").pop()}`, r.ok, `HTTP ${r.status}`);
  } catch (e) { check(`ressource ${ref.split("/").pop()}`, false, e.message); }
}

// 7. og:image doit être absolue, sinon la vignette de partage reste vide.
const og = (html.match(/property="og:image" content="([^"]+)"/) || [])[1];
if (og) check("og:image absolue", /^https?:\/\//.test(og), og);

for (const o of ok) console.log("  ok    " + o);
for (const f of fails) console.error("  ECHEC " + f);
console.log(`\n${ok.length} contrôles passés, ${fails.length} échec(s) — ${url}`);
process.exit(fails.length ? 1 : 0);
