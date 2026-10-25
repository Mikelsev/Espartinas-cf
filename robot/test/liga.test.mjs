import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { interpretar, partidosDeTablas, planPartidos, partidosGesliga, goleadoresGesliga } from "../liga.mjs";

const leer = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), "utf8"));
// Copia real de la web del Benjamín guardada por el robot el 24/10/2026 (tras la jornada 2).
const benjamin = leer("./ejemplos/benjamin-2026-10-24-tablas.json");

test("clasificación real del Benjamín: 14 equipos en orden oficial", () => {
  const filas = interpretar(benjamin);
  assert.equal(filas.length, 14);
  assert.deepEqual(filas[0], { equipo: 'La Moneda CF "Compromiso"', pos: 1, pts: 6, pj: 2, pg: 2, pe: 0, pp: 0, dif: 10 });
  assert.deepEqual(filas[10], { equipo: "Espartinas CF", pos: 11, pts: 0, pj: 2, pg: 0, pe: 0, pp: 2, dif: -6 });
  assert.deepEqual(filas.map(f => f.pos), [...Array(14)].map((_, i) => i + 1));
});

test("partidos reales del Benjamín: resultado de la jornada 2 y fecha y hora de la 3", () => {
  const partidos = partidosDeTablas(benjamin, interpretar(benjamin).map(f => f.equipo));
  assert.deepEqual(partidos, [
    { jornada: 2, local: true, rival: "EEMM Villamanrique", gf: 3, gc: 4, fecha: "2026-10-23", estado: "Finalizado" },
    { jornada: 3, local: true, rival: 'CF Comarca los Alcores "A"', hora: "18:00", fecha: "2026-10-30" }
  ]);
});

test("partido fuera: el marcador se da la vuelta y el campo se guarda", () => {
  const tablas = [[
    ["Benjamines - Jornada: 5 (13/11/2026)"],
    ["Finalizado", "Centro Deportivo Los Mares", "AD Los Mares", "", "2 - 5", "", "Espartinas CF", "", ""],
    ["Finalizado", "", "EDM Bormujos", "", "1 - 1", "", "CA Aznalcázar", "", ""]
  ]];
  assert.deepEqual(partidosDeTablas(tablas, ["AD Los Mares", "Espartinas CF", "EDM Bormujos", "CA Aznalcázar"]), [
    { jornada: 5, local: false, rival: "AD Los Mares", gf: 5, gc: 2, fecha: "2026-11-13", estado: "Finalizado", campo: "Centro Deportivo Los Mares" }
  ]);
});

test("partido sin jugar (filas reales): «Vie 30\\n18:00» es día y hora, no el campo; sin marcador", () => {
  const tablas = [[
    ["Benjamines - Benjamín 1º Año - 1º Año Grupo Único -  Jornada: 3 (30/10/2026)"],
    ["Vie 30\n18:00", "", "Espartinas CF", "", "-", "", 'CF Comarca los Alcores "A"', "", ""]
  ], [
    ["Benjamines - Benjamín 1º Año - 1º Año Grupo Único -  Jornada: 4 (06/11/2026)"],
    ["", "", "EDM Bormujos", "", "-", "", "Espartinas CF", "", ""]
  ]];
  assert.deepEqual(partidosDeTablas(tablas, ["Espartinas CF", 'CF Comarca los Alcores "A"', "EDM Bormujos"]), [
    { jornada: 3, local: true, rival: 'CF Comarca los Alcores "A"', hora: "18:00", fecha: "2026-10-30" },
    { jornada: 4, local: false, rival: "EDM Bormujos", fecha: "2026-11-06" }
  ]);
});

test("enlace de Maps publicado por la liga: se guarda como «mapa» y no ensucia el campo", () => {
  const tablas = [[
    ["Jornada: 3 (30/10/2026)"],
    ["Vie 30\n18:00", "Campo Municipal [[MAPA:https://maps.google.com/?q=37.38,-6.12]]", "CD Isidro Reguera \"A\"", "", "-", "", "Espartinas CF", "", ""]
  ]];
  const [p] = partidosDeTablas(tablas, ['CD Isidro Reguera "A"', "Espartinas CF"]);
  assert.equal(p.campo, "Campo Municipal");
  assert.equal(p.mapa, "https://maps.google.com/?q=37.38,-6.12");
  assert.equal(planPartidos([p], [])[0].campos.mapa, "https://maps.google.com/?q=37.38,-6.12");
});

test("jornada en la que descansamos: no se crea partido", () => {
  const tablas = [[["Alevines - Jornada: 12 (29/01/2027)"], ["", "", "EF Rio Grande", "", "-", "", "CD Atco. San Juan", "", ""]]];
  assert.deepEqual(partidosDeTablas(tablas, ["EF Rio Grande", "CD Atco. San Juan", "Espartinas CF"]), []);
});

test("no pisa lo del delegado: solo campos oficiales y reutiliza su partido de la misma jornada", () => {
  const oficiales = [
    { jornada: 2, local: true, rival: "EEMM Villamanrique", gf: 3, gc: 4, fecha: "2026-10-23" },
    { jornada: 3, local: true, rival: "Comarca A", hora: "18:00", fecha: "2026-10-30" },
    { jornada: 4, local: false, rival: "Bormujos", fecha: "2026-11-06" }
  ];
  const existentes = [{ id: "pxyz", jornada: "3", citacion: "17:30", gf: 2, gc: 1, goles: {} }, { id: "liga-j4", gf: 1, gc: 0 }];
  assert.deepEqual(planPartidos(oficiales, existentes), [
    { id: "liga-j2", campos: { jornada: "2", fecha: "2026-10-23", rival: "EEMM Villamanrique", local: true, gf: 3, gc: 4 } },
    { id: "pxyz", campos: { jornada: "3", fecha: "2026-10-30", rival: "Comarca A", local: true, hora: "18:00" } },
    { id: "liga-j4", campos: { jornada: "4", fecha: "2026-11-06", rival: "Bormujos", local: false } }
  ]);
});

test("ignora tablas que no son la clasificación", () => {
  assert.deepEqual(interpretar([[["Menú", "Inicio"]], [["Fecha", "Local", "Visitante"]]]), []);
});


// ---- Gesliga (COTI FC): copias reales del 25/10/2026 ----
const cotiCal = leer("./ejemplos/coti-2026-10-25-calendario-tablas.json");
const cotiCla = leer("./ejemplos/coti-2026-10-25-clasificacion-tablas.json");

test("gesliga: clasificación real sin columna «Equipo»", () => {
  const filas = interpretar(cotiCla);
  assert.equal(filas.length, 7);
  assert.deepEqual(filas[0], { equipo: "ALCOPONE", pos: 1, pts: 9, dif: 9, gf: 16, gc: 7, pg: 3, pe: 0, pp: 0, pj: 3 });
  assert.deepEqual(filas[6], { equipo: "COTI FC", pos: 7, pts: 0, dif: -8, gf: 8, gc: 16, pg: 0, pe: 0, pp: 3, pj: 3 });
});

test("gesliga: calendario real del COTI (resultados, descansos y fechas provisionales)", () => {
  const p = partidosGesliga(cotiCal);
  assert.equal(p.length, 12); // 14 jornadas, descansa en la 5 y la 12
  assert.deepEqual(p[0], { jornada: 1, local: true, rival: "LOS REMATANDO BAJITO", gf: 2, gc: 5, fecha: "2026-09-21", provisional: false, hora: "22:30", campo: "Campo 1" });
  assert.deepEqual(p[1], { jornada: 2, local: false, rival: "CHAVALEO FC", gf: 1, gc: 5, fecha: "2026-09-28", provisional: false, hora: "21:30", campo: "Campo 1" });
  assert.deepEqual(p[3], { jornada: 4, local: true, rival: "CORTECONCEPCIÓN", fecha: "2026-10-21", provisional: false, hora: "21:30", campo: "Campo 1" });
  assert.equal(p.some(x => x.jornada === 5), false);
  assert.deepEqual(p[4], { jornada: 6, local: true, rival: "CLARET LEGENDS", fecha: "2026-11-03", provisional: true });
  assert.equal(planPartidos([p[4]], [])[0].campos.provisional, true);
});

test("gesliga: goleadores del COTI en la página de estadísticas", () => {
  assert.deepEqual(goleadoresGesliga(leer("./ejemplos/coti-2026-10-25-estadisticas-tablas.json")), [
    { nombre: "JAVI CASTELLANOS", goles: 4 }, { nombre: "ANTONIO Gª ROBLEDO", goles: 2 },
    { nombre: "PEPE SHOLL", goles: 1 }, { nombre: "LUIS PUIG", goles: 1 }
  ]);
});
