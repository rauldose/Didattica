/*
 * Impara giocando – "Per gli insegnanti" (globale INS).
 * Like the "Programmatore" of his E.G. and EM: teachers write their own
 * exercises. Quizzes use the shared "impara-quiz" format (see nuovo/BRIEF.md)
 * and are stored in localStorage "impara.quiz".
 *
 * Provides: storage (with "memory full" detection), new/duplicate quiz,
 * validation, share-link encode/decode (deflate-raw + base64url), .json
 * export, image downscaling, and import of .json quizzes and of the
 * ORIGINAL E.G. (.L1-.L5/.DAT) and EM (.ESE + media) files through the
 * existing importers in programmi/eg and programmi/em (loaded on demand).
 */
(function () {
  "use strict";
  var INS = {};
  window.INS = INS;

  INS.MATERIE = [
    { id: "ita", nome: "Italiano", emoji: "📖", tema: "t-ita" },
    { id: "mat", nome: "Matematica", emoji: "🔢", tema: "t-mat" },
    { id: "sci", nome: "Scienze", emoji: "🔬", tema: "t-sci" },
    { id: "altro", nome: "Altro", emoji: "🧩", tema: "t-ins" }
  ];
  INS.materia = function (id) { return INS.MATERIE.filter(function (m) { return m.id === id; })[0] || INS.MATERIE[3]; };
  INS.TIPI = {
    "scelta": { nome: "Scelta multipla", emoji: "🔘", sotto: "Una risposta giusta tra 2–6" },
    "vero-falso": { nome: "Vero o falso", emoji: "✅", sotto: "Una frase: vera o falsa?" },
    "scrivi": { nome: "Risposta scritta", emoji: "✏️", sotto: "Il bambino scrive la parola" },
    "tocca": { nome: "Tocca l'immagine", emoji: "👆", sotto: "Tocca il punto giusto della foto" }
  };
  INS.LINK_MAX = 8000;          // longer share links are not practical in chats

  /* ---------------- storage ---------------- */
  var CHIAVE = "impara.quiz";
  INS.lista = function () { var l = N.leggi("quiz", []); return Array.isArray(l) ? l : []; };
  // Returns true when saved, false when the storage is full / unavailable
  INS.salvaLista = function (l) {
    try { localStorage.setItem(CHIAVE, JSON.stringify(l)); return true; } catch (e) { return false; }
  };
  INS.trova = function (id) { return INS.lista().filter(function (q) { return q.id === id; })[0] || null; };
  INS.salva = function (q) {
    q.modificato = Date.now();
    var l = INS.lista(), i = -1;
    l.forEach(function (x, k) { if (x.id === q.id) i = k; });
    if (i >= 0) l[i] = q; else l.unshift(q);
    return INS.salvaLista(l);
  };
  INS.elimina = function (id) { return INS.salvaLista(INS.lista().filter(function (q) { return q.id !== id; })); };
  INS.usoMemoria = function () {   // approximate bytes used by the quizzes
    try { return (localStorage.getItem(CHIAVE) || "").length * 2; } catch (e) { return 0; }
  };

  INS.nuovoId = function () { return "q" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  INS.copia = function (o) { return JSON.parse(JSON.stringify(o)); };
  INS.nuovo = function () {
    return { formato: "impara-quiz", versione: 1, id: INS.nuovoId(), titolo: "", materia: "altro",
      autore: N.leggi("ins.autore", ""), classe: [0, 5], domande: [] };
  };
  INS.duplica = function (q) {
    var c = INS.copia(q); c.id = INS.nuovoId(); c.titolo = (q.titolo || "Quiz") + " (copia)"; return c;
  };
  INS.nuovaDomanda = function (tipo) {
    if (tipo === "scelta") return { tipo: tipo, testo: "", immagine: null, scelte: ["", ""], giusta: 0 };
    if (tipo === "vero-falso") return { tipo: tipo, testo: "", immagine: null, giusta: true };
    if (tipo === "scrivi") return { tipo: tipo, testo: "", immagine: null, risposte: [""], suggerimento: "" };
    return { tipo: "tocca", testo: "", immagine: null, zone: [], giusta: 0 };
  };

  // Make any object coming from a file/link a well-formed quiz
  INS.normalizza = function (o) {
    var q = { formato: "impara-quiz", versione: 1, id: String(o.id || INS.nuovoId()), titolo: String(o.titolo || "Quiz senza titolo"),
      materia: INS.materia(o.materia).id, autore: String(o.autore || ""),
      classe: Array.isArray(o.classe) && o.classe.length === 2 ? o.classe.map(function (c) { return Math.max(0, Math.min(5, parseInt(c, 10) || 0)); }) : [0, 5],
      domande: [] };
    if (q.classe[0] > q.classe[1]) q.classe.reverse();
    (o.domande || []).forEach(function (d) {
      if (!d || !INS.TIPI[d.tipo]) return;
      var n = INS.nuovaDomanda(d.tipo);
      n.testo = String(d.testo || ""); n.immagine = typeof d.immagine === "string" && d.immagine ? d.immagine : null;
      if (d.tipo === "scelta") { n.scelte = (d.scelte || []).map(String).slice(0, 6); n.giusta = Math.max(0, Math.min(n.scelte.length - 1, parseInt(d.giusta, 10) || 0)); }
      if (d.tipo === "vero-falso") n.giusta = d.giusta !== false && d.giusta !== "false";
      if (d.tipo === "scrivi") { n.risposte = (d.risposte || []).map(String); n.suggerimento = String(d.suggerimento || ""); }
      if (d.tipo === "tocca") {
        n.zone = (d.zone || []).filter(function (z) { return Array.isArray(z) && z.length === 4 && z.every(isFinite); }).map(function (z) { return z.map(Number); });
        n.giusta = Math.max(0, Math.min(n.zone.length - 1, parseInt(d.giusta, 10) || 0));
      }
      q.domande.push(n);
    });
    return q;
  };
  // The object that leaves the device (file / link): only the shared format
  INS.pulito = function (q) {
    var c = INS.normalizza(q);
    return { formato: c.formato, versione: c.versione, id: c.id, titolo: c.titolo, materia: c.materia, autore: c.autore, classe: c.classe, domande: c.domande };
  };

  /* ---------------- validation ---------------- */
  INS.problemi = function (d) {
    var p = [];
    if (!String(d.testo || "").trim() && d.tipo !== "tocca") p.push("Scrivi la domanda");
    if (d.tipo === "scelta") {
      var piene = d.scelte.filter(function (s) { return String(s).trim(); }).length;
      if (piene < 2) p.push("Servono almeno 2 risposte");
      if (!String(d.scelte[d.giusta] || "").trim()) p.push("La risposta giusta è vuota");
    }
    if (d.tipo === "scrivi" && !d.risposte.some(function (s) { return String(s).trim(); })) p.push("Scrivi almeno una risposta accettata");
    if (d.tipo === "tocca") {
      if (!d.immagine) p.push("Aggiungi un'immagine");
      else if (!d.zone.length) p.push("Disegna almeno una zona");
    }
    return p;
  };
  INS.contaProblemi = function (q) { return q.domande.filter(function (d) { return INS.problemi(d).length; }).length; };
  INS.haImmagini = function (q) { return q.domande.some(function (d) { return d.immagine && /^data:/.test(d.immagine); }); };

  INS.classi = function (q) {
    var c = q.classe || [0, 5];
    return c[0] === c[1] ? N.CLASSI[c[0]] : N.CLASSI[c[0]] + " – " + N.CLASSI[c[1]];
  };

  /* ---------------- share link: "z" + base64url(deflate-raw(JSON)) ---------------- */
  function b64url(bytes) {
    var s = "", CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function daB64url(t) {
    t = t.replace(/-/g, "+").replace(/_/g, "/");
    while (t.length % 4) t += "=";
    var s = atob(t), b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }
  function flusso(bytes, trasf) {
    var st = new Blob([bytes]).stream().pipeThrough(trasf);
    return new Response(st).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
  }
  INS.codifica = function (q) {
    var bytes = new TextEncoder().encode(JSON.stringify(INS.pulito(q)));
    if (typeof CompressionStream === "undefined") return Promise.resolve("j" + b64url(bytes));
    return flusso(bytes, new CompressionStream("deflate-raw")).then(function (z) { return "z" + b64url(z); })
      .catch(function () { return "j" + b64url(bytes); });
  };
  INS.decodifica = function (dati) {
    return Promise.resolve().then(function () {
      dati = String(dati || "").trim();
      var m = /[#&?]q=([^&]+)/.exec(dati); if (m) dati = m[1];
      var tipo = dati.charAt(0), bytes = daB64url(dati.slice(1));
      if (tipo === "j") return bytes;
      if (tipo !== "z") throw new Error("Link non valido");
      return flusso(bytes, new DecompressionStream("deflate-raw"));
    }).then(function (b) { return INS.normalizza(JSON.parse(new TextDecoder().decode(b))); });
  };
  INS.urlGioca = function (id) { return N.base + "quiz/gioca.html?mio=" + encodeURIComponent(id); };
  INS.link = function (q) { return INS.codifica(q).then(function (d) { return N.base + "quiz/gioca.html#q=" + d; }); };

  /* ---------------- file export ---------------- */
  INS.nomeFile = function (q) {
    return (q.titolo || "quiz").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40) + ".json";
  };
  INS.fileQuiz = function (q) {
    var testo = JSON.stringify(INS.pulito(q));
    try { return new File([testo], INS.nomeFile(q), { type: "application/json" }); }
    catch (e) { var b = new Blob([testo], { type: "application/json" }); b.name = INS.nomeFile(q); return b; }
  };
  INS.scarica = function (q) {
    var f = INS.fileQuiz(q), a = N.el("a", { href: URL.createObjectURL(f), download: INS.nomeFile(q) });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
  INS.puoCondividereFile = function (q) {
    try { return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [INS.fileQuiz(q)] })); } catch (e) { return false; }
  };
  INS.copiaTesto = function (t) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).catch(function () { return vecchiaCopia(t); });
    return Promise.resolve(vecchiaCopia(t));
  };
  function vecchiaCopia(t) {
    var a = N.el("textarea", { style: "position:fixed;left:-9999px;top:0", readonly: true }); a.value = t;
    document.body.appendChild(a); a.select();
    var ok = false; try { ok = document.execCommand("copy"); } catch (e) { /* */ }
    a.remove(); if (!ok) throw new Error("copia non riuscita");
  }

  /* ---------------- images: downscale to max 800px, JPEG ~0.8 ---------------- */
  function caricaImg(src) {
    return new Promise(function (ok, ko) {
      var img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { ko(new Error("Immagine non leggibile")); };
      img.src = src;
    });
  }
  // src: File/Blob or URL. Resolves { url, w, h, scala } (scala = new/old size)
  INS.immagine = function (src, max) {
    max = max || 800;
    var url = typeof src === "string" ? src : URL.createObjectURL(src);
    return caricaImg(url).then(function (img) {
      if (typeof src !== "string") URL.revokeObjectURL(url);
      var W = img.naturalWidth, H = img.naturalHeight, s = Math.min(1, max / Math.max(W, H));
      var w = Math.max(1, Math.round(W * s)), h = Math.max(1, Math.round(H * s));
      var c = document.createElement("canvas"); c.width = w; c.height = h;
      var x = c.getContext("2d");
      x.fillStyle = "#fff"; x.fillRect(0, 0, w, h);
      x.drawImage(img, 0, 0, w, h);
      var jpg = c.toDataURL("image/jpeg", 0.8), png = c.toDataURL("image/png");
      // drawings with few colours (like his .bmp) are often smaller as PNG
      return { url: png.length < jpg.length ? png : jpg, w: w, h: h, scala: w / W };
    });
  };

  /* ---------------- import ---------------- */
  var caricati = {};
  INS.carica = function (src) {
    if (caricati[src]) return caricati[src];
    caricati[src] = new Promise(function (ok, ko) {
      var s = document.createElement("script");
      s.src = src; s.onload = ok;
      s.onerror = function () { delete caricati[src]; ko(new Error("Non riesco a caricare " + src)); };
      document.head.appendChild(s);
    });
    return caricati[src];
  };
  // the original importers need js/common.js (global D) first
  INS.caricaImportatori = function () {
    var r = N.base + "../";
    return INS.carica(r + "js/common.js").then(function () {
      return Promise.all([INS.carica(r + "programmi/eg/eg-core.js"), INS.carica(r + "programmi/em/em-core.js")]);
    });
  };
  function leggiTesto(f) {
    return new Promise(function (ok, ko) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = ko; r.readAsText(f); });
  }
  function testoPulito(t) { return String(t || "").replace(/[ \t]+\n/g, "\n").trim(); }
  function unisci(consegna, testo) {
    consegna = testoPulito(consegna); testo = testoPulito(testo);
    return consegna && testo ? consegna + "\n\n" + testo : consegna || testo;
  }
  function limitaScelte(voci, giusta) {          // keep the right one, at most 6
    var altre = voci.filter(function (v) { return v !== giusta; });
    var l = N.mescola(altre).slice(0, 5); l.push(giusta);
    return voci.filter(function (v) { return l.indexOf(v) >= 0; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
  }

  /* E.G.: one quiz per level; type 1-4 questions -> "scrivi" or "scelta" */
  INS.daEG = function (es) {
    var out = [], livelli = es.livelli.map(function (t, i) { return t ? i : -1; }).filter(function (i) { return i >= 0; });
    livelli.forEach(function (i) {
      var an = EG.analizza(es.livelli[i]), dom = [];
      an.quesiti.forEach(function (q) {
        var r = EG.risposte(q), testo = unisci(q.consegna, r.domanda);
        if (!r.voci.length) return;
        if (r.lista && r.voci.length >= 2 && r.giusta) {
          var voci = r.voci.length > 6 ? limitaScelte(r.voci, r.giusta) : r.voci.filter(function (v, k, a) { return a.indexOf(v) === k; });
          dom.push({ tipo: "scelta", testo: testo, immagine: null, scelte: voci, giusta: Math.max(0, voci.indexOf(r.giusta)) });
        } else dom.push({ tipo: "scrivi", testo: testo, immagine: null, risposte: r.voci.slice(0, 6), suggerimento: "" });
      });
      if (!dom.length) return;
      var q = INS.nuovo();
      q.titolo = (es.titolo || "Esercitazione E.G.") + (livelli.length > 1 ? " – Livello " + (i + 1) : "");
      q.autore = ""; q.domande = dom;
      out.push(q);
    });
    return out;
  };

  /* EM: one quiz per level; every step of an exercise becomes a question
     with the board text written so far (blanks "____" filled as in his player) */
  function paroleLavagna(t) {
    var viste = {}, out = [];
    t.split(/\s+/).forEach(function (w) {
      w = w.replace(/^[^\wÀ-ÿ']+|[^\wÀ-ÿ']+$/g, "");
      if (w.length < 2 || /^_+$/.test(w) || viste[w.toLowerCase()]) return;
      viste[w.toLowerCase()] = 1; out.push(w);
    });
    return out;
  }
  INS.daEM = function (es) {
    var cache = {};
    function img(nome) {
      if (!cache[nome]) {
        var u = EMC.urlMedia(es, nome);
        cache[nome] = u ? INS.immagine(u).catch(function () { return null; }) : Promise.resolve(null);
      }
      return cache[nome];
    }
    var lavori = [];
    es.livelli.forEach(function (l, i) {
      if (!l || !l.testo) return;
      var an = EMC.analizzaLivello(l.testo);
      if (!an.esercizi.length) return;
      var passi = [];
      an.esercizi.forEach(function (e) {
        var lav = "";
        e.passi.forEach(function (p) {
          lav += p.testo;
          var nomi = EMC.media(lav).filter(EMC.eImmagine);
          var testo = unisci(EMC.senzaMedia(e.consegna || ""), EMC.senzaMedia(lav));
          var giusta = p.risposte[0] || null;
          passi.push({ p: p, testo: testo, lavagna: EMC.senzaMedia(lav), nome: nomi[0] || null });
          if (giusta != null && /_{2,}/.test(lav)) lav = lav.replace(/_{2,}/, giusta);
        });
      });
      lavori.push(Promise.all(passi.map(function (x) { return x.nome ? img(x.nome) : null; })).then(function (imgs) {
        var dom = [];
        passi.forEach(function (x, k) {
          var p = x.p, im = imgs[k];
          var d = null;
          if (p.tipo === "clicca") {
            if (!im || !p.zone.length) return;
            d = { tipo: "tocca", testo: x.testo, immagine: im.url, giusta: 0,
              zone: p.zone.map(function (z) { return z.map(function (v) { return Math.round(v * im.scala); }); }) };
          } else if (p.tipo === "scegli") {
            var voci = p.voci.slice().sort(function (a, b) { return a.localeCompare(b, "it", { numeric: true }); });
            if (voci.length > 6) voci = limitaScelte(voci, p.risposte[0]);
            d = { tipo: "scelta", testo: x.testo, immagine: im ? im.url : null, scelte: voci, giusta: Math.max(0, voci.indexOf(p.risposte[0])) };
          } else if (p.tipo === "seleziona") {
            var giusta = p.risposte[0];
            if (!giusta) return;
            var altre = N.mescola(paroleLavagna(x.lavagna).filter(function (w) { return w.toLowerCase() !== giusta.toLowerCase() && giusta.toLowerCase().indexOf(w.toLowerCase()) < 0; })).slice(0, 3);
            var sc = N.mescola(altre.concat([giusta]));
            d = { tipo: "scelta", testo: x.testo, immagine: im ? im.url : null, scelte: sc, giusta: sc.indexOf(giusta) };
            if (sc.length < 2) return;
          } else {
            if (!p.risposte.length) return;
            d = { tipo: "scrivi", testo: x.testo, immagine: im ? im.url : null, risposte: p.risposte.slice(0, 6), suggerimento: p.sugg || "" };
          }
          dom.push(d);
        });
        if (!dom.length) return null;
        var q = INS.nuovo();
        q.titolo = (es.titolo || "Esercitazione EM") + " – Livello " + (i + 1);
        q.autore = ""; q.domande = dom;
        return q;
      }));
    });
    return Promise.all(lavori).then(function (l) {
      l = l.filter(Boolean);
      if (l.length === 1) l[0].titolo = l[0].titolo.replace(/ – Livello \d$/, "");
      return l;
    });
  };

  // files: array of File. Resolves { quiz: [...], avvisi: [...] }
  INS.importaFile = function (files) {
    files = Array.prototype.slice.call(files);
    var json = files.filter(function (f) { return /\.json$/i.test(f.name); });
    var eg = files.filter(function (f) { return /\.(L[1-5]|DAT)$/i.test(f.name); });
    var em = files.filter(function (f) { return /\.(ese|bmp|png|jpe?g|gif|wav)$/i.test(f.name); });
    var hasEse = em.some(function (f) { return /\.ese$/i.test(f.name); });
    var quiz = [], avvisi = [];
    var ignorati = files.length - json.length - eg.length - (hasEse ? em.length : 0);
    if (ignorati > 0) avvisi.push(ignorati === 1 ? "Un file non è stato riconosciuto." : ignorati + " file non sono stati riconosciuti.");
    var serve = eg.length || hasEse;
    var lavori = json.map(function (f) {
      return leggiTesto(f).then(function (t) {
        var o = JSON.parse(t);
        if (o.formato === "didattica-eg" || o.formato === "didattica-em") {
          return INS.caricaImportatori().then(function () {
            return o.formato === "didattica-eg" ? INS.daEG(o.esercitazione) : INS.daEM(o.esercitazione);
          });
        }
        var l = Array.isArray(o) ? o : o.quiz && Array.isArray(o.quiz) ? o.quiz : [o];
        l = l.filter(function (x) { return x && Array.isArray(x.domande); });
        if (!l.length) throw new Error("non è un quiz");
        return l.map(INS.normalizza);
      }).then(function (l) { quiz.push.apply(quiz, l); }, function () { avvisi.push(f.name + ": file non valido."); });
    });
    if (serve) lavori.push(INS.caricaImportatori().then(function () {
      var p = [];
      if (eg.length) {
        if (!eg.some(function (f) { return /\.L1$/i.test(f.name); })) avvisi.push("Per E.G. serve almeno il file .L1.");
        p.push(EG.importaOriginali(eg).then(function (sets) { sets.forEach(function (es) { quiz.push.apply(quiz, INS.daEG(es)); }); }));
      }
      if (hasEse) p.push(EMC.importa(em).then(function (sets) {
        return Promise.all(sets.map(INS.daEM)).then(function (r) { r.forEach(function (l) { quiz.push.apply(quiz, l); }); });
      }));
      return Promise.all(p);
    }).catch(function (e) { avvisi.push("Errore nella lettura degli esercizi originali: " + e.message); }));
    return Promise.all(lavori).then(function () { return { quiz: quiz, avvisi: avvisi }; });
  };
})();

/* ---------------- shared UI: share dialog, storage-full warning ---------------- */
(function () {
  "use strict";
  var INS = window.INS, el = N.el;
  function kB(n) { return n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + " kB" : (n / 1048576).toFixed(1).replace(".", ",") + " MB"; }
  INS.kB = kB;

  INS.memoriaPiena = function () {
    return N.dialogo({
      titolo: "Memoria piena 😟",
      testo: "Il browser non ha più spazio per salvare i quiz.\n\n• Usa foto più piccole o toglile.\n• Scarica i quiz che non usi (Condividi → Scarica file) e poi eliminali.\n\nL'ultima modifica NON è stata salvata.",
      pulsanti: [{ testo: "Ho capito", valore: true }]
    });
  };

  INS.condividi = function (q) {
    if (!q.domande.length) return N.dialogo({ titolo: "Quiz vuoto", testo: "Aggiungi almeno una domanda prima di condividere." });
    return INS.link(q).then(function (link) {
      var conImg = INS.haImmagini(q), lungo = link.length > INS.LINK_MAX;
      var nodo = el("div", { class: "condividi" }), opz = { titolo: "Condividi «" + (q.titolo || "Quiz") + "»", nodo: nodo, pulsanti: [{ testo: "Chiudi", valore: null, secondario: true }] };
      var npr = INS.contaProblemi(q);
      if (npr) nodo.appendChild(el("p", { class: "problemi", style: "padding-left:12px", text: "⚠️ " + (npr === 1 ? "Una domanda è" : npr + " domande sono") + " da completare." }));
      var riga = el("div", { class: "scelte-import" });
      function chiudi() { if (opz._chiudi) opz._chiudi(null); }
      var puoFile = INS.puoCondividereFile(q);
      var bFile = el("button", { class: "btn" + (conImg || lungo ? "" : " secondario"), type: "button", text: "💾 Scarica file", onclick: function () { INS.scarica(q); N.esito("info", "File scaricato"); } });
      var bShareFile = puoFile ? el("button", { class: "btn", type: "button", text: "📤 Condividi il file", onclick: function () {
        navigator.share({ files: [INS.fileQuiz(q)], title: q.titolo }).then(chiudi, function () { /* annullato */ });
      } }) : null;
      if (conImg || lungo) {
        nodo.appendChild(el("p", { text: conImg
          ? "Questo quiz contiene immagini: il link sarebbe lunghissimo (" + kB(link.length) + ") e non funzionerebbe nei messaggi."
          : "Questo quiz è molto lungo: il link non entrerebbe in un messaggio." }));
        nodo.appendChild(el("p", { class: "nota", text: "Manda invece il file (.json) per email, WhatsApp o sul registro. Chi lo riceve apre «Per gli insegnanti» → «Importa», poi «Gioca»." }));
        if (bShareFile) riga.appendChild(bShareFile);
        riga.appendChild(bFile);
      } else {
        var campo = el("input", { class: "campo campo-link", type: "text", readonly: true, value: link, "aria-label": "Link del quiz", id: "link-condividi", onfocus: function () { this.select(); } });
        nodo.appendChild(el("p", { text: "Chi apre questo link gioca subito, senza installare niente." }));
        nodo.appendChild(campo);
        if (navigator.share) riga.appendChild(el("button", { class: "btn", type: "button", text: "📤 Condividi", onclick: function () {
          navigator.share({ title: q.titolo, text: "Gioca al quiz «" + q.titolo + "»", url: link }).then(chiudi, function (e) {
            if (e && e.name === "AbortError") return;
            copia();
          });
        } }));
        var copia = function () {
          INS.copiaTesto(link).then(function () { N.esito("si", "Link copiato! Incollalo dove vuoi."); }, function () { campo.focus(); campo.select(); N.esito("info", "Copia il link a mano"); });
        };
        riga.appendChild(el("button", { class: "btn" + (navigator.share ? " secondario" : ""), type: "button", text: "📋 Copia link", onclick: copia }));
        riga.appendChild(bFile);
      }
      nodo.appendChild(riga);
      return N.dialogo(opz);
    });
  };
})();
