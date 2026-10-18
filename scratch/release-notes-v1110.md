## v1.11.0 — cycle 2026-10-18, wave 2

Four upgrades from the audited candidate list, each covered deterministically:

- **Effective-state line (G01)** — one always-visible line inside the log's sticky band: Off /
  **Paused** (one-tap Resume on the line) / Log-only / Live / YOLO, plus watched-surface counts
  ("2 muse.ai tabs open", + chatgpt.com when Codex is on). Lives inside the log's scroll area —
  costs the popup zero height.
- **Standing-grant flag (G11)** — a click that grants lasting authority ("Always allow", … —
  reachable only under the explicit YOLO opt-in) is recorded with a boolean `standing` on the
  log entry (never a new kind); the import sanitizer round-trips it boolean-only.
- **Blocked-entry deep link (G07)** — a chevron on blocked rows opens Safety & Control at the
  Block-keywords group. Deep link only — no suggested-exception nudge.
- **Onboarding clarity (G03)** — step 2 gains three static lines: what would be clicked / what
  the keyword block-list would skip / what stays manual.

**i18n:** 199 keys × 6 locales (parity green). **Caught by in-Chrome QA pre-gates:** the first
G01 build showed "Live" while OFF — fixed to read the canonical toggle state (recorded in the
cycle doc).

### Verification (frozen tree)

lint 0 (27 checks) · background-unit 32/32 · import-security **145/0** · yolo-ux-unit 5/5 ·
e2e 0 · followup 0 · mission 0 · lang-switch **24/24 @ 199 keys × 6** (height baselines held) ·
codex 0 (4 phases) · experience assert **28/0** · CI on this commit: **lint ✅ · e2e ✅**.

### Artifact

`muse-auto-allow-v1.11.0.zip` — **206,845 bytes, 19 entries**,
sha256 `c09819c6e49baa5b7c70d5df0fa819f6d1065f74349b35d6a4785278f469cb0f`
(`verify-zip.py` 19 matched / 0 mismatched; deterministic double-build byte-identical;
`smoke-zip.mjs` 20/20). Sidecar `.sha256` attached. Store captures 1/2/3/5 regenerated at this
tree. Full record: `docs/RELEASE_INTEGRITY.md` (v1.11.0 evidence).

### Honest notes

No independent subagent review of this wave completed (delegation stalls on long tasks — a
600 s child timeout guard is now set); main-session QA + the deterministic suites are the
verification of record. CWS owner items and the Muse-ToS owner decision remain unchanged;
the package has not been uploaded to the Chrome Web Store.
