# Didattica — the educational software of Prof. Carmelo Muscolino

Prof. Carmelo Muscolino taught mathematics and science at the middle school of Gonars, near Palmanova (Udine, Italy). Between 1995 and 2000 he wrote educational programs for his pupils and gave them away on his website. This repository brings them back so they run on today's computers.

**How to use it:** open `index.html` in any modern browser. Nothing needs to be installed, and it works offline. It can also be published as a static site, for example on GitHub Pages.

## Programs

| Program | Original | Remake |
|---|---|---|
| **E.G.** – Esercizi e Giochi | Visual Basic for DOS, source published | Faithful port: menu, 5 exercise types, levels and points, the game as a reward, teacher editor, import of the original `.L1–.L5/.DAT` files |
| **EM** – Esercizi Multimediali | Windows, no source | Rebuilt from his help pages and exercise files: type / choose / select / click on the picture, hints, sounds, teacher editor with a click-zone tool, import of the original `.ESE` folders |
| **Espressioni, Pitagora, Radici, Tabellina** | Visual Basic for DOS, source published | Faithful ports, including the letter-by-letter checking and his messages |
| **Le quattro operazioni** | Visual Basic for DOS, no source | Rebuilt from the program's description; the number ranges are our own |
| **Geometria piana** | Visual Basic for DOS, source published | Faithful port (version 2.3) |
| **Archimede, Talete** | Delphi 1, no source | Rebuilt from the screen layouts and data recovered from the executables |
| **Puzzle** | his two-player game | Faithful port |
| **Duello** | — | A new two-player game that replaces Microsoft's "Gorillas", which his DOS programs launched |
| ProfEdit | VB-DOS / Windows | Not ported; the originals are kept in the archive |

The original data are all included: 16 E.G. exercise sets, 9 EM sets with their pictures and sounds, and the Archimede and Talete material. User-facing text is in Italian, as he wrote it.

## Repository layout

- `index.html`: home page
- `programmi/`: the programs (plain HTML, CSS and JS, no dependencies, no build step)
- `dati/`: the original exercise data, decoded (`.js` so it loads from `file://`), plus images and sounds
- `archivio/originali/`: every recovered file, unchanged (sources, executables, help pages, recovery manifest)
- `archivio/decodificati/`: the original exercise files in readable text
- `strumenti/costruisci_dati.py`: regenerates `dati/` from the original archives
- `docs/FORMATI.md`: how his data files are encoded

## Notes

- Exercise sets that teachers create or import are saved in the browser of that computer. Use "Esporta file" in the editors to keep a copy or share it with another school.
- The password protection of the editors and the time limits of the shareware versions have been removed.
- The original software is © 1995-2000 Prof. Carmelo Muscolino. "Gorillas" (`archivio/originali/matdos/gorillas.txt`) belongs to Microsoft and is kept in the archive only as it was on his site.
