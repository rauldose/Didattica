/*
 * La spinta di Archimede – versione per bambini (touch) della simulazione
 * Delphi del Prof. Carmelo Muscolino. La fisica e i valori (pesi specifici,
 * blocco da 100 cm³, vaso da 80 cm², livello iniziale 7 cm, cavità fino a
 * 79 cm³) sono quelli del remake fedele in programmi/archimede/archimede.js.
 *
 * Unità: cm, cm³, grammi-forza (g). Coordinate della scena: x a destra,
 * y in alto, y = 0 è il fondo interno del vaso.
 */
(function () {
  "use strict";
  var $ = N.$, fmt = LAB.fmt;

  N.testata({ titolo: "La spinta di Archimede", indietro: "index.html", tema: "t-lab" });

  /* ---------------- data (his values) ---------------- */
  // id, emoji, name, specific weight, colour
  var SOLIDI = [
    ["sughero", "🍾", "Sughero", 0.3, "#c8a165"],
    ["legno", "🪵", "Legno", 0.7, "#a5642f"],
    ["cera", "🕯️", "Cera", 0.8, "#f6eec4"],
    ["ghiaccio", "🧊", "Ghiaccio", 0.9, "rgba(205,238,255,0.85)"],
    ["vetro", "🔮", "Vetro", 2.6, "rgba(150,235,240,0.6)"],
    ["alluminio", "🥫", "Alluminio", 2.7, "#c9ced3"],
    ["marmo", "🏛️", "Marmo", 2.7, "#f6f6f2"],
    ["ferro", "🔩", "Ferro", 7.8, "#5d6268"],
    ["oro", "🥇", "Oro", 19.5, "#e5b80b"],
    ["platino", "💍", "Platino", 21.4, "#d9dde0"]
  ];
  // id, emoji, name, specific weight, colour, opacity
  var LIQUIDI = [
    ["acqua", "💧", "Acqua", 1.0, "#3aa6ff", 0.5],
    ["marina", "🌊", "Acqua marina", 1.3, "#1677c4", 0.55],     // sic: his value
    ["olio", "🛢️", "Olio d'oliva", 0.91, "#d2b31c", 0.6],
    ["glicerina", "🧪", "Glicerina", 1.26, "#d9e3a6", 0.65],
    ["benzina", "⛽", "Benzina", 0.78, "#f3df6a", 0.55],
    ["alcol", "🍶", "Alcol", 0.80, "#bfe3f3", 0.55],
    ["mercurio", "🥈", "Mercurio", 13.6, "#a7b0b8", 0.92]
  ];
  function idx(lista, id) { for (var i = 0; i < lista.length; i++) if (lista[i][0] === id) return i; return -1; }

  /* ---------------- geometry (block & vessel as in his program) ---------------- */
  var BW = 5, BH = 4, BD = 5, VOL = BW * BH * BD, AB = BW * BD;
  var VW = 12, VH = 12, AV = 80, L0 = 7;
  // a more compact hanger than the original, so the vessel can be big on a phone
  var HB_MAX = 9.5, STRING = 2.4, HOOK = 0.5, SPRING_EXT = 1.6, BODY_H = 4, BODY_W = 4;
  var SCENE_W = 15.6, Y_MIN = -1, Y_MAX = 23.2;

  var st = { sol: 1, liq: 0, cav: 0, hb: 9, v: 0, rilasciato: false, drag: null, fermo: false };

  function psS() { return SOLIDI[st.sol][3]; }
  function psL() { return LIQUIDI[st.liq][3]; }
  function calcola(hb) {
    var s = (L0 - hb) / (1 - AB / AV);
    s = Math.max(0, Math.min(BH, s));
    var vimm = AB * s, peso = psS() * (VOL - st.cav), spinta = psL() * vimm;
    return { s: s, livello: L0 + vimm / AV, vimm: vimm, peso: peso, spinta: spinta, bilancia: peso - spinta };
  }
  function equilibrio() {
    var peso = psS() * (VOL - st.cav), psl = psL();
    if (peso < psl * VOL) return { hb: L0 - peso / (psl * AB) * (1 - AB / AV), galleggia: true };
    return { hb: 0.15, galleggia: false };
  }

  /* ---------------- canvas ---------------- */
  var cv = $("#cv"), ctx = cv.getContext("2d");
  var S = 1, OX = 0, OY = 0, dpr = 1, W = 0, H = 0;
  function ridimensiona() {
    var w = cv.parentNode.clientWidth;
    var largo = window.matchMedia("(min-width: 720px), (orientation: landscape) and (min-width: 560px)").matches;
    var hMax = largo ? window.innerHeight - 96 : Math.max(320, window.innerHeight * 0.62);
    var h = Math.round(Math.max(260, Math.min(w * (Y_MAX - Y_MIN) / SCENE_W, hMax)));
    cv.style.height = h + "px";
    dpr = window.devicePixelRatio || 1; W = w; H = h;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    S = Math.min(w / SCENE_W, h / (Y_MAX - Y_MIN));
    OX = w / 2; OY = h + Y_MIN * S;
    disegna();
  }
  function X(x) { return OX + x * S; }
  function Y(y) { return OY - y * S; }
  function rect(x0, y0, x1, y1) { ctx.rect(X(x0), Y(y1), (x1 - x0) * S, (y1 - y0) * S); }

  function alone(t, x, y) {
    ctx.save(); ctx.lineJoin = "round"; ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = 4;
    ctx.strokeText(t, x, y); ctx.fillText(t, x, y); ctx.restore();
  }
  function freccia(x, y0, y1, colore, nome) {
    var len = Math.abs(y1 - y0) * S;
    if (len < 3) return;
    var dir = y1 > y0 ? -1 : 1, px = X(x), a = Y(y0), b = Y(y1);
    var head = Math.min(18, Math.max(8, len * 0.35)), hw = Math.max(8, S * 0.55);
    ctx.save(); ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(px - hw * 0.4, a); ctx.lineTo(px - hw * 0.4, b - dir * head);
    ctx.lineTo(px - hw, b - dir * head); ctx.lineTo(px, b);
    ctx.lineTo(px + hw, b - dir * head); ctx.lineTo(px + hw * 0.4, b - dir * head);
    ctx.lineTo(px + hw * 0.4, a); ctx.closePath();
    ctx.fillStyle = colore; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#2d2240"; ctx.stroke();
    ctx.font = "800 " + Math.round(Math.max(13, S * 0.7)) + "px system-ui, sans-serif";
    ctx.fillStyle = "#2d2240"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    alone(nome, px + hw + 4, b + dir * 8);
    ctx.restore();
  }

  function disegnaBlocco(hb) {
    var x0 = -BW / 2, x1 = BW / 2, y0 = hb, y1 = hb + BH, id = SOLIDI[st.sol][0], col = SOLIDI[st.sol][4];
    ctx.save();
    ctx.beginPath(); rect(x0, y0, x1, y1);
    if (id === "oro") {
      var g = ctx.createLinearGradient(X(x0), Y(y1), X(x1), Y(y0));
      g.addColorStop(0, "#fff2a8"); g.addColorStop(0.45, "#e5b80b"); g.addColorStop(1, "#9c7400"); ctx.fillStyle = g;
    } else if (id === "alluminio" || id === "platino" || id === "ferro") {
      var m = ctx.createLinearGradient(X(x0), Y(y1), X(x1), Y(y0));
      m.addColorStop(0, "#fff"); m.addColorStop(0.35, col); m.addColorStop(1, id === "ferro" ? "#2b2e31" : "#8d9399"); ctx.fillStyle = m;
    } else ctx.fillStyle = col;
    ctx.fill(); ctx.clip();
    ctx.lineWidth = 1.2;
    if (id === "marmo") {
      ctx.strokeStyle = "rgba(110,110,120,0.55)"; ctx.beginPath();
      ctx.moveTo(X(x0), Y(y0 + 3)); ctx.bezierCurveTo(X(-1), Y(y0 + 2), X(0), Y(y0 + 3.4), X(x1), Y(y0 + 1.2));
      ctx.moveTo(X(-1.5), Y(y0)); ctx.bezierCurveTo(X(-0.8), Y(y0 + 1.5), X(0.5), Y(y0 + 1), X(1.2), Y(y1));
      ctx.stroke();
    } else if (id === "legno" || id === "sughero") {
      ctx.strokeStyle = id === "legno" ? "rgba(60,30,10,0.45)" : "rgba(90,60,20,0.35)";
      for (var k = 0.5; k < BH; k += id === "legno" ? 0.55 : 0.9) {
        ctx.beginPath(); ctx.moveTo(X(x0), Y(y0 + k)); ctx.quadraticCurveTo(X(0), Y(y0 + k + 0.25), X(x1), Y(y0 + k - 0.1)); ctx.stroke();
      }
      if (id === "sughero") {
        ctx.fillStyle = "rgba(90,55,20,0.45)";
        for (var i = 0; i < 18; i++) ctx.fillRect(X(x0 + ((i * 37) % 50) / 10), Y(y0 + ((i * 23) % 40) / 10), 3, 3);
      }
    } else if (id === "vetro" || id === "ghiaccio") {
      ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(X(x0 + 0.4), Y(y1 - 0.4)); ctx.lineTo(X(x0 + 1.6), Y(y1 - 0.4)); ctx.stroke();
    }
    if (st.cav > 0) {     // the empty cavity, same proportions as the block
      var f = Math.sqrt(st.cav / VOL), cw = BW * f / 2, ch = BH * f / 2, cy = hb + BH / 2;
      ctx.beginPath(); rect(-cw, cy - ch, cw, cy + ch);
      ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fill();
      ctx.setLineDash([5, 4]); ctx.strokeStyle = "#444"; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
    ctx.beginPath(); rect(x0, y0, x1, y1); ctx.lineWidth = 2; ctx.strokeStyle = "#2d2240"; ctx.stroke();
    // big emoji label on the block, so children recognise it
    ctx.font = Math.round(S * 1.7) + "px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.globalAlpha = 0.95; ctx.fillText(SOLIDI[st.sol][1], X(-BW / 2 + 1.1), Y(hb + BH / 2)); ctx.globalAlpha = 1;
  }

  function disegnaBilancia(hb, lettura, maxPeso) {
    var top = hb + BH, allentato = lettura <= 0;
    var ext = allentato ? 0 : SPRING_EXT * Math.min(1, lettura / maxPeso);
    var hookTop = top + STRING, bodyY0 = hookTop + HOOK + ext, bodyY1 = bodyY0 + BODY_H;
    var bx0 = -BODY_W / 2, bx1 = BODY_W / 2;
    ctx.strokeStyle = "#2d2240"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(0), Y(bodyY1 + 0.5)); ctx.lineTo(X(0), 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(X(0), Y(bodyY1 + 0.3), Math.max(4, 0.3 * S), 0, Math.PI * 2); ctx.lineWidth = 3; ctx.stroke();
    // string (slack when floating)
    ctx.lineWidth = 2; ctx.strokeStyle = "#222";
    ctx.beginPath(); ctx.moveTo(X(0), Y(top));
    if (allentato) ctx.bezierCurveTo(X(0.9), Y(top + STRING * 0.3), X(-0.9), Y(top + STRING * 0.7), X(0), Y(hookTop));
    else ctx.lineTo(X(0), Y(hookTop));
    ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = "#555";
    ctx.beginPath(); ctx.arc(X(0), Y(hookTop + 0.2), Math.max(3, 0.22 * S), Math.PI * 0.5, Math.PI * 2.1); ctx.stroke();
    // body
    ctx.beginPath(); rect(bx0, bodyY0, bx1, bodyY1);
    var g = ctx.createLinearGradient(X(bx0), 0, X(bx1), 0);
    g.addColorStop(0, "#ff9a5c"); g.addColorStop(0.5, "#ffc7a1"); g.addColorStop(1, "#ff7a2f");
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#2d2240"; ctx.stroke();
    // spring window (lower part)
    var sy0 = bodyY0 + 0.25, sy1 = bodyY0 + 2.1;
    ctx.beginPath(); rect(-0.6, sy0, 0.6, sy1); ctx.fillStyle = "#fffdf2"; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = "#555"; ctx.stroke();
    var idxY = sy1 - 0.15 - ext;
    ctx.lineWidth = 2.5; ctx.strokeStyle = "#555";
    ctx.beginPath(); ctx.moveTo(X(0), Y(hookTop + 0.4)); ctx.lineTo(X(0), Y(idxY)); ctx.stroke();
    ctx.strokeStyle = "#555"; ctx.lineWidth = 1.5; ctx.beginPath();
    var n = 7, zTop = sy1 - 0.05;
    ctx.moveTo(X(0), Y(zTop));
    for (var z = 1; z <= n; z++) ctx.lineTo(X(z % 2 ? 0.42 : -0.42), Y(zTop - (zTop - idxY) * z / (n + 1)));
    ctx.lineTo(X(0), Y(idxY)); ctx.stroke();
    ctx.strokeStyle = "#e5484d"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(X(-0.55), Y(idxY)); ctx.lineTo(X(0.55), Y(idxY)); ctx.stroke();
    // digital display
    var dy0 = bodyY0 + 2.35, dy1 = bodyY1 - 0.3;
    ctx.beginPath(); rect(bx0 + 0.25, dy0, bx1 - 0.25, dy1); ctx.fillStyle = "#16301b"; ctx.fill();
    var testo = fmt(Math.max(0, lettura), 1) + " g";
    var fs = Math.max(11, Math.min(1.05 * S, (BODY_W - 0.7) * S / (testo.length * 0.62)));
    ctx.font = "bold " + fs + "px 'Courier New', monospace";
    ctx.fillStyle = "#7dff7d"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(testo, X(0), Y((dy0 + dy1) / 2));
  }

  function disegna() {
    if (!W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var c = calcola(st.hb), liq = LIQUIDI[st.liq];
    if (st.rilasciato && equilibrio().galleggia) c.bilancia = Math.min(c.bilancia, 0);
    var x0 = -VW / 2, x1 = VW / 2, T = 0.4;

    // table
    ctx.fillStyle = "#c98a4b"; ctx.fillRect(0, Y(-T), W, H - Y(-T));
    ctx.fillStyle = "#e3a866"; ctx.fillRect(0, Y(-T), W, Math.max(3, 0.25 * S));
    // vessel back + liquid
    ctx.beginPath(); rect(x0, 0, x1, VH); ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.fill();
    ctx.save(); ctx.globalAlpha = liq[5]; ctx.beginPath(); rect(x0, 0, x1, c.livello); ctx.fillStyle = liq[4]; ctx.fill(); ctx.restore();
    // starting level (dashed) – shows the rise
    ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = "rgba(45,34,64,.7)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(X(x0), Y(L0)); ctx.lineTo(X(x0 + 2.4), Y(L0)); ctx.stroke(); ctx.restore();

    disegnaBlocco(st.hb);
    if (c.s > 0) {     // liquid tint over the immersed part
      ctx.save(); ctx.globalAlpha = liq[0] === "mercurio" ? 0.6 : 0.33;
      ctx.beginPath(); rect(-BW / 2, st.hb, BW / 2, st.hb + c.s); ctx.fillStyle = liq[4]; ctx.fill(); ctx.restore();
    }
    // surface
    ctx.strokeStyle = "rgba(0,40,90,0.8)"; ctx.lineWidth = 2.5; ctx.beginPath();
    if (c.s > 0 && c.s < BH) {
      ctx.moveTo(X(x0), Y(c.livello)); ctx.lineTo(X(-BW / 2), Y(c.livello));
      ctx.moveTo(X(BW / 2), Y(c.livello)); ctx.lineTo(X(x1), Y(c.livello));
    } else { ctx.moveTo(X(x0), Y(c.livello)); ctx.lineTo(X(x1), Y(c.livello)); }
    ctx.stroke();
    // glass + scale marks
    ctx.fillStyle = "rgba(190,235,255,0.6)"; ctx.strokeStyle = "#1d3c58"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X(x0 - T), Y(VH)); ctx.lineTo(X(x0 - T), Y(-T)); ctx.lineTo(X(x1 + T), Y(-T)); ctx.lineTo(X(x1 + T), Y(VH));
    ctx.lineTo(X(x1), Y(VH)); ctx.lineTo(X(x1), Y(0)); ctx.lineTo(X(x0), Y(0)); ctx.lineTo(X(x0), Y(VH)); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "rgba(29,60,88,.7)"; ctx.lineWidth = 1.2;
    for (var k = 1; k < VH; k++) { ctx.beginPath(); ctx.moveTo(X(x1), Y(k)); ctx.lineTo(X(x1 - (k % 5 === 0 ? 1 : 0.55)), Y(k)); ctx.stroke(); }
    // current level marker on the right wall
    ctx.fillStyle = "#e5484d"; ctx.beginPath();
    ctx.moveTo(X(x1 + T) + 2, Y(c.livello)); ctx.lineTo(X(x1 + T) + 14, Y(c.livello) - 8); ctx.lineTo(X(x1 + T) + 14, Y(c.livello) + 8); ctx.closePath(); ctx.fill();

    // forces from the block centre
    var maxF = Math.max(c.peso, psL() * VOL, 1), kF = 5.2 / maxF, yc = st.hb + BH / 2;
    freccia(0, yc, yc - c.peso * kF, "#ffd400", "Peso");
    freccia(0, yc, yc + c.spinta * kF, "#2fe0f0", "Spinta");

    disegnaBilancia(st.hb, c.bilancia, Math.max(psS() * VOL, 1));
    aggiornaLetture(c);
  }

  /* ---------------- readouts in plain words ---------------- */
  var ultimo = "";
  function aggiornaLetture(c) {
    var fermoGiu = st.rilasciato && st.fermo && !equilibrio().galleggia;
    var chiave = [c.peso, c.spinta, c.vimm, c.bilancia, st.liq, fermoGiu].join("|");
    if (chiave === ultimo) return;
    ultimo = chiave;
    $("#vPeso").textContent = fmt(c.peso) + " g";
    $("#vSpinta").textContent = fmt(c.spinta) + " g";
    $("#vBil").textContent = fmt(Math.max(0, c.bilancia)) + " g";
    $("#vVol").textContent = fmt(c.vimm, 0) + " cm³";
    var s;
    if (c.vimm <= 0) s = "Il solido è fuori: la bilancia segna tutto il suo peso.";
    else if (c.bilancia <= 0) s = "Galleggia! 🛟 La spinta è grande come il peso.";
    else if (fermoGiu) s = "Va a fondo! ⬇️ È più pesante del liquido.";
    else if (c.vimm >= VOL - 1e-9) s = "Tutto sotto! Il liquido lo spinge su: la bilancia segna meno.";
    else s = "Il liquido spinge verso l'alto: più lo immergi, più spinge!";
    $("#stato").textContent = s;
    var sale = c.livello - L0;
    $("#dettagli").textContent = c.vimm > 0
      ? "💧 Liquido spostato: " + fmt(c.vimm) + " cm³ (pesa " + fmt(c.spinta) + " g) · il livello sale di " + fmt(sale, 2) + " cm"
      : "💧 Il livello del liquido è fermo alla linea tratteggiata.";
  }

  /* ---------------- "Lascia andare" ---------------- */
  var raf = 0, tPrec = 0;
  function anima(t) {
    raf = 0;
    if (!st.rilasciato || st.drag) return;
    var dt = Math.min(0.04, tPrec ? (t - tPrec) / 1000 : 0.016);
    tPrec = t;
    var eq = equilibrio(), k = eq.galleggia ? 28 : 10, smorz = eq.galleggia ? 4.5 : 6;
    st.v += (-k * (st.hb - eq.hb) - smorz * st.v) * dt;
    st.hb += st.v * dt;
    if (st.hb < 0) { st.hb = 0; st.v = 0; }
    if (Math.abs(st.hb - eq.hb) < 0.005 && Math.abs(st.v) < 0.03) { fermati(eq); return; }
    disegna();
    raf = requestAnimationFrame(anima);
  }
  function fermati(eq) {
    st.hb = eq.hb; st.v = 0; st.fermo = true; disegna();
    dopoLascia(eq.galleggia);
  }
  function avvia() {
    st.rilasciato = true; st.fermo = false;
    if (LAB.ridotto()) { fermati(equilibrio()); return; }
    if (!raf) { tPrec = 0; raf = requestAnimationFrame(anima); }
  }
  function prendi() { st.rilasciato = false; st.fermo = false; st.v = 0; }

  /* ---------------- touch / mouse / keyboard ---------------- */
  function scena(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - OX) / S, y: (OY - (e.clientY - r.top)) / S }; }
  function sposta(hb) { st.hb = Math.max(0, Math.min(HB_MAX, hb)); disegna(); }
  // the whole vessel column is a handle: easy for small fingers
  cv.addEventListener("pointerdown", function (e) {
    var p = scena(e);
    if (Math.abs(p.x) > VW / 2 + 1.5) return;
    e.preventDefault();
    prendi();
    var preso = p.y >= st.hb - 0.5 && p.y <= st.hb + BH + 0.5;
    st.drag = { id: e.pointerId, off: preso ? p.y - st.hb : BH / 2 };
    if (!preso) sposta(p.y - BH / 2);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* */ }
    $("#dito").hidden = true;
  });
  cv.addEventListener("pointermove", function (e) {
    if (st.drag && e.pointerId === st.drag.id) sposta(scena(e).y - st.drag.off);
  });
  function fineDrag(e) {
    if (!st.drag || e.pointerId !== st.drag.id) return;
    st.drag = null;
    controllaBilancia();
  }
  cv.addEventListener("pointerup", fineDrag);
  cv.addEventListener("pointercancel", fineDrag);
  cv.addEventListener("keydown", function (e) {
    var d = { ArrowUp: 0.25, ArrowDown: -0.25, PageUp: 2, PageDown: -2 }[e.key];
    if (d == null) return;
    e.preventDefault(); prendi(); sposta(st.hb + d); controllaBilancia();
  });
  function passo(d) { N.suono.tocco(); prendi(); $("#dito").hidden = true; sposta(st.hb + d); controllaBilancia(); }
  $("#su").addEventListener("click", function () { passo(1); });
  $("#giu").addEventListener("click", function () { passo(-1); });
  $("#lascia").addEventListener("click", function () { N.suono.tocco(); $("#dito").hidden = true; avvia(); });

  /* ---------------- chips ---------------- */
  function chips(host, lista, chiave) {
    lista.forEach(function (x, i) {
      host.appendChild(N.el("button", {
        type: "button", class: "chip", "aria-pressed": st[chiave] === i ? "true" : "false",
        "aria-label": x[2] + ", 1 centimetro cubo pesa " + N.numero(x[3]) + " grammi",
        onclick: function () { N.suono.tocco(); scegli(chiave, i); }
      }, [N.el("span", { class: "e", text: x[1] }), N.el("span", { class: "n", text: x[2] }), N.el("span", { class: "d", text: N.numero(x[3]) })]));
    });
  }
  chips($("#solidi"), SOLIDI, "sol");
  chips($("#liquidi"), LIQUIDI, "liq");
  function scegli(chiave, i) {
    st[chiave] = i;
    N.$$("#" + (chiave === "sol" ? "solidi" : "liquidi") + " .chip").forEach(function (b, j) { b.setAttribute("aria-pressed", j === i ? "true" : "false"); });
    ultimo = "";
    if (st.rilasciato) avvia();
    disegna(); controllaBilancia(); mostraMissione();
  }
  function impostaCavita(v) {
    v = Math.max(0, Math.min(79, v));
    st.cav = v; $("#cavita").value = v; $("#cavVal").textContent = v + " cm³";
    ultimo = ""; if (st.rilasciato) avvia(); disegna(); controllaBilancia();
  }
  $("#cavita").addEventListener("input", function () { impostaCavita(+this.value); });
  function ripeti(btn, d) {
    var t1 = 0, t2 = 0;
    function stop() { clearTimeout(t1); clearInterval(t2); }
    btn.addEventListener("pointerdown", function (e) {
      e.preventDefault(); N.suono.tocco(); impostaCavita(st.cav + d);
      t1 = setTimeout(function () { t2 = setInterval(function () { impostaCavita(st.cav + d); }, 70); }, 400);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { btn.addEventListener(ev, stop); });
    btn.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); impostaCavita(st.cav + d); } });
  }
  ripeti($("#cavMeno"), -1); ripeti($("#cavPiu"), 1);

  /* ---------------- Archimedes card (his text) ---------------- */
  $("#testoArch").textContent = "ARCHIMEDE\nNato a Siracusa nel 287 a. C.\ne morto nel 212 a. C.\n\n" +
    "Il più grande matematico ed ingegnere dell'antichità. Greco di Siracusa, fu ucciso durante la presa " +
    "della città da parte dei Romani. La sua fama è legata al \"principio di Archimede\", per cui un corpo " +
    "immerso in un fluido riceve .........(devi scoprirlo tu )";
  function mostraSegreto() {
    var h = $("#segreto"); h.innerHTML = "";
    if (LAB.fatta("lab:archimede:galleggia")) {
      h.appendChild(N.el("div", { class: "svelato", role: "note" }, [
        N.el("div", { text: "🔓 L'hai scoperto! Un corpo immerso in un liquido riceve una spinta dal basso verso l'alto, uguale al peso del liquido che sposta." }),
        N.el("div", { style: "font-weight:700;margin-top:6px", text: "Guarda: la «Spinta» è sempre uguale al peso del liquido spostato. Se la spinta riesce a pareggiare il peso, il corpo galleggia!" })
      ]));
    } else h.appendChild(N.el("div", { class: "chiuso", text: "🔒 Completa la missione 1 per svelare il segreto di Archimede!" }));
  }

  /* ---------------- missions ---------------- */
  var MISSIONI = [
    { id: "galleggia", emoji: "🍾", titolo: "Fai galleggiare il sughero" },
    { id: "mercurio", emoji: "🥈", titolo: "Trova un solido che affonda nell'acqua ma galleggia nel mercurio" },
    { id: "bilancia", emoji: "🔩", titolo: "Fai segnare alla bilancia meno di 100 g con il ferro tutto immerso" },
    { id: "ghiaccio", emoji: "🧊", titolo: "Il ghiaccio galleggia nell'olio?" },
    { id: "volume", emoji: "💧", titolo: "Quanta acqua sposta un solido tutto immerso?" }
  ];
  function aid(i) { return "lab:archimede:" + MISSIONI[i].id; }
  var attiva = 0, chiusa = false, prova = {}, previsione = null, errori = 0, domanda = null;
  for (var i0 = 0; i0 < MISSIONI.length; i0++) if (!LAB.fatta(aid(i0))) { attiva = i0; break; }
  var param = +N.parametro("missione", 0); if (param >= 1 && param <= MISSIONI.length) attiva = param - 1;

  function scegliMissione(i) {
    attiva = i; chiusa = false; previsione = null; errori = 0;
    mostraMissione(); LAB.aggiorna();
    $("#missione").scrollIntoView({ behavior: LAB.ridotto() ? "auto" : "smooth", block: "start" });
  }
  LAB.lista($("#lista"), "archimede", MISSIONI, function () { return attiva; }, scegliMissione);

  function mostraMissione() {
    var box = $("#missione"), m = MISSIONI[attiva], fatta = LAB.fatta(aid(attiva));
    if (domanda) { domanda.rimuovi(); domanda = null; }
    box.innerHTML = "";
    box.className = "missione-box" + (fatta ? " fatta" : "");
    box.appendChild(N.el("div", { class: "num", text: "Missione " + (attiva + 1) + " di " + MISSIONI.length + (fatta ? " · fatta ✓ " + LAB.stelline(LAB.stelleDi(aid(attiva))) : "") }));
    box.appendChild(N.el("h2", { text: m.emoji + " " + m.titolo }));
    var aiuto = function (t) { box.appendChild(N.el("p", { class: "aiuto", text: t })); };
    if (m.id === "galleggia") aiuto("Tocca 🍾 Sughero, poi premi «Lascia andare» e guarda che cosa succede.");
    else if (m.id === "mercurio") {
      aiuto("Prova un solido nell'💧 acqua: se va a fondo, prova lo stesso solido nel 🥈 mercurio! Premi sempre «Lascia andare».");
      var righe = Object.keys(prova).map(function (k) {
        var r = prova[k], s = SOLIDI[+k];
        return s[1] + " " + s[2] + ": " + (r.acqua ? "acqua " + (r.acqua === "su" ? "⬆️ galleggia" : "⬇️ affonda") : "acqua ?") +
          " · " + (r.mercurio ? "mercurio " + (r.mercurio === "su" ? "⬆️ galleggia" : "⬇️ affonda") : "mercurio ?");
      });
      if (righe.length) box.appendChild(N.el("ul", { style: "margin:6px 0;padding-left:20px;font-weight:700" }, righe.map(function (t) { return N.el("li", { text: t }); })));
    } else if (m.id === "bilancia") {
      aiuto("Tocca 🔩 Ferro e mettilo tutto sotto il liquido. È troppo pesante? Fai più grande il buco nascosto!");
    } else if (m.id === "ghiaccio") {
      if (previsione == null && !fatta) {
        box.appendChild(N.el("p", { text: "Prima indovina: secondo te che cosa fa il 🧊 ghiaccio nell'🛢️ olio?" }));
        box.appendChild(N.el("div", { class: "scelte" }, [
          N.el("button", { type: "button", class: "scelta", text: "⬆️ Galleggia", onclick: function () { previsione = true; N.suono.tocco(); mostraMissione(); } }),
          N.el("button", { type: "button", class: "scelta", text: "⬇️ Va a fondo", onclick: function () { previsione = false; N.suono.tocco(); mostraMissione(); } })
        ]));
      } else aiuto((previsione != null ? "Hai detto: " + (previsione ? "galleggia" : "va a fondo") + ". " : "") +
        "Ora prova: tocca 🧊 Ghiaccio e 🛢️ Olio, poi premi «Lascia andare».");
    } else if (m.id === "volume") {
      aiuto("Il solido è un blocco di 5 × 4 × 5 cm. Spingilo tutto sotto e leggi «liquido spostato». Scrivi quanti cm³ di acqua sposta.");
      domanda = LAB.domanda(box, { unita: "cm³", virgola: false, verifica: rispostaVolume });
    }
    if (fatta && !chiusa) {
      var dopo = attiva + 1 < MISSIONI.length ? attiva + 1 : null;
      if (dopo != null) box.appendChild(N.el("button", { type: "button", class: "btn piccolo", style: "margin-top:8px", text: "Prossima missione ➜", onclick: function () { scegliMissione(dopo); } }));
    }
  }

  function vinci(stelle, testo) {
    var i = attiva;
    chiusa = true;
    LAB.completa(aid(i), stelle, testo).then(function () {
      mostraSegreto();
      var dopo = -1;
      for (var j = 1; j <= MISSIONI.length; j++) { var k = (i + j) % MISSIONI.length; if (!LAB.fatta(aid(k))) { dopo = k; break; } }
      if (dopo >= 0) scegliMissione(dopo);
      else { chiusa = false; mostraMissione(); N.esito("si", "Hai fatto tutte le missioni! 🏆", 2500); }
    });
  }

  function gufo(testo) { var h = $("#gufo"); h.innerHTML = ""; h.appendChild(N.gufoDice(testo, "felice")); }
  gufo("Più è pesante, più va giù! Se 1 cm³ del solido pesa meno di 1 cm³ del liquido, il solido galleggia.");

  function dopoLascia(galleggia) {
    var s = SOLIDI[st.sol], l = LIQUIDI[st.liq];
    var peso1 = psS() * (VOL - st.cav) / VOL;
    gufo(s[1] + " " + s[2] + (st.cav ? " con il buco" : "") + (galleggia ? " galleggia" : " va a fondo") + " nel liquido " + l[1] + " " + l[2] + ": " +
      (galleggia ? "1 cm³ di solido pesa meno (" + fmt(peso1, 2) + " g) di 1 cm³ di liquido (" + N.numero(l[3]) + " g)." :
        "1 cm³ di solido pesa più (" + fmt(peso1, 2) + " g) di 1 cm³ di liquido (" + N.numero(l[3]) + " g)."));
    if (galleggia) N.suono.ok(); else N.suono.ko();
    // record the experiment for mission 2
    if (st.cav === 0 && (l[0] === "acqua" || l[0] === "mercurio")) {
      var r = prova[st.sol] = prova[st.sol] || {};
      r[l[0]] = galleggia ? "su" : "giu";
    }
    if (chiusa) return;
    var m = MISSIONI[attiva].id;
    if (m === "galleggia" && s[0] === "sughero" && galleggia) vinci(3, "Il sughero galleggia! Bravo!");
    else if (m === "mercurio") {
      var r2 = prova[st.sol];
      if (r2 && r2.acqua === "giu" && r2.mercurio === "su") vinci(3, s[2] + ": giù nell'acqua, su nel mercurio! Che centro!");
      else mostraMissione();
    } else if (m === "ghiaccio" && s[0] === "ghiaccio" && l[0] === "olio" && st.cav === 0) {
      if (previsione == null) { N.esito("info", "Prima indovina, poi prova!"); mostraMissione(); return; }
      var giusta = previsione === galleggia;
      vinci(giusta ? 3 : 2, (giusta ? "Hai indovinato! " : "Sorpresa! ") +
        "Il ghiaccio (0,9) è appena più leggero dell'olio (0,91): galleggia, quasi tutto sotto!");
    }
  }
  function controllaBilancia() {
    if (chiusa || MISSIONI[attiva].id !== "bilancia" || SOLIDI[st.sol][0] !== "ferro") return;
    var c = calcola(st.hb);
    if (c.s >= BH - 1e-9 && c.bilancia > 0 && c.bilancia < 100) vinci(3, "La bilancia segna " + fmt(c.bilancia) + " g: il ferro è diventato leggero!");
  }
  function rispostaVolume(v) {
    if (Math.abs(v - VOL) < 1e-9) { vinci(errori === 0 ? 3 : errori === 1 ? 2 : 1, "Esatto: 100 cm³, proprio il volume del solido!"); return true; }
    errori++;
    N.sbagliato(errori >= 2 ? "Quanto fa 5 × 4 × 5?" : "Riprova! Guarda «liquido spostato»");
    return false;
  }

  /* ---------------- start ---------------- */
  mostraMissione(); mostraSegreto();
  if (window.ResizeObserver) new ResizeObserver(function () { ridimensiona(); }).observe(cv.parentNode);
  window.addEventListener("resize", ridimensiona);
  ridimensiona();
  window.Archimede = { st: st, calcola: calcola, equilibrio: equilibrio };   // for tests
})();
