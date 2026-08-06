// Gráficas en SVG, dibujadas a mano, sin librerías.

function puroSVG(fFijos, fVar) {
  // El puro se completa con el gasto: entero = presupuesto fundido.
  // La parte que falta (ya "fumada") es lo que aún te queda por gastar.
  const X0 = 12, L = 316, Y = 9, H = 22, R = 11;
  const pct = Math.min(fFijos + fVar, 1);
  const wT = pct * L, wF = Math.min(fFijos, 1) * L;
  const izq = X0 + L - wT; // borde donde arde el puro
  const FORMA = "M" + X0 + "," + Y + " h" + (L - R) + " a" + R + "," + R + " 0 0 1 0," + H + " H" + X0 + " z";
  let dentro = "";
  if (wT > 0.5) {
    if (wT - wF > 0.5) dentro += '<rect x="' + izq.toFixed(1) + '" y="' + Y + '" width="' + (wT - wF).toFixed(1) + '" height="' + H + '" fill="#9C6B2F"/>';
    if (wF > 0.5) dentro += '<rect x="' + (X0 + L - wF).toFixed(1) + '" y="' + Y + '" width="' + wF.toFixed(1) + '" height="' + H + '" fill="#5E3A1B"/>';
    dentro += '<path d="M40,28 Q120,12 200,26 T330,20" fill="none" stroke="#00000030" stroke-width="1.4"/>' +
      '<rect x="' + X0 + '" y="' + (Y + 2) + '" width="' + L + '" height="4" rx="2" fill="#FFFFFF1E"/>';
    // vitola dorada con filos rojos, como el puro de verdad
    const bx = X0 + 0.68 * L;
    dentro += '<rect x="' + bx.toFixed(1) + '" y="' + Y + '" width="4" height="' + H + '" fill="#DC2626"/>' +
      '<rect x="' + (bx + 4).toFixed(1) + '" y="' + Y + '" width="12" height="' + H + '" fill="' + ORO + '"/>' +
      '<rect x="' + (bx + 16).toFixed(1) + '" y="' + Y + '" width="4" height="' + H + '" fill="#DC2626"/>';
    if (pct >= 1) {
      dentro += '<rect x="' + X0 + '" y="' + Y + '" width="7" height="' + H + '" fill="#3B2410"/>' +
        '<rect x="' + (X0 + 7) + '" y="' + Y + '" width="3" height="' + H + '" fill="#DC2626"/>';
    }
  }
  let brasa = "";
  if (pct > 0 && pct < 1) {
    brasa = '<circle cx="' + izq.toFixed(1) + '" cy="20" r="11" fill="#F9731633"/>' +
      '<ellipse cx="' + izq.toFixed(1) + '" cy="20" rx="5" ry="10" fill="#F97316"/>' +
      '<ellipse cx="' + izq.toFixed(1) + '" cy="20" rx="2.4" ry="6" fill="#FDE68A"/>' +
      '<circle cx="' + (izq - 9).toFixed(1) + '" cy="26" r="1.6" fill="#6B7280"/>' +
      '<circle cx="' + (izq - 15).toFixed(1) + '" cy="23" r="1.2" fill="#6B7280"/>' +
      '<path d="M' + (izq - 2).toFixed(1) + ',7 q-6,-4 -2,-7" fill="none" stroke="#94A3B8" stroke-width="1.4" opacity=".55"/>';
  }
  return '<svg viewBox="0 0 340 40" style="width:100%;display:block;overflow:visible">' +
    '<defs><clipPath id="clip-puro"><path d="' + FORMA + '"/></clipPath></defs>' +
    '<path d="' + FORMA + '" fill="none" stroke="#8F7B74" stroke-width="1.5" stroke-dasharray="5 5"/>' +
    '<g clip-path="url(#clip-puro)">' + dentro + '</g>' +
    brasa + '</svg>';
}

// Dibujo original de una caja registradora para el centro del donut
function cajaRegistradoraSVG(totalTexto) {
  let teclas = "";
  for (let fila = 0; fila < 2; fila++) {
    for (let i = 0; i < 5; i++) {
      teclas += '<circle cx="' + (94 + i * 8.5) + '" cy="' + (112 + fila * 8) + '" r="2.6" fill="#4A5164"/>';
    }
  }
  return '<rect x="74" y="127" width="72" height="16" rx="4" fill="#6B534E" stroke="rgba(255,255,255,.78)" stroke-width="1.4"/>' +
    '<rect x="80" y="131" width="14" height="8" rx="1.5" fill="#AEC6CF"/>' +
    '<rect x="97" y="131" width="14" height="8" rx="1.5" fill="#AEC6CF"/>' +
    '<rect x="114" y="131" width="12" height="8" rx="1.5" fill="' + ORO + '"/>' +
    '<circle cx="134" cy="135" r="3.4" fill="' + ORO + '"/>' +
    '<rect x="82" y="86" width="56" height="41" rx="8" fill="#4A3835" stroke="rgba(255,255,255,.78)" stroke-width="1.4"/>' +
    '<rect x="88" y="92" width="44" height="13" rx="3" fill="#0B0D12"/>' +
    '<text x="110" y="102" text-anchor="middle" font-size="9.5" font-weight="800" fill="#F3E5AB">' + esc(totalTexto) + '</text>' +
    teclas +
    '<rect x="96" y="80" width="28" height="6" rx="2" fill="#8F7B74"/>';
}

function donutSVG(partes, total) {
  const R = 78, C = 2 * Math.PI * R, gap = partes.length > 1 ? 3 : 0;
  let off = 0, circulos = "";
  partes.forEach(p => {
    const len = Math.max((p.valor / total) * C - gap, 0.5);
    circulos += '<circle r="' + R + '" cx="110" cy="110" fill="none" stroke="' + p.color +
      '" stroke-width="26" stroke-linecap="butt" stroke-dasharray="' + len + ' ' + (C - len) +
      '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 110 110)"/>';
    off += (p.valor / total) * C;
  });
  return '<svg viewBox="0 0 220 220" style="width:220px;max-width:100%;display:block;margin:0 auto">' +
    circulos + cajaRegistradoraSVG(Math.round(total) + " €") + '</svg>';
}

function botellaSVG(nivel, idx, resaltada) {
  const FORMA = "M24,8 h12 v10 c0,14 8,18 8,34 v82 a6,6 0 0 1 -6,6 H22 a6,6 0 0 1 -6,-6 V52 c0,-16 8,-20 8,-34 z";
  const lleno = Math.min(Math.max(nivel, 0), 1);
  const h = lleno * 122;
  const y = 140 - h;
  const colorVino = nivel > 1 ? VINO_TOPE : VINO;
  let vino = "";
  if (lleno > 0) {
    vino = '<rect x="10" y="' + y.toFixed(1) + '" width="40" height="' + h.toFixed(1) + '" fill="' + colorVino + '" clip-path="url(#bot' + idx + ')"/>' +
      '<rect x="10" y="' + y.toFixed(1) + '" width="40" height="3" fill="#FFFFFF22" clip-path="url(#bot' + idx + ')"/>';
  }
  return '<svg viewBox="0 0 60 150" style="width:44px;display:block;margin:0 auto">' +
    '<defs><clipPath id="bot' + idx + '"><path d="' + FORMA + '"/></clipPath></defs>' +
    vino +
    '<path d="' + FORMA + '" fill="none" stroke="' + (resaltada ? ORO : "#BFAFA8") + '" stroke-width="2.6"/>' +
    '<rect x="26" y="2" width="8" height="6" rx="1.5" fill="#B08968"/>' +
    '</svg>';
}

function bodegaHTML() {
  const pres = datos.config.presupuesto || 1;
  let html = '<div class="bodega">';
  for (let i = 5; i >= 0; i--) {
    const m = mesVecino(mes, -i);
    const t = totalDeMes(m);
    const nivel = t.total / pres;
    const pct = Math.round(nivel * 100);
    const colorPct = nivel > 1 ? VINO_TOPE : nivel > 0.85 ? ORO : VERDE;
    html += '<div class="botella-item">' +
      botellaSVG(nivel, m.replace("-", ""), m === mes) +
      '<div class="mes-tx" style="' + (m === mes ? "color:" + ORO : "") + '">' + etiquetaMes(m) + '</div>' +
      '<div class="pct-tx num" style="color:' + (t.total > 0 ? colorPct : "#8F7B74") + '">' + (t.total > 0 ? pct + "%" : "–") + '</div>' +
      '</div>';
  }
  return html + '</div>';
}

function barrasDiaSVG(porDia) {
  const W = 340, H = 150, mI = 6, mB = 22;
  const max = Math.max.apply(null, porDia.map(d => d.total).concat([1]));
  const n = porDia.length, paso = (W - mI * 2) / n, ancho = Math.max(paso - 2, 2);
  let barras = "", etiquetas = "";
  porDia.forEach((d, i) => {
    const h = (d.total / max) * (H - mB - 10);
    const x = mI + i * paso, y = H - mB - h;
    if (d.total > 0) barras += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + ancho.toFixed(1) + '" height="' + Math.max(h, 1).toFixed(1) + '" rx="2" fill="' + VERDE + '"/>';
    if ((i + 1) % 5 === 0 || i === 0) etiquetas += '<text x="' + (x + ancho / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="9" fill="' + GRIS + '">' + (i + 1) + '</text>';
  });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;display:block">' +
    '<line x1="' + mI + '" y1="' + (H - mB) + '" x2="' + (W - mI) + '" y2="' + (H - mB) + '" stroke="#6B534E"/>' +
    barras + etiquetas + '</svg>';
}

function comparativaSVG(meses) {
  const W = 340, H = 180, mB = 22, mT = 18;
  const max = Math.max.apply(null, meses.map(m => m.fijos + m.variable).concat([1]));
  const paso = W / meses.length, ancho = 34;
  let out = "";
  meses.forEach((m, i) => {
    const x = paso * i + (paso - ancho) / 2;
    const hF = (m.fijos / max) * (H - mB - mT);
    const hV = (m.variable / max) * (H - mB - mT);
    const yV = H - mB - hF - hV;
    if (hF > 0) out += '<rect x="' + x.toFixed(1) + '" y="' + (H - mB - hF).toFixed(1) + '" width="' + ancho + '" height="' + hF.toFixed(1) + '" fill="' + COLOR_FIJOS + '"/>';
    if (hV > 0) out += '<rect x="' + x.toFixed(1) + '" y="' + yV.toFixed(1) + '" width="' + ancho + '" height="' + hV.toFixed(1) + '" rx="3" fill="' + VERDE + '"/>';
    out += '<text x="' + (x + ancho / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10" fill="' + GRIS + '">' + esc(m.etiqueta) + '</text>';
    if (m.fijos + m.variable > 0) out += '<text x="' + (x + ancho / 2).toFixed(1) + '" y="' + (yV - 4).toFixed(1) + '" text-anchor="middle" font-size="9" font-weight="800" fill="#FFFFFF">' + Math.round(m.fijos + m.variable) + '€</text>';
  });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;display:block">' + out + '</svg>';
}