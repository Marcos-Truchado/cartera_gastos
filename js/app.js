// Lógica de la app: navegación, acciones, render y arranque.

// ===== Navegación =====
function navegar(t) { tab = t; borrandoId = null; confirmaTotal = false; render(); window.scrollTo(0, 0); }
function cambiarMes(delta) { mes = mesVecino(mes, delta); borrandoId = null; render(); }
function ponerFiltro(c) { filtroCat = c; render(); }
function elegirCategoria(id) {
  fCat = id;
  document.querySelectorAll(".chip-cat").forEach(b => {
    const activa = b.dataset.cat === id;
    const c = categoria(b.dataset.cat);
    b.style.borderColor = activa ? c.color : "transparent";
    b.style.background = activa ? c.color + "2E" : "#57443F";
  });
  // el panel de "debo / me deben" solo tiene sentido si la categoría es bizum
  const panel = document.getElementById("bizum-opciones");
  if (panel) panel.style.display = id === "bizum" ? "flex" : "none";
  const nota = document.getElementById("bizum-nota");
  if (nota) nota.style.display = id === "bizum" ? "block" : "none";
}
function elegirBizumTipo(tipo) {
  fBizumTipo = tipo;
  document.querySelectorAll(".chip-bizum").forEach(b => {
    const activa = b.dataset.tipo === tipo;
    b.style.background = activa ? "#FB923C2E" : "#57443F";
    b.style.borderColor = activa ? "#FB923C" : "transparent";
  });
}

// ===== Acciones =====
function anadirGasto() {
  const cantidad = parseNum(document.getElementById("f-cantidad").value);
  const fecha = document.getElementById("f-fecha").value;
  const nota = document.getElementById("f-nota").value.trim();
  if (!cantidad || cantidad <= 0) { avisar("Pon una cantidad, crack"); return; }
  if (!fecha) { avisar("Elige una fecha"); return; }
  const nuevo = { id: Date.now(), fecha: fecha, categoria: fCat, cantidad: Math.round(cantidad * 100) / 100, nota: nota };
  if (fCat === "bizum") {
    nuevo.bizumTipo = fBizumTipo; // "debo" o "recibo"
    if (fBizumTipo === "recibo") nuevo.pendiente = true; // hasta que confirmes que te han pagado, no suma a tu saldo
  }
  datos.gastos.push(nuevo);
  guardar();
  document.getElementById("f-cantidad").value = "";
  document.getElementById("f-nota").value = "";

  // el gasto siempre cuenta en el mes de SU fecha, no en el mes que estuvieras mirando
  const mesDelGasto = fecha.slice(0, 7);
  let msg = (fCat === "bizum" && fBizumTipo === "recibo")
    ? "Apuntado 🟠 toca el bizum cuando te lo paguen"
    : "Apuntado 💸 " + eur(cantidad) + " en " + categoria(fCat).nombre;
  if (mesDelGasto !== mes) {
    mes = mesDelGasto; // saltamos automáticamente a ver el mes donde cae de verdad
    msg += " · va a " + nombreMes(mesDelGasto);
  }
  avisar(msg);
}
function confirmarBizum(id) {
  const g = datos.gastos.find(x => x.id === id);
  if (!g || !g.pendiente) return;
  g.pendiente = false; // ya te lo han pagado: a partir de ahora suma a tu saldo
  guardar();
  render();
  avisar("Bizum cobrado 💰 +" + eur(g.cantidad) + " a tu saldo");
}
function borrarGasto(id) {
  if (borrandoId !== id) { borrandoId = id; render(); return; }
  datos.gastos = datos.gastos.filter(g => g.id !== id);
  borrandoId = null;
  guardar();
  render();
  avisar("Fuera 🗑");
}
function guardarPresupuesto() {
  const p = parseNum(document.getElementById("a-presupuesto").value);
  if (!p || p <= 0) { avisar("Presupuesto no válido"); return; }
  datos.config.presupuesto = p;
  guardar();
  avisar("Presupuesto actualizado");
  render();
}
function actualizarFijo(id, campo, valor) {
  const f = datos.fijos.find(x => x.id === id);
  if (!f) return;
  f[campo] = campo === "cantidad" ? parseNum(valor) : valor;
  guardar();
}
function anadirFijo() {
  const nombre = document.getElementById("a-fijo-nombre").value.trim();
  const c = parseNum(document.getElementById("a-fijo-cantidad").value);
  if (!nombre || !c || c <= 0) { avisar("Nombre y cantidad del gasto fijo"); return; }
  datos.fijos.push({ id: "f" + Date.now(), nombre: nombre, cantidad: Math.round(c * 100) / 100 });
  guardar();
  render();
  avisar("Gasto fijo añadido");
}
function borrarFijo(id) { datos.fijos = datos.fijos.filter(f => f.id !== id); guardar(); render(); }

// ===== Foto de fondo =====
function elegirFondo() { document.getElementById("input-fondo").click(); }
function procesarFondo(input) {
  const archivo = input.files && input.files[0];
  if (!archivo) return;
  const lector = new FileReader();
  lector.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      // se achica la foto antes de guardarla: si no, el móvil se queda sin espacio de almacenamiento enseguida
      const maxLado = 1000;
      const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = img.width * escala;
      canvas.height = img.height * escala;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      datos.config.fondo = canvas.toDataURL("image/jpeg", 0.65);
      guardar();
      aplicarFondo();
      render();
      avisar("Fondo actualizado 🖼");
    };
    img.onerror = function () { avisar("Esa imagen no se ha podido leer"); };
    img.src = e.target.result;
  };
  lector.onerror = function () { avisar("No se ha podido abrir la foto"); };
  lector.readAsDataURL(archivo);
  input.value = ""; // para poder elegir la misma foto otra vez si hace falta
}
function quitarFondo() {
  datos.config.fondo = null;
  guardar();
  aplicarFondo();
  render();
  avisar("Fondo quitado");
}
function aplicarFondo() {
  const capa = document.getElementById("fondo-capa");
  capa.style.backgroundImage = datos.config.fondo ? 'url("' + datos.config.fondo + '")' : "none";
}

// ===== Datos =====
function exportarCSV() {
  const filas = [["fecha", "categoria", "cantidad", "nota", "bizum_estado"]];
  datos.gastos.slice().sort((a, b) => a.fecha < b.fecha ? -1 : 1).forEach(g => {
    let estado = "";
    if (g.categoria === "bizum") {
      estado = g.bizumTipo === "recibo" ? (g.pendiente ? "me lo deben (pendiente)" : "me lo pagaron") : "yo lo debo";
    }
    filas.push([g.fecha, g.categoria, String(g.cantidad).replace(".", ","), g.nota || "", estado]);
  });
  const csv = filas.map(f => f.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "gastos_erasmus.csv"; a.click();
  URL.revokeObjectURL(url);
}
function borrarTodo() {
  if (!confirmaTotal) { confirmaTotal = true; render(); return; }
  datos = structuredClone(INICIALES);
  confirmaTotal = false;
  guardar();
  render();
  avisar("Datos reiniciados");
}

// ===== Render =====
const TITULOS = { inicio: "Resumen Mes", anadir: "Nuevo Gasto", registro: "La bodega", graficas: "Los Gráficos", ajustes: "Ajustes" };
function render() {
  document.getElementById("titulo").textContent = TITULOS[tab];
  const vistas = { inicio: vistaInicio, anadir: vistaAnadir, registro: vistaRegistro, graficas: vistaGraficas, ajustes: vistaAjustes };
  document.getElementById("vista").innerHTML = vistas[tab]();
  ["inicio", "registro", "graficas", "ajustes"].forEach(t => {
    document.getElementById("nav-" + t).classList.toggle("activa", tab === t);
  });
}

aplicarFondo(); // pinta el fondo guardado (si el usuario puso uno) antes de renderizar
render();

// Modo sin conexión: registrar el service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(function () {});
}