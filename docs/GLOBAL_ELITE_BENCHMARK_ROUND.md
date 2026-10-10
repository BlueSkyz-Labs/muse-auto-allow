# Global-Elite Benchmark Round — charter (queued after the v1.8.0 freeze)

Owner instruction (2026-10-10, verbatim intent): *"làm 1 vòng benchmark global elite standard,
design top tier để nâng cấp tiếp toàn diện: giao diện, tốc độ, trải nghiệm"* — measure this
product against a global-elite / top-tier reference standard, then upgrade comprehensively
across **UI (giao diện)**, **speed (tốc độ)** and **experience (trải nghiệm)**.

Status: **QUEUED** — starts after (a) the v1.8.0 freeze and (b) the Quiet Luxury phase-2
application (`docs/QUIET_LUXURY_SPEC.md` §7) land, so the benchmark baseline is the *new*
design rather than a moving target.

## Routing record

```
python scripts/sgps_prompt_router.py --mode AUDIT_PLAN \
  --signals "global elite benchmark standard, top tier design, performance speed budget,
             perceived performance, experience metrics, ui ux polish, competitive benchmark" \
  --repo "C:/00. AI Project/PRJ_AutoAllowMUSE"
→ pack=owner-dir-2026-10-04 pack_verified=YES · ROLES: experience
→ LOAD: 00_SGPS_COMMON_EXECUTION_KERNEL_v1.0 + 01_SGPS_AI_FACTORY_MASTER_v2.0 +
        03_SGPS_PREMIUM_EXPERIENCE_v4.0
→ experience signals matched: ux, ui, experience, design, perceived
```

Stage -1 gates run first (live-truth rebind before any claim or verdict). Every measurement
binds to `MEASURED_ON_SHA` + the loaded-extension revision; a HEAD change invalidates the
measurement, never silently reuses it.

## Rule: benchmarks are measured, not asserted

- Every number in the report is produced by a harness in this repo (CDP lane, real Chrome,
  scratch profile) and pasted with its command; **no invented or estimated figures**.
- Each axis gets: `BASELINE (measured) → TARGET (sourced) → DELTA (measured after) → verdict`.
- Targets must cite a real external reference (Chrome extension best practices, published
  performance budgets, named best-in-class products/design systems) — "elite" without a
  source is not a target.
- Vision QA scores stay qualitative and are labelled as such; they never stand in for a
  measured metric.
- Maker != judge: the lane that implements an upgrade does not certify its own measurement;
  an independent verification pass re-runs the harness on the frozen revision.

## Axis 1 — Speed (tốc độ)

| Metric | Method (proposed) |
|---|---|
| Popup open → painted (cold / warm) | CDP trace over N=20 opens, report median + p95 |
| Content-script scan cost per sweep | Synthetic heavy DOM fixture; ms per sweep, median + p95 |
| Detect → click latency on an approval card | Harness timestamps (fixture), median + p95 |
| Service-worker wake cost | Chrome `serviceWorker` CDP events; cold-start ms |
| Storage write amplification | Writes per click / per follow-up (instrumented counter) |
| Memory footprint (idle / during sweeps) | Chrome memory metrics via CDP |
| Package size | Bytes per file + total zip; hard budget check in `scripts/lint.mjs` |
| Popup layout stability | No layout shift in any state; height <=600 px everywhere (existing gate) |

## Axis 2 — UI / design (giao diện)

Reference base: `docs/QUIET_LUXURY_SPEC.md` (tokens, computed contrasts, motion, a11y) plus
`docs/BRANDING.md`. Benchmarked dimensions: token discipline (zero ad-hoc colours), type
scale + rhythm, contrast (all text pairs >=4.5:1), focus-visible everywhere, dark/light
parity, density at the 320 px popup width, **i18n expansion** (vi/zh_CN/ja/ko/es longer
strings must not overflow or clip), iconography, empty/error/loading states, motion budget
(<=200 ms, reduced-motion honoured), and stats-surface coherence.

## Axis 3 — Experience (trải nghiệm)

Time-to-first-value (install → first successful auto-allow), setup friction (onboarding
steps actually needed), trust signals (what happened and why, per-action reason, undo),
error recovery paths, digest/notification usefulness, feature discoverability, keyboard-only
path, screen-reader path, and failure honesty (never a silent wrong click).

## Deliverables

1. `docs/ELITE_BENCHMARK_REPORT.md` — measured baseline vs sourced targets vs gaps, per axis,
   with commands and raw numbers.
2. A ranked upgrade wave plan (E1..En) derived from the gaps, each item with a falsifiable
   acceptance criterion.
3. The upgrade waves themselves, executed under the standing non-stop law, each proven by
   re-measurement on the frozen revision.

## Instrument calibration — vision scores are NOT an acceptance gate (measured 2026-10-10)

The design axis was originally gated on a vision score (">=8/10 premium"). The iteration lane
proved that gate unsound, and the coordinator reproduced the evidence:

- In ONE session, with one identical prompt: the phase-1 mockup scored **5/10** (recorded 8/10
  in its own round), the Statistics page scored **5/10** (recorded 9/10), and the SAME popup
  render scored **6, then 4, then 7, then 3** across passes.
- One pass "found" a typo (`vour`) that does not exist in the DOM; another called the today
  legend dot a different colour from the today bar although both are painted with the same
  `--c-now` gradient (verified in the CSS).
- The coordinator's own pass on the same render scored 3/10 while an earlier pass on the
  pre-iteration render scored 6/10 — a 3-point swing with no code change between the prompts'
  subjects.

**Rule that follows:** vision stays a DIRECTIONAL signal (does this look better/worse than the
other render in THIS session?) and must always be anchored by scoring the known references in
the same session. Design acceptance is DETERMINISTIC:

| Criterion | How it is checked |
|---|---|
| Alignment grid conformance | measured element right/left edges == the declared content column |
| Contrast | computed ratios from the shipped tokens + pixel verification in the render (text >=4.5:1, non-text >=3:1, documented decorative exceptions) |
| Spacing ladder | declared scale (2/4/6/8/12/16/20/24/32/40) — no off-ladder values |
| Browser-default artifacts | none: no native resize handle, no unthemed scrollbar, no text-triangle chevrons |
| i18n | no overflow/clipping in any of the 6 locales at worst-case content |
| Heights | popup <=600 px in every state (harness-asserted) |
| Functional | all 5 suites green |

A vision score may still be REPORTED (labelled directional, with its anchors), but it can no
longer pass or fail this round.

## Exit criteria

- Every axis either MEETS its sourced target or is reported `NOT_MET` with rationale and a
  queued follow-up — never silently dropped.
- No regression: `scripts/lint.mjs`, `test/e2e.mjs`, `test/followup-e2e.mjs`,
  `test/background-unit.mjs` all green; popup <=600 px in every state.
- Independent verification of the final numbers on the frozen revision.

## Non-goals

- No payment/entitlement surface (SGPS S9–S11 remain NOT_APPLICABLE for this product).
- No new permissions, no remote code, no network calls (the zero-network lint gate stays).
- No cosmetic churn that does not move a measured metric or a sourced design criterion.
