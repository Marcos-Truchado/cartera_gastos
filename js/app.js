// Lógica de la app: navegación, acciones, render y arranque.

// ===== Navegación =====
function navegar(t) {
  tab = t; borrandoId = null; confirmaTotal = false;
  enlazandoViaje = false; borrandoViajeId = null; formViajeAbierto = false;
  importPendiente = null;
  render(); window.scrollTo(0, 0);
}
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
  actualizarViajesElegibles();
}
function elegirBizumTipo(tipo) {
  fBizumTipo = tipo;
  document.querySelectorAll(".chip-bizum").forEach(b => {
    const activa = b.dataset.tipo === tipo;
    b.style.background = activa ? "#FB923C2E" : "#57443F";
    b.style.borderColor = activa ? "#FB923C" : "transparent";
  });
}
function elegirViaje(id) {
  fViaje = id || null;
}
function elegirDivisa(cod) {
  fDivisa = cod;
  const extra = document.getElementById("divisa-extra");
  if (extra) extra.style.display = cod === "EUR" ? "none" : "block";
  const simbolo = document.getElementById("f-divisa-nombre");
  if (simbolo) simbolo.textContent = cod;
  const tasa = document.getElementById("f-tasa");
  if (tasa) {
    const guardada = datos.config.cambios[cod];
    tasa.value = guardada ? String(guardada).replace(".", ",") : "";
  }
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
// Al cambiar de categoría, el selector de viaje se rehace: un viaje terminado
// deja de ofrecerse para comidas, pero sigue para vuelos y alojamiento.
function actualizarViajesElegibles() {
  const bloque = document.getElementById("viaje-bloque");
  const sel = document.getElementById("f-viaje");
  if (!bloque || !sel) return;
  const validos = viajesElegibles(fCat);
  if (fViaje && !validos.some(v => v.id === fViaje)) fViaje = null;
  bloque.style.display = validos.length ? "block" : "none";
  sel.innerHTML = '<option value="">Sin viaje</option>' + opcionesViajeHTML(fCat, fViaje);
}

// ===== Acciones =====
function anadirGasto() {
  const cantidad = parseNum(document.getElementById("f-cantidad").value);
  const fecha = document.getElementById("f-fecha").value;
  const nota = document.getElementById("f-nota").value.trim();
  if (!cantidad || cantidad <= 0) { avisar("Pon una cantidad, crack"); return; }
  if (!fecha) { avisar("Elige una fecha"); return; }
  const tasa = fDivisa === "EUR" ? 1 : parseNum((document.getElementById("f-tasa") || {}).value);
  if (fDivisa !== "EUR" && (!tasa || tasa <= 0)) { avisar("Pon el cambio a euros, crack"); return; }

  const nuevo = nuevoGasto({
    fecha: fecha,
    categoria: fCat,
    cantidad: cantidad,
    nota: nota,
    moneda: fDivisa,
    tasa: tasa,
    bizumTipo: fBizumTipo,
    viajeId: fViaje,
  });
  datos.gastos.push(nuevo);
  if (fDivisa !== "EUR") datos.config.cambios[fDivisa] = tasa; // se recuerda para la próxima
  guardar();
  document.getElementById("f-cantidad").value = "";
  document.getElementById("f-nota").value = "";

  // el gasto siempre cuenta en el mes de SU fecha, no en el mes que estuvieras mirando
  const mesDelGasto = fecha.slice(0, 7);
  let msg = (fCat === "bizum" && fBizumTipo === "recibo")
    ? "Apuntado 🟠 toca el bizum cuando te lo paguen"
    : "Apuntado " + eur(nuevo.cantidad) + (fDivisa !== "EUR" ? " (" + String(cantidad).replace(".", ",") + " " + fDivisa + ")" : "") + " en " + categoria(fCat).nombre;
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
  if (campo === "cantidad") f[campo] = parseNum(valor);
  else if (campo === "cada") f[campo] = Math.max(1, parseInt(valor, 10) || 1);
  else f[campo] = valor;
  guardar();
  if (campo === "desde" || campo === "cada") render();
}
function anadirFijo() {
  const nombre = document.getElementById("a-fijo-nombre").value.trim();
  const c = parseNum(document.getElementById("a-fijo-cantidad").value);
  const desde = document.getElementById("a-fijo-desde").value || mes;
  const cada = Math.max(1, parseInt(document.getElementById("a-fijo-cada").value, 10) || 1);
  if (!nombre || !c || c <= 0) { avisar("Nombre y cantidad del gasto fijo"); return; }
  datos.fijos.push({ id: "f" + Date.now() + Math.floor(Math.random() * 100), nombre: nombre, cantidad: Math.round(c * 100) / 100, desde: desde, cada: cada });
  guardar();
  render();
  avisar("Gasto fijo añadido");
}
function borrarFijo(id) { datos.fijos = datos.fijos.filter(f => f.id !== id); guardar(); render(); }

// ===== Viajes =====
function abrirViaje(id) {
  viajeAbierto = id;
  enlazandoViaje = false;
  borrandoViajeId = null;
  navegar("viaje");
}
function volverInicio() {
  viajeAbierto = null;
  navegar("inicio");
}
function alternarFormViaje() {
  formViajeAbierto = !formViajeAbierto;
  render();
}
function crearViaje() {
  const nombre = document.getElementById("v-nombre").value.trim();
  if (!nombre) { avisar("Ponle nombre al viaje"); return; }
  datos.viajes.push({
    id: "v" + Date.now() + Math.floor(Math.random() * 100),
    nombre: nombre,
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
  guardar();
  render();
  avisar(v.estado === "curso" ? "¡Buen viaje! 🟢" : "Viaje cerrado ✔️");
}
function borrarViaje() {
  if (borrandoViajeId !== viajeAbierto) { borrandoViajeId = viajeAbierto; render(); return; }
  const id = viajeAbierto;
  datos.gastos.forEach(g => { if (g.viajeId === id) delete g.viajeId; });
  datos.viajes = datos.viajes.filter(v => v.id !== id);
  guardar();
  volverInicio();
  avisar("Viaje borrado, sus gastos siguen ahí");
}
function alternarEnlazables() {
  enlazandoViaje = !enlazandoViaje;
  render();
}
function enlazarGasto(id) {
  const g = datos.gastos.find(x => x.id === id);
  const v = viajePorId(viajeAbierto);
  if (!g || !v) return;
  g.viajeId = v.id;
  guardar();
  render();
  avisar("Gasto añadido al viaje");
}
function apuntarAViaje() {
  fViaje = viajeAbierto;
  navegar("anadir");
}
function desenlazarGasto(id) {
  const g = datos.gastos.find(x => x.id === id);
  if (!g) return;
  delete g.viajeId;
  guardar();
  render();
  avisar("Fuera del viaje");
}

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

// ===== Importar CSV =====
function elegirCSV() {
  const input = document.getElementById("input-csv");
  if (input) input.click();
}
function procesarCSV(input) {
  const archivo = input.files && input.files[0];
  input.value = ""; // así se puede elegir otra vez el mismo archivo
  if (!archivo) return;
  // Si había otro CSV esperando confirmación, se descarta: nunca confirmar el anterior por error.
  importPendiente = null;
  render();
  const lector = new FileReader();
  lector.onload = function (e) {
    const r = gastosDesdeCSV(e.target.result);
    if (r.error) { avisar(r.error); return; }
    importPendiente = r;
    render();
    window.scrollTo(0, 0); // la tarjeta de confirmación está arriba
  };
  lector.onerror = function () { avisar("No se ha podido leer el archivo"); };
  lector.readAsText(archivo, "UTF-8");
}
function confirmarImportacion() {
  if (!importPendiente) return;
  const n = importPendiente.gastos.length;
  const ultimo = importPendiente.gastos.map(g => g.fecha).sort().pop();
  if (!aplicarImportacion(importPendiente)) { avisar("No hay nada que importar"); return; }
  if (ultimo) mes = ultimo.slice(0, 7); // enseña el mes del último gasto importado
  importPendiente = null;
  const guardado = guardar();
  render();
  avisar(guardado ? "Importados " + n + " gastos ✅" : "Importados en memoria, pero no se pudieron guardar ⚠️");
}
function cancelarImportacion() {
  importPendiente = null;
  render();
  avisar("Importación cancelada");
}

// ===== Datos =====
function exportarCSV() {
  const csv = filasCSV().map(f => f.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "gastos_erasmus.csv"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
const TITULOS = { inicio: "Resumen Mes", anadir: "Nuevo Gasto", registro: "La bodega", graficas: "Los Gráficos", ajustes: "Ajustes", viaje: "Viaje" };
function render() {
  if (tab === "viaje" && !viajePorId(viajeAbierto)) { tab = "inicio"; viajeAbierto = null; }
  document.getElementById("titulo").textContent = TITULOS[tab];
  const vistas = { inicio: vistaInicio, anadir: vistaAnadir, registro: vistaRegistro, graficas: vistaGraficas, ajustes: vistaAjustes, viaje: vistaViaje };
  document.getElementById("vista").innerHTML = vistas[tab]();
  ["inicio", "registro", "graficas", "ajustes"].forEach(t => {
    document.getElementById("nav-" + t).classList.toggle("activa", tab === t || (tab === "viaje" && t === "inicio"));
  });
}

aplicarFondo(); // pinta el fondo guardado (si el usuario puso uno) antes de renderizar
render();

// Modo sin conexión: registrar el service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(function () {});
}