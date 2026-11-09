/*
 * Impara giocando – quiz: data layer (global QZ).
 *
 * Turns every kind of quiz into one shape the player understands:
 *   fonte = { id, titolo, emoji, materia, eta, attivita(n), livelli: [livello] }
 *   livello = { n, presentazione: { testo, audio: [url] }, gruppi: [[passo, …], …] }
 *   passo = { tipo: "scelta"|"vf"|"scrivi"|"seleziona"|"tocca",
 *             testo, consegna, voci, giusta, risposte, zone, immagini: [url],
 *             audio: [url], sugg: { testo|audio|immagine }, cumula, ordine }
 * A "gruppo" is a run of steps that must stay together and in order
 * (E.G. "legato" questions, EM multi-step exercises).
 *
 * Sources:
 *   (A) his sets, parsed with the original parsers EG.analizza / EG.risposte
 *       (programmi/eg/eg-core.js) and EMC.analizzaLivello (programmi/em/em-core.js);
 *   (B) teacher quizzes in the "impara-quiz" format (see nuovo/BRIEF.md),
 *       from localStorage or from a share link (#q=z<base64url deflate-raw> | j<base64url json>).
 * Also: lenient comparison of typed answers.
 */
(function () {
  "use strict";
  var QZ = {};
  window.QZ = QZ;

  /* ======================= lenient answers ======================= */
  var ACCENTI = { "à": "a'", "á": "a'", "è": "e'", "é": "e'", "ì": "i'", "í": "i'", "ò": "o'", "ó": "o'", "ù": "u'", "ú": "u'" };
  QZ.normalizza = function (s) {
    s = String(s == null ? "" : s);
    if (s.normalize) s = s.normalize("NFC");
    s = s.replace(/[’‘`´]/g, "'").toLowerCase().replace(/[àáèéìíòóùú]/g, function (c) { return ACCENTI[c]; });
    s = s.replace(/\s+/g, " ").trim();
    s = s.replace(/(\S)\s*[.;]+$/, "$1");          // a final full stop does not matter
    return s;
  };
  function eMatematica(s) { return !/[a-zà-ú]/i.test(s) && /\d/.test(s); }
  function normMat(s) {
    s = String(s).replace(/[x×·]/gi, "*").replace(/:/g, "/").replace(/,/g, ".").replace(/\s+/g, " ").trim();
    s = s.replace(/\s*([+\-*/^=()\[\]{}])\s*/g, "$1").replace(/^=+|=+$/g, "");
    return s;
  }
  function numero(s) {
    var t = String(s).replace(",", ".").trim();
    return /^-?(\d+\.?\d*|\.\d+)$/.test(t) ? parseFloat(t) : null;
  }
  // Returns the accepted answer the child's text matches, or null.
  QZ.confronta = function (dato, risposte) {
    var d = QZ.normalizza(dato);
    if (!d) return null;
    for (var i = 0; i < risposte.length; i++) {
      var r = risposte[i];
      if (QZ.normalizza(r) === d) return r;
      if (eMatematica(r)) {
        var a = normMat(QZ.normalizza(r)), b = normMat(d);
        if (a === b) return r;
        var na = numero(a), nb = numero(b);
        if (na != null && nb != null && Math.abs(na - nb) < 1e-9) return r;
      }
    }
    return null;
  };
  // On-screen keypad settings when every accepted answer is "numeric"
  // (digits plus math signs), else null.
  QZ.tastiPer = function (risposte) {
    if (!risposte.length) return null;
    var ok = risposte.every(function (r) { return /^[0-9\s.,+\-*/:^()\[\]{}=]+$/.test(r.trim()) && /\d/.test(r); });
    if (!ok) return null;
    var tutti = risposte.join(""), extra = [];
    var virgola = /[.,]/.test(tutti), meno = false;
    "+-*/:^()[]{}=".split("").forEach(function (c) {
      if (tutti.indexOf(c) < 0) return;
      if (c === "-" && !virgola && !/[+*/:^()\[\]{}=]/.test(tutti)) { meno = true; return; }
      extra.push(c);
    });
    // expressions: always the same operator keys (and the comma), so the keys give nothing away
    if (extra.some(function (c) { return c !== "-"; })) {
      extra = ["+", "-", "*", "/", "^", "(", ")", "[", "]", "="];
      if (/[{}]/.test(tutti)) extra.push("{", "}");
      virgola = true; meno = false;
    }
    if (risposte.some(function (r) { return /\d\s+\d/.test(r.trim()); })) extra.push(" ");
    return { virgola: virgola, meno: meno, extra: extra };
  };

  /* ======================= text helpers ======================= */
  // His texts were wrapped by hand for an 80-column screen: join the wrapped
  // prose lines (next line starts with a lowercase letter), keep the others
  // (expressions, lists), drop decorative lines, trim the indentation.
  QZ.riflow = function (t) {
    var righe = String(t || "").replace(/\r/g, "").split("\n").map(function (r) { return r.replace(/\s+$/, "").replace(/^\s+/, ""); });
    righe = righe.filter(function (r) { return !/^[-_=*~.]{5,}$/.test(r); });
    var out = [];
    righe.forEach(function (r) {
      var prev = out.length ? out[out.length - 1] : null;
      if (prev && r && /^[a-zà-ú(]/.test(r) && /[a-zà-ú,;'’)]$/i.test(prev) && prev.length >= 25) out[out.length - 1] = prev + " " + r;
      else out.push(r);
    });
    return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  };
  // "IN QUESTO LIVELLO DEVI…" -> "In questo livello devi…" (presentations only)
  QZ.senzaMaiuscolo = function (t) {
    return t.split("\n").map(function (r) {
      var lettere = r.replace(/[^a-zà-úA-ZÀ-Ú]/g, "");
      if (lettere.length < 8 || lettere !== lettere.toUpperCase()) return r;
      var s = r.toLowerCase();
      return s.replace(/[a-zà-ú]/, function (c) { return c.toUpperCase(); });
    }).join("\n");
  };
  function pulisciConsegna(t) { return String(t || "").replace(/\s+/g, " ").trim(); }
  function alfabetico(a, b) { return a.localeCompare(b, "it", { numeric: true, sensitivity: "base" }); }

  /* ======================= (A) his sets ======================= */
  function egInfo(id) { return (window.EG_DATI || []).filter(function (e) { return e.id === id; })[0]; }
  function emInfo(c) { return (window.EMC && window.EM_DATI) ? EMC.originali().filter(function (e) { return e.cartella === c; })[0] : null; }
  function catalogo(id) { return (window.QUIZ_CATALOGO || []).filter(function (c) { return c.id === id; })[0]; }

  QZ.fonteEG = function (id) {
    var es = egInfo(id);
    if (!es || !window.EG) return null;
    var max = EG.livelliMax(es), visti = [], livelli = [];
    for (var i = 0; i < max; i++) {
      var t = es.livelli[i];
      if (!t || visti.indexOf(t) >= 0) continue;      // identical levels are shown once
      visti.push(t);
      var r = EG.analizza(t), gruppi = [];
      r.quesiti.forEach(function (q) {
        var x = EG.risposte(q), p;
        if (x.lista) {
          if (x.giusta == null || !x.voci.length) return;
          p = { tipo: "scelta", voci: x.voci.slice().sort(alfabetico), giusta: x.giusta, ordine: "alfabetico" };
        } else {
          if (!x.voci.length) return;
          p = { tipo: "scrivi", risposte: x.voci };
        }
        p.testo = QZ.riflow(x.domanda);
        p.consegna = pulisciConsegna(q.consegna);
        p.immagini = []; p.audio = []; p.sugg = null;
        if (q.legato && gruppi.length) gruppi[gruppi.length - 1].push(p); else gruppi.push([p]);
      });
      if (!gruppi.length) continue;
      livelli.push({ n: livelli.length + 1, originale: i + 1, presentazione: { testo: QZ.senzaMaiuscolo(QZ.riflow(r.lezione)), audio: [] }, gruppi: gruppi });
    }
    return completa({ id: "EG:" + id, titolo: es.titolo, livelli: livelli });
  };

  QZ.fonteEM = function (cartella) {
    var es = emInfo(cartella);
    if (!es) return null;
    function url(n) { return EMC.urlMedia(es, n); }
    function suggerimento(s) {
      s = (s || "").trim();
      if (!s) return null;
      if (EMC.eAudio(s)) return { audio: url(s) };
      if (EMC.eImmagine(s)) return { immagine: url(s) };
      return { testo: s };
    }
    var visti = [], livelli = [];
    EMC.livelliValidi(es).forEach(function (i) {
      var t = es.livelli[i].testo;
      if (visti.indexOf(t) >= 0) return;
      visti.push(t);
      var r = EMC.analizzaLivello(t), gruppi = [];
      r.esercizi.forEach(function (ese) {
        var acc = "", g = [];
        ese.passi.forEach(function (ps, k) {
          acc += ps.testo;
          var audio = EMC.media(ps.testo).filter(EMC.eAudio);
          if (k === 0 && ese.consegna) audio = EMC.media(ese.consegna).filter(EMC.eAudio).concat(audio);
          var p = {
            testo: ps.testo, cumula: true, consegna: pulisciConsegna(EMC.senzaMedia(ese.consegna)),
            immagini: EMC.media(acc).filter(EMC.eImmagine).map(url), audio: audio.map(url), sugg: suggerimento(ps.sugg)
          };
          if (ps.tipo === "scegli") { p.tipo = "scelta"; p.voci = ps.voci.slice().sort(alfabetico); p.giusta = ps.risposte[0]; p.ordine = "alfabetico"; }
          else if (ps.tipo === "seleziona") { p.tipo = "seleziona"; p.risposte = ps.risposte; }
          else if (ps.tipo === "clicca") { p.tipo = "tocca"; p.zone = ps.zone; p.giusta = 0; }
          else { p.tipo = "scrivi"; p.risposte = ps.risposte; }
          if (p.tipo === "tocca" && (!p.immagini.length || !p.zone.length)) return;
          if ((p.tipo === "scrivi" || p.tipo === "seleziona") && !p.risposte.length) return;
          g.push(p);
        });
        if (g.length) gruppi.push(g);
      });
      if (!gruppi.length) return;
      var pres = r.presentazione;
      if (r.risorsa) pres = pres.split("\n").filter(function (l) { return !/\.exe\b/i.test(l); }).join("\n");
      livelli.push({
        n: livelli.length + 1, originale: i + 1, gruppi: gruppi,
        presentazione: { testo: QZ.senzaMaiuscolo(QZ.riflow(EMC.senzaMedia(pres))), audio: EMC.media(r.presentazione).filter(EMC.eAudio).map(url) }
      });
    });
    return completa({ id: "EM:" + cartella, titolo: es.titolo, livelli: livelli });
  };

  function completa(f) {
    var c = catalogo(f.id);
    if (c) { f.titolo = c.titolo; f.emoji = c.emoji; f.materia = c.materia; f.eta = c.eta; f.sotto = c.sotto; }
    else { f.emoji = "📘"; f.materia = f.materia || "altro"; f.eta = null; }
    f.attivita = function (n) { return "quiz:" + f.id + ":" + n; };
    return f.livelli.length ? f : null;
  }

  QZ.fonteSet = function (set) {
    var m = /^(EG|EM):(.+)$/.exec(set || "");
    if (!m) return null;
    return m[1] === "EG" ? QZ.fonteEG(m[2]) : QZ.fonteEM(m[2]);
  };

  /* ======================= (B) teacher quizzes ======================= */
  var TIPI = ["scelta", "vero-falso", "scrivi", "tocca"];
  QZ.valida = function (q) {
    if (!q || typeof q !== "object" || !Array.isArray(q.domande)) throw new Error("Questo non sembra un quiz.");
    var d = q.domande.filter(function (x) {
      if (!x || TIPI.indexOf(x.tipo) < 0) return false;
      if (x.tipo === "scelta") return Array.isArray(x.scelte) && x.scelte.length > 1 && x.scelte[x.giusta] != null;
      if (x.tipo === "vero-falso") return typeof x.giusta === "boolean";
      if (x.tipo === "scrivi") return Array.isArray(x.risposte) && x.risposte.some(function (r) { return String(r).trim(); });
      if (x.tipo === "tocca") return !!x.immagine && Array.isArray(x.zone) && x.zone[x.giusta] != null;
      return false;
    });
    if (!d.length) throw new Error("Il quiz non contiene domande.");
    return {
      formato: "impara-quiz", versione: 1, id: String(q.id || "q" + Date.now().toString(36)), titolo: String(q.titolo || "Quiz"),
      materia: QUIZ_MATERIE_OK.indexOf(q.materia) >= 0 ? q.materia : "altro", autore: q.autore ? String(q.autore) : "",
      classe: Array.isArray(q.classe) ? q.classe : [0, 5], domande: d
    };
  };
  var QUIZ_MATERIE_OK = ["ita", "mat", "sci", "altro"];
  function immagineSicura(u) { return typeof u === "string" && !/^\s*javascript:/i.test(u) && u.trim() ? u : null; }

  QZ.fonteMaestra = function (q) {
    var gruppi = q.domande.map(function (d) {
      var img = immagineSicura(d.immagine);
      var p = { testo: String(d.testo || "").trim(), consegna: "", immagini: img ? [img] : [], audio: [], sugg: null };
      if (d.tipo === "scelta") { p.tipo = "scelta"; p.voci = d.scelte.map(String); p.giusta = String(d.scelte[d.giusta]); p.ordine = "mescola"; }
      else if (d.tipo === "vero-falso") { p.tipo = "vf"; p.giusta = d.giusta; }
      else if (d.tipo === "scrivi") {
        p.tipo = "scrivi"; p.risposte = d.risposte.map(String).filter(function (r) { return r.trim(); });
        if (d.suggerimento && String(d.suggerimento).trim()) p.sugg = { testo: String(d.suggerimento).trim() };
      } else { p.tipo = "tocca"; p.zone = d.zone.map(function (z) { return z.map(Number); }); p.giusta = d.giusta | 0; }
      return [p];
    });
    return {
      id: "mio:" + q.id, titolo: q.titolo, emoji: "🍎", materia: q.materia, eta: null, maestra: true, autore: q.autore,
      tutte: true, quiz: q,
      livelli: [{ n: 1, presentazione: { testo: q.autore ? "Un quiz preparato da " + q.autore + "." : "", audio: [] }, gruppi: gruppi }],
      attivita: function () { return "quiz:mio:" + q.id; }
    };
  };

  // teacher's own quizzes (editor) + the ones received through a link
  QZ.miei = function () { var l = N.leggi("quiz", []); return Array.isArray(l) ? l : []; };
  QZ.ricevuti = function () { var l = N.leggi("quiz.ricevuti", []); return Array.isArray(l) ? l : []; };
  QZ.salvaRicevuto = function (q) {
    var l = QZ.ricevuti().filter(function (x) { return x.id !== q.id; });
    q = JSON.parse(JSON.stringify(q)); q.ricevuto = Date.now();
    l.unshift(q);
    N.scrivi("quiz.ricevuti", l.slice(0, 30));
  };
  QZ.tuttiMaestra = function () {
    var ids = {}, out = [];
    QZ.miei().concat(QZ.ricevuti()).forEach(function (q) {
      if (!q || !q.id || ids[q.id]) return;
      try { var v = QZ.valida(q); ids[q.id] = 1; out.push(v); } catch (e) { /* skip broken */ }
    });
    return out;
  };
  QZ.trovaMaestra = function (id) { return QZ.tuttiMaestra().filter(function (q) { return q.id === id; })[0] || null; };

  /* ---------------- share links ---------------- */
  function b64uDaByte(b) {
    var s = "", i, CH = 0x8000;
    for (i = 0; i < b.length; i += CH) s += String.fromCharCode.apply(null, b.subarray(i, i + CH));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function byteDaB64u(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/").replace(/[^A-Za-z0-9+/]/g, "");
    while (s.length % 4) s += "=";
    var bin = atob(s), b = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
  }
  function flusso(byte, trasforma) {
    return new Response(new Blob([byte]).stream().pipeThrough(trasforma)).arrayBuffer().then(function (a) { return new Uint8Array(a); });
  }
  // data (the part after "#q=") -> Promise(quiz)
  QZ.leggiLink = function (data) {
    return Promise.resolve().then(function () {
      data = decodeURIComponent(String(data || "").trim());
      var tipo = data.charAt(0), byte = byteDaB64u(data.slice(1));
      if (tipo === "z") {
        if (typeof DecompressionStream === "undefined") throw new Error("Questo browser non sa aprire il link: prova con un browser più recente.");
        return flusso(byte, new DecompressionStream("deflate-raw"));
      }
      if (tipo === "j") return byte;
      throw new Error("Link non valido.");
    }).then(function (b) {
      return QZ.valida(JSON.parse(new TextDecoder().decode(b)));
    });
  };
  // quiz -> Promise("z…" | "j…"), same scheme as the teachers' editor
  QZ.creaLink = function (quiz) {
    var b = new TextEncoder().encode(JSON.stringify(quiz));
    if (typeof CompressionStream === "undefined") return Promise.resolve("j" + b64uDaByte(b));
    return flusso(b, new CompressionStream("deflate-raw")).then(function (z) { return "z" + b64uDaByte(z); });
  };

  /* ======================= rounds ======================= */
  // ~10 steps from random groups, groups kept whole and in order
  QZ.round = function (livello, tutte) {
    var gruppi = livello.gruppi;
    if (tutte) return gruppi.slice();
    var scelti = [], tot = 0;
    N.mescola(gruppi).some(function (g) {
      if (tot === 0 || tot + g.length <= 12) { scelti.push(g); tot += g.length; }
      return tot >= 10;
    });
    return scelti;
  };
  // class index -> level of this source
  QZ.livelloPerClasse = function (fonte, classe) {
    var n = fonte.livelli.length;
    if (n <= 1) return 1;
    if (fonte.eta) {
      var a = fonte.eta[0], b = fonte.eta[1];
      var f = b > a ? (classe - a) / (b - a) : 0.5;
      f = Math.max(0, Math.min(1, f));
      return 1 + Math.round(f * (n - 1));
    }
    return Math.max(1, Math.min(n, Math.ceil(N.difficolta(classe) * n / 5)));
  };
})();
