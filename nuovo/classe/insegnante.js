/*
 * Impara giocando – "La mia classe online": teacher dashboard (phone first).
 * Routes (hash):  #classi  ·  #classe/<id>[/alunni|pubblicati|risultati]  ·  #quiz  ·  #app  ·  #account
 */
(function () {
  "use strict";
  var el = N.el, app = N.$("#app"), nav = N.$("#nav");
  N.testata({ titolo: "La mia classe online", indietro: "../index.html", tema: "t-classe" });
  if (!API.attivo()) { nav.remove(); return CL.nonAttivo(app); }
  var s = API.sessione();
  if (!s) return location.replace("accedi.html#insegnante");
  if (s.ruolo !== "insegnante") return location.replace("index.html");

  var MATERIE = { ita: "📚", mat: "🔢", sci: "🔬", altro: "🍎" };
  var giro = 0;               // render generation: ignore answers for a page already left

  /* ---------------- helpers ---------------- */
  function problema(e) {
    if (e && e.status === 401) { location.replace("accedi.html#insegnante"); return; }
    N.dialogo({ titolo: e && e.offline ? "Nessuna connessione" : "Non è stato possibile", testo: e && e.message || String(e) });
  }
  function carica(promessa, disegna, testo) {
    var mio = ++giro;
    CL.carico(app, testo);
    return promessa.then(function (r) { if (mio === giro) disegna(r); }, function (e) {
      if (mio !== giro) return;
      if (e && e.status === 401) return location.replace("accedi.html#insegnante");
      CL.errore(app, e, router);
    });
  }
  function h1(testo) { return el("h1", { style: "font-size:26px;margin:14px 0 6px", text: testo }); }
  function plur(n, uno, molti) { return n + " " + (n === 1 ? uno : molti); }
  function kB(n) { return n < 1024 ? n + " byte" : n < 1048576 ? Math.round(n / 1024) + " kB" : (n / 1048576).toFixed(1).replace(".", ",") + " MB"; }

  function menuNav(attivo) {
    nav.innerHTML = "";
    [["classi", "🏫", "Classi"], ["quiz", "📝", "Quiz online"], ["app", "🎲", "Mini-giochi"], ["account", "👤", "Account"]].forEach(function (v) {
      nav.appendChild(el("a", { href: "#" + v[0], "aria-current": attivo === v[0] ? "page" : null }, [el("span", { "aria-hidden": "true", text: v[1] }), v[2]]));
    });
  }

  /* ======================= classes ======================= */
  function paginaClassi() {
    menuNav("classi");
    carica(API.classi(), function (l) {
      app.innerHTML = "";
      app.appendChild(el("div", { class: "gufo-box", style: "margin-top:12px" }, [
        el("div", { html: N.gufo("felice") }).firstChild,
        el("div", { class: "fumetto", text: "Ciao " + (s.utente.nome || "") + "! Crea una classe, aggiungi gli alunni e pubblica quiz e mini-giochi." })
      ]));
      app.appendChild(el("h2", { class: "sezione", text: "🏫 Le mie classi" }));
      var lista = el("div", { class: "lista" });
      if (!l.length) lista.appendChild(el("p", { class: "vuoto", text: "Non hai ancora classi." }));
      l.forEach(function (c) {
        lista.appendChild(el("a", { class: "riga-el", href: "#classe/" + encodeURIComponent(c.id) }, [
          el("span", { class: "ico", "aria-hidden": "true", text: "🏫" }),
          el("span", { class: "dati" }, [el("b", { text: c.nome }), el("span", { text: (N.CLASSI[c.anno] || "") + " · " + plur(c.alunni || 0, "alunno", "alunni") })])
        ]));
      });
      app.appendChild(lista);
      app.appendChild(el("div", { class: "azioni" }, [el("button", { class: "btn", type: "button", text: "➕ Nuova classe", onclick: nuovaClasse })]));
      app.appendChild(el("p", { class: "nota" }, [
        "Prima di inserire gli alunni, fai adattare alla tua scuola l'", el("a", { href: "privacy.html", text: "informativa sulla privacy" }), ". ",
        "Per gli alunni usa solo il nome o un soprannome: niente cognomi."
      ]));
    }, "Carico le tue classi…");
  }
  function nuovaClasse() {
    CL.chiedi({
      titolo: "Nuova classe", si: "Crea",
      campi: [{ id: "nome", etichetta: "Nome della classe", attr: { maxlength: "40", placeholder: "es. 4ª B – Scuola Rodari" } },
        { id: "anno", etichetta: "Che classe è?", tipo: "select", opzioni: N.CLASSI, valore: 1 }],
      valida: function (v) { return v.nome.trim() ? "" : "Scrivi il nome della classe."; },
      esegui: function (v) { return API.creaClasse(v.nome.trim(), v.anno); }
    }).then(function (c) { if (c && c.id) location.hash = "#classe/" + encodeURIComponent(c.id) + "/alunni"; });
  }

  /* ======================= one class ======================= */
  function paginaClasse(cid, tab) {
    menuNav("classi");
    tab = ["alunni", "pubblicati", "risultati"].indexOf(tab) >= 0 ? tab : "alunni";
    carica(API.classe(cid), function (c) {
      app.innerHTML = "";
      app.appendChild(el("p", { style: "margin:12px 0 0" }, [el("a", { href: "#classi", text: "← Tutte le classi" })]));
      app.appendChild(el("div", { class: "testa-classe" }, [
        el("div", { style: "flex:1;min-width:0" }, [el("h1", { text: c.nome }), el("div", { class: "nota", style: "margin:2px 0 0", text: N.CLASSI[c.anno] || "" })]),
        el("button", { class: "btn-ico", type: "button", "aria-label": "Modifica nome e anno della classe", text: "✏️", onclick: function () { modificaClasse(c); } }),
        el("button", { class: "btn-ico pericolo", type: "button", "aria-label": "Elimina la classe", text: "🗑", onclick: function () { eliminaClasse(c); } })
      ]));
      var seg = el("div", { class: "segmenti", role: "tablist", "aria-label": "Sezioni della classe" });
      [["alunni", "👧 Alunni (" + c.alunni.length + ")"], ["pubblicati", "📌 Pubblicati (" + c.pubblicati.length + ")"], ["risultati", "📊 Risultati"]].forEach(function (t) {
        seg.appendChild(el("button", { type: "button", role: "tab", "aria-selected": String(t[0] === tab), text: t[1],
          onclick: function () { location.hash = "#classe/" + encodeURIComponent(cid) + "/" + t[0]; } }));
      });
      app.appendChild(seg);
      var corpo = el("section", { role: "tabpanel" });
      app.appendChild(corpo);
      if (tab === "alunni") alunni(c, corpo);
      else if (tab === "pubblicati") pubblicati(c, corpo);
      else risultati(c, corpo);
    }, "Apro la classe…");
  }
  function modificaClasse(c) {
    CL.chiedi({
      titolo: "Modifica la classe", si: "Salva",
      campi: [{ id: "nome", etichetta: "Nome della classe", valore: c.nome, attr: { maxlength: "40" } },
        { id: "anno", etichetta: "Che classe è?", tipo: "select", opzioni: N.CLASSI, valore: c.anno }],
      valida: function (v) { return v.nome.trim() ? "" : "Scrivi il nome della classe."; },
      esegui: function (v) { return API.modificaClasse(c.id, { nome: v.nome.trim(), anno: v.anno }); }
    }).then(function (r) { if (r) router(); });
  }
  function eliminaClasse(c) {
    CL.chiedi({
      titolo: "Eliminare la classe «" + c.nome + "»?", pericolo: true, si: "Elimina per sempre",
      testo: "Verranno cancellati per sempre:\n• " + plur(c.alunni.length, "account alunno", "account degli alunni") + "\n• tutti i loro risultati\n\nI tuoi quiz e mini-giochi restano. Non si può annullare.\n\nPer confermare scrivi il nome della classe.",
      campi: [{ id: "conf", etichetta: "Nome della classe", attr: { placeholder: c.nome } }],
      valida: function (v) { return v.conf.trim() === c.nome.trim() ? "" : "Il nome non corrisponde: scrivi «" + c.nome + "»."; },
      esegui: function () { return API.eliminaClasse(c.id); }
    }).then(function (r) { if (r) { N.esito("info", "Classe eliminata"); location.hash = "#classi"; } });
  }

  /* ---------------- pupils ---------------- */
  function alunni(c, box) {
    box.appendChild(el("div", { class: "azioni" }, [el("button", { class: "btn", type: "button", text: "➕ Aggiungi alunni", onclick: function () { aggiungiAlunni(c); } })]));
    if (!c.alunni.length) {
      box.appendChild(el("p", { class: "vuoto", text: "Nessun alunno. Tocca «Aggiungi alunni» e incolla i nomi, uno per riga: creerò per ognuno un nome utente e una parola segreta da stampare." }));
      return;
    }
    var lista = el("div", { class: "lista" });
    c.alunni.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome, "it"); }).forEach(function (a) {
      lista.appendChild(el("div", { class: "riga-el" }, [
        el("span", { class: "ico", "aria-hidden": "true", text: "🧒" }),
        el("div", { class: "dati" }, [el("b", { text: a.nome }), el("span", { text: a.username }),
          el("small", { text: "⭐ " + (a.stelle || 0) + " · " + plur(a.attivita || 0, "attività", "attività") + " · " + (a.ultimo ? "ultima: " + API.data(a.ultimo) : "mai entrato") })]),
        el("button", { class: "btn-ico", type: "button", "aria-label": "Azioni per " + a.nome, text: "⋯", onclick: function () { azioniAlunno(c, a); } })
      ]));
    });
    box.appendChild(lista);
    box.appendChild(el("p", { class: "nota", text: "Le parole segrete non si possono rivedere: se un alunno perde il cartellino, usa «Nuova parola segreta» e stampa la nuova scheda." }));
  }
  function aggiungiAlunni(c) {
    function nomi(t) { return t.split(/\r?\n/).map(function (x) { return x.replace(/\s+/g, " ").trim(); }).filter(Boolean); }
    CL.chiedi({
      titolo: "Aggiungi alunni", si: "Crea gli account",
      testo: "Scrivi o incolla i nomi, uno per riga (massimo 60 alla volta). Usa solo il nome o un soprannome, senza cognome.",
      campi: [{ id: "nomi", etichetta: "Nomi degli alunni", tipo: "textarea", attr: { rows: "8", placeholder: "Anna\nLuca\nMarco B.", autocapitalize: "words", spellcheck: "false" } }],
      valida: function (v) {
        var l = nomi(v.nomi);
        if (!l.length) return "Scrivi almeno un nome.";
        if (l.length > 60) return "Sono " + l.length + " nomi: al massimo 60 alla volta.";
        var lungo = l.filter(function (x) { return x.length > 40; })[0];
        if (lungo) return "Questo nome è troppo lungo: «" + lungo.slice(0, 20) + "…» (massimo 40 caratteri).";
        return "";
      },
      esegui: function (v) { return API.aggiungiAlunni(c.id, nomi(v.nomi)); }
    }).then(function (creati) {
      if (!creati || !creati.length) return;
      N.suono.ok();
      schede(c, creati, true);
    });
  }
  function azioniAlunno(c, a) {
    var nodo = el("div", { class: "lista" }, [
      el("p", { class: "nota", style: "margin:0", text: "Nome utente: " + a.username }),
      el("button", { class: "btn secondario blocco", type: "button", text: "✏️ Cambia nome", onclick: function () { N.chiudiDialogo(null); rinomina(a); } }),
      el("button", { class: "btn secondario blocco", type: "button", text: "🔑 Nuova parola segreta", onclick: function () { N.chiudiDialogo(null); nuovaPassword(c, a); } }),
      el("button", { class: "btn pericolo blocco", type: "button", text: "🗑 Elimina alunno", onclick: function () { N.chiudiDialogo(null); eliminaAlunno(a); } })
    ]);
    N.dialogo({ titolo: a.nome, nodo: nodo, pulsanti: [{ testo: "Chiudi", valore: null, secondario: true }] });
  }
  function rinomina(a) {
    CL.chiedi({
      titolo: "Cambia nome", si: "Salva",
      campi: [{ id: "nome", etichetta: "Nome (o soprannome)", valore: a.nome, attr: { maxlength: "40" } }],
      valida: function (v) { return v.nome.trim() ? "" : "Scrivi un nome."; },
      esegui: function (v) { return API.rinominaAlunno(a.id, v.nome.trim()); }
    }).then(function (r) { if (r) { N.esito("si", "Nome cambiato"); router(); } });
  }
  function nuovaPassword(c, a) {
    CL.conferma({ titolo: "Nuova parola segreta per " + a.nome + "?", si: "Sì, creane una nuova",
      testo: "La parola segreta di adesso smetterà di funzionare e " + a.nome + " dovrà rientrare con quella nuova su tutti i dispositivi. I risultati restano." })
      .then(function (si) {
        if (!si) return;
        API.nuovaPassword(a.id).then(function (r) {
          schede(c, [{ id: a.id, nome: a.nome, username: r.username || a.username, password: r.password }], false);
        }, problema);
      });
  }
  function eliminaAlunno(a) {
    CL.conferma({ titolo: "Eliminare " + a.nome + "?", si: "Elimina per sempre",
      testo: "L'account «" + a.username + "» e tutti i suoi risultati verranno cancellati per sempre. Non si può annullare." })
      .then(function (si) {
        if (!si) return;
        API.eliminaAlunno(a.id).then(function () { N.esito("info", a.nome + " eliminato"); router(); }, problema);
      });
  }

  /* ---------------- printable login cards (8 per A4) ---------------- */
  function indirizzo() {
    var u = new URL("accedi.html", location.href); u.hash = ""; u.search = "";
    return u.href;
  }
  function schede(c, creati, nuovi) {
    var stampato = false, sito = indirizzo();
    var fogli = el("div", { class: "fogli" });
    for (var i = 0; i < creati.length; i += 8) {
      var f = el("div", { class: "foglio" });
      creati.slice(i, i + 8).forEach(function (a) {
        f.appendChild(el("article", { class: "tessera", "aria-label": "Scheda di " + a.nome }, [
          el("div", { html: N.gufo("felice") }).firstChild,
          el("div", { class: "t-testa" }, ["Impara giocando", el("small", { text: "La mia classe · " + c.nome })]),
          el("dl", {}, [
            el("dt", { text: "Nome" }), el("dd", { class: "nome", text: a.nome }),
            el("dt", { text: "Utente" }), el("dd", { class: "cred", text: a.username }),
            el("dt", { text: "Parola segreta" }), el("dd", { class: "cred", text: a.password }),
            el("dt", { text: "Sito" }), el("dd", { class: "sito", text: sito })
          ]),
          el("p", { class: "t-nota", text: "Apri il sito, tocca «Sono un alunno» e scrivi utente e parola segreta. Non dirli a nessuno! 🤫" })
        ]));
      });
      fogli.appendChild(f);
    }
    var vista = el("div", { class: "stampa-vista", role: "dialog", "aria-modal": "true", "aria-labelledby": "stampa-t" }, [
      el("div", { class: "stampa-barra" }, [
        el("div", { class: "riga" }, [
          el("h2", { id: "stampa-t", style: "margin:0;flex:1;font-size:20px;min-width:200px", text: "🪪 Schede di accesso · " + c.nome }),
          el("button", { class: "btn piccolo", type: "button", id: "btn-stampa", text: "🖨️ Stampa", onclick: function () { stampato = true; window.print(); } }),
          el("button", { class: "btn secondario piccolo", type: "button", id: "btn-finito", text: "✅ Ho finito", onclick: chiudi })
        ]),
        el("div", { class: "avviso-box", role: "alert" }, [
          "⚠️ ", el("b", { text: "Le parole segrete si vedono solo adesso." }),
          " Stampa le schede (" + plur(creati.length, "scheda", "schede") + ", 8 per foglio A4) o copiale in un posto sicuro: dopo non potrai più rivederle, potrai solo crearne di nuove." +
          (nuovi ? "" : " La vecchia parola segreta non funziona più.")
        ])
      ]),
      fogli
    ]);
    function chiudi() {
      var dopo = function () { vista.remove(); document.removeEventListener("keydown", esc, true); router(); };
      if (stampato) return dopo();
      CL.conferma({ titolo: "Hai salvato le parole segrete?", testo: "Non hai ancora stampato le schede. Se chiudi, le parole segrete non si potranno più vedere.", si: "Sì, chiudi", no: "Torna alle schede" })
        .then(function (si) { if (si) dopo(); });
    }
    function esc(e) { if (e.key === "Escape" && !N.$(".velo")) { e.preventDefault(); chiudi(); } }
    document.addEventListener("keydown", esc, true);
    document.body.appendChild(vista);
    N.$("#btn-stampa").focus();
  }

  /* ---------------- published items ---------------- */
  function pubblicati(c, box) {
    var mio = giro;
    box.appendChild(el("div", { class: "carico", text: "Carico quiz e mini-giochi…" }));
    Promise.all([API.quizLista(), API.appLista()]).then(function (r) {
      if (mio !== giro) return;
      box.innerHTML = "";
      box.appendChild(el("p", { class: "nota", text: "Accendi l'interruttore per far vedere un quiz o un mini-gioco agli alunni di questa classe." }));
      [["quiz", "📝 Quiz", r[0], "#quiz", "Carica un quiz"], ["app", "🎲 Mini-giochi", r[1], "#app", "Carica un mini-gioco"]].forEach(function (g) {
        box.appendChild(el("h2", { class: "sezione", text: g[1] }));
        if (!g[2].length) { box.appendChild(el("p", { class: "vuoto" }, ["Non hai ancora niente online. ", el("a", { href: g[3], text: g[4] })])); return; }
        var lista = el("div", { class: "lista" });
        g[2].forEach(function (x) {
          var cb = el("input", { type: "checkbox", role: "switch", "aria-label": "Pubblica «" + x.titolo + "» in " + c.nome });
          cb.checked = (x.classi || []).indexOf(c.id) >= 0;
          cb.addEventListener("change", function () {
            var acceso = cb.checked;
            cb.disabled = true;
            (acceso ? API.pubblica(c.id, g[0], x.id) : API.ritira(c.id, g[0], x.id)).then(function () {
              cb.disabled = false;
              N.esito(acceso ? "si" : "info", acceso ? "Pubblicato!" : "Tolto dalla classe");
            }, function (e) { cb.disabled = false; cb.checked = !acceso; problema(e); });
          });
          lista.appendChild(el("label", { class: "interruttore-riga" }, [
            el("span", { class: "ico", "aria-hidden": "true", text: g[0] === "quiz" ? "📝" : "🎲" }),
            el("span", { class: "dati" }, [el("b", { text: x.titolo }), el("small", { text: "aggiornato il " + API.data(x.aggiornato) })]),
            cb
          ]));
        });
        box.appendChild(lista);
      });
    }, function (e) { if (mio === giro) { box.innerHTML = ""; box.appendChild(el("p", { class: "errore-msg", text: e.message })); } });
  }

  /* ---------------- results ---------------- */
  function risultati(c, box) {
    var mio = giro;
    box.appendChild(el("div", { class: "carico", text: "Carico i risultati…" }));
    Promise.all([API.risultatiClasse(c.id), API.quizLista().catch(function () { return []; }), API.appLista().catch(function () { return []; })]).then(function (r) {
      if (mio !== giro) return;
      var ris = r[0] || [], titoli = {};
      r[1].forEach(function (q) { titoli["quiz:" + q.id] = q.titolo; });
      r[2].forEach(function (a) { titoli["app:" + a.id] = a.titolo; });
      c.pubblicati.forEach(function (p) { titoli[p.tipo + ":" + p.id] = p.titolo; });
      box.innerHTML = "";
      if (!ris.length) {
        box.appendChild(el("p", { class: "vuoto", text: "Ancora nessun risultato. Quando gli alunni giocano dopo essere entrati con il loro cartellino, qui vedrai le loro stelle." }));
        return;
      }
      box.appendChild(el("div", { class: "azioni" }, [el("button", { class: "btn secondario", type: "button", text: "⬇️ Scarica CSV (Excel)", onclick: function () { esportaCSV(c, ris, titoli); } })]));

      // per pupil: best stars per activity, summed
      var per = {};
      c.alunni.forEach(function (a) { per[a.id] = { a: a, att: {}, ultimo: null, n: 0 }; });
      ris.forEach(function (x) {
        var p = per[x.alunno_id] || (per[x.alunno_id] = { a: { id: x.alunno_id, nome: x.nome, username: x.username }, att: {}, ultimo: null, n: 0 });
        var t = p.att[x.attivita] || (p.att[x.attivita] = { migliore: 0, volte: 0, ultimo: null });
        t.migliore = Math.max(t.migliore, x.stelle | 0); t.volte++;
        if (!t.ultimo || String(x.creato) > String(t.ultimo)) t.ultimo = x.creato;
        if (!p.ultimo || String(x.creato) > String(p.ultimo)) p.ultimo = x.creato;
        p.n++;
      });
      box.appendChild(el("h2", { class: "sezione", text: "👧 Per alunno" }));
      var righe = Object.keys(per).map(function (k) {
        var p = per[k], st = 0;
        Object.keys(p.att).forEach(function (a) { st += p.att[a].migliore; });
        p.stelle = st; return p;
      }).sort(function (a, b) { return b.stelle - a.stelle || a.a.nome.localeCompare(b.a.nome, "it"); });
      box.appendChild(el("p", { class: "nota", text: "Stelle = somma della stella migliore in ogni attività. Tocca un nome per il dettaglio." }));
      box.appendChild(tabella(["Alunno", "Stelle", "Attività", "Ultima attività"], righe.map(function (p) {
        return [
          el("button", { class: "link", type: "button", text: p.a.nome, onclick: function () { dettaglioAlunno(p, titoli); } }),
          { num: true, t: "⭐ " + p.stelle }, { num: true, t: String(Object.keys(p.att).length) }, p.ultimo ? API.data(p.ultimo) : "—"
        ];
      })));

      // per activity
      var att = {};
      ris.forEach(function (x) {
        var t = att[x.attivita] || (att[x.attivita] = { alunni: {}, volte: 0 });
        t.volte++; t.alunni[x.alunno_id] = Math.max(t.alunni[x.alunno_id] || 0, x.stelle | 0);
      });
      box.appendChild(el("h2", { class: "sezione", text: "🧩 Per attività" }));
      box.appendChild(tabella(["Attività", "Alunni", "Media ⭐", "Giri"], Object.keys(att).map(function (k) {
        var t = att[k], ids = Object.keys(t.alunni), somma = 0;
        ids.forEach(function (i) { somma += t.alunni[i]; });
        return { ord: ids.length, r: [API.nomeAttivita(k, titoli), { num: true, t: String(ids.length) }, { num: true, t: (somma / ids.length).toFixed(1).replace(".", ",") }, { num: true, t: String(t.volte) }] };
      }).sort(function (a, b) { return b.ord - a.ord; }).map(function (x) { return x.r; })));
      box.appendChild(el("p", { class: "nota", text: "Media ⭐ = media della stella migliore degli alunni che l'hanno provata." }));
    }, function (e) { if (mio === giro) { box.innerHTML = ""; box.appendChild(el("p", { class: "errore-msg", text: e.message })); } });
  }
  function tabella(intest, righe) {
    var t = el("table", { class: "tab" }, [
      el("thead", {}, [el("tr", {}, intest.map(function (h, i) { return el("th", { scope: "col", class: i > 0 && i < 3 ? "num" : null, text: h }); }))]),
      el("tbody", {}, righe.map(function (r) {
        return el("tr", {}, r.map(function (c) {
          if (c && c.nodeType) return el("td", {}, [c]);
          if (c && typeof c === "object") return el("td", { class: c.num ? "num" : null, text: c.t });
          return el("td", { text: String(c) });
        }));
      }))
    ]);
    return el("div", { class: "tabella-box" }, [t]);
  }
  function dettaglioAlunno(p, titoli) {
    var righe = Object.keys(p.att).map(function (k) { return [k, p.att[k]]; }).sort(function (a, b) { return String(b[1].ultimo).localeCompare(String(a[1].ultimo)); });
    var nodo = el("div", {}, [
      el("p", { class: "nota", style: "margin-top:0", text: p.a.username + " · ⭐ " + p.stelle + " · " + plur(p.n, "giro", "giri") }),
      righe.length ? tabella(["Attività", "Migliore", "Giri", "Ultima volta"], righe.map(function (r) {
        return [API.nomeAttivita(r[0], titoli), { num: true, t: API.stelline(r[1].migliore) }, { num: true, t: String(r[1].volte) }, API.data(r[1].ultimo)];
      })) : el("p", { text: "Nessun risultato." })
    ]);
    N.dialogo({ titolo: p.a.nome, nodo: nodo });
  }
  function csv(v) { v = v == null ? "" : String(v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function esportaCSV(c, ris, titoli) {
    var righe = [["Alunno", "Utente", "Attività", "Codice attività", "Stelle", "Corrette", "Totali", "Data"]];
    ris.forEach(function (x) {
      righe.push([x.nome, x.username, API.nomeAttivita(x.attivita, titoli).replace(/^\S+\s/, ""), x.attivita, x.stelle, x.corrette == null ? "" : x.corrette, x.totali == null ? "" : x.totali, API.dataOra(x.creato)]);
    });
    // ";" and a BOM: opens correctly in Excel with Italian settings
    var testo = "﻿" + righe.map(function (r) { return r.map(csv).join(";"); }).join("\r\n") + "\r\n";
    var nome = "risultati-" + c.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + new Date().toISOString().slice(0, 10) + ".csv";
    API.scaricaFile(nome, testo, "text/csv;charset=utf-8");
  }

  /* ======================= my quizzes online ======================= */
  function locali() { var l = N.leggi("quiz", []); return Array.isArray(l) ? l : []; }
  function paginaQuiz() {
    menuNav("quiz");
    carica(API.quizLista(), function (online) {
      var perId = {}; online.forEach(function (q) { perId[q.id] = q; });
      var mappa = API.mappaQuiz(), localePer = {};
      locali().forEach(function (q) { if (mappa[q.id]) localePer[mappa[q.id]] = q; });
      app.innerHTML = "";
      app.appendChild(h1("📝 I miei quiz online"));
      app.appendChild(el("p", { class: "nota", text: "I quiz online si possono pubblicare nelle tue classi (Classi → Pubblicati)." }));
      var lista = el("div", { class: "lista" });
      if (!online.length) lista.appendChild(el("p", { class: "vuoto", text: "Nessun quiz online. Caricane uno dall'elenco qui sotto." }));
      online.forEach(function (q) {
        var loc = localePer[q.id];
        lista.appendChild(el("div", { class: "riga-el" }, [
          el("span", { class: "ico", "aria-hidden": "true", text: "📝" }),
          el("div", { class: "dati" }, [el("b", { text: q.titolo }),
            el("span", { text: "aggiornato il " + API.data(q.aggiornato) + " · " + ((q.classi || []).length ? "in " + plur(q.classi.length, "classe", "classi") : "non pubblicato") })]),
          el("a", { class: "btn-ico", href: "../quiz/gioca.html?classe=" + encodeURIComponent(q.id), "aria-label": "Prova «" + q.titolo + "»", text: "▶️", style: "display:grid;place-items:center;text-decoration:none" }),
          loc ? el("button", { class: "btn-ico", type: "button", "aria-label": "Aggiorna «" + q.titolo + "» con la versione di questo dispositivo", text: "🔄", onclick: function () { caricaLocale(loc); } }) : null,
          el("button", { class: "btn-ico pericolo", type: "button", "aria-label": "Elimina «" + q.titolo + "» dal server", text: "🗑", onclick: function () { eliminaQuiz(q); } })
        ]));
      });
      app.appendChild(lista);

      app.appendChild(el("h2", { class: "sezione", text: "📱 Quiz su questo dispositivo" }));
      var loc = locali();
      if (!loc.length) app.appendChild(el("p", { class: "vuoto" }, ["Non hai quiz su questo dispositivo. ", el("a", { href: "../insegnanti/modifica.html", text: "Crea un quiz" })]));
      var l2 = el("div", { class: "lista" });
      loc.forEach(function (q) {
        var sid = mappa[q.id], giaOnline = sid && perId[sid];
        l2.appendChild(el("div", { class: "riga-el" }, [
          el("span", { class: "ico", "aria-hidden": "true", text: MATERIE[q.materia] || "🍎" }),
          el("div", { class: "dati" }, [el("b", { text: q.titolo || "Quiz senza titolo" }), el("span", { text: plur((q.domande || []).length, "domanda", "domande") + (giaOnline ? " · già online" : "") })]),
          el("button", { class: "btn piccolo", type: "button", text: giaOnline ? "🔄 Aggiorna" : "☁️ Carica", "aria-label": (giaOnline ? "Aggiorna online «" : "Carica online «") + (q.titolo || "") + "»", onclick: function () { caricaLocale(q); } })
        ]));
      });
      app.appendChild(l2);
      app.appendChild(el("p", { class: "nota" }, ["I quiz si creano e si modificano in ", el("a", { href: "../insegnanti/index.html", text: "Per gli insegnanti" }), ". Dopo una modifica, tocca «Aggiorna» per mandare la nuova versione."]));
    }, "Carico i tuoi quiz…");
  }
  function caricaLocale(q) {
    if (!(q.domande || []).length) return N.dialogo({ titolo: "Quiz vuoto", testo: "Questo quiz non ha domande." });
    N.esito("info", "Carico…", 900);
    API.caricaQuizLocale(q).then(function (r) {
      N.suono.ok();
      N.esito("si", r.nuovo ? "Quiz caricato!" : "Quiz aggiornato!");
      router();
    }, problema);
  }
  function eliminaQuiz(q) {
    CL.conferma({ titolo: "Eliminare «" + q.titolo + "» dal server?", si: "Elimina dal server",
      testo: "Il quiz sparirà da tutte le classi in cui è pubblicato. I risultati già ottenuti dagli alunni restano. La copia su questo dispositivo (se c'è) non viene toccata." })
      .then(function (si) { if (si) API.eliminaQuiz(q.id).then(function () { N.esito("info", "Quiz eliminato dal server"); router(); }, problema); });
  }

  /* ======================= my mini-games ======================= */
  function paginaApp() {
    menuNav("app");
    carica(API.appLista(), function (l) {
      app.innerHTML = "";
      app.appendChild(h1("🎲 I miei mini-giochi"));
      app.appendChild(el("p", { class: "nota" }, ["Un mini-gioco è un file HTML che scrivi tu (o che ti fai aiutare a scrivere). ",
        el("a", { href: "mini-giochi.html", text: "Come si scrive un mini-gioco" }), " · ", el("a", { href: "modello-minigioco.html", download: "modello-minigioco.html", text: "Scarica il modello" })]));
      app.appendChild(el("div", { class: "azioni" }, [el("button", { class: "btn", type: "button", text: "➕ Nuovo mini-gioco", onclick: function () { editorApp(null); } })]));
      var lista = el("div", { class: "lista" });
      if (!l.length) lista.appendChild(el("p", { class: "vuoto", text: "Nessun mini-gioco caricato." }));
      l.forEach(function (a) {
        lista.appendChild(el("div", { class: "riga-el" }, [
          el("span", { class: "ico", "aria-hidden": "true", text: "🎲" }),
          el("div", { class: "dati" }, [el("b", { text: a.titolo }), a.descrizione ? el("span", { text: a.descrizione }) : null,
            el("small", { text: kB(a.dimensione || 0) + " · " + API.data(a.aggiornato) + " · " + ((a.classi || []).length ? "in " + plur(a.classi.length, "classe", "classi") : "non pubblicato") })]),
          el("a", { class: "btn-ico", href: "app.html?id=" + encodeURIComponent(a.id), "aria-label": "Prova «" + a.titolo + "»", text: "▶️", style: "display:grid;place-items:center;text-decoration:none" }),
          el("button", { class: "btn-ico", type: "button", "aria-label": "Modifica «" + a.titolo + "»", text: "✏️", onclick: function () { API.getApp(a.id).then(editorApp, problema); } }),
          el("button", { class: "btn-ico pericolo", type: "button", "aria-label": "Elimina «" + a.titolo + "»", text: "🗑", onclick: function () { eliminaApp(a); } })
        ]));
      });
      app.appendChild(lista);
    }, "Carico i tuoi mini-giochi…");
  }
  function editorApp(a) {
    ++giro;
    var html = a ? a.html : "";
    app.innerHTML = "";
    app.appendChild(el("p", { style: "margin:12px 0 0" }, [el("a", { href: "#app", text: "← I miei mini-giochi", onclick: function (e) { e.preventDefault(); router(); } })]));
    app.appendChild(h1(a ? "✏️ Modifica mini-gioco" : "➕ Nuovo mini-gioco"));
    var titolo = el("input", { class: "campo", id: "app-titolo", maxlength: "80", required: true, placeholder: "es. Le capitali d'Europa" });
    var descr = el("input", { class: "campo", id: "app-descr", maxlength: "200", placeholder: "Una frase per gli alunni (facoltativa)" });
    titolo.value = a ? a.titolo : ""; descr.value = a && a.descrizione || "";
    var file = el("input", { type: "file", id: "app-file", accept: ".html,.htm,text/html", class: "sr" });
    var codice = el("textarea", { class: "campo codice", id: "app-html", spellcheck: "false", autocapitalize: "none", autocorrect: "off", placeholder: "<!doctype html>\n<html>…</html>" });
    codice.value = html;
    var info = el("p", { class: "nota", id: "app-dim", "aria-live": "polite" });
    var err = el("p", { class: "errore-msg", role: "alert" });
    function dim() {
      var n = API.byte(codice.value);
      info.textContent = "Dimensione: " + kB(n) + " su 1 MB" + (n > API.MAX_APP ? " — troppo grande!" : "");
      info.style.color = n > API.MAX_APP ? "#b4232a" : "";
    }
    codice.addEventListener("input", dim);
    file.addEventListener("change", function () {
      var f = file.files && file.files[0];
      file.value = "";
      if (!f) return;
      if (f.size > API.MAX_APP) { err.textContent = "Il file è troppo grande (" + kB(f.size) + "): il massimo è 1 MB."; return; }
      f.text().then(function (t) {
        codice.value = t; dim(); err.textContent = "";
        if (!titolo.value.trim()) { var m = /<title[^>]*>([^<]{1,80})<\/title>/i.exec(t); titolo.value = m ? m[1].trim() : f.name.replace(/\.html?$/i, ""); }
        N.esito("si", "File caricato: " + f.name);
      }, function () { err.textContent = "Non riesco a leggere il file."; });
    });
    var salva = el("button", { class: "btn", type: "submit", text: "💾 Salva" });
    var form = el("form", { class: "modulo", style: "max-width:none", novalidate: true }, [
      el("label", { for: "app-titolo", text: "Titolo" }), titolo,
      el("label", { for: "app-descr", text: "Descrizione" }), descr,
      el("label", { for: "app-html", text: "Codice HTML del gioco" }),
      el("div", { class: "riga", style: "margin-bottom:8px" }, [
        el("button", { class: "btn secondario piccolo", type: "button", text: "📂 Scegli un file .html", onclick: function () { file.click(); } }), file
      ]),
      codice, info,
      el("div", { class: "avviso-box", style: "font-size:15px" }, ["🔒 Il gioco gira in una «scatola chiusa»: non può usare Internet, caricare file esterni, né leggere i dati del sito. Immagini e suoni vanno inseriti nel file (data:…). Vedi ", el("a", { href: "mini-giochi.html", text: "la guida" }), "."]),
      err,
      el("div", { class: "azioni" }, [
        el("button", { class: "btn secondario", type: "button", text: "👀 Anteprima", onclick: function () { anteprima(codice.value); } }),
        salva
      ])
    ]);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var dati = { titolo: titolo.value.trim(), descrizione: descr.value.trim(), html: codice.value };
      if (!dati.titolo) { err.textContent = "Scrivi un titolo."; titolo.focus(); return; }
      if (!dati.html.trim()) { err.textContent = "Manca il codice HTML: scegli un file o incollalo."; return; }
      if (API.byte(dati.html) > API.MAX_APP) { err.textContent = "Il gioco è troppo grande: il massimo è 1 MB."; return; }
      if (!/impara\s*["']?\s*:\s*["']risultato/.test(dati.html)) {
        // not an error: just a reminder
        N.esito("info", "Attenzione: il gioco non sembra mandare il risultato", 2600);
      }
      salva.disabled = true; err.textContent = "";
      (a ? API.aggiornaApp(a.id, dati) : API.creaApp(dati)).then(function () {
        N.suono.ok(); N.esito("si", a ? "Mini-gioco aggiornato!" : "Mini-gioco salvato!");
        router();
      }, function (e2) { salva.disabled = false; if (e2.status === 401) return problema(e2); err.textContent = e2.message; });
    });
    app.appendChild(form);
    dim();
    titolo.focus();
  }
  function anteprima(html) {
    if (!html.trim()) return N.dialogo({ titolo: "Anteprima", testo: "Prima scegli un file o incolla il codice." });
    var ifr = document.createElement("iframe");
    ifr.setAttribute("sandbox", "allow-scripts");
    ifr.setAttribute("title", "Anteprima del mini-gioco");
    ifr.setAttribute("referrerpolicy", "no-referrer");
    ifr.srcdoc = API.srcdocApp(html);
    var stato = el("p", { class: "nota", role: "status", "aria-live": "polite", text: "Il gioco gira come lo vedranno gli alunni. Qui sotto vedrai i messaggi che manda." });
    function ascolta(e) {
      var m = API.messaggioApp(e, ifr);
      if (!m) return;
      if (m.tipo === "fine") stato.textContent = "✅ Il gioco ha chiesto di tornare alla classe ({impara:\"fine\"}).";
      else stato.textContent = "✅ Risultato ricevuto: " + API.stelline(m.stelle) + (m.totali ? " · " + m.corrette + " giuste su " + m.totali : "") + ". Agli alunni apparirà la schermata delle stelle.";
    }
    window.addEventListener("message", ascolta);
    var nodo = el("div", {}, [el("div", { class: "anteprima-box" }, [ifr]), stato]);
    var aperta = N.dialogo({ titolo: "Anteprima", nodo: nodo, pulsanti: [{ testo: "Chiudi", valore: null, secondario: true }] });
    var fin = N.$$(".finestra").pop(); if (fin) fin.style.width = "min(860px, 100%)";
    aperta.then(function () { window.removeEventListener("message", ascolta); });
  }
  function eliminaApp(a) {
    CL.conferma({ titolo: "Eliminare «" + a.titolo + "»?", si: "Elimina per sempre",
      testo: "Il mini-gioco sparirà da tutte le classi in cui è pubblicato. I risultati già ottenuti restano. Non si può annullare." })
      .then(function (si) { if (si) API.eliminaApp(a.id).then(function () { N.esito("info", "Mini-gioco eliminato"); router(); }, problema); });
  }

  /* ======================= account ======================= */
  function paginaAccount() {
    menuNav("account");
    ++giro;
    var u = (API.sessione() || s).utente || {};
    app.innerHTML = "";
    app.appendChild(h1("👤 Il mio account"));
    app.appendChild(el("div", { class: "riga-el" }, [el("span", { class: "ico", "aria-hidden": "true", text: "🧑‍🏫" }),
      el("div", { class: "dati" }, [el("b", { text: u.nome || "" }), el("span", { text: u.email || "" })])]));
    app.appendChild(el("div", { class: "lista", style: "margin-top:16px" }, [
      el("button", { class: "btn secondario blocco", type: "button", text: "🔑 Cambia password", onclick: cambiaPassword }),
      el("button", { class: "btn secondario blocco", type: "button", text: "⬇️ Scarica tutti i miei dati (JSON)", onclick: esporta }),
      el("button", { class: "btn secondario blocco", type: "button", text: "🚪 Esci", onclick: esci }),
      el("a", { class: "btn secondario blocco", href: "privacy.html", text: "🔒 Informativa privacy (modello)" })
    ]));
    app.appendChild(el("h2", { class: "sezione", text: "⚠️ Zona pericolosa" }));
    app.appendChild(el("p", { class: "nota", text: "Eliminando l'account cancelli per sempre le tue classi, gli account degli alunni, i loro risultati, i quiz e i mini-giochi online. Prima puoi scaricare i tuoi dati." }));
    app.appendChild(el("button", { class: "btn pericolo blocco", type: "button", text: "🗑 Elimina il mio account", onclick: eliminaAccount }));
  }
  function cambiaPassword() {
    CL.chiedi({
      titolo: "Cambia password", si: "Cambia",
      campi: [{ id: "vecchia", etichetta: "Password attuale", tipo: "password", autocomplete: "current-password" },
        { id: "nuova", etichetta: "Nuova password (almeno 8 caratteri)", tipo: "password", autocomplete: "new-password" },
        { id: "conferma", etichetta: "Ripeti la nuova password", tipo: "password", autocomplete: "new-password" }],
      valida: function (v) {
        if (!v.vecchia) return "Scrivi la password attuale.";
        if (v.nuova.length < 8) return "La nuova password deve avere almeno 8 caratteri.";
        if (v.nuova !== v.conferma) return "Le due nuove password non sono uguali.";
        return "";
      },
      esegui: function (v) { return API.cambiaPassword(v.vecchia, v.nuova); }
    }).then(function (r) { if (r) N.dialogo({ titolo: "Fatto! 🔑", testo: "La password è cambiata." }); });
  }
  function esporta() {
    N.esito("info", "Preparo il file…", 900);
    API.esporta().then(function (d) {
      API.scaricaFile("impara-giocando-miei-dati-" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify(d, null, 2), "application/json");
      N.esito("si", "File scaricato");
    }, problema);
  }
  function esci() {
    CL.conferma({ titolo: "Vuoi uscire?", testo: "Su questo dispositivo dovrai entrare di nuovo con email e password.", si: "Esci" })
      .then(function (si) { if (si) API.esci().then(function () { location.replace("../index.html"); }); });
  }
  function eliminaAccount() {
    CL.chiedi({
      titolo: "Eliminare il tuo account?", pericolo: true, si: "Elimina tutto per sempre",
      testo: "Verranno cancellati PER SEMPRE:\n• le tue classi e gli account di tutti i tuoi alunni\n• tutti i loro risultati\n• i tuoi quiz e mini-giochi online\n\nNon si può annullare. I quiz salvati su questo dispositivo restano.\n\nPer confermare scrivi la tua password.",
      campi: [{ id: "password", etichetta: "La tua password", tipo: "password", autocomplete: "current-password" }],
      valida: function (v) { return v.password ? "" : "Scrivi la tua password."; },
      esegui: function (v) { return API.eliminaAccount(v.password); }
    }).then(function (r) {
      if (!r) return;
      N.dialogo({ titolo: "Account eliminato", testo: "Tutti i tuoi dati online sono stati cancellati." }).then(function () { location.replace("../index.html"); });
    });
  }

  /* ======================= router ======================= */
  function router() {
    var h = decodeURIComponent(location.hash.replace(/^#/, "")), m;
    window.scrollTo(0, 0);
    if ((m = /^classe\/([^/]+)(?:\/(\w+))?$/.exec(h))) return paginaClasse(m[1], m[2]);
    if (h === "quiz") return paginaQuiz();
    if (h === "app") return paginaApp();
    if (h === "account") return paginaAccount();
    return paginaClassi();
  }
  window.addEventListener("hashchange", router);
  router();
})();
