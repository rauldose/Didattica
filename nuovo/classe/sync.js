/*
 * Impara giocando – "La mia classe": sends the results of a pupil who has
 * entered with the class account to the class API.
 *
 * Include after core.js and classe/config.js. core.js calls
 * window.N_DOPO_REGISTRA(attivita, stelle, esito) every time N.registra
 * records a round; when a pupil session exists and CLASSE_API is set the
 * result is POSTed to /api/risultati (fire and forget). Without connection
 * it waits in localStorage "impara.coda" and is sent on the next page load
 * or when the device is back online. Does nothing when CLASSE_API is "".
 */
(function () {
  "use strict";
  var CODA = "impara.coda", MAX_CODA = 300, VECCHIO = 30 * 24 * 3600 * 1000;

  function leggi(k, def) { try { var v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } }
  function scrivi(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* full or private */ } }
  function base() { return String(window.CLASSE_API || "").replace(/\/+$/, ""); }
  function sessione() {
    var s = leggi("impara.sessione", null);
    return s && typeof s.token === "string" && (s.ruolo === "alunno" || s.ruolo === "insegnante") ? s : null;
  }
  function alunno() { var s = sessione(); return s && s.ruolo === "alunno" && s.utente ? s : null; }

  // POST one result. Resolves "ok" | "scartato" (refused for good) | "riprova"
  function posta(s, r) {
    return fetch(base() + "/api/risultati", {
      method: "POST", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", keepalive: true,
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + s.token },
      body: JSON.stringify({ attivita: r.attivita, stelle: r.stelle, corrette: r.corrette, totali: r.totali })
    }).then(function (x) {
      if (x.ok) return "ok";
      if (x.status === 401) return "riprova";                       // kept until this pupil enters again
      if (x.status === 429 || x.status >= 500) return "riprova";
      return "scartato";                                            // 400/403/404: would never be accepted
    }, function () { return "riprova"; });
  }

  function pulisci(r) {
    var o = { attivita: String(r.attivita).slice(0, 120), stelle: Math.max(0, Math.min(3, r.stelle | 0)) };
    if (r.totali != null && isFinite(r.totali) && r.totali > 0 && isFinite(r.corrette)) {
      o.totali = Math.round(r.totali); o.corrette = Math.max(0, Math.min(o.totali, Math.round(r.corrette)));
    }
    return o;
  }
  function inCoda(s, r) {
    var c = leggi(CODA, []);
    if (!Array.isArray(c)) c = [];
    r.utente = s.utente.id; r.quando = Date.now();
    c.push(r);
    scrivi(CODA, c.slice(-MAX_CODA));
  }

  // send a result now (or queue it). Returns a Promise of "ok" | "coda" | "scartato" | "no"
  function invia(r) {
    var s = alunno();
    if (!base() || !s || !r || !r.attivita) return Promise.resolve("no");
    r = pulisci(r);
    if (navigator.onLine === false) { inCoda(s, r); return Promise.resolve("coda"); }
    return posta(s, r).then(function (esito) {
      if (esito === "riprova") { inCoda(s, r); return "coda"; }
      return esito;
    });
  }

  var svuotando = null;
  function svuota() {
    var s = alunno();
    if (!base() || !s || svuotando || navigator.onLine === false) return svuotando || Promise.resolve(0);
    var c = leggi(CODA, []);
    if (!Array.isArray(c) || !c.length) return Promise.resolve(0);
    var adesso = Date.now(), restano = [], inviati = 0;
    var miei = c.filter(function (r) {
      if (!r || adesso - (r.quando || 0) > VECCHIO) return false;        // too old: dropped
      if (r.utente !== s.utente.id) { restano.push(r); return false; }   // another pupil on this device
      return true;
    });
    svuotando = miei.reduce(function (p, r) {
      return p.then(function (fermo) {
        if (fermo) { restano.push(r); return true; }
        return posta(s, r).then(function (e) {
          if (e === "ok") inviati++;
          if (e === "riprova") { restano.push(r); return true; }       // stop at the first failure, keep order
          return false;
        });
      });
    }, Promise.resolve(false)).then(function () {
      // results queued while sending are kept too
      var ora = leggi(CODA, []), nuovi = Array.isArray(ora) ? ora.filter(function (r) { return r && r.quando > adesso; }) : [];
      scrivi(CODA, restano.concat(nuovi).slice(-MAX_CODA));
      svuotando = null;
      return inviati;
    });
    return svuotando;
  }

  window.N_DOPO_REGISTRA = function (attivita, stelle, esito) {
    esito = esito || {};
    invia({ attivita: attivita, stelle: stelle, corrette: esito.corrette, totali: esito.totali });
  };
  window.CLASSE_SYNC = {
    attivo: function () { return !!base(); }, sessione: sessione, alunno: alunno,
    invia: invia, svuota: svuota, inCoda: function () { var c = leggi(CODA, []); return Array.isArray(c) ? c.length : 0; }
  };

  if (base()) {
    window.addEventListener("online", svuota);
    setTimeout(svuota, 800);
  }
})();
