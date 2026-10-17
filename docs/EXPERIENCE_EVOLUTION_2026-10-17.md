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

## Ranked discovery shortlist — owner approval required

Targets: 10 God-tier + 10 Tier S+. At this baseline only **5 God-tier and 6 Tier S+** are independently useful enough to retain as hypotheses. These are NOT new defect findings or implementation approvals. All proposals require user validation and must reconcile with existing features and frozen decisions before progressing beyond QUALIFIED.

**Legend:** confidence H/M/L = source-supported / plausible but untested / concept without research. Effort S/M/L = relative complexity, not committed delivery time. Status is DISCOVERED or QUALIFIED until Owner explicitly approves.

| Priority / ID | User scenario and problem | Proposed experience and value | Evidence / confidence | Effort, dependencies and trade-off | Falsifiable acceptance / status |
|---|---|---|---|---|---|
| P1 GT-01 | New user sees YOLO, Dry-run, Pause and the global switch and cannot predict what will happen next | One *Effective Automation State* summary: Disabled / Paused / Log-only / Live / YOLO, with precise precedence and one direct corrective action; avoids unintended grants and support friction | `popup.js` stored flags, `background.js` pause, `content.js` gate; H for complexity, UX effect unmeasured | M; state machine documentation, runtime + accessibility matrix; risk of another dense panel | In blinded first-use test user states current effect in <5 s and recovers a blocked session without trial-and-error; QUALIFIED |
| P1 GT-02 | Experienced operator sees ordinary approvals blocked by generic keywords and switches to unrestricted YOLO | Intent-based *Safe / Guided / Fast* profiles on top of existing switches, with a reviewable delta before escalation and no silent opt-in; reduce over-blocking without forcing permanent high-risk mode | `CHANGELOG.md` records 3,816 blocked vs 2,250 clicked, including 3,273 `deploy` blocks; H for pain, M for proposed remedy | L; needs safety threat model, migrate/rollback semantics, owner approval; risk profile labels become misleading | Users complete representative deployment task faster with no extra unintended standing grants; QUALIFIED |
| P2 GT-03 | Operator wants to understand *why* a request was clicked or skipped without interpreting raw IDs | Existing local audit log becomes an actionable explanation with recognized approval context, explicit scope, and “review in Muse” where safe; trust + reduced investigation time | Current `blockedReason` and log exist (`popup.js`, `content.js`); M, journey not measured | M; redaction/privacy, card identity persistence; risk leaking sensitive approval text | Each test event has accurate reason; 0 cross-site disclosure and no confusing false links; DISCOVERED |
| P2 GT-04 | First-time user cannot distinguish one-time versus standing permission grant and skips wizard | Add a guided, non-automating “would click / would not click” example to existing 3-step onboarding, with explicit default log-only state; informed consent | `popup.html` onboard, `test/e2e.mjs` dry-phase, v1.9.4 standing grant path; H for mechanics, L for uplift | M; existing wizard height and i18n x6; risk added friction | First-run test improves scope comprehension without materially increasing setup abandonment; DISCOVERED |
| P2 GT-05 | Returning operator sees counts but not what to inspect after a long unattended run | Evolve existing startup digest into an opt-in *review-first* summary: high-risk grant class, blocked causes, last active mode, suggested human review; no automated security decisions | Startup digest and counters in `background.js`; M, no user study | M/L; reliable local aggregation + retention/privacy rules; risk alert fatigue | Operators identify high-risk sessions in one step, false-risk labels excluded by test corpus; DISCOVERED |
| P1 TS-01 | Existing release engineer cannot trust a red end-to-end signal | Restore deterministic Chrome E2E without weakening guard assertions; make failure diagnostics pinpoint stage + state | Main CI `38346798215` + PR #1 CI `38993147910` both E2E FAIL; H | M/L; Windows Chrome CDP, race investigation, falsification; risk hiding actual engine bug | 13 expected approvals, no Deny/forbidden, dry-run opt-in and YOLO negative/positive fixtures all PASS in same workflow; QUALIFIED, issue #2 |
| P2 TS-02 | Keyboard/assistive-tech user opens Safety, Missions or consent modal | Independent focus-return, modal inertness, confirmation live-announcement test in all 6 locales | `popup.js` modal inert and `popup.html` aria; older historical audit, current SHA unverified; M | S/M; Chrome AX tree/screen reader; risk async announcements; no design overhaul | 0 keyboard traps, every destructive confirmation announced, focus returns on Escape; QUALIFIED |
| P2 TS-03 | User operates Chrome with zoom, larger text or long translations | Re-run 320px popup/600px height reflow, language overflow and statistics-page responsive checks at current SHA | `docs/UI_V19.md` historical 594px crowded layout, `EXPERIENCE_REVIEW_V17.md` historical reflow issue; M | M; real rendered Chrome x6 locales and OS scaling; risk treating unsupported popup zoom as product bug | No inaccessible controls, clipped labels or wrong focus; report platform-specific limitations; DISCOVERED |
| P2 TS-04 | Non-English first-time user does not understand “YOLO”, “connector”, “rotation”, “cooldown” | Native-level UX microcopy review with consistent action-based naming; preserve technical precision and brand tone | 177 locale keys x6 in v1.9.4, `docs/UX_COPY_REVIEW.md` older partial coverage; H for gap, L for comprehension | M; native reviewers + localization regression; risk semantic drift | Localized terminology glossary and comprehension-tested top tasks; DISCOVERED |
| P2 TS-05 | User edits topic/keyword filters but cannot tell whether changes are *enforced* | Label saved-vs-effective restrictions, inline explanatory copy in current Safety sheet, no new settings hierarchy | Current source confirmed YOLO bypass; first corrective wave covers copy only; H | S/M; depends on GT-01 if a new state summary is adopted; risk duplicate warnings | While YOLO active, zero UI claims “never clicked” or implies the rule was applied; QUALIFIED |
| P2 TS-06 | User switches several controls across Disabled, Pause, Dry-run and YOLO and sees potentially conflicting signals | Regression matrix for effective-state chip, log banner, buttons, confirmation and manual-send feedback, with visual/AX assertions | `renderDry`, `renderPause`, `renderRules`, source message maps; H for combinations | M; likely nested state precedence, scope limited to existing controls; risk retesting without behavior coverage | State table on rendered Chrome has no contradictory signals, and all negative tests remain green; DISCOVERED |

**Reconciliation:** Existing blocked reason in logs, startup digest, pause control, manual-send failure messaging, safety sheet, brand, Missions and phrase library are implemented today. Suggestions above improve or compose those capabilities, not claim they are missing. Product research and actual customer adoption metrics remain **NOT VERIFIED**.

## Acceptance and release gates

- E1 source: exact old-state defects corrected, without touching `content.js` and `background.js`.
- E2: `node scripts/lint.mjs`; `node test/yolo-ux-unit.mjs`; existing Windows E2E. Do not mislabel any failure as PASS.
- E3: inspect Chrome popup and Safety modal on the built extension, keyboard/AX tree, six locales, zoom 125/150/200%, 600px cap.
- E4: end-to-end first-run Dry-run, explicit live consent, YOLO double-confirm, back to Dry-run, restoration of saved rules, import/sync and failure recovery.
- E5: deployed Chrome Web Store version and exact artifact SHA; NOT VERIFIED without matching evidence.

**Rollback:** revert focused PR. No migration is required. The main CI failure is pre-existing; merge/release are blocked until relevant required checks pass and receive independent review.
