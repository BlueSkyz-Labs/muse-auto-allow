# Global-Elite Benchmark Report — Muse Auto-Allow

Status: **IN PROGRESS** — baseline measured for the package (speed axis) and the design axis;
runtime latency/memory and the experience axis are still PENDING. Charter:
`docs/GLOBAL_ELITE_BENCHMARK_ROUND.md`. Rule of this report: **every number is measured by a
command in this repo and pasted with it**; a value that has not been measured says PENDING, it
is never estimated.

Live truth at first measurement: `HEAD ee3e1bb` · `OBSERVED_AT 2026-10-10` · branch `main`
(a HEAD change invalidates the measurements below; re-measure, do not reuse).

## Axis 1 — Speed (tốc độ)

### 1.1 Package size (measured)

`wc -c extension/*.js extension/*.html extension/*.json extension/_locales/*/messages.json`
and `du -sb extension`:

| Artifact | Bytes | Lines |
|---|---|---|
| `extension/content.js` (injected into every muse.ai frame) | 73,702 | 1,334 |
| `extension/popup.js` | 63,009 | 1,272 |
| `extension/popup.html` | 47,092 | — |
| `extension/background.js` (service worker) | 13,685 | 288 |
| `extension/stats.js` | 17,319 | 323 |
| `extension/stats.html` | 15,053 | — |
| `extension/manifest.json` | 1,309 | — |
| `_locales/*/messages.json` (6 files) | 9,941–11,742 each (~64 KB total) | — |
| **`extension/` total** | **369,197** | **18 files** |

Reference point: the last shipped package `dist/muse-auto-allow-v1.7.0.zip` = **130,028 bytes**
(v1.6.0 122,694 · v1.5.0 99,029).

**The dominant lever is the popup payload: 47,092 + 63,009 = ~110 KB parsed and executed on
every popup open.** `content.js` at 73,702 bytes is the second lever (it is parsed in every
muse.ai frame on every load).

### 1.2 Runtime (PENDING — harness not built yet)

| Metric | Status |
|---|---|
| Popup open → painted (cold/warm, median+p95, N=20) | PENDING |
| Content-script scan cost per sweep (heavy synthetic DOM, median+p95) | PENDING |
| Detect → click latency on an approval card | PENDING |
| Service-worker wake cost (cold-start ms) | PENDING |
| Storage write amplification (writes per click / per follow-up) | PENDING |
| Memory footprint (idle / during sweeps) | PENDING |
| Popup layout stability (no shift) | covered indirectly: popup <=600 px asserted in every state by `test/followup-e2e.mjs` + `test/lang-switch-e2e.mjs` |

Targets for this axis are also PENDING: they must be sourced (published extension/perf budgets)
before they can be called targets — see the charter's "benchmarks are measured, not asserted".

## Axis 2 — Design (UI)

**Method note (2026-10-10, after the composition iteration):** the vision instrument was
measured to be UNRELIABLE as an absolute scale — see the charter's "Instrument calibration"
section. Scores below are DIRECTIONAL, always anchored in the same session, and no longer gate
the round. Design acceptance is deterministic (grid, contrast, spacing ladder, artifacts, i18n,
heights, suites).

| Surface | Directional score (premium / craft) | Notes |
|---|---|---|
| Popup, light — shipped pre-Quiet-Luxury (anchor) | 6 / 7 | the calibration anchor |
| Popup — after the token re-skin (91f4c14) | 4–7 / 4–6; coordinator pass 6 / 5 | tokens fine, composition was the gap |
| Popup — after the composition pass (555f9f0) | 3–7 across passes (instrument noise) | craft axis moved: light CRAFT 8/10 in 2 of the iteration rounds vs 4/10 for the token-only state; the remaining reviewer complaints are frozen-intent items (pill language, no per-bar values, uppercase captions) and density/progressive-disclosure opinions |
| Phase-1 mockup (anchor) | 5–8.5 depending on the session | the anchor itself moves with the instrument |
| Statistics, light / dark | 5–9 depending on the session | 9/10 in its own round, 5/10 in the iteration session |

Deterministic results of the composition pass (all measured): one content column [14,306] with
every right edge on it; type tiers separated (title 15/600, section titles 11/600 uppercase
--ink-2 at 10.34:1/11.25:1); colour roles split (state carried by dots/tags, not whole-pill
tints); action hierarchy corrected ('Send now' primary graphite/ivory 17.74:1/14.86:1, footer
Statistics ghost); browser artifacts gone (resize:none, one inline-SVG chevron, 5px scrollbar);
chart given a dashed y-max gridline + tick + today legend at ZERO extra height; header no longer
renders a truncated sentence (locale-stable count badge, full text in title/aria); net height
SHORTER (follow-up-ON empty 590 → 571) with crowded states at the 600 cap.

Measured contrast (rendered output, pixel-verified): mini-chart day bars **1.88 → 3.32:1** light
and **2.06 → 4.52:1** dark; dark toggle ON-vs-OFF track **1.85 → 4.83:1**; all text pairs
>=4.5:1 (light 16.86…5.22:1, dark 15.44…5.61:1); one documented decorative exception: the new
--grid hairline 1.59:1 light / 3.47:1 dark (same class as the spec's existing --axis/--divide,
value carried by the muted tick numeral at 5.99:1 / 7.78:1).

**Store assets (deterministic fix):** `store/screenshot1.png` was clipping ~42px off the popup
header — the capture was scaled width-only (440px → 825px tall) inside a 730px `overflow:hidden`
stage. Fixed with max-width+max-height (aspect preserved), the log-expansion framing hack removed,
and the follow-up section seeded ON; regenerated and verified by vision (header visible, footer
visible, no clip). `store/screenshot3-popup.png` was already correct (`max-height: 740px`).

## Axis 3 — Experience (trải nghiệm)

PENDING — time-to-first-value, setup friction, trust signals, error recovery, digest
usefulness, discoverability, keyboard-only and screen-reader paths are not measured yet. The
keyboard/a11y floor is partially covered by the language switcher's Escape/focus behaviour
(`test/lang-switch-e2e.mjs`) and the focus-visible rules in the Quiet Luxury spec.

## Method notes / honesty rails

- A measurement belongs to the revision it was taken on; the HEAD is recorded above and any
  later commit invalidates it (re-measure, never reuse).
- Vision scores are qualitative; they never substitute for a measured metric.
- Maker != judge: the lane that implements an upgrade does not certify its own measurement.
- **Known residual flakiness (open):** the Chrome/CDP suites are intermittently flaky in a way
  that is independent of the product — a pristine `git archive HEAD` copy failed 1 of 3 runs
  with a CDP `Runtime.evaluate timed out`, and `test/followup-e2e.mjs` has been seen failing the
  engine check `rot. a blocked send (approval present) does not advance the index` in this tree
  while passing on re-run (two consecutive clean runs were reproduced by the coordinator on
  555f9f0). Treat a single red run as INCONCLUSIVE and re-run before concluding; a repeatable
  red is a finding.
