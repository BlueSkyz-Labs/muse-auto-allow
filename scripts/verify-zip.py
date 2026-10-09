# -*- coding: utf-8 -*-
"""Verify dist zip bytes == extension/ on disk for every entry."""
import zipfile, pathlib, sys

z = zipfile.ZipFile("dist/muse-auto-allow-v1.3.0.zip")
ext = pathlib.Path("extension")
ok = bad = 0
for n in z.namelist():
    rel = n.replace(chr(92), "/")
    p = ext / rel
    if p.exists() and p.read_bytes() == z.read(n):
        ok += 1
    else:
        bad += 1
        print("MISMATCH", n)
print(f"{ok} matched, {bad} mismatched")
sys.exit(1 if bad else 0)
