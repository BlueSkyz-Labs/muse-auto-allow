# Global-Elite Benchmark Report — Muse Auto-Allow

Status: **IN PROGRESS** — the package + runtime speed axes and the design axis are measured; the
experience axis is still PENDING. Charter: `docs/GLOBAL_ELITE_BENCHMARK_ROUND.md`. Rule of this
report: **every number is measured by a command in this repo and pasted with it**; a value that
has not been measured says PENDING, it is never estimated.

Live truth: package/design measurements were first taken at `HEAD ee3e1bb`; the runtime speed
axis (§1.2) was measured at the frozen `HEAD 531cbca` on a **byte-exact export** of that revision
(the live tree was being edited by another lane at the time). `OBSERVED_AT 2026-10-10` · branch
`main` (a HEAD change invalidates the measurements below; re-measure, do not reuse).

**Load sensitivity (measured 2026-10-10):** the runtime harness is sensitive to machine load. An
independent coordinator re-run of `node scripts/bench/perf.mjs --only=scan` **while another lane's
Chrome suite was running** reported min 28.2 ms / p95 48.7 ms, versus the baseline's median
11.25 ms / p95 15.1 ms taken on an idle machine against the pristine export — a ~3-4x inflation
from contention alone. Therefore: take baselines on an idle machine, one Chrome instance at a
time, and treat any run taken under concurrent load as INVALID for the baseline.

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

### 1.2 Runtime (measured on `HEAD 531cbca` — the v1.8.0 freeze)

Harness: `scripts/bench/perf.mjs` (CDP lane, real Chrome `154.0.8037.99`, scratch profile —
the same installed-Chrome + `Extensions.loadUnpacked` launcher as `test/e2e.mjs`; the extension
is loaded from a temp copy whose manifest also matches `http://127.0.0.1/*`). Every number
below is that command's output; the JSON block it prints carries the raw samples, so anyone can
re-run and compare sample-for-sample. One Chrome instance at a time.

**Revision binding.** The numbers were taken against a **byte-exact export of `HEAD 531cbca`**
(`git cat-file blob HEAD:<path>` for every tracked file, so LF endings and sizes match the
committed blobs: `popup.html` 50,445 B, `popup.js` 63,840 B, `content.js` 73,702 B) because the
working tree was being edited by another lane while this lane ran — measuring the live tree
would have bound the numbers to an uncommitted revision. Re-run it the same way:

```
node scripts/bench/perf.mjs --only=popup      # popup open -> painted (cold + warm N=20)
node scripts/bench/perf.mjs --only=scan       # content-script scan cost per sweep
node scripts/bench/perf.mjs --only=latency    # detect -> click latency
node scripts/bench/perf.mjs --only=sw         # service-worker cold start + wake
node scripts/bench/perf.mjs --only=writes     # storage write amplification
node scripts/bench/perf.mjs --only=memory     # JS heap footprint
node scripts/bench/perf.mjs                   # everything (sw, popup, latency, scan, writes, memory)
```

(To bind a run to a revision, point `MAA_EXT_DIR` at that revision's `extension/` directory;
unset, it measures the working tree.)

| Metric | Measured (frozen `531cbca`) | Target | Target source |
|---|---|---|---|
| Popup open → painted, COLD (first open in a fresh profile) | **484 ms** FCP (DCL 260 ms; wall 540 ms) | ≤ 1000 ms ("first meaningful paint" in the page-load window) | web.dev RAIL — https://web.dev/articles/rail |
| Popup open → painted, WARM (N=20 consecutive opens) | **median 100 ms · p95 112 ms** FCP (wall median 148 ms · p95 271) | ≤ 200 ms (p75 "good" responsiveness) | web.dev INP — https://web.dev/articles/inp |
| Content-script scan cost per sweep (5,000 nodes · 200 approval-like cards · 700 buttons; worst case = no eligible hit, full traversal) | **median 11.3 ms · p95 15.1 ms** (min 10.1 · max 15.1, N=12) | ≤ 50 ms (long-task threshold) | web.dev "Optimize long tasks" — https://web.dev/articles/optimize-long-tasks |
| Detect → click latency, quiet page (`minDelayMs=0`, 400 ms gap) | **median 121 ms · p95 131 ms** (N=12) | ≤ 100 ms (RAIL "respond to input") — *analogy*, see note | web.dev RAIL — https://web.dev/articles/rail |
| Detect → click latency, shipped default pacing (`minDelayMs=300`, back-to-back) | **median 307 ms · p95 320 ms** (N=12) | TARGET PENDING (unsourced) | — |
| Service-worker cold start (extension load → worker global created) | **614 ms** (`Extensions.loadUnpacked` call itself 397 ms) | TARGET PENDING (unsourced) | — |
| Service-worker wake (stopped worker → restarted by a message) | **median 5.0 ms · p95 10.9 ms** (N=5) | TARGET PENDING (unsourced) | — |
| Storage write amplification, per click (`chrome.storage.local.set` calls) | **2** steady-state and first click — keys `log,stats,clickCount,schemaVersion` + `digestCounters`; 2–3 `get`s | TARGET PENDING (unsourced) | — |
| Storage write amplification, per follow-up send | **2** (same key pair; 3 `get`s) | TARGET PENDING (unsourced) | — |
| Memory — popup JS heap, idle | **1.09 MB** | ≤ 5–15 MB (popup) | bestchromeextensions.com memory guide — https://bestchromeextensions.com/guides/chrome-memory-optimization-developer-guide |
| Memory — content-script renderer JS heap: idle / heavy DOM / during sweeps | **5.15 / 5.45 / 5.51 MB** (repeated sweeps add **+0.06 MB**) | ≤ 2–5 MB per tab | bestchromeextensions.com memory guide — https://bestchromeextensions.com/guides/chrome-memory-optimization-developer-guide |
| Popup layout stability (no shift) | covered indirectly: popup <=600 px asserted in every state by `test/followup-e2e.mjs` + `test/lang-switch-e2e.mjs` | — | — |

**Sourcing discipline.** Rows whose target reads `TARGET PENDING (unsourced)` have no credible
published budget for that exact metric; they stay unmeasured-against rather than get an invented
number. The popup / scan / detect rows are anchored to Google's published web-performance
budgets (RAIL response 100 ms, INP "good" 200 ms at p75, long-task 50 ms, page-load first
meaningful paint 1000 ms) — these are general web budgets, not extension-specific ones, and the
"detect → click" row is an **analogy** (a machine reaction to a DOM change, not a user input),
labelled as such. The size budgets come from the Extension.js performance playbook (content
script ≤ 512 KiB, service worker ≤ 512 KiB, UI page ≤ 1 MiB —
https://extension.js.org/docs/workflows/performance-playbook); `content.js` 73,702 B and the
~110 KB popup payload are both comfortably inside those, and §1.1's hard budget check in
`scripts/lint.mjs` remains the enforcing gate.

**Verdicts against the sourced targets (frozen `531cbca`).** MET — popup warm 100 ms ≤ 200 ms;
popup cold 484 ms ≤ 1000 ms; scan per sweep 11.3 ms ≤ 50 ms; popup memory 1.09 MB ≤ 5 MB.
NOT MET — content-script per-tab memory 5.51 MB vs the 2–5 MB vendor rule of thumb (marginal,
and that guide is a vendor heuristic, not a standards body); detect → click 121 ms vs the 100 ms
RAIL analogy (the ~120 ms is the engine's 120 ms `MutationObserver` trailing debounce). PENDING
(unsourced target) — default-pacing latency, service-worker cold start and wake, storage writes
per click/follow-up.

**Method caveats (read before reusing a number).** (a) The content-script heap figure is the
renderer's JS heap (page + content script share one renderer) measured after a forced GC — it is
not an isolated per-script allocation, so treat it as an upper bound on the content script's own
footprint. (b) The scan-cost fixture makes every injected card ineligible on purpose (the
Allow/Deny pair sits inside a `<form>`, which the engine's `unsafeTarget()` refuses) so a sweep
traverses the whole tree instead of clicking the first hit — that is the worst case, not the
common one. (c) The service-worker "wake" is measured by stopping the worker with
`Target.closeTarget` and re-triggering it with a `runtime.sendMessage` from an extension page;
the cold start is the worker's own `performance.timeOrigin` minus the trigger timestamp, so it
excludes the harness's polling latency. (d) The popup FCP is the in-page
`first-contentful-paint` entry (relative to navigation start), not a CDP round-trip. (e) A single
run's warm-popup p95 is noisy (this host is memory-constrained): the warm wall-clock p95 swung
271–365 ms across three runs while the FCP median stayed 98–106 ms — re-run before treating a
p95 as a regression.

### 1.3 Engine hot-path optimization — before/after (measured 2026-10-10)

Same harness, same host/session, taken **before and after** the engine lane's content-script
optimization (three changes: adaptive `MutationObserver` debounce for card-bearing mutations;
one query per scope + per-sweep read caches behind a detection gate; `digestCounters` folded into
the click flush so one action = one storage write). The engine's own contract doc carries the
detail: `docs/ENGINE_V18.md` §12.

- **BEFORE** = a byte-exact export of `HEAD e0a2752`'s `extension/` (`content.js` 73,702 B),
  measured via `MAA_EXT_DIR`.
- **AFTER** = the engine lane's working tree (`content.js` 79,724 B; `background.js` unchanged).
  The AFTER cells below were taken on the 79,083 B build and **reproduced on the final 79,724 B
  build** (only a header comment block differs): latency quiet median 1 ms · p95 32 ms, default
  pacing 308/319 ms, scan median 6.55 ms · p95 10.6 ms, writes 1 per click / 2 first / 1 per
  follow-up.
- Host: Windows 11, Node `v26.7.0`, installed Chrome `154.0.8037.99`, one harness Chrome at a
  time. **The host was NOT fully idle**: the user's own Chrome (18 processes) was open for the
  whole session, so the **scan** row below is reported as quiet-window back-to-back pairs and is
  load-directional; the latency and write rows are deterministic counts and are unaffected.

```
node scripts/bench/perf.mjs --only=latency   # detect -> click, quiet (minDelayMs=0)
node scripts/bench/perf.mjs --only=scan      # content-script scan cost per sweep
node scripts/bench/perf.mjs --only=writes    # storage write amplification
```

| Metric | BEFORE (`e0a2752`, pristine) | AFTER | Target |
|---|---|---|---|
| Detect → click, quiet (`minDelayMs=0`) | **median 121.5 ms · p95 132 ms** — raw 124,131,132,128,121,70,121,39,121,122,121,122 | **median 2.5 ms · p95 20 ms** (2nd run 1.5 / 15) — raw 20,3,3,3,3,4,2,2,1,2,1,1 | ≤ 100 ms (RAIL analogy) — **now MET** |
| Detect → click, shipped default pacing (`minDelayMs=300`) | median 312.5 ms · p95 326 ms | median 315 ms · p95 321 ms — **NOT_IMPROVED** (governed by `minDelayMs`, not the debounce) | TARGET PENDING (unsourced) |
| Scan per sweep (5,000 nodes / 200 cards / 700 buttons, N=12) | quiet pair: **median 13.9 ms · p95 18.3 ms** (min 11.9) — raw 12.2,13.7,11.9,16.6,13.2,14.3,13.7,18.3,14.1,15.0,12.6,16.8; second pair 15.65 / 25.5 | quiet pair: **median 6.45 ms · p95 8.5 ms** (min 5.9) — raw 6.8,6.2,6.7,6.1,6.2,8.5,6.7,6.1,6.9,5.9,6.1,8.4; second pair 6.15 / 10.2 | ≤ 50 ms — MET (≈ -55 % median/p95 at equal load) |
| Storage writes per click (`chrome.storage.local.set`) | **2** steady / 3 first — `[log,stats,clickCount,schemaVersion]` + `[digestCounters]`; 2 `get`s | **1** steady / 2 first — `[log,stats,clickCount,schemaVersion,digestCounters]`; 1 `get` | TARGET PENDING (unsourced) |
| Storage writes per follow-up send | **2** (3 `get`s) | **1** (2 `get`s) | TARGET PENDING (unsourced) |

**Verdict delta.** The detect → click row moves from **NOT MET (121 ms vs the 100 ms RAIL
analogy)** to **MET (2.5 ms)**: the ~120 ms was exactly the engine's fixed `MutationObserver`
trailing debounce, which is now applied only to *generic* mutations — a mutation that brings in
(or lands inside) an approval card sweeps on the next task. The scan row roughly halves; the
write row halves. **Default-pacing latency does not move** and is reported NOT_IMPROVED: it is
paced by `minDelayMs` (300 ms) by design, not by the observer.

**Falsification (this section's numbers are not host luck).** Disabling the fast path with one
single-line mutation (`scheduleSweep('observer', fast ? OBSERVER_CARD_MS : OBSERVER_GENERIC_MS,
fast)` → `scheduleSweep('observer', OBSERVER_GENERIC_MS, false)`, anchor asserted to occur exactly
once) and re-running the latency harness through `MAA_EXT_DIR` reproduces the old latency —
**median 123 ms · p95 131 ms**, raw 130,126,131,121,131,122,124,36,121,121,130,121. The dedup
invariants hold with the fast path enabled (`test/e2e.mjs`: `ok:true`, `n7count:1`, `n11count:1`,
`denyCount:0`, `forbiddenHit:[]`), and the same e2e suite is also green against the mutated
(fixed-120 ms) copy — the debounce change is a latency change only, never a detection change. The
optional service-worker boot deferral was **not** done (it cannot move the harness's
`timeOrigin`-based SW metrics and would break `background-unit` S7) — `docs/ENGINE_V18.md` §12.5.

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
