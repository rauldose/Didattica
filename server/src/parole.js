/*
 * Italian word lists for pupils' usernames and passwords.
 *
 * Rules: lowercase a–z only (no accents, no k/j/w/x/y), easy to read aloud
 * and to type for children aged 8–13, no words that are used as insults or
 * have a vulgar double meaning (e.g. no asino, oca, maiale, verme, cuculo,
 * fico, palla), no near-duplicates (no mela/mele).
 *
 * Usernames: animal + adjective + 2 digits, e.g. "gufo-verde-27".
 * All animals are masculine and all adjectives are given in the masculine
 * form, so every combination is grammatical.
 * Passwords: 3 short nouns + 1 digit, e.g. "sole-mare-pane-4".
 * Digits are 2–9 (0 and 1 look like o and l).
 */
import { pick, randomInt } from "./crypto.js";

export const ANIMALI = [
  "gatto", "leone", "delfino", "pinguino", "coala", "panda", "orso", "lupo",
  "gufo", "falco", "cigno", "cavallo", "criceto", "riccio", "castoro", "canguro",
  "cammello", "pavone", "merlo", "passero", "granchio", "polpo", "bruco", "grillo",
  "bisonte", "alce", "cervo", "daino", "tucano", "airone", "gabbiano", "struzzo",
  "elefante", "leopardo", "puma", "lama", "salmone", "geco", "furetto", "lemure",
  "picchio", "usignolo", "fagiano", "ghiro", "tasso", "fenicottero", "scoiattolo", "pettirosso"
];

export const AGGETTIVI = [
  "rosso", "giallo", "verde", "blu", "viola", "rosa", "azzurro", "celeste",
  "dorato", "allegro", "veloce", "felice", "gentile", "curioso", "saggio", "forte",
  "buffo", "calmo", "dolce", "agile", "attento", "sereno", "vivace", "magico",
  "gioioso", "sveglio", "fiero", "leale", "generoso", "paziente", "bravo", "lucente"
];

export const PAROLE = [
  "sole", "mare", "pane", "luna", "neve", "vento", "lago", "monte",
  "prato", "bosco", "fiume", "onda", "isola", "faro", "nave", "treno",
  "bici", "nido", "ponte", "torre", "porta", "casa", "tetto", "sedia",
  "tazza", "forno", "pizza", "burro", "sale", "zucca", "noce", "pera",
  "mela", "uva", "riso", "latte", "miele", "torta", "libro", "penna",
  "carta", "sasso", "foglia", "ramo", "seme", "fiore", "erba", "pino",
  "stella", "cielo", "nuvola", "gelato", "limone", "fragola", "gomma", "matita",
  "zaino", "banco", "orto", "campo", "festa", "gioco", "regalo", "flauto",
  "razzo", "drago", "fata", "mago", "corona", "perla", "sabbia", "barca",
  "vela", "mappa", "tesoro", "chiave", "candela", "cappello", "sciarpa", "guanto",
  "pianeta", "tamburo", "castello", "biscotto", "ciliegia", "arancia", "conchiglia", "lampada",
  "ombrello", "bussola", "aquilone", "tappeto", "girasole", "cometa", "arcobaleno", "pennello"
];

const cifra = () => String(2 + randomInt(8));

export function nuovoUsername() {
  return `${pick(ANIMALI)}-${pick(AGGETTIVI)}-${cifra()}${cifra()}`;
}

export function nuovaPassword() {
  const parole = new Set();
  while (parole.size < 3) parole.add(pick(PAROLE));
  return `${[...parole].join("-")}-${cifra()}`;
}
