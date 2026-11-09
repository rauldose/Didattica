/*
 * GEOMETRIA PIANA - Applicazioni del Teorema di Pitagora (Versione 2.3)
 * Prof. Carmelo Muscolino. Port of geo.txt (Visual Basic per DOS).
 *
 * Flow per exercise: the pupil first chooses from a list WHICH quantity to
 * compute next ("Cosa calcoli ??"), then types its value followed by the
 * unit ("124 cm."). After two wrong answers the formula is suggested, after
 * three the numeric expression. Key "S" asks for the formula (-30 points).
 */
(function () {
  "use strict";
  var el = D.el;
  var S = function (n) { return " " + D.qstr(n); };   // STR$()

  /* ---------- the four exercise generators (esercizio1..4) ---------- */
  function esercizio1() {
    var n = D.rand(4, 9), h = n * 3, b = n * 4, d = n * 5, p = (b + h) * 2, a = b * h;
    var lista = ["Perimetro", "Diagonale", "Area", "Altezza ", "Cateto", "Ipotenusa"];
    if (D.rand(1, 2) === 1) {
      return {
        testo: ["ESERCIZIO", "Un rettangolo ha il perimetro  e la base lunghi", "rispettivamente" + S(p) + " cm. e " + S(b) + " cm.", "Calcola la lunghezza della diagonale."],
        lista: lista, prima: " Cosa calcoli ?? ",
        passi: [
          { proc: 3, ris: S(h) + " cm.", sugg: S(p) + " / 2 -" + S(b), formula: "Altezza = Perimetro/2 - Base" },
          { proc: 1, ris: S(d) + " cm.", sugg: "√(" + S(b) + ")²+(" + S(h) + ")²", formula: "Diagonale=√(base)²+(altezza)²" }
        ]
      };
    }
    return {
      testo: ["ESERCIZIO", "Un rettangolo ha la base e la diagonale lunghi", "rispettivamente" + S(b) + " cm. e " + S(d) + " cm.", "Calcola l'area (in centimetri quadrati cmq.) ."],
      lista: lista, prima: " Cosa calcoli ?? ",
      passi: [
        { proc: 3, ris: S(h) + " cm.", sugg: "√(" + S(d) + ")²-(" + S(b) + ")²", formula: "Altezza=√(Diagonale)²-(Base)²" },
        { proc: 2, ris: S(a) + " cmq.", sugg: S(b) + " *" + S(h), formula: " Area = Base * Altezza" }
      ]
    };
  }
  function esercizio2() {
    var n = D.rand(4, 9), Dmin = n * 6, Dmag = n * 8, a = Dmin * Dmag / 2;
    return {
      testo: ["ESERCIZIO", "Un rombo ha l'area di " + S(a) + " cmq. Sapendo che 1/2  della", "diagonale maggiore misura " + S(Dmag / 2) + " cm. calcolare", "la lunghezza del perimetro."],
      lista: [" Perimetro", " Lato", " Diagonale maggiore", " Area", " Altezza ", " 1/2 Diagonale minore", " Diagonale minore"],
      prima: "Cosa calcoli adesso ??",
      passi: [
        { proc: 2, ris: S(Dmag) + " cm.", sugg: S(Dmag / 2) + " * 2", formula: "Diag. Magg.= semidiagonale magg. * 2" },
        { proc: 6, ris: S(Dmin) + " cm.", sugg: S(a) + " * 2 /" + S(Dmag), formula: "Diag.minore = 2 * area / diag.magg.)" },
        { proc: 5, ris: S(Dmin / 2) + " cm.", sugg: S(Dmin) + " / 2", formula: "Semidiag.minore = Diag. minore / 2" },
        { proc: 1, ris: S(n * 5) + " cm.", sugg: "√(" + S(Dmag / 2) + ")²+(" + S(Dmin / 2) + ")²", formula: "Lato = √ (Dmag / 2)²+(Dmin / 2)²" },
        { proc: 0, ris: S(n * 20) + " cm.", sugg: S(n * 5) + " * 4", formula: "Perimetro = lato * 4" }
      ]
    };
  }
  function esercizio3() {
    var n = D.rand(4, 9), a = n * n * 45, Bmin = 3 * n, pro = n * 12;
    return {
      testo: ["ESERCIZIO", "Un trapezio rettangolo ha l'area di " + S(a) + " cmq.", "Sapendo che la base minore e la proiezione del lato ", "obliquo sulla base maggiore misurano  ", "rispettivamente" + S(Bmin) + " e " + S(pro) + " cm.", "Calcola la lunghezza del perimetro."],
      lista: [" Perimetro", " Lato obliquo", " Diagonale maggiore", " Base maggiore", " Area", " Altezza ", " Base Minore", " Diagonale minore"],
      prima: "Cosa calcoli adesso ??",
      passi: [
        { proc: 3, ris: S(15 * n) + " cm.", sugg: S(Bmin) + " +" + S(pro), formula: "Base Magg. = Base Minore + Proiezione " },
        { proc: 5, ris: S(5 * n) + " cm.", sugg: "2 *" + S(a) + " /(" + S(15 * n) + " +" + S(Bmin) + ")", formula: "Altezza = 2 * area / ( base mag.+ base min.)" },
        { proc: 1, ris: S(13 * n) + " cm.", sugg: "√(" + S(5 * n) + ")²+(" + S(pro) + ")²", formula: "Lato ob.=√(Altezza)²+(proiezione)²" },
        { proc: 0, ris: S(36 * n) + " cm.", sugg: S(15 * n) + " +" + S(Bmin) + " +" + S(13 * n) + " +" + S(5 * n), formula: "Perim. = Base Mag.+ Base min.+ Altezza + lato ob." }
      ]
    };
  }
  function esercizio4() {
    var n = D.rand(3, 9), a = n * n * 90, h = n * 5, p = 54 * n;
    return {
      testo: ["ESERCIZIO", "Un trapezio rettangolo ha l'area di " + S(a) + " cmq.", "Sapendo che l'altezza ed il perimetro misurano ", "rispettivamente" + S(h) + " cm." + " e" + S(p) + " cm., calcola", "la lunghezza della diagonale minore."],
      lista: [" Perimetro ", " Lato obliquo ", " Diagonale maggiore  ", " Base maggiore  ", " Proiez.lato obbliquo  ", " Base magg.+ base minore  ", " Area    ", " Altezza       ", " Base minore  ", " Diagonale minore  "],
      prima: "Iniziamo calcolando ..??",
      passi: [
        { proc: 5, ris: S(36 * n) + " cm.", sugg: "2 *" + S(a) + " /" + S(h), formula: "Somma delle due basi = area * 2 / altezza" },
        { proc: 1, ris: S(13 * n) + " cm.", sugg: S(p) + " - ( " + S(36 * n) + " +" + S(h) + " )", formula: "Lato ob. = Perimetro - ( Somma delle due basi + altezza)" },
        { proc: 4, ris: S(12 * n) + " cm.", sugg: "√(" + S(13 * n) + ")² - (" + S(h) + ")²", formula: "Proiez.= √ (lato ob.)² - (altezza)²" },
        { proc: 8, ris: S(12 * n) + " cm.", sugg: "( " + S(36 * n) + "-" + S(12 * n) + " ) / 2", formula: "Base min.= (Somma delle due basi-proiez.) / 2" },
        { proc: 9, ris: S(13 * n) + " cm.", sugg: "√(" + S(h) + ")² + (" + S(12 * n) + ")²", formula: "Diag min = √ (altezza)² + (base min.)²" }
      ]
    };
  }
  var GENERA = [null, esercizio1, esercizio2, esercizio3, esercizio4];
  var TIMER = [0, 8000, 12000, 14000, 18000];

  /* ---------- form ---------- */
  var punti = 0, livello = 1, es = null, passaggio = 0, tentativi = 0, ultimoInvio = 0;
  var timer = null, timerMsg = null;

  var lcd = el("pre", { class: "dos-lcd vd-lcd", "aria-label": "punti" });
  var etiLiv = el("div", { class: "vd-livello" });
  var chkSuono = el("input", { type: "checkbox", id: "geo-suono" });
  chkSuono.checked = D.suono.attivo;
  var testo = el("pre", { class: "geo-testo" });
  var passi = el("div", { class: "geo-passi" });
  var lista = el("ul", { class: "dos-list geo-lista", role: "listbox", tabindex: "0", "aria-label": "Cosa calcoli" });
  var msgBox = el("div", { class: "dos-err geo-msg", hidden: true });
  var calc = el("div", { class: "geo-calc dos-panel", hidden: true }, []);
  var calcIn = el("input", { class: "dos-input", type: "text", autocomplete: "off", "aria-label": "calcolatrice" });
  var calcTot = el("div", { class: "geo-calctot" });
  calc.appendChild(el("div", { class: "dos-label", text: "Calcolatrice (es. 12*5  poi Invio; Invio a vuoto copia il risultato)" }));
  calc.appendChild(el("div", { class: "vd-riga" }, [calcIn, calcTot]));
  var btnUscita = el("button", { class: "dos-btn", type: "button", html: "<u>U</u>scita" });
  var btnAutore = el("button", { class: "dos-btn geo-autore", type: "button", text: "< Autore >" });
  var btnInfo = el("button", { class: "geo-link", type: "button", text: "? Info" });

  var schermo = el("div", { class: "dos-screen vd-screen geo-screen" }, [
    el("div", { class: "dos-title", text: D.SCUOLA }),
    el("div", { class: "dos-body vd-corpo" }, [
      el("div", { class: "vd-sinistra" }, [testo, passi, lista, calc]),
      el("div", { class: "vd-lato" }, [
        lcd, etiLiv,
        el("div", { class: "geo-opz" }, [btnInfo, el("label", { class: "dos-check", for: "geo-suono" }, [chkSuono, " Suono"])]),
        el("div", { class: "vd-bottoni" }, [btnUscita, btnAutore])
      ]),
      msgBox
    ])
  ]);
  document.getElementById("app").appendChild(schermo);

  function st() { lcd.textContent = D.lcd(punti, 5); }
  function suonoOk() { if (chkSuono.checked) D.suonoOk(); }

  // messaggio n (imgmessaggio) - optional auto-hide after ms
  function messaggio(n, ms) {
    var p = es && es.passi[passaggio];
    var M = {
      1: ["", "   ATTENZIONE !!  ERRORE     ", "", "  Cancella con  il tasto  <--", "  o con il tasto cancella    "],
      2: ["", "   ATTENZIONE !!  ERRORE     ", " -------------------------   ", "  Non e' la grandezza da     ", "  calcolare adesso . "],
      3: ["", "   ATTENZIONE !!  ERRORE     ", "", "   MANCA L' UNITA' DI  ", "   MISURA     "],
      4: ["  ATTENZIONE !!  Il calcolo e' errato.  ", "  Ti suggerisco di eseguire:", "", "  " + (p ? p.sugg : "")],
      5: ["", "  B R A V O   ! ! !    ", ""],
      9: ["  SUGGERIMENTO : ", "", "  " + (p ? p.formula : ""), ""],
      10: ["  Calcolo ERRATO !!! Ti suggerisco la formula : ", "", "  " + (p ? p.formula : ""), ""],
      11: ["", " Non cliccare !!!  ", " Pensa a risolvere l'esercizio. "],
      12: [" Non distrarti !!! ", " Risolvi l'esercizio se vuoi giocare. "],
      13: ["  SVEGLIATI !!.  ", "  E' la quarta volta che sbagli. ", "  Lavora con calma e con ordine."]
    };
    msgBox.textContent = M[n].join("\n");
    msgBox.className = "dos-err geo-msg" + ([4, 9, 10].indexOf(n) >= 0 ? " basso" : "") + (n === 5 ? " bravo" : "");
    msgBox.hidden = false;
    clearTimeout(timerMsg);
    if (ms) timerMsg = setTimeout(function () { msgBox.hidden = true; }, ms);
  }
  function nascondiMsg() { msgBox.hidden = true; }

  /* ---------- list ("rpl") ---------- */
  var selIdx = 0;
  function riempiLista(voci) {
    lista.innerHTML = "";
    voci.forEach(function (v, i) {
      var li = el("li", { role: "option", text: v });
      li.addEventListener("click", function () { seleziona(i); nascondiMsg(); });
      li.addEventListener("dblclick", function () { seleziona(i); scegli(); });
      lista.appendChild(li);
    });
    seleziona(0);
  }
  function seleziona(i) {
    var li = D.$$("li", lista);
    selIdx = Math.max(0, Math.min(li.length - 1, i));
    li.forEach(function (x, k) { x.classList.toggle("sel", k === selIdx); x.setAttribute("aria-selected", k === selIdx); });
    if (li[selIdx]) li[selIdx].scrollIntoView({ block: "nearest" });
  }
  lista.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); seleziona(selIdx + 1); nascondiMsg(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); seleziona(selIdx - 1); nascondiMsg(); }
    else if (e.key === "Enter") { e.preventDefault(); scegli(); }
    else if (e.key === "Escape") { esci(); }
  });

  // Rpl_KeyPress Enter: is this the quantity to compute now?
  function scegli() {
    var adesso = Date.now();
    if (es.passi[passaggio].proc === selIdx) {
      punti += 80; st(); messaggio(5, 1000); suonoOk();
      var riga = passi.children[passaggio];
      D.$(".geo-eti", riga).textContent = lista.children[selIdx].textContent.trim() + " =";
      var inp = D.$("input", riga);
      inp.hidden = false; inp.disabled = false; inp.focus();
      lista.hidden = true;
      if (punti < 0) calcOn();
    } else {
      if (adesso - ultimoInvio < 3000) return;
      punti -= 80; messaggio(2); st();
    }
    ultimoInvio = adesso;
  }

  /* ---------- answer fields ("testo(i)") ---------- */
  function normalizza(s) {
    // Original compared LCASE$(TRIM$()) exactly. We also tolerate extra
    // spaces and a missing final dot after the unit ("15 cm" = "15 cm.").
    return s.toLowerCase().replace(/,/g, ".").replace(/\s+/g, " ").trim().replace(/\.$/, "");
  }
  function creaRighe() {
    passi.innerHTML = "";
    es.passi.forEach(function (p, i) {
      var inp = el("input", { class: "dos-input geo-risp", type: "text", autocomplete: "off", spellcheck: "false", hidden: true, disabled: true, "aria-label": "valore" });
      inp.addEventListener("keydown", function (e) { tastoRisposta(e, inp); });
      passi.appendChild(el("div", { class: "geo-riga" }, [el("span", { class: "geo-eti", text: i === 0 ? es.prima : "" }), inp]));
    });
  }
  function tastoRisposta(e, inp) {
    if (e.key === "Escape") { e.preventDefault(); esci(); return; }
    if (e.key === "s" || e.key === "S") {        // S = suggerimento
      e.preventDefault(); inp.value = ""; punti -= 30; st(); messaggio(9); return;
    }
    if (e.key === "Backspace" || e.key === "Delete") { nascondiMsg(); return; }
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (Date.now() - ultimoInvio < 3000) return;
    ultimoInvio = Date.now();
    var risp = normalizza(inp.value), giusto = normalizza(es.passi[passaggio].ris);
    if (risp.indexOf("cm") < 0) { messaggio(3, 2000); punti -= 30; st(); return; }
    if (risp === giusto) {
      punti += 100; tentativi = 0; messaggio(5, 500); st();
      inp.disabled = true;
      passaggio++;
      calcOff();
      if (passaggio >= es.passi.length) { fineEsercizio(); return; }
      var riga = passi.children[passaggio];
      D.$(".geo-eti", riga).textContent = "e adesso cosa calcoli ??";
      lista.hidden = false; seleziona(0); lista.focus();
    } else {
      punti -= 30; st(); tentativi++;
      if (tentativi === 1) messaggio(1);
      else if (tentativi === 2) messaggio(10);
      else if (tentativi === 3) messaggio(4);
      else if (tentativi === 4) messaggio(13);
    }
  }

  function fineEsercizio() {
    if (chkSuono.checked) D.play(D.ALLARME);
    if (punti > 1000 && livello === 4) {
      clearInterval(timer);
      D.msg("COMPLIMENTI !!!\nHai superato i quattro livelli.\nAdesso puoi giocare per 200 secondi.").then(function () {
        return D.gioco("duello", 200);
      }).then(function () { nuovoEsercizio(4); });
      return;
    }
    if (punti > 750) return nuovoEsercizio(4);
    if (punti > 500) return nuovoEsercizio(3);
    if (punti > 250) return nuovoEsercizio(2);
    nuovoEsercizio(1);
  }
  function nuovoEsercizio(l) {
    livello = l;
    etiLiv.textContent = "  " + l + "  LIVELLO ";
    clearInterval(timer);
    timer = setInterval(function () { if (!D.dialogoAperto()) { punti -= 5; st(); } }, TIMER[l]);
    es = GENERA[l]();
    passaggio = 0; tentativi = 0;
    testo.textContent = ".".repeat(51) + "\n" + es.testo.join("\n") + "\n" + ".".repeat(51);
    creaRighe();
    riempiLista(es.lista);
    lista.hidden = false;
    nascondiMsg();
    lista.focus();
  }

  /* ---------- helper calculator (shown when the score is negative) ---------- */
  var totale = "", fatto = false;
  function calcOn() { calc.hidden = false; calcIn.value = ""; calcTot.textContent = ""; calcIn.focus(); }
  function calcOff() { calc.hidden = true; }
  calcIn.addEventListener("keydown", function (e) {
    if (fatto && e.key.length === 1) { fatto = false; calcIn.value = ""; }
    if (e.key !== "Enter") return;
    e.preventDefault();
    var t = calcIn.value.replace(/\s/g, "");
    if (t === "") {
      calcOff();
      var inp = D.$("input", passi.children[passaggio]);
      inp.value = totale; inp.focus();
      return;
    }
    var m = /^(-?[\d.,]+)([-+*/:])([\d.,]+)$/.exec(t);
    if (!m) return;
    var a = parseFloat(m[1].replace(",", ".")), b = parseFloat(m[3].replace(",", ".")), r;
    r = m[2] === "-" ? a - b : m[2] === "+" ? a + b : m[2] === "*" ? a * b : a / b;
    totale = D.qstr(r);
    calcTot.textContent = "= " + totale;
    fatto = true;
  });

  /* ---------- other controls ---------- */
  function esci() { clearInterval(timer); D.msg(" CIAO!! A PRESTO.").then(function () { location.href = "../../index.html"; }); }
  btnUscita.addEventListener("click", esci);
  etiLiv.addEventListener("click", function () { messaggio(11, 2000); });
  testo.addEventListener("click", function () { messaggio(12, 2000); });
  lcd.addEventListener("click", function () { D.marquee(schermo); });
  chkSuono.addEventListener("change", function () { D.suono.imposta(chkSuono.checked); });
  btnInfo.addEventListener("click", function () { D.marquee(schermo); });
  document.addEventListener("keydown", function (e) {
    if (e.altKey && (e.key === "u" || e.key === "U")) { e.preventDefault(); esci(); }
  });
  // His own description, recovered from the obfuscated "Autore" note in geo.txt
  btnAutore.addEventListener("click", function () {
    D.msg(" Questo e' un programma didattico finalizzato allo sviluppo\n delle capacita' di calcolo geometrico. Sono presenti \n quattro tipi di esercizi di geometria piana (applicazione \n Teorema di Pitagora) con i dati numerici elaborati casualmente.\n Se si superano i quattro livelli di difficolta' con un punteggio\n adeguato e' possibile giocare per un paio di minuti. \n Le risposte numeriche devono essere seguite da uno spazio e \n dall'unita' di misura ( esempio  124 cm. ).\n Dopo due errori consecutivi appare un aiuto con la formula da \n utilizzare. Dopo tre errori compare l'espressione numerica.\n\n Soft. Prof. C. Muscolino Palmanova UD", "Autore");
  });

  st();
  D.msg("        ╔════  ╔══  ╔══╗\n        ║ ══╗  ╠══  ║  ║\n        ╚═══╝  ╚══  ╚══╝\n\n GEOMETRIA PIANA:\n Applicazioni del Teorema di Pitagora\n\n Versione N' 2.3", D.SCUOLA)
    .then(function () { nuovoEsercizio(1); });
  window.Geometria = { stato: function () { return { punti: punti, livello: livello, es: es, passaggio: passaggio }; } };
})();
