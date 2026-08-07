// Service sitegen : build statique + déploiement Cloudflare Pages.
// Appelé par n8n (comme le scraper). Un projet Pages par site client.
//
//   POST /deploy         {slug, lang, seo, pay_url, watermark}  -> {url, project, watermark}
//   POST /attach-domain  {project, domain}                      -> {ok, domain}
//   (header X-Sitegen-Token)
//
// `watermark` vaut true par défaut : toute démo envoyée à un prospect part
// filigranée et en noindex. Le workflow 2 (post-paiement) redéploie le même
// slug avec watermark:false pour livrer le site propre et indexable.
//
// Env : SITEGEN_TOKEN, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
// wrangler lit CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID depuis l'env.
import express from "express";
import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { buildHtml } from "./build.js";

const run = promisify(execFile);
const app = express();
app.use(express.json({ limit: "1mb" }));

const TOKEN = process.env.SITEGEN_TOKEN || "";
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";

const auth = (req, res, next) =>
  TOKEN && req.get("X-Sitegen-Token") === TOKEN ? next() : res.status(401).json({ error: "bad token" });

const projectName = (slug) => ("oueb-" + String(slug || "site")).slice(0, 54);

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.post("/deploy", auth, async (req, res) => {
  const { slug, lang = "en", seo = {}, pay_url = "", watermark = true } = req.body || {};
  if (!slug || !seo.h1) return res.status(400).json({ error: "slug + seo.h1 requis" });

  // Seul un false explicite retire le filigrane (une valeur absente ou douteuse
  // doit laisser la démo protégée).
  const wm = watermark !== false;
  const project = projectName(slug);
  const dir = mkdtempSync(join(tmpdir(), "site-"));
  try {
    writeFileSync(join(dir, "index.html"), buildHtml(seo, lang, pay_url, { watermark: wm }));
    // wrangler crée le projet Pages s'il n'existe pas, puis déploie.
    const { stdout } = await run("npx", [
      "--yes", "wrangler", "pages", "deploy", dir,
      "--project-name", project, "--branch", "production", "--commit-dirty=true",
    ], { env: process.env, timeout: 120000 });
    const m = stdout.match(/https:\/\/[^\s]+\.pages\.dev/);
    res.json({ project, url: m ? m[0] : `https://${project}.pages.dev`, watermark: wm });
  } catch (e) {
    res.status(500).json({ error: String(e.stderr || e.message).slice(0, 500) });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

app.post("/attach-domain", auth, async (req, res) => {
  const { project, domain } = req.body || {};
  if (!project || !domain) return res.status(400).json({ error: "project + domain requis" });
  // Attache un domaine custom au projet Pages. Le DNS du domaine doit ensuite
  // pointer (CNAME) vers <project>.pages.dev — géré par le workflow registrar.
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/pages/projects/${project}/domains`,
    { method: "POST",
      headers: { Authorization: `Bearer ${CF_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ name: domain }) });
  const j = await r.json();
  if (!j.success) return res.status(502).json({ error: j.errors || "cloudflare error" });
  res.json({ ok: true, domain, cname_target: `${project}.pages.dev` });
});

app.listen(8080, () => console.log("sitegen on :8080"));
