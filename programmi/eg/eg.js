/*
 * E.G. - Esercizi e Giochi, Ver. 2 - player (menu + "blocco di lavoro").
 * Port of the "CODICE DEL MENU" and "BLOCCO DI LAVORO" forms of eg.txt.
 */
(function () {
  "use strict";
  var el = D.el;

  /* ======================= MENU ======================= */
  var vMenu = D.$("#menu"), vLavoro = D.$("#lavoro");
  var lista = D.$("#eg-lista");
  var voci = [], sel = 0;

  function mostraMenu() {
    fermaTimer();
    vLavoro.hidden = true; vMenu.hidden = false;
    voci = EG.tutte().map(function (e) { return { tipo: "es", es: e, testo: e.titolo + (e.utente ? "  *" : "") }; });
    voci.push({ tipo: "info", testo: "INFORMAZIONI" }, { tipo: "esci", testo: "ESCI " });
    lista.innerHTML = "";
    voci.forEach(function (v, i) {
      var li = el("li", { role: "option", text: v.testo });
      li.addEventListener("click", function () { seleziona(i); });
      li.addEventListener("dblclick", function () { seleziona(i); apri(); });
      lista.appendChild(li);
    });
    seleziona(Math.min(sel, voci.length - 1));
    lista.focus();
  }
  function seleziona(i) {
    sel = Math.max(0, Math.min(voci.length - 1, i));
    D.$$("li", lista).forEach(function (li, k) { li.classList.toggle("sel", k === sel); li.setAttribute("aria-selected", k === sel); });
    var li = lista.children[sel]; if (li) li.scrollIntoView({ block: "nearest" });
  }
  lista.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); seleziona(sel + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); seleziona(sel - 1); }
    else if (e.key === "Home") { e.preventDefault(); seleziona(0); }
    else if (e.key === "End") { e.preventDefault(); seleziona(voci.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); apri(); }
  });
  function apri() {
    var v = voci[sel];
    if (v.tipo === "esci") { location.href = "../../index.html"; return; }
    if (v.tipo === "info") {
      D.msg("Soft programmabile per esercitazioni o test multidisciplinari.\nGli esercizi sono strutturati in livelli (Max 5 ).\nPer ogni livello si possono programmare :\n- i punti acquisiti per svolgimento corretto;\n- i punti persi per errore;\n- i punti necessari per superare il livello;\n- i punti da perdere al passare del tempo;\n- la cadenza del tempo in secondi;\n- l'eventuale tempo da dedicare al gioco; \nI giochi disponibili sono due (duello e puzzle). Entrambi sono\nstudiati per permettere il gioco di due alunni.\nIl duello e' disponibile  nei livelli intermedi mentre puzzle 'gira'\nnell'ultimo livello.\nGli esercizi all'interno di un livello sono proposti \ncasualmente.\n\nAutore: prof. Carmelo Muscolino \nPalmanova Udine", "INFORMAZIONI");
      return;
    }
    avvia(v.es);
  }
  D.$("#eg-programmatore").addEventListener("click", function () {
    var v = voci[sel];
    location.href = "editor.html" + (v && v.tipo === "es" ? "?id=" + encodeURIComponent(v.es.id) : "");
  });
  D.$("#eg-esci").addEventListener("click", function () { location.href = "../../index.html"; });

  /* ======================= LAVORO ======================= */
  var lcd = D.$("#eg-lcd"), etiLiv = D.$("#eg-livello"), info1 = D.$("#eg-info1"), info2 = D.$("#eg-info2"), etiErr = D.$("#eg-errori");
  var lavagna = D.$("#eg-lavagna"), consegna = D.$("#eg-consegna"), campo = D.$("#eg-risposta"), scelta = D.$("#eg-scelta");
  var msgBox = D.$("#eg-msg"), titolo = D.$("#eg-titolo"), scuola = D.$("#eg-scuola");

  var S = {};           // session state
  var timer = null, timerOk = null, timerBlocco = null;

  function fermaTimer() { clearInterval(timer); timer = null; clearTimeout(timerOk); timerOk = null; }
  function st() { lcd.textContent = D.lcd(S.punti, 5); }
  function percErr() { etiErr.textContent = "Errori = " + Math.floor(S.nErrori / (S.esercizi + 1) * 100) + "%"; }
  function avviaTimer() {
    clearInterval(timer);
    var sec = S.es.parametri.tp[S.livello - 1];
    if (sec > 30) sec = 30;                      // "troppi i secondi togli punti (max 30)"
    if (sec > 0) timer = setInterval(function () {
      if (D.dialogoAperto()) return;
      S.punti -= S.es.parametri.pt[S.livello - 1]; st();
    }, sec * 1000);
  }
  function etichetteLivello() {
    var p = S.es.parametri, l = S.livello - 1;
    etiLiv.textContent = "LIVELLO " + S.livello + "°";
    info1.textContent = "Livello massimo : " + S.max + "°";
    info2.textContent = p.tg[l] > 0 ? S.sec + " sec. di gioco a " + p.sl[l] + " punti" : "Il prossimo livello a " + p.sl[l] + " punti";
  }

  function messaggio(n) {
    var testi = {
      1: "  ATTENZIONE !! ERRORE   \n  correggi con il tasto [ CANC ] o con [ <- ] ",
      2: "   ERRORE !! non è la scelta giusta  ",
      9: "\n       Per proseguire premi il tasto \n\n         [ CANC ] o [ spazio ]       "
    };
    msgBox.className = "eg-msg";
    if (n === 4) {
      var frasi = [["             B R A V O ", "           _____________"], ["           S E I   F O R T E  !!!", "          ------------------------"],
        ["         B E N I S S I M O  !!", "        ....................... "], ["         P E R F E T T O  !!!  ", "       ***********************  "],
        ["     C H E   C E N T R O  ! !  ", "    _______________________"], ["            E S A T T O ", "           _____________"],
        ["      SEI IN OTTIMA FORMA !!!", "     _____________________"]];
      var f = Math.random() < 0.3 ? frasi[0] : frasi[D.rand(0, frasi.length - 1)];
      msgBox.textContent = "\n" + f[0] + "\n" + f[1] + "\n";
      msgBox.classList.add("bravo");
    } else msgBox.textContent = testi[n];
    msgBox.hidden = false;
  }
  function nascondiMsg() { msgBox.hidden = true; }

  function avvia(es) {
    S = { es: es, livello: 1, punti: 10, esercizi: 0, nErrori: 0, sec: 0, ultimo: -1, quesiti: [], errore: false, lung: 0, sugg: false, risolto: false, bloccoErr: false };
    S.max = EG.livelliMax(es);
    vMenu.hidden = true; vLavoro.hidden = false;
    titolo.textContent = es.titolo;
    st(); percErr();
    caricaLivello().then(function (ok) {
      if (!ok) return mostraMenu();
      avviaTimer();
      if (es.parametri.tg[0] > 0) S.sec += es.parametri.tg[0];
      etichetteLivello();
      return lezione().then(esercizio);
    });
  }
  function caricaLivello() {
    var testo = S.es.livelli[S.livello - 1];
    if (!testo) return D.msg("Non e' presente il livello " + S.livello).then(function () { return false; });
    var r = EG.analizza(testo);
    S.quesiti = r.quesiti; S.lezione = r.lezione; S.ultimo = -1;
    if (!S.quesiti.length) return D.msg("Il livello " + S.livello + " non contiene esercizi.").then(function () { return false; });
    return Promise.resolve(true);
  }
  function lezione() {
    var t = (S.lezione || "").replace(/\s+$/, "");
    S.lezione = "";
    if (t.trim()) return D.msg(t, "INFORMAZIONI:", "eg-lezione");
    return Promise.resolve();
  }

  function cambioLivello(daGioco) {
    S.livello++;
    if (S.livello > S.max) {
      fermaTimer();
      return D.msg("Bravissimo !!.\nHai raggiunto il livello massimo.\nEsercizi errati : " + S.nErrori + "\nEsercizi svolti : " + S.esercizi +
        "\nPercentuale di errati : " + Math.floor(S.nErrori / (S.esercizi + 1) * 100) + "%", "Informazione").then(function () { mostraMenu(); return false; });
    }
    var p = Promise.resolve();
    if (!daGioco) {
      D.play(D.ALLARME);
      p = D.msg(" HAI RAGGIUNTO IL LIVELLO " + S.livello + "°");
    }
    return p.then(caricaLivello).then(function (ok) {
      if (!ok) { mostraMenu(); return false; }
      avviaTimer();
      if (S.es.parametri.tg[S.livello - 1] > 0) S.sec += S.es.parametri.tg[S.livello - 1];
      etichetteLivello();
      return lezione().then(function () { return true; });
    });
  }

  // Choose and show the next exercise (SUB esercizio)
  function esercizio() {
    if (vLavoro.hidden) return;
    var p = S.es.parametri, l = S.livello - 1, i;
    var seguente = S.quesiti[S.ultimo + 1];
    if (S.ultimo >= 0 && seguente && seguente.legato) return mostra(S.ultimo + 1);
    var passo = Promise.resolve(true);
    if (p.tg[l] > 0 && S.punti > p.sl[l]) {
      D.play(D.ALLARME);
      var ultimo = S.livello === S.max, nome = ultimo ? "Puzzle" : "Duello";
      passo = D.conferma("\nBENISSIMO !\n\nVuoi riposarti giocando con " + nome + " ?\n\nSe non giochi conservo il tempo-gioco. \n\nAdesso sono disponibili " + S.sec + " sec. di gioco. ", " INFORMAZIONE: ")
        .then(function (si) {
          if (!si) return true;
          clearInterval(timer);
          return D.gioco(ultimo ? "puzzle" : "duello", S.sec).then(function (resto) {
            S.sec = resto || 0;
            return cambioLivello(true);
          }).then(function (ok) { if (ok) mostra(scegli()); return false; });
        });
    }
    passo.then(function (continua) {
      if (!continua) return;
      if (S.punti > p.sl[l]) {
        return cambioLivello(false).then(function (ok) { if (ok) mostra(scegli()); });
      }
      mostra(scegli());
    });
    function scegli() {
      var liberi = [];
      S.quesiti.forEach(function (q, k) { if (!q.legato && k !== S.ultimo) liberi.push(k); });
      if (!liberi.length) S.quesiti.forEach(function (q, k) { if (!q.legato) liberi.push(k); });
      return liberi[D.rnd(liberi.length)];
    }
  }

  function mostra(i) {
    S.ultimo = i;
    var q = S.quesiti[i], r = EG.risposte(q);
    S.r = r; S.lung = 0; S.errore = false; S.sugg = false; S.risolto = false;
    nascondiMsg();
    lavagna.textContent = r.domanda;
    consegna.textContent = q.consegna || "";
    consegna.hidden = !q.consegna;
    if (r.lista) {
      campo.hidden = true; scelta.hidden = false;
      scelta.innerHTML = "";
      // (the original listed the choices as written - correct one often first;
      //  EM later presented them in alphabetical order, as we do here)
      r.voci.slice().sort(function (a, b) { return a.localeCompare(b, "it", { numeric: true }); }).forEach(function (v) {
        var li = el("li", { role: "option", text: v });
        li.addEventListener("click", function () { selScelta(li); nascondiMsg(); });
        li.addEventListener("dblclick", function () { selScelta(li); verificaScelta(); });
        scelta.appendChild(li);
      });
      selScelta(scelta.firstChild);
      scelta.focus();
    } else {
      scelta.hidden = true; campo.hidden = false;
      campo.value = ""; campo.readOnly = false;
      campo.focus();
    }
  }

  /* --- multiple choice (rplin) --- */
  function selScelta(li) {
    D.$$("li", scelta).forEach(function (x) { x.classList.toggle("sel", x === li); x.setAttribute("aria-selected", x === li); });
    if (li) li.scrollIntoView({ block: "nearest" });
  }
  scelta.addEventListener("keydown", function (e) {
    var cur = D.$("li.sel", scelta);
    if (e.key === "ArrowDown") { e.preventDefault(); selScelta(cur && cur.nextSibling || cur); nascondiMsg(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); selScelta(cur && cur.previousSibling || cur); nascondiMsg(); }
    else if (e.key === "Enter") { e.preventDefault(); verificaScelta(); }
    else if (e.key === "Escape") { e.preventDefault(); esciAlMenu(); }
    else if (e.key === "Delete") { nascondiMsg(); }
  });
  function verificaScelta() {
    if (S.risolto) return;
    if (S.sugg) { S.sugg = false; S.risolto = true; timerOk = setTimeout(prossimo, 100); return; }
    var cur = D.$("li.sel", scelta);
    if (!cur || cur.textContent !== S.r.giusta) {
      D.sound(300, 2); D.sound(100, 2); D.sound(300, 2);
      messaggio(2);
      S.punti -= S.es.parametri.err[S.livello - 1]; st();
      S.nErrori++; percErr();
      return;
    }
    corretto();
  }

  /* --- typed answer (testorisposta_Change): checked letter by letter --- */
  campo.addEventListener("input", function () {
    if (S.risolto) return;
    if (S.sugg) return;
    var t = campo.value.replace(/^\s+/, "");
    var ok = "";
    S.r.voci.forEach(function (v) { if (v.slice(0, t.length) === t) ok = v; });
    if (!ok) {
      messaggio(1);
      if (!S.bloccoErr && t.length > S.lung) {
        S.punti -= S.es.parametri.err[S.livello - 1]; st();
        D.sound(100, 3);
        S.errore = true; S.bloccoErr = true;
        clearTimeout(timerBlocco);
        timerBlocco = setTimeout(function () { S.bloccoErr = false; }, 2000);
        percErr();
      }
      S.lung = t.length;
      return;
    }
    S.lung = t.length;
    nascondiMsg();
    if (t.length === ok.length) {
      if (S.errore) { S.errore = false; S.nErrori++; }
      corretto();
    }
  });
  campo.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { e.preventDefault(); esciAlMenu(); return; }
    if (S.sugg && (e.key === " " || e.key === "Delete" || e.key === "Backspace" || e.key === "Enter")) {
      e.preventDefault(); S.sugg = false; S.risolto = true; prossimo();
    }
  });

  function corretto() {
    S.risolto = true;
    D.suonoOk();
    S.esercizi++; percErr();
    S.punti += S.es.parametri.ok[S.livello - 1]; st();
    messaggio(4);
    campo.readOnly = true;
    timerOk = setTimeout(prossimo, 1000);
  }
  function prossimo() { clearTimeout(timerOk); timerOk = null; nascondiMsg(); esercizio(); }

  /* --- menu bar --- */
  D.$("#eg-mnu-menu").addEventListener("click", esciAlMenu);
  function esciAlMenu() { fermaTimer(); mostraMenu(); }
  D.$("#eg-mnu-soluzione").addEventListener("click", function () {   // MNUSuggerisci
    if (S.risolto) return;
    var l = S.livello - 1;
    if (!S.r.lista) {
      campo.value = S.r.voci[0];
      messaggio(9);
      campo.focus();
    } else {
      D.$$("li", scelta).forEach(function (li) { if (li.textContent === S.r.giusta) selScelta(li); });
      scelta.focus();
    }
    S.punti -= S.es.parametri.err[l]; S.nErrori++; S.sugg = true;
    percErr(); st();
  });
  D.$("#eg-mnu-info").addEventListener("click", function () { D.marquee(vLavoro); });
  D.$("#eg-mnu-esci").addEventListener("click", function () {
    D.conferma("  Vuoi uscire ?? ", " INFORMAZIONE: ").then(function (si) {
      if (si) D.msg(" Ciao !! ").then(function () { location.href = "../../index.html"; });
    });
  });
  scuola.addEventListener("click", function () {                    // mnuSM: school <-> signature
    scuola.textContent = scuola.textContent === D.SCUOLA ? D.FIRMA : D.SCUOLA;
  });
  lcd.addEventListener("click", function () { lcd.title = "Lavora!!!"; (campo.hidden ? scelta : campo).focus(); });

  document.addEventListener("keydown", function (e) {
    if (!e.altKey || vLavoro.hidden || D.dialogoAperto()) return;
    var k = e.key.toLowerCase(), b = { m: "#eg-mnu-menu", s: "#eg-mnu-soluzione", e: "#eg-mnu-esci" }[k];
    if (b) { e.preventDefault(); D.$(b).click(); }
  });
  document.addEventListener("keydown", function (e) {
    if (!e.altKey || vMenu.hidden || D.dialogoAperto()) return;
    if (e.key.toLowerCase() === "p") { e.preventDefault(); D.$("#eg-programmatore").click(); }
    if (e.key.toLowerCase() === "s") { e.preventDefault(); D.$("#eg-esci").click(); }
  });

  // Expose for tests
  window.EGPlayer = { stato: function () { return S; } };

  var richiesto = D.param("id");
  if (richiesto && EG.trova(richiesto)) avvia(EG.trova(richiesto)); else mostraMenu();
})();
