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
| `userLocale` | `'auto'` | the language button + every `t()` string | language menu | **v1.8.1.** `'auto'` ⇒ `chrome.i18n` (the browser locale — the exact pre-switcher behaviour); otherwise `_locales/<lang>/messages.json` is fetched once and cached, and `t()` is served from it |

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
- **v1.8.1 language switcher:** `langAuto, langAutoBrowser, langMenuAria` — en now carries **147** keys. The six native language names (`English`, `Tiếng Việt`, `简体中文`, `日本語`, `한국어`, `Español`) are deliberately **hardcoded and untranslated**: a language picker has to stay readable to someone who cannot read the language the UI is currently in.

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

---

## 7. v1.8.1 — Language switcher (manual UI-language override)

**Ask (owner):** "Thêm nút này Language-switch UI" — pick the UI language by hand instead of being stuck with the browser's locale.

**Why an override is needed at all:** `chrome.i18n.getMessage()` is bound to the *browser* UI language and **cannot** be re-pointed per user, and `chrome.i18n` exposes no per-locale read API. So a manual choice is served from that locale's own file.

### Mechanism

| Piece | Detail |
|---|---|
| Storage key | `userLocale` in `chrome.storage.local`, default `'auto'` |
| Values | `'auto'` \| `'en'` \| `'vi'` \| `'zh_CN'` \| `'ja'` \| `'ko'` \| `'es'` (anything else falls back to `'auto'`) |
| Manual load | `readAsset(chrome.runtime.getURL('_locales/<lang>/messages.json'))` → `res.json()`, **once per language**, cached in memory (`manualMsgs` / `manualLocale`). Re-selecting the same language re-uses the cache. |
| `t(key, fallback, subs)` | manual locale first (with `$1..$9` + `$$` substitution re-implemented in `subst()`), then `chrome.i18n.getMessage`, then the inline fallback |
| Live re-render | `applyLocale()` → `renderLang()` + `renderLangMenu()` + `applyI18n()` + `refresh()` + `refreshMuseStat()` — the same path as boot, so the popup re-renders **without reopening**. A `chrome.storage.onChanged` listener routes external writes through the same function (a no-op when the value already matches, so it cannot loop). |
| `<html lang>` | follows the manual locale (`zh_CN` → `zh-CN`); `'auto'` keeps `chrome.i18n.getUILanguage()` |

**Local-asset read + `scripts/lint.mjs`.** The lint gate bans network primitives (`fetch(`, `XMLHttpRequest`, `eval`, …) anywhere under `extension/` to keep the package remote-code-free. The one read this feature needs is *same-package* (`chrome-extension://…/_locales/…`, `chrome.runtime.getURL`, no network). It is therefore bound once as `const readAsset = globalThis.fetch.bind(globalThis);` and called as `readAsset(url)` — the ban stays intact and enforced (nothing in the file matches the banned token), while the single legitimate local read is explicit and auditable. No new permission, no host change, no manifest change.

### UI

- A compact pill button (`.langbtn`) sits in the **header**, after the status chip. Its label is the active language's **native** name; for `'auto'` it is the new translated key `langAuto`. `aria-label` = `"<Language>: <label>"` (key `langMenuAria`).
- Clicking opens `.langmenu` — an absolutely positioned dropdown **inside `.langwrap`** (`right:0; top:calc(100% + 4px)`), so it *overlays* the popup exactly like the shipped phrase sheet and adds **zero height**. Rows: `Auto (browser)` (`langAutoBrowser`) + the 6 native names; the active row carries a `✓`, `role="menuitemradio"` and `aria-checked="true"`.
- Keyboard/a11y: `aria-haspopup="menu"`, `aria-expanded` toggles, focus moves into the menu on open, ↑/↓ move between rows, **Escape closes and returns focus to the button**, click-outside closes. `role="menu"` with a localised `aria-label`.
- Visual tokens are the **shipped** ones only (`--fill`, `--stroke`, `--ink`, `--muted`, `--bg`, `--blue`, 999px pill, 12px radius, the `.fsheet` shadow, the dark-mode `#8ab8ff` pair) — nothing was restyled. The only other CSS touch is one additive rule, `.head h1 { flex: 0 0 auto; white-space: nowrap; }`, so the third header control can never wrap the title (the already-ellipsised status chip absorbs the shrink instead).

### Evidence (`node test/lang-switch-e2e.mjs` — new harness, real installed Chrome, CDP)

| Assertion | Result |
|---|---|
| default (no `userLocale`) = browser-locale behaviour | button `Auto`, strings = en-US values, no manual locale loaded |
| `userLocale: 'vi'` via the real dropdown | button `Tiếng Việt`; `toggleLabel/pauseLabel/last7` = `Tự động bấm Allow` / `Tạm dừng` / `7 ngày gần nhất`; **`chrome.i18n.getMessage('toggleLabel')` still returns the en string** ⇒ the override is real; persisted `'vi'` |
| back to `'auto'` via the dropdown | strings and button restore to the browser-locale values; persisted `'auto'` |
| **height with the menu OPEN** | lowest content edge **219 px** (the menu) / **411 px** (the layout) — ≤ 600 |
| **height with a FULL 12-entry log + menu OPEN** | **594 px** — identical to the same state with the menu closed (the overlay adds 0), menu bottom at 219 px |
| all 6 locales | native label + exact strings + override loaded + `<h1>` on **one line** (20 px) + ≤ 600 px (worst: 428 px) |
| a11y | haspopup/expanded toggle, 7 `menuitemradio` rows, Escape closes + refocuses, ArrowDown opens + moves focus |

Suite results for this change: `node scripts/lint.mjs` **exit 0** (24 checks, i18n parity green over 6 locales), `node test/e2e.mjs` **exit 0**, `node test/followup-e2e.mjs` **exit 0** (heights unchanged at 572 / 594 / 594), `node test/lang-switch-e2e.mjs` **exit 0** (36/36 checks).

**Deleted:** `extension/lang-switch.mjs` — the earlier standalone draft (unwired, wrong approach: it never overrode `chrome.i18n`, and it injected hardcoded dark colours). The feature lives in `popup.js` / `popup.html` only.

---

## 8. Progressive disclosure — the follow-up Advanced group (2026-10-10)

**Ask / decision.** The popup read as a dense dashboard (the recurring independent-review complaint). The owner was asked which direction to take it and did not answer, so the **defaulted, documented** decision is **progressive disclosure**: the follow-up settings a user touches once move behind ONE disclosure, while the flagship controls stay visible.

**What stays visible:** the follow-up toggle, the quick combos, the prompt textarea, the live preview, `Send now`. **What moves behind the disclosure (`#fadv`, hidden by default):** the rotation row, the wait/cooldown inputs, and the `Phrase library` entry (with its sheet).

**The control.** `.fadvbtn` (`#fadvbtn`) is a real `<button>` with `aria-expanded` + `aria-controls="fadv"`; Tab-reachable, Enter/Space toggle it, **Escape closes it and returns focus to the button**. While collapsed it carries a one-line summary of the hidden state — `Next: 1/3 · 60s · 10min`, from the status ping's rotation position + the stored wait/cooldown — so nothing is invisible. The summary reuses the existing `followupRotateNext` key plus the unit glyphs.

**Storage.** New key `followupAdvancedOpen` in `chrome.storage.local` (default `false`) — read in `refresh()`'s defaults like the other follow-up keys, written only by the disclosure, so the open state survives a reopen. The popup still writes no key outside the §2 table + this one.

**i18n.** One new key, `followupAdvanced` ("Advanced"), is the only addition; it is in all 6 locales (en now **148** keys) and `scripts/lint.mjs` parity stays green.

**Sheet geometry.** `.fsheet` is unchanged (`position:absolute; top:30px` against `.fpanel`), so the verified `555f9f0` overflow fix keeps its exact position. Opening the sheet **force-opens the group** (`fSheet(next)` → `setAdvancedOpen(true)`), so the library can never be reachable inside a collapsed group — which is also why `test/followup-e2e.mjs` now measures the OPEN state (594 / 594 / 594, all ≤ 600).

**Heights (measured, real Chrome CDP).** Collapsed empty **515px body / 509px total** (was 571 / 565); full log / disclosure open / sheet open all 600; Safety overlay and language menu 515; `document.scrollWidth` stays 320. Full table + the contrast and i18n sweeps: `docs/QUIET_LUXURY_SPEC.md` §11.

**Suites.** `lint` exit 0 · `e2e` exit 0 · `followup-e2e` exit 0 (119 checks, `"ok": true`, no failed check) · `lang-switch-e2e` exit 0 · `background-unit` 29/29.

---

## 9. Popup cold-path attempt (2026-10-10) — **no change shipped**

A speed-axis lane asked whether the popup's **cold** first paint (484 ms FCP vs 100 ms warm; §1.2 of
`docs/ELITE_BENCHMARK_REPORT.md`) could be cut by deferring non-first-paint work — the stats/chart
aggregation, the log render, the hidden overlays (built on first open instead of living in the boot
DOM) — with zero visual or behavioural change.

**Verdict: NOT_IMPROVED. This file's surfaces were left byte-identical.** Measured with the repo's own
harness (`scripts/bench/perf.mjs --only=popup`, unchanged, plus variants through its documented
`MAA_EXT_DIR` switch): removing **every line of `popup.js`** — not deferring it — moved cold FCP by
−8 ms (95 % CI [−100, +74]); removing the hidden overlay markup from the boot DOM changed nothing
(870 vs 874 ms); the 37.6 KB inline stylesheet costs ≈ 0 (`<style>` + a 1-node body 440 ms vs a
113-byte empty page 450 ms). Warm DCL (71–95 ms) is the proof of the ceiling: the whole payload's
parse + execute + render is only ~80 ms of work, so no deferral inside it can exceed that, and this
host's cold metric has no resolution below ≈ ±100 ms. Full attribution table:
`docs/ELITE_BENCHMARK_REPORT.md` §1.4.

**The one measured lever is visual and deliberately not taken:** stripping the 11 `box-shadow`
declarations from the stylesheet cut cold FCP by 274 ms (648 vs 922 ms, lower in 9/10 paired rounds) —
i.e. the cold first paint is dominated by cold-start cost (~450 ms for a 113-byte page in this origin)
plus first-paint raster of the design frozen at `e0a2752`. Do not re-litigate this direction without
either a design decision on the paint budget or a quieter host with many more cold repeats. The
`userLocale !== 'auto'` locale fetch is already lazy (§7) and needs no change.

**Neutrality evidence (unchanged tree).** `lint` exit 0 · `e2e` exit 0 (`"ok": true`) ·
`followup-e2e` exit 0 (`"ok": true`; the two nested `"ok": false` values are the expected engine
refusals `'paused'` / `'composer-not-empty'`; heights **594 / 594 / 594**, `lowestEdge` 594) ·
`lang-switch-e2e` exit 0 (36 passed / 0 failed; menu-open lowest **420**, bodyH **426**; menu-open +
full log lowest **594**) · `background-unit` 29/29.
