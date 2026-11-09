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


LEGGIBILI = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 "
                "àèéìòùÀÈÉÌÒÙ.,;:'\"!?()-=+*/\\%°<>[]{}_\t")


def spazzatura(riga):
    """True for a line of scrambled bytes (a leftover password line)."""
    r = riga.strip()
    if len(r) < 10:
        return False
    strani = sum(1 for c in r if c not in LEGGIBILI)
    return strani / len(r) > 0.3


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
            righe = [eg_decode(l) for l in lines]
            # the 1995 files (VERBI) also carry the scrambled password line at
            # the top of every level, not only in .L1: it is not exercise text
            if righe and spazzatura(righe[0]):
                righe = righe[1:]
            levels.append("\n".join(righe).rstrip() + "\n")
        dat = base + ".DAT"
        params = eg_parse_dat(files[dat]) if dat in files else json.loads(json.dumps(EG_DEFAULTS))
        out.append({"id": base, "titolo": title, "parametri": params, "livelli": levels})
    return out


EM_SHIFT = [-2, 1, -1, 2]


def em_decode_line(b):
    b = b[::-1]
    raw = bytes((c + EM_SHIFT[i % 4]) & 255 for i, c in enumerate(b))
    # Some sets were typed in a DOS editor: their accented letters use code
    # page 850 (0x85 à, 0x8A è, 0x97 ù, ...), which in Windows-1252 are
    # punctuation. Bytes 0x80-0x9F are therefore read as code page 850.
    return "".join(bytes([c]).decode("cp850") if 0x80 <= c <= 0x9F else bytes([c]).decode("cp1252") for c in raw)


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



def applica_correzioni(eg, em, path):
    """Apply the reviewed corrections (strumenti/correzioni.json): exact line replacements."""
    if not os.path.exists(path):
        return []
    corr = json.load(open(path, encoding="utf-8"))
    per_id = {e["id"]: e for e in eg}
    per_dir = {e["cartella"]: e for e in em}
    for c in corr:
        tipo, nome = c["set"].split(":", 1)
        if tipo == "EG":
            es, n = per_id[nome], c["livello"] - 1
            righe = es["livelli"][n].split("\n")
        else:
            es = per_dir[nome]
            righe = es["testo"].split("\n")
        trovate = [i for i, r in enumerate(righe) if r.rstrip() == c["prima"].rstrip()]
        if not trovate:
            raise SystemExit("Correzione non applicabile (%s, riga %s): %r" % (c["set"], c.get("riga"), c["prima"]))
        for i in trovate:
            righe[i] = c["dopo"]
        if tipo == "EG":
            es["livelli"][n] = "\n".join(righe)
        else:
            es["testo"] = "\n".join(righe)
    return corr


def scrivi_elenco(corr, path, eg):
    titoli = {e["id"]: e["titolo"] for e in eg}
    out = ["# Correzioni alle esercitazioni originali", "",
           "Il Prof. Muscolino scriveva sul suo sito che gli esercizi di esempio \"possono contenere",
           "degli errori in quanto sono quelli prodotti dai ragazzi\" e chiedeva aiuto per sistemarli.",
           "Queste sono le correzioni applicate alle versioni giocabili (`dati/`). I file originali",
           "restano invariati in `archivio/` e le correzioni sono in `strumenti/correzioni.json`.", ""]
    corrente = None
    for c in corr:
        tipo, nome = c["set"].split(":", 1)
        intest = ("E.G. – %s" % titoli.get(nome, nome)) if tipo == "EG" else ("EM – %s" % nome)
        if c.get("livello"):
            intest += ", livello %d" % c["livello"]
        if intest != corrente:
            out += ["", "## " + intest, ""]
            corrente = intest
        out.append("- `%s` → `%s` — %s" % (c["prima"].strip(), c["dopo"].strip(), c["motivo"]))
    open(path, "w", encoding="utf-8").write("\n".join(out) + "\n")


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
    eg, em = build_eg(src), build_em(src)
    corr = applica_correzioni(eg, em, os.path.join(root, "strumenti/correzioni.json"))
    if corr:
        scrivi_elenco(corr, os.path.join(root, "docs/CORREZIONI.md"), eg)
    write_js(os.path.join(root, "dati/eg/eg-dati.js"), "EG_DATI", eg)
    write_js(os.path.join(root, "dati/em/em-dati.js"), "EM_DATI", em)
    print("correzioni applicate:", len(corr))
    print("ok")


if __name__ == "__main__":
    main()
