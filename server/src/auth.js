/*
 * Sessions (Bearer tokens, stored as SHA-256) and login rate limiting.
 */
import { nuovoToken, sha256Hex } from "./crypto.js";
import { errore } from "./http.js";

const GIORNO = 24 * 60 * 60 * 1000;
export const DURATA = { insegnante: 30 * GIORNO, alunno: 180 * GIORNO };

export const FINESTRA = 15 * 60 * 1000;
export const LIMITE = { utente: 10, ip: 30, registrazione: 20, password: 10 };

const TOKEN = /^Bearer ([A-Za-z0-9_-]{43})$/;

export async function creaSessione(db, ruolo, utenteId) {
  const { token, hash } = await nuovoToken();
  const ora = Date.now();
  await db.batch([
    // opportunistic cleanup of expired sessions and old login attempts
    db.prepare("DELETE FROM sessioni WHERE scade <= ?").bind(ora),
    db.prepare("DELETE FROM tentativi WHERE quando <= ?").bind(ora - FINESTRA),
    db.prepare("INSERT INTO sessioni (hash, ruolo, utente_id, scade) VALUES (?, ?, ?, ?)")
      .bind(hash, ruolo, utenteId, ora + DURATA[ruolo])
  ]);
  return token;
}

/** Profile of a pupil in the shape used by the API. */
export function profiloAlunno(r) {
  return { id: r.id, username: r.username, nome: r.nome, classe: { id: r.classe_id, nome: r.classe_nome, anno: r.classe_anno } };
}

export async function caricaAlunno(db, id) {
  return db.prepare(
    `SELECT a.id, a.username, a.nome, a.pass, c.id AS classe_id, c.nome AS classe_nome, c.anno AS classe_anno,
            c.insegnante_id
       FROM alunni a JOIN classi c ON c.id = a.classe_id WHERE a.id = ?`
  ).bind(id).first();
}

/**
 * Returns { ruolo, utente, hash, pass } for a valid, non-expired token, or
 * throws 401. `utente` is the public profile; `pass` the stored hash (for
 * internal use only, never returned).
 */
export async function sessione(request, env) {
  const m = TOKEN.exec(request.headers.get("Authorization") || "");
  if (!m) throw errore(401, "Devi accedere per usare questa funzione.");
  const hash = await sha256Hex(m[1]);
  const s = await env.DB.prepare("SELECT ruolo, utente_id FROM sessioni WHERE hash = ? AND scade > ?")
    .bind(hash, Date.now()).first();
  if (!s) throw errore(401, "La sessione è scaduta: accedi di nuovo.");
  if (s.ruolo === "insegnante") {
    const u = await env.DB.prepare("SELECT id, email, nome, pass FROM insegnanti WHERE id = ?").bind(s.utente_id).first();
    if (!u) throw errore(401, "La sessione è scaduta: accedi di nuovo.");
    return { ruolo: "insegnante", hash, pass: u.pass, utente: { id: u.id, email: u.email, nome: u.nome } };
  }
  const a = await caricaAlunno(env.DB, s.utente_id);
  if (!a) throw errore(401, "La sessione è scaduta: accedi di nuovo.");
  return { ruolo: "alunno", hash, pass: a.pass, insegnanteId: a.insegnante_id, utente: profiloAlunno(a) };
}

export function soloInsegnante(s) {
  if (s.ruolo !== "insegnante") throw errore(403, "Questa funzione è riservata agli insegnanti.");
}

export function soloAlunno(s) {
  if (s.ruolo !== "alunno") throw errore(403, "Questa funzione è riservata agli alunni.");
}

export function ipDi(request) {
  return (request.headers.get("CF-Connecting-IP") || "sconosciuto").slice(0, 64);
}

/** Number of attempts recorded for `chiave` in the current window. */
export async function contaTentativi(db, chiave) {
  const r = await db.prepare("SELECT COUNT(*) AS n FROM tentativi WHERE chiave = ? AND quando > ?")
    .bind(chiave, Date.now() - FINESTRA).first();
  return r ? r.n : 0;
}

export function registraTentativi(db, chiavi) {
  const ora = Date.now();
  return db.batch(chiavi.map((k) => db.prepare("INSERT INTO tentativi (chiave, quando) VALUES (?, ?)").bind(k, ora)));
}

export const TROPPI = "Troppi tentativi: aspetta 15 minuti e riprova.";
