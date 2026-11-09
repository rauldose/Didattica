/*
 * Impara giocando – Matematica: motore di gioco (gioca.html?a=<id>).
 * One round = def.quanti(livello) exercises (10 by default); each exercise has
 * one or more steps; a step may first ask "Cosa calcoli?" (geometria) and
 * then a number typed with the shared keypad.
 */
(function () {
  "use strict";
  var id = N.parametro("a", ""), def = MAT.PER_ID[id];
  if (!def) { location.replace("index.html"); return; }
  document.title = def.titolo + " – Matematica";
  N.testata({ titolo: def.emoji + " " + def.titolo, indietro: "index.html", tema: "t-mat" });

  var main = N.$("#gioco");
  var livello = N.difficolta(N.classe());
  var S = {};            // round state
  var tastiera = null, timerTempo = null, attesa = null;

  /* ------------------------------------------------------------ start screen */
  function schermoInizio() {
    pulisci();
    var best = N.migliore("mat:" + id);
    var desc = N.el("p", { class: "desc-livello", "aria-live": "polite" });
    var bottoni = [1, 2, 3, 4, 5].map(function (l) {
      return N.el("button", {
        type: "button", text: String(l), "aria-label": "Livello " + l + ": " + def.livelli[l - 1], "aria-pressed": String(l === livello),
        onclick: function () { livello = l; N.suono.tocco(); aggiorna(); }
      });
    });
    function aggiorna() {
      bottoni.forEach(function (b, i) { b.setAttribute("aria-pressed", String(i + 1 === livello)); });
      desc.textContent = "Livello " + livello + ": " + def.livelli[livello - 1];
    }
    var box = N.el("section", { class: "inizio gioco-wrap" }, [
      N.el("div", { class: "grande-emoji", "aria-hidden": "true", text: def.emoji }),
      N.el("h2", { text: def.titolo }),
      N.el("div", { class: "riga centro" }, [
        N.el("span", { class: "etichetta", text: MAT.testoClassi(def.classi) }),
        N.el("span", { class: "etichetta", text: "Record: " + (best ? Array(best + 1).join("⭐") : "nessuna stella") })
      ]),
      N.gufoDice(def.intro, ""),
      N.el("p", { class: "consegna", text: "Scegli il livello:" }),
      N.el("div", { class: "livelli", role: "group", "aria-label": "Livello" }, bottoni),
      desc,
      N.el("button", { type: "button", class: "btn blocco", text: "Inizia! ▶", onclick: iniziaRound })
    ]);
    main.appendChild(box);
    aggiorna();
  }

  function pulisci() {
    clearInterval(timerTempo); clearTimeout(attesa);
    if (tastiera) { tastiera.rimuovi(); tastiera = null; }
    main.innerHTML = "";
  }

  /* ------------------------------------------------------------ round */
  function iniziaRound() {
    pulisci();
    S = {
      quanti: def.aTempo ? Infinity : (def.quanti ? def.quanti(livello) : 10),
      indice: 0, corrette: 0, totali: 0, punti: 0, serie: 0, migliorSerie: 0, recenti: [],
      es: null, k: 0, fase: "", buffer: "", errori: 0, sceltaFatta: false, tempo: 60
    };
    var ui = S.ui = {};
    ui.barra = N.el("div", { style: "width:0%" });
    ui.avanz = N.el("div", { class: "avanzamento" + (def.aTempo ? " tempo" : ""), role: "progressbar", "aria-label": "Avanzamento", "aria-valuemin": "0", "aria-valuemax": "100" }, [ui.barra]);
    ui.conta = N.el("span", { class: "chip" + (def.aTempo ? " cronometro" : "") });
    ui.serie = N.el("span", { class: "chip serie", "aria-label": "Risposte giuste di fila" });
    ui.punti = N.el("span", { class: "chip", "aria-live": "off" });
    ui.liv = N.el("button", { type: "button", class: "chip", "aria-label": "Cambia livello", onclick: cambiaLivello });
    ui.aiuto = N.el("button", { type: "button", class: "chip", text: "💡", "aria-label": "Aiuto del gufo", title: "Aiuto del gufo", onclick: mostraAiuto });
    ui.consegna = N.el("p", { class: "consegna" });
    ui.problema = N.el("div", { class: "problema", hidden: true });
    ui.lavagna = N.el("div", { class: "lavagna mat", "aria-live": "polite" });
    ui.gufo = N.el("div", { class: "gufo-zona", "aria-live": "polite" });
    ui.domScelta = N.el("p", { class: "domanda-scelta" });
    ui.scelte = N.el("div", { class: "scelte" });
    ui.etichetta = N.el("span");
    ui.risposta = N.el("div", { class: "risposta vuota", "aria-label": "La tua risposta" });
    ui.unita = N.el("span");
    ui.rigaRisp = N.el("div", { class: "riga-risposta" }, [ui.etichetta, ui.risposta, ui.unita]);
    ui.tasti = N.el("div");
    ui.avanti = N.el("button", { type: "button", class: "btn avanti", text: "Avanti ▶", onclick: function () { if (S.fase === "avanti") prossimoPasso(); } });
    ui.dock = N.el("div", { class: "dock" }, [ui.domScelta, ui.scelte, ui.rigaRisp, ui.tasti, ui.avanti]);
    ui.area = N.el("div", { class: "area" }, [ui.consegna, ui.problema, ui.lavagna, ui.gufo]);
    main.appendChild(N.el("div", { class: "gioco-wrap app" }, [
      ui.avanz,
      N.el("div", { class: "stato-gioco" }, [ui.conta, ui.serie, ui.punti, N.el("span", { style: "flex:1" }), ui.aiuto, ui.liv]),
      ui.area, ui.dock
    ]));
    tastiera = N.tastierino(ui.tasti, { onTasto: tasto, virgola: !!(def.virgola && def.virgola(livello)) });
    aggiornaStato();
    if (def.aTempo) {
      timerTempo = setInterval(function () {
        if (N.$(".velo")) return;                    // paused while a dialog is open
        S.tempo--; aggiornaStato();
        if (S.tempo <= 0) fineTempo();
      }, 1000);
      ui.aiuto.hidden = true;
    }
    nuovoEsercizio();
  }

  function aggiornaStato() {
    var ui = S.ui;
    if (def.aTempo) {
      ui.barra.style.width = (S.tempo / 60 * 100) + "%";
      ui.conta.textContent = "⏱ " + Math.max(0, S.tempo) + " s";
      ui.conta.classList.toggle("ultimi", S.tempo <= 10);
      ui.avanz.setAttribute("aria-valuenow", String(Math.round(S.tempo / 60 * 100)));
    } else {
      var parte = S.es ? S.k / S.es.passi.length : 0;
      var pc = Math.min(100, (S.indice + parte) / S.quanti * 100);
      ui.barra.style.width = pc + "%";
      ui.avanz.setAttribute("aria-valuenow", String(Math.round(pc)));
      ui.conta.textContent = Math.min(S.indice + 1, S.quanti) + "/" + S.quanti;
    }
    ui.serie.textContent = "🔥 " + S.serie;
    ui.serie.classList.toggle("calda", S.serie >= 3);
    ui.punti.textContent = "🏅 " + S.punti;
    ui.punti.setAttribute("aria-label", S.punti + " punti");
    ui.liv.textContent = "Liv. " + livello + " ▾";
  }

  function nuovoEsercizio() {
    var es, n = 0;
    do { es = def.genera(livello); n++; } while (n < 40 && S.recenti.indexOf(String(es.chiave)) >= 0);
    S.recenti.unshift(String(es.chiave)); S.recenti.length = Math.min(S.recenti.length, 6);
    S.es = es; S.k = 0;
    var ui = S.ui;
    if (es.problema) {
      ui.problema.hidden = false;
      ui.problema.innerHTML = "";
      ui.problema.appendChild(N.el("div", { text: es.problema }));
      ui.figura = N.el("div", { html: es.figura ? es.figura(0) : "" });
      ui.problema.appendChild(ui.figura);
    } else ui.problema.hidden = true;
    ui.area.scrollTop = 0;
    mostraPasso();
  }

  function passo() { return S.es.passi[S.k]; }

  function mostraPasso() {
    var p = passo(), ui = S.ui;
    S.buffer = ""; S.errori = 0; S.sceltaFatta = !p.scelta; S.erroriScelta = 0;
    ui.consegna.textContent = p.consegna || S.es.consegna || (def.aTempo ? "Veloce!" : "Quanto fa?");
    ui.lavagna.innerHTML = p.lavagna || "";
    ui.lavagna.classList.toggle("testo-lungo", /quaderno|colonna/.test(p.lavagna || ""));
    ui.lavagna.classList.remove("entra"); void ui.lavagna.offsetWidth; ui.lavagna.classList.add("entra");
    if (S.es.figura && ui.figura) ui.figura.innerHTML = S.es.figura(S.k);
    ui.gufo.innerHTML = "";
    ui.aiuto.hidden = def.aTempo || !p.aiuto;
    if (!S.sceltaFatta) faseScelta(); else faseNumero();
    aggiornaStato();
  }

  function faseScelta() {
    var p = passo(), ui = S.ui;
    S.fase = "scelta";
    ui.domScelta.hidden = false; ui.domScelta.textContent = p.scelta.domanda;
    ui.scelte.hidden = false; ui.scelte.innerHTML = "";
    p.scelta.voci.forEach(function (v, i) {
      ui.scelte.appendChild(N.el("button", { type: "button", class: "scelta", text: v, "data-i": String(i), onclick: function (e) { scegli(i, e.currentTarget); } }));
    });
    ui.rigaRisp.hidden = true; ui.tasti.hidden = true; ui.avanti.hidden = true;
  }

  function scegli(i, btn) {
    if (S.fase !== "scelta") return;
    var p = passo();
    if (i === p.scelta.giusta) {
      btn.classList.add("giusta");
      N.giusto(N.scegli(["Bravo!", "Giusto!", "Sì, proprio quella!"]));
      S.punti += 2;
      S.sceltaFatta = true;
      S.fase = "attesa";
      attesa = setTimeout(faseNumero, 450);
    } else {
      btn.classList.add("sbagliata"); btn.disabled = true;
      S.serie = 0; S.erroriScelta++;
      N.sbagliato("Non è la grandezza da calcolare adesso");
      if (S.erroriScelta >= 2) gufo("Rileggi il problema: quali dati hai? Cosa puoi calcolare <b>subito</b> con quei dati?", "pensa");
      aggiornaStato();
    }
  }

  function faseNumero() {
    var p = passo(), ui = S.ui;
    S.fase = "numero"; S.buffer = "";
    ui.domScelta.hidden = true; ui.scelte.hidden = true; ui.avanti.hidden = true; ui.tasti.hidden = false;
    var slot = N.$$(".slot", ui.lavagna);
    ui.rigaRisp.hidden = slot.length > 0;
    if (slot.length) vedi(slot[slot.length - 1]);
    ui.etichetta.textContent = p.etichetta || "";
    ui.unita.textContent = p.unita || "";
    ui.risposta.className = "risposta vuota";
    mostraBuffer();
  }

  function mostraBuffer(cls) {
    var ui = S.ui, t = S.buffer;
    N.$$(".slot", ui.lavagna).forEach(function (s) { s.textContent = t; s.className = "slot" + (cls ? " " + cls : ""); });
    ui.risposta.textContent = t;
    ui.risposta.className = "risposta" + (t ? "" : " vuota") + (cls ? " " + cls : "");
  }

  function tasto(k) {
    if (S.fase === "avanti") { if (k === "ok") prossimoPasso(); return; }
    if (S.fase !== "numero") return;
    if (k === "canc") S.buffer = S.buffer.slice(0, -1);
    else if (k === "ok") return verifica();
    else if (k === ",") { if (S.buffer.indexOf(",") < 0) S.buffer = (S.buffer || "0") + ","; }
    else if (S.buffer.replace(",", "").length < 8) S.buffer = S.buffer === "0" ? k : S.buffer + k;
    mostraBuffer();
  }

  function valore(t) { return /^\d+(,\d+)?$/.test(t) ? parseFloat(t.replace(",", ".")) : NaN; }
  function formatta(n) { return MAT.f(n); }

  function verifica() {
    var p = passo(), ui = S.ui;
    if (!S.buffer || /,$/.test(S.buffer)) {
      var d = ui.rigaRisp.hidden ? ui.lavagna : ui.risposta;
      d.classList.remove("scossa"); void d.offsetWidth; d.classList.add("scossa");
      N.esito("info", S.buffer ? "Completa il numero dopo la virgola" : "Scrivi prima la risposta", 1200);
      return;
    }
    var v = valore(S.buffer);
    if (Math.abs(v - p.risposta) < 1e-9) giusto();
    else sbagliato();
  }

  function giusto() {
    var p = passo();
    S.fase = "attesa";
    mostraBuffer("ok");
    S.totali++;
    var testo = null;
    if (S.errori === 0) {
      S.corrette++; S.serie++; S.migliorSerie = Math.max(S.migliorSerie, S.serie);
      S.punti += 10 + (S.serie >= 3 ? 5 : 0);
      if (S.serie === 3) testo = "3 di fila! Bonus +5 🔥";
      else if (S.serie === 5) testo = "5 di fila! Sei forte! 🔥";
      else if (S.serie === 10) testo = "Che centro! 10 di fila! 🔥🔥";
      else if (S.serie > 0 && S.serie % 5 === 0) testo = S.serie + " di fila! Fantastico! 🔥";
      S.ui.serie.classList.remove("pop"); void S.ui.serie.offsetWidth; S.ui.serie.classList.add("pop");
    } else {
      S.punti += 3;
      testo = "Bravo, ora è giusto!";
    }
    N.giusto(testo);
    if (S.serie === 5 || S.serie === 10) gufo(N.scegli(["Sei forte!", "Che centro!", "Continua così!"]) + " " + S.serie + " risposte giuste di fila!", "felice");
    aggiornaStato();
    attesa = setTimeout(prossimoPasso, def.aTempo ? 300 : 700);
    void p;
  }

  function sbagliato() {
    var p = passo(), ui = S.ui, max = S.es.tentativi || 1;
    S.errori++; S.serie = 0;
    aggiornaStato();
    if (def.aTempo) {
      S.totali++;
      S.fase = "attesa";
      var tuo = S.buffer;
      S.buffer = formatta(p.risposta); mostraBuffer("ok");
      N.sbagliato("Era " + formatta(p.risposta) + " (non " + tuo + ")");
      attesa = setTimeout(prossimoPasso, 1100);
      return;
    }
    if (S.errori < max) {
      // geometria: his rule – after 2 errors the formula, after 3 the numeric expression
      mostraBuffer("ko");
      S.fase = "attesa";
      if (S.errori === 1) { N.sbagliato("Il calcolo è errato. Riprova!"); gufo("Controlla bene il calcolo e riprova.", "pensa"); }
      else if (S.errori === 2) { N.sbagliato("Ancora no…"); gufo("Ti suggerisco la formula:<br><b>" + p.formula + "</b>", "pensa"); }
      else { N.sbagliato("Quasi!"); gufo("Ti suggerisco di eseguire:<br><b>" + p.sugg + "</b>", "pensa"); }
      attesa = setTimeout(function () { S.buffer = ""; S.fase = "numero"; mostraBuffer(); }, 900);
      return;
    }
    // show the right answer kindly, then let the child go on
    S.totali++;
    S.fase = "avanti";
    var tuo2 = S.buffer;
    S.buffer = formatta(p.risposta);
    mostraBuffer("ok");
    N.sbagliato(N.scegli(["Quasi!", "Non è giusto, ma ci sei quasi", "Niente paura!"]));
    var inizio = max > 1 ? "Svegliati! È la quarta volta che sbagli. Lavora con calma e con ordine.<br>" :
      N.scegli(["Niente paura! ", "Succede anche ai campioni. ", "Non preoccuparti! "]);
    gufo(inizio + "Avevi scritto " + tuo2 + ". La risposta giusta è <b>" + formatta(p.risposta) + (p.unita ? " " + p.unita : "") + "</b>." +
      (p.spiega ? '<br><span style="font-weight:700">' + p.spiega + "</span>" : ""), "pensa");
    ui.tasti.hidden = true; ui.avanti.hidden = false;
    ui.avanti.focus();
  }

  function prossimoPasso() {
    clearTimeout(attesa);
    if (S.fase === "fine") return;
    S.k++;
    if (S.k < S.es.passi.length) { mostraPasso(); return; }
    // exercise finished
    S.indice++;
    var es = S.es, ui = S.ui;
    var dopo = function () {
      if (S.indice >= S.quanti) fineRound();
      else nuovoEsercizio();
    };
    if ((es.finale || es.passi.length > 1) && !def.aTempo) {
      S.fase = "attesa";
      if (es.finale) ui.lavagna.innerHTML = es.finale;
      if (es.figura && ui.figura) ui.figura.innerHTML = es.figura(es.passi.length);
      ui.tasti.hidden = true; ui.scelte.hidden = true; ui.domScelta.hidden = true; ui.rigaRisp.hidden = true; ui.avanti.hidden = true;
      ui.consegna.textContent = "Esercizio finito!";
      gufo(N.scegli(["Bravo! Hai finito l'esercizio.", "Che centro! Esercizio risolto.", "Ottimo lavoro, con calma e con ordine!"]), "felice");
      aggiornaStato();
      attesa = setTimeout(dopo, 1500);
    } else dopo();
  }

  function fineRound() {
    S.fase = "fine";
    aggiornaStato();
    N.fineRound({
      attivita: "mat:" + id, corrette: S.corrette, totali: S.totali,
      messaggio: S.migliorSerie >= 5 ? "Serie migliore: " + S.migliorSerie + " di fila! 🔥" : undefined,
      onAncora: iniziaRound, onEsci: function () { location.href = "index.html"; }
    });
  }

  /* ------------------------------------------------------------ 60 seconds */
  var SOGLIE = { 1: [6, 12, 18], 2: [6, 12, 18], 3: [5, 10, 15], 4: [5, 10, 14], 5: [4, 8, 12] };
  function fineTempo() {
    clearInterval(timerTempo); clearTimeout(attesa);
    S.fase = "fine";
    S.ui.tasti.hidden = true;
    var s = SOGLIE[livello], c = S.corrette, stelle = c >= s[2] ? 3 : c >= s[1] ? 2 : c >= s[0] ? 1 : 0;
    var p = N.profilo(), chiave = "mat.tempo." + (p ? p.id : "ospite"), rec = N.leggi(chiave, {}), prima = rec[livello] || 0;
    if (c > prima) { rec[livello] = c; N.scrivi(chiave, rec); }
    N.esito("info", "Tempo scaduto!", 1200);
    attesa = setTimeout(function () {
      N.fineRound({
        attivita: "mat:" + id, corrette: c, totali: S.totali, stelle: stelle,
        messaggio: c + " giuste in 60 secondi!" + (c > prima && prima > 0 ? " Record! 🏅" : prima ? " (record: " + prima + ")" : ""),
        titolo: "Tempo scaduto!",
        onAncora: iniziaRound, onEsci: function () { location.href = "index.html"; }
      });
    }, 900);
  }

  /* ------------------------------------------------------------ helpers */
  function gufo(html, umore) {
    var g = N.gufoDice("", umore);
    N.$(".fumetto", g).innerHTML = html;
    N.$(".gufo", g).classList.add("piccolo");
    S.ui.gufo.innerHTML = ""; S.ui.gufo.appendChild(g);
    vedi(g);
  }
  // scroll the middle area (only) so that the element is visible
  function vedi(el) {
    setTimeout(function () {
      var a = S.ui.area, r = el.getBoundingClientRect(), ra = a.getBoundingClientRect();
      if (r.bottom > ra.bottom) a.scrollTop += r.bottom - ra.bottom + 8;
      else if (r.top < ra.top) a.scrollTop -= ra.top - r.top + 8;
    }, 30);
  }
  function mostraAiuto() {
    var p = S.es && passo();
    if (!p) return;
    N.suono.tocco();
    if (S.fase === "scelta") gufo("Rileggi il problema: con i dati che hai, cosa puoi calcolare subito?", "pensa");
    else gufo(p.aiuto || "Lavora con calma e con ordine.", "pensa");
  }
  function cambiaLivello() {
    var lista = N.el("ul", { class: "livelli-dialogo" }, def.livelli.map(function (t, i) { return N.el("li", { html: "<b>" + (i + 1) + "</b> – " + t }); }));
    var nodo = N.el("div", {}, [N.el("p", { text: "Il giro ricomincia dal livello che scegli." }), lista]);
    N.dialogo({
      titolo: "Scegli il livello", nodo: nodo,
      pulsanti: [1, 2, 3, 4, 5].map(function (l) { return { testo: String(l), valore: l, secondario: l !== livello }; }).concat([{ testo: "Annulla", valore: null, secondario: true }])
    }).then(function (l) {
      if (!l || l === livello) return;
      livello = l; N.suono.livello();
      N.esito("info", "Livello " + l + "!", 1200);
      iniziaRound();
    });
  }

  // small hook for automated tests
  window.__mat = {
    domanda: function () {
      var p = S.es && passo();
      return p ? { fase: S.fase, risposta: p.risposta, testo: formatta(p.risposta), scelta: p.scelta ? p.scelta.giusta : null, livello: livello, indice: S.indice, k: S.k, errori: S.errori, quanti: S.quanti } : null;
    },
    stato: function () { return { corrette: S.corrette, totali: S.totali, punti: S.punti, serie: S.serie, fase: S.fase, tempo: S.tempo }; },
    livello: function (l) { if (l) livello = l; return livello; },
    inizia: iniziaRound
  };

  schermoInizio();
})();
