/*
 * "Vari DOS" - esercizi di matematica del Prof. Carmelo Muscolino
 * (originali in Visual Basic per DOS, 1997-98: ESPRES, PITAGORA, RADICE,
 * TABEL, OPERAZ). Port fedele della logica dai sorgenti pubblicati
 * (archivio/originali/matdos/*.txt).
 *
 * The page sets <body data-programma="..."> and this file builds the
 * shared VB-DOS style form, then runs the chosen program.
 */
(function () {
  "use strict";
  var el = D.el;

  /* =========================================================
     Shared form ("shell") common to all the Vari DOS programs
     ========================================================= */
  function Shell(opt) {
    var self = this;
    this.opt = opt;
    this.punti = 0;
    this.tempoStart = Date.now();
    this.timer = null;

    this.titolo = el("div", { class: "dos-title", text: opt.titolo });
    this.intest = el("button", { class: "vd-intest", type: "button", text: D.SCUOLA });
    this.area = el("div", { class: "vd-area dos-panel" });
    this.errBox = el("div", { class: "dos-err vd-errbox", hidden: true });

    this.etiLivello = el("div", { class: "vd-livello", text: "LIVELLO 1" });
    this.lcd = el("pre", { class: "dos-lcd vd-lcd", "aria-label": "punti" });
    this.etiPunti = el("div", { class: "vd-punti", text: "PUNTI" });
    this.etiVel = el("div", { class: "vd-vel", text: "" });
    this.etiExtra = el("div", { class: "vd-extra", text: "" });
    this.suono = el("input", { type: "checkbox", id: "vd-suono" });
    this.suono.checked = D.suono.attivo;
    this.btnEs = el("button", { class: "dos-btn", type: "button", html: "<u>E</u>sercizio" });
    this.btnEsci = el("button", { class: "dos-btn", type: "button", html: "E<u>s</u>ci" });
    this.btnInfo = el("button", { class: "vd-info", type: "button", text: "?", title: "Autore" });

    var lato = el("div", { class: "vd-lato" }, [
      this.etiLivello, this.lcd, this.etiPunti, this.etiVel, this.etiExtra,
      el("label", { class: "dos-check vd-suono", for: "vd-suono" }, [this.suono, " Suono"]),
      el("div", { class: "vd-bottoni" }, [this.btnEs, this.btnEsci])
    ]);
    var corpo = el("div", { class: "dos-body vd-corpo" }, [
      el("div", { class: "vd-sinistra" }, [this.intest, this.area]), lato, this.errBox
    ]);
    this.schermo = el("div", { class: "dos-screen vd-screen" }, [this.titolo, this.btnInfo, corpo]);
    document.getElementById("app").appendChild(this.schermo);

    // His playful reactions when the pupil clicks around instead of working
    this.intest.addEventListener("click", function () { self.dici(" Non cliccarmi !!!!  BASTAAAA...."); D.beep(); self.fuoco(); });
    this.etiLivello.addEventListener("click", function () { self.dici(" Non cliccare. Lavora !!!!"); self.fuoco(); });
    this.etiPunti.addEventListener("click", function () { self.dici(" Lavora. Pensa a guadagnarti i punti !!!!"); self.fuoco(); });
    this.lcd.addEventListener("click", function () { self.dici(" Non giocare con il mouse !!!!"); self.fuoco(); });
    this.btnInfo.addEventListener("click", function () { D.marquee(self.schermo); });
    this.suono.addEventListener("change", function () { D.suono.imposta(self.suono.checked); self.fuoco(); });
    this.btnEsci.addEventListener("click", function () { self.esci(); });
    document.addEventListener("keydown", function (e) {
      if (D.dialogoAperto()) return;
      if (e.altKey && (e.key === "e" || e.key === "E")) { e.preventDefault(); self.btnEs.click(); }
      if (e.altKey && (e.key === "s" || e.key === "S")) { e.preventDefault(); self.btnEsci.click(); }
    });
    this.mostraPunti();
  }
  Shell.prototype.dici = function (t) { this.intest.textContent = t; };
  Shell.prototype.ripristina = function () { this.intest.textContent = D.SCUOLA; };
  Shell.prototype.fuoco = function () { if (this.campo && !this.campo.disabled) this.campo.focus(); };
  Shell.prototype.mostraPunti = function () {
    this.lcd.textContent = D.lcd(this.punti, 5);
    var sec = (Date.now() - this.tempoStart) / 1000;
    if (this.opt.velocita && sec >= 1) this.etiVel.textContent = Math.floor(this.punti / Math.floor(sec) * 60) + " punti al minuto";
    if (this.opt.extra) this.etiExtra.textContent = this.opt.extra(this.punti);
  };
  Shell.prototype.aggiungi = function (n) { this.punti += n; this.mostraPunti(); };
  Shell.prototype.errore = function (righe) {
    this.errBox.textContent = righe.join("\n");
    this.errBox.hidden = false;
    this.intest.style.visibility = "hidden";
  };
  Shell.prototype.okRiga = function () {
    this.errBox.hidden = true;
    this.intest.style.visibility = "";
    this.ripristina();
  };
  // Timer that removes points as time passes (timer1)
  Shell.prototype.timerPunti = function (ms, quanti) {
    var self = this;
    clearInterval(this.timer);
    this.timer = null;
    if (ms > 0) this.timer = setInterval(function () {
      if (D.dialogoAperto()) return;
      self.aggiungi(-quanti);
    }, ms);
  };
  Shell.prototype.esci = function () {
    clearInterval(this.timer);
    return D.msg(" CIAO!! A PRESTO.").then(function () { location.href = "../../index.html"; });
  };
  // End of the last level: "1 per Uscire / 2 per Giocare / 3 per Ripetere"
  Shell.prototype.finale = function (testa, secGioco) {
    var self = this;
    clearInterval(this.timer);
    if (this.suono.checked) D.play(D.ALLARME);
    var t = "\n" + testa + "\n\nCOSA VUOI FARE ADESSO ? \n\n 1 per Uscire \n 2 per Giocare \n 3 per Ripetere gli esercizi\n";
    return D.input(t, "3").then(function (a) {
      a = (a || "").trim();
      if (a === "" || a === "1") { location.href = "../../index.html"; return new Promise(function () {}); }
      if (a === "2") return D.gioco("duello", secGioco).then(function () { return "ripeti"; });
      return "ripeti";
    });
  };
  Shell.prototype.messaggioLivello = function (n) {
    if (this.suono.checked) D.play(D.ALLARME);
    return D.msg(" SEI AL " + n + "' LIVELLO ");
  };

  /* =========================================================
     Single-answer programs: PITAGORA, RADICE, TABEL, OPERAZ
     ========================================================= */
  // Live check of the typed answer, char by char (testorisposta_Change)
  function confronta(digitato, risposta, virgola) {
    for (var i = 0; i < digitato.length; i++) {
      var c = digitato[i], r = risposta[i];
      if (virgola && c === "," && r === ".") continue;
      if (c !== r) return false;
    }
    return true;
  }

  function ProgrammaRisposta(def) {
    var sh = new Shell({ titolo: def.titolo, velocita: true, extra: def.extra });
    var stato = { livello: -1, svolto: true, risposta: "", precedenti: [] };
    var domanda = el("div", { class: "vd-domanda" });
    var info = el("div", { class: "vd-infoliv" });
    var etiTesto = el("span", { class: "vd-etitesto" });
    var campo = el("input", { class: "dos-input vd-campo", type: "text", autocomplete: "off", spellcheck: "false", inputmode: def.inputmode || "decimal", "aria-label": "risposta" });
    sh.campo = campo;
    sh.area.appendChild(el("div", { class: "vd-esercizio" }, [
      el("div", { class: "dos-label", text: "ESERCIZIO:" }), info, domanda,
      el("div", { class: "vd-riga" }, [etiTesto, campo])
    ]));

    function nuovo() {
      var p = Promise.resolve();
      sh.ripristina();
      if (!stato.svolto) {
        p = p.then(function () { return D.msg(" Non hai finito l'esercizio !!! \n Ti tolgo 150 punti. "); })
          .then(function () { sh.aggiungi(-150); });
      }
      return p.then(function () {
        stato.svolto = false;
        // level changes at 200 / 400 / 600 / 800 / 1000 points
        var soglie = [200, 400, 600, 800, 1000];
        if (sh.punti < 200 && stato.livello === -1) {
          stato.livello = 0; sh.tempoStart = Date.now();
          return entra(0, false);
        }
        for (var l = 1; l <= 4; l++) {
          if (sh.punti >= soglie[l - 1] && sh.punti < soglie[l] && stato.livello === l - 1) return entra(l, true);
        }
        if (sh.punti > 999) {
          return sh.finale(def.complimenti ? def.complimenti(sh.punti) : "COMPLIMENTI  !!!!", def.secGioco(sh.punti)).then(function () {
            stato.svolto = true; sh.punti = 10; stato.livello = -1; sh.mostraPunti();
            return nuovo();
          });
        }
      }).then(function (r) { if (r !== "stop") genera(); });
    }
    function entra(l, msg) {
      stato.livello = l;
      sh.etiLivello.textContent = "  " + (l + 1) + "°  LIVELLO ";
      if (def.info) info.textContent = def.info[l] || "";
      sh.timerPunti(def.timer[l], def.puntiTempo);
      if (msg) return sh.messaggioLivello(l + 1);
    }
    function genera() {
      var es, tent = 0;
      do { es = def.genera(stato.livello); tent++; }
      while (tent < 30 && stato.precedenti.indexOf(es.chiave) >= 0);
      stato.precedenti.unshift(es.chiave);
      stato.precedenti.length = Math.min(stato.precedenti.length, def.memoria || 1);
      stato.risposta = es.risposta;
      domanda.textContent = es.testo || "";
      domanda.hidden = !es.testo;
      etiTesto.textContent = es.etichetta;
      campo.value = "";
      sh.okRiga();
      campo.focus();
    }
    campo.addEventListener("input", function () {
      var t = campo.value.trim();
      if (!confronta(t, stato.risposta, def.virgola)) {
        sh.errore(["", "   ATTENZIONE !!    ERRORE   ", "", "   Correggi con il tasto <-- ", ""]);
        sh.aggiungi(-def.puntiErrore);
        if (sh.suono.checked) D.sound(2000, 5);
        return;
      }
      sh.okRiga();
      if (t.length === stato.risposta.length) {
        if (sh.suono.checked) D.suonoOk();
        stato.svolto = true;
        sh.aggiungi(def.premio(stato.livello));
        campo.value = "";
        nuovo();
      }
    });
    sh.btnEs.addEventListener("click", function () { nuovo(); });
    sh.mostraPunti();
    D.msg(def.presentazione, def.titoloMsg).then(nuovo);
  }

  var PROGRAMMI = {};

  /* ---------- PITAGORA (pitagora.txt) ---------- */
  PROGRAMMI.pitagora = function () {
    ProgrammaRisposta({
      titolo: "TEOREMA DI PITAGORA",
      titoloMsg: "TEOREMA DI PITAGORA  Ver 1.00  ",
      presentazione: "Programma per esercitazione di calcolo con Teorema di Pitagora.\n\nI dati vengono proposte casualmente.\n\nUsa il mouse oppure il tasto alt+lettera evidenziata. \n\nVi sono 5 livelli di difficolta'. \n\nAnche la velocita' e' importante : il trascorrere del tempo \n\nfa diminuire il punteggio. \n\nQuando superi il 5 livello puoi riposarti giocando per 300 sec. ",
      virgola: true,
      timer: [10000, 15000, 20000, 30000, 50000],
      puntiTempo: 3,
      puntiErrore: 50,
      premio: function (l) { return [80, 100, 120, 140, 180, 200][l]; },
      secGioco: function () { return 240; },
      complimenti: function (p) { return "COMPLIMENTI  per i " + p + " punti."; },
      genera: function (liv) {
        var a, c1, c2, ip, testo, esp, r, S = function (n) { return " " + D.qstr(n); };
        function terna(k, piccola) {
          if (piccola) { c1 = k * 3; c2 = k * 4; ip = k * 5; } else { c1 = k * 5; c2 = k * 12; ip = k * 13; }
        }
        var CATETI = "Un triangolo rettangolo ha i due cateti che misurano rispettivamente ";
        var CAT_IP = "Un triangolo rettangolo ha un cateto e l'ipotenusa che misurano rispettivamente ";
        if (liv === 0 || liv === 1) {
          a = liv === 0 ? D.rand(1, 6) : D.rand(6, 14);
          if (a > (liv === 0 ? 3 : 9)) {
            terna(a, true);
            testo = CATETI + S(c1) + " e " + S(c2) + " Metri. Calcola la misura dell'ipotenusa. ";
            esp = "IPOTENUSA = "; r = ip;
          } else {
            terna(a, false);
            testo = CAT_IP + S(c1) + " e  " + S(ip) + " metri. Calcola la misura dell'altro cateto. ";
            esp = "  CATETO = "; r = c2;
          }
        } else if (liv === 2) {
          a = D.rand(2, 9);
          if (a > 5) { terna(a, true); testo = CAT_IP + S(c1) + " e  " + S(ip) + " metri. Calcola la misura del perimetro. "; }
          else { terna(a, false); testo = CATETI + S(c1) + " e " + S(c2) + " Metri. Calcola la misura del perimetro. "; }
          esp = "Perimetro = "; r = c1 + c2 + ip;
        } else if (liv === 3) {
          a = D.rand(2, 9);
          if (a > 5) { terna(a, true); testo = "Un rettangolo ha la base lunga " + S(c2) + " metri. La diagonale misura " + S(ip * 10) + " decimetri. Calcola la misura del perimetro (in metri). "; }
          else { terna(a, false); testo = "Un rettangolo ha l'altezza lunga " + S(c2 * 10) + " decimetri. La diagonale misura " + S(ip) + " metri. Calcola la misura del perimetro (in metri). "; }
          esp = "Perimetro = "; r = 2 * c1 + 2 * c2;
        } else {
          a = D.rand(2, 9);
          terna(a, a > 5);
          testo = "In un triangolo rettangolo i due cateti misurano " + S(c1) + " e " + S(c2) + " metri. Calcola la misura dell'altezza relativa all'ipotenusa. " +
            (a > 5 ? "( Il risultato sara' con una cifra decimale.) " : "( Il risultato sara' con varie cifre decimali. Rispondi con due cifre decimali.) ");
          esp = "Altezza = "; r = D.tronca(c1 * c2 / ip, 100);
        }
        return { testo: testo, etichetta: esp, risposta: D.qstr(r), chiave: r };
      }
    });
  };

  /* ---------- RADICE (radice.txt) ---------- */
  PROGRAMMI.radici = function () {
    ProgrammaRisposta({
      titolo: "RADICI QUADRATE",
      titoloMsg: "  RADICI QUADRATE   Ver 2.00  ",
      presentazione: "Programma per esercitazione di calcolo di RADICI quadrate.\n\nLe radici vengono proposte casualmente.\n\nUsa il mouse oppure il tasto alt+lettera evidenziata. \n\nVi sono 5 livelli di difficolta'. \n\nAnche la velocita' e' importante : il trascorrere del tempo \n\nfa diminuire il punteggio. \n\nQuando arrivi al 5 livello puoi riposarti giocando per 300 sec. ",
      virgola: true,
      memoria: 2,
      info: [
        "      Il risultato e' un intero   =< 13  ",
        "  Il risultato e' un intero >=14 e < 25 ",
        "   Il risultato e' un intero >=25 e <35",
        " Scrivi il risultato approssimato per difetto con una sola cifra decimale ",
        "Scrivi il risultato approssimato per difetto con due sole cifre decimali "
      ],
      timer: [3000, 5000, 7000, 9000, 11000],
      puntiTempo: 5,
      puntiErrore: 25,
      premio: function (l) { return [30, 70, 100, 130, 160, 200][l]; },
      secGioco: function () { return 240; },
      genera: function (liv) {
        var A, r;
        if (liv <= 2) {
          A = [D.rand(5, 13), D.rand(14, 24), D.rand(25, 34)][liv];
          return { etichetta: "√ " + A * A + " = ", risposta: D.qstr(A), chiave: A };
        }
        do { A = D.rand(150, 990); } while (Math.sqrt(A) % 1 === 0);
        r = D.tronca(Math.sqrt(A), liv === 3 ? 10 : 100);
        return { etichetta: "√ " + A + " = ", risposta: D.qstr(r), chiave: A };
      }
    });
  };

  /* ---------- TABEL - prodotti, la tabellina (tabel.txt) ---------- */
  PROGRAMMI.tabellina = function () {
    var RANGE = [[0, 3], [1, 4], [2, 7], [4, 9], [6, 10]];
    ProgrammaRisposta({
      titolo: "PRODOTTO",
      titoloMsg: "  PRODOTTO   Ver 1.00  ",
      presentazione: "Programma  per esercitazione di Moltiplicazioni. \n\nI due fattori vengono proposti casualmente.\n\nUsa il mouse oppure il tasto alt+lettera evidenziata. \n\nVi sono 5 livelli di difficolta'. \n\nAnche la velocita' e' importante : il trascorrere del tempo \n\nfa diminuire il punteggio. ",
      inputmode: "numeric",
      timer: [3000, 5000, 7000, 9000, 11000],
      puntiTempo: 5,
      puntiErrore: 20,
      premio: function () { return 30; },
      secGioco: function (p) { return Math.floor(p / 5); },
      extra: function (p) { return Math.floor(p / 5) + " sec. di gioco"; },
      genera: function (liv) {
        var a = D.rand(RANGE[liv][0], RANGE[liv][1]), b = D.rand(RANGE[liv][0], RANGE[liv][1]);
        return { etichetta: " " + a + " * " + b + " = ", risposta: D.qstr(a * b), chiave: a * b };
      }
    });
  };

  /* ---------- OPERAZ - le quattro operazioni ----------
     RECONSTRUCTION: OPERAZ.EXE survived but its source was never
     published. Its intro text and messages are taken from the executable;
     the number ranges below are our own reconstruction following its
     description ("Vengono proposte (casualmente) le quattro operazioni.
     Anche i valori numerici sono casuali e variabili con il livello."). */
  PROGRAMMI.operazioni = function () {
    var MAX = [10, 20, 50, 100, 500];
    ProgrammaRisposta({
      titolo: "OPERAZIONI",
      titoloMsg: "  OPERAZIONI   Ver 2.00  ",
      presentazione: "Programma  per esercitazione di calcolo aritmetico \n\nVengono proposte (casualmente) le quatto operazioni.\n\nAnche i valori numerici sono casuali e variabili con il livello.\n\nUsa il mouse oppure il tasto alt+lettera evidenziata. \n\nVi sono 5 livelli di difficolta'. \n\nAnche la velocita' e' importante : il trascorrere del tempo \n\nfa diminuire il punteggio. ",
      inputmode: "numeric",
      timer: [3000, 5000, 7000, 9000, 11000],
      puntiTempo: 5,
      puntiErrore: 20,
      premio: function (l) { return [30, 40, 50, 60, 70][l]; },
      secGioco: function () { return 240; },
      genera: function (liv) {
        var m = MAX[liv], op = D.rand(1, 4), a, b, r, s;
        if (op === 1) { a = D.rand(1, m); b = D.rand(1, m); r = a + b; s = "+"; }
        else if (op === 2) { a = D.rand(1, m); b = D.rand(0, a); r = a - b; s = "-"; }
        else if (op === 3) { var t = Math.min(10, 3 + liv * 2) + (liv > 2 ? 5 : 0); a = D.rand(2, t); b = D.rand(2, liv < 3 ? 10 : 20); r = a * b; s = "*"; }
        else { b = D.rand(2, liv < 3 ? 10 : 20); r = D.rand(1, liv < 2 ? 10 : 20); a = b * r; s = ":"; }
        return { etichetta: " " + a + " " + s + " " + b + " = ", risposta: String(r), chiave: s + a + b };
      }
    });
  };

  /* ---------- ESPRES - espressioni (espres.txt) ---------- */
  PROGRAMMI.espressioni = function () {
    var sh = new Shell({ titolo: "A R I T M E T I C A" });
    var Q = "²"; // CHR$(253) in code page 437
    var stato = { svolto: true, esp: [], index: 0 };
    var righe = [];
    var box = el("div", { class: "vd-esercizio" }, [el("div", { class: "dos-label", text: "ESERCIZIO:" })]);
    for (var i = 0; i < 7; i++) {
      var r = el("input", { class: "dos-input vd-espr", type: "text", autocomplete: "off", spellcheck: "false", "aria-label": "passaggio " + i });
      righe.push(r);
      box.appendChild(r);
    }
    righe[0].readOnly = true;
    sh.area.appendChild(box);

    var L = function (n) { return D.qstr(n); };
    function nuovo0() {
      var a, b, c;
      switch (D.rand(1, 4)) {
        case 1: b = D.rnd(9) + 1; a = D.rnd(100) + b; c = D.rnd(9) + 1;
          return [" " + L(a) + "-" + L(b) + "+" + L(c) + "=", "=" + L(a - b) + "+" + L(c) + "=", "=" + L(a - b + c)];
        case 2: c = D.rnd(9) + 1; b = D.rnd(9) + 1; a = D.rnd(100) + c;
          return [" " + L(a) + "+" + L(b) + "-" + L(c) + "=", "=" + L(a + b) + "-" + L(c) + "=", "=" + L(a + b - c)];
        case 3: b = D.rnd(9) + 1; a = D.rnd(10); c = D.rnd(9) + 1;
          return [" " + L(a) + "+" + L(b) + "*" + L(c) + "=", "=" + L(a) + "+" + L(b * c) + "=", "=" + L(a + b * c)];
        default: c = D.rnd(9) + 1; b = D.rnd(9) + 1; a = D.rnd(10) + Math.floor(c / b);
          return [" " + L(a) + "*" + L(b) + "-" + L(c) + "=", "=" + L(a * b) + "-" + L(c) + "=", "=" + L(a * b - c)];
      }
    }
    function nuovo1() {
      var a, b, c;
      switch (D.rand(1, 3)) {
        case 1: b = D.rnd(9) + 1; a = D.rnd(100) + b * b; c = D.rnd(9) + 1;
          return [" " + L(a) + "-" + L(b) + Q + "+" + L(c) + "=", "=" + L(a) + "-" + L(b * b) + "+" + L(c) + "=", "=" + L(a - b * b) + "+" + L(c) + "=", "=" + L(a - b * b + c)];
        case 2: b = D.rnd(12) + 5; a = D.rnd(10) + 5; c = D.rnd(9) + 1;
          return [" " + L(a) + "+" + L(b) + Q + "-" + L(c) + "=", "=" + L(a) + "+" + L(b * b) + "-" + L(c) + "=", "=" + L(a + b * b) + "-" + L(c) + "=", "=" + L(a + b * b - c)];
        default: b = D.rnd(9) + 1; a = D.rnd(10) + b; c = D.rnd(9) + 1;
          return [" " + L(a) + Q + "-" + L(b) + Q + "+" + L(c) + "=", "=" + L(a * a) + "-" + L(b * b) + "+" + L(c) + "=", "=" + L(a * a - b * b) + "+" + L(c) + "=", "=" + L(a * a - b * b + c)];
      }
    }
    function nuovo2() {
      var a, b, c;
      switch (D.rand(1, 3)) {
        case 1: b = D.rnd(9) + 1; c = D.rnd(9) + 1; a = D.rnd(100) + b * b + c;
          return [" " + L(a) + "-(" + L(b) + Q + "+" + L(c) + ")=", "=" + L(a) + "-(" + L(b * b) + "+" + L(c) + ")=", "=" + L(a) + "-" + L(b * b + c) + "=", "=" + L(a - (b * b + c))];
        case 2: c = D.rnd(9) + 1; b = D.rnd(12) + 5; a = D.rnd(10) + 5;
          return [" " + L(a) + "+(" + L(b) + Q + "+" + L(c) + ")=", "=" + L(a) + "+(" + L(b * b) + "+" + L(c) + ")=", "=" + L(a) + "+" + L(b * b + c) + "=", "=" + L(a + (b * b + c))];
        default: b = D.rnd(9) + 1; a = D.rnd(10) + b; c = D.rnd(9) + 1;
          return [" (" + L(a) + Q + "-" + L(b) + Q + ")+" + L(c) + "=", "=(" + L(a * a) + "-" + L(b * b) + ")+" + L(c) + "=", "=" + L(a * a - b * b) + "+" + L(c) + "=", "=" + L(a * a - b * b + c)];
      }
    }
    function prepara(esp) {
      stato.esp = esp; stato.svolto = false; stato.index = 1;
      righe.forEach(function (r, k) { r.value = ""; r.disabled = k > 1; r.hidden = k >= esp.length; });
      righe[0].value = esp[0];
      righe[0].disabled = false;
      righe[1].focus();
      sh.campo = righe[1];
      sh.okRiga();
    }
    function esercizio() {
      sh.timerPunti(10000, 5);
      sh.ripristina();
      var p = Promise.resolve();
      if (!stato.svolto) {
        p = D.msg(" Non hai finito l'esercizio!!!\n Ti tolgo 60 punti. ").then(function () { sh.aggiungi(-60); });
      }
      return p.then(function () {
        if (sh.punti < 300) { sh.etiLivello.textContent = "LIVELLO 1"; return prepara(nuovo0()); }
        if (sh.punti < 500) { annuncia("LIVELLO 2"); return prepara(nuovo1()); }
        if (sh.punti < 800) { annuncia("LIVELLO 3"); return prepara(nuovo2()); }
        return sh.finale("COMPLIMENTI  !!!!", 300).then(function () {
          stato.svolto = true; sh.punti = 10; sh.mostraPunti(); return esercizio();
        });
      });
    }
    function annuncia(t) {
      if (sh.etiLivello.textContent !== t && sh.suono.checked) D.play(D.ALLARME);
      sh.etiLivello.textContent = t;
    }
    righe.forEach(function (r, k) {
      r.addEventListener("input", function () {
        if (k === 0 || k !== stato.index) return;
        var t = r.value.trim(), atteso = stato.esp[k];
        for (var j = 0; j < t.length; j++) {
          if (t[j] !== atteso[j]) {
            sh.aggiungi(-5);
            sh.errore(atteso[j] === "=" ?
              ["", "  ATTENZIONE !!     ERRORE    ", "  Si inizia con il simbolo di ", "  uguaglianza ( = )           ", "  Correggi con  il tasto   <--"] :
              ["", "   ATTENZIONE !!    ERRORE   ", "", "   Correggi con il tasto <-- ", ""]);
            if (sh.suono.checked) D.sound(2000, 5);
            return;
          }
        }
        sh.okRiga();
        if (t.length === atteso.length) {
          r.disabled = true;
          if (k === stato.esp.length - 1) {
            clearInterval(sh.timer);
            if (sh.suono.checked) D.play(D.ALLARME);
            stato.svolto = true;
            D.msg(" Bravo !! \nHai finito l'esercizio.\nTi meriti 60 punti.").then(function () {
              sh.aggiungi(60);
              esercizio();
            });
            return;
          }
          stato.index = k + 1;
          righe[k + 1].disabled = false;
          righe[k + 1].focus();
          sh.campo = righe[k + 1];
          sh.aggiungi(10);
        }
      });
    });
    sh.btnEs.addEventListener("click", esercizio);
    D.msg("Programma per migliorare la capacita' di calcolo e \n\nla correttezza formale.\n\nScrivi con le stesse regole che usi sul quaderno.\n\nL'espressioni sono generate casualmente.\n\nUsa il mouse oppure il tasto alt+lettera evidenziata. \n\nQuando arrivi all'ultimo livello puoi giocare. \n\nAnche la velocita' e' importante : ogni 10 secondi ti toglie 5 punto.", "ESPRESSIONI")
      .then(esercizio);
  };

  window.VariDOS = { Shell: Shell, PROGRAMMI: PROGRAMMI };
  document.addEventListener("DOMContentLoaded", function () {
    var p = document.body.getAttribute("data-programma");
    if (p && PROGRAMMI[p]) PROGRAMMI[p]();
  });
})();
