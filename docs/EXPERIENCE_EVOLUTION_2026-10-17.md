# Muse SGPS Experience — trust-state correction and discovery (2026-10-17)

**Project:** BlueSkyz-Labs/muse-auto-allow  
**Baseline:** `main@5d5860d3e0442fd7bc01bef93527ba55df9777d4` (v1.9.4)  
**Implementation:** isolated UX bug-fix branch. New functionality remains **DISCOVERED** and is **not approved**.  
**Authority:** `docs/SGPS_EXPERIENCE_ADOPTION.md` routes SGPS Experience v4.0, Release v1.0, Common Execution Kernel v1.0. Brand Kit v2 is unchanged. No `AGENTS.md` in repository root at baseline.

## Evidence and finding

1. **P1 — misleading active-mode chip:** `renderDry()` showed YOLO over Dry-run when `yoloMode:true, dryRun:true`; engine's Dry-run overrides clicks. Status must represent actual effect instead of an enabled preference.
2. **P1 — deceptive rule copy during YOLO:** `extension/content.js` explicitly bypasses `allowTopics` and `blockKeywords` when YOLO is active. The Safety panel previously claimed keyword cards are *never clicked* and topic allow-list *always limits clicks*. Reword based on persisted state.
3. **P1 — existing CI not green:** main workflow `38346798215`: lint succeeds, Windows Chrome E2E fails on both Dry-run pre-phase (`[object Object] is not valid JSON`) and YOLO phase (no observed positive clicks). Root cause unresolved. Not evidence of an exploited permission boundary; never waive the tests to get green.

## Wave A: safe UX correctness repair (in this PR)

- Prioritize the effective no-click Dry-run status over YOLO mode in the header.
- Show translated `YOLO is configured but Dry-run is on` and `saved rule lists are bypassed` explanations when applicable.
- Re-read persisted Safety toggles while modal remains open, including changes from sync/import/another popup; do not dismiss a two-step consent mid-confirmation.
- Make the changing YOLO explanatory note a polite live region.
- Add exactly two locale keys in all six supported locales and preserve key parity.
- Add a zero-dependency renderer-level unit harness to CI.
- Do not change manifest version, approval engine, security guards, brand tokens or locked assets.

## Proposed further discovery — for owner review, not implementation

| ID | Tier | Candidate | Evidence status | Acceptance hypothesis |
|---|---|---|---|---|
| GT-01 | God-tier | Single *Effective Automation State* explaining Disabled / Paused / Logging-only / Live / YOLO with precedence | QUALIFIED (logic/source), UX NOT VERIFIED | User identifies what extension will do in <5 seconds |
| GT-02 | God-tier | Intent-based autonomy profiles (Safe / Guided / Fast) mapped to current settings | DISCOVERED | Fewer errors, explicit grants, no invisible relaxation |
| GT-03 | God-tier | Explain-why for each event based on the current local log | DISCOVERED | One tap explains auto/blocked event; no secret text |
| GT-04 | God-tier | First-run guided preview: ordinary grant vs standing grant | DISCOVERED | Informed consent comprehension improves |
| GT-05 | God-tier | Session-level safety digest with pause/stop recommendations | DISCOVERED | Trust improves without notification fatigue |
| TS-01 | Tier S+ | UI screen-reader focus and two-step confirmation regression | QUALIFIED (source gap) | E3 confirms focus announcements in six locales |
| TS-02 | Tier S+ | Repair red Windows E2E and add mutation-backed guard checks | QUALIFIED (CI log) | Original red reproduced, fix stays green; mutant red |
| TS-03 | Tier S+ | Zoom 125–200% + worst-case i18n overflow sweep | DISCOVERED | All visible controls reachable, no clipping |
| TS-04 | Tier S+ | Simplify technical terms in VI/JA/KO/ES with native QA | DISCOVERED | Faster comprehension on first use |
| TS-05 | Tier S+ | Accessible rules editor: distinct “configured vs enforced” status | QUALIFIED (source) | Zero false guarantee while YOLO bypass active |
| TS-06 | Tier S+ | Persisted-settings feedback and failure recovery messaging | DISCOVERED | User knows when a setting actually saved |

**No quota-filling:** fewer than 10 in each tier until evidence warrants more. Competitor benchmarks and user studies: NOT VERIFIED.

## Acceptance and release gates

- E1 source: exact old-state defects corrected, without touching `content.js` and `background.js`.
- E2: `node scripts/lint.mjs`; `node test/yolo-ux-unit.mjs`; existing Windows E2E. Do not mislabel any failure as PASS.
- E3: inspect Chrome popup and Safety modal on the built extension, keyboard/AX tree, six locales, zoom 125/150/200%, 600px cap.
- E4: end-to-end first-run Dry-run, explicit live consent, YOLO double-confirm, back to Dry-run, restoration of saved rules, import/sync and failure recovery.
- E5: deployed Chrome Web Store version and exact artifact SHA; NOT VERIFIED without matching evidence.

**Rollback:** revert focused PR. No migration is required. The main CI failure is pre-existing; merge/release are blocked until relevant required checks pass and receive independent review.
