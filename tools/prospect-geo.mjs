#!/usr/bin/env node
// Géolocalise un prospect et calcule le cap de la caméra Street View.
//
//   node tools/prospect-geo.mjs "Rue du Centre 9, 1023 Crissier, Suisse"
//
// Sort un fragment JSON à recopier dans le champ `streetview` du client.
//
// Pourquoi le cap est calculé et non laissé à 0 : sans lui, Street View
// regarde plein nord et cadre le plus souvent le trottoir d'en face. On prend
// donc le point de voirie publique le plus proche et on vise l'adresse depuis
// ce point — c'est l'angle sous lequel un passant voit la façade.

const UA = "oueb-sitegen/1.0 (prospection)";

// Street View ne couvre que la voirie carrossable ouverte : un chemin de
// service ou un trottoir est souvent plus proche mais n'a aucun panorama.
const DRIVABLE = new Set(["residential", "unclassified", "tertiary",
  "secondary", "primary", "living_street"]);

const OVERPASS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

const metres = (a, b) => Math.hypot(
  (b.lon - a.lon) * Math.cos(toRad((a.lat + b.lat) / 2)) * 111320,
  (b.lat - a.lat) * 110540);

function bearing(from, to) {
  const y = Math.sin(toRad(to.lon - from.lon)) * Math.cos(toRad(to.lat));
  const x = Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(toRad(to.lon - from.lon));
  return Math.round((toDeg(Math.atan2(y, x)) + 360) % 360);
}

async function geocode(address) {
  const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
    encodeURIComponent(address);
  const r = await fetch(url, { headers: { "user-agent": UA } });
  const j = await r.json();
  if (!j.length) throw new Error(`adresse introuvable : ${address}`);
  return { lat: +j[0].lat, lon: +j[0].lon, label: j[0].display_name };
}

async function overpass(query) {
  for (const url of OVERPASS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": UA },
        body: "data=" + encodeURIComponent(query),
      });
      const text = await r.text();
      if (text.trimStart().startsWith("{")) return JSON.parse(text);
      console.error(`  ${url} -> réponse non JSON (${r.status})`);
    } catch (e) { console.error(`  ${url} -> ${e.message}`); }
  }
  throw new Error("tous les miroirs Overpass ont échoué");
}

const address = process.argv.slice(2).join(" ");
if (!address) {
  console.error('usage : node tools/prospect-geo.mjs "Rue X 1, 1000 Ville, Suisse"');
  process.exit(1);
}

const point = await geocode(address);
console.error(`adresse : ${point.label}`);

const data = await overpass(
  `[out:json][timeout:25];way(around:80,${point.lat},${point.lon})["highway"];out geom;`);

const roads = [];
for (const way of data.elements || []) {
  let near = null;
  for (const p of way.geometry || []) {
    const d = metres(p, point);
    if (!near || d < near.d) near = { d, p };
  }
  if (near) roads.push({ ...near, hw: way.tags?.highway, name: way.tags?.name || "(sans nom)" });
}
roads.sort((a, b) => a.d - b.d);

console.error("voies proches :");
for (const r of roads.slice(0, 5))
  console.error(`  ${r.d.toFixed(1).padStart(6)} m  ${String(r.hw).padEnd(13)} ${r.name}`);

const road = roads.find((r) => DRIVABLE.has(r.hw));
if (!road) {
  console.error("aucune voirie carrossable publique à moins de 80 m — cap laissé à 0,");
  console.error("à régler à la main après contrôle visuel du panorama.");
}

console.log(JSON.stringify({
  streetview: {
    lat: +point.lat.toFixed(7),
    lng: +point.lon.toFixed(7),
    heading: road ? bearing(road.p, point) : 0,
    fov: 80,
    caption: "La devanture",
  },
  _voie_retenue: road ? `${road.name} (${road.hw}, ${road.d.toFixed(1)} m)` : null,
}, null, 2));
