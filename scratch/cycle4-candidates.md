# Cycle 4 candidates — audited & verified (2026-10-18, post-v1.12.0) — FINAL ROUND

Sources: 2 bounded read-only audit subagents (deleg_1f0c7605) — engines (content.js/codex.js) and
background/stats/popup. Task 2 EXECUTED real function bodies to prove findings. Every claim below
re-verified in-session against the cited code. Verdicts are the main session's.

## CONFIRMED — fix in cycle 4 (v1.13.0)

### C4-A — migrate() × pullFromSync() race: fresh-device defaults shadow synced settings (background.js)
- Evidence: `background.js:305-310` `migrate(); pullFromSync();` (both async, unchained);
  `migrate():60-94` seeds absent keys (`enabled:true`/`minDelayMs:300`/`dryRun:true`/`yoloMode:false`/
  `codexEnabled:false` + schemaVersion); `pullFromSync():258-265` fills ONLY keys "absent from local".
  When migrate lands first, every seeded key blocks its synced value; `:301` then pushes local
  (defaults) over the shared sync bucket on `syncSettings` enable.
- Impact: a user's kill-switch (enabled:false) / live choice (dryRun:false) can be resurrected as
  defaults on a new device, then pushed across devices. Audit executed the bodies (FIFO model) to prove.
- Fix: chain pull BEFORE migrate for the absent-key seeding semantics — `pullFromSync(cb) → migrate()`
  in the cb; sync values fill absent keys first; migrate only seeds what remains absent. Keep
  explicit-local-wins. Effort M.
- Tests: background-unit additions (ordering semantics: sync beats fresh seeds; local explicit beats sync).

### C4-B — content.js boot race: first sweep can run before the kill-switch read lands
- Evidence: `content.js:148` state.enabled defaults true; `:1581-1586` enabled-read callback sets
  state.enabled and sweeps only `if (v18Ready)`; `:1592-1593` v18-read callback sets v18Ready and
  calls `sweep('init')` — if the v18 read wins the race, the first sweep runs while state.enabled is
  still the hardcoded default. codex.js fails closed on the same race (`state.enabled:false` default).
- Fix: gate the first sweep on BOTH reads (e.g. `enabledReady` flag; sweep only when enabledReady &&
  v18Ready). Effort S.

### C4-C — connector hard-block depth 1 on path A vs 2 on path B (content.js)
- Evidence: `:497` `connectorNear(card, 1)` (path A) vs `:533` `connectorNear(node, 2)` (path B);
  helper contract `:328-329` — "cards can render Connect in a wrapper AROUND the pair container"
  (why the default is 2). Path A checks only the card element, missing the wrapper level.
- Impact: a marked approval card whose Connect/token wording sits one level up gets its pair clicked
  by path A before path B can refuse. Safety-align. Fix: `connectorNear(card, 2)`. Effort S.

### C4-D — import honesty pack (stats.js)
- (1) "Replace" promise: `:482` confirm copy says "…will be replaced" but `:489` `set(clean)` only
  MERGES present keys — a partial backup leaves the old encrypted log + clickCount behind (executed
  proof in audit). Fix: remove data keys absent from the file (`log`/`stats`/`clickCount`) before the
  set — start-clean honest; restriction keys keep merge semantics (fail-closed) and the COPY is
  updated to say so (importConfirm value edit ×6 locales, no new keys).
- (2) ctx-bearing file with NO supplied key: `resolveImportedKey:431` returns
  `{adopt:null, kept:false, ok:true}` — no warning fires (`:491` gates on `kr.kept`) while every
  restored entry renders "(unable to decrypt)" forever. Fix: when the file carries ctx entries and no
  key was supplied, surface the existing `importKeyKept` alert (reuse — accurate copy, no new keys).
- Tests: import-security additions (data-key removal decision + kept-notice logic where testable).

### C4-E — approvalPresent() under-matches resolved cards → follow-up/mission stall
- Evidence: `:1167` `for (const card of querySelectorAll(CARD_SEL)) if (isVisible(card)) return true;`
  — no DONE_STATUS_RE/allowDoneCards filter (contrast `:1172` which filters pending-vs-done, and the
  click paths which skip resolved). Consumed at `:1362` `if (approvalPresent()) return {ok:false,
  reason:'approval-present'}` — while any (resolved) card renders visible, sending is refused forever.
- Fix: apply the engine's own resolved-status vocabulary to the CARD_SEL branch (skip
  DONE_STATUS_RE cards and allowDoneCards) so "approval present" means the click paths would act.
  Effort S. Validate via followup-e2e + QA vignette.

### C4-F — composer gone after submit is recorded "unverified" → mission/rotation stall
- Evidence: `:1411-1436` — `c = findComposer()` null → skips the delivered branch → `:1434` unverified,
  "will not retry until it is cleared" — but the composer is GONE (post-submit SPA swap), so the
  mission step and rotation never advance. The verify window runs post-submit already (tried ≥ 1).
- Fix: composer missing at verify time (after a submit attempt) counts as delivered → verified →
  mission advances. Trade documented (rare navigation during window). Effort S.

### C4-G — stats chart role="img" without an accessible name (WCAG 1.1.1)
- Evidence: `stats.html:198` `<svg id="chart" viewBox="0 0 720 158" role="img"></svg>` — no
  aria-label/labelledby anywhere (`#ccap` sibling never linked); role=img makes the per-bar
  `<title>`s presentational and suppresses them.
- Fix: link the caption (`aria-labelledby="ccap"`) and/or set aria-label with range+total each
  render. Effort S.

### C4-H — topics caption denominator can contradict the Total KPI (stats.js)
- Evidence: `:141` `const total = Math.max(num(TOTAL), sum, 1)` feeding `:149-150` caption
  ("share of the N-click total") while `:173` prints TOTAL on the KPI card — with legacy/pruned
  byTopic exceeding TOTAL, the caption states a number the KPI contradicts (audit executed it).
- Fix: denominator = the KPI's own number when > 0 (fallback to sum only when TOTAL == 0), with bar
  percentages clamped ≤ 100 so legacy rows can never overflow the track. Effort S.

## VERDICT: REJECT-with-reason (record)

### C4-I — Muse review-bar wording narrower than Codex (audit task 1 #5) — REJECT
- `/^review$/i` on muse vs the broader Codex BAR_BTN_RE is DELIBERATE fail-closed posture: muse's
  bar reliably says "Review"; broadening the open-control vocabulary on muse adds NEW click surface
  without live evidence of those labels there. Codex is a different product surface with its own
  sealed vocabulary. No change.

### C4-J — cooldown/dedup Map insertion-order eviction; codex digest TDZ order — REJECT (note)
- Eviction asymmetry is real only on pages with >300/200/200 distinct keys (never observed); the
  codex declaration order is unreachable today (top-level calls only after declarations). Recorded
  as known-minor; not worth final-round risk.

## CYCLE 4 PLAN (target: v1.13.0 — FINAL round, then convergence)

Scope: C4-A (M) · C4-B (S) · C4-C (S) · C4-D (S, +copy edit ×6) · C4-E (S) · C4-F (S) · C4-G (S) ·
C4-H (S). Rejects recorded (C4-I/J).
Checks: lint · bgu (+ordering checks) · import-security (+C4-D checks) · e2e · followup-e2e ·
mission-e2e · lang-switch · codex · assert F6 · QA v1130 (approvalPresent vignette; import
data-replace + no-key notice dialogs; stats aria; topics caption) · build/verify/smoke · store shots
(popup unchanged visually? chevron/none → no popup visual change expected → shots only if changed) ·
docs train v1.13.0 · PR #9 · CI · merge · tag · release · FINAL 7-part report (Vietnamese).
Red-team: bounded subagent review of the v1.13.0 diff (schema with properties).

## RED-TEAM RESULTS (v1.13.0 diff; subagent sa-0-f8fc8a74, 13m47s, schema-corrected)

- **Claim 1 (pullFromSync `fin` fires exactly once on every path): PASS with caveat** — a throw
  inside the `local.get` async callback (outside the outer try's dynamic extent) fired `fin` ZERO
  times, so `migrate()` would never run. **FIXED** — the callback body now has its own try; `fin`
  always fires exactly once.
- **Claim 2 (no sweep before both reads land): PASS** — all callers funnel through `sweep()`;
  the v18Ready + enabledReady gates precede every click path; the flags are set only after their
  reads apply; no digest path sweeps.
- **Claim 3 (approvalPresent cannot miss a pending card): FAIL** — `DONE_STATUS_RE` is unanchored
  and was tested against the WHOLE card text: a genuinely pending card carrying e.g. "denied ·"
  anywhere was skipped (and "Approved ·"/"Cancelled ·" resolved cards still blocked; path A's
  actionable set differed). **FIXED** — the card branch now uses the structural actionable-pair
  predicate (SURFACE_SEL/visible/allowDoneCards + clickable deny AND unhandled clickable allow =
  path A's ground truth minus pacing; it can only OVER-count, which blocks more = fail-safe).
  Residual nuance recorded: the pre-existing (v1.9.1) collapsed-card button branch keeps its text
  guard — not introduced by this wave.
- **Claim 4 (composer-gone reachable only post-submit): PASS with caveat** — the first submit's
  return value was ignored, so a FAILED 'button' submit still armed the verifier and a vanished
  composer could count as delivered. **FIXED** — the verify window arms only when a submit
  actually fired (the other strategy is tried once; both-fail records unverified immediately,
  reason 'submit-failed').
- **Claim 5 (set→remove order + no-key notice): PASS** — `set` precedes `remove` (a quota
  rejection leaves the old data = merge semantics, no loss); the notice requires `!clean.cryptKeyRaw`
  after the sanitizer and a file-carried key is adopted or the import aborts. Nuance: a malformed
  key dropped by the sanitizer can reach the notice — the shared `importKeyKept` message stays
  accurate for that case.
- Child's residual notes: `codex.js` shares `DONE_STATUS_RE` (:87/:524); codex's sweep gates only
  on v18Ready but its `state.enabled` defaults false — fail-closed, no change needed.
