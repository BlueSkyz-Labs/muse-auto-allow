# v1.17.0 — Micro-label legibility + chart announcement (R6/R8) + license design (PROPOSED)

Cycle on the frozen v1.16.0 baseline; closes two deferred beauty-blind findings and lands the
paid-tier engineering design with **no paid code shipped**.

## Changes

- **R6 — micro-label legibility.** Uppercase micro labels (`.micro`, `.kpi .l`, `.chart .ccap`,
  `.topics .cap`) move 10.5 → 11 px with slightly tighter tracking (`.08em → .065em`); chart tick
  text 10.5 → 11 px. The calm hierarchy stays; scanning improves.
- **R8 — chart range is announced.** `#ccap` (the caption that already names the visual range)
  is now `aria-live="polite"`, so switching Day/Week/Month/Year announces the new scope to
  assistive tech.
- **License & entitlement design — `docs/LICENSING_DESIGN.md` (PROPOSED).** Offline-verifiable
  ES256 license tokens via WebCrypto (zero dependencies, no network), owner-held signing key
  ceremony, clock-rollback grace, accepted-and-documented key-sharing risk, the SGPS-DEC-2026-040
  mapping for any future online check, a full test plan, and the Owner gates before any
  implementation. **Nothing paid ships; the extension stays network-free.**

## Evidence on the frozen tree

- Battery (exits without pipes): nine suites + bench + QA v1.14.0 + `qa-experience` — expected all
  exit 0; numbers in `docs/RELEASE_INTEGRITY.md` (v1.17.0 section).
- Artifact: deterministic build (2× identical) → `verify-zip.py` → `smoke-zip.mjs`.

## Falsification direction

Revert the caption `aria-live` → R8's announcement disappears (manual AX check); regress a
micro-label to 10.5/chart title to `.08em` → the visual review's R6 reading returns.
