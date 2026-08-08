#!/usr/bin/env node
// Déploie la démo d'un client depuis sa fiche JSON et son dossier de photos.
//
//   node tools/deploy-client.mjs clients/garage-du-centre.json
//   node tools/deploy-client.mjs clients/garage-du-centre.json --paid
//
// `--paid` retire le filigrane : à n'utiliser qu'après encaissement.
//
// Les photos ne sont pas dans le JSON : le script lit le dossier indiqué par
// `assets_dir` (chemin relatif à la fiche) et les encode. Une fiche reste ainsi
// lisible et versionnable.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error("usage : node tools/deploy-client.mjs <fiche.json> [--paid]");
  process.exit(1);
}
const paid = flags.includes("--paid");

const SITEGEN = process.env.SITEGEN_URL || "http://127.0.0.1:8080";
const TOKEN = process.env.SITEGEN_TOKEN;
if (!TOKEN) { console.error("SITEGEN_TOKEN manquant dans l'environnement"); process.exit(1); }

const client = JSON.parse(readFileSync(file, "utf8"));
const assetsDir = client.assets_dir
  ? resolve(dirname(file), client.assets_dir) : null;

const assets = [];
if (assetsDir) {
  for (const name of readdirSync(assetsDir)) {
    if (!/\.(jpe?g|png|svg|webp)$/i.test(name)) continue;
    assets.push({ name: basename(name),
      data_base64: readFileSync(join(assetsDir, name)).toString("base64") });
  }
}

const body = {
  slug: client.slug,
  lang: client.lang || "fr",
  pay_url: paid ? "" : client.pay_url || "",
  watermark: !paid,
  watermark_text: client.watermark_text,
  watermark_cta: client.watermark_cta,
  assets,
  seo: client.seo,
};

const kb = Math.round(JSON.stringify(body).length / 1024);
console.log(`${client.slug} — ${assets.length} fichier(s), ${kb} Ko, ` +
  (paid ? "SANS filigrane (livraison)" : "avec filigrane (démo)"));

const r = await fetch(`${SITEGEN}/deploy`, {
  method: "POST",
  headers: { "content-type": "application/json", "X-Sitegen-Token": TOKEN },
  body: JSON.stringify(body),
});
const out = await r.text();
console.log(r.status, out);
if (!r.ok) process.exit(1);

const { url } = JSON.parse(out);
console.log(`\nContrôlez maintenant :\n  node tools/verify-live.mjs ${url}${paid ? " --paid" : ""}`);
