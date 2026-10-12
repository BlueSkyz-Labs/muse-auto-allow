# Store Packet Verification — Muse Auto-Allow v1.2.0

**Verifier:** independent (maker ≠ judge) — this report was produced by a separate agent from the one(s) that authored the packet; every claim below was re-checked against the repository, not taken from the packet documents.
**Date:** 2026-10-09 07:33 +07:00
**Repo / revision:** `C:\00. AI Project\muse-auto-allow` @ git `3af9ba4979bbc7859f93a44eff7f14f61b0a31b9` (working tree clean at check time except untracked `store/COMPLIANCE_CHECKLIST.md`)
**Scope:** `store/LISTING.md`, `dist/muse-auto-allow-v1.2.0.zip`, `store/PRIVACY.md`, `store/PUBLISH_RUNBOOK.md` vs repo reality.
**Method:** static inspection; Python 3.14.7 zip / sha256 / PNG-header checks; sandbox re-run of `node scripts/build.mjs` (node v26.7.0) on a scratch copy outside the repo; image inspection of `store/screenshot1.png`.
**Not executed (per task constraints):** Chrome, `test/e2e.mjs`. No existing repo file was modified; this report is the only file created.

> **v1.4.0 addendum:** the packet now ships as **v1.4.0** (`dist/muse-auto-allow-v1.4.0.zip`) — the addendum at the end of this document records what changed and the re-verification status per item. Everything above this line remains the v1.2.0 record.
>
> **v1.5.0 addendum:** the packet now ships as **v1.5.0** (`dist/muse-auto-allow-v1.5.0.zip`) — the v1.5.0 addendum at the end of this document re-verifies the items that changed since v1.4.0 (commits `d7084da` + `311f006`).
>
> **v1.9.0 addendum:** the packet shipped as **v1.9.0** (`dist/muse-auto-allow-v1.9.0.zip`) — kept as history.
>
> **v1.9.1 addendum (history):** the packet shipped as **v1.9.1** (`dist/muse-auto-allow-v1.9.1.zip`) — superseded by the v1.9.2 addendum; kept as history.
>
> **v1.9.2 addendum (current verification):** the packet now ships as **v1.9.2** (`dist/muse-auto-allow-v1.9.2.zip`) — the v1.9.2 addendum at the end of this document is the **current verification** for this packet; it extends the v1.9.1 addendum with the 1.9.2 artifact and the re-run gates. Everything above (the v1.2.0 record and the v1.4.0 / v1.5.0 / v1.9.0 / v1.9.1 addenda) is the frozen historical record; the **v1.6.0 / v1.7.0 / v1.8.0 gap** in this file is a known stale item (those releases moved without a verification addendum here).

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

---

## v1.4.0 Addendum (2026-10-09)

**Verifier:** same independent pass (maker ≠ judge). File-level re-verification only — **no Chrome / e2e run was performed in this pass**; the redesign e2e result is cited from `CHANGELOG.md` line 9, not re-executed.
**Revision:** v1.4.0 revision = commit `8c76d2a` (2026-10-09); the zip byte-matches this revision for all 18 entries (normalized line endings). Later in-flight working-tree edits (e.g. uncommitted post-release work) are outside this record.
**Method:** full read of every changed file; `python scripts/verify-zip.py` executed read-only (byte-compare, exit 0); Python zip listing + sha256; PNG-header dimension checks on all store images + icons; JSON locale-parity parse; grep scans (remote code / URLs / manifest keys).

### What changed since this report's v1.2.0 pass

- **v1.3.0** — Statistics page (`extension/stats.html` + `stats.js`), toolbar badge (`extension/background.js` lines 34–46), muse.ai-only status chip, Web-Locks-serialized stats recording (`extension/content.js` lines 225–294), i18n 26→30 keys; zip-guard HIGH fix (`scripts/build.mjs` lines 32–54; new `scripts/verify-zip.py`). See `docs/REDTEAM_V3.md` lines 104–113.
- **v1.4.0** — UI/UX redesign in Muse's design language + dark theme (`CHANGELOG.md` line 4); Brand Kit v2 (`CHANGELOG.md` line 5, `docs/BRANDING.md`); strictly fictional demo data in store assets (`CHANGELOG.md` line 6); regenerated screenshots (`CHANGELOG.md` line 7); i18n 31 keys × 6 locales (`CHANGELOG.md` line 8); e2e re-run recorded exit 0 (`CHANGELOG.md` line 9 — NOT_RE_VERIFIED here).
- Manifest 1.3.0 → **1.4.0** (`extension/manifest.json` line 4); package **`dist/muse-auto-allow-v1.4.0.zip`** — **18 entries** (was 16).

### Previously-verified items — re-verification status

| Old item | v1.2.0 claim | v1.4.0 re-check (file-level) | Status |
|---|---|---|---|
| 1.1 | name "Muse Auto-Allow" | `extension/_locales/en/messages.json` lines 2–4 unchanged | PASS |
| 1.2 | version 1.2.0 | `extension/manifest.json` line 4 = `"1.4.0"` | PASS (superseded) |
| 1.7 | 6 locales, same key set | all 6 locale files = identical 31-key sets (Python parse) | PASS |
| 1.10 | short description 107 chars | recounted: 107 (limit 132) | PASS |
| 1.15 / M2 | popup rendered only 12 of the 50 log entries | `extension/popup.js` line 24 now `log.slice(0, 50)`; scroll area `extension/popup.html` line 42 | PASS (M2 fixed) |
| 1.20 | asset dimensions | icon128 128×128; screenshot1 1280×800; promo 440×280; **new:** screenshot2-stats 1280×800, screenshot4-overview 1280×800, screenshot3-popup 680×1964 | PASS except screenshot3-popup → Finding F1 |
| 1.21 / M1 | screenshot1 was a mockup | `scripts/store-shot.mjs` lines 3–11, 24: real runtime capture pipeline | PASS (structural; visual content NOT_RE_VERIFIED in this pass) |
| 2.1–2.3 | 16 entries, 16/16 byte-equal, manifest at root | **18 entries, 18/18 byte-equal** — `scripts/verify-zip.py` output: `muse-auto-allow-v1.4.0.zip: 18 matched, 0 mismatched, 0 disk-only, 0 zip-only` (exit 0); manifest at root | PASS |
| 2.5 | rebuild reproducibility | full-tree guard present (`scripts/build.mjs` lines 32–54, exit 3/4); no sandbox rebuild performed this pass (byte-compare covers content identity) | NOT_RE_VERIFIED |
| 2.6 | zip structural hygiene | 18 entries, `/`-separated, no directory entries (Python listing) | PASS |
| 3.1–3.4 | PRIVACY vs code | `store/PRIVACY.md` lines 23, 42–46, 78–79, 92 now enumerate settings + click counter + log (timestamp/kind/label/context) + statistics (caps 400 days / 24 months / 100 topics), matching `extension/content.js` lines 262–277 | PASS (M3/M4 fixed) |
| 4.1–4.6 | runbook paths/commands | runbook updated to v1.4.0 + mandatory `verify-zip.py` step in this pass | PASS (see runbook) |
| M5 | icon512 unreferenced in manifest | unchanged (still shipped, still unreferenced; allowed) | PASS (informational) |
| M6 | build open item unchecked | runbook open-items updated | PASS |

> `scripts/verify-zip.py` is a live check against the current working tree: it reported 18/18 matched (exit 0) at the 2026-10-09 check on revision `8c76d2a`; an uncommitted edit landing after a build shows as `MISMATCH <file>` until the zip is rebuilt — rebuild + re-verify on the final release revision before upload.

### New items (introduced after the v1.2.0 pass)

| # | Item | Status | Evidence |
|---|---|---|---|
| N1 | `scripts/verify-zip.py` byte-compare step | PASS | executed 2026-10-09: 18 matched / 0 mismatched / 0 disk-only / 0 zip-only, exit 0; script derives the zip name from `manifest.json` (lines 7–8) and exits 1 on any mismatch/missing/extra (lines 25–29) |
| N2 | Full-tree build guard | PASS (read) | `scripts/build.mjs` lines 32–43 (disk ↔ zip set equality), lines 47–54 (exit 2/3/4); residual scope notes at `docs/REDTEAM_V3.md` line 35 (V3-8) fixed per line 111 |
| N3 | Neutral fictional demo data in store assets | PASS | `docs/BRANDING.md` lines 75–77; `scripts/stats-shot.mjs` lines 44–51, 54–64; `scripts/store-shot.mjs` line 219 |
| N4 | v1.4.0 store image set (4 screenshots + promo) | PASS with F1 | PNG headers 2026-10-09; `CHANGELOG.md` line 7 |
| N5 | i18n 31 keys × 6 locales | PASS | Python parity parse; `CHANGELOG.md` line 8; new key `museTabsFoundOne` at `extension/_locales/en/messages.json` lines 92–94 |

### Findings in this pass (outside this report's write scope)

- **F1 — `store/screenshot3-popup.png` is 680×1964** — not a valid CWS screenshot size (1280×800 / 640×400; developer.chrome.com, checked 2026-10-09) and not the packet's stated 1280×800 (`store/LISTING.md` line 379). Re-render or drop it from the dashboard set; the other three screenshots comply. (`scripts/stats-shot.mjs` header line 7 also says "(340x640 @2x)" while the file is 680×1964 — comment drift.)
- **F2 — `store/LISTING.md` still says v1.2.0** (§1 lines 16, 18; §6 line 320) and its §8 asset table lists only screenshot1 + promo (lines 378–381). Stale for a 1.4.0 submission; update before uploading.
- **F3 — cosmetic:** `extension/content.js` line 1 header comment still reads "(v1.2.0, security-hardened)".

**Bottom line:** all substantive v1.2.0 findings M1–M4 and M6 are addressed in the working tree; the two baseline FAILs (M1 screenshot mockup, M2 log count) are both resolved by file-level evidence. Remaining submission blockers are F1 (screenshot3) and F2 (LISTING.md staleness), plus the pre-existing owner-input TODOs (privacy URL, support email, publisher name).

---

## v1.5.0 Addendum (2026-10-09)

**Verifier:** independent docs pass (maker ≠ judge). File-level re-verification only — **no Chrome / e2e execution was performed in this pass**; the e2e result is cited from the v1.5.0 commit message (`d7084da`: "e2e exit 0"), not re-executed. Store-image checks are PNG-header dimension parses; pixel content was not visually inspected in this pass.
**Revision:** v1.5.0 = commits `d7084da` (feature) + `311f006` (polish), HEAD `311f0065bb8049f29beb0cbb1826fed992a09bad`, 2026-10-09; working tree clean at check time.
**Method:** targeted reads of every file cited below; `python scripts/verify-zip.py` executed read-only (byte-compare, exit 0); Python zip listing + sha256; PNG-header dimension checks on all six store images; JSON locale-parity parse (6 files × 35 keys); targeted greps.

### What changed since the v1.4.0 addendum

- **Feature (`d7084da`)** — upgrade-safe data inheritance (`schemaVersion: 2` per flush; legacy shapes stay readable); AES-GCM-256 at-rest encryption for the log's approval text (per-install `cryptKeyRaw`; documented limitation); Statistics-page Export/Import data (full-storage JSON backup); log timestamps display the viewer's local system time; showcase kit: marquee 1400×560 + `store/SHOWCASE.md`; i18n 31 → 35 keys.
- **Polish (`311f006`)** — `store/screenshot3-popup.png` recomposed as a 1280×800 stage shot (was 680×1964 — the v1.4.0 finding F1); marquee redesigned two-zone; popup micro-fixes; `store/LISTING.md` refreshed to v1.5.0 (F2); `extension/content.js` header now reads v1.5.0 (F3).
- Manifest 1.4.0 → **1.5.0** (`extension/manifest.json` line 4); package **`dist/muse-auto-allow-v1.5.0.zip`** — still **18 entries**.

### Re-verification of changed items (file-level)

| Old item | v1.4.0 status | v1.5.0 re-check | Status |
|---|---|---|---|
| 1.2 | version 1.4.0 | `extension/manifest.json` line 4 = `"1.5.0"` | PASS (superseded) |
| 1.7 / N5 | 6 locales, identical 31-key sets | all 6 locale files = identical **35-key** sets (Python parse); 4 new keys `exportData`/`importData`/`importConfirm`/`importBad` at `extension/_locales/en/messages.json` lines 95, 98, 101, 104 | PASS |
| 2.1–2.3 / N1 | 18 entries, 18/18 byte-equal (v1.4.0) | **18 entries, 18/18 byte-equal at v1.5.0** — `scripts/verify-zip.py`: `muse-auto-allow-v1.5.0.zip: 18 matched, 0 mismatched, 0 disk-only, 0 zip-only` (exit 0; zip byte-verified against the committed `311f006` extension tree); last-build archive sha256 `386f156bd301511ff8a32f7b57721a3d9687c186617ceeb0e93ea199babf5d29`, 97,217 bytes (rebuild-dependent); manifest at root | PASS |
| 1.20 / N4 / F1 | screenshots 1280×800 except screenshot3-popup 680×1964 | **all four screenshots 1280×800** (screenshot3 recomposed at `311f006`); promo 440×280; **new** marquee 1400×560 — PNG headers 2026-10-09 | PASS (F1 fixed) |
| N4 | 4 screenshots + promo; no marquee, no index | 6 store images exact-spec; `store/SHOWCASE.md` index present (asset table + regenerate commands + pre-submit list) | PASS |
| F2 | `store/LISTING.md` stale at v1.2.0 | refreshed to v1.5.0 — version/package refs lines 16, 18, 320; asset table lines 379–381; `store/SHOWCASE.md` linked line 385 | PASS (F2 fixed) |
| F3 | content.js header read v1.2.0 | `extension/content.js` line 1 = "v1.5.0, security-hardened" | PASS (F3 fixed) |
| N6 (new) | — | **Encryption at rest:** `extension/content.js` lines 252–283 (AES-GCM-256; `cryptKeyRaw` per install, lines 268–270), `ctx` per entry (lines 279–281, 305); popup decrypts (`extension/popup.js` lines 22–44) with graceful fallbacks; limitation documented (`CHANGELOG.md` line 5; `content.js` lines 253–256) | PASS (read) |
| N7 (new) | — | **Backup/restore:** `extension/stats.js` lines 159–192 — export = local JSON incl. `cryptKeyRaw`; import validates `app` marker + confirms before replace; UI `extension/stats.html` lines 85–87 | PASS (read) |
| N8 (new) | — | **Upgrade inheritance:** `schemaVersion: 2` per flush (`extension/content.js` line 315); legacy plaintext entries still render (`extension/popup.js` line 43); counters/aggregates coerced on read (`content.js` lines 294–298; `stats.js` lines 126–135) | PASS (read) |
| N9 (new) | — | **Local-time log display:** `extension/popup.js` lines 45–51 (local `HH:MM:SS`); hover title = full local datetime (line 64) | PASS (read) |

### Explicitly NOT re-run in this pass

- **Chrome / `test/e2e.mjs`** — not executed here; "e2e exit 0" is cited from the v1.5.0 commit message (`d7084da`), not independently reproduced. Re-run before submit per the runbook.
- **Sandbox rebuild of the zip** — not performed; the byte-compare against the working tree covers content identity.
- **Visual content of store images** — only PNG-header dimensions were verified; the images were not visually reviewed in this pass.

**Bottom line:** all three v1.4.0 addendum findings (F1 screenshot3 spec, F2 LISTING staleness, F3 header version) are closed at `311f006`; the v1.5.0 feature set (encryption at rest, backup/restore, upgrade inheritance, local-time log) is present per file-level evidence; the zip re-verifies 18/18 byte-equal at v1.5.0. Remaining submission blockers are the pre-existing owner-input TODOs (privacy URL, support email, publisher name) — unchanged.

---

## v1.9.0 Addendum (2026-10-10) — history

**Verifier:** independent docs pass (maker ≠ judge), run as part of the v1.9.0 store/release doc sync. This addendum does **not** rewrite anything above it: §1–§11 and the v1.4.0 / v1.5.0 addenda are the **frozen v1.2.0-era record** (with its v1.4.0/v1.5.0 addenda), kept as history.

**This was the current verification at the v1.9.0 freeze; it is superseded by the v1.9.1 and v1.9.2 addenda below.** The **v1.6.0 / v1.7.0 / v1.8.0 gap** in this document is a known stale item — those releases moved the packet (CWS submission pack, Statistics, pause/dry-run/rules/notifications/settings-sync) without a verification addendum here; the gap is acknowledged, not back-filled.

**Revision:** v1.9.0 = freeze commit `fcbdd63` (2026-10-10; remote `main`; tag `v1.9.0`); working tree clean at check time.

**Method (this pass):** Python `zipfile` listing + per-entry parse of `dist/muse-auto-allow-v1.9.0.zip`; `sha256sum` of the artifact vs its sidecar; `python scripts/verify-zip.py` (read-only byte-compare, exit 0); read of `extension/manifest.json` (permissions / host patterns / commands / `content_scripts.matches`); read of `store/LISTING.md` §1; `node scripts/lint.mjs`; `node test/background-unit.mjs`; targeted greps for remote-code/network primitives and `https://` strings. **No Chrome / CDP run was performed in this pass.**

### Freeze evidence — the v1.9.0 freeze (superseded by the v1.9.1 and v1.9.2 addenda)

- **Artifact:** `dist/muse-auto-allow-v1.9.0.zip` — **177,387 bytes**, **18 entries**, `manifest.json` at the zip root; sha256 `d1929416a88a550505c68120542dcd1830a1142f5d96bfe2a5aa195ff531718d` (matches the sidecar `dist/muse-auto-allow-v1.9.0.zip.sha256`).
- **Byte-verify:** `python scripts/verify-zip.py` → `18 matched, 0 mismatched, 0 disk-only, 0 zip-only` (exit 0) — **re-run in this pass**.
- **Artifact smoke:** `node scripts/smoke-zip.mjs` → exit 0, `ok: true` (freeze-recorded; see `docs/RELEASE_INTEGRITY.md` → "Recorded evidence (v1.9.0 freeze)").
- **Determinism:** two consecutive `node scripts/build.mjs` runs byte-identical (same sha256) — freeze-recorded.
- **Gates on the frozen tree (freeze-recorded):** `lint.mjs` 0 · `background-unit.mjs` 29/29 · `e2e.mjs` ok (`n7count 1`, `forbiddenHit []`) · `followup-e2e.mjs` 106 checks 0 failed · `lang-switch-e2e.mjs` ok · `mission-e2e.mjs` 39 checks 0 failed.
- **Not done:** the package has **not** been uploaded to the Chrome Web Store; no CWS review, no store publish.

### Re-verification of the item list that still applies (file-level, this pass)

| # | Item | v1.9.0 re-check | Status |
|---|---|---|---|
| 2.1 | `manifest.json` at the zip root | entry list contains `manifest.json` at root (not nested) | PASS |
| 2.2 | Only runtime files — no `test/`, `docs/`, `scripts/`, `store/` entries | 18 entries: `manifest.json`, `content.js`, `background.js`, `popup.html`, `popup.js`, `stats.html`, `stats.js`, `icons/{icon16,icon32,icon48,icon128,icon512}.png`, `_locales/{en,es,ja,ko,vi,zh_CN}/messages.json` — nothing else | PASS |
| 2.3 | Every entry matches `extension/` on disk | `verify-zip.py` → 18 matched, 0 mismatched, 0 disk-only, 0 zip-only (exit 0) | PASS |
| 2.4 | Manifest inside zip == LISTING | zip manifest `version 1.9.0`, `permissions ["storage","alarms","notifications"]`, `host_permissions` the two muse.ai patterns, `commands` `toggle-pause`/`send-followup`, `default_locale en` — matches `store/LISTING.md` §1 (`Version 1.9.0`, package `dist/muse-auto-allow-v1.9.0.zip`) and the frozen `extension/manifest.json` | PASS |
| 2.6 | Zip structural hygiene | 18 entries, `/`-separated names, no directory entries (Python listing) | PASS |
| 3.2 | No network calls in extension code | grep for `eval(`/`new Function`/`fetch(`/`XMLHttpRequest`/`WebSocket`/`sendBeacon`/`EventSource`/`importScripts`/`insertAdjacentHTML`/`document.write` over `extension/`: **0 matches**; the only `https://` strings are the muse.ai `chrome.tabs.query` match patterns (`background.js` 121/255, `popup.js` 477/641/1429) — the remaining `http://` hits are inline `data:image/svg+xml` URIs in `popup.html` CSS, not network requests | PASS |
| 3.7 | Page access limited to muse.ai | `host_permissions` and `content_scripts[0].matches` are exactly `https://muse.ai/*` + `https://*.muse.ai/*` | PASS |
| 3.8 | Permissions table matches manifest | manifest = `storage` / `alarms` / `notifications` + the two muse.ai hosts (`commands` is a manifest key, **not** a permission) — matches `store/LISTING.md` §5 / `store/PRIVACY.md` §5 | PASS |
| 3.9 | "collects nothing / transmits nothing / no analytics / no advertising" | consistent with the scans above; the one optional data-flow surface (off-by-default settings sync) is disclosed in `store/PRIVACY.md` §2 and `store/CWS_SUBMISSION_PACK.md` §3.2a | PASS |
| 1.2 / 4.6 | Version consistency | `extension/manifest.json` `"version": "1.9.0"` = `store/LISTING.md` §1 `Version 1.9.0` = `dist/muse-auto-allow-v1.9.0.zip` (all three read in this pass) | PASS (superseded from 1.2.0) |
| — | Lint gate | `node scripts/lint.mjs` → exit 0 (24 checks across 18 files) | PASS (re-run) |
| — | Background-unit gate | `node test/background-unit.mjs` → 29/29, `ok: true`, exit 0 | PASS (re-run) |

### NOT_VERIFIED in this pass (explicit)

- **Chrome / CDP runtime suites** — `test/e2e.mjs`, `test/followup-e2e.mjs`, `test/lang-switch-e2e.mjs`, `test/mission-e2e.mjs`, and `scripts/smoke-zip.mjs` were **NOT executed** here; their results are cited from the v1.9.0 freeze evidence (`docs/RELEASE_INTEGRITY.md`, `CHANGELOG.md` 1.9.0) and not independently reproduced. **NOT_VERIFIED.**
- **Determinism re-proof** — a clean `node scripts/build.mjs` could **NOT** complete in this docs pass: the write step aborted with a Windows `EPERM` file-lock on `dist/muse-auto-allow-v1.9.0.zip`. The artifact bytes were unchanged (same sha256) and `verify-zip.py` still passed. The double-build determinism claim is freeze-recorded, not re-proven here. **NOT_VERIFIED.**
- **Visual content of the store images** — PNG dimensions were not re-parsed and the images were not visually reviewed in this pass. **NOT_VERIFIED.**
- **Chrome Web Store submission state** — no dashboard was opened; nothing was uploaded, reviewed, or published. **NOT_VERIFIED / NOT DONE.**
- **Items 1.3–1.21, 3.1, 3.3–3.6, 4.1–4.8** (the v1.2.0 per-line checks) — only the subset re-listed in the table above was re-checked; the rest stand as the historical v1.2.0/v1.4.0/v1.5.0 record and are **NOT_VERIFIED** against the v1.9.0 tree in this pass.

**Bottom line:** the v1.9.0 freeze evidence (artifact + sha256 + verify-zip + smoke + six green suites) was the current verification at the v1.9.0 freeze — **superseded by the v1.9.1 and v1.9.2 addenda below**; the sections above it are the frozen v1.2.0-era record with its v1.4.0/v1.5.0 addenda, and the v1.6.0–v1.8.0 gap here is a known stale item. Nothing in this document claims a Chrome Web Store upload, review, or publish — the package has not been uploaded.

---

## v1.9.1 Addendum (2026-10-11) — history

**Verifier:** independent docs pass (maker ≠ judge), run as part of the v1.9.1 store/release doc sync. This addendum **extends** the v1.9.0 addendum above with the 1.9.1 artifact and the re-run gates; it does not rewrite anything above it. The v1.2.0 record and the v1.4.0 / v1.5.0 / v1.9.0 addenda remain the frozen historical record.

**Revision:** v1.9.1 = freeze commit `6187606` (2026-10-11; remote `main`; tag `v1.9.1`); working tree clean at check time.

**Method (this pass):** Python `zipfile` listing + per-entry parse of `dist/muse-auto-allow-v1.9.1.zip`; `sha256sum` of the artifact vs its sidecar; `python scripts/verify-zip.py` (read-only byte-compare, exit 0); read of `extension/manifest.json` (permissions / host patterns / commands / `content_scripts.matches`); read of `store/LISTING.md` §1; `node scripts/lint.mjs`. **No Chrome / CDP run was performed in this pass.**

### v1.9.1 freeze evidence (history — superseded by the v1.9.2 addendum below)

- **Artifact:** `dist/muse-auto-allow-v1.9.1.zip` — **180,069 bytes**, **18 entries**, `manifest.json` at the zip root; sha256 `eec91d1d8f16005e2f34a748145d7a7d32c04b7d85f8ada267255fdb0ac8d1d8` (matches the sidecar `dist/muse-auto-allow-v1.9.1.zip.sha256`).
- **Byte-verify:** `python scripts/verify-zip.py` → `18 matched, 0 mismatched, 0 disk-only, 0 zip-only` (exit 0) — **re-run in this pass**.
- **Determinism:** two consecutive `node scripts/build.mjs` runs byte-identical (same sha256) — freeze-recorded.
- **Artifact smoke:** `node scripts/smoke-zip.mjs` → exit 0, `ok: true` (freeze-recorded; see `docs/RELEASE_INTEGRITY.md` → "Recorded evidence (v1.9.1 freeze)").
- **Gates on the frozen tree (freeze-recorded):** `lint.mjs` 0 · `background-unit.mjs` 29/29 · `e2e.mjs` ok · `followup-e2e.mjs` 106 checks 0 failed · `lang-switch-e2e.mjs` ok · `mission-e2e.mjs` 39 checks 0 failed · `scripts/bench/experience.mjs --only=assert` 22 passed / 0 failed.
- **New in 1.9.1:** the popup background is `inert` while a dialog is open (accessibility-tree background nodes 99 → 0 safety, 22 → 0 missions, 13 → 0 onboarding); the send-refusal reason map covers **all 10** engine failure reasons (added paused / schedule / dead, 3 new i18n keys); a blocked log chip shows `blocked · <reason>` in text **and** in its accessible name; deleting a settings key resets it to its default immediately; a failed log flush warns locally instead of dropping the record silently. i18n is **172 keys × 6 locales**.
- **Not done:** the package has **not** been uploaded to the Chrome Web Store; no CWS review, no store publish.

### Re-verification of the item list that still applies (file-level, this pass)

| # | Item | v1.9.1 re-check | Status |
|---|---|---|---|
| 2.1 | `manifest.json` at the zip root | entry list contains `manifest.json` at root (not nested) | PASS |
| 2.2 | Only runtime files — no `test/`, `docs/`, `scripts/`, `store/` entries | 18 entries: `manifest.json`, `content.js`, `background.js`, `popup.html`, `popup.js`, `stats.html`, `stats.js`, `icons/{icon16,icon32,icon48,icon128,icon512}.png`, `_locales/{en,es,ja,ko,vi,zh_CN}/messages.json` — nothing else | PASS |
| 2.3 | Every entry matches `extension/` on disk | `verify-zip.py` → 18 matched, 0 mismatched, 0 disk-only, 0 zip-only (exit 0) | PASS |
| 2.4 | Manifest inside zip == LISTING | zip manifest `version 1.9.1`, `permissions ["storage","alarms","notifications"]`, `host_permissions` the two muse.ai patterns, `commands` `toggle-pause`/`send-followup`, `default_locale en` — matches `store/LISTING.md` §1 (`Version 1.9.1`, package `dist/muse-auto-allow-v1.9.1.zip`) and the frozen `extension/manifest.json` | PASS |
| 2.6 | Zip structural hygiene | 18 entries, `/`-separated names, no directory entries (Python listing) | PASS |
| 3.7 | Page access limited to muse.ai | `host_permissions` and `content_scripts[0].matches` are exactly `https://muse.ai/*` + `https://*.muse.ai/*` | PASS |
| 3.8 | Permissions table matches manifest | manifest = `storage` / `alarms` / `notifications` + the two muse.ai hosts (`commands` is a manifest key, **not** a permission) — matches `store/LISTING.md` §5 / `store/PRIVACY.md` §5 | PASS |
| 3.9 | "collects nothing / transmits nothing / no analytics / no advertising" | consistent with the scans above; the one optional data-flow surface (off-by-default settings sync) is disclosed in `store/PRIVACY.md` §2 and `store/CWS_SUBMISSION_PACK.md` §3.2a | PASS |
| 1.2 / 4.6 | Version consistency | `extension/manifest.json` `"version": "1.9.1"` = `store/LISTING.md` §1 `Version 1.9.1` = `dist/muse-auto-allow-v1.9.1.zip` (all three read in this pass) | PASS (superseded from 1.9.0) |
| — | Lint gate | `node scripts/lint.mjs` → exit 0 (24 checks across 18 files) | PASS (re-run) |

### NOT_VERIFIED in this pass (explicit)

- **Chrome / CDP runtime suites** — `test/e2e.mjs`, `test/followup-e2e.mjs`, `test/lang-switch-e2e.mjs`, `test/mission-e2e.mjs`, `scripts/smoke-zip.mjs` and `scripts/bench/experience.mjs` were **NOT executed** here; their results are cited from the v1.9.1 freeze evidence (`docs/RELEASE_INTEGRITY.md`, `CHANGELOG.md` 1.9.1) and not independently reproduced. **NOT_VERIFIED.**
- **Determinism re-proof** — a clean `node scripts/build.mjs` was **NOT** re-run in this docs pass; the artifact bytes are unchanged (same sha256) and `verify-zip.py` still passed. The double-build determinism claim is freeze-recorded, not re-proven here. **NOT_VERIFIED.**
- **Visual content of the store images** — PNG dimensions were not re-parsed and the images were not visually reviewed in this pass. **NOT_VERIFIED.**
- **Chrome Web Store submission state** — no dashboard was opened; nothing was uploaded, reviewed, or published. **NOT_VERIFIED / NOT DONE.**
- **Items 1.3–1.21, 3.1, 3.3–3.6, 4.1–4.8** (the v1.2.0 per-line checks) — only the subset re-listed in the table above was re-checked; the rest stand as the historical v1.2.0/v1.4.0/v1.5.0/v1.9.0 record and are **NOT_VERIFIED** against the v1.9.1 tree in this pass.

**Bottom line:** the v1.9.1 freeze evidence (artifact + sha256 + verify-zip + smoke + six green suites + the experience assert) was the current verification at the v1.9.1 freeze — **superseded by the v1.9.2 addendum below**; the sections above it are the frozen v1.2.0-era record with its v1.4.0/v1.5.0/v1.9.0 addenda, and the v1.6.0–v1.8.0 gap here is a known stale item. Nothing in this document claims a Chrome Web Store upload, review, or publish — the package has not been uploaded.

---

## v1.9.2 Addendum (2026-10-12)

**Verifier:** independent docs pass (maker ≠ judge), run as part of the v1.9.2 store/release doc sync. This addendum **extends** the v1.9.1 addendum above with the 1.9.2 artifact and the re-run gates; it does not rewrite anything above it. The v1.2.0 record and the v1.4.0 / v1.5.0 / v1.9.0 / v1.9.1 addenda remain the frozen historical record.

**Revision:** v1.9.2 = freeze commit `0632391` (2026-10-11; tag `v1.9.2`); `origin/main` has since advanced to the hosted-privacy-page docs commit `5cb6a47`. The frozen `extension/` tree is unchanged since the freeze (working tree clean at check time).

**Method (this pass):** Python `zipfile` listing + per-entry parse of `dist/muse-auto-allow-v1.9.2.zip`; `sha256sum` of the artifact vs its sidecar; `python scripts/verify-zip.py` (read-only byte-compare, exit 0); read of `extension/manifest.json` (permissions / host patterns / commands / `content_scripts.matches`); read of `store/LISTING.md` §1; `node scripts/lint.mjs` (exit 0) and `node scripts/lint.mjs --self-test` (15/15); i18n key count per locale (6 × 172); PNG-header dimension parse of the six store images. **No Chrome / CDP run was performed in this pass.**

### Current verification — the v1.9.2 freeze evidence

- **Artifact:** `dist/muse-auto-allow-v1.9.2.zip` — **183,081 bytes**, **18 entries**, `manifest.json` at the zip root; sha256 `0d29f0cd8e3d0d4209519d6ce270375feec11fe85273c041f1dc71384900f29c` (matches the sidecar `dist/muse-auto-allow-v1.9.2.zip.sha256`).
- **Byte-verify:** `python scripts/verify-zip.py` → `18 matched, 0 mismatched, 0 disk-only, 0 zip-only` (exit 0) — **re-run in this pass**.
- **Determinism:** two consecutive `node scripts/build.mjs` runs byte-identical (same sha256) — freeze-recorded.
- **Artifact smoke:** `node scripts/smoke-zip.mjs` → exit 0, `ok: true` (freeze-recorded; see `docs/RELEASE_INTEGRITY.md` → "Recorded evidence (v1.9.2 freeze)").
- **Gates on the frozen tree (freeze-recorded):** `lint.mjs` 0 · `lint.mjs --self-test` 15/15 · `background-unit.mjs` 29/29 · `import-security` 142/0 (property: 0 of 22 crafted files clear a stored restriction) · `e2e.mjs` ok · `followup-e2e.mjs` 106 checks 0 failed · `lang-switch-e2e.mjs` 36/36 · `mission-e2e.mjs` 39 checks 0 failed · `scripts/bench/experience.mjs --only=assert` 22 passed / 0 failed.
- **New in 1.9.2:** the **backup-restore hardening** — the import sanitizer type-validates every v1.8/v1.9 setting against the engine's own readers and merges the composite groups (rules, smart recovery, schedule) at sub-key granularity, so a crafted or partial backup can only **tighten or preserve** a stored restriction, never clear it (measured on the engine's effective post-restore values: **0 of 22 crafted files clear a stored restriction**; the previous behaviour cleared 13 of 16); mirror guards assert the sanitizer's mission table and locale set equal to the shipped corpus/locales **in both directions**; the zero-network lint gate now models realistic network forms (beacon, EventSource, image/script source injection, dynamic `import()`, destructured/bracket/Reflect fetch, indirect eval) and self-tests **15** cases; the import-security harness grew from 29 to **142** checks with reverse-mutation falsifications. i18n remains **172 keys × 6 locales**.
- **Not done:** the package has **not** been uploaded to the Chrome Web Store; no CWS review, no store publish.

### Re-verification of the item list that still applies (file-level, this pass)

| # | Item | v1.9.2 re-check | Status |
|---|---|---|---|
| 2.1 | `manifest.json` at the zip root | entry list contains `manifest.json` at root (not nested) | PASS |
| 2.2 | Only runtime files — no `test/`, `docs/`, `scripts/`, `store/` entries | 18 entries: `manifest.json`, `content.js`, `background.js`, `popup.html`, `popup.js`, `stats.html`, `stats.js`, `icons/{icon16,icon32,icon48,icon128,icon512}.png`, `_locales/{en,es,ja,ko,vi,zh_CN}/messages.json` — nothing else | PASS |
| 2.3 | Every entry matches `extension/` on disk | `verify-zip.py` → 18 matched, 0 mismatched, 0 disk-only, 0 zip-only (exit 0) | PASS |
| 2.4 | Manifest inside zip == LISTING | zip manifest (byte-verified equal to `extension/manifest.json` by `verify-zip.py`): `version 1.9.2`, `permissions ["storage","alarms","notifications"]`, `host_permissions` the two muse.ai patterns, `commands` `toggle-pause`/`send-followup`, `default_locale en` — matches `store/LISTING.md` §1 (`Version 1.9.2`, package `dist/muse-auto-allow-v1.9.2.zip`) | PASS |
| 2.6 | Zip structural hygiene | 18 entries, `/`-separated names, no directory entries (Python listing) | PASS |
| 3.7 | Page access limited to muse.ai | `host_permissions` and `content_scripts[0].matches` are exactly `https://muse.ai/*` + `https://*.muse.ai/*` | PASS |
| 3.8 | Permissions table matches manifest | manifest = `storage` / `alarms` / `notifications` + the two muse.ai hosts (`commands` is a manifest key, **not** a permission) — matches `store/LISTING.md` §5 / `store/PRIVACY.md` §5 | PASS |
| 3.9 | "collects nothing / transmits nothing / no analytics / no advertising" | consistent with the scans above; the one optional data-flow surface (off-by-default settings sync) is disclosed in `store/PRIVACY.md` §2 and `store/CWS_SUBMISSION_PACK.md` §3.2a | PASS |
| 1.2 / 4.6 | Version consistency | `extension/manifest.json` `"version": "1.9.2"` = `store/LISTING.md` §1 `Version 1.9.2` = `dist/muse-auto-allow-v1.9.2.zip` (all three read in this pass) | PASS (superseded from 1.9.1) |
| — | Lint gate | `node scripts/lint.mjs` → exit 0 (24 checks across 18 files) | PASS (re-run) |
| — | i18n parity | key count per locale — all six files = 172 keys (parity enforced by lint, exit 0) | PASS (re-run) |
| — | Store-image dimensions | PNG-header parse: screenshot1 / 2 / 3 / 4 = 1280×800; promo 440×280; marquee 1400×560 | PASS (re-run) |

### NOT_VERIFIED in this pass (explicit)

- **Chrome / CDP runtime suites** — `test/e2e.mjs`, `test/followup-e2e.mjs`, `test/lang-switch-e2e.mjs`, `test/mission-e2e.mjs`, `scripts/smoke-zip.mjs` and `scripts/bench/experience.mjs` were **NOT executed** here; their results are cited from the v1.9.2 freeze evidence (`docs/RELEASE_INTEGRITY.md`, `CHANGELOG.md` 1.9.2) and not independently reproduced. **NOT_VERIFIED.**
- **Determinism re-proof** — a clean `node scripts/build.mjs` was **NOT** re-run in this docs pass; the artifact bytes are unchanged (same sha256) and `verify-zip.py` still passed. The double-build determinism claim is freeze-recorded, not re-proven here. **NOT_VERIFIED.**
- **Visual content of the store images** — dimensions were re-parsed in this pass (all exact-spec), but the images were **not** visually reviewed; whether screenshot1/2/3 show the current 1.9.2 build pixel-for-pixel is **NOT_VERIFIED** here.
- **Chrome Web Store submission state** — no dashboard was opened; nothing was uploaded, reviewed, or published. **NOT_VERIFIED / NOT DONE.**
- **Items 1.3–1.21, 3.1, 3.3–3.6, 4.1–4.8** (the v1.2.0 per-line checks) — only the subset re-listed in the table above was re-checked; the rest stand as the historical v1.2.0/v1.4.0/v1.5.0/v1.9.0/v1.9.1 record and are **NOT_VERIFIED** against the v1.9.2 tree in this pass.

**Bottom line:** the v1.9.2 freeze evidence (artifact + sha256 + verify-zip + smoke + the green gates) is the current verification for this packet; the sections above it are the frozen v1.2.0-era record with its v1.4.0/v1.5.0/v1.9.0/v1.9.1 addenda, and the v1.6.0–v1.8.0 gap here is a known stale item. Nothing in this document claims a Chrome Web Store upload, review, or publish — the package has not been uploaded.
