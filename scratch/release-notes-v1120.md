## v1.12.0 — cycle 3 (AUDIT → PLAN → DO → CHECK)

The audit found; the code confirmed; four fixes shipped — every candidate claim was re-verified against the cited code before any change (3 confirmed fixes, 1 by-design recorded, 1 rejected with reason).

**C3-1 — restore keeps your authority opt-ins, and never grants one silently.** `yoloMode` / `codexEnabled` now round-trip through export/import (they were silently dropped). If an imported file would **turn one ON from off**, the import asks first ("This backup turns on: YOLO — continue?") — a crafted file can never enable authority silently; turning one off (or junk values) stays fail-closed with no prompt. Blocked log entries keep their `blockedReason` across a restore. `import-security` 145 → **150 checks** (G12).

**C3-2 — off outranks paused.** With the toggle off during a live pause the state line read "Paused until …" (hidden Resume) while the pause row still showed one — two readouts disagreeing. Precedence: dry > off > paused > YOLO > live.

**C3-3 — reason-aware blocked deep link.** The chevron on blocked rows now opens the rules that can resolve the block: `keyword:<kw>` → keyword list, `topic` → allowed-topics list. `connector` (hard consent boundary) and reason-less rows get **no chevron**.

**C3-4 — standing-grant mark.** A log entry that granted lasting authority carries a quiet aria-labelled lock — "what permanent access did this tool grant?" is answerable from the popup.

**i18n:** 202 keys × 6 locales. Caught by in-Chrome QA pre-gates: the authority dialog first showed an empty `$1` (stats helper `tp()` vs `t()`) — fixed.

### Verification (frozen tree)

lint 0 (27) · background-unit 32/32 · import-security **150/0** · yolo-ux-unit 5/5 · e2e 0 · followup 0 · mission 0 · lang-switch **24/24 @ 202 keys × 6** · codex 0 (4 phases) · assert **28/0** · CI on this commit: **lint ✅ · e2e ✅**. Red-team: bounded subagent review — 4/4 PASS (disclosed harness incident: its final summary line was lost to an empty `output_schema`; findings recovered from the transcript + re-verified in-session).

### Artifact

`muse-auto-allow-v1.12.0.zip` — **208,315 bytes, 19 entries**, sha256 `d46006bfbbb4e288d9ac0a1ade27b50b6c3116119ad350fa12d70432733c10bb`; verify-zip 19/0/0/0; deterministic double-build byte-identical; smoke 20/20 `ok: true`; sidecar attached. Store captures regenerated at this tree. Full record: `docs/RELEASE_INTEGRITY.md` (v1.12.0 evidence).

### Honest notes

CWS owner items and the Muse-ToS owner decision unchanged; the package has not been uploaded to the Chrome Web Store.
