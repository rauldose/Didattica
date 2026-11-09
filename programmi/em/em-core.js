/*
 * EM - Esercizi Multimediali (v1, revisione 2/7/2000) - core.
 * Prof. Carmelo Muscolino, Windows (Delphi) 1998-2000.
 *
 * An EM "esercitazione" (originally a folder with NAME.ESE + .bmp/.wav files):
 *   { id, titolo, cartella?, parametri: {pl, sg, pp, pm, ti, pt, ac, oe, tv},
 *     livelli: [{ intest, testo } x5], media: { "nome.bmp": dataURL, ... } }
 * parametri, one value per level (from the <pl1>..<tv5> header lines):
 *   pl punti per superare il livello (cumulative)   sg secondi di gioco guadagnati
 *   pp (p+) punti per esercizio esatto              pm (p-) punti persi per errore
 *   ti tempo per rispondere (s)                     pt punti persi a tempo scaduto
 *   oe ordine esercizi (1 = casuale, 0 = sequenziale)  ac, tv: kept, not used
 *
 * Level syntax (as decoded from his files):
 *   text before the first <con>/<ese> = presentazione (may name .wav/.bmp files)
 *   <con> ...     consegna, common to the following exercises
 *   <ese> [voce programma.exe parametri]   starts an exercise (optional resource)
 *   lines without "\" are question text; each line with "\" is one question:
 *     suggerimento\risp1\risp2     digitare (typed, up to 6 valid answers)
 *     \!giusta\altra\altra         scegliere da una lista (alphabetical)
 *     \"parola                     selezionare sulla lavagna
 *     \|x y w h\x y w h ...        cliccare sull'immagine: first zone correct, others wrong
 *   "____" in the text is replaced by the answers as they are given.
 */
(function () {
  "use strict";
  var EMC = {};
  window.EMC = EMC;

  EMC.CHIAVI = [["pl", "pl"], ["sg", "sg"], ["p+", "pp"], ["p-", "pm"], ["ti", "ti"], ["pt", "pt"], ["ac", "ac"], ["oe", "oe"], ["tv", "tv"]];
  EMC.ETICHETTE = {
    pl: "punti per superare il livello", sg: "secondi di gioco guadagnati", pp: "punti per esercizio esatto",
    pm: "punti persi per risposta errata", ti: "tempo per rispondere (s)", pt: "punti persi a tempo scaduto",
    oe: "ordine casuale (1) o sequenziale (0)"
  };
  function copia(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------------- decoding of the original .ESE files ---------------- */
  var SH = [-2, 1, -1, 2];
  EMC.decodificaEse = function (bytes) {
    return D.righeBytes(bytes).map(function (r) {
      var x = new Uint8Array(r.length);
      for (var i = 0; i < r.length; i++) x[i] = (r[r.length - 1 - i] + SH[i % 4]) & 255;
      return D.decodifica(x, "cp1252");
    }).join("\n");
  };

  /* ---------------- ESE text -> object ---------------- */
  EMC.daTesto = function (testo, id) {
    var righe = testo.replace(/\r/g, "").split("\n");
    var es = { id: id, titolo: "", parametri: {}, livelli: [], media: {} };
    var m = /^(.*?)\s*pass\s*(\S*)\s*$/.exec(righe[0] || "");
    es.titolo = (m ? m[1] : righe[0] || "").trim() || "Esercitazione";
    EMC.CHIAVI.forEach(function (k) { es.parametri[k[1]] = [0, 0, 0, 0, 0]; });
    var liv = -1, buf = [];
    function chiudi() { if (liv >= 0) es.livelli[liv].testo = buf.join("\n").replace(/\s+$/, "") + "\n"; buf = []; }
    righe.slice(1).forEach(function (r) {
      var lv = /^<lv([1-5])>(.*)$/.exec(r);
      if (lv) { chiudi(); liv = parseInt(lv[1], 10) - 1; es.livelli[liv] = { intest: lv[2], testo: "" }; return; }
      if (liv < 0) {
        var re = /<(pl|sg|p\+|p-|ti|pt|ac|oe|tv)([1-5])>\s*(\S+)/g, x;
        while ((x = re.exec(r))) {
          var k = EMC.CHIAVI.filter(function (c) { return c[0] === x[1]; })[0][1];
          es.parametri[k][parseInt(x[2], 10) - 1] = /^-?\d+$/.test(x[3]) ? parseInt(x[3], 10) : 0;
        }
        return;
      }
      buf.push(r);
    });
    chiudi();
    for (var i = 0; i < 5; i++) if (!es.livelli[i]) es.livelli[i] = { intest: "", testo: "" };
    return es;
  };

  /* ---------------- level parser ---------------- */
  var MEDIA_RE = /(^|\s)([^\s\\]+\.(?:wav|bmp|png|jpe?g|gif|mp3|ogg))(?=\s|$)/gi;
  EMC.eImmagine = function (n) { return /\.(bmp|png|jpe?g|gif)$/i.test(n || ""); };
  EMC.eAudio = function (n) { return /\.(wav|mp3|ogg)$/i.test(n || ""); };
  EMC.media = function (t) {
    var out = [], m; MEDIA_RE.lastIndex = 0;
    while ((m = MEDIA_RE.exec(t || ""))) out.push(m[2].toLowerCase());
    return out;
  };
  EMC.senzaMedia = function (t) { return (t || "").replace(MEDIA_RE, "$1"); };
  function risorsa(t) {
    var tok = t.trim().split(/\s+/).filter(Boolean), i;
    for (i = 0; i < tok.length; i++) if (/\.exe$/i.test(tok[i])) break;
    if (i === tok.length) return null;
    return { voce: tok.slice(0, i).join(" ") || tok[i], programma: tok[i].toLowerCase(), parametri: tok.slice(i + 1).join(" ") };
  }
  EMC.risorsa = risorsa;
  function risposta(s) {
    var c = s.charAt(1);
    var parti = s.slice(1).split("\\").map(function (x) { return x.trim(); }).filter(Boolean);
    if (c !== '"' && c !== "|" && parti.some(function (x) { return x.charAt(0) === "!"; })) {
      var giusta = null;
      parti = parti.map(function (x) { if (x.charAt(0) === "!") { x = x.slice(1).trim(); giusta = x; } return x; });
      return { tipo: "scegli", voci: parti, risposte: [giusta] };
    }
    if (c === '"') return { tipo: "seleziona", risposte: s.slice(2).split("\\").map(function (x) { return x.replace(/^"/, "").trim(); }).filter(Boolean) };
    if (c === "|") {
      var zone = s.slice(2).split("\\").map(function (z) {
        var n = z.trim().split(/\s+/).map(Number);
        return n.length === 4 && n.every(isFinite) ? n : null;
      }).filter(Boolean);
      return { tipo: "clicca", zone: zone, risposte: [] };
    }
    return { tipo: "digita", risposte: s.slice(1).split("\\").map(function (x) { return x.trim(); }).filter(Boolean) };
  }
  EMC.analizzaLivello = function (testo) {
    var righe = (testo || "").replace(/\r/g, "").split("\n");
    var stato = "pres", pres = [], conLines = [], consegna = "", esercizi = [], cur = null, bufTesto = "";
    function chiudiEse() {
      if (cur) { cur.coda = bufTesto; if (cur.passi.length) esercizi.push(cur); }
      cur = null; bufTesto = "";
    }
    righe.forEach(function (r) {
      if (/^<con>/i.test(r)) {
        chiudiEse(); stato = "con"; conLines = [];
        var resto = r.slice(5).trim(); if (resto) conLines.push(resto);
        consegna = conLines.join("\n");
        return;
      }
      if (/^<ese>/i.test(r)) {
        chiudiEse(); stato = "ese";
        cur = { risorsa: risorsa(r.slice(5)), consegna: consegna, passi: [] };
        return;
      }
      if (stato === "pres") { pres.push(r); return; }
      if (stato === "con") { conLines.push(r); consegna = conLines.join("\n").replace(/^\s*\n|\s+$/g, ""); return; }
      var k = r.indexOf("\\");
      if (k < 0) { bufTesto += r + "\n"; return; }
      var p = risposta(r.slice(k));
      p.testo = bufTesto; p.sugg = r.slice(0, k).trim();
      cur.passi.push(p); bufTesto = "";
    });
    chiudiEse();
    var presentazione = pres.join("\n").replace(/^\s*\n|\s+$/g, "");
    return { presentazione: presentazione, risorsa: risorsa(presentazione.split("\n").filter(function (l) { return /\.exe\b/i.test(l); })[0] || ""), esercizi: esercizi };
  };
  EMC.livelliValidi = function (es) {
    var out = [];
    es.livelli.forEach(function (l, i) { if (l && EMC.analizzaLivello(l.testo).esercizi.length) out.push(i); });
    return out;
  };

  /* ---------------- media URLs ---------------- */
  EMC.urlMedia = function (es, nome) {
    nome = (nome || "").toLowerCase();
    if (es.media && es.media[nome]) return es.media[nome];
    if (es.cartella) return D.base + "dati/em/" + es.cartella + "/" + nome.replace(/\.bmp$/, ".png");
    return null;
  };

  /* ---------------- storage (IndexedDB: media can be large) ---------------- */
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error("IndexedDB non disponibile"));
      var r = indexedDB.open("didattica-em", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("esercitazioni", { keyPath: "id" }); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function tx(modo, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction("esercitazioni", modo), s = t.objectStore("esercitazioni"), out = fn(s);
        t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  EMC.utente = function () { return tx("readonly", function (s) { return s.getAll(); }).catch(function () { return []; }); };
  EMC.salva = function (es) { var c = copia(es); delete c.modificata; delete c.utente; return tx("readwrite", function (s) { s.put(c); }); };
  EMC.elimina = function (id) { return tx("readwrite", function (s) { s.delete(id); }); };

  EMC.originali = function () {
    return (window.EM_DATI || []).map(function (d) {
      var es = EMC.daTesto(d.testo, "B-" + d.cartella);
      es.cartella = d.cartella;
      return es;
    });
  };
  EMC.tutte = function () {
    return EMC.utente().then(function (ut) {
      var ids = {};
      ut.forEach(function (e) { ids[e.id] = e; });
      var out = EMC.originali().map(function (e) {
        if (ids[e.id]) { var u = ids[e.id]; delete ids[e.id]; u.modificata = true; return u; }
        return e;
      });
      Object.keys(ids).forEach(function (k) { ids[k].utente = true; out.push(ids[k]); });
      return out;
    });
  };
  EMC.trova = function (id) { return EMC.tutte().then(function (l) { return l.filter(function (e) { return e.id === id; })[0]; }); };
  EMC.originale = function (id) { return EMC.originali().filter(function (e) { return e.id === id; })[0]; };
  EMC.nuova = function () {
    var p = {};
    EMC.CHIAVI.forEach(function (k) { p[k[1]] = [0, 0, 0, 0, 0]; });
    p.pl = [100, 200, 300, 400, 500]; p.pp = [10, 10, 10, 10, 10]; p.pm = [5, 5, 5, 5, 5]; p.ti = [60, 60, 60, 60, 60];
    var l = [{ intest: "", testo: "\n  Presentazione del livello\n\n<con>\nCalcola:\n<ese>\n  2+3=\n\\5\n" }];
    for (var i = 1; i < 5; i++) l.push({ intest: "", testo: "" });
    return { id: "U" + Date.now().toString(36).toUpperCase(), titolo: "Nuova esercitazione", parametri: p, livelli: l, media: {} };
  };

  /* ---------------- import / export ---------------- */
  // files: FileList from a folder (or several .ESE + media). Groups by folder.
  EMC.importa = function (files) {
    var gruppi = {};
    files.forEach(function (f) {
      var path = (f.webkitRelativePath || f.name).split("/");
      var dir = path.length > 1 ? path.slice(0, -1).join("/") : "";
      (gruppi[dir] = gruppi[dir] || []).push(f);
    });
    var lavori = [];
    Object.keys(gruppi).forEach(function (dir) {
      var g = gruppi[dir];
      var json = g.filter(function (f) { return /\.json$/i.test(f.name); });
      json.forEach(function (f) {
        lavori.push(D.leggiFile(f).then(function (t) {
          var o = JSON.parse(t); var es = o.esercitazione || o;
          if (!es.livelli || !es.parametri) throw new Error(f.name + ": file non valido");
          return [es];
        }));
      });
      var ese = g.filter(function (f) { return /\.ese$/i.test(f.name); });
      if (!ese.length) return;
      var media = {};
      var mlav = g.filter(function (f) { return /\.(wav|bmp|png|jpg|jpeg|gif)$/i.test(f.name); }).map(function (f) {
        return D.leggiFile(f, "dataurl").then(function (u) { media[f.name.toLowerCase()] = u; });
      });
      lavori.push(Promise.all(mlav).then(function () {
        return Promise.all(ese.map(function (f) {
          return D.leggiFile(f, true).then(function (buf) {
            var es = EMC.daTesto(EMC.decodificaEse(new Uint8Array(buf)), "U" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1e4));
            es.media = media;
            return es;
          });
        }));
      }));
    });
    return Promise.all(lavori).then(function (r) { return [].concat.apply([], r); });
  };
  EMC.esporta = function (es) {
    var c = copia(es); delete c.modificata; delete c.utente;
    return JSON.stringify({ formato: "didattica-em", versione: 1, esercitazione: c });
  };

  /* ---------------- tiny safe calculator (resource "calcolatrice") ---------------- */
  EMC.calcola = function (s) {
    var t = s.replace(/,/g, ".").replace(/\s+/g, ""), i = 0;
    function num() { var m = /^\d*\.?\d+(e[+-]?\d+)?/i.exec(t.slice(i)); if (!m) throw new Error("?"); i += m[0].length; return parseFloat(m[0]); }
    function fat() {
      if (t[i] === "-") { i++; return -fat(); }
      if (t[i] === "+") { i++; return fat(); }
      if (t[i] === "(") { i++; var v = som(); if (t[i] !== ")") throw new Error("?"); i++; return v; }
      return num();
    }
    function pot() { var b = fat(); if (t[i] === "^") { i++; return Math.pow(b, pot()); } return b; }
    function pro() { var v = pot(); while (t[i] === "*" || t[i] === "/" || t[i] === ":") { var o = t[i++], w = pot(); v = o === "*" ? v * w : v / w; } return v; }
    function som() { var v = pro(); while (t[i] === "+" || t[i] === "-") { var o = t[i++], w = pro(); v = o === "+" ? v + w : v - w; } return v; }
    var r = som(); if (i !== t.length) throw new Error("?");
    return r;
  };
})();
