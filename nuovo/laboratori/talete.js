/*
 * Le ombre di Talete – versione per bambini (touch) del «Laboratorio di
 * matematica» (MAT.EXE) del Prof. Carmelo Muscolino. La geometria è quella del
 * remake fedele in programmi/talete/talete.js: il raggio di sole tocca terra in
 * P = (466, 242), 20 px = 1 cm, tre soli; i triangoli sono simili: a/b = c/d.
 */
(function () {
  "use strict";
  var $ = N.$, fmt = LAB.fmt;

  N.testata({ titolo: "Le ombre di Talete", indietro: "index.html", tema: "t-lab" });

  /* ---------------- scene (his coordinates) ---------------- */
  var TOP = 16, W = 514, H = 318 + TOP, SUOLO = 242, PX = 466, SCALA = 20;
  var XMIN = 46, XMAX = PX - 40, LARGO = 8;
  var SOLI = [{ x: 18, y: 18 }, { x: 14, y: 60 }, { x: 16, y: 118 }];
  var NOMI_SOLI = [["☀️", "Alto"], ["🌤️", "Medio"], ["🌅", "Basso"]];

  var st = { sole: 0, legni: [{ x: 130 }, { x: 330 }], attivo: 0, drag: null, nascondiC: false, bloccati: false };

  function tanRaggio() { var s = SOLI[st.sole]; return (SUOLO - s.y) / (PX - s.x); }
  function yRaggio(x) { return SUOLO - (PX - x) * tanRaggio(); }
  function snap(x) { x = Math.max(XMIN, Math.min(XMAX, x)); return PX - Math.round((PX - x) / 2) * 2; }  // 0,1 cm steps
  function misure() {
    var t = tanRaggio(), r = function (v) { return Math.round(v * 10) / 10; };
    var b = (PX - st.legni[0].x) / SCALA, d = (PX - st.legni[1].x) / SCALA;
    return { a: r(b * t), b: r(b), c: r(d * t), d: r(d) };
  }
  function xDaCm(cm) { return PX - cm * SCALA; }

  var cv = $("#cv"), ctx = cv.getContext("2d"), k = 1, dpr = 1;
  function ridimensiona() {
    var w = cv.parentNode.clientWidth;
    k = w / W; dpr = window.devicePixelRatio || 1;
    cv.style.height = Math.round(H * k) + "px";
    cv.width = Math.round(w * dpr); cv.height = Math.round(H * k * dpr);
    disegna();
  }
  function px(n) { return n / k; }                       // CSS px -> world units
  function font(sz, bold) { return (bold ? "800 " : "700 ") + px(Math.max(sz * 0.8, Math.min(sz * k, sz * 1.15))) + "px system-ui, sans-serif"; }
  function alone(t, x, y) {
    ctx.save(); ctx.lineJoin = "round"; ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = px(5);
    ctx.strokeText(t, x, y); ctx.fillText(t, x, y); ctx.restore();
  }

  function disegnaSole(s, scelto) {
    var r = Math.max(11, px(scelto ? 13 : 10));
    ctx.save();
    if (scelto) {
      ctx.strokeStyle = "#ff9d00"; ctx.lineWidth = px(2.5); ctx.lineCap = "round";
      for (var i = 0; i < 12; i++) {
        var a = i * Math.PI / 6;
        ctx.beginPath(); ctx.moveTo(s.x + Math.cos(a) * (r + px(3)), s.y + Math.sin(a) * (r + px(3)));
        ctx.lineTo(s.x + Math.cos(a) * (r + px(9)), s.y + Math.sin(a) * (r + px(9))); ctx.stroke();
      }
    }
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fillStyle = scelto ? "#ffd21a" : "rgba(255,236,140,.75)"; ctx.fill();
    ctx.lineWidth = px(1.5); ctx.strokeStyle = scelto ? "#c46a00" : "#c9b04a"; ctx.stroke();
    ctx.restore();
  }

  function disegnaLegno(i, nome, val) {
    var x = st.legni[i].x, x0 = x - LARGO;
    function sagoma() { ctx.beginPath(); ctx.moveTo(x0, SUOLO); ctx.lineTo(x0, yRaggio(x0)); ctx.lineTo(x, yRaggio(x)); ctx.lineTo(x, SUOLO); ctx.closePath(); }
    ctx.save();
    sagoma(); ctx.fillStyle = "#ffd6d6"; ctx.fill();
    ctx.save(); ctx.clip(); ctx.strokeStyle = "#e5484d"; ctx.lineWidth = 1;
    for (var h = yRaggio(x0) - LARGO - 6; h < SUOLO + LARGO; h += 5) { ctx.beginPath(); ctx.moveTo(x0, h + LARGO); ctx.lineTo(x, h); ctx.stroke(); }
    ctx.restore();
    sagoma(); ctx.strokeStyle = "#d81e24"; ctx.lineWidth = Math.max(1.5, px(2)); ctx.stroke();
    // letter + length to the left of the stick
    var ym = Math.min(SUOLO - px(26), (SUOLO + yRaggio(x)) / 2);
    ctx.fillStyle = "#b3141a"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.font = font(22, true); alone(nome, x0 - px(5), ym - px(10));
    ctx.fillStyle = "#2d2240"; ctx.font = font(15);
    alone(nome === "c" && st.nascondiC ? "? cm" : fmt(val, 1) + " cm", x0 - px(5), ym + px(9));
    // big yellow handle at the foot
    var on = st.drag && st.drag.i === i, hx = x - LARGO / 2, r = px(on ? 19 : 16);
    ctx.beginPath(); ctx.arc(hx, SUOLO, r, 0, Math.PI * 2);
    ctx.fillStyle = st.bloccati ? "#d8d2c6" : "#ffd21a"; ctx.fill();
    ctx.lineWidth = px(2.5); ctx.strokeStyle = on ? "#d81e24" : "#8a5b00"; ctx.stroke();
    ctx.fillStyle = "#2d2240"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "800 " + px(16) + "px system-ui, sans-serif";
    ctx.fillText(st.bloccati ? "🔒" : "↔", hx, SUOLO + px(1));
    ctx.restore();
  }

  function quota(x0, y, nome, val) {
    ctx.save();
    ctx.strokeStyle = "#2d2240"; ctx.lineWidth = px(1.5);
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(PX, y);
    ctx.moveTo(x0, y - 5); ctx.lineTo(x0, y + 5); ctx.moveTo(PX, y - 5); ctx.lineTo(PX, y + 5); ctx.stroke();
    ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x0, SUOLO + 4); ctx.lineTo(x0, y); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#2d2240"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.font = font(15, true);
    alone(nome + " = " + fmt(val, 1) + " cm", Math.max(x0 + px(40), (x0 + PX) / 2), y - 1);
  }

  function disegna() {
    var m = misure();
    ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.translate(0, TOP);
    // sky and sand
    var g = ctx.createLinearGradient(0, 0, 0, SUOLO); g.addColorStop(0, "#bfe6ff"); g.addColorStop(1, "#effaff");
    ctx.fillStyle = g; ctx.fillRect(0, -TOP, W, SUOLO + TOP);
    ctx.fillStyle = "#ffe7b3"; ctx.fillRect(0, SUOLO, W, H - SUOLO);
    ctx.strokeStyle = "#8a5b00"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, SUOLO); ctx.lineTo(W, SUOLO); ctx.stroke();

    // shadows b and d (the shorter one on top)
    var L = st.legni, ordine = L[0].x < L[1].x ? [0, 1] : [1, 0];
    ordine.forEach(function (i, n) { ctx.fillStyle = n === 0 ? "rgba(45,34,64,.55)" : "#2d2240"; ctx.fillRect(L[i].x, SUOLO - 1, PX - L[i].x, n === 0 ? 7 : 4); });

    // ray
    var s = SOLI[st.sole];
    ctx.strokeStyle = "#ffb000"; ctx.lineWidth = px(5); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(PX, SUOLO); ctx.stroke();
    ctx.strokeStyle = "#8a5b00"; ctx.lineWidth = px(1);
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(PX, SUOLO); ctx.stroke();
    SOLI.forEach(function (so, i) { disegnaSole(so, i === st.sole); });

    quota(L[0].x, 284, "b", m.b);
    quota(L[1].x, 312, "d", m.d);
    var ord = st.attivo === 0 ? [1, 0] : [0, 1];
    ord.forEach(function (i) { disegnaLegno(i, i === 0 ? "a" : "c", i === 0 ? m.a : m.c); });
    ctx.fillStyle = "#2d2240"; ctx.font = font(13, true); ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("P", PX + 6, SUOLO + 4);
    aggiornaValori(m);
  }

  /* ---------------- readouts ---------------- */
  function aggiornaValori(m) {
    ["a", "b", "c", "d"].forEach(function (l) { $("#m" + l).textContent = l === "c" && st.nascondiC ? "?" : fmt(m[l], 1) + " cm"; });
    aggiornaRapporti(m);
  }

  /* ---------------- interaction ---------------- */
  function mondo(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k - TOP }; }
  function trovaSole(p) {
    for (var i = 0; i < SOLI.length; i++) if (Math.hypot(p.x - SOLI[i].x, p.y - SOLI[i].y) <= Math.max(26, px(26))) return i;
    return -1;
  }
  function trovaLegno(p) {
    var best = -1, dist = Infinity, raggio = Math.max(18, px(34));
    st.legni.forEach(function (l, i) {
      var cx = l.x - LARGO / 2, dx = Math.abs(p.x - cx);
      if (p.y < yRaggio(l.x) - px(20) || dx > raggio) return;
      if (dx < dist) { dist = dx; best = i; }
    });
    return best;
  }
  function scegliLegno(i) {
    st.attivo = i;
    $("#selA").setAttribute("aria-pressed", i === 0 ? "true" : "false"); $("#selA").classList.toggle("secondario", i !== 0);
    $("#selC").setAttribute("aria-pressed", i === 1 ? "true" : "false"); $("#selC").classList.toggle("secondario", i !== 1);
  }
  cv.addEventListener("pointerdown", function (e) {
    var p = mondo(e), s = trovaSole(p);
    if (s >= 0) { e.preventDefault(); cambiaSole(s); return; }
    var i = trovaLegno(p);
    if (i < 0) return;
    e.preventDefault();
    if (st.bloccati) { N.esito("info", "In questa missione i bastoni stanno fermi 🔒"); return; }
    st.drag = { i: i, id: e.pointerId, off: p.x - st.legni[i].x };
    scegliLegno(i);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* */ }
    $("#dito").hidden = true;
    disegna();
  });
  cv.addEventListener("pointermove", function (e) {
    if (!st.drag || e.pointerId !== st.drag.id) return;
    var nx = snap(mondo(e).x - st.drag.off);
    if (nx !== st.legni[st.drag.i].x) { st.legni[st.drag.i].x = nx; disegna(); }
  });
  function fine(e) {
    if (!st.drag || e.pointerId !== st.drag.id) return;
    st.drag = null; disegna(); dopoMossa();
  }
  cv.addEventListener("pointerup", fine);
  cv.addEventListener("pointercancel", fine);
  cv.addEventListener("keydown", function (e) {
    if (e.key >= "1" && e.key <= "3") cambiaSole(+e.key - 1);
    else if (e.key === "a" || e.key === "A") scegliLegno(0);
    else if (e.key === "c" || e.key === "C") scegliLegno(1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") muovi(e.key === "ArrowLeft" ? -1 : 1, e.shiftKey ? 10 : 1);
    else return;
    e.preventDefault(); disegna();
  });
  function muovi(dir, passi) {
    if (st.bloccati) { N.esito("info", "In questa missione i bastoni stanno fermi 🔒"); return; }
    var l = st.legni[st.attivo], nx = snap(l.x + dir * 2 * (passi || 1));
    if (nx !== l.x) { l.x = nx; disegna(); dopoMossa(); }
  }
  function ripeti(btn, dir) {
    var t1 = 0, t2 = 0;
    function stop() { clearTimeout(t1); clearInterval(t2); }
    btn.addEventListener("pointerdown", function (e) {
      e.preventDefault(); N.suono.tocco(); muovi(dir);
      t1 = setTimeout(function () { t2 = setInterval(function () { muovi(dir); }, 70); }, 400);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { btn.addEventListener(ev, stop); });
    btn.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); muovi(dir); } });
  }
  ripeti($("#sx"), -1); ripeti($("#dx"), 1);
  $("#selA").addEventListener("click", function () { N.suono.tocco(); scegliLegno(0); disegna(); });
  $("#selC").addEventListener("click", function () { N.suono.tocco(); scegliLegno(1); disegna(); });

  NOMI_SOLI.forEach(function (s, i) {
    $("#soli").appendChild(N.el("button", {
      type: "button", class: "chip", "aria-pressed": i === st.sole ? "true" : "false", "aria-label": "Sole " + s[1].toLowerCase(),
      onclick: function () { N.suono.tocco(); cambiaSole(i); }
    }, [N.el("span", { class: "e", text: s[0] }), N.el("span", { class: "n", text: "Sole " + (i + 1) }), N.el("span", { class: "d", text: s[1] })]));
  });
  function cambiaSole(i) {
    if (st.bloccati && i !== st.sole) { N.esito("info", "In questa missione il sole sta fermo 🔒"); return; }
    st.sole = i;
    N.$$("#soli .chip").forEach(function (b, j) { b.setAttribute("aria-pressed", j === i ? "true" : "false"); });
    disegna();
  }

  /* ---------------- "Scopri la regola" ---------------- */
  var regolaAperta = false, festeggiato = false;
  function uguali(m) { return Math.abs(m.a / m.b - m.c / m.d) <= 0.03; }
  function mostraRegola() {
    var h = $("#regolaCorpo"); h.innerHTML = "";
    h.appendChild(N.gufoDice(regolaAperta
      ? "Dividi ogni bastone per la sua ombra. Guarda i due risultati mentre sposti i bastoni!"
      : "Il bastone a fa l'ombra b, il bastone c fa l'ombra d. C'è una regola segreta che li lega!", regolaAperta ? "felice" : "pensa"));
    if (!regolaAperta) {
      h.appendChild(N.el("button", { type: "button", class: "btn blocco", style: "margin-top:10px", text: "🔍 Mostra i rapporti", onclick: function () { N.suono.tocco(); regolaAperta = true; mostraRegola(); } }));
      return;
    }
    h.appendChild(N.el("div", { class: "rapporti" }, [
      N.el("div", { class: "frazione" }, [N.el("span", { class: "f" }, [N.el("span", { text: "a" }), N.el("span", { text: "b" })]), N.el("span", { class: "r", id: "rAB" })]),
      N.el("div", { class: "segno", id: "segno", "aria-live": "polite" }),
      N.el("div", { class: "frazione" }, [N.el("span", { class: "f" }, [N.el("span", { text: "c" }), N.el("span", { text: "d" })]), N.el("span", { class: "r", id: "rCD" })])
    ]));
    h.appendChild(N.el("p", { class: "dettagli", id: "notaRapporti" }));
    h.appendChild(N.el("p", { style: "font-weight:700;margin:8px 0 0", text: "Prova a spostare i bastoni e a cambiare sole: i due rapporti restano uguali! Allora a : b = c : d." }));
    aggiornaRapporti(misure());
  }
  function aggiornaRapporti(m) {
    if (!regolaAperta || !$("#rAB")) return;
    var nasc = st.nascondiC;
    $("#rAB").textContent = "= " + fmt(m.a / m.b, 2);
    $("#rCD").textContent = nasc ? "= ?" : "= " + fmt(m.c / m.d, 2);
    var eq = uguali(m);
    $("#segno").textContent = nasc ? "?" : eq ? "=" : "≠";
    $("#segno").className = "segno" + (eq && !nasc ? " uguale" : "");
    $("#notaRapporti").textContent = nasc ? "" : eq ? (fmt(m.a / m.b, 2) === fmt(m.c / m.d, 2) ? "Sono uguali! 🎉" :
      "Sono uguali (la piccola differenza viene dalle misure arrotondate).") : "";
    if (eq && !nasc && !festeggiato) {
      festeggiato = true; N.giusto("Uguali! È la regola di Talete!"); N.coriandoli();
    }
  }

  /* ---------------- missions ---------------- */
  var MISSIONI = [
    { id: "doppio", emoji: "✌️", titolo: "Rendi l'ombra d lunga il doppio dell'ombra b" },
    { id: "altezza", emoji: "📏", titolo: "Trova l'altezza del bastone c senza misurarla" },
    { id: "piramide", emoji: "🔺", titolo: "Come Talete con la piramide" },
    { id: "soli", emoji: "☀️", titolo: "Cambia sole: la regola vale ancora?" }
  ];
  function tid(i) { return "lab:talete:" + MISSIONI[i].id; }
  var attiva = 0, chiusa = false, errori = 0, domanda = null, soliOk = {}, prob = null;
  for (var i0 = 0; i0 < MISSIONI.length; i0++) if (!LAB.fatta(tid(i0))) { attiva = i0; break; }
  var param = +N.parametro("missione", 0); if (param >= 1 && param <= MISSIONI.length) attiva = param - 1;

  function scegliMissione(i) {
    attiva = i; chiusa = false; errori = 0;
    preparaMissione(); mostraMissione(); LAB.aggiorna();
    $("#missione").scrollIntoView({ behavior: LAB.ridotto() ? "auto" : "smooth", block: "start" });
  }
  LAB.lista($("#lista"), "talete", MISSIONI, function () { return attiva; }, scegliMissione);

  function preparaMissione() {
    var m = MISSIONI[attiva].id;
    st.nascondiC = false; st.bloccati = false;
    if (m === "altezza") {
      // nice numbers for the younger ones (sun 1: a = b : 2), any sun from 1ª media
      var grande = N.classe() >= 3;
      var sole = grande ? N.rand(0, 2) : 0, b = grande ? N.rand(3, 8) : N.scegli([4, 6, 8]), d = grande ? N.rand(10, 20) : N.scegli([10, 12, 14, 16, 18]);
      st.sole = sole; st.legni[0].x = xDaCm(b); st.legni[1].x = xDaCm(d);
      N.$$("#soli .chip").forEach(function (bt, j) { bt.setAttribute("aria-pressed", j === sole ? "true" : "false"); });
      st.nascondiC = true; st.bloccati = true;
      prob = misure();
    }
    if (m === "soli") soliOk = {};
    disegna();
  }

  function mostraMissione() {
    var box = $("#missione"), m = MISSIONI[attiva], fatta = LAB.fatta(tid(attiva));
    if (domanda) { domanda.rimuovi(); domanda = null; }
    box.innerHTML = ""; box.className = "missione-box" + (fatta ? " fatta" : "");
    box.appendChild(N.el("div", { class: "num", text: "Missione " + (attiva + 1) + " di " + MISSIONI.length + (fatta ? " · fatta ✓ " + LAB.stelline(LAB.stelleDi(tid(attiva))) : "") }));
    box.appendChild(N.el("h2", { text: m.emoji + " " + m.titolo }));
    function p(t, cls) { box.appendChild(N.el("p", { class: cls || "aiuto", text: t })); }
    if (m.id === "doppio") {
      var mm = misure();
      p("Trascina le maniglie gialle (o usa ◀ ▶). Ora b = " + fmt(mm.b) + " cm e d = " + fmt(mm.d) + " cm." +
        (mm.b * 2 > 21 ? " L'ombra b è troppo lunga: prima sposta il bastone a verso destra!" : " d deve diventare " + fmt(mm.b * 2) + " cm."));
    } else if (m.id === "altezza") {
      p("Il bastone c è nascosto! Conosci a = " + fmt(prob.a) + " cm, b = " + fmt(prob.b) + " cm e d = " + fmt(prob.d) + " cm. Quanto è alto c?", "");
      p("Aiuto: b sta ad a come d sta a c. Quante volte d è più lunga di b?");
      box.appendChild(N.el("button", { type: "button", class: "btn piccolo secondario", text: "💡 Un aiutino", onclick: function () {
        N.dialogo({ titolo: "Un aiutino", testo: "La regola di Talete: a : b = c : d\n\nAllora  c = a × d : b\n\nc = " + fmt(prob.a) + " × " + fmt(prob.d) + " : " + fmt(prob.b) });
      } }));
      domanda = LAB.domanda(box, { unita: "cm", verifica: rispostaAltezza });
    } else if (m.id === "piramide") {
      mostraStoria(box);
    } else if (m.id === "soli") {
      p("Per ogni sole premi «Controlla»: i rapporti a/b e c/d sono ancora uguali? Prova tutti e 3 i soli!");
      box.appendChild(N.el("p", { class: "soli-check", "aria-label": "Soli controllati: " + Object.keys(soliOk).length + " su 3",
        text: [0, 1, 2].map(function (i) { return (soliOk[i] ? "✅" : "⬜") + NOMI_SOLI[i][0]; }).join("  ") }));
      box.appendChild(N.el("button", { type: "button", class: "btn", text: "✔️ Controlla con questo sole", onclick: controllaSole }));
    }
    if (fatta && !chiusa && attiva + 1 < MISSIONI.length) {
      box.appendChild(N.el("button", { type: "button", class: "btn piccolo", style: "margin-top:8px", text: "Prossima missione ➜", onclick: function () { scegliMissione(attiva + 1); } }));
    }
  }

  function mostraStoria(box) {
    var svg = '<svg viewBox="0 0 340 170" role="img" aria-label="La piramide, il bastone di Talete e le loro ombre">' +
      '<circle cx="40" cy="20" r="16" fill="#ffd21a" stroke="#c46a00" stroke-width="2"/>' +
      '<rect x="0" y="138" width="340" height="32" fill="#f1cf86"/>' +
      '<polygon points="40,138 120,40 200,138" fill="#e7b25c" stroke="#8a5b00" stroke-width="2"/>' +
      '<line x1="120" y1="40" x2="120" y2="138" stroke="#b3141a" stroke-width="2" stroke-dasharray="5 4"/>' +
      '<line x1="60" y1="0" x2="268" y2="138" stroke="#ffb000" stroke-width="3"/>' +
      '<rect x="120" y="136" width="148" height="5" fill="#2d2240"/>' +
      '<line x1="294" y1="114" x2="294" y2="138" stroke="#b3141a" stroke-width="5" stroke-linecap="round"/>' +
      '<line x1="258" y1="90" x2="330" y2="138" stroke="#ffb000" stroke-width="2" stroke-dasharray="4 3"/>' +
      '<rect x="294" y="136" width="36" height="5" fill="#2d2240"/>' +
      '<text x="128" y="96" font-size="15" font-weight="800" fill="#b3141a">?</text>' +
      '<text x="194" y="160" font-size="13" font-weight="800" text-anchor="middle" fill="#2d2240">219 m</text>' +
      '<text x="284" y="112" font-size="13" font-weight="800" text-anchor="end" fill="#b3141a">2 m</text>' +
      '<text x="312" y="160" font-size="13" font-weight="800" text-anchor="middle" fill="#2d2240">3 m</text>' +
      '<text x="294" y="104" font-size="18" text-anchor="middle">🧔</text></svg>';
    box.appendChild(N.el("div", { class: "storia", html: svg }));
    box.appendChild(N.el("p", { text: "Tanto tempo fa (circa 600 anni prima di Cristo) il saggio greco Talete andò in Egitto. " +
      "Tutti si chiedevano: «Quanto è alta la grande piramide?». Nessuno poteva salire a misurarla!" }));
    box.appendChild(N.el("p", { text: "Talete piantò un bastone nella sabbia e guardò le ombre. Il sole fa ombre con la stessa regola: " +
      "altezza del bastone : ombra del bastone = altezza della piramide : ombra della piramide." }));
    box.appendChild(N.el("p", { style: "font-weight:800", text: "Il bastone è alto 2 m e la sua ombra è lunga 3 m. L'ombra della piramide (misurata dal centro della base) è lunga 219 m. Quanto è alta la piramide?" }));
    domanda = LAB.domanda(box, { unita: "m", verifica: rispostaPiramide });
  }

  function vinci(stelle, testo) {
    var i = attiva;
    chiusa = true;
    LAB.completa(tid(i), stelle, testo).then(function () {
      var dopo = -1;
      for (var j = 1; j <= MISSIONI.length; j++) { var q = (i + j) % MISSIONI.length; if (!LAB.fatta(tid(q))) { dopo = q; break; } }
      if (dopo >= 0) scegliMissione(dopo);
      else { chiusa = false; st.nascondiC = false; st.bloccati = false; disegna(); mostraMissione(); N.esito("si", "Hai fatto tutte le missioni! 🏆", 2500); }
    });
  }
  function stelleErrori() { return errori === 0 ? 3 : errori === 1 ? 2 : 1; }

  function dopoMossa() {
    if (chiusa) return;
    var m = MISSIONI[attiva].id, mm = misure();
    if (m === "doppio") {
      if (Math.abs(mm.d - 2 * mm.b) <= 0.1 + 1e-9) vinci(3, "d = " + fmt(mm.d) + " cm è il doppio di b = " + fmt(mm.b) + " cm. E guarda: anche c è il doppio di a!");
      else mostraMissione();
    }
  }
  function rispostaAltezza(v) {
    var giusto = prob.a * prob.d / prob.b;
    if (Math.abs(v - giusto) <= 0.2 || Math.abs(v - prob.c) <= 0.11) {
      st.nascondiC = false; st.bloccati = false; disegna();
      vinci(stelleErrori(), "Proprio così: c = " + fmt(prob.c) + " cm, e non l'hai nemmeno misurato!");
      return true;
    }
    errori++;
    N.sbagliato(errori >= 2 ? "Prova: " + fmt(prob.a) + " × " + fmt(prob.d) + " : " + fmt(prob.b) : "Quasi! Usa la regola a : b = c : d");
    return false;
  }
  function rispostaPiramide(v) {
    if (Math.abs(v - 146) < 0.01) { vinci(stelleErrori(), "146 metri! Proprio come la piramide di Cheope. Sei bravo come Talete!"); return true; }
    errori++;
    N.sbagliato(errori >= 2 ? "Fai 2 × 219 : 3" : "Riprova! L'ombra della piramide è quante volte quella del bastone?");
    return false;
  }
  function controllaSole() {
    var mm = misure();
    if (!regolaAperta) { regolaAperta = true; mostraRegola(); }
    if (uguali(mm)) {
      if (!soliOk[st.sole]) N.giusto("Sole " + (st.sole + 1) + ": a/b = " + fmt(mm.a / mm.b, 2) + " e c/d = " + fmt(mm.c / mm.d, 2) + ". Uguali!");
      soliOk[st.sole] = true;
    }
    if (Object.keys(soliOk).length === 3) vinci(3, "Con ogni sole la regola vale: a : b = c : d. Il sole cambia, la regola no!");
    else {
      mostraMissione();
      if (Object.keys(soliOk).length) setTimeout(function () { N.esito("info", "Ora tocca un altro sole!"); }, 1500);
    }
  }

  /* ---------------- start ---------------- */
  preparaMissione(); mostraMissione(); mostraRegola();
  if (window.ResizeObserver) new ResizeObserver(function () { ridimensiona(); }).observe(cv.parentNode);
  window.addEventListener("resize", ridimensiona);
  ridimensiona();
  window.Talete = { st: st, misure: misure };   // for tests
})();
