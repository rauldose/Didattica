# La classe online — server

Cloudflare Worker + D1 (SQLite) that implements the API in
[`../docs/classe-api.md`](../docs/classe-api.md). Plain JavaScript, no runtime
dependencies; `wrangler` is the only dev dependency.

```
src/index.js   router, CORS, endpoints
src/auth.js    sessions, rate limiting
src/crypto.js  PBKDF2, tokens, random ids
src/http.js    JSON responses, body size limits, validation
src/parole.js  Italian word lists for pupils' usernames/passwords
schema.sql     database schema (same as migrations/0001_init.sql)
test/          end-to-end test (starts wrangler dev --local)
```

## English

### Run locally
```sh
cd server
npm install
npm run db:local      # create the local database
npm run dev           # http://localhost:8787/api/salute
npm test              # end-to-end test, about 15 s
```
Serve the site on `http://localhost:8000` (e.g. `python3 -m http.server 8000`
from the repository root): that origin is already allowed.

### Deploy
1. Create a free Cloudflare account and log in: `npx wrangler login`.
2. Create the database: `npx wrangler d1 create didattica-classe`.
3. Copy the printed `database_id` into `wrangler.toml` (replace
   `REPLACE_WITH_D1_ID`).
4. Create the tables: `npm run db:remote`
   (`wrangler d1 migrations apply didattica-classe --remote`).
5. Set `ALLOWED_ORIGINS` in `wrangler.toml` to the origin(s) of the site
   (scheme + host, no path, e.g. `https://rauldose.github.io`), comma-separated.
6. `npm run deploy`. The API URL is printed
   (`https://didattica-classe.<account>.workers.dev`); configure it in the site.

### CPU limit and password hashing
Passwords are hashed with PBKDF2-SHA256, `PBKDF2_ITERATIONS` = 100 000 (also
the maximum Workers allows). One hash takes about 16 ms of CPU (measured
locally); the **Workers Free plan allows 10 ms of CPU per request**, so login,
registration and password changes may fail there with "exceeded CPU" errors,
and creating 60 pupils at once needs about 1 s of CPU. Options:
- **Workers Paid** ($5/month): 30 s CPU per request by default. Recommended.
- Lower `PBKDF2_ITERATIONS` (e.g. `"10000"`) in `wrangler.toml`. This works on
  the Free plan but makes each guess 10× cheaper for anyone who steals the
  database: weaker protection of the passwords at rest. Online guessing is
  still limited by the rate limits. Existing hashes keep their own iteration
  count, so the value can be raised later (hashes update when passwords change).

### Privacy (GDPR)
The **school is the data controller**; whoever deploys the Worker acts on its
behalf, and Cloudflare is a processor (its Data Processing Addendum is part
of the Cloudflare terms; check it covers the account). The
school should adapt `nuovo/classe/privacy.html`, inform families, and keep a
record of processing. The API stores only: teacher email/name, pupils' display
names (use a first name or nickname), generated usernames, password hashes and
activity results. Teachers can export (`GET /api/io/esporta`) and delete
everything (`DELETE /api/io`, or per class/pupil).

## Italiano

### Uso in locale
```sh
cd server
npm install
npm run db:local      # crea il database locale
npm run dev           # http://localhost:8787/api/salute
npm test              # test completo, circa 15 s
```

### Pubblicazione
1. Crea un account Cloudflare gratuito ed entra: `npx wrangler login`.
2. Crea il database: `npx wrangler d1 create didattica-classe`.
3. Copia il `database_id` in `wrangler.toml` al posto di `REPLACE_WITH_D1_ID`.
4. Crea le tabelle: `npm run db:remote`.
5. In `wrangler.toml` metti in `ALLOWED_ORIGINS` l'indirizzo del sito
   (es. `https://rauldose.github.io`), separando più indirizzi con virgole.
6. `npm run deploy` e configura nel sito l'indirizzo dell'API stampato.

### Limite di CPU
Con 100 000 iterazioni PBKDF2 ogni password richiede circa 16 ms di CPU, più
dei 10 ms per richiesta del piano **Workers Free**: accesso e registrazione
potrebbero fallire. Soluzioni: piano **Workers Paid** (5 $/mese, consigliato)
oppure abbassare `PBKDF2_ITERATIONS` (es. `"10000"`), sapendo che le password
salvate diventano più facili da indovinare se qualcuno ruba il database.

### Privacy (GDPR)
Il **titolare del trattamento è la scuola**; Cloudflare è responsabile del
trattamento (vale il suo Data Processing Addendum). La scuola adatta
`nuovo/classe/privacy.html` e informa le famiglie. Si salvano solo email e nome
dell'insegnante, nome o soprannome degli alunni, nomi utente generati, password
cifrate e risultati delle attività. L'insegnante può esportare e cancellare
tutto in qualsiasi momento.
