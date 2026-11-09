/*
 * SPINTA DI ARCHIMEDE - remake of the Delphi program by Prof. Carmelo Muscolino.
 * A 100 cm³ block (with an optional empty cavity) hangs from a spring scale
 * and can be dragged up/down into the liquid of a vessel. The page shows the
 * weight, the buoyant force and the weight of the displaced liquid.
 *
 * Units: lengths in cm, volumes in cm³, forces in grams-force (g).
 * Scene coordinates: x right, y up, y = 0 is the inner bottom of the vessel.
 */
(function () {
  "use strict";

  /* ---------------- data (values from the original program) ---------------- */
  // [name, specific weight as shown, fill colour]
  var SOLIDI = [
    ["Sughero", "0.3", "#c8a165"],
    ["Cera", "0.8", "#f3ecc8"],
    ["Vetro", "2.6", "rgba(150,235,240,0.55)"],
    ["Alluminio", "2.7", "#c9ced3"],
    ["Ferro", "7.8", "#55595e"],
    ["Oro", "19.5", "#e5b80b"],
    ["Platino", "21.4", "#d9dde0"],
    ["Legno", "0.7", "#9a5b2c"],
    ["Marmo", "2.7", "#f4f4f0"],
    ["Ghiaccio", "0.9", "rgba(215,240,255,0.8)"]
  ];
  // [name, specific weight as shown, colour, opacity]
  var LIQUIDI = [
    ["Acqua (a 4°)", "1.0", "#5fb4ff", 0.45],
    ["Acqua marina", "1.3", "#2f8fc9", 0.5],      // sic: his value
    ["Benzina", "0.78", "#f2efc4", 0.5],
    ["Alcol etilico", "0.80", "#e4f1f7", 0.45],
    ["Mercurio", "13.60", "#b8bec4", 0.82],
    ["Olio d'oliva", "0.91", "#c9b62c", 0.55],
    ["Glicerina", "1.26", "#eef0d6", 0.55]
  ];

  /* ---------------- geometry ---------------- */
  var BW = 5, BH = 4, BD = 5;          // block 5 x 4 x 5 cm = 100 cm³
  var VOL = BW * BH * BD;
  var AB = BW * BD;                    // block horizontal section (25 cm²)
  var VW = 12, VH = 12;                // vessel inner width and height (cm)
  var AV = 80;                         // vessel inner section (cm²)
  var L0 = 7;                          // initial liquid level (cm)
  var SCENE_W = 20, Y_MIN = -2, Y_MAX = 36;
  var HB_MAX = 14;                     // highest position of the block bottom
  var STRING = 9, HOOK = 0.6, SPRING_EXT = 2.2, BODY_H = 5, BODY_W = 3.4;

  /* ---------------- state ---------------- */
  var st = {
    sol: 0, liq: 0, cav: 0,
    hb: 10,             // height of the block bottom above the vessel floor
    v: 0,               // velocity during the "Lascia" animation
    rilasciato: false,  // true after "Lascia" until the next drag
    drag: null
  };

  var $ = D.$;
  var cv = $("#cv"), ctx = cv.getContext("2d");
  var S = 1, OX = 0, OY = 0, dpr = 1; // scene -> CSS px transform

  function num(s) { return parseFloat(s); }
  function psSolido() { return num(SOLIDI[st.sol][1]); }
  function psLiquido() { return num(LIQUIDI[st.liq][1]); }

  // Italian formatting, up to `dec` decimals (default 2)
  function fmt(n, dec) {
    var s = Number(n).toFixed(dec == null ? 2 : dec);
    if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
    if (s === "-0") s = "0";
    return s.replace(".", ",");
  }

  /* ---------------- physics ---------------- */
  // Everything that depends on the block position hb
  function calcola(hb) {
    // Immersed height s and level L satisfy L = L0 + AB*s/AV and s = L - hb
    var s = (L0 - hb) / (1 - AB / AV);
    s = Math.max(0, Math.min(BH, s));
    var vimm = AB * s;
    var peso = psSolido() * (VOL - st.cav);
    var spinta = psLiquido() * vimm;
    return {
      s: s, livello: L0 + vimm / AV, vimm: vimm,
      peso: peso, spinta: spinta, bilancia: peso - spinta
    };
  }
  // Rest position after "Lascia"
  function equilibrio() {
    var peso = psSolido() * (VOL - st.cav), psl = psLiquido();
    if (peso < psl * VOL) {
      var s = peso / (psl * AB);            // floats: immersed height
      return { hb: L0 - s * (1 - AB / AV), galleggia: true };
    }
    return { hb: 0.15, galleggia: false };  // sinks: hangs just above the bottom
  }

  /* ---------------- canvas sizing ---------------- */
  function ridimensiona() {
    var r = cv.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    S = Math.min(r.width / SCENE_W, r.height / (Y_MAX - Y_MIN));
    OX = r.width / 2;
    OY = r.height + Y_MIN * S;   // y = Y_MIN at the bottom edge
    disegna();
  }
  function X(x) { return OX + x * S; }
  function Y(y) { return OY - y * S; }
  function rect(x0, y0, x1, y1) { ctx.rect(X(x0), Y(y1), (x1 - x0) * S, (y1 - y0) * S); }

  /* ---------------- drawing ---------------- */
  function freccia(x, y0, y1, colore) {
    var len = Math.abs(y1 - y0) * S;
    if (len < 2) return;
    var dir = y1 > y0 ? -1 : 1;                 // canvas y direction
    var px = X(x), a = Y(y0), b = Y(y1);
    var head = Math.min(14, Math.max(6, len * 0.35)), hw = Math.max(5, S * 0.45);
    ctx.save();
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(px - hw * 0.35, a); ctx.lineTo(px - hw * 0.35, b - dir * head);
    ctx.lineTo(px - hw, b - dir * head); ctx.lineTo(px, b);
    ctx.lineTo(px + hw, b - dir * head); ctx.lineTo(px + hw * 0.35, b - dir * head);
    ctx.lineTo(px + hw * 0.35, a); ctx.closePath();
    ctx.fillStyle = colore; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = "#000"; ctx.stroke();
    ctx.restore();
  }

  function disegnaBlocco(hb) {
    var x0 = -BW / 2, x1 = BW / 2, y0 = hb, y1 = hb + BH;
    var nome = SOLIDI[st.sol][0], col = SOLIDI[st.sol][2];
    ctx.save();
    ctx.beginPath(); rect(x0, y0, x1, y1);
    if (nome === "Oro") {
      var g = ctx.createLinearGradient(X(x0), Y(y1), X(x1), Y(y0));
      g.addColorStop(0, "#fff2a8"); g.addColorStop(0.45, "#e5b80b"); g.addColorStop(1, "#9c7400");
      ctx.fillStyle = g;
    } else if (nome === "Alluminio" || nome === "Platino" || nome === "Ferro") {
      var m = ctx.createLinearGradient(X(x0), Y(y1), X(x1), Y(y0));
      m.addColorStop(0, "#fff"); m.addColorStop(0.35, col); m.addColorStop(1, nome === "Ferro" ? "#2b2e31" : "#8d9399");
      ctx.fillStyle = m;
    } else ctx.fillStyle = col;
    ctx.fill();
    ctx.clip();
    // material texture
    ctx.lineWidth = 1;
    if (nome === "Marmo") {
      ctx.strokeStyle = "rgba(110,110,120,0.55)";
      ctx.beginPath();
      ctx.moveTo(X(x0), Y(y0 + 3)); ctx.bezierCurveTo(X(-1), Y(y0 + 2), X(0), Y(y0 + 3.4), X(x1), Y(y0 + 1.2));
      ctx.moveTo(X(-1.5), Y(y0)); ctx.bezierCurveTo(X(-0.8), Y(y0 + 1.5), X(0.5), Y(y0 + 1), X(1.2), Y(y1));
      ctx.stroke();
    } else if (nome === "Legno" || nome === "Sughero") {
      ctx.strokeStyle = nome === "Legno" ? "rgba(60,30,10,0.45)" : "rgba(90,60,20,0.35)";
      for (var k = 0.5; k < BH; k += nome === "Legno" ? 0.55 : 0.9) {
        ctx.beginPath();
        ctx.moveTo(X(x0), Y(y0 + k));
        ctx.quadraticCurveTo(X(0), Y(y0 + k + 0.25), X(x1), Y(y0 + k - 0.1));
        ctx.stroke();
      }
      if (nome === "Sughero") {
        ctx.fillStyle = "rgba(90,55,20,0.45)";
        for (var i = 0; i < 18; i++) {
          var rx = x0 + ((i * 37) % 50) / 10, ry = y0 + ((i * 23) % 40) / 10;
          ctx.fillRect(X(rx), Y(ry), 2, 2);
        }
      }
    } else if (nome === "Vetro" || nome === "Ghiaccio") {
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X(x0 + 0.4), Y(y1 - 0.4)); ctx.lineTo(X(x0 + 1.6), Y(y1 - 0.4)); ctx.stroke();
    }
    // cavity: empty hollow, same proportions as the block
    if (st.cav > 0) {
      var f = Math.sqrt(st.cav / VOL), cw = BW * f / 2, ch = BH * f / 2, cy = hb + BH / 2;
      ctx.beginPath(); rect(-cw, cy - ch, cw, cy + ch);
      ctx.fillStyle = "rgba(255,255,255,0.82)"; ctx.fill();
      ctx.setLineDash([4, 3]); ctx.strokeStyle = "#444"; ctx.lineWidth = 1; ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    ctx.beginPath(); rect(x0, y0, x1, y1);
    ctx.lineWidth = 1.5; ctx.strokeStyle = "#000"; ctx.stroke();
  }

  function disegnaBilancia(hb, lettura, maxPeso) {
    var top = hb + BH;
    var allentato = lettura <= 0;
    var ext = allentato ? 0 : SPRING_EXT * Math.min(1, lettura / maxPeso);
    var hookTop = top + STRING;
    var bodyY0 = hookTop + HOOK + ext, bodyY1 = bodyY0 + BODY_H;
    var bx0 = -BODY_W / 2, bx1 = BODY_W / 2;

    // thread from the ceiling to the ring
    ctx.strokeStyle = "#222"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X(0), Y(bodyY1 + 0.6)); ctx.lineTo(X(0), 0); ctx.stroke();
    // ring
    ctx.beginPath(); ctx.arc(X(0), Y(bodyY1 + 0.35), Math.max(3, 0.28 * S), 0, Math.PI * 2);
    ctx.lineWidth = 2; ctx.strokeStyle = "#333"; ctx.stroke();

    // string holding the block (slack when the block floats)
    ctx.lineWidth = 1.3; ctx.strokeStyle = "#111";
    ctx.beginPath(); ctx.moveTo(X(0), Y(top));
    if (allentato) ctx.bezierCurveTo(X(0.9), Y(top + STRING * 0.3), X(-0.9), Y(top + STRING * 0.7), X(0), Y(hookTop));
    else ctx.lineTo(X(0), Y(hookTop));
    ctx.stroke();
    // hook + rod into the body
    ctx.lineWidth = 2; ctx.strokeStyle = "#444";
    ctx.beginPath(); ctx.arc(X(0), Y(hookTop + 0.2), Math.max(2.5, 0.2 * S), Math.PI * 0.5, Math.PI * 2.1); ctx.stroke();

    // body
    ctx.beginPath(); rect(bx0, bodyY0, bx1, bodyY1);
    var g = ctx.createLinearGradient(X(bx0), 0, X(bx1), 0);
    g.addColorStop(0, "#9aa3ad"); g.addColorStop(0.5, "#eef1f4"); g.addColorStop(1, "#8a939c");
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = "#222"; ctx.stroke();

    // slot with spring and graduation (lower half of the body)
    var sy0 = bodyY0 + 0.3, sy1 = bodyY0 + 3.1;
    ctx.beginPath(); rect(-0.55, sy0, 0.55, sy1);
    ctx.fillStyle = "#fbfbf2"; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = "#555"; ctx.stroke();
    ctx.strokeStyle = "#333"; ctx.lineWidth = 1;
    for (var t = 0; t <= 10; t++) {
      var ty = sy1 - 0.2 - t * (SPRING_EXT / 10);
      ctx.beginPath(); ctx.moveTo(X(0.55), Y(ty)); ctx.lineTo(X(t % 5 === 0 ? 1.15 : 0.85), Y(ty)); ctx.stroke();
    }
    // spring: from the top of the slot down to the moving index
    var idx = sy1 - 0.2 - ext;
    // rod from the hook up to the index (fixed length: the body moves instead)
    ctx.lineWidth = 2; ctx.strokeStyle = "#444";
    ctx.beginPath(); ctx.moveTo(X(0), Y(hookTop + 0.4)); ctx.lineTo(X(0), Y(idx)); ctx.stroke();
    ctx.strokeStyle = "#555"; ctx.lineWidth = 1.2;
    ctx.beginPath();
    var n = 9, zTop = sy1 - 0.05, zBot = idx;
    ctx.moveTo(X(0), Y(zTop));
    for (var z = 1; z <= n; z++) {
      var zy = zTop - (zTop - zBot) * z / (n + 1);
      ctx.lineTo(X(z % 2 ? 0.38 : -0.38), Y(zy));
    }
    ctx.lineTo(X(0), Y(zBot));
    ctx.stroke();
    // red index
    ctx.strokeStyle = "#d00000"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(-0.5), Y(idx)); ctx.lineTo(X(0.75), Y(idx)); ctx.stroke();

    // digital display (upper half)
    var dy0 = bodyY0 + 3.5, dy1 = bodyY1 - 0.5;
    ctx.beginPath(); rect(bx0 + 0.25, dy0, bx1 - 0.25, dy1);
    ctx.fillStyle = "#1b2e1b"; ctx.fill(); ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.stroke();
    var testo = fmt(Math.max(0, lettura), 1) + " g";
    var fs = Math.max(9, Math.min(0.95 * S, (BODY_W - 0.6) * S / (testo.length * 0.62)));
    ctx.font = "bold " + fs + "px 'Courier New', monospace";
    ctx.fillStyle = "#7dff7d"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(testo, X(0), Y((dy0 + dy1) / 2 - 0.05));

    // floating label next to the scale
    if (allentato) {
      ctx.font = "bold " + Math.max(11, 0.8 * S) + "px " + "Tahoma, sans-serif";
      ctx.textAlign = "left"; ctx.fillStyle = "#ffff80";
      ctx.fillText("galleggia", X(bx1 + 0.3), Y(bodyY0 + 1));
    }
  }

  function disegna() {
    var w = cv.width / dpr, h = cv.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var c = calcola(st.hb);
    var liq = LIQUIDI[st.liq];
    // after "Lascia" a floating block no longer pulls on the scale (slack string)
    if (st.rilasciato && equilibrio().galleggia) c.bilancia = Math.min(c.bilancia, 0);
    var lettura = c.bilancia;
    var maxPeso = Math.max(psSolido() * VOL, 1);
    var x0 = -VW / 2, x1 = VW / 2, T = 0.35; // glass thickness

    // table
    ctx.fillStyle = "#6b4a2b";
    ctx.fillRect(0, Y(-T), w, Math.max(0, h - Y(-T)));
    ctx.fillStyle = "#8a6440"; ctx.fillRect(0, Y(-T), w, Math.max(2, 0.3 * S));

    // vessel back pane
    ctx.beginPath(); rect(x0, 0, x1, VH);
    ctx.fillStyle = "rgba(232,248,250,0.92)"; ctx.fill();

    // liquid
    ctx.save();
    ctx.globalAlpha = liq[3];
    ctx.beginPath(); rect(x0, 0, x1, c.livello);
    ctx.fillStyle = liq[2]; ctx.fill();
    ctx.restore();

    // initial level marker (shows the rise)
    ctx.save();
    ctx.setLineDash([5, 4]); ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X(x1 - 2.2), Y(L0)); ctx.lineTo(X(x1 + T + 0.6), Y(L0)); ctx.stroke();
    ctx.restore();

    // block, arrows' centre
    disegnaBlocco(st.hb);

    // liquid tint over the immersed part of the block
    if (c.s > 0) {
      ctx.save();
      ctx.globalAlpha = liq[0] === "Mercurio" ? 0.55 : 0.32;
      ctx.beginPath(); rect(-BW / 2, st.hb, BW / 2, st.hb + c.s);
      ctx.fillStyle = liq[2]; ctx.fill();
      ctx.restore();
    }
    // liquid surface
    ctx.strokeStyle = "rgba(0,40,80,0.7)"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (c.s > 0 && c.s < BH) {
      ctx.moveTo(X(x0), Y(c.livello)); ctx.lineTo(X(-BW / 2), Y(c.livello));
      ctx.moveTo(X(BW / 2), Y(c.livello)); ctx.lineTo(X(x1), Y(c.livello));
    } else { ctx.moveTo(X(x0), Y(c.livello)); ctx.lineTo(X(x1), Y(c.livello)); }
    ctx.stroke();

    // vessel glass walls + graduation
    ctx.fillStyle = "rgba(220,245,255,0.55)";
    ctx.strokeStyle = "#0b2b33"; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(X(x0 - T), Y(VH)); ctx.lineTo(X(x0 - T), Y(-T)); ctx.lineTo(X(x1 + T), Y(-T)); ctx.lineTo(X(x1 + T), Y(VH));
    ctx.lineTo(X(x1), Y(VH)); ctx.lineTo(X(x1), Y(0)); ctx.lineTo(X(x0), Y(0)); ctx.lineTo(X(x0), Y(VH)); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 1;
    for (var k = 1; k < VH; k++) {
      ctx.beginPath(); ctx.moveTo(X(x0), Y(k)); ctx.lineTo(X(x0 + (k % 5 === 0 ? 0.9 : 0.5)), Y(k)); ctx.stroke();
    }

    // forces from the block centre (lengths proportional)
    var maxF = Math.max(c.peso, psLiquido() * VOL, 1);
    var kF = 6.5 / maxF, yc = st.hb + BH / 2;
    freccia(0, yc, yc - c.peso * kF, "#ffff00");
    freccia(0, yc, yc + c.spinta * kF, "#00ffff");

    disegnaBilancia(st.hb, lettura, maxPeso);
    aggiornaLetture(c);
  }

  /* ---------------- readouts ---------------- */
  var ultimo = "";
  function aggiornaLetture(c) {
    var chiave = [c.peso, c.spinta, c.vimm, c.bilancia, st.liq].join("|");
    if (chiave === ultimo) return;
    ultimo = chiave;
    $("#vPeso").textContent = fmt(c.peso) + " g";
    $("#vSpinta").textContent = fmt(c.spinta) + " g";
    $("#vVolume").textContent = fmt(c.vimm) + " cm³";
    $("#vPsl").textContent = LIQUIDI[st.liq][1].replace(".", ",") + " g/cm³";
    $("#vPls").textContent = fmt(c.spinta) + " g";
    $("#vBil").textContent = fmt(Math.max(0, c.bilancia)) + " g";
    var s = "";
    if (c.vimm > 0 && c.bilancia <= 0) s = "Il solido galleggia: la spinta è uguale o maggiore del peso.";
    else if (c.vimm >= VOL - 1e-9) s = "Il solido è completamente immerso.";
    else if (c.vimm > 0) s = "Il solido è parzialmente immerso.";
    $("#stato").textContent = s;
  }

  /* ---------------- animation ("Lascia") ---------------- */
  var raf = 0, tPrec = 0;
  function anima(t) {
    raf = 0;
    if (!st.rilasciato || st.drag) return;
    var dt = Math.min(0.04, tPrec ? (t - tPrec) / 1000 : 0.016);
    tPrec = t;
    var eq = equilibrio();
    // damped spring towards the rest position (more damping when sinking)
    var k = eq.galleggia ? 28 : 10, smorz = eq.galleggia ? 4.5 : 6;
    st.v += (-k * (st.hb - eq.hb) - smorz * st.v) * dt;
    st.hb += st.v * dt;
    if (st.hb < 0) { st.hb = 0; st.v = 0; }
    if (Math.abs(st.hb - eq.hb) < 0.005 && Math.abs(st.v) < 0.03) { st.hb = eq.hb; st.v = 0; disegna(); return; }
    disegna();
    raf = requestAnimationFrame(anima);
  }
  function avvia() {
    st.rilasciato = true;
    if (!raf) { tPrec = 0; raf = requestAnimationFrame(anima); }
  }

  /* ---------------- pointer / keyboard interaction ---------------- */
  function scenaY(e) {
    var r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left - OX) / S, y: (OY - (e.clientY - r.top)) / S };
  }
  function sulSolido(p) {
    var m = Math.max(0.4, 12 / S); // extra grab margin for fingers
    var c = calcola(st.hb);
    var bodyTop = st.hb + BH + STRING + HOOK + BODY_H + SPRING_EXT;
    return Math.abs(p.x) <= BW / 2 + m && p.y >= st.hb - m && p.y <= (c.bilancia > 0 ? bodyTop : st.hb + BH + m);
  }
  function sposta(hb) {
    st.hb = Math.max(0, Math.min(HB_MAX, hb));
    disegna();
  }
  cv.addEventListener("pointerdown", function (e) {
    var p = scenaY(e);
    if (!sulSolido(p)) return;
    e.preventDefault();
    st.rilasciato = false; st.v = 0;
    st.drag = { id: e.pointerId, off: p.y - st.hb };
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* */ }
    cv.style.cursor = "grabbing";
    $("#hint").hidden = true;
  });
  cv.addEventListener("pointermove", function (e) {
    var p = scenaY(e);
    if (st.drag && e.pointerId === st.drag.id) { sposta(p.y - st.drag.off); return; }
    cv.style.cursor = sulSolido(p) ? "grab" : "default";
  });
  function fineDrag(e) {
    if (!st.drag || e.pointerId !== st.drag.id) return;
    st.drag = null; cv.style.cursor = "grab";
  }
  cv.addEventListener("pointerup", fineDrag);
  cv.addEventListener("pointercancel", fineDrag);
  cv.addEventListener("keydown", function (e) {
    var d = { ArrowUp: 0.25, ArrowDown: -0.25, PageUp: 2, PageDown: -2 }[e.key];
    if (d == null) return;
    e.preventDefault();
    st.rilasciato = false; st.v = 0;
    sposta(st.hb + d);
  });

  /* ---------------- controls ---------------- */
  function pad(s, n) { while (s.length < n) s += " "; return s; }
  SOLIDI.forEach(function (s, i) {
    $("#solido").appendChild(D.el("option", { value: i, text: pad(s[0], 12) + "ps " + s[1] }));
  });
  LIQUIDI.forEach(function (l, i) {
    $("#liquido").appendChild(D.el("option", { value: i, text: pad(l[0], 15) + "ps " + l[1] }));
  });
  function cambiato() { ultimo = ""; if (st.rilasciato) avvia(); disegna(); }
  $("#solido").addEventListener("change", function () { st.sol = +this.value; cambiato(); });
  $("#liquido").addEventListener("change", function () { st.liq = +this.value; cambiato(); });

  // cavity "scrollbar": 0..79 cm³
  function impostaCavita(v) {
    v = Math.max(0, Math.min(79, v));
    if (v === st.cav) return;
    st.cav = v;
    var f = $("#cavita");
    f.textContent = v + " cm³";
    f.setAttribute("aria-valuenow", v);
    cambiato();
  }
  function ripeti(btn, passo) {
    var t1 = 0, t2 = 0;
    function stop() { clearTimeout(t1); clearInterval(t2); }
    btn.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      impostaCavita(st.cav + passo);
      t1 = setTimeout(function () { t2 = setInterval(function () { impostaCavita(st.cav + passo); }, 60); }, 400);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { btn.addEventListener(ev, stop); });
    btn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); impostaCavita(st.cav + passo); }
    });
  }
  ripeti($("#cavSu"), 1);
  ripeti($("#cavGiu"), -1);
  $("#cavita").addEventListener("keydown", function (e) {
    var d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[e.key];
    if (e.key === "Home") d = -st.cav; else if (e.key === "End") d = 79 - st.cav;
    if (d == null) return;
    e.preventDefault(); impostaCavita(st.cav + d);
  });
  $(".cavita").addEventListener("wheel", function (e) {
    e.preventDefault(); impostaCavita(st.cav + (e.deltaY < 0 ? 1 : -1));
  }, { passive: false });

  $("#lascia").addEventListener("click", function () { $("#hint").hidden = true; avvia(); });
  $("#uscita").addEventListener("click", function () { location.href = "../../index.html"; });

  function autore() { D.msg("Prof. Carmelo Muscolino - Palmanova (UD)", "Autore"); }
  $("#autore").addEventListener("click", autore);
  $("#autore").addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); autore(); } });

  // "Archimede" window with the original bitmap and text
  var TESTO_ARCHIMEDE = "ARCHIMEDE\nNato a Siracusa nel 287 a. C.\ne morto nel  212 a. C.\n\n" +
    "Il più grande matematico ed ingegnere dell'antichità. Greco di Siracusa, fu ucciso durante la presa " +
    "della città da parte dei Romani. La sua fama è legata al \"principio di Achimede\", per cui un corpo " +
    "immerso in un fluido riceve .........(devi scoprirlo tu )";
  $("#linkArch").addEventListener("click", function () {
    var nodo = D.el("div", { class: "info-arch" }, [
      D.el("img", { src: "../../img/archimede-busto.png", width: 152, height: 228, alt: "Busto di Archimede" }),
      D.el("div", { class: "testo", text: TESTO_ARCHIMEDE })
    ]);
    D.dialogo({ titolo: "Archimede", nodo: nodo, pulsanti: [{ testo: "chiudi", valore: true }], annulla: true });
  });

  /* ---------------- start ---------------- */
  if (window.ResizeObserver) new ResizeObserver(ridimensiona).observe(cv);
  window.addEventListener("resize", ridimensiona);
  ridimensiona();
})();
