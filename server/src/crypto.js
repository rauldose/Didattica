/*
 * Small crypto helpers on top of WebCrypto (available in Workers).
 * Every secret comes from crypto.getRandomValues.
 */

const enc = new TextEncoder();

/** Workers (workerd) refuses PBKDF2 with more than 100000 iterations. */
export const PBKDF2_MAX = 100000;
export const PBKDF2_MIN = 1000;

export function randomBytes(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/** Uniform integer in [0, max) without modulo bias. */
export function randomInt(max) {
  if (!Number.isInteger(max) || max <= 0 || max > 0x100000000) throw new RangeError("max");
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

export function pick(list) {
  return list[randomInt(list.length)];
}

const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";
/** Random id: prefix + `len` base36 chars (e.g. "q" + 12 chars). */
export function randomId(prefix, len = 12) {
  let s = prefix;
  for (let i = 0; i < len; i++) s += B36[randomInt(36)];
  return s;
}

export function b64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function fromB64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function b64url(bytes) {
  return b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function hex(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
  return s;
}

/** Constant-time comparison of two byte arrays. */
export function timingSafeEqual(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) return false;
  // Lengths are not secret here (always 32-byte digests).
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function sha256Hex(str) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(str))));
}

/** New session token (32 random bytes, base64url) and its SHA-256 (stored). */
export async function nuovoToken() {
  const token = b64url(randomBytes(32));
  return { token, hash: await sha256Hex(token) };
}

export function iterazioni(env) {
  const n = parseInt(env && env.PBKDF2_ITERATIONS, 10);
  if (!Number.isFinite(n)) return PBKDF2_MAX;
  return Math.min(PBKDF2_MAX, Math.max(PBKDF2_MIN, n));
}

async function pbkdf2(password, salt, iter) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256);
  return new Uint8Array(bits);
}

/** Returns "pbkdf2$<iter>$<salt b64>$<hash b64>". */
export async function hashPassword(password, iter) {
  const salt = randomBytes(16);
  const h = await pbkdf2(password, salt, iter);
  return `pbkdf2$${iter}$${b64(salt)}$${b64(h)}`;
}

/** Verifies a password against a stored string; never throws on bad input. */
export async function verifyPassword(password, stored) {
  try {
    const parts = String(stored).split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
    const iter = parseInt(parts[1], 10);
    if (!(iter >= 1 && iter <= PBKDF2_MAX)) return false;
    const salt = fromB64(parts[2]);
    const expected = fromB64(parts[3]);
    const h = await pbkdf2(password, salt, iter);
    return timingSafeEqual(h, expected);
  } catch {
    return false;
  }
}

/** Burns the same CPU as a real check (used when the user does not exist). */
export async function fintaVerifica(password, iter) {
  await pbkdf2(password, new Uint8Array(16), iter);
  return false;
}
