/* EM - Programmazione (exercise editor) */
(function () {
  "use strict";
  var el = D.el;
  var scegli = D.$("#ed-scegli"), titolo = D.$("#ed-titolo"), tab = D.$("#ed-par"), tabs = D.$("#ed-tabs");
  var testo = D.$("#ed-testo"), stato = D.$("#ed-stato"), mediaBox = D.$("#ed-media");
  var es = null, livello = 0, modificato = false, tutte = [];
  var CHIAVI = ["pl", "sg", "pp", "pm", "ti", "pt", "oe"];

  /* ---------- parameters table and level tabs ---------- */
  var celle = {};
  (function () {
    var th = el("tr", null, [el("th", { text: "" })]);
    for (var l = 1; l <= 5; l++) th.appendChild(el("th", { text: "Liv. " + l }));
    th.appendChild(el("th"));
    tab.appendChild(th);
    CHIAVI.forEach(function (k) {
      var tr = el("tr", null, [el("th", { text: { pp: "p+", pm: "p-" }[k] || k })]);
      celle[k] = [];
      for (var l = 0; l < 5; l++) {
        var inp = el("input", { type: "number", min: "0", step: "1", max: k === "oe" ? "1" : null, "aria-label": EMC.ETICHETTE[k] + " livello " + (l + 1) });
        inp.addEventListener("input", function () { modificato = true; aggiornaStato(); });
        celle[k].push(inp);
        tr.appendChild(el("td", null, [inp]));
      }
      tr.appendChild(el("td", { class: "descr", text: EMC.ETICHETTE[k] }));
      tab.appendChild(tr);
    });
    for (var i = 0; i < 5; i++) (function (i) {
      var b = el("button", { type: "button", class: "win-btn", role: "tab", text: "Livello " + (i + 1) });
      b.addEventListener("click", function () { leggi(); livello = i; mostraLivello(); });
      tabs.appendChild(b);
    })(i);
  })();

  function riempiScelta() {
    return EMC.tutte().then(function (l) {
      tutte = l;
      scegli.innerHTML = "";
      tutte.forEach(function (e) { scegli.appendChild(el("option", { value: e.id, text: e.titolo + (e.utente ? " *" : e.modificata ? " (modificata)" : "") })); });
      if (es && !tutte.some(function (e) { return e.id === es.id; })) scegli.appendChild(el("option", { value: es.id, text: es.titolo + " (non salvata)" }));
      if (es) scegli.value = es.id;
    });
  }
  function carica(e) {
    es = JSON.parse(JSON.stringify(e));
    es.media = es.media || {};
    titolo.value = es.titolo;
    CHIAVI.forEach(function (k) { for (var l = 0; l < 5; l++) celle[k][l].value = es.parametri[k][l]; });
    livello = 0; modificato = false;
    D.$("#ed-elimina").textContent = EMC.originale(es.id) ? "Ripristina originale" : "Elimina";
    chiudiZone();
    return riempiScelta().then(function () { mostraLivello(); mostraMedia(); });
  }
  function mostraLivello() {
    D.$$("button", tabs).forEach(function (b, i) {
      b.setAttribute("aria-selected", i === livello);
      b.textContent = "Livello " + (i + 1) + (es.livelli[i] && es.livelli[i].testo.trim() ? "" : " (vuoto)");
    });
    testo.value = (es.livelli[livello] && es.livelli[livello].testo) || "";
    aggiornaStato();
  }
  function leggi() {
    es.titolo = titolo.value.trim() || "Senza titolo";
    CHIAVI.forEach(function (k) { for (var l = 0; l < 5; l++) es.parametri[k][l] = parseInt(celle[k][l].value, 10) || 0; });
    es.livelli[livello] = { intest: (es.livelli[livello] && es.livelli[livello].intest) || "", testo: testo.value.replace(/\s+$/, "") + "\n" };
  }
  function aggiornaStato() {
    var a = EMC.analizzaLivello(testo.value);
    var mancanti = EMC.media(testo.value).filter(function (n) { return !EMC.urlMedia(es, n); });
    var tipi = {};
    a.esercizi.forEach(function (e) { e.passi.forEach(function (p) { tipi[p.tipo] = (tipi[p.tipo] || 0) + 1; }); });
    stato.textContent = "Livello " + (livello + 1) + ": " + a.esercizi.length + " esercizi" +
      (Object.keys(tipi).length ? " (" + Object.keys(tipi).map(function (k) { return k + " " + tipi[k]; }).join(", ") + ")" : "") +
      (a.presentazione.trim() ? " + presentazione" : "") +
      (mancanti.length ? " – ATTENZIONE, file mancanti: " + mancanti.join(", ") : "") + (modificato ? " · non salvato" : "");
  }
  testo.addEventListener("input", function () { modificato = true; aggiornaStato(); });
  titolo.addEventListener("input", function () { modificato = true; });

  function avviso() {
    if (!modificato) return Promise.resolve(true);
    return D.conferma("Non hai salvato l'esercitazione.\nVuoi salvarla?", "Attenzione", true).then(function (r) {
      if (r === null) return false;
      return r ? salva().then(function () { return true; }) : true;
    });
  }
  function salva() {
    leggi();
    return EMC.salva(es).then(function () {
      modificato = false;
      D.$("#ed-elimina").textContent = EMC.originale(es.id) ? "Ripristina originale" : "Elimina";
      return riempiScelta();
    }).then(function () { stato.textContent = "Salvato."; })
      .catch(function (e) { D.msg("Impossibile salvare: " + e.message); });
  }

  scegli.addEventListener("change", function () {
    var id = scegli.value;
    avviso().then(function (ok) {
      if (!ok) { scegli.value = es.id; return; }
      carica(tutte.filter(function (e) { return e.id === id; })[0]);
    });
  });
  D.$("#ed-nuova").addEventListener("click", function () { avviso().then(function (ok) { if (ok) carica(EMC.nuova()).then(function () { modificato = true; titolo.select(); }); }); });
  D.$("#ed-salva").addEventListener("click", salva);
  D.$("#ed-prova").addEventListener("click", function () { salva().then(function () { location.href = "index.html?id=" + encodeURIComponent(es.id); }); });
  D.$("#ed-esporta").addEventListener("click", function () {
    leggi();
    // bundled media are referenced by URL: embed them so the file is self-contained
    var nomi = {};
    es.livelli.forEach(function (l) { EMC.media(l.testo).forEach(function (n) { nomi[n] = 1; }); });
    var lavori = Object.keys(nomi).filter(function (n) { return !es.media[n] && EMC.urlMedia(es, n); }).map(function (n) {
      return fetch(EMC.urlMedia(es, n)).then(function (r) { return r.blob(); }).then(function (b) {
        return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res([n, fr.result]); }; fr.readAsDataURL(b); });
      }).catch(function () { return null; });
    });
    Promise.all(lavori).then(function (r) {
      var c = JSON.parse(JSON.stringify(es));
      r.filter(Boolean).forEach(function (x) { c.media[x[0]] = x[1]; });
      var mancano = Object.keys(nomi).filter(function (n) { return !c.media[n]; });
      delete c.cartella;
      D.scarica(es.titolo.replace(/[^\w\-àèéìòù ]+/gi, "").trim().replace(/\s+/g, "_") + ".em.json", EMC.esporta(c), "application/json");
      if (mancano.length && !location.protocol.startsWith("http")) {
        D.msg("Nota: aprendo il programma direttamente dal disco il browser non permette di includere\nnel file le immagini e i suoni originali: " + mancano.join(", ") + ".\nPubblicando il sito (o usando un server) vengono inclusi automaticamente.");
      }
    });
  });
  function importa(files) {
    EMC.importa(Array.prototype.slice.call(files)).then(function (lista) {
      if (!lista.length) return D.msg("Nessuna esercitazione trovata.\nSeleziona il file .ESE insieme ai suoi .bmp e .wav, oppure la cartella dell'esercitazione, oppure un file .json.");
      return Promise.all(lista.map(function (e) {
        if (!/^U/.test(e.id) || EMC.originale(e.id)) e.id = "U" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1e4);
        delete e.cartella;
        return EMC.salva(e);
      })).then(function () {
        return carica(lista[0]).then(function () {
          D.msg("Importate " + lista.length + " esercitazioni:\n" + lista.map(function (e) { return "- " + e.titolo + " (" + Object.keys(e.media || {}).length + " file multimediali)"; }).join("\n"));
        });
      });
    }).catch(function (e) { D.msg("Errore nella lettura dei file:\n" + e.message); });
  }
  D.$("#ed-importa").addEventListener("click", function () { var f = D.$("#ed-file"); f.value = ""; f.click(); });
  D.$("#ed-importa-dir").addEventListener("click", function () { var f = D.$("#ed-dir"); f.value = ""; f.click(); });
  D.$("#ed-file").addEventListener("change", function () { importa(this.files); });
  D.$("#ed-dir").addEventListener("change", function () { importa(this.files); });
  D.$("#ed-elimina").addEventListener("click", function () {
    var orig = EMC.originale(es.id);
    D.conferma(orig ? "Vuoi annullare le tue modifiche e ripristinare l'esercitazione originale?" : "Vuoi eliminare l'esercitazione \"" + es.titolo + "\"?", "Attenzione").then(function (si) {
      if (!si) return;
      EMC.elimina(es.id).then(function () { modificato = false; return EMC.tutte(); }).then(function (l) { carica(orig || l[0]); });
    });
  });
  D.$("#ed-guida-btn").addEventListener("click", function () { var g = D.$("#ed-guida"); g.hidden = !g.hidden; });
  window.addEventListener("beforeunload", function (e) { if (modificato) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- media ---------- */
  function nomiMedia() {
    var n = {};
    Object.keys(es.media).forEach(function (k) { n[k] = 1; });
    es.livelli.forEach(function (l) { EMC.media(l && l.testo).forEach(function (k) { if (EMC.urlMedia(es, k)) n[k] = 1; }); });
    return Object.keys(n).sort();
  }
  function mostraMedia() {
    mediaBox.innerHTML = "";
    nomiMedia().forEach(function (n) {
      var u = EMC.urlMedia(es, n), fig = el("figure");
      if (EMC.eImmagine(n)) {
        fig.appendChild(el("img", { src: u, alt: n }));
        var z = el("button", { class: "win-btn", type: "button", text: "Punti caldi" });
        z.addEventListener("click", function () { apriZone(n); });
        fig.appendChild(z);
      } else {
        var a = el("button", { class: "win-btn", type: "button", text: "▶ Ascolta" });
        a.addEventListener("click", function () { new Audio(u).play().catch(function () {}); });
        fig.appendChild(a);
      }
      fig.appendChild(el("figcaption", { text: n }));
      if (es.media[n]) {
        var x = el("button", { class: "win-btn", type: "button", text: "Rimuovi" });
        x.addEventListener("click", function () { delete es.media[n]; modificato = true; mostraMedia(); aggiornaStato(); });
        fig.appendChild(x);
      }
      mediaBox.appendChild(fig);
    });
  }
  D.$("#ed-media-agg").addEventListener("click", function () { var f = D.$("#ed-media-file"); f.value = ""; f.click(); });
  D.$("#ed-media-file").addEventListener("change", function () {
    Promise.all(Array.prototype.slice.call(this.files).map(function (f) {
      return D.leggiFile(f, "dataurl").then(function (u) { es.media[f.name.toLowerCase().replace(/\s+/g, "_")] = u; });
    })).then(function () { modificato = true; mostraMedia(); aggiornaStato(); });
  });

  /* ---------- hot-spot editor ("punti caldi") ---------- */
  var zone = [], zImg = null, zNome = "";
  function apriZone(nome) {
    zNome = nome; zone = [];
    var box = D.$("#ed-zone"); box.innerHTML = "";
    var wrap = el("div", { class: "ed-zone-wrap" });
    zImg = el("img", { src: EMC.urlMedia(es, nome), alt: nome, draggable: "false" });
    wrap.appendChild(zImg); box.appendChild(wrap);
    D.$("#ed-zone-box").hidden = false;
    var inizio = null, corrente = null;
    function pt(e) {
      var r = zImg.getBoundingClientRect(), k = zImg.naturalWidth / r.width;
      return [Math.round((e.clientX - r.left) * k), Math.round((e.clientY - r.top) * k)];
    }
    wrap.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      e.preventDefault(); wrap.setPointerCapture(e.pointerId);
      inizio = pt(e); corrente = el("div", { class: "ed-z" + (zone.length ? "" : " giusta") }); wrap.appendChild(corrente);
    });
    wrap.addEventListener("pointermove", function (e) {
      if (!inizio) return;
      var p = pt(e), z = [Math.min(inizio[0], p[0]), Math.min(inizio[1], p[1]), Math.abs(p[0] - inizio[0]), Math.abs(p[1] - inizio[1])];
      posiziona(corrente, z); corrente._z = z;
    });
    wrap.addEventListener("pointerup", function () {
      if (!inizio) return;
      inizio = null;
      if (!corrente._z || corrente._z[2] < 4 || corrente._z[3] < 4) { corrente.remove(); return; }
      var z = corrente._z, d = corrente;
      zone.push(z);
      d.addEventListener("contextmenu", function (ev) { ev.preventDefault(); zone.splice(zone.indexOf(z), 1); d.remove(); ricolora(); });
      ricolora();
    });
    zImg.scrollIntoView({ block: "nearest" });
    ricolora();
  }
  function posiziona(d, z) {
    var W = zImg.naturalWidth || 1, H = zImg.naturalHeight || 1;
    d.style.left = z[0] / W * 100 + "%"; d.style.top = z[1] / H * 100 + "%";
    d.style.width = z[2] / W * 100 + "%"; d.style.height = z[3] / H * 100 + "%";
  }
  function riga() { return zone.length ? "\\|" + zone.map(function (z) { return z.join(" "); }).join("\\") + "\\" : ""; }
  function ricolora() {
    D.$$(".ed-z", D.$("#ed-zone")).forEach(function (d, i) { d.classList.toggle("giusta", i === 0); });
    D.$("#ed-zone-riga").textContent = riga();
  }
  function chiudiZone() { D.$("#ed-zone-box").hidden = true; zone = []; }
  D.$("#ed-zone-canc").addEventListener("click", function () { apriZone(zNome); });
  D.$("#ed-zone-chiudi").addEventListener("click", chiudiZone);
  D.$("#ed-zone-ins").addEventListener("click", function () {
    if (!zone.length) return D.msg("Disegna almeno un quadrato (il primo è la risposta esatta).");
    var p = testo.selectionStart, v = testo.value;
    var ins = (p > 0 && v[p - 1] !== "\n" ? "\n" : "") + zNome + "\n" + riga() + "\n";
    testo.value = v.slice(0, p) + ins + v.slice(p);
    testo.focus(); testo.selectionStart = testo.selectionEnd = p + ins.length;
    modificato = true; aggiornaStato();
  });

  var id = D.param("id");
  EMC.tutte().then(function (l) { carica((id && l.filter(function (e) { return e.id === id; })[0]) || l[0]); });
})();
