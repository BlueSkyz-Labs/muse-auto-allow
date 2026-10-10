# UI v1.8 — pause, Safety & Control, dry-run, digest, onboarding

**Lane:** UI (popup/statistics surface only). **Frozen contract:** `contracts-v18.md` (storage keys) + `docs/ENGINE_V18.md` (engine behaviour).
**Write set:** `extension/popup.html`, `extension/popup.js`, `extension/_locales/*/messages.json`, this file.
`extension/stats.html` / `stats.js` are **deliberately unchanged** — v1.8 adds no statistics surface (the digest lives in the popup), and the page's export/import + backup-key logic is out of the UI lane's scope.

---

## 1. What was added

| # | Surface | Where | Behaviour |
|---|---|---|---|
| 1 | **Pause** | `.ctlbar` (row under the header) | three one-tap durations — `15 min`, `1 hour`, `Tomorrow` — write `pauseUntil`. While `Date.now() < pauseUntil` the row flips to a state banner `Paused until HH:MM` + `Resume` (writes `pauseUntil: 0`). `Tomorrow` = the next local midnight, floored to ≥ 1 hour so a 23:50 tap never means 10 minutes. The row auto-flips back the moment the pause expires while the popup is open. |
| 2 | **Dry-run** | toggle in Safety & Control + banner | `dryRun: true` shows the sticky banner **"Logging only — nothing will be clicked"** at the top of the log, plus a `Dry-run` chip next to the Safety entry so the state is visible even when the log is scrolled. |
| 3 | **Rules editor** | Safety & Control | `rules.allowTopics` (add / remove, 50 × 64-char cap, case-insensitive dedupe) and `rules.blockKeywords` (add / remove, **shipped seed list pre-loaded**, `Reset to defaults` as a two-step inline confirm). Both lists are written together so a write can never drop the sibling list. |
| 4 | **Allow-once** | Safety & Control | `allowOnceMode` toggle + one-line rationale ("one-time approvals instead of standing access"). |
| 5 | **Schedule** | Safety & Control | `followupSchedule.enabled` + `start`/`end` hour selects (`00`–`23`, values are numbers) + `onlyActiveTab`. Writes the whole contract object, merging unknown engine keys. |
| 6 | **Sync** | Safety & Control | `syncSettings` toggle + the 8 KB per-item Chrome Sync note (large lists stay local; local settings win). |
| 7 | **Stuck & error recovery** | Safety & Control | `followupSmart.stuckMin` (minutes, 0 = off) + `followupSmart.errorRecovery`. Writes **merge** the stored object, so the engine-owned `stuckPrompt` / `errorPrompt` overrides survive. |
| 8 | **While you were away** | sticky band inside the log | reads `digestCounters` + `lastDigestAt`; shown only while `clicks + followups + blocked > 0`; shows the four contract fields (title, `since <time>`, clicks, follow-ups, blocked). |
| 9 | **Onboarding wizard** | full-popup overlay | 3 steps, shown while `onboarded !== true` (see §4). |
| 10 | **Log kinds** | log rows | new kinds get real labels + chips: `blocked` (with the engine's `blockedReason` in the chip tooltip), `followup`, and the `-dry` variants (`allow-dry`, `expand-dry`, `open-panel-dry`, `followup-dry`). |

### Layout decision (why overlays, not inline expansion)

The popup must stay ≤ 600 px **in every state**, and v1.7.0 already ships at 561–590 px. Expanding ~300 px of safety controls inline cannot fit, so:

- the **Safety & Control panel** is a full-popup overlay (`position:absolute; inset:0`, own header + internal scroll) — the same family as the shipped phrase-library sheet, which exists for the same reason;
- the **onboarding wizard** is an overlay (`z-index:10`, on top of the panel);
- the **dry-run banner + digest** live *inside* the log's own scroll area (`#logTop`, `position:sticky; top:0`), so they cost the layout **zero height** — in a crowded state the log simply gives them its own space;
- the **log** keeps `flex:0 1 auto` with `min-height:0`, so it is the element that absorbs crowded states instead of pushing the popup past its cap. With `max-height:600px` on the body the measured total therefore saturates at 592–594 px for any content height.

**Bug found and fixed during the height audit:** the shipped hidden checkbox pattern (`input[type=checkbox]{position:absolute;width:1px;height:1px}`) inside an overlay positioned against the *overlay* (not its group), so a checkbox deep in the scrolled list landed outside the popup box and added phantom document overflow (measured 600 → 767 px while the panel was open). `.rgroup{position:relative}` keeps every checkbox inside its own group. Re-measured: `document.scrollHeight` stays at the viewport height in every state.

---

## 2. Storage mapping (frozen contract → UI)

| Storage key | Default | Read by UI | Written by UI | Notes |
|---|---|---|---|---|
| `pauseUntil` | `0` | `.ctlbar` state | pause pills / `Resume` | epoch ms; paused while `now < pauseUntil` |
| `dryRun` | `false` | banner + chip + toggle | Safety panel toggle | log-only mode |
| `allowOnceMode` | `false` | toggle | Safety panel toggle | prefer one-shot allow options |
| `rules.allowTopics` | `[]` | chip list | add / remove | 50 × 64-char cap, case-insensitive dedupe |
| `rules.blockKeywords` | seed list (20 words) | chip list (seed pre-loaded when absent) | add / remove / reset | an *explicit* empty array is honoured as "block nothing" |
| `digestCounters` | absent | digest band | — (engine writes) | shown while any counter > 0 |
| `lastDigestAt` | `0` | digest `since` line | — (background writes) | 0 → "since you started" |
| `followupSmart.stuckMin` | `10` | number field | change | merged write (keeps `stuckPrompt`/`errorPrompt`) |
| `followupSmart.errorRecovery` | `false` | checkbox | change | merged write |
| `followupSchedule.{enabled,start,end,onlyActiveTab}` | `false,8,18,false` | toggle + selects + checkbox | change | merged write; hours clamped to 0–23 with a real default (an empty value must not become 0) |
| `syncSettings` | `false` | toggle | change | 8 KB note in the panel |
| `onboarded` | `false` | wizard visibility | wizard Done/Skip | absent ⇒ wizard shows once |

The popup never writes a key outside this table. `followupSmart`, `followupSchedule` and `rules` are read-merge-written so UI edits cannot delete engine-owned fields.

---

## 3. i18n

**62 new keys × 6 locales = 372 new entries** (en now carries 144 keys; `node scripts/lint.mjs` enforces identical key sets across `en, vi, zh_CN, ja, ko, es`).

- Pause: `pauseLabel, pause15, pause60, pauseTomorrow, pauseTomorrowTitle, pauseHint, pauseResume, pauseStateUntil`
- Dry-run: `dryRunTitle, dryRunNote, dryRunBanner, dryRunChip`
- Allow-once: `allowOnceTitle, allowOnceNote`
- Panel: `safetyOpen, safetyTitle, safetyClose`
- Topics: `topicsLabel, topicsNote, topicsPlaceholder, topicsEmpty`
- Keywords: `keywordsLabel, keywordsNote, keywordsPlaceholder, keywordsReset, keywordsResetConfirm, keywordsEmpty`
- Editor: `rulesAdd, rulesRemove`
- Schedule: `scheduleTitle, scheduleNote, scheduleOnlyActive, scheduleStart*, scheduleEnd*` (*aria labels set from JS)
- Smart recovery: `smartTitle, smartNote, smartStuckLabel, smartErrorLabel`
- Sync: `syncTitle, syncNote`
- Digest: `digestTitle, digestSince, digestSinceStart, digestClicks, digestFollowups, digestBlocked`
- Onboarding: `onbStep1Title, onbStep1Body, onbEnable, onbStep2Title, onbStep2Body, onbDryRun, onbStep3Title, onbStep3Body, onbBack, onbSkip, onbDone, onbStepCount`
- Log kinds: `kindBlocked, kindFollowup, kindAllowDry, kindExpandDry, kindOpenPanelDry, kindFollowupDry`

Every literal `t('key')` in `popup.js` and every `data-i18n`/`data-i18n-ph` in `popup.html` resolves in `en` (the harness pre-flight asserts both directions, with no fallback-only allowlist). Follow-up **prompt** chips stay English by design (existing rule); state chips (`.schip`, `.fstat`, log kind chips) are localised.

---

## 4. Onboarding flow

Shown while `onboarded !== true` (so existing v1.7 users see it once after the upgrade).

1. **Turn on auto-click** — `Turn on` writes `enabled: true` → step 2.
2. **Start in Dry-run** (recommended) — `Turn on Dry-run` writes `dryRun: true` → step 3.
3. **Pick a follow-up** — the three quick-combo presets (same strings as the follow-up row) write `followupEnabled: true` + the exact preset into `followupPrompt` (+ `followupChips: []`); `Done` closes without picking.

`Skip` is always available; `Back` appears from step 2; Escape is **not** bound (a modal must not dismiss silently — only the explicit Skip/Done actions close it). Skip, Done and any step-3 pick all write `onboarded: true`. Progress is shown as three dots + "Step 1 of 3". No animation beyond the shipped reduced-motion-safe transitions; the global `prefers-reduced-motion` block pins every final state.

---

## 5. Height measurements (≤ 600 px discipline)

Harness (real Chrome, real extension, `node test/followup-e2e.mjs` — the popup states it asserts):

| State | Total | follow-up section | log |
|---|---|---|---|
| empty log | **572** | 278 | 32 |
| 12-entry log | **594** | 278 | 54 |
| phrase sheet open | **594** | 278 | 54 |

Scratch worst-case sweep (own CDP harness, read-only w.r.t. the repo; states the shipped suites do not seed — all ≤ 600):

| State | Total |
|---|---|
| fresh install (wizard visible) | 411 |
| default (follow-up off) | 411 |
| 12-entry log | 594 |
| paused + 12-entry log | 594 |
| dry-run + 12-entry log | 594 |
| paused + dry-run + digest + 12-entry log | 594 |
| **worst: paused + dry-run + digest + 2-line composed prompt + rotation + 12-entry log** | **594** (bands 50 px inside a 54 px log, both fully visible) |
| Safety & Control panel open (any of the above) | 594 (panel is `inset:0`, adds 0) |

Locale width check (popup rendered once per locale via `--lang`): the control bar is **292/292 px with no overlap in en, vi, zh_CN, ja, ko, es**; the widest paused state (vi: 194 + 53 px) still fits the 292 px content column.

Functional probe (own CDP harness): **58/58** checks — wizard steps and their writes, pause 15 min/1 h/Tomorrow + resume, dry banner, panel toggles, topics/keywords add–remove–reset, schedule object write, `followupSmart` merge (keeps `stuckPrompt`/`errorPrompt`), sync toggle, Escape close, digest show/hide, log kind rendering, worst-case height and the no-phantom-overflow assertion.

---

## 6. Limits / notes

- The engine's startup **notification** text stays hardcoded English (contract note, `docs/ENGINE_V18.md`); the UI strings are localised.
- The digest band is informational and never resets `digestCounters` (only the background digest does, when it shows its notification) — the popup therefore shows the same counters the last notification would.
- `followupSmart.stuckPrompt` / `errorPrompt` have **no** UI field (the frozen contract exposes `stuckMin` + `errorRecovery` only); they are preserved on every UI write.
- `stats.html` / `stats.js` were not touched: v1.8 adds no statistics surface, and the export/import + backup-key logic is explicitly out of scope for this lane.
- Measured on Windows Chrome (v26.7.0 node harness, installed Chrome via CDP); heights are CSS px in the popup document (320 px wide, `max-height:600px`).
