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
let fDivisa = "EUR";
let fViaje = null;
let borrandoId = null;
let confirmaTotal = false;
let viajeAbierto = null;
let formViajeAbierto = false;
let enlazandoViaje = false;
let borrandoViajeId = null;

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

// ===== Viajes =====
// Un viaje es una etiqueta: su total es la suma de los gastos que lo llevan,
// sin sacarlos del mes ni duplicarlos en ningún sitio.
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
      if (!fa) return 1; // los viajes sin fecha, al final de su grupo
      if (!fb) return -1;
      return a.estado === "finalizado" ? (fa < fb ? 1 : -1) : (fa < fb ? -1 : 1);
    }
    const cmp = String(a.id).localeCompare(String(b.id));
    return a.estado === "finalizado" ? -cmp : cmp;
  });
}
// Solo vuelos y alojamiento se pueden apuntar a un viaje que no está en curso.
const CATS_VIAJE = ["viajes", "alojamiento"];
function esCategoriaDeViaje(cat) {
  return CATS_VIAJE.includes(cat);
}
function viajesElegibles(categoria) {
  return viajesOrdenados().filter(v => v.estado === "curso" || esCategoriaDeViaje(categoria));
}
function gastosEnlazables(viaje) {
  return datos.gastos
    .filter(g => !viajePorId(g.viajeId)) // sin viaje, o con un viaje que ya no existe
    .filter(g => viaje.estado === "curso" || esCategoriaDeViaje(g.categoria))
    .sort((a, b) => a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.id - a.id);
}

// ===== Importar CSV =====
// Parser mínimo pero correcto: comillas dobles, comillas escapadas ("") y saltos
// de línea dentro de un campo. Acepta ; o , como separador.
function separadorCSV(texto) {
  const linea = texto.split("\n")[0] || "";
  let puntoYComa = 0, coma = 0, comillas = false;
  for (const ch of linea) {
    if (ch === '"') comillas = !comillas;
    else if (!comillas && ch === ";") puntoYComa++;
    else if (!comillas && ch === ",") coma++;
  }
  return puntoYComa >= coma ? ";" : ",";
}

function parsearCSV(texto) {
  const limpio = String(texto == null ? "" : texto)
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n");
  if (!limpio.trim()) return [];
  const sep = separadorCSV(limpio);
  const filas = [];
  let fila = [], campo = "", comillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const ch = limpio[i];
    if (comillas) {
      if (ch === '"') {
        if (limpio[i + 1] === '"') { campo += '"'; i++; }
        else comillas = false;
      } else campo += ch;
    } else if (ch === '"') {
      comillas = true;
    } else if (ch === sep) {
      fila.push(campo);
      campo = "";
    } else if (ch === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else {
      campo += ch;
    }
  }
  if (campo !== "" || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter(f => f.some(c => String(c).trim() !== ""));
}

function sinAcentos(s) {
  return String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

// "2025-09-03" o "03/09/2025" → "2025-09-03"; "" si la fecha no existe.
function fechaCSV(v) {
  const s = String(v == null ? "" : v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let a, mes, dia;
  if (m) { a = +m[1]; mes = +m[2]; dia = +m[3]; }
  else {
    m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if (!m) return "";
    dia = +m[1]; mes = +m[2]; a = +m[3];
  }
  const d = new Date(a, mes - 1, dia);
  if (d.getFullYear() !== a || d.getMonth() !== mes - 1 || d.getDate() !== dia) return "";
  return a + "-" + String(mes).padStart(2, "0") + "-" + String(dia).padStart(2, "0");
}

// Acepta "12,50", "1.234,56" y "12.50"; NaN si no es un número.
function importeCSV(v) {
  let s = String(v == null ? "" : v).trim().replace(/[€\s]/g, "");
  if (!s) return NaN;
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function categoriaCSV(v) {
  const n = sinAcentos(v);
  if (!n) return "otros";
  const c = CATS.find(c => c.id === n || sinAcentos(c.nombre) === n);
  return c ? c.id : "otros";
}

function bizumCSV(v) {
  const s = sinAcentos(v);
  if (s.includes("pagaron") || s.includes("pagado") || s.includes("cobrado")) return { tipo: "recibo", pendiente: false };
  if (s.includes("deben") || s.includes("pendiente") || s.includes("recibo")) return { tipo: "recibo", pendiente: true };
  return { tipo: "debo", pendiente: false };
}

const COLUMNAS_CSV = {
  fecha: ["fecha"],
  categoria: ["categoria"],
  cantidad: ["cantidad", "importe"],
  nota: ["nota"],
  bizum: ["bizum_estado", "bizum"],
  viaje: ["viaje"],
  moneda: ["moneda", "divisa"],
  cantidadOriginal: ["cantidad_original", "importe_original"],
  cambio: ["cambio", "tasa"],
};

function mapaColumnasCSV(cabecera) {
  const mapa = {};
  cabecera.forEach((c, i) => {
    const n = sinAcentos(c).replace(/\s+/g, "_");
    if (!(n in mapa)) mapa[n] = i;
  });
  const indice = {};
  Object.keys(COLUMNAS_CSV).forEach(clave => {
    const nombre = COLUMNAS_CSV[clave].find(n => mapa[n] != null);
    indice[clave] = nombre == null ? -1 : mapa[nombre];
  });
  return indice;
}

function celdaCSV(fila, i) {
  return i >= 0 && i < fila.length ? fila[i] : "";
}

// Convierte el texto de un CSV en gastos y viajes listos para guardar.
// No toca `datos`: quien importa decide cuándo sustituir.
function gastosDesdeCSV(texto) {
  const filas = parsearCSV(texto);
  if (!filas.length) return { error: "El archivo está vacío" };

  const cabecera = mapaColumnasCSV(filas[0]);
  const conCabecera = cabecera.fecha >= 0 && cabecera.categoria >= 0 && cabecera.cantidad >= 0;
  const idx = conCabecera ? cabecera : {
    fecha: 0, categoria: 1, cantidad: 2, nota: 3, bizum: 4,
    viaje: -1, moneda: -1, cantidadOriginal: -1, cambio: -1,
  };
  const filasDatos = conCabecera ? filas.slice(1) : filas;

  const gastos = [], viajes = [], porNombre = new Map();
  const base = Date.now();
  let saltadas = 0;

  filasDatos.forEach((fila, i) => {
    const fecha = fechaCSV(celdaCSV(fila, idx.fecha));
    const cantidad = importeCSV(celdaCSV(fila, idx.cantidad));
    if (!fecha || !Number.isFinite(cantidad) || cantidad <= 0) { saltadas++; return; }

    const categoria = categoriaCSV(celdaCSV(fila, idx.categoria));
    const g = {
      id: base + i,
      fecha: fecha,
      categoria: categoria,
      cantidad: Math.round(cantidad * 100) / 100,
      nota: String(celdaCSV(fila, idx.nota) || "").trim(),
    };
    if (categoria === "bizum") {
      const b = bizumCSV(celdaCSV(fila, idx.bizum));
      g.bizumTipo = b.tipo;
      if (b.pendiente) g.pendiente = true;
    }

    // Divisa: solo se reconstruye si el cambio es válido; si no, se queda en euros.
    const moneda = String(celdaCSV(fila, idx.moneda) || "").trim().toUpperCase();
    const original = importeCSV(celdaCSV(fila, idx.cantidadOriginal));
    const cambio = importeCSV(celdaCSV(fila, idx.cambio));
    if (moneda && moneda !== "EUR" && original > 0 && cambio > 0) {
      g.moneda = moneda;
      g.cantidadOriginal = Math.round(original * 100) / 100;
      g.tasa = cambio;
      g.cantidad = Math.round(original * cambio * 100) / 100;
    }

    const nombreViaje = String(celdaCSV(fila, idx.viaje) || "").trim();
    if (nombreViaje) {
      let v = porNombre.get(nombreViaje);
      if (!v) {
        v = { id: "v" + (base + viajes.length), nombre: nombreViaje, desde: "", hasta: "", estado: "pendiente" };
        porNombre.set(nombreViaje, v);
        viajes.push(v);
      }
      g.viajeId = v.id;
    }
    gastos.push(g);
  });

  if (!gastos.length) return { error: "No he encontrado gastos válidos en ese CSV" };
  return { gastos: gastos, viajes: viajes, saltadas: saltadas };
}

// Filas del CSV: las columnas de siempre y, al final, el viaje y la divisa.
function filasCSV() {
  const filas = [["fecha", "categoria", "cantidad", "nota", "bizum_estado", "viaje", "moneda", "cantidad_original", "cambio"]];
  datos.gastos.slice().sort((a, b) => a.fecha < b.fecha ? -1 : 1).forEach(g => {
    let estado = "";
    if (g.categoria === "bizum") {
      estado = g.bizumTipo === "recibo" ? (g.pendiente ? "me lo deben (pendiente)" : "me lo pagaron") : "yo lo debo";
    }
    const viaje = viajePorId(g.viajeId);
    filas.push([
      g.fecha,
      g.categoria,
      String(g.cantidad).replace(".", ","),
      g.nota || "",
      estado,
      viaje ? viaje.nombre : "",
      g.moneda || "EUR",
      g.cantidadOriginal != null ? String(g.cantidadOriginal).replace(".", ",") : "",
      g.tasa != null ? String(g.tasa).replace(".", ",") : "",
    ]);
  });
  return filas;
}