/* "Per gli insegnanti" – quiz editor (modifica.html?id=<id>, or a new quiz) */
(function () {
  "use strict";
  var el = N.el;
  N.testata({ titolo: "Il mio quiz", indietro: "index.html", tema: "t-ins" });

  var id = N.parametro("id"), q = id ? INS.trova(id) : null, esiste = !!q;
  if (id && !q) setTimeout(function () { N.dialogo({ titolo: "Quiz non trovato", testo: "Questo quiz non è in questo dispositivo. Ne creo uno nuovo." }); }, 50);
  q = q ? INS.normalizza(q) : INS.nuovo();
  var aperta = -1;

  /* ---------------- autosave ---------------- */
  var timer = null, avvisato = false;
  function cambiato() { clearTimeout(timer); timer = setTimeout(salvaOra, 350); N.$("#stato").textContent = "…"; }
  function salvaOra() {
    clearTimeout(timer); timer = null;
    if (!esiste && !q.titolo.trim() && !q.domande.length) return true;
    var st = N.$("#stato");
    if (INS.salva(q)) {
      if (!esiste) { esiste = true; try { history.replaceState(null, "", "modifica.html?id=" + encodeURIComponent(q.id)); } catch (e) { /* file:// on some browsers */ } }
      avvisato = false;
      var d = new Date();
      st.className = "stato"; st.textContent = "Salvato ✓ " + d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0");
      return true;
    }
    st.className = "stato errore"; st.textContent = "⚠️ Non salvato: memoria piena";
    if (!avvisato) { avvisato = true; INS.memoriaPiena(); }
    return false;
  }
  window.addEventListener("pagehide", function () { if (timer) salvaOra(); });
  document.addEventListener("visibilitychange", function () { if (document.hidden && timer) salvaOra(); });

  /* ---------------- quiz data ---------------- */
  var tit = N.$("#titolo"), aut = N.$("#autore"), da = N.$("#classe-da"), a = N.$("#classe-a");
  tit.value = q.titolo; aut.value = q.autore;
  tit.addEventListener("input", function () { q.titolo = tit.value; cambiato(); });
  aut.addEventListener("input", function () { q.autore = aut.value; N.scrivi("ins.autore", aut.value.trim()); cambiato(); });
  N.CLASSI.forEach(function (c, i) { da.appendChild(el("option", { value: i, text: c })); a.appendChild(el("option", { value: i, text: c })); });
  da.value = q.classe[0]; a.value = q.classe[1];
  function classi(e) {
    var x = +da.value, y = +a.value;
    if (x > y) { if (e.target === da) a.value = y = x; else da.value = x = y; }
    q.classe = [x, y]; cambiato();
  }
  da.addEventListener("change", classi); a.addEventListener("change", classi);

  var boxMat = N.$("#materia");
  function disegnaMaterie() {
    boxMat.innerHTML = "";
    INS.MATERIE.forEach(function (m) {
      boxMat.appendChild(el("button", { type: "button", class: "chip " + m.tema, role: "radio", "aria-checked": String(q.materia === m.id),
        onclick: function () { q.materia = m.id; disegnaMaterie(); cambiato(); } }, [el("span", { "aria-hidden": "true", text: m.emoji }), m.nome]));
    });
  }
  disegnaMaterie();

  /* ---------------- questions ---------------- */
  var lista = N.$("#domande");
  function disegna() {
    lista.innerHTML = "";
    N.$("#conta").textContent = String(q.domande.length);
    if (!q.domande.length) lista.appendChild(N.gufoDice("Tocca «Aggiungi domanda» per scrivere la prima!", ""));
    q.domande.forEach(function (d, i) { lista.appendChild(carta(d, i)); });
  }

  function riassunto(d, i) {
    var t = INS.TIPI[d.tipo], pr = INS.problemi(d);
    return [
      el("span", { class: "num", "aria-hidden": "true", text: String(i + 1) }),
      el("span", { class: "anteprima" }, [
        el("span", { class: "t", text: d.testo.trim() || "(domanda senza testo)" }),
        el("span", { class: "s" + (pr.length ? " warn" : ""), text: t.emoji + " " + t.nome + (pr.length ? " · ⚠️ " + pr[0] : "") })
      ]),
      d.immagine ? el("img", { class: "mini", src: d.immagine, alt: "" }) : null,
      el("span", { class: "freccia", "aria-hidden": "true", text: aperta === i ? "▲" : "▼" })
    ];
  }
  function aggiornaRiassunto(i) {
    var c = lista.children[i]; if (!c) return;
    var b = N.$(".riassunto", c); b.innerHTML = "";
    riassunto(q.domande[i], i).forEach(function (x) { if (x) b.appendChild(x); });
    var pb = N.$(".problemi-box", c); if (pb) { pb.innerHTML = ""; problemi(q.domande[i], pb); }
  }
  function problemi(d, box) {
    var p = INS.problemi(d);
    if (p.length) box.appendChild(el("ul", { class: "problemi" }, p.map(function (x) { return el("li", { text: x }); })));
  }

  function carta(d, i) {
    var c = el("div", { class: "domanda" + (aperta === i ? " aperta" : ""), id: "d" + i });
    var b = el("button", { type: "button", class: "riassunto", "aria-expanded": String(aperta === i), "aria-label": "Domanda " + (i + 1) + ": " + (d.testo.trim() || INS.TIPI[d.tipo].nome) + (aperta === i ? " (chiudi)" : " (apri)"),
      onclick: function () { aperta = aperta === i ? -1 : i; disegna(); if (aperta >= 0) vediCarta(i); } });
    riassunto(d, i).forEach(function (x) { if (x) b.appendChild(x); });
    c.appendChild(b);
    if (aperta !== i) return c;
    var n = q.domande.length;
    c.appendChild(el("div", { class: "strumenti" }, [
      strumento("⬆️", "Su", "Sposta su", i === 0, function () { sposta(i, -1); }),
      strumento("⬇️", "Giù", "Sposta giù", i === n - 1, function () { sposta(i, 1); }),
      strumento("📑", "Duplica", "Duplica la domanda", false, function () { duplica(i); }),
      strumento("🗑️", "Elimina", "Elimina la domanda", false, function () { elimina(i); }, "pericolo")
    ]));
    var corpo = el("div", { class: "corpo" });
    c.appendChild(corpo);
    editor(d, i, corpo);
    return c;
  }
  function strumento(ico, testo, aria, dis, fn, cls) {
    return el("button", { type: "button", class: "azione" + (cls ? " " + cls : ""), "aria-label": aria, disabled: dis, onclick: fn, style: dis ? "opacity:.4" : null },
      [el("span", { class: "ico", text: ico }), testo]);
  }
  function vediCarta(i) {
    var c = N.$("#d" + i); if (!c) return;
    var r = c.getBoundingClientRect();
    if (r.top < 70 || r.top > innerHeight - 160) window.scrollTo({ top: scrollY + r.top - 76, behavior: "smooth" });
  }

  function sposta(i, dir) {
    var j = i + dir; if (j < 0 || j >= q.domande.length) return;
    var t = q.domande[i]; q.domande[i] = q.domande[j]; q.domande[j] = t;
    aperta = j; disegna(); vediCarta(j); cambiato();
    var bt = N.$("#d" + j + " .strumenti button:nth-child(" + (dir < 0 ? 1 : 2) + ")"); if (bt && !bt.disabled) bt.focus();
  }
  function duplica(i) {
    q.domande.splice(i + 1, 0, INS.copia(q.domande[i]));
    aperta = i + 1; disegna(); vediCarta(i + 1); cambiato(); N.esito("info", "Domanda duplicata");
  }
  function elimina(i) {
    N.dialogo({ titolo: "Eliminare la domanda " + (i + 1) + "?", testo: q.domande[i].testo.trim() || INS.TIPI[q.domande[i].tipo].nome,
      pulsanti: [{ testo: "Elimina", valore: true }, { testo: "Annulla", valore: false, secondario: true }] })
      .then(function (ok) { if (!ok) return; q.domande.splice(i, 1); aperta = -1; disegna(); cambiato(); });
  }

  /* ---------------- one question's editor ---------------- */
  function editor(d, i, corpo) {
    function aggiorna() { aggiornaRiassunto(i); cambiato(); }
    var tid = "testo" + i;
    corpo.appendChild(el("div", {}, [
      el("label", { class: "etic", for: tid, text: d.tipo === "tocca" ? "Cosa deve toccare?" : d.tipo === "vero-falso" ? "La frase (vera o falsa)" : "La domanda" }),
      (function () {
        var t = el("textarea", { class: "campo", id: tid, rows: "3", placeholder: {
          "scelta": "Es. Quanto fa 7 × 8?", "vero-falso": "Es. Il Sole è una stella.", "scrivi": "Es. Il plurale di «uovo» è …", "tocca": "Es. Tocca il cuore"
        }[d.tipo] });
        t.value = d.testo;
        function alto() { t.rows = Math.min(10, Math.max(3, t.value.split("\n").length + 1)); }
        alto();
        t.addEventListener("input", function () { d.testo = t.value; alto(); aggiorna(); });
        return t;
      })()
    ]));
    if (d.tipo !== "tocca") corpo.appendChild(boxImmagine(d, i, false));

    if (d.tipo === "scelta") editorScelta(d, i, corpo, aggiorna);
    else if (d.tipo === "vero-falso") editorVF(d, i, corpo, aggiorna);
    else if (d.tipo === "scrivi") editorScrivi(d, i, corpo, aggiorna);
    else editorTocca(d, i, corpo, aggiorna);

    var pb = el("div", { class: "problemi-box" }); problemi(d, pb); corpo.appendChild(pb);
  }

  function boxImmagine(d, i, perTocca) {
    var box = el("div", { class: "img-box" });
    if (!perTocca) box.appendChild(el("span", { class: "etic", text: "Immagine (facoltativa)" }));
    if (d.immagine && !perTocca) box.appendChild(el("img", { class: "foto", src: d.immagine, alt: "Immagine della domanda " + (i + 1) }));
    var foto = el("input", { type: "file", accept: "image/*", capture: "environment", class: "file-nascosto", tabindex: "-1", "aria-hidden": "true" });
    var file = el("input", { type: "file", accept: "image/*", class: "file-nascosto", tabindex: "-1", "aria-hidden": "true", "data-img": String(i) });
    [foto, file].forEach(function (inp) {
      inp.addEventListener("change", function () {
        var f = inp.files && inp.files[0]; inp.value = "";
        if (!f) return;
        N.$("#stato").textContent = "Preparo l'immagine…";
        INS.immagine(f, 800).then(function (r) {
          var cambiaZone = d.tipo === "tocca" && d.zone.length;
          d.immagine = r.url;
          if (cambiaZone) { d.zone = []; d.giusta = 0; }
          disegna(); cambiato();
          if (cambiaZone) N.esito("info", "Nuova immagine: disegna di nuovo le zone", 2500);
        }, function () { N.$("#stato").textContent = ""; N.dialogo({ titolo: "Immagine non valida", testo: "Non riesco ad aprire questo file. Prova con una foto JPG o PNG." }); });
      });
    });
    var bott = el("div", { class: "img-bottoni" }, [
      el("button", { type: "button", class: "btn secondario piccolo", text: "📷 Scatta foto", onclick: function () { foto.click(); } }),
      el("button", { type: "button", class: "btn secondario piccolo", text: d.immagine ? "🖼️ Cambia immagine" : "🖼️ Scegli immagine", onclick: function () { file.click(); } }),
      d.immagine ? el("button", { type: "button", class: "btn secondario piccolo", text: "✖️ Togli", "aria-label": "Togli l'immagine",
        onclick: function () { d.immagine = null; if (d.tipo === "tocca") { d.zone = []; d.giusta = 0; } disegna(); cambiato(); } }) : null
    ]);
    box.appendChild(bott); box.appendChild(foto); box.appendChild(file);
    return box;
  }

  function radio(acceso, aria, fn) {
    return el("button", { type: "button", class: "radio-giusta", role: "radio", "aria-checked": String(acceso), "aria-label": aria, text: acceso ? "✓" : "", onclick: fn });
  }

  function editorScelta(d, i, corpo, aggiorna) {
    var g = el("div", { class: "zone-lista", role: "radiogroup", "aria-label": "Risposte: tocca il cerchio della risposta giusta" });
    corpo.appendChild(el("div", {}, [el("span", { class: "etic", text: "Risposte (tocca ✓ per quella giusta)" }), g]));
    d.scelte.forEach(function (s, k) {
      var inp = el("input", { class: "campo", type: "text", value: s, placeholder: "Risposta " + (k + 1), "aria-label": "Risposta " + (k + 1) + (d.giusta === k ? " (giusta)" : "") });
      inp.addEventListener("input", function () { d.scelte[k] = inp.value; aggiorna(); });
      g.appendChild(el("div", { class: "voce" }, [
        radio(d.giusta === k, "Segna la risposta " + (k + 1) + " come giusta", function () { d.giusta = k; disegna(); cambiato(); }),
        inp,
        el("button", { type: "button", class: "togli", "aria-label": "Togli la risposta " + (k + 1), text: "✕", disabled: d.scelte.length <= 2, onclick: function () {
          d.scelte.splice(k, 1);
          if (d.giusta === k) d.giusta = 0; else if (d.giusta > k) d.giusta--;
          disegna(); cambiato();
        } })
      ]));
    });
    if (d.scelte.length < 6) corpo.appendChild(el("button", { type: "button", class: "btn secondario", text: "➕ Aggiungi risposta", onclick: function () {
      d.scelte.push(""); disegna(); cambiato();
      var ins = N.$$("#d" + i + " .voce input"); if (ins.length) ins[ins.length - 1].focus();
    } }));
    corpo.appendChild(el("p", { class: "nota", text: "Le risposte saranno mescolate durante il gioco." }));
  }

  function editorVF(d, i, corpo) {
    var g = el("div", { class: "vf", role: "radiogroup", "aria-label": "La frase è" });
    [[true, "👍 Vero"], [false, "👎 Falso"]].forEach(function (v) {
      g.appendChild(el("button", { type: "button", class: "chip", role: "radio", "aria-checked": String(d.giusta === v[0]), text: v[1],
        onclick: function () { d.giusta = v[0]; disegna(); cambiato(); } }));
    });
    corpo.appendChild(el("div", {}, [el("span", { class: "etic", text: "La frase è…" }), g]));
  }

  function editorScrivi(d, i, corpo, aggiorna) {
    var g = el("div", { class: "zone-lista" });
    corpo.appendChild(el("div", {}, [el("span", { class: "etic", text: "Risposte accettate" }), g]));
    d.risposte.forEach(function (s, k) {
      var inp = el("input", { class: "campo", type: "text", value: s, placeholder: k ? "Altra risposta giusta" : "Risposta giusta", "aria-label": "Risposta accettata " + (k + 1), autocapitalize: "off", autocomplete: "off", spellcheck: "false" });
      inp.addEventListener("input", function () { d.risposte[k] = inp.value; aggiorna(); });
      g.appendChild(el("div", { class: "voce" }, [inp,
        el("button", { type: "button", class: "togli", "aria-label": "Togli la risposta " + (k + 1), text: "✕", disabled: d.risposte.length <= 1, onclick: function () { d.risposte.splice(k, 1); disegna(); cambiato(); } })]));
    });
    if (d.risposte.length < 10) corpo.appendChild(el("button", { type: "button", class: "btn secondario", text: "➕ Altra risposta giusta", onclick: function () {
      d.risposte.push(""); disegna(); cambiato();
      var ins = N.$$("#d" + i + " .voce input"); if (ins.length) ins[ins.length - 1].focus();
    } }));
    corpo.appendChild(el("p", { class: "nota", text: "Non contano maiuscole e spazi in più; «perche'» vale come «perché»." }));
    var sid = "sugg" + i, sg = el("input", { class: "campo", id: sid, type: "text", value: d.suggerimento || "", placeholder: "Es. Inizia con la lettera N" });
    sg.addEventListener("input", function () { d.suggerimento = sg.value; aggiorna(); });
    corpo.appendChild(el("div", {}, [el("label", { class: "etic", for: sid, text: "🦉 Suggerimento del gufo (facoltativo)" }), sg]));
  }

  function editorTocca(d, i, corpo) {
    if (!d.immagine) {
      corpo.appendChild(el("p", { class: "nota", text: "Prima aggiungi una foto o un disegno. Poi ci disegni sopra le zone da toccare." }));
      corpo.appendChild(boxImmagine(d, i, true));
      return;
    }
    corpo.appendChild(el("p", { class: "nota", style: "margin:0", text: "Trascina il dito sull'immagine per disegnare una zona. La zona verde è quella giusta, le rosse sono sbagliate." }));
    var img = el("img", { src: d.immagine, alt: "Immagine: disegna le zone", draggable: "false" });
    var area = el("div", { class: "disegno", role: "application", "aria-label": "Immagine su cui disegnare le zone" }, [img]);
    corpo.appendChild(area);

    function pos(z, nodo, W, H) {
      nodo.style.left = (z[0] / W * 100) + "%"; nodo.style.top = (z[1] / H * 100) + "%";
      nodo.style.width = (z[2] / W * 100) + "%"; nodo.style.height = (z[3] / H * 100) + "%";
    }
    function zone() {
      N.$$(".zona", area).forEach(function (z) { z.remove(); });
      var W = img.naturalWidth, H = img.naturalHeight; if (!W) return;
      d.zone.forEach(function (z, k) {
        var n = el("div", { class: "zona" + (k === d.giusta ? " giusta" : ""), "aria-hidden": "true", text: String(k + 1) });
        pos(z, n, W, H); area.appendChild(n);
      });
    }
    if (img.complete && img.naturalWidth) zone(); else img.addEventListener("load", zone);

    var inizio = null, nuova = null;
    function punto(e) {
      var r = img.getBoundingClientRect(), W = img.naturalWidth, H = img.naturalHeight;
      return [Math.max(0, Math.min(W, (e.clientX - r.left) * W / r.width)), Math.max(0, Math.min(H, (e.clientY - r.top) * H / r.height))];
    }
    function rett(p) { return [Math.min(inizio[0], p[0]), Math.min(inizio[1], p[1]), Math.abs(p[0] - inizio[0]), Math.abs(p[1] - inizio[1])]; }
    area.addEventListener("pointerdown", function (e) {
      if (!img.naturalWidth || (e.pointerType === "mouse" && e.button !== 0)) return;
      e.preventDefault();
      try { area.setPointerCapture(e.pointerId); } catch (x) { /* */ }
      inizio = punto(e);
      nuova = el("div", { class: "zona nuova", "aria-hidden": "true" }); area.appendChild(nuova);
      pos([inizio[0], inizio[1], 0, 0], nuova, img.naturalWidth, img.naturalHeight);
    });
    area.addEventListener("pointermove", function (e) {
      if (!inizio) return;
      e.preventDefault();
      pos(rett(punto(e)), nuova, img.naturalWidth, img.naturalHeight);
    });
    function fine(e, annulla) {
      if (!inizio) return;
      var z = rett(punto(e)).map(Math.round);
      inizio = null; nuova.remove(); nuova = null;
      var r = img.getBoundingClientRect(), minimo = 14 * img.naturalWidth / r.width;   // ≥ 14 screen px
      if (annulla) return;
      if (z[2] < minimo || z[3] < minimo) { N.esito("info", "Zona troppo piccola: trascina il dito"); return; }
      d.zone.push(z);
      if (d.zone.length === 1) d.giusta = 0;
      N.suono.tocco();
      disegna(); cambiato();
    }
    area.addEventListener("pointerup", function (e) { fine(e, false); });
    area.addEventListener("pointercancel", function (e) { fine(e, true); });

    var g = el("div", { class: "zone-lista", role: "radiogroup", "aria-label": "Zone: scegli quella giusta" });
    if (!d.zone.length) g.appendChild(el("p", { class: "nota", style: "margin:0", text: "Nessuna zona: la prima che disegni sarà quella giusta." }));
    d.zone.forEach(function (z, k) {
      g.appendChild(el("div", { class: "voce" }, [
        radio(d.giusta === k, "Zona " + (k + 1) + " giusta", function () { d.giusta = k; disegna(); cambiato(); }),
        el("span", { class: "nome", text: "Zona " + (k + 1) + (d.giusta === k ? " — giusta ✅" : " — sbagliata") }),
        el("button", { type: "button", class: "togli", "aria-label": "Elimina la zona " + (k + 1), text: "🗑", onclick: function () {
          d.zone.splice(k, 1);
          if (d.giusta === k) d.giusta = 0; else if (d.giusta > k) d.giusta--;
          disegna(); cambiato();
        } })
      ]));
    });
    corpo.appendChild(g);
    corpo.appendChild(boxImmagine(d, i, true));
  }

  /* ---------------- add a question ---------------- */
  N.$("#aggiungi").addEventListener("click", function () {
    var opz = { titolo: "Che tipo di domanda?", pulsanti: [{ testo: "Annulla", valore: null, secondario: true }] };
    opz.nodo = el("div", { class: "tiles" }, Object.keys(INS.TIPI).map(function (k) {
      var t = INS.TIPI[k];
      return el("button", { type: "button", class: "scheda", "data-tipo": k, onclick: function () { opz._chiudi(k); } }, [
        el("span", { class: "fascia" }), el("span", { class: "emoji", "aria-hidden": "true", text: t.emoji }),
        el("span", { class: "titolo", text: t.nome }), el("span", { class: "sotto", text: t.sotto })
      ]);
    }));
    N.dialogo(opz).then(function (tipo) {
      if (!tipo) return;
      q.domande.push(INS.nuovaDomanda(tipo));
      aperta = q.domande.length - 1;
      disegna(); cambiato();
      var c = N.$("#d" + aperta);
      if (c) { c.scrollIntoView({ block: "start", behavior: "smooth" }); var t = N.$("textarea", c); if (t) setTimeout(function () { t.focus({ preventScroll: true }); }, 60); }
    });
  });

  /* ---------------- share / try ---------------- */
  N.$("#condividi").addEventListener("click", function () { salvaOra(); INS.condividi(q); });
  var prova = N.$("#prova");
  prova.href = INS.urlGioca(q.id);
  prova.addEventListener("click", function (e) {
    if (!q.domande.length) { e.preventDefault(); N.dialogo({ titolo: "Quiz vuoto", testo: "Aggiungi almeno una domanda per provarlo." }); return; }
    if (!salvaOra()) e.preventDefault();
  });

  disegna();
})();
