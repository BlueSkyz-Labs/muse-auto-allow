# Auto follow-up (v1.6.0 engine · v1.7.0 phrase library + rotation)

Muse Auto-Allow's second engine: when Muse (muse.ai) stops working — its status line
reads **'Connected'** — and the user enabled Auto follow-up, the extension types a
user-chosen prompt into the chat composer and submits it so the assistant continues
long-run. Added in the v1.6.0 development line (`extension/content.js`); the shipped
manifest version is bumped separately by the release task.

**v1.7.0 adds the phrase library + round-robin rotation** on top of the same engine:
the popup composes the prompt from 8 phrase groups (multi-select chips), keeps the
legacy presets as quick combos, appends custom text, and can send a saved list of
composed prompts round-robin — advancing the index only after a verified send. The
phrases, their rationale, composition rules and recommended combos live in
`docs/PROMPT_LIBRARY.md`.

Everything below is implemented and verified against a deterministic fixture page in a
real Chromium (`test/followup-e2e.mjs`). Items that could NOT be verified against a
logged-in muse.ai session are listed explicitly under **Limitations / NOT VERIFIED**
— no claim here was validated on the live site.

---

## 1. Idle detection

Three fallback strategies, evaluated on every 1s heartbeat tick, combined with
**busy-wins** semantics:

| # | Strategy | Scope | Idle rule |
|---|----------|-------|-----------|
| 1 | Assistant header | The first short element (≤60 chars) reading exactly `Muse` (the title/avatar label) or a short `Muse <status>` line; the status is classified in its enclosing container (climb ≤4 levels, container text ≤160 chars) | text contains `/\bconnected\b/i` AND no busy match |
| 2 | `[aria-live]` regions | Region text ≤120 chars | region text is JUST `connected` (letters/digits/underscore may not surround it — `Connected to GitHub` does NOT count; `· Connected` does) |
| 3 | `class`/`data-testid` containing `status` | Element text ≤60 chars | same strict rule as strategy 2 |

**Busy** (defeats idle from any strategy): the status text matches
`/\b(is working|working|doing|thinking|running|analyzing|searching|reading|writing|implementing|generating)\b/i`,
or a visible spinner/`progressbar` element (`[class*="spin"], [class*="loading"], [role="progressbar"]`)
sits inside the inspected scope.

**Fail closed:** absent, ambiguous or disabled-looking status => `unknown` => NOT idle
=> no follow-up. Strategy-1 scans are bounded (first 4000 candidate elements) so huge
chat pages cannot stall the tick. The detected state is also mirrored to the
`data-muse-followup` attribute on `<html>` (debugging/observability only).

## 2. Trigger guards (all mandatory for an automatic send)

| Guard | Default | Notes |
|---|---|---|
| `followupEnabled` | `false` | OFF by default; opt-in only. Independent of the existing auto-approve toggle. |
| Continuous idle | `followupIdleMs` = 60 000 ms | Idle must be observed **continuously** for this long; any other state resets the timer. Live-updatable. |
| No approval surface | — | Absolute priority: while ANY approval surface is present (paths A–E of the click engine: marked cards, any clickable `Allow/Approve` button, collapsed pending cards, `N tasks need your approval` banners, chat-level `Review` bars), no follow-up is sent. Reuses the same selectors and fails closed. |
| Per-tab cooldown | `followupCooldownMs` = 600 000 ms | Between send *attempts* (manual attempts also arm it). |
| Hourly cap | 6 / rolling hour (fixed) | Automatic sends only, per tab. Hard constant `FOLLOWUP_HOUR_MAX`. |
| Composer must be empty | — | Never sends while the composer already holds unsent text; a leftover draft also blocks retries. |
| Verified send | — | A send only counts as success when the composer verifiably empties or changes afterwards (600 ms window); otherwise the other submit strategy is retried once, then the attempt stays unverified and any leftover text blocks further sends. |
| Liveness | — | If the extension context is invalidated, the engine stops (`stopForever()` clears the pending verification timer too). |

## 3. Composer + send

**Finding the composer** (no blind last resort; unknown composer => no send):
1. `input`/`textarea` with placeholder exactly `Message` (the live UI per user report);
2. placeholder/`aria-label` mentioning `message|prompt|chat` (search fields excluded);
3. `[contenteditable="true"]`/`[role="textbox"]` with message/prompt/chat metadata.

**Typing (React-safe):** native value setter
(`Object.getOwnPropertyDescriptor(HTMLInputElement|HTMLTextAreaElement.prototype,'value').set`)
+ `InputEvent('input', {bubbles:true, inputType:'insertText', data:text})` + a
`change` event. Contenteditable fallback: `document.execCommand('insertText')`, then
`textContent` + input event. The typed value is read back before submitting.

**Submitting:** a visible send button whose `aria-label`/`title`/text is exactly
`send|send message|send prompt|submit|submit message|send a message` is preferred;
otherwise (or on retry) Enter is dispatched as `keydown`/`keypress`/`keyup`
(`key:'Enter', code:'Enter', keyCode:13, which:13, bubbles`). One strategy is tried,
the composer is re-checked after 600 ms, and the other strategy is tried once if the
value did not change.

## 4. Settings + message API

`chrome.storage.local` keys (read at boot; all react live via `storage.onChanged`):

```
followupEnabled    boolean  default false
followupPrompt     string   default 'Approve and continue working' (preset 1)
followupIdleMs     number   default 60000
followupCooldownMs number   default 600000
followupPrompts    string[] default []   (rotation list; non-empty = round-robin mode)
followupRotateIdx  number   default 0    (index of the NEXT prompt to send)
followupChips      string[] popup-only   (selected phrase ids, for re-hydration; the
                                          engine never reads it)
```

Content-script messages (answered synchronously, per tab):

- `{type:'followup-send-now'}` — manual send. Skips the idle wait, the cooldown and
  the hourly cap, but still respects: disabled, approval-present, composer-not-empty,
  no-composer, empty-prompt. Answers `{ok, reason, via, state, lastSentAt}`;
  `reason` is one of `disabled|sending|approval-present|no-composer|composer-not-empty|no-prompt|type-failed|attempted|dead`.
- `{type:'followup-status'}` — answers `{state:'working'|'idle'|'unknown', lastSentAt, enabled, rotateIdx, rotateCount}`
  (`rotateIdx` = index of the next rotation item, `0` when the list is empty; `rotateCount` = list length).

## 5. Popup UI (v1.7.0: phrase-library builder + rotation)

The **Auto follow-up** section below the existing rows: pill toggle (same `.track`/
`.knob` switch as the approve toggle), then the builder:

- **Quick combos** — the three legacy presets as one-tap buttons (exact strings:
  `Approve and continue working` / `Continues implementation — working long-run` /
  `follow best practice, Project Source of Truth, Do your best`). A tap clears
  chips + custom text and stores the preset verbatim (pressed state shown).
- **Phrase library** — an overlay sheet with 8 group tabs (Continue, Verify, Quality,
  Workflow, Scope, Report, Security, Design/UX) and multi-select chips that compose in
  LIBRARY order (click order never matters); the sheet carries its own Preview line.
  The sheet clips to its own box, the phrase area scrolls internally (bounded
  max-height, visible scrollbar) and every selected row keeps its `×` — the popup
  stays ≤ 600px in every state (measured in the harness; owner-reported overflow
  "tràn mất lựa chọn" fixed 2026-10-09).
- **Per-group save** — under each group's chips: one tap appends exactly that group's
  selected phrases to the rotation; disabled while the group has no selection; the
  transient "added" confirmation is a label change only (a rapid second save is never
  blocked).
- **Custom** textarea — appended as the last part of the composition.
- **Preview** — always visible in the panel: the exact string the engine will send
  (2-line clamp; full text on hover).
- **Rotation** row — `Save combo` (saves the current preview), `Starter rotation`
  (loads the three recommended combos), `Next: i/n` (click opens the saved list);
  each saved row shows its **source group** (derived from its phrases, `A+B` for
  multi-group combos) and a remove `✕`.
- *Wait (s)* / *Cooldown (min)* inputs, **Send now** (disabled while the feature is
  off, per the disabled guard), and the live status pill: **Working** /
  **Follow-up sent HH:MM** (15 min after a verified send) / **Waiting** (idle, armed)
  / **Idle**; a tab that never reports hides the pill (the header chip already carries
  the muse.ai tab status).

The popup polls every 2.5s by messaging every muse.ai tab and aggregating (working
wins; newest verified send wins; the first tab answering with a rotation list supplies
`rotateIdx`/`rotateCount` for the Next line).

i18n: all chrome is localized — **78 keys × 6 locales** (`en, vi, zh_CN, ja, ko, es`),
identical key sets (lint parity). The **prompt strings themselves stay English** — they
are instructions to the agent — while all UI chrome is localized.

## 6. Tests

- `node test/e2e.mjs` — unchanged legacy suite (read-only for this task); still exit 0
  with the v1.7.0 working tree (verified: 13/13 expected clicks incl. the GitHub-context
  card, 0 forbidden, 0 denies, stats + encryption + i18n sub-checks all true).
- `node test/followup-e2e.mjs` — CDP scratch-Chrome harness (copies the
  launch/attach/teardown pattern from `test/e2e.mjs`; never touches the user's real
  profile). Loads a temp copy of the extension whose manifest gains
  `http://127.0.0.1/*` as a content-script match **and host permission** (test-only —
  the shipped manifest stays muse.ai-only). Fixture: `test/followup-fixture.html`
  (switchable status, composer + `window.__sent` recorder, approval-card block, and the
  GitHub-card family: the owner-reported card, its unmarked twin, a lone-allow negative
  control and the prefixed pending variant).

  Seeds `followupEnabled=true, followupIdleMs=400, followupCooldownMs=1500` and a legacy
  prompt (no `followupChips` key); asserts (**74 checks**): locale parity + popup i18n
  coverage; popup section renders and maps settings; legacy prompt rehydrates as custom
  text; the library sheet opens with 8 group tabs; two chips compose in LIBRARY order
  into storage + preview (click order must not matter); remove-chip; custom text appended
  as the last part; exact quick-combo strings; height ≤ 600px with an empty log, a full
  log and the sheet open; **overflow probe** with several phrases selected (sheet inside
  the popup, phrase area internally scrollable, every selected row keeps its ×, last row
  reachable, Preview visible — measured, not asserted on faith); no send while 'is
  working'; idle-wait enforced with a live `followupIdleMs` change; send with the exact
  composed prompt via the send button with the React-safe input event and composer
  cleared and `lastSentAt` recorded; no second send within the cooldown and one after;
  disabled => nothing; approval card => skipped, clearing resumes; manual send skips the
  idle wait and falls back to Enter; composer-not-empty guard preserves the draft;
  status ping shape `{state, lastSentAt, rotateIdx, rotateCount}`; **rotation
  end-to-end** (starter loads the 3 recommended combos with source-group tags, a remove
  leaves 2, send #1 = item 1, send #2 = item 2, send #3 wraps to item 1, the popup
  next-line follows the engine index, a BLOCKED send does not advance the index);
  **per-group save** (each group's one tap appends exactly that group's composed combo;
  enabled only when the group has a selection; the 6-item rotation sheet scrolls
  internally with the last remove reachable); **rotation falsification** (the stored
  index is forced to the previous send's value — what a non-advancing engine looks like
  — and the next send REPEATS item 2, i.e. the round-robin expectation goes RED;
  restoring the index resumes item 1, GREEN); **the owner-reported GitHub card** (the
  marked card is approved on "Allow once" only — never Deny, never the standing-grant
  option; the unmarked twin is approved by the pair heuristic; a lone allow under the
  same title is never clicked; the prefixed pending card expands and its pair is
  approved); deny never clicked on any card variant; no page JS errors. Prints a JSON
  summary; exit 2 on any failure. Two harness-hardening notes are commented in-file:
  (a) after a send fires the engine refuses re-entry for ~600 ms by design, so the
  harness settles the engine before manual cases; (b) the approval-guard phase reloads
  the fixture to reset the engine's hourly budget, so a slow-CDP stall cannot make the
  6/hour cap (correctly) mask the guard under test.

### Verification evidence (2026-10-09, this workspace)

v1.6.0-era runs (kept for the record):

| Run | Code state | Result |
|---|---|---|
| `e2e.mjs` | content.js @ `61a66639…` | exit 0 (13/13, 0 forbidden) |
| `followup-e2e.mjs` | unmutated | exit 0, 34/34 |
| **Mutation A** — `if (approvalPresent())` → `if (false && approvalPresent())` in `followupAttempt` | mutated | **exit 2 — RED**: only `e. no send while an approval card is present` failed (2 sends fired while the card was visible) |
| Restore from byte backup | `61a66639…` (sha asserted) | — |
| **Mutation B** — idle-wait check → `if (false && now - followup.idleSince < …)` | mutated | **exit 2 — RED**: only `b0. idle observed but idle-wait not elapsed => no send` failed (1 send inside the un-elapsed wait) |
| Restore from byte backup | `61a66639…` (sha asserted) | — |

v1.7.0 runs (phrase library + rotation + GitHub-card handling):

| Run | Code state | Result |
|---|---|---|
| `scripts/lint.mjs` | working tree | exit 0 — 24 checks / 18 files (syntax, JSON, i18n parity 78 keys × 6, no remote code, manifest hygiene) |
| `followup-e2e.mjs` | working tree | exit 0, **74/74** |
| `e2e.mjs` | working tree (card rails widened) | exit 0 — 13/13, 0 forbidden, 0 denies, stats + encryption + i18n sub-checks true |
| **Mutation R** — `advanceFollowupRotation`: `rotateIdx = (rotateIdx + 1) % n` → `rotateIdx = rotateIdx` | mutated | **exit 2 — RED**: exactly the three rotation-index checks failed (`rot. send #2 carries the exact item 2` repeated item 1; `rot. ping reports rotateIdx/rotateCount` stayed 0; `rot. popup next-line follows the engine index` never reached 2/2) — everything else stayed green |
| Restore from byte backup | sha256 `fdffc5fd…` re-verified | — |
| `followup-e2e.mjs` | restored, byte-identical | exit 0, 74/74 |

Restores were byte-level copies (never `git checkout`), verified by sha256 against the
pre-mutation file. The in-harness `rot-falsify` phase additionally forces the stored
index to the previous send's value (what a non-advancing engine looks like) and proves
the round-robin expectation goes RED, then restores it (GREEN) — together with the
mutation runs, the suite discriminates what it claims to.

## 7. Limitations / NOT VERIFIED (honest list)

- **Live muse.ai DOM is unverified.** The exact status element, its wording (the
  user reports 'is working' vs a green-lightning 'Connected') and the composer
  markup were taken from the user's description, not from a logged-in session. All
  three detection strategies and the composer strategies are heuristics built to be
  redundant; if Muse's real markup differs, detection returns `unknown` (fail closed,
  no sends) rather than acting on a guess — which also means the feature might do
  nothing until selectors are tuned against a live session.
- **The owner-reported GitHub card** ("Allow Muse to perform this action on your GitHub
  account? Action Pull", 2026-10-09) is handled as a standard Allow/Deny-paired card.
  The live chat DOM could not be re-observed for this task (muse.ai's chat requires a
  logged-in session), so the fixture covers the shapes consistent with the captured
  evidence: a marked card with the live option set (Allow once / Always allow / Deny —
  approved on "Allow once" only), its unmarked twin (pair heuristic), a lone allow under
  the same title (never clicked) and a collapsed pending card whose clickable text
  carries a leading badge ("Needs review · <title>" — the title phrase must start within
  the first 24 characters). Wording outside those shapes still fails closed:
  **standing-grant labels ("Always allow", "Allow for this site/task") are deliberately
  NOT recognized** as the positive option — the engine only clicks plain/one-shot forms,
  so it can never silently escalate the granted scope — and cards that are not real
  buttons are left to the user.
- **Popup overflow fix**: the geometry (sheet inside the popup, phrase area internally
  scrollable, every selected row's × reachable, Preview visible, ≤ 600px) is *measured*
  in the real popup by the harness; a visual/vision review of the final revision remains
  the separate experience-audit gate, not this task's.
- **Send integration unverified live**: whether Muse submits on Enter, on the send
  button click, or both, is unknown; the verifier + one retry covers either, but a
  site that clears the composer asynchronously beyond 600 ms could see one duplicate
  prompt (bounded by cooldown + cap).
- **Strategy-1 precision trade-off** (documented, accepted): the header strategy
  uses the spec-loose `/\bconnected\b/i` on a short container near a `Muse` label.
  A chat line like `Muse: Connected the dots.` inside a ≤60-char element could in
  principle read as idle; the strict strategies and the confluence rule reduce this
  further, and the guards bound the blast radius (a queued prompt, 6/h max). Not
  observed on the fixture; not verified against live content.
- **Per-tab scope only.** Cooldown/cap/state live in each tab's content script; two
  simultaneously idle muse.ai tabs can each send one follow-up. No cross-tab lock
  (deliberately — the repo's no-over-engineering rule; the click recorder's
  `navigator.locks` pattern was not replicated here).
- **Background-tab timer throttling**: heartbeat ticks are 1 s in a visible tab and
  can be throttled to ~1/min in a heavily backgrounded tab (Chrome). Idle windows of
  60 s+ are unaffected; the test launches Chrome with the throttle-disabling flags
  used by the existing e2e suite.
- **i18n translations** for vi/zh_CN/ja/ko/es were authored in this task and are not
  native-reviewed.
- **Manifest version** remains 1.5.0 (manifest.json is outside this task's write
  set); the v1.6.0 label lives in the content-script header until the release task
  bumps it.

## 8. Design decisions worth knowing

- Fail-closed everywhere: unknown status, unknown composer, unknown submit result,
  any error inside the approval check, no prompt => no send.
- The engine is **independent of the auto-approve toggle** (`enabled`); it has its
  own opt-in (`followupEnabled`, default false).
- Manual `Send now` is user-explicit: it bypasses wait/cooldown/cap but can never
  bypass disabled/approval/composer-empty.
- Sends are only *counted* (status pill, `lastSentAt`) after the composer verifiably
  empties/changes; the attempt itself (for cooldown/cap purposes) is always counted,
  so a broken submit cannot loop.
- `data-muse-followup` on `<html>` mirrors the detected state (`working|idle|unknown`)
  — a testing/debug hook, same spirit as the existing `data-muse-auto-allow` marker.
- The rotation index is **engine state** (`followupRotateIdx`), not popup state: any
  tab with the list stored rotates from the same index, and the advance happens inside
  the verified-send callback — a blocked or failed send can never skip a prompt.
- Per-group save writes plain composed strings into `followupPrompts` (the engine's
  schema is unchanged); the **source-group tag** on each rotation row is *derived* from
  the phrases the row contains — no parallel metadata is stored, and an item with a
  custom part simply shows no tag.
