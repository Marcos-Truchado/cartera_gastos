const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const RAIZ = path.join(__dirname, "..");
const FUENTES = ["js/util.js", "js/datos.js"]
  .map(f => fs.readFileSync(path.join(RAIZ, f), "utf8")).join("\n");

// Carga util.js + datos.js en un contexto limpio con localStorage simulado.
// `ver(expr)` evalúa una expresión dentro de ese contexto y devuelve JSON parseado.
function cargar(raw) {
  const almacen = { valor: raw == null ? null : JSON.stringify(raw) };
  const ctx = vm.createContext({
    localStorage: {
      getItem: () => almacen.valor,
      setItem: (k, v) => { almacen.valor = v; },
    },
    structuredClone,
  });
  vm.runInContext(FUENTES, ctx);
  return { almacen, ver: (expr) => JSON.parse(vm.runInContext("JSON.stringify(" + expr + ")", ctx)) };
}

const VIEJOS = [
  { id: 1, fecha: "2025-09-03", categoria: "comida", cantidad: 12.5, nota: "pizza" },
  { id: 2, fecha: "2025-09-10", categoria: "bizum", cantidad: 20, bizumTipo: "recibo", pendiente: true },
];

test("los gastos viejos se conservan y los totales no cambian", () => {
  const { ver } = cargar({
    config: { presupuesto: 900, fondo: null },
    fijos: [{ id: "resi", nombre: "Residencia", cantidad: 455, desde: "2025-09", cada: 1 }],
    gastos: VIEJOS,
  });
  assert.deepEqual(ver("totalDeMes('2025-09')"), { variable: 12.5, fijos: 455, total: 467.5 });
  assert.deepEqual(ver("datos.gastos"), VIEJOS);
  assert.deepEqual(ver("datos.viajes"), []);
  assert.deepEqual(ver("datos.config.cambios"), {});
});

test("existen las categorías tabaco y alojamiento", () => {
  const { ver } = cargar(null);
  const ids = ver("CATS.map(c => c.id)");
  assert.ok(ids.includes("tabaco"));
  assert.ok(ids.includes("alojamiento"));
  assert.equal(ver("categoria('tabaco').nombre"), "Tabaco");
  assert.equal(ver("categoria('alojamiento').nombre"), "Alojamiento");
});

test("los viajes guardados se normalizan y los rotos no rompen", () => {
  const { ver } = cargar({
    viajes: [
      { id: "v1", nombre: "Praga" },
      { id: "v2", nombre: "Roma", estado: "curso", desde: "2026-01-03" },
      { id: "v3", nombre: "Lisboa", estado: "inventado", hasta: "2026-02-01" },
      null,
      { nombre: "sin id" },
    ],
    config: { presupuesto: 1000, cambios: { GBP: 1.17 } },
  });
  assert.deepEqual(ver("datos.viajes"), [
    { id: "v1", nombre: "Praga", desde: "", hasta: "", estado: "pendiente" },
    { id: "v2", nombre: "Roma", desde: "2026-01-03", hasta: "", estado: "curso" },
    { id: "v3", nombre: "Lisboa", desde: "", hasta: "2026-02-01", estado: "pendiente" },
  ]);
  assert.deepEqual(ver("datos.config.cambios"), { GBP: 1.17 });
});

test("sin datos guardados arranca con todo vacío", () => {
  const { ver } = cargar(null);
  assert.deepEqual(ver("datos.viajes"), []);
  assert.deepEqual(ver("datos.gastos"), []);
  assert.equal(ver("datos.config.presupuesto"), 1000);
});
