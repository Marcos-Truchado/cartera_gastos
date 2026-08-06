// Vistas: cada pantalla construye su HTML.

function selectorMes() {
  return '<div class="selector-mes">' +
    '<button class="btn-mes" onclick="cambiarMes(-1)">‹</button>' +
    '<span class="nombre-mes">' + nombreMes(mes) + '</span>' +
    '<button class="btn-mes" onclick="cambiarMes(1)">›</button>' +
    '</div>';
}

function filaGasto(g, compacta) {
  const c = categoria(g.categoria);
  const esBizumRecibo = g.categoria === "bizum" && g.bizumTipo === "recibo";
  const pendiente = esBizumRecibo && g.pendiente;
  const colorMonto = pendiente ? "#FB923C" : "#FFFFFF";
  const signo = esBizumRecibo ? "+" : "−";
  const subtitulo = pendiente ? "Pendiente de cobro · toca para confirmar" : (c.nombre + ' · ' + fechaCorta(g.fecha));
  // si está pendiente, toda la fila es tocable para marcarlo como cobrado
  let html = '<div class="fila-gasto"' + (pendiente ? ' style="cursor:pointer" onclick="confirmarBizum(' + g.id + ')"' : '') + '>' +
    '<div class="icono-cat" style="background:' + c.color + '2E">' + (pendiente ? "🟠" : c.emoji) + '</div>' +
    '<div style="flex:1;min-width:0">' +
      '<div style="font-weight:700;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(g.nota || c.nombre) + '</div>' +
      '<div style="font-size:12px;color:' + (pendiente ? "#FB923C" : GRIS) + '">' + subtitulo + '</div>' +
    '</div>' +
    '<div class="num" style="font-weight:800;font-size:14px;color:' + colorMonto + '">' + signo + eur(g.cantidad) + '</div>';
  if (!compacta) {
    const conf = borrandoId === g.id;
    html += '<button class="btn-borrar' + (conf ? ' confirmar' : '') + '" onclick="event.stopPropagation();borrarGasto(' + g.id + ')">' + (conf ? "¿Seguro?" : "🗑") + '</button>';
  }
  return html + '</div>';
}

function vistaInicio() {
  const gs = gastosDelMes(mes);
  const tVar = gs.reduce((s, g) => s + efectivo(g), 0);
  const tFij = totalFijos();
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
  return '<div class="tarjeta">' +
    '<div style="font-weight:800;margin-bottom:12px">¿Cuanto fué la broma?</div>' +
    '<label class="etiqueta">Cantidad (€)</label>' +
    '<input id="f-cantidad" class="campo-cantidad num" inputmode="decimal" placeholder="0,00">' +
    '<label class="etiqueta">Categoría</label>' +
    '<div class="rejilla3" style="margin:8px 0 14px">' + chips + '</div>' +
    bizumPanel +
    '<label class="etiqueta">Fecha</label>' +
    '<input id="f-fecha" class="campo" type="date" value="' + hoy() + '">' +
    '<label class="etiqueta">Nota (opcional)</label>' +
    '<input id="f-nota" class="campo" placeholder="Ej.: kebab post-fiesta">' +
    '<button class="btn-principal" onclick="anadirGasto()">Apuntarlo 💸</button>' +
    '</div>' +
    '<div class="tarjeta" style="background:rgba(174,198,207,.14);border-color:rgba(174,198,207,.4)"><div style="font-size:13px;color:#FFFFFF">🏠 Los gastos fijos (' +
    eur(totalFijos()) + ') se descuentan solos cada mes. Se cambian en Ajustes.</div></div>';
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

  html += '<div class="tarjeta"><div style="display:flex;justify-content:space-between">' +
    '<span style="font-weight:800">Gastos fijos del mes</span>' +
    '<span class="num" style="font-weight:800;color:' + COLOR_FIJOS + '">−' + eur(totalFijos()) + '</span></div>';
  datos.fijos.forEach(f => {
    html += '<div style="display:flex;justify-content:space-between;font-size:13px;color:' + GRIS + ';margin-top:6px">' +
      '<span>🏠 ' + esc(f.nombre) + '</span><span class="num">' + eur(f.cantidad) + '</span></div>';
  });
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
  const tFij = totalFijos();
  const tVar = gs.reduce((s, g) => s + efectivo(g), 0);
  const total = tVar + tFij;

  const mapa = {};
  // los bizums que me deben no son "gasto en una categoría", así que no entran en el reparto
  gs.forEach(g => { if (g.categoria === "bizum" && g.bizumTipo === "recibo") return; mapa[g.categoria] = (mapa[g.categoria] || 0) + g.cantidad; });
  const partes = [];
  if (tFij > 0) partes.push({ nombre: "Fijos (resi)", emoji: "🏠", valor: tFij, color: COLOR_FIJOS });
  CATS.forEach(c => { if (mapa[c.id] > 0) partes.push({ nombre: c.nombre, emoji: c.emoji, valor: mapa[c.id], color: c.color }); });

  let html = selectorMes();

  html += '<div class="tarjeta"><div style="font-weight:800;margin-bottom:10px">La caja del mes</div>';
  if (partes.length === 0) {
    html += '<div style="color:' + GRIS + ';font-size:14px;padding:14px 0">Aún no hay datos este mes.</div>';
  } else {
    html += donutSVG(partes, total) + '<div style="margin-top:12px">';
    partes.forEach(p => {
      html += '<div class="leyenda-fila"><span><span class="punto" style="background:' + p.color + '"></span>' +
        p.emoji + ' ' + p.nombre + '</span><span class="num" style="font-weight:700">' + eur(p.valor) + ' · ' +
        Math.round(p.valor / total * 100) + '%</span></div>';
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
  let html = '<div class="tarjeta"><div style="font-weight:800;margin-bottom:10px">Presupuesto mensual</div>' +
    '<div class="caption" style="margin:0 0 10px">Es también el tope de las botellas de la bodega.</div>' +
    '<div style="display:flex;gap:8px">' +
    '<input id="a-presupuesto" class="campo num" style="margin:0;flex:1;font-weight:700" inputmode="decimal" value="' + datos.config.presupuesto + '">' +
    '<button onclick="guardarPresupuesto()" style="padding:10px 18px;border-radius:12px;background:' + VERDE + ';color:#33272B;font-weight:800;border:none">Guardar</button>' +
    '</div></div>';

  html += '<div class="tarjeta"><div style="font-weight:800;margin-bottom:4px">Gastos fijos</div>' +
    '<div style="font-size:13px;color:' + GRIS + ';margin-bottom:10px">Se descuentan automáticamente cada mes.</div>';
  datos.fijos.forEach(f => {
    html += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">' +
      '<input class="campo" style="margin:0;flex:1;font-size:14px;padding:9px 10px" value="' + esc(f.nombre) + '" onchange="actualizarFijo(\'' + f.id + '\',\'nombre\',this.value)">' +
      '<input class="campo num" style="margin:0;width:84px;font-size:14px;padding:9px 10px;text-align:right" inputmode="decimal" value="' + f.cantidad + '" onchange="actualizarFijo(\'' + f.id + '\',\'cantidad\',this.value)">' +
      '<button onclick="borrarFijo(\'' + f.id + '\')" style="padding:9px 11px;border-radius:10px;background:#5C4642;border:none">🗑</button></div>';
  });
  html += '<div style="display:flex;gap:8px;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid #5C4642">' +
    '<input id="a-fijo-nombre" class="campo" style="margin:0;flex:1;font-size:14px;padding:9px 10px" placeholder="Nuevo fijo (ej.: gimnasio)">' +
    '<input id="a-fijo-cantidad" class="campo num" style="margin:0;width:70px;font-size:14px;padding:9px 10px;text-align:right" inputmode="decimal" placeholder="€">' +
    '<button onclick="anadirFijo()" style="padding:9px 14px;border-radius:10px;background:' + VERDE + ';color:#33272B;border:none;font-size:16px;font-weight:800">+</button></div></div>';

  html += '<div class="tarjeta"><div style="font-weight:800;margin-bottom:4px">Fondo de pantalla</div>' +
    '<div style="font-size:13px;color:' + GRIS + ';margin-bottom:10px">Elige una foto de tu galería. Se oscurece sola para que se siga leyendo bien.</div>' +
    '<input id="input-fondo" type="file" accept="image/*" style="display:none" onchange="procesarFondo(this)">' +
    '<div style="display:flex;gap:8px">' +
    '<button onclick="elegirFondo()" style="flex:1;padding:12px;border-radius:12px;background:' + VERDE + ';color:#33272B;font-weight:800;font-size:14px;border:none">🖼 Elegir foto</button>' +
    (datos.config.fondo ? '<button onclick="quitarFondo()" style="padding:12px 16px;border-radius:12px;background:#5C4642;color:#FFFFFF;font-weight:700;font-size:14px;border:none">Quitar</button>' : '') +
    '</div></div>';

  html += '<div class="tarjeta"><div style="font-weight:800;margin-bottom:10px">Datos</div>' +
    '<button onclick="exportarCSV()" style="width:100%;padding:13px;border-radius:12px;background:#57443F;color:#FFFFFF;font-weight:700;font-size:14px;border:1px solid #6B534E;margin-bottom:10px">⬇️ Exportar todo a CSV</button>' +
    '<button onclick="borrarTodo()" style="width:100%;padding:13px;border-radius:12px;font-weight:700;font-size:14px;border:none;background:' +
    (confirmaTotal ? "#EF4444;color:#fff" : "#2A1518;color:#F87171") + '">' +
    (confirmaTotal ? "Pulsa otra vez para confirmar" : "Borrar todos los datos") + '</button></div>';

  html += '<div style="text-align:center;font-size:12px;color:rgba(255,255,255,.55);padding:4px 0 8px">Cuentas Erasmus v5 · ' +
    datos.gastos.length + ' gastos · todo guardado en este móvil 📱</div>';
  return html;
}