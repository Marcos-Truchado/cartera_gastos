const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const RAIZ = path.join(__dirname, "..");
const FUENTES = ["js/util.js", "js/datos.js", "js/vistas.js"]
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

test("un gasto en euros conserva la forma de siempre", () => {
  const { ver } = cargar(null);
  const claves = ver(`Object.keys(nuevoGasto({ fecha: "2026-01-02", categoria: "comida", cantidad: 12.345 }))`);
  assert.deepEqual(claves, ["id", "fecha", "categoria", "cantidad", "nota"]);
  assert.equal(ver(`nuevoGasto({ fecha: "2026-01-02", categoria: "comida", cantidad: 12.345 }).cantidad`), 12.35);
});

test("un gasto en libras guarda original, tasa y euros redondeados", () => {
  const { ver } = cargar(null);
  const g = ver(`nuevoGasto({ fecha: "2026-01-02", categoria: "ocio", cantidad: 19.99, moneda: "GBP", tasa: 1.17 })`);
  assert.equal(g.cantidad, 23.39);
  assert.equal(g.cantidadOriginal, 19.99);
  assert.equal(g.tasa, 1.17);
  assert.equal(g.moneda, "GBP");
});

test("sin tasa válida no hay importe en euros", () => {
  const { ver } = cargar(null);
  assert.equal(ver("Number.isNaN(importeEnEuros(10, 0))"), true);
  assert.equal(ver("Number.isNaN(importeEnEuros(10, undefined))"), true);
  assert.equal(ver("importeEnEuros(10, 1.17)"), 11.7);
});

test("bizum y viaje se guardan si se piden", () => {
  const { ver } = cargar(null);
  const g = ver(`nuevoGasto({ fecha: "2026-01-02", categoria: "bizum", cantidad: 20, bizumTipo: "recibo", viajeId: "v1" })`);
  assert.equal(g.bizumTipo, "recibo");
  assert.equal(g.pendiente, true);
  assert.equal(g.viajeId, "v1");
  assert.deepEqual(ver("DIVISAS.slice(0, 4)"), ["EUR", "USD", "GBP", "CHF"]);
});

const VIAJES_RAW = {
  viajes: [
    { id: "v1", nombre: "Praga", estado: "pendiente", desde: "2026-03-01" },
    { id: "v2", nombre: "Interrail", estado: "curso", desde: "2026-02-01" },
    { id: "v3", nombre: "Roma", estado: "pendiente", desde: "" },
    { id: "v4", nombre: "Lisboa", estado: "finalizado", hasta: "2026-01-10" },
    { id: "v5", nombre: "Oporto", estado: "finalizado", hasta: "" },
  ],
  gastos: [
    { id: 10, fecha: "2026-02-02", categoria: "comida", cantidad: 10, viajeId: "v2" },
    { id: 11, fecha: "2026-02-03", categoria: "ocio", cantidad: 5, viajeId: "v2" },
    { id: 12, fecha: "2026-02-04", categoria: "viajes", cantidad: 7 },
    { id: 13, fecha: "2026-02-05", categoria: "comida", cantidad: 3, viajeId: "v9" },
    { id: 14, fecha: "2026-02-06", categoria: "bizum", cantidad: 20, bizumTipo: "recibo", pendiente: true, viajeId: "v2" },
  ],
};

test("total del viaje: solo sus gastos, ignora viajes borrados y bizums pendientes", () => {
  const { ver } = cargar(VIAJES_RAW);
  assert.equal(ver("totalViaje('v2')"), 15);
  assert.equal(ver("totalViaje('v1')"), 0);
  assert.equal(ver("viajePorId('v9')"), null);
});

test("orden de viajes: en curso, sin empezar y terminados", () => {
  const { ver } = cargar(VIAJES_RAW);
  assert.deepEqual(ver("viajesOrdenados().map(v => v.id)"), ["v2", "v1", "v3", "v4", "v5"]);
});

test("qué viajes ofrece el formulario según la categoría", () => {
  const { ver } = cargar(VIAJES_RAW);
  assert.deepEqual(ver(`viajesElegibles("comida").map(v => v.id)`), ["v2"]);
  assert.deepEqual(ver(`viajesElegibles("viajes").map(v => v.id)`), ["v2", "v1", "v3", "v4", "v5"]);
  assert.deepEqual(ver(`viajesElegibles("alojamiento").map(v => v.id)`), ["v2", "v1", "v3", "v4", "v5"]);
});

test("qué gastos se pueden enganchar a un viaje ya apuntado", () => {
  const { ver } = cargar(VIAJES_RAW);
  assert.deepEqual(ver(`gastosEnlazables(viajePorId("v2")).map(g => g.id)`), [13, 12]);
  assert.deepEqual(ver(`gastosEnlazables(viajePorId("v4")).map(g => g.id)`), [12]);
});

test("fechas del viaje se muestran si existen", () => {
  const { ver } = cargar(null);
  assert.equal(ver(`fechasViaje({ desde: "", hasta: "" })`), "");
  assert.ok(ver(`fechasViaje({ desde: "2026-02-01", hasta: "" })`).length > 0);
  assert.ok(ver(`fechasViaje({ desde: "2026-02-01", hasta: "2026-02-04" })`).includes("–"));
});

test("el CSV añade viaje, divisa y cambio al final", () => {
  const { ver } = cargar({
    viajes: [{ id: "v1", nombre: "Praga", estado: "curso" }],
    gastos: [
      { id: 1, fecha: "2026-01-02", categoria: "comida", cantidad: 10, nota: "" },
      { id: 2, fecha: "2026-01-03", categoria: "ocio", cantidad: 23.39, nota: "teatro", viajeId: "v1", moneda: "GBP", cantidadOriginal: 19.99, tasa: 1.17 },
    ],
  });
  const filas = ver("filasCSV()");
  assert.deepEqual(filas[0], ["fecha", "categoria", "cantidad", "nota", "bizum_estado", "viaje", "moneda", "cantidad_original", "cambio"]);
  assert.equal(filas[1][5], "");
  assert.equal(filas[1][6], "EUR");
  assert.equal(filas[2][5], "Praga");
  assert.equal(filas[2][6], "GBP");
  assert.equal(filas[2][7], "19,99");
  assert.equal(filas[2][8], "1,17");
});

test("el selector de viaje sigue ahí aunque el viaje esté pendiente", () => {
  const { ver } = cargar({ viajes: [{ id: "v1", nombre: "Praga", estado: "pendiente" }] });
  const inicial = ver("(fCat = 'comida', vistaAnadir())");
  assert.ok(inicial.includes('id="viaje-bloque"'));
  assert.ok(inicial.includes('id="viaje-bloque" style="display:none"'));
  const enViajes = ver("(fCat = 'viajes', vistaAnadir())");
  assert.ok(enViajes.includes("Praga"));
  assert.ok(enViajes.includes('id="viaje-bloque" style="display:block"'));
  assert.ok(enViajes.includes('value="v1"'));
  assert.ok(ver(`opcionesViajeHTML("viajes", "")`).includes("Praga"));
  assert.equal(ver(`opcionesViajeHTML("comida", "")`), "");
});

test("un viaje terminado tampoco se cuela para comida", () => {
  const { ver } = cargar({ viajes: [{ id: "v1", nombre: "Roma", estado: "finalizado" }] });
  assert.equal(ver(`opcionesViajeHTML("comida", "")`), "");
  assert.ok(ver(`opcionesViajeHTML("alojamiento", "")`).includes("Roma"));
});

// ===== Importar CSV =====
const CSV_VIEJO = "\uFEFF\"fecha\";\"categoria\";\"cantidad\";\"nota\";\"bizum_estado\"\n" +
  "\"2025-09-03\";\"comida\";\"12,50\";\"pizza; con extra\";\"\"\n" +
  "\"2025-09-10\";\"bizum\";\"20,00\";\"cena\";\"me lo deben (pendiente)\"\n" +
  "\"2025-09-11\";\"bizum\";\"25,00\";\"gasolina\";\"me lo pagaron\"\n" +
  "\"2025-09-12\";\"bizum\";\"15,00\";\"entrada\";\"yo lo debo\"\n" +
  "\"2025-09-13\";\"inventada\";\"7,25\";\"un \"\"clásico\"\"\";\"\"\n";

test("importa el CSV viejo con BOM, punto y coma y notas con punto y coma", () => {
  const { ver } = cargar(null);
  const r = ver(`gastosDesdeCSV(${JSON.stringify(CSV_VIEJO)})`);
  assert.equal(r.gastos.length, 5);
  assert.deepEqual(r.viajes, []);
  assert.equal(r.saltadas, 0);
  assert.equal(r.gastos[0].fecha, "2025-09-03");
  assert.equal(r.gastos[0].categoria, "comida");
  assert.equal(r.gastos[0].cantidad, 12.5);
  assert.equal(r.gastos[0].nota, "pizza; con extra");
  assert.equal(r.gastos[4].nota, 'un "clásico"');
  assert.equal(r.gastos[4].categoria, "otros");
});

test("el estado del bizum vuelve igual que se exportó", () => {
  const { ver } = cargar(null);
  const gs = ver(`gastosDesdeCSV(${JSON.stringify(CSV_VIEJO)}).gastos`);
  assert.equal(gs[1].bizumTipo, "recibo");
  assert.equal(gs[1].pendiente, true);
  assert.equal(gs[2].bizumTipo, "recibo");
  assert.equal("pendiente" in gs[2], false);
  assert.equal(gs[3].bizumTipo, "debo");
  assert.equal("pendiente" in gs[3], false);
});

const CSV_NUEVO = [
  "fecha,categoria,cantidad,nota,bizum_estado,viaje,moneda,cantidad_original,cambio",
  '2026-02-01,comida,23.39,"teatro, cena",,Praga,GBP,19.99,1.17',
  "2026-02-02,viajes,89,vuelo,,Praga,EUR,,",
].join("\n");

test("importa el CSV nuevo con viaje y divisa", () => {
  const { ver } = cargar(null);
  const r = ver(`gastosDesdeCSV(${JSON.stringify(CSV_NUEVO)})`);
  assert.equal(r.gastos.length, 2);
  assert.equal(r.viajes.length, 1);
  assert.equal(r.viajes[0].nombre, "Praga");
  assert.equal(r.gastos[0].nota, "teatro, cena");
  assert.equal(r.gastos[0].moneda, "GBP");
  assert.equal(r.gastos[0].cantidadOriginal, 19.99);
  assert.equal(r.gastos[0].tasa, 1.17);
  assert.equal(r.gastos[0].cantidad, 23.39);
  assert.equal(r.gastos[0].viajeId, r.viajes[0].id);
  assert.equal(r.gastos[1].viajeId, r.viajes[0].id);
  assert.equal("moneda" in r.gastos[1], false);
});

test("acepta fechas DD/MM/AAAA, nombres de categoría y miles", () => {
  const { ver } = cargar(null);
  const csv = '"03/09/2025";"Comida";"1.234,56";"x";""';
  const r = ver(`gastosDesdeCSV(${JSON.stringify(csv)})`);
  assert.equal(r.gastos.length, 1);
  assert.equal(r.gastos[0].fecha, "2025-09-03");
  assert.equal(r.gastos[0].categoria, "comida");
  assert.equal(r.gastos[0].cantidad, 1234.56);
});

test("las filas rotas se saltan y sin ninguna válida no se importa", () => {
  const { ver } = cargar(null);
  const csv = "fecha;categoria;cantidad;nota;bizum_estado\n" +
    "2025-13-01;comida;10;mes malo;\n" +
    "2025-09-02;comida;0;cero;\n" +
    ";comida;5;sin fecha;\n" +
    "2025-09-04;ocio;-2;negativo;\n" +
    "2025-09-05;ocio;8;bien;\n";
  const r = ver(`gastosDesdeCSV(${JSON.stringify(csv)})`);
  assert.equal(r.gastos.length, 1);
  assert.equal(r.saltadas, 4);
  assert.ok(ver(`gastosDesdeCSV("")`).error);
  assert.ok(ver(`gastosDesdeCSV("fecha;categoria;cantidad;nota;bizum_estado\\n")`).error);
});

test("exportar y volver a importar conserva los gastos", () => {
  const { ver } = cargar({
    viajes: [{ id: "v1", nombre: "Praga", estado: "curso" }],
    gastos: [
      { id: 1, fecha: "2026-01-02", categoria: "comida", cantidad: 10, nota: "a;b" },
      { id: 2, fecha: "2026-01-03", categoria: "ocio", cantidad: 23.39, nota: "teatro", viajeId: "v1", moneda: "GBP", cantidadOriginal: 19.99, tasa: 1.17 },
      { id: 3, fecha: "2026-01-04", categoria: "bizum", cantidad: 20, nota: "", bizumTipo: "recibo", pendiente: true },
    ],
  });
  const csv = ver("filasCSV().map(f => f.map(c => '\"' + String(c).replace(/\"/g, '\"\"') + '\"').join(';')).join('\\n')");
  const r = ver(`gastosDesdeCSV(${JSON.stringify(csv)})`);
  assert.equal(r.gastos.length, 3);
  assert.equal(r.gastos[0].nota, "a;b");
  assert.equal(r.gastos[1].cantidad, 23.39);
  assert.equal(r.gastos[1].moneda, "GBP");
  assert.equal(r.gastos[1].cantidadOriginal, 19.99);
  assert.equal(r.gastos[1].tasa, 1.17);
  assert.equal(r.gastos[1].viajeId, r.viajes[0].id);
  assert.equal(r.viajes[0].nombre, "Praga");
  assert.equal(r.gastos[2].bizumTipo, "recibo");
  assert.equal(r.gastos[2].pendiente, true);
});
