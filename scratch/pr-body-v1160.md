# v1.16.0 — Beauty-blind review pass: first fixes (R1/R4/R5) + instrument K-check

Follow-up cycle on the frozen v1.15.0 baseline. SGPS:Experience (BPXS §18 beauty-blind review,
executed with the vision lane over eight 2×-DPI shots) produced nine findings; this release ships
the three validated fixes and records honest verdicts for the rest.

## Changes

- **R4 — zero KPI cards calm down.** `renderKpis` toggles `.kpi.zero` (value === 0); the card dims
  its icon tint and quiets its number, so the live metric owns the eye.
- **R5 — topic shares are printed.** Topic rows now read `12 80%` — the share is text, not only a
  bar width.
- **R1 — the popup's empty-log line breathes.** `.empty` padding separates it from the sticky
  state band (the reviewed "run-on paragraph" reading).
- **R2/R3 — rejected with evidence** (recorded in `docs/EXPERIENCE_REVIEW_V115.md`): the disabled
  "Send now" carries `disabled` + tooltips on the button and row + an inline hint; the header pill
  is the muse.ai tab-count badge with a full localized `title`/`aria-label`. The reviewer could
  not see tooltips in stills.
- **Deferred with records:** R6 micro-label typography, R7 Safety-link placement, R8 filter↔chart
  linkage.
- **Instrument**: `scripts/qa-experience.mjs` gains **K** (topics print %; zero cards carry the
  calm class) — 20 checks total. `scripts/capture-shots.mjs` seed fixed to the real `byDay`
  shape (plain daily counts; the earlier "empty chart" was a probe-seed bug — disclosed in the
  review doc).

## Evidence on the frozen tree

- Battery (exits without pipes): nine suites + bench + QA v1.14.0 + `qa-experience` (expect all
  exit 0) — numbers in `docs/RELEASE_INTEGRITY.md` (v1.16.0 section).
- Artifact: deterministic build (2× byte-identical) → `verify-zip.py` → `smoke-zip.mjs`.
- Visual re-verification: vision lane on the re-captured `stats-dark.png` confirmed the chart
  renders bars, zero cards are calmer, topic percentages print, no new defects.

## Falsification direction

- Remove the `.kpi.zero` toggle → K goes red. Remove the `%` span → K goes red. Revert `.empty`
  padding → R1's reading returns (visual).
