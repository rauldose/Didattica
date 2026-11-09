/*
 * Impara giocando – quiz catalogue.
 *   index.html?materia=ita|sci|mat   one subject (themed)
 *   index.html                       every subject, with tabs
 * Lists Prof. Muscolino's sets (catalogo.js) and the teachers' quizzes
 * (N.leggi("quiz") from the editor + those opened through a share link).
 */
(function () {
  "use strict";
  var el = N.el, M = window.QUIZ_MATERIE;
  var app = N.$("#app");
  var fissa = N.parametro("materia");
  if (!M[fissa] || fissa === "altro") fissa = null;
  var scelta = fissa || "tutte";
  if (!fissa) { try { var t = sessionStorage.getItem("impara.quiz.tab"); if (t && (t === "tutte" || M[t])) scelta = t; } catch (e) { /* */ } }

  N.testata({ titolo: fissa ? "Quiz di " + M[fissa].nome.toLowerCase() : "Quiz", tema: fissa ? M[fissa].tema : "t-ita" });

  function eta(e) {
    if (!e) return "";
    var c = N.CLASSI;
    return e[0] === e[1] ? c[e[0]] : c[e[0]].replace(" primaria", "").replace(" media", "") + (e[0] <= 2 && e[1] >= 3 ? " primaria" : "") + " – " + c[e[1]];
  }
  function stelle(id, livelli) {
    var m = 0;
    for (var n = 1; n <= (livelli || 1); n++) m = Math.max(m, N.migliore("quiz:" + id + ":" + n));
    return m;
  }
  function scheda(c) {
    var classe = N.classe(), perTe = N.profilo() && c.eta && classe >= c.eta[0] && classe <= c.eta[1];
    var s = stelle(c.id, c.livelli);
    return el("a", { class: "scheda " + M[c.materia].tema, href: "gioca.html?set=" + encodeURIComponent(c.id) }, [
      el("span", { class: "fascia" }),
      el("span", { class: "emoji", "aria-hidden": "true", text: c.emoji }),
      el("span", { class: "titolo", text: c.titolo }),
      el("span", { class: "sotto", text: c.sotto }),
      el("span", { class: "riga-eta" }, [
        el("span", { class: "etichetta", text: eta(c.eta) }),
        c.livelli > 1 ? el("span", { class: "etichetta", text: c.livelli + " livelli" }) : null,
        perTe ? el("span", { class: "etichetta per-te", text: "Per te!" }) : null
      ]),
      s ? el("span", { class: "stelline", "aria-label": s + " stelle", text: "⭐".repeat(s) }) : null
    ]);
  }
  function schedaMaestra(q) {
    var m = M[q.materia] || M.altro, s = N.migliore("quiz:mio:" + q.id);
    return el("a", { class: "scheda " + m.tema, href: "gioca.html?mio=" + encodeURIComponent(q.id) }, [
      el("span", { class: "fascia" }),
      el("span", { class: "emoji", "aria-hidden": "true", text: "🍎" }),
      el("span", { class: "titolo", text: q.titolo }),
      el("span", { class: "sotto", text: q.domande.length + " domande" + (q.autore ? " · " + q.autore : "") }),
      el("span", { class: "riga-eta" }, [el("span", { class: "etichetta", text: m.emoji + " " + m.nome })]),
      s ? el("span", { class: "stelline", "aria-label": s + " stelle", text: "⭐".repeat(s) }) : null
    ]);
  }

  function disegna() {
    app.innerHTML = "";
    var p = N.profilo();
    app.appendChild(el("div", { class: "benvenuto" }, [N.gufoDice(
      (p ? "Ciao " + p.nome + "! " : "Ciao! ") + "Scegli un quiz: rispondi a 10 domande e vinci le stelle.", "felice")]));
    if (!fissa) {
      var tabs = el("div", { class: "schede-tab", role: "tablist", "aria-label": "Materie" });
      [["tutte", "🌈 Tutti"]].concat(["ita", "sci", "mat"].map(function (k) { return [k, M[k].emoji + " " + M[k].nome]; })).forEach(function (x) {
        tabs.appendChild(el("button", {
          type: "button", role: "tab", class: "tab", "aria-selected": x[0] === scelta ? "true" : "false", text: x[1],
          onclick: function () {
            N.suono.tocco(); scelta = x[0];
            try { sessionStorage.setItem("impara.quiz.tab", scelta); } catch (e) { /* */ }
            disegna(); var b = N.$('.tab[aria-selected="true"]'); if (b) b.focus();
          }
        }));
      });
      app.appendChild(tabs);
      document.body.classList.remove("t-ita", "t-sci", "t-mat");
      document.body.classList.add(scelta === "tutte" ? "t-ita" : M[scelta].tema);
    }
    var materie = scelta === "tutte" ? ["ita", "sci", "mat"] : [scelta];
    var pannello = el("div", { role: fissa ? null : "tabpanel" });
    app.appendChild(pannello);

    // teacher quizzes first: they are what the class is doing now
    var mae = QZ.tuttiMaestra().filter(function (q) { return scelta === "tutte" || q.materia === scelta; });
    pannello.appendChild(el("h2", { class: "sezione", id: "maestra" }, [el("span", { "aria-hidden": "true", text: "🍎" }), "I quiz della maestra o del maestro"]));
    if (mae.length) {
      var gm = el("div", { class: "griglia larga" });
      mae.forEach(function (q) { gm.appendChild(schedaMaestra(q)); });
      pannello.appendChild(gm);
    } else {
      pannello.appendChild(el("div", { class: "vuoto" }, [el("p", { text: "Qui troverai i quiz preparati per te. Se la maestra o il maestro ti manda un link, aprilo: il quiz comparirà in questa pagina." })]));
    }

    materie.forEach(function (k) {
      var lista = window.QUIZ_CATALOGO.filter(function (c) { return c.materia === k; });
      if (!lista.length) return;
      pannello.appendChild(el("h2", { class: "sezione" }, [el("span", { "aria-hidden": "true", text: M[k].emoji }), "Esercizi di " + M[k].nome]));
      var g = el("div", { class: "griglia" });
      lista.forEach(function (c) { g.appendChild(scheda(c)); });
      pannello.appendChild(g);
    });
  }
  disegna();
})();
