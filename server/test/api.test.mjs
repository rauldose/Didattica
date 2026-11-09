// End-to-end test of the class API: starts `wrangler dev --local` on a free
// port with a fresh D1 database and exercises every endpoint.
// Run with: npm test   (node --test)
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const SERVER = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRANGLER = join(SERVER, "node_modules", "wrangler", "bin", "wrangler.js");
const ENV = { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1", NO_COLOR: "1" };
const ORIGINE_OK = "http://localhost:8000";

let base, proc, persist, log = "";

function portaLibera() {
  return new Promise((ok, ko) => {
    const s = createServer();
    s.once("error", ko);
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); });
  });
}

function wrangler(args) {
  return promisify(execFile)(process.execPath, [WRANGLER, ...args], { cwd: SERVER, env: ENV, maxBuffer: 1 << 24 });
}

let ipN = 0;
const nuovoIp = () => `10.${(ipN >> 16) & 255}.${(ipN >> 8) & 255}.${ipN++ & 255}`;

/** Calls the API. Each call gets its own fake client IP unless `ip` is given. */
async function api(metodo, percorso, { token, body, headers = {}, ip, raw } = {}) {
  const h = { "CF-Connecting-IP": ip || nuovoIp(), ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let corpo;
  if (raw !== undefined) corpo = raw;
  else if (body !== undefined) { corpo = JSON.stringify(body); h["Content-Type"] = "application/json"; }
  const r = await fetch(base + percorso, { method: metodo, headers: h, body: corpo });
  const testo = await r.text();
  let dati = null;
  if (testo) dati = JSON.parse(testo);
  return { status: r.status, body: dati, headers: r.headers, testo };
}

function erroreItaliano(r, status) {
  assert.equal(r.status, status, `atteso ${status}, ricevuto ${r.status}: ${r.testo}`);
  assert.equal(typeof r.body.errore, "string");
  assert.ok(r.body.errore.length > 0);
}

before(async () => {
  persist = await mkdtemp(join(tmpdir(), "classe-test-"));
  await wrangler(["d1", "migrations", "apply", "didattica-classe", "--local", "--persist-to", persist]);
  const porta = await portaLibera();
  const ispettore = await portaLibera();
  base = `http://127.0.0.1:${porta}`;
  proc = spawn(process.execPath, [WRANGLER, "dev", "--local", "--ip", "127.0.0.1", "--port", String(porta),
    "--inspector-port", String(ispettore), "--persist-to", persist, "--var", "PBKDF2_ITERATIONS:1000",
    "--show-interactive-dev-session=false", "--log-level", "warn"],
  { cwd: SERVER, env: ENV, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  proc.stdout.on("data", (d) => { log += d; });
  proc.stderr.on("data", (d) => { log += d; });
  const fine = Date.now() + 90000;
  for (;;) {
    try {
      const r = await fetch(base + "/api/salute");
      if (r.ok) break;
    } catch { /* not ready */ }
    if (Date.now() > fine || proc.exitCode !== null) throw new Error("wrangler dev non parte:\n" + log);
    await new Promise((r) => setTimeout(r, 300));
  }
});

after(async () => {
  if (proc && proc.exitCode === null) {
    try { process.kill(-proc.pid, "SIGTERM"); } catch { proc.kill("SIGTERM"); }
    await new Promise((r) => { proc.once("exit", r); setTimeout(r, 5000); });
  }
  if (persist) await rm(persist, { recursive: true, force: true });
});

// shared state across the ordered tests below
const S = {};
const PW_A = "maestra-anna-123";
const PW_B = "maestro-bruno-456";

function quiz(titolo = "Le tabelline", n = 2) {
  return {
    formato: "impara-quiz", versione: 1, id: "locale-123", titolo, materia: "mat", autore: "Anna", classe: [0, 2],
    domande: Array.from({ length: n }, (_, i) => ({ tipo: "vero-falso", testo: `2 x ${i} = ${2 * i}`, immagine: null, giusta: true }))
  };
}

describe("API classe online", { concurrency: false }, () => {
  test("salute", async () => {
    const r = await api("GET", "/api/salute");
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { ok: true, versione: r.body.versione });
    assert.equal(typeof r.body.versione, "string");
    assert.equal(r.headers.get("cache-control"), "no-store");
    assert.match(r.headers.get("content-type"), /application\/json/);
  });

  test("CORS: preflight, origine consentita e non consentita", async () => {
    let r = await api("OPTIONS", "/api/classi", { headers: { Origin: ORIGINE_OK, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization, content-type" } });
    assert.equal(r.status, 204);
    assert.equal(r.headers.get("access-control-allow-origin"), ORIGINE_OK);
    assert.match(r.headers.get("access-control-allow-methods"), /GET.*POST.*PUT.*DELETE/);
    assert.match(r.headers.get("access-control-allow-headers"), /Authorization/);
    assert.match(r.headers.get("access-control-allow-headers"), /Content-Type/);

    r = await api("OPTIONS", "/api/classi", { headers: { Origin: "https://cattivo.example", "Access-Control-Request-Method": "POST" } });
    assert.equal(r.status, 403);
    assert.equal(r.headers.get("access-control-allow-origin"), null);

    r = await api("GET", "/api/salute", { headers: { Origin: "https://cattivo.example" } });
    erroreItaliano(r, 403);
    assert.equal(r.headers.get("access-control-allow-origin"), null);

    r = await api("GET", "/api/salute", { headers: { Origin: "https://rauldose.github.io" } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("access-control-allow-origin"), "https://rauldose.github.io");
    assert.match(r.headers.get("vary"), /Origin/);
  });

  test("indirizzi sconosciuti e metodi sbagliati", async () => {
    erroreItaliano(await api("GET", "/api/nulla"), 404);
    erroreItaliano(await api("GET", "/"), 404);
    erroreItaliano(await api("PATCH", "/api/classi"), 405);
  });

  test("registrazione insegnanti e validazione", async () => {
    erroreItaliano(await api("POST", "/api/insegnanti", { body: { email: "a@scuola.it", nome: "A", password: "corta" } }), 400);
    erroreItaliano(await api("POST", "/api/insegnanti", { body: { email: "non-una-email", nome: "A", password: PW_A } }), 400);
    erroreItaliano(await api("POST", "/api/insegnanti", { body: { email: "a@scuola.it", nome: "", password: PW_A } }), 400);
    erroreItaliano(await api("POST", "/api/insegnanti", { body: { email: 5, nome: "A", password: PW_A } }), 400);
    erroreItaliano(await api("POST", "/api/insegnanti", { raw: "{non json", headers: { "Content-Type": "application/json" } }), 400);
    erroreItaliano(await api("POST", "/api/insegnanti", { body: [1, 2] }), 400);

    let r = await api("POST", "/api/insegnanti", { body: { email: "Anna.Rossi@Scuola.it", nome: "Anna Rossi", password: PW_A } });
    assert.equal(r.status, 201);
    assert.equal(r.body.ruolo, "insegnante");
    assert.match(r.body.token, /^[A-Za-z0-9_-]{43}$/);
    assert.deepEqual(Object.keys(r.body.utente).sort(), ["email", "id", "nome"]);
    assert.equal(r.body.utente.email, "anna.rossi@scuola.it");
    assert.match(r.body.utente.id, /^u[a-z0-9]{10,}$/);
    S.a = r.body;

    erroreItaliano(await api("POST", "/api/insegnanti", { body: { email: "anna.rossi@scuola.it", nome: "Altra", password: PW_A } }), 409);

    r = await api("POST", "/api/insegnanti", { body: { email: "bruno@scuola.it", nome: "Bruno", password: PW_B } });
    assert.equal(r.status, 201);
    S.b = r.body;
  });

  test("accesso insegnante, /io, errore uniforme", async () => {
    let r = await api("POST", "/api/accedi", { body: { utente: "ANNA.ROSSI@scuola.it", password: PW_A } });
    assert.equal(r.status, 200);
    assert.equal(r.body.ruolo, "insegnante");
    assert.equal(r.body.utente.id, S.a.utente.id);
    assert.ok(!r.testo.includes("pbkdf2"));
    S.a2token = r.body.token; // second session of A, used for revocation tests

    const sbagliata = await api("POST", "/api/accedi", { body: { utente: "anna.rossi@scuola.it", password: "sbagliata!!" } });
    const inesistente = await api("POST", "/api/accedi", { body: { utente: "nessuno@scuola.it", password: "sbagliata!!" } });
    const alunnoInesistente = await api("POST", "/api/accedi", { body: { utente: "gatto-blu-22", password: "sbagliata!!" } });
    erroreItaliano(sbagliata, 401);
    erroreItaliano(inesistente, 401);
    erroreItaliano(alunnoInesistente, 401);
    assert.equal(sbagliata.body.errore, inesistente.body.errore);
    assert.equal(sbagliata.body.errore, alunnoInesistente.body.errore);
    erroreItaliano(await api("POST", "/api/accedi", { body: { utente: "x" } }), 400);

    r = await api("GET", "/api/io", { token: S.a.token });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { ruolo: "insegnante", utente: S.a.utente });

    erroreItaliano(await api("GET", "/api/io"), 401);
    erroreItaliano(await api("GET", "/api/io", { token: "x".repeat(43) }), 401);
    erroreItaliano(await api("GET", "/api/io", { headers: { Authorization: "Basic abc" } }), 401);
  });

  test("classi: crea, elenca, modifica, dettaglio", async () => {
    erroreItaliano(await api("POST", "/api/classi", { token: S.a.token, body: { nome: "3A", anno: 6 } }), 400);
    erroreItaliano(await api("POST", "/api/classi", { token: S.a.token, body: { nome: "3A", anno: "2" } }), 400);
    erroreItaliano(await api("POST", "/api/classi", { token: S.a.token, body: { nome: "   ", anno: 2 } }), 400);
    erroreItaliano(await api("POST", "/api/classi", { token: S.a.token, body: { nome: "x".repeat(61), anno: 2 } }), 400);

    let r = await api("POST", "/api/classi", { token: S.a.token, body: { nome: " 3ª A ", anno: 0 } });
    assert.equal(r.status, 201);
    assert.match(r.body.id, /^c[a-z0-9]{10,}$/);
    assert.deepEqual(r.body, { id: r.body.id, nome: "3ª A", anno: 0 });
    S.classe = r.body.id;

    r = await api("POST", "/api/classi", { token: S.a.token, body: { nome: "5B", anno: 2 } });
    S.classe2 = r.body.id;
    r = await api("POST", "/api/classi", { token: S.b.token, body: { nome: "Classe di Bruno", anno: 3 } });
    S.classeB = r.body.id;

    r = await api("PUT", `/api/classi/${S.classe}`, { token: S.a.token, body: { anno: 1 } });
    assert.deepEqual(r.body, { id: S.classe, nome: "3ª A", anno: 1 });
    r = await api("PUT", `/api/classi/${S.classe}`, { token: S.a.token, body: { nome: "4ª A" } });
    assert.deepEqual(r.body, { id: S.classe, nome: "4ª A", anno: 1 });
    erroreItaliano(await api("PUT", `/api/classi/${S.classe}`, { token: S.a.token, body: { anno: -1 } }), 400);

    r = await api("GET", "/api/classi", { token: S.a.token });
    assert.equal(r.status, 200);
    assert.equal(r.body.length, 2);
    const c = r.body.find((x) => x.id === S.classe);
    assert.deepEqual(Object.keys(c).sort(), ["alunni", "anno", "creato", "id", "nome"]);
    assert.equal(c.alunni, 0);

    r = await api("GET", "/api/classi", { token: S.b.token });
    assert.deepEqual(r.body.map((x) => x.id), [S.classeB]);
  });

  test("alunni: creazione, nomi utente e password", async () => {
    const nomi = Array.from({ length: 61 }, (_, i) => `Alunno ${i}`);
    erroreItaliano(await api("POST", `/api/classi/${S.classe}/alunni`, { token: S.a.token, body: { nomi } }), 400);
    erroreItaliano(await api("POST", `/api/classi/${S.classe}/alunni`, { token: S.a.token, body: { nomi: "Anna" } }), 400);
    erroreItaliano(await api("POST", `/api/classi/${S.classe}/alunni`, { token: S.a.token, body: { nomi: [] } }), 400);
    erroreItaliano(await api("POST", `/api/classi/${S.classe}/alunni`, { token: S.a.token, body: { nomi: ["Anna", 3] } }), 400);
    erroreItaliano(await api("POST", `/api/classi/${S.classe}/alunni`, { token: S.a.token, body: { nomi: ["x".repeat(41)] } }), 400);

    let r = await api("POST", `/api/classi/${S.classe}/alunni`, { token: S.a.token, body: { nomi: ["Anna", "Luca", "Sara"] } });
    assert.equal(r.status, 201);
    assert.equal(r.body.length, 3);
    for (const a of r.body) {
      assert.deepEqual(Object.keys(a).sort(), ["id", "nome", "password", "username"]);
      assert.match(a.id, /^u[a-z0-9]{10,}$/);
      assert.match(a.username, /^[a-z]+-[a-z]+-[2-9]{2}$/);
      assert.match(a.password, /^[a-z]+-[a-z]+-[a-z]+-[2-9]$/);
    }
    assert.equal(new Set(r.body.map((a) => a.username)).size, 3);
    assert.deepEqual(r.body.map((a) => a.nome), ["Anna", "Luca", "Sara"]);
    [S.anna, S.luca, S.sara] = r.body;

    // 60 at once is allowed (and usernames stay unique)
    r = await api("POST", `/api/classi/${S.classe2}/alunni`, { token: S.a.token, body: { nomi: Array.from({ length: 60 }, (_, i) => `Bimbo ${i}`) } });
    assert.equal(r.status, 201);
    assert.equal(new Set(r.body.map((a) => a.username)).size, 60);
    S.alunniClasse2 = r.body;

    r = await api("POST", `/api/classi/${S.classeB}/alunni`, { token: S.b.token, body: { nomi: ["Piero"] } });
    S.piero = r.body[0];

    r = await api("GET", "/api/classi", { token: S.a.token });
    assert.equal(r.body.find((x) => x.id === S.classe).alunni, 3);
    assert.equal(r.body.find((x) => x.id === S.classe2).alunni, 60);
  });

  test("accesso alunno e /io", async () => {
    let r = await api("POST", "/api/accedi", { body: { utente: S.anna.username.toUpperCase(), password: S.anna.password } });
    assert.equal(r.status, 200);
    assert.equal(r.body.ruolo, "alunno");
    assert.deepEqual(r.body.utente, { id: S.anna.id, username: S.anna.username, nome: "Anna", classe: { id: S.classe, nome: "4ª A", anno: 1 } });
    S.annaToken = r.body.token;
    r = await api("GET", "/api/io", { token: S.annaToken });
    assert.deepEqual(r.body, { ruolo: "alunno", utente: { id: S.anna.id, username: S.anna.username, nome: "Anna", classe: { id: S.classe, nome: "4ª A", anno: 1 } } });

    S.lucaToken = (await api("POST", "/api/accedi", { body: { utente: S.luca.username, password: S.luca.password } })).body.token;
    S.saraToken = (await api("POST", "/api/accedi", { body: { utente: S.sara.username, password: S.sara.password } })).body.token;
    S.pieroToken = (await api("POST", "/api/accedi", { body: { utente: S.piero.username, password: S.piero.password } })).body.token;
    S.bimboToken = (await api("POST", "/api/accedi", { body: { utente: S.alunniClasse2[0].username, password: S.alunniClasse2[0].password } })).body.token;
    assert.ok(S.lucaToken && S.saraToken && S.pieroToken && S.bimboToken);
  });

  test("autorizzazione: alunno su funzioni da insegnante (403) e viceversa", async () => {
    const t = S.annaToken;
    const chiamate = [
      ["GET", "/api/classi"], ["POST", "/api/classi", { nome: "x", anno: 1 }], ["GET", `/api/classi/${S.classe}`],
      ["PUT", `/api/classi/${S.classe}`, { nome: "x" }], ["DELETE", `/api/classi/${S.classe}`],
      ["POST", `/api/classi/${S.classe}/alunni`, { nomi: ["x"] }], ["GET", `/api/classi/${S.classe}/risultati`],
      ["POST", `/api/classi/${S.classe}/pubblica`, { tipo: "quiz", id: "qxxxxxxxxxx" }],
      ["DELETE", `/api/classi/${S.classe}/pubblica/quiz/qxxxxxxxxxx`],
      ["PUT", `/api/alunni/${S.luca.id}`, { nome: "x" }], ["DELETE", `/api/alunni/${S.luca.id}`],
      ["POST", `/api/alunni/${S.luca.id}/password`],
      ["GET", "/api/quiz"], ["POST", "/api/quiz", { dati: quiz() }], ["PUT", "/api/quiz/qxxxxxxxxxx", { dati: quiz() }],
      ["DELETE", "/api/quiz/qxxxxxxxxxx"], ["GET", "/api/app"], ["POST", "/api/app", { titolo: "x", html: "<p>x</p>" }],
      ["PUT", "/api/app/axxxxxxxxxx", { titolo: "x" }], ["DELETE", "/api/app/axxxxxxxxxx"],
      ["GET", "/api/io/esporta"], ["DELETE", "/api/io", { password: S.anna.password }]
    ];
    for (const [m, p, body] of chiamate) {
      const r = await api(m, p, { token: t, body });
      erroreItaliano(r, 403);
    }
    erroreItaliano(await api("GET", "/api/classe", { token: S.a.token }), 403);
    erroreItaliano(await api("POST", "/api/risultati", { token: S.a.token, body: { attivita: "x", stelle: 1 } }), 403);
    erroreItaliano(await api("GET", "/api/io/risultati", { token: S.a.token }), 403);
    // no login at all
    erroreItaliano(await api("GET", "/api/classi"), 401);
    erroreItaliano(await api("GET", "/api/classe"), 401);
  });

  test("autorizzazione: insegnante B sulle classi e alunni di A (404)", async () => {
    const t = S.b.token;
    const chiamate = [
      ["GET", `/api/classi/${S.classe}`], ["PUT", `/api/classi/${S.classe}`, { nome: "rubata" }], ["DELETE", `/api/classi/${S.classe}`],
      ["POST", `/api/classi/${S.classe}/alunni`, { nomi: ["Intruso"] }], ["GET", `/api/classi/${S.classe}/risultati`],
      ["DELETE", `/api/classi/${S.classe}/pubblica/quiz/qxxxxxxxxxx`],
      ["PUT", `/api/alunni/${S.anna.id}`, { nome: "rubata" }], ["DELETE", `/api/alunni/${S.anna.id}`],
      ["POST", `/api/alunni/${S.anna.id}/password`]
    ];
    for (const [m, p, body] of chiamate) erroreItaliano(await api(m, p, { token: t, body }), 404);
    // nothing changed
    const r = await api("GET", `/api/classi/${S.classe}`, { token: S.a.token });
    assert.equal(r.body.nome, "4ª A");
    assert.equal(r.body.alunni.length, 3);
    // the pupil still logs in with the same password
    assert.equal((await api("POST", "/api/accedi", { body: { utente: S.anna.username, password: S.anna.password } })).status, 200);
    erroreItaliano(await api("GET", "/api/classi/inesistente1", { token: S.a.token }), 404);
    erroreItaliano(await api("GET", "/api/classi/NON-VALIDO!", { token: S.a.token }), 404);
  });

  test("alunni: rinomina", async () => {
    erroreItaliano(await api("PUT", `/api/alunni/${S.sara.id}`, { token: S.a.token, body: { nome: "" } }), 400);
    const r = await api("PUT", `/api/alunni/${S.sara.id}`, { token: S.a.token, body: { nome: "Sara B." } });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { id: S.sara.id, nome: "Sara B.", username: S.sara.username });
  });

  test("quiz: crea, leggi, elenca, modifica, isolamento tra insegnanti", async () => {
    erroreItaliano(await api("POST", "/api/quiz", { token: S.a.token, body: {} }), 400);
    erroreItaliano(await api("POST", "/api/quiz", { token: S.a.token, body: { dati: "testo" } }), 400);
    erroreItaliano(await api("POST", "/api/quiz", { token: S.a.token, body: { dati: { titolo: "senza domande" } } }), 400);

    let r = await api("POST", "/api/quiz", { token: S.a.token, body: { dati: quiz("Le tabelline", 3) } });
    assert.equal(r.status, 201);
    assert.match(r.body.id, /^q[a-z0-9]{10,}$/);
    S.quiz = r.body.id;

    r = await api("GET", `/api/quiz/${S.quiz}`, { token: S.a.token });
    assert.equal(r.status, 200);
    assert.equal(r.body.id, S.quiz);
    assert.equal(r.body.titolo, "Le tabelline");
    assert.equal(r.body.dati.id, S.quiz, "server sets dati.id");
    assert.equal(r.body.dati.domande.length, 3);

    r = await api("PUT", `/api/quiz/${S.quiz}`, { token: S.a.token, body: { dati: { ...quiz("Tabelline del 2", 4), id: "altro" } } });
    assert.deepEqual(r.body, { id: S.quiz });
    r = await api("GET", `/api/quiz/${S.quiz}`, { token: S.a.token });
    assert.equal(r.body.titolo, "Tabelline del 2");
    assert.equal(r.body.dati.id, S.quiz);

    r = await api("GET", "/api/quiz", { token: S.a.token });
    assert.equal(r.body.length, 1);
    assert.deepEqual(Object.keys(r.body[0]).sort(), ["aggiornato", "classi", "id", "titolo"]);
    assert.deepEqual(r.body[0].classi, []);

    r = await api("POST", "/api/quiz", { token: S.b.token, body: { dati: quiz("Quiz di Bruno") } });
    S.quizB = r.body.id;
    assert.deepEqual((await api("GET", "/api/quiz", { token: S.b.token })).body.map((q) => q.id), [S.quizB]);

    erroreItaliano(await api("GET", `/api/quiz/${S.quiz}`, { token: S.b.token }), 404);
    erroreItaliano(await api("PUT", `/api/quiz/${S.quiz}`, { token: S.b.token, body: { dati: quiz("rubato") } }), 404);
    erroreItaliano(await api("DELETE", `/api/quiz/${S.quiz}`, { token: S.b.token }), 404);
    erroreItaliano(await api("GET", `/api/quiz/${S.quizB}`, { token: S.a.token }), 404);
    erroreItaliano(await api("GET", "/api/quiz/qinesistente", { token: S.a.token }), 404);
  });

  test("pubblicazione quiz: visibilità per gli alunni", async () => {
    // not published yet → pupil gets 404
    erroreItaliano(await api("GET", `/api/quiz/${S.quiz}`, { token: S.annaToken }), 404);
    let r = await api("GET", "/api/classe", { token: S.annaToken });
    assert.deepEqual(r.body.quiz, []);

    erroreItaliano(await api("POST", `/api/classi/${S.classe}/pubblica`, { token: S.a.token, body: { tipo: "video", id: S.quiz } }), 400);
    erroreItaliano(await api("POST", `/api/classi/${S.classe}/pubblica`, { token: S.a.token, body: { tipo: "quiz", id: S.quizB } }), 404);
    erroreItaliano(await api("POST", `/api/classi/${S.classeB}/pubblica`, { token: S.a.token, body: { tipo: "quiz", id: S.quiz } }), 404);
    erroreItaliano(await api("POST", `/api/classi/${S.classeB}/pubblica`, { token: S.b.token, body: { tipo: "quiz", id: S.quiz } }), 404);

    r = await api("POST", `/api/classi/${S.classe}/pubblica`, { token: S.a.token, body: { tipo: "quiz", id: S.quiz } });
    assert.equal(r.status, 204);
    assert.equal(r.testo, "");
    // publishing twice is harmless
    assert.equal((await api("POST", `/api/classi/${S.classe}/pubblica`, { token: S.a.token, body: { tipo: "quiz", id: S.quiz } })).status, 204);

    r = await api("GET", `/api/quiz/${S.quiz}`, { token: S.annaToken });
    assert.equal(r.status, 200);
    assert.equal(r.body.titolo, "Tabelline del 2");
    // pupil of another class (same teacher) and of another teacher: 404
    erroreItaliano(await api("GET", `/api/quiz/${S.quiz}`, { token: S.bimboToken }), 404);
    erroreItaliano(await api("GET", `/api/quiz/${S.quiz}`, { token: S.pieroToken }), 404);

    r = await api("GET", "/api/classe", { token: S.annaToken });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.classe, { id: S.classe, nome: "4ª A", anno: 1 });
    assert.deepEqual(r.body.insegnante, { nome: "Anna Rossi" });
    assert.deepEqual(r.body.quiz, [{ id: S.quiz, titolo: "Tabelline del 2", materia: "mat", domande: 4 }]);
    assert.deepEqual(r.body.app, []);
    assert.ok(!r.testo.includes("email"), "pupils do not see the teacher's email");

    r = await api("GET", "/api/quiz", { token: S.a.token });
    assert.deepEqual(r.body[0].classi, [S.classe]);
    r = await api("GET", `/api/classi/${S.classe}`, { token: S.a.token });
    assert.deepEqual(r.body.pubblicati, [{ tipo: "quiz", id: S.quiz, titolo: "Tabelline del 2" }]);

    // unpublish
    erroreItaliano(await api("DELETE", `/api/classi/${S.classe}/pubblica/video/${S.quiz}`, { token: S.a.token }), 400);
    r = await api("DELETE", `/api/classi/${S.classe}/pubblica/quiz/${S.quiz}`, { token: S.a.token });
    assert.equal(r.status, 204);
    erroreItaliano(await api("GET", `/api/quiz/${S.quiz}`, { token: S.annaToken }), 404);
    assert.deepEqual((await api("GET", "/api/classe", { token: S.annaToken })).body.quiz, []);

    // publish again for later tests
    await api("POST", `/api/classi/${S.classe}/pubblica`, { token: S.a.token, body: { tipo: "quiz", id: S.quiz } });
  });

  test("mini-app: crea, leggi, elenca, modifica, pubblica", async () => {
    const html = "<!doctype html><title>Gioco</title><script>parent.postMessage({impara:'fine'},'*')</script>";
    erroreItaliano(await api("POST", "/api/app", { token: S.a.token, body: { titolo: "Gioco" } }), 400);
    erroreItaliano(await api("POST", "/api/app", { token: S.a.token, body: { titolo: "", html } }), 400);
    erroreItaliano(await api("POST", "/api/app", { token: S.a.token, body: { titolo: "Gioco", html: 42 } }), 400);
    erroreItaliano(await api("POST", "/api/app", { token: S.a.token, body: { titolo: "Gioco", html, descrizione: "x".repeat(501) } }), 400);

    let r = await api("POST", "/api/app", { token: S.a.token, body: { titolo: "Gioco delle frazioni", descrizione: "Trascina i pezzi", html } });
    assert.equal(r.status, 201);
    assert.match(r.body.id, /^a[a-z0-9]{10,}$/);
    S.app = r.body.id;

    r = await api("GET", `/api/app/${S.app}`, { token: S.a.token });
    assert.match(r.headers.get("content-type"), /^application\/json/);
    assert.deepEqual(r.body, { id: S.app, titolo: "Gioco delle frazioni", descrizione: "Trascina i pezzi", html });

    r = await api("GET", "/api/app", { token: S.a.token });
    assert.equal(r.body.length, 1);
    assert.deepEqual(Object.keys(r.body[0]).sort(), ["aggiornato", "classi", "descrizione", "dimensione", "id", "titolo"]);
    assert.equal(r.body[0].dimensione, Buffer.byteLength(html));
    assert.ok(!("html" in r.body[0]));

    r = await api("PUT", `/api/app/${S.app}`, { token: S.a.token, body: { titolo: "Frazioni" } });
    assert.deepEqual(r.body, { id: S.app });
    r = await api("GET", `/api/app/${S.app}`, { token: S.a.token });
    assert.deepEqual(r.body, { id: S.app, titolo: "Frazioni", descrizione: "Trascina i pezzi", html });

    r = await api("POST", "/api/app", { token: S.b.token, body: { titolo: "App di Bruno", html: "<p>B</p>" } });
    S.appB = r.body.id;
    erroreItaliano(await api("GET", `/api/app/${S.app}`, { token: S.b.token }), 404);
    erroreItaliano(await api("PUT", `/api/app/${S.app}`, { token: S.b.token, body: { titolo: "rubata" } }), 404);
    erroreItaliano(await api("DELETE", `/api/app/${S.app}`, { token: S.b.token }), 404);
    erroreItaliano(await api("POST", `/api/classi/${S.classe}/pubblica`, { token: S.a.token, body: { tipo: "app", id: S.appB } }), 404);

    erroreItaliano(await api("GET", `/api/app/${S.app}`, { token: S.annaToken }), 404);
    assert.equal((await api("POST", `/api/classi/${S.classe}/pubblica`, { token: S.a.token, body: { tipo: "app", id: S.app } })).status, 204);
    r = await api("GET", `/api/app/${S.app}`, { token: S.annaToken });
    assert.equal(r.status, 200);
    assert.equal(r.body.html, html);
    erroreItaliano(await api("GET", `/api/app/${S.app}`, { token: S.pieroToken }), 404);
    r = await api("GET", "/api/classe", { token: S.annaToken });
    assert.deepEqual(r.body.app, [{ id: S.app, titolo: "Frazioni", descrizione: "Trascina i pezzi" }]);
    r = await api("GET", "/api/app", { token: S.a.token });
    assert.deepEqual(r.body[0].classi, [S.classe]);
  });

  test("limiti di dimensione (413) e numero (400)", async () => {
    // quiz larger than the limit
    const grande = quiz("Grande", 1);
    grande.domande[0].immagine = "data:image/png;base64," + "A".repeat(1950000);
    erroreItaliano(await api("POST", "/api/quiz", { token: S.a.token, body: { dati: grande } }), 413);
    erroreItaliano(await api("PUT", `/api/quiz/${S.quiz}`, { token: S.a.token, body: { dati: grande } }), 413);
    // quiz just under the limit is accepted
    const medio = quiz("Medio", 1);
    medio.domande[0].immagine = "data:image/png;base64," + "A".repeat(1800000);
    let r = await api("POST", "/api/quiz", { token: S.a.token, body: { dati: medio } });
    assert.equal(r.status, 201);
    assert.equal((await api("DELETE", `/api/quiz/${r.body.id}`, { token: S.a.token })).status, 204);

    // mini-app over 1 MB
    erroreItaliano(await api("POST", "/api/app", { token: S.a.token, body: { titolo: "Grande", html: "x".repeat(1024 * 1024 + 1) } }), 413);
    erroreItaliano(await api("PUT", `/api/app/${S.app}`, { token: S.a.token, body: { html: "x".repeat(1024 * 1024 + 1) } }), 413);
    r = await api("POST", "/api/app", { token: S.a.token, body: { titolo: "1 MB", html: "x".repeat(1024 * 1024) } });
    assert.equal(r.status, 201);
    assert.equal((await api("DELETE", `/api/app/${r.body.id}`, { token: S.a.token })).status, 204);

    // whole request body too big for a small endpoint (Content-Length and streamed)
    erroreItaliano(await api("POST", "/api/classi", { token: S.a.token, body: { nome: "x", anno: 1, extra: "y".repeat(100 * 1024) } }), 413);
    erroreItaliano(await api("POST", "/api/accedi", { body: { utente: "x", password: "y", extra: "z".repeat(100 * 1024) } }), 413);
    const flusso = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('{"nome":"' + "x".repeat(200 * 1024) + '","anno":1}')); c.close(); } });
    const rs = await fetch(base + "/api/classi", { method: "POST", body: flusso, duplex: "half", headers: { Authorization: `Bearer ${S.a.token}`, "Content-Type": "application/json" } });
    assert.equal(rs.status, 413);
    erroreItaliano(await api("POST", "/api/quiz", { token: S.a.token, raw: "x".repeat(5 * 1024 * 1024), headers: { "Content-Type": "application/json" } }), 413);
  });

  test("risultati degli alunni", async () => {
    erroreItaliano(await api("POST", "/api/risultati", { token: S.annaToken, body: { attivita: "quiz:x", stelle: 4 } }), 400);
    erroreItaliano(await api("POST", "/api/risultati", { token: S.annaToken, body: { attivita: "quiz:x", stelle: 1.5 } }), 400);
    erroreItaliano(await api("POST", "/api/risultati", { token: S.annaToken, body: { attivita: "x".repeat(121), stelle: 1 } }), 400);
    erroreItaliano(await api("POST", "/api/risultati", { token: S.annaToken, body: { attivita: "", stelle: 1 } }), 400);
    erroreItaliano(await api("POST", "/api/risultati", { token: S.annaToken, body: { attivita: "quiz:x", stelle: 1, corrette: 5, totali: 3 } }), 400);
    erroreItaliano(await api("POST", "/api/risultati", { token: S.annaToken, body: { attivita: "quiz:x", stelle: 1, corrette: -1 } }), 400);

    let r = await api("POST", "/api/risultati", { token: S.annaToken, body: { attivita: `quiz:${S.quiz}`, stelle: 2, corrette: 3, totali: 4 } });
    assert.equal(r.status, 201);
    await new Promise((ok) => setTimeout(ok, 5));
    r = await api("POST", "/api/risultati", { token: S.annaToken, body: { attivita: `app:${S.app}`, stelle: 3 } });
    assert.equal(r.status, 201);
    await new Promise((ok) => setTimeout(ok, 5));
    await api("POST", "/api/risultati", { token: S.lucaToken, body: { attivita: "x".repeat(120), stelle: 1, corrette: 1, totali: 4 } });
    await api("POST", "/api/risultati", { token: S.pieroToken, body: { attivita: "di Bruno", stelle: 3 } });

    r = await api("GET", "/api/io/risultati", { token: S.annaToken });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.map((x) => [x.attivita, x.stelle, x.corrette, x.totali]), [[`app:${S.app}`, 3, null, null], [`quiz:${S.quiz}`, 2, 3, 4]]);
    assert.deepEqual(Object.keys(r.body[0]).sort(), ["attivita", "corrette", "creato", "stelle", "totali"]);

    r = await api("GET", `/api/classi/${S.classe}/risultati`, { token: S.a.token });
    assert.equal(r.status, 200);
    assert.equal(r.body.length, 3);
    assert.deepEqual(Object.keys(r.body[0]).sort(), ["alunno_id", "attivita", "corrette", "creato", "nome", "stelle", "totali", "username"]);
    assert.equal(r.body[0].nome, "Luca"); // newest first
    assert.ok(r.body.every((x) => x.alunno_id !== S.piero.id));
    const creati = r.body.map((x) => x.creato);
    assert.deepEqual([...creati].sort().reverse(), creati);

    r = await api("GET", `/api/classi/${S.classe}`, { token: S.a.token });
    const anna = r.body.alunni.find((a) => a.id === S.anna.id);
    assert.deepEqual(Object.keys(anna).sort(), ["attivita", "id", "nome", "stelle", "ultimo", "username"]);
    assert.equal(anna.stelle, 5);
    assert.equal(anna.attivita, 2);
    assert.match(anna.ultimo, /^\d{4}-\d\d-\d\dT/);
    const sara = r.body.alunni.find((a) => a.id === S.sara.id);
    assert.deepEqual([sara.stelle, sara.attivita, sara.ultimo], [0, 0, null]);
    assert.ok(!r.testo.includes("pbkdf2"));
  });

  test("limite di accessi per nome utente (429)", async () => {
    const u = S.luca.username;
    for (let i = 0; i < 10; i++) {
      erroreItaliano(await api("POST", "/api/accedi", { body: { utente: u, password: "sbagliata-" + i } }), 401);
    }
    // even the right password is refused now, from any IP
    erroreItaliano(await api("POST", "/api/accedi", { body: { utente: u, password: S.luca.password } }), 429);
    // other users are not affected
    assert.equal((await api("POST", "/api/accedi", { body: { utente: S.sara.username, password: S.sara.password } })).status, 200);
  });

  test("limite di accessi per IP (429)", async () => {
    const ip = "203.0.113.7";
    for (let i = 0; i < 30; i++) {
      erroreItaliano(await api("POST", "/api/accedi", { ip, body: { utente: `nessuno-${i}`, password: "sbagliata" } }), 401);
    }
    erroreItaliano(await api("POST", "/api/accedi", { ip, body: { utente: S.sara.username, password: S.sara.password } }), 429);
    assert.equal((await api("POST", "/api/accedi", { ip: "203.0.113.8", body: { utente: S.sara.username, password: S.sara.password } })).status, 200);
  });

  test("limite di registrazioni per IP (429)", async () => {
    const ip = "198.51.100.9";
    for (let i = 0; i < 20; i++) {
      // invalid email domain-less requests are rejected before counting; use duplicates (409) instead
      erroreItaliano(await api("POST", "/api/insegnanti", { ip, body: { email: "anna.rossi@scuola.it", nome: "X", password: "abcdefgh" } }), 409);
    }
    erroreItaliano(await api("POST", "/api/insegnanti", { ip, body: { email: "nuova@scuola.it", nome: "X", password: "abcdefgh" } }), 429);
  });

  test("cambio password: revoca le altre sessioni", async () => {
    erroreItaliano(await api("PUT", "/api/io/password", { token: S.a.token, body: { vecchia: "sbagliata", nuova: "nuovissima-1" } }), 403);
    erroreItaliano(await api("PUT", "/api/io/password", { token: S.a.token, body: { vecchia: PW_A, nuova: "corta" } }), 400);
    let r = await api("PUT", "/api/io/password", { token: S.a.token, body: { vecchia: PW_A, nuova: "nuovissima-1" } });
    assert.equal(r.status, 204);
    assert.equal((await api("GET", "/api/io", { token: S.a.token })).status, 200, "current session kept");
    erroreItaliano(await api("GET", "/api/io", { token: S.a2token }), 401);
    erroreItaliano(await api("POST", "/api/accedi", { body: { utente: "anna.rossi@scuola.it", password: PW_A } }), 401);
    r = await api("POST", "/api/accedi", { body: { utente: "anna.rossi@scuola.it", password: "nuovissima-1" } });
    assert.equal(r.status, 200);

    // a pupil can change their own password too
    r = await api("PUT", "/api/io/password", { token: S.saraToken, body: { vecchia: S.sara.password, nuova: "sara-segreta-9" } });
    assert.equal(r.status, 204);
    assert.equal((await api("POST", "/api/accedi", { body: { utente: S.sara.username, password: "sara-segreta-9" } })).status, 200);

    // too many wrong current passwords → 429
    for (let i = 0; i < 10; i++) await api("PUT", "/api/io/password", { token: S.saraToken, body: { vecchia: "no-" + i, nuova: "abcdefghi" } });
    erroreItaliano(await api("PUT", "/api/io/password", { token: S.saraToken, body: { vecchia: "sara-segreta-9", nuova: "abcdefghi" } }), 429);
  });

  test("nuova password per un alunno: revoca le sue sessioni", async () => {
    const r = await api("POST", `/api/alunni/${S.anna.id}/password`, { token: S.a.token });
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.body).sort(), ["password", "username"]);
    assert.equal(r.body.username, S.anna.username);
    assert.match(r.body.password, /^[a-z]+-[a-z]+-[a-z]+-[2-9]$/);
    erroreItaliano(await api("GET", "/api/io", { token: S.annaToken }), 401);
    erroreItaliano(await api("POST", "/api/accedi", { body: { utente: S.anna.username, password: S.anna.password } }), 401);
    const nuovo = await api("POST", "/api/accedi", { body: { utente: S.anna.username, password: r.body.password } });
    assert.equal(nuovo.status, 200);
    S.annaToken = nuovo.body.token;
    S.anna.password = r.body.password;
  });

  test("esci revoca il token", async () => {
    const r = await api("POST", "/api/accedi", { body: { utente: S.anna.username, password: S.anna.password } });
    assert.equal((await api("POST", "/api/esci", { token: r.body.token })).status, 204);
    erroreItaliano(await api("GET", "/api/io", { token: r.body.token }), 401);
    assert.equal((await api("GET", "/api/io", { token: S.annaToken })).status, 200, "other sessions untouched");
  });

  test("sessione scaduta", async () => {
    const r = await api("POST", "/api/accedi", { body: { utente: "bruno@scuola.it", password: PW_B } });
    assert.equal(r.status, 200);
    // expire every session of Bruno directly in the local D1 database
    await wrangler(["d1", "execute", "didattica-classe", "--local", "--persist-to", persist,
      "--command", `UPDATE sessioni SET scade = 1 WHERE utente_id = '${S.b.utente.id}'`]);
    erroreItaliano(await api("GET", "/api/io", { token: r.body.token }), 401);
    erroreItaliano(await api("GET", "/api/io", { token: S.b.token }), 401);
    S.b.token = (await api("POST", "/api/accedi", { body: { utente: "bruno@scuola.it", password: PW_B } })).body.token;
    assert.equal((await api("GET", "/api/io", { token: S.b.token })).status, 200);
  });

  test("esportazione dei dati", async () => {
    const r = await api("GET", "/api/io/esporta", { token: S.a.token });
    assert.equal(r.status, 200);
    const e = r.body;
    assert.equal(e.insegnante.id, S.a.utente.id);
    assert.equal(e.insegnante.email, "anna.rossi@scuola.it");
    assert.equal(e.classi.length, 2);
    const c = e.classi.find((x) => x.id === S.classe);
    assert.deepEqual(c.alunni.map((a) => a.nome).sort(), ["Anna", "Luca", "Sara B."]);
    assert.deepEqual(Object.keys(c.alunni[0]).sort(), ["creato", "id", "nome", "username"]);
    assert.deepEqual(c.pubblicati.map((p) => p.tipo).sort(), ["app", "quiz"]);
    assert.deepEqual(e.quiz.map((q) => q.id), [S.quiz]);
    assert.equal(e.quiz[0].dati.titolo, "Tabelline del 2");
    assert.deepEqual(e.app.map((a) => a.id), [S.app]);
    assert.ok(e.app[0].html.length > 0);
    assert.equal(e.risultati.length, 3);
    assert.ok(e.risultati.every((x) => x.alunno_id !== S.piero.id));
    assert.ok(!r.testo.includes("pbkdf2"), "no password hashes");
    assert.ok(!r.testo.includes(S.b.utente.id) && !r.testo.includes("Bruno"), "no data of other teachers");
    assert.ok(!/"pass"/.test(r.testo));
  });

  test("eliminare un alunno cancella risultati e sessioni", async () => {
    assert.equal((await api("DELETE", `/api/alunni/${S.luca.id}`, { token: S.a.token })).status, 204);
    erroreItaliano(await api("GET", "/api/io", { token: S.lucaToken }), 401);
    const r = await api("GET", `/api/classi/${S.classe}/risultati`, { token: S.a.token });
    assert.ok(r.body.every((x) => x.alunno_id !== S.luca.id));
    assert.equal(r.body.length, 2);
    erroreItaliano(await api("DELETE", `/api/alunni/${S.luca.id}`, { token: S.a.token }), 404);
  });

  test("eliminare quiz e app li toglie dalle classi", async () => {
    assert.equal((await api("DELETE", `/api/quiz/${S.quiz}`, { token: S.a.token })).status, 204);
    erroreItaliano(await api("GET", `/api/quiz/${S.quiz}`, { token: S.a.token }), 404);
    erroreItaliano(await api("GET", `/api/quiz/${S.quiz}`, { token: S.annaToken }), 404);
    let r = await api("GET", "/api/classe", { token: S.annaToken });
    assert.deepEqual(r.body.quiz, []);
    assert.equal(r.body.app.length, 1);
    assert.equal((await api("DELETE", `/api/app/${S.app}`, { token: S.a.token })).status, 204);
    r = await api("GET", "/api/classe", { token: S.annaToken });
    assert.deepEqual(r.body.app, []);
    r = await api("GET", `/api/classi/${S.classe}`, { token: S.a.token });
    assert.deepEqual(r.body.pubblicati, []);
  });

  test("eliminare una classe cancella alunni, sessioni e risultati", async () => {
    // give the class a published quiz again, to check the publication goes too
    const q = await api("POST", "/api/quiz", { token: S.a.token, body: { dati: quiz("Ancora") } });
    await api("POST", `/api/classi/${S.classe}/pubblica`, { token: S.a.token, body: { tipo: "quiz", id: q.body.id } });
    assert.equal((await api("DELETE", `/api/classi/${S.classe}`, { token: S.a.token })).status, 204);
    erroreItaliano(await api("GET", `/api/classi/${S.classe}`, { token: S.a.token }), 404);
    erroreItaliano(await api("GET", "/api/io", { token: S.annaToken }), 401);
    erroreItaliano(await api("GET", "/api/io", { token: S.saraToken }), 401);
    erroreItaliano(await api("POST", "/api/accedi", { body: { utente: S.anna.username, password: S.anna.password } }), 401);
    const e = (await api("GET", "/api/io/esporta", { token: S.a.token })).body;
    assert.deepEqual(e.classi.map((c) => c.id), [S.classe2]);
    assert.equal(e.risultati.length, 0);
    assert.deepEqual((await api("GET", "/api/quiz", { token: S.a.token })).body.find((x) => x.id === q.body.id).classi, []);
    // the other class is untouched
    assert.equal((await api("GET", "/api/io", { token: S.bimboToken })).status, 200);
  });

  test("eliminare l'account insegnante cancella tutto", async () => {
    await api("POST", "/api/app", { token: S.a.token, body: { titolo: "Da cancellare", html: "<p>x</p>" } });
    erroreItaliano(await api("DELETE", "/api/io", { token: S.a.token, body: { password: "sbagliata" } }), 403);
    erroreItaliano(await api("DELETE", "/api/io", { token: S.a.token, body: {} }), 403);
    const r = await api("DELETE", "/api/io", { token: S.a.token, body: { password: "nuovissima-1" } });
    assert.equal(r.status, 204);
    erroreItaliano(await api("GET", "/api/io", { token: S.a.token }), 401);
    erroreItaliano(await api("GET", "/api/io", { token: S.bimboToken }), 401);
    erroreItaliano(await api("POST", "/api/accedi", { body: { utente: "anna.rossi@scuola.it", password: "nuovissima-1" } }), 401);
    erroreItaliano(await api("POST", "/api/accedi", { body: { utente: S.alunniClasse2[1].username, password: S.alunniClasse2[1].password } }), 401);

    // same email can register again and starts empty
    const n = await api("POST", "/api/insegnanti", { body: { email: "anna.rossi@scuola.it", nome: "Anna", password: PW_A } });
    assert.equal(n.status, 201);
    const e = (await api("GET", "/api/io/esporta", { token: n.body.token })).body;
    assert.deepEqual([e.classi, e.quiz, e.app, e.risultati], [[], [], [], []]);

    // teacher B is untouched
    const b = await api("GET", "/api/classi", { token: S.b.token });
    assert.deepEqual(b.body.map((c) => c.id), [S.classeB]);
    assert.equal((await api("GET", "/api/io", { token: S.pieroToken })).status, 200);
    assert.equal((await api("GET", `/api/quiz/${S.quizB}`, { token: S.b.token })).status, 200);
  });
});
