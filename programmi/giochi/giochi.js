/*
 * Didattica - supporto comune ai giochi-premio (puzzle, duello).
 * Countdown " Secondi di gioco = N", nomi dei giocatori, uscita, topbar.
 * Requires js/common.js (global D).
 */
(function () {
  "use strict";

  var G = {};
  window.G = G;

  G.embed = D.param("embed", null) !== null;
  G.sec = Math.max(0, parseInt(D.param("sec", "180"), 10) || 0);
  G.finito = false;

  var timerId = null;

  // Back link bar, only when the page is opened directly
  G.topbar = function (titolo) {
    if (G.embed) return;
    var bar = D.el("div", { class: "topbar" }, [
      D.el("a", { href: "../../index.html", text: "← Programmi" }),
      D.el("span", { class: "spacer" }),
      D.el("span", { text: titolo || "" })
    ]);
    document.body.insertBefore(bar, document.body.firstChild);
  };

  // Ask both names (original prompts); empty / cancelled -> default
  G.nomi = function () {
    var nomi = [];
    return D.input("NOME DEL 1' GIOCATORE :", "nome1").then(function (n) {
      nomi.push((n || "").trim() || "nome1");
      return D.input("NOME DEL 2' GIOCATORE :", "nome2");
    }).then(function (n) {
      nomi.push((n || "").trim() || "nome2");
      return nomi;
    });
  };

  // Start the countdown, writing the label into `el` every second
  G.avviaTempo = function (el) {
    function mostra() { el.textContent = " Secondi di gioco = " + G.sec; }
    mostra();
    if (G.sec <= 0) { scaduto(); return; }
    timerId = setInterval(function () {
      G.sec--;
      mostra();
      if (G.sec <= 0) scaduto();
    }, 1000);
  };

  function scaduto() {
    if (G.finito) return;
    G.finito = true;
    clearInterval(timerId);
    D.msg("Il tempo del gioco è finito.\nProseguire con lo studio.").then(function () { D.fineGioco(0); });
  }

  // "Esci": end early, giving back the seconds not used
  G.esci = function () {
    if (G.finito) return;
    G.finito = true;
    clearInterval(timerId);
    D.fineGioco(G.sec);
  };
})();
