/* "Per gli insegnanti" – list of my quizzes, import, share */
(function () {
  "use strict";
  var el = N.el;
  N.testata({ titolo: "Per gli insegnanti", tema: "t-ins" });

  N.$("#intro").appendChild(N.gufoDice("Qui scrivi tu gli esercizi per la tua classe!", "felice"));

  /* ---------------- class space online (only when configured) ---------------- */
  var online = window.API && API.attivo();
  function insegnanteOnline() { return online && API.insegnante(); }
  if (online) {
    var io = insegnanteOnline();
    N.$("#intro").appendChild(el("a", { class: "link-classe", href: io ? "../classe/insegnante.html" : "../classe/accedi.html#insegnante" }, [
      el("span", { style: "font-size:28px", "aria-hidden": "true", text: "🏫" }),
      el("span", {}, [io ? "La mia classe online" : "Entra nella classe online",
        el("small", { text: io ? "Classi, alunni, risultati e mini-giochi" : "Per pubblicare i quiz nelle tue classi e vedere i risultati" })])
    ]));
  }
  function pubblicaOnline(q) {
    var quiz = INS.trova(q.id) || q;
    if (INS.contaProblemi(INS.normalizza(quiz))) {
      return N.dialogo({ titolo: "Quiz da completare", testo: "Alcune domande sono incomplete: gli alunni non le vedranno. Completale con «Modifica», poi pubblica.",
        pulsanti: [{ testo: "Pubblica lo stesso", valore: true }, { testo: "Annulla", valore: false, secondario: true }] })
        .then(function (si) { if (si) invia(quiz); });
    }
    invia(quiz);
  }
  function invia(quiz) {
    N.esito("info", "Carico il quiz…", 1000);
    API.caricaQuizLocale(INS.pulito(quiz)).then(function (r) {
      N.suono.ok();
      disegna();
      N.dialogo({ titolo: r.nuovo ? "Quiz online! ☁️" : "Quiz aggiornato! 🔄",
        testo: r.nuovo ? "«" + quiz.titolo + "» è sul server. Ora scegli in quali classi pubblicarlo: «La mia classe online» → la classe → «Pubblicati»."
          : "Gli alunni vedranno la nuova versione di «" + quiz.titolo + "».",
        pulsanti: [{ testo: "Vai alle classi", valore: true }, { testo: "OK", valore: false, secondario: true }] })
        .then(function (v) { if (v) location.href = "../classe/insegnante.html#classi"; });
    }, function (e) {
      if (e.status === 401) { disegna(); return N.dialogo({ titolo: "Devi entrare di nuovo", testo: "La sessione è scaduta: entra di nuovo nella classe online." }); }
      N.dialogo({ titolo: "Non riesco a pubblicare", testo: e.message });
    });
  }

  function disegna() {
    var l = INS.lista(), box = N.$("#lista");
    box.innerHTML = "";
    if (!l.length) {
      box.appendChild(el("div", { class: "scheda quiz-card" }, [
        el("div", { class: "testa" }, [el("span", { class: "emoji", text: "📭" }), el("div", {}, [
          el("div", { class: "titolo", text: "Non hai ancora quiz" }),
          el("div", { class: "sotto", text: "Tocca «Nuovo quiz» per creare il primo, oppure «Importa» per caricare un file." })
        ])])
      ]));
    }
    l.forEach(function (q) { box.appendChild(scheda(q)); });
    var m = INS.usoMemoria();
    N.$("#memoria").textContent = l.length ? "Spazio usato dai quiz: " + INS.kB(m) : "";
  }

  function scheda(q) {
    var mat = INS.materia(q.materia), n = (q.domande || []).length, pr = INS.contaProblemi(INS.normalizza(q));
    return el("article", { class: "scheda quiz-card " + mat.tema, "aria-label": q.titolo || "Quiz senza titolo" }, [
      el("div", { class: "fascia" }),
      el("div", { class: "testa" }, [
        el("span", { class: "emoji", "aria-hidden": "true", text: mat.emoji }),
        el("div", { style: "min-width:0" }, [
          el("div", { class: "titolo", text: q.titolo || "Quiz senza titolo" }),
          el("div", { class: "sotto", text: (n === 1 ? "1 domanda" : n + " domande") + " · " + INS.classi(q) + (q.autore ? " · " + q.autore : "") }),
          el("span", { class: "etichetta", text: mat.nome }),
          pr ? el("div", { class: "avviso", text: "⚠️ " + (pr === 1 ? "1 domanda da completare" : pr + " domande da completare") }) : null
        ])
      ]),
      el("div", { class: "barra-azioni" + (insegnanteOnline() ? " sei" : "") }, [
        el("a", { class: "azione principale", href: INS.urlGioca(q.id), "aria-label": "Gioca " + (q.titolo || "") }, [el("span", { class: "ico", text: "▶️" }), "Gioca"]),
        el("a", { class: "azione", href: "modifica.html?id=" + encodeURIComponent(q.id), "aria-label": "Modifica " + (q.titolo || "") }, [el("span", { class: "ico", text: "✏️" }), "Modifica"]),
        el("button", { class: "azione", type: "button", "aria-label": "Condividi " + (q.titolo || ""), onclick: function () { INS.condividi(INS.trova(q.id) || q); } }, [el("span", { class: "ico", text: "📤" }), "Condividi"]),
        el("button", { class: "azione", type: "button", "aria-label": "Duplica " + (q.titolo || ""), onclick: function () { duplica(q); } }, [el("span", { class: "ico", text: "📑" }), "Duplica"]),
        insegnanteOnline() ? el("button", { class: "azione online", type: "button", "aria-label": (API.idOnline(q.id) ? "Aggiorna online " : "Pubblica online ") + (q.titolo || ""), onclick: function () { pubblicaOnline(q); } },
          [el("span", { class: "ico", text: API.idOnline(q.id) ? "🔄" : "☁️" }), API.idOnline(q.id) ? "Aggiorna online" : "Pubblica online"]) : null,
        el("button", { class: "azione pericolo", type: "button", "aria-label": "Elimina " + (q.titolo || ""), onclick: function () { elimina(q); } }, [el("span", { class: "ico", text: "🗑️" }), "Elimina"])
      ])
    ]);
  }

  function duplica(q) {
    var c = INS.duplica(INS.trova(q.id) || q);
    if (!INS.salva(c)) return INS.memoriaPiena();
    disegna(); N.esito("si", "Copia creata!");
  }
  function elimina(q) {
    N.dialogo({ titolo: "Eliminare il quiz?", testo: "«" + (q.titolo || "Quiz senza titolo") + "» sarà cancellato da questo dispositivo.",
      pulsanti: [{ testo: "Elimina", valore: true }, { testo: "Annulla", valore: false, secondario: true }] })
      .then(function (ok) { if (!ok) return; INS.elimina(q.id); disegna(); N.esito("info", "Quiz eliminato"); });
  }

  /* ---------------- import ---------------- */
  var fileIn = N.$("#file-import"), dirIn = N.$("#cartella-import");
  var cartelle = "webkitdirectory" in dirIn && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  N.$("#btn-importa").addEventListener("click", function () {
    var opz = {};
    function vai(fn) { return function () { if (opz._chiudi) opz._chiudi(null); fn(); }; }
    var nodo = el("div", {}, [
      el("p", { text: "Puoi importare:" }),
      el("ul", { class: "nota", style: "margin-top:0" }, [
        el("li", { text: "un quiz scaricato da qui (file .json);" }),
        el("li", { text: "esercizi di E.G.: i file .L1 … .L5 e .DAT con lo stesso nome;" }),
        el("li", { text: "esercizi di EM: il file .ESE con le sue immagini (.bmp)." })
      ]),
      el("div", { class: "scelte-import" }, [
        el("button", { class: "btn", type: "button", text: "📄 Scegli i file", onclick: vai(function () { fileIn.click(); }) }),
        cartelle ? el("button", { class: "btn secondario", type: "button", text: "📁 Scegli una cartella (EM)", onclick: vai(function () { dirIn.click(); }) }) : null,
        el("button", { class: "btn secondario", type: "button", text: "🔗 Incolla un link", onclick: vai(incollaLink) })
      ])
    ]);
    opz.titolo = "Importa"; opz.nodo = nodo; opz.pulsanti = [{ testo: "Annulla", valore: null, secondario: true }];
    N.dialogo(opz);
  });
  [fileIn, dirIn].forEach(function (inp) {
    inp.addEventListener("change", function () {
      var files = Array.prototype.slice.call(inp.files || []);
      inp.value = "";
      if (files.length) importa(files);
    });
  });

  function attesa(testo) {
    var v = el("div", { class: "velo", role: "status", "aria-live": "polite" }, [el("div", { class: "finestra", style: "text-align:center" }, [
      el("div", { html: N.gufo("pensa") }).firstChild, el("p", { style: "font-weight:800", text: testo })
    ])]);
    document.body.appendChild(v);
    return function () { v.remove(); };
  }

  function importa(files) {
    var fine = attesa("Sto leggendo i file…");
    INS.importaFile(files).then(function (r) { fine(); aggiungi(r.quiz, r.avvisi); }, function (e) { fine(); N.dialogo({ titolo: "Non riesco a importare", testo: String(e && e.message || e) }); });
  }
  function incollaLink() {
    var campo = el("input", { class: "campo", type: "url", inputmode: "url", placeholder: "https://…/gioca.html#q=…", "aria-label": "Link del quiz" });
    N.dialogo({ titolo: "Incolla il link del quiz", nodo: el("div", {}, [el("p", { class: "nota", text: "Il link che ti hanno mandato (quello di «Condividi»)." }), campo]),
      pulsanti: [{ testo: "Importa", valore: true }, { testo: "Annulla", valore: false, secondario: true }] })
      .then(function (ok) {
        if (!ok || !campo.value.trim()) return;
        INS.decodifica(campo.value).then(function (q) { aggiungi([q], []); }, function () { N.dialogo({ titolo: "Link non valido", testo: "Controlla di aver copiato tutto il link." }); });
      });
  }

  function aggiungi(quiz, avvisi) {
    if (!quiz.length) return N.dialogo({ titolo: "Nessun quiz trovato", testo: (avvisi.join("\n") || "Nei file scelti non ci sono quiz.") });
    var ids = {}; INS.lista().forEach(function (q) { ids[q.id] = 1; });
    var doppi = quiz.filter(function (q) { return ids[q.id]; });
    var scelta = doppi.length
      ? N.dialogo({ titolo: "Quiz già presente", testo: (doppi.length === 1 ? "«" + doppi[0].titolo + "» c'è già." : doppi.length + " quiz ci sono già.") + " Vuoi sostituirlo o tenere entrambe le versioni?",
          pulsanti: [{ testo: "Sostituisci", valore: "sost" }, { testo: "Tieni entrambi", valore: "copia", secondario: true }] })
      : Promise.resolve("sost");
    scelta.then(function (modo) {
      if (!modo) return;
      var salvati = 0, pieno = false;
      quiz.slice().reverse().forEach(function (q) {
        if (pieno) return;
        if (modo === "copia" && ids[q.id]) q.id = INS.nuovoId();
        if (INS.salva(q)) salvati++; else pieno = true;
      });
      disegna();
      var testo = salvati === 1 ? "Ho aggiunto il quiz «" + quiz[0].titolo + "»." : "Ho aggiunto " + salvati + " quiz:\n" + quiz.slice(quiz.length - salvati).map(function (q) { return "• " + q.titolo + " (" + q.domande.length + " domande)"; }).join("\n");
      if (pieno) testo += "\n\n⚠️ La memoria è piena: " + (quiz.length - salvati) + " quiz non sono stati salvati.";
      if (avvisi.length) testo += "\n\n" + avvisi.join("\n");
      N.suono.ok();
      N.dialogo({ titolo: pieno ? "Importazione incompleta" : "Fatto! 🎉", testo: testo, pulsanti: [{ testo: "OK", valore: true }] });
    });
  }

  disegna();
  window.addEventListener("pageshow", function (e) { if (e.persisted) disegna(); });
})();
