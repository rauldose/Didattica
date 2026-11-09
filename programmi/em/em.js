/*
 * EM - Esercizi Multimediali - player ("Lettore" + lavagna).
 * Behaviour reconstructed from his help pages (emhelp.htm, eng/t2..t9.htm)
 * and from the recovered exercise files; EM's own source was not published.
 */
(function () {
  "use strict";
  var el = D.el;
  var vLettore = D.$("#em-lettore"), vLavoro = D.$("#em-lavoro"), lista = D.$("#em-lista");
  var lavagna = D.$("#em-lavagna"), lavTesto = D.$("#em-lav-testo"), lavMedia = D.$("#em-lav-media");
  var zonaRisp = D.$("#em-risposta"), campo = D.$("#em-campo"), btnOk = D.$("#em-ok"), scelta = D.$("#em-scelta");
  var lcd = D.$("#em-lcd"), etiLiv = D.$("#em-livello"), tempo = D.$("#em-tempo"), gufo = D.$("#em-gufo");
  var esito = D.$("#em-esito"), titolo = D.$("#em-titolo"), continua = D.$("#em-continua"), btnRisorsa = D.$("#em-risorsa-pres");
  var mnuSol = D.$("#em-mnu-soluzione"), mnuAudio = D.$("#em-mnu-audio"), mnuRis = D.$("#em-mnu-risorse");

  var tutte = [], sel = 0, S = null, cronometro = null, attesa = null;
  var player = new Audio();

  /* ======================= LETTORE (exercise list) ======================= */
  function mostraLettore() {
    ferma();
    vLavoro.hidden = true; vLettore.hidden = false;
    EMC.tutte().then(function (l) {
      tutte = l;
      lista.innerHTML = "";
      tutte.forEach(function (e, i) {
        var li = el("li", { role: "option" }, [
          el("span", { class: "em-l-tit", text: e.titolo + (e.utente ? "  *" : e.modificata ? "  (modificata)" : "") }),
          el("span", { class: "em-l-dir", text: e.cartella ? e.cartella.toUpperCase() : "" })
        ]);
        li.addEventListener("click", function () { seleziona(i); });
        li.addEventListener("dblclick", function () { seleziona(i); avvia(tutte[sel]); });
        lista.appendChild(li);
      });
      seleziona(Math.min(sel, tutte.length - 1));
      lista.focus();
    });
  }
  function seleziona(i) {
    sel = Math.max(0, Math.min(tutte.length - 1, i));
    D.$$("li", lista).forEach(function (li, k) { li.classList.toggle("sel", k === sel); li.setAttribute("aria-selected", k === sel); });
    if (lista.children[sel]) lista.children[sel].scrollIntoView({ block: "nearest" });
  }
  lista.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); seleziona(sel + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); seleziona(sel - 1); }
    else if (e.key === "Enter") { e.preventDefault(); if (tutte[sel]) avvia(tutte[sel]); }
  });
  D.$("#em-avvia").addEventListener("click", function () { if (tutte[sel]) avvia(tutte[sel]); });

  /* ======================= session ======================= */
  function ferma() { clearInterval(cronometro); cronometro = null; clearTimeout(attesa); attesa = null; player.pause(); }
  function par(k) { return S.es.parametri[k][S.livello] || 0; }
  function st() { lcd.textContent = D.lcd(S.punti, 5); }
  function suona(nome) {
    var u = EMC.urlMedia(S.es, nome);
    if (!u) return;
    player.pause(); player.src = u;
    var p = player.play(); if (p && p.catch) p.catch(function () { /* autoplay blocked */ });
  }
  function rimescola(a) { for (var i = a.length - 1; i > 0; i--) { var j = D.rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function avvia(es) {
    var validi = EMC.livelliValidi(es);
    if (!validi.length) { D.msg("Questa esercitazione non contiene esercizi."); return; }
    S = { es: es, validi: validi, li: 0, punti: 0, sec: 0, esatti: 0, errati: 0 };
    vLettore.hidden = true; vLavoro.hidden = false;
    titolo.textContent = es.titolo;
    st();
    iniziaLivello();
  }

  function iniziaLivello() {
    ferma();
    S.livello = S.validi[S.li];
    S.liv = EMC.analizzaLivello(S.es.livelli[S.livello].testo);
    etiLiv.textContent = D.lcd(S.livello + 1, 1);
    S.coda = []; S.ese = null;
    var pres = S.liv.presentazione;
    if (pres.trim()) {
      modo("presentazione");
      var testo = EMC.senzaMedia(pres);
      if (S.liv.risorsa) testo = testo.split("\n").filter(function (l) { return !/\.exe\b/i.test(l); }).join("\n");
      lavTesto.textContent = testo;
      mostraMedia(EMC.media(pres));
      btnRisorsa.hidden = !S.liv.risorsa;
      if (S.liv.risorsa) btnRisorsa.textContent = "Avvia " + nomeRisorsa(S.liv.risorsa);
      continua.focus();
    } else prossimo();
  }
  continua.addEventListener("click", prossimo);
  btnRisorsa.addEventListener("click", function () { apriRisorsa(S.liv.risorsa); });

  function riempiCoda() {
    var idx = S.liv.esercizi.map(function (e, i) { return i; });
    S.coda = par("oe") === 1 ? rimescola(idx) : idx;
  }
  function prossimo() {
    ferma();
    if (S.punti >= par("pl")) return livelloSuperato();
    if (!S.coda.length) riempiCoda();
    var i = S.coda.shift();
    S.ese = S.liv.esercizi[i]; S.eseIdx = i; S.passo = 0; S.sbagliato = false;
    S.testo = "";
    mostraPasso();
  }

  function mostraPasso() {
    var p = S.ese.passi[S.passo];
    S.testo += p.testo;
    S.audio = EMC.media(p.testo).filter(function (n) { return EMC.eAudio(n); });
    if (S.passo === 0 && S.ese.consegna) S.audio = EMC.media(S.ese.consegna).filter(function (n) { return EMC.eAudio(n); }).concat(S.audio);
    var immagini = EMC.media(S.testo).filter(function (n) { return EMC.eImmagine(n); });
    S.risolto = false; S.tentativi = 0;
    disegnaLavagna(p, immagini);
    if (S.audio.length) suona(S.audio[0]);
    mnuAudio.disabled = !S.audio.length;
    mnuRis.disabled = !S.ese.risorsa;
    mnuRis.textContent = S.ese.risorsa ? nomeRisorsa(S.ese.risorsa) : "Risorse";
    gufo.hidden = !p.sugg;
    esito.hidden = true;
    // answer widget
    modo(p.tipo);
    if (p.tipo === "digita") { campo.value = ""; campo.focus(); }
    else if (p.tipo === "scegli") {
      scelta.innerHTML = "";
      p.voci.slice().sort(function (a, b) { return a.localeCompare(b, "it", { numeric: true }); }).forEach(function (v) {
        var b = el("button", { type: "button", class: "win-btn em-voce", text: v });
        b.addEventListener("click", function () { verifica(v); });
        scelta.appendChild(b);
      });
      if (scelta.firstChild) scelta.firstChild.focus();
    }
    avviaCronometro();
  }

  function disegnaLavagna(p, immagini) {
    var testo = EMC.senzaMedia((S.ese.consegna ? EMC.senzaMedia(S.ese.consegna).trim() + "\n\n" : "") + S.testo).replace(/\s+$/, "");
    lavTesto.innerHTML = "";
    if (p.tipo === "seleziona") {
      // every word is clickable; a mouse selection also works
      testo.split(/(\s+)/).forEach(function (w) {
        if (!w.trim()) { lavTesto.appendChild(document.createTextNode(w)); return; }
        var s = el("span", { class: "em-parola", text: w, tabindex: "0", role: "button" });
        s.addEventListener("click", function () { verifica(w.replace(/^[^\wÀ-ÿ]+|[^\wÀ-ÿ]+$/g, "")); });
        s.addEventListener("keydown", function (e) { if (e.key === "Enter") s.click(); });
        lavTesto.appendChild(s);
      });
    } else lavTesto.textContent = testo;
    mostraMedia(immagini, p.tipo === "clicca" ? p : null);
  }

  function mostraMedia(nomi, passoClic) {
    lavMedia.innerHTML = "";
    nomi.filter(function (n) { return EMC.eImmagine(n); }).forEach(function (n, k) {
      var u = EMC.urlMedia(S.es, n);
      if (!u) return;
      var img = el("img", { src: u, alt: n, draggable: "false" });
      var box = el("div", { class: "em-img" }, [img]);
      lavMedia.appendChild(box);
      if (passoClic && k === 0) preparaClic(box, img, passoClic);
    });
  }
  // "modalità cliccare": first zone correct (blue), others wrong (red)
  function preparaClic(box, img, p) {
    function pronta() {
      var W = img.naturalWidth, H = img.naturalHeight;
      box.style.maxWidth = W + "px";
      var sbagliate = p.zone.length > 1;
      box.classList.add("em-clic");
      if (!sbagliate) box.classList.add("tutta");
      p.zone.forEach(function (z, i) {
        var a = el("button", { type: "button", class: "em-zona", "aria-label": "zona " + (i + 1) });
        a.style.left = (z[0] / W * 100) + "%"; a.style.top = (z[1] / H * 100) + "%";
        a.style.width = (z[2] / W * 100) + "%"; a.style.height = (z[3] / H * 100) + "%";
        a.addEventListener("click", function (e) { e.stopPropagation(); verificaClic(i === 0, a); });
        if (i === 0) a.dataset.giusta = "1";
        box.appendChild(a);
      });
      if (!sbagliate) box.addEventListener("click", function () { verificaClic(false); });
    }
    if (img.complete && img.naturalWidth) pronta(); else img.addEventListener("load", pronta);
  }

  function modo(m) {
    vLavoro.dataset.modo = m;
    campo.hidden = btnOk.hidden = m !== "digita";
    scelta.hidden = m !== "scegli";
    continua.hidden = m !== "presentazione";
    if (m !== "presentazione") btnRisorsa.hidden = true;
    D.$("#em-istr").textContent = {
      digita: "Digita la risposta e premi Invio", scegli: "Scegli la risposta esatta",
      seleziona: "Seleziona sulla lavagna la risposta esatta", clicca: "Clicca sul disegno la risposta esatta",
      presentazione: ""
    }[m] || "";
    mnuSol.disabled = m === "presentazione";
    if (m === "presentazione") { gufo.hidden = true; mnuAudio.disabled = !EMC.media(S.liv.presentazione).some(function (n) { return EMC.eAudio(n); }); tempo.textContent = ""; }
  }

  /* ---------------- answers ---------------- */
  function verifica(valore) {
    if (S.risolto) return;
    var p = S.ese.passi[S.passo];
    var giusto = p.risposte.some(function (r) { return r === valore.trim(); });
    if (giusto) return passoGiusto(valore.trim());
    sbaglia();
  }
  function verificaClic(ok, zona) {
    if (S.risolto) return;
    if (ok) { if (zona) zona.classList.add("vista"); return passoGiusto(null); }
    sbaglia();
  }
  campo.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); verifica(campo.value); } });
  btnOk.addEventListener("click", function () { verifica(campo.value); campo.focus(); });
  lavTesto.addEventListener("mouseup", function () {
    if (vLavoro.dataset.modo !== "seleziona") return;
    var t = String(window.getSelection() || "").trim();
    if (t && t.indexOf(" ") > 0) verifica(t);
  });

  function sbaglia() {
    S.punti -= par("pm"); st();
    S.sbagliato = true; S.tentativi++;
    D.sound(300, 2); D.sound(100, 3);
    segnala("Risposta errata. Riprova!", "no");
  }
  function segnala(t, cls) {
    esito.textContent = t; esito.className = "em-esito " + cls; esito.hidden = false;
  }
  function passoGiusto(valore, conSoluzione) {
    S.risolto = true;
    clearInterval(cronometro);
    var p = S.ese.passi[S.passo];
    if (valore == null && p.tipo !== "clicca") valore = p.risposte[0];
    if (valore != null && /_{2,}/.test(S.testo)) S.testo = S.testo.replace(/_{2,}/, valore);
    S.passo++;
    if (S.passo < S.ese.passi.length) {
      if (!conSoluzione) { D.suonoOk(); segnala("Esatto!", "si"); }
      attesa = setTimeout(mostraPasso, conSoluzione ? 1800 : 700);
      return;
    }
    // exercise completed
    if (!S.sbagliato) { S.punti += par("pp"); S.esatti++; } else { S.errati++; if (par("oe") === 1) S.coda.push(S.eseIdx); }
    st();
    lavTesto.textContent = EMC.senzaMedia((S.ese.consegna ? EMC.senzaMedia(S.ese.consegna).trim() + "\n\n" : "") + S.testo).replace(/\s+$/, "");
    if (!conSoluzione) { D.suonoOk(); segnala(S.sbagliato ? "Esatto! (ma c'era un errore)" : "B R A V O !", "si"); }
    attesa = setTimeout(prossimo, conSoluzione ? 2200 : 1200);
  }

  function avviaCronometro() {
    clearInterval(cronometro);
    var ti = par("ti");
    if (!ti) { tempo.textContent = ""; return; }
    var resta = ti;
    tempo.textContent = "⏱ " + resta;
    cronometro = setInterval(function () {
      if (D.dialogoAperto()) return;
      resta--;
      tempo.textContent = "⏱ " + resta;
      if (resta <= 0) {
        S.punti -= par("pt"); st();
        if (par("pt")) segnala("Tempo scaduto! -" + par("pt") + " punti", "no");
        resta = ti;
      }
    }, 1000);
  }

  function livelloSuperato() {
    ferma();
    player.src = D.base + "dati/em/cambiolv.wav"; player.play().catch(function () {});
    var ultimo = S.li === S.validi.length - 1;
    var p = D.msg("COMPLIMENTI !!\nHai superato il livello " + (S.livello + 1) + " con " + S.punti + " punti.");
    if (par("sg") > 0) {
      S.sec += par("sg");
      p = p.then(function () { return D.conferma("Hai guadagnato " + S.sec + " secondi di gioco.\nVuoi giocare adesso?\n(Se non giochi conservo il tempo-gioco.)"); })
        .then(function (si) { if (si) return D.gioco(ultimo ? "puzzle" : "duello", S.sec).then(function (r) { S.sec = r || 0; }); });
    }
    p.then(function () {
      S.li++;
      if (S.li >= S.validi.length) return fine();
      iniziaLivello();
    });
  }
  function fine() {
    D.msg("Bravissimo !!\nHai completato tutti i livelli.\n\nPunti: " + S.punti + "\nEsercizi esatti: " + S.esatti + "\nEsercizi con errori: " + S.errati, "EM").then(mostraLettore);
  }

  /* ---------------- menu bar ---------------- */
  var mnuEs = D.$("#em-mnu-esercizi"), tendina = D.$("#em-tendina");
  mnuEs.addEventListener("click", function (e) { e.stopPropagation(); tendina.hidden = !tendina.hidden; if (!tendina.hidden) tendina.querySelector("button").focus(); });
  document.addEventListener("click", function () { tendina.hidden = true; });
  tendina.addEventListener("keydown", function (e) { if (e.key === "Escape") { tendina.hidden = true; mnuEs.focus(); } });
  D.$("#em-t-menu").addEventListener("click", mostraLettore);
  D.$("#em-t-prog").addEventListener("click", function () { location.href = "editor.html" + (S ? "?id=" + encodeURIComponent(S.es.id) : ""); });
  D.$("#em-t-uscita").addEventListener("click", function () { location.href = "../../index.html"; });
  D.$("#em-mnu-help").addEventListener("click", function () {
    var n = el("div", null, [
      el("p", { text: "EM – Esercizi Multimediali, Prof. Carmelo Muscolino (v1, revisione 2/7/2000)." }),
      el("p", { text: "Soft di esercitazione multimediale programmabile: livelli (cinque) superabili al raggiungimento di un punteggio stabilito. Il suggerimento si ottiene cliccando sul gufo (appare solo quando è disponibile). Cliccando 'Soluzione' si perdono i punti stabiliti per risposta errata e appare la soluzione." }),
      el("p", null, [el("a", { href: "../../archivio/originali/em/emhelp.htm", target: "_blank", rel: "noopener", text: "Guida originale completa (emhelp.htm)" })])
    ]);
    D.dialogo({ titolo: "?", nodo: n, pulsanti: [{ testo: "OK", valore: true }], annulla: true });
  });
  mnuSol.addEventListener("click", function () {
    if (!S || !S.ese || S.risolto) return;
    var p = S.ese.passi[S.passo];
    S.punti -= par("pm"); st(); S.sbagliato = true;
    if (p.tipo === "digita") campo.value = p.risposte[0];
    if (p.tipo === "scegli") D.$$("button", scelta).forEach(function (b) { if (b.textContent === p.risposte[0]) b.classList.add("giusta"); });
    if (p.tipo === "seleziona") D.$$(".em-parola", lavTesto).forEach(function (s) { if (s.textContent.indexOf(p.risposte[0]) >= 0) s.classList.add("giusta"); });
    if (p.tipo === "clicca") { var z = D.$(".em-zona[data-giusta]", lavMedia); if (z) z.classList.add("vista"); }
    segnala("Soluzione: " + (p.tipo === "clicca" ? "la zona evidenziata" : p.risposte[0]), "sol");
    passoGiusto(p.tipo === "clicca" ? null : p.risposte[0], true);
  });
  mnuAudio.addEventListener("click", function () {
    if (vLavoro.dataset.modo === "presentazione") { var w = EMC.media(S.liv.presentazione).filter(function (n) { return EMC.eAudio(n); }); if (w[0]) suona(w[0]); return; }
    if (S && S.audio && S.audio.length) suona(S.audio[0]);
  });
  mnuRis.addEventListener("click", function () { if (S && S.ese && S.ese.risorsa) apriRisorsa(S.ese.risorsa); });
  gufo.addEventListener("click", function () {
    var s = S.ese.passi[S.passo].sugg;
    if (EMC.eAudio(s)) return suona(s);
    if (EMC.eImmagine(s)) {
      return D.dialogo({ titolo: "Suggerimento", nodo: el("img", { src: EMC.urlMedia(S.es, s), alt: "suggerimento", style: "max-width:100%" }), pulsanti: [{ testo: "OK", valore: true }], annulla: true });
    }
    D.msg(s, "Suggerimento");
  });
  lcd.addEventListener("click", function () { D.marquee(vLavoro); });

  /* ---------------- external resources ---------------- */
  function nomeRisorsa(r) {
    if (r.programma === "mat.exe") return r.voce === r.programma ? "laboratorio (Talete)" : r.voce;
    return r.voce;
  }
  function apriRisorsa(r) {
    var p = r.programma.replace(/\.exe$/, "");
    if (p === "mat" || p === "talete") return finestra("../talete/index.html", "Laboratorio di matematica");
    if (p === "archimed" || p === "archime") return finestra("../archimede/index.html", "Spinta di Archimede");
    if (/^cal/.test(p)) return calcolatrice();
    D.msg("Il programma esterno \"" + r.programma + "\" non è disponibile in questa versione.");
  }
  function finestra(url, nome) {
    var ov = el("div", { class: "em-finestra" });
    var chiudi = el("button", { class: "win-btn", type: "button", text: "Chiudi " + nome });
    chiudi.addEventListener("click", function () { ov.remove(); });
    ov.appendChild(el("div", { class: "em-finestra-barra" }, [chiudi]));
    ov.appendChild(el("iframe", { src: url, title: nome }));
    document.body.appendChild(ov);
  }
  function calcolatrice() {
    var inp = el("input", { class: "dlg-input", type: "text", placeholder: "es. (12+3)*4", "aria-label": "espressione" });
    var out = el("div", { class: "em-calc-out", text: " " });
    inp.addEventListener("input", function () {
      try { var r = EMC.calcola(inp.value); out.textContent = "= " + D.qstr(r).replace(/^\./, "0.").replace(/^-\./, "-0."); } catch (e) { out.textContent = " "; }
    });
    D.dialogo({ titolo: "Calcolatrice", nodo: el("div", null, [inp, out]), pulsanti: [{ testo: "Chiudi", valore: true }], annulla: true });
  }

  window.EMPlayer = { stato: function () { return S; } };
  var id = D.param("id");
  if (id) EMC.trova(id).then(function (e) { if (e) avvia(e); else mostraLettore(); }); else mostraLettore();
})();
