/*
 * Impara giocando – "La mia classe": client of the class API (global API).
 * Contract: docs/classe-api.md. Needs config.js (window.CLASSE_API) first.
 *
 *   API.attivo()            true when an API address is configured
 *   API.sessione()          {token, ruolo:"alunno"|"insegnante", utente} or null
 *   API.<endpoint>(…)       Promise of the JSON answer (null for 204)
 * Errors are thrown as Error(<Italian message>) with .status (0 = no
 * connection) and .offline = true when the server cannot be reached.
 */
(function () {
  "use strict";
  var API = {};
  window.API = API;
  var CHIAVE = "impara.sessione", MAPPA = "impara.quiz.online";
  var ATTESA_MS = 25000;

  function leggi(k, def) { try { var v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } }
  function scrivi(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }

  API.base = function () { return String(window.CLASSE_API || "").replace(/\/+$/, ""); };
  API.attivo = function () { return !!API.base(); };

  /* ---------------- session ---------------- */
  API.sessione = function () {
    var s = leggi(CHIAVE, null);
    return s && typeof s.token === "string" && (s.ruolo === "alunno" || s.ruolo === "insegnante") ? s : null;
  };
  API.salvaSessione = function (s) { scrivi(CHIAVE, s ? { token: s.token, ruolo: s.ruolo, utente: s.utente || {} } : null); };
  API.alunno = function () { var s = API.sessione(); return s && s.ruolo === "alunno" ? s : null; };
  API.insegnante = function () { var s = API.sessione(); return s && s.ruolo === "insegnante" ? s : null; };

  /* ---------------- fetch wrapper ---------------- */
  function errore(msg, status, extra) {
    var e = new Error(msg); e.status = status || 0;
    if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
    return e;
  }
  var MESSAGGI = {
    400: "Controlla i dati inseriti.", 401: "Devi entrare di nuovo.", 403: "Non hai il permesso per farlo.",
    404: "Non trovato.", 409: "Esiste già.", 413: "Il file è troppo grande.", 429: "Troppi tentativi: aspetta qualche minuto e riprova."
  };
  // API.richiesta("GET", "/api/classi") → Promise
  API.richiesta = function (metodo, percorso, corpo) {
    if (!API.attivo()) return Promise.reject(errore("La classe online non è attiva su questo sito.", 0, { nonConfigurato: true }));
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return Promise.reject(errore("Sei offline: controlla la connessione a Internet.", 0, { offline: true }));
    }
    var h = { "Accept": "application/json" }, s = API.sessione();
    if (s) h.Authorization = "Bearer " + s.token;
    var opz = { method: metodo, headers: h, cache: "no-store", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" };
    if (corpo !== undefined) { h["Content-Type"] = "application/json"; opz.body = JSON.stringify(corpo); }
    var ctrl = typeof AbortController === "function" ? new AbortController() : null, timer = null;
    if (ctrl) { opz.signal = ctrl.signal; timer = setTimeout(function () { ctrl.abort(); }, ATTESA_MS); }
    return fetch(API.base() + percorso, opz).then(function (r) {
      clearTimeout(timer);
      if (r.status === 204) return null;
      return r.text().then(function (t) {
        var dati = null;
        if (t) { try { dati = JSON.parse(t); } catch (e) { dati = null; } }
        if (r.ok) return dati;
        if (r.status === 401 && s) API.salvaSessione(null);           // expired or revoked: log out
        var msg = dati && typeof dati.errore === "string" && dati.errore ? dati.errore
          : (MESSAGGI[r.status] || (r.status >= 500 ? "Il server ha un problema. Riprova tra poco." : "Errore " + r.status + "."));
        throw errore(msg, r.status);
      });
    }, function (e) {
      clearTimeout(timer);
      throw errore(e && e.name === "AbortError" ? "Il server non risponde. Riprova tra poco." : "Non riesco a collegarmi al server. Controlla la connessione.", 0, { offline: true });
    });
  };
  function id(x) { return encodeURIComponent(String(x)); }
  var R = API.richiesta;

  /* ---------------- accounts ---------------- */
  function entra(r) { API.salvaSessione(r); return r; }
  API.salute = function () { return R("GET", "/api/salute"); };
  API.registraInsegnante = function (email, nome, password) { return R("POST", "/api/insegnanti", { email: email, nome: nome, password: password }).then(entra); };
  API.accedi = function (utente, password) { return R("POST", "/api/accedi", { utente: utente, password: password }).then(entra); };
  API.esci = function () {
    var fatto = function () { API.salvaSessione(null); return null; };
    if (!API.sessione()) return Promise.resolve(fatto());
    return R("POST", "/api/esci").then(fatto, fatto);              // always forget the token locally
  };
  API.io = function () {
    return R("GET", "/api/io").then(function (r) {
      var s = API.sessione();
      if (s && r && r.utente) { s.utente = r.utente; API.salvaSessione(s); }
      return r;
    });
  };
  API.cambiaPassword = function (vecchia, nuova) { return R("PUT", "/api/io/password", { vecchia: vecchia, nuova: nuova }); };
  API.eliminaAccount = function (password) { return R("DELETE", "/api/io", { password: password }).then(function () { API.salvaSessione(null); scrivi(MAPPA, null); return null; }); };
  API.esporta = function () { return R("GET", "/api/io/esporta"); };

  /* ---------------- classes & pupils (teacher) ---------------- */
  API.classi = function () { return R("GET", "/api/classi"); };
  API.creaClasse = function (nome, anno) { return R("POST", "/api/classi", { nome: nome, anno: anno }); };
  API.modificaClasse = function (cid, dati) { return R("PUT", "/api/classi/" + id(cid), dati); };
  API.eliminaClasse = function (cid) { return R("DELETE", "/api/classi/" + id(cid)); };
  API.classe = function (cid) { return R("GET", "/api/classi/" + id(cid)); };
  API.aggiungiAlunni = function (cid, nomi) { return R("POST", "/api/classi/" + id(cid) + "/alunni", { nomi: nomi }); };
  API.rinominaAlunno = function (aid, nome) { return R("PUT", "/api/alunni/" + id(aid), { nome: nome }); };
  API.nuovaPassword = function (aid) { return R("POST", "/api/alunni/" + id(aid) + "/password"); };
  API.eliminaAlunno = function (aid) { return R("DELETE", "/api/alunni/" + id(aid)); };
  API.risultatiClasse = function (cid) { return R("GET", "/api/classi/" + id(cid) + "/risultati"); };
  API.pubblica = function (cid, tipo, rid) { return R("POST", "/api/classi/" + id(cid) + "/pubblica", { tipo: tipo, id: rid }); };
  API.ritira = function (cid, tipo, rid) { return R("DELETE", "/api/classi/" + id(cid) + "/pubblica/" + id(tipo) + "/" + id(rid)); };

  /* ---------------- quizzes & mini-apps ---------------- */
  API.MAX_QUIZ = 2 * 1024 * 1024;
  API.MAX_APP = 1024 * 1024;
  API.byte = function (testo) { return typeof TextEncoder === "function" ? new TextEncoder().encode(testo).length : unescape(encodeURIComponent(testo)).length; };
  API.quizLista = function () { return R("GET", "/api/quiz"); };
  API.creaQuiz = function (dati) { return R("POST", "/api/quiz", { dati: dati }); };
  API.aggiornaQuiz = function (qid, dati) { return R("PUT", "/api/quiz/" + id(qid), { dati: dati }); };
  API.eliminaQuiz = function (qid) {
    return R("DELETE", "/api/quiz/" + id(qid)).then(function () { API.dimenticaQuiz(qid); return null; });
  };
  API.getQuiz = function (qid) { return R("GET", "/api/quiz/" + id(qid)); };
  API.appLista = function () { return R("GET", "/api/app"); };
  API.creaApp = function (dati) { return R("POST", "/api/app", dati); };
  API.aggiornaApp = function (aid, dati) { return R("PUT", "/api/app/" + id(aid), dati); };
  API.eliminaApp = function (aid) { return R("DELETE", "/api/app/" + id(aid)); };
  API.getApp = function (aid) { return R("GET", "/api/app/" + id(aid)); };

  /* local quiz id (editor, localStorage "impara.quiz") → server quiz id */
  API.mappaQuiz = function () { var m = leggi(MAPPA, {}); return m && typeof m === "object" ? m : {}; };
  API.idOnline = function (localeId) { return API.mappaQuiz()[localeId] || null; };
  API.dimenticaQuiz = function (serverId) {
    var m = API.mappaQuiz();
    Object.keys(m).forEach(function (k) { if (m[k] === serverId) delete m[k]; });
    scrivi(MAPPA, m);
  };
  // Upload a local quiz, or update the copy already online. → Promise {id, nuovo}
  API.caricaQuizLocale = function (q) {
    var dati = JSON.parse(JSON.stringify(q)), localeId = q.id;
    if (API.byte(JSON.stringify(dati)) > API.MAX_QUIZ) return Promise.reject(errore("Il quiz è troppo grande (massimo 2 MB): usa foto più piccole o meno foto.", 413));
    var sid = API.idOnline(localeId);
    function ricorda(r) { var m = API.mappaQuiz(); m[localeId] = r.id; scrivi(MAPPA, m); return r; }
    function crea() { return API.creaQuiz(dati).then(function (r) { return ricorda({ id: r.id, nuovo: true }); }); }
    if (!sid) return crea();
    return API.aggiornaQuiz(sid, dati).then(function () { return { id: sid, nuovo: false }; }, function (e) {
      if (e.status === 404) { API.dimenticaQuiz(sid); return crea(); }   // deleted online meanwhile
      throw e;
    });
  };

  /* ---------------- pupil ---------------- */
  API.miaClasse = function () { return R("GET", "/api/classe"); };
  API.inviaRisultato = function (r) { return R("POST", "/api/risultati", r); };
  API.mieiRisultati = function () { return R("GET", "/api/io/risultati"); };

  /* ---------------- mini-app runtime helpers (see app.html) ---------------- */
  API.CSP = "default-src 'none'; img-src data: blob:; media-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:";
  // The CSP meta goes at the very top of the document (after a doctype, so
  // the page keeps standards mode): everything the app loads comes after it.
  API.srcdocApp = function (html) {
    var meta = '<meta http-equiv="Content-Security-Policy" content="' + API.CSP + '">';
    var t = String(html || "").replace(/^﻿/, "");
    var m = /^\s*<!doctype[^>]*>/i.exec(t);
    return m ? m[0] + meta + t.slice(m[0].length) : meta + t;
  };
  function intero(x, min, max) { return typeof x === "number" && isFinite(x) && Math.floor(x) === x && x >= min && x <= max; }
  // Validates a message from a mini-app. Returns {tipo:"risultato", stelle, corrette?, totali?} | {tipo:"fine"} | null
  API.messaggioApp = function (e, iframe) {
    if (!iframe || !e || e.source !== iframe.contentWindow) return null;
    if (e.origin !== "null") return null;                          // sandboxed srcdoc = opaque origin
    var d = e.data;
    if (!d || typeof d !== "object" || Array.isArray(d)) return null;
    if (d.impara === "fine") return { tipo: "fine" };
    if (d.impara !== "risultato" || !intero(d.stelle, 0, 3)) return null;
    var r = { tipo: "risultato", stelle: d.stelle };
    if (d.totali != null || d.corrette != null) {
      if (!intero(d.totali, 1, 10000) || !intero(d.corrette, 0, d.totali)) return null;
      r.corrette = d.corrette; r.totali = d.totali;
    }
    return r;
  };

  /* ---------------- small UI helpers shared by the pages ---------------- */
  API.data = function (t) {
    if (!t) return "—";
    var d = new Date(typeof t === "number" ? t : String(t).replace(" ", "T"));
    if (isNaN(d)) return String(t);
    return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
  };
  API.dataOra = function (t) {
    var d = new Date(typeof t === "number" ? t : String(t).replace(" ", "T"));
    if (isNaN(d)) return String(t || "");
    return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  };
  // a readable name for an activity id ("mat:tabelline", "classe:quiz:q…", "app:a…")
  API.nomeAttivita = function (a, titoli) {
    titoli = titoli || {};
    var m;
    if ((m = /^classe:quiz:(.+)$/.exec(a))) return "📝 " + (titoli["quiz:" + m[1]] || "Quiz della classe");
    if ((m = /^app:(.+)$/.exec(a))) return "🎮 " + (titoli["app:" + m[1]] || "Mini-gioco della classe");
    var p = String(a).split(":");
    var mod = { mat: "🔢 Matematica", quiz: "📚 Quiz", lab: "🧪 Laboratorio", gio: "🎲 Giochi" }[p[0]];
    if (!mod) return String(a);
    var resto = p.slice(1).filter(function (x) { return x !== "mio"; });
    if (p[0] === "quiz" && resto.length === 3) return mod + " · " + resto[1].toLowerCase() + " · livello " + resto[2];
    return mod + (resto.length ? " · " + resto.join(" · ").replace(/[-_]/g, " ") : "");
  };
  API.stelline = function (n) { n = Math.max(0, Math.min(3, n | 0)); return "⭐".repeat(n) + "☆".repeat(3 - n); };
  API.scaricaFile = function (nome, testo, tipo) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([testo], { type: tipo || "application/json" }));
    a.download = nome; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
})();
