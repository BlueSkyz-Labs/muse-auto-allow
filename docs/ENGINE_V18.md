# ENGINE V18 — pause · dry-run · rules · smart follow-up · schedule · digest · sync

Status: **implemented in the engine lane** (`extension/content.js`, `extension/background.js`,
`extension/manifest.json`), verified by the harnesses below. The **popup/UI for these keys is a
later UI lane** — this document is the frozen storage contract that lane builds against.
The shipped `manifest.version` stays **1.7.0**; the release task bumps it.

Everything here is exercised against a deterministic fixture in a real Chromium
(`test/followup-e2e.mjs`, `test/e2e.mjs`) or against the real `background.js` in a vm sandbox
(`test/background-unit.mjs`). Items that could not be verified live are listed under
**Limits / NOT VERIFIED** — nothing here was validated on a logged-in muse.ai session.

---

## 1. Storage keys (chrome.storage.local; absent = default)

| Key | Type / default | Behavior |
|---|---|---|
| `pauseUntil` | number epoch-ms, `0` | While `Date.now() < pauseUntil` **all automation is halted**: every click path (A–E) and the follow-up engine, including manual `followup-send-now` (reason `paused`). The toolbar badge shows the pause marker `||`. |
| `dryRun` | bool, `false` | Detection and logging run exactly as usual; **nothing is clicked** and no follow-up is typed/sent. Log entries get `entry.dryRun=true` and the kind gets a `-dry` suffix (`allow-dry`, `expand-dry`, `open-panel-dry`, `review-bar-dry`); the follow-up logs `followup-dry`. |
| `allowOnceMode` | bool, `false` | Prefers a one-shot allow option. See §3.5. |
| `rules.allowTopics` | string[], `[]` (cap 50 × 64) | Non-empty ⇒ auto-click **only** when `extractTopic()` matches (case-insensitive exact). See §3.4. |
| `rules.blockKeywords` | string[], seed list | Any keyword (case-insensitive substring) in the card text **or** the extracted context ⇒ never click. See §3.3. |
| `followupSmart.stuckMin` | number minutes, `10` (`0` = off) | `working` status with **no DOM mutation** for `stuckMin` ⇒ stuck-recovery prompt. See §4.1. |
| `followupSmart.stuckPrompt` | string, default below | Override for the stuck prompt. |
| `followupSmart.errorRecovery` | bool, `false` | Visible error surface ⇒ recovery prompt. See §4.2. |
| `followupSmart.errorPrompt` | string, default below | Override for the recovery prompt. |
| `followupSchedule` | `{enabled:false, start:8, end:18, onlyActiveTab:false}` | Send only when the local hour ∈ `[start,end)` (wrap-around supported) and, with `onlyActiveTab`, only while `document.visibilityState === 'visible'`. See §4.3. |
| `syncSettings` | bool, `false` | Mirrors the settings subset to `chrome.storage.sync` write-through. See §5.4. |
| `digestCounters` | `{clicks, followups, blocked}` | Written by the content script, consumed + reset by the background digest. See §5.3. |
| `lastDigestAt` | number epoch-ms, `0` | Set when a digest notification is shown. |
| `onboarded` | bool, `false` | **UI-only** — the engine ignores it. |

Seed keyword list (`rules.blockKeywords` default):

```
delete, remove, drop, wipe, format, billing, payment, invoice, pay, transfer,
refund, production, deploy, revoke, rm -rf, sudo, credential, password, secret, token
```

Default smart prompts:

```
stuck:  Looks like you may be stuck — check the last error or continue where you left off.
error:  An error occurred. Read the error, fix the root cause, then continue.
```

Sanitization on read: lists are trimmed, empty entries dropped; `allowTopics` is sliced to
64 chars/entry and capped at 50 entries; `blockKeywords` is **never truncated** (a dropped
keyword would silently unblock — fail closed; the list is bounded at 500 entries for
performance); `stuckMin` is clamped to `0..1440`; prompts are trimmed and capped at 600 chars;
schedule hours must be integers `0..23` else the defaults apply.

## 2. Gate order (content script)

```
sweep():      alive → enabled → PAUSED → minDelay → path A/B allow → C expand → E review-bar → D open-panel
path A/B:     handledNode → unsafe target → consent-only → CONNECTOR hard-block → BLOCKLIST/TOPIC
              → 5s allow dedup → one-allow-per-card → click
path C/D/E:   visibility → shape/wording → CONNECTOR hard-block → BLOCKLIST/TOPIC → throttle/cooldown → click
followupTick(): state detect → PAUSED → error recovery → stuck recovery → idle eligibility → send
followupAttempt(): alive → enabled → PAUSED → SCHEDULE → sending → approval-present → composer
                   → prompt → DRY-RUN (log only) → type → submit → verify
```

Rails kept intact (unchanged from v1.7.0): never click Deny/Reject/Decline; the adjacent-pair
rule (a lone Allow is never clicked); the consent-card block (notification/permission cards are
never clicked even with “allow muse” wording); no anchors/forms; 30/min allow cap + 30/min aux
cap; 5s fingerprint dedup computed from the same button-anchored scope on every path; rotation
advances only on a **verified** send.

v1.8.0 **tightening** (new, fail-closed): **at most one allow click per card/pair scope**. A
persistent card that keeps several recognized allow options on screen after the first approval
is not walked down the ranking on later sweeps (`Allow once` → `Allow` → `Allow always` would
silently escalate the granted scope). The scope is marked only by a **real** click — a dry run
never consumes a card, so turning `dryRun` off still clicks a card that was only simulated.

## 3. Click-path gates

### 3.1 Pause
`pauseUntil` is read at boot and on every `storage.onChanged`. While active:
`content.js` `sweep()` returns before any detection-to-click step and `followupTick()` returns
before any attempt; `followupAttempt()` additionally returns `{ok:false, reason:'paused'}` so a
manual `followup-send-now` is refused with a precise reason (the pause check sits **before** the
approval-present check). `background.js` renders the badge as `||` (colour `#8a8f98`) and arms a
one-shot `maa-pause-expiry` alarm at `pauseUntil` so the badge flips back without user action;
the 1-minute sweep alarm is a second safety net.

### 3.2 Dry-run
`doClick()` performs **every** state transition of a real click (dedup fingerprint, cooldowns,
rate-cap timestamps, pacing, `clickedNodes`-equivalent marking) but skips `btn.click()` and
flags the entry. Consequences, documented deliberately:

- Dry-run actions are **logged** but never increment `clickCount`/`stats` (queue items carry
  `counts=false` for dry, blocked and follow-up entries) and never increment `digest.clicks`.
- Nodes are marked in a **separate** dry-run WeakSet: turning `dryRun` off re-arms them, so a
  card detected during a simulation is still clicked afterwards (once the 5s dedup window has
  passed) — the simulation never consumes a card.
- Follow-up: the attempt is logged as `followup-dry` (with the text it *would* send), the
  cooldown/hourly-cap pacing advances, nothing is typed and nothing is submitted; the rotation
  index does **not** advance (only verified sends do).

### 3.3 Blocklist
`rules.blockKeywords` (case-insensitive **substring** match, fail closed — over-blocking is
intended) is tested against the **card text and the extracted context** on all five click paths
(A/B allow candidates, C expand, D open-panel, E review-bar). On a hit the candidate is skipped
and **one** `blocked` log entry is written per fingerprint per 30s window:

```json
{ "kind": "blocked", "blockedReason": "keyword:<kw>", "label": "Allow", "context": "<card text>", "at": "…" }
```

Known over-block examples (substring semantics): `format` matches “information”, `pay` matches
“repayment”. That is the fail-closed trade-off; the UI copy should say “keyword appears in the
card”.

### 3.4 Topic whitelist
When `rules.allowTopics` is non-empty, a candidate may only be clicked if
`extractTopic(context)` matches an entry **exactly** (case-insensitive). A mismatch logs
`{kind:'blocked', blockedReason:'topic'}` (same 30s dedup) and never clicks. The gate applies to
all click paths; the whitelist therefore also gates expanding pending cards / opening panels.

`extractTopic()` is the existing v1.3 heuristic: the **last** `Repository <name>` token in the
context, else the first `https://<host>` host, else the first 40 characters of the context,
else `unknown`. Limit: a context without a repository/host token extracts to an opaque
40-char string, so such cards can only match if that exact string is listed — prefer plain
allow cards (paths A/B) for topic whitelisting.

### 3.5 Allow-once mode (`allowOnceMode`)
- Recognition: the legacy `Allow|Approve [once|always|this time]` grammar is unchanged.
  Under `allowOnceMode` the exact variant **`Allow once only`** is additionally recognized
  (decoration-tolerant). `Always allow` (standing grant) is never recognized on any path.
- Ranking in a pair, `allowOnceMode: true`: one-shot forms (`Allow once`, `Allow once only`,
  `Allow this time`) → rank 0; plain `Allow`/`Approve` → rank 1; `Allow always` → rank 2.
  With the mode off the legacy ranking applies (plain → 0, one-shot → 1, always → 2).
- Rank never **filters**: a pair offering a single recognized allow option clicks it as before.
- Mode ON example (live GitHub card shape): `Allow once` beats both `Allow` and `Allow always`.
  Mode OFF twin: plain `Allow` wins — both directions are asserted in the harness.

### 3.6 Connector cards — hard block (owner-reported)
A live Muse **Connector** card (title `Cloudflare`, subtitle `Connector`, a full-width
`Connect` button) is a **user-input surface**: the user connects the service and pastes an
API token themselves. The extension must never interact with it, so the WHOLE container is
hard-blocked on **every** click path — including when an Allow/Deny-like pair renders inside
it — and the refusal is logged once per 30s window:

```json
{ "kind": "blocked", "blockedReason": "connector", "label": "Connect", "context": "<card text>" }
```

Recognition (`connectorIn(scope)`, checked on the candidate scope plus up to 2 ancestors,
never past `<body>`):

| Trigger | Pattern |
|---|---|
| connector label/subtitle | `\bconnectors?\b` anywhere in the container text |
| Connect-family button | a button whose trimmed text (≤40 chars) starts with `connect`, `set up` or `add account` — covers `Connect`, `Connect account`, `Connect <service>`, `Set up`, `Add account` |
| credential-entry wording | `api token`, `access token`, `personal access token`, `paste [the/your] token`, `api key` |

Notes: `\b` prevents `Connected` from matching; the blocklist/topic gates run **after** the
connector gate, so a connector container is reported as `connector` (not as a keyword/topic
block). Fail-closed over-blocking is intended: an approval card nested inside the same
wrapper as a connector card is also left to the user. The follow-up engine is unaffected —
it never touches card DOM, and its own approval-surface guard is unchanged.

## 4. Follow-up smart triggers

### 4.1 Stuck recovery
A MutationObserver tracks the timestamp of the last DOM mutation (`childList`, `subtree`,
`characterData`, `attributes`). When status is `working` **and** it has been `working` for
`stuckMin` **and** the DOM has been silent for `stuckMin` **and** the cooldown/hourly-cap allow
an attempt, the engine sends `followupSmart.stuckPrompt` (default above; `stuckMin = 0` disables).
After each stuck attempt the silence/working watch restarts (no tight retry loop). The send
respects: enabled, pause, schedule, approval-present, composer-empty, cooldown, 6/hour cap.
Fractional `stuckMin` values are allowed (the harness uses `0.05` = 3s).

### 4.2 Error recovery
`errorRecovery: true` scans explicit error surfaces (`[role="alert"]`, `[class*="error" i]`,
`[data-testid*="error" i]`) and `[aria-live]` regions — visible, text ≤300 chars — for:

```
1. /something went wrong/i
2. /\b(?:an?\s+)?(?:error|exception)\s+(?:occurred|happened|encountered|was encountered)\b/i
3. /\b(?:i|we)\s+(?:hit|ran into|encountered)\s+(?:an?\s+)?(?:error|exception)\b/i
4. /\b(?:unhandled\s+exception|traceback|stack trace)\b/i
5. /\b[A-Z][A-Za-z]*Error\b/                (TypeError, RuntimeError, …)
6. /\b(?:request|command|network|server)\s+(?:failed|error)\b/i
7. /\bexit code\s+[1-9]\d*\b/i
```

On a match the engine sends `followupSmart.errorPrompt` (default above). Guards: one send **per
distinct error text** (the fingerprint clears when the error disappears, so a re-appearing error
is answered again); the same cooldowns/caps as the idle trigger; never while an approval is
present; never while paused or outside the schedule. A false positive only costs one paced
prompt — that is why the pattern list can stay simple.

### 4.3 Schedule
`followupSchedule.enabled` gates **all** follow-up sends (automatic, stuck, error and manual
`Send now` alike — the literal contract “send only when…”). Window logic:
`start < end` ⇒ `start ≤ hour < end`; otherwise (wrap-around) ⇒ `hour ≥ start || hour < end`;
`start === end` is treated as a 24h window. With `onlyActiveTab`, the send additionally
requires `document.visibilityState === 'visible'`.

## 5. Background (service worker)

### 5.1 Badge
Today's click count as before; while paused the text is `||` with the grey pause colour. The
badge refreshes on `storage.onChanged` (`stats`/`clickCount`/`pauseUntil`), on the one-shot
`maa-pause-expiry` alarm and on the 1-minute sweep alarm.

### 5.2 Commands (manifest `commands`)
| Command | Suggested key | Action |
|---|---|---|
| `toggle-pause` | `Alt+Shift+P` | not paused ⇒ `pauseUntil = now + 15 min`; paused ⇒ `pauseUntil = 0` |
| `send-followup` | `Alt+Shift+F` | sends `{type:'followup-send-now'}` to the **active muse.ai tab** (no tab ⇒ no-op) |

### 5.3 Startup digest
On `chrome.runtime.onStartup` **only**, the background composes
`{since: lastDigestAt, clicks, followups, blocked}` from `digestCounters` (incremented by the
content script: `clicks` = real click actions performed, dry-run excluded; `followups` =
**verified** sends; `blocked` = rule-blocked candidates logged) and shows **one**
`chrome.notifications` notification when `clicks > 0`:

```
title:   Muse Auto-Allow
message: Since your last session: 12 clicks · 3 follow-ups · 2 blocked
```

The notification text is **hardcoded English on purpose** (a single transient OS notification;
localizing it would add locale keys owned by the UI lane). `lastDigestAt` is updated and the
counters are reset **only when the notification was shown** — with `clicks === 0` nothing is
touched and the counters keep accumulating; a failed `notifications.create` leaves everything
untouched (the digest is retried on the next startup).

### 5.4 syncSettings mirror
`syncSettings: true` (local, per-device — deliberately **not** part of the mirrored subset)
mirrors the subset below to `chrome.storage.sync` on every **local** change
(`storage.onChanged`; sync-area echoes are ignored so the mirror can never loop):

```
enabled, minDelayMs, dryRun, allowOnceMode, rules,
followupEnabled, followupPrompt, followupPrompts, followupChips,
followupSmart, followupSchedule
```

(`followupRotateIdx`, `log`, `stats`, `clickCount`, `schemaVersion` stay device-local.)
Enabling the toggle pushes a snapshot of the present subset keys. **On load**, sync values are
applied only to keys **absent** from local storage — a local choice is never overwritten.

**8KB quota (documented limit — measured in BYTES):** `chrome.storage.sync` allows 8 192
**bytes** per item (`QUOTA_BYTES_PER_ITEM`; 100 KB total, 512 items) — bytes of the serialized
JSON, **not** UTF-16 code units. The guard measures the real size
(`new TextEncoder().encode(JSON.stringify(value)).length`), because a code-unit `.length` check
waves through multibyte content (Vietnamese/CJK — exactly what users write into
`followupPrompts`/`followupChips`): 4 000 `ế` characters are 4 002 code units but 12 002 bytes,
so the write would have been attempted, rejected by the API and — before this fix — silently
never synced. An oversized item is **skipped with a console warning naming the measured byte
size** (local storage remains the source of truth; the rest of the subset still syncs). A
rejected `chrome.storage.sync.set` (quota or any other failure) is **never silent**: the
callback reads `chrome.runtime.lastError` and logs the reason (local console only).

## 6. New log kinds (popup renders them via its generic chip fallback)

| kind | meaning |
|---|---|
| `allow-dry` / `expand-dry` / `open-panel-dry` / `review-bar-dry` | a click that would have happened under `dryRun` (with `entry.dryRun = true`) |
| `blocked` | rule-blocked candidate; `entry.blockedReason` = `keyword:<kw>` or `topic` |
| `followup` | a **verified** follow-up send (`entry.source` = `auto`/`manual`/`stuck`/`error`) |
| `followup-dry` | a follow-up that would have been sent under `dryRun` |

`blocked`, `-dry` and `followup*` entries never increment `clickCount`/`stats` aggregates.

## 7. Test coverage map

| Area | Harness | Checks |
|---|---|---|
| pause: no click / status ping / resume | `test/followup-e2e.mjs` | `v18 pause. no click while paused`, `v18 status. …`, `v18 pause. clearing the pause resumes clicking` |
| dry-run clicks | `test/followup-e2e.mjs` | `v18 dry-run. detection runs…`, `…the card is NOT clicked…`, `…dryRun off re-arms the SAME node…` |
| blocklist | `test/followup-e2e.mjs` | `v18 blocklist.` ×4 (seed keyword, clean control, custom list, never clicked) |
| topics | `test/followup-e2e.mjs` | `v18 topics.` ×4 (match, mismatch log, never clicked, gate off) |
| allow-once | `test/followup-e2e.mjs` | `v18 allow-once.` ×6 (recognition, preference both modes, never always/deny) |
| pause: send + manual + badge + resume | `test/followup-e2e.mjs` | `v18 pause.` ×4 |
| schedule / onlyActiveTab | `test/followup-e2e.mjs` | `v18 schedule.` ×4 |
| error recovery | `test/followup-e2e.mjs` | `v18 error.` ×5 |
| stuck recovery | `test/followup-e2e.mjs` | `v18 stuck.` ×4 |
| dry-run follow-up | `test/followup-e2e.mjs` | `v18 dry-run.` ×2 |
| digest counters | `test/followup-e2e.mjs` | `v18 digest. counters…` |
| hygiene (no deny, ever) | `test/followup-e2e.mjs` | `v18 hygiene. pre-reload…` + the existing `z.` checks |
| connector hard-block (owner-reported) | `test/e2e.mjs` | `FORBIDDEN` now includes `20` (any button inside the connector card) and `lone-connect`; `connectorCheck` asserts the refusal is logged (`blocked` / `connector`) |
| badge / commands / digest / sync / manifest | `test/background-unit.mjs` | `M1–M3, P1–P2, B1–B2, A1–A2, C1–C2, D1–D1b–D4, S1–S8 + **S5b–S5c** (byte-accurate quota, surfaced write failure), L1–L2, G1` (**29 checks**) |
| v1.7.0 regression (all rails) | `test/e2e.mjs`, `test/followup-e2e.mjs` | every pre-existing check stays green |

## 8. Falsification (reverse-mutation proof)

`test/followup-e2e.mjs` accepts `MAA_EXT_DIR=<path>` so a **mutated copy** of the extension can
be run against the same fixtures; `test/background-unit.mjs` accepts an explicit
`background.js` path. Protocol: copy `extension/` to a scratch dir → apply one single-line
mutation that disables a guard → run the harness → the matching checks must go **RED** (and the
rest stay green) → restore the pristine copy → run again → **GREEN**.

Results (this round):

| # | Mutation (guard disabled) | Expected RED checks | Observed |
|---|---|---|---|
| F1 | `content.js` `doClick()`: `const isDry = v18.dryRun === true;` → `const isDry = false;` | the two `v18 dry-run.` click checks | see §8.1 |
| F2 | `content.js` `sweep()`: `if (paused()) return;` → `if (false && paused()) return;` | `v18 pause. no click while paused` | see §8.1 |
| F3 | `content.js` `isAllowText`/`rankAllow`: drop the `allowOnceMode` branch | `v18 allow-once. mode ON: "Allow once only" is recognized and clicked` + `mode ON prefers "Allow once"…` | see §8.1 |

### 8.1 Observed results

| # | Mutation (guard disabled) | RED checks in the mutated run | Everything else | Restored (pristine) run |
|---|---|---|---|---|
| F1 | `content.js` `doClick()`: `const isDry = v18.dryRun === true;` → `const isDry = false;` | exactly 2: `v18 dry-run. detection runs…`, `v18 dry-run. the card is NOT clicked…` | 116 green | 118/118 green |
| F2 | `content.js` `sweep()`: `if (paused()) return;` → `if (false && paused()) return;` | exactly 1: `v18 pause. no click while paused` | 117 green | 118/118 green |
| F3 | `content.js` `rankAllow()`: `if (v18.allowOnceMode) {` → `if (false) {` | exactly 2: `v18 allow-once. mode ON prefers "Allow once"…`, `…neither the plain nor the always option was clicked` | 116 green | 118/118 green |
| F4 | `background.js` `updateBadge()`: pause branch `if (Date.now() < pu) {` → `if (false) {` | exactly 1: `B1 badge. paused => pause marker "||"…` | 25 green | 26/26 green |
| F5 | `background.js` `digestOnStartup()`: `if (d.clicks <= 0) return;` → `if (false) return;` | exactly 1: `D2 digest. clicks=0 => no notification…` | 25 green | 26/26 green |
| F6 | `background.js` `storage.onChanged`: `if (area && area !== 'local') return;` → `if (false) return;` | exactly 1: `S8 sync echo. onChanged(area=sync) is ignored…` | 25 green | 26/26 green |
| F7 | `content.js` `connectorIn()`: `function connectorIn(scope) {` → `function connectorIn(scope) { return false;` | `test/e2e.mjs` (mutated run, `ok:false`): `forbiddenHit:["20"]` + `extra:["20"]` — the Allow option inside the connector card is clicked — and the refusal log is gone (`connectorCheck.ok:false`, `blockedConnector:0`) | no other forbidden id, `denyCount:0`; clicks 13→15 | pristine `ok:true`, `forbiddenHit: []`, `connectorCheck.ok:true` (`blockedConnector:2`) |
| F8 | `background.js` `syncValueBytes()`: `return new TextEncoder().encode(json).length;` → `return json.length;` (the pre-fix code-unit check) | `test/background-unit.mjs`: `S5b sync quota. a value over 8192 BYTES but under 8192 code units is skipped (byte-accurate guard)` | exactly 1 RED (`S5b`, detail `jsonBytes:12002, jsonUnits:4002`, `keys:["followupPrompt","followupChips"]` — the 4 000-char multibyte value was NOT skipped) | 28 green | 29/29 green |

F1–F6 are the transcript of the round that shipped those guards (suite sizes then: follow-up
**118** checks, background-unit **26**); F7 (connector hard-block) and F8 (byte-accurate sync
quota) were re-run in this round against the current suites (follow-up **119**,
background-unit **29**).

Note on F7: the `lone-connect` twin (a bare `Connect` button with no pair) is held by the
lone/pair rail on its own — `Connect` is not an allow-ish label, so no click path reaches it
even with the connector guard disabled. The connector guard's own falsification is therefore
the `20` container: with the guard off the pair inside the card IS clicked and the refusal log
disappears, which is exactly the RED state asserted (`forbiddenHit`/`extra` + `connectorCheck`).

Each mutated run is a full harness pass over a scratch copy of `extension/`
(`MAA_EXT_DIR=<mut-dir>/extension node test/e2e.mjs` / `node test/followup-e2e.mjs`;
`node test/background-unit.mjs <mut-dir>/extension/background.js`) — the RED sets are exactly
the targeted guards, and no unrelated check flips in either direction. The mutation builders are one-line string edits that
assert the source string occurs exactly once (so a drifted copy fails loudly instead of
silently mutating the wrong line).

### 8.1a Independent re-verification (coordinator, maker != judge)

Re-run by the coordinating session on the committed HEAD (`b6faaa0`), not by this lane:

- pristine `node test/e2e.mjs` -> exit 0, `ok:true`, `forbiddenHit: []`,
  `connectorCheck.ok:true` (`blockedConnector:2`).
- the connector-guard mutation re-applied by hand (scratch copy; `function connectorIn(scope) {`
  -> `function connectorIn(scope) { return false;`, anchor asserted to occur exactly once) ->
  `MAA_EXT_DIR=<mut> node test/e2e.mjs` exit **2**, `ok:false`, `forbiddenHit:["20"]`,
  `extra:["20"]`, `blockedConnector:0` — F7's RED state reproduced independently.
- full batch on the same HEAD: `lint.mjs` exit 0; `e2e.mjs` exit 0; `background-unit.mjs`
  **29/29**; `followup-e2e.mjs` exit 0 with **0 failed checks in two consecutive runs**;
  `import-security.mjs` exit 0.
- residual flake found by that verification and fixed at the source (never by weakening a
  check): the harness raced the engine's in-flight send lock, so the `followup-status` ping now
  echoes `sending: followup.sending` and the harness waits for `sending === false` before the
  manual send-now — the engine's refusal with reason `'sending'` was correct behaviour, not a
  defect, so the fix belongs in the harness's observation, not in the engine's guard.

## 8.2 Harness race root causes (follow-up suite) — fixed

`test/followup-e2e.mjs` flapped between exit 0 and exit 2, and a *different* check failed each
time: `v18 error. after the error clears, the same text is answerable again`,
`v18 pause. manual send-now is refused with reason "paused"`, and
`v18 stuck. a custom stuckPrompt override is honored`. All of them were **harness races
against the engine's own asynchronous clocks** — no engine defect — and **no assertion was
weakened, loosened or deleted to get green** (the follow-up check count is unchanged at 119).

Root causes:

1. **Sampled fingerprint clear vs a fixed clear-window** (`v18 error` re-entry). The engine
   clears `followup.lastErrorFp` on a tick that *samples* `errorPresent()` as empty, and it
   samples DOM state on its 1 s heartbeat. The harness cleared the error and then waited a
   fixed 600 ms before re-setting the SAME text: whenever no heartbeat tick landed inside that
   window (~40 % of runs) the fingerprint was never cleared, the re-appearing text looked
   "already answered", and no third send fired → RED.
2. **Seeding is not applying** (`v18 pause` manual refusal, `v18 stuck` custom prompt,
   `v18 schedule` / `onlyActiveTab`). `chrome.storage.local.set` resolves in the WRITER's
   process (the popup page); the content script takes the value in later, on
   `storage.onChanged`. "seed → fixed sleep → assert" therefore races the engine: a negative
   assertion can pass because the config has not been applied *yet*, and a positive one can
   fail because it was applied too late (e.g. stuck send #2 firing with the stale default
   prompt before the custom override had been taken in).
3. **Visibility/seed ordering** (`onlyActiveTab`). Arming `followupSchedule.onlyActiveTab`
   while the fixture tab was still visible let a legitimate visible-tab send fire before the
   tab was hidden.

Fixes (all in the harness — the engine keeps its frozen contract):

- `content.js`'s `followup-status` response now additionally echoes the engine's **applied**
  config — `pauseUntil`, `schedule`, `stuckPrompt`, `errorPrompt`, `allowTopics`,
  `blockKeywords`, `lastErrorFp` (additive keys only; every frozen field is unchanged) — and
  `window.__museAutoAllow.followup` also exposes `lastErrorFp` / `workingSince` / `domIdleMs`.
- New `waitEngine(pred, ms, label)` polls that ping until the engine reports the seeded state.
  Every v18 gate now asserts only after the engine has confirmed the config, and the confirmed
  pings are recorded as `results.v18.applied` so a failure is diagnosable.
- `v18 error`: waits for `lastErrorFp === ''` — the engine's own "the error cleared" signal —
  instead of a fixed 600 ms.
- `v18 stuck`: waits for `stuckPrompt === 'CUSTOM STUCK PROMPT'` before the next silence
  window (3 s) can elapse.
- `v18 pause` / `v18 schedule` / `onlyActiveTab` / the v18-A click gates: the pause, schedule
  window, visibility gate, dry-run, blocklist, topic and allow-once configs are all confirmed
  applied before the probe card is shown; the `onlyActiveTab` fixture tab is hidden FIRST and
  the gate confirmed closed before the negative assertion.

Result: **five consecutive full runs, each 119 checks / 0 failed / 0 verification timeouts**
(§11.1).

## 9. Limits / NOT VERIFIED

- **Live muse.ai**: none of the new gates was exercised against a logged-in muse.ai session.
  Selectors (`[class*="error" i]`, status surfaces, card wording) come from the captured live
  cards used by the v1.7.0 fixtures; real-world wording drift can reduce detection (fail closed:
  a missed detection means no click/send, never a wrong one).
- **`onlyActiveTab`**: verified by making the fixture tab a genuine background tab
  (`Target.activateTarget`); real-world behaviour on a minimized browser window is Chrome’s
  standard `visibilityState` semantics.
- **Stuck detector**: “no DOM mutation” includes attributes/characterData; pages that animate
  DOM attributes forever (e.g. re-rendering timestamps) will not be seen as stuck — fail open
  (no send), which is the safe direction.
- **Digest notification**: shown only on browser startup (`chrome.runtime.onStartup`); it is not
  re-shown if the browser stays open for days. Counters keep accumulating until a digest is
  actually shown.
- **Sync**: the 8KB per-item cap is measured in BYTES, so a large or multibyte
  `followupPrompts` list stays local with an explicit console warning naming the size;
  cross-device propagation of such an item does not happen. A rejected `chrome.storage.sync.set`
  is logged with its reason rather than swallowed.
- **Keyword matching is substring-based** and therefore over-blocks (see §3.3). The UI copy
  should warn users before adding short keywords like `pay`.
- **Connector recognition is heuristic** (word `connector`, Connect-family button text,
  token wording). A card that renders none of those (e.g. an icon-only connect affordance)
  is not recognized — but it also carries no allow-ish option, so no click path reaches it;
  the guard is defense-in-depth for the case where an approval pair renders inside the card.
  Conversely the bounded 2-ancestor climb can over-block an approval card that shares a
  wrapper with a connector card — fail closed, left to the user.
- **`pauseUntil` expiry**: the badge refresh relies on a one-shot alarm + the 1-minute alarm;
  worst case the badge lags ~1 minute if the one-shot alarm is lost (content-side gating is
  time-exact — no clicks happen after expiry regardless of the badge).

## 10. ENVIRONMENT BOOTSTRAP & TEST EXECUTION

- Environment: Windows 11 host, git-bash/MSYS shell, Node `v26.7.0`
  (the pinned Node toolchain in the local Hermes tools dir), installed Google Chrome
  ≥137 (CDP `Extensions.loadUnpacked` lane), zero-dependency repo (no package.json).
- Bootstrap performed: none required beyond the pre-existing toolchain (no installs; scratch
  profiles and temp extension copies live under the OS temp dir and are reaped by the harnesses).
- Commands executed (all from the repo root):

```
node scripts/lint.mjs
node test/e2e.mjs
node test/followup-e2e.mjs
node test/import-security.mjs
node test/background-unit.mjs
```

- Results: recorded in §8/§11 (final gate table below). The e2e harnesses launch a scratch
  Chrome (detached via PowerShell) and reap it by scratch-profile path at teardown.
- **The Chrome/CDP suites MUST run FOREGROUND (a real TTY).** In a non-TTY / background shell
  they abort with `stdin is not a tty` and rc=1 before executing a single check — that is a
  launcher limitation, NOT a test failure. Give each run a generous timeout, and re-run a
  single flaky run before concluding.
- Limitations: browser gates are Windows-only by design (see `.github/workflows/ci.yml`);
  the vm/unit harnesses are OS-independent.

## 11. Gate results (final state)

| Gate | Result |
|---|---|
| `node scripts/lint.mjs` | exit 0 — “lint OK — 24 checks across 18 files (syntax, JSON, i18n parity, no remote code, minimal permissions)” |
| `node test/e2e.mjs` | exit 0 — `ok:true`; 13 expected clicks, no missing/extra/forbidden, 0 deny, dedup n7=1/n11=1, `connectorCheck.ok:true` (`blockedConnector:2`), Web Locks + stats + encryption + stats-page green |
| `node test/followup-e2e.mjs` | exit 0 — **119 checks, 0 failed, 0 verification timeouts** on each of five consecutive runs after the race fixes (§11.1) |
| `node test/background-unit.mjs` | exit 0 — **29 checks, 0 failed** (27 + `S5b`/`S5c`) |
| `node test/import-security.mjs` | exit 0 — 29 checks, 0 failed (stats.js untouched) |

Test-count changes this round: `background-unit.mjs` **27 → 29** (byte-accurate sync quota
`S5b`, surfaced sync write failure `S5c`); `followup-e2e.mjs` unchanged at **119** (the race
fixes added no assertions and removed none); `lint.mjs` unchanged at 24 checks.

### 11.1 Consecutive follow-up-e2e runs (post-fix)

```
run 1  rc=0  ok:true  checks:119  failed:0  timeouts:[]
run 2  rc=0  ok:true  checks:119  failed:0  timeouts:[]
run 3  rc=0  ok:true  checks:119  failed:0  timeouts:[]
run 4  rc=0  ok:true  checks:119  failed:0  timeouts:[]
run 5  rc=0  ok:true  checks:119  failed:0  timeouts:[]
```

Falsification runs (mutated copies): F1 → 2 RED / 116 green, F2 → 1 RED / 117 green,
F3 → 2 RED / 116 green, F4/F5/F6 → 1 RED / 25 green each, F7 → `test/e2e.mjs` RED
(`forbiddenHit:["20"]`, `connectorCheck.ok:false`), F8 → 1 RED / 28 green (`S5b`); pristine
re-runs fully green (§8.1).
