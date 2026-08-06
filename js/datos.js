// Datos y estado de la app: constantes, persistencia y consultas sobre los gastos.

const CLAVE = "erasmus_gastos_v1";
const VERDE = "#AEC6CF", COLOR_FIJOS = "#F3E5AB", GRIS = "rgba(255,255,255,.78)", VINO = "#C34A64", VINO_TOPE = "#E24B63", ORO = "#F3E5AB";

const CATS = [
  { id: "comida",     nombre: "Comida",     emoji: "🍝",  color: "#F59E0B" },
  { id: "transporte", nombre: "Transporte", emoji: "🚋",  color: "#0EA5E9" },
  { id: "viajes",     nombre: "Viajes",     emoji: "✈️",  color: "#10B981" },
  { id: "esqui",      nombre: "Esquí",      emoji: "⛷️",  color: "#84CC16" },
  { id: "ocio",       nombre: "Ocio",       emoji: "🎬",  color: "#EC4899" },
  { id: "fiesta",     nombre: "Fiesta",     emoji: "🎉",  color: "#A855F7" },
  { id: "alcohol",    nombre: "Alcohol",    emoji: "🍻",  color: "#EF4444" },
  { id: "compras",    nombre: "Compras",    emoji: "🛍️", color: "#14B8A6" },
  { id: "bizum",      nombre: "Bizum",      emoji: "📲",  color: "#FB923C" },
  { id: "otros",      nombre: "Otros",      emoji: "📦",  color: "#94A3B8" },
];

const INICIALES = {
  config: { presupuesto: 1000, fondo: null }, // fondo: foto en base64 que elige el usuario; null = sin foto
  fijos: [{ id: "resi", nombre: "Residencia", cantidad: 455 }],
  gastos: [],
};

// Estado en memoria; se persiste en localStorage con cada cambio.
// Se clona INICIALES para que los arrays anidados no queden compartidos con él
// (si no, añadir gastos "contaminaría" el estado base y el reset no vaciaría nada).
let datos;
try {
  datos = Object.assign({}, structuredClone(INICIALES), JSON.parse(localStorage.getItem(CLAVE)) || {});
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

// ===== Consultas =====
function gastosDelMes(m) {
  return datos.gastos
    .filter(g => g.fecha.slice(0, 7) === m)
    .sort((a, b) => a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.id - a.id);
}

function totalFijos() {
  return datos.fijos.reduce((s, f) => s + f.cantidad, 0);
}

// Los fijos solo cuentan en meses con actividad (o en el mes que estás mirando)
function totalDeMes(m) {
  const v = datos.gastos.filter(g => g.fecha.slice(0, 7) === m).reduce((s, g) => s + efectivo(g), 0);
  const f = (v > 0 || m === mes) ? totalFijos() : 0;
  return { variable: v, fijos: f, total: v + f };
}