# File formats of the original programs

Notes on the data files of Prof. Carmelo Muscolino's programs, so that
anyone with old floppies can still read them. Decoders live in
`strumenti/costruisci_dati.py` (Python) and in the import functions of
`programmi/eg/eg-core.js` and `programmi/em/em-core.js` (browser).

The downloads on his site were RAR self-extracting archives
(`archivio/originali/**.exe`). Unpack them with `unrar x` (7-Zip cannot
read this old RAR version). Do not run them.

## E.G. (Visual Basic for DOS): `NAME.L1` … `NAME.L5`, `NAME.DAT`

- Code page 850, CR LF line endings.
- Every byte is stored as `char − 10`. Decode with `+10`.
- `.L1`: line 1 is the menu title in plain text. Line 2 holds the 4-character
  author password (encoded). The level text follows.
- `.L2`–`.L5`: level text only.
- `.DAT`: line 1 is a header (`L1 L2 L3 L4 L5`). Then come 6 lines of 5 numbers
  (one per level), each followed by a comment:
  seconds between time penalties, points lost over time, points per correct
  answer, points lost per error, points needed to pass the level (0 = the
  previous level is the last), seconds of game.
- Level syntax: `'0` presentation, `'1` question\answer, `'2` progressive
  expressions, `'3` problems (quantity, value), `'4` text completion. A line
  starting with `.` is the instruction; `!` marks the correct choice. See
  the bundled "Demo 1-4" sets.
- `CS.BIN`: author code, each char + 2·i.

## EM (Windows): folder with `NAME.ESE` + `.bmp` + `.wav`

- Windows-1252, CR LF.
- Each line is stored **reversed**. Each byte is then shifted by the repeating
  pattern `+2, −1, +1, −2`. Decode by reversing the line and adding
  `−2, +1, −1, +2` by position.
- Line 1 is the title plus `pass xxx`. Parameter lines `<pl1>…<tv5>` follow:
  points to pass (cumulative), game seconds, points +, points −, time to
  answer, points lost on timeout, ac, order, tv.
- `<lvN>` starts level N. `<con>` is the instruction text. `<ese>` starts an
  exercise. Answer lines: `hint\a\b` typed, `\!x\y` choice, `\"word` select,
  `\|x y w h\…` click zones (the first zone is correct, the others are wrong).

## ProfEdit V1: `.FRA` (not ported)

- Windows-1252. Bytes are shifted alternately −1 and +1 by position. Decoded
  copies are in `archivio/decodificati/profedit-v1/`.

## Delphi programs (Archimede, Talete)

The form layouts, texts and bitmaps were read from the binary `TPF0`
resources inside the executables. That is where the material lists and
densities, the Archimedes portrait and the help texts come from.

## Gorillas (`MSU.EXE`)

His build of Gorillas takes the seconds of play on the command line
(`MSU.EXE 240`) and counts them down while the players aim. The test that
should run once per second (`IF VAL(RIGHT$(TIME$, 2)) <> tmem%`) is compiled
as a floating-point compare that never reports "equal" under DOSBox, so the
counter dropped on every pass of the input loop. `strumenti/patch_gorillas.py`
replaces only that test with an integer check on the BIOS tick counter. The
unmodified file is inside `archivio/originali/em/em.exe`.
