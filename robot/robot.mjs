// Robot que lee la clasificación de la Liga Educa y la guarda en la app.
import { chromium } from "playwright";
import fs from "node:fs/promises";
import { interpretar } from "./liga.mjs";

// ---- Qué ligas leer: una línea por equipo ----
const LIGAS = [
  {
    equipo: "benjamin", // "benjamin" o "alevin", igual que en la app
    url: "https://www.educationleague.es/?id_lan=1&id_geo=8&id_spo=1&id_com_gro0=439&sea=2026&id_rac=1&id_age=75&id_com_gro1=465&id_com_sea=1831&id_com_sta=2254&id_sec=335"
  },
  {
    equipo: "alevin",
    url: "https://www.educationleague.es/?id_lan=1&id_geo=8&id_spo=1&id_com_gro0=439&sea=2026&id_rac=1&id_age=77&id_com_gro1=466&id_com_sea=1832&id_com_sta=2271&id_sec=335"
  },
];

const PROJECT = process.env.FIREBASE_PROJECT_ID;
const API_KEY = process.env.FIREBASE_API_KEY || "";

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
    // Guarda también las respuestas JSON/XHR: si la web carga los datos así, es mejor leerlos de ahí.
    const respuestas = [];
    page.on("response", async r => {
      const tipo = r.headers()["content-type"] || "";
      if (!/json|javascript|xml|text\/plain/.test(tipo) && !["xhr", "fetch"].includes(r.request().resourceType())) return;
      try { respuestas.push({ url: r.url(), tipo, cuerpo: (await r.text()).slice(0, 200000) }); } catch {}
    });
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2000);
    const tablas = await page.evaluate(() =>
      [...document.querySelectorAll("table")].map(t =>
        [...t.querySelectorAll("tr")].map(tr => [...tr.querySelectorAll("th,td")].map(c => c.innerText.trim()))));
    await fs.writeFile(`copia/${equipo}.html`, await page.content());
    await fs.writeFile(`copia/${equipo}-respuestas.json`, JSON.stringify(respuestas.filter(x => !/javascript/.test(x.tipo) || x.url.includes("educationleague")), null, 1));
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
