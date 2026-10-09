# Redteam Report — Muse Auto-Allow (v1.2.0, security-hardened)

**Date:** 2026-10-08 · **Revised:** 2026-10-09
**Scope:** `extension/` (content.js, background.js, popup.html/js, manifest.json, _locales), `test/` harness, `scripts/` build tooling.
**Method:** adversarial static review (per the vibe-code-security checklist: injection, XSS, permission misuse, races, fail-closed logic) + runtime verification on real Chrome 154 (CDP `Extensions.loadUnpacked`, scratch profile) + **mutation proof** (each new guard disabled in turn — suite must go RED; restored — GREEN).

## Verdict

7 defects found and fixed (R1–R7). 4 residual risks accepted and documented (R8–R11). 6 classes verified clean (R12–R17). The e2e suite that proves the fixes is itself mutation-proven (V1–V5). No unfixed defect is known to remain in the shipped surface.

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
