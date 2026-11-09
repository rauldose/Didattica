/* E.G. - Programmatore (exercise editor). Replaces the original "Testo" form. */
(function () {
  "use strict";
  var el = D.el;
  var scegli = D.$("#ed-scegli"), titolo = D.$("#ed-titolo"), tab = D.$("#ed-parametri"), tabs = D.$("#ed-tabs");
  var testo = D.$("#ed-testo"), stato = D.$("#ed-stato"), file = D.$("#ed-file");
  var es = null, livello = 0, modificato = false;

  /* ---------- parameter table ---------- */
  var celle = {};
  (function () {
    var th = el("tr", null, [el("th", { text: "" })]);
    for (var l = 1; l <= 5; l++) th.appendChild(el("th", { text: "L" + l }));
    th.appendChild(el("th", { text: "" }));
    tab.appendChild(th);
    EG.CHIAVI.forEach(function (k) {
      var tr = el("tr", null, [el("th", { text: k })]);
      celle[k] = [];
      for (var l = 0; l < 5; l++) {
        var inp = el("input", { class: "dos-input", type: "number", min: "0", step: "1", "aria-label": EG.ETICHETTE[k] + " livello " + (l + 1) });
        inp.addEventListener("input", function () { modificato = true; leggi(); aggiornaStato(); });
        celle[k].push(inp);
        tr.appendChild(el("td", null, [inp]));
      }
      tr.appendChild(el("td", { class: "descr", text: EG.ETICHETTE[k] }));
      tab.appendChild(tr);
    });
    for (var l2 = 0; l2 < 5; l2++) {
      (function (i) {
        var b = el("button", { type: "button", role: "tab", text: "Livello " + (i + 1) });
        b.addEventListener("click", function () { leggi(); livello = i; mostraLivello(); });
        tabs.appendChild(b);
      })(l2);
    }
  })();

  function riempiScelta(idSel) {
    scegli.innerHTML = "";
    EG.tutte().forEach(function (e) {
      scegli.appendChild(el("option", { value: e.id, text: e.titolo + (e.utente ? " *" : e.modificata ? " (modificata)" : "") }));
    });
    if (es && !EG.trova(es.id)) scegli.appendChild(el("option", { value: es.id, text: es.titolo + " (non salvata)" }));
    scegli.value = idSel;
  }
  function carica(e) {
    es = JSON.parse(JSON.stringify(e));
    titolo.value = es.titolo;
    EG.CHIAVI.forEach(function (k) { for (var l = 0; l < 5; l++) celle[k][l].value = es.parametri[k][l]; });
    livello = 0; modificato = false;
    riempiScelta(es.id);
    mostraLivello();
    D.$("#ed-elimina").textContent = EG.originale(es.id) ? "Ripristina originale" : "Elimina";
  }
  function mostraLivello() {
    D.$$("button", tabs).forEach(function (b, i) {
      b.setAttribute("aria-selected", i === livello);
      b.textContent = "Livello " + (i + 1) + (es.livelli[i] ? "" : " (vuoto)");
    });
    testo.value = es.livelli[livello] || "";
    aggiornaStato();
  }
  function leggi() {
    es.titolo = titolo.value.trim() || "Senza titolo";
    EG.CHIAVI.forEach(function (k) { for (var l = 0; l < 5; l++) es.parametri[k][l] = parseInt(celle[k][l].value, 10) || 0; });
    es.livelli[livello] = testo.value.trim() ? testo.value.replace(/\s+$/, "") + "\n" : null;
  }
  function aggiornaStato() {
    var r = EG.analizza(testo.value), n = r.quesiti.length;
    var bad = r.quesiti.filter(function (q) { return !EG.risposte(q).voci.length; }).length;
    stato.textContent = "Livello " + (livello + 1) + ": " + n + " esercizi" + (r.lezione.trim() ? " + presentazione" : "") +
      (bad ? " – ATTENZIONE: " + bad + " senza risposta" : "") + " · livelli giocabili: " + EG.livelliMax(es) + (modificato ? " · non salvato" : "");
  }
  testo.addEventListener("input", function () { modificato = true; aggiornaStato(); });
  titolo.addEventListener("input", function () { modificato = true; });

  function avviso() {
    if (!modificato) return Promise.resolve(true);
    return D.conferma("  ATTENZIONE:\n\n  Non hai salvato il file !! \n\n  vuoi SALVARLO ?? ", " INFORMAZIONE: ", true).then(function (r) {
      if (r === null) return false;
      if (r) salva();
      return true;
    });
  }
  function salva() {
    leggi();
    EG.salva(es);
    modificato = false;
    riempiScelta(es.id);
    D.$("#ed-elimina").textContent = EG.originale(es.id) ? "Ripristina originale" : "Elimina";
    stato.textContent = "Salvato.";
  }

  scegli.addEventListener("change", function () {
    var id = scegli.value;
    avviso().then(function (ok) { if (ok) carica(EG.trova(id)); else scegli.value = es.id; });
  });
  D.$("#ed-nuova").addEventListener("click", function () { avviso().then(function (ok) { if (ok) { carica(EG.nuova()); modificato = true; titolo.focus(); titolo.select(); } }); });
  D.$("#ed-salva").addEventListener("click", salva);
  D.$("#ed-prova").addEventListener("click", function () {
    salva();
    location.href = "index.html?id=" + encodeURIComponent(es.id);
  });
  D.$("#ed-esporta").addEventListener("click", function () {
    leggi();
    D.scarica(es.titolo.replace(/[^\w\-àèéìòù ]+/gi, "").trim().replace(/\s+/g, "_") + ".eg.json", EG.esporta(es), "application/json");
  });
  D.$("#ed-importa").addEventListener("click", function () { file.value = ""; file.click(); });
  file.addEventListener("change", function () {
    var files = Array.prototype.slice.call(file.files);
    var json = files.filter(function (f) { return /\.json$/i.test(f.name); });
    var lavori = json.map(function (f) { return D.leggiFile(f).then(EG.importaJson); });
    lavori.push(EG.importaOriginali(files));
    Promise.all(lavori).then(function (r) {
      var tutte = [].concat.apply([], r).filter(Boolean);
      if (!tutte.length) return D.msg("Nessuna esercitazione trovata.\nSeleziona i file NOME.L1 (e .L2..L5, .DAT) oppure un file .json.");
      tutte.forEach(function (e) {
        if (EG.originale(e.id) || !/^U/.test(e.id)) e.id = "U" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1000);
        EG.salva(e);
      });
      carica(EG.trova(tutte[0].id));
      D.msg("Importate " + tutte.length + " esercitazioni:\n" + tutte.map(function (e) { return "- " + e.titolo; }).join("\n"));
    }).catch(function (err) { D.msg("Errore nella lettura del file:\n" + err.message); });
  });
  D.$("#ed-elimina").addEventListener("click", function () {
    var orig = EG.originale(es.id);
    D.conferma(orig ? "Vuoi annullare le tue modifiche e ripristinare l'esercitazione originale?" : "  ATTENZIONE !!!\n Vuoi eliminare l'esercitazione \"" + es.titolo + "\" ??", "").then(function (si) {
      if (!si) return;
      EG.elimina(es.id);
      carica(orig || EG.tutte()[0]);
    });
  });
  D.$("#ed-guida-btn").addEventListener("click", function () { var g = D.$("#ed-guida"); g.hidden = !g.hidden; });
  window.addEventListener("beforeunload", function (e) { if (modificato) { e.preventDefault(); e.returnValue = ""; } });

  var id = D.param("id");
  carica((id && EG.trova(id)) || EG.tutte()[0]);
})();
