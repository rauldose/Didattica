/*
 * E.G. ("Esercizi e Giochi") - core: data, parser, storage, import.
 * Prof. Carmelo Muscolino, Visual Basic per DOS, 1997-98 (eg.txt).
 *
 * An "esercitazione" is:
 *   { id, titolo, parametri: {tp, pt, ok, err, sl, tg}, livelli: [L1..L5 text or null] }
 * parametri (one value per level 1..5), from the original .DAT file:
 *   tp  - ogni quanti secondi togliere punti      (seconds between time penalties)
 *   pt  - punti tolti al passare del tempo
 *   ok  - punti per risposta corretta
 *   err - punti persi per errore
 *   sl  - punti occorrenti per superare il livello (0 = the previous level is the last)
 *   tg  - secondi di gioco guadagnati nel livello (0 = no game in that level)
 * Level texts use his original syntax (see the bundled "Demo" sets).
 */
(function () {
  "use strict";
  var EG = {};
  window.EG = EG;

  EG.CHIAVI = ["tp", "pt", "ok", "err", "sl", "tg"];
  EG.ETICHETTE = {
    tp: "ogni quanti secondi togliere punti",
    pt: "punti tolti al passare del tempo",
    ok: "punti per risposta corretta",
    err: "punti persi per errore",
    sl: "punti per superare il livello (0 = livello finale)",
    tg: "secondi di gioco (0 = nessun gioco)"
  };
  EG.PREDEFINITI = { tp: [10, 10, 7, 7, 7], pt: [5, 5, 5, 5, 5], ok: [60, 60, 60, 60, 60], err: [30, 40, 40, 50, 60], sl: [300, 600, 800, 1000, 1200], tg: [0, 30, 0, 90, 120] };

  /* ---------------- library: bundled + teacher-made ---------------- */
  function copia(o) { return JSON.parse(JSON.stringify(o)); }
  EG.utente = function () { return D.store.get("eg.utente", []); };
  EG.salvaUtente = function (lista) { D.store.set("eg.utente", lista); };
  EG.tutte = function () {
    var ut = EG.utente(), ids = {};
    ut.forEach(function (e) { ids[e.id] = e; });
    var out = (window.EG_DATI || []).map(function (e) {
      if (ids[e.id]) { var u = ids[e.id]; delete ids[e.id]; u.modificata = true; return u; }
      return e;
    });
    Object.keys(ids).forEach(function (k) { ids[k].utente = true; out.push(ids[k]); });
    return out;
  };
  EG.trova = function (id) { return EG.tutte().filter(function (e) { return e.id === id; })[0]; };
  EG.originale = function (id) { return (window.EG_DATI || []).filter(function (e) { return e.id === id; })[0]; };
  EG.salva = function (es) {
    var lista = EG.utente().filter(function (e) { return e.id !== es.id; });
    var c = copia(es); delete c.modificata; delete c.utente;
    lista.push(c);
    EG.salvaUtente(lista);
  };
  EG.elimina = function (id) { EG.salvaUtente(EG.utente().filter(function (e) { return e.id !== id; })); };
  EG.nuova = function () {
    return { id: "U" + Date.now().toString(36).toUpperCase(), titolo: "Nuova esercitazione", parametri: copia(EG.PREDEFINITI), livelli: ["'1\n.Calcola\n2+2=\\4\n", null, null, null, null] };
  };

  // Number of playable levels (Nlivellimax): stops at the first sl = 0 or missing level
  EG.livelliMax = function (es) {
    var n = 5;
    for (var i = 0; i < 5; i++) { if (!es.parametri.sl[i]) { n = i; break; } }
    for (var j = 0; j < n; j++) { if (!es.livelli[j]) { n = j; break; } }
    return Math.max(1, n);
  };

  /* ---------------- parser (leggiquesiti) ----------------
     Returns { lezione, quesiti: [{ testo, consegna, legato }] }.
     testo = board text + "\" + answer(s). legato = must follow the previous one. */
  function primaAlternativa(ese) {
    // "\!x\y" -> the item marked "!" ; "\x\y" -> x
    var parti = ese.slice(1).split("\\");
    for (var k = 0; k < parti.length; k++) if (parti[k].trim().charAt(0) === "!") return parti[k].trim().slice(1).trim();
    return (parti[0] || "").trim();
  }
  EG.analizza = function (testoLivello) {
    var righe = (testoLivello || "").replace(/\r/g, "").split("\n");
    var tipo = 1, lezione = "", Uconse = "", quesiti = [], cur = null;
    var ese = [], conse = [], base = "";
    function nuovoQ() { if (!cur) { cur = { testo: "", consegna: "", legato: false }; } return cur; }
    function chiudi() {
      for (var t = 0; t < ese.length; t++) {
        var q = { testo: base + ese[t], consegna: conse[t] || Uconse, legato: t > 0 };
        quesiti.push(q);
        if (tipo === 2) base += ese[t].slice(1) + "\n";
        else if (tipo === 3) {
          if (t % 2 === 0) base += primaAlternativa(ese[t]) + " = ";
          else base += primaAlternativa(ese[t]) + "\n";
        } else if (tipo === 4) {
          var kl = base.indexOf("..");
          if (kl >= 0) {
            var b1 = base.slice(0, kl), b2 = base.slice(kl + 2).replace(/^\.+/, "");
            base = b1 + " " + primaAlternativa(ese[t]) + " " + b2;
          }
        }
      }
      ese = []; conse = []; base = "";
    }
    righe.forEach(function (ii) {
      var aii = ii.replace(/^\s+/, "");
      if (aii.charAt(0) === "'" && /[0-4]/.test(aii.charAt(1))) {
        if (ese.length) chiudi();
        tipo = parseInt(aii.charAt(1), 10);
        return;
      }
      var consegna = aii.charAt(0) === "." && aii.slice(0, 2) !== "..";
      if (tipo === 0) { lezione += ii + "\n"; return; }
      if (tipo === 1) {
        if (ii.trim() === "") return;
        if (consegna) { Uconse = aii.slice(1); return; }
        nuovoQ().testo += ii;
        if (ii.indexOf("\\") < 0) { cur.testo += "\n"; return; }
        cur.consegna = Uconse;
        quesiti.push(cur); cur = null;
        return;
      }
      // types 2, 3, 4
      if (consegna) { Uconse = aii.slice(1); return; }
      var k = ii.indexOf("\\");
      if (k >= 0) {
        ese.push(ii.slice(k));
        conse.push(tipo === 4 ? ii.slice(0, k).trim() : ii.slice(0, k).replace(/\s+$/, ""));
        return;
      }
      if (ii.trim() === "") { chiudi(); return; }
      base += ii + "\n";
    });
    if (ese.length) chiudi();      // (original lost a final exercise without a blank line after it)
    return { lezione: lezione, quesiti: quesiti };
  };

  /* Split one quesito into board text and answers (esercizio) */
  EG.risposte = function (q) {
    var al = q.testo.indexOf("\\");
    var domanda = q.testo.slice(0, al), risposta = q.testo.slice(al + 1);
    var parti = risposta.split("\\").map(function (s) { return s.trim(); });
    var lista = parti.some(function (s) { return s.charAt(0) === "!"; });
    var giusta = null, voci = [];
    parti.forEach(function (s) {
      if (s === "") return;
      if (s.charAt(0) === "!") { s = s.slice(1).trim(); giusta = s; }
      voci.push(s);
    });
    return { domanda: domanda.replace(/\s+$/, ""), lista: lista, voci: voci, giusta: lista ? giusta : voci[0] };
  };

  /* ---------------- import of the ORIGINAL DOS files ----------------
     .L1-.L5 / .DAT: each byte stored as (char - 10), code page 850.
     .L1: line 1 = title (plain), line 2 = author password (ignored). */
  function decodRiga(b) {
    var x = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) x[i] = (b[i] + 10) & 255;
    return D.decodifica(x, "cp850");
  }
  function qbVal(t) { var m = /^[+-]?\d+/.exec(t); return m ? parseInt(m[0], 10) : 0; }
  EG.importaOriginali = function (files) {
    var gruppi = {};
    files.forEach(function (f) {
      var m = /^(.*)\.(L[1-5]|DAT)$/i.exec(f.name);
      if (!m) return;
      var k = m[1].toUpperCase();
      (gruppi[k] = gruppi[k] || {})[m[2].toUpperCase()] = f;
    });
    var nomi = Object.keys(gruppi).filter(function (k) { return gruppi[k].L1; });
    return Promise.all(nomi.map(function (nome) {
      var g = gruppi[nome];
      var es = { id: "U-" + nome, titolo: nome, parametri: copia(EG.PREDEFINITI), livelli: [null, null, null, null, null] };
      var lavori = [];
      [1, 2, 3, 4, 5].forEach(function (n) {
        var f = g["L" + n];
        if (!f) return;
        lavori.push(D.leggiFile(f, true).then(function (buf) {
          var righe = D.righeBytes(new Uint8Array(buf));
          if (n === 1) {
            es.titolo = D.decodifica(righe[0], "cp850").trim() || nome;
            righe = righe.slice(2);
          }
          es.livelli[n - 1] = righe.map(decodRiga).join("\n").replace(/\s+$/, "") + "\n";
        }));
      });
      if (g.DAT) lavori.push(D.leggiFile(g.DAT, true).then(function (buf) {
        var righe = D.righeBytes(new Uint8Array(buf)).slice(1, 7);
        EG.CHIAVI.forEach(function (k, i) {
          var tok = righe[i] ? decodRiga(righe[i]).trim().split(/\s+/) : [];
          es.parametri[k] = [0, 1, 2, 3, 4].map(function (j) { return qbVal(tok[j] || "0"); });
        });
      }));
      return Promise.all(lavori).then(function () { return es; });
    }));
  };

  /* modern exchange file */
  EG.esporta = function (es) {
    var c = copia(es); delete c.modificata; delete c.utente;
    return JSON.stringify({ formato: "didattica-eg", versione: 1, esercitazione: c }, null, 1);
  };
  EG.importaJson = function (testo) {
    var o = JSON.parse(testo);
    var es = o.esercitazione || o;
    if (!es || !es.livelli || !es.parametri) throw new Error("File non valido");
    return es;
  };
})();
