# SECURITY V19 AUDIT — Muse Auto-Allow, frozen revision v1.9.1

> **Lane:** SECURITY & PAID GO-LIVE ROUND — **AUDIT ONLY** (read-only; no fix in this lane).
> Charter: `docs/SECURITY_PAID_GO_LIVE_ROUND.md` (S0–S15 map). Prompt: `docs/SGPS_SECURITY_PAID_v1.6_ROUND_PROMPT.md`.
> This document is the audit; remediation + independent re-attack are separate lanes (S12/S13).
> **S12 REMEDIATION (separate lane):** F-V19-1 (MEDIUM) and F-V19-2 (LOW) are **FIXED** at the
> post-fix revision — see the status + proof in §9 and the gate re-run / falsifications in §10.1.
> The audit's own findings and evidence below are unchanged.
> **Prior evidence is PRIOR EVIDENCE ONLY** (redteam v1–v4, the v1.6/v1.7 security rounds). Every
> previously-closed finding is **re-attacked at THIS revision** (§8); no old PASS is re-cited as fresh.

---

## 0. REVISION BINDING (S1)

| Item | Value |
|---|---|
| Repo | `C:/00. AI Project/PRJ_AutoAllowMUSE` (public), branch `main`, clean tree |
| **HEAD (frozen)** | `9e6b151d150a62641e09295849a92cadbaa3f3cf` — "docs(release): v1.9.1 packet sync…" |
| Freeze commit | `6187606` (tag **`v1.9.1`**); HEAD is the packet-sync doc commit on top of it (no `extension/**` change) |
| Artifact | `dist/muse-auto-allow-v1.9.1.zip` — **180,069 bytes**, sha256 `eec91d1d8f16005e2f34a748145d7a7d32c04b7d85f8ada267255fdb0ac8d1d8` (matches the frozen hash; on-disk `sha256sum` re-run) |
| Evidence classes | `SOURCE_REVIEWED` · `AGENT_REPORTED` · `INDEPENDENTLY_VERIFIED` · `RUNTIME_VERIFIED` · `NOT_VERIFIED` |

### 0.1 sha256 of the reviewed files (frozen @HEAD)

```
extension/content.js                92fc55638020dfa9d3a702a4eec6b18c12a41527353a10462314c0fb32ab2eb1
extension/background.js             50ef89011f64f2f059b13e505b6d7155bd370775ab10ee0a6233bc4d05b2e1fc
extension/popup.js                  0aca892942b3d8f7e775b340d471928e7df3c25a134fbe1df42f4900e75982ea
extension/stats.js                  a47da7aa8b7b83c13a073eaede9c97ef73dd9a992d859eab03e3eaea3aa53543
extension/popup.html                35d945ad1e7472c37fc608dfd132b53ce6d073045c0e3aa1735b00efa8a29c59
extension/stats.html                ad64f89b5f394011cdf27729343d19b01b30e500e165a9bf3c8f4ccec6423747
extension/manifest.json             1a993e3109d196c1f891c232d76c5c1f8cae4f82dfe4b89a752cd37d1f7e8242
extension/_locales/en/messages.json 6fea4b73aab4e044952bbc07c4db5e2a3d7d04ed8f8d8f49871a29d49d731a46
extension/_locales/{vi,zh_CN,ja,ko,es}/messages.json  (6 files — see git)
scripts/lint.mjs                    b27792c1e635a502a87a91f64a9d3daeb127c66eb4d319ae8fb66d296427eecd
scripts/verify-zip.py               84f753e5db88a01ee52e7769e4fd88fb2f4cfa70cc039111a41bd5db5b831660
test/e2e.mjs                        db4e2933fc601e15d23c5d5ed95b2a32956d9c3f16613be6c9b796aba10c2ab4
test/followup-e2e.mjs               a550908665c036557ed648f07f49357ad06e34172ae8a0cdb342f5b796447444
test/mission-e2e.mjs                d074eb8a374e63b176a1c3069881188bd95d491a9ed37998205e9640c8573e36
test/lang-switch-e2e.mjs            992e8d751f7bb7af58b19c4e8e26bc680c5e8bbb934cef6d1bcf4686492a3654
test/background-unit.mjs            ae8474bad9d750c4cd479f6f3ad7c297271940b8d9cd5f980a7b9e4021a71aec
test/import-security.mjs            3a80756d7854fb3b35a053f6f39453205e6422ee1841a9b9c0f9ed68a114f240
```

`DISCOVERED_ON` = `9e6b151`. This lane writes nothing else; `FIXED_ON`/`VERIFIED_ON` are for the
remediation/re-attack lanes.

---

## 1. LIVE TRUTH SNAPSHOT

- **What it is:** a Chrome **MV3** extension that auto-clicks Muse's approval "Allow" on
  `muse.ai` (delegated approval, in the user's own session), plus an **auto follow-up engine**
  (v1.6/v1.7: type+submit prompts on idle), a **v1.8 authority surface** (pause / dry-run / rules
  / smart follow-up / schedule / settings-sync mirror / digest notification / language switcher),
  and — **NEW in v1.9** — the **Mission Orchestrator** (a stateful sequence of *shipped* prompts
  sent into the session, `missionEnabled` + `mission{id,step,cycles,…}`, caps 12 steps / 3 cycles).
- **Zero backend, zero deps, zero network** (see §6). All state in `chrome.storage.local`
  (+ opt-in `chrome.storage.sync` settings subset). Permissions: `storage`, `alarms`,
  `notifications`; host pinned `https://muse.ai/*` + `https://*.muse.ai/*`; CSP
  `script-src 'self'; object-src 'self';`; `all_frames:true`; no `web_accessible_resources`; no
  `externally_connectable`. **`SOURCE_REVIEWED` + `RUNTIME_VERIFIED`** (manifest read; loaded in
  real Chrome by the suites).

---

## 2. S2 — THREAT MODEL REGEN (at v1.9.1)

Authority surfaces **new since the v1.7 model** (the model in `docs/SECURITY_AUDIT_DRAFT.md` §2):
the v1.8 pause/dry-run/rules/smart/schedule surface, the settings-sync mirror, the digest
notification, the language switcher's same-package locale read, and the **v1.9 Mission
Orchestrator** (a *send-authority* state machine holding durable state). `THREAT_MODEL_REGEN_REQUIRED = TRUE` (done).

| ASSET | ENTRY | ATTACKER CONTROL | TRUST BOUNDARY | AUTHORITY CHANGE | EFFECT | DETECTION | RECOVERY |
|---|---|---|---|---|---|---|---|
| Click authority (allow) | muse.ai DOM (`all_frames`) | page content (incl. frames) | DOM(lower) → heuristics → `btn.click()` | grant approval as the user | approval granted / mis-click | rails + encrypted log | toggle OFF; review log; Muse-side revoke |
| **Send authority — follow-up** | composer + status DOM | page (trigger); storage (text) | storage(prompt)+DOM(trigger) → type/submit | send a message as the user | message sent; agent continues | verify composer + caps + log | disable follow-up; cooldown 10 m / 6 h cap |
| **Send authority — Mission (v1.9)** | same composer path; `mission`+`missionEnabled` in storage | page (idle trigger); storage (mission object) | **shipped corpus (text)** + storage(which mission/step) → send | send the *next plan step* as the user | a sequence of shipped directives sent; durable mission state | `mission`/`mission-dry` log kind; caps 12/3 | clear `mission`; toggle `missionEnabled`; pause |
| Settings-sync mirror | `chrome.storage.sync` | Chrome account sync data | local↔sync (Google) | change settings subset on other devices | follow-up prompt/rules change cross-device | console warn on quota/failure | turn sync off; clear sync data |
| At-rest data (log/context/key) | `storage.local` + backup file | profile access / crafted file (user-mediated) | disk/file → extension | read/write/rotate key, log | read context / corrupt data | AES-GCM; sanitizer | restore backup; clear storage |
| Locale file read | `_locales/<id>/messages.json` (same package) | none (fixed id list) | package → popup | render localized strings | — | fixed `LOCALE_IDS` validation | — |
| Digest notification | `chrome.notifications` on startup | local counters | local → OS | show one transient notification | info leak to shoulder-surfer (bounded) | local compose only | — |
| Update channel | CWS / unpacked dir | publisher compromise | pipeline → browser | full extension authority | any in-scope click/type/read | CWS review; lint; zip hash | reinstall from clean source |
| Rate/resource | DOM flood / large import | page / file | caps + quota | (none) | CPU/storage burn | caps; quota | clear storage |
| Multi-frame | iframes on muse.ai | page frames | `all_frames` → N instances | multiply clicks/sends | amplified but bounded | per-instance caps | — (accepted F4) |

**New-chain note (v1.9):** the mission *state* is durable (`mission` in storage) and *drives send
authority* — so the threat model now has a **persistent** send-authority object, unlike the
transient phrase rotation. Tamper-resistance of that object is the new S3-G question (§3-G).

---

## 3. S3 — ATTACK CHAINS A–I (re-attacked at `9e6b151`)

Legend: **SAFE** = the rails hold under the probe; **BOUNDED** = residual accepted; **NOT_VERIFIED**
= not executed. `FINANCIAL IMPACT = none` for every chain (§7).

### Chain A — Page-content trickery vs the auto-clicker — **SAFE** (`RUNTIME_VERIFIED`)
- **Objective:** make the extension click a non-approval UI (destructive/consent/navigation/form).
- **Controlled surface:** DOM of any `muse.ai`/`*.muse.ai` origin, incl. frames (`all_frames`).
- **Probe / evidence:** `node test/e2e.mjs` → **exit 0**, `ok:true`, `forbiddenHit: []`,
  `denyCount: 0`, `connectorCheck.ok:true` (`blockedConnector:2`), `dupes:[]`, `n7count:1`,
  `n11count:1`, `orderOk:true`, `dedupSepOk:true`. The 13 expected clicks landed; every
  never-click id (lone Allow, notification card `19`, split-container, hidden/disabled deny,
  opacity:0, form-bound, destructive surface buttons, connector card `20`, `lone-connect`) was
  **not** touched. **`RUNTIME_VERIFIED`** (real Chrome, scratch profile).
- **Rails (frozen):** adjacent-pair + clickable deny; skip anchor/form; consent-card block
  (`PERMISSION_CARD_RE` wins absolutely — OB-1 fix intact); destructive-verb filter; connector
  hard-block (`connectorIn`, 2-ancestor climb); visibility; fingerprint dedup 5 s; 30/min allow
  cap; one-allow-per-card; liveness.
- **Remediation:** none at this revision. **Residual:** heuristic arms-race, bounded by caps +
  rails (accepted R8–R11).

### Chain B — Approval-text XSS (log → popup/stats; import path) — **SAFE** (`INDEPENDENTLY_VERIFIED`)
- **Objective:** run script in the extension page context via a log/label/context/reason string.
- **Controlled surface:** any string reaching a render sink — approval text, `kind`, `label`,
  `blockedReason` (v1.8), `mission.id`/`step`/`cycle` (v1.9), the new **aria-label** path, and a
  crafted import file.
- **Probe (independent, this lane):** `probe_xss_v19.mjs` runs the **REAL** `esc()`/`renderLog()`
  extracted verbatim from frozen `popup.js` (`sha 0aca8929…`) against 10 payload entries incl. the
  new `mission`, `mission-dry`, `blocked` kinds, malicious `blockedReason` (`keyword:"><img …>`),
  malicious `mission.id`, and `null`/number/string junk entries → rendered HTML validated with a
  **spec-faithful Python `html.parser`**: **tags = {b,div,span}, 0 dangerous tags, 0 `on*`
  handlers, 0 `javascript:` URLs → CLEAN.** The `stats.js` topic render (`title`→`&quot;`, text
  strips `[<>&]`) validated the same way → CLEAN. `renderLog` also survived the `null`/primitive
  entries without throwing (V4-3 stays fixed). **`INDEPENDENTLY_VERIFIED`.**
- **Sinks:** 6 `innerHTML` in popup.js / 3 in stats.js — every interpolation `esc()`-wrapped or
  numeric; no `outerHTML`/`insertAdjacentHTML`/`document.write`; no inline handlers; CSP
  `script-src 'self'`.
- **Remediation:** none. **Residual:** DOM-clobbering via `innerHTML` — **NOT_VERIFIED** (not
  probe-tested; esc() prevents element creation from data, so only a pre-existing clobbering sink
  could matter, and none is reachable).

### Chain C — Crafted backup import — **BOUNDED** (`INDEPENDENTLY_VERIFIED`; one MEDIUM finding)
- **Objective:** (a) rotate the at-rest key to an attacker-known key; (b) corrupt log/stats; (c)
  change settings; (d) inflate storage.
- **Controlled surface:** a backup file the user picks + `confirm()` (no `externally_connectable`;
  file picker needs a user gesture).
- **Probe (independent):** `probe_import_v19.mjs` runs the **REAL** `sanitizeBackup` +
  `resolveImportedKey` + `testBackupKey` extracted verbatim from frozen `stats.js`
  (`sha a47da7aa…`) with real WebCrypto → **13/13 PASS**:
  - key rotation **refused** when a supplied key has no ctx-bearing entry (classic SA-1 shape);
  - **adopted** only after decrypt proof against *any* ctx entry; **whole import rejected** on
    proof failure (fail-closed);
  - `clickCount` 1e308 → **1e7**; a 300k-char `at` **dropped** (only ISO survives);
  - `__proto__` not an own key; `Object.prototype` not polluted; unknown keys + malformed
    `cryptKeyRaw` dropped.
- **New (v1.9) — see §9 F-V19-1:** the sanitizer whitelist has **not** kept pace with the storage
  keys — a backup carrying `pauseUntil`/`dryRun`/`allowOnceMode`/`rules`/`followupSmart`/
  `followupSchedule`/`syncSettings`/`missionEnabled`/`mission`/`userLocale`/`onboarded` silently
  **drops all of them**; a file of *only* those is reported **"Not a backup file."**
- **Residual:** SA-1 R-1 (a *self-consistent* crafted file still rotates the key — by-design
  limit, no signing); V4-2 merge/race (accepted). **Remediation:** §9 F-V19-1 (extend whitelist).

### Chain D — Local storage tampering (other extension / user / malware profile) — **BOUNDED / ACCEPTED**
- **Objective:** read/modify the extension's storage; change behaviour incl. the **new mission keys**.
- **Controlled surface:** the Chrome profile on disk / devtools. Another extension cannot reach
  this extension's storage (Chrome isolation). A local attacker with profile write already holds
  the OS-user boundary.
- **Probe (independent):** `probe_mission_v19.mjs` feeds **tampered `mission` objects** through the
  **REAL** `sanitizeMission`/`applyMissionSettings` extracted verbatim from frozen `content.js`
  (`sha 92fc5563…`) → **18/18 PASS**: `step` 999/1e308/-5/"3" all clamp to `[0, L-1]`; `cycles`
  999/1e308 clamp to `≤3`; an **unknown/blank id ⇒ no mission (fail-closed)**; `missionEnabled`
  must be **strictly `=== true`** (the string `"true"` does not enable).
- **Conclusion:** a tampered mission **cannot bypass the 12/3 caps** (§3-G) and cannot inject text
  (§3-G). Tampering can only *start* a mission (within the user's own profile) — same boundary as
  R10-lineage accepted. **`INDEPENDENTLY_VERIFIED` (source-level) + `NOT_VERIFIED`** for a real
  malware-profile simulation (unsafe/unnecessary).
- **Residual:** ACCEPTED (R10 lineage; the AES-GCM key sits in the same profile — "casual
  inspection" only, per the code comment).

### Chain E — Compromised update channel (unpacked dir / CWS) — **BOUNDED / ACCEPTED**
- **Objective:** push malicious code into the extension → inherit full authority.
- **Controlled surface:** CWS account / local unpacked dir.
- **Evidence:** zero deps (§6), lint gate, `verify-zip.py` byte-verify. **No code-signing beyond
  CWS default; unpacked install = the user's own machine trust** (see §6 residual).
- **Probe:** not executable (would require compromising the channel). **`NOT_VERIFIED`** by design;
  this is control inventory, not a test.
- **Remediation (owner TODO):** CWS 2FA; verify the zip hash before upload (`store/PUBLISH_RUNBOOK.md`);
  install unpacked only from a trusted source.

### Chain F — Delegated-approval impersonation (CORE accepted risk) — **ACCEPTED (mitigations re-verified)**
- **Objective:** let the extension auto-approve requests an attacker queued in the user's account.
- **Preconditions:** Muse account/session compromised + extension ON (default ON) + tab open.
- **Re-verification at this revision:** rails bind (`RUNTIME_VERIFIED` via e2e — one click per node,
  cap 30/min, dedup, never Deny, log). The extension **cannot** distinguish a genuine approval
  from a forged one — that is the nature of auto-allow.
- **Mitigations (present):** visible toggle; audit log (context + `at`, encrypted at rest, cap 50);
  rate cap; never-Deny; pause (`Alt+Shift+P` / 15 min); schedule; blocklist/topic rules; connector
  hard-block; `dryRun`.
- **Remediation (owner decision):** first-run consent explaining default-ON; keep the "turn OFF
  when unattended" advice in the listing/privacy. **Muse-side session security is out of scope.**
- **Residual:** ACCEPTED — must stay explicit in the verdict (R8–R11; R11 = this chain).

### Chain G — Send-authority abuse via Mission + follow-up — **SAFE / BOUNDED** (`INDEPENDENTLY_VERIFIED` + `RUNTIME_VERIFIED`)
- **Objective:** steer **which** prompt is sent, the **timing**, or the **count past the caps** via
  page content or tampered storage.
- **Which prompt?** — **page content cannot steer it.** `missionSendOverride()` returns
  `missionStepText()` = `missionStepsOf(mission.id)` = a **shipped corpus step**; the follow-up
  path sends `followupActiveText()` = `followup.prompts[rotateIdx]` / `followupPrompt` from
  **storage** (user-set), never page text. Probe `probe_mission_v19.mjs`: the override text is a
  shipped step; `mission-e2e` case A: the send carries the **exact shipped step 0**.
- **Timing?** — page DOM controls *idle detection* (the trigger) — by design; bounded by
  cooldown + rolling-hour cap + `followupSchedule` + `pauseUntil` + approval-present guard
  (absolute priority). **`RUNTIME_VERIFIED`** (`mission-e2e` B2/C; `followup-e2e` case (e)).
- **Count past the caps?** — **No.** `sanitizeMission` clamps stored `step`/`cycles` (probe,
  §3-D); `missionOnVerifiedSend` completes at `cycles*L+step ≥ 12` **or** `cycles ≥ 3`
  (`mission-e2e` case E: exactly **12 sends / 3 cycles**, then a **silent stop** with one
  completion entry and no further send; falsification F2 widens the caps → RED). Advance happens
  **only on a verified send** (F1 falsification → RED).
- **Gate:** a mission send requires `followupEnabled` **and** `missionEnabled` **and** an active
  mission; `missionEnabled` defaults **false**; the corpus is shipped/English/reviewed; the
  `mission-e2e` preflight safety scan flags **0** destructive/secret/URL markers in all 18 steps
  (with positive + negative controls).
- **Residual:** (i) the rolling-hour cap and the mission caps are **per content-script instance**;
  with `all_frames:true` a page that renders the composer + idle status in **N** frames could in
  principle multiply sends up to N×12 — the same per-frame limitation already accepted as **F4**
  for the follow-up cap (`SOURCE_REVIEWED`; multi-frame multiplication **NOT_VERIFIED**). (ii) a
  false idle-positive costs one paced prompt (bounded). **Remediation:** none; optional per-extension
  (not per-frame) budget if Muse ever ships multi-frame chat.

### Chain H — Rate-cap / resource abuse — **SAFE / BOUNDED** (`SOURCE_REVIEWED` + `RUNTIME_VERIFIED`)
- **Objective:** force continuous clicks/logs or inflate storage.
- **Evidence:** e2e cap behaviour green; `mission-e2e`/`followup-e2e` caps green; import caps
  verified (50 log, 500 keys/bucket, clamp 1e9, `at ≤64`, `clickCount ≤1e7`); storage headroom
  ample. Liveness guard + Web Locks serialization + write merge (v1.8 §12.3) present.
- **Residual:** multi-frame per-instance budget (F4); a huge crafted file stalls parse (self-DoS,
  user-mediated + confirm). LOW.

### Chain I — Reliability adversary (fail-open vs fail-closed under odd DOM) — **BOUNDED**
- **Objective:** force a wrong click (fail-open) or a TOCTOU mis-click, or paralysis.
- **Evidence (`SOURCE_REVIEWED`):** authority decisions fail-closed — sweep clicks only after all
  rails; `approvalPresent()` catch → **true** (blocks send); `detectMuseState` error → `'unknown'`
  (no send); `findComposer` has no blind fallback; `flushClicks` failures are now **surfaced**
  (`console.warn`, v1.9.1 §13.2); a removed settings key **resets to its shipped default**, never a
  stale value (v1.9.1 §13.1). TOCTOU: `btn.click()` runs on the checked node reference (a detached
  node is a document no-op); re-render races are covered by fingerprint dedup + WeakSet
  (`RUNTIME_VERIFIED`: e2e n7/n11 = 1).
- **NEW v1.8 surface — the adaptive fast-path sweep:** `cardBearingMutation()` schedules a
  card-bearing mutation at `OBSERVER_CARD_MS = 0` (next task) instead of the 120 ms generic
  debounce. **Does it click something the old path would not?** The repo's falsification (§12.4)
  and my re-run show the **same** e2e outcome with the fast path on/off (`n7count:1`,
  `n11count:1`, `denyCount:0`, `forbiddenHit:[]`) — detection is unchanged for the fixture.
  **Residual (INFO, `NOT_VERIFIED`):** the settle window is now ~0 ms for card mutations, so a card
  that renders *and then mutates within the same task* could be evaluated in a transient state;
  no fault-injection probe beyond the fixture was run. Bounded by the click-time rails.
- **Residual:** `isVisible` catch → `true` (a small fail-open, mitigated by the other rails).

### RAILS LIST (frozen @`9e6b151`) — the extension CANNOT click / CANNOT send

**Cannot click:** Deny/Reject/Decline (no deny click path exists); a lone Allow (no clickable deny
in the same container); anything outside `muse.ai` scope; non-`button`/`[role=button]`; disabled/
`aria-disabled`; not visible (size/visibility/display/pointer-events/opacity); inside `<a>` or a
`<form>`; consent-only pairs (notifications/newsletter/subscribe/cookies/marketing/alerts/
reminders/tips **without** approval wording); **permission-card wording** (send notifications/
notifications/camera/microphone/location/clipboard — wins absolutely, OB-1); destructive-verb
surfaces; **any container matching the connector hard-block** (`connectors?` word, Connect-family
button, token wording); Review buttons outside a "needs review" context; past the 5 s dedup; past
the 30/min allow or 30/min aux cap; after extension-context invalidation.

**Cannot send (follow-up / mission):** while `followupEnabled` is off; while paused (`pauseUntil`);
outside the schedule; while a send is in flight; **while an approval surface is present (absolute
priority)**; while the composer already holds text; when no composer/send target is identifiable;
when the verify step fails (composer still holds the text → no retry until cleared); past the
rolling-hour cap; and a mission only sends while `missionEnabled` **and** a mission is active, only
**shipped** step text, advancing **only on a verified send**, stopping at 12 steps / 3 cycles.

---

## 4. S4 — APPSEC SURFACES

| Surface | Result | Evidence class |
|---|---|---|
| Popup/stats XSS (`esc()` coverage incl. the new aria-label + mission/blocked kinds) | **CLEAN** — real `renderLog` + Python parser: only `b/div/span`, 0 handlers, 0 dangerous tags | `INDEPENDENTLY_VERIFIED` |
| CSP | explicit `script-src 'self'; object-src 'self';` (MV3 floor; not widened) | `SOURCE_REVIEWED` |
| No secrets | repo grep for `api key/secret/password/token/bearer/PRIVATE KEY/…` → hits only in the blocklist/consent regex lists, a UI checklist string, and CSS "token" comments; **no credential, no PII** | `SOURCE_REVIEWED` |
| Sensitive local logs | log/context encrypted at rest (AES-GCM-256, random 96-bit IV); `console.warn` is local-only; no PII written | `SOURCE_REVIEWED` + `RUNTIME_VERIFIED` (e2e `encCheck.ok`, `hasPlain:false`) |
| Unsafe file handling (import) | typed whitelist + caps + decrypt-proof + `confirm`; **but the whitelist lags the v1.8/v1.9 keys (F-V19-1)** | `INDEPENDENTLY_VERIFIED` |
| Storage RMW races (Web Locks) | flush serialized per-tab + cross-tab via `maa-record-v1`; **import runs on the extension origin, outside the page lock** (V4-2 accepted) | `SOURCE_REVIEWED` |
| Wrongful grant/denial equivalence | never Deny (`denyCount:0`), never a lone Allow, connector hard-block fires (`blockedConnector:2`) | `RUNTIME_VERIFIED` |

---

## 5. S5 — AI / AGENTIC

This product **is** an agentic tool: `LOWER-TRUST INPUT (page DOM) → DECISION (heuristics) → TOOL
CALL (click/type/submit) → REAL EFFECT (approval granted / message sent)`.

- **Prompt-injection-style DOM trickery:** the *content* of a send is never page-derived (Chain G);
  the *decision* to click/send is page-DOM-influenced by design, bounded by rails (Chain A/I).
  **SAFE / BOUNDED.**
- **Excessive permission:** `all_frames:true` + click authority + (new) send authority. No new
  permissions were added in v1.9 (mission rides the existing follow-up engine); `notifications`
  was added in v1.8 (digest) and is allow-listed by lint. `all_frames` remains the accepted F4
  exception (multi-frame amplification is bounded per instance). **SOURCE_REVIEWED.**
- **Unsafe retries:** sends are paced (cooldown + rolling-hour cap) and verify-gated; a failed
  verify does not retry until the composer is cleared. **SAFE.**
- **Data exfiltration — must stay zero-network:** the extension makes **no network request**; the
  only `fetch`-family call is `readAsset(chrome.runtime.getURL('_locales/…'))` — a **same-package**
  read of a fixed `LOCALE_IDS` entry. **However the lint gate that is supposed to *enforce* this is
  now blind to it (F-V19-2).** No remote URL, no exfil path. **SOURCE_REVIEWED**; gate weakness
  **INDEPENDENTLY_VERIFIED** (§9 F-V19-2).

---

## 6. S6 — SUPPLY CHAIN

- **Zero dependencies — verified, not asserted:** repo-wide `find` for `package.json` /
  `node_modules` / lockfiles → **none**. No npm transitive exposure. **`INDEPENDENTLY_VERIFIED`.**
- **Build from repo scripts only:** `scripts/build.mjs` / `lint.mjs` / `verify-zip.py`; no CI token
  in scope. No remote/`eval`/`new Function`/`importScripts` in `extension/**` (lint §4).
- **Artifact byte-verified:** `python scripts/verify-zip.py` → **`18 matched, 0 mismatched, 0
  disk-only, 0 zip-only`** (exit 0); on-disk `sha256sum` of `dist/muse-auto-allow-v1.9.1.zip` =
  **`eec91d1d…d1d8`** (180,069 B) — matches the frozen hash. **`INDEPENDENTLY_VERIFIED`.**
- **Residual trust:** unpacked-dir install = the user's own machine (Chain D boundary); CWS-default
  provenance only; no reproducible-build/signing beyond that. **ACCEPTED (Chain E).**

---

## 7. S9–S11 — MONEY / PAID: **NOT_APPLICABLE** (evidence-backed)

**State: NOT_APPLICABLE — this revision has no money path.**

- Repo grep across `extension/` for `webhook|ledger|entitle|payment|stripe|payos|checkout|billing|
  subscri|licen[cs]e|purchase|monetiz|price|refund|settlement` → **only** the fail-closed
  `BLOCK_SEED` blocklist and the consent-word regex (not a payment path). **0 payment code.**
- Manifest: no payment/network permission; no provider, webhook, entitlement, ledger, order, price,
  refund or settlement anywhere.
- ⇒ **S9 (money model), S10 (money invariants), S11 (webhook/concurrency/failure injection) =
  NOT_APPLICABLE.** Do **not** manufacture a paid model.
- ⇒ **Paid-path readiness = `NOT_VERIFIED`** (nothing to verify). IF the owner opens a monetization
  path (e.g. a future Pro tier/licensing), **S9–S11 become a mandatory design gate** before any
  build ships a money path: canonical authority per state, replay/dedup/idempotency,
  sandbox/prod isolation, negative tests (charter `docs/SECURITY_PAID_GO_LIVE_ROUND.md`).
- ⇒ The maximum verdict axis for this round: **security assurance for a FREE go-live (+ CONDITIONAL
  items)** — `PAID_GO` is **not** claimable while the paid surface is N/A (S14/S15 rail).

---

## 8. PRIOR FINDINGS — RE-ATTACK AT `9e6b151` (evidence invalidated by the HEAD change)

> Old SHAs do **not** close the new HEAD (S15-S04). Each row is re-derived at this revision.

| Prior finding (old rev) | Status at `9e6b151` | Evidence |
|---|---|---|
| **V4-1** import unvalidated (MED) | **CONFIRMED_FIXED** — typed whitelist + caps + decrypt-proof all bind; residual SA-1 R-1 + **new whitelist-lag (F-V19-1)** | `INDEPENDENTLY_VERIFIED` (probe 13/13) + `test/import-security.mjs` 29/29 |
| **V4-2** import merge semantics + cross-context race | **STILL PRESENT, ACCEPTED** (merge `set(clean)`; import outside the page lock) | `SOURCE_REVIEWED` |
| **V4-3** popup log crash on a `null` entry | **CONFIRMED_FIXED** — `renderLog` filters non-objects; my probe fed `null`/`5`/`"str"` with no throw | `INDEPENDENTLY_VERIFIED` |
| **V4-4** key-cache not invalidated | **CONFIRMED_FIXED** — `storage.onChanged` clears `cryptKey` on `cryptKeyRaw` (content.js:666) | `SOURCE_REVIEWED` |
| **V4-5** first-install key race | **CONFIRMED_FIXED** — re-read + adopt the stored key (content.js:654-660) | `SOURCE_REVIEWED` |
| **V4-6** e2e gap for crypto/import | **CONFIRMED_FIXED** — `encCheck` (schemaVersion 2, `hasCtx`, no plaintext, 44-char key, round-trip) green | `RUNTIME_VERIFIED` (e2e `encCheck.ok:true`) |
| **V4-7** lock-holder stall | **STILL ACCEPTED** (theoretical) | `SOURCE_REVIEWED` |
| **V4-8** `localTime` non-string | **CONFIRMED_FIXED** — `!iso` → `''`; NaN → `''` | `SOURCE_REVIEWED` |
| **SA-1** key rotation without proof | **CONFIRMED_FIXED** — no-ctx ⇒ refuse+keep; any-ctx ⇒ adopt; proof-fail ⇒ reject whole import; residual R-1 (self-consistent file) | `INDEPENDENTLY_VERIFIED` (probe) + import-security 29/29 |
| **SA-2** follow-up config lost on restore | **CONFIRMED_FIXED for the v1.7 `followup*` keys** — round-trips exactly; **REGRESSED-IN-SCOPE for the v1.8/v1.9 keys** → new **F-V19-1** | `INDEPENDENTLY_VERIFIED` |
| **SA-3** dataset bounds + quota message | **CONFIRMED_FIXED** — `clickCount ≤1e7`, `at ≤64` ISO-only, dedicated `importQuota` message | `INDEPENDENTLY_VERIFIED` + import-security |
| **OB-1** consent/notification card auto-clicked | **CONFIRMED_FIXED** — `PERMISSION_CARD_RE` wins absolutely; e2e card `19` in FORBIDDEN, `forbiddenHit:[]`; `mission-e2e`/`followup-e2e` z-checks confirm deny never clicked | `RUNTIME_VERIFIED` |
| **OB-2** pacing (~1 s) | **ACCEPTED** (not a security invariant) | `SOURCE_REVIEWED` |
| **redteam v1–v3** (v1.2.0) | **PRIOR EVIDENCE ONLY** — not re-cited; the v1.2.0 code no longer exists at this revision; the rails they protected are re-verified live in Chains A/I (§3) | — |

**No prior finding is `NOT_VERIFIED` for lack of a probe except V4-7 (theoretical, accepted).**

---

## 9. NEW FINDINGS (this audit, bound to `9e6b151`)

### F-V19-1 — **MEDIUM** · Import sanitizer whitelist lags the v1.8/v1.9 storage keys
- **Class:** import / data-integrity / silent safety-setting loss (SA-2 lineage extended).
- **File:line:** `extension/stats.js:200-246` (`sanitizeBackup`) vs the writers
  `extension/content.js:1569` and `extension/background.js:29-30`; export uses
  `chrome.storage.local.get(null)` at `extension/stats.js:275`.
- **Issue:** `sanitizeBackup` whitelists only `enabled`, `minDelayMs`, `clickCount`, `log`, `stats`,
  the v1.7 `followup*` keys, `cryptKeyRaw`, `schemaVersion`. It has **no** handling for
  `pauseUntil`, `dryRun`, `allowOnceMode`, `rules`, `followupSmart`, `followupSchedule`,
  `syncSettings`, `missionEnabled`, `mission`, `userLocale`, `onboarded` — yet `exportData` writes
  **all** of `chrome.storage.local`. So a restore **silently drops** every v1.8/v1.9 setting and the
  mission state; a backup file containing **only** those keys is reported **"Not a Muse Auto-Allow
  backup file."** (because `seen === 0` → `null`).
- **Repro (executed):** `node probe_import_v19.mjs extension/stats.js` →
  `SA-2(v1.8/v1.9): sanitizer DROPS … {missing:[pauseUntil,dryRun,allowOnceMode,rules,followupSmart,
  followupSchedule,syncSettings,missionEnabled,mission,userLocale,onboarded]}` and
  `a backup of ONLY v1.8/v1.9 keys is reported "Not a backup" (clean === null)`.
- **Impact:** on a **fresh device / after a wipe**, restoring a backup silently loses the user's
  **safety settings** — notably `dryRun:true` (the engine falls back to real clicking),
  `rules.allowTopics` (a restrictive whitelist reverts to "all topics"), custom
  `rules.blockKeywords`, and `pauseUntil` — and the mission state. This is a **fail-open on a
  user-configured restriction** after a documented "replace" restore. (On the *same* device the
  merge semantics of V4-2 keep current values, so the loss only bites when the keys are absent.)
- **Recommended fix (remediation lane, NOT this lane):** add the v1.8/v1.9 keys to `sanitizeBackup`
  with typed validation mirroring the engine's own readers (`rules`/`followupSmart`/
  `followupSchedule` as plain objects with bounded keys; `pauseUntil` finite ≥ 0; `dryRun`/
  `allowOnceMode`/`syncSettings`/`missionEnabled` booleans; `mission` via the engine's
  `sanitizeMission` shape; `userLocale` ∈ `LOCALE_IDS ∪ {auto}`), and keep `seen` counting them.
- **Status: FIXED (S12 remediation lane).** `extension/stats.js` `sanitizeBackup` now accepts the
  v1.8/v1.9 keys with typed validation that MIRRORS the engine's own readers (content.js
  `applyV18Settings`/`sanitizeMission`, popup.js `applyV18UI`, background.js `syncSettings`):
  booleans strict (`dryRun`/`allowOnceMode`/`syncSettings`/`missionEnabled`/`onboarded`);
  `pauseUntil` a finite number, clamped ≥ 0; `rules` a plain object with `allowTopics`
  (cap 50 × 64 chars) / `blockKeywords` (cap 500) string arrays; `followupSmart` a plain object
  (finite `stuckMin` ≤ 1440, non-empty string `stuckPrompt`/`errorPrompt` ≤ 600, boolean
  `errorRecovery`); `followupSchedule` a plain object (boolean `enabled`/`onlyActiveTab`,
  integer 0–23 `start`/`end`); `mission` validated to the engine's `sanitizeMission` shape
  (shipped id only, `step`/`cycles` clamped to the 12/3 caps, finite timestamps); and
  `userLocale` ∈ `LOCALE_IDS ∪ {'auto'}`. Every accepted key counts toward `seen`, so a file of
  ONLY those keys imports. A present-but-invalid value is DROPPED (never emitted as a
  reset-to-default) so a crafted file cannot use junk to CLEAR a user restriction. Every
  pre-existing rule (typed whitelist, decrypt-proof/adopt-or-refuse, caps, quota message) is
  untouched.
- **Proof (S12):** `test/import-security.mjs` (now **50 checks, 0 failed**, exit 0) adds
  (a) an export→import round-trip of all 11 keys byte-for-byte with types preserved;
  (b) a v1.8/v1.9-ONLY file that imports (no "Not a backup" refusal, `dryRun` applied);
  (c) tamper cases — `rules` a string / an unknown mission id / `userLocale:'xx'` /
  `pauseUntil:'soon'` / `dryRun:'true'` dropped; `pauseUntil:-5`→0; `stuckMin:1e9`→1440;
  `start:99` dropped; `mission{step:999,cycles:999}`→`{step:5,cycles:3}`; `startedAt:-1`→now;
  `__proto__`-bearing objects do not pollute `Object.prototype`; plus a **mirror guard** asserting
  stats.js `MISSION_STEPS`/`LOCALE_IDS` equal content.js `MISSION_CORPUS`/popup.js `LOCALE_IDS`.
  **Falsification:** stripping the two new blocks from a mutated copy
  (`stats_nov19keys.js`) turns **13** of the new assertions RED (exit 2) while the shipped file is
  **50/50 green** (§10.1).

### F-V19-2 — **LOW** · The "zero-network" lint gate is blind to the aliased `fetch`
- **Class:** assurance-gate false-negative (supply chain / no-remote-primitive invariant).
- **File:line:** `scripts/lint.mjs:83` (`REMOTE_CODE` regexes) vs `extension/popup.js:21`
  (`const readAsset = globalThis.fetch.bind(globalThis);`) and its only call site
  `extension/popup.js:25` (`readAsset(chrome.runtime.getURL(...))`).
- **Issue:** the lint pattern is `/\bfetch\s*\(/`. `fetch.bind(` does **not** match (`.bind`
  intervenes), so the extension now calls `fetch()` (via `readAsset`) while `node scripts/lint.mjs`
  still reports **"no remote code"**. The code comment even acknowledges the intent ("bound once so
  `scripts/lint.mjs`'s remote-primitive ban keeps its meaning") — but the ban is not actually
  enforced for the alias. A future edit could point `readAsset`/a similar alias at a remote URL and
  the gate would stay green.
- **Repro (executed):** `node -e '… REMOTE_CODE.some(r=>r.test(src))'` on `extension/popup.js` →
  `lint flags popup.js: false`, while `fetch.bind present: true`, `readAsset call: true`.
- **Impact:** the product's headline "zero network" property is **not mechanically enforced** any
  more; today there is no reachable remote URL (the call is `chrome.runtime.getURL` of a fixed
  `LOCALE_IDS` entry), so this is a **gate weakness, not an active vulnerability**.
- **Recommended fix:** extend `REMOTE_CODE` (or add a rule) to flag `\.fetch\b`, `globalThis.fetch`,
  `window.fetch`, and any bare `readAsset(`/aliased-call pattern; and add a lint assertion that the
  only `fetch`-family call site passes a `chrome.runtime.getURL(...)` argument. (Also add a
  regression assertion so a remote URL cannot be passed.)
- **Status: FIXED (S12 remediation lane).** `scripts/lint.mjs` gains a shared
  `fetchFamilyFindings()` check (run alongside the original `REMOTE_CODE` rules): the only allowed
  fetch-family form is the alias binding `<g>.fetch.bind(<g>)` (`g` ∈
  globalThis|window|self|global), and EVERY call of that alias must pass a
  `chrome.runtime.getURL(...)` argument; any bare `fetch(...)`, any other `.fetch` reference, or an
  alias call with a different argument is flagged. The shipped
  `globalThis.fetch.bind(globalThis)` + `readAsset(chrome.runtime.getURL(...))` pair is explicitly
  allowed — no false positive anywhere in the package. A `--self-test` mode encodes the three
  cases so the gate can prove itself.
- **Proof (S12):** `node scripts/lint.mjs` stays **exit 0** ("lint OK — 24 checks across 18 files");
  `node scripts/lint.mjs --self-test` → **all 3 cases PASS**. **Falsification (real package copy):**
  a copy of `extension/` with `fetch('https://evil.example')` appended ⇒ **exit 1**
  ("forbidden primitive /\bfetch\s*\(/" + "bare fetch( call"); the copy with
  `readAsset('https://evil.example')` ⇒ **exit 1** ("aliased fetch without a same-package URL");
  the restored copy ⇒ **exit 0** (§10.1).

### F-V19-3 — **INFO** · Adaptive fast-path sweep reduces the card-mutation settle window to ~0 ms
- **Class:** reliability / TOCTOU (Chain I).
- **File:line:** `extension/content.js:132-133` (`OBSERVER_CARD_MS = 0`), `:1624-1653`
  (`cardBearingMutation` → `scheduleSweep('observer', fast ? 0 : 120, fast)`).
- **Issue:** a card-bearing mutation now triggers the sweep on the **next task** instead of after
  the 120 ms generic debounce. The repo's falsification (§12.4) and my re-run show the **same**
  e2e outcome with the fast path on/off (`n7count:1`, `n11count:1`, `denyCount:0`,
  `forbiddenHit:[]`), so detection is unchanged for the fixture. **Residual:** a card that renders
  *and mutates within the same task* could be evaluated in a transient state; bounded by the
  click-time rails.
- **Status:** `NOT_VERIFIED` beyond the fixture (no fault-injection probe). **No fix recommended**
  (latency is the product's core loop; the rails re-evaluate at click time).

### F-V19-4 — **INFO** · Mission / follow-up caps are per content-script instance (F4 lineage)
- **Class:** multi-frame amplification (Chain G/H residual).
- **File:line:** `extension/content.js:1278-1285` (per-instance `followup.attempts`), `:948-966`
  (per-instance mission `step`/`cycles`), manifest `all_frames:true`.
- **Issue:** with `all_frames:true`, each muse.ai frame runs its own engine; the rolling-hour cap
  and the 12/3 mission caps are enforced on **that instance's** in-memory state. A page rendering
  the composer + idle status in N frames could in principle multiply sends up to N×12 — the same
  limitation already **accepted as F4** for the follow-up cap.
- **Status:** `SOURCE_REVIEWED`; multi-frame multiplication `NOT_VERIFIED` (the suites run
  single-frame). **No fix recommended** unless Muse ships multi-frame chat.

**No P0/P1 new findings.** The only new finding above INFO is **F-V19-1 (MEDIUM)**.

---

## 10. GATES — RESULTS (verbatim, run foreground/unpiped this lane)

```
node scripts/lint.mjs                 exit 0  "lint OK — 24 checks across 18 files (syntax, JSON, i18n parity, no remote code, minimal permissions)"
python scripts/verify-zip.py          exit 0  "muse-auto-allow-v1.9.1.zip: 18 matched, 0 mismatched, 0 disk-only, 0 zip-only"
sha256sum dist/…v1.9.1.zip            eec91d1d8f16005e2f34a748145d7a7d32c04b7d85f8ada267255fdb0ac8d1d8  (180,069 B)
node test/e2e.mjs                     exit 0  ok:true; forbiddenHit:[]; denyCount:0; connectorCheck.ok:true (blockedConnector:2); n7=1; n11=1; encCheck.ok:true; statsPage.ok:true; locksProbe:true
node test/followup-e2e.mjs            exit 0  ok:true (z-checks: fixture no JS errors; deny never clicked)
node test/mission-e2e.mjs             exit 0  ok:true; 39 checks, 0 failed; verifyTimeouts:[]; preflight corpus 4 ids / 18 steps / flagged:[] / controlPositive:2 / controlNegative:0
node test/lang-switch-e2e.mjs         exit 0  passed:36, failed:0
node test/background-unit.mjs         exit 0  total:29, failed:0 (manifest/badge/commands/digest/sync/migrate)
node test/import-security.mjs         exit 0  total:29, failed:0
node scripts/bench/experience.mjs --only=assert   exit 0  pass:22, fail:0
```

**Independent probes (this lane, scratch `…/cache/scratch/maa_v19_audit/`):**

```
probe_import_v19.mjs  → 13/13 PASS  (bound stats.js a47da7aa…)   SA-1 fixed; SA-2 v1.7 fixed; NEW whitelist lag F-V19-1; SA-3 fixed; proto/whitelist clean
probe_mission_v19.mjs → 18/18 PASS  (bound content.js 92fc5563…)  caps enforced on stored values; corpus-only text; unknown id fail-closed
probe_xss_v19.mjs     → CLEAN        (bound popup.js 0aca8929…)   real renderLog + Python html.parser: {b,div,span}, 0 handlers, 0 dangerous tags
stats topics render   → CLEAN        (Python html.parser on the verbatim renderTopics expressions)
```

**Environment:** Windows 11, git-bash/MSYS, Node **v26.7.0**, installed Chrome (CDP
`Extensions.loadUnpacked`, **scratch profile — the user profile was never touched**). Zero-dependency
repo; no bootstrap needed. The Chrome suites ran **foreground/unpiped** and returned real JSON
(exit 0). No suite failed. (Note: `[ -t 0 ]` reports the shell is not a TTY, yet the suites ran —
recorded so the "non-TTY kills Chrome suites" caveat is not over-generalized here.)

---

## 10.1 S12 REMEDIATION — GATE RE-RUN + FALSIFICATIONS (F-V19-1 + F-V19-2 FIXED)

Post-fix working tree (v1.9.1 + S12; `FIXED_ON` = this revision). All gates run
foreground/unpiped:

```
node scripts/lint.mjs                             exit 0  "lint OK — 24 checks across 18 files (syntax, JSON, i18n parity, no remote code, minimal permissions)"
node scripts/lint.mjs --self-test                 exit 0  "all 3 cases PASS"
node test/import-security.mjs                     exit 0  total:50, failed:0
node test/e2e.mjs                                 exit 0  ok:true; forbiddenHit:[]; denyCount:0; connectorCheck.ok:true (blockedConnector:2); encCheck.ok:true; statsPage.ok:true; locksProbe:true
node test/followup-e2e.mjs                        exit 0  ok:true (the nested ok:false = the EXPECTED 'paused' / 'composer-not-empty' engine refusals)
node test/lang-switch-e2e.mjs                     exit 0  passed:36, failed:0
node test/background-unit.mjs                     exit 0  total:29, failed:0
node test/mission-e2e.mjs                         exit 0  ok:true; 39 checks, 0 failed; verifyTimeouts:[]
node scripts/bench/experience.mjs --only=assert   exit 0  pass:22, fail:0
```

Reverse-mutation falsifications:

```
import-security on a mutated stats.js (both new blocks removed)      → 13 new F-V19-1 assertions RED, exit 2
lint --self-test (shipped / +fetch(remote) / readAsset(remote))      → PASS / PASS / PASS
lint on a mutated package copy  + fetch('https://evil.example')      → exit 1 (forbidden primitive + bare fetch( call)
lint on a mutated package copy  + readAsset('https://evil.example')  → exit 1 (aliased fetch without a same-package URL)
lint on the restored package copy                                    → exit 0
```

Files changed by S12: `extension/stats.js`, `scripts/lint.mjs`, `test/import-security.mjs`,
this document. `VERIFIED_ON` remains for the S13 independent re-attack lane — no PASS here is a
re-attack.

---

## 11. RESIDUAL / ACCEPTED RISKS (explicit)

1. **R8–R11 — delegated-approval impersonation (CORE, accepted).** A compromised Muse
   account/session + default-ON auto-allow ⇒ attacker-queued approvals are granted. The extension
   cannot distinguish genuine vs forged approval cards. Mitigations: visible toggle, audit log,
   rate cap, never-Deny, pause, rules, connector block. **Owner decision:** first-run consent.
2. **R-1 — crafted self-consistent backup still rotates the at-rest key** (no authenticity without
   signing). Requires the user to pick + confirm the file. `INDEPENDENTLY_VERIFIED`.
3. **V4-2 / R-4 — import merge semantics + import outside the page Web Lock** (last-writer-wins on
   a concurrent flush; restore keeps absent keys). Accepted.
4. **Chain D — at-rest confidentiality is bounded by the OS-user boundary** (the AES-GCM key sits in
   the same profile; "casual inspection" only). Accepted.
5. **Chain E — update-channel trust** (unpacked dir = the user's machine; CWS-default provenance
   only; no signing/reproducible build). Accepted; owner TODOs: CWS 2FA + hash-verify before upload.
6. **F4 lineage — per-instance (per-frame) caps** with `all_frames:true` (Chain G/H); the v1.9
   mission caps inherit the same limitation. Bounded; `NOT_VERIFIED` for multi-frame multiplication.
7. **F-V19-3 — the fast-path sweep's ~0 ms card settle window** (Chain I); detection unchanged on
   the fixture, `NOT_VERIFIED` beyond it.
8. **Settings-sync is account-bound.** The mirror can seed `followupEnabled`/`followupPrompts`/
   `rules` from the user's own Google sync **on absent local keys** — i.e. a fully compromised
   Google account could set an attacker prompt on a fresh device. The **mission keys are NOT in the
   sync subset** (a synced account cannot start a mission or inject mission text). Accepted
   (account boundary, documented in `store/PRIVACY.md` §2).
9. **Muse ToS tension (legal/product, not technical).** `docs/MUSE_TOS_RESEARCH.md` rates the
   blanket auto-approver **MEDIUM** against Muse ToS §7.6 ("meaningful human oversight"). A scoped
   design (rules/blocklist/topic whitelist, dry-run, schedule, never-Deny, connector block) reduces
   the tension. Owner/legal decision; out of technical scope.
10. **Paid path** = `NOT_VERIFIED` (nothing exists). Any future monetization must pass the S9–S11
    design gate first.

---

## 12. VERDICT (honest — S14/S15 rails)

- **Security assurance for a FREE go-live: GO-equivalent, with one MEDIUM + one LOW + two INFO
  findings open (this is an AUDIT, not a remediation verdict).** At the frozen revision `9e6b151`
  the shipped rails bind under real-Chrome suites and independent probes: never a Deny, never a lone
  Allow, connector hard-block, consent/permission-card block, encrypted at-rest log, zero network,
  zero deps, byte-verified artifact, and the new v1.9 Mission Orchestrator is **fail-closed** —
  shipped-corpus-only text, advance-on-verified-send-only, caps (12/3) enforced on **stored** values,
  unknown ids ⇒ no mission.
- **CONDITIONAL items (owner TODO list):** (a) extend the import sanitizer whitelist to the
  v1.8/v1.9 keys (F-V19-1) — **FIXED (S12)**, see §9 + §10.1; (b) close the lint zero-network
  blind spot (F-V19-2) — **FIXED (S12)**, see §9 + §10.1; (c) owner
  decision on Chain F first-run consent; (d) CWS 2FA + hash-verify-before-upload; (e) owner/legal
  decision on the Muse ToS §7.6 tension.
- **Paid-path readiness: `NOT_VERIFIED`** — there is no payment/provider/webhook/entitlement/ledger
  to verify (§7). **`PAID_GO` is not claimable** while the paid surface is N/A.
- **Never claim more.** This audit did **not** fix anything, did **not** re-run the S12 remediation
  or the S13 independent re-attack (separate lanes), and does **not** attest the artifact beyond the
  byte-verify + suites recorded in §10. `FIXED_ON`/`VERIFIED_ON` SHAs remain for those lanes.

**PHASE STATUS: AUDIT COMPLETE at `9e6b151` (v1.9.1) — remediation (S12) + independent re-attack
(S13) + rebind at the post-fix revision are required before any GO verdict is issued.**
