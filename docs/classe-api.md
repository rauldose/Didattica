# La classe online — API contract

Shared class space for "Impara giocando" (`nuovo/`). The site stays static on
GitHub Pages; this API runs on a **Cloudflare Worker** with a **D1** database
(`server/` in this repository).

## Principles
- **Privacy by design** (pupils are mostly under 14): teachers create pupil
  accounts; pupils have no email, only a generated username + password; a
  display name (first name or nickname) chosen by the teacher; only results
  of activities are stored. Teachers can export and delete everything.
  The school is the data controller; `nuovo/classe/privacy.html` is a
  template notice it adapts.
- **Untrusted mini-apps**: HTML uploaded by teachers is only ever returned as
  data (`application/json` string field, never served as a page by the API)
  and rendered by the client in `<iframe sandbox="allow-scripts">` via
  `srcdoc` (opaque origin: no access to the site's storage or token).
- All JSON, UTF-8. Errors: HTTP status + `{ "errore": "messaggio in italiano" }`.
- Auth: `Authorization: Bearer <token>`. Tokens are random (32 bytes,
  base64url); the server stores only SHA-256(token). Sessions last 30 days
  (teachers) / 180 days (pupils); `POST /api/esci` revokes.
- Passwords: PBKDF2-SHA256, 16-byte random salt, iterations from env
  `PBKDF2_ITERATIONS` (default 100000, which is also the maximum the Workers
  runtime accepts; minimum 1000), stored as
  `pbkdf2$<iter>$<salt b64>$<hash b64>`. Constant-time comparison.
- Login rate limit: max 10 failed attempts per username per 15 minutes and
  30 per IP (`CF-Connecting-IP`) per 15 minutes → 429.
- CORS: allowed origins from env `ALLOWED_ORIGINS` (comma separated, e.g.
  `https://rauldose.github.io,http://localhost:8000`); `OPTIONS` preflight;
  allow headers `Authorization, Content-Type`; methods GET POST PUT DELETE.
- Limits: quiz JSON ≤ 1.9 MB (1 900 000 bytes: a D1 row cannot exceed
  2 000 000 bytes, so "2 MB" cannot be stored); mini-app HTML ≤ 1 MB
  (1 048 576 bytes); ≤ 60 pupils per request. Too large → 413. See
  "Implementation notes" for the other limits.
- IDs: short random base36 strings (`q…`, `a…`, `c…`, `u…`), 10+ chars.

## Data model (D1)
```
insegnanti(id PK, email UNIQUE, nome, pass, creato)
classi(id PK, insegnante_id, nome, anno, creato)               -- anno: 0..5 (N.CLASSI)
alunni(id PK, classe_id, username UNIQUE, nome, pass, creato)
sessioni(hash PK, ruolo 'insegnante'|'alunno', utente_id, scade)
quiz(id PK, insegnante_id, titolo, dati TEXT (impara-quiz JSON), aggiornato)
app(id PK, insegnante_id, titolo, descrizione, html TEXT, aggiornato)
pubblicazioni(classe_id, tipo 'quiz'|'app', risorsa_id, creato, PK(classe_id,tipo,risorsa_id))
risultati(id PK, alunno_id, attivita, stelle, corrette, totali, creato) -- index (alunno_id), (attivita)
tentativi(chiave, quando)                                       -- rate limiting
```
Deleting a class deletes its pupils, their sessions and results; deleting a
teacher deletes everything they own.

## Endpoints

### Accounts
| Method & path | Who | Body → Response |
|---|---|---|
| `POST /api/insegnanti` | anyone | `{email, nome, password (≥8)}` → `201 {token, ruolo:"insegnante", utente:{id,email,nome}}`; 409 if email exists |
| `POST /api/accedi` | anyone | `{utente: email-or-username, password}` → `{token, ruolo, utente}`; for a pupil `utente` = `{id, username, nome, classe:{id,nome,anno}}` |
| `POST /api/esci` | logged | → `204` |
| `GET /api/io` | logged | → `{ruolo, utente}` |
| `PUT /api/io/password` | logged | `{vecchia, nuova}` → `204` |
| `DELETE /api/io` | teacher | `{password}` → `204` (deletes account and all data) |
| `GET /api/io/esporta` | teacher | → JSON with all their data (classes, pupils without password hashes, quizzes, apps, results) |

### Classes and pupils (teacher, own resources only; 404 otherwise)
| Method & path | Body → Response |
|---|---|
| `GET /api/classi` | → `[{id, nome, anno, alunni: n, creato}]` |
| `POST /api/classi` | `{nome, anno}` → `201 {id, nome, anno}` |
| `PUT /api/classi/:id` | `{nome?, anno?}` → `{id, nome, anno}` |
| `DELETE /api/classi/:id` | → `204` |
| `GET /api/classi/:id` | → `{id, nome, anno, alunni:[{id, username, nome, stelle, attivita, ultimo}], pubblicati:[{tipo, id, titolo}]}` |
| `POST /api/classi/:id/alunni` | `{nomi: ["Anna", "Luca", …]}` → `201 [{id, nome, username, password}]` — the ONLY time passwords are returned in clear. Usernames: two easy Italian words + 2 digits, lowercase, e.g. `volpe-blu-27`; passwords: 3 short words + digit, e.g. `sole-mare-pane-4` |
| `PUT /api/alunni/:id` | `{nome}` → `{id, nome, username}` |
| `POST /api/alunni/:id/password` | → `{username, password}` (new generated password; revokes the pupil's sessions) |
| `DELETE /api/alunni/:id` | → `204` |
| `GET /api/classi/:id/risultati` | → `[{alunno_id, nome, username, attivita, stelle, corrette, totali, creato}]` (newest first, max 5000) |

### Quizzes and mini-apps (teacher owns; pupils read when published to their class)
| Method & path | Who | Body → Response |
|---|---|---|
| `GET /api/quiz` | teacher | → `[{id, titolo, aggiornato, classi:[classe_id]}]` |
| `POST /api/quiz` | teacher | `{dati: <impara-quiz object>}` → `201 {id}` (server sets `dati.id = id`) |
| `PUT /api/quiz/:id` | teacher | `{dati}` → `{id}` |
| `DELETE /api/quiz/:id` | teacher | → `204` (also unpublishes) |
| `GET /api/quiz/:id` | owner teacher, or pupil whose class has it published | → `{id, titolo, dati}` |
| `GET /api/app` | teacher | → `[{id, titolo, descrizione, dimensione, aggiornato, classi:[…]}]` |
| `POST /api/app` | teacher | `{titolo, descrizione, html}` → `201 {id}` |
| `PUT /api/app/:id` | teacher | `{titolo?, descrizione?, html?}` → `{id}` |
| `DELETE /api/app/:id` | teacher | → `204` |
| `GET /api/app/:id` | owner, or pupil whose class has it published | → `{id, titolo, descrizione, html}` |
| `POST /api/classi/:id/pubblica` | teacher | `{tipo:"quiz"|"app", id}` → `204` |
| `DELETE /api/classi/:id/pubblica/:tipo/:rid` | teacher | → `204` |

### Pupil
| Method & path | Body → Response |
|---|---|
| `GET /api/classe` | → `{classe:{id,nome,anno}, insegnante:{nome}, quiz:[{id,titolo,materia,domande:n}], app:[{id,titolo,descrizione}]}` |
| `POST /api/risultati` | `{attivita (≤120 chars), stelle 0..3, corrette?, totali?}` → `201` |
| `GET /api/io/risultati` | → `[{attivita, stelle, corrette, totali, creato}]` |

### Health
`GET /api/salute` → `{ok:true, versione}`.

## Implementation notes (server/)
Clarifications of points the tables above leave open:
- **Dates** (`creato`, `aggiornato`, `ultimo`) are ISO 8601 UTC strings,
  e.g. `2026-11-09T10:15:00.000Z`.
- **Status codes**: 400 invalid input (Italian message names the field);
  401 missing/invalid/expired token or wrong login (always the same message,
  whether or not the user exists); 403 wrong role (pupil on a teacher
  endpoint or vice versa), wrong current password in `PUT /api/io/password`
  / `DELETE /api/io`, or request from an `Origin` not in `ALLOWED_ORIGINS`;
  404 unknown path or resource not owned / not published to the pupil's
  class; 405 known path, wrong method; 409 email already registered;
  413 body or field too large, or storage quota exceeded; 429 rate limit.
  Requests without an `Origin` header (curl, server-to-server) are allowed.
- `POST /api/risultati` → `201 {ok:true}`.
- `PUT /api/io/password` keeps the current session and revokes all the
  user's other sessions.
- `GET /api/classi/:id`: `alunni[].stelle` = total stars of all results,
  `attivita` = number of results, `ultimo` = date of the newest result or
  `null`. Pupils sorted by name.
- `GET /api/classe`: `materia` is `dati.materia` (`"altro"` if missing),
  `domande` = `dati.domande.length`. Newest publications first.
- `POST /api/quiz` / `PUT`: `dati` must be an object with a `domande` array;
  `titolo` is taken from `dati.titolo` (≤ 200 chars, default
  `"Quiz senza titolo"`).
- `POST /api/app`: `titolo` 1–100 chars, `descrizione` optional ≤ 500,
  `html` non-empty string. `dimensione` in `GET /api/app` = HTML size in bytes.
- `POST /api/classi/:id/pubblica` is idempotent; `DELETE …/pubblica/…` too.
- Text fields are trimmed; names: teacher ≤ 80, class ≤ 60, pupil ≤ 40,
  `attivita` ≤ 120 chars; control characters are refused. `anno`, `stelle`,
  `corrette`, `totali` must be JSON integers (`corrette ≤ totali`).
- Extra limits (abuse protection): 100 classes per teacher, 100 pupils per
  class, 100 MB of quizzes + mini-apps per teacher (413), newest 20 000
  results kept per pupil, 20 registrations per IP per 15 min, 10 wrong
  current-password checks per user per 15 min (429). Non-quiz/app request
  bodies ≤ 64 KB.
- IDs: `u…` for both teachers and pupils (12 random base36 chars after the
  prefix). Usernames: masculine animal + adjective + two digits 2–9
  (`gufo-verde-27`); passwords: three nouns + one digit 2–9.
- `GET /api/io/esporta` → `{formato:"impara-classe-esportazione", versione:1,
  esportato, insegnante:{id,email,nome,creato}, classi:[{id,nome,anno,creato,
  alunni:[{id,username,nome,creato}], pubblicati:[{tipo,id,creato}]}],
  quiz:[{id,titolo,dati,aggiornato}], app:[{id,titolo,descrizione,html,aggiornato}],
  risultati:[{alunno_id,classe_id,attivita,stelle,corrette,totali,creato}]}`.
- Every response has `Cache-Control: no-store`, `X-Content-Type-Options:
  nosniff`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`.

## Mini-app runtime (client side)
`nuovo/classe/app.html?id=<id>` fetches the app and renders it in
`<iframe sandbox="allow-scripts" srcdoc="…">` with a CSP meta injected at the
top of the document (`default-src 'none'; img-src data: blob:; media-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:`)
so it cannot load or send anything over the network. The app talks to the
page only with `parent.postMessage`:
- `{ impara: "risultato", stelle: 0..3, corrette, totali }` → saved with
  `POST /api/risultati` (`attivita: "app:<id>"`) and shown with the stars screen;
- `{ impara: "fine" }` → back to the class page.
A teacher-facing "Come si scrive un mini-gioco" page documents this with a
template.
