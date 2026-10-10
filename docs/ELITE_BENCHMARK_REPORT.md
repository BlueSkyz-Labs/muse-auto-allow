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
| ↳ cold caveat (measured 2026-10-10) | the cold figure above is **one sample**; three identical runs on the same bytes swung **568–928 ms** — see §1.4. Cold is only resolvable with paired/interleaved variants; warm (below) is the stable metric. | | |
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

### 1.4 Popup cold-path optimization — before/after (measured 2026-10-10) — **NOT_IMPROVED**

Goal of this lane: cut the popup **cold** first paint (484 ms FCP vs 100 ms warm, §1.2) by deferring
non-first-paint work — stats aggregation, the mini-chart render, the log render, the hidden overlays
(built lazily on first open instead of living in the boot DOM) — plus any safe parse deferral, with
**zero** visual or behavioural change.

**Outcome: no code change was made, because no safe direction moves the number.** A false win is
worse than an honest no-op, so this section records the measurement, not a change. `extension/popup.html`
and `extension/popup.js` are byte-identical to `HEAD cd7c38b` after this lane.

**Before / after (the requested harness pair).** `node scripts/bench/perf.mjs --only=popup` (N=20,
defaults, harness untouched) on the live tree, three runs in one session. BEFORE = `HEAD cd7c38b`;
AFTER = the same bytes (nothing was changed). Host was **not** idle — the user's own Chrome (19
processes) was open for the whole session; one harness Chrome at a time.

| run | cold FCP | cold DCL | cold wall | warm FCP median | warm FCP p95 | warm wall med/p95 |
|---|---|---|---|---|---|---|
| 1 | 928 ms | 704 ms | 973 ms | 100 ms | 116 ms | 145 / 228 ms |
| 2 | 788 ms | 530 ms | 887 ms | 104 ms | 176 ms | 210 / 282 ms |
| 3 | 568 ms | 311 ms | 703 ms | 96 ms | 120 ms | 151 / 291 ms |

Read this correctly: **warm is stable** (median 96–104 ms, matching §1.2's 100 ms) while **cold is a
single sample that swung 568–928 ms across three identical runs** on the same host and the same bytes.
The cold figure is not a resolvable instrument at N=1 here; the rest of this section therefore uses
only **paired, interleaved** comparisons (same session, same host, alternating variants), which cancel
drift.

**Attribution: what the cold cost actually is.** Each variant is the live payload with exactly one
thing removed, built in a scratch copy and measured through the harness's own `MAA_EXT_DIR` switch
(`node scripts/bench/perf.mjs --only=popup --popup-n=2`, interleaved rounds) — `scripts/bench/**` was
never modified, and `MAA_EXT_DIR` is the documented way to point the harness at another tree.

| Variant | What is removed vs the live tree | Cold FCP median | n |
|---|---|---|---|
| **A** live | — (control: the live payload, CD7C38B) | 862–922 ms (two blocks) | 14 / 10 |
| **H** | `popup.js` is not loaded **at all** — no parse, no execute, no render | 830–898 ms | 14 / 10 |
| **B** | the whole boot tail (`boot()`, `refresh()`, `refreshFollowupStatus()`, the 2.5 s interval) — an **upper bound** far beyond any safe deferral | 886 ms | 14 |
| **M** | the hidden overlays are gone from the boot DOM: `#safetyPanel`, `#onboard`, the phrase-library sheet and the advanced group (−7.5 KB markup, ~120 fewer nodes) | 870–902 ms | 8 / 10 |
| **K** | the markup is replaced by a 1-node body: the 37,597 B inline `<style>` alone remains | 440 ms | 8 |
| **L** | the CSS is gone; the full 15 KB markup is present but unstyled | 614 ms | 8 |
| **G** | everything: a 113-byte page in the same extension origin (no CSS, no markup, no JS) | 450 ms | 8 |
| **N** (diagnostic only) | the 11 `box-shadow` declarations — a **visual** change, measured to locate the cost, never shipped | 648 ms (−274 ms vs A, lower in 9/10 rounds) | 10 |

Paired deltas within one interleaved block (14 rounds, 95 % bootstrap CI, bootstrap over round pairs):

| Comparison | Median Δ cold FCP | 95 % CI | Lower in |
|---|---|---|---|
| A − H (the **entire** popup.js: parse + execute + every pre-paint render) | **−8 ms** | [−100, +74] | 7/14 |
| A − B (all boot render work, i.e. deferring strictly more than any safe change could) | **−60 ms** | [−212, +50] | 8/14 |
| B − H (instrument control: B does strictly more work than H) | +28 ms | [−32, +152] | 7/14 |

The third row is the honesty check on the instrument: **B performs strictly more work than H yet
measures faster**, so the metric has no resolution below ≈ ±100 ms at this N on this host. The first
row is therefore the ceiling for the whole direction: removing every line of `popup.js` — not
deferring it, *removing* it — lands inside the noise.

**Verdicts.**

1. **Defer non-first-paint work (stats aggregation, mini-chart, log render, hidden overlays).**
   **NOT_IMPROVED.** Every one of those renders lives in `popup.js`, and all of `popup.js` is worth
   **−8 ms** (CI includes 0). Removing the hidden overlay markup from the boot DOM entirely is worth
   ~0 (M 870 vs H 874; both ≈ A). Warm proves why: the same payload — CSS + markup + JS parse +
   execute + every render — is only ~80 ms of work (warm DCL 71–95 ms, §1.2 and the runs above), so
   no deferral inside it can be worth more than that, which is below this host's cold resolution.
2. **Defer or trim the critical CSS.** **NOT_IMPROVED**, and the defer is unsafe. The 37,597 B
   stylesheet costs ≈ 0 on the cold first paint (K 440 ms with a 1-node body vs G 450 ms with a
   113-byte page), and making it non-render-blocking is exactly the FOUC risk the task forbids — the
   popup is dark-themed and a flash of unstyled content is a regression, not a win.
3. **Keep the manual-locale fetch lazy.** **Already satisfied, nothing to change.** `boot()` reads
   `userLocale` first and only fetches `_locales/<lang>/messages.json` when it is not `'auto'`; a cold
   open in a fresh profile has no `userLocale` key, so the fetch never happens on the cold path.

**What the cold number is made of (measured).** A cold page in this extension origin costs ~450 ms
before any content exists (G: a 113-byte page). A real styled popup costs ~420 ms on top of that
(H: CSS + full markup, no JS), and the single largest *reducible* term inside it is the raster of the
**frozen design's 11 `box-shadow` declarations** (−274 ms when they are removed). That is a visual
change to a design frozen at `e0a2752`, so it is recorded here as the only measured lever and
deliberately **not** taken: the lane's mandate is zero visual change. Cold popup first-paint for this
revision is therefore cold-start cost plus first-paint raster of the shipped design, not deferrable
payload work — the honest next step for anyone revisiting it is either a design decision about the
shadow/paint budget or a much quieter measuring host with a much larger number of cold repeats.

**Neutrality of this lane (nothing changed ⇒ nothing to regress).** All five suites were run
**foreground, unpiped**, on the unchanged tree at `cd7c38b`: `node scripts/lint.mjs` (exit 0 — 24
checks across 18 files) · `node test/e2e.mjs` (`"ok": true`, exit 0) · `node test/followup-e2e.mjs`
(`"ok": true`, exit 0; the two nested `"ok": false` values are the expected engine refusals `'paused'`
and `'composer-not-empty'`, not failed checks) · `node test/lang-switch-e2e.mjs` (`"ok": true`, 36
passed / 0 failed) · `node test/background-unit.mjs` (29/29, `"failed": 0`). Heights measured by the
suites are unchanged and still inside the 600 px discipline: `followup-e2e` **empty 594 / full 594 /
sheet open 594** total (follow-up section 312, log 16; `lowestEdge` 594, sheet fits the popup);
`lang-switch-e2e` **menu open lowest 420 (bodyH 426)** and **menu open + full log lowest 594**.

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

Status: **MEASURED** — this section supersedes the top-of-report "the experience axis is still
PENDING" clause (the preamble is another lane's text and is left untouched). Harness:
`scripts/bench/experience.mjs` (new; same CDP lane as §1.2 — installed Chrome `154.0.8037.99`,
scratch profile, `Extensions.loadUnpacked`, extension loaded from a temp copy whose manifest also
matches `http://127.0.0.1/*`). One Chrome instance at a time; **the host was NOT idle** (the user's
own Chrome, 19 processes, was open for the whole session) — every *timing* below is a single cold
sample and is load-directional; every *count* (user actions, interactions, controls, log entries)
is deterministic and load-independent. Measured at `HEAD a782915` (the v1.9.0 freeze) ·
`OBSERVED_AT 2026-10-10`.

```
node scripts/bench/experience.mjs                 # all six dimensions
node scripts/bench/experience.mjs --only=ttff     # time-to-first-value
node scripts/bench/experience.mjs --only=reach    # setup friction / discoverability
node scripts/bench/experience.mjs --only=trust    # trust signals
node scripts/bench/experience.mjs --only=errors   # error recovery
node scripts/bench/experience.mjs --only=keyboard # keyboard-only path
node scripts/bench/experience.mjs --only=ax       # accessibility tree
node scripts/bench/experience.mjs --only=assert   # explicit PASS/FAIL for the §3.7 fixes
```

### 3.0 Post-fix revision — the §3.7 defects (measured 2026-10-10)

The §3.7 list was produced by the audit above. This lane then fixed the fixable ones at the
root cause and re-measured. The harness gained a `--only=assert` metric: **22 explicit
PASS/FAIL assertions** (`node scripts/bench/experience.mjs --only=assert` → `22 passed / 0
failed`, exit 0). Every claim below is that command's output.

| # | Defect (§3.7) | Status | Evidence (command + numbers) |
|---|---|---|---|
| 1 | Modal overlays do not hide the background from AT | **FIXED** | Background top-level children of `<body>` are made `inert` while any of the three dialogs is open and restored on close (button / Escape / programmatic). AX `Accessibility.getFullAXTree` interactive nodes **before → after**: `safety_open` **99 → 83**, `mission_open` **22 → 6**, `onboarding` **13 → 2**; **background interactive nodes with a dialog open = 0** in all three states (`--only=ax` + the F1/F1b assertions). The one deliberate exception: an open non-modal popover in the background (the language menu) keeps its own subtree operable — exactly ONE subtree exempt, asserted. |
| 2 | Paused / schedule-closed manual send reports the wrong cause | **FIXED** | `SEND_BLOCKED_KEY` gained `paused`, `schedule` **and** `dead` (the third missing engine reason). The F2 assertion enumerates every `reason:` literal from `content.js` (12 reasons; 10 failure reasons) and proves the map covers all of them; a missing entry now fails the harness. |
| 3 | The blocked reason is a tooltip only | **FIXED** | The chip carries the reason in its **accessible name** (`aria-label="blocked — keyword:delete"`, verified via `Accessibility.getPartialAXTree`, not just the attribute) **and** as compact visible text (`blocked · keyword:delete`, bounded `.kreason` span) — measured chip right edge **194 px** inside the **320 px** popup. Contrast of the new visible text: **5.84:1** light / **6.72:1** dark (AA pass). |
| 4 | The engine ignores REMOVAL of a settings key | **FIXED** | A removed key (storage `newValue === undefined`) now resets to that key's shipped DEFAULT for the whole `storage.onChanged` surface (v18 keys, follow-up keys, `enabled`, `mission`). Driven at runtime: closed schedule → `reason:'schedule'`; after `storage.local.remove('followupSchedule')` → **`reason:'attempted'`** (no longer `schedule`). Future pause → `'paused'`; after removing `pauseUntil` → **`'attempted'`**. |
| 5 | A failed log flush is silent | **FIXED** | `content.js` `flushClicks` now `console.warn`s the failure. Proven at runtime by forcing `chrome.storage.local.set` to throw in the content world, then firing a real click: the captured console line is `[muse-auto-allow] log flush failed — record dropped: probe-quota-exceeded`. |
| 6 | Phrase-library discoverability (4 interactions) | **NOT DONE** | Unchanged at **4** interactions (`--only=reach`: phrase_library reach 2 / operate 4, still the only `>3` flag). The depth is structural: the entire `.fadvhead`/`.fadvgroup` is `display:none` while follow-up is off, so reaching a phrase needs follow-up ON → Advanced → Phrase library → tap. The only ways to cut a step both regress a frozen contract — a permanently-visible library row risks the ≤600 px cap in the crowded states, and auto-opening the library sheet on Advanced-expand changes the disclosure/sheet contract `test/followup-e2e.mjs` exercises (`#flibbtn` toggling would then CLOSE an already-open sheet). Reported NOT DONE rather than traded against a frozen behaviour. |

**Falsification (reverse-mutation).** The assertions were proven to *detect* the defects, not just
pass: a mutated copy of `extension/` with each fix reverted (`MAA_EXT_DIR` points the harness at
it) turns **12 of the 22 checks RED** and exits 2 — F2 coverage (2), F1 safety/mission (3), F1b
(2), F3 accessible-name (2), F4 removal (2), F5 (1). The pre-fix AX counts reproduced exactly
(`safety_open` 99, `mission_open` 22, `onboarding` 13).

**Gates on the fixed revision (all six suites, foreground + unpiped):** `node scripts/lint.mjs`
exit 0 — 24 checks / 18 files · `node test/e2e.mjs` exit 0 (`"ok": true`) ·
`node test/followup-e2e.mjs` exit 0 (`"ok": true`, 119 checks, 0 failed; heights
**594/594/594**) · `node test/lang-switch-e2e.mjs` exit 0 (36 passed / 0 failed; heights
menu-open **423**, menu + full log **594**) · `node test/background-unit.mjs` 29/29 ·
`node test/mission-e2e.mjs` exit 0 (**39 checks**, 0 failed). i18n parity: **172 keys × 6
locales** (169 + the 3 new `followupSendBlockedPaused/Schedule/Dead`).

### 3.1 Time-to-first-value (fresh scratch profile, extension loaded unpacked)

"How many user actions" = trusted pointer clicks/key gestures the harness had to dispatch from a
**truly fresh profile** (`chrome.storage.local` cleared) to reach each goal. The engine ships
enabled-by-default (`content.js` `DEFAULT.enabled = true`; the worker's `migrate()` seeds
`enabled:true` — `background.js:56`), so goal 1 needs no user action at all.

| Goal | Measured (ms) | User actions from fresh install | How measured | Verdict |
|---|---|---|---|---|
| First **auto-click** on a real approval card (`test/fixture.html`) | **1662.5 ms** from `performance.timeOrigin` (5 full-suite runs swung **1210–2023 ms** — a single cold sample, not a resolvable instrument at N=1) | **0** | `node scripts/bench/experience.mjs --only=ttff` | MET the product's own promise (install → working with zero setup); **no sourced target** for an extension's first auto-click — reported unmeasured-against |
| First **follow-up send** | **968 ms** after the toggle (idle→send) | **2** (dismiss the first-run wizard, toggle "Continue when Muse is idle") | `… --only=ttff` | 2 actions; the engine ships follow-up OFF (`content.js` `FOLLOWUP_DEFAULTS.followupEnabled = false`), so it is opt-in by design |
| First **mission step** | **1063 ms** after selecting a mission | **4** (wizard dismiss → follow-up ON → Missions sheet → select a mission) | `… --only=ttff` | 4 actions; missions ride the follow-up engine and are gated on it (`#missionGate`, `popup.js:1175`) |

Fresh-profile storage after goal 1 = `[clickCount, cryptKeyRaw, digestCounters, log, schemaVersion,
stats]` — the engine clicked with **no** `enabled`/`onboarded` key written by a user, and
`onboarded` was absent (`onboarded_absent_fresh: true`).

### 3.2 Setup friction / discoverability — reachability table (drives the REAL popup)

One "interaction" = one trusted pointer click or one text-entry gesture. **Reach** = interactions
from the default popup state until the surface is visible/operable; **operate** = the full path from
that state that performs the surface's primary operation (it includes the reach steps). Default state
= shipped defaults with the one-time wizard already dismissed. Every row's `operate_ok` is `true`
(the harness verified the effect, not just the click).

| Surface | Reach | Operate | >3 flag | How measured |
|---|---|---|---|---|
| Pause (15 min / 1 h / tomorrow) | 0 | 1 | | `… --only=reach` |
| Auto-click Allow toggle | 0 | 1 | | ″ |
| Safety & Control sheet (entry) | 0 | 1 | | ″ |
| Dry-run (log only) | 1 | 2 | | ″ |
| Rules — allowed topics | 1 | 3 | | ″ |
| Rules — block keywords | 1 | 3 | | ″ |
| Schedule (follow-up only during hours) | 1 | 2 | | ″ |
| Stuck & error recovery | 1 | 2 | | ″ |
| Sync settings across devices | 1 | 2 | | ″ |
| "While you were away" digest | 0 | 0 | | ″ (renders automatically once `digestCounters` > 0) |
| **Phrase library (combo builder)** | 2 | **4** | **FLAG** | ″ |
| Prompt rotation | 2 | 3 | | ″ |
| Missions (select + enable) | 0 | 3 | | ″ |
| Language switcher | 0 | 2 | | ″ |
| Statistics page (footer CTA) | 0 | 1 | | ″ |

**Visible without opening anything:** pause, auto-click toggle, the Safety *entry*, the digest (once
it has data), the Missions *entry*, the language switcher, the Statistics CTA. **Behind one open:**
dry-run, rules (topics + keywords), schedule, smart recovery, settings sync (all behind the Safety
sheet), and the phrase library + rotation (behind the Auto-follow-up section **and** its "Advanced"
disclosure — the whole `.fadvhead`/`.fadvgroup` is `display:none` while follow-up is off:
`popup.html:170-171`, `popup.html:570-608`).

**The one >3 flag — the phrase library is 4 interactions deep** (enable follow-up → open Advanced →
open Phrase library → tap a phrase): `popup.js:1284` (`#flibbtn`), `popup.js:1287` (`#fadvbtn`),
`popup.js:1296` (`#fchips`). Its sibling "rotation" is 3. Nothing else exceeds 3.

**First-run adds +1 to everything:** on a genuinely fresh install the 3-step onboarding wizard
(`popup.html:716-734`, `popup.js:933-948`, shown while `onboarded !== true`) is a full-popup overlay
that measured **320 × 428 px covering the whole popup**, with the header's topmost element resolving
to `obTitle` *inside* the wizard — so every surface above costs one extra interaction on first run.

### 3.3 Trust signals — every engine action leaves a visible, explained entry

Enumerated from code (the log vocabulary) and verified at runtime by driving each path, then reading
the storage log **and** the rendered popup log. Engine log kinds in code (13):
`allow, allow-dry, blocked, expand, expand-dry, followup, followup-dry, mission, mission-dry,
open-panel, open-panel-dry, review-bar, review-bar-dry`.

| Engine action | Log kind | Visible trace | Evidence |
|---|---|---|---|
| Allow click | `allow` | ✓ storage log + rendered `k-allow` chip + `console.log '[muse-auto-allow] allow "Allow" \| …'` | `content.js:1499` → `doClick` `content.js:746-750`; rendered `popup.js:555-586` |
| Dry-run click | `allow-dry` | ✓ log + `k-dry` chip (nothing clicked) | `content.js:729,746`; rendered `popup.js:97` |
| Blocked with reason | `blocked` (+ `blockedReason`) | ✓ log + `k-blocked` chip + `console.log 'blocked (keyword:delete)'` | `content.js:365-376`; rendered `popup.js:559,585` |
| Follow-up send | `followup` | ✓ log + chip (shares the `k-allow` class) + `console.log 'follow-up sent via button'` | `content.js:1381`; rendered `popup.js:98` |
| Mission step | `mission` | ✓ log + `k-mission` chip with the localized step/cycle line | `content.js:933`; rendered `popup.js:572-580` |
| Digest | `digestCounters` | ✓ "While you were away" band (auto-shown when counters > 0) | `content.js:696-703`; `popup.js:871-888` |

Runtime result: **all six actions logged = true** (`--only=trust`); rendered classes =
`[allow, blocked, dry, mission]` (a follow-up entry renders as `k-allow` by design —
`popup.js:98` — so it is not separately classed). **No engine action was found that leaves no
visible trace.** One caveat on *how much* is explained: the blocked **reason** was carried only
as a `title` tooltip on the chip (`popup.js:585`); the chip's text was the localized word
"blocked" (measured `blocked_chip = {title: "keyword:delete", text: "blocked"}`), so the *why*
was a mouse-hover affordance, not visible text and not in the accessible name (defect #3 below).
**FIXED in §3.0** — the reason now rides the chip's `aria-label` *and* a bounded visible span
(measured `{aria: "blocked — keyword:delete", text: "blocked · keyword:delete"}`).

### 3.4 Error recovery — each failure path, surfaced? recovery path?

Driven at runtime by sending the same `followup-send-now` message the popup's "Send now" sends
(`--only=errors`) and recording the engine's `{ok, reason}`; the popup's user-facing mapping is read
from source.

| Failure path | Engine `{ok, reason}` (measured) | Popup surfaces the specific cause? | Recovery path | Evidence |
|---|---|---|---|---|
| Success (control) | `{ok:true, reason:'attempted'}` | — | — | `content.js:1358` |
| Follow-up off | `{ok:false, reason:'disabled'}` | ✓ "Enable Auto follow-up first" | turn the toggle on | `content.js:1316`; `popup.js:1411` |
| Paused | `{ok:false, reason:'paused'}` | **FIXED** — "Couldn't send — automation is paused" | wait / Resume | `content.js:1317`; **now mapped** in `SEND_BLOCKED_KEY` → `followupSendBlockedPaused` |
| Schedule closed | `{ok:false, reason:'schedule'}` | **FIXED** — "Couldn't send — outside the follow-up hours" | change the window / disable the schedule | `content.js:1318`; `scheduleAllows` `content.js:336-344`; **now mapped** → `followupSendBlockedSchedule` |
| Approval present | `{ok:false, reason:'approval-present'}` | ✓ "Muse is waiting for your approval" | clear the approval | `content.js:1320`; `popup.js:1405` |
| Composer not empty | `{ok:false, reason:'composer-not-empty'}` | ✓ "Muse's message box already has text" | clear the draft | `content.js:1323`; `popup.js:1406` |
| No composer | `{ok:false, reason:'no-composer'}` | ✓ "no message box found on the Muse page" | — | `content.js:1322`; `popup.js:1407` |
| No prompt set | `{ok:false, reason:'no-prompt'}` | ✓ "no follow-up prompt is set" | set a prompt | `content.js:1326`; `popup.js:1409` |
| Dry-run (allowed, logs only) | `{ok:true, reason:'dry-run'}` | ✓ dry-run banner in the log | turn dry-run off | `content.js:1342,1348` |
| Send now, no muse.ai tab | note "No muse.ai tab found" | ✓ `#fsendnote` (role=status) | open muse.ai | `popup.js:1431,1414-1421` |
| Oversized sync item | skipped + `console.warn "… over the 8192-byte per-item quota; kept local only"` | console only | local storage stays authoritative | `background.js:182-186` |
| Sync write rejected | `console.warn "chrome.storage.sync.set failed — …"` | console only | — | `background.js:191-200` |
| Import refused (bad file) | `alert "Not a Muse Auto-Allow backup file."` | ✓ blocking alert | pick a valid backup | `stats.js:293,297,304,320` |
| Import refused (quota) | `alert "Could not restore the backup: browser storage is full."` | ✓ dedicated message | free storage | `stats.js:312-314` |
| Storage quota on click flush | `chrome.storage.local.set` wrapped in try/catch | **FIXED** — `console.warn` with the reason (no new UI, no network) | — | `content.js` `flushClicks` |
| No cards found | nothing happens (no log entry) | n/a (no action taken) | — | by design |

**Gaps (reported by the audit, then FIXED in §3.0):** (1) a **paused** or **schedule-closed**
manual send showed the generic "Couldn't send the follow-up" instead of naming the cause — both
reasons are now mapped in `SEND_BLOCKED_KEY` (plus the third missing engine reason `dead`), and
the harness asserts the map covers the engine's full reason set; (2) a failed log flush was
silent (`content.js:705` caught and dropped) — it now `console.warn`s the reason; (3) removing a
v1.8 settings key from storage did **not** reset the engine — `content.js:1565-1567` applied only
`newValue !== undefined`, so a key deleted out from under the page left the engine on its stale
value until reload (observed live: after a `storage.local.clear()` the engine kept refusing every
send with `reason:'schedule'`). A removed key now resets to that key's shipped default, proven at
runtime for `followupSchedule` and `pauseUntil`.

### 3.5 Keyboard-only path

Every focusable interactive control in the popup was enumerated and swept with trusted CDP `Tab`
key events; a sample of each control type was then operated with trusted `Enter`/`Space`/typing.

- **Focusable controls in the default state: 11** — `langBtn, p15, p60, ptom, safetyBtn, enabled,
  delay, misbtn, followupEnabled, fsendnow, openstats`.
- **Unreachable by Tab, default state: `fsendnow` (disabled)** — correct behaviour for a disabled
  control (`.btn:disabled`, `popup.html:145`; disabled by `applyFollowupUI` while follow-up is off).
  **With follow-up ON: 0 unreachable.**
- The visually-hidden toggle pattern (`input[type=checkbox]{position:absolute;opacity:0;width:1px;
  height:1px}`, `popup.html:80`) keeps the *native* input focusable, so Space toggles it.

| Control type (sample) | Key | Operated |
|---|---|---|
| button `#safetyBtn` | Enter | ✓ opens the Safety panel |
| toggle `#enabled` | Space | ✓ flips |
| toggle `#followupEnabled` | Space | ✓ flips |
| disclosure `#fadvbtn` | Enter | ✓ opens Advanced |
| sheet `#misbtn` | Enter + Escape | ✓ opens, Escape closes, focus returns to the entry |
| select `#schStart` | ArrowDown | ✓ focus stays, value moves |
| text `#topicInput` | type + Enter | ✓ text lands, Enter commits the rule |
| menu `#langBtn` | Enter + Escape | ✓ opens, Escape closes |

**No control was found that cannot be reached and operated by keyboard alone.** Focus containment
while the Safety modal is open was also checked: 10 consecutive `Tab`s stayed inside the panel
(`escaped_to_background: false`).

### 3.6 Screen-reader path — accessibility tree per popup state

`CDP Accessibility.getFullAXTree` in each main state.

| Popup state | Interactive nodes (before → after §3.0) | **Unnamed interactive** | Focusable & unnamed | Roles used |
|---|---|---|---|---|
| default | 16 → 16 | **0** | 0 | button, checkbox, spinbutton, textbox, status |
| safety_open | 99 → **83** | **0** | 0 | + dialog, combobox, option |
| mission_open | 22 → **6** | **0** | 0 | + dialog, radiogroup, radio |
| advanced_open | 21 → 21 | **0** | 0 | button, checkbox, spinbutton, textbox |
| onboarding (fresh) | 13 → **2** | **0** | 0 | button, dialog, status |

**No interactive node with an empty or missing accessible name in any state.** Roles for the custom
controls: toggles are native `checkbox` (real `<input type=checkbox>`, `checked` state exposed);
the Safety / Mission / onboarding overlays are `role="dialog" aria-modal="true"`
(`popup.html:636,662,716`); the mission list is `role="radiogroup"` with `role="radio"
aria-checked` rows (`popup.html:655`, `popup.js:1148`); the schedule hours are native
`combobox`+`option`; number fields are `spinbutton`. Every control carried a real name (e.g. the
`#enabled` checkbox → "Auto-click Allow"; mission rows → "GOLIVE READY — Project Orchestrator 6
steps …").

**One a11y gap (defect #1) — FIXED in §3.0:** in `safety_open` (99 interactive nodes) and
`mission_open` (22) the tree exposed the **background** popup controls (Statistics, Language,
Auto-click Allow, Missions, the pause pills, …) — `aria-modal="true"` was set but nothing made
the background `inert`/`aria-hidden`, so a screen-reader user could navigate out of the modal
into the obscured popup. The background is now `inert` while any of the three dialogs is open:
the interactive-node delta is exactly the background (**99 → 83**, **22 → 6**, **13 → 2**) and
the background interactive count with a dialog open is **0**.

### 3.7 Defects found (ranked — status as of the §3.0 fix pass)

1. **Modal overlays do not hide the background from assistive tech (medium).** `#safetyPanel`,
   `#missionSheet`, `#onboard` are `role="dialog" aria-modal="true"` (`popup.html:636,662,716`) but
   the background stayed in the AX tree and focusable — measured: safety_open = 99 interactive nodes
   including every background control. No `inert`/`aria-hidden` on the background. (Keyboard Tab
   happens to stay inside, so this is a screen-reader-only leak.) — **FIXED** (§3.0): background
   `inert` while any of the three dialogs is open, restored on close; background interactive nodes
   with a dialog open = **0** (99 → 83, 22 → 6, 13 → 2).
2. **A paused / schedule-closed manual send reports the wrong cause (medium).** The engine returns
   `reason:'paused'` (`content.js:1317`) and `reason:'schedule'` (`content.js:1318`), but
   `SEND_BLOCKED_KEY` (`popup.js:1404-1412`) had no entry for either, so `#fsendnote` showed the
   generic "Couldn't send the follow-up" (`popup.js:1436`). Measured: both reasons
   `surfaced_in_popup_message_map: false`. — **FIXED** (§3.0): both mapped, plus `dead`; the map is
   now asserted against the engine's full reason set.
3. **The blocked reason is a tooltip only (low/medium).** `popup.js:585` renders `blockedReason` as
   a `title` attribute on a chip whose text is the word "blocked"; it was neither visible text nor in
   the accessible name (measured `blocked_chip = {title:"keyword:delete", text:"blocked"}`), so a
   screen-reader user heard *that* a card was blocked but never *why*. — **FIXED** (§3.0): the
   reason now rides `aria-label` **and** a bounded visible span.
4. **The engine ignores removal of a v1.8 settings key (low).** `content.js:1565-1567` only applied
   a change when `newValue !== undefined`; a key deleted from storage (newValue `undefined`) never
   reset the engine's in-memory value until reload. Observed live: after `storage.local.clear()`
   the engine kept a closed schedule and refused every send with `reason:'schedule'`. — **FIXED**
   (§3.0): a removed key resets to that key's shipped default (proven for `followupSchedule` and
   `pauseUntil`).
5. **A failed log flush is silent (low).** `content.js:705` caught `chrome.storage.local.set`
   failures with an empty handler — a dropped click record left no trace. — **FIXED** (§3.0): it now
   `console.warn`s the reason (local only).
6. **Phrase library discoverability (low).** 4 interactions from the default popup state (flag in
   §3.2); its parent controls are `display:none` until follow-up is on *and* Advanced is expanded. —
   **NOT DONE** (§3.0): the depth is structural and the only step-cutting changes regress a frozen
   contract (see the §3.0 row).
7. **Follow-up entries are visually indistinguishable from allow clicks (info).** `popup.js:98`
   maps kind `followup` to the `allow` chip class, so in the rendered log the two share a chip and
   only the label differs.
8. **"Send now" is disabled in the default state (info).** Not tabbable until follow-up is enabled
   (`popup.html:611`, `popup.js` `applyFollowupUI`) — correct for a disabled control, listed for
   completeness.

### 3.8 NOT MEASURABLE (with reason — never estimated)

- **The popup's own per-reason note text end-to-end.** The popup's "Send now" only messages
  `https://muse.ai/*` tabs (`popup.js:1429`), and this repo's zero-network / no-new-permissions gate
  keeps the fixtures on `127.0.0.1`, so the note that can actually be reached in the harness is the
  "No muse.ai tab found" path (measured). The reason→message mapping is verified **in source**
  (§3.4) but not driven end-to-end in the popup.
- **Digest usefulness (does the "While you were away" summary change a user's behaviour?).** No
  instrument for perceived usefulness; the harness can only prove the band renders and is correct.
- **Real screen-reader output (NVDA/JAWS/VoiceOver speech).** No AT engine on this host; the CDP
  accessibility tree is the closest available evidence and is what §3.6 reports.
- **Field/real-user experience (first-session funnel, drop-off).** No RUM/analytics tag on this
  product (zero-network gate), so there is no field source to read.

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
