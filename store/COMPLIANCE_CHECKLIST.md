# Chrome Web Store Pre-Submission Compliance Checklist — Muse Auto-Allow

**Prepared:** 2026-10-09 · **Item version:** 1.2.0 (`extension/manifest.json` → `"version": "1.2.0"`) · **Package:** `dist/muse-auto-allow-v1.2.0.zip`
**Scope:** Independent pre-submission review for the Chrome Web Store dashboard. Every checkbox cites the exact file and value it was verified against on 2026-10-09. Items marked `UNCERTAIN` or `OWNER INPUT REQUIRED` must be resolved by the owner before clicking **Submit for review**.

> Provenance: `CHANGELOG.md` (1.2.0 entry) already references this file: "Independent store-compliance checklist added (`store/COMPLIANCE_CHECKLIST.md`)."

---

## 1. Single Purpose

- [ ] **Single purpose is stated and matches actual behavior.** Statement (from `store/LISTING.md` §4): "Muse Auto-Allow automatically clicks the **Allow** button on approval requests displayed by Muse (muse.ai) in the user's own browser, so the user's Muse agent runs without stopping for manual approvals." — matches `extension/content.js` header comment ("Automatically clicks \"Allow\" on Muse (muse.ai) approval requests") and all four click paths in `content.js` (`findMarkedAllow`, `findPairAllow`, `findCollapsedPending`, `findSurfaceButton`).
- [ ] **Nothing outside the single purpose is performed.** The extension acts only on `https://muse.ai/*` and `https://*.muse.ai/*` (`extension/manifest.json` → `host_permissions` and `content_scripts[0].matches`); it does not browse the web, collect content, or interact with other sites (`store/LISTING.md` §4; `store/PRIVACY.md` §2).
- [ ] **The single-purpose statement is what will be pasted into the dashboard.** Dashboard → Privacy practices → Single purpose: paste `store/LISTING.md` §4 verbatim (`store/PUBLISH_RUNBOOK.md` Step 3.2).

## 2. Permission Justifications (dashboard → Privacy practices)

- [ ] **`storage` — justified and actually used.** Manifest declares `"permissions": ["storage", "alarms"]` (`extension/manifest.json` line 7). Code use: saves settings and click log to `chrome.storage.local` — `content.js` line 48 (`DEFAULT = { enabled: true, minDelayMs: 300, clickCount: 0 }`), line 188 (`log.slice(0, 50)`), line 204 (`chrome.storage.local.set({ clickCount })`); read/write in `popup.js` lines 37, 58, 62. Justification text ready in `store/LISTING.md` §5 and `store/PRIVACY.md` §5 ("Save your on/off setting, click delay, and the local last-50 click log").
- [ ] **`alarms` — justified and actually used.** `extension/background.js` line 6 creates `chrome.alarms.create('muse-sweep', { periodInMinutes: 1 })`; the alarm handler (lines 13–21) sends `{ type: 'sweep' }` to open muse.ai tabs so background-tab approvals are processed. Justification text ready in `store/LISTING.md` §5 ("Schedules a once-a-minute nudge … makes no network requests") and `store/PRIVACY.md` §5.
- [ ] **Host permission `https://muse.ai/*` + `https://*.muse.ai/*` — justified and actually used.** Manifest declares exactly these two host patterns (`extension/manifest.json` line 8); the content script detects and clicks the Allow button on the page (`content.js` paths A–D) and `background.js` line 15 queries only these URL patterns (`chrome.tabs.query({ url: ['https://muse.ai/*', 'https://*.muse.ai/*'] })`). Justification text ready in `store/LISTING.md` §5 (host permission rather than `activeTab` because approvals can appear in background tabs).
- [ ] **No broad or unused permissions.** Manifest requests only `storage`, `alarms`, and the muse.ai host patterns — no `tabs`, `scripting`, `webRequest`, `cookies`, `downloads`, `<all_urls>`, `web_accessible_resources`, or `externally_connectable` (`extension/manifest.json`; confirmed by `docs/REDTEAM_REPORT.md` R15). Note: `background.js` line 15 uses the `chrome.tabs.query` **API** with muse.ai URL filters, which is covered by the host permission; the `"tabs"` **permission** is genuinely not needed and not declared.
- [ ] **Paste one justification per permission into the dashboard** per `store/PUBLISH_RUNBOOK.md` Step 3.2 (text source: `store/LISTING.md` §5).

## 3. Remote Code

- [ ] **No remote code — verified by grep on 2026-10-09.** Command run: `grep -rnE "eval\(|new Function|fetch\(|XMLHttpRequest|insertAdjacentHTML|document\.write|import\(|\.src\s*=|createElement\(['\"]script" extension/ --include="*.js" --include="*.html"` → **0 matches (grep exit code 1)**.
- [ ] **No network calls.** A second grep, `grep -rnE "https?://" extension/` (excluding `_locales`), returns a single hit: `extension/background.js` line 15 — a `chrome.tabs.query` URL **match pattern**, not a network request. The extension makes zero outbound calls (`store/PRIVACY.md` §3: "there are no servers").
- [ ] **Only bundled scripts are loaded.** `extension/popup.html` line 60 contains the only script tag: `<script src="popup.js"></script>` — a file shipped inside the package. No external `<script src>`, no CDN, no update endpoint (`store/LISTING.md` §6).
- [ ] **Dashboard answer: "No, I am not using remote code"** (`store/PUBLISH_RUNBOOK.md` Step 3.2; declaration text in `store/LISTING.md` §6). Manifest V3 with no `content_security_policy` relaxation (`extension/manifest.json` — no CSP key).
- [ ] **Shipped zip contains only static files.** `dist/muse-auto-allow-v1.2.0.zip` verified on 2026-10-09: 16 entries, `manifest.json` at the zip root, contents = `manifest.json`, `content.js`, `background.js`, `popup.html`, `popup.js`, 5 icons, 6 `_locales/*/messages.json` (`scripts/build.mjs` fails with exit code 2 if `manifest.json` is not at the root).

## 4. Data Usage Disclosures (dashboard → Privacy practices)

- [ ] **Local-only storage — nothing transmitted.** All persistence is `chrome.storage.local` (`content.js` lines 185, 188, 204, 251; `popup.js` lines 37, 58, 62). `store/PRIVACY.md` §2–3: "This information never leaves your device"; "The extension makes no outbound network calls."
- [ ] **Click log contents are disclosed accurately.** Each entry = kind (`allow` / `expand` / `open-panel`), button label, and context text of up to **240 characters** (`content.js`: `(card ? contextText(card) : label).slice(0, 240)` — card text with button labels excluded), stored **capped at 50 entries** (`content.js` line 188: `log.slice(0, 50)`). Residual risk R10 in `docs/REDTEAM_REPORT.md` documents that this may contain approval text (e.g. repo names) — already disclosed in `store/PRIVACY.md` §2 ("the last 50 clicks … kind, button label, and context") and §4 (retention/deletion: remove the extension to delete all data).
- [ ] **No analytics / no tracking / no advertising.** No analytics SDK exists in the package (grep in §3 shows no network primitives); `store/PRIVACY.md` §1 and §3 state "no analytics, no tracking, and no advertising" and "no sale/rent/share".
- [ ] **Data-collection answers ready for the dashboard form.** `store/LISTING.md` §7.1–7.2: collects or uses user data → **No**; all listed data types → **None**; data transmitted off device → **No**.
- [x] **Popup renders the full log — RESOLVED 2026-10-09.** The popup now renders up to **50** entries (`popup.js` line 24: `log.slice(0, 50)`, inside the scrollable area `popup.html` line 33: `max-height: 220px; overflow: auto`) — matches `store/LISTING.md` §2 "a log of the last 50 clicks" as written.

## 5. User-Data Policy Answers (certifications in the dashboard)

- [ ] **"I do not sell or transfer user data to third parties…" — check.** No data leaves the device; nothing is collected (`store/LISTING.md` §7.3; `store/PRIVACY.md` §3).
- [ ] **"I do not use or transfer user data for purposes that are unrelated to my item's single purpose" — check.** The only data handled is the local settings + click log that implement the single purpose (`content.js` lines 48, 188, 204).
- [ ] **"I do not use or transfer user data to determine creditworthiness or for lending purposes" — check.** (`store/LISTING.md` §7.3.)
- [ ] **Limited-use statement consistent across listing, privacy policy, and code.** `store/LISTING.md` §7.2–7.3, `store/PRIVACY.md` §3 ("does not use data for advertising, profiling, creditworthiness, or lending"), and code (grep §3) all agree.
- [ ] **Privacy policy URL will be live before submit.** Host `store/PRIVACY.md` publicly and paste the URL into the dashboard (`store/PUBLISH_RUNBOOK.md` Step 3.2; placeholder in `store/LISTING.md` §1, §7.4, §9) — `OWNER INPUT REQUIRED`, see §8.

## 6. Quality Guidelines

- [ ] **Functionality works — e2e evidence summary.** `docs/REDTEAM_REPORT.md` (2026-10-08, revised 2026-10-09): runtime verification on **real Chrome 154** via CDP `Extensions.loadUnpacked` (scratch profile); 7 defects found and fixed (R1–R7); mutation proof — disabling the four new guards turns the suite RED (`dupes: ['7']`, `forbiddenHit: ['8','9','surface2']`), restoring them returns GREEN (`ok: True`, `denyCount: 0`, `n7count: 1`, `dupes: []`, `forbiddenHit: []`, `surface2Hit: False`). Re-run command: `node test/e2e.mjs` (exit 0 = pass). *This pass did not re-execute the e2e suite (light-process constraint) — it cites the report; re-run before submit per `store/PUBLISH_RUNBOOK.md` open items.*
- [ ] **Honest framing — auto-approval is user-intent automation, not a bypass.** The user installs the extension deliberately; the popup on/off toggle stops it at any time (`popup.js` line 58 writes `enabled` to storage; `content.js` line 220: `if (!state.enabled) return`). The listing never claims to bypass any security control (`store/PUBLISH_RUNBOOK.md` §6: "It only clicks Muse's own 'Allow' button on the user's behalf, and it never clicks Deny/Reject/Decline").
- [ ] **Safety rails are documented and verifiable in code.** `content.js`: never clicks Deny/Reject/Decline (`DENY_RE` line 33; allow clicks only on `ALLOW_RE` line 32); never clicks a lone Allow without a Deny pair (path B requires exactly one allow button in a deny-holding ancestor, line 143; path A requires a deny button in the card, line 122); never clicks inside `<a>` (line 64, applied in all paths); consent-only pairs (notifications/newsletter/subscribe/cookies/marketing) skipped (lines 40–41, 116); 5s fingerprint dedup on allow clicks (line 45, 104); auxiliary clicks rate-capped at 30/min (line 46); liveness guard stops clicking when the extension context is invalidated (lines 211, 219).
- [ ] **No deceptive behavior.** Description matches code (four detection paths documented in `content.js` header lines 4–12 match `findMarkedAllow`/`findPairAllow`/`findCollapsedPending`/`findSurfaceButton`); no hidden functionality (grep §3: no remote code, no network); permissions minimal (§2).
- [ ] **Reviewer-facing "Notes for the reviewer" text is ready.** `store/LISTING.md` §7.4 — replace the `[PRIVACY POLICY URL — TODO]` placeholder before pasting (`OWNER INPUT REQUIRED`, §8).
- [ ] **Mature content = No** and **Pricing = Free**, **Visibility = Public** (`store/PUBLISH_RUNBOOK.md` Step 3.3).
- [ ] **Muse terms-of-service sanity check before public launch** — open item in `store/PUBLISH_RUNBOOK.md` ("Sanity-check Muse's terms of service around helping a user auto-approve their own agent actions"); `OWNER INPUT REQUIRED`, listed in §8/§11.

## 7. Listing Requirements

- [ ] **Extension icon 128×128 exists.** `extension/icons/icon128.png` verified 128×128 on 2026-10-09 (PNG header check); declared in `extension/manifest.json` → `"icons": { "128": "icons/icon128.png", … }` and included in the zip.
- [ ] **Screenshot 1280×800 exists.** `store/screenshot1.png` verified 1280×800 on 2026-10-09 (PNG header check); referenced in `store/LISTING.md` §8 and `store/PUBLISH_RUNBOOK.md` Step 3.1.
- [ ] **Small promo tile 440×280 exists.** `store/promo440x280.png` verified 440×280 on 2026-10-09 (PNG header check); referenced in `store/LISTING.md` §8.
- [x] **Screenshot content — RESOLVED 2026-10-09.** `store/screenshot1.png` is now a **real runtime capture** (real Chrome + real extension + real popup with a freshly generated click log + the approval-card replica), produced by `scripts/store-shot.mjs` and visually reviewed (popup ON state, counter, clean log contexts, three complete cards, chips, footer — no artifacts). Dimensions 1280×800.
- [ ] **Category: Productivity.** `store/LISTING.md` §3 states the category and rationale ("removes a repetitive approval step … a productivity utility").
- [ ] **Short description ≤132 characters — recounted: 107 characters.** Text from `store/LISTING.md` §1: "Auto-click Allow on Muse (muse.ai) approval requests so your agent keeps running. Local-only, no data sent." Programmatic recount on 2026-10-09 = **107** (matches the "Verified length: 107" note in `store/LISTING.md` §1; limit 132).
- [ ] **Detailed description provided in all 6 locales.** `store/LISTING.md` §2 has EN, vi, zh_CN, ja, ko, es; `extension/_locales/` contains exactly those 6 locale directories; manifest `"default_locale": "en"` (`extension/manifest.json` line 6).
- [ ] **Marquee promo tile (1400×560) is optional and not required.** `store/LISTING.md` §8 marks it "optional, not required".
- [ ] **Upload steps followed.** Dashboard → Store listing → Graphic assets → upload icon, 1280×800 screenshot, 440×280 tile (`store/LISTING.md` §8).

## 8. Owner Input Required — fill before clicking Submit

- [ ] **OWNER INPUT REQUIRED — publisher display name.** `store/LISTING.md` §1/§9: "BlueSkyz Labs `TODO: fill before submit` (exact legal/display name)"; `store/PUBLISH_RUNBOOK.md` Step 1.6: confirm the exact publisher name in the dashboard ("appears on the public listing and is hard to change casually").
- [ ] **OWNER INPUT REQUIRED — support email.** `store/LISTING.md` §1/§9 (`TODO: fill before submit`); also `store/PRIVACY.md` §7.
- [ ] **OWNER INPUT REQUIRED — support / homepage URL.** `store/LISTING.md` §9 (`TODO: fill before submit`); also `store/PRIVACY.md` §7.
- [ ] **OWNER INPUT REQUIRED — privacy policy URL.** Host `store/PRIVACY.md` publicly, paste the link into the dashboard and into the §7.4 review note (`store/LISTING.md` §1, §7.4, §9; `store/PUBLISH_RUNBOOK.md` Step 3.2). Verify the link loads before submitting (`store/PUBLISH_RUNBOOK.md` §6, "Missing or dead privacy policy link").
- [ ] **OWNER INPUT REQUIRED — effective date + last updated in the privacy policy.** `store/PRIVACY.md` lines 3–4: `**Effective date:** TODO: fill before submit` / `**Last updated:** TODO: fill before submit`.
- [ ] **OWNER INPUT REQUIRED — developer account registration (one-time, manual).** Pay the US$5 fee and complete identity verification (`store/PUBLISH_RUNBOOK.md` Step 1 — the only step that cannot be done from the repo).
- [ ] **OWNER INPUT REQUIRED — replace every `TODO: fill before submit` marker** in `store/LISTING.md` and `store/PRIVACY.md` (`store/PUBLISH_RUNBOOK.md` "Open items before submit").
- [ ] **OWNER INPUT REQUIRED — Muse ToS sanity check** (`store/PUBLISH_RUNBOOK.md` open items, last section).

## 9. Reviewer Test Instructions (paste into "Notes for the reviewer")

- [ ] **Draft reviewer instructions ready (honest, concise):**
  1. Install Muse Auto-Allow in Chrome and sign in to `https://muse.ai` in a normal tab.
  2. Use Muse until an approval request appears — one of the four surfaces: a marked approval card, a paired Allow/Deny card, a collapsed "Allow Muse to perform this action…" card, or the background "N tasks need your approval" banner.
  3. Expected behavior: the extension clicks **Allow** (default pacing `minDelayMs` = 300ms, `content.js` line 48; 1s heartbeat line 277). It **never** clicks Deny/Reject/Decline and never clicks a lone "Allow" that is not part of an approval pair.
  4. Open the toolbar popup: on/off toggle, adjustable delay (0–10000 ms, `popup.js` lines 59–63), click counter, and the click log (`popup.js` lines 22–32). Toggle off → clicking stops immediately (`content.js` line 220).
  5. The extension requests no account, transmits no data, and makes no network calls (see §3–§4 above). It runs only on muse.ai pages.
- [ ] **UNCERTAIN — reviewer's ability to trigger a real approval card.** A store reviewer needs a muse.ai account and enough Muse functionality to surface an approval request; whether a reviewer account can produce one without specific entitlements is not verified (`UNCERTAIN`, §11). Consider attaching a short screen recording or the `docs/REDTEAM_REPORT.md` e2e evidence summary if the reviewer asks for proof of behavior.
- [ ] **Paste the §7.4 review note from `store/LISTING.md`** (with the privacy URL filled in) into the dashboard's "Notes for the reviewer" field (`store/PUBLISH_RUNBOOK.md` Step 3.2).

## 10. Version & Update Process

- [ ] **Current version is consistent everywhere.** `extension/manifest.json` `"version": "1.2.0"` = `store/LISTING.md` §1 "Version 1.2.0" = `dist/muse-auto-allow-v1.2.0.zip`.
- [ ] **Update flow documented: bump → build → upload → resubmit.** `store/PUBLISH_RUNBOOK.md` Step 5: (1) make the change in `extension/`; (2) bump the version in `extension/manifest.json` (Chrome rejects a re-upload with a version not higher than the published one); (3) run `node scripts/build.mjs` → output `dist/muse-auto-allow-v<version>.zip`; (4) dashboard → Package → Upload new package; (5) keep listing text accurate if behavior changed; (6) resubmit for review.
- [ ] **Build script validates the package.** `scripts/build.mjs` (lines 26–35) verifies the zip and exits with code 2 if `manifest.json` is not at the zip root; it packages exactly `manifest.json, content.js, background.js, popup.html, popup.js, icons, _locales` (line 16).
- [ ] **Keep `CHANGELOG.md` updated** on each shipped version (`store/PUBLISH_RUNBOOK.md` Step 5.7; current 1.2.0 entry in `CHANGELOG.md`).

## 11. Open Notes / UNCERTAIN Items

- [x] **RESOLVED — popup renders up to 50 log entries** (was 12; `popup.js` `log.slice(0, 50)`); the listing wording "last 50 clicks" is now accurate as written.
- [x] **RESOLVED — screenshot is a real runtime capture** (`scripts/store-shot.mjs`, 2026-10-09) and was visually reviewed before ship.
- [x] **RESOLVED — PRIVACY/LISTING now enumerate the click counter and log timestamps** (independent verification findings M3/M4, `store/PACKET_VERIFICATION.md`).
- [ ] **UNCERTAIN — reviewer testability of the real Muse approval flow** (see §9): account/entitlement requirements not verified from the repo.
- [ ] **UNCERTAIN — Muse ToS reading** (see §6/§8): open item in `store/PUBLISH_RUNBOOK.md`; owner decision before public launch.
- [ ] **Accepted residual risks remain documented, not hidden.** `docs/REDTEAM_REPORT.md` R8–R11 (extension fingerprinting cosmetic; `*.muse.ai` wildcard needed for app frames; local click log may contain approval text — disclosed in `store/PRIVACY.md`; auto-allow grants queued approvals if the account is compromised — mitigated by the popup toggle + log). Keep these accepted-risk notes with the submission record.
- [ ] **Pre-submit final pass:** re-run `node test/e2e.mjs` (exit 0 = pass), re-run `node scripts/build.mjs`, confirm every `TODO` is replaced, confirm the privacy policy URL loads, then submit (`store/PUBLISH_RUNBOOK.md` open items; Step 4).

---

## Appendix — Verification log (commands run for this checklist, 2026-10-09)

| Check | Command / method | Result |
|---|---|---|
| Remote code grep | `grep -rnE "eval\(|new Function|fetch\(|XMLHttpRequest|insertAdjacentHTML|document\.write|import\(|\.src\s*=|createElement\(['\"]script" extension/ --include="*.js" --include="*.html"` | 0 matches (exit 1) |
| URL strings in code | `grep -rnE "https?://" extension/` (excl. `_locales`) | 1 hit: `background.js:15` match pattern only |
| Image dimensions | PNG IHDR header parse (Python) | screenshot1.png 1280×800; promo440x280.png 440×280; icon128.png 128×128 |
| Short description length | Python `len()` on the exact §1 string | 107 chars (limit 132) |
| Locales | `ls extension/_locales/` | en, es, ja, ko, vi, zh_CN (6) |
| Zip integrity | Python `zipfile` listing of `dist/muse-auto-allow-v1.2.0.zip` | 16 entries; `manifest.json` at root |
| popup.html scripts | `grep -n "<script" extension/popup.html` | 1 hit: bundled `popup.js` only |

*This checklist is documentation-only; it was not executed against a live Chrome Web Store dashboard. E2e results are cited from `docs/REDTEAM_REPORT.md` (not re-run in this pass, per light-process constraint).*
