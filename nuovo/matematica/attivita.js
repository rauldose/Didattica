/*
 * Impara giocando – Matematica: elenco delle attività e generatori di esercizi.
 * Ispirati ai programmi DOS del Prof. Carmelo Muscolino (TABEL, OPERAZ,
 * ESPRES, RADICE, PITAGORA, GEOMETRIA PIANA) ed estesi in basso fino alla
 * 3ª primaria.
 *
 * An exercise ("esercizio") is { consegna?, problema?, figura?(noti), passi: [passo], finale?, chiave }.
 * A step ("passo") is { lavagna (HTML; a <span class="slot"> shows the typed answer),
 *   consegna?, etichetta?, unita?, risposta (number), spiega, aiuto?,
 *   scelta?: { domanda, voci: [..], giusta }, formula?, sugg?, nome? }.
 */
(function () {
  "use strict";
  var R = N.rand;
  var SLOT = '<span class="slot" aria-label="la tua risposta"></span>';
  var X = "×", DIV = ":", MENO = "−";

  // number formatting: up to 2 decimals, Italian comma, thin grouping for big numbers
  function f(n) {
    var s = String(+(+n).toFixed(2));
    var p = s.split(".");
    if (p[0].replace("-", "").length > 4) p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return p.length > 1 ? p[0] + "," + p[1] : p[0];
  }
  function tronca(x, d) { var k = Math.pow(10, d); return Math.floor(x * k + 1e-9) / k; }
  function sup(e) { return "<sup>" + e + "</sup>"; }
  function semplice(lavagna, risposta, spiega, aiuto, extra) {
    var p = { lavagna: lavagna, risposta: risposta, spiega: spiega, aiuto: aiuto };
    if (extra) Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
    return p;
  }
  function riga(s) { return '<div class="riga-calcolo">' + s + "</div>"; }

  /* =====================================================================
     1. TABELLINE (TABEL)
     ===================================================================== */
  function consiglioTabellina(a, b) {
    var t = Math.max(a, b) <= 12 ? (a === 1 || b === 1 ? 1 : Math.min(a, b) <= 10 && [2, 5, 9, 10, 11].indexOf(a) >= 0 ? a : b) : b;
    switch (t) {
      case 1: return "Per 1 il numero non cambia!";
      case 2: return "× 2 vuol dire fare il doppio.";
      case 5: return "Nella tabellina del 5 i risultati finiscono con 0 o con 5.";
      case 9: return "Trucco del 9: le cifre del risultato sommate fanno 9 (es. 63 → 6 + 3 = 9).";
      case 10: return "× 10: basta aggiungere uno zero!";
      case 11: return "× 11 di un numero da 1 a 9: la cifra si ripete (11 × 4 = 44).";
      default: return "Conta a salti di " + t + ": " + [1, 2, 3, 4].map(function (i) { return t * i; }).join(", ") + "…";
    }
  }
  function tabelline(liv) {
    var a, b, mancante = false;
    if (liv === 1) { a = R(1, 5); b = R(1, 10); if (R(0, 1)) { var t = a; a = b; b = t; } }
    else if (liv === 2) { a = R(1, 10); b = R(1, 10); }
    else if (liv === 3) { a = R(2, 10); b = R(2, 10); mancante = R(1, 100) <= 35; }
    else if (liv === 4) { a = R(2, 12); b = R(3, 12); mancante = R(1, 100) <= 35; }
    else { a = R(11, 99); b = R(2, 9); if (a % 10 === 0) a++; }
    var p = a * b, aiuto;
    if (liv === 5) {
      var d = a - a % 10, u = a % 10;
      aiuto = "Scomponi: " + a + " " + X + " " + b + " = " + d + " " + X + " " + b + " + " + u + " " + X + " " + b + " = " + (d * b) + " + " + (u * b);
      return { chiave: a + "x" + b, passi: [semplice(a + " " + X + " " + b + " = " + SLOT, p, aiuto + " = " + p, "Scomponi il numero grande in decine e unità: " + d + " e " + u + ".")] };
    }
    if (mancante) {
      var primo = R(0, 1) === 1;
      var lav = primo ? SLOT + " " + X + " " + b + " = " + p : a + " " + X + " " + SLOT + " = " + p;
      return {
        chiave: "m" + a + "x" + b, consegna: "Quale numero manca?",
        passi: [semplice(lav, primo ? a : b, a + " " + X + " " + b + " = " + p,
          "Pensa alla tabellina del " + (primo ? b : a) + ": quale numero dà " + p + "?")]
      };
    }
    return { chiave: a + "x" + b, passi: [semplice(a + " " + X + " " + b + " = " + SLOT, p, a + " " + X + " " + b + " = " + p, consiglioTabellina(a, b))] };
  }

  /* =====================================================================
     2. ADDIZIONI E SOTTRAZIONI
     ===================================================================== */
  function colonna(a, b, s) {
    return '<div class="colonna" aria-label="' + a + " " + (s === "+" ? "più" : "meno") + " " + b + '">' +
      '<span></span><span>' + a + '</span><span class="segno">' + s + '</span><span>' + b + '</span>' +
      '<span class="linea"></span><span class="linea"></span><span></span><span>' + SLOT + "</span></div>";
  }
  function addizioni(liv) {
    var piu = R(0, 1) === 1, a, b;
    if (liv === 1) { if (piu) { a = R(1, 15); b = R(1, 20 - a); } else { a = R(5, 20); b = R(1, a); } }
    else if (liv === 2) { if (piu) { a = R(11, 80); b = R(5, 100 - a); } else { a = R(20, 100); b = R(5, a - 3); } }
    else if (liv === 3) { if (piu) { a = R(100, 700); b = R(15, 299); } else { a = R(200, 999); b = R(15, a - 50); } }
    else if (liv === 4) { if (piu) { a = R(250, 999); b = R(150, 999); } else { a = R(1000, 1999); b = R(120, 999); } }
    else { if (piu) { a = R(1000, 6999); b = R(250, 2999); } else { a = R(2000, 9999); b = R(500, a - 300); } }
    var r = piu ? a + b : a - b, s = piu ? "+" : MENO;
    var aiuto = liv === 1 ? (piu ? "Parti dal numero più grande e conta in avanti." : "Parti da " + a + " e conta all'indietro di " + b + ".")
      : liv === 2 ? (piu ? "Prima aggiungi le decine, poi le unità." : "Prima togli le decine, poi le unità.")
        : (piu ? "In colonna: parti dalle unità (a destra) e ricorda il riporto!" : "In colonna: parti dalle unità. Se la cifra sopra è più piccola, chiedi un prestito alla cifra vicina.");
    var lav = liv >= 3 ? colonna(a, b, s) : a + " " + s + " " + b + " = " + SLOT;
    return { chiave: a + s + b, colonna: liv >= 3, passi: [semplice(lav, r, a + " " + s + " " + b + " = " + r, aiuto)] };
  }

  /* =====================================================================
     3. LE QUATTRO OPERAZIONI (OPERAZ) – divisioni sempre esatte
     ===================================================================== */
  function operazioni(liv) {
    var op = R(1, 4), a, b, r, S = 1;   // values are integers in units of 1/S
    if (liv <= 3) {
      var MAX = [0, 10, 50, 100][liv];
      if (op === 1) { a = R(1, MAX); b = R(1, MAX); }
      else if (op === 2) { a = R(2, MAX); b = R(0, a); }
      else if (op === 3) { a = R(2, [0, 5, 10, 15][liv]); b = R(2, [0, 5, 10, 12][liv]); }
      else { b = R(2, [0, 5, 10, 12][liv]); r = R(1, [0, 5, 10, 15][liv]); a = b * r; }
    } else {
      S = liv === 4 ? 10 : 100;
      if (op === 1) { a = R(S, 50 * S); b = R(S, 30 * S); }
      else if (op === 2) { a = R(5 * S, 60 * S); b = R(S, a - S); }
      else if (op === 3) {           // decimal × whole number
        a = R(S + 1, 20 * S); b = R(2, 9) * S;
        if (a % (S / 10) === 0 && liv === 5) a += R(1, 9);   // make sure 2 decimals appear on lv5
      } else {                       // exact division with a decimal result
        if (liv === 4) { b = R(2, 9); r = R(11, 99); if (r % 10 === 0) r++; a = b * r; b *= S; }   // 12,6 : 3 = 4,2  or  7 : 2 = 3,5
        else if (R(0, 1)) { b = 4 * S; a = (4 * R(1, 10) + N.scegli([1, 3])) * S; }             // 9 : 4 = 2,25
        else { b = R(2, 9); r = R(101, 999); if (r % 10 === 0) r++; a = b * r; b *= S; }      // 20,82 : 6 = 3,47
      }
    }
    var va = a / S, vb = b / S, segno, ris;
    if (op === 1) { segno = "+"; ris = va + vb; }
    else if (op === 2) { segno = MENO; ris = va - vb; }
    else if (op === 3) { segno = X; ris = va * vb; }
    else { segno = DIV; ris = va / vb; }
    ris = Math.round(ris * 1000) / 1000;
    var aiuto = {
      1: liv >= 4 ? "Metti in colonna virgola sotto virgola, poi somma." : "Somma con calma: prima le decine, poi le unità.",
      2: liv >= 4 ? "Virgola sotto virgola! Se serve, aggiungi uno zero dopo la virgola." : "Togli con calma: prima le decine, poi le unità.",
      3: liv >= 4 ? "Moltiplica come se non ci fosse la virgola, poi metti tante cifre decimali quante ne ha il numero." : "Ripassa la tabellina del " + Math.min(va, vb) + ".",
      4: liv >= 4 ? "Quando avanza un resto, metti la virgola nel risultato e aggiungi uno zero al resto." : "Pensa: quale numero " + X + " " + f(vb) + " fa " + f(va) + "?"
    }[op];
    var testo = f(va) + " " + segno + " " + f(vb);
    return { chiave: testo, passi: [semplice(testo + " = " + SLOT, ris, testo + " = " + f(ris), aiuto)] };
  }

  /* =====================================================================
     4. ESPRESSIONI (ESPRES: NUOVO, NUOVO1, NUOVO2) – un calcolo alla volta
     ===================================================================== */
  function tokenizza(s) {
    return s.match(/\d+|[+−×:()²]/g).map(function (t) { return /\d/.test(t) ? { n: +t } : { o: t }; });
  }
  // next sub-calculation: innermost brackets first; inside, powers, then × :, then + −
  function prossimo(tk) {
    var j = -1, i = -1, k;
    for (k = 0; k < tk.length; k++) if (tk[k].o === ")") { j = k; break; }
    if (j >= 0) { for (k = j; k >= 0; k--) if (tk[k].o === "(") { i = k; break; } }
    else j = tk.length;
    for (k = i + 1; k < j; k++) if (tk[k].o === "²" && tk[k - 1].n != null) return [k - 1, k];
    for (k = i + 1; k < j; k++) if (tk[k].o === X || tk[k].o === DIV) return [k - 1, k + 1];
    for (k = i + 1; k < j; k++) if (tk[k].o === "+" || tk[k].o === MENO) return [k - 1, k + 1];
    return null;
  }
  function calcola(tk, r) {
    if (tk[r[1]].o === "²") return tk[r[0]].n * tk[r[0]].n;
    var a = tk[r[0]].n, b = tk[r[1]].n, o = tk[r[0] + 1].o;
    return o === "+" ? a + b : o === MENO ? a - b : o === X ? a * b : a / b;
  }
  function togliParentesi(tk) {
    for (var k = 0; k + 2 < tk.length; k++) {
      if (tk[k].o === "(" && tk[k + 1].n != null && tk[k + 2].o === ")") { tk.splice(k, 3, tk[k + 1]); k = -1; }
    }
    return tk;
  }
  function mostra(tk, r, cls) {
    var h = "";
    tk.forEach(function (t, k) {
      if (r && k === r[0]) h += '<span class="' + (cls || "evidenzia") + '">';
      if (t.n != null) h += t.n;
      else if (t.o === "²") h += sup(2);
      else if (t.o === "(") h += (k > 0 && tk[k - 1].o !== "(" ? " " : "") + "(";
      else if (t.o === ")") h += ")";
      else h += " " + t.o + " ";
      if (r && k === r[1]) h += "</span>";
    });
    return h.replace(/\( /g, "(").replace(/ \)/g, ")").trim();
  }
  function testoCalcolo(tk, r) { return mostra(tk.slice(r[0], r[1] + 1)); }
  // builds all the steps; returns null if an intermediate result is not a whole number >= 0
  function costruisciEspressione(s, max) {
    var tk = togliParentesi(tokenizza(s)), righe = [], passi = [], r;
    while ((r = prossimo(tk))) {
      var v = calcola(tk, r);
      if (v < 0 || v % 1 !== 0 || v > (max || 2000)) return null;
      righe.push({ tk: tk.slice(), r: r });
      tk = tk.slice(); tk.splice(r[0], r[1] - r[0] + 1, { n: v }); togliParentesi(tk);
    }
    var fine = tk[0].n;
    righe.forEach(function (x, k) {
      var storia = righe.slice(0, k).map(function (y, i) { return riga((i ? "= " : "") + mostra(y.tk)); }).join("");
      var calc = testoCalcolo(x.tk, x.r), v = calcola(x.tk, x.r);
      var ultimo = k === righe.length - 1;
      passi.push({
        lavagna: '<div class="quaderno">' + storia + riga((k ? "= " : "") + mostra(x.tk, x.r)) + "</div>" +
          '<div class="sottocalcolo">' + calc + " = " + SLOT + "</div>",
        consegna: ultimo ? "Ultimo calcolo!" : k === 0 ? "Da dove si comincia? Quanto fa il calcolo colorato?" : "Riscrivi e continua: quanto fa il calcolo colorato?",
        risposta: v,
        spiega: calc + " = " + v,
        aiuto: x.tk[x.r[1]].o === "²" ? "La potenza: " + x.tk[x.r[0]].n + sup(2) + " = " + x.tk[x.r[0]].n + " " + X + " " + x.tk[x.r[0]].n + "."
          : s.indexOf("(") >= 0 ? "Prima si calcola dentro le parentesi. Dentro: potenze, poi " + X + " e :, infine + e " + MENO + "."
            : "Ricorda l'ordine: potenze, poi " + X + " e :, poi + e " + MENO + " da sinistra a destra."
      });
    });
    var finale = '<div class="quaderno">' + righe.map(function (y, i) { return riga((i ? "= " : "") + mostra(y.tk)); }).join("") +
      riga('= <span class="risultato-finale">' + fine + "</span>") + "</div>";
    return { chiave: s, passi: passi, finale: finale, consegna: "Risolvi passo passo, come sul quaderno." };
  }
  function espressioni(liv) {
    var es = null, s, a, b, c, d, e, rnd = function (n) { return R(0, n - 1); };
    while (!es) {
      if (liv === 1) {
        a = R(3, 15); b = R(1, 9); c = R(1, 9);
        s = R(0, 1) ? a + " + " + b + " − " + c : a + " − " + b + " + " + c;
        es = costruisciEspressione(s, 20);
      } else if (liv === 2) {            // NUOVO
        switch (R(1, 4)) {
          case 1: b = rnd(9) + 1; a = rnd(100) + b; c = rnd(9) + 1; s = a + " − " + b + " + " + c; break;
          case 2: c = rnd(9) + 1; b = rnd(9) + 1; a = rnd(100) + c; s = a + " + " + b + " − " + c; break;
          case 3: b = rnd(9) + 1; a = rnd(10); c = rnd(9) + 1; s = a + " + " + b + " × " + c; break;
          default: c = rnd(9) + 1; b = rnd(9) + 1; a = rnd(10) + Math.ceil(c / b); s = a + " × " + b + " − " + c;
        }
        es = costruisciEspressione(s);
      } else if (liv === 3) {            // NUOVO1 (potenze)
        switch (R(1, 3)) {
          case 1: b = rnd(9) + 1; a = rnd(100) + b * b; c = rnd(9) + 1; s = a + " − " + b + "² + " + c; break;
          case 2: b = rnd(12) + 5; a = rnd(10) + 5; c = rnd(9) + 1; s = a + " + " + b + "² − " + c; break;
          default: b = rnd(9) + 1; a = rnd(10) + b + 1; c = rnd(9) + 1; s = a + "² − " + b + "² + " + c;
        }
        es = costruisciEspressione(s);
      } else if (liv === 4) {            // NUOVO2 (parentesi)
        switch (R(1, 3)) {
          case 1: b = rnd(9) + 1; c = rnd(9) + 1; a = rnd(100) + b * b + c; s = a + " − (" + b + "² + " + c + ")"; break;
          case 2: c = rnd(9) + 1; b = rnd(12) + 5; a = rnd(10) + 5; s = a + " + (" + b + "² + " + c + ")"; break;
          default: b = rnd(9) + 1; a = rnd(10) + b + 1; c = rnd(9) + 1; s = "(" + a + "² − " + b + "²) + " + c;
        }
        es = costruisciEspressione(s);
      } else {                           // more steps: brackets with × : and powers
        switch (R(1, 4)) {
          case 1: a = R(2, 9); b = R(2, 9); c = R(1, 9); d = R(2, 6); s = a + " × (" + b + " + " + c + ") − " + d + "²"; break;
          case 2: a = R(1, 6); b = R(1, 6); c = N.scegli([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(function (x) { return (a + b) * (a + b) % x === 0; })); s = "(" + a + " + " + b + ")² : " + c; break;
          case 3: b = R(2, 6); c = R(2, 6); d = R(1, b * c - 1); a = R(Math.ceil(Math.sqrt(b * c)), 12); s = a + "² − (" + b + " × " + c + " − " + d + ")"; break;
          default: b = R(1, 9); a = b + R(1, 9); c = R(2, 6); e = R(2, 9); d = e * R(1, 9); s = "(" + a + " − " + b + ") × " + c + " + " + d + " : " + e;
        }
        es = costruisciEspressione(s);
      }
    }
    return es;
  }

  /* =====================================================================
     5. RADICI QUADRATE (RADICE)
     ===================================================================== */
  function radici(liv) {
    var A, r;
    if (liv === 1) {
      A = R(2, 10);
      return {
        chiave: A, consegna: "Quale numero, moltiplicato per se stesso, fa " + A * A + "?",
        passi: [semplice(SLOT + " " + X + " " + SLOT + " = " + A * A, A, A + " " + X + " " + A + " = " + A * A + ", quindi √" + A * A + " = " + A,
          "Prova con le tabelline: 1 × 1, 2 × 2, 3 × 3… quale arriva a " + A * A + "?")]
      };
    }
    if (liv <= 3) {
      A = liv === 2 ? R(5, 13) : R(14, 34);
      return {
        chiave: A, consegna: liv === 2 ? "Il risultato è un numero intero (fino a 13)." : "Il risultato è un numero intero tra 14 e 34.",
        passi: [semplice("√" + A * A + " = " + SLOT, A, "√" + A * A + " = " + A + " perché " + A + " " + X + " " + A + " = " + A * A,
          liv === 2 ? "Quale numero per se stesso fa " + A * A + "?" : "Guarda l'ultima cifra di " + A * A + ": ti dice con che cifra finisce la radice. Poi prova con le decine: " + Math.floor(A / 10) * 10 + sup(2) + " = " + Math.pow(Math.floor(A / 10) * 10, 2) + ".")]
      };
    }
    do { A = R(150, 990); } while (Math.sqrt(A) % 1 === 0);
    var d = liv === 4 ? 1 : 2, q = Math.floor(Math.sqrt(A));
    r = tronca(Math.sqrt(A), d);
    return {
      chiave: A, consegna: "Scrivi il risultato approssimato per difetto con " + (d === 1 ? "una cifra decimale." : "due cifre decimali."),
      passi: [semplice("√" + A + " ≈ " + SLOT, r, "√" + A + " = " + f(tronca(Math.sqrt(A), 4)) + "… → per difetto " + f(r).replace(/,(\d)$/, d === 2 ? ",$10" : ",$1"),
        "Il risultato sta tra " + q + " e " + (q + 1) + ", perché " + q + sup(2) + " = " + q * q + " e " + (q + 1) + sup(2) + " = " + (q + 1) * (q + 1) + ". Poi prova i decimali.")]
    };
  }

  /* =====================================================================
     6. POTENZE
     ===================================================================== */
  function potenze(liv) {
    var a, e, m, n, tipo;
    function semplicePot(a, e) {
      var v = Math.pow(a, e);
      var aiuto = e === 0 ? "Ogni numero (diverso da 0) elevato alla 0 fa 1!" : e === 1 ? "Elevato alla 1 il numero resta uguale." :
        a === 10 ? "10 elevato a " + e + ": scrivi 1 seguito da " + e + " zeri." :
          a + sup(e) + " = " + Array(e + 1).join(a + " " + X + " ").slice(0, -3);
      return { chiave: a + "^" + e, passi: [semplice(a + sup(e) + " = " + SLOT, v, a + sup(e) + " = " + (e > 1 && a !== 10 ? Array(e + 1).join(a + " " + X + " ").slice(0, -3) + " = " : "") + f(v), aiuto)] };
    }
    if (liv === 1) return semplicePot(R(1, 10), 2);
    if (liv === 2) { tipo = R(1, 3); return tipo === 1 ? semplicePot(R(1, 12), 2) : tipo === 2 ? semplicePot(R(1, 5), 3) : semplicePot(10, R(2, 3)); }
    if (liv === 3) {
      tipo = R(1, 4);
      if (tipo === 1) { a = R(2, 5); e = a === 2 ? R(3, 6) : R(3, 4); return semplicePot(a, e); }
      if (tipo === 2) return semplicePot(R(2, 99), R(0, 1));
      if (tipo === 3) return semplicePot(10, R(2, 5));
      return semplicePot(R(2, 12), 2);
    }
    if (liv === 4) {
      tipo = R(1, 4);
      if (tipo === 1) return semplicePot(R(11, 20), 2);
      if (tipo === 2) return semplicePot(R(2, 10), 3);
      if (tipo === 3) return semplicePot(10, R(3, 6));
      a = R(4, 15);
      return { chiave: "r" + a, consegna: "Quale numero manca?", passi: [semplice(SLOT + sup(2) + " = " + a * a, a, a + sup(2) + " = " + a * a, "Quale numero moltiplicato per se stesso fa " + a * a + "?")] };
    }
    // lv5: properties
    a = R(2, 9); m = R(2, 7); n = R(2, 6); tipo = R(1, 3);
    if (tipo === 1) return { chiave: "p" + a + m + n, consegna: "Usa le proprietà: scrivi solo l'esponente.", passi: [semplice(a + sup(m) + " · " + a + sup(n) + " = " + a + '<sup class="sup-slot">' + SLOT + "</sup>", m + n, a + sup(m) + " · " + a + sup(n) + " = " + a + sup(m + n) + " (stessa base: gli esponenti si sommano)", "Prodotto di potenze con la stessa base: la base resta, gli esponenti si sommano.")] };
    if (tipo === 2) { m = n + R(1, 6); return { chiave: "q" + a + m + n, consegna: "Usa le proprietà: scrivi solo l'esponente.", passi: [semplice(a + sup(m) + " : " + a + sup(n) + " = " + a + '<sup class="sup-slot">' + SLOT + "</sup>", m - n, a + sup(m) + " : " + a + sup(n) + " = " + a + sup(m - n) + " (stessa base: gli esponenti si sottraggono)", "Quoziente di potenze con la stessa base: la base resta, gli esponenti si sottraggono.")] }; }
    m = R(2, 5); n = R(2, 4);
    return { chiave: "w" + a + m + n, consegna: "Usa le proprietà: scrivi solo l'esponente.", passi: [semplice("(" + a + sup(m) + ")" + sup(n) + " = " + a + '<sup class="sup-slot">' + SLOT + "</sup>", m * n, "(" + a + sup(m) + ")" + sup(n) + " = " + a + sup(m * n) + " (potenza di potenza: gli esponenti si moltiplicano)", "Potenza di una potenza: la base resta, gli esponenti si moltiplicano.")] };
  }

  /* =====================================================================
     7. TEOREMA DI PITAGORA (PITAGORA)
     ===================================================================== */
  function svgTriangolo(c1, c2, ip, et, h) {
    // longer leg horizontal; et = { base, alt, ip, h } labels
    var W = 300, H = 190, pad = 34;
    var bx = Math.max(c1, c2), by = Math.min(c1, c2);
    var sc = Math.min((W - 2 * pad - 30) / bx, (H - 2 * pad) / by);
    var x0 = pad + 26, y0 = H - pad, x1 = x0 + bx * sc, y1 = y0 - by * sc;
    var s = '<svg class="figura" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Triangolo rettangolo">';
    s += '<polygon points="' + x0 + "," + y0 + " " + x1 + "," + y0 + " " + x0 + "," + y1 + '" class="fig-forma"/>';
    s += '<path d="M' + x0 + "," + (y0 - 14) + " h14 v14" + '" class="fig-angolo"/>';
    if (h) {
      // foot of the altitude from the right angle (x0,y0) to the hypotenuse
      var dx = x1 - x0, dy = y0 - y1, t = (dx * dx) / (dx * dx + dy * dy);
      var fx = x1 + (x0 - x1) * t, fy = y0 + (y1 - y0) * t;
      s += '<line x1="' + x0 + '" y1="' + y0 + '" x2="' + fx + '" y2="' + fy + '" class="fig-tratteggio"/>';
      s += lbl((x0 + fx) / 2 + 8, (y0 + fy) / 2 + 4, et.h, "start");
    }
    s += lbl((x0 + x1) / 2, y0 + 24, et.base, "middle");
    s += lbl(x0 - 8, (y0 + y1) / 2 + 6, et.alt, "end");
    s += lbl((x0 + x1) / 2 + 10, (y0 + y1) / 2 - 8, et.ip, "start");
    return s + "</svg>";
  }
  function lbl(x, y, t, anchor) {
    if (!t) return "";
    var ign = t === "?";
    return '<text x="' + x + '" y="' + y + '" text-anchor="' + anchor + '" class="fig-testo' + (ign ? " ignota" : "") + '">' + t + "</text>";
  }
  function svgRettangolo(b, h, et) {
    var W = 300, H = 190, pad = 30;
    var sc = Math.min((W - 2 * pad - 40) / b, (H - 2 * pad - 10) / h);
    var w = b * sc, hh = h * sc, x0 = (W - w) / 2 + 10, y0 = pad;
    var s = '<svg class="figura" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Rettangolo">';
    s += '<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + hh + '" class="fig-forma"/>';
    s += '<line x1="' + x0 + '" y1="' + (y0 + hh) + '" x2="' + (x0 + w) + '" y2="' + y0 + '" class="fig-tratteggio"/>';
    s += lbl(x0 + w / 2, y0 + hh + 24, et.base, "middle");
    s += lbl(x0 - 8, y0 + hh / 2 + 6, et.alt, "end");
    s += lbl(x0 + w / 2 + 8, y0 + hh / 2 - 6, et.d, "start");
    return s + "</svg>";
  }
  var TERNE = [[3, 4, 5], [5, 12, 13], [8, 15, 17]];
  function pitagora(liv) {
    var t, k, c1, c2, ip, testo, et, nome, r, unita = "m", spiega, aiuto, fig;
    function scegliTerna(max) { t = N.scegli(TERNE.slice(0, max)); k = t[0] === 3 ? R(1, liv <= 2 ? 8 : 9) : t[0] === 5 ? R(1, 4) : R(1, 2); c1 = t[0] * k; c2 = t[1] * k; ip = t[2] * k; }
    if (liv <= 2 || (liv === 3 && R(0, 1))) {
      scegliTerna(liv === 1 ? 1 : liv === 2 ? 2 : 3);
      testo = "Un triangolo rettangolo ha i due cateti che misurano " + c1 + " m e " + c2 + " m. Calcola la misura dell'ipotenusa.";
      nome = "Ipotenusa"; r = ip;
      et = { base: c2 + " m", alt: c1 + " m", ip: "?" };
      spiega = "Ipotenusa = √(" + c1 + sup(2) + " + " + c2 + sup(2) + ") = √(" + c1 * c1 + " + " + c2 * c2 + ") = √" + ip * ip + " = " + ip + " m";
      aiuto = "Ipotenusa = √(cateto" + sup(2) + " + cateto" + sup(2) + "). Fai i quadrati, sommali e poi la radice.";
      fig = svgTriangolo(c1, c2, ip, et);
    } else if (liv === 3) {
      scegliTerna(3);
      testo = "Un triangolo rettangolo ha un cateto e l'ipotenusa che misurano " + c1 + " m e " + ip + " m. Calcola la misura dell'altro cateto.";
      nome = "Cateto"; r = c2;
      et = { base: "?", alt: c1 + " m", ip: ip + " m" };
      spiega = "Cateto = √(" + ip + sup(2) + " − " + c1 + sup(2) + ") = √(" + ip * ip + " − " + c1 * c1 + ") = √" + c2 * c2 + " = " + c2 + " m";
      aiuto = "Cateto = √(ipotenusa" + sup(2) + " − altro cateto" + sup(2) + "). Attenzione: qui si fa la sottrazione!";
      fig = svgTriangolo(c1, c2, ip, et);
    } else if (liv === 4) {
      var a = R(2, 9);
      t = a > 5 ? TERNE[0] : TERNE[1]; c1 = t[0] * a; c2 = t[1] * a; ip = t[2] * a;
      if (R(0, 1)) {          // his level 3: perimeter of a right triangle
        nome = "Perimetro"; r = c1 + c2 + ip;
        if (a > 5) {
          testo = "Un triangolo rettangolo ha un cateto e l'ipotenusa che misurano " + c1 + " m e " + ip + " m. Calcola la misura del perimetro.";
          et = { base: "?", alt: c1 + " m", ip: ip + " m" };
          spiega = "Cateto = √(" + ip + sup(2) + " − " + c1 + sup(2) + ") = " + c2 + " m; Perimetro = " + c1 + " + " + c2 + " + " + ip + " = " + r + " m";
        } else {
          testo = "Un triangolo rettangolo ha i due cateti che misurano " + c1 + " m e " + c2 + " m. Calcola la misura del perimetro.";
          et = { base: c2 + " m", alt: c1 + " m", ip: "?" };
          spiega = "Ipotenusa = √(" + c1 + sup(2) + " + " + c2 + sup(2) + ") = " + ip + " m; Perimetro = " + c1 + " + " + c2 + " + " + ip + " = " + r + " m";
        }
        aiuto = "Prima trova il lato che manca con Pitagora, poi somma i tre lati.";
        fig = svgTriangolo(c1, c2, ip, et);
      } else {                // his level 4: rectangle with the diagonal, mixed units
        nome = "Perimetro"; r = 2 * c1 + 2 * c2;
        if (a > 5) {
          testo = "Un rettangolo ha la base lunga " + c2 + " m. La diagonale misura " + ip * 10 + " dm. Calcola la misura del perimetro (in metri).";
          fig = svgRettangolo(c2, c1, { base: c2 + " m", alt: "?", d: ip * 10 + " dm" });
          spiega = ip * 10 + " dm = " + ip + " m; Altezza = √(" + ip + sup(2) + " − " + c2 + sup(2) + ") = " + c1 + " m; Perimetro = 2 × " + c2 + " + 2 × " + c1 + " = " + r + " m";
        } else {
          testo = "Un rettangolo ha l'altezza lunga " + c2 * 10 + " dm. La diagonale misura " + ip + " m. Calcola la misura del perimetro (in metri).";
          fig = svgRettangolo(c1, c2, { base: "?", alt: c2 * 10 + " dm", d: ip + " m" });
          spiega = c2 * 10 + " dm = " + c2 + " m; Base = √(" + ip + sup(2) + " − " + c2 + sup(2) + ") = " + c1 + " m; Perimetro = 2 × " + c1 + " + 2 × " + c2 + " = " + r + " m";
        }
        aiuto = "Attenzione alle unità di misura: trasforma i dm in m (10 dm = 1 m). La diagonale divide il rettangolo in due triangoli rettangoli.";
      }
    } else {
      var a5 = R(2, 9), piccola = a5 > 5;
      t = piccola ? TERNE[0] : TERNE[1]; c1 = t[0] * a5; c2 = t[1] * a5; ip = t[2] * a5;
      testo = "In un triangolo rettangolo i due cateti misurano " + c1 + " m e " + c2 + " m. Calcola la misura dell'altezza relativa all'ipotenusa. " +
        (piccola ? "(Il risultato avrà una cifra decimale.)" : "(Il risultato ha varie cifre decimali: rispondi con due cifre decimali, per difetto.)");
      nome = "Altezza"; r = tronca(c1 * c2 / ip, 2);
      fig = svgTriangolo(c1, c2, ip, { base: c2 + " m", alt: c1 + " m", ip: "", h: "h = ?" }, true);
      spiega = "Ipotenusa = " + ip + " m; Altezza = " + c1 + " × " + c2 + " : " + ip + " = " + f(r) + " m";
      aiuto = "Prima trova l'ipotenusa. Poi: altezza = cateto × cateto : ipotenusa (il doppio dell'area diviso l'ipotenusa).";
    }
    return {
      chiave: testo, problema: testo, figura: function () { return fig; },
      passi: [{ lavagna: "", etichetta: nome + " =", unita: unita, risposta: r, spiega: spiega, aiuto: aiuto }]
    };
  }

  /* =====================================================================
     8. GEOMETRIA PIANA (GEOMETRIA 2.3) – cosa calcoli? poi il valore
     ===================================================================== */
  function svgGeo(tipo, v, noti, chiede) {
    var W = 300, H = 200, s = '<svg class="figura" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Figura del problema">';
    function e(k, txt) { return noti[k] != null ? noti[k] + " cm" : chiede === k ? "?" : txt || ""; }
    if (tipo === "rett") {
      var sc = Math.min(200 / v.b, 120 / v.h), w = v.b * sc, hh = v.h * sc, x0 = (W - w) / 2 + 12, y0 = 28;
      s += '<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + hh + '" class="fig-forma"/>';
      s += '<line x1="' + x0 + '" y1="' + (y0 + hh) + '" x2="' + (x0 + w) + '" y2="' + y0 + '" class="fig-tratteggio"/>';
      s += lbl(x0 + w / 2, y0 + hh + 24, e("b", "base"), "middle");
      s += lbl(x0 - 8, y0 + hh / 2 + 6, e("h", "h"), "end");
      s += lbl(x0 + w / 2 + 6, y0 + hh / 2 - 8, e("d", "d"), "start");
    } else if (tipo === "rombo") {
      var cx = 150, cy = 100, dx = 120, dy = 90 * v.dmin / v.dmag;
      s += '<polygon points="' + (cx - dx) + "," + cy + " " + cx + "," + (cy - dy) + " " + (cx + dx) + "," + cy + " " + cx + "," + (cy + dy) + '" class="fig-forma"/>';
      s += '<line x1="' + (cx - dx) + '" y1="' + cy + '" x2="' + (cx + dx) + '" y2="' + cy + '" class="fig-tratteggio"/>';
      s += '<line x1="' + cx + '" y1="' + (cy - dy) + '" x2="' + cx + '" y2="' + (cy + dy) + '" class="fig-tratteggio"/>';
      s += lbl(cx + dx / 2, cy - 6, noti.semi != null ? noti.semi + " cm" : "", "middle");
      s += lbl(cx + 6, cy + dy / 2 + 6, noti.semimin != null ? noti.semimin + " cm" : "", "start");
      s += lbl(cx - dx / 2 - 6, cy - dy / 2 - 8, e("l"), "end");
      s += lbl(cx, cy + dy + 22, noti.area != null ? "Area = " + noti.area + " cm²" : "", "middle");
    } else {
      var sc2 = Math.min(220 / v.B, 130 / v.h), B = v.B * sc2, b = v.b * sc2, h = v.h * sc2, x = 50, y = 160;
      s += '<polygon points="' + x + "," + y + " " + (x + B) + "," + y + " " + (x + b) + "," + (y - h) + " " + x + "," + (y - h) + '" class="fig-forma"/>';
      s += '<path d="M' + x + "," + (y - 14) + " h14 v14" + '" class="fig-angolo"/>';
      s += '<line x1="' + (x + b) + '" y1="' + (y - h) + '" x2="' + (x + b) + '" y2="' + y + '" class="fig-tratteggio"/>';
      if (v.diag) s += '<line x1="' + x + '" y1="' + y + '" x2="' + (x + b) + '" y2="' + (y - h) + '" class="fig-tratteggio diag"/>';
      s += lbl(x + b / 2, y - h - 8, e("b", "b"), "middle");
      s += lbl(x + B / 2, y + 24, e("B", "B"), "middle");
      s += lbl(x - 8, y - h / 2 + 6, e("h", "h"), "end");
      s += lbl(x + (b + B) / 2 + 10, y - h / 2, e("l"), "start");
      s += lbl(x + (b + B) / 2, y - 6, noti.p != null ? noti.p + " cm" : "", "middle");
      if (v.diag) s += lbl(x + b / 2 + 6, y - h / 2 + 18, e("dmin"), "start");
    }
    return s + "</svg>";
  }
  // passo helper: voce = correct list entry, k = key on figure
  function gp(voce, ris, unita, sugg, formula, k) { return { voce: voce, risposta: ris, unita: unita, sugg: sugg, formula: formula, k: k }; }
  function geometria(liv) {
    var n, es, tipo, v, noti = {}, chiede, testo, lista;
    if (liv <= 2) {
      n = liv === 1 ? R(2, 5) : R(4, 9);
      var h = n * 3, b = n * 4, d = n * 5, p = (b + h) * 2, a = b * h;
      tipo = "rett"; v = { b: b, h: h };
      lista = ["Perimetro", "Diagonale", "Area", "Altezza", "Cateto", "Ipotenusa"];
      if (R(0, 1)) {
        testo = "Un rettangolo ha il perimetro e la base lunghi rispettivamente " + p + " cm e " + b + " cm. Calcola la lunghezza della diagonale.";
        noti = { b: b }; chiede = "d";
        es = [gp("Altezza", h, "cm", p + " : 2 − " + b, "Altezza = Perimetro : 2 − Base", "h"),
          gp("Diagonale", d, "cm", "√(" + b + sup(2) + " + " + h + sup(2) + ") = √(" + b * b + " + " + h * h + ")", "Diagonale = √(base" + sup(2) + " + altezza" + sup(2) + ")", "d")];
      } else {
        testo = "Un rettangolo ha la base e la diagonale lunghe rispettivamente " + b + " cm e " + d + " cm. Calcola l'area (in cm²).";
        noti = { b: b, d: d }; chiede = "area";
        es = [gp("Altezza", h, "cm", "√(" + d + sup(2) + " − " + b + sup(2) + ") = √(" + d * d + " − " + b * b + ")", "Altezza = √(diagonale" + sup(2) + " − base" + sup(2) + ")", "h"),
          gp("Area", a, "cm²", b + " × " + h, "Area = base × altezza", "area")];
      }
    } else if (liv === 3) {
      n = R(4, 9);
      var dmin = n * 6, dmag = n * 8, ar = dmin * dmag / 2;
      tipo = "rombo"; v = { dmin: dmin, dmag: dmag };
      testo = "Un rombo ha l'area di " + ar + " cm². Sapendo che metà della diagonale maggiore misura " + dmag / 2 + " cm, calcola la lunghezza del perimetro.";
      noti = { semi: dmag / 2, area: ar }; chiede = "l";
      lista = ["Perimetro", "Lato", "Diagonale maggiore", "Area", "Altezza", "Metà diagonale minore", "Diagonale minore"];
      es = [gp("Diagonale maggiore", dmag, "cm", dmag / 2 + " × 2", "Diagonale maggiore = metà diagonale maggiore × 2", "dmag"),
        gp("Diagonale minore", dmin, "cm", ar + " × 2 : " + dmag, "Diagonale minore = 2 × area : diagonale maggiore", "dmin"),
        gp("Metà diagonale minore", dmin / 2, "cm", dmin + " : 2", "Metà diagonale minore = diagonale minore : 2", "semimin"),
        gp("Lato", n * 5, "cm", "√(" + dmag / 2 + sup(2) + " + " + dmin / 2 + sup(2) + ") = √(" + dmag * dmag / 4 + " + " + dmin * dmin / 4 + ")", "Lato = √((diag. magg. : 2)" + sup(2) + " + (diag. min. : 2)" + sup(2) + ")", "l"),
        gp("Perimetro", n * 20, "cm", n * 5 + " × 4", "Perimetro = lato × 4", "p")];
    } else if (liv === 4) {
      n = R(4, 9);
      var a3 = n * n * 45, bmin = 3 * n, pro = n * 12;
      tipo = "trap"; v = { B: 15 * n, b: bmin, h: 5 * n };
      testo = "Un trapezio rettangolo ha l'area di " + a3 + " cm². La base minore e la proiezione del lato obliquo sulla base maggiore misurano " + bmin + " cm e " + pro + " cm. Calcola la lunghezza del perimetro.";
      noti = { b: bmin }; chiede = "p";
      lista = ["Perimetro", "Lato obliquo", "Diagonale maggiore", "Base maggiore", "Area", "Altezza", "Base minore", "Diagonale minore"];
      es = [gp("Base maggiore", 15 * n, "cm", bmin + " + " + pro, "Base maggiore = base minore + proiezione", "B"),
        gp("Altezza", 5 * n, "cm", "2 × " + a3 + " : (" + 15 * n + " + " + bmin + ")", "Altezza = 2 × area : (base magg. + base min.)", "h"),
        gp("Lato obliquo", 13 * n, "cm", "√(" + 5 * n + sup(2) + " + " + pro + sup(2) + ") = √(" + 25 * n * n + " + " + pro * pro + ")", "Lato obliquo = √(altezza" + sup(2) + " + proiezione" + sup(2) + ")", "l"),
        gp("Perimetro", 36 * n, "cm", 15 * n + " + " + bmin + " + " + 13 * n + " + " + 5 * n, "Perimetro = base magg. + base min. + altezza + lato obliquo", "p")];
    } else {
      n = R(3, 9);
      var a4 = n * n * 90, h4 = n * 5, p4 = 54 * n;
      tipo = "trap"; v = { B: 24 * n, b: 12 * n, h: h4, diag: true };
      testo = "Un trapezio rettangolo ha l'area di " + a4 + " cm². L'altezza e il perimetro misurano " + h4 + " cm e " + p4 + " cm. Calcola la lunghezza della diagonale minore.";
      noti = { h: h4 }; chiede = "dmin";
      lista = ["Perimetro", "Lato obliquo", "Diagonale maggiore", "Base maggiore", "Proiezione del lato obliquo", "Base magg. + base min.", "Area", "Altezza", "Base minore", "Diagonale minore"];
      es = [gp("Base magg. + base min.", 36 * n, "cm", "2 × " + a4 + " : " + h4, "Somma delle basi = 2 × area : altezza", "somma"),
        gp("Lato obliquo", 13 * n, "cm", p4 + " − (" + 36 * n + " + " + h4 + ")", "Lato obliquo = perimetro − (somma delle basi + altezza)", "l"),
        gp("Proiezione del lato obliquo", 12 * n, "cm", "√(" + 13 * n + sup(2) + " − " + h4 + sup(2) + ") = √(" + 169 * n * n + " − " + h4 * h4 + ")", "Proiezione = √(lato obliquo" + sup(2) + " − altezza" + sup(2) + ")", "pro"),
        gp("Base minore", 12 * n, "cm", "(" + 36 * n + " − " + 12 * n + ") : 2", "Base minore = (somma delle basi − proiezione) : 2", "b"),
        gp("Diagonale minore", 13 * n, "cm", "√(" + h4 + sup(2) + " + " + 12 * n + sup(2) + ") = √(" + h4 * h4 + " + " + 144 * n * n + ")", "Diagonale minore = √(altezza" + sup(2) + " + base minore" + sup(2) + ")", "dmin")];
    }
    var passi = es.map(function (g, i) {
      return {
        lavagna: "", nome: g.voce, etichetta: g.voce + " =", unita: g.unita, risposta: g.risposta, k: g.k,
        scelta: { domanda: i === 0 ? (liv === 5 ? "Iniziamo calcolando…?" : "Cosa calcoli?") : "E adesso cosa calcoli?", voci: lista, giusta: lista.indexOf(g.voce) },
        formula: g.formula, sugg: g.sugg, spiega: g.formula + ": " + g.sugg + " = " + g.risposta + " " + g.unita,
        aiuto: "Suggerimento: " + g.formula
      };
    });
    return {
      chiave: testo, problema: testo, tentativi: 4,
      figura: function (fatti) {
        var nn = {}; Object.keys(noti).forEach(function (k) { nn[k] = noti[k]; });
        passi.slice(0, fatti).forEach(function (p) { nn[p.k] = p.risposta; });
        if (tipo === "rett" && nn.area != null) delete nn.area;
        return svgGeo(tipo, v, nn, chiede);
      },
      passi: passi
    };
  }

  /* =====================================================================
     Elenco delle attività
     ===================================================================== */
  var ATTIVITA = [
    {
      id: "tabelline", emoji: "✖️", titolo: "Tabelline", sotto: "Moltiplicazioni veloci", colore: "#ff7a2f", classi: [0, 3],
      livelli: ["Tabelline da 1 a 5", "Tabelline da 1 a 10", "Anche il numero che manca", "Fino alla tabellina del 12", "Due cifre × una cifra"],
      intro: "Le tabelline sono la base di tutto! Rispondi con calma.", genera: tabelline
    },
    {
      id: "addizioni", emoji: "➕", titolo: "Più e meno", sotto: "Addizioni e sottrazioni", colore: "#19a974", classi: [0, 2],
      livelli: ["Entro il 20", "Entro il 100", "Numeri a tre cifre (in colonna)", "Con riporti e prestiti", "Numeri a quattro cifre"],
      intro: "Somma e togli! Nei numeri grandi parti sempre dalle unità.", genera: addizioni
    },
    {
      id: "operazioni", emoji: "🧮", titolo: "Le quattro operazioni", sotto: "+ − × : tutte insieme", colore: "#2f86ff", classi: [1, 4],
      livelli: ["Numeri fino a 10", "Numeri fino a 50", "Numeri fino a 100", "Con una cifra decimale", "Con due cifre decimali"],
      intro: "Leggi bene il segno prima di calcolare!", genera: operazioni, virgola: function (l) { return l >= 4; }
    },
    {
      id: "espressioni", emoji: "🧩", titolo: "Espressioni", sotto: "Passo passo, come sul quaderno", colore: "#8a4dff", classi: [2, 5],
      livelli: ["Più e meno entro il 20", "Con la moltiplicazione", "Con le potenze", "Con le parentesi", "Espressioni lunghe"],
      intro: "Un calcolo alla volta, come sul quaderno. Lavora con calma e con ordine!", genera: espressioni,
      quanti: function (l) { return [5, 5, 5, 4, 4, 3][l]; }
    },
    {
      id: "radici", emoji: "🌱", titolo: "Radici quadrate", sotto: "Quale numero per se stesso…?", colore: "#13a8a8", classi: [3, 5],
      livelli: ["Quale numero per se stesso…?", "Radici fino a 13", "Radici da 14 a 34", "Per difetto: un decimale", "Per difetto: due decimali"],
      intro: "La radice quadrata è il numero che, moltiplicato per se stesso, dà il numero sotto la radice.", genera: radici,
      virgola: function (l) { return l >= 4; }
    },
    {
      id: "potenze", emoji: "🚀", titolo: "Potenze", sotto: "Quadrati, cubi e proprietà", colore: "#ff4f8b", classi: [3, 5],
      livelli: ["Quadrati fino a 10", "Quadrati, cubi e 10", "Esponenti più grandi", "Grandi quadrati e cubi", "Proprietà delle potenze"],
      intro: "5² vuol dire 5 × 5. L'esponente dice quante volte moltiplichi la base.", genera: potenze
    },
    {
      id: "pitagora", emoji: "📐", titolo: "Teorema di Pitagora", sotto: "Problemi con i triangoli rettangoli", colore: "#e0a800", classi: [4, 5],
      livelli: ["Trova l'ipotenusa (facile)", "Trova l'ipotenusa", "Ipotenusa o cateto", "Perimetri", "Altezza sull'ipotenusa"],
      intro: "In un triangolo rettangolo: ipotenusa² = cateto² + cateto².", genera: pitagora, virgola: function (l) { return l >= 5; },
      quanti: function (l) { return l >= 4 ? 6 : 8; }
    },
    {
      id: "geometria", emoji: "🔷", titolo: "Geometria piana", sotto: "Rettangolo, rombo e trapezio", colore: "#607089", classi: [3, 5],
      livelli: ["Rettangolo (numeri piccoli)", "Rettangolo", "Rombo", "Trapezio rettangolo", "Trapezio: diagonale"],
      intro: "Prima scegli cosa calcolare, poi scrivi il valore. Lavora con calma e con ordine!", genera: geometria,
      quanti: function (l) { return [5, 5, 5, 2, 3, 2][l]; }
    },
    {
      id: "tempo", emoji: "⏱️", titolo: "Sfida 60 secondi", sotto: "Quante ne fai in un minuto?", colore: "#e5484d", classi: [0, 5],
      livelli: ["Tabelline e più/meno facili", "Fino a 10 e 100", "Tabelline e numeri grandi", "Tabelline fino al 12", "Per veri campioni"],
      intro: "Hai 60 secondi: rispondi a più domande che puoi!", aTempo: true,
      genera: function (l) { return R(0, 1) ? tabelline(l) : addizioni(Math.min(l, 2)); }
    }
  ];
  var PER_ID = {};
  ATTIVITA.forEach(function (a) { PER_ID[a.id] = a; });

  function testoClassi(c) {
    var nomi = N.CLASSI;
    if (c[0] === 0 && c[1] === 5) return "Per tutti";
    var a = nomi[c[0]].split(" "), b = nomi[c[1]].split(" ");
    if (a[1] === b[1]) return a[0] + (c[0] === c[1] ? "" : "–" + b[0]) + " " + a[1];
    return nomi[c[0]] + " – " + nomi[c[1]];
  }
  function consigliata(att, classe) { return classe >= att.classi[0] && classe <= att.classi[1]; }

  window.MAT = { ATTIVITA: ATTIVITA, PER_ID: PER_ID, testoClassi: testoClassi, consigliata: consigliata, f: f, tronca: tronca, _costruisci: costruisciEspressione };
})();
