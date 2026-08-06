// Utilidades: formato de números y fechas, escape de HTML y avisos flotantes.

function eur(n) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);
}

// Fecha de hoy en formato "AAAA-MM-DD"
function hoy() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function nombreMes(c) {
  const [a, m] = c.split("-").map(Number);
  const t = new Date(a, m - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function mesVecino(c, delta) {
  const [a, m] = c.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

function diasDelMes(c) {
  const [a, m] = c.split("-").map(Number);
  return new Date(a, m, 0).getDate();
}

function fechaCorta(f) {
  const [a, m, d] = f.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}

function etiquetaMes(c) {
  return new Date(Number(c.slice(0, 4)), Number(c.slice(5, 7)) - 1, 1).toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function parseNum(v) {
  return parseFloat(String(v).replace(",", ".")) || 0;
}

let toastTimer = null;
function avisar(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("visible"), 2200);
}