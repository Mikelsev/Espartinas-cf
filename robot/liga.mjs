// Funciones para entender lo que se lee de la web de la Liga Educa (sin navegador, para poder probarlas).

export const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
export const COLUMNAS = {
  equipo: ["equipo", "equipos", "club", "nombre"],
  pj: ["pj", "j", "jugados", "partidos", "pjugados"],
  pg: ["pg", "g", "ganados", "v", "pganados"],
  pe: ["pe", "e", "empatados", "x", "pempatados"],
  pp: ["pp", "p", "perdidos", "d", "pperdidos"],
  gf: ["gf", "favor", "golesfavor", "golesaf", "f"],
  gc: ["gc", "contra", "golescontra", "golesec", "c"],
  pts: ["pts", "pt", "puntos", "ptos"]
};
export const num = s => { const n = parseInt(String(s).replace(/[^\d-]/g, ""), 10); return Number.isFinite(n) ? n : null; };

// Recibe las tablas de la página (filas de celdas de texto) y devuelve la clasificación más larga que encuentre.
export function interpretar(tablas) {
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

// Saca las tablas de un HTML guardado (para los tests, sin navegador). Suficiente para tablas sencillas.
export function tablasDeHtml(html) {
  const texto = s => s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/\s+/g, " ").trim();
  return [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map(([t]) =>
    [...t.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(([tr]) =>
      [...tr.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(m => texto(m[1]))));
}
