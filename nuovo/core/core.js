/*
 * Impara giocando – libreria condivisa (globale N).
 * Nuova versione mobile dei programmi del Prof. Carmelo Muscolino.
 *
 * Provides: DOM helpers, pupil profiles (name, avatar, class), stars and
 * records, unlocks, synthesized sounds, the owl mascot, header, feedback
 * banner, dialogs, on-screen numeric keypad, end-of-round results with
 * stars and confetti. No dependencies; works offline.
 */
(function () {
  "use strict";
  var N = {};
  window.N = N;
  var script = document.currentScript;
  N.base = script ? script.src.replace(/core\/core\.js(\?.*)?$/, "") : "../";   // .../nuovo/

  /* ---------------- DOM ---------------- */
  N.$ = function (s, r) { return (r || document).querySelector(s); };
  N.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  N.el = function (tag, attrs, figli) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k === "html") e.innerHTML = v;
      else if (k.slice(0, 2) === "on" && typeof v === "function") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    });
    (figli || []).forEach(function (f) { if (f != null) e.appendChild(typeof f === "string" ? document.createTextNode(f) : f); });
    return e;
  };
  N.parametro = function (nome, def) {
    var m = new RegExp("[?&]" + nome + "=([^&#]*)").exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : def;
  };
  N.rand = function (a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; };
  N.scegli = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  N.mescola = function (a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  N.numero = function (x) { return String(x).replace(".", ","); };          // Italian decimal comma

  /* ---------------- storage ---------------- */
  function leggi(k, def) { try { var v = localStorage.getItem("impara." + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } }
  function scrivi(k, v) { try { localStorage.setItem("impara." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  N.leggi = leggi; N.scrivi = scrivi;

  /* ---------------- classes & profiles ---------------- */
  N.CLASSI = ["3ª primaria", "4ª primaria", "5ª primaria", "1ª media", "2ª media", "3ª media"];
  N.AVATAR = ["🦊", "🐼", "🐸", "🐯", "🐨", "🦁", "🐰", "🐙", "🦄", "🐧", "🐢", "🐝", "🦉", "🐬", "🐞", "🦖"];
  // difficulty 1..5 suggested for a class index 0..5
  N.difficolta = function (classe) { return [1, 1, 2, 3, 4, 5][classe == null ? 3 : classe]; };

  N.profili = function () { return leggi("profili", []); };
  N.profilo = function () {
    var id = leggi("attuale", null), l = N.profili();
    return l.filter(function (p) { return p.id === id; })[0] || null;
  };
  N.salvaProfilo = function (p) {
    var l = N.profili().filter(function (x) { return x.id !== p.id; });
    l.push(p); scrivi("profili", l); scrivi("attuale", p.id);
  };
  N.nuovoProfilo = function (nome, avatar, classe) {
    var p = { id: "p" + Date.now().toString(36), nome: nome, avatar: avatar, classe: classe, stelle: 0, record: {}, creato: Date.now() };
    N.salvaProfilo(p);
    return p;
  };
  N.eliminaProfilo = function (id) {
    scrivi("profili", N.profili().filter(function (x) { return x.id !== id; }));
    if (leggi("attuale") === id) scrivi("attuale", null);
  };
  N.usaProfilo = function (id) { scrivi("attuale", id); };
  // a guest profile is used when nobody has signed in (stars are not kept)
  N.profiloOspite = function () { return N.profilo() || { id: null, nome: "Ospite", avatar: "🦉", classe: 3, stelle: 0, record: {} }; };
  N.classe = function () { return N.profiloOspite().classe; };
  N.stelle = function () { return N.profiloOspite().stelle || 0; };

  // Record a round: adds the stars won and keeps the best result per activity
  N.registra = function (attivita, stelle, extra) {
    var p = N.profilo();
    if (!p) return null;
    p.stelle = (p.stelle || 0) + stelle;
    var r = p.record[attivita] || { migliore: 0, volte: 0 };
    r.migliore = Math.max(r.migliore, stelle); r.volte++; r.ultima = Date.now();
    if (extra) Object.keys(extra).forEach(function (k) { r[k] = extra[k]; });
    p.record[attivita] = r;
    N.salvaProfilo(p);
    N.aggiornaTestata();
    return p;
  };
  N.migliore = function (attivita) { var r = N.profiloOspite().record[attivita]; return r ? r.migliore : 0; };
  // Mini-games are unlocked by the total number of stars ("prima si lavora, poi si gioca")
  N.sbloccato = function (soglia) { return N.stelle() >= (soglia || 0); };
  // Mini-games cost play time: N.tempoGioco() seconds earned since last game
  N.tempoGioco = function () { return Math.min(300, 60 + Math.floor(N.stelle() / 3) * 10); };

  /* ---------------- sounds (synthesized, no files) ---------------- */
  var ctx = null;
  N.suonoAttivo = function () { return leggi("suono", true); };
  N.impostaSuono = function (v) { scrivi("suono", !!v); };
  function audio() {
    if (!N.suonoAttivo()) return null;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function nota(f, t, d, tipo, vol) {
    var a = audio(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + t;
    o.type = tipo || "triangle"; o.frequency.setValueAtTime(f, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.18, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + d + 0.02);
  }
  N.suono = {
    tocco: function () { nota(660, 0, 0.06, "sine", 0.08); },
    ok: function () { nota(660, 0, 0.12); nota(880, 0.09, 0.18); },
    ko: function () { nota(220, 0, 0.18, "sawtooth", 0.07); nota(185, 0.12, 0.22, "sawtooth", 0.06); },
    stella: function () { [988, 1319, 1568, 1976].forEach(function (f, i) { nota(f, i * 0.07, 0.25, "sine", 0.12); }); },
    vittoria: function () { [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { nota(f, i * 0.11, i === 5 ? 0.5 : 0.16, "square", 0.07); }); },
    livello: function () { [392, 523, 659, 784].forEach(function (f, i) { nota(f, i * 0.09, 0.2, "triangle", 0.14); }); }
  };
  N.vibra = function (ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* */ } };

  /* ---------------- owl mascot (a nod to the hint owl of his EM) ---------------- */
  N.gufo = function (umore, classe) {
    var occhi = umore === "felice"
      ? '<path d="M26 43 q6 -7 12 0" stroke="#2d2240" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M58 43 q6 -7 12 0" stroke="#2d2240" stroke-width="4" fill="none" stroke-linecap="round"/>'
      : umore === "pensa"
        ? '<circle cx="34" cy="42" r="7" fill="#2d2240"/><circle cx="64" cy="40" r="7" fill="#2d2240"/><circle cx="36" cy="40" r="2.5" fill="#fff"/><circle cx="66" cy="38" r="2.5" fill="#fff"/>'
        : '<circle cx="32" cy="42" r="7" fill="#2d2240"/><circle cx="64" cy="42" r="7" fill="#2d2240"/><circle cx="34" cy="40" r="2.5" fill="#fff"/><circle cx="66" cy="40" r="2.5" fill="#fff"/>';
    return '<svg class="gufo ' + (umore || "") + ' ' + (classe || "") + '" viewBox="0 0 96 96" role="img" aria-label="Gufetto">' +
      '<path d="M18 22 L28 6 L36 22 Z M60 22 L68 6 L78 22 Z" fill="#8b5a2b"/>' +
      '<ellipse cx="48" cy="56" rx="34" ry="36" fill="#a8703a"/>' +
      '<ellipse cx="48" cy="66" rx="20" ry="22" fill="#f3d6b0"/>' +
      '<path d="M40 72 q8 4 16 0 M38 80 q10 5 20 0" stroke="#d9b48f" stroke-width="3" fill="none"/>' +
      '<circle cx="32" cy="42" r="15" fill="#fff"/><circle cx="64" cy="42" r="15" fill="#fff"/>' + occhi +
      '<path d="M44 52 L48 60 L52 52 Z" fill="#ffb21a"/>' +
      '<path d="M12 60 q-4 14 10 22 M84 60 q4 14 -10 22" stroke="#8b5a2b" stroke-width="6" fill="none" stroke-linecap="round"/>' +
      '<path d="M36 92 l4 -6 M44 92 l2 -6 M60 92 l-4 -6 M52 92 l-2 -6" stroke="#ffb21a" stroke-width="4" stroke-linecap="round"/>' +
      '</svg>';
  };
  N.gufoDice = function (testo, umore) {
    return N.el("div", { class: "gufo-box" }, [N.el("div", { html: N.gufo(umore) }).firstChild, N.el("div", { class: "fumetto", text: testo })]);
  };

  /* ---------------- header ---------------- */
  // N.testata({ titolo, indietro: url|function, tema: "t-mat" })
  N.testata = function (o) {
    o = o || {};
    if (o.tema) document.body.classList.add(o.tema);
    var p = N.profilo();
    var back = typeof o.indietro === "function"
      ? N.el("button", { class: "indietro", type: "button", "aria-label": "Indietro", text: "←", onclick: o.indietro })
      : N.el("a", { class: "indietro", href: o.indietro || N.base + "index.html", "aria-label": "Indietro", text: "←" });
    var h = N.el("header", { class: "testata" }, [
      back,
      N.el("h1", { text: o.titolo || "Impara giocando" }),
      N.el("a", { class: "contastelle", href: N.base + "index.html#profilo", "aria-label": "Le mie stelle" }, [
        N.el("span", { class: "ico", text: "⭐" }), N.el("span", { class: "n-stelle", text: String(N.stelle()) })
      ]),
      p ? N.el("a", { class: "avatar-mini", href: N.base + "index.html#profilo", title: p.nome, text: p.avatar }) : null
    ]);
    document.body.insertBefore(h, document.body.firstChild);
    return h;
  };
  N.aggiornaTestata = function () { N.$$(".n-stelle").forEach(function (e) { e.textContent = String(N.stelle()); }); };

  /* ---------------- feedback banner ---------------- */
  var bannerT = null;
  N.esito = function (tipo, testo, ms) {
    var b = N.$("#esito");
    if (!b) { b = N.el("div", { id: "esito", class: "esito", role: "status", "aria-live": "polite" }); document.body.appendChild(b); }
    var ico = { si: N.scegli(["🎉", "⭐", "👏", "😃", "🚀"]), no: "🤔", info: "💡" }[tipo] || "";
    b.className = "esito " + tipo;
    b.innerHTML = "";
    b.appendChild(N.el("span", { class: "ico", text: ico }));
    b.appendChild(N.el("span", { text: testo }));
    requestAnimationFrame(function () { b.classList.add("visibile"); });
    clearTimeout(bannerT);
    bannerT = setTimeout(function () { b.classList.remove("visibile"); }, ms || 1400);
  };
  N.LODI = ["Bravo!", "Esatto!", "Perfetto!", "Che centro!", "Sei forte!", "Benissimo!", "Super!", "Fantastico!"];   // echoing his "B R A V O", "CHE CENTRO !!"...
  N.INCORAGGIA = ["Riprova!", "Quasi!", "Pensaci ancora", "Non mollare!", "Ci sei quasi"];
  N.giusto = function (testo) { N.suono.ok(); N.vibra(15); N.esito("si", testo || N.scegli(N.LODI)); };
  N.sbagliato = function (testo) { N.suono.ko(); N.vibra([30, 40, 30]); N.esito("no", testo || N.scegli(N.INCORAGGIA)); };

  /* ---------------- dialogs ---------------- */
  // N.dialogo({ titolo, testo, nodo, pulsanti: [{testo, valore, secondario}], chiudibile })
  N.dialogo = function (o) {
    return new Promise(function (fine) {
      var prima = document.activeElement;
      var velo = N.el("div", { class: "velo" });
      var f = N.el("div", { class: "finestra", role: "dialog", "aria-modal": "true", "aria-label": o.titolo || "" });
      if (o.titolo) f.appendChild(N.el("h2", { text: o.titolo }));
      if (o.testo) f.appendChild(N.el("p", { text: o.testo, style: "white-space:pre-wrap" }));
      if (o.nodo) f.appendChild(o.nodo);
      var riga = N.el("div", { class: "riga centro", style: "margin-top:16px" });
      function chiudi(v) { document.removeEventListener("keydown", tasti, true); velo.remove(); if (prima && prima.focus) prima.focus(); fine(v); }
      (o.pulsanti || [{ testo: "OK", valore: true }]).forEach(function (p) {
        riga.appendChild(N.el("button", { class: "btn" + (p.secondario ? " secondario" : ""), type: "button", text: p.testo, onclick: function () { chiudi(p.valore); } }));
      });
      if (riga.children.length) f.appendChild(riga);
      function tasti(e) { if (e.key === "Escape" && o.chiudibile !== false) { e.preventDefault(); chiudi(null); } }
      document.addEventListener("keydown", tasti, true);
      if (o.chiudibile !== false) velo.addEventListener("click", function (e) { if (e.target === velo) chiudi(null); });
      velo.appendChild(f); document.body.appendChild(velo);
      var b = N.$("button, input, select, textarea", f); if (b) setTimeout(function () { b.focus(); }, 30);
      o._chiudi = chiudi;
    });
  };

  /* ---------------- on-screen numeric keypad ---------------- */
  // N.tastierino(host, { onTasto(k), virgola: true, meno: false, extra: ["x","/"] })
  // k is a digit, ",", "-", "canc" or "ok". Also listens to the physical keyboard.
  N.tastierino = function (host, o) {
    o = o || {};
    var tasti = ["1", "2", "3", "4", "5", "6", "7", "8", "9", o.virgola ? "," : (o.meno ? "-" : ""), "0", "canc"];
    if (o.extra) tasti = tasti.concat(o.extra);
    tasti.push("ok");
    var g = N.el("div", { class: "tastierino", role: "group", "aria-label": "Tastierino" });
    tasti.forEach(function (k) {
      if (k === "") { g.appendChild(N.el("span")); return; }
      var b = N.el("button", {
        type: "button", class: k === "ok" ? "ok" : k === "canc" ? "canc" : "", "data-k": k,
        "aria-label": k === "canc" ? "Cancella" : k === "ok" ? "Conferma" : k,
        text: k === "canc" ? "⌫" : k === "ok" ? "OK ✓" : k
      });
      if (k === "ok") b.style.gridColumn = "1 / -1";
      b.addEventListener("click", function () { N.suono.tocco(); o.onTasto(k); });
      g.appendChild(b);
    });
    host.appendChild(g);
    function fisica(e) {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (N.$(".velo")) return;
      var k = e.key;
      if (/^[0-9]$/.test(k)) o.onTasto(k);
      else if ((k === "," || k === ".") && o.virgola) o.onTasto(",");
      else if (k === "-" && (o.meno || (o.extra || []).indexOf("-") >= 0)) o.onTasto("-");
      else if (o.extra && o.extra.indexOf(k) >= 0) o.onTasto(k);
      else if (k === "Backspace") o.onTasto("canc");
      else if (k === "Enter") o.onTasto("ok");
      else return;
      e.preventDefault();
    }
    document.addEventListener("keydown", fisica);
    return { elemento: g, rimuovi: function () { document.removeEventListener("keydown", fisica); g.remove(); } };
  };

  /* ---------------- confetti ---------------- */
  N.coriandoli = function () {
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var c = N.el("canvas", { id: "coriandoli" }); document.body.appendChild(c);
    var x = c.getContext("2d"), W = c.width = innerWidth, H = c.height = innerHeight;
    var col = ["#ff7a2f", "#8a4dff", "#19a974", "#2f86ff", "#ff4f8b", "#ffc21a"], pezzi = [];
    for (var i = 0; i < 140; i++) pezzi.push({ x: W / 2 + (Math.random() - .5) * 80, y: H * .35, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4, r: Math.random() * 6 + 4, c: N.scegli(col), a: Math.random() * 6, va: (Math.random() - .5) * .3 });
    var t0 = performance.now();
    (function passo(t) {
      x.clearRect(0, 0, W, H);
      pezzi.forEach(function (p) { p.x += p.vx; p.y += p.vy; p.vy += .35; p.vx *= .99; p.a += p.va; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); x.restore(); });
      if (t - t0 < 2600) requestAnimationFrame(passo); else c.remove();
    })(t0);
  };

  /* ---------------- end of round ---------------- */
  // N.fineRound({ attivita, corrette, totali, titolo, onAncora, onEsci, messaggio })
  // Stars: >= 90% -> 3, >= 70% -> 2, >= 40% -> 1. Returns the stars.
  N.stelleDa = function (corrette, totali) { var p = totali ? corrette / totali : 0; return p >= .9 ? 3 : p >= .7 ? 2 : p >= .4 ? 1 : 0; };
  N.fineRound = function (o) {
    var s = o.stelle != null ? o.stelle : N.stelleDa(o.corrette, o.totali);
    var prima = N.migliore(o.attivita);
    var p = N.registra(o.attivita, s);
    var frasi = ["Proviamo ancora: ce la farai!", "Buon inizio! Continua così.", "Molto bene!", "Perfetto! Sei un campione!"];
    var nodo = N.el("div", { class: "risultato" }, [
      N.el("div", { html: N.gufo(s >= 2 ? "felice" : "pensa") }).firstChild,
      N.el("div", { class: "stelle-grandi", "aria-label": s + " stelle su 3" }, [0, 1, 2].map(function (i) { return N.el("span", { class: i < s ? "accesa" : "", text: "⭐" }); })),
      N.el("p", { style: "font-size:22px;font-weight:800;margin:6px 0", text: o.messaggio || frasi[s] }),
      o.totali != null ? N.el("p", { text: o.corrette + " risposte giuste su " + o.totali }) : null,
      s > prima && prima > 0 ? N.el("p", { style: "font-weight:800;color:var(--ok)", text: "Nuovo record! 🏅" }) : null,
      p ? N.el("p", { class: "consegna", text: "Hai " + p.stelle + " stelle in tutto." }) :
        N.el("p", { class: "consegna", text: "Crea il tuo profilo nella pagina principale per raccogliere le stelle." })
    ]);
    if (s >= 2) { N.suono.vittoria(); N.coriandoli(); } else if (s === 1) N.suono.stella();
    return N.dialogo({
      titolo: o.titolo || "Fine del giro", nodo: nodo, chiudibile: false,
      pulsanti: [{ testo: "Gioca ancora", valore: "ancora" }, { testo: "Esci", valore: "esci", secondario: true }]
    }).then(function (v) {
      if (v === "ancora" && o.onAncora) o.onAncora();
      else if (o.onEsci) o.onEsci(); else location.href = N.base + "index.html";
      return s;
    });
  };

  /* ---------------- PWA ---------------- */
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", function () { navigator.serviceWorker.register(N.base + "sw.js").catch(function () { /* offline cache is optional */ }); });
  }
})();
