# -*- coding: utf-8 -*-
"""Verify dist zip bytes == extension/ on disk for every entry."""
import json, zipfile, pathlib, sys

root = pathlib.Path(__file__).resolve().parent.parent
ext = root / "extension"
version = json.loads((ext / "manifest.json").read_text(encoding="utf-8"))["version"]
zip_path = root / "dist" / f"muse-auto-allow-v{version}.zip"
z = zipfile.ZipFile(zip_path)
zip_norm = set()
ok = bad = 0
for n in z.namelist():
    rel = n.replace(chr(92), "/")
    zip_norm.add(rel)
    p = ext / rel
    if p.exists() and p.read_bytes() == z.read(n):
        ok += 1
    else:
        bad += 1
        print("MISMATCH", n)
disk = sorted(str(p.relative_to(ext)).replace(chr(92), "/") for p in ext.rglob("*") if p.is_file())
missing = [f for f in disk if f not in zip_norm]
extra = [f for f in sorted(zip_norm) if f not in disk]
print(f"{zip_path.name}: {ok} matched, {bad} mismatched, {len(missing)} disk-only, {len(extra)} zip-only")
if missing:
    print("disk-only:", missing)
if extra:
    print("zip-only:", extra)
sys.exit(1 if (bad or missing or extra) else 0)
