/*
 * TALETE - "LABORATORIO DI MATEMATICA" (MAT.EXE), remake of the Delphi program
 * by Prof. Carmelo Muscolino. A sun ray hits two red sticks and forms their
 * shadows: the triangles are similar, so a/b = c/d.
 *
 * Drawing coordinates follow the original 514 x 319 bitmaps: the ground is at
 * y = 242 and the ray always meets it at P = (466, 242). 20 px = 1 cm.
 */
(function () {
  "use strict";
  var $ = D.$;

  /* =================================================================
     Expression parser (own recursive-descent code, no eval/Function).
     Grammar:  espr   = termine { (+|-) termine }
               termine = unario { (*|/) unario }
               unario  = (+|-) unario | fattore
               fattore = numero | lettera | PI | FUNZ fattore | "(" espr ")"
     Functions (as in J. L. Dean's Pascal evaluator): ABS ARCTAN COS EXP LN
     SIN SQR (square) SQRT. Trig functions use radians.
     ================================================================= */
  var FUNZ = {
    ABS: Math.abs, ARCTAN: Math.atan, COS: Math.cos, EXP: Math.exp,
    LN: function (x) { if (x <= 0) throw new Error("LN di un numero non positivo"); return Math.log(x); },
    SIN: Math.sin, SQR: function (x) { return x * x; },
    SQRT: function (x) { if (x < 0) throw new Error("radice di un numero negativo"); return Math.sqrt(x); }
  };
  function tokenizza(s) {
    var t = [], i = 0, m;
    while (i < s.length) {
      var r = s.slice(i);
      if ((m = /^\s+/.exec(r))) { i += m[0].length; continue; }
      if ((m = /^(\d+([.,]\d*)?|[.,]\d+)/.exec(r))) { t.push({ k: "n", v: parseFloat(m[0].replace(",", ".")) }); }
      else if ((m = /^[a-z]+/i.exec(r))) { t.push({ k: "id", v: m[0] }); }
      else if ((m = /^[-+*/()]/.exec(r))) { t.push({ k: m[0] }); }
      else throw new Error("carattere non valido: " + r[0]);
      i += m[0].length;
    }
    return t;
  }
  function valuta(testo, variabili) {
    var t = tokenizza(testo), p = 0;
    variabili = variabili || {};
    function vedi() { return t[p] ? t[p].k : null; }
    function espr() {
      var v = termine();
      while (vedi() === "+" || vedi() === "-") { v = t[p++].k === "+" ? v + termine() : v - termine(); }
      return v;
    }
    function termine() {
      var v = unario();
      while (vedi() === "*" || vedi() === "/") {
        var op = t[p++].k, w = unario();
        if (op === "*") v *= w;
        else { if (w === 0) throw new Error("divisione per zero"); v /= w; }
      }
      return v;
    }
    function unario() {
      if (vedi() === "-") { p++; return -unario(); }
      if (vedi() === "+") { p++; return unario(); }
      return fattore();
    }
    function fattore() {
      var tk = t[p++];
      if (!tk) throw new Error("espressione incompleta");
      if (tk.k === "n") return tk.v;
      if (tk.k === "(") {
        var v = espr();
        if (vedi() !== ")") throw new Error("manca la parentesi )");
        p++; return v;
      }
      if (tk.k === "id") {
        var nome = tk.v.toUpperCase(), low = tk.v.toLowerCase();
        if (Object.prototype.hasOwnProperty.call(variabili, low)) return variabili[low];
        if (nome === "PI") return Math.PI;
        if (FUNZ.hasOwnProperty(nome)) return FUNZ[nome](unario());
        throw new Error("nome sconosciuto: " + tk.v);
      }
      throw new Error("simbolo inatteso: " + tk.k);
    }
    if (!t.length) throw new Error("espressione vuota");
    var ris = espr();
    if (p < t.length) throw new Error("simbolo inatteso: " + (t[p].v || t[p].k));
    if (!isFinite(ris)) throw new Error("risultato non valido");
    return ris;
  }

  // Italian number formatting with at most `dec` decimals
  function fmt(n, dec) {
    var s = Number(n).toFixed(dec);
    if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
    if (s === "-0") s = "0";
    return s.replace(".", ",");
  }

  /* =================================================================
     Scene
     ================================================================= */
  var W = 514, H = 300, SUOLO = 242, PX = 466, SCALA = 20;  // 20 px = 1 cm
  var XMIN = 46, XMAX = PX - 20, LARGO = 8;                  // stick limits and width
  // the three suns = starting points of the ray (measured on the original bitmaps)
  var SOLI = [{ x: 18, y: 18 }, { x: 14, y: 60 }, { x: 16, y: 118 }];

  var st = {
    sole: 0,
    legni: [{ x: 130 }, { x: 330 }],   // x = right edge of each stick (the measured segment)
    attivo: 0,                         // stick moved by the keyboard
    drag: null, hover: -1
  };

  var cv = $("#cv"), ctx = cv.getContext("2d");
  var k = 1, dpr = 1;  // world -> CSS px scale

  function tanRaggio() { var s = SOLI[st.sole]; return (SUOLO - s.y) / (PX - s.x); }
  function yRaggio(x) { return SUOLO - (PX - x) * tanRaggio(); }
  function snap(x) { x = Math.max(XMIN, Math.min(XMAX, x)); return PX - Math.round((PX - x) / 2) * 2; } // 0.1 cm steps

  // Lengths in cm, rounded to 1 decimal as shown to the pupil
  function misure() {
    var t = tanRaggio(), r = function (v) { return Math.round(v * 10) / 10; };
    var b = (PX - st.legni[0].x) / SCALA, d = (PX - st.legni[1].x) / SCALA;
    return { a: r(b * t), b: r(b), c: r(d * t), d: r(d) };
  }

  function ridimensiona() {
    var r = cv.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    k = r.width / W;
    disegna();
  }

  /* ---------------- drawing ---------------- */
  function px(n) { return n / k; }             // CSS px -> world units
  // `sz` = nominal size in CSS px at the original 514 px width; never below 11 px, never much above sz
  function font(sz, bold) {
    var css = Math.max(11, Math.min(sz * k, sz * 1.15));
    return (bold ? "bold " : "") + px(css) + "px Tahoma, Verdana, sans-serif";
  }

  function sole(s, scelto) {
    var r = 11;
    ctx.save();
    if (scelto) {
      ctx.strokeStyle = "#e0a000"; ctx.lineWidth = 2;
      for (var i = 0; i < 12; i++) {
        var a = i * Math.PI / 6;
        ctx.beginPath();
        ctx.moveTo(s.x + Math.cos(a) * (r + 3), s.y + Math.sin(a) * (r + 3));
        ctx.lineTo(s.x + Math.cos(a) * (r + 8), s.y + Math.sin(a) * (r + 8));
        ctx.stroke();
      }
    }
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fillStyle = scelto ? "#ffd800" : "#ffff60"; ctx.fill();
    ctx.lineWidth = scelto ? 2 : 1; ctx.strokeStyle = scelto ? "#a06000" : "#b0a000"; ctx.stroke();
    ctx.restore();
  }

  function legno(x, nome, val, i) {
    var x0 = x - LARGO;
    ctx.save();
    function sagoma() {
      ctx.beginPath();
      ctx.moveTo(x0, SUOLO); ctx.lineTo(x0, yRaggio(x0)); ctx.lineTo(x, yRaggio(x)); ctx.lineTo(x, SUOLO); ctx.closePath();
    }
    sagoma();
    ctx.fillStyle = "#ffe0e0"; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = "#e00000"; ctx.lineWidth = 1;          // hatched diagonal fill
    for (var h = yRaggio(x0) - LARGO - 6; h < SUOLO + LARGO; h += 5) {
      ctx.beginPath(); ctx.moveTo(x0, h + LARGO); ctx.lineTo(x, h); ctx.stroke();
    }
    ctx.restore();
    sagoma();
    ctx.strokeStyle = "#ff0000"; ctx.lineWidth = Math.max(1.5, px(1.5)); ctx.stroke();
    // label: letter + length, to the left of the stick
    var ym = (SUOLO + yRaggio(x)) / 2;
    ctx.fillStyle = "#000"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.font = font(20, true); alone(nome, x0 - 5, ym - px(8));
    ctx.font = font(13); alone(fmt(val, 1) + " cm", x0 - 5, ym + px(8));
    // yellow handle at the foot
    var on = st.hover === i || (st.drag && st.drag.i === i);
    ctx.beginPath(); ctx.arc(x - LARGO / 2, SUOLO, Math.max(6, px(on ? 9 : 7)), 0, Math.PI * 2);
    ctx.fillStyle = "#ffff00"; ctx.fill();
    ctx.lineWidth = px(1.5); ctx.strokeStyle = on ? "#c00000" : "#806000"; ctx.stroke();
    ctx.restore();
  }

  // text with a white halo, readable over lines
  function alone(t, x, y) {
    ctx.save();
    ctx.lineJoin = "round"; ctx.strokeStyle = "#fff"; ctx.lineWidth = px(4);
    ctx.strokeText(t, x, y); ctx.fillText(t, x, y);
    ctx.restore();
  }

  // horizontal dimension line from x0 to P at height y, with label
  function quota(x0, y, nome, val) {
    ctx.save();
    ctx.strokeStyle = "#333"; ctx.fillStyle = "#000"; ctx.lineWidth = px(1);
    ctx.beginPath();
    ctx.moveTo(x0, y); ctx.lineTo(PX, y);
    ctx.moveTo(x0, y - 4); ctx.lineTo(x0, y + 4); ctx.moveTo(PX, y - 4); ctx.lineTo(PX, y + 4);
    ctx.stroke();
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(x0, SUOLO + 4); ctx.lineTo(x0, y); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#000"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.font = font(15, true);
    alone(nome + " = " + fmt(val, 1) + " cm", (x0 + PX) / 2, y - 2);
  }

  function disegna() {
    var m = misure();
    ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);

    // ground
    ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(14, SUOLO); ctx.lineTo(PX + 30, SUOLO); ctx.stroke();

    // shadows b and d on the ground (dark bands; the shorter one on top)
    var L = st.legni;
    var ordine = L[0].x < L[1].x ? [0, 1] : [1, 0];
    ordine.forEach(function (i, n) {
      ctx.fillStyle = n === 0 ? "#3a3a3a" : "#000";
      ctx.fillRect(L[i].x, SUOLO - 1, PX - L[i].x, n === 0 ? 5 : 3);
    });

    // sun ray
    var s = SOLI[st.sole];
    ctx.strokeStyle = "#d8c000"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(PX, SUOLO); ctx.stroke();
    ctx.strokeStyle = "#5a5000"; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(PX, SUOLO); ctx.stroke();

    SOLI.forEach(function (so, i) { sole(so, i === st.sole); });

    // dimension lines for the shadows
    quota(L[0].x, 266, "b", m.b);
    quota(L[1].x, 291, "d", m.d);

    // sticks (the active one drawn last)
    var ord = st.attivo === 0 ? [1, 0] : [0, 1];
    ord.forEach(function (i) { legno(L[i].x, i === 0 ? "a" : "c", i === 0 ? m.a : m.c, i); });

    ctx.fillStyle = "#000"; ctx.font = font(12, true); ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("P", PX + 6, SUOLO + 4);

    aggiornaValori(m);
  }

  /* ---------------- readouts and letter calculator ---------------- */
  function aggiornaValori(m) {
    ["a", "b", "c", "d"].forEach(function (l) { $("#m" + l).textContent = fmt(m[l], 1) + " cm"; });
    [1, 2].forEach(function (n) {
      var inp = $("#e" + n), out = $("#r" + n), txt = inp.value.trim();
      if (!txt) { out.textContent = ""; out.classList.remove("err"); out.title = ""; return; }
      try {
        out.textContent = fmt(valuta(txt, m), 2);
        out.classList.remove("err"); out.title = "";
      } catch (e) {
        out.textContent = "errore"; out.classList.add("err"); out.title = e.message;
      }
    });
  }
  [1, 2].forEach(function (n) {
    $("#e" + n).addEventListener("input", function () {
      var pos = this.selectionStart, low = this.value.toLowerCase();
      if (low !== this.value) { this.value = low; this.setSelectionRange(pos, pos); }
      aggiornaValori(misure());
    });
  });
  $("#prova").addEventListener("click", function () {
    $("#e1").value = "a/b"; $("#e2").value = "c/d";
    aggiornaValori(misure());
  });

  /* ---------------- pointer interaction ---------------- */
  function mondo(e) {
    var r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  }
  function trovaSole(p) {
    for (var i = 0; i < SOLI.length; i++) {
      if (Math.hypot(p.x - SOLI[i].x, p.y - SOLI[i].y) <= Math.max(16, px(20))) return i;
    }
    return -1;
  }
  function trovaLegno(p) {
    var best = -1, dist = Infinity, raggio = Math.max(10, px(22));
    st.legni.forEach(function (l, i) {
      var cx = l.x - LARGO / 2, dx = Math.abs(p.x - cx), d;
      if (Math.abs(p.y - SUOLO) <= raggio) d = Math.hypot(dx, p.y - SUOLO);       // near the handle
      else if (p.y >= yRaggio(l.x) - 4 && p.y <= SUOLO && dx <= LARGO / 2 + px(8)) d = dx + raggio; // on the stick
      else return;
      if (d <= raggio * 2 && d < dist) { dist = d; best = i; }
    });
    return best;
  }
  cv.addEventListener("pointerdown", function (e) {
    var p = mondo(e), i = trovaLegno(p);
    if (i >= 0) {
      e.preventDefault();
      st.drag = { i: i, id: e.pointerId, off: p.x - st.legni[i].x };
      st.attivo = i;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* */ }
      disegna();
      return;
    }
    var s = trovaSole(p);
    if (s >= 0) { e.preventDefault(); st.sole = s; disegna(); }
  });
  cv.addEventListener("pointermove", function (e) {
    var p = mondo(e);
    if (st.drag && e.pointerId === st.drag.id) {
      st.legni[st.drag.i].x = snap(p.x - st.drag.off);
      disegna();
      return;
    }
    var i = trovaLegno(p), s = i < 0 ? trovaSole(p) : -1;
    cv.style.cursor = i >= 0 ? "ew-resize" : s >= 0 ? "pointer" : "default";
    cv.title = i >= 0 ? "Clicca e trascina" : s >= 0 ? "Clicca per cambiare l'inclinazione del raggio" : "";
    if (i !== st.hover) { st.hover = i; disegna(); }
  });
  function fine(e) {
    if (st.drag && e.pointerId === st.drag.id) { st.drag = null; disegna(); }
  }
  cv.addEventListener("pointerup", fine);
  cv.addEventListener("pointercancel", fine);
  cv.addEventListener("pointerleave", function () { if (!st.drag && st.hover !== -1) { st.hover = -1; disegna(); } });

  cv.addEventListener("keydown", function (e) {
    if (e.key >= "1" && e.key <= "3") { st.sole = +e.key - 1; }
    else if (e.key === "a" || e.key === "A") st.attivo = 0;
    else if (e.key === "c" || e.key === "C") st.attivo = 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      var l = st.legni[st.attivo];
      l.x = snap(l.x + (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 20 : 2));
    } else return;
    e.preventDefault();
    disegna();
  });

  /* ---------------- menu ---------------- */
  var AIUTO = "ESERCITAZIONE DI MATEMATICA\n" +
    "Muovere i segmenti a e b (cliccando e trascinando i punti colorati giallo)\n" +
    "Osservare il valore che assumono i vari segmenti.\n" +
    "Cambiare l'inclinazione del raggio luminoso cliccando sul relativo 'sole'.\n" +
    "Per osservare le relazioni tra le grandezze in esame è disponibile la calcolatrice.\n" +
    "Per osservare in tempo reale il risultato delle varie operazioni si possono digitare le lettere dei  segmenti con  l'operazione da eseguire nelle caselle grigie.\n" +
    "Esempio scrivendo:\n" +
    "    a-b\n" +
    "    c/d\n" +
    "appare il risultato in tempo reale di a-b e c diviso d.\n" +
    "Le operazioni possibili sono:\n" +
    " SOTTRAZIONE  -\n" +
    " SOMMA             +\n" +
    " PRODOTTO       *\n" +
    " DIVISIONE         /\n" +
    "Sono possibili  errori nei calcoli dovuti alle approssimazioni .";
  $("#mUscita").addEventListener("click", function () { location.href = "../../index.html"; });
  $("#mAiuto").addEventListener("click", function () { D.msg(AIUTO, "?"); });
  $("#mCalc").addEventListener("click", apriCalc);

  /* =================================================================
     Calcolatrice
     ================================================================= */
  var calc = $("#calc"), espr = $("#calcEspr"), ris = $("#calcRis");
  function apriCalc() {
    if (calc.hidden) {
      calc.hidden = false;
      var w = calc.offsetWidth, h = calc.offsetHeight;
      calc.style.left = Math.max(8, window.innerWidth - w - 24) + "px";
      calc.style.top = Math.max(8, Math.min(90, window.innerHeight - h - 8)) + "px";
    }
    espr.focus();
  }
  function chiudiCalc() { calc.hidden = true; $("#mCalc").focus(); }
  function calcola() {
    if (!espr.value.trim()) { ris.value = ""; return; }
    try { ris.value = fmt(valuta(espr.value), 10); }
    catch (e) { ris.value = "Errore: " + e.message; }
  }
  $("#tasti").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    var t = b.textContent;
    if (t === "=") calcola();
    else if (t === "Cancella") { espr.value = ""; ris.value = ""; }
    else espr.value += t;
  });
  espr.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); calcola(); }
  });
  calc.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !D.dialogoAperto()) { e.preventDefault(); chiudiCalc(); }
  });
  $("#calcX").addEventListener("click", chiudiCalc);
  $("#calcChiudi").addEventListener("click", chiudiCalc);
  $("#calcAiuto").addEventListener("click", function () {
    D.msg("Questa calcolatrice calcola anche espressioni. Le operazioni eseguibili sono: (+) (-) (*) (/) " +
      "ABS, ARCTAN, COS, EXP, LN, SIN, SQR, and SQRT. PI ritorna il valore di pi.\n\n" +
      "Tutto ciò grazie al codice Pascal scritto da: James L. Dean, New Orleans, February 25, 1985", "Calcolatrice");
  });
  // drag the calculator by its title bar
  (function () {
    var bar = $("#calcTitolo"), d = null;
    bar.addEventListener("pointerdown", function (e) {
      if (e.target.closest("button")) return;
      d = { id: e.pointerId, dx: e.clientX - calc.offsetLeft, dy: e.clientY - calc.offsetTop };
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener("pointermove", function (e) {
      if (!d || e.pointerId !== d.id) return;
      var x = Math.max(0, Math.min(window.innerWidth - calc.offsetWidth, e.clientX - d.dx));
      var y = Math.max(0, Math.min(window.innerHeight - 30, e.clientY - d.dy));
      calc.style.left = x + "px"; calc.style.top = y + "px";
    });
    function stop() { d = null; }
    bar.addEventListener("pointerup", stop);
    bar.addEventListener("pointercancel", stop);
  })();

  /* ---------------- start ---------------- */
  if (window.ResizeObserver) new ResizeObserver(ridimensiona).observe(cv);
  window.addEventListener("resize", ridimensiona);
  ridimensiona();
  window.Talete = { valuta: valuta };  // exposed for testing
})();
