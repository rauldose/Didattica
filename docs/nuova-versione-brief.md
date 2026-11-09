# "Impara giocando" — brief for the new mobile version

Repository: /home/user/Didattica (a static site, no build step). The old
faithful remakes of Prof. Carmelo Muscolino's programs live in `programmi/`
and MUST NOT be changed. The new version lives in `nuovo/`.

Goal: a modern, catchy, mobile-first version of his educational programs
for pupils aged 8–13 (3ª primaria → 3ª media), keeping his spirit: levels,
points, immediate feedback, his playful messages ("Bravo!", "Che centro!",
"Lavora!"), and "first you work, then you play" (stars unlock mini-games).

## Hard rules
- Plain HTML + CSS + vanilla JS. No frameworks, no CDN, no build. Must work
  opened from disk (file://) AND served (GitHub Pages). Load data with
  `<script src>` (never fetch local JSON).
- Italian UI, warm and simple language for children; short sentences.
- Mobile first: design at 360–430px wide, portrait; also good on tablet and
  desktop. Touch targets ≥ 56px. No horizontal scroll. Respect
  `prefers-reduced-motion`. Use `inputmode` on inputs; prefer the shared
  on-screen keypad for numbers (no phone keyboard popping up).
- Accessibility: real buttons, aria-labels, aria-live feedback, good contrast.
- Every page: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`,
  `<meta name="theme-color" content="#fff8ec">`, link `../core/stile.css`,
  load `../core/core.js`, call `N.testata({ titolo, indietro, tema })`.
- Only create/edit files inside your own folder (named in your task). Do not
  edit `nuovo/core/*` — if you need something there, write it in your folder
  and mention it in your report.

## Shared core (read both files first)
- `nuovo/core/stile.css`: design tokens and components — `.pagina`,
  `.griglia`, `.scheda` (cards; `.fascia` colour strip, `.emoji`, `.titolo`,
  `.sotto`), `.btn` (+ `.secondario`, `.piccolo`, `.blocco`), `.scelte` /
  `.scelta` (+ `.giusta` `.sbagliata`), `.lavagna` (+ `.grande`),
  `.consegna`, `.risposta` (+ `.vuota`), `.campo`, `.avanzamento`,
  `.punteggio-riga`, `.tastierino`, `.esito`, `.gufo-box`, `.fumetto`,
  `.etichetta`, subject themes `.t-mat .t-ita .t-sci .t-lab .t-gio .t-ins`
  (set `--colore` / `--colore-chiaro`).
- `nuovo/core/core.js` (global `N`): `N.el/$/$$`, `N.parametro`, `N.rand`,
  `N.scegli`, `N.mescola`, `N.numero` (decimal comma), profiles
  (`N.profilo()`, `N.profiloOspite()`, `N.classe()` 0..5, `N.CLASSI`,
  `N.difficolta(classe)` → 1..5), stars (`N.stelle()`, `N.registra`,
  `N.migliore(attivita)`, `N.sbloccato(soglia)`, `N.tempoGioco()`),
  sounds `N.suono.tocco/ok/ko/stella/vittoria/livello`, `N.vibra`,
  `N.giusto(testo?)` / `N.sbagliato(testo?)` (sound + banner), `N.esito`,
  mascot `N.gufo(umore)` (SVG string; umore "", "felice", "pensa") and
  `N.gufoDice(testo, umore)` (node), `N.testata`, `N.dialogo({titolo,
  testo|nodo, pulsanti})` → Promise, `N.tastierino(host, {onTasto, virgola,
  meno, extra})`, `N.coriandoli()`, `N.stelleDa(c,t)`,
  `N.fineRound({attivita, corrette, totali, onAncora, onEsci})` (results
  screen with 0–3 stars, records them).
- Activity ids for stars: `"<modulo>:<id>"`, e.g. `"mat:tabelline"`,
  `"quiz:EG:VERBI:2"`, `"lab:archimede:<missione>"`.

## Difficulty
Read `N.classe()` (0 = 3ª primaria … 5 = 3ª media) and start at
`N.difficolta(classe)`; always let the child change the level (1–5) with big
buttons. A round is ~10 questions; then `N.fineRound`.

## Quiz format (shared by the quiz player and the teachers' editor)
```json
{ "formato": "impara-quiz", "versione": 1, "id": "q...", "titolo": "...",
  "materia": "ita|mat|sci|altro", "autore": "...", "classe": [0, 5],
  "domande": [
    { "tipo": "scelta", "testo": "...", "immagine": "dataURL|url|null", "scelte": ["...", "..."], "giusta": 0 },
    { "tipo": "vero-falso", "testo": "...", "immagine": null, "giusta": true },
    { "tipo": "scrivi", "testo": "...", "immagine": null, "risposte": ["...", "..."], "suggerimento": "" },
    { "tipo": "tocca", "testo": "...", "immagine": "dataURL|url", "zone": [[x, y, w, h], ...], "giusta": 0 }
  ] }
```
(`zone` in pixels of the image's natural size; `giusta` = index of the
correct zone.) Teacher quizzes are stored in localStorage key
`impara.quiz` (array of quiz objects) — read/write with `N.leggi("quiz", [])`
/ `N.scrivi("quiz", list)`. Share links: `nuovo/quiz/gioca.html#q=<data>`
where data = base64url of the deflate-raw-compressed JSON
(`CompressionStream("deflate-raw")`), prefixed with `z`; or `j` + plain
base64url JSON when CompressionStream is unavailable. Answers typed by
children are compared leniently: trim, collapse spaces, case-insensitive,
and `'` after a vowel equals the accented vowel (perche' = perché).

## Testing (required)
Use Playwright (`require('playwright')`, `chromium.launch()` needs no
options; for a phone use `browser.newContext({ ...devices['iPhone 13'] })`
from `require('playwright').devices`). Test from file:// and look at
screenshots (deviceScaleFactor 1) of the main screens on a phone and on a
desktop. No console errors, no horizontal scroll at 360px. Put test scripts
and screenshots in /tmp/claude-0/-home-user-Didattica/d52a3f24-2099-52bb-815a-e773ed8e12d6/scratchpad/nuovo/
(not in the repo). Do not commit or push. Report: files created, what you
tested, screenshot paths, anything you needed from the core.
