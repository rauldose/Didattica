#!/usr/bin/env python3
"""
Costruisce i file dati/*.js a partire dai file originali di Carmelo Muscolino.

Builds the dati/*.js data modules from the original data files.

The original programs were distributed as RAR self-extracting archives
(archivio/originali/**.exe). Extract them first, without running them, e.g.:

    mkdir estratti && cd estratti
    for f in eg/egarc em/em em/opscve simulaz/matrar; do
        mkdir -p $(basename $f) && (cd $(basename $f) && unrar x -y ../../archivio/originali/$f.exe)
    done

then run:

    python3 strumenti/costruisci_dati.py estratti

Each program used its own light obfuscation; the decoders below document
them (see also docs/FORMATI.md):

  * E.G. (.L1-.L5, .DAT, DOS code page 850): every byte stored as (char - 10).
    In .L1 the first line (title) is plain text and the second holds the
    4-character author password, also shifted by -10.
  * EM (.ESE, Windows-1252): every line is stored reversed, then each byte
    shifted by a repeating pattern [+2, -1, +1, -2] (decode: [-2, +1, -1, +2]).
  * ProfEdit v1 (.FRA, Windows-1252): bytes alternately shifted +1 / -1
    (not ported; decoded copies are kept in archivio/decodificati/).
"""
import json
import os
import sys

EG_DEFAULTS = {
    "tp": [10, 10, 7, 7, 7],
    "pt": [5, 5, 5, 5, 5],
    "ok": [60, 60, 60, 60, 60],
    "err": [30, 40, 40, 50, 60],
    "sl": [300, 600, 800, 1000, 1200],
    "tg": [0, 30, 0, 90, 120],
}
EG_KEYS = ["tp", "pt", "ok", "err", "sl", "tg"]


def eg_decode(b):
    return bytes((c + 10) & 255 for c in b).decode("cp850")


def qb_val(tok):
    """QuickBASIC VAL(): leading numeric part, 0 if none."""
    num = ""
    for ch in tok:
        if ch.isdigit() or (ch in "+-." and not num):
            num += ch
        elif ch == "." and "." not in num:
            num += ch
        else:
            break
    try:
        return int(float(num))
    except ValueError:
        return 0


def eg_parse_dat(path):
    lines = open(path, "rb").read().split(b"\r\n")
    params = {}
    for key, raw in zip(EG_KEYS, lines[1:7]):
        toks = eg_decode(raw).split()
        params[key] = [qb_val(t) for t in (toks + ["0"] * 5)[:5]]
    return params


def build_eg(src):
    folder = os.path.join(src, "egarc")
    files = {f.upper(): os.path.join(folder, f) for f in os.listdir(folder)}
    out = []
    for name in sorted(files):
        if not name.endswith(".L1"):
            continue
        base = name[:-3]
        raw = open(files[name], "rb").read().split(b"\r\n")
        title = raw[0].decode("cp850").strip()
        levels = []
        for n in range(1, 6):
            fn = "%s.L%d" % (base, n)
            if fn not in files:
                levels.append(None)
                continue
            lines = open(files[fn], "rb").read().split(b"\r\n")
            if n == 1:
                lines = lines[2:]
            levels.append("\n".join(eg_decode(l) for l in lines).rstrip() + "\n")
        dat = base + ".DAT"
        params = eg_parse_dat(files[dat]) if dat in files else json.loads(json.dumps(EG_DEFAULTS))
        out.append({"id": base, "titolo": title, "parametri": params, "livelli": levels})
    return out


EM_SHIFT = [-2, 1, -1, 2]


def em_decode_line(b):
    b = b[::-1]
    return bytes((c + EM_SHIFT[i % 4]) & 255 for i, c in enumerate(b)).decode("cp1252")


def build_em(src):
    out = []
    for pkg in ["em", "opscve", "matrar/talete"]:
        base = os.path.join(src, pkg)
        dirs = [base] if pkg.endswith("talete") else [os.path.join(base, d) for d in sorted(os.listdir(base))]
        for d in dirs:
            if not os.path.isdir(d):
                continue
            for f in os.listdir(d):
                if f.lower().endswith(".ese"):
                    text = "\n".join(em_decode_line(l) for l in open(os.path.join(d, f), "rb").read().split(b"\r\n"))
                    out.append({"cartella": os.path.basename(d).lower(), "testo": text.rstrip() + "\n"})
    order = ["esempio1", "esempio2", "esempio3", "esempio4", "esempio5", "operaz", "schele", "verbi", "talete"]
    out.sort(key=lambda e: order.index(e["cartella"]) if e["cartella"] in order else 99)
    return out



def write_js(path, var, data):
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("// Generato da strumenti/costruisci_dati.py - dati originali di Carmelo Muscolino\n")
        fh.write("window.%s = %s;\n" % (var, json.dumps(data, ensure_ascii=False, indent=1)))


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    src = sys.argv[1]
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
    write_js(os.path.join(root, "dati/eg/eg-dati.js"), "EG_DATI", build_eg(src))
    write_js(os.path.join(root, "dati/em/em-dati.js"), "EM_DATI", build_em(src))
    print("ok")


if __name__ == "__main__":
    main()
