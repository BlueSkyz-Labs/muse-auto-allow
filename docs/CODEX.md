# Codex (ChatGPT) auto-approve — engine contract, rails, and evidence (v1.10.0)

A **separate, opt-in** engine (`extension/codex.js`, chatgpt.com only) that clicks the
**affirmative** option on Codex approval requests, so a long-running Codex task keeps
working while you are away. It ships **off**: its own switch — `codexEnabled`, rendered
in the popup's **Safety & Control panel** as *Codex (ChatGPT)* — is the only way to arm
it, and with the switch off the engine is completely dormant (no click, no log entry;
proven by the OFF phase of `test/codex-e2e.mjs`).

This document is the contract: what the engine matches, the rails that must never
change, the storage it shares with the Muse engine, and the honest limits.

---

## 1. Why this exists

Codex asks for approval before actions that leave its sandbox — run a command outside
the workspace, reach the network, touch a protected resource. In the ChatGPT web UI the
request renders as an approval card with an affirmative option (`Yes, proceed`,
`Allow`, `Approve`) next to a negative one (`No, and tell Codex what to do differently`,
`Deny`, …). Step away and the run sits on that card, exactly like Muse's approval cards
— which is the job this extension already does, applied to a second agent surface.

OpenAI ships its own *auto-review* — a reviewer model that decides eligible requests —
but it is plan/environment dependent and can be missing or disabled
(learn.chatgpt.com troubleshooting). This engine is the client-side complement: **you**
choose to have the card clicked in your own session, with your own rules.

## 2. The switch (the user-facing control)

| Where | What |
|---|---|
| Popup → **Safety & Control** → *Codex (ChatGPT)* | On/off switch (`codexEnabled`), default **off**; the one-line safety note; a live chatgpt.com tab-status line; while on, a **"Codex" chip** on the Safety entry |
| Same key | Synced only while the opt-in *Sync settings* is enabled (it is in the mirrored subset) |
| Installer | Seeds an explicit `codexEnabled:false` (absent-only — never overwrites a stored choice) |

Placement: the switch lives in the Safety & Control panel (the same home as the YOLO
opt-in) because that panel is a **full-popup overlay** — it costs the main popup zero
height. Measured at this revision: the crowded popup state has only ~6 px of slack, so
any in-flow section would break the shipped ≤600 px popup discipline.

Everything the engine does is gated on this key. The content script is injected on
chatgpt.com by the manifest, but with the switch off it reads settings and stops —
the OFF phase of `test/codex-e2e.mjs` proves zero clicks and zero log entries on a page
full of approval-shaped pairs.

## 3. What it clicks — detection paths, in priority order

1. **Pair heuristic (path P).** An affirmative button whose nearest button container
   holds exactly one clickable affirmative (best-ranked — itself) **and** a clickable
   negative counterpart. The pair must sit in the SAME container — a lone affirmative
   next to a distant or disabled negative is not an approval request and is never
   clicked (the same adjacent-pair rule the Muse engine uses).
2. **Collapsed pending card (path E).** A button reading "Allow Codex to …" / "Let
   Codex …" is clicked to *expand* it; the revealed pair is approved on the next sweep.
   Paced by the auxiliary rail (30/min, 30 s per-text cooldown, 800 ms throttle).
3. **Review bar (path R).** A bare Review/Open/View control whose short container says
   approval/review is needed ("A task needs your approval", "waiting for your review")
   is clicked so the approvals panel renders; the pair is approved on the next sweep.
   A generic "Review" without that wording is never clicked.

Affirmative labels are matched **exact-ish** (decoration tolerated): `allow`, `approve`,
`proceed`, `yes, proceed`, `yes, allow/approve`, … with one-shot forms (`allow once`,
`allow once only`, `this time`) recognized. **Standing grants** — `Always allow`,
`Yes, and don't ask again for this command in this session`, `Allow for this
session/task/command` — are **not recognized by default**; only the explicit YOLO
opt-in makes them clickable, and the ranking still prefers the narrowest recognized
grant (one-shot first).

## 4. What must never happen (the rails)

- **Never Deny.** Deny/Reject/Decline/No/Cancel/Stop/Abort/Dismiss/"keep waiting"/
  "not now" are never clicked — an explicit negative-text skip runs before every other
  check on every path, and the YOLO opt-in does not change this.
- **Never a lone affirmative.** The clickable negative counterpart in the same
  container is mandatory (fail closed when it is missing, disabled, or split away).
- **Never an auth/connector surface.** Containers carrying Connect/Authorize/Sign
  in/link-account/API-key/token wording are hard-blocked wholesale, even when an
  Allow-like pair renders inside them — the user connects accounts themselves.
- **Consent wording cannot be overridden.** notifications, camera, microphone,
  location, clipboard (and newsletter/subscribe/cookies/marketing without approval
  wording) are skipped even when the copy says "Allow …".
- **No silent scope escalation.** Standing grants stay manual unless YOLO is on;
  at most ONE affirmative click per pair scope; dedup fingerprints are
  button-anchored and path-independent (the same scope computation as the Muse engine).
- **Block rules apply.** The shared frozen keyword seed (`BLOCK_SEED`, byte-identical
  with content.js — enforced by `scripts/lint.mjs`) blocks a card whose text or
  context carries a seed keyword, logged once as `blocked · keyword:<kw>`; a non-empty
  allow-topics list blocks too (the Codex topic is always `chatgpt.com`). YOLO bypasses
  both, exactly like the Muse engine.
- **Bounded clicking.** One click per element (WeakSet), 5 s fingerprint dedup, 30 s
  per-text cooldowns on expand/bar clicks, auxiliary and affirmative rates capped at
  30/min; real visibility/pointer/opacity checks; never inside `<a>` or a `<form>`.
- **Fail closed everywhere.** `pauseUntil` halts the engine; dry-run logs `codex-*-dry`
  entries and clicks nothing; the boot gate refuses every sweep until the settings read
  is applied (the v1.9.3 lesson, replicated); unknown state does nothing; an
  invalidated extension context stops the script.

## 5. Storage contracts (shared with the Muse engine)

| Key | Shape |
|---|---|
| `codexEnabled` | bool, default false (this feature's own switch) |
| `pauseUntil` / `dryRun` / `yoloMode` / `allowOnceMode` / `minDelayMs` / `rules` | shared with content.js; same absent=default semantics |
| `log` | entries `{ at, kind: 'codex-allow'｜'codex-expand'｜'codex-open-panel'(+'-dry')｜'blocked', label, ctx (AES-GCM), blockedReason? }` — last 50 |
| `clickCount`, `stats.byDay/byMonth/byYear/byTopic` | the Codex topic is `chatgpt.com`; counts include Codex clicks |
| `digestCounters` | the startup digest counts Codex clicks like Muse clicks |

Flushes ride the SAME serialized queue and the SAME Web Lock (`maa-record-v1`) as
content.js, so parallel muse.ai/chatgpt.com tabs cannot lose a write; the
at-rest encryption uses the same per-install AES-GCM key.

## 6. Evidence

- `test/codex-e2e.mjs` (real Chrome, scratch profile, the CODEX manifest entry widened
  to localhost only — the Muse entry is not): **OFF** = dormant (zero clicks, zero log
  entries; `data-codex-auto-allow` proves injection while sleeping, and the muse
  attribute proves scope isolation); **DRY** = the popup switch arms the feature
  (storage read-back) while logging-only: no clicks, `-dry` entries only; **LIVE** =
  the expected set clicked (pair, trio-one-shot, expand→pair, bar→pair, dedup held to
  one click in the window) and the full forbidden set untouched — lone, disabled/
  split/anchor negative, consent card, auth container, standing-only card, keyword
  card, deny-only, generic Review — never a deny; **YOLO** = standing + keyword cards
  clicked, consent/auth/lone/never-deny rails still hold. Then the store contract:
  kinds, `blocked` reasons (`connector`, `keyword:delete`), `byTopic['chatgpt.com']`,
  `clickCount`, digest counters, encrypted-at-rest round-trip.
- `test/background-unit.mjs` — the service worker's chatgpt.com nudges are
  url-filtered (muse + chatgpt tabs, exactly once each; unrelated hosts excluded),
  `codexEnabled` mirrors through the opt-in sync subset, the installer seeds
  `codexEnabled:false` absent-only (explicit `true` survives).
- `scripts/lint.mjs` — manifest host set and per-engine content_scripts matches pinned
  exactly; the two engines' `BLOCK_SEED` copies must stay byte-identical.
- **Reverse-mutation falsification (recorded):** a mutant copy of the extension with
  the `if (!state.enabled) return;` gate removed from codex.js turns the OFF phase
  RED (the fixture page gets clicked while the switch is off); the pristine tree is
  GREEN. Run: `MAA_EXT_DIR=<mutant> node test/codex-e2e.mjs`.

## 7. Honest limits

- **English-label matching.** Labels are matched in English (the shipped Codex
  vocabulary). A ChatGPT UI in another language matches nothing — the engine fails
  closed (no click) rather than guessing. Extending the label set is future work.
- **Heuristic, not contract.** The fixture encodes the *shipped* Codex wording family,
  not live chatgpt.com markup (which can change without notice). The rails are
  conservative: anything the engine does not recognize is left to the user.
- **The expand path (E) clicks a collapsed "Allow Codex to …" control to reveal it.**
  If a future UI made that click grant immediately, the click is still an allow-type
  consent from your session, bounded by the same filters — but the engine cannot tell
  the two shapes apart in advance.
- **`allowTopics`, when set, applies to Codex cards with the fixed topic
  `chatgpt.com`** — a topics list that does not include `chatgpt.com` blocks Codex
  clicks (fail closed; the block is logged with reason `topic`).
- The engine never reads your repositories or files; it only interacts with the DOM of
  chatgpt.com pages you already have open, in your own session.
