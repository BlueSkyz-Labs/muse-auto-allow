# Store Packet Verification — Muse Auto-Allow v1.2.0

**Verifier:** independent (maker ≠ judge) — this report was produced by a separate agent from the one(s) that authored the packet; every claim below was re-checked against the repository, not taken from the packet documents.
**Date:** 2026-10-09 07:33 +07:00
**Repo / revision:** `C:\00. AI Project\muse-auto-allow` @ git `3af9ba4979bbc7859f93a44eff7f14f61b0a31b9` (working tree clean at check time except untracked `store/COMPLIANCE_CHECKLIST.md`)
**Scope:** `store/LISTING.md`, `dist/muse-auto-allow-v1.2.0.zip`, `store/PRIVACY.md`, `store/PUBLISH_RUNBOOK.md` vs repo reality.
**Method:** static inspection; Python 3.14.7 zip / sha256 / PNG-header checks; sandbox re-run of `node scripts/build.mjs` (node v26.7.0) on a scratch copy outside the repo; image inspection of `store/screenshot1.png`.
**Not executed (per task constraints):** Chrome, `test/e2e.mjs`. No existing repo file was modified; this report is the only file created.

## Verdict

**43 / 45 checks PASS · 2 FAIL · 0 UNCERTAIN.** The packet's substantive claims — manifest metadata, permissions, locale set, zip contents, privacy behavior, runbook paths/commands — are accurate. The two FAILs: (a) `store/screenshot1.png` is a rendered marketing composition, not a real capture, while the packet's own guidance requires a real screenshot (M1, medium); (b) the popup shows only the 12 most recent log entries while the listing says the log of the last 50 clicks is viewable (M2, low). See "Mismatches found" for all findings.

---

## Item 1 — `store/LISTING.md` vs repo

| # | Claim | Status | Evidence |
|---|---|---|---|
| 1.1 | Item name "Muse Auto-Allow" | PASS | `extension/manifest.json` → `name: __MSG_extName__`; `extension/_locales/en/messages.json` → `extName = "Muse Auto-Allow"` |
| 1.2 | Version 1.2.0 | PASS | `extension/manifest.json` → `"version": "1.2.0"` |
| 1.3 | Manifest V3 | PASS | `"manifest_version": 3` |
| 1.4 | Permissions = `storage`, `alarms` | PASS | `"permissions": ["storage", "alarms"]` — exact match |
| 1.5 | Host permissions `https://muse.ai/*` + `https://*.muse.ai/*` | PASS | `host_permissions` — exact match |
| 1.6 | Default language English (en) | PASS | `"default_locale": "en"` |
| 1.7 | Six locales (en, vi, zh_CN, ja, ko, es) | PASS | `extension/_locales/` contains exactly those 6 dirs; all 6 `messages.json` carry the same 9-key set (`extName`, `extDesc`, `toggleLabel`, `delayLabel`, `clickedLabel`, `noClicks`, `kindAllow`, `kindExpand`, `kindOpenPanel`) |
| 1.8 | Extension package `dist/muse-auto-allow-v1.2.0.zip` | PASS | file exists — 100,666 bytes, sha256 `ac3792867c80c7da1b41d33bf9a068c3553422177b8eacde1b9e8d158526f33b` |
| 1.9 | License "MIT © 2026 BlueSkyz Labs" | PASS | `LICENSE` = MIT License, "Copyright (c) 2026 BlueSkyz Labs" |
| 1.10 | Short description ≤132 chars; "Verified length: 107" | PASS | exact extraction from §1 code block: **107 chars** (107 UTF-8 bytes), limit 132 → PASS; the claimed 107 is accurate |
| 1.11 | Four detection paths | PASS | `content.js`: A `findMarkedAllow` (`[data-testid="hatch-inline-approval-card"]`, lines 119–130), B `findPairAllow` (133–152), C `findCollapsedPending` ("Allow Muse to perform this action…", 155–167), D `findSurfaceButton` ("N tasks need your approval" surface, 170–181) |
| 1.12 | Safety rails (never Deny/Reject/Decline; never lone Allow; never same button twice) | PASS | `DENY_RE` (line 33) is never clicked on any path; Path A requires a deny button in the card (line 122), Path B requires exactly one allow in a deny-holding ancestor (lines 141–144); `clickedNodes` WeakSet (line 51) + 5s text-fingerprint dedup `ALLOW_DEDUP_MS` (lines 45, 104). Note: dedup is per-DOM-node + a 5s fingerprint window; an identical re-rendered card after 5s can be clicked again by design (treated as a distinct request — e2e asserts this as legitimate retry) |
| 1.13 | "background tabs too, checking once a minute" | PASS | `background.js`: `chrome.alarms.create('muse-sweep', { periodInMinutes: 1 })` (line 6); alarm sends `{type:'sweep'}` to muse.ai tabs (lines 13–21) |
| 1.14 | On/off switch; adjustable delay (ms) | PASS | popup checkbox ↔ `enabled` (`popup.js:58`); number input min 0 max 10000 (`popup.html:57`) ↔ `minDelayMs` (`popup.js:59–62`) |
| 1.15 | "a log of the last 50 clicks … you can see" | **FAIL** | stored log capped at 50 (`content.js:188` `log.slice(0, 50)`) but the popup renders only the **12** most recent (`popup.js:24` `log.slice(0, 12)`) — see M2 |
| 1.16 | Local-only; no account/analytics/tracking/remote code; nothing sent | PASS | only `chrome.storage.local` used; 0 hits for `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource`, `importScripts`, `eval(`, `new Function` across `extension/` |
| 1.17 | Runs only on muse.ai pages, only while enabled | PASS | `content_scripts.matches` = muse.ai patterns only; `sweep()` returns early unless `state.enabled` (line 220) |
| 1.18 | "Permissions deliberately NOT requested" list (no tabs/scripting/webRequest/`<all_urls>`/cookies/downloads) | PASS | manifest contains none of them. (`chrome.tabs.query`/`sendMessage` APIs are used in `background.js:15–18`; covered by the host permission — the `tabs` *permission* is genuinely absent, which is what the claim states) |
| 1.19 | §6 remote-code notes (no CSP relaxation, no eval, no external `<script src>`, zip = static files) | PASS | no `content_security_policy` key; `popup.html`'s only script tag is local `popup.js` (line 60); zip is 16 static entries (see Item 2) |
| 1.20 | §8 asset dimensions (icon 128×128; screenshot 1280×800; promo 440×280) | PASS | PNG headers: `icon128.png` 128×128; `screenshot1.png` 1280×800; `promo440x280.png` 440×280 |
| 1.21 | §8 screenshot content policy ("show the real … card"; "Do not use a mockup") vs shipped asset | **FAIL** | `store/screenshot1.png` is a rendered design composition (`assets/store-screenshot.html`, rendered by `scripts/render.mjs` line 107), not a real browser capture; it contains demo values ("Clicked: 128", "✓ auto-clicked in 0.2s", fabricated log rows) — see M1 |
| 1.22 | Owner-field placeholders marked `TODO: fill before submit` | PASS | present in §1/§7.4/§9 (privacy URL, support email, homepage, publisher name) as claimed |

Localized descriptions (vi/zh_CN/ja/ko/es) repeat the same four-path / safety-rail / 50-log claims as EN; spot-checked against code — consistent (subject to the same M2 nuance).

## Item 2 — `dist/muse-auto-allow-v1.2.0.zip`

| # | Claim / criterion | Status | Evidence |
|---|---|---|---|
| 2.1 | `manifest.json` at the zip root | PASS | entry list contains `manifest.json` at root (not nested) |
| 2.2 | Only runtime files; NO `test/`, `docs/`, `scripts/`, `store/` entries | PASS | 16 entries: `manifest.json`, `content.js`, `background.js`, `popup.html`, `popup.js`, `icons/{icon16,icon32,icon48,icon128,icon512}.png`, `_locales/{en,es,ja,ko,vi,zh_CN}/messages.json` — nothing else |
| 2.3 | Every entry matches `extension/` on disk | PASS | 16/16 entries sha256-equal to the corresponding disk file; no zip-only entries; no disk-only files (extension/ holds exactly those 16 files) |
| 2.4 | Manifest version inside zip == LISTING | PASS | zip manifest: `version 1.2.0`, `permissions ["storage","alarms"]`, host patterns identical, `default_locale en` — matches `store/LISTING.md` §1 |
| 2.5 | Rebuild reproducibility of `node scripts/build.mjs` | PASS | sandbox run on a scratch copy: exit 0; output `dist/muse-auto-allow-v1.2.0.zip` (100,666 bytes); same 16 entries; per-entry sha256 identical to the committed zip (archive bytes differ only by embedded timestamps — expected for a rebuild) |
| 2.6 | Zip structural hygiene | PASS | no directory entries; no backslash-separated names; entry names use `/` |

Informational: `icons/icon512.png` (75,879 B) ships in the zip but is not referenced by the manifest — allowed under the stated rules (it is under `icons/`), dead payload only (M5).

## Item 3 — `store/PRIVACY.md` vs code behavior

| # | Claim / criterion | Status | Evidence |
|---|---|---|---|
| 3.1 | Storage keys actually used | PASS | `chrome.storage.local` only; keys: `enabled`, `minDelayMs`, `clickCount`, `log` (`content.js:185,188,204,251,258`; `popup.js:37,58,62,64`). PRIVACY §2 enumerates settings (`enabled`, delay) + log; `clickCount` is omitted from that list (M3, low) |
| 3.2 | NO network calls in extension code | PASS | 0 hits for `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource`, `importScripts` anywhere in `extension/`; the only `https://` strings are the muse.ai match patterns (`manifest.json`; `background.js:15` `chrome.tabs.query` URL filter — a local Chrome API call, not a request) |
| 3.3 | Log cap 50 / retention | PASS | `content.js:188` `log.slice(0, 50)` — "keeps only the most recent 50 entries; older entries discarded automatically" is accurate |
| 3.4 | What the click log may contain | PASS | each entry = `{ at (ISO timestamp), kind ∈ {allow, expand, open-panel}, label (button text), context (card text, ≤240 chars) }` (`content.js:196,203`); PRIVACY says "kind (allow / expand / open panel), button label, and context" — accurate, except the timestamp is not mentioned (M4, nit) |
| 3.5 | Deletion: remove extension → deletes all stored settings/logs | PASS | relies on Chrome platform semantics (`chrome.storage.local` is cleared on uninstall) — correct, but not runtime-exercised in this pass (no Chrome per constraints) |
| 3.6 | No remote code — all JS bundled | PASS | no `eval`/`new Function`/`importScripts`; no external script tags; only local `popup.js` in `popup.html` |
| 3.7 | Page access limited to muse.ai | PASS | content script + host permissions are muse.ai-only; `all_frames: true` applies only to frames whose URL matches the muse.ai patterns |
| 3.8 | Permissions table matches manifest | PASS | `storage` / `alarms` / host — exact match |
| 3.9 | "collects nothing / transmits nothing / no analytics / no advertising" | PASS | consistent with the scans above; nothing leaves the device |

## Item 4 — `store/PUBLISH_RUNBOOK.md` paths & commands

| # | Claim / criterion | Status | Evidence |
|---|---|---|---|
| 4.1 | `dist/muse-auto-allow-v1.2.0.zip` exists | PASS | 100,666 B, sha256 `ac3792…f33b` |
| 4.2 | `node scripts/build.mjs` correct | PASS | script exists; sandbox-executed successfully (exit 0): writes `dist/muse-auto-allow-v<version>.zip` → `muse-auto-allow-v1.2.0.zip` (`build.mjs:13`), zips exactly the 7 declared items (`build.mjs:16`), and self-verifies `manifest.json` at root (`build.mjs:31–35`) |
| 4.3 | Cross-references resolve (LISTING §2/§4/§5/§6/§7.4/§8/§9; PRIVACY) | PASS | all referenced sections and files exist; §7.4 review-note block present |
| 4.4 | `store/screenshot1.png` 1280×800; `store/promo440x280.png` 440×280 | PASS | PNG headers confirm both sizes |
| 4.5 | `test/e2e.mjs` exists and covers the four paths + negatives | PASS | header assertions 1–4 cover paths B/A/C/D; negative controls (lone Allow, "Allow notifications", Deny, surface re-click) listed; **not executed** here (constraint) |
| 4.6 | "Confirm the version in `extension/manifest.json` … (currently 1.2.0)" | PASS | 1.2.0 |
| 4.7 | Update-flow naming (`dist/muse-auto-allow-v1.2.1.zip` after bump) | PASS | consistent with `build.mjs` naming `muse-auto-allow-v${man.version}.zip` (hypothetical for 1.2.1) |
| 4.8 | Open-items list accuracy | PASS | TODOs genuinely present in LISTING+PRIVACY; images present with correct dims; build check satisfiable — the "[ ] Run node scripts/build.mjs…" item is still unchecked although the committed zip already satisfies it (M6, nit) |

---

## Mismatches found

**M1 — MEDIUM — Screenshot asset is a mockup; conflicts with the packet's own guidance.**
`store/screenshot1.png` is a rendered design composition, not a real browser capture: `scripts/render.mjs` (line 107) renders `assets/store-screenshot.html` → `store/screenshot1.png`, and that HTML is a marketing composition (tagline "Approvals on autopilot…", feature bullets, "Detect → Allow → Log" flow, footer "6 languages", a simulated approval card with "✓ auto-clicked in 0.2s", a simulated popup with "Clicked: 128" and fabricated log rows at 12:00:41/38/35). Image inspection of the PNG matches this composition (no browser chrome, promo layout).
Conflict: `LISTING.md` §8 says "show the real Muse approval card with the extension's popup open … Do not use a mockup … do not put misleading wording in the image"; `PUBLISH_RUNBOOK.md` §6 says "Screenshots must show the real Muse approval card with the popup open — no mockups implying extra capabilities. (Render real screenshots before submit.)" The packet partially acknowledges this (runbook open item: "review content before upload"), but as shipped the asset does not meet the packet's stated requirement, and the demo numbers ("Clicked: 128", "0.2s") are not from a real session.
*Fix direction (not applied): replace with a real capture of the popup + a real approval card before submit — or consciously change the packet's stated policy.*

**M2 — LOW — "log of the last 50 clicks" overstates what the popup shows.**
Stored log holds 50 (`content.js:188`), popup renders only the 12 most recent (`popup.js:24` `log.slice(0, 12)`; the scroll container only contains those 12 items). The claim appears in `LISTING.md` §2 (EN + all five localized descriptions) and §"You stay in control"; PRIVACY §2/§4 describe storage (accurate there). *Fix direction: render more entries in the popup, or reword the listing line.*

**M3 — LOW — `clickCount` omitted from the "what is stored" enumerations.**
PRIVACY §2 and LISTING §5 storage justification list settings (`enabled`, `minDelayMs`) + log; code also persists `clickCount` (`content.js:204`, read in `popup.js:37`). No claim is contradicted ("collects nothing" stays true — local-only state), but the enumeration is incomplete. *Fix direction: add the click counter to both lists.*

**M4 — NIT — log-entry timestamp not mentioned in PRIVACY's log description.**
Entries carry an ISO `at` timestamp (`content.js:203`); PRIVACY §2 describes "kind, button label, and context" only. Cosmetic.

**M5 — INFO — `icons/icon512.png` (75,879 B) shipped in the zip but unreferenced by the manifest.** Allowed under the stated runtime-file rules; dead payload only.

**M6 — NIT — runbook open item "[ ] Run node scripts/build.mjs and confirm the zip has manifest.json at root" is unchecked** although the committed zip already satisfies it (and the build reproduces content-identically). Status hygiene.

### Out-of-scope observations (not part of the 4 verified items)

- `store/COMPLIANCE_CHECKLIST.md` (20,671 B) exists on disk but is **untracked in git** (`git status` → `?? store/COMPLIANCE_CHECKLIST.md`) although `CHANGELOG.md` (1.2.0) and `README.md` reference it — commit it or it will be lost on push. (It independently flags the same M2 issue.)
- `dist/` is gitignored by design; the zip exists on disk and rebuilds content-identically via `node scripts/build.mjs`. A fresh clone must run the build before upload.

---

## Verification evidence (commands, all read-only / sandboxed)

- Zip: Python `zipfile` — entry list (16), sizes, per-entry sha256 vs `extension/` disk files; `manifest.json` parsed from inside the zip.
- Build reproducibility: `cp` of `scripts/` + `extension/` to a scratch dir outside the repo → `node scripts/build.mjs` → entry-set and per-entry-data comparison vs committed zip.
- Locales: all 6 `messages.json` parsed; key sets compared.
- Short description: exact extraction from `store/LISTING.md` §1 code block → `len()` = 107.
- PNG sizes: header parse (bytes 16–24) for all store assets and icons.
- Network scan: substring scan of every file under `extension/` for `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource`, `importScripts`, `eval(`, `new Function`, `http://`, `https://`, `chrome.storage`, `chrome.runtime.connect`.
- Environment: Windows host, git-bash; Python 3.14.7; node v26.7.0; git `3af9ba4979bbc7859f93a44eff7f14f61b0a31b9`.
