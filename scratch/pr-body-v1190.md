# v1.19.0 — W1 of the approved catalog (S02/S03/S04/S07/S08/S10)

First execute-wave of the Owner-approved 2026-10-19 catalog (`docs/APPROVED_WORK_2026-10-19.md`:
G02, G04, G07, S02, S03, S04, S07, S08, S10). G02/G04/G07 follow in W2–W3.

## Changes

- **S02 — log readability (the substantive one).** Kind chips (All / Allowed / Blocked / Log-only) + a search field + day-group headers (Today / Yesterday / locale-formatted date) above the
  popup log; decrypted entries cached so re-paints are instant; 200 scanned, 50 rendered; no
  layout-height cost. Drag-free, keyboard-visible, reduced-motion-safe.
  **A real defect was caught by the new checks pre-freeze:** the first implementation coerced the
  ISO `at` string with `Number()` → every entry collapsed under one bogus 1970 day header; fixed
  to `new Date(e.at)` with a NaN guard (LSN discipline: assertion before claim).
- **S03 — micro-interactions.** Quiet press feedback on the new chips and compact controls;
  fade-in/count-pop already shipped; reduced-motion verified by the instrument.
- **S04 — typography.** Font stacks gain "Noto Sans" + CJK fallbacks (all six locales on any OS);
  tabular numerals audited across every counter.
- **S07 — onboarding.** Consent step gains a "Learn more — how the rails work" link (repo README,
  new tab, rel=noopener); the demo list existed since v1.11.0.
- **S08 — keyboard (audited, no new code).** Commands `Alt+Shift+P` / `Alt+Shift+F` already ship
  with unit coverage; QA keyboard traversal + focus trap passes.
- **S10 — i18n evidence.** The experience instrument now sweeps **all 6 locales on both surfaces**
  (no horizontal overflow, no clipped control) — 12 checks replacing the partial vi-only check.
- **i18n**: 213 keys × 6. **QA instrument: 34 checks** (was 24).

## Evidence on the frozen tree

Nine suites + bench + QA v1.14.0 + `qa-experience` 34/34, then build → determinism ×2 → sidecar
→ verify-zip 19/0/0/0 → smoke. Numbers: `docs/RELEASE_INTEGRITY.md` (v1.19.0).

## Falsification direction

Revert the `new Date(e.at)` fix → L1 goes red (one bogus header). Remove the chips → L2/L3/L4 red.
Drop the locale sweep → S10's evidence disappears.
