# Cycle 3 candidates — audited & verified against code (2026-10-18, post-v1.11.0)

Source: subagent audit (deleg_4c037f7c task 4) — every claim re-verified by reading the cited code
in the main session. Verdicts below are OURS, not the subagent's.

## VERDICT: CONFIRMED defects (fix in cycle 3)

### C3-1 — BACKUP RESTORE drops `yoloMode` + `codexEnabled` (stats.js sanitizeBackup)
- Evidence: `stats.js:282-384` — the whitelist carries `enabled/minDelayMs/clickCount/log/stats/
  followup*/pauseUntil/dryRun/allowOnceMode/syncSettings/missionEnabled/onboarded/userLocale/
  rules{allowTopics,blockKeywords}/followupSmart/followupSchedule/mission/cryptKeyRaw`.
  **No `yoloMode`, no `codexEnabled`.** Restore writes the sanitized object → both real user
  opt-ins silently vanish on restore.
- Impact: a legit user's own backup round-trip loses YOLO + Codex settings without a word.
- Nuance (original design): the whitelist deliberately "can only tighten or preserve, never clear"
  (stats.js:351) — NOT carrying YOLO means a crafted import can never GRANT YOLO. Options for the
  fix: (a) carry both booleans as-is; (b) carry only when `false`; (c) carry + import-UI notice
  when the file would ENABLE an authority ("this backup turns on YOLO — confirm"). Red-team it.
- Related: log entries lose `blockedReason` (`stats.js:288-296` builds {at,kind,label} only).
  Restored blocked rows render the chip without its reason/aria-label while `.kopen` still shows.
- Effort: S (+ suite checks) / notice variant M.

### C3-2 — State line vs Pause row contradiction when Off ∧ Paused (popup.js)
- Evidence: `popup.js:1018-1028` token precedence `paused ? … : off ? …` → with toggle OFF and a live
  pause, the line reads "Paused until 14:00" while `canResume = paused && !off` hides its Resume —
  yet `renderPause()` (`popup.js:821-837`) independently shows the #pauseActive row WITH its Resume.
  Effective truth = Off (nothing clicks). Two readouts disagree in one popup.
- Fix: token precedence → off before paused (dry > off > paused > YOLO > live); QA case off+paused.
- Effort: S.

### C3-3 — `.kopen` deep-links to keyword rules for blocks keywords cannot resolve (popup.js)
- Evidence: `popup.js:600` gates only on `kCls === 'blocked'`; label hard-wired to
  `logOpenRules` ("Open the keyword rules"). But blocked reasons are `keyword:<kw>` (the keyword
  list CAN resolve), `topic` (allow-topics mismatch — different list), `connector`
  (`content.js:497` — hard consent boundary, `connectorNear`). Tapping the chevron on a
  connector/topic block lands in an editor with no bearing on the block.
- Fix: reason-aware deep link — `keyword*` → keyword group (current), `topic` → the allow-topics
  group, `connector` → no chevron at all. aria-label per target. Effort: S.

## VERDICT: feature candidate (not a defect)

### C3-4 — `standing` is write-only (popup.js renderLog never reads it)
- Evidence: set at `content.js:772/790`, `codex.js:445/463`; round-trips via sanitizer
  (`stats.js:294`); `renderLog` (`popup.js:555-608`) never reads `e.standing`. The G11 comment
  says "later surfaces can then tell" — by design interim.
- Candidate: a subtle standing-grant marker on log rows (e.g. small glyph + aria "granted
  standing access") — answers "what permanent access did this tool grant?". Effort: S/M.

## VERDICT: REJECT-with-note

### C3-0 — "state line hidden in dry-run = dead on arrival" (audit #1) — REJECT
- The dry-run first-run state shows the full #dryBand banner (logging-only, explicit); the state
  line yields BY DESIGN to it (`popup.js:1012-1013` + comment 1000-1002: "dry (the existing
  #dryBand banner carries it) > paused > off > YOLO > live"). Duplicating the banner with a line
  adds noise, not clarity. Keep. (Re-check at a future round if the banner shrinks.)

### Audit #5 codex "no YOLO guard" — NOT a defect
- `codex.js:445` sets standing without a local yolo check, but a standing-TEXT positive only
  exists when `isPosText` returns true, which requires `v18.yoloMode` (`codex.js:190`). Indirect
  guard is sufficient; the flag can only be set on a click that was only possible under YOLO.

## Suite availability for cycle 3 (what must catch regressions)
- import-security: add yoloMode/codexEnabled (per chosen option) + blockedReason round-trip checks.
- QA (scratch): off+paused state-line case; .kopen-per-reason cases.
- lang-switch / F6: must stay green (line height-neutral; chevron unchanged).

## CYCLE 3 PLAN (target: v1.12.0)

**Scope (4 items, all S/M):** C3-1 restore authority keys + `blockedReason`; C3-2 state-line
precedence when Off ∧ Paused; C3-3 reason-aware `.kopen` deep link (keyword→keywords,
topic→allow-topics, connector→no chevron); C3-4 standing-grant marker on log rows (stretch).

**Decision — C3-1 variant:** carry `yoloMode` + `codexEnabled` booleans through the sanitizer,
PLUS an import notice line when the file would flip an authority ON from OFF ("this backup
turns on YOLO/Codex") — explicit consent, never silent. Turning OFF or junk = no notice
(fail-closed unchanged). Rationale: a user's OWN backup must round-trip settings; a crafted
file can no longer flip YOLO silently.

**Decision — C3-4:** standing marker = small glyph suffix on the log row (inside the log scroll
area, zero height impact), `title` + `aria-label` from ONE new key (`logStanding`, x6 locales →
200 keys/locale).

**Version:** v1.12.0 (fixes + one new surface).

**CHECK plan:** lint · import-security (new: yolo/codex round-trip + notice-trigger logic;
blockedReason round-trip) · lang-switch (200 keys) · assert (F6) · scratch QA (off+paused;
kopen per reason; standing marker render) · build + verify-zip + smoke · store shots 1/3 regen
(popup changed) · docs train → RELEASE_INTEGRITY v1.12.0 evidence.

**Red-team:** one bounded subagent review of the v1.12.0 diff (small scope — fits the
proven-safe delegation profile) + main-session verification of every claim.

**Cycle 4 preview:** fresh audit subagent after v1.12.0 lands + leftover G/S candidates
(rt-candidates.md G01–G10/S01–S10 net of shipped/rejected).
