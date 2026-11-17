// Datos y estado de la app: constantes, persistencia y consultas sobre los gastos.

const CLAVE = "erasmus_gastos_v1";
const VERDE = "#AEC6CF", COLOR_FIJOS = "#F3E5AB", GRIS = "rgba(255,255,255,.78)", VINO = "#C34A64", VINO_TOPE = "#E24B63", ORO = "#F3E5AB";

const CATS = [
  { id: "comida",      nombre: "Comida",      emoji: "🍝",  color: "#F59E0B" },
  { id: "alojamiento", nombre: "Alojamiento", emoji: "🛏️", color: "#6366F1" },
  { id: "transporte",  nombre: "Transporte",  emoji: "🚋",  color: "#0EA5E9" },
  { id: "viajes",      nombre: "Viajes",      emoji: "✈️",  color: "#10B981" },
  { id: "esqui",       nombre: "Esquí",       emoji: "⛷️",  color: "#84CC16" },
  { id: "ocio",        nombre: "Ocio",        emoji: "🎬",  color: "#EC4899" },
  { id: "fiesta",      nombre: "Fiesta",      emoji: "🎉",  color: "#A855F7" },
  { id: "alcohol",     nombre: "Alcohol",     emoji: "🍻",  color: "#EF4444" },
  { id: "tabaco",      nombre: "Tabaco",      emoji: "🚬",  color: "#A16207" },
  { id: "compras",     nombre: "Compras",     emoji: "🛍️", color: "#14B8A6" },
  { id: "bizum",       nombre: "Bizum",       emoji: "📲",  color: "#FB923C" },
  { id: "otros",       nombre: "Otros",       emoji: "📦",  color: "#94A3B8" },
];

const ESTADOS_VIAJE = {
  pendiente:  { nombre: "Sin empezar", color: "#94A3B8", icono: "⚪" },
  curso:      { nombre: "En curso",    color: "#10B981", icono: "🟢" },
  finalizado: { nombre: "Terminado",   color: "#AEC6CF", icono: "✔️" },
};

const INICIO_FIJOS = "2025-09"; // fallback para fijos antiguos sin fecha

const INICIALES = {
  config: { presupuesto: 1000, fondo: null, cambios: {} }, // fondo: foto en base64 que elige el usuario; null = sin foto
  fijos: [{ id: "resi", nombre: "Residencia", cantidad: 455, desde: INICIO_FIJOS, cada: 1 }],
  gastos: [],
  viajes: [],
};

// Estado en memoria; se persiste en localStorage con cada cambio.
// Se clona INICIALES para que los arrays anidados no queden compartidos con él
// (si no, añadir gastos "contaminaría" el estado base y el reset no vaciaría nada).
function normalizarFijos(arr) {
  return arr.map(f => ({
    id: f.id, nombre: f.nombre, cantidad: f.cantidad,
    desde: f.desde || INICIO_FIJOS, // antiguos sin fecha → desde septiembre
    cada: Number.isFinite(f.cada) && f.cada > 0 ? Math.floor(f.cada) : 1, // 1=mensual
  }));
}

// Un viaje guardado puede venir de una versión anterior o con campos raros:
// se rellena lo que falte y se descarta lo que no tenga id.
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

let datos;
try {
  const raw = JSON.parse(localStorage.getItem(CLAVE) || "null");
  if (raw && typeof raw === "object") {
    const cambios = raw.config && typeof raw.config.cambios === "object" && raw.config.cambios ? raw.config.cambios : {};
    datos = {
      config: { ...structuredClone(INICIALES.config), ...(raw.config || {}), cambios },
      fijos: Array.isArray(raw.fijos) ? normalizarFijos(raw.fijos) : structuredClone(INICIALES.fijos),
      gastos: Array.isArray(raw.gastos) ? raw.gastos : [],
      viajes: normalizarViajes(raw.viajes),
    };
  } else {
    datos = structuredClone(INICIALES);
  }
} catch {
  datos = structuredClone(INICIALES);
}

let tab = "inicio";
let mes = hoy().slice(0, 7);
let filtroCat = "todas";
let fCat = "comida";
let fBizumTipo = "debo"; // en el formulario: "debo" = yo lo debo, "recibo" = me lo deben
let borrandoId = null;
let confirmaTotal = false;

function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch {
    avisar("⚠️ No se pudo guardar");
  }
}

function categoria(id) {
  return CATS.find(c => c.id === id) || CATS[CATS.length - 1];
}

// Cuánto pesa un gasto de verdad en el saldo. Normalmente es su cantidad tal cual,
// pero un bizum que "me deben" no resta nada mientras esté pendiente, y cuando se
// confirma que ya me lo han pagado, en vez de restar SUMA saldo (por eso va en negativo).
function efectivo(g) {
  if (g.categoria === "bizum" && g.bizumTipo === "recibo") {
    return g.pendiente ? 0 : -g.cantidad;
  }
  return g.cantidad;
}

// Divisas que se pueden elegir al apuntar un gasto. El cambio se teclea a mano.
const DIVISAS = ["EUR", "USD", "GBP", "CHF", "PLN", "CZK", "HUF", "SEK", "NOK", "DKK", "TRY", "MAD", "JPY"];

// Euros por `cantidad` unidades de la divisa; NaN si la tasa no vale.
function importeEnEuros(cantidad, tasa) {
  const c = Number(cantidad), t = Number(tasa);
  if (!Number.isFinite(c) || !Number.isFinite(t) || t <= 0) return NaN;
  return Math.round(c * t * 100) / 100;
}

// Construye el gasto tal y como se guarda. `cantidad` siempre acaba en euros;
// si la divisa no es EUR se guardan también el importe tecleado y la tasa.
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

// ===== Consultas =====
function gastosDelMes(m) {
  return datos.gastos
    .filter(g => g.fecha.slice(0, 7) === m)
    .sort((a, b) => a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.id - a.id);
}

function mesesEntre(a, b) {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

function fijoActivoEnMes(f, m) {
  const desde = f.desde || INICIO_FIJOS;
  if (m < desde) return false;
  const cada = f.cada || 1;
  if (cada <= 1) return true;
  return mesesEntre(desde, m) % cada === 0;
}

function fijosDelMes(m) {
  return datos.fijos.filter(f => fijoActivoEnMes(f, m));
}

function totalFijos(m) {
  const objetivo = m || mes;
  return fijosDelMes(objetivo).reduce((s, f) => s + f.cantidad, 0);
}

// Los fijos se filtran por desde/cada; el total del mes suma solo los activos ese mes.
function totalDeMes(m) {
  const v = datos.gastos.filter(g => g.fecha.slice(0, 7) === m).reduce((s, g) => s + efectivo(g), 0);
  const f = totalFijos(m);
  return { variable: v, fijos: f, total: v + f };
}