/*
 * Didattica - libreria comune / shared runtime
 * Remake dei programmi didattici del Prof. Carmelo Muscolino.
 *
 * Provides: DOM helpers, modal dialogs (msg/conferma/input), QuickBASIC
 * PLAY / SOUND / BEEP emulation via WebAudio, the "st" box-drawing score
 * digits used by the DOS programs, the scrolling author marquee, QuickBASIC
 * number formatting (STR$) and the reward-game overlay.
 */
(function () {
  "use strict";

  var D = {};
  window.D = D;

  // Base URL of the site (folder that contains /js/common.js)
  var script = document.currentScript;
  D.base = script ? script.src.replace(/js\/common\.js(\?.*)?$/, "") : "../../";

  /* ---------------- DOM ---------------- */
  D.$ = function (sel, root) { return (root || document).querySelector(sel); };
  D.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  D.el = function (tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k === "html") e.innerHTML = v;
      else if (k.slice(0, 2) === "on" && typeof v === "function") e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? "" : v);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  };

  /* ---------------- storage (never throws) ---------------- */
  D.store = {
    get: function (k, def) {
      try { var v = localStorage.getItem("didattica." + k); return v == null ? def : JSON.parse(v); }
      catch (e) { return def; }
    },
    set: function (k, v) {
      try { localStorage.setItem("didattica." + k, JSON.stringify(v)); } catch (e) { /* ignore */ }
    }
  };

  /* ---------------- random, QuickBASIC helpers ---------------- */
  // INT((sup - inf + 1) * RND + inf)
  D.rand = function (inf, sup) { return Math.floor((sup - inf + 1) * Math.random() + inf); };
  // RND*n -> INT(RND * n)
  D.rnd = function (n) { return Math.floor(Math.random() * n); };
  // LTRIM$(STR$(n)) with QuickBASIC single precision style (".5" for 0.5)
  D.qstr = function (n) {
    var s = String(parseFloat(Number(n).toPrecision(7)));
    if (s.indexOf("e") >= 0) s = String(Number(n));
    s = s.replace(/^(-?)0\./, "$1.");
    return s;
  };
  // INT(x*m)/m robust against float noise
  D.tronca = function (x, m) { return Math.floor(x * m + 1e-9) / m; };

  /* ---------------- sound ---------------- */
  var ctx = null;
  function audio() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  D.suono = {
    attivo: D.store.get("suono", true),
    imposta: function (v) { this.attivo = !!v; D.store.set("suono", this.attivo); }
  };
  var tail = 0; // time when queued sound ends
  function tone(freq, dur, when, vol) {
    var a = audio(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = "square"; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.05, when);
    g.gain.setValueAtTime(0, when + Math.max(dur - 0.004, 0.002));
    o.connect(g); g.connect(a.destination);
    o.start(when); o.stop(when + dur);
  }
  function startTime() {
    var a = audio(); if (!a) return 0;
    var t = Math.max(a.currentTime + 0.01, tail);
    return t;
  }
  // SOUND freq, ticks (1 tick = 1/18.2 s)
  D.sound = function (freq, ticks, forza) {
    if (!D.suono.attivo && !forza) return;
    var a = audio(); if (!a) return;
    var t = startTime(), d = ticks / 18.2;
    if (freq >= 37 && freq <= 20000) tone(freq, d, t);
    tail = t + d;
  };
  D.beep = function () { D.sound(800, 4); };
  D.attendiSuono = function () {
    var a = ctx; if (!a) return Promise.resolve();
    var ms = Math.max(0, (tail - a.currentTime) * 1000);
    return new Promise(function (r) { setTimeout(r, ms); });
  };
  // QuickBASIC PLAY macro language (subset: T L O < > A-G # + - . N P M*)
  D.play = function (mml, forza) {
    if (!D.suono.attivo && !forza) return;
    var a = audio(); if (!a) return;
    var s = mml.toUpperCase().replace(/\s+/g, ""), i = 0;
    var tempo = 120, len = 4, oct = 4, style = 7 / 8, t = startTime();
    var semis = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    function num() { var m = /^\d+/.exec(s.slice(i)); if (!m) return null; i += m[0].length; return parseInt(m[0], 10); }
    function dots() { var k = 0; while (s[i] === ".") { k++; i++; } return k; }
    function dur(l, d) { var x = (60 / tempo) * (4 / l); var add = x; for (var j = 0; j < d; j++) { add /= 2; x += add; } return x; }
    function note(n, l, d) {
      var full = dur(l, d);
      if (n > 0) tone(440 * Math.pow(2, (n - 46) / 12), full * style, t);
      t += full;
    }
    while (i < s.length) {
      var c = s[i++];
      if (c === "T") { tempo = num() || 120; }
      else if (c === "L") { len = num() || 4; }
      else if (c === "O") { oct = num(); if (oct == null) oct = 4; }
      else if (c === "<") { oct = Math.max(0, oct - 1); }
      else if (c === ">") { oct = Math.min(6, oct + 1); }
      else if (c === "M") { var m = s[i++]; if (m === "L") style = 1; else if (m === "N") style = 7 / 8; else if (m === "S") style = 3 / 4; }
      else if (c === "P") { var pl = num() || len; t += dur(pl, dots()); }
      else if (c === "N") { var nn = num() || 0; note(nn, len, dots()); }
      else if (semis[c] !== undefined) {
        var sm = semis[c];
        if (s[i] === "#" || s[i] === "+") { sm++; i++; } else if (s[i] === "-") { sm--; i++; }
        var l = num() || len;
        note(oct * 12 + sm + 1, l, dots());
      }
    }
    tail = t;
  };
  D.ALLARME = "MBT255L16O6CO4GEDCBT255L16O6CO4GEDCBT255L16O6CO4GEDC"; // suonoallarme
  D.suonoOk = function () { D.sound(1000, 2); D.sound(500, 2); D.sound(800, 2); };

  /* ---------------- "st" box-drawing digits ---------------- */
  var GLYPH = {
    "0": ["╔═╗", "║ ║", "╚═╝"], "1": [" ╗ ", " ║ ", " ╩ "], "2": ["╔═╗", "╔═╝", "╚══"],
    "3": [" ═╗", " ═╣", " ═╝"], "4": ["╔ ╔", "╚═╣", "  ╩"], "5": ["╔══", "╚═╗", "══╝"],
    "6": ["╔══", "╠═╗", "╚═╝"], "7": ["╔═╗", "  ║", "  ╩"], "8": ["╔═╗", "╠═╣", "╚═╝"],
    "9": ["╔═╗", "╚═╣", "══╝"], " ": ["   ", "   ", "   "], "+": ["   ", "─┼─", "   "],
    "-": ["   ", "───", "   "], ":": [" . ", " . ", "   "], "A": ["╔═╗", "╠═╣", "ð ð"]
  };
  // Returns the three text lines for a number, right aligned to `width` glyphs
  D.lcd = function (n, width) {
    var str = typeof n === "number" ? (n < 0 ? "-" : " ") + Math.abs(n) : String(n);
    width = width || 5;
    while (str.length < width) str = " " + str;
    var rows = ["", "", ""];
    for (var k = 0; k < str.length; k++) {
      var g = GLYPH[str[k]] || GLYPH[" "];
      for (var r = 0; r < 3; r++) rows[r] += g[r] + " ";
    }
    return rows.join("\n");
  };

  /* ---------------- author marquee ---------------- */
  D.FIRMA = "Soft prof. C. Muscolino - Palmanova ";
  D.SCUOLA = "SCUOLA MEDIA GONARS (UD)";
  // Toggle a box with the author's signature scrolling in it (ETPD_CLICK / Timer2)
  D.marquee = function (host) {
    var box = D.$(".marquee", host);
    if (box) { clearInterval(box._t); box.remove(); return; }
    box = D.el("div", { class: "marquee", title: "Premi un tasto o clicca per chiudere" });
    box.style.top = (10 + D.rnd(50)) + "%";
    box.style.left = (5 + D.rnd(35)) + "%";
    var a = D.FIRMA;
    box._t = setInterval(function () { a = a.slice(1) + a[0]; box.textContent = (a + a).slice(0, 38); }, 150);
    box.textContent = a;
    function chiudi() { clearInterval(box._t); box.remove(); document.removeEventListener("keydown", chiudi, true); }
    box.addEventListener("click", chiudi);
    document.addEventListener("keydown", chiudi, true);
    (host || document.body).appendChild(box);
  };

  /* ---------------- dialogs ---------------- */
  var aperti = [];
  D.dialogoAperto = function () { return aperti.length > 0; };
  function dialogo(opts) {
    return new Promise(function (resolve) {
      var prevFocus = document.activeElement;
      var ov = D.el("div", { class: "dlg-overlay" });
      var box = D.el("div", { class: "dlg " + (opts.stile || ""), role: "dialog", "aria-modal": "true" });
      var titolo = D.el("div", { class: "dlg-title", text: opts.titolo || "" });
      var corpo = D.el("div", { class: "dlg-body" });
      if (opts.testo) corpo.appendChild(D.el("div", { class: "dlg-text", text: opts.testo }));
      if (opts.nodo) corpo.appendChild(opts.nodo);
      var inp = null;
      if (opts.input !== undefined) {
        inp = D.el("input", { class: "dlg-input", type: "text", value: opts.input, autocomplete: "off" });
        corpo.appendChild(inp);
      }
      var barra = D.el("div", { class: "dlg-buttons" });
      function fine(v) {
        document.removeEventListener("keydown", onKey, true);
        ov.remove();
        aperti.pop();
        if (prevFocus && prevFocus.focus && document.contains(prevFocus)) { try { prevFocus.focus(); } catch (e) { /* */ } }
        resolve(v);
      }
      var primo = null;
      opts.pulsanti.forEach(function (p, idx) {
        var b = D.el("button", { class: "btn", type: "button", text: p.testo });
        b.addEventListener("click", function () { fine(inp && p.valore !== null && p.valore !== false ? inp.value : p.valore); });
        barra.appendChild(b);
        if (idx === 0) primo = b;
      });
      function onKey(e) {
        if (aperti[aperti.length - 1] !== box) return;
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fine(opts.annulla); }
        else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); (document.activeElement && document.activeElement.parentNode === barra ? document.activeElement : primo).click(); }
        else if (e.key === "Tab") {
          var f = D.$$("input,button", box), k = f.indexOf(document.activeElement);
          e.preventDefault();
          f[(k + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
        }
        e.stopPropagation();
      }
      document.addEventListener("keydown", onKey, true);
      box.appendChild(titolo); box.appendChild(corpo); box.appendChild(barra);
      ov.appendChild(box);
      document.body.appendChild(ov);
      aperti.push(box);
      setTimeout(function () { (inp || primo).focus(); if (inp) inp.select(); }, 0);
    });
  }
  D.msg = function (testo, titolo, stile) {
    return dialogo({ testo: testo, titolo: titolo || "", stile: stile, pulsanti: [{ testo: "OK", valore: true }], annulla: true });
  };
  D.conferma = function (testo, titolo, conAnnulla) {
    var p = [{ testo: "Sì", valore: true }, { testo: "No", valore: false }];
    if (conAnnulla) p.push({ testo: "Annulla", valore: null });
    return dialogo({ testo: testo, titolo: titolo || "INFORMAZIONE:", pulsanti: p, annulla: conAnnulla ? null : false });
  };
  D.input = function (testo, predef, titolo) {
    return dialogo({ testo: testo, titolo: titolo || "", input: predef || "", pulsanti: [{ testo: "OK", valore: true }, { testo: "Annulla", valore: null }], annulla: null });
  };
  D.dialogo = dialogo;

  /* ---------------- reward game overlay ---------------- */
  // tipo: "duello"/"gorillas" (intermediate levels) or "puzzle" (last level)
  D.gioco = function (tipo, secondi) {
    // His DOS programs rewarded pupils with his build of Gorillas: when the
    // site is served over http(s) it runs in the js-dos emulator, otherwise
    // (file://, where WebAssembly cannot load) the new Duello is used.
    if (tipo === "duello" && /^https?:$/.test(location.protocol)) tipo = "gorillas";
    return new Promise(function (resolve) {
      var ov = D.el("div", { class: "game-overlay" });
      var fr = D.el("iframe", {
        class: "game-frame", title: "Gioco",
        src: D.base + "programmi/giochi/" + tipo + ".html?sec=" + Math.max(0, Math.round(secondi)) + "&embed=1"
      });
      ov.appendChild(fr);
      document.body.appendChild(ov);
      function onMsg(e) {
        if (!e.data || e.data.didattica !== "fine-gioco") return;
        window.removeEventListener("message", onMsg);
        ov.remove();
        resolve(e.data.secondiRimasti || 0);
      }
      window.addEventListener("message", onMsg);
      setTimeout(function () { try { fr.focus(); } catch (e) { /* */ } }, 50);
    });
  };
  // Called by the game pages when they finish
  D.fineGioco = function (secondiRimasti) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ didattica: "fine-gioco", secondiRimasti: secondiRimasti || 0 }, "*");
    } else {
      location.href = D.base + "index.html";
    }
  };
  D.param = function (nome, def) {
    var m = new RegExp("[?&]" + nome + "=([^&]*)").exec(location.search);
    return m ? decodeURIComponent(m[1]) : def;
  };

  /* ---------------- files ---------------- */
  D.scarica = function (nome, contenuto, tipo) {
    var blob = contenuto instanceof Blob ? contenuto : new Blob([contenuto], { type: tipo || "text/plain;charset=utf-8" });
    var a = D.el("a", { href: URL.createObjectURL(blob), download: nome });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  D.leggiFile = function (file, comeBytes) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = reject;
      if (comeBytes === "dataurl") r.readAsDataURL(file);
      else if (comeBytes) r.readAsArrayBuffer(file);
      else r.readAsText(file);
    });
  };
  // Decode bytes from the old DOS (cp850) / Windows (cp1252) code pages
  var CP850 = "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ ";
  var CP1252 = "€�‚ƒ„…†‡ˆ‰Š‹Œ�Ž��‘’“”•–—˜™š›œ�žŸ";
  D.decodifica = function (bytes, codepage) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) {
      var c = bytes[i];
      if (c < 128) s += String.fromCharCode(c);
      else if (codepage === "cp850") s += CP850[c - 128];
      else if (c < 160) s += CP1252[c - 128];
      else s += String.fromCharCode(c);
    }
    return s;
  };
  // Split a byte array on CR LF (or LF)
  D.righeBytes = function (bytes) {
    var out = [], start = 0;
    for (var i = 0; i < bytes.length; i++) {
      if (bytes[i] === 10) {
        var end = i > start && bytes[i - 1] === 13 ? i - 1 : i;
        out.push(bytes.subarray(start, end)); start = i + 1;
      }
    }
    out.push(bytes.subarray(start, bytes.length));
    return out;
  };

  D.escapeHtml = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  };
})();
