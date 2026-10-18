# v1.14.0 — cycle 5 + independent-adversarial-audit hardening

Closes the cycle-5 scope and four live-reproduced findings from an independent adversarial audit
(separate child, read-only, evidence-quoted; every fix carries a regression check).

## Changes

- **TS-04 closed — stats follows the popup language switcher.** `stats.js` loads the selected
  locale's catalog via the lint-approved `readAsset` alias (same-package URL) and re-renders;
  "Auto" restores the browser locale; storage.onChanged live-updates an open stats page. Hostile
  locale values are rejected by shape.
- **C5-3 + F5-codex — honest schema handling on import.** `schemaVersion > 2` → "update the
  extension first" notice; present-but-non-numeric → not-a-backup refusal; absent → legacy
  import accepted (no silent key-drop, no silent degradation).
- **F4 — every autonomy switch asks.** The import authority confirm now also covers dry-run OFF
  (live clicking), follow-up ON, mission ON, and clearing an active pause.
- **F1 — postfix standing grants.** `Allow always`/`Approve always` are standing labels: never
  clicked without the explicit YOLO opt-in; with YOLO they're logged with the standing flag.
  (Previously clicked as one-shots with no standing flag — the rail's own comment forbade it.)
- **F2 — real visibility.** Off-canvas (`fixed;left:-9999px`) and near-invisible buttons are never
  clicked; bounds test = document scroll area, so below-the-fold content stays clickable
  (regression caught by e2e and fixed before freeze — LSN-006).
- **F3 — consent-surface parity.** Connector/auth keyword sets widened to the codex.js proven
  lists ("Authorize app", "Bearer key", …); the whole container stays hard-blocked and logged.
- **C5-5** — follow-up state detection throttled to ~3 s while follow-up is off; unchanged when
  on. **C5-1** — `approvalPresent` parity (unsafe-target buttons no longer block sends).
- **Docs**: `AGENTS.md` (project authority), `docs/SGPS_ADOPTION.md` (pinned v1.13.0 + overlays;
  state `IMPLEMENTING` — no self-declared ADOPTED), `docs/GOLIVE_PAID_READINESS.md` (DEC-016
  matrix), `docs/LESSONS.md` (LSN-001..006 with executable guards), plus
  `scripts/cleanup-chrome-scratch.mjs` (battery hygiene).
- i18n: **204 keys × 6 locales** (`importNewer`).

## Evidence on the frozen tree

- Battery (exits without pipes; see `docs/RELEASE_INTEGRITY.md` for the numbers): lint · 
  background-unit · import-security (G14/G15/G16) · yolo-ux-unit · e2e · followup-e2e ·
  mission-e2e · lang-switch-e2e · codex-e2e · bench assert · QA v1.14.0 (8/8).
- Artifact: `build.mjs` 2× byte-identical → `verify-zip.py` → `smoke-zip.mjs` → sidecar sha256.

## Falsification direction (recorded)

- Remove the ALLOW_RE/STANDING_RE split → e2e FORBIDDEN `f1-standing` goes red.
- Restore the old visibility check → `f2-offscreen`/`f2-faint` go red.
- Narrow the connector keyword sets → `f3-*` go red.
- Drop the new confirm flips → import-security G15 goes red.
