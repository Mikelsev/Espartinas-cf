import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { interpretar, tablasDeHtml } from "../liga.mjs";

const leer = p => fs.readFileSync(new URL(p, import.meta.url), "utf8");

test("lee la clasificación de una tabla con cabeceras Equipo/PJ/G/E/P/GF/GC/Pts", () => {
  const filas = interpretar(tablasDeHtml(leer("./ejemplos/ejemplo-inventado.html")));
  assert.equal(filas.length, 4);
  assert.deepEqual(filas[1], { equipo: "Espartinas C.F.", pj: 4, pg: 3, pe: 0, pp: 1, gf: 12, gc: 6, pts: 9 });
  assert.equal(filas[0].equipo, "Equipo Uno");
});

test("ignora tablas que no son la clasificación", () => {
  assert.deepEqual(interpretar([[["Menú", "Inicio"]], [["Fecha", "Local", "Visitante"]]]), []);
});

// Cuando el robot haya guardado copias reales de la web (robot/copia/*-tablas.json), se comprueban también.
const copia = new URL("../copia/", import.meta.url);
const reales = fs.existsSync(copia) ? fs.readdirSync(copia).filter(f => f.endsWith("-tablas.json")) : [];
for (const f of reales) {
  test(`copia real ${f}: encuentra la clasificación y sale el Espartinas`, () => {
    const filas = interpretar(JSON.parse(fs.readFileSync(new URL(f, copia), "utf8")));
    assert.ok(filas.length >= 3, `solo ${filas.length} equipos`);
    assert.ok(filas.some(x => /espartinas/i.test(x.equipo)), "no aparece el Espartinas");
  });
}
