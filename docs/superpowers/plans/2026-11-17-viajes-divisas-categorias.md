# Viajes, divisas y categorías — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir tabaco y alojamiento, gastos en divisa con conversión manual a euros, y viajes con estado y coste total, sin perder ningún dato guardado.

**Architecture:** Se mantiene el `localStorage` actual (`erasmus_gastos_v1`) y la forma de los gastos. El gasto gana campos opcionales (`viajeId`, `moneda`, `cantidadOriginal`, `tasa`); `cantidad` sigue siendo euros. `datos.viajes` es nuevo. Los viajes son etiquetas: su total es la suma de sus gastos, sin duplicarlos. La lógica pura vive en `js/datos.js` y se prueba con `node:test`; las vistas siguen en `js/vistas.js`.

**Tech Stack:** JS puro (sin build, sin dependencias), HTML/CSS, `localStorage`, service worker. Tests con `node:test` (Node 26 ya instalado), cargando los módulos con `node:vm` y un `localStorage` simulado.

**Spec:** `docs/superpowers/specs/2026-11-16-viajes-divisas-categorias-design.md`

## Global Constraints

- No añadir dependencias, ni build, ni backend. Todo estático para GitHub Pages.
- No cambiar la clave `erasmus_gastos_v1` ni reescribir gastos guardados.
- `gasto.cantidad` es siempre euros; la UI y los totales existentes no cambian de moneda.
- No consultar ninguna API de tipos de cambio: la tasa se teclea.
- Textos en español, tono informal actual, sin jerga.
- Móvil, ancho máximo 480 px, componentes y estilos existentes.
- `sw.js` pasa a `CACHE = "gastos-v7"`.
- Categorías exactas: `tabaco` (🚬, nombre "Tabaco"), `alojamiento` (🛏️, nombre "Alojamiento").
- Estados de viaje exactos: `"pendiente"`, `"curso"`, `"finalizado"`.

## Review Focus

- Datos antiguos en `localStorage` (gastos sin `moneda`/`viajeId`, config sin `cambios`): la app carga, los gastos quedan idénticos y los totales de meses pasados no cambian. Test en Task 1.
- Viaje `pendiente` o `finalizado`: no aparece en el selector de un gasto normal, sí para `viajes`/`alojamiento`; al enganchar gastos ya apuntados se aplica la misma regla. Test en Task 3.
- Gasto con `viajeId` que apunta a un viaje borrado: no rompe ni suma a ningún viaje. Test en Task 3.
- Bizum "me lo deben" pendiente dentro de un viaje: el total del viaje cuenta 0 hasta cobrarlo (usa `efectivo`). Test en Task 3.
- Divisa no EUR sin tasa, tasa 0 o redondeo (19,99 × 1,17 → 23,39 €): no se guarda sin tasa válida y el redondeo es a 2 decimales. Test en Task 2.

---

### Task 1: Base compatible — test harness, categorías y migración

**Files:**
- Create: `tests/app.test.js`
- Modify: `js/datos.js`
- Docs: `docs/superpowers/specs/2026-11-16-viajes-divisas-categorias-design.md` (ya escrito), este plan

**Interfaces:**
- Consumes: nada.
- Produces: `CATS` con `tabaco` y `alojamiento`; `datos.viajes` (array normalizado); `datos.config.cambios` (objeto); `normalizarViajes(arr)`; `ESTADOS_VIAJE` (objeto `estado → { nombre, color, icono }`). Helper de tests `cargar(raw)` para el resto de tareas.

- [ ] **Step 1: Write the failing test**

`tests/app.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/app.test.js`
Expected: FAIL — `tabaco` no existe / `datos.viajes` es `undefined`.

- [ ] **Step 3: Implementar categorías, viajes y migración en `js/datos.js`**

En `CATS`, insertar `alojamiento` después de `transporte` y `tabaco` después de `alcohol`, con los valores del Global Constraints.

Añadir:

```js
const ESTADOS_VIAJE = {
  pendiente:  { nombre: "Sin empezar", color: "#94A3B8", icono: "⚪" },
  curso:      { nombre: "En curso",    color: "#10B981", icono: "🟢" },
  finalizado: { nombre: "Terminado",   color: "#AEC6CF", icono: "✔️" },
};

function normalizarViajes(arr) {
  return (Array.isArray(arr) ? arr : [])
    .filter(v => v && v.id)
    .map(v => ({
      id: String(v.id),
      nombre: String(v.nombre || "Viaje"),
      desde: typeof v.desde === "string" ? v.desde : "",
      hasta: typeof v.hasta === "string" ? v.hasta : "",
      estado: ESTADOS_VIAJE[v.estado] ? v.estado : "pendiente",
    }));
}
```

En `INICIALES`: `config: { presupuesto: 1000, fondo: null, cambios: {} }` y `viajes: []`.

En la carga, dentro del `if (raw && typeof raw === "object")`, añadir `viajes` con `normalizarViajes(raw.viajes)` y sanear `config.cambios`:

```js
const cambios = raw.config && typeof raw.config.cambios === "object" && raw.config.cambios ? raw.config.cambios : {};
// en el objeto datos:
config: { ...structuredClone(INICIALES.config), ...(raw.config || {}), cambios },
viajes: normalizarViajes(raw.viajes),
```

En el `else` de fallback no hace falta nada: `structuredClone(INICIALES)` ya trae `viajes` y `cambios`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/app.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/matru/Desktop/cartera_gastos
git add docs tests js/datos.js
git commit -m "docs: diseño y plan; feat: categorías tabaco y alojamiento y base de viajes"
```

---

### Task 2: Gasto en divisa con conversión manual

**Files:**
- Modify: `js/datos.js`
- Test: `tests/app.test.js`

**Interfaces:**
- Consumes: `CATS`, `datos`.
- Produces: `DIVISAS` (array de códigos ISO con `"EUR"` primero); `importeEnEuros(cantidad, tasa) → number | NaN`; `nuevoGasto({ fecha, categoria, cantidad, moneda, tasa, nota, bizumTipo, viajeId }) → gasto`.

- [ ] **Step 1: Write the failing test**

Añadir a `tests/app.test.js`:

```js
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
  assert.ok(Number.isNaN(ver("importeEnEuros(10, 0)")));
  assert.ok(Number.isNaN(ver("importeEnEuros(10, undefined)")));
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/app.test.js`
Expected: FAIL — `nuevoGasto is not defined`.

- [ ] **Step 3: Implementar `DIVISAS`, `importeEnEuros` y `nuevoGasto` en `js/datos.js`**

```js
const DIVISAS = ["EUR", "USD", "GBP", "CHF", "PLN", "CZK", "HUF", "SEK", "NOK", "DKK", "TRY", "MAD", "JPY"];

function importeEnEuros(cantidad, tasa) {
  const c = Number(cantidad), t = Number(tasa);
  if (!Number.isFinite(c) || !Number.isFinite(t) || t <= 0) return NaN;
  return Math.round(c * t * 100) / 100;
}

function nuevoGasto(opts) {
  const original = Math.round(Number(opts.cantidad) * 100) / 100;
  const extranjera = !!opts.moneda && opts.moneda !== "EUR";
  const g = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    fecha: opts.fecha,
    categoria: opts.categoria,
    cantidad: extranjera ? importeEnEuros(original, opts.tasa) : original,
    nota: opts.nota || "",
  };
  if (extranjera) {
    g.moneda = opts.moneda;
    g.cantidadOriginal = original;
    g.tasa = Number(opts.tasa);
  }
  if (opts.viajeId) g.viajeId = opts.viajeId;
  if (opts.categoria === "bizum") {
    g.bizumTipo = opts.bizumTipo;
    if (opts.bizumTipo === "recibo") g.pendiente = true;
  }
  return g;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/app.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add js/datos.js tests/app.test.js
git commit -m "feat: gastos en divisa con conversión manual a euros"
```

---

### Task 3: Consultas y reglas de viajes

**Files:**
- Modify: `js/datos.js`
- Test: `tests/app.test.js`

**Interfaces:**
- Consumes: `datos`, `viajePorId`, `efectivo`.
- Produces:
  - `viajePorId(id) → viaje | null`
  - `viajesOrdenados() → viaje[]` (curso, pendiente, finalizado)
  - `gastosDeViaje(id) → gasto[]`
  - `totalViaje(id) → number` (euros, con `efectivo`)
  - `esCategoriaDeViaje(cat) → boolean` (`viajes` o `alojamiento`)
  - `viajesElegibles(categoria) → viaje[]`
  - `gastosEnlazables(viaje) → gasto[]`
  - `fechasViaje(v) → string` (en `js/util.js`)

- [ ] **Step 1: Write the failing test**

Añadir a `tests/app.test.js`:

```js
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
  assert.equal(ver("totalViaje('v9')"), 0);
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
  assert.deepEqual(ver(`gastosEnlazables(viajePorId("v2")).map(g => g.id)`), [12, 13]);
  assert.deepEqual(ver(`gastosEnlazables(viajePorId("v4")).map(g => g.id)`), [12]);
});

test("fechas del viaje se muestran si existen", () => {
  const { ver } = cargar(null);
  assert.equal(ver(`fechasViaje({ desde: "", hasta: "" })`), "");
  assert.ok(ver(`fechasViaje({ desde: "2026-02-01", hasta: "" })`).length > 0);
  assert.ok(ver(`fechasViaje({ desde: "2026-02-01", hasta: "2026-02-04" })`).includes("–"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/app.test.js`
Expected: FAIL — `viajePorId is not defined`.

- [ ] **Step 3: Implementar los helpers en `js/datos.js` y `fechasViaje` en `js/util.js`**

En `js/datos.js`:

```js
function viajePorId(id) {
  return datos.viajes.find(v => v.id === id) || null;
}
function gastosDeViaje(id) {
  return datos.gastos.filter(g => g.viajeId === id);
}
function totalViaje(id) {
  return gastosDeViaje(id).reduce((s, g) => s + efectivo(g), 0);
}
function viajesOrdenados() {
  const orden = { curso: 0, pendiente: 1, finalizado: 2 };
  return datos.viajes.slice().sort((a, b) => {
    if (orden[a.estado] !== orden[b.estado]) return orden[a.estado] - orden[b.estado];
    const campo = a.estado === "finalizado" ? "hasta" : "desde";
    const fa = a[campo] || "", fb = b[campo] || "";
    if (fa !== fb) {
      if (!fa) return 1;
      if (!fb) return -1;
      return a.estado === "finalizado" ? (fa < fb ? 1 : -1) : (fa < fb ? -1 : 1);
    }
    const cmp = String(a.id).localeCompare(String(b.id));
    return a.estado === "finalizado" ? -cmp : cmp;
  });
}
const CATS_VIAJE = ["viajes", "alojamiento"];
function esCategoriaDeViaje(cat) {
  return CATS_VIAJE.includes(cat);
}
function viajesElegibles(categoria) {
  return viajesOrdenados().filter(v => v.estado === "curso" || esCategoriaDeViaje(categoria));
}
function gastosEnlazables(viaje) {
  return datos.gastos
    .filter(g => !viajePorId(g.viajeId))
    .filter(g => viaje.estado === "curso" || esCategoriaDeViaje(g.categoria))
    .sort((a, b) => a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.id - a.id);
}
```

En `js/util.js`:

```js
function fechasViaje(v) {
  const f = d => d ? fechaCorta(d) : "";
  if (v.desde && v.hasta) return f(v.desde) + " – " + f(v.hasta);
  return f(v.desde || v.hasta);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/app.test.js`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add js/datos.js js/util.js tests/app.test.js
git commit -m "feat: consultas y reglas de viajes"
```

---

### Task 4: Formulario de gasto con divisa y viaje

**Files:**
- Modify: `js/datos.js` (estado de UI), `js/vistas.js` (`vistaAnadir`), `js/app.js` (`elegirCategoria`, `anadirGasto` y acciones nuevas)
- Test: `tests/app.test.js` (solo helpers ya cubiertos; este task se verifica en navegador)

**Interfaces:**
- Consumes: `DIVISAS`, `importeEnEuros`, `nuevoGasto`, `viajesElegibles`, `viajePorId`, `cambios`.
- Produces: estado `fDivisa` (`"EUR"` por defecto) y `fViaje` (`null` por defecto); acciones `elegirDivisa(cod)`, `actualizarConversion()`, `actualizarViajesElegibles()`; `anadirGasto()` usa `nuevoGasto`. HTML: `#f-divisa`, `#f-tasa`, `#f-conv`, `#f-viaje`.

- [ ] **Step 1: Estado de UI en `js/datos.js`**

Junto a `fCat`/`fBizumTipo`:

```js
let fDivisa = "EUR";
let fViaje = null;
```

- [ ] **Step 2: Cambiar `vistaAnadir` en `js/vistas.js`**

Después del campo de cantidad, añadir un selector de divisa con `DIVISAS` (`onchange="elegirDivisa(this.value)"`, `EUR` seleccionado según `fDivisa`). A continuación, un bloque `#divisa-extra` que solo se muestra si `fDivisa !== "EUR"`:

```html
<div id="divisa-extra" style="display:none;margin-bottom:14px">
  <label class="etiqueta">Cambio a euros (1 <span id="f-divisa-nombre">GBP</span> = ? €)</label>
  <input id="f-tasa" class="campo num" inputmode="decimal" placeholder="1,17" oninput="actualizarConversion()">
  <div id="f-conv" class="caption" style="margin-top:-6px">≈ 0,00 €</div>
</div>
```

Antes del botón "Apuntarlo", el selector de viaje:

```html
<label class="etiqueta">Viaje (opcional)</label>
<select id="f-viaje" class="campo" onchange="fViaje = this.value || null">
  <option value="">Sin viaje</option>
  <!-- viajesElegibles(fCat), con selected si coincide con fViaje -->
</select>
<div class="caption" style="margin-top:-8px">Solo salen los viajes en curso; los de vuelos y alojamiento salen todos.</div>
```

- [ ] **Step 3: Acciones en `js/app.js`**

```js
function elegirDivisa(cod) {
  fDivisa = cod;
  const extra = document.getElementById("divisa-extra");
  if (extra) extra.style.display = cod === "EUR" ? "none" : "block";
  const simbolo = document.getElementById("f-divisa-nombre");
  if (simbolo) simbolo.textContent = cod;
  const tasa = document.getElementById("f-tasa");
  if (tasa) tasa.value = (!datos.config.cambios[cod] ? "" : String(datos.config.cambios[cod]).replace(".", ","));
  actualizarConversion();
}

function actualizarConversion() {
  const linea = document.getElementById("f-conv");
  if (!linea) return;
  const cantidad = parseNum(document.getElementById("f-cantidad").value);
  const tasa = parseNum(document.getElementById("f-tasa").value);
  const euros = importeEnEuros(cantidad, tasa);
  linea.textContent = Number.isNaN(euros) ? "≈ 0,00 €" : "≈ " + eur(euros);
}

function actualizarViajesElegibles() {
  const sel = document.getElementById("f-viaje");
  if (!sel) return;
  const validos = viajesElegibles(fCat);
  if (fViaje && !validos.some(v => v.id === fViaje)) fViaje = null;
  sel.innerHTML = '<option value="">Sin viaje</option>' + validos.map(v =>
    '<option value="' + v.id + '"' + (v.id === fViaje ? " selected" : "") + ">" + esc(v.nombre) + " · " + ESTADOS_VIAJE[v.estado].nombre + "</option>"
  ).join("");
}
```

- Al final de `elegirCategoria`, llamar a `actualizarViajesElegibles()`.
- Añadir `oninput="actualizarConversion()"` al `#f-cantidad`.
- Reescribir `anadirGasto()` para leer `fDivisa`, `#f-tasa` y `fViaje`, validar tasa si la divisa no es EUR (`!tasa` o `tasa <= 0` → `avisar("Pon el cambio a euros")` y salir), construir con `nuevoGasto(...)`, guardar la tasa en `datos.config.cambios[fDivisa]` cuando no sea EUR, y avisar con ambos importes: `"Apuntado " + eur(nuevo.cantidad) + " (" + original + " " + fDivisa + ")"`.
- Al entrar en la vista de añadir, el bloque de divisa debe renderizarse con el estado actual: `display` correcto y tasa prellenada desde `datos.config.cambios[fDivisa]`.

- [ ] **Step 4: Verificar en navegador**

Run: `python3 -m http.server 8000` (en la carpeta del proyecto) y abre `http://localhost:8000`.
Comprobar: gasto EUR sin viaje igual que siempre; gasto GBP 19,99 con tasa 1,17 avisa "23,39 € (19,99 GBP)"; con tasa vacía no guarda; al cambiar a Viajes aparecen los viajes terminados en el selector, y al volver a Comida desaparecen; la tasa se recuerda al volver a abrir el formulario.

- [ ] **Step 5: Commit**

```bash
git add js/datos.js js/vistas.js js/app.js
git commit -m "feat: formulario de gasto con divisa y viaje"
```

---

### Task 5: Inicio con viajes y pantalla de detalle

**Files:**
- Modify: `js/datos.js` (estado de UI), `js/vistas.js` (`vistaInicio`, `vistaViaje`), `js/app.js` (acciones, `render`, navegación)
- Test: manual en navegador

**Interfaces:**
- Consumes: `viajesOrdenados`, `totalViaje`, `viajePorId`, `gastosDeViaje`, `gastosEnlazables`, `ESTADOS_VIAJE`, `fechasViaje`, `abrirViaje`.
- Produces: estado `viajeAbierto`, `formViajeAbierto`, `enlazandoViaje`, `borrandoViajeId`; acciones `abrirViaje(id)`, `volverInicio()`, `alternarFormViaje()`, `crearViaje()`, `cambiarEstadoViaje()`, `borrarViaje()`, `alternarEnlazables()`, `enlazarGasto(gastoId)`, `desenlazarGasto(gastoId)`, `apuntarAViaje()`. `TITULOS.viaje = "Viaje"`.

- [ ] **Step 1: Estado en `js/datos.js`**

```js
let viajeAbierto = null;
let formViajeAbierto = false;
let enlazandoViaje = false;
let borrandoViajeId = null;
```

- [ ] **Step 2: Tarjeta de viajes en Inicio (`js/vistas.js`, `vistaInicio`)**

Insertar entre las tres tarjetas de estadísticas y "Últimos sablazos". Cabecera "✈️ Viajes" con botón "+ Nuevo" (`onclick="alternarFormViaje()"`). Si `formViajeAbierto`, un formulario con `#v-nombre`, `#v-desde`, `#v-hasta` (`type="date"`, opcionales) y botón "Crear viaje". Lista `viajesOrdenados()`: icono de estado, nombre, `fechasViaje(v)`, nº de gastos y `totalViaje(v.id)`. Cada fila abre el detalle. Sin viajes: mensaje de la spec.

- [ ] **Step 3: `vistaViaje()` en `js/vistas.js`**

Con `viajePorId(viajeAbierto)`; si no existe, volver a Inicio. Cabecera con botón "‹ Viajes" (`volverInicio()`), nombre, estado con su color/icono, fechas, total grande y botón de estado: pendiente → "Empezar viaje", curso → "Terminar viaje", finalizado → "Reabrir" (`cambiarEstadoViaje()`). Acciones: "+ Apuntar gasto" (`apuntarAViaje()`, solo si no está finalizado) y "Añadir gasto ya apuntado" (`alternarEnlazables()`). Si `enlazandoViaje`, lista `gastosEnlazables(v)` con botón "+" por fila (`enlazarGasto(id)`) o mensaje "No hay gastos sueltos que encajar". Lista de `gastosDeViaje(v.id)` ordenada por fecha descendente con `filaGasto` (Task 6 añade la ✕) y botón "Borrar viaje" con doble confirmación (`borrandoViajeId`). Si está finalizado: texto de que solo se pueden añadir vuelos o alojamiento.

- [ ] **Step 4: Acciones y navegación en `js/app.js`**

```js
function abrirViaje(id) { viajeAbierto = id; enlazandoViaje = false; borrandoViajeId = null; navegar("viaje"); }
function volverInicio() { viajeAbierto = null; navegar("inicio"); }
function alternarFormViaje() { formViajeAbierto = !formViajeAbierto; render(); }
function crearViaje() {
  const nombre = document.getElementById("v-nombre").value.trim();
  if (!nombre) { avisar("Ponle nombre al viaje"); return; }
  datos.viajes.push({
    id: "v" + Date.now() + Math.floor(Math.random() * 100),
    nombre,
    desde: document.getElementById("v-desde").value || "",
    hasta: document.getElementById("v-hasta").value || "",
    estado: "pendiente",
  });
  guardar();
  formViajeAbierto = false;
  render();
  avisar("Viaje creado ✈️");
}
function cambiarEstadoViaje() {
  const v = viajePorId(viajeAbierto);
  if (!v) return;
  v.estado = v.estado === "pendiente" ? "curso" : v.estado === "curso" ? "finalizado" : "curso";
  guardar(); render();
  avisar(v.estado === "curso" ? "¡Buen viaje! 🟢" : v.estado === "finalizado" ? "Viaje cerrado ✔️" : "Viaje reabierto");
}
function borrarViaje() {
  if (borrandoViajeId !== viajeAbierto) { borrandoViajeId = viajeAbierto; render(); return; }
  datos.gastos.forEach(g => { if (g.viajeId === viajeAbierto) delete g.viajeId; });
  datos.viajes = datos.viajes.filter(v => v.id !== viajeAbierto);
  guardar(); volverInicio(); avisar("Viaje borrado, sus gastos siguen ahí");
}
function alternarEnlazables() { enlazandoViaje = !enlazandoViaje; render(); }
function enlazarGasto(id) {
  const g = datos.gastos.find(x => x.id === id);
  if (!g) return;
  g.viajeId = viajeAbierto; guardar(); render(); avisar("Gasto añadido al viaje");
}
function apuntarAViaje() { fViaje = viajeAbierto; navegar("anadir"); }
```

`TITULOS` gana `viaje: "Viaje"`; `vistas` gana `viaje: vistaViaje`; en `render`, marcar Inicio como activo cuando `tab === "viaje"`; `navegar` resetea `enlazandoViaje`/`borrandoViajeId`/`formViajeAbierto`.

- [ ] **Step 5: Verificar en navegador**

Crear viaje con y sin fechas; verlo en Inicio; abrirlo; empezar; apuntar gasto desde el detalle (viaje preseleccionado); terminar; comprobar que "+ Apuntar gasto" desaparece y que en + → Comida el viaje ya no sale; que en + → Viajes sí sale; enganchar un gasto existente desde el detalle y ver el total; "✕" en Task 6; borrar viaje con gastos y comprobar que siguen en su mes.

- [ ] **Step 6: Commit**

```bash
git add js/datos.js js/vistas.js js/app.js
git commit -m "feat: viajes en inicio, detalle, estados y enganche de gastos"
```

---

### Task 6: Divisas en las filas, CSV, reinicio, caché y README

**Files:**
- Modify: `js/vistas.js` (`filaGasto`), `js/datos.js` (`filasCSV`), `js/app.js` (`exportarCSV`), `sw.js`, `README.md`
- Test: `tests/app.test.js`

**Interfaces:**
- Consumes: `viajePorId`, `datos`, `efectivo`.
- Produces: `filaGasto(g, compacta, conQuitar)` con subtítulo de divisa y botón "✕" si `conQuitar`; `filasCSV() → string[][]` con cabecera de 9 columnas.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/app.test.js`
Expected: FAIL — `filasCSV is not defined`.

- [ ] **Step 3: Implementar `filasCSV` en `js/datos.js`**

Devuelve la cabecera y una fila por gasto ordenado por fecha ascendente. Columnas actuales iguales; al final: nombre del viaje (`viajePorId(g.viajeId)?.nombre || ""`), `g.moneda || "EUR"`, `cantidadOriginal` con coma decimal o `""`, `tasa` con coma decimal o `""`. El estado de bizum se calcula como en `exportarCSV` actual.

- [ ] **Step 4: Usar `filasCSV` en `exportarCSV` (`js/app.js`) y añadir la divisa a `filaGasto`**

- `exportarCSV` construye el CSV desde `filasCSV()` con el mismo escapado y BOM de ahora.
- En `filaGasto`, si `g.moneda && g.moneda !== "EUR"`, añadir al subtítulo ` · 19,99 GBP (1 GBP = 1,17 €)` (con coma decimal). En el detalle del viaje, `filaGasto(g, false, true)` muestra además un botón "✕" que llama a `desenlazarGasto(id)`.

- [ ] **Step 5: Añadir `desenlazarGasto`, reinicio y caché**

```js
function desenlazarGasto(id) {
  const g = datos.gastos.find(x => x.id === id);
  if (!g) return;
  delete g.viajeId; guardar(); render(); avisar("Fuera del viaje");
}
```

`borrarTodo` ya reinicia viajes y `cambios` porque `INICIALES` los incluye; comprobar en navegador. En `sw.js`: `const CACHE = "gastos-v7";`.

- [ ] **Step 6: Actualizar `README.md`**

Añadir a "Qué hace": categorías nuevas, gastos en divisa con cambio manual y viajes (crear, empezar/terminar, coste total, enganchar gastos antiguos). En "Estructura", añadir `tests/app.test.js` y una línea de cómo correrlo (`node --test tests/app.test.js`). Mantener el tono y el resto del texto.

- [ ] **Step 7: Run tests**

Run: `node --test tests/app.test.js`
Expected: PASS (14 tests).

- [ ] **Step 8: Verificar en navegador y commit**

Probar CSV descargado (columnas nuevas y acentos), fila con divisa, "✕" para desenganchar, "Borrar todos los datos" (viajes y cambios vuelven a cero) y recarga offline.

```bash
git add js/datos.js js/vistas.js js/app.js sw.js README.md tests/app.test.js
git commit -m "feat: divisas en filas y CSV, desenganchar gastos y caché v7"
```

---

### Task 7: Publicar en GitHub Pages

**Files:**
- No hay cambios de código.

- [ ] **Step 1: Comprobar todo antes de subir**

Run: `node --test tests/app.test.js && git status --short && git log --oneline -8`
Expected: tests PASS, sin cambios sin commitear, 7 commits nuevos.

- [ ] **Step 2: Push a main**

```bash
git push origin main
```

- [ ] **Step 3: Verificar que GitHub Pages sirve la versión nueva**

Esperar a que despliegue y comprobar:

```bash
curl -s https://marcos-truchado.github.io/cartera_gastos/js/datos.js | grep -c "tabaco"
curl -s https://marcos-truchado.github.io/cartera_gastos/sw.js | grep "gastos-v7"
```

Expected: `1` y la línea con `gastos-v7`.

- [ ] **Step 4: Comprobación en el móvil (la hace la persona)**

Abrir la URL, cerrar y reabrir hasta ver las categorías nuevas (la caché cambia de versión), comprobar que los gastos de antes siguen, que los totales del mes no cambian, y que la PWA sigue abriendo desde la pantalla de inicio.

---

## Notas para quien ejecute

- No hay `package.json` a propósito: `node --test` funciona sin instalación.
- `node:vm` da a cada test un contexto limpio, así que `datos.js` se puede recargar sin chocar con `const` ya declarados.
- Si un test falla por `structuredClone`, comprobar que el contexto lo recibe (está en el helper).
- No tocar `CLAVE` ni la forma de `gastos` existentes. `cantidad` siempre en euros.
- Los textos nuevos van en español y con el tono actual ("crack", "broma", "sablazos").
