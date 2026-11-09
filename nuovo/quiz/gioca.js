/*
 * Impara giocando – quiz player.
 *   gioca.html?set=EG:VERBI&livello=2   one of his sets (E.G. or EM)
 *   gioca.html?mio=<quizId>             a teacher quiz saved on this device
 *   gioca.html#q=<data>                 a teacher quiz from a share link
 * Test switches: &test=1 (no delays), &tutte=1 (every question of the level).
 */
(function () {
  "use strict";
  var el = N.el;
  var TEST = N.parametro("test") === "1", TUTTE = N.parametro("tutte") === "1";
  var PAUSA = TEST ? 0 : 1;
  var app = N.$("#app");
  var fonte = null, livIdx = 0, S = null, tast = null, schermo = "carico", presentate = {};
  var player = new Audio();
  var indietro = "index.html";

  var CONSEGNE = {
    scelta: "Scegli la risposta giusta.", vf: "È vero o falso?", scrivi: "Scrivi la risposta.",
    seleziona: "Tocca sulla lavagna la parola giusta.", tocca: "Tocca il punto giusto del disegno."
  };

  /* ======================= start ======================= */
  function avvia() {
    var hash = /^#q=(.+)$/.exec(location.hash);
    if (hash) {
      return QZ.leggiLink(hash[1]).then(function (q) {
        QZ.salvaRicevuto(q);
        pronto(QZ.fonteMaestra(q));
      }).catch(function (e) { errore("Non riesco ad aprire questo quiz.", e && e.message); });
    }
    var mio = N.parametro("mio"), set = N.parametro("set");
    if (mio) {
      var q = QZ.trovaMaestra(mio);
      return q ? pronto(QZ.fonteMaestra(q)) : errore("Non trovo questo quiz.", "Forse è stato cancellato da questo dispositivo.");
    }
    var f = set ? QZ.fonteSet(set) : null;
    if (!f) return errore("Non trovo questi esercizi.", set ? "Esercitazione: " + set : "Scegli un quiz dall'elenco.");
    pronto(f);
  }
  function testata(titolo, materia) {
    var m = (window.QUIZ_MATERIE[materia] || window.QUIZ_MATERIE.altro);
    indietro = "index.html" + (materia && materia !== "altro" ? "?materia=" + materia : "");
    N.testata({ titolo: titolo, indietro: indietro, tema: m.tema });
    document.title = titolo + " – Impara giocando";
  }
  function errore(titolo, dettaglio) {
    schermo = "errore";
    testata("Quiz", null);
    app.innerHTML = "";
    app.appendChild(el("div", { class: "errore-box" }, [
      N.gufoDice(titolo + (dettaglio ? "\n" + dettaglio : ""), "pensa"),
      el("p", { class: "riga centro" }, [el("a", { class: "btn", href: indietro, text: "Torna ai quiz" })])
    ]));
  }
  function pronto(f) {
    fonte = f;
    testata(f.titolo, f.materia);
    var n = f.livelli.length, voluto = parseInt(N.parametro("livello", ""), 10);
    var salvato = N.leggi("quiz.livello." + f.id, null);
    var l = voluto >= 1 && voluto <= n ? voluto : (salvato >= 1 && salvato <= n ? salvato : QZ.livelloPerClasse(f, N.classe()));
    livIdx = l - 1;
    schermoInizio();
  }

  /* ======================= start screen ======================= */
  function stelline(n) { return "⭐".repeat(n) + "☆".repeat(3 - n); }
  function schermoInizio() {
    schermo = "inizio";
    chiudiTastierino(); player.pause();
    var liv = fonte.livelli[livIdx];
    app.innerHTML = "";
    var sotto = fonte.maestra ? (fonte.quiz.domande.length + " domande" + (fonte.autore ? " · di " + fonte.autore : "")) : (fonte.sotto || "");
    app.appendChild(el("div", { class: "intro" }, [
      el("span", { class: "emoji", "aria-hidden": "true", text: fonte.emoji }),
      el("div", null, [el("h2", { text: fonte.titolo }), sotto ? el("p", { text: sotto }) : null])
    ]));
    if (fonte.livelli.length > 1) {
      app.appendChild(el("h2", { class: "sezione", text: "Scegli il livello" }));
      var g = el("div", { class: "livelli", role: "group", "aria-label": "Livello" });
      fonte.livelli.forEach(function (lv, k) {
        var s = N.migliore(fonte.attivita(lv.n));
        g.appendChild(el("button", {
          type: "button", class: "livello", "aria-pressed": k === livIdx ? "true" : "false",
          "aria-label": "Livello " + lv.n + (s ? ", " + s + " stelle" : ""),
          onclick: function () { N.suono.tocco(); livIdx = k; N.scrivi("quiz.livello." + fonte.id, lv.n); schermoInizio(); var b = N.$$(".livello")[k]; if (b) b.focus(); }
        }, [document.createTextNode(String(lv.n)), el("small", { "aria-hidden": "true", text: stelline(s) })]));
      });
      app.appendChild(g);
    }
    // the level's presentation (his '0 "lezione" / EM presentazione), with the owl
    var pres = liv.presentazione, testo = pres.testo;
    if (!testo) testo = fonte.maestra ? "Pronto? Ti aspettano " + fonte.quiz.domande.length + " domande. Forza!" : "Pronto? Ti aspettano 10 domande. Forza!";
    var box = el("div", { class: "presentazione" }, [N.gufoDice(testo, "felice")]);
    if (pres.audio.length) box.appendChild(el("button", { type: "button", class: "btn secondario piccolo", text: "🔊 Ascolta", onclick: function () { suona(pres.audio[0]); } }));
    app.appendChild(box);
    presentate[livIdx] = true;
    app.appendChild(el("button", { type: "button", id: "via", class: "btn blocco", text: "Inizia ▶", onclick: function () { N.suono.livello(); nuovoRound(); } }));
  }

  /* ======================= round ======================= */
  function nuovoRound() {
    var liv = fonte.livelli[livIdx], gruppi = QZ.round(liv, TUTTE || fonte.tutte), passi = [];
    gruppi.forEach(function (g) { g.forEach(function (p, k) { passi.push({ p: p, primo: k === 0 }); }); });
    S = { liv: liv, passi: passi, i: 0, corrette: 0, acc: "" };
    schermo = "gioco";
    app.innerHTML = "";
    var barra = el("div", { class: "barra-gioco" });
    if (fonte.livelli.length > 1) {
      barra.appendChild(el("button", {
        type: "button", class: "chip-livello", text: "Livello " + liv.n, "aria-label": "Livello " + liv.n + ": cambia livello",
        onclick: function () {
          N.dialogo({ titolo: "Cambi livello?", testo: "Questo giro non verrà contato.", pulsanti: [{ testo: "Sì, cambia", valore: true }, { testo: "Continua a giocare", valore: false, secondario: true }] })
            .then(function (v) { if (v) schermoInizio(); });
        }
      }));
    }
    barra.appendChild(el("div", { class: "avanzamento", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(passi.length) }, [el("div", { style: "width:0%" })]));
    app.appendChild(barra);
    app.appendChild(el("div", { class: "punteggio-riga" }, [el("span", { id: "contatore" }), el("span", { id: "punti" })]));
    app.appendChild(el("div", { id: "passo" }));
    mostraPasso();
  }

  function aggiornaBarra() {
    var tot = S.passi.length;
    N.$(".avanzamento > div").style.width = (S.i / tot * 100) + "%";
    N.$(".avanzamento").setAttribute("aria-valuenow", String(S.i));
    N.$("#contatore").textContent = "Domanda " + (S.i + 1) + " di " + tot;
    N.$("#punti").textContent = "✅ " + S.corrette;
  }

  /* ---------------- board text ---------------- */
  var SEGNI = /(\u0001[^\u0002]*\u0002)|(\.{3,}|_{2,})|\^(\d+|\([^)]*\)|[a-z])/g;
  function scriviTesto(host, t, conAttuale) {
    var i = 0, m, primo = conAttuale;
    SEGNI.lastIndex = 0;
    while ((m = SEGNI.exec(t))) {
      if (m.index > i) host.appendChild(document.createTextNode(t.slice(i, m.index)));
      if (m[1]) host.appendChild(el("span", { class: "riempito", text: m[1].slice(1, -1) }));
      else if (m[2]) {
        var b = el("span", { class: "buco" + (primo ? " attuale" : ""), "aria-label": "spazio da completare", text: m[2] });
        b.style.minWidth = Math.max(2.2, Math.min(6, m[2].length * 0.35)) + "em";
        host.appendChild(b); primo = false;
      } else host.appendChild(el("sup", { text: m[3] }));
      i = m.index + m[0].length;
    }
    if (i < t.length) host.appendChild(document.createTextNode(t.slice(i)));
    // "6 * 7" is shown as "6 × 7" (only on screen: the child still types "*")
    if (/[\d)\]]\s*\*\s*[\d(\[]/.test(t.replace(/\^(\d+|\([^)]*\))/g, "$1"))) N.$$("*", host).concat([host]).forEach(function (n) {
      Array.prototype.forEach.call(n.childNodes, function (c) { if (c.nodeType === 3) c.textContent = c.textContent.replace(/\*/g, "×"); });
    });
  }
  function testoLavagna(p) {
    if (!p.cumula) return p.testo;
    return QZ.riflow(EMC.senzaMedia(S.acc));
  }
  function disegnaTesto() {
    var p = S.p, host = N.$("#lav-testo"), t = testoLavagna(p);
    host.innerHTML = "";
    if (p.tipo === "seleziona") {
      t.replace(/\u0001|\u0002/g, "").split(/(\s+)/).forEach(function (w) {
        if (!w.trim()) { host.appendChild(document.createTextNode(w)); return; }
        host.appendChild(el("button", { type: "button", class: "parola", text: w, onclick: function () { selezionaParola(this, w); } }));
      });
      return;
    }
    scriviTesto(host, t, !S.risolto && (p.tipo === "scrivi" || p.tipo === "scelta"));
  }

  /* ---------------- one step ---------------- */
  function mostraPasso() {
    chiudiTastierino(); player.pause();
    var st = S.passi[S.i], p = st.p;
    S.p = p; S.tent = 0; S.risolto = false; S.suggVisto = false; S.buf = "";
    if (p.cumula) { if (st.primo) S.acc = ""; S.acc += p.testo; }
    aggiornaBarra();
    var host = N.$("#passo");
    host.innerHTML = "";
    var t = testoLavagna(p);
    var grande = t.length <= 24 && t.indexOf("\n") < 0 && p.tipo !== "seleziona" && !p.immagini.length;
    var lav = el("div", { class: "lavagna" + (grande ? " grande" : ""), id: "lavagna" }, [el("div", { id: "lav-testo" })]);
    host.appendChild(lav);
    disegnaTesto();
    if (p.immagini.length) {
      var media = el("div", { class: "media" });
      p.immagini.forEach(function (u, k) {
        if (p.tipo === "tocca" && k === 0) media.appendChild(immagineTocca(u, p));
        else media.appendChild(el("img", { src: u, alt: "Immagine della domanda", style: "max-height:50vh" }));
      });
      lav.appendChild(media);
    }
    if (p.audio.length) {
      lav.appendChild(el("button", { type: "button", class: "btn secondario piccolo ascolta", text: "🔊 Ascolta", onclick: function () { suona(p.audio[0]); } }));
      if (!TEST) suona(p.audio[0]);
    }
    host.appendChild(el("p", { class: "consegna", id: "consegna", text: p.consegna || CONSEGNE[p.tipo] }));
    var w = el("div", { id: "widget" });
    host.appendChild(w);
    if (p.tipo === "scelta") widgetScelta(w, p);
    else if (p.tipo === "vf") widgetVF(w, p);
    else if (p.tipo === "scrivi") widgetScrivi(w, p);
    host.appendChild(el("div", { id: "extra", "aria-live": "polite" }));
    host.appendChild(el("div", { class: "aiuto-riga" }, [
      el("span"),
      el("button", { type: "button", class: "btn secondario piccolo", id: "aiuto", text: "🦉 Aiuto", "aria-label": "Aiuto del gufo", onclick: aiuto })
    ]));
    if (!TEST && S.i > 0) window.scrollTo({ top: 0, behavior: "smooth" });
    var f = N.$("input", w);
    if (f) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); } }, 60);
  }

  /* ---------------- widgets ---------------- */
  function widgetScelta(w, p) {
    var voci = p.ordine === "mescola" ? N.mescola(p.voci) : p.voci;
    var g = el("div", { class: "scelte", role: "group", "aria-label": "Risposte" });
    voci.forEach(function (v) {
      g.appendChild(el("button", {
        type: "button", class: "scelta", text: v, onclick: function () {
          if (S.risolto) return;
          if (v === p.giusta) { this.classList.add("giusta"); giusto(v); }
          else { this.classList.remove("sbagliata"); void this.offsetWidth; this.classList.add("sbagliata"); this.disabled = true; sbagliato(); }
        }
      }));
    });
    w.appendChild(g);
  }
  function widgetVF(w, p) {
    var g = el("div", { class: "scelte vf", role: "group", "aria-label": "Vero o falso" });
    [[true, "👍 Vero"], [false, "👎 Falso"]].forEach(function (x) {
      g.appendChild(el("button", {
        type: "button", class: "scelta", "data-v": String(x[0]), text: x[1], onclick: function () {
          if (S.risolto) return;
          if (x[0] === p.giusta) { this.classList.add("giusta"); giusto(null); }
          else { this.classList.add("sbagliata"); this.disabled = true; sbagliato(); }
        }
      }));
    });
    w.appendChild(g);
  }
  function widgetScrivi(w, p) {
    var tasti = QZ.tastiPer(p.risposte);
    if (tasti) {
      var vis = el("div", { class: "risposta vuota", id: "display", role: "status", "aria-live": "polite", "aria-label": "La tua risposta" });
      w.appendChild(vis);
      var ops = el("div", { class: "tasti-op" });
      w.appendChild(ops);
      tast = N.tastierino(w, {
        virgola: tasti.virgola, meno: tasti.meno, extra: tasti.extra.length ? tasti.extra : null,
        onTasto: function (k) {
          if (S.risolto) return;
          if (k === "ok") { if (S.buf.trim()) verificaTesto(S.buf); return; }
          if (k === "canc") S.buf = S.buf.slice(0, -1);
          else if (S.buf.length < 40) S.buf += k;
          mostraBuf();
        }
      });
      // operator keys go in their own row above the digits
      tasti.extra.forEach(function (k) {
        var b = N.$('button[data-k="' + (k === '"' ? '\\"' : k) + '"]', tast.elemento);
        if (!b) return;
        if (k === " ") { b.textContent = "spazio"; b.setAttribute("aria-label", "Spazio"); }
        if (k === "*") { b.textContent = "×"; b.setAttribute("aria-label", "per"); }
        ops.appendChild(b);
      });
      if (!ops.children.length) ops.remove();
      return;
    }
    var campo = el("input", {
      class: "campo", type: "text", inputmode: "text", autocomplete: "off", autocapitalize: "none", autocorrect: "off",
      spellcheck: "false", enterkeyhint: "done", "aria-label": "La tua risposta", placeholder: "Scrivi qui…", maxlength: "120"
    });
    campo.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); if (campo.value.trim()) verificaTesto(campo.value); } });
    w.appendChild(el("div", { class: "campo-riga" }, [campo, el("button", {
      type: "button", class: "btn", text: "OK ✓", "aria-label": "Controlla",
      onclick: function () { if (campo.value.trim()) verificaTesto(campo.value); else campo.focus(); }
    })]));
  }
  function mostraBuf() {
    var d = N.$("#display");
    if (!d) return;
    d.innerHTML = "";
    d.classList.toggle("vuota", !S.buf);
    scriviTesto(d, S.buf.replace(/ /g, " "), false);
  }
  function verificaTesto(v) {
    if (S.risolto) return;
    var m = QZ.confronta(v, S.p.risposte);
    if (m != null) {
      var c = N.$("#widget .campo"); if (c) { c.value = v.trim(); c.readOnly = true; c.style.borderColor = "var(--ok)"; }
      return giusto(m);
    }
    sbagliato();
    var campo = N.$("#widget .campo");
    if (campo && !S.risolto) { campo.select(); }
  }
  function selezionaParola(b, w) {
    if (S.risolto) return;
    var pulita = w.replace(/^[^0-9A-Za-zÀ-ÿ]+|[^0-9A-Za-zÀ-ÿ]+$/g, "");
    var m = QZ.confronta(w, S.p.risposte);
    if (m == null && pulita) m = QZ.confronta(pulita, S.p.risposte);
    if (m != null) { b.classList.add("giusta"); return giusto(null); }
    b.classList.add("sbagliata");
    setTimeout(function () { b.classList.remove("sbagliata"); }, 900);
    sbagliato();
  }

  /* ---------------- tap on the picture (EM "clicca", teacher "tocca") ---------------- */
  function immagineTocca(url, p) {
    var img = el("img", { src: url, alt: "Disegno: tocca il punto giusto", draggable: "false" });
    var box = el("div", { class: "tocca-box", id: "tocca" }, [img]);
    function misura() {
      var W = img.naturalWidth, H = img.naturalHeight;
      if (!W || !box.isConnected) return;
      var dispo = box.parentNode.clientWidth || 320, maxH = Math.max(220, window.innerHeight * 0.55);
      var s = Math.min(dispo / W, maxH / H, 3);
      box.style.width = Math.floor(W * s) + "px";
    }
    function pronta() {
      var W = img.naturalWidth, H = img.naturalHeight;
      p.zone.forEach(function (z, i) {
        var d = el("div", { class: "zona", "data-i": String(i), "aria-hidden": "true" });
        d.style.left = (z[0] / W * 100) + "%"; d.style.top = (z[1] / H * 100) + "%";
        d.style.width = (z[2] / W * 100) + "%"; d.style.height = (z[3] / H * 100) + "%";
        d.style.pointerEvents = "none";
        box.appendChild(d);
      });
      misura();
    }
    if (img.complete && img.naturalWidth) setTimeout(pronta, 0); else img.addEventListener("load", pronta);
    img.addEventListener("error", function () { box.replaceWith(el("p", { text: "(Immagine non disponibile)" })); });
    window.addEventListener("resize", misura);
    box.addEventListener("click", function (e) {
      if (S.risolto || !img.naturalWidth) return;
      var r = img.getBoundingClientRect();
      var x = (e.clientX - r.left) * img.naturalWidth / r.width, y = (e.clientY - r.top) * img.naturalHeight / r.height;
      segno(box, (e.clientX - r.left) / r.width * 100, (e.clientY - r.top) / r.height * 100, colpo(x, y));
    });
    return box;
  }
  function dentro(z, x, y, m) { return x >= z[0] - m && x <= z[0] + z[2] + m && y >= z[1] - m && y <= z[1] + z[3] + m; }
  // x, y in pixels of the picture's natural size; returns true when right
  function colpo(x, y) {
    var p = S.p, img = N.$("#tocca img");
    var W = img && img.naturalWidth || 400, H = img && img.naturalHeight || 400;
    var m = Math.max(6, 0.03 * Math.max(W, H));
    var g = p.zone[p.giusta];
    if (dentro(g, x, y, 0) || (dentro(g, x, y, m) && !p.zone.some(function (z, i) { return i !== p.giusta && dentro(z, x, y, 0); }))) {
      mostraZona(); giusto(null); return true;
    }
    sbagliato();
    return false;
  }
  function segno(box, px, py, ok) {
    var s = el("span", { class: "segno" + (ok ? " ok" : "") });
    s.style.left = px + "%"; s.style.top = py + "%";
    box.appendChild(s);
    if (!ok) setTimeout(function () { s.remove(); }, 900);
  }
  function mostraZona() { var z = N.$('#tocca .zona[data-i="' + S.p.giusta + '"]'); if (z) z.classList.add("vista"); }

  /* ---------------- right / wrong / help ---------------- */
  function scuoti() {
    var w = N.$("#widget .campo") || N.$("#display") || (S.p.tipo === "tocca" || S.p.tipo === "seleziona" ? N.$("#lavagna") : null);
    if (!w) return;
    w.classList.remove("scuoti"); void w.offsetWidth; w.classList.add("scuoti");
  }
  function riempi(valore) {
    if (S.p.cumula && valore != null && /_{2,}/.test(S.acc)) { S.acc = S.acc.replace(/_{2,}/, "\u0001" + valore + "\u0002"); }
  }
  function giusto(valore) {
    if (S.risolto) return;
    S.risolto = true;
    var primoColpo = S.tent === 0;
    if (primoColpo) S.corrette++;
    N.giusto(primoColpo ? null : N.scegli(["Giusto! Ce l'hai fatta", "Ora sì! Bravo!"]));
    riempi(valore);
    disegnaTesto();
    blocca();
    N.$("#punti").textContent = "✅ " + S.corrette;
    setTimeout(avanti, PAUSA * (S.p.cumula && ultimoDelGruppo() ? 1500 : 1000));
  }
  function ultimoDelGruppo() { var n = S.passi[S.i + 1]; return !n || n.primo; }
  function sbagliato() {
    S.tent++;
    scuoti();
    if (S.tent >= 2) { N.sbagliato("Ecco la risposta giusta"); return rivela(); }
    N.sbagliato(N.scegli(["Riprova!", "Quasi! Riprova", "Pensaci ancora", "Non mollare!"]));
  }
  function soluzioneTesto(p) {
    if (p.tipo === "scelta") return p.giusta;
    if (p.tipo === "vf") return p.giusta ? "Vero" : "Falso";
    if (p.tipo === "scrivi" || p.tipo === "seleziona") return p.risposte[0];
    return null;
  }
  function rivela() {
    if (S.risolto) return;
    S.risolto = true;
    var p = S.p, sol = soluzioneTesto(p);
    if (p.tipo === "scelta") N.$$("#widget .scelta").forEach(function (b) { if (b.textContent === p.giusta) b.classList.add("giusta"); });
    if (p.tipo === "vf") { var b = N.$('#widget .scelta[data-v="' + p.giusta + '"]'); if (b) b.classList.add("giusta"); }
    if (p.tipo === "tocca") mostraZona();
    riempi(p.tipo === "scrivi" || p.tipo === "scelta" ? sol : null);
    disegnaTesto();
    if (p.tipo === "seleziona") N.$$("#lav-testo .parola").forEach(function (x) {
      var w = x.textContent, pulita = w.replace(/^[^0-9A-Za-zÀ-ÿ]+|[^0-9A-Za-zÀ-ÿ]+$/g, "");
      if (QZ.confronta(w, p.risposte) != null || (pulita && QZ.confronta(pulita, p.risposte) != null)) x.classList.add("giusta");
    });
    blocca();
    var box = el("div", { class: "soluzione" }, [
      N.gufoDice(p.tipo === "tocca" ? "Ecco il punto giusto: guarda il disegno!" : "La risposta giusta è:", "pensa"),
      sol != null ? el("strong", { text: sol }) : null,
      el("button", { type: "button", class: "btn blocco", id: "avanti", text: "Avanti →", style: "margin-top:12px", onclick: avanti })
    ]);
    if (sol != null) { box.querySelector("strong").innerHTML = ""; scriviTesto(box.querySelector("strong"), sol, false); }
    var extra = N.$("#extra"); extra.innerHTML = ""; extra.appendChild(box);
    var a = N.$("#avanti"); if (a) { a.focus({ preventScroll: true }); if (!TEST) box.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  }
  function blocca() {
    N.$$("#widget button, #lav-testo .parola").forEach(function (b) { if (!b.classList.contains("giusta")) b.disabled = true; });
    var c = N.$("#widget .campo"); if (c) c.readOnly = true;
    var ai = N.$("#aiuto"); if (ai) ai.disabled = true;
    chiudiTastierino(true);
  }
  function aiuto() {
    if (S.risolto) return;
    var p = S.p;
    if (p.sugg && !S.suggVisto) {
      S.suggVisto = true;
      var extra = N.$("#extra"); extra.innerHTML = "";
      var box = el("div", { class: "suggerimento" });
      if (p.sugg.testo) box.appendChild(N.gufoDice(p.sugg.testo, "pensa"));
      else if (p.sugg.audio) { box.appendChild(N.gufoDice("Ascolta il suggerimento!", "pensa")); suona(p.sugg.audio); }
      else if (p.sugg.immagine) { box.appendChild(N.gufoDice("Guarda qui:", "pensa")); box.appendChild(el("img", { src: p.sugg.immagine, alt: "Suggerimento", style: "max-width:100%;margin-top:8px" })); }
      extra.appendChild(box);
      N.$("#aiuto").textContent = "🦉 Soluzione";
      return;
    }
    N.suono.tocco();
    S.tent = Math.max(S.tent, 1);         // a revealed answer counts as wrong
    rivela();
  }
  function avanti() {
    if (schermo !== "gioco") return;
    S.i++;
    if (S.i >= S.passi.length) return fine();
    mostraPasso();
  }
  function fine() {
    schermo = "fine";
    chiudiTastierino();
    N.$(".avanzamento > div").style.width = "100%";
    var liv = S.liv, corrette = S.corrette, totali = S.passi.length;
    S.fine = { corrette: corrette, totali: totali };
    N.fineRound({
      attivita: fonte.attivita(liv.n), corrette: corrette, totali: totali,
      titolo: fonte.livelli.length > 1 ? "Livello " + liv.n + ": fine del giro" : "Fine del giro",
      onAncora: nuovoRound,
      onEsci: function () { location.href = indietro; }
    });
  }

  /* ---------------- helpers ---------------- */
  function chiudiTastierino(soloTasti) {
    if (!tast) return;
    if (soloTasti) { N.$$("button", tast.elemento.parentNode).forEach(function (b) { b.disabled = true; }); }
    else { tast.rimuovi(); tast = null; }
  }
  function suona(u) {
    if (!u) return;
    try { player.pause(); player.src = u; var pr = player.play(); if (pr && pr.catch) pr.catch(function () { /* autoplay blocked */ }); } catch (e) { /* */ }
  }

  window.addEventListener("hashchange", function () { if (/^#q=/.test(location.hash)) location.reload(); });

  /* ---------------- test hook ---------------- */
  window.QUIZ_TEST = {
    stato: function () {
      return {
        schermo: schermo, fonte: fonte && fonte.id, livelli: fonte ? fonte.livelli.length : 0, livello: fonte ? fonte.livelli[livIdx].n : 0,
        i: S ? S.i : 0, totali: S ? S.passi.length : 0, corrette: S ? S.corrette : 0, tipo: S && S.p ? S.p.tipo : null,
        risolto: S ? S.risolto : false, tastierino: !!tast
      };
    },
    fonte: function () { return fonte; },
    scegliLivello: function (n) { livIdx = n - 1; schermoInizio(); },
    // the right answer for the current step, in the form rispondi() takes
    soluzione: function () {
      var p = S.p;
      if (p.tipo === "tocca") { var z = p.zone[p.giusta]; return { x: z[0] + z[2] / 2, y: z[1] + z[3] / 2 }; }
      if (p.tipo === "seleziona") {
        var k = -1;
        N.$$("#lav-testo .parola").some(function (x, i) {
          var w = x.textContent, pulita = w.replace(/^[^0-9A-Za-zÀ-ÿ]+|[^0-9A-Za-zÀ-ÿ]+$/g, "");
          if (QZ.confronta(w, p.risposte) != null || (pulita && QZ.confronta(pulita, p.risposte) != null)) { k = i; return true; }
          return false;
        });
        return k;
      }
      if (p.tipo === "vf") return p.giusta;
      if (p.tipo === "scelta") return p.giusta;
      return p.risposte[0];
    },
    // answers through the same handlers the buttons use
    rispondi: function (v) {
      var p = S.p;
      if (p.tipo === "scelta") { var b = N.$$("#widget .scelta").filter(function (x) { return x.textContent === v && !x.disabled; })[0]; if (!b) throw new Error("scelta assente: " + v); b.click(); }
      else if (p.tipo === "vf") N.$('#widget .scelta[data-v="' + v + '"]').click();
      else if (p.tipo === "seleziona") { var w = N.$$("#lav-testo .parola")[v]; if (!w) throw new Error("parola assente"); w.click(); }
      else if (p.tipo === "tocca") colpo(v.x, v.y);
      else if (tast) {
        String(v).split("").forEach(function (c) {
          var k = c === "." ? "," : c;
          var b = N.$$('button[data-k]', N.$("#widget")).filter(function (x) { return x.getAttribute("data-k") === k; })[0];
          if (!b) throw new Error("tasto assente: " + JSON.stringify(k) + " in " + JSON.stringify(v));
          b.click();
        });
        N.$('#widget button[data-k="ok"]').click();
      } else { var c = N.$("#widget .campo"); c.value = v; N.$("#widget .campo-riga .btn").click(); }
    },
    avanti: function () { var a = N.$("#avanti"); if (a) a.click(); },
    immagineOk: function () { var i = N.$("#tocca img") || N.$(".media img"); return !i || (i.complete && i.naturalWidth > 0) ? true : (i.complete ? false : null); }
  };

  avvia();
})();
