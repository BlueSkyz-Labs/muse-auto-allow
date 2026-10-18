# v1.15.0 — SGPS:Experience cycle: locale-correct data formats + the shipped experience instrument

Follow-up cycle on the frozen v1.14.0 baseline (SGPS:Experience, machine-checkable class).

## Changes

- **E1 — chart date formats follow the EFFECTIVE locale.** `stats.js` tick formatters
  (`tickDay`/`tickMonth`) now rebuild against the popup's manual language (once it lands) or the
  browser locale otherwise. Previously the text followed the switcher (v1.14.0) but dates kept
  the browser convention — the TS-04 class is now closed for data formats too. Verified live:
  the same chart renders different, Intl-correct labels under `en` vs `vi`/`ja`.
- **`scripts/qa-experience.mjs` — the experience instrument ships with the repo (19 checks)**:
  WCAG contrast both themes on popup + stats (colour-scheme-confirmed before every read),
  `prefers-reduced-motion` honoured, `:focus-visible` coverage with the `.numwrap` wrapper-ring
  pattern understood, `vi` long-string layout, state-as-text (dry-run band / live state line),
  accessibility-tree accessible-NAME coverage for every interactive control, a real keyboard Tab
  traversal via the CDP Input domain (G1: modal focus-trap while onboarding is open; G2: every
  control reachable after), a 200%-zoom proxy at the real popup width, empty-state presence, and
  the locale data-format check above.
- **Probe hygiene (from LSN-007):** every contrast read confirms `matchMedia` for the emulated
  scheme first; selectors read the real DOM ids; modal/exposure preconditions are asserted, not
  assumed — the v1 experience pass had reported three probe-defect failures (all re-derived).

## Evidence on the frozen tree

- Battery (exits without pipes): the nine suites + bench + QA v1.14.0 + `qa-experience` (expect
  all exit 0) — numbers land in `docs/RELEASE_INTEGRITY.md` (v1.15.0 section).
- Artifact: deterministic build (2× byte-identical) → `verify-zip.py` → `smoke-zip.mjs`.

## Falsification direction

- Force `i18nFmt` back to the captured browser locale → the J check (en vs vi tick labels)
  goes red.
- Remove the modal inert/focus handling → G1 (focus-trap) goes red.
- Regress the visibility/contrast tokens → the A/C checks go red.
