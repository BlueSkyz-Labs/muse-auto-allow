# Experience Cycle — 2026-10-18 (SGPS Premium Experience vNext 1.1, PROPOSAL-FIRST)

Owner mandate: "làm vòng nâng cấp giao diện… ủy quyền tự thực thi toàn diện, tự quyết" +
"tự động thực thi lặp lại đến khi trạng thái hoàn hảo". Cycle ran on `main @ f4cf2ec`
(v1.10.0, PR #5 merged, CI green) with full delegated authority inside the standing limits
(frozen brand/geometry decisions, no new permissions, safety rails untouched).

## 1. Fresh truth (audited, not assumed)

- main `f4cf2ec`; only open issue: #3 (drift reconciliation) awaiting owner sign-off.
- Prior-cycle docs re-read: `EXPERIENCE_EVOLUTION_2026-10-17.md`, `UI_UPGRADE_ROUND.md`,
  `UI_V19.md`, `QUIET_LUXURY_SPEC.md` (landed), `ELITE_BENCHMARK_REPORT.md`,
  `GLOBAL_ELITE_BENCHMARK_ROUND.md` (vision scores are NOT a gate — documented calibration).
- Rendered audit of the LIVE UI at the frozen revision (own scratch Chrome, tight crops):
  popup default 431px / crowded 602px (log viewport 14px) / stats 816px, light + dark,
  plus code cross-checks (stats.js, popup.js, harnesses). Two capture artifacts were
  identified and corrected (viewport padding; OS-dark default) — findings built on the
  corrected set; per-capture vision noise recorded honestly in the working notes.

## 2. Candidate catalog → red-team → verdicts

21 candidates (G01–G10, S01–S10) were adversarially reviewed by an independent subagent at
the frozen tree (read-only), then 9 post-freeze items (S11, S13, G11, A1–A6) got a second
independent pass. Verdicts (final, after both rounds):

| Kept / refined (approved, actionable) | Score | Note |
|---|---|---|
| G01 — single effective-automation-state line (reuses the existing #logTop slot) | 94 | Wave 2 #1 |
| G11 — standing-grant class recorded structurally (boolean at the two log sites; never a new kind string) | 78 | prereq of G02's filter; RT shape pinned |
| G02 — approval journal on the Statistics page (aggregates only; no decrypt duplication into stats) | 77 | Wave 2 |
| G07 — blocked-entry one-tap deep link to the Safety keyword section (deep link only; no suggested-exception nudge) | 75 | Wave 2 |
| G03 — onboarding copy naming what would be clicked (static lines; no simulated clickable card) | 71 | Wave 2 |
| S12 — localized detailed descriptions carry the Codex bullets | 75 | **executed (wave 1)** |
| A2 — stats chart ticks follow the UI locale (`Intl.DateTimeFormat`) | 74 | **executed (wave 1)** |
| S07′ — topics panel caption stating its scope + denominator (A3 merged into S07 per RT2) | 72 | **executed (wave 1)** |
| S08 — Codex strings copy review ×6 locales | 71 | **executed (wave 1)** |
| S01 — store assets regenerated at the frozen tree | 77 | **executed (wave 1)** |
| S03 — deterministic dark-scheme assertions (F6) | 65 | **executed (wave 1)** |
| S06 — KPI deltas, only with honest single-line semantics | 64 | Wave 2 (conditional) |
| S04 — OS-scaling / zoom matrix recorded per locale (documented limits, no popup-zoom feature) | 62 | Wave 2 |
| S11 — memory attribution spike first; 5 MB target dropped until attribution shows it is the script's own retained data | 61 | Wave 2 (spike) |

Validation-class (owner decision, not implemented here): **G04** (intent profiles — needs the
GT-02 threat model + migrate/rollback semantics) and **G10** (locale-aware label matching —
own security round; touching the matcher multiplies the never-Deny proof surface). Both
deferred to a dedicated discovery/security round with owner sign-off.

Rejected with recorded reasons: G05 (in-page pill — page can hide/fake it; the action badge
already exists), G06 (digest duplicates shipped digest + popup block), G08 (per-engine panel —
v1.10.0 surfaces already ship; schema risk), G09 (trust export — export exists; plaintext
review file reverses encrypted-at-rest posture), S02 (header churn against a frozen,
verified composition), S05 (empty states already ship; no observable gap), S09 (mini-chart
legend — C6/C7 landed), S10 (onboarding visual churn — keyboard bit folded into S03),
S13 (digest localization — fallback already shipped; duplicated i18n layer), A1 (log
min-height in the crowded state — re-litigates the frozen ≤600px budget lever), A4
(safety-panel heading — the toggle-as-heading pattern is shipped and consistent), A5
(follow-up off-state wording — reviewer-inferred; routed to TS-04), A6 (count badge —
spec-frozen C7, intentional).

No filler was added to reach 10+10: 7 God-tier + 9 Tier S+ survived the quality bar; the
remaining seats were refused rather than synthetic (contract §1).

## 3. Wave 1 — executed in this cycle (ships as v1.10.1)

- **S01** assets: `screenshot1/2/3/5` regenerated (Codex chip + codex/blocked log rows in the
  captures; all five assets 1280×800 re-verified); store docs updated. `screenshot4`/promo/
  marquee/hero are designed compositions (unchanged).
- **S12** copy: five localized detailed descriptions now carry the Codex bullets (the v1.10.0
  TO-DO closed in `LISTING.md` + `CWS_SUBMISSION_PACK.md`).
- **S08** review: 11 Codex keys ×6 locales reviewed; ja `codexHint` strengthened
  ("Deny は決して…"); recorded in `UX_COPY_REVIEW.md` (addendum).
- **A2** stats locale dates + **S07′** topics scope caption (`statsBarScopeTop/Scope`,
  192 keys ×6, parity green); bar denominator = all-time total.
- **S03** harness F6: dark palette tokens parsed from the shipped stylesheet, fragment
  rendering asserted, no height drift across schemes, ≥4.5:1 body/title contrast in both
  schemes (assert suite 28 checks).

## 4. Wave 2 — approved queue (next cycle, not started here)

Order: G01 → G11 (with G02's journal filters riding it) → G02 → G07 → G03 → S06 → S04 → S11.
Each item follows the same gate battery and the same red-team discipline; G04/G10 stay in
VALIDATE until an owner decision.

## 5. Limits & honesty notes

- Vision reviews are directional only (noisy instrument, documented calibration); all gates
  that fail CI are deterministic (lint/unit/e2e/assert/falsification), never vision scores.
- The audit's "no topic" 432-vs-489 demonstration was a fixture artifact; the shipped truth
  is that `recordClick` gives every counted click a topic (remainders = pruned/legacy data) —
  hence the caption approach over an "other" row.
- The stats page follows the BROWSER UI locale; the popup's manual language switcher does not
  reach it (recorded in `stats.js`, TS-04 class).
- v1.10.0's own release notes carry the historical record; artifact values for v1.10.1 live in
  `CHANGELOG.md` and `docs/RELEASE_INTEGRITY.md` (freeze battery, 2026-10-18).
