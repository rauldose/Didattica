/*
 * Laboratori – piccole utilità condivise da archimede.html e talete.html:
 * elenco delle missioni con le spunte, missione compiuta (stelle), domanda
 * con il tastierino. Usa la libreria N di ../core/core.js.
 */
(function () {
  "use strict";
  var LAB = window.LAB = {};
  var sessione = {};            // missions done in this visit (also for guests)

  LAB.MISSIONI = {
    archimede: ["galleggia", "mercurio", "bilancia", "ghiaccio", "volume"],
    talete: ["doppio", "altezza", "piramide", "soli"]
  };
  LAB.stelleDi = function (id) { return Math.max(N.migliore(id), sessione[id] || 0); };
  LAB.fatta = function (id) { return LAB.stelleDi(id) > 0; };
  LAB.ridotto = function () { return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); };

  // Italian number formatting with at most `dec` decimals
  LAB.fmt = function (n, dec) {
    var s = Number(n).toFixed(dec == null ? 1 : dec);
    if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
    if (s === "-0") s = "0";
    return s.replace(".", ",");
  };
  LAB.stelline = function (s) { var t = ""; for (var i = 0; i < 3; i++) t += i < s ? "⭐" : "☆"; return t; };

  // A mission is done: record the stars (never twice the same result) and celebrate
  LAB.completa = function (id, stelle, testo) {
    var prima = N.migliore(id);
    sessione[id] = Math.max(sessione[id] || 0, stelle);
    var p = stelle > prima ? N.registra(id, stelle) : N.profilo();
    N.suono.vittoria(); N.vibra([20, 40, 20]); N.coriandoli();
    var nodo = N.el("div", { class: "risultato" }, [
      N.el("div", { html: N.gufo("felice") }).firstChild,
      N.el("div", { class: "stelle-grandi", "aria-label": stelle + " stelle su 3" }, [0, 1, 2].map(function (i) {
        return N.el("span", { class: i < stelle ? "accesa" : "", text: "⭐" });
      })),
      N.el("p", { style: "font-size:21px;font-weight:800;margin:6px 0", text: testo || N.scegli(N.LODI) }),
      p ? N.el("p", { class: "consegna", text: "Hai " + p.stelle + " stelle in tutto." })
        : N.el("p", { class: "consegna", text: "Crea il tuo profilo nella pagina principale per tenere le stelle." })
    ]);
    LAB.aggiorna();
    return N.dialogo({ titolo: "Missione compiuta!", nodo: nodo, chiudibile: false, pulsanti: [{ testo: "Avanti! 🚀", valore: true }] });
  };

  /* ---- mission checklist ---- */
  // LAB.lista(host, modulo, [{id, emoji, titolo}], getAttiva, onScegli)
  var liste = [];
  LAB.lista = function (host, modulo, missioni, attiva, onScegli) {
    var l = { host: host, modulo: modulo, missioni: missioni, attiva: attiva, onScegli: onScegli };
    liste.push(l);
    disegnaLista(l);
  };
  function disegnaLista(l) {
    l.host.innerHTML = "";
    var fatte = 0;
    var ol = N.el("ol", { class: "missioni" });
    l.missioni.forEach(function (m, i) {
      var id = "lab:" + l.modulo + ":" + m.id, s = LAB.stelleDi(id);
      if (s > 0) fatte++;
      ol.appendChild(N.el("li", null, [N.el("button", {
        type: "button", class: "missione" + (s > 0 ? " fatta" : "") + (l.attiva() === i ? " attiva" : ""),
        "aria-pressed": l.attiva() === i ? "true" : "false",
        "aria-label": "Missione " + (i + 1) + ": " + m.titolo + (s > 0 ? ", fatta, " + s + " stelle" : ", da fare"),
        onclick: function () { N.suono.tocco(); l.onScegli(i); }
      }, [
        N.el("span", { class: "spunta", text: s > 0 ? "✓" : String(i + 1) }),
        N.el("span", { class: "m-testo" }, [N.el("span", { class: "m-titolo", text: m.emoji + " " + m.titolo }),
          N.el("span", { class: "m-stelle", text: LAB.stelline(s) })])
      ])]));
    });
    l.host.appendChild(N.el("div", { class: "punteggio-riga" }, [
      N.el("span", { text: "Missioni fatte: " + fatte + " su " + l.missioni.length }),
      N.el("span", { text: fatte === l.missioni.length ? "🏆 Tutte!" : "" })
    ]));
    l.host.appendChild(N.el("div", { class: "avanzamento", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(l.missioni.length), "aria-valuenow": String(fatte) },
      [N.el("div", { style: "width:" + (100 * fatte / l.missioni.length) + "%" })]));
    l.host.appendChild(ol);
  }
  LAB.aggiorna = function () { liste.forEach(disegnaLista); };

  /* ---- numeric question with the shared keypad ---- */
  // LAB.domanda(host, { virgola, unita, verifica(valore, testo) -> true|false })
  LAB.domanda = function (host, o) {
    var testo = "";
    var box = N.el("div", { class: "risposta vuota", "aria-live": "polite", "aria-label": "La tua risposta" });
    var unita = N.el("span", { class: "unita", text: o.unita || "" });
    var riga = N.el("div", { class: "riga-risposta" }, [box, unita]);
    host.appendChild(riga);
    function mostra() { box.textContent = testo; box.classList.toggle("vuota", !testo); }
    var t = N.tastierino(host, {
      virgola: o.virgola !== false,
      onTasto: function (k) {
        if (k === "canc") testo = testo.slice(0, -1);
        else if (k === "ok") {
          if (!testo) return;
          var v = parseFloat(testo.replace(",", "."));
          if (o.verifica(v, testo) === false) { box.classList.remove("scossa"); void box.offsetWidth; box.classList.add("scossa"); testo = ""; }
        } else if (k === ",") { if (testo.indexOf(",") < 0 && testo.length < 6) testo = (testo || "0") + ","; }
        else if (testo.length < 6) testo = testo === "0" ? k : testo + k;
        mostra();
      }
    });
    return { rimuovi: function () { t.rimuovi(); riga.remove(); } };
  };
})();
