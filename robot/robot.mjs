// Robot que lee la web de cada liga (clasificación, calendario y resultados) y lo guarda en la app.
// Liga Educa (Espartinas CF) y Gesliga (COTI FC).
import { chromium } from "playwright";
import fs from "node:fs/promises";
import { interpretar, partidosDeTablas, planPartidos, partidosGesliga } from "./liga.mjs";

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
  {
    equipo: "coti", fuente: "gesliga",
    url: "https://gesliga.com/Calendario.aspx?Liga=511988"
  },
];

const PROJECT = process.env.FIREBASE_PROJECT_ID;
const API_KEY = process.env.FIREBASE_API_KEY || "";

// ---- Firestore por REST ----
const BASE = () => `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const conClave = (url, extra = []) => url + "?" + [...extra, API_KEY && "key=" + API_KEY].filter(Boolean).join("&");
const valor = x => typeof x === "boolean" ? { booleanValue: x }
  : typeof x === "number" ? { integerValue: String(x) } : { stringValue: String(x) };
const deValor = v => "integerValue" in v ? +v.integerValue : "doubleValue" in v ? v.doubleValue
  : "booleanValue" in v ? v.booleanValue : "stringValue" in v ? v.stringValue : null;
const campos = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, valor(v)]));

async function pedir(url, opciones) {
  const r = await fetch(url, opciones);
  if (!r.ok) throw new Error(`Firebase respondió ${r.status}: ${await r.text()}`);
  return r.json();
}

async function guardarTabla(equipo, filas, url) {
  const body = { fields: {
    filas: { arrayValue: { values: filas.map(f => ({ mapValue: { fields: campos(f) } })) } },
    actualizado: { integerValue: String(Date.now()) },
    fuente: { stringValue: url }
  }};
  await pedir(conClave(`${BASE()}/equipos/${equipo}/liga/tabla`),
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

async function leerPartidos(equipo) {
  const docs = [];
  let token = "";
  do {
    const r = await pedir(conClave(`${BASE()}/equipos/${equipo}/partidos`, ["pageSize=300", token && "pageToken=" + token]));
    for (const d of r.documents || [])
      docs.push({ id: d.name.split("/").pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, deValor(v)])) });
    token = r.nextPageToken || "";
  } while (token);
  return docs;
}

// Escribe solo los campos indicados (updateMask): lo demás del documento (goles, citación…) se queda igual.
async function guardarPartido(equipo, id, datos) {
  const mascara = Object.keys(datos).map(k => "updateMask.fieldPaths=" + k);
  await pedir(conClave(`${BASE()}/equipos/${equipo}/partidos/${id}`, mascara),
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: campos(datos) }) });
}

// ---- Leer la web ----
// Texto de cada celda. Si la celda tiene un enlace a un mapa (la liga lo pone al publicar la hora),
// se añade como «[[MAPA:url]]» para que liga.mjs lo recoja.
const leerTablas = page => page.evaluate(() => {
  const MAPA = /google\.[a-z.]+\/maps|maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl|maps\.apple|waze\.com|openstreetmap/i;
  const enlaces = c => [...c.querySelectorAll("a[href]")].map(a => a.href).filter(h => MAPA.test(h)).map(h => ` [[MAPA:${h}]]`).join("");
  return [...document.querySelectorAll("table")].map(t =>
    [...t.querySelectorAll("tr")].map(tr => [...tr.querySelectorAll("th,td")].map(c => (c.innerText.trim() + enlaces(c)).trim())));
});
// HTML de las filas de nuestros partidos (para ver qué publica la liga en cada una)
const filasNuestras = page => page.evaluate(() =>
  [...document.querySelectorAll("tr")].filter(tr => !tr.querySelector("table") && /espartinas/i.test(tr.innerText)).map(tr => tr.outerHTML.replace(/\s+/g, " ")));

async function abrir(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1000);
}

// Gesliga: lee el calendario y la clasificación (y guarda copia de las dos páginas).
async function explorarGesliga(page, equipo, url){
  const paginas = [];
  const guardar = async (nombre) => {
    const tablas = await leerTablas(page);
    const enlaces = await page.$$eval("a[href]", as => [...new Set(as.map(a => a.href))]);
    await fs.writeFile(`copia/${equipo}-${nombre}.html`, await page.content());
    await fs.writeFile(`copia/${equipo}-${nombre}-tablas.json`, JSON.stringify(tablas, null, 1));
    await fs.writeFile(`copia/${equipo}-${nombre}-enlaces.json`, JSON.stringify(enlaces, null, 1));
    paginas.push({ nombre, url: page.url(), tablas: tablas.length });
    return { tablas, enlaces };
  };
  await abrir(page, url);
  const cal = await guardar("calendario");
  const liga = new URL(url).searchParams.get("Liga");
  const candidatas = [...new Set([
    ...cal.enlaces.filter(h => /clasifica/i.test(h)),
    `https://gesliga.com/Clasificacion.aspx?Liga=${liga}`
  ])].slice(0, 3);
  let todas = [...cal.tablas];
  for (const [i, h] of candidatas.entries()) {
    try { await abrir(page, h); todas.push(...(await guardar("clasificacion" + (i || ""))).tablas); }
    catch (e) { console.warn(`  aviso ${equipo}: no pude abrir ${h}: ${e.message}`); }
  }
  await fs.writeFile(`copia/${equipo}-paginas.json`, JSON.stringify(paginas, null, 1));
  return { clasificacion: interpretar(todas), partidos: partidosGesliga(cal.tablas) };
}

const navegador = await chromium.launch();
await fs.mkdir("copia", { recursive: true });
let fallos = 0;
for (const { equipo, url, fuente } of LIGAS) {
  try {
    const page = await navegador.newPage({ locale: "es-ES" });
    if (fuente === "gesliga") {
      const { clasificacion, partidos } = await explorarGesliga(page, equipo, url);
      await fs.writeFile(`copia/${equipo}-clasificacion.json`, JSON.stringify(clasificacion, null, 1));
      await fs.writeFile(`copia/${equipo}-partidos.json`, JSON.stringify(partidos, null, 1));
      console.log(`  ${equipo}: ${clasificacion.length} equipos, ${partidos.length} partidos nuestros`);
      if (clasificacion.length < 3) throw new Error("No encontré la clasificación");
      if (!PROJECT) throw new Error("Falta el secreto FIREBASE_PROJECT_ID (la copia sí se ha guardado)");
      await guardarTabla(equipo, clasificacion, url);
      const plan = planPartidos(partidos, await leerPartidos(equipo));
      for (const { id, campos: datos } of plan) await guardarPartido(equipo, id, datos);
      console.log(`✔ ${equipo}: clasificación y ${plan.length} partidos guardados`);
      await page.close();
      continue;
    }
    await abrir(page, url);
    const tablas = await leerTablas(page);
    await fs.writeFile(`copia/${equipo}.html`, await page.content());
    await fs.writeFile(`copia/${equipo}-tablas.json`, JSON.stringify(tablas, null, 1));
    const clasificacion = interpretar(tablas);
    await fs.writeFile(`copia/${equipo}-clasificacion.json`, JSON.stringify(clasificacion, null, 1));
    if (clasificacion.length < 3) throw new Error(`No encontré la clasificación (${tablas.length} tablas en la página)`);

    // Cada jornada tiene su página (desplegable «Jornada N» → ...&num_day=N...)
    const jornadas = await page.$$eval("option", os => [...new Set(os.map(o => o.value).filter(v => /num_day=\d+/.test(v)))]);
    const todas = [...tablas];
    const copiaJornadas = [], copiaFilas = new Set(await filasNuestras(page));
    for (const rel of jornadas) {
      try {
        await abrir(page, new URL(rel, url).href);
        const t = (await leerTablas(page)).filter(t => t.length < 40 && t.every(f => f.every(c => c.length < 200)));
        todas.push(...t);
        (await filasNuestras(page)).forEach(f => copiaFilas.add(f));
        copiaJornadas.push({ url: rel, tablas: t.filter(t => t.some(f => /Jornada:?\s*\d+\s*\(/.test(f.join(" ")))) });
      } catch (e) { console.warn(`  aviso ${equipo}: no pude abrir ${rel}: ${e.message}`); }
    }
    await fs.writeFile(`copia/${equipo}-jornadas.json`, JSON.stringify(copiaJornadas, null, 1));
    await fs.writeFile(`copia/${equipo}-filas.html`, [...copiaFilas].join("\n"));
    const partidos = partidosDeTablas(todas, clasificacion.map(f => f.equipo));
    await fs.writeFile(`copia/${equipo}-partidos.json`, JSON.stringify(partidos, null, 1));
    console.log(`  ${equipo}: ${clasificacion.length} equipos, ${jornadas.length} jornadas, ${partidos.length} partidos nuestros`);

    if (!PROJECT) throw new Error("Falta el secreto FIREBASE_PROJECT_ID (la copia sí se ha guardado)");
    await guardarTabla(equipo, clasificacion, url);
    const plan = planPartidos(partidos, await leerPartidos(equipo));
    for (const { id, campos: datos } of plan) await guardarPartido(equipo, id, datos);
    console.log(`✔ ${equipo}: clasificación y ${plan.length} partidos guardados`);
    await page.close();
  } catch (e) {
    fallos++;
    console.error(`✘ ${equipo}: ${e.message}`);
  }
}
await navegador.close();
process.exit(fallos ? 1 : 0);
