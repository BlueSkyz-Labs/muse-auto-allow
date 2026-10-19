# G02 — Mission Playbooks implementation spec

**Scope:** extend the shipped Missions in `content.js`; do not add a second mission concept, remote content, permissions, or timers. Playbook steps remain reviewed, shipped English text. User values personalize only explicit tokens. All safety rails remain global and immutable.

## 1. Variables and prompt construction

**Token grammar:** `{{name}}`, where `name` matches `[a-z][a-z0-9_]{0,31}` (ASCII, case-sensitive). No whitespace, nesting, escaping, or partial-token syntax. A malformed token-like sequence or unknown valid token makes the playbook/run invalid; never send unresolved braces. Escape is not needed: values are literal text, not HTML or a template language.

Each playbook declares allowed variable names and English default strings. On start, form a per-run `values` object by copying those defaults, then overlaying validated user-supplied values. Require every supplied name to be declared; missing values use defaults. Reject the entire start if any value fails validation—do not silently truncate or partially apply. Each value is a string, trimmed, non-empty, at most 120 Unicode code points; each final rendered step is at most 2,000 code points. Reject C0/C1 controls (including tab/newline), bidi override/isolate controls, and unpaired surrogates. Do not HTML-interpret values. Scan each value case-insensitively with the existing `keywordIn`/`v18.blockKeywords` screen and `CONNECTOR_WORD_RE`/`TOKEN_WORDING_RE` connector/credential screens; reject on a hit. This blocks dangerous strings, not merely dangerous tokens. Revalidate persisted values on load and immediately before send; failure disables the playbook and sends nothing.

**Assembly:** for the current shipped step, replace each complete `{{name}}` once by its validated value, literally (replacement callback, never replacement-string `$` semantics); then scan for remaining `{{`/`}}` and fail closed if any remain. Run the normal final-text non-empty/length checks and existing send-path guards. Unknown tokens never fall back to raw token text. The same pure renderer is used for preview and send.

**Preview:** selecting a playbook opens its existing full-popup Missions sheet into a configuration state. Show defaults populated in editable controls, then render the complete *next step* prompt as text via `textContent` before Start. Preview updates on input, identifies unresolved/invalid values inline, and disables Start. No auto-send on selection; user must inspect preview and explicitly press Start. Active run values are immutable; editing requires stopping/restarting. Preview is local and never reads page content.

## 2. Per-playbook guards

Add two optional, narrowing guards in shipped playbook metadata: `extraBlockedKeywords` (small reviewed list, max 20, each 1–40 chars) and `pauseWhenUnavailable` (boolean; default false). Sanitize malformed guard metadata fail-closed: invalid playbook settings cannot start. In `followupAttempt`, for mission overrides, before `typeIntoComposer`, check extra keywords against the final rendered text using the same case-insensitive substring semantics as `keywordIn`; on match return `{ok:false, reason:'mission-guard'}` without typing/advancing. Check `pauseWhenUnavailable` in the existing eligibility/send path: if the current mission step has no valid renderable text/values, refuse and keep the mission paused/inactive; never substitute another prompt. Do not change global `keywordIn`, connector detection, approval-surface detection, Deny handling, composer checks, pause, schedule, dry-run, caps, or verification. Extra guards only add refusals; no playbook field can disable or override global gates, including YOLO bypass rules for their separate click path.

## 3. Storage and migration

Keep legacy keys and `mission: {id,step,cycles,startedAt,lastSentAt}` readable. Add local-only `missionPlaybooks` (schema version 1; optional edited defaults/guards keyed by shipped ID) and extend active `mission` with `values` (validated per-run snapshot) and optional `playbookVersion:1`. Do not store secrets; validation rejects credential/token-like values. Sanitize against known IDs/declared variable names, strict types, lengths, counts, and guard allowlists; any invalid active `values` clears/stops the active mission (fail closed), while a bad custom definition falls back to immutable shipped metadata only if no user override is needed. Unknown keys ignored. Persist one atomic storage write per user action under the existing Web Lock convention; no multi-write partial start. Settings sync is explicitly **not** enabled: remain in `chrome.storage.local`, no new permissions or sync migration.

In-flight migration (3 steps): (1) old mission objects without `values` load with shipped defaults; (2) preserve `id/step/cycles/timestamps` exactly and do not reset progress; (3) persist normalized version/values on the next explicit user action, not on passive startup. Invalid/missing defaults stop sending rather than resume with unresolved tokens.

## 4. Popup and accessibility

Extend the existing `#missionSheet` reached by `#misbtn` in the Auto-follow-up header—not the in-flow block. Add IDs: `#misConfig` (configuration container), `#misVariables` (generated labeled inputs), `#misPreview` (read-only preview, `aria-live="polite"`, `aria-atomic="true"`), `#misValidation` (`role="status"`), `#misStart` and `#misCancel`. Keep shipped playbook selector `#misList`, active controls, and progress. Overlay remains fixed viewport with its existing scrollable `.ovbody`; cap configuration section to 320px available sheet body and make it internally scrollable, preserving the 320×600 popup budget (no in-flow height increase). Labels use `<label for>`, preview uses textContent. Tab follows DOM order; Enter/Space activates native buttons/radio rows, Escape closes overlay and restores focus to `#misbtn`; validation focuses first invalid field, not a toast. Start/Cancel are explicit buttons; no keyboard shortcut.

## 5. i18n keys (English source; add identical keys to en, vi, es, ja, ko, zh_CN)

- `missionVariables`: “Playbook variables”
- `missionPreview`: “Next-step preview”
- `missionStart`: “Preview and start”
- `missionCancel`: “Cancel”
- `missionValueInvalid`: “Enter a valid value; unresolved or unsafe values cannot be sent.”
- `missionUnknownToken`: “This playbook has an unsupported variable token.”
- `missionGuardBlocked`: “This playbook guard blocked the step; progress was not changed.”
- `missionUnavailable`: “The step is unavailable; the mission remains paused.”

No new log kind is required: verified send stays `mission`, dry-run stays `mission-dry`; blocked guard attempts use existing `followupAttempt` response and must not advance. Add `mission-guard` to the existing popup send-reason map/i18n reason coverage; do not add bench/experience kind. Extend experience reason enumeration only if its exhaustive check requires the new reason map key.

## 6. Tests

**`test/mission-e2e.mjs` fixture updates:** add a playbook with declared `project`/`branch` values and tokens in two steps. Assert default + run override preview equals sent text byte-for-byte; literal `$&`/braces-looking values do not trigger replacement semantics; unknown/malformed token, undeclared key, empty/overlength/control/bidi value, keyword-hit value, and connector/credential-hit value prevent Start/send and do not advance; verify step 2 uses same run snapshot. Seed legacy in-flight `mission` without new fields and prove same id/step resumes with defaults. Seed corrupt `values` and assert fail-closed/no send. Assert extra keyword guard blocks before typing and no advancement; global approval card, composer draft, pause, dry-run, and caps remain unchanged. Keep the existing corpus positive/negative safety scan and assert no shipped token is undeclared.

**Unit suite:** add `test/mission-playbook-unit.mjs` for token parser/renderer and sanitizers (grammar boundaries, duplicate/unknown/malformed token, codepoint caps, controls/surrogates, fallback/default merge, connector and keyword screen, guard union). Follow repository’s dependency-free unit harness pattern; export pure helpers behind a test-only hook if needed, without runtime dependencies.

Run mission E2E, new unit suite, `scripts/bench/experience.mjs --only=trust`, six-locale parity/overflow checks, and full project QA. Verify manifest permissions unchanged and no new alarm.

## 7. Files to touch

1. `extension/content.js` — shipped variable metadata, sanitizer/renderer, active snapshot, guard enforcement, status preview fields.
2. `extension/popup.html` — configuration/preview controls inside mission sheet.
3. `extension/popup.js` — rendering, validation, explicit start/cancel, atomic persistence, reason mapping.
4. `extension/_locales/{en,vi,es,ja,ko,zh_CN}/messages.json` — eight keys each.
5. `test/mission-e2e.mjs` — fixture assertions.
6. `test/mission-playbook-unit.mjs` — new unit suite.
7. `scripts/bench/experience.mjs` — only if exhaustive reason-map assertions need `mission-guard` coverage; no new kind.

No `background.js`, manifest, permission, or timer changes.