# Redteam Report — Muse Auto-Allow (v1.2.0, security-hardened)

**Date:** 2026-10-08 · **Revised:** 2026-10-09
**Scope:** `extension/` (content.js, background.js, popup.html/js, manifest.json, _locales), `test/` harness, `scripts/` build tooling.
**Method:** adversarial static review (per the vibe-code-security checklist: injection, XSS, permission misuse, races, fail-closed logic) + runtime verification on real Chrome 154 (CDP `Extensions.loadUnpacked`, scratch profile) + **mutation proof** (new guards disabled in combined batches — every defect must produce its distinct red signal; restored — GREEN).

## Verdict

7 defects found and fixed (R1–R7). 4 residual risks accepted and documented (R8–R11). 6 classes verified clean (R12–R17). The e2e suite that proves the fixes is itself mutation-proven (V1–V5). An **independent redteam v2** (2026-10-09) then challenged this report and found 16 further issues: 15 fixed (F1–F3, F5–F16) and 1 accepted with rationale (F4) — see the v2 section below. No unfixed defect is known to remain in the shipped surface.

## Findings — fixed

| ID | Sev | Finding | Fix |
|----|-----|---------|-----|
| R1 | MED | Path D clicked the **first** button inside an approval surface — if Muse (or a manipulated page) rendered a destructive button first, it would be clicked | Surface buttons are only clicked when their text matches `review/open/show/view/details/see`; no match → skip (fail-closed). Negative test: `surface2` ("Delete everything") never clicked |
| R2 | MED | **Re-render race**: React recreating a card's button node (identical text) bypassed the per-node WeakSet → duplicate approval click | 5s fingerprint dedup on `(button label + card text, buttons excluded)`; cards with no context text get **no** dedup so distinct requests are never blocked. Negative test: replaced card7 clicked exactly once (`n7count=1`) |
| R3 | LOW-MED | A candidate button inside `<a>` could navigate as a side effect of the auto-click | Candidates inside anchors are never clicked (all 4 paths). Negative test: `allow8` (anchor-wrapped) never clicked |
| R4 | LOW | Consent-only Allow/Deny pairs (e.g. "Allow notifications…") were treated as approvals | Consent wording (`notifications/newsletter/subscribe/cookies/marketing`) without approval wording (`approv/perform this action/permission/allow muse`) → skipped. Negative test: `allow9` never clicked |
| R5 | LOW | Expand/open-panel clicks were unbounded — an adversarial page emitting endless distinct pending-texts could drive unlimited clicks | Aux clicks rate-capped at 30/min + 30s per-text cooldown + per-node WeakSet |
| R6 | LOW | `minDelayMs = 0` silently reverted to 300 on reload (`Number(x) \|\| 300` bug) | Explicit `Number.isFinite(n) && n >= 0` parsing in both boot and storage-change paths |
| R7 | LOW | After the extension context was invalidated (reload/disable), the script could keep clicking from stale timers | Liveness guard (`chrome.runtime?.id`) stops observer + heartbeat permanently |

## Findings — accepted (documented residual risk)

| ID | Risk | Rationale |
|----|------|-----------|
| R8 | Page can fingerprint the extension (documentElement attribute, CustomEvent) | No secret leaks (isolated world); a site can already infer clicking behavior. Cosmetic only |
| R9 | `*.muse.ai` wildcard host scope | Subdomains are Meta-controlled; needed so the script also runs inside app frames |
| R10 | Local click log (last 50, ~240 chars each) may contain approval text (repo names etc.) | Local-only, never transmitted, disclosed in PRIVACY.md; capped and clearable by removing the extension |
| R11 | Auto-allow by design: if the Muse account/session is compromised, queued approvals are granted automatically | The product's purpose; user control = popup toggle + review the click log. Recommended: keep toggle off when unattended |

## Verified clean

| ID | Class | Evidence |
|----|-------|----------|
| R12 | XSS in popup | `renderLog` is the only `innerHTML` sink; every interpolation passes `esc()` (incl. attribute context); verified by review + grep |
| R13 | Remote code / eval | grep across `extension/`: no `eval`, `new Function`, `fetch`, `XMLHttpRequest`, `insertAdjacentHTML`, `document.write`; MV3 CSP, external popup.js only |
| R14 | ReDoS | All regexes are anchored alternations — linear, no nested quantifiers |
| R15 | Permission misuse | `permissions: [storage, alarms]` only; no `scripting/tabs/webRequest`; host limited to muse.ai; no `web_accessible_resources`, no `externally_connectable` |
| R16 | background.js surface | No message listener (content scripts cannot make the SW do anything); `lastError` consumed in sendMessage callback |
| R17 | Content-script isolation | `window.__museAutoAllow` lives in the isolated world — not reachable from page JS |

## Verification-integrity findings (the test harness itself)

| ID | Finding | Resolution |
|----|---------|------------|
| V1 | First dedup design collided: fingerprint used raw card text, and for simple cards the matched ancestor is the button **row** (text = "Allow Deny") → distinct requests were blocked 5s | Fixed: context text = card text **minus buttons**, walking up max 3 levels; empty context → no dedup. Caught by e2e going RED (`missing: [6,7]`) |
| V2 | The `surface2` negative test was **vacuous**: the loop exited when all positive clicks were done, before surface2 could ever be evaluated (and Path D sits behind a 10s throttle after an open-panel click) | Fixed: two-phase assertions — phase 1 (all positives + dedup inside its 5s window), phase 2 waits out the 10s throttle, then checks `surface2Hit` |
| V3 | Click queue crawled at ~1 click/s: observer debounce fires once, is blocked by `minDelay`, next click waits for the 1s heartbeat | Product fix: blocked sweeps reschedule at the remaining `minDelay` — queue now paces at the configured delay (~3/s default) |
| V4 | On Windows, the offscreen test window stopped producing clicks ~5s in (occlusion/timer throttling) | Harness flags added: `--disable-background-timer-throttling`, `--disable-backgrounding-occluded-windows`, `--disable-renderer-backgrounding`, `CalculateNativeWinOcclusion` in `--disable-features`; plus V3's pacing keeps runs short |
| V5 | One stability run was killed by the OS (`exit 0x40010004`) under host memory pressure | Classified as **resource exhaustion** (not harness defect, not product regression); orphan Chrome reaped; rerun on a fresh host state |

## Mutation proof (guards are real)

All four new negative guards disabled simultaneously (inAnchor→false, consentOnly→false, SURFACE_BTN_RE→`/.*/`, allowOnCooldown→false):

```
ok: False
clicked: [4,1,2,7,7,8,9,3,pending5,5,surface,6]   ← 7 twice, 8 and 9 leaked
forbiddenHit: ['8','9','surface2']                 ← anchor, consent, intent-filter all detected
dupes: ['7'] · n7count: 2 · surface2Hit: True      ← dedup + phase-2 both detected
```

Restored → GREEN:

```
ok: True
clicked: [4,1,2,7,pending5,5,surface,6,3]
missing/extra/forbiddenHit/dupes: [] · denyCount: 0 · n7count: 1
orderOk: True · museAttr: True · surface2Hit: False
lateClicks: ['7'] (legitimate retry after the 5s dedup window) · retryFired: True
```

## How to re-run

```bash
cd "C:/00. AI Project/muse-auto-allow"
node test/e2e.mjs        # real Chrome 154, scratch profile; exit 0 = pass
```

Environment: Windows 11, Chrome 154 (installed), Node 24, CDP `Extensions.loadUnpacked` (installed Chrome ignores `--load-extension`). The harness never touches the user's real profile (scratch profile reaped by path).

---

## Independent redteam v2 (2026-10-09) — findings + fixes

A separate adversarial review agent (read-only) attacked this report's claims and found 16 issues. Each was verified against the code; 15 fixed, 1 accepted with rationale. Every fix is covered by a new fixture case, falsified RED-first.

| ID | Sev | Finding | Status |
|----|-----|---------|--------|
| F1 | HIGH | Path-dependent dedup fingerprint (Path A used card text, Path B the matched row's) — a marked card whose button row carries its own text (e.g. `· 2m`) yielded two different fingerprints, so a re-rendered card was clicked again | FIXED — fingerprint context computed from one shared button-anchored scope (`contextScope`) in every path. Mutation (path-dependent ctx restored) → `n11count: 2`, RED |
| F2 | MED | "Lone Allow" rule weaker than documented: the deny could be distant, nested, or non-clickable; the fixture control could not detect it | FIXED — the deny must sit in the same button container and be clickable; climb capped at 4 levels. Mutation → `forbiddenHit ['12','13']`, RED |
| F3 | MED | Allow clicks had no global ceiling (only aux clicks were capped) | FIXED — allow clicks rate-capped at 30/min (`allowRateOk`) |
| F4 | MED | All guards are per-frame under `all_frames: true` | ACCEPTED — multi-frame multiplication requires a hostile page rendering fake approvals (its clicks land on its own buttons — no privilege gained); duplicate-approval needs Muse to render one card in two frames (no evidence). Bounded further by the F3 cap. Revisit if Muse ships iframe approvals |
| F5 | LOW | Consent filter bypassable — "…change this permission…" satisfied the approval override; several consent wordings escaped | FIXED — "permission" removed from the approval override; consent list extended (alerts/reminders/tips). Mutation → `forbiddenHit ['10']`, RED |
| F6 | LOW | `isVisible` was layout-box only — `visibility:hidden`, `opacity:0`, `pointer-events:none` elements stayed clickable | FIXED — computed-style checks added. Mutation → `forbiddenHit ['14']`, RED |
| F7 | LOW | Surface intent filter was a broad verb allowlist ("Open and delete all projects" matched `open`); only the first surface was ever considered | FIXED — destructive verbs rejected; the surface search now iterates all surfaces. Mutation → `forbiddenHit ['surface3']`, RED |
| F8 | LOW | Anchor-skip didn't cover form-associated buttons (implicit submit) | FIXED — `unsafeTarget` also rejects `el.form`. Mutation → `forbiddenHit ['16']`, RED |
| F9 | LOW | Log read-modify-write race could silently drop entries | FIXED — serialized write queue (one in-flight get→set per frame) |
| F10 | LOW | Harness: forbidden/deny assertions were phase-1 only — a late click could not fail the suite | FIXED — `forbiddenHit`/`denyCount` now computed from the final snapshot (proven: the mutated run's late `surface3` click was caught) |
| F11 | LOW | Phase-2 timing margin could miss a broken filter's first eligible click | FIXED — wait extended to `surfaceAt + 12s` (worst case 10s throttle + 1s heartbeat) |
| F12 | LOW | Fixture lacked discriminating controls for several guards | FIXED — 7 new cases (card10, card11, card12, card13, card14, surface3, form16), each falsified RED-first |
| F13 | LOW | v1 mutation proof disabled all guards at once while claiming "each in turn" | FIXED (wording) — the method line now states exactly what ran; both combined-disabling runs produced every defect's distinct red signal |
| F14 | INFO | `CustomEvent.detail` crosses worlds (Chrome 102+ structured-clone) — v1's "no leak" rationale was wrong (payload benign: the page's own text) | FIXED — event dispatch removed; R8/R17 rationale corrected (the `data-muse-auto-allow` attribute stays for the e2e check; benign fingerprinting only) |
| F15 | INFO | No `minimum_chrome_version` | FIXED — `"minimum_chrome_version": "110"` added |
| F16 | INFO | e2e server: path check lacked a separator; `decodeURIComponent` could throw | FIXED — `startsWith(ROOT + path.sep)` + try/catch |

**Mutation proof v2** (all six new guards disabled simultaneously; every defect produced its distinct red signal):

```
ok: False
forbiddenHit: ['10','12','13','14','16','surface3']
dupes: ['11'] · n11count: 2 · lateClicks: ['7','surface3']   ← the late click was caught by the F10 fix
```

Restored → GREEN on the exact head:

```
ok: True
clicked: ['4','11','1','2','7','pending5','5','surface','6','3']
missing/extra/forbiddenHit/dupes: [] · denyCount: 0 · n7count: 1 · n11count: 1
orderOk: True · museAttr: True · surface2Hit: False · lateClicks: ['11','7'] (legitimate retries after the 5s windows)
```
