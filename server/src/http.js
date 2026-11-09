/*
 * HTTP helpers: JSON responses, Italian errors, size-limited body reading
 * and input validation.
 */

export class Errore extends Error {
  constructor(status, messaggio) {
    super(messaggio);
    this.status = status;
  }
}

export const errore = (status, messaggio) => new Errore(status, messaggio);

export const KB = 1024;
export const MB = 1024 * 1024;

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

export function vuoto(status = 204) {
  return new Response(null, { status });
}

const enc = new TextEncoder();
export const byteLength = (s) => enc.encode(s).length;

/**
 * Reads the request body as JSON with a hard byte limit, checked on
 * Content-Length first and then while streaming (in case the header is
 * missing or wrong). Returns a plain object.
 */
export async function leggiJson(request, max) {
  const troppo = () => errore(413, "I dati inviati sono troppo grandi.");
  const cl = request.headers.get("Content-Length");
  if (cl !== null) {
    const n = Number(cl);
    if (!Number.isFinite(n) || n < 0) throw errore(400, "Richiesta non valida.");
    if (n > max) throw troppo();
  }
  if (!request.body) throw errore(400, "Mancano i dati della richiesta.");
  const reader = request.body.getReader();
  const pezzi = [];
  let totale = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    totale += value.byteLength;
    if (totale > max) {
      try { await reader.cancel(); } catch { /* ignore */ }
      throw troppo();
    }
    pezzi.push(value);
  }
  const bytes = new Uint8Array(totale);
  let pos = 0;
  for (const p of pezzi) { bytes.set(p, pos); pos += p.byteLength; }
  let testo;
  try {
    testo = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw errore(400, "I dati non sono in UTF-8.");
  }
  if (byteLength(testo) > max) throw troppo();
  if (!testo.trim()) throw errore(400, "Mancano i dati della richiesta.");
  let dati;
  try {
    dati = JSON.parse(testo);
  } catch {
    throw errore(400, "I dati inviati non sono JSON valido.");
  }
  if (!dati || typeof dati !== "object" || Array.isArray(dati)) throw errore(400, "I dati devono essere un oggetto JSON.");
  return dati;
}

// eslint-disable-next-line no-control-regex
const CONTROLLO = /[\u0000-\u001f\u007f]/;

/**
 * Validates a single-line string: type, trimmed length (in characters),
 * no control characters. Returns the trimmed string.
 */
export function testo(v, campo, { min = 1, max = 100, multiriga = false } = {}) {
  if (typeof v !== "string") throw errore(400, `Il campo "${campo}" deve essere un testo.`);
  const s = v.trim();
  const n = [...s].length;
  if (n < min) throw errore(400, min === 1 ? `Il campo "${campo}" è vuoto.` : `Il campo "${campo}" deve avere almeno ${min} caratteri.`);
  if (n > max) throw errore(400, `Il campo "${campo}" può avere al massimo ${max} caratteri.`);
  const controllo = multiriga ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : CONTROLLO;
  if (controllo.test(s)) throw errore(400, `Il campo "${campo}" contiene caratteri non validi.`);
  return s;
}

/** A password is NOT trimmed; length 8..200. */
export function password(v, campo = "password") {
  if (typeof v !== "string") throw errore(400, `Il campo "${campo}" deve essere un testo.`);
  if ([...v].length < 8) throw errore(400, "La password deve avere almeno 8 caratteri.");
  if (v.length > 200) throw errore(400, "La password è troppo lunga (massimo 200 caratteri).");
  return v;
}

export function intero(v, campo, min, max) {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) {
    throw errore(400, `Il campo "${campo}" deve essere un numero intero da ${min} a ${max}.`);
  }
  return v;
}

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;
export function email(v) {
  const s = testo(v, "email", { max: 254 }).toLowerCase();
  if (!EMAIL.test(s)) throw errore(400, "L'indirizzo email non è valido.");
  return s;
}
