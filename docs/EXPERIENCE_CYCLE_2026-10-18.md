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

## Wave 2 — executed (v1.11.0)

- **G01** effective-state line: one always-visible line inside the log's sticky `#logTop` band
  showing Off / Paused (with a one-tap Resume on the line) / Log-only (the existing banner) /
  Live / YOLO + watched-surface tab counts. Lives inside the log's scroll area, so it costs the
  popup zero height. 3 new state-word keys ×6 locales (`stateOff`/`stateLive`/`stateYolo`) —
  no honest shipped string existed for those states. An in-Chrome QA pass caught that the first
  build read a storage field the popup never carried (`v18.enabled`); fixed to read the canonical
  toggle checkbox before any gate ran.
- **G11** standing-grant class recorded structurally: boolean `standing: true` on the log entry
  at both engines' single log sites (`content.js` `doClick` 'allow' branch under YOLO;
  `codex.js` `doClick` 'codex-allow'). Never a new kind string. The export/import sanitizer
  round-trips it (boolean-only, junk dropped); the import-security suite grew 142 → 145 checks.
- **G07** blocked-entry deep link: a chevron on blocked log rows opens Safety & Control at the
  `#kwGroup` keyword group and focuses `#kwInput`. Deep link only.
- **G03** onboarding step 2 static list: 3 non-interactive lines (click / keyword-block-skip /
  standing-grant-left-to-you), keys `onbDemoClick`/`onbDemoBlock`/`onbDemoStanding` ×6 locales.
- **i18n** parity: 199 keys ×6 locales.
- **Multi-agent note:** this wave used the delegation pipeline on a free `step-5-preview` model
  for bounded tasks — a probe task succeeded (24.6s, verified answers) and a repo edit task
  applied one correct sanitizer line before stalling; three long multi-step tasks were
  interrupted at ~16 min (provider/model stalls on long generations), so the carry-over work
  (locale values, the test additions, the independent review) was completed and verified in the
  main session instead. Delegation now runs with a 600s child timeout guard (config
  `delegation.child_timeout_seconds`).
- **Honest caveat:** no independent subagent review of wave 2 completed. The main session's QA
  pass + the deterministic suites are the wave-2 verification of record.

## Wave 3 — executed (v1.12.0)

- **AUDIT (subagent-assisted, every claim re-verified in-session):** a bounded read-only audit
  subagent produced 5 candidates from the v1.11.0 tree; the main session re-checked each against
  the cited code — **3 confirmed defects, 1 by-design (recorded as a feature), 1 rejected with
  reason** (`scratch/cycle3-candidates.md`).
- **C3-1 backup restore keeps authority opt-ins:** `yoloMode`/`codexEnabled` now round-trip
  through export/import (were silently dropped); an import that would turn one ON from off asks
  first ("This backup turns on: YOLO — continue?") — no silent authority grants; turning off /
  junk stays prompt-free and fail-closed. Blocked entries keep `blockedReason` across a restore.
  `import-security` 145 → **150 checks** (G12).
- **C3-2 state-line precedence:** dry > off > paused > YOLO > live — with the toggle off during a
  live pause the line no longer reads "Paused" (with a hidden Resume) while the pause row showed
  one; off is the effective truth.
- **C3-3 reason-aware blocked deep link:** `keyword:<kw>` → keyword list, `topic` →
  allowed-topics list, `connector` (consent boundary) / reason-less → **no chevron** (a dead-end
  link is worse than none).
- **C3-4 standing-grant mark:** standing rows carry a quiet aria-labelled lock — "what permanent
  access did this tool grant?" is now answerable from the popup.
- **i18n:** 202 keys × 6 locales (`logOpenTopics`, `logStanding`, `importAuthorityWarn`).
- **Red-team:** a bounded subagent reviewed the diff for bypasses (4 claims); its final summary
  line was lost to a harness artifact (an empty `output_schema`), so the findings were recovered
  from its transcript and re-verified in-session — **4/4 PASS** on file+line evidence (single
  gated `storage.local.set` in stats.js; chevron UI-only + esc()'d; standing `=== true`-typed;
  `$1` present in all six locales). Recorded: `docs/RELEASE_INTEGRITY.md` (v1.12.0 evidence).
- **Caught by in-Chrome QA before any gate:** the authority dialog initially showed an empty
  `$1` (stats page helper is `tp()`, not `t()`) — fixed; QA re-run speaks the full sentence.
- **Gates:** lint 0 (27) · bgu 32/32 · ims 150/0 · yolo 5/5 · e2e 0 · followup 0 · mission 0 ·
  lang-switch 24/24 @202 keys · codex 0 (4 phases) · assert 28/0 · verify-zip 19/0/0/0 ·
  determinism 2× identical · smoke 20/20. Artifact: `dist/muse-auto-allow-v1.12.0.zip` —
  208,315 bytes, 19 entries, sha256 `d46006bf…10bb`.

## Wave 4 — executed (v1.13.0) — FINAL round

- **AUDIT:** two bounded read-only subagents (engines; background/stats/popup) produced 10
  candidates; the main session re-verified every claim against the cited code — **8 confirmed
  fixes, 2 rejected with reason** (`scratch/cycle4-candidates.md`). Task 2 executed the real
  function bodies to prove its findings.
- **C4-A** `onInstalled` chains pull→migrate: synced values fill absent keys BEFORE the
  fresh-install seeds, so a synced kill-switch/live choice can never be shadowed by defaults —
  nor pushed back over the sync bucket. bgu 32→35 (G2a/b/c).
- **C4-B** sweeps wait for BOTH the v18 read and the enabled read; the gate lives inside
  `sweep()` so observer-driven sweeps are covered too (self-review caught that the caller-side
  gate alone left the observer path open).
- **C4-C** connector hard-block depth aligned — path A climbs 2 levels like path B.
- **C4-D** honest restore: log/stats/clickCount absent from a file are removed (set-first,
  remove-second: a quota-failed set can't lose data — self-review reordered this); restrictions
  keep fail-closed merge; confirm copy rewritten ×6; a ctx-bearing file with no key gets the
  kept-key notice. ims 150→154 (G13).
- **C4-E** `approvalPresent()` applies the click paths' own resolved vocabulary — a lingering
  allowed card no longer blocks every follow-up/mission send.
- **C4-F** a composer that disappears after a submit counts as delivered — missions/rotation
  advance (documented trade: a mid-window navigation counts as delivered).
- **C4-G** chart accessible name (`aria-labelledby="ccap"`); **C4-H** topics caption follows the
  Total KPI with bars clamped ≤100%.
- **Rejected with reason:** Muse review-bar wording broadening; cooldown-eviction order + codex
  digest declaration order (known-minor / unreachable).
- **Checks:** lint 0 (27) · bgu **35/35** · ims **154/0** · yolo 5/5 · e2e 0 · followup 0 ·
  mission 0 · lang 24/24 @202 keys · codex 0 (4 phases) · assert 28/0 · verify-zip 19/0/0/0 ·
  determinism 2× identical · smoke 20/20. QA v1.13.0 (pre-battery): aria + caption "share of the
  5-click total" (bars capped on synthetic legacy data) + data-restart + no-key + flip-confirm
  all correct. Artifact: `dist/muse-auto-allow-v1.13.0.zip` — 210,496 bytes, 19 entries,
  sha256 `aaaa3fd2…3ad2`. Red-team (bounded subagent, schema-corrected): 2 PASS+caveats (both
  FIXED — pullFromSync async-callback try; submit-arming only on a real submit), 1 FAIL FIXED
  (approvalPresent re-implemented with the structural actionable-pair predicate), 2 PASS+nuances;
  verdicts in `scratch/cycle4-candidates.md`. +1 i18n key (`followupSendBlockedSubmit`, flagged
  by the F2 reason-coverage assert) → 203 keys × 6.

## SGPS:Experience pass (overnight 2026-10-18/19, on the frozen v1.14.0 tree)

Instrument: `docs/SGPS_EXPERIENCE_CHECKLIST.md` (standard-derived, 30 items; machine-checkable
subset automated in `qa-experience`). Result: **v2 — 11/11 PASS** (`scratch/experience-v2.json`):
WCAG AA contrast in both themes on popup + stats, `prefers-reduced-motion` fully honored,
`:focus-visible` coverage incl. the `.numwrap` wrapper-ring pattern, `vi` long-string layout
without overflow, state communicated as text (dry-run band / live state line). The v1 probe's
3 reported failures were **probe defects** (color-scheme emulation race + wrong selectors) —
recorded as LSN-007; nothing was filed as a product defect without live re-derivation.
Residual manual-class evidence (screen-reader pass, beauty-blind review, 200%-zoom pass) is the
next experience cycle's scope; deviation-recording rules (GUX §20) apply if any FAIL is accepted.
