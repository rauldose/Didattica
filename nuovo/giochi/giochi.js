/*
 * Impara giocando – supporto comune ai giochi-premio (globale GI).
 * "Prima si lavora, poi si gioca": i giochi si sbloccano con le stelle
 * guadagnate negli esercizi e ogni sessione dura N.tempoGioco() secondi.
 * Requires ../core/core.js (global N).
 */
(function () {
  "use strict";
  var GI = {};
  window.GI = GI;

  GI.GIOCHI = [
    { id: "memoria", nome: "Memoria", emoji: "🃏", soglia: 3, href: "memoria.html",
      sotto: "Trova le coppie: tabelline, plurali o animali. Da solo o in due." },
    { id: "puzzle", nome: "Puzzle di numeri", emoji: "🔢", soglia: 10, href: "puzzle.html",
      sotto: "Rimetti in ordine i numeri. In due vince chi fa meno mosse!" },
    { id: "cannoni", nome: "Duello di cannoni", emoji: "💥", soglia: 20, href: "cannoni.html",
      sotto: "Trascina per mirare, attento al vento. Sfida per due." }
  ];
  GI.gioco = function (id) { return GI.GIOCHI.filter(function (g) { return g.id === id; })[0]; };
  GI.mancano = function (soglia) { return Math.max(0, soglia - N.stelle()); };
  GI.finito = false;   // true when the play time is over (games stop accepting moves)

  /* ---------------- records (per profile) ---------------- */
  function chi() { var p = N.profilo(); return p ? p.id : "ospite"; }
  GI.record = function (nome, def) {
    var t = N.leggi("giochi.record", {}), r = (t[chi()] || {})[nome];
    return r == null ? def : r;
  };
  GI.salvaRecord = function (nome, v) {
    var t = N.leggi("giochi.record", {}), k = chi();
    t[k] = t[k] || {}; t[k][nome] = v;
    N.scrivi("giochi.record", t);
  };
  // Save v if better than the stored record (minore: lower is better). Returns true on a new record.
  GI.migliora = function (nome, v, minore) {
    var r = GI.record(nome, null);
    if (r == null || (minore ? v < r : v > r)) { GI.salvaRecord(nome, v); return true; }
    return false;
  };

  /* ---------------- lock screen ---------------- */
  // Returns true if the game can be played; otherwise fills `host` with a friendly lock message.
  GI.porta = function (id, host) {
    var g = GI.gioco(id);
    if (N.sbloccato(g.soglia)) return true;
    var m = GI.mancano(g.soglia);
    host.innerHTML = "";
    host.appendChild(N.el("div", { class: "lucchetto" }, [
      N.el("div", { class: "grande-emoji", text: "🔒" }),
      N.el("h2", { text: g.nome + " è ancora chiuso" }),
      N.el("p", { class: "mancano", text: "Ti mancano " + m + " ⭐" }),
      N.gufoDice("Prima si lavora, poi si gioca! Fai qualche esercizio e torna qui.", "pensa"),
      N.el("div", { class: "riga centro", style: "margin-top:12px" }, [
        N.el("a", { class: "btn", href: "../index.html", text: "Vai agli esercizi 📚" }),
        N.el("a", { class: "btn secondario", href: "index.html", text: "Menu giochi" })
      ])
    ]));
    return false;
  };

  /* ---------------- play time ---------------- */
  var tempo = { fine: 0, id: null, gioco: null, avvisi: {} };
  GI.restanti = function () { return tempo.fine ? Math.max(0, Math.ceil((tempo.fine - Date.now()) / 1000)) : N.tempoGioco(); };
  function mmss(s) { return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }

  // Bar with the countdown and the "Esci" button. Returns the node.
  GI.barra = function (gioco) {
    tempo.gioco = gioco;
    var tot = N.tempoGioco();
    var b = N.el("div", { class: "barra-gioco" }, [
      N.el("div", { class: "orologio", id: "orologio", role: "timer", "aria-label": "Tempo di gioco" }, [
        N.el("span", { class: "ico", "aria-hidden": "true", text: "⏳" }),
        N.el("span", { class: "tempo", id: "tempo", text: mmss(GI.restanti()) }),
        N.el("span", { class: "barretta", "aria-hidden": "true" }, [N.el("span", { id: "barretta", style: "width:100%" })])
      ]),
      N.el("span", { class: "sr", id: "tempo-sr", "aria-live": "polite" }),
      N.el("button", { class: "btn piccolo secondario esci", type: "button", text: "Esci 🚪", onclick: GI.esci })
    ]);
    b._tot = tot;
    GI._barra = b;
    return b;
  };

  function mostra() {
    var s = GI.restanti(), t = N.$("#tempo"), bar = N.$("#barretta"), o = N.$("#orologio");
    if (t) t.textContent = mmss(s);
    if (bar && GI._barra) bar.style.width = Math.max(0, Math.min(100, 100 * s / GI._barra._tot)) + "%";
    if (o) o.classList.toggle("poco", s <= 15);
    [60, 30, 10].forEach(function (k) {
      if (s === k && !tempo.avvisi[k] && GI._barra && GI._barra._tot > k) {
        tempo.avvisi[k] = true;
        var sr = N.$("#tempo-sr"); if (sr) sr.textContent = "Ancora " + k + " secondi";
        if (k === 10) N.esito("info", "Ancora 10 secondi!", 1800);
      }
    });
    if (s <= 0) scaduto();
  }

  // Start the countdown (once). A reload of the same game keeps the remaining time.
  GI.avviaTempo = function () {
    if (tempo.id || GI.finito) return;
    var p = N.profilo(), s = N.leggi("giochi.sessione", null), ora = Date.now();
    if (s && s.gioco === tempo.gioco && s.pid === (p ? p.id : null) && s.fine > ora && s.fine - ora <= N.tempoGioco() * 1000) tempo.fine = s.fine;
    else tempo.fine = ora + N.tempoGioco() * 1000;
    N.scrivi("giochi.sessione", { gioco: tempo.gioco, pid: p ? p.id : null, fine: tempo.fine });
    tempo.id = setInterval(mostra, 250);
    mostra();
  };
  GI.tempoAvviato = function () { return !!tempo.id; };

  function ferma() { clearInterval(tempo.id); tempo.id = null; N.scrivi("giochi.sessione", null); }

  var fineCb = [];
  GI.alTermine = function (f) { fineCb.push(f); };

  function scaduto() {
    if (GI.finito) return;
    GI.finito = true;
    ferma();
    fineCb.forEach(function (f) { try { f(); } catch (e) { /* */ } });
    // close any open dialog (e.g. end of a match) before the time-out message
    N.$$(".velo").forEach(function (v) { v.remove(); });
    N.suono.livello();
    N.dialogo({
      titolo: "Tempo scaduto!", chiudibile: false,
      nodo: N.el("div", { class: "fine-tempo" }, [N.gufoDice("Tempo scaduto! Torniamo a studiare 📚", "felice")]),
      pulsanti: [{ testo: "Torna al menu", valore: "menu" }, { testo: "Esercizi 📚", valore: "studio", secondario: true }]
    }).then(function (v) { location.href = v === "studio" ? "../index.html" : "index.html"; });
  }
  GI.scaduto = scaduto;        // used by tests

  // "Esci" any time: back to the games menu
  GI.esci = function () {
    GI.finito = true;
    ferma();
    location.href = "index.html";
  };

  /* ---------------- small UI helpers ---------------- */
  // Segmented choice: opzioni [{valore, testo}], returns node; onCambia(valore)
  GI.pillole = function (etichetta, opzioni, valore, onCambia) {
    var g = N.el("div", { class: "pillole", role: "group", "aria-label": etichetta });
    opzioni.forEach(function (o) {
      var b = N.el("button", { type: "button", class: "pillola", "aria-pressed": String(o.valore === valore), "data-v": String(o.valore), text: o.testo });
      b.addEventListener("click", function () {
        N.suono.tocco();
        N.$$(".pillola", g).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        onCambia(o.valore);
      });
      g.appendChild(b);
    });
    return N.el("div", { class: "scelta-opzione" }, [N.el("div", { class: "consegna", text: etichetta }), g]);
  };
  GI.nomeG1 = function () { var p = N.profilo(); return p ? p.nome : "Giocatore 1"; };
})();
