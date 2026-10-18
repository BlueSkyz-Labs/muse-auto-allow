## v1.11.0 — wave 2 of the 2026-10-18 experience cycle

Four user-facing upgrades from the audited candidate list, each with deterministic coverage:

| # | Surface | What it does | Keys |
|---|---|---|---|
| G01 | **Effective-state line** | One always-visible line inside the log's sticky band: Off / **Paused** with a one-tap **Resume** on the line / Log-only / Live / YOLO + watched-surface counts ("2 muse.ai tabs open", + chatgpt.com when Codex is on). Lives INSIDE the log's scroll area — the popup costs zero extra height. | `stateOff`, `stateLive`, `stateYolo` |
| G11 | **Standing-grant boolean** | Both engines flag a standing grant ("Always allow", "don't ask again…" — reachable only under the explicit YOLO opt-in) with `standing: true` on the log entry — never a new kind string. Import sanitizer round-trips it boolean-only. | — |
| G07 | **Blocked-entry deep link** | A chevron on blocked log rows opens Safety & Control at the Block-keywords group, focused. Deep link only — no suggested-exception nudge. | `logOpenRules` |
| G03 | **Onboarding clarity** | Step 2 gains three static lines: what would be clicked / what the keyword block-list would skip / what stays manual (standing grants). | `onbDemoClick/Block/Standing` |

**i18n**: 199 keys × 6 locales (parity + lang-switch green). **Caught by QA pre-gates**: the first G01 build displayed "Live" while OFF (read a storage field the popup never carried) — fixed to read the canonical toggle checkbox; the in-Chrome QA pass is part of the cycle record.

### Verification (exit codes captured on the frozen tree)

lint 0 (27 checks) · background-unit 32/32 · import-security **145/0** (3 new G11 checks) · yolo-ux-unit 5/5 · e2e 0 · followup-e2e 0 · mission-e2e 0 · lang-switch-e2e 24/24 @ 199 keys × 6 (popup height baselines held — the state line is height-neutral by construction) · codex-e2e 0 (4 phases) · experience assert **28/0** (one transient CDP `Target.createTarget` timeout on the loaded machine disclosed; clean re-run recorded).

**Artifact** `dist/muse-auto-allow-v1.11.0.zip` — **206,845 bytes, 19 entries**, sha256 `c09819c6e49baa5b7c70d5df0fa819f6d1065f74349b35d6a4785278f469cb0f`; `verify-zip.py` 19 matched / 0 mismatched; deterministic double-build byte-identical; `smoke-zip.mjs` 20/20 `ok: true`. Store captures 1/2/3/5 regenerated at this tree (1280×800). Full freeze record: `docs/RELEASE_INTEGRITY.md` (v1.11.0 evidence).

### Honest notes
- **No independent subagent review of this wave completed** — the delegation experiment (free `step-5-preview` model) succeeds on micro tasks but stalls on long ones; carry-over work was completed in-session. Verification of record = main-session QA + the deterministic suites above.
- CWS owner items unchanged (publisher name, support email, 2-Step, fee); Muse-ToS owner decision unchanged; package not uploaded to the CWS.
