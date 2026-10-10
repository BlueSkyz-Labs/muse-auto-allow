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

Instrument: `vision_analyze` over REAL CDP renders (popup 640x1200 @2x; stats 1280x800).
Scores are qualitative and labelled as such; the SCALE is anchored by scoring the shipped
pre-change popup and the phase-1 mockup with the same prompt in the same session.

| Surface | Score (premium / craft) | Notes |
|---|---|---|
| Popup, light — shipped pre-Quiet-Luxury (anchor) | 6 / 7 | the calibration anchor |
| Popup, light — after the token re-skin (91f4c14) | 4–7 / 4–6 across rounds; independent coordinator pass: **6 / 5** | **GATE NOT MET** — the tokens are fine, the COMPOSITION is the gap |
| Popup, dark — after the token re-skin | 6–7 / 5.5–6 | same composition gap |
| Phase-1 mockup popup (anchor for the target) | 8 / 8.5 | the target quality bar |
| Statistics, light / dark | 9 / 8 and 8 / 7 | meets the bar |

Measured contrast improvements (in the rendered output, not by eye): mini-chart day bars
**1.88 → 3.32:1** light and **2.06 → 4.52:1** dark; dark toggle ON-vs-OFF track **1.85 → 4.83:1**;
all spec text pairs >=4.5:1 (light 16.86…5.22:1, dark 15.44…5.61:1).

Composition defects driving the gap (both passes agree): broken-looking truncated domain badge;
inconsistent right-edge alignment; flat type hierarchy; one blue doing six jobs; inverted action
hierarchy (Send now vs footer Statistics); browser-default artifacts (unthemed scrollbar,
textarea resize handle, native-looking chevrons/toggles); chart with no scale/legend; cramped
rows (pause row, follow-up container, log vs scrollbar, footer).

Active work: the design iteration lane (`deleg_8245e4b3`) targets **>=8/10 premium light+dark in
>=2 anchored vision rounds** with all gates green.

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
