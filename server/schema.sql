-- Schema D1 della classe online (idempotente).
-- Date: testo ISO 8601 UTC (creato, aggiornato); sessioni.scade e
-- tentativi.quando: millisecondi dall'epoch (interi).
-- D1 applica le chiavi esterne; il Worker cancella comunque i figli
-- esplicitamente prima dei genitori.

CREATE TABLE IF NOT EXISTS insegnanti (
  id      TEXT PRIMARY KEY,
  email   TEXT NOT NULL UNIQUE,
  nome    TEXT NOT NULL,
  pass    TEXT NOT NULL,
  creato  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classi (
  id            TEXT PRIMARY KEY,
  insegnante_id TEXT NOT NULL REFERENCES insegnanti(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  anno          INTEGER NOT NULL CHECK (anno BETWEEN 0 AND 5),
  creato        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS classi_insegnante ON classi(insegnante_id);

CREATE TABLE IF NOT EXISTS alunni (
  id        TEXT PRIMARY KEY,
  classe_id TEXT NOT NULL REFERENCES classi(id) ON DELETE CASCADE,
  username  TEXT NOT NULL UNIQUE,
  nome      TEXT NOT NULL,
  pass      TEXT NOT NULL,
  creato    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS alunni_classe ON alunni(classe_id);

-- utente_id punta a insegnanti o alunni secondo il ruolo: niente FK.
CREATE TABLE IF NOT EXISTS sessioni (
  hash      TEXT PRIMARY KEY,
  ruolo     TEXT NOT NULL CHECK (ruolo IN ('insegnante', 'alunno')),
  utente_id TEXT NOT NULL,
  scade     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessioni_utente ON sessioni(utente_id);
CREATE INDEX IF NOT EXISTS sessioni_scade ON sessioni(scade);

CREATE TABLE IF NOT EXISTS quiz (
  id            TEXT PRIMARY KEY,
  insegnante_id TEXT NOT NULL REFERENCES insegnanti(id) ON DELETE CASCADE,
  titolo        TEXT NOT NULL,
  dati          TEXT NOT NULL,
  aggiornato    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS quiz_insegnante ON quiz(insegnante_id);

CREATE TABLE IF NOT EXISTS app (
  id            TEXT PRIMARY KEY,
  insegnante_id TEXT NOT NULL REFERENCES insegnanti(id) ON DELETE CASCADE,
  titolo        TEXT NOT NULL,
  descrizione   TEXT NOT NULL DEFAULT '',
  html          TEXT NOT NULL,
  aggiornato    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_insegnante ON app(insegnante_id);

-- risorsa_id punta a quiz o app secondo il tipo: niente FK su di essa.
CREATE TABLE IF NOT EXISTS pubblicazioni (
  classe_id  TEXT NOT NULL REFERENCES classi(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL CHECK (tipo IN ('quiz', 'app')),
  risorsa_id TEXT NOT NULL,
  creato     TEXT NOT NULL,
  PRIMARY KEY (classe_id, tipo, risorsa_id)
);
CREATE INDEX IF NOT EXISTS pubblicazioni_risorsa ON pubblicazioni(tipo, risorsa_id);

CREATE TABLE IF NOT EXISTS risultati (
  id        TEXT PRIMARY KEY,
  alunno_id TEXT NOT NULL REFERENCES alunni(id) ON DELETE CASCADE,
  attivita  TEXT NOT NULL,
  stelle    INTEGER NOT NULL CHECK (stelle BETWEEN 0 AND 3),
  corrette  INTEGER,
  totali    INTEGER,
  creato    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS risultati_alunno ON risultati(alunno_id);
CREATE INDEX IF NOT EXISTS risultati_attivita ON risultati(attivita);

CREATE TABLE IF NOT EXISTS tentativi (
  chiave TEXT NOT NULL,
  quando INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tentativi_chiave ON tentativi(chiave, quando);
CREATE INDEX IF NOT EXISTS tentativi_quando ON tentativi(quando);
