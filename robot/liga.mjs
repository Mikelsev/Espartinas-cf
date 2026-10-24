// Funciones para entender lo que se lee de la web de la Liga Educa (educationleague.es).
// No usan navegador, así se pueden probar con copias guardadas (ver test/).
//
// La web devuelve tablas HTML. El robot las convierte en listas de filas con el texto de cada celda
// (las tablas anidadas repiten filas de las de dentro; por eso aquí se busca por contenido, no por posición).

export const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
export const num = s => { const n = parseInt(String(s).replace(/[^\d-]/g, ""), 10); return Number.isFinite(n) ? n : null; };
const tieneLetras = c => /[a-zA-ZÁÉÍÓÚÑáéíóúñ]{3,}/.test(c || "");

// Nombre de cabecera → campo. "p" es ambiguo: en la Liga Educa la cabecera es «Pt Equipo P J G E P Dif»,
// donde la primera P son los puntos y la segunda los perdidos.
const ALIAS = {
  pj: ["pj", "j", "jugados", "partidos"],
  pg: ["pg", "g", "ganados", "v"],
  pe: ["pe", "e", "empatados", "x"],
  pp: ["pp", "perdidos", "d"],
  gf: ["gf", "favor", "golesfavor"],
  gc: ["gc", "contra", "golescontra"],
  pts: ["pts", "pt", "puntos", "ptos"],
  dif: ["dif", "dg", "diferencia", "golaverage"]
};
const EQUIPO = ["equipo", "equipos", "club", "nombre"];

function columnas(cabeceras) {
  const claves = [];
  for (const c of cabeceras.map(norm)) {
    let k = Object.keys(ALIAS).find(k => ALIAS[k].includes(c) && !claves.includes(k));
    if (c === "p") k = claves.includes("pts") ? "pp" : "pts";
    claves.push(k || null);
  }
  return claves;
}

// Devuelve la clasificación: [{ pos, equipo, pts, pj, pg, pe, pp, dif?, gf?, gc? }] en el orden oficial.
export function interpretar(tablas) {
  let mejor = [];
  for (const filas of tablas) {
    const iCab = filas.findIndex(f => f.length < 15 && f.some(c => EQUIPO.includes(norm(c))) &&
      f.filter(c => norm(c) === "p" || Object.values(ALIAS).some(a => a.includes(norm(c)))).length >= 4);
    if (iCab < 0) continue;
    const cab = filas[iCab];
    // Las columnas de números van después de «Equipo» (antes suele ir la posición y el escudo).
    const claves = columnas(cab.slice(cab.findIndex(c => EQUIPO.includes(norm(c))) + 1));
    if (!claves.includes("pg") || !claves.includes("pts")) continue;
    const res = [];
    for (const f of filas.slice(iCab + 1)) {
      const iNombre = f.findIndex(tieneLetras);
      if (iNombre < 0) continue;
      const nums = f.slice(iNombre + 1).filter(c => c !== "").map(num);
      if (nums.length < claves.filter(Boolean).length || nums.some(n => n == null)) continue;
      const fila = { equipo: f[iNombre].replace(/^\s*\d+[.º)]?\s+/, "").replace(/\s+/g, " ").trim() };
      const pos = num(f.slice(0, iNombre).find(c => c !== ""));
      if (pos != null) fila.pos = pos;
      claves.forEach((k, i) => { if (k) fila[k] = nums[i]; });
      res.push(fila);
    }
    if (res.length > mejor.length) mejor = res;
  }
  return mejor;
}

// Celda con el día (y a veces la hora): «V-30» en «Próxima jornada», «Vie 30 18:00» en la página de la jornada.
const DIA = /^(?:[LMXJVSD]-|(?:lun|mar|mi[eé]|jue|vie|s[aá]b|dom)[a-zé]*\.?\s+)(\d{1,2})(?:\s+(\d{1,2}:\d{2}))?$/i;
const ESTADOS = ["finalizado", "pendiente", "aplazado", "suspendido", "descansa", "enjuego", "programado", "anulado"];
const iso = d => d.toISOString().slice(0, 10);

// Fecha real del partido: la jornada trae una fecha y a veces la celda trae el día («V-30» = viernes 30).
function fechaPartido(base, dia) {
  if (dia == null) return iso(base);
  let mejor = null;
  for (let delta = -15; delta <= 15; delta++) {
    const d = new Date(base.getTime() + delta * 864e5);
    if (d.getUTCDate() === dia && (mejor == null || Math.abs(delta) < Math.abs(mejor[0]))) mejor = [delta, d];
  }
  return iso(mejor ? mejor[1] : base);
}

// Busca los partidos de nuestro club en las tablas de jornadas («… Jornada: 2 (23/10/2026)») y de
// «Próxima jornada» («Jornada 3 (30/10/2026)»). `equipos` son los nombres de la clasificación.
// Devuelve [{ jornada, fecha, hora?, rival, local, campo?, gf?, gc?, estado? }] ordenados por jornada.
export function partidosDeTablas(tablas, equipos, club = /espartinas/i) {
  const conocidos = [...equipos].sort((a, b) => b.length - a.length);
  const esEquipo = c => conocidos.includes(c);
  // «Local - Visitante» en una sola celda
  const pareja = c => {
    for (const a of conocidos) if (c.startsWith(a + " - ") && esEquipo(c.slice(a.length + 3).trim())) return [a, c.slice(a.length + 3).trim()];
    return null;
  };
  const porJornada = new Map();
  // Solo tablas «hoja»: las que envuelven a otras tienen celdas enormes con todo el texto mezclado.
  for (const filas of tablas.filter(t => t.every(f => f.every(c => c.length < 200)))) {
    let jornada = null, base = null;
    for (const f of filas) {
      const texto = f.join(" ").trim();
      const cab = f.length === 1 && texto.match(/Jornada:?\s*(\d+)\s*\((\d{2})\/(\d{2})\/(\d{4})\)/);
      if (cab) { jornada = +cab[1]; base = new Date(Date.UTC(+cab[4], cab[3] - 1, +cab[2])); continue; }
      if (jornada == null || f.length < 2) continue;
      // Enlace al mapa que añade el robot («[[MAPA:url]]»): se guarda aparte y se quita del texto
      const mapa = f.map(c => c.match(/\[\[MAPA:(\S+?)\]\]/)?.[1]).find(Boolean);
      const celdas = f.map(c => c.replace(/\s*\[\[MAPA:\S+?\]\]/g, "").replace(/\s+/g, " ").trim());
      let local, visitante, iLocal;
      const juntos = celdas.map(pareja).find(Boolean);
      if (juntos) { [local, visitante] = juntos; iLocal = celdas.findIndex(pareja); }
      else {
        const idx = celdas.map((c, i) => esEquipo(c) ? i : -1).filter(i => i >= 0);
        if (idx.length !== 2) continue;
        [local, visitante] = [celdas[idx[0]], celdas[idx[1]]]; iLocal = idx[0];
      }
      if (club.test(local) === club.test(visitante)) continue; // no es nuestro partido
      const p = { jornada, local: club.test(local), rival: club.test(local) ? visitante : local };
      const marcador = celdas.map(c => c.match(/^(\d+)\s*-\s*(\d+)$/)).find(Boolean);
      if (marcador) { const [a, b] = [+marcador[1], +marcador[2]]; [p.gf, p.gc] = p.local ? [a, b] : [b, a]; }
      const dia = celdas.map(c => c.match(DIA)).find(Boolean);
      const hora = celdas.find(c => /^\d{1,2}:\d{2}$/.test(c)) || dia?.[2];
      if (hora) p.hora = hora.padStart(5, "0");
      p.fecha = fechaPartido(base, dia ? +dia[1] : null);
      const estado = celdas.find(c => ESTADOS.includes(norm(c)));
      if (estado) p.estado = estado;
      const campo = celdas.slice(0, iLocal).find(c => tieneLetras(c) && !ESTADOS.includes(norm(c)) && !DIA.test(c));
      if (campo) p.campo = campo;
      if (mapa) p.mapa = mapa;
      porJornada.set(jornada, { ...porJornada.get(jornada), ...p });
    }
  }
  return [...porJornada.values()].sort((a, b) => a.jornada - b.jornada);
}

// Decide qué escribir en Firestore para cada partido oficial sin pisar lo que mete el delegado.
// `existentes`: [{ id, ...campos }] ya guardados. Devuelve [{ id, campos }]: solo se escriben esos campos.
// - Si el delegado ya creó a mano el partido de esa jornada, se actualiza ese mismo en vez de duplicarlo.
// - Nunca se tocan goles, citacion, equipacion, notas ni direccion.
// - «mapa» es el enlace de Google Maps que publica la liga junto a la hora.
// - El marcador solo se escribe cuando la web ya lo tiene; la hora y el campo solo si la web los trae.
export function planPartidos(oficiales, existentes) {
  return oficiales.map(o => {
    const id = `liga-j${o.jornada}`;
    const previo = existentes.find(d => d.id === id) ||
      existentes.find(d => !String(d.id).startsWith("liga-") && String(d.jornada) === String(o.jornada));
    const campos = { jornada: String(o.jornada), fecha: o.fecha, rival: o.rival, local: o.local };
    if (o.hora) campos.hora = o.hora;
    if (o.campo) campos.campo = o.campo;
    if (o.mapa) campos.mapa = o.mapa;
    if (o.gf != null) { campos.gf = o.gf; campos.gc = o.gc; }
    else if (!previo) { campos.gf = ""; campos.gc = ""; }
    return { id: previo ? previo.id : id, campos };
  });
}
