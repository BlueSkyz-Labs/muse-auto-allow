# Release Integrity — deterministic package, checksum, artifact smoke

Scope: how the Chrome Web Store package is produced, proven identical on rebuild,
checksummed, byte-verified and smoke-tested **as an artifact** (extracted zip loaded
in a real Chrome). Tooling: `scripts/build.mjs`, `scripts/verify-zip.py`,
`scripts/smoke-zip.mjs`. Nothing here signs or uploads anything — the upload path is
`docs/GITHUB_PUBLISH_RUNBOOK.md` + `store/PUBLISH_RUNBOOK.md`.

## Artifacts

| Path | What |
|---|---|
| `dist/muse-auto-allow-v<version>.zip` | store package, `manifest.json` at the zip ROOT, 18 entries |
| `dist/muse-auto-allow-v<version>.zip.sha256` | sibling checksum sidecar (`sha256sum` format: `<hex>  <basename>`) |

`<version>` is always read from `extension/manifest.json` — no script hardcodes it.
`dist/` is gitignored; the zip ships as a GitHub Release asset, never committed.

## Determinism rules (and why)

Defined in `scripts/build.mjs`:

- **Entries sorted byte-wise by path.** Filesystem enumeration order is not stable.
- **One fixed DOS timestamp for every entry**, derived from `SOURCE_DATE_EPOCH`
  (reproducible-builds convention), clamped to the ZIP minimum
  `1980-01-01T00:00:00Z`; that minimum is also the default when the variable is
  unset. File mtimes are deliberately **not** used: a fresh checkout or a different
  machine has different mtimes, a fixed epoch does not. Two builds of the same bytes
  therefore produce the same archive anywhere.
- **Fixed compression rule**: raw deflate level 9, or STORE when deflate is not
  smaller — deterministic for a given input.
- **No extra fields, no comments, fixed version/attribute fields.**

## Exact commands

```bash
# 1. build (writes zip + .sha256 sidecar; prints entry count, sizes, hash)
node scripts/build.mjs

# 2. checksum sidecar, standalone (also proves the sidecar is sha256sum-consumable)
cd dist && sha256sum -c muse-auto-allow-v<version>.zip.sha256 && cd ..

# 3. byte-compare zip vs extension/ on disk (set-equality both directions)
python scripts/verify-zip.py

# 4. artifact smoke: extract the zip, load the EXTRACTED copy in a scratch Chrome
#    (unique user-data-dir, random CDP port), run the core e2e checks against it.
#    Exit 0 only when the artifact passes; prints {artifact, entries, checks, ok}.
node scripts/smoke-zip.mjs

# 5. determinism proof: build twice, hashes must match
node scripts/build.mjs && sha256sum dist/muse-auto-allow-v<version>.zip
node scripts/build.mjs && sha256sum dist/muse-auto-allow-v<version>.zip   # same hex
```

`smoke-zip.mjs` environment knobs: `MAA_CHROME` (Chrome executable),
`MAA_SMOKE_PORT` (fixed CDP port). One declared test-only delta: the **loaded copy**
of the artifact gets `http://127.0.0.1/*` appended to `content_scripts[0].matches`
(the same injection `test/e2e.mjs` performs) so the content script runs on the local
fixture origin — the pristine extraction dir and the shipped manifest stay untouched,
and the artifact's own bytes are what gets loaded everywhere else.

## Freeze procedure (next freeze: v1.7.0)

Run from the repo root during the freeze, tree stable, editing lanes stopped.

1. Confirm the version: `extension/manifest.json` reads `1.7.0` (the freeze owns
   version bumps — no script edits it).
2. Rebuild clean:
   `node scripts/build.mjs`
   Expect: `manifest at root: true`, an entry count equal to the number of files in
   `extension/`, and a fresh `dist/muse-auto-allow-v1.7.0.zip` + `.sha256`.
3. Record the hash: `sha256sum dist/muse-auto-allow-v1.7.0.zip` (must equal the
   sidecar; verify with `sha256sum -c` as above).
4. Determinism proof: build once more; the hash must be **identical**. A differing
   hash means the tree changed between builds — stop and find out what moved.
5. Byte-verify + smoke: `python scripts/verify-zip.py` (18 matched, 0 mismatched)
   then `node scripts/smoke-zip.mjs` — exit 0 and `"ok": true` in the JSON summary.
6. Attach to the GitHub Release: the zip **and** its `.sha256` sidecar, per
   `docs/GITHUB_PUBLISH_RUNBOOK.md` §3 —
   `gh release create "v1.7.0" "dist/muse-auto-allow-v1.7.0.zip#…" "dist/muse-auto-allow-v1.7.0.zip.sha256#checksum" …`
   The attached zip must be the exact bytes that passed steps 2–5; if anything is
   rebuilt after step 5, restart from step 2.

## Recorded evidence (lane run, v1.6.0 tree)

- Double-build: `dee10e83…96c2` both builds, byte-identical (`cmp` clean).
- `SOURCE_DATE_EPOCH=1700000000` double-build: `6857c161…98af6` both builds —
  the fixed-epoch path is deterministic too (the default-epoch artifact above is
  the canonical one).
- `verify-zip.py`: `18 matched, 0 mismatched, 0 disk-only, 0 zip-only` (exit 0).
- `smoke-zip.mjs`: exit 0, `"ok": true`, 20/20 checks true against the extracted
  artifact (sidecar match, CRC extraction, fixture click paths, popup boot, storage
  read-back).
