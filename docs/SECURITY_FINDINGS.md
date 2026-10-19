# Security findings register — Muse Auto-Allow (SGPS 7A format)

Findings from independent adversarial audits (read-only children; live Chromium reproductions
on their own scratch profiles). States follow `SOURCE_FIXED != VERIFIED != RUNTIME_VERIFIED !=
CLOSED`. Baseline for the first register entry: engine shipped since v1.10.0.

---

## CX-01 — collapsed-pending EXPAND click accepts any "Allow Codex …" button (text-only detection)

| Field | Value |
|---|---|
| Severity | MEDIUM · CONFIRMED (live repro: a lone `<button>Allow Codex to read repository files</button>` received an expand click) |
| Exploit path | A malicious chatgpt.com surface can render a button whose label matches `PENDING_RE` and wire its click to an approval action. The engine treats the click as `codex-expand` (aux rail), never as an approval — but the page's own handler could still act. |
| Customer impact | Inherent limit of DOM automation: the engine clicked a page-supplied button. No local approval was recorded and the revealed-card path still requires a real Allow+Deny pair. |
| Root cause | Text-only detection for the collapsed card; the engine's rail (never click a lone affirmative) applies to APPROVALS, while expand clicks are navigation. |
| Disposition | **ACCEPTED RISK (documented) + hardening**: v1.18.0 adds a `DESTRUCTIVE_RE` skip on the expand path. The click stays `codex-expand` (never logged as an approval), rate-limited (aux rail), and blocks anchors/forms. |
| Residual | A lying page can still self-execute on any click we dispatch for expansion. Mitigation is commercial/structural (the engine never treats it as consent), not solvable in the DOM alone. |
| Re-attack | codex-e2e covers expansion of the genuine collapsed card; the expand click kind is asserted distinct from `codex-allow`. |

## CX-02 — reworded auth/consent surfaces bypassed the hard block (P1)

| Field | Value |
|---|---|
| Severity | HIGH · CONFIRMED (live: `Provide the Bearer value`, `Enter your API-key`, `Complete login to GitHub` all received ALLOW clicks on the pre-fix engine) |
| Exploit path | `AUTH_WORD_RE`/`CONNECT_BTN_RE` knew `authorize|sign in|log in|oauth|api key|access token|…` but not `bearer`, `api-key`, or single-word `login` — a card with such wording plus an Allow/Deny pair passed `authNear()` and was approved. |
| Customer impact | The consent boundary leaked: the extension could approve an auth/credential surface — exactly what the rail forbids. |
| Root cause | Divergent keyword lists between engines (content.js was widened at v1.14.0 F3; codex.js kept the older list). |
| Fix | v1.18.0: `AUTH_WORD_RE` + `CONNECT_BTN_RE` widened to content.js parity **plus** `bearer`, `api[-_ ]?key`, `login`, `sign-in/login` variants. |
| Negative test | `test/fixture-codex.html` gains three cards (bearer / API-key / login) with Allow+Deny; `codex-e2e` FORBIDDEN adds `cbearer`, `capikey`, `clogin`. Pre-fix the ids are clicked (audit repro); post-fix they must be untouched in every phase. |
| Re-attack | codex-e2e LIVE phase asserts the full FORBIDDEN set untouched (`forbiddenHit: []`); the connector block logs `blockedReason: 'connector'`. |
| State | SOURCE_FIXED (v1.18.0) → VERIFIED on the codex-e2e suite; runtime closure = the shipped smoke artifact. |

## CX-03 — plaintext DOM context survived a failed encryption (LOW)

| Field | Value |
|---|---|
| Severity | LOW · CONFIRMED (source: `encryptCtx()` returns null on failure; the entry kept `context` and was persisted) |
| Exploit path | Not exfiltration — local storage only. A crypto failure (rare) would write the card sentence as plaintext into the extension's own log, violating the documented "0 plaintext" store contract. |
| Customer impact | Local privacy posture weaker than documented; the log could carry approval sentences in clear text. |
| Root cause | `if (enc) { entry.ctx = enc; delete entry.context; }` — the delete only ran on success. Same pattern in BOTH engines. |
| Fix | v1.18.0: `if (enc) entry.ctx = enc;` then **unconditional** `delete entry.context;` in content.js and codex.js. A failed encryption drops the sentence (label/kind/reason stay). |
| Negative test | The store contract is asserted by `codex-e2e` (0 plaintext entries) and the encrypted-log checks in the battery. |
| State | SOURCE_FIXED (v1.18.0) → VERIFIED by the battery; runtime closure = shipped artifact. |
