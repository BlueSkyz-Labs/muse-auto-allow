# Auto follow-up (v1.6.0 dev)

Muse Auto-Allow's second engine: when Muse (muse.ai) stops working — its status line
reads **'Connected'** — and the user enabled Auto follow-up, the extension types a
user-chosen prompt into the chat composer and submits it so the assistant continues
long-run. Added in the v1.6.0 development line (`extension/content.js`); the shipped
manifest version is bumped separately by the release task.

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
```

Content-script messages (answered synchronously, per tab):

- `{type:'followup-send-now'}` — manual send. Skips the idle wait, the cooldown and
  the hourly cap, but still respects: disabled, approval-present, composer-not-empty,
  no-composer, empty-prompt. Answers `{ok, reason, via, state, lastSentAt}`;
  `reason` is one of `disabled|sending|approval-present|no-composer|composer-not-empty|no-prompt|type-failed|attempted|dead`.
- `{type:'followup-status'}` — answers `{state:'working'|'idle'|'unknown', lastSentAt, enabled}`.

## 5. Popup UI

New **Auto follow-up** section below the existing rows: pill toggle (same `.track`/
`.knob` switch as the approve toggle), preset select (the three owner-specified
presets — `Approve and continue working`, `Continues implementation — working
long-run`, `follow best practice, Project Source of Truth, Do your best` — plus
**Custom…** with a free-text field), *Wait before sending (seconds)* and *Cooldown
(minutes)* inputs, a **Send now** button (disabled while the feature is off, per the
disabled guard), and a live status pill: **Working** / **Connected** /
**Follow-up sent HH:MM** (shown for 15 min after a verified send) / *No muse.ai tab
found* / *Status unknown*. The popup polls every 2.5s by messaging every muse.ai tab
and aggregating (working wins; newest verified send wins).

i18n: 12 new keys × 6 locales (`en, vi, zh_CN, ja, ko, es`); all locale files carry
the identical 47-key set. The follow-up **preset prompt strings themselves stay in
English** — they are instructions to the agent and are the owner-specified exact
strings — while all UI chrome is localized.

## 6. Tests

- `node test/e2e.mjs` — unchanged legacy suite; still exit 0 with the v1.6.0 dev
  content script (verified: 13/13 expected clicks, 0 forbidden, 0 denies, stats +
  encryption + i18n sub-checks all true).
- `node test/followup-e2e.mjs` — new CDP scratch-Chrome harness (copies the
  launch/attach/teardown pattern from `test/e2e.mjs`; never touches the user's real
  profile). Loads a temp copy of the extension whose manifest gains
  `http://127.0.0.1/*` as a content-script match **and host permission** (test-only —
  the shipped manifest stays muse.ai-only). Fixture: `test/followup-fixture.html`
  (switchable status, composer + `window.__sent` recorder, approval-card block).

  Seeds `followupEnabled=true, followupIdleMs=400, followupCooldownMs=1500` and the
  prompt `Continue implementation — follow best practices, Source of Truth, do your best`;
  asserts (34 checks): locale parity + popup i18n coverage; popup section renders and
  maps settings; no send while 'is working'; idle-wait enforced with a live
  `followupIdleMs` change; send with exact prompt via the send button with the
  React-safe input event and composer cleared and `lastSentAt` recorded; no second
  send within the cooldown and one after (~2s separation); disabled => nothing;
  approval card => skipped, clearing resumes; manual send skips the idle wait and
  falls back to Enter; composer-not-empty guard preserves the draft; status ping
  shape; deny never clicked; no page JS errors. Prints a JSON summary; exit 2 on any
  failure. Two harness-hardening notes are commented in-file: (a) after a send fires
  the engine refuses re-entry for ~600 ms by design, so the harness settles the
  engine before manual cases; (b) the approval-guard phase reloads the fixture to
  reset the engine's hourly budget, so a slow-CDP stall cannot make the 6/hour cap
  (correctly) mask the guard under test.

### Verification evidence (2026-10-09, this workspace)

| Run | Code state | Result |
|---|---|---|
| `e2e.mjs` | content.js @ `61a66639…` | exit 0 (13/13, 0 forbidden) |
| `followup-e2e.mjs` | unmutated | exit 0, 34/34 |
| **Mutation A** — `if (approvalPresent())` → `if (false && approvalPresent())` in `followupAttempt` | mutated | **exit 2 — RED**: only `e. no send while an approval card is present` failed (2 sends fired while the card was visible) |
| Restore from byte backup | `61a66639…` (sha asserted) | — |
| **Mutation B** — idle-wait check → `if (false && now - followup.idleSince < …)` | mutated | **exit 2 — RED**: only `b0. idle observed but idle-wait not elapsed => no send` failed (1 send inside the un-elapsed wait) |
| Restore from byte backup | `61a66639…` (sha asserted) | — |
| `followup-e2e.mjs` ×2 | restored, byte-identical | exit 0 both, 34/34 each |

Restores were byte-level copies (never `git checkout`), verified by sha256 against the
pre-mutation file. The mutations each break exactly ONE guard and exactly the case
targeting that guard goes red — the suite discriminates what it claims to.

## 7. Limitations / NOT VERIFIED (honest list)

- **Live muse.ai DOM is unverified.** The exact status element, its wording (the
  user reports 'is working' vs a green-lightning 'Connected') and the composer
  markup were taken from the user's description, not from a logged-in session. All
  three detection strategies and the composer strategies are heuristics built to be
  redundant; if Muse's real markup differs, detection returns `unknown` (fail closed,
  no sends) rather than acting on a guess — which also means the feature might do
  nothing until selectors are tuned against a live session.
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
