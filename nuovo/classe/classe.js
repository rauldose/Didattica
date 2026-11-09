/*
 * Impara giocando – "La mia classe": small UI helpers shared by the pages
 * of this folder (global CL). Needs core.js, config.js and api.js.
 */
(function () {
  "use strict";
  var CL = {}, el = N.el;
  window.CL = CL;

  // "Online features are off" screen (CLASSE_API empty)
  CL.nonAttivo = function (host) {
    host.innerHTML = "";
    host.appendChild(el("div", { style: "padding-top:24px" }, [
      N.gufoDice("La classe online non è attiva su questo sito. Puoi comunque giocare con tutte le attività!", "pensa"),
      el("p", { class: "riga centro", style: "margin-top:18px" }, [el("a", { class: "btn", href: "../index.html", text: "🏠 Torna alla pagina principale" })])
    ]));
  };
  CL.carico = function (host, testo) {
    host.innerHTML = "";
    host.appendChild(el("div", { class: "carico", role: "status" }, [el("div", { html: N.gufo("pensa") }).firstChild, testo || "Un momento…"]));
  };
  CL.errore = function (host, e, riprova) {
    host.innerHTML = "";
    host.appendChild(el("div", { style: "padding-top:20px" }, [
      N.gufoDice((e && e.offline ? "📡 " : "") + (e && e.message || "Qualcosa non va."), "pensa"),
      el("p", { class: "riga centro", style: "margin-top:16px" }, [
        riprova ? el("button", { class: "btn", type: "button", text: "Riprova", onclick: riprova }) : null,
        el("a", { class: "btn secondario", href: "../index.html", text: "🏠 Pagina principale" })
      ])
    ]));
  };

  // password field with a big "Mostra" button
  CL.campoPassword = function (o) {
    var campo = el("input", {
      class: "campo", type: "password", id: o.id, name: o.nome || o.id, autocomplete: o.autocomplete || "current-password",
      autocapitalize: "none", autocorrect: "off", spellcheck: "false", required: true, minlength: o.minimo || null, "aria-describedby": o.descr || null
    });
    var b = el("button", { class: "mostra", type: "button", "aria-pressed": "false", "aria-controls": o.id, text: "👁 Mostra" });
    b.addEventListener("click", function () {
      var vis = campo.type === "password";
      campo.type = vis ? "text" : "password";
      b.textContent = vis ? "🙈 Nascondi" : "👁 Mostra";
      b.setAttribute("aria-pressed", String(vis));
      campo.focus();
    });
    return { nodo: el("div", { class: "campo-pw" }, [campo, b]), campo: campo };
  };

  // usernames are typed by children: "Volpe Blu 27" → "volpe-blu-27"
  CL.normalizzaUtente = function (t) {
    t = String(t || "").trim();
    if (t.indexOf("@") >= 0) return t;                        // an email (teacher)
    return t.toLowerCase().replace(/[\s_]+/g, "-").replace(/-+/g, "-");
  };

  // A pupil who enters with the class account plays with a local profile
  // linked to the account (name and class from the teacher), so the stars
  // and the avatar in the header work as usual.
  CL.collegaProfilo = function (utente) {
    if (!utente || !utente.id) return null;
    var p = N.profili().filter(function (x) { return x.online === utente.id; })[0];
    var anno = utente.classe && utente.classe.anno != null ? Math.max(0, Math.min(5, utente.classe.anno | 0)) : 3;
    if (!p) {
      p = N.nuovoProfilo(utente.nome || utente.username || "Alunno", N.scegli(N.AVATAR), anno);
      p.online = utente.id;
    }
    p.nome = utente.nome || p.nome; p.classe = anno;
    N.salvaProfilo(p);                                         // also makes it the current profile
    return p;
  };

  CL.conferma = function (o) {
    return N.dialogo({
      titolo: o.titolo, testo: o.testo, nodo: o.nodo,
      pulsanti: [{ testo: o.si || "Sì", valore: true }, { testo: o.no || "Annulla", valore: false, secondario: true }]
    }).then(function (v) { return v === true; });
  };
  // a dialog with form fields; o.campi = [{id, etichetta, tipo, valore, attr}]; o.valida(valori) → error text or ""
  CL.chiedi = function (o) {
    var box = el("div", {}), campi = {}, err = el("p", { class: "errore-msg", role: "alert" });
    if (o.testo) box.appendChild(el("p", { text: o.testo, style: "margin-top:0;white-space:pre-wrap" }));
    (o.campi || []).forEach(function (c) {
      box.appendChild(el("label", { class: "etich", for: "ch-" + c.id, text: c.etichetta }));
      var f;
      if (c.tipo === "password") { var pw = CL.campoPassword({ id: "ch-" + c.id, autocomplete: c.autocomplete }); f = pw.campo; box.appendChild(pw.nodo); }
      else if (c.tipo === "select") {
        f = el("select", { class: "campo", id: "ch-" + c.id });
        c.opzioni.forEach(function (op, i) { f.appendChild(el("option", { value: String(i), text: op, selected: i === c.valore })); });
        box.appendChild(f);
      } else if (c.tipo === "textarea") { f = el("textarea", Object.assign({ class: "campo", id: "ch-" + c.id }, c.attr || {})); f.value = c.valore || ""; box.appendChild(f); }
      else { f = el("input", Object.assign({ class: "campo", id: "ch-" + c.id, type: c.tipo || "text", autocomplete: "off" }, c.attr || {})); f.value = c.valore || ""; box.appendChild(f); }
      campi[c.id] = f;
    });
    box.appendChild(err);
    var ok = el("button", { class: "btn" + (o.pericolo ? " pericolo" : ""), type: "submit", text: o.si || "OK" });
    var no = el("button", { class: "btn secondario", type: "button", text: o.no || "Annulla" });
    var form = el("form", { novalidate: true }, [box, el("div", { class: "riga centro", style: "margin-top:12px" }, [ok, no])]);
    return new Promise(function (fine) {
      var aperto = N.dialogo({ titolo: o.titolo, nodo: form, pulsanti: [] });
      var chiudi = N.chiudiDialogo;
      no.addEventListener("click", function () { chiudi(null); });
      aperto.then(function (v) { if (v == null) fine(null); });
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var val = {};
        Object.keys(campi).forEach(function (k) { val[k] = campi[k].tagName === "SELECT" ? parseInt(campi[k].value, 10) : campi[k].value; });
        var msg = o.valida ? o.valida(val) : "";
        if (msg) { err.textContent = msg; return; }
        if (!o.esegui) { chiudi(true); fine(val); return; }
        ok.disabled = true; err.textContent = "";
        Promise.resolve(o.esegui(val)).then(function (r) { chiudi(true); fine(r === undefined ? val : r); }, function (e2) {
          ok.disabled = false; err.textContent = e2 && e2.message || "Errore.";
        });
      });
    });
  };
})();
