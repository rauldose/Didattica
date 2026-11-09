#!/usr/bin/env python3
"""
Correzione del contatore "SECONDI" del Gorillas di Prof. Muscolino (MSU.EXE).

Fixes the play-time counter of Prof. Muscolino's build of Gorillas.

In FUNCTION GetNum# (see archivio/originali/matdos/gorillas.txt) he added:

    IF VAL(RIGHT$(TIME$, 2)) <> tmem% THEN
      tmem% = VAL(RIGHT$(TIME$, 2))
      sec% = sec% - 1
      LOCATE 24, 33: PRINT "SECONDI = "; : PRINT sec%
    END IF

The comparison is compiled as a floating-point compare (QuickBASIC 8087
emulator interrupts). In the DOSBox emulator it never reports "equal", so
sec% dropped on every pass of the input loop instead of once per second:
pupils lost their earned play time in a few seconds.

This patch replaces only that IF test (image offsets 0x293A-0x2982) with an
integer test on the BIOS tick counter (0040:006C, 18.2 ticks per second),
using tmem% to remember the tick count of the last decrement:

    push ds / xor ax,ax / mov ds,ax / mov ax,[046Ch] / pop ds
    mov dx,ax / sub dx,[tmem%] / cmp dx,18 / jb skip
    mov [tmem%],ax / jmp <sec% = sec% - 1 ...>
    skip: jmp <END IF>

The new instructions avoid the 2-byte segment slots of the far calls that
were in the block, because the VB-DOS runtime patches those slots at load
time. The rest of the program is unchanged.

Usage: python3 strumenti/patch_gorillas.py ORIGINAL_MSU.EXE PATCHED_MSU.EXE
The original file is in archivio/originali/em/em.exe (RAR self-extractor).
"""
import hashlib
import struct
import sys

ORIGINAL_SHA256 = None  # printed for reference when run

A, END = 0x293A, 0x2983          # image offsets of the replaced block
DEC_SEC, END_IF = 0x2983, 0x29B2  # "dec word [sec%]" and the END IF target
TMEM, SEC = 0x0128, 0x0126        # DGROUP offsets of tmem% and sec%


def patch(data):
    data = bytearray(data)
    hdr = 16 * struct.unpack_from("<H", data, 8)[0]       # header size
    nrel, reltab = struct.unpack_from("<H", data, 6)[0], struct.unpack_from("<H", data, 0x18)[0]
    img = lambda off: hdr + off

    # sanity checks: the bytes we expect around the block
    assert data[img(DEC_SEC):img(DEC_SEC) + 4] == bytes([0xFF, 0x0E]) + struct.pack("<H", SEC), "unexpected file"
    assert data[img(A) + 1:img(A) + 5] == bytes([0x3B, 0x06]) + struct.pack("<H", TMEM), "unexpected file"

    # The VB-DOS runtime writes segment values into the far-call slots at
    # load time (the EXE has no MZ relocations), so the new code must not
    # use those 2-byte slots: it hops over them with short jumps.
    orig = bytes(data[img(A):img(END)])
    code = bytearray([0x90]) * (END - A)
    for slot in (0x2942, 0x294C, 0x2952, 0x295E, 0x2965, 0x296F, 0x2975):
        code[slot - A:slot - A + 2] = orig[slot - A:slot - A + 2]

    def put(addr, b):
        code[addr - A:addr - A + len(b)] = b

    def rel8(frm, to):
        return struct.pack("<b", to - frm)

    def rel16(frm, to):
        return struct.pack("<h", to - frm)

    put(0x293A, bytes([0x1E, 0x31, 0xC0, 0x8E, 0xD8]))             # push ds; xor ax,ax; mov ds,ax
    put(0x293F, b"\xEB" + rel8(0x2941, 0x2944))                    # jmp short
    put(0x2944, bytes([0xA1, 0x6C, 0x04, 0x1F, 0x89, 0xC2]))       # mov ax,[046Ch]; pop ds; mov dx,ax
    put(0x294A, b"\xEB" + rel8(0x294C, 0x2954))                    # jmp short
    put(0x2954, bytes([0x2B, 0x16]) + struct.pack("<H", TMEM))     # sub dx,[tmem%]
    put(0x2958, bytes([0x83, 0xFA, 0x12]))                         # cmp dx,18
    put(0x295B, b"\xEB" + rel8(0x295D, 0x2960))                    # jmp short
    put(0x2960, b"\x72" + rel8(0x2962, 0x2977))                    # jb skip
    put(0x2962, b"\xEB" + rel8(0x2964, 0x2967))                    # jmp short
    put(0x2967, b"\xA3" + struct.pack("<H", TMEM))                 # mov [tmem%],ax
    put(0x296A, b"\xE9" + rel16(0x296D, DEC_SEC))                  # jmp sec% = sec% - 1
    put(0x2977, b"\xE9" + rel16(0x297A, END_IF))                   # skip: jmp END IF
    data[img(A):img(END)] = code

    # drop relocations that point inside the replaced block
    rels = [struct.unpack_from("<HH", data, reltab + 4 * i) for i in range(nrel)]
    keep = [r for r in rels if not (A <= r[1] * 16 + r[0] < END)]
    for i, (o, s) in enumerate(keep):
        struct.pack_into("<HH", data, reltab + 4 * i, o, s)
    for i in range(len(keep), nrel):
        struct.pack_into("<HH", data, reltab + 4 * i, 0, 0)
    struct.pack_into("<H", data, 6, len(keep))
    return bytes(data), nrel - len(keep)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    src = open(sys.argv[1], "rb").read()
    out, tolte = patch(src)
    open(sys.argv[2], "wb").write(out)
    print("original sha256", hashlib.sha256(src).hexdigest())
    print("patched  sha256", hashlib.sha256(out).hexdigest())
    print("relocations removed:", tolte)
