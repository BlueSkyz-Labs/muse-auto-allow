# AGENTS.md — Muse Auto-Allow (project authority)

**Owner:** BlueSkyz Labs. **Auto-approve companion** for Muse (muse.ai) and ChatGPT Codex
(chatgpt.com) approval surfaces — Chrome MV3, zero runtime dependencies, sturmfrei of any
remote code. **Standing order:** actionable work runs end-to-end autonomously through the
autonomous-delivery-harness loop (REBIND → AUDIT → VERIFY → PLAN → DO → CHECK → RELEASE →
DELTA_DISCOVERY) with safe self-merges on exact-head verification; only the Owner gates in §5
stay manual.

## 1. Immutable invariants (never weaken — any change here is Owner-only)

- **Safety rails:** never click deny/negative labels; never click a lone affirmative (a negative
  must exist in the same button container); standing grants ("Always allow" / "Allow always" /
  "Allow for this site|task") stay manual unless the explicit YOLO opt-in is on; auth / connector
  / consent surfaces are hard-blocked (keyword sets mirror the proven codex.js parity lists).
- **Visibility:** a clickable element must have real geometry, real opacity and pass ancestor
  visibility (`checkVisibility`) — parked off-canvas (`left:-9999px`) or near-invisible buttons
  are never clicked. Below-the-fold content stays clickable (bounds test = document scroll area).
- **Permissions:** `storage`, `alarms`, `notifications` only. Host pins: `muse.ai` +
  `chatgpt.com` (plus localhost, test-harness copy only). No `tabs`/`scripting`/`webRequest`/
  `cookies`/`<all_urls>`.
- **No remote code:** network primitives only via the lint-approved `readAsset` alias with
  same-package `chrome.runtime.getURL` URLs. No eval / new Function / remote imports.
- **Fail-closed defaults:** fresh installs start in logging-only mode (`dryRun`); authority
  switches (YOLO, Codex, live clicking, follow-up, mission, clearing a pause) apply from a
  backup ONLY behind an explicit confirm; newer/garbage-schema backups are refused.

## 2. Governance binding (SGPS)

- Adoption record: `docs/SGPS_ADOPTION.md`. Pinned SGPS release **v1.13.0** (last immutable tag)
  + the explicit overlay list recorded there. `SGPS:FULL` / `SGPS:Experience` mean: reference
  `C:\Users\thinh\dev\sgps-core` per its `AGENTS.md` read-order. **Never** upgrade the pin, never
  self-declare central `ADOPTED`, never enable Paid GO without an Owner decision.
- Orchestration driver: the **SGPS 7-task prompt kit v1.5 (independent prompts, 2026-10-19)**
  (`C:\00_AI_PRJ\00_PROMPT\SGPS_7_TASK_PROMPTS_INDEPENDENT_v1.5_FULL\`, provenance verified 8/8,
  zip ↔ folder byte-identical) — **pick ONE prompt per task** (01 discovery · 02 UX · 03 security ·
  04 paid · 05 security+paid · 06 release · 07 continue approved); routing + hashes in
  `docs/SGPS_PROMPT_KIT.md`. Historical vNext 1.3.1 package is superseded (kept for traceability).
- Delivery harness + model lanes: skill `autonomous-delivery-harness` (free-tier subagents by
  default; Codex lane `gpt-6-luna` for heavy tasks with the quota probe; vision = `mimo-v2.6-pro`).

## 3. Repo map

| Path | What |
|---|---|
| `extension/` | the shipped MV3 extension (content.js, codex.js, background.js, popup.*, stats.*, _locales/*) |
| `test/` | the suites: `e2e`, `followup-e2e`, `mission-e2e`, `lang-switch-e2e`, `codex-e2e` (scratch Chrome), `background-unit`, `yolo-ux-unit`, `import-security` (node) |
| `scripts/` | `lint.mjs` (27 static checks), `build.mjs` (deterministic zip), `verify-zip.py`, `smoke-zip.mjs`, `cleanup-chrome-scratch.mjs`, `bench/` |
| `docs/` | authority + evidence docs: `RELEASE_INTEGRITY.md` (the freeze ledger), `SGPS_ADOPTION.md`, `GOLIVE_PAID_READINESS.md`, `LESSONS.md`, runbooks |
| `scratch/` | working notes (tracked); never the shipped artifact |

## 4. Verified release pipeline (the only acceptable evidence path)

1. Full battery on the exact tree: `lint` → `background-unit` → `import-security` →
   `yolo-ux-unit` → `e2e` → `followup-e2e` → `mission-e2e` → `lang-switch-e2e` → `codex-e2e` →
   `bench/experience --only=assert`; capture exit codes **without pipes**.
2. Artifact freeze: `build.mjs` → determinism (two builds byte-identical) → `verify-zip.py` →
   `smoke-zip.mjs` → sidecar `sha256`.
3. Record every number in `docs/RELEASE_INTEGRITY.md` (freeze ledger; both runs on flakes).
4. Commit → PR → CI watch (`gh run watch`) → merge on the exact verified head → tag + GitHub
   release (zip + `.sha256` sidecar) → issue comment.
5. **Always run `node scripts/cleanup-chrome-scratch.mjs` after any Chrome-spawning battery**
   (kills only `maa-*` scratch profiles; the owner's own browser is never touched).

## 5. Owner-only gates

CWS publishing actions · pricing/money/provider accounts · signing keys · Paid GO switch ·
brand/identity changes · anything touching real money or user payment data · SGPS central
registration of this project's adoption record.
