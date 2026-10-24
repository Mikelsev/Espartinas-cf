// Robot que lee la clasificación de la Liga Educa y la guarda en la app.
import { chromium } from "playwright";
import fs from "node:fs/promises";

// ---- Qué ligas leer: una línea por equipo ----
const LIGAS = [
  {
    equipo: "benjamin", // "benjamin" o "alevin", igual que en la app
    url: "https://www.educationleague.es/?id_lan=1&id_geo=8&id_spo=1&id_com_gro0=439&sea=2026&id_rac=1&id_age=75&id_com_gro1=465&id_com_sea=1831&id_com_sta=2254&id_sec=335"
  },
  // { equipo: "alevin", url: "PEGA AQUÍ LA DIRECCIÓN DEL ALEVÍN" },
];

const PROJECT = process.env.FIREBASE_PROJECT_ID;
const API_KEY = process.env.FIREBASE_API_KEY || "";

const norm = s => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const COLUMNAS = {
  equipo: ["equipo", "equipos", "club", "nombre"],
  pj: ["pj", "j", "jugados", "partidos", "pjugados"],
  pg: ["pg", "g", "ganados", "v", "pganados"],
  pe: ["pe", "e", "empatados", "x", "pempatados"],
  pp: ["pp", "p", "perdidos", "d", "pperdidos"],
  gf: ["gf", "favor", "golesfavor", "golesaf", "f"],
  gc: ["gc", "contra", "golescontra", "golesec", "c"],
  pts: ["pts", "pt", "puntos", "ptos", "ptos"]
};
const num = s => { const n = parseInt(String(s).replace(/[^\d-]/g, ""), 10); return Number.isFinite(n) ? n : null; };

function interpretar(tablas) {
  let mejor = [];
  for (const filas of tablas) {
    const iCab = filas.findIndex(f => f.filter(c => Object.values(COLUMNAS).some(a => a.includes(norm(c)))).length >= 4);
    if (iCab < 0) continue;
    const cab = filas[iCab].map(norm);
    const col = {};
    for (const [k, alias] of Object.entries(COLUMNAS)) {
      const i = cab.findIndex(c => alias.includes(c));
      if (i >= 0) col[k] = i;
    }
    if (col.pg == null || col.pts == null) continue;
    const res = [];
    for (const f of filas.slice(iCab + 1)) {
      let nombre = col.equipo != null ? f[col.equipo] : f.find(c => /[a-zA-ZÁÉÍÓÚÑáéíóúñ]{3,}/.test(c));
      nombre = (nombre || "").replace(/^\s*\d+[.º)]?\s*/, "").replace(/\s+/g, " ").trim();
      if (!nombre || num(f[col.pg]) == null) continue;
      const fila = { equipo: nombre };
      for (const k of ["pj", "pg", "pe", "pp", "gf", "gc", "pts"]) if (col[k] != null) fila[k] = num(f[col[k]]) ?? 0;
      res.push(fila);
    }
    if (res.length > mejor.length) mejor = res;
  }
  return mejor;
}

const valor = x => typeof x === "number" ? { integerValue: String(x) } : { stringValue: String(x) };
async function guardar(equipo, filas, url) {
  const body = { fields: {
    filas: { arrayValue: { values: filas.map(f => ({ mapValue: { fields: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, valor(v)])) } })) } },
    actualizado: { integerValue: String(Date.now()) },
    fuente: { stringValue: url }
  }};
  const dir = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/equipos/${equipo}/liga/tabla${API_KEY ? "?key=" + API_KEY : ""}`;
  const r = await fetch(dir, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Firebase respondió ${r.status}: ${await r.text()}`);
}

const navegador = await chromium.launch();
await fs.mkdir("copia", { recursive: true });
let fallos = 0;
for (const { equipo, url } of LIGAS) {
  try {
    const page = await navegador.newPage({ locale: "es-ES" });
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2000);
    const tablas = await page.evaluate(() =>
      [...document.querySelectorAll("table")].map(t =>
        [...t.querySelectorAll("tr")].map(tr => [...tr.querySelectorAll("th,td")].map(c => c.innerText.trim()))));
    await fs.writeFile(`copia/${equipo}.html`, await page.content());
    await fs.writeFile(`copia/${equipo}-tablas.json`, JSON.stringify(tablas, null, 1));
    const filas = interpretar(tablas);
    await fs.writeFile(`copia/${equipo}-clasificacion.json`, JSON.stringify(filas, null, 1));
    if (filas.length < 3) throw new Error(`No encontré la clasificación (${tablas.length} tablas en la página)`);
    if (!PROJECT) throw new Error("Falta el secreto FIREBASE_PROJECT_ID");
    await guardar(equipo, filas, url);
    console.log(`✔ ${equipo}: ${filas.length} equipos guardados`);
    await page.close();
  } catch (e) {
    fallos++;
    console.error(`✘ ${equipo}: ${e.message}`);
  }
}
await navegador.close();
process.exit(fallos ? 1 : 0);
