import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { interpretar, partidosDeTablas, planPartidos } from "../liga.mjs";

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

