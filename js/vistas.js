// Vistas: cada pantalla construye su HTML.

function selectorMes() {
  return '<div class="selector-mes">' +
    '<button class="btn-mes" onclick="cambiarMes(-1)">‹</button>' +
    '<span class="nombre-mes">' + nombreMes(mes) + '</span>' +
    '<button class="btn-mes" onclick="cambiarMes(1)">›</button>' +
    '</div>';
}

function filaGasto(g, compacta, conQuitar) {
  const c = categoria(g.categoria);
  const esBizumRecibo = g.categoria === "bizum" && g.bizumTipo === "recibo";
  const pendiente = esBizumRecibo && g.pendiente;
  const colorMonto = pendiente ? "#FB923C" : "#FFFFFF";
  const signo = esBizumRecibo ? "+" : "−";
  const original = g.moneda && g.moneda !== "EUR" && g.cantidadOriginal != null
    ? ' · ' + String(g.cantidadOriginal).replace(".", ",") + " " + g.moneda +
      (g.tasa ? " (" + String(g.tasa).replace(".", ",") + " €/1 " + g.moneda + ")" : "")
    : "";
  const subtitulo = pendiente ? "Pendiente de cobro · toca para confirmar" : (c.nombre + ' · ' + fechaCorta(g.fecha) + original);
  // si está pendiente, toda la fila es tocable para marcarlo como cobrado
  let html = '<div class="fila-gasto"' + (pendiente ? ' style="cursor:pointer" onclick="confirmarBizum(' + g.id + ')"' : '') + '>' +
    '<div class="icono-cat" style="background:' + c.color + '2E">' + (pendiente ? "🟠" : c.emoji) + '</div>' +
    '<div style="flex:1;min-width:0">' +
      '<div style="font-weight:700;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(g.nota || c.nombre) + '</div>' +
      '<div style="font-size:12px;color:' + (pendiente ? "#FB923C" : GRIS) + '">' + esc(subtitulo) + '</div>' +
    '</div>' +
    '<div class="num" style="font-weight:800;font-size:14px;color:' + colorMonto + '">' + signo + eur(g.cantidad) + '</div>';
  if (conQuitar) {
    html += '<button class="btn-borrar" onclick="event.stopPropagation();desenlazarGasto(' + g.id + ')" title="Quitar del viaje" style="margin-right:4px">✕</button>';
  }
  if (!compacta) {
    const conf = borrandoId === g.id;
    html += '<button class="btn-borrar' + (conf ? ' confirmar' : '') + '" onclick="event.stopPropagation();borrarGasto(' + g.id + ')">' + (conf ? "¿Seguro?" : "🗑") + '</button>';
  }
  return html + '</div>';
}

function vistaInicio() {
  const gs = gastosDelMes(mes);
  const tVar = gs.reduce((s, g) => s + efectivo(g), 0);
  const tFij = totalFijos(mes);
  const total = tVar + tFij;
  const pres = datos.config.presupuesto || 0;
  const restante = pres - total;
  const pF = pres > 0 ? Math.min(tFij / pres * 100, 100) : 0;
  const pV = pres > 0 ? Math.min(tVar / pres * 100, 100 - pF) : 0;
  const esActual = mes === hoy().slice(0, 7);
  const dia = Number(hoy().slice(8, 10));
  const media = esActual && dia > 0 ? tVar / dia : tVar / diasDelMes(mes);
  const proy = esActual ? media * diasDelMes(mes) + tFij : total;

  const pctReal = pres > 0 ? Math.round(total / pres * 100) : 0;

  let html = selectorMes();
  html += '<div class="tarjeta">' +
    '<span class="etiqueta" style="text-transform:uppercase;letter-spacing:.8px">' +
      (restante >= 0 ? "Te queda este mes" : "Te has pasado 😬") + '</span>' +
    '<div class="num" style="font-size:42px;font-weight:800;letter-spacing:-1px;color:#FFFFFF">' +
      eur(Math.abs(restante)) + '</div>' +
    '<div style="font-size:13px;color:' + GRIS + ';margin-bottom:14px">de ' + eur(pres) + ' de presupuesto</div>' +
    puroSVG(pF / 100, pV / 100) +
    '<div class="caption num" style="margin-top:8px">Llevas el ' + pctReal + '% · puro entero = mes fundido 🚬</div>' +
    '<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:13px;color:' + GRIS + '">' +
      '<span><span class="punto" style="background:#5E3A1B"></span>Fijos ' + eur(tFij) + '</span>' +
      '<span><span class="punto" style="background:#9C6B2F"></span>Variable ' + eur(tVar) + '</span>' +
    '</div></div>';

  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px">';
  [["Fundido", total], ["Media/día", media], ["Proyección", proy]].forEach(t => {
    html += '<div class="tarjeta" style="padding:12px;margin:0">' +
      '<div style="font-size:11px;color:' + GRIS + ';font-weight:700">' + t[0] + '</div>' +
      '<div class="num" style="font-size:15px;font-weight:800">' + eur(t[1]) + '</div></div>';
  });
  html += '</div>';

  html += seccionViajes();

  html += '<div class="tarjeta"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
    '<span style="font-weight:800">Últimos sablazos</span>' +
    '<button onclick="navegar(\'registro\')" style="font-size:13px;color:' + VERDE + ';font-weight:700;background:none;border:none">Ver todo</button></div>';
  if (gs.length === 0) {
    html += '<div style="color:' + GRIS + ';font-size:14px;padding:8px 0">Cero gastos este mes.</div>';
  } else {
    gs.slice(0, 4).forEach(g => { html += filaGasto(g, true); });
  }
  return html + '</div>';
}

// Tarjeta de viajes de Inicio: crear y abrir cada viaje.
function seccionViajes() {
  let html = '<div class="tarjeta"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
    '<span style="font-weight:800">✈️ Viajes</span>' +
    '<button onclick="alternarFormViaje()" style="font-size:13px;color:' + VERDE + ';font-weight:700;background:none;border:none">' +
    (formViajeAbierto ? "Cancelar" : "+ Nuevo") + '</button></div>';

  if (formViajeAbierto) {
    html += '<div style="background:#3A2A27;border:1px solid #5C4642;border-radius:14px;padding:10px;margin-bottom:10px">' +
      '<input id="v-nombre" class="campo" style="margin:0 0 8px;font-size:14px" placeholder="¿A dónde te vas? (ej.: Praga)">' +
      '<div style="display:flex;gap:8px">' +
      '<input id="v-desde" class="campo" style="margin:0;flex:1;font-size:13px;padding:9px 8px" type="date">' +
      '<input id="v-hasta" class="campo" style="margin:0;flex:1;font-size:13px;padding:9px 8px" type="date">' +
      '</div><div class="caption" style="margin:6px 0 8px">Las fechas son opcionales.</div>' +
      '<button onclick="crearViaje()" style="width:100%;padding:11px;border-radius:12px;background:' + VERDE + ';color:#33272B;font-weight:800;border:none">Crear viaje</button></div>';
  }

  const vs = viajesOrdenados();
  if (vs.length === 0) {
    html += '<div style="color:' + GRIS + ';font-size:14px;padding:4px 0">Aún no hay viajes. Crea uno para saber cuánto te cuesta cada escapada.</div>';
  } else {
    vs.forEach(v => {
      const e = ESTADOS_VIAJE[v.estado];
      const fechas = fechasViaje(v);
      const n = gastosDeViaje(v.id).length;
      html += '<div class="fila-gasto" style="cursor:pointer" onclick="abrirViaje(\'' + v.id + '\')">' +
        '<div class="icono-cat" style="background:' + e.color + '2E">' + e.icono + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:700;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(v.nombre) + '</div>' +
          '<div style="font-size:12px;color:' + GRIS + '">' + e.nombre + (fechas ? ' · ' + esc(fechas) : '') +
            ' · ' + n + (n === 1 ? ' gasto' : ' gastos') + '</div>' +
        '</div>' +
        '<div class="num" style="font-weight:800;font-size:14px">' + eur(totalViaje(v.id)) + '</div>' +
      '</div>';
    });
  }
  return html + '</div>';
}

// Pantalla de un viaje: estado, total, gastos y acciones.
function vistaViaje() {
  const v = viajePorId(viajeAbierto);
  if (!v) return "";
  const e = ESTADOS_VIAJE[v.estado];
  const fechas = fechasViaje(v);
  const n = gastosDeViaje(v.id).length;
  const boton = v.estado === "pendiente" ? "Empezar viaje" : v.estado === "curso" ? "Terminar viaje" : "Reabrir";

  let html = '<div class="tarjeta">' +
    '<button onclick="volverInicio()" style="background:none;border:none;color:' + VERDE + ';font-weight:700;font-size:14px;padding:0 0 8px">‹ Viajes</button>' +
    '<div style="font-size:24px;font-weight:800;letter-spacing:-.5px">' + esc(v.nombre) + '</div>' +
    '<div style="font-size:13px;font-weight:700;color:' + e.color + ';margin-top:2px">' + e.icono + ' ' + e.nombre +
      (fechas ? '<span style="color:' + GRIS + ';font-weight:400"> · ' + esc(fechas) + '</span>' : '') + '</div>' +
    '<div class="num" style="font-size:36px;font-weight:800;margin:10px 0 2px">' + eur(totalViaje(v.id)) + '</div>' +
    '<div class="caption" style="margin:0 0 12px">' + n + (n === 1 ? ' gasto' : ' gastos') + ' · cuenta en el mes de cada gasto, sin duplicarse.</div>' +
    '<button class="btn-principal" onclick="cambiarEstadoViaje()"' +
      (v.estado === "finalizado" ? ' style="background:#57443F;color:#FFFFFF;border:1px solid #6B534E"' : '') + '>' + boton + '</button>' +
    '</div>';

  html += '<div class="tarjeta">';
  if (v.estado === "curso") {
    html += '<button onclick="apuntarAViaje()" style="width:100%;padding:12px;border-radius:12px;background:' + VERDE + ';color:#33272B;font-weight:800;border:none;margin-bottom:8px">+ Apuntar gasto</button>';
  } else if (v.estado === "pendiente") {
    html += '<div class="caption" style="margin:0 0 10px">Empieza el viaje para apuntarle gastos. Mientras, puedes engancharle vuelos y alojamiento.</div>';
  } else {
    html += '<div class="caption" style="margin:0 0 10px">Viaje cerrado: solo puedes añadir vuelos o alojamiento desde + eligiendo esa categoría.</div>';
  }
  html += '<button onclick="alternarEnlazables()" style="width:100%;padding:12px;border-radius:12px;background:#57443F;color:#FFFFFF;font-weight:700;border:1px solid #6B534E">' +
    (enlazandoViaje ? "Cerrar lista" : "Añadir gasto ya apuntado") + '</button>';

  if (enlazandoViaje) {
    const sueltos = gastosEnlazables(v);
    html += '<div style="margin-top:10px;max-height:260px;overflow-y:auto">';
    if (sueltos.length === 0) {
      html += '<div class="caption" style="margin:6px 0 0">No hay gastos sueltos que encajar.</div>';
    } else {
      sueltos.forEach(g => {
        const c = categoria(g.categoria);
        html += '<div class="fila-gasto">' +
          '<div class="icono-cat" style="background:' + c.color + '2E">' + c.emoji + '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(g.nota || c.nombre) + '</div>' +
            '<div style="font-size:11px;color:' + GRIS + '">' + esc(fechaCorta(g.fecha)) + ' · ' + c.nombre + '</div>' +
          '</div>' +
          '<div class="num" style="font-size:13px;font-weight:700;margin-right:6px">' + eur(g.cantidad) + '</div>' +
          '<button class="btn-borrar" onclick="enlazarGasto(' + g.id + ')">+</button>' +
        '</div>';
      });
    }
    html += '</div>';
  }
  html += '</div>';

  const gastos = gastosDeViaje(v.id).slice().sort((a, b) => a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.id - a.id);
  html += '<div class="tarjeta"><div style="font-weight:800;margin-bottom:4px">Gastos del viaje</div>';
  if (gastos.length === 0) {
    html += '<div class="caption" style="margin-top:6px">Todavía no hay nada apuntado a este viaje.</div>';
  } else {
    gastos.forEach(g => { html += filaGasto(g, false, true); });
  }
  html += '</div>';

  html += '<div class="tarjeta"><button onclick="borrarViaje()" style="width:100%;padding:13px;border-radius:12px;font-weight:700;font-size:14px;border:none;background:' +
    (borrandoViajeId === v.id ? "#EF4444;color:#fff" : "#2A1518;color:#F87171") + '">' +
    (borrandoViajeId === v.id ? "Pulsa otra vez para confirmar" : "Borrar viaje") + '</button>' +
    '<div class="caption">Sus gastos no se borran: solo dejan de pertenecer al viaje.</div></div>';
  return html;
}

// Opciones del selector de viaje. Lo usan la vista y el refresco al cambiar de categoría.
function opcionesViajeHTML(categoria, seleccionado) {
  return viajesElegibles(categoria).map(v =>
    '<option value="' + v.id + '"' + (v.id === seleccionado ? " selected" : "") + '>' +
    esc(v.nombre) + " · " + ESTADOS_VIAJE[v.estado].nombre + "</option>").join("");
}

// Bloque de viaje del formulario. Siempre está en el HTML (aunque se oculte)
// para que al cambiar de categoría se pueda rellenar sin volver a entrar.
function bloqueViajeHTML() {
  const validos = viajesElegibles(fCat);
  if (fViaje && !validos.some(v => v.id === fViaje)) fViaje = null;
  return '<div id="viaje-bloque" style="display:' + (validos.length ? "block" : "none") + '">' +
    '<label class="etiqueta">Viaje (opcional)</label>' +
    '<select id="f-viaje" class="campo" onchange="elegirViaje(this.value)">' +
    '<option value=""' + (fViaje ? "" : " selected") + '>Sin viaje</option>' + opcionesViajeHTML(fCat, fViaje) + '</select>' +
    '<div class="caption" style="margin-top:-8px">Solo salen los viajes en curso; para vuelos y alojamiento salen todos.</div></div>';
}

function vistaAnadir() {
  let chips = "";
  CATS.forEach(c => {
    const activa = fCat === c.id;
    chips += '<button class="chip-cat" data-cat="' + c.id + '" onclick="elegirCategoria(\'' + c.id + '\')" style="' +
      (activa ? 'border-color:' + c.color + ';background:' + c.color + '2E' : '') + '">' +
      '<div class="emoji">' + c.emoji + '</div><div class="nombre">' + c.nombre + '</div></button>';
  });
  // panel para elegir si el bizum es dinero que debo o que me deben (solo se ve si la categoría es bizum)
  const mostrarBizum = fCat === "bizum" ? "flex" : "none";
  const bizumPanel = '<div id="bizum-opciones" style="display:' + mostrarBizum + ';gap:8px;margin:-2px 0 14px">' +
    '<button class="chip-bizum" data-tipo="debo" onclick="elegirBizumTipo(\'debo\')" style="flex:1;padding:10px 4px;border-radius:14px;text-align:center;font-weight:700;font-size:13px;border:2px solid ' +
      (fBizumTipo === "debo" ? "#FB923C;background:#FB923C2E" : "transparent;background:#57443F") + '">💸 Yo lo debo</button>' +
    '<button class="chip-bizum" data-tipo="recibo" onclick="elegirBizumTipo(\'recibo\')" style="flex:1;padding:10px 4px;border-radius:14px;text-align:center;font-weight:700;font-size:13px;border:2px solid ' +
      (fBizumTipo === "recibo" ? "#FB923C;background:#FB923C2E" : "transparent;background:#57443F") + '">🟠 Me lo deben</button></div>' +
    '<div id="bizum-nota" class="caption" style="display:' + mostrarBizum + ';margin:-10px 0 14px">Si "lo debo" se descuenta ya. Si "me lo deben" no resta nada hasta que confirmes el cobro tocando el gasto.</div>';

  // divisa: si no es euro, se pide el cambio a mano y se enseña la conversión al momento
  const extranjera = fDivisa !== "EUR";
  const tasaGuardada = datos.config.cambios[fDivisa];
  const tasaValor = tasaGuardada ? String(tasaGuardada).replace(".", ",") : "";
  const divisaPanel = '<label class="etiqueta">Divisa</label>' +
    '<select id="f-divisa" class="campo" onchange="elegirDivisa(this.value)">' +
    DIVISAS.map(d => '<option value="' + d + '"' + (d === fDivisa ? " selected" : "") + ">" + d + "</option>").join("") + '</select>' +
    '<div id="divisa-extra" style="display:' + (extranjera ? "block" : "none") + ';margin-bottom:14px">' +
    '<label class="etiqueta">Cambio a euros (1 <span id="f-divisa-nombre">' + fDivisa + '</span> = ? €)</label>' +
    '<input id="f-tasa" class="campo num" inputmode="decimal" placeholder="1,17" value="' + tasaValor + '" oninput="actualizarConversion()">' +
    '<div id="f-conv" class="caption" style="margin-top:-6px">≈ 0,00 €</div></div>';

  const tFijAdd = totalFijos(mes);
  return '<div class="tarjeta">' +
    '<div style="font-weight:800;margin-bottom:12px">¿Cuanto fué la broma?</div>' +
    '<label class="etiqueta">Cantidad</label>' +
    '<input id="f-cantidad" class="campo-cantidad num" inputmode="decimal" placeholder="0,00" oninput="actualizarConversion()">' +
    divisaPanel +
    '<label class="etiqueta">Categoría</label>' +
    '<div class="rejilla3" style="margin:8px 0 14px">' + chips + '</div>' +
    bizumPanel +
    '<label class="etiqueta">Fecha</label>' +
    '<input id="f-fecha" class="campo" type="date" value="' + hoy() + '">' +
    '<label class="etiqueta">Nota (opcional)</label>' +
    '<input id="f-nota" class="campo" placeholder="Ej.: kebab post-fiesta">' +
    bloqueViajeHTML() +
    '<button class="btn-principal" onclick="anadirGasto()">Apuntarlo 💸</button>' +
    '</div>' +
    '<div class="tarjeta" style="background:rgba(174,198,207,.14);border-color:rgba(174,198,207,.4)"><div style="font-size:13px;color:#FFFFFF">🏠 Los gastos fijos (' +
    eur(tFijAdd) + ') se descuentan solos según su inicio/periodicidad. Se cambian en Ajustes.</div></div>';
}

function vistaRegistro() {
  const gs = gastosDelMes(mes);
  const filtrados = filtroCat === "todas" ? gs : gs.filter(g => g.categoria === filtroCat);

  let html = selectorMes();

  html += '<div class="tarjeta"><div style="font-weight:800;margin-bottom:2px">Gastos Por Mes🍷</div>' +
    '<div class="caption" style="margin-top:0;margin-bottom:6px">Cada botella es un mes. Se llena con lo que gastas; el tope es tu presupuesto (' + eur(datos.config.presupuesto) + ').</div>' +
    bodegaHTML() + '</div>';

  html += '<div class="filtros">';
  [{ id: "todas", nombre: "Todas", emoji: "🧾" }].concat(CATS).forEach(c => {
    html += '<button class="filtro' + (filtroCat === c.id ? ' activo' : '') + '" onclick="ponerFiltro(\'' + c.id + '\')">' + c.emoji + ' ' + c.nombre + '</button>';
  });
  html += '</div>';

  const activos = fijosDelMes(mes);
  const tFijReg = activos.reduce((s, f) => s + f.cantidad, 0);
  html += '<div class="tarjeta"><div style="display:flex;justify-content:space-between">' +
    '<span style="font-weight:800">Gastos fijos del mes</span>' +
    '<span class="num" style="font-weight:800;color:' + COLOR_FIJOS + '">−' + eur(tFijReg) + '</span></div>';
  if (activos.length === 0) {
    html += '<div style="font-size:12px;color:' + GRIS + ';margin-top:6px">Sin fijos activos este mes</div>';
  } else {
    activos.forEach(f => {
      const cadaTx = f.cada === 12 ? 'anual' : f.cada === 6 ? 'semestral' : f.cada === 3 ? 'trimestral' : 'mensual';
      html += '<div style="display:flex;justify-content:space-between;font-size:13px;color:' + GRIS + ';margin-top:6px">' +
        '<span>🏠 ' + esc(f.nombre) + ' <span style="opacity:.6">· ' + f.desde + ' · ' + cadaTx + '</span></span><span class="num">' + eur(f.cantidad) + '</span></div>';
    });
  }
  html += '</div>';

  if (filtrados.length === 0) {
    html += '<div class="tarjeta" style="text-align:center;color:' + GRIS + ';font-size:14px;padding:26px 16px">No hay gastos variables' +
      (filtroCat !== "todas" ? " de esta categoría" : "") + ' este mes.</div>';
    return html;
  }

  const grupos = [];
  filtrados.forEach(g => {
    const gr = grupos.find(x => x.fecha === g.fecha);
    if (gr) gr.items.push(g); else grupos.push({ fecha: g.fecha, items: [g] });
  });
  grupos.forEach(gr => {
    const sub = gr.items.reduce((s, g) => s + efectivo(g), 0);
    html += '<div class="tarjeta" style="padding-top:12px;padding-bottom:6px">' +
      '<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:' + GRIS + ';text-transform:uppercase;letter-spacing:.5px">' +
      '<span>' + fechaCorta(gr.fecha) + '</span><span class="num">' + eur(sub) + '</span></div><div style="margin-top:4px">';
    gr.items.forEach(g => { html += filaGasto(g, false); });
    html += '</div></div>';
  });
  return html;
}

function vistaGraficas() {
  const gs = gastosDelMes(mes);
  const tFij = totalFijos(mes);
  const tVar = gs.reduce((s, g) => s + efectivo(g), 0);
  const total = tVar + tFij;

  const mapa = {};
  // los bizums que me deben no son "gasto en una categoría", así que no entran en el reparto
  gs.forEach(g => { if (g.categoria === "bizum" && g.bizumTipo === "recibo") return; mapa[g.categoria] = (mapa[g.categoria] || 0) + g.cantidad; });
  const partes = [];
  if (tFij > 0) partes.push({ nombre: "Fijos (resi)", emoji: "🏠", valor: tFij, color: COLOR_FIJOS });
  CATS.forEach(c => { if (mapa[c.id] > 0) partes.push({ nombre: c.nombre, emoji: c.emoji, valor: mapa[c.id], color: c.color }); });
  const totalDonut = partes.reduce((s, p) => s + p.valor, 0);

  let html = selectorMes();

  html += '<div class="tarjeta"><div style="font-weight:800;margin-bottom:10px">La caja del mes</div>';
  if (partes.length === 0) {
    html += '<div style="color:' + GRIS + ';font-size:14px;padding:14px 0">Aún no hay datos este mes.</div>';
  } else {
    html += donutSVG(partes, totalDonut || total || 1) + '<div style="margin-top:12px">';
    partes.forEach(p => {
      html += '<div class="leyenda-fila"><span><span class="punto" style="background:' + p.color + '"></span>' +
        p.emoji + ' ' + p.nombre + '</span><span class="num" style="font-weight:700">' + eur(p.valor) + ' · ' +
        Math.round(p.valor / (totalDonut || 1) * 100) + '%</span></div>';
    });
    html += '</div>';
  }
  html += '</div>';

  const dias = diasDelMes(mes);
  const porDia = Array.from({ length: dias }, (_, i) => ({ dia: i + 1, total: 0 }));
  gs.forEach(g => { const d = Number(g.fecha.slice(8, 10)); if (porDia[d - 1]) porDia[d - 1].total += efectivo(g); });
  let diaMax = null;
  porDia.forEach(d => { if (d.total > 0 && (!diaMax || d.total > diaMax.total)) diaMax = d; });

  html += '<div class="tarjeta"><div style="font-weight:800;margin-bottom:10px">Gasto variable por día</div>' + barrasDiaSVG(porDia);
  if (diaMax) html += '<div class="caption">El día que más te fundiste: el ' + diaMax.dia + ' (' + eur(diaMax.total) + ')</div>';
  html += '</div>';

  const meses = [];
  for (let i = 5; i >= 0; i--) {
    const m = mesVecino(mes, -i);
    const t = totalDeMes(m);
    meses.push({ etiqueta: etiquetaMes(m), variable: t.variable, fijos: t.fijos });
  }
  html += '<div class="tarjeta"><div style="font-weight:800;margin-bottom:10px">Últimos 6 meses</div>' + comparativaSVG(meses) +
    '<div class="caption"><span class="punto" style="background:' + COLOR_FIJOS + '"></span>Fijos&nbsp;&nbsp;<span class="punto" style="background:' + VERDE + '"></span>Variable</div></div>';
  return html;
}

function vistaAjustes() {
  let html = "";
  if (importPendiente) {
    const n = importPendiente.gastos.length;
    const v = importPendiente.viajes.length;
    html += '<div class="tarjeta" style="border-color:' + VERDE + '">' +
      '<div style="font-weight:800;margin-bottom:6px">Importar CSV</div>' +
      '<div style="font-size:14px;margin-bottom:6px">He leído <b>' + n + '</b> ' + (n === 1 ? "gasto" : "gastos") +
        (v ? ' y <b>' + v + '</b> ' + (v === 1 ? "viaje" : "viajes") : "") + '.</div>' +
      (importPendiente.saltadas ? '<div class="caption" style="color:#FBBF24;margin:0 0 6px">Se saltan ' + importPendiente.saltadas + ' fila(s) sin fecha o cantidad válida.</div>' : '') +
      '<div class="caption" style="margin:0 0 10px">Se sustituirán tus gastos actuales (' + datos.gastos.length + ') y los viajes. El presupuesto, los gastos fijos y el fondo no se tocan (el CSV no los trae). Los viajes se recrean por su nombre, sin fechas ni estado.</div>' +
      '<button onclick="confirmarImportacion()" style="width:100%;padding:13px;border-radius:12px;background:' + VERDE + ';color:#33272B;font-weight:800;font-size:14px;border:none;margin-bottom:8px">Importar ' + n + ' ' + (n === 1 ? "gasto" : "gastos") + '</button>' +
      '<button onclick="cancelarImportacion()" style="width:100%;padding:12px;border-radius:12px;background:#57443F;color:#FFFFFF;font-weight:700;font-size:14px;border:1px solid #6B534E">Cancelar</button></div>';
  }
  html += '<div class="tarjeta"><div style="font-weight:800;margin-bottom:10px">Presupuesto mensual</div>' +
    '<div class="caption" style="margin:0 0 10px">Es también el tope de las botellas de la bodega.</div>' +
    '<div style="display:flex;gap:8px">' +
    '<input id="a-presupuesto" class="campo num" style="margin:0;flex:1;font-weight:700" inputmode="decimal" value="' + datos.config.presupuesto + '">' +
    '<button onclick="guardarPresupuesto()" style="padding:10px 18px;border-radius:12px;background:' + VERDE + ';color:#33272B;font-weight:800;border:none">Guardar</button>' +
    '</div></div>';

  html += '<div class="tarjeta"><div style="font-weight:800;margin-bottom:4px">Gastos fijos</div>' +
    '<div style="font-size:13px;color:' + GRIS + ';margin-bottom:10px">Cada fijo tiene inicio y periodicidad. Mensual=1, anual=12 (ej: gimnasio mensual, spotify mensual, resi desde sep).</div>';
  datos.fijos.forEach(f => {
    const fDesde = f.desde || INICIO_FIJOS;
    const fCada = f.cada || 1;
    html += '<div style="background:#3A2A27;border:1px solid #5C4642;border-radius:14px;padding:10px;margin-bottom:8px">' +
      '<div style="display:flex;gap:8px;align-items:center">' +
      '<input class="campo" style="margin:0;flex:1;font-size:14px;padding:9px 10px" value="' + esc(f.nombre) + '" onchange="actualizarFijo(\'' + f.id + '\',\'nombre\',this.value)">' +
      '<input class="campo num" style="margin:0;width:84px;font-size:14px;padding:9px 10px;text-align:right" inputmode="decimal" value="' + f.cantidad + '" onchange="actualizarFijo(\'' + f.id + '\',\'cantidad\',this.value)">' +
      '<button onclick="borrarFijo(\'' + f.id + '\')" style="padding:9px 11px;border-radius:10px;background:#5C4642;border:none">🗑</button></div>' +
      '<div style="display:flex;gap:8px;align-items:center;margin-top:8px">' +
      '<label style="font-size:11px;color:' + GRIS + ';font-weight:700;min-width:42px">Desde</label>' +
      '<input class="campo" style="margin:0;flex:1;font-size:13px;padding:7px 8px" type="month" value="' + fDesde + '" onchange="actualizarFijo(\'' + f.id + '\',\'desde\',this.value)">' +
      '<label style="font-size:11px;color:' + GRIS + ';font-weight:700">Cada</label>' +
      '<select class="campo" style="margin:0;width:110px;font-size:13px;padding:7px 6px" onchange="actualizarFijo(\'' + f.id + '\',\'cada\',this.value)">' +
      '<option value="1"' + (fCada === 1 ? ' selected' : '') + '>Mensual</option>' +
      '<option value="3"' + (fCada === 3 ? ' selected' : '') + '>Trimestral</option>' +
      '<option value="6"' + (fCada === 6 ? ' selected' : '') + '>Semestral</option>' +
      '<option value="12"' + (fCada === 12 ? ' selected' : '') + '>Anual</option>' +
      '</select></div></div>';
  });
  html += '<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid #5C4642">' +
    '<div style="display:flex;gap:8px;align-items:center">' +
    '<input id="a-fijo-nombre" class="campo" style="margin:0;flex:1;font-size:14px;padding:9px 10px" placeholder="Nuevo fijo (ej.: gimnasio)">' +
    '<input id="a-fijo-cantidad" class="campo num" style="margin:0;width:82px;font-size:14px;padding:9px 10px;text-align:right" inputmode="decimal" placeholder="€"></div>' +
    '<div style="display:flex;gap:8px;align-items:center">' +
    '<input id="a-fijo-desde" class="campo" style="margin:0;flex:1;font-size:13px;padding:7px 8px" type="month" value="' + mes + '">' +
    '<select id="a-fijo-cada" class="campo" style="margin:0;width:120px;font-size:13px;padding:7px 6px"><option value="1">Mensual</option><option value="3">Trimestral</option><option value="6">Semestral</option><option value="12">Anual</option></select>' +
    '<button onclick="anadirFijo()" style="padding:9px 14px;border-radius:10px;background:' + VERDE + ';color:#33272B;border:none;font-size:16px;font-weight:800">+</button></div></div></div>';

  html += '<div class="tarjeta"><div style="font-weight:800;margin-bottom:4px">Fondo de pantalla</div>' +
    '<div style="font-size:13px;color:' + GRIS + ';margin-bottom:10px">Elige una foto de tu galería. Se oscurece sola para que se siga leyendo bien.</div>' +
    '<input id="input-fondo" type="file" accept="image/*" style="display:none" onchange="procesarFondo(this)">' +
    '<div style="display:flex;gap:8px">' +
    '<button onclick="elegirFondo()" style="flex:1;padding:12px;border-radius:12px;background:' + VERDE + ';color:#33272B;font-weight:800;font-size:14px;border:none">🖼 Elegir foto</button>' +
    (datos.config.fondo ? '<button onclick="quitarFondo()" style="padding:12px 16px;border-radius:12px;background:#5C4642;color:#FFFFFF;font-weight:700;font-size:14px;border:none">Quitar</button>' : '') +
    '</div></div>';

  html += '<div class="tarjeta"><div style="font-weight:800;margin-bottom:10px">Datos</div>' +
    '<input id="input-csv" type="file" accept=".csv,text/csv,text/plain,application/vnd.ms-excel" style="display:none" onchange="procesarCSV(this)">' +
    '<button onclick="elegirCSV()" style="width:100%;padding:13px;border-radius:12px;background:#57443F;color:#FFFFFF;font-weight:700;font-size:14px;border:1px solid #6B534E;margin-bottom:6px">⬆️ Importar CSV</button>' +
    '<div class="caption" style="margin:0 0 12px">Recupera los gastos de un CSV exportado (de esta versión o de la antigua). Primero te enseña cuántos son y luego los guarda.</div>' +
    '<button onclick="exportarCSV()" style="width:100%;padding:13px;border-radius:12px;background:#57443F;color:#FFFFFF;font-weight:700;font-size:14px;border:1px solid #6B534E;margin-bottom:10px">⬇️ Exportar todo a CSV</button>' +
    '<button onclick="borrarTodo()" style="width:100%;padding:13px;border-radius:12px;font-weight:700;font-size:14px;border:none;background:' +
    (confirmaTotal ? "#EF4444;color:#fff" : "#2A1518;color:#F87171") + '">' +
    (confirmaTotal ? "Pulsa otra vez para confirmar" : "Borrar todos los datos") + '</button></div>';

  html += '<div style="text-align:center;font-size:12px;color:rgba(255,255,255,.55);padding:4px 0 8px">Cuentas Erasmus v7 · ' +
    datos.gastos.length + ' gastos · todo guardado en este móvil 📱</div>';
  return html;
}