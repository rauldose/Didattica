/*
 * "La classe online" — Cloudflare Worker + D1.
 * Contract: docs/classe-api.md. Plain ES modules, no dependencies.
 */
import {
  caricaAlunno, contaTentativi, creaSessione, ipDi, LIMITE, profiloAlunno, registraTentativi,
  sessione, soloAlunno, soloInsegnante, TROPPI
} from "./auth.js";
import { fintaVerifica, hashPassword, iterazioni, randomId, verifyPassword } from "./crypto.js";
import { byteLength, email, errore, Errore, intero, json, KB, leggiJson, MB, password, testo, vuoto } from "./http.js";
import { nuovaPassword, nuovoUsername } from "./parole.js";

const VERSIONE = "1.0.0";

/* ---------------- limits ---------------- */
// (not exported: a Worker main module may only export handlers)
// D1 limits a row (and a single string) to 2 000 000 bytes, so the quiz
// limit leaves room for the other columns.
const QUIZ_MAX = 1900000;           // serialized quiz JSON, bytes
const APP_MAX = 1 * MB;             // mini-app HTML, bytes
const ALUNNI_PER_RICHIESTA = 60;
const ALUNNI_PER_CLASSE = 100;
const CLASSI_PER_INSEGNANTE = 100;
const SPAZIO_PER_INSEGNANTE = 100 * MB; // quizzes + mini-apps
const RISULTATI_PER_ALUNNO = 20000;     // older ones are pruned
const CORPO = { piccolo: 64 * KB, quiz: 4 * MB, app: 3 * MB };

const ID = /^[a-z0-9]{1,40}$/;
const TIPI = ["quiz", "app"];
const ora = () => new Date().toISOString();

/* ---------------- helpers ---------------- */
function idValido(id, cosa) {
  if (typeof id !== "string" || !ID.test(id)) throw errore(404, `${cosa} non trovato.`);
  return id;
}

async function classeMia(db, id, insegnanteId) {
  if (!ID.test(id)) throw errore(404, "Classe non trovata.");
  const c = await db.prepare("SELECT id, nome, anno, creato FROM classi WHERE id = ? AND insegnante_id = ?")
    .bind(id, insegnanteId).first();
  if (!c) throw errore(404, "Classe non trovata.");
  return c;
}

async function alunnoMio(db, id, insegnanteId) {
  if (!ID.test(id)) throw errore(404, "Alunno non trovato.");
  const a = await db.prepare(
    "SELECT a.id, a.nome, a.username FROM alunni a JOIN classi c ON c.id = a.classe_id WHERE a.id = ? AND c.insegnante_id = ?"
  ).bind(id, insegnanteId).first();
  if (!a) throw errore(404, "Alunno non trovato.");
  return a;
}

function eUnico(e) {
  return /UNIQUE constraint failed/i.test(String(e && (e.message || e)));
}

/** Bytes used by a teacher's quizzes and mini-apps, excluding one resource. */
async function spazioUsato(db, insegnanteId, escludi = "") {
  const r = await db.prepare(
    `SELECT COALESCE((SELECT SUM(length(CAST(dati AS BLOB))) FROM quiz WHERE insegnante_id = ?1 AND id <> ?2), 0)
          + COALESCE((SELECT SUM(length(CAST(html AS BLOB))) FROM app WHERE insegnante_id = ?1 AND id <> ?2), 0) AS n`
  ).bind(insegnanteId, escludi).first();
  return r ? r.n : 0;
}

async function controllaSpazio(db, insegnanteId, nuovi, escludi) {
  if ((await spazioUsato(db, insegnanteId, escludi)) + nuovi > SPAZIO_PER_INSEGNANTE) {
    throw errore(413, `Hai esaurito lo spazio a disposizione (${SPAZIO_PER_INSEGNANTE / MB} MB): elimina qualche quiz o mini-gioco.`);
  }
}

function gruppiClassi(righe) {
  const m = new Map();
  for (const r of righe) {
    if (!m.has(r.risorsa_id)) m.set(r.risorsa_id, []);
    m.get(r.risorsa_id).push(r.classe_id);
  }
  return m;
}

/* Statements that delete pupils matching `dove` (SQL on alunni) and all their data. */
function cancellaAlunni(db, dove, ...valori) {
  const ids = `SELECT id FROM alunni WHERE ${dove}`;
  return [
    db.prepare(`DELETE FROM sessioni WHERE ruolo = 'alunno' AND utente_id IN (${ids})`).bind(...valori),
    db.prepare(`DELETE FROM risultati WHERE alunno_id IN (${ids})`).bind(...valori),
    db.prepare(`DELETE FROM alunni WHERE ${dove}`).bind(...valori)
  ];
}

/* ---------------- accounts ---------------- */
async function salute() {
  return json({ ok: true, versione: VERSIONE });
}

async function registra({ request, env }) {
  const db = env.DB;
  const b = await leggiJson(request, CORPO.piccolo);
  const em = email(b.email);
  const nome = testo(b.nome, "nome", { max: 80 });
  const pw = password(b.password);
  const chiave = "reg:" + ipDi(request);
  if ((await contaTentativi(db, chiave)) >= LIMITE.registrazione) throw errore(429, TROPPI);
  await registraTentativi(db, [chiave]);
  if (await db.prepare("SELECT 1 FROM insegnanti WHERE email = ?").bind(em).first()) {
    throw errore(409, "Esiste già un account con questa email.");
  }
  const id = randomId("u");
  const pass = await hashPassword(pw, iterazioni(env));
  try {
    await db.prepare("INSERT INTO insegnanti (id, email, nome, pass, creato) VALUES (?, ?, ?, ?, ?)")
      .bind(id, em, nome, pass, ora()).run();
  } catch (e) {
    if (eUnico(e)) throw errore(409, "Esiste già un account con questa email.");
    throw e;
  }
  const token = await creaSessione(db, "insegnante", id);
  return json({ token, ruolo: "insegnante", utente: { id, email: em, nome } }, 201);
}

async function accedi({ request, env }) {
  const db = env.DB;
  const b = await leggiJson(request, CORPO.piccolo);
  if (typeof b.utente !== "string" || typeof b.password !== "string" || !b.utente.trim() || !b.password) {
    throw errore(400, "Scrivi il nome utente (o l'email) e la password.");
  }
  if (b.utente.length > 254 || b.password.length > 200) throw errore(400, "Nome utente o password troppo lunghi.");
  const utente = b.utente.trim().toLowerCase();
  const pw = b.password;
  const kUtente = "login:u:" + utente;
  const kIp = "login:ip:" + ipDi(request);
  const [nU, nIp] = await Promise.all([contaTentativi(db, kUtente), contaTentativi(db, kIp)]);
  if (nU >= LIMITE.utente || nIp >= LIMITE.ip) throw errore(429, TROPPI);

  let ruolo, riga;
  if (utente.includes("@")) {
    ruolo = "insegnante";
    riga = await db.prepare("SELECT id, email, nome, pass FROM insegnanti WHERE email = ?").bind(utente).first();
  } else {
    ruolo = "alunno";
    const r = await db.prepare("SELECT id FROM alunni WHERE username = ?").bind(utente).first();
    riga = r ? await caricaAlunno(db, r.id) : null;
  }
  const ok = riga ? await verifyPassword(pw, riga.pass) : await fintaVerifica(pw, iterazioni(env));
  if (!ok) {
    await registraTentativi(db, [kUtente, kIp]);
    throw errore(401, "Nome utente o password sbagliati.");
  }
  const token = await creaSessione(db, ruolo, riga.id);
  const profilo = ruolo === "insegnante" ? { id: riga.id, email: riga.email, nome: riga.nome } : profiloAlunno(riga);
  return json({ token, ruolo, utente: profilo });
}

async function esci({ env, s }) {
  await env.DB.prepare("DELETE FROM sessioni WHERE hash = ?").bind(s.hash).run();
  return vuoto();
}

async function io({ s }) {
  return json({ ruolo: s.ruolo, utente: s.utente });
}

/** Checks the current password of the logged user (rate limited). */
async function controllaPassword(db, s, pw) {
  const chiave = "pw:" + s.utente.id;
  if ((await contaTentativi(db, chiave)) >= LIMITE.password) throw errore(429, TROPPI);
  if (typeof pw !== "string" || pw.length > 200 || !(await verifyPassword(pw, s.pass))) {
    await registraTentativi(db, [chiave]);
    throw errore(403, "La password non è giusta.");
  }
}

async function cambiaPassword({ request, env, s }) {
  const db = env.DB;
  const b = await leggiJson(request, CORPO.piccolo);
  if (typeof b.vecchia !== "string") throw errore(400, "Scrivi la password attuale.");
  const nuova = password(b.nuova, "nuova");
  await controllaPassword(db, s, b.vecchia);
  const pass = await hashPassword(nuova, iterazioni(env));
  const tabella = s.ruolo === "insegnante" ? "insegnanti" : "alunni";
  await db.batch([
    db.prepare(`UPDATE ${tabella} SET pass = ? WHERE id = ?`).bind(pass, s.utente.id),
    // every other session of this user is revoked; the current one stays
    db.prepare("DELETE FROM sessioni WHERE ruolo = ? AND utente_id = ? AND hash <> ?").bind(s.ruolo, s.utente.id, s.hash)
  ]);
  return vuoto();
}

async function eliminaAccount({ request, env, s }) {
  const db = env.DB;
  const b = await leggiJson(request, CORPO.piccolo);
  await controllaPassword(db, s, b.password);
  const id = s.utente.id;
  const classi = "SELECT id FROM classi WHERE insegnante_id = ?";
  await db.batch([
    ...cancellaAlunni(db, `classe_id IN (${classi})`, id),
    db.prepare(`DELETE FROM pubblicazioni WHERE classe_id IN (${classi})`).bind(id),
    db.prepare("DELETE FROM classi WHERE insegnante_id = ?").bind(id),
    db.prepare("DELETE FROM quiz WHERE insegnante_id = ?").bind(id),
    db.prepare("DELETE FROM app WHERE insegnante_id = ?").bind(id),
    db.prepare("DELETE FROM sessioni WHERE ruolo = 'insegnante' AND utente_id = ?").bind(id),
    db.prepare("DELETE FROM tentativi WHERE chiave = ?").bind("pw:" + id),
    db.prepare("DELETE FROM insegnanti WHERE id = ?").bind(id)
  ]);
  return vuoto();
}

async function esporta({ env, s }) {
  const db = env.DB;
  const id = s.utente.id;
  const [ins, classi, alunni, pubb, quiz, app, risultati] = await db.batch([
    db.prepare("SELECT id, email, nome, creato FROM insegnanti WHERE id = ?").bind(id),
    db.prepare("SELECT id, nome, anno, creato FROM classi WHERE insegnante_id = ? ORDER BY creato").bind(id),
    db.prepare(
      `SELECT a.id, a.classe_id, a.username, a.nome, a.creato FROM alunni a JOIN classi c ON c.id = a.classe_id
        WHERE c.insegnante_id = ? ORDER BY a.nome`
    ).bind(id),
    db.prepare(
      `SELECT p.classe_id, p.tipo, p.risorsa_id, p.creato FROM pubblicazioni p JOIN classi c ON c.id = p.classe_id
        WHERE c.insegnante_id = ? ORDER BY p.creato`
    ).bind(id),
    db.prepare("SELECT id, titolo, dati, aggiornato FROM quiz WHERE insegnante_id = ? ORDER BY aggiornato").bind(id),
    db.prepare("SELECT id, titolo, descrizione, html, aggiornato FROM app WHERE insegnante_id = ? ORDER BY aggiornato").bind(id),
    db.prepare(
      `SELECT r.alunno_id, a.classe_id, r.attivita, r.stelle, r.corrette, r.totali, r.creato
         FROM risultati r JOIN alunni a ON a.id = r.alunno_id JOIN classi c ON c.id = a.classe_id
        WHERE c.insegnante_id = ? ORDER BY r.creato, r.rowid`
    ).bind(id)
  ]);
  const perClasse = (righe, cid) => righe.results.filter((r) => r.classe_id === cid);
  return json({
    formato: "impara-classe-esportazione",
    versione: 1,
    esportato: ora(),
    insegnante: ins.results[0],
    classi: classi.results.map((c) => ({
      ...c,
      alunni: perClasse(alunni, c.id).map(({ classe_id, ...a }) => a),
      pubblicati: perClasse(pubb, c.id).map((p) => ({ tipo: p.tipo, id: p.risorsa_id, creato: p.creato }))
    })),
    quiz: quiz.results.map((q) => ({ id: q.id, titolo: q.titolo, dati: JSON.parse(q.dati), aggiornato: q.aggiornato })),
    app: app.results,
    risultati: risultati.results
  });
}

/* ---------------- classes and pupils ---------------- */
async function listaClassi({ env, s }) {
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.nome, c.anno, (SELECT COUNT(*) FROM alunni a WHERE a.classe_id = c.id) AS alunni, c.creato
       FROM classi c WHERE c.insegnante_id = ? ORDER BY c.creato, c.rowid`
  ).bind(s.utente.id).all();
  return json(results);
}

async function creaClasse({ request, env, s }) {
  const db = env.DB;
  const b = await leggiJson(request, CORPO.piccolo);
  const nome = testo(b.nome, "nome", { max: 60 });
  const anno = intero(b.anno, "anno", 0, 5);
  const n = await db.prepare("SELECT COUNT(*) AS n FROM classi WHERE insegnante_id = ?").bind(s.utente.id).first();
  if (n.n >= CLASSI_PER_INSEGNANTE) throw errore(400, `Puoi avere al massimo ${CLASSI_PER_INSEGNANTE} classi.`);
  const id = randomId("c");
  await db.prepare("INSERT INTO classi (id, insegnante_id, nome, anno, creato) VALUES (?, ?, ?, ?, ?)")
    .bind(id, s.utente.id, nome, anno, ora()).run();
  return json({ id, nome, anno }, 201);
}

async function modificaClasse({ request, env, s, params }) {
  const db = env.DB;
  const c = await classeMia(db, params.id, s.utente.id);
  const b = await leggiJson(request, CORPO.piccolo);
  const nome = b.nome !== undefined ? testo(b.nome, "nome", { max: 60 }) : c.nome;
  const anno = b.anno !== undefined ? intero(b.anno, "anno", 0, 5) : c.anno;
  await db.prepare("UPDATE classi SET nome = ?, anno = ? WHERE id = ? AND insegnante_id = ?")
    .bind(nome, anno, c.id, s.utente.id).run();
  return json({ id: c.id, nome, anno });
}

async function eliminaClasse({ env, s, params }) {
  const db = env.DB;
  const c = await classeMia(db, params.id, s.utente.id);
  await db.batch([
    ...cancellaAlunni(db, "classe_id = ?", c.id),
    db.prepare("DELETE FROM pubblicazioni WHERE classe_id = ?").bind(c.id),
    db.prepare("DELETE FROM classi WHERE id = ? AND insegnante_id = ?").bind(c.id, s.utente.id)
  ]);
  return vuoto();
}

async function dettaglioClasse({ env, s, params }) {
  const db = env.DB;
  const c = await classeMia(db, params.id, s.utente.id);
  const [alunni, pubblicati] = await db.batch([
    db.prepare(
      `SELECT a.id, a.username, a.nome, COALESCE(SUM(r.stelle), 0) AS stelle, COUNT(r.id) AS attivita, MAX(r.creato) AS ultimo
         FROM alunni a LEFT JOIN risultati r ON r.alunno_id = a.id
        WHERE a.classe_id = ? GROUP BY a.id ORDER BY a.nome COLLATE NOCASE, a.username`
    ).bind(c.id),
    db.prepare(
      `SELECT p.tipo, p.risorsa_id AS id, COALESCE(q.titolo, a.titolo) AS titolo
         FROM pubblicazioni p
         LEFT JOIN quiz q ON p.tipo = 'quiz' AND q.id = p.risorsa_id
         LEFT JOIN app a ON p.tipo = 'app' AND a.id = p.risorsa_id
        WHERE p.classe_id = ? ORDER BY p.creato, p.rowid`
    ).bind(c.id)
  ]);
  return json({ id: c.id, nome: c.nome, anno: c.anno, alunni: alunni.results, pubblicati: pubblicati.results });
}

async function creaAlunni({ request, env, s, params }) {
  const db = env.DB;
  const c = await classeMia(db, params.id, s.utente.id);
  const b = await leggiJson(request, CORPO.piccolo);
  if (!Array.isArray(b.nomi) || b.nomi.length === 0) throw errore(400, 'Il campo "nomi" deve essere un elenco di nomi.');
  if (b.nomi.length > ALUNNI_PER_RICHIESTA) throw errore(400, `Puoi aggiungere al massimo ${ALUNNI_PER_RICHIESTA} alunni alla volta.`);
  const nomi = b.nomi.map((n) => testo(n, "nomi", { max: 40 }));
  const n = await db.prepare("SELECT COUNT(*) AS n FROM alunni WHERE classe_id = ?").bind(c.id).first();
  if (n.n + nomi.length > ALUNNI_PER_CLASSE) throw errore(400, `Una classe può avere al massimo ${ALUNNI_PER_CLASSE} alunni.`);

  const iter = iterazioni(env);
  const passwords = nomi.map(() => nuovaPassword());
  const hashes = [];
  for (const p of passwords) hashes.push(await hashPassword(p, iter));

  for (let prova = 0; prova < 5; prova++) {
    // pick usernames that are unique in this request and not yet in the database
    const scelti = new Set();
    for (let giro = 0; scelti.size < nomi.length; giro++) {
      if (giro > 50) throw new Error("username space exhausted");
      const candidati = [];
      while (scelti.size + candidati.length < nomi.length) {
        const u = nuovoUsername();
        if (!scelti.has(u) && !candidati.includes(u)) candidati.push(u);
      }
      const { results } = await db.prepare(
        `SELECT username FROM alunni WHERE username IN (${candidati.map(() => "?").join(",")})`
      ).bind(...candidati).all();
      const presi = new Set(results.map((r) => r.username));
      for (const u of candidati) if (!presi.has(u)) scelti.add(u);
    }
    const usernames = [...scelti];
    const creato = ora();
    const nuovi = nomi.map((nome, i) => ({ id: randomId("u"), nome, username: usernames[i], password: passwords[i] }));
    try {
      await db.batch(nuovi.map((a, i) =>
        db.prepare("INSERT INTO alunni (id, classe_id, username, nome, pass, creato) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(a.id, c.id, a.username, a.nome, hashes[i], creato)));
      return json(nuovi, 201);
    } catch (e) {
      if (!eUnico(e)) throw e; // a concurrent request took a username: retry
    }
  }
  throw errore(503, "Non riesco a creare i nomi utente: riprova.");
}

async function modificaAlunno({ request, env, s, params }) {
  const db = env.DB;
  const a = await alunnoMio(db, params.id, s.utente.id);
  const b = await leggiJson(request, CORPO.piccolo);
  const nome = testo(b.nome, "nome", { max: 40 });
  await db.prepare("UPDATE alunni SET nome = ? WHERE id = ?").bind(nome, a.id).run();
  return json({ id: a.id, nome, username: a.username });
}

async function nuovaPasswordAlunno({ env, s, params }) {
  const db = env.DB;
  const a = await alunnoMio(db, params.id, s.utente.id);
  const pw = nuovaPassword();
  const pass = await hashPassword(pw, iterazioni(env));
  await db.batch([
    db.prepare("UPDATE alunni SET pass = ? WHERE id = ?").bind(pass, a.id),
    db.prepare("DELETE FROM sessioni WHERE ruolo = 'alunno' AND utente_id = ?").bind(a.id)
  ]);
  return json({ username: a.username, password: pw });
}

async function eliminaAlunno({ env, s, params }) {
  const db = env.DB;
  const a = await alunnoMio(db, params.id, s.utente.id);
  await db.batch(cancellaAlunni(db, "id = ?", a.id));
  return vuoto();
}

async function risultatiClasse({ env, s, params }) {
  const db = env.DB;
  const c = await classeMia(db, params.id, s.utente.id);
  const { results } = await db.prepare(
    `SELECT r.alunno_id, a.nome, a.username, r.attivita, r.stelle, r.corrette, r.totali, r.creato
       FROM risultati r JOIN alunni a ON a.id = r.alunno_id
      WHERE a.classe_id = ? ORDER BY r.creato DESC, r.rowid DESC LIMIT 5000`
  ).bind(c.id).all();
  return json(results);
}

/* ---------------- quizzes ---------------- */
function validaQuiz(b) {
  const dati = b.dati;
  if (!dati || typeof dati !== "object" || Array.isArray(dati)) throw errore(400, 'Il campo "dati" deve contenere un quiz.');
  if (!Array.isArray(dati.domande)) throw errore(400, "Il quiz non è valido: mancano le domande.");
  let titolo = "Quiz senza titolo";
  if (dati.titolo !== undefined && dati.titolo !== null && dati.titolo !== "") {
    titolo = testo(dati.titolo, "titolo", { max: 200 });
  }
  return { dati, titolo };
}

function serializzaQuiz(dati, id) {
  dati.id = id;
  const testoJson = JSON.stringify(dati);
  const n = byteLength(testoJson);
  if (n > QUIZ_MAX) throw errore(413, `Il quiz è troppo grande (massimo ${(QUIZ_MAX / 1e6).toFixed(1)} MB): usa immagini più piccole.`);
  return { testoJson, n };
}

async function listaQuiz({ env, s }) {
  const db = env.DB;
  const [quiz, pubb] = await db.batch([
    db.prepare("SELECT id, titolo, aggiornato FROM quiz WHERE insegnante_id = ? ORDER BY aggiornato DESC").bind(s.utente.id),
    db.prepare(
      `SELECT p.risorsa_id, p.classe_id FROM pubblicazioni p JOIN quiz q ON q.id = p.risorsa_id
        WHERE p.tipo = 'quiz' AND q.insegnante_id = ? ORDER BY p.creato`
    ).bind(s.utente.id)
  ]);
  const g = gruppiClassi(pubb.results);
  return json(quiz.results.map((q) => ({ ...q, classi: g.get(q.id) || [] })));
}

async function creaQuiz({ request, env, s }) {
  const db = env.DB;
  const { dati, titolo } = validaQuiz(await leggiJson(request, CORPO.quiz));
  const id = randomId("q");
  const { testoJson, n } = serializzaQuiz(dati, id);
  await controllaSpazio(db, s.utente.id, n);
  await db.prepare("INSERT INTO quiz (id, insegnante_id, titolo, dati, aggiornato) VALUES (?, ?, ?, ?, ?)")
    .bind(id, s.utente.id, titolo, testoJson, ora()).run();
  return json({ id }, 201);
}

async function quizMio(db, id, insegnanteId) {
  idValido(id, "Quiz");
  const q = await db.prepare("SELECT id FROM quiz WHERE id = ? AND insegnante_id = ?").bind(id, insegnanteId).first();
  if (!q) throw errore(404, "Quiz non trovato.");
  return q;
}

async function modificaQuiz({ request, env, s, params }) {
  const db = env.DB;
  const q = await quizMio(db, params.id, s.utente.id);
  const { dati, titolo } = validaQuiz(await leggiJson(request, CORPO.quiz));
  const { testoJson, n } = serializzaQuiz(dati, q.id);
  await controllaSpazio(db, s.utente.id, n, q.id);
  await db.prepare("UPDATE quiz SET titolo = ?, dati = ?, aggiornato = ? WHERE id = ? AND insegnante_id = ?")
    .bind(titolo, testoJson, ora(), q.id, s.utente.id).run();
  return json({ id: q.id });
}

async function eliminaQuiz({ env, s, params }) {
  const db = env.DB;
  const q = await quizMio(db, params.id, s.utente.id);
  await db.batch([
    db.prepare("DELETE FROM pubblicazioni WHERE tipo = 'quiz' AND risorsa_id = ?").bind(q.id),
    db.prepare("DELETE FROM quiz WHERE id = ? AND insegnante_id = ?").bind(q.id, s.utente.id)
  ]);
  return vuoto();
}

async function leggiQuiz({ env, s, params }) {
  const db = env.DB;
  idValido(params.id, "Quiz");
  const q = s.ruolo === "insegnante"
    ? await db.prepare("SELECT id, titolo, dati FROM quiz WHERE id = ? AND insegnante_id = ?").bind(params.id, s.utente.id).first()
    : await db.prepare(
      `SELECT q.id, q.titolo, q.dati FROM quiz q
         JOIN pubblicazioni p ON p.tipo = 'quiz' AND p.risorsa_id = q.id
        WHERE q.id = ? AND p.classe_id = ?`
    ).bind(params.id, s.utente.classe.id).first();
  if (!q) throw errore(404, "Quiz non trovato.");
  return json({ id: q.id, titolo: q.titolo, dati: JSON.parse(q.dati) });
}

/* ---------------- mini-apps ---------------- */
function validaApp(b, parziale) {
  const v = {};
  if (!parziale || b.titolo !== undefined) v.titolo = testo(b.titolo, "titolo", { max: 100 });
  if (b.descrizione !== undefined && b.descrizione !== null) v.descrizione = testo(b.descrizione, "descrizione", { min: 0, max: 500, multiriga: true });
  else if (!parziale) v.descrizione = "";
  if (!parziale || b.html !== undefined) {
    if (typeof b.html !== "string" || !b.html.trim()) throw errore(400, 'Il campo "html" deve contenere la pagina del mini-gioco.');
    if (byteLength(b.html) > APP_MAX) throw errore(413, "Il mini-gioco è troppo grande (massimo 1 MB).");
    v.html = b.html;
  }
  return v;
}

async function appMia(db, id, insegnanteId) {
  idValido(id, "Mini-gioco");
  const a = await db.prepare("SELECT id, titolo, descrizione, html FROM app WHERE id = ? AND insegnante_id = ?")
    .bind(id, insegnanteId).first();
  if (!a) throw errore(404, "Mini-gioco non trovato.");
  return a;
}

async function listaApp({ env, s }) {
  const db = env.DB;
  const [app, pubb] = await db.batch([
    db.prepare(
      `SELECT id, titolo, descrizione, length(CAST(html AS BLOB)) AS dimensione, aggiornato
         FROM app WHERE insegnante_id = ? ORDER BY aggiornato DESC`
    ).bind(s.utente.id),
    db.prepare(
      `SELECT p.risorsa_id, p.classe_id FROM pubblicazioni p JOIN app a ON a.id = p.risorsa_id
        WHERE p.tipo = 'app' AND a.insegnante_id = ? ORDER BY p.creato`
    ).bind(s.utente.id)
  ]);
  const g = gruppiClassi(pubb.results);
  return json(app.results.map((a) => ({ ...a, classi: g.get(a.id) || [] })));
}

async function creaApp({ request, env, s }) {
  const db = env.DB;
  const v = validaApp(await leggiJson(request, CORPO.app), false);
  await controllaSpazio(db, s.utente.id, byteLength(v.html));
  const id = randomId("a");
  await db.prepare("INSERT INTO app (id, insegnante_id, titolo, descrizione, html, aggiornato) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, s.utente.id, v.titolo, v.descrizione, v.html, ora()).run();
  return json({ id }, 201);
}

async function modificaApp({ request, env, s, params }) {
  const db = env.DB;
  const a = await appMia(db, params.id, s.utente.id);
  const v = { ...a, ...validaApp(await leggiJson(request, CORPO.app), true) };
  if (v.html !== a.html) await controllaSpazio(db, s.utente.id, byteLength(v.html), a.id);
  await db.prepare("UPDATE app SET titolo = ?, descrizione = ?, html = ?, aggiornato = ? WHERE id = ? AND insegnante_id = ?")
    .bind(v.titolo, v.descrizione, v.html, ora(), a.id, s.utente.id).run();
  return json({ id: a.id });
}

async function eliminaApp({ env, s, params }) {
  const db = env.DB;
  idValido(params.id, "Mini-gioco");
  const a = await db.prepare("SELECT id FROM app WHERE id = ? AND insegnante_id = ?").bind(params.id, s.utente.id).first();
  if (!a) throw errore(404, "Mini-gioco non trovato.");
  await db.batch([
    db.prepare("DELETE FROM pubblicazioni WHERE tipo = 'app' AND risorsa_id = ?").bind(a.id),
    db.prepare("DELETE FROM app WHERE id = ? AND insegnante_id = ?").bind(a.id, s.utente.id)
  ]);
  return vuoto();
}

async function leggiApp({ env, s, params }) {
  const db = env.DB;
  idValido(params.id, "Mini-gioco");
  const a = s.ruolo === "insegnante"
    ? await db.prepare("SELECT id, titolo, descrizione, html FROM app WHERE id = ? AND insegnante_id = ?").bind(params.id, s.utente.id).first()
    : await db.prepare(
      `SELECT a.id, a.titolo, a.descrizione, a.html FROM app a
         JOIN pubblicazioni p ON p.tipo = 'app' AND p.risorsa_id = a.id
        WHERE a.id = ? AND p.classe_id = ?`
    ).bind(params.id, s.utente.classe.id).first();
  if (!a) throw errore(404, "Mini-gioco non trovato.");
  return json({ id: a.id, titolo: a.titolo, descrizione: a.descrizione, html: a.html });
}

/* ---------------- publishing ---------------- */
function tipoValido(tipo) {
  if (!TIPI.includes(tipo)) throw errore(400, 'Il tipo deve essere "quiz" o "app".');
  return tipo;
}

async function pubblica({ request, env, s, params }) {
  const db = env.DB;
  const c = await classeMia(db, params.id, s.utente.id);
  const b = await leggiJson(request, CORPO.piccolo);
  const tipo = tipoValido(b.tipo);
  const cosa = tipo === "quiz" ? "Quiz" : "Mini-gioco";
  idValido(b.id, cosa);
  const r = await db.prepare(`SELECT id FROM ${tipo} WHERE id = ? AND insegnante_id = ?`).bind(b.id, s.utente.id).first();
  if (!r) throw errore(404, `${cosa} non trovato.`);
  await db.prepare("INSERT OR IGNORE INTO pubblicazioni (classe_id, tipo, risorsa_id, creato) VALUES (?, ?, ?, ?)")
    .bind(c.id, tipo, r.id, ora()).run();
  return vuoto();
}

async function spubblica({ env, s, params }) {
  const db = env.DB;
  const c = await classeMia(db, params.id, s.utente.id);
  const tipo = tipoValido(params.tipo);
  idValido(params.rid, tipo === "quiz" ? "Quiz" : "Mini-gioco");
  await db.prepare("DELETE FROM pubblicazioni WHERE classe_id = ? AND tipo = ? AND risorsa_id = ?")
    .bind(c.id, tipo, params.rid).run();
  return vuoto();
}

/* ---------------- pupil ---------------- */
async function miaClasse({ env, s }) {
  const db = env.DB;
  const classe = s.utente.classe;
  const [ins, quiz, app] = await db.batch([
    db.prepare("SELECT nome FROM insegnanti WHERE id = ?").bind(s.insegnanteId),
    db.prepare(
      `SELECT q.id, q.titolo, json_extract(q.dati, '$.materia') AS materia, json_array_length(q.dati, '$.domande') AS domande
         FROM pubblicazioni p JOIN quiz q ON q.id = p.risorsa_id
        WHERE p.classe_id = ? AND p.tipo = 'quiz' ORDER BY p.creato DESC, p.rowid DESC`
    ).bind(classe.id),
    db.prepare(
      `SELECT a.id, a.titolo, a.descrizione
         FROM pubblicazioni p JOIN app a ON a.id = p.risorsa_id
        WHERE p.classe_id = ? AND p.tipo = 'app' ORDER BY p.creato DESC, p.rowid DESC`
    ).bind(classe.id)
  ]);
  return json({
    classe,
    insegnante: { nome: ins.results[0] ? ins.results[0].nome : "" },
    quiz: quiz.results.map((q) => ({
      id: q.id,
      titolo: q.titolo,
      materia: typeof q.materia === "string" && q.materia.length <= 20 ? q.materia : "altro",
      domande: Number.isInteger(q.domande) ? q.domande : 0
    })),
    app: app.results
  });
}

async function salvaRisultato({ request, env, s }) {
  const db = env.DB;
  const b = await leggiJson(request, CORPO.piccolo);
  const attivita = testo(b.attivita, "attivita", { max: 120 });
  const stelle = intero(b.stelle, "stelle", 0, 3);
  const corrette = b.corrette === undefined || b.corrette === null ? null : intero(b.corrette, "corrette", 0, 100000);
  const totali = b.totali === undefined || b.totali === null ? null : intero(b.totali, "totali", 0, 100000);
  if (corrette !== null && totali !== null && corrette > totali) throw errore(400, "Le risposte corrette non possono essere più delle totali.");
  const id = s.utente.id;
  await db.batch([
    db.prepare("INSERT INTO risultati (id, alunno_id, attivita, stelle, corrette, totali, creato) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(randomId("r"), id, attivita, stelle, corrette, totali, ora()),
    db.prepare(
      `DELETE FROM risultati WHERE rowid IN (SELECT rowid FROM risultati WHERE alunno_id = ?
         ORDER BY creato DESC, rowid DESC LIMIT -1 OFFSET ${RISULTATI_PER_ALUNNO})`
    ).bind(id)
  ]);
  return json({ ok: true }, 201);
}

async function mieiRisultati({ env, s }) {
  const { results } = await env.DB.prepare(
    `SELECT attivita, stelle, corrette, totali, creato FROM risultati WHERE alunno_id = ?
      ORDER BY creato DESC, rowid DESC LIMIT 5000`
  ).bind(s.utente.id).all();
  return json(results);
}

/* ---------------- routing ---------------- */
const PUBBLICO = { pubblico: true };
const INS = { ruolo: "insegnante" };
const ALU = { ruolo: "alunno" };
const LOGGATO = {};

const ROTTE = [
  ["GET", "/api/salute", salute, PUBBLICO],
  ["POST", "/api/insegnanti", registra, PUBBLICO],
  ["POST", "/api/accedi", accedi, PUBBLICO],
  ["POST", "/api/esci", esci, LOGGATO],
  ["GET", "/api/io", io, LOGGATO],
  ["DELETE", "/api/io", eliminaAccount, INS],
  ["PUT", "/api/io/password", cambiaPassword, LOGGATO],
  ["GET", "/api/io/esporta", esporta, INS],
  ["GET", "/api/io/risultati", mieiRisultati, ALU],
  ["GET", "/api/classi", listaClassi, INS],
  ["POST", "/api/classi", creaClasse, INS],
  ["GET", "/api/classi/:id", dettaglioClasse, INS],
  ["PUT", "/api/classi/:id", modificaClasse, INS],
  ["DELETE", "/api/classi/:id", eliminaClasse, INS],
  ["POST", "/api/classi/:id/alunni", creaAlunni, INS],
  ["GET", "/api/classi/:id/risultati", risultatiClasse, INS],
  ["POST", "/api/classi/:id/pubblica", pubblica, INS],
  ["DELETE", "/api/classi/:id/pubblica/:tipo/:rid", spubblica, INS],
  ["PUT", "/api/alunni/:id", modificaAlunno, INS],
  ["DELETE", "/api/alunni/:id", eliminaAlunno, INS],
  ["POST", "/api/alunni/:id/password", nuovaPasswordAlunno, INS],
  ["GET", "/api/quiz", listaQuiz, INS],
  ["POST", "/api/quiz", creaQuiz, INS],
  ["GET", "/api/quiz/:id", leggiQuiz, LOGGATO],
  ["PUT", "/api/quiz/:id", modificaQuiz, INS],
  ["DELETE", "/api/quiz/:id", eliminaQuiz, INS],
  ["GET", "/api/app", listaApp, INS],
  ["POST", "/api/app", creaApp, INS],
  ["GET", "/api/app/:id", leggiApp, LOGGATO],
  ["PUT", "/api/app/:id", modificaApp, INS],
  ["DELETE", "/api/app/:id", eliminaApp, INS],
  ["GET", "/api/classe", miaClasse, ALU],
  ["POST", "/api/risultati", salvaRisultato, ALU]
].map(([metodo, percorso, gestore, opz]) => {
  const nomi = [];
  const re = new RegExp("^" + percorso.replace(/:([a-z]+)/g, (_, n) => { nomi.push(n); return "([^/]+)"; }) + "/?$");
  return { metodo, re, nomi, gestore, opz };
});

function trova(metodo, percorso) {
  let altroMetodo = false;
  for (const r of ROTTE) {
    const m = r.re.exec(percorso);
    if (!m) continue;
    if (r.metodo !== metodo) { altroMetodo = true; continue; }
    const params = {};
    r.nomi.forEach((n, i) => {
      try { params[n] = decodeURIComponent(m[i + 1]); } catch { params[n] = ""; }
    });
    return { rotta: r, params };
  }
  if (altroMetodo) throw errore(405, "Operazione non consentita su questo indirizzo.");
  throw errore(404, "Indirizzo sconosciuto.");
}

/* ---------------- CORS and headers ---------------- */
function origini(env) {
  return String(env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
}

function conIntestazioni(risposta, origine) {
  const r = new Response(risposta.body, risposta);
  const h = r.headers;
  h.set("Cache-Control", "no-store");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  h.set("Referrer-Policy", "no-referrer");
  h.set("Vary", "Origin");
  if (origine) {
    h.set("Access-Control-Allow-Origin", origine);
    h.set("Access-Control-Max-Age", "86400");
  }
  return r;
}

async function gestisci(request, env) {
  const url = new URL(request.url);
  const origine = request.headers.get("Origin");
  if (origine !== null && !origini(env).includes(origine)) {
    return conIntestazioni(json({ errore: "Origine non consentita." }, 403), null);
  }
  if (request.method === "OPTIONS") {
    const r = vuoto(204);
    const h = new Headers(r.headers);
    h.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    h.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    return conIntestazioni(new Response(null, { status: 204, headers: h }), origine);
  }
  try {
    const { rotta, params } = trova(request.method, url.pathname);
    const ctx = { request, env, params, s: null };
    if (!rotta.opz.pubblico) {
      ctx.s = await sessione(request, env);
      if (rotta.opz.ruolo === "insegnante") soloInsegnante(ctx.s);
      if (rotta.opz.ruolo === "alunno") soloAlunno(ctx.s);
    }
    return conIntestazioni(await rotta.gestore(ctx), origine);
  } catch (e) {
    if (e instanceof Errore) return conIntestazioni(json({ errore: e.message }, e.status), origine);
    console.error("Errore interno:", e && e.stack ? e.stack : e);
    return conIntestazioni(json({ errore: "Errore del server: riprova più tardi." }, 500), origine);
  }
}

export default {
  fetch: gestisci
};
