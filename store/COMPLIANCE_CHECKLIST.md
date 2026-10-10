# Chrome Web Store Pre-Submission Compliance Checklist — Muse Auto-Allow

**Prepared:** 2026-10-09 · **Item version:** 1.2.0 (`extension/manifest.json` → `"version": "1.2.0"`) · **Package:** `dist/muse-auto-allow-v1.2.0.zip` *(v1.2.0 baseline — superseded; current version references are in the v1.9.0 current-state note below and in §10.)*
**Scope:** Independent pre-submission review for the Chrome Web Store dashboard. Every checkbox cites the exact file and value it was verified against on 2026-10-09. Items marked `UNCERTAIN` or `OWNER INPUT REQUIRED` must be resolved by the owner before clicking **Submit for review**.

> Provenance: `CHANGELOG.md` (1.2.0 entry) already references this file: "Independent store-compliance checklist added (`store/COMPLIANCE_CHECKLIST.md`)."

**v1.4.0 addendum:** the release packet is now **1.4.0** — `extension/manifest.json` line 4 (`"version": "1.4.0"`), package `dist/muse-auto-allow-v1.4.0.zip`. The addendum below supersedes the version-specific details in this header and in §3/§7/§10 wherever they conflict; §1–§11 remain the v1.2.0 baseline record.

**v1.5.0 addendum:** the release packet is now **1.5.0** — `extension/manifest.json` line 4 (`"version": "1.5.0"`), package `dist/muse-auto-allow-v1.5.0.zip`. The v1.5.0 addendum below supersedes version-specific details in the v1.4.0 addendum and in §1–§11 wherever they conflict; the v1.4.0 addendum remains as history.

**v1.8.0 addendum (frozen 2026-10-10, HEAD `91b1726`):** the v1.8.0 packet fixed the version at **`1.8.0`** — `extension/manifest.json` `"version": "1.8.0"`, the shipped package `dist/muse-auto-allow-v1.8.0.zip` (162,471 bytes, 18 entries, sha256 `0300d2fa42fa2ea2235669b02dfeaba8a6ee6a06227091ad249f506c4228c53b`), git tag **v1.8.0** at `91b1726` (remote `main`). Kept as history.

**v1.9.0 current state (frozen 2026-10-10, HEAD `fcbdd63`):** the release freeze has happened — `extension/manifest.json` `"version"` reads **`1.9.0`**, the shipped package is **`dist/muse-auto-allow-v1.9.0.zip`** (177,387 bytes, 18 entries, sha256 `d1929416a88a550505c68120542dcd1830a1142f5d96bfe2a5aa195ff531718d`), git tag **v1.9.0** points at the freeze commit `fcbdd63` (remote `main`), and `CHANGELOG.md` carries the 1.9.0 entry. The package has **not** been uploaded to the Chrome Web Store (no CWS review, no store publish). Current manifest: `permissions: ["storage", "alarms", "notifications"]` (line 8), `host_permissions` muse.ai only (line 9), and a `commands` block (line 34: `toggle-pause` Alt+Shift+P, `send-followup` Alt+Shift+F) — `commands` is a manifest key, **not** a permission. i18n is **169 keys × 6 locales**. The refreshed §1–§11, §6 feature surface and appendix below supersede every v1.8.0-era statement that no longer matches the code; the earlier addenda stay as history.

---

## v1.4.0 Addendum (2026-10-09)

Checked against the v1.4.0 revision (commit `8c76d2a`, 2026-10-09; manifest 1.4.0; package `dist/muse-auto-allow-v1.4.0.zip`). Every item cites the file and line it was verified against; items marked `UNCERTAIN` must be resolved by the owner before **Submit for review**.

### A. Redesign vs store policy — no trademark copying, original mark

- [ ] **No Muse/Meta trademark is copied in the redesign.** `docs/BRANDING.md` lines 3–5: "Everything here is original to BlueSkyz Labs; the visual language is *compatible with* Muse's design system without copying any Muse/Meta trademark (logo, squiggle mark, wordmark or product imagery)." Rule restated at line 85 ("Never substitute Muse/Meta trademarks for our mark; style compatibility only").
- [ ] **The mark is original — a white check on a gradient tile, deliberately not Muse's squiggle.** `docs/BRANDING.md` lines 28–29 ("a white **check** on a rounded-square tile … deliberately does **not** reproduce Muse's squiggle \"m\""); geometry at lines 30–34 (tile radius 26% = 133/512; gradient diagonal 72,60 → 452,464; check stroke 76/512). Shipped in-product: `extension/popup.html` lines 77–84 and `extension/stats.html` line 52 (`rect … rx="133"` + check path `M124 284 L214 374 L368 182`); icons re-rendered from `assets/icon.html` / `assets/icon-small.html` by `scripts/render.mjs` lines 102–106.
- [ ] **The adopted "Muse language" is style tokens, not IP.** `docs/BRANDING.md` lines 15–24 (tokens captured from the live site as computed styles) and lines 40–51 (light/dark token table); implemented in `extension/popup.html` lines 6–12 and `extension/stats.html` lines 7–13. `CHANGELOG.md` line 5 (1.4.0) states the mark uses a "Muse-compatible palette, deliberately not Muse's trademarked squiggle".
- [ ] **Screenshots show real behavior; no mockups implying extra capability.** Real-capture pipeline: `scripts/store-shot.mjs` lines 3–11 ("captures the real extension at runtime … Unlike the old designed mock"), output `store/screenshot1.png` (line 24); `scripts/stats-shot.mjs` lines 3–7, 171–172, 197–198; designed overview/promo only via `scripts/render.mjs` lines 107–110. Caption copy stays within product behavior ("Allow only — never Deny", `scripts/store-shot.mjs` line 283).

### B. Neutral demo data policy for store assets

- [ ] **Policy stated.** `docs/BRANDING.md` lines 75–77: "All demo data in public assets is **fictional** (`Example Org`, `demo-project`, `sample-app`, `web-starter`, `notes-app`, `files.example.com`). Never use real projects, real repositories or personal data in store assets." `CHANGELOG.md` line 6 (1.4.0): "no real projects anywhere in public assets."
- [ ] **Policy enforced in the render seeds.** `scripts/stats-shot.mjs` lines 44–51 (`byTopic` = exactly those five fictional names) and lines 54–64 (fictional org/repos only); `scripts/store-shot.mjs` line 219 (seed `byTopic: { 'demo-project': 8, 'sample-app': 4 }`; showcase cards lines 191–199 carry no org names); `assets/store-screenshot.html` lines 92, 107–108 ("Example Org/demo-project").

### C. Store images for v1.4.0 (dimensions verified from PNG headers, 2026-10-09)

| File | Size | Produced by | Evidence |
|---|---|---|---|
| `store/screenshot1.png` | 1280×800 | real runtime capture (live popup + live card clicks, light stage) | `scripts/store-shot.mjs` lines 3–11, 24; `CHANGELOG.md` line 7 |
| `store/screenshot2-stats.png` | 1280×800 | real render — Statistics page | `scripts/stats-shot.mjs` lines 5–6, 166–167, 171–172 |
| `store/screenshot3-popup.png` | 680×1964 | real render — popup (portrait; height is content-dependent) | `scripts/stats-shot.mjs` lines 7, 184, 192–198 |
| `store/screenshot4-overview.png` | 1280×800 | designed overview (`assets/store-screenshot.html`) | `scripts/render.mjs` lines 107–109 |
| `store/promo440x280.png` | 440×280 | designed promo tile (`assets/promo-tile.html`) | `scripts/render.mjs` line 110 |

- [x] **RESOLVED at v1.5.0 — the v1.4.0 `UNCERTAIN` flag on `store/screenshot3-popup.png` is closed.** The file was 680×1964 (portrait) and matched neither the CWS screenshot spec (1280×800 / 640×400) nor the packet's own §8 requirement (`store/LISTING.md` line 379). Commit `311f006` recomposed it as a **1280×800** stage shot — the real popup centered on a light stage (`scripts/stats-shot.mjs` lines 7, 188–215; PNG header re-verified 1280×800, 2026-10-09). See the v1.5.0 addendum §E for the corrected image list.
- [ ] **At least one compliant screenshot exists.** `screenshot1.png` (1280×800) satisfies the mandatory screenshot; `screenshot2-stats.png` and `screenshot4-overview.png` are also 1280×800.

### D. i18n — 31 keys × 6 locales

- [ ] **All six locale files carry the identical 31-key set (Python JSON parse, 2026-10-09).** `extension/_locales/{en,es,ja,ko,vi,zh_CN}/messages.json`; key sets compared pairwise — no missing/extra keys. Newest key `museTabsFoundOne` (singular chip copy) at `extension/_locales/en/messages.json` lines 92–94, consumed at `extension/popup.js` line 70. `CHANGELOG.md` line 8: "singular/plural chip copy … across 6 locales (31 keys each)". Manifest `"default_locale": "en"` (`extension/manifest.json` line 7).

### E. muse.ai-only interaction guarantees (unchanged)

- [ ] **Manifest scope is muse.ai-only.** `extension/manifest.json` line 9 (`host_permissions`) and line 13 (`content_scripts[0].matches`) contain exactly `https://muse.ai/*` + `https://*.muse.ai/*`; grep on the shipped manifest for `localhost`/`127.0.0.1`: 0 hits (the temp-copy exception for captures is documented at `scripts/store-shot.mjs` line 28).
- [ ] **Defense-in-depth hostname guard in the content script.** `extension/content.js` lines 31–34 — the script returns unless the hostname is muse.ai; the `localhost`/`127.0.0.1` branch exists solely for the test-harness copy (comment line 32).
- [ ] **Service worker only touches muse.ai URLs.** `extension/background.js` lines 6 (URL regex), 24 (tab-query filter), 31 (onUpdated sweep).
- [ ] **Live status is surfaced to the user.** Popup chip "N muse.ai tabs open / No muse.ai tab found" (`extension/popup.js` lines 63–76; `extension/popup.html` line 92); "Works only on muse.ai" (`extension/popup.html` line 94; `extension/stats.html` line 77).
- [ ] **Safety rails unchanged** (never Deny / never lone Allow / rate caps / liveness guard): `extension/content.js` lines 36–37 (regexes), 79 (never inside `<a>` or tied to a `<form>`), 145–149 and 336 (allow rate cap), 315–320 (liveness guard). Behavior identical to the baseline §6 review.
- [ ] **No broad permissions / no remote code — re-checked 2026-10-09.** Manifest requests only `storage`, `alarms`, and the muse.ai hosts (`extension/manifest.json` lines 8–9); grep for `tabs`/`scripting`/`webRequest`/`cookies`/`downloads`/`<all_urls>`: 0 hits. Remote-code grep over `extension/` (`eval(`, `new Function`, `fetch(`, `XMLHttpRequest`, `insertAdjacentHTML`, `document.write`, dynamic `import(`, script-element creation): **0 matches**. URL grep: only muse.ai match patterns (`background.js` line 24; `manifest.json` lines 9, 13; `popup.js` line 65). Only bundled script tags (`extension/popup.html` line 96; `extension/stats.html` line 78).

### F. Package and pre-submit for this release

- [ ] **Package `dist/muse-auto-allow-v1.4.0.zip` — 18 entries, manifest at root, byte-clean.** `scripts/verify-zip.py` run 2026-10-09: `18 matched, 0 mismatched, 0 disk-only, 0 zip-only` (exit 0); sha256 `3e22397c59de252b2eb1bf581ce13bda215b31c6831aecf476d3758b6a964061`, 125,067 bytes; the zip byte-matches the committed v1.4.0 revision `8c76d2a` for all 18 entries. `verify-zip.py` compares the zip against the **current working tree**, so any uncommitted edit landing after the build shows as `MISMATCH <file>` until rebuilt — rebuild + re-verify on the final release revision before uploading. Entries: `manifest.json`, `content.js`, `background.js`, `popup.html`, `popup.js`, `stats.html`, `stats.js`, 5 icons, 6 `_locales/*/messages.json`. Build guard: `scripts/build.mjs` lines 16 (item list), 32–43 (full-tree set equality), 47–54 (exit 2/3/4).
- [ ] **Mandatory pre-submit: `node scripts/build.mjs` then `python scripts/verify-zip.py`, both exit 0** (now a required runbook step — `store/PUBLISH_RUNBOOK.md` Step 2).
- [ ] **`FLAG (outside this checklist's write scope)` — `store/LISTING.md` still carries v1.2.0 references** (§1 "Version | 1.2.0" line 16; package line 18; §6 line 320) and its §8 asset table lists only `screenshot1.png` + promo (lines 378–381). Update it so the dashboard copy matches 1.4.0 before submitting.

---

## v1.5.0 Addendum (2026-10-09)

Checked against the v1.5.0 revision (commits `d7084da` + `311f006`, 2026-10-09; manifest 1.5.0; package `dist/muse-auto-allow-v1.5.0.zip`). Every item cites the file and line it was verified against; items marked `UNCERTAIN` must be resolved by the owner before **Submit for review**. File-level checks only — no Chrome run in this pass (popup/e2e behavior is cited from code and `CHANGELOG.md`).

### A. Encrypted at rest — and its documented limitation

- [ ] **The log's approval text is stored AES-GCM-256 encrypted.** `extension/content.js` lines 252–283: a per-install key is generated on first use (`crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, …)`, line 268) and kept as `cryptKeyRaw` in `chrome.storage.local` (line 270); each log entry's context becomes `{ iv, ct }` (`ctx`, lines 279–281), written at line 305 (`entry.ctx = enc; delete entry.context`). The popup decrypts for display (`extension/popup.js` lines 22–44) with graceful fallback strings — `'(encrypted)'` (line 38) / `'(unable to decrypt)'` (line 41) — and never blocks rendering.
- [ ] **The limitation is documented, not hidden.** `CHANGELOG.md` line 5: "documented limitation — protects casual profile inspection, not a full local attacker" (the key lives in the same `chrome.storage.local`, so full profile access defeats the encryption). The same limitation is stated in the code comment (`extension/content.js` lines 253–256). Do not claim more than this in any dashboard copy.
- [ ] **No new data leaves the device.** Encryption is purely local (`crypto.subtle`); no network primitives were added (re-check of the v1.4.0 §E scans: no `fetch(`/`XMLHttpRequest` anywhere in `extension/`).

### B. Backup / restore — data flow (what leaves the machine: nothing)

- [ ] **Export is a local file the user creates; there is no upload path.** `extension/stats.js` lines 159–175: builds `{ app: 'muse-auto-allow', schemaVersion: 2, exportedAt, data }` where `data` = the full `chrome.storage.local` (via `get(null)`, line 165 — includes `cryptKeyRaw` so backups stay readable) and downloads it as `muse-auto-allow-backup-<date>.json` through a local Blob + `a.download` (lines 167–173). Nothing is transmitted; the file only moves if the user moves it.
- [ ] **Import validates the app marker, confirms, then replaces state.** `extension/stats.js` lines 176–192: a file without `app === 'muse-auto-allow'` is rejected with the `importBad` message (line 183); otherwise the user confirms (`importConfirm`, line 184) and `chrome.storage.local.set(j.data)` replaces the stored state (line 185). Buttons/inputs: `extension/stats.html` lines 85–87.
- [ ] **Dashboard answers unchanged.** The export/import feature adds no collection or transmission; `store/LISTING.md` §7 answers (collects nothing / nothing transmitted) remain accurate.

### C. Upgrade-safe data inheritance (schemaVersion 2)

- [ ] **Every flush stamps `schemaVersion: 2`.** `extension/content.js` line 315 — the single serialized storage write per flush (log + counter + aggregates together).
- [ ] **Legacy shapes stay readable — nothing is dropped on upgrade.** Legacy plaintext log entries still render (`extension/popup.js` line 43: `return String((e && e.context) || ''); // legacy plaintext entries stay readable`); counters and aggregates are coerced defensively on read (`extension/content.js` lines 294–298; `extension/stats.js` lines 126–135). `CHANGELOG.md` line 4.
- [ ] **An encryption failure never loses a record** — the entry falls back to plaintext (`extension/content.js` lines 302–306).

### D. i18n — 35 keys × 6 locales

- [ ] **All six locale files carry the identical 35-key set (Python JSON parse, 2026-10-09).** `extension/_locales/{en,es,ja,ko,vi,zh_CN}/messages.json`; key sets compared pairwise — no missing/extra keys. v1.5.0 adds 4 keys — `exportData` (line 95), `importData` (line 98), `importConfirm` (line 101), `importBad` (line 104) in `extension/_locales/en/messages.json`; previous count was 31 (`CHANGELOG.md` line 15, v1.4.0 entry).

### E. Store images — corrected list (all exact-spec; PNG headers re-verified 2026-10-09)

| File | Size | Produced by | Evidence |
|---|---|---|---|
| `store/screenshot1.png` | 1280×800 | real runtime capture (live popup + live card clicks) | `scripts/store-shot.mjs`; regenerated in `311f006` |
| `store/screenshot2-stats.png` | 1280×800 | real render — Statistics page | `scripts/stats-shot.mjs` lines 6, 163 |
| `store/screenshot3-popup.png` | 1280×800 | real render — popup centered on a light stage | `scripts/stats-shot.mjs` lines 7, 188–215; **recomposed at `311f006`** (was 680×1964) |
| `store/screenshot4-overview.png` | 1280×800 | designed overview (`assets/store-screenshot.html`) | `scripts/render.mjs` line 109 |
| `store/promo440x280.png` | 440×280 | designed promo tile (`assets/promo-tile.html`) | `scripts/render.mjs` line 110 |
| `store/marquee1400x560.png` | 1400×560 | designed two-zone marquee (new at v1.5.0) | `scripts/render.mjs` line 111; `assets/marquee.html` |

- [x] **The v1.4.0 `UNCERTAIN` screenshot3 flag is RESOLVED at v1.5.0** (the flag line in the v1.4.0 addendum §C now carries the resolution note). The v1.4.0 §C table is kept as history; the table above supersedes it.
- [ ] **Full asset inventory lives in `store/SHOWCASE.md`** (new at v1.5.0): per-asset size + store requirement, regenerate commands and the pre-submit upload list — 4 screenshots + promo + optional marquee.

### F. Package and pre-submit for this release

- [ ] **Package `dist/muse-auto-allow-v1.5.0.zip` — 18 entries, manifest at root, byte-clean.** `python scripts/verify-zip.py` run 2026-10-09 (zip byte-verified against the committed v1.5.0 revision `311f006`): `muse-auto-allow-v1.5.0.zip: 18 matched, 0 mismatched, 0 disk-only, 0 zip-only` (exit 0); archive bytes are rebuild-dependent (embedded timestamps) — at the last build during this check: sha256 `386f156bd301511ff8a32f7b57721a3d9687c186617ceeb0e93ea199babf5d29`, 97,217 bytes. Same caveat as before: `verify-zip.py` compares the zip against the **current working tree** — rebuild + re-verify on the final release revision before uploading.
- [ ] **The v1.4.0 `FLAG` on `store/LISTING.md` is resolved** — LISTING.md now carries v1.5.0 version/package refs (lines 16, 18, 320), the full asset table (lines 379–381: 4 screenshots 1280×800, promo 440×280, marquee 1400×560) and a `store/SHOWCASE.md` pointer (line 385).
- [ ] **Mandatory pre-submit: `node scripts/build.mjs` then `python scripts/verify-zip.py`, both exit 0** (unchanged from v1.4.0; `store/PUBLISH_RUNBOOK.md` Step 2).

---

## 1. Single Purpose

- [ ] **Single purpose is stated and matches actual behavior.** Statement (from `store/LISTING.md` §4): "Muse Auto-Allow automatically clicks the **Allow** button on approval requests displayed by Muse (muse.ai) in the user's own browser, so the user's Muse agent runs without stopping for manual approvals." — matches `extension/content.js` header comment ("Automatically clicks \"Allow\" on Muse (muse.ai) approval requests") and all five click paths in `content.js` (A/B allow pairs, C expand, D open-panel, E chat-level review bar).
- [ ] **Nothing outside the single purpose is performed.** The extension acts only on `https://muse.ai/*` and `https://*.muse.ai/*` (`extension/manifest.json` → `host_permissions` and `content_scripts[0].matches`); it does not browse the web, collect content, or interact with other sites (`store/LISTING.md` §4; `store/PRIVACY.md` §2).
- [ ] **The single-purpose statement is what will be pasted into the dashboard.** Dashboard → Privacy practices → Single purpose: paste `store/LISTING.md` §4 verbatim (`store/PUBLISH_RUNBOOK.md` Step 3.2).

## 2. Permission Justifications (dashboard → Privacy practices)

- [ ] **`storage` — justified and actually used.** Manifest declares `"permissions": ["storage", "alarms", "notifications"]` (`extension/manifest.json` line 8). Code use: saves settings, rules and the click log to `chrome.storage.local` — `content.js` line 122 (`DEFAULT = { enabled: true, minDelayMs: 300, clickCount: 0 }`) plus the v1.8 keys `pauseUntil` / `dryRun` / `allowOnceMode` / `rules` / `followupSmart` / `followupSchedule` / `syncSettings` (lines 140–144; `docs/ENGINE_V18.md` §1), the last-50 log, and the compact statistics counters; read/write in `popup.js` and `stats.js`. Justification text ready in `store/LISTING.md` §5 and `store/PRIVACY.md` §5 (settings, rules, follow-up options, local last-50 click log, compact statistics — plus the optional, off-by-default settings sync).
- [ ] **`alarms` — justified and actually used.** `extension/background.js` lines 40–41 create `chrome.alarms.create('muse-sweep', { periodInMinutes: 1 })`; the alarm handler sweeps open muse.ai tabs so background-tab approvals are processed, and v1.8 adds a one-shot `maa-pause-expiry` alarm that flips the badge back when a pause expires (`docs/ENGINE_V18.md` §3.1). Justification text ready in `store/LISTING.md` §5 ("Schedules a once-a-minute nudge … makes no network requests") and `store/PRIVACY.md` §5.
- [ ] **`notifications` — justified and actually used (new at v1.8).** Declared at `extension/manifest.json` line 8; `extension/background.js` §5.3 shows **one** locally-composed `chrome.notifications` desktop digest on `chrome.runtime.onStartup`, only when `clicks > 0` (text hardcoded English by contract). Justification text ready in `store/LISTING.md` §5 and `store/PRIVACY.md` §5 ("Show the local activity digest as a desktop notification on browser startup. The digest is generated on your device; no data leaves it").
- [ ] **`commands` — a manifest key, NOT a permission (new at v1.8).** `extension/manifest.json` line 34 declares two keyboard shortcuts: `toggle-pause` (Alt+Shift+P) and `send-followup` (Alt+Shift+F). There is no dashboard justification field for it and it grants no extra access; it is recorded here so the checklist matches the manifest exactly.
- [ ] **Host permission `https://muse.ai/*` + `https://*.muse.ai/*` — justified and actually used.** Manifest declares exactly these two host patterns (`extension/manifest.json` line 9); the content script detects and clicks the Allow button on the page (`content.js` paths A–E) and `background.js` queries only these URL patterns (`chrome.tabs.query({ url: ['https://muse.ai/*', 'https://*.muse.ai/*'] })`). Justification text ready in `store/LISTING.md` §5 (host permission rather than `activeTab` because approvals can appear in background tabs).
- [ ] **No broad or unused permissions.** Manifest requests only `storage`, `alarms`, `notifications`, and the muse.ai host patterns — no `tabs`, `scripting`, `webRequest`, `cookies`, `downloads`, `<all_urls>`, `web_accessible_resources`, or `externally_connectable` (`extension/manifest.json`; confirmed by `docs/REDTEAM_REPORT.md` R15). Note: `background.js` uses the `chrome.tabs.query` **API** with muse.ai URL filters, which is covered by the host permission; the `"tabs"` **permission** is genuinely not needed and not declared. `scripts/lint.mjs` fails on any permission outside the `storage`/`alarms`/`notifications` allowlist, so the packaged manifest cannot silently drift from these answers.
- [ ] **Paste one justification per permission into the dashboard** per `store/PUBLISH_RUNBOOK.md` Step 3.2 (text source: `store/LISTING.md` §5).

## 3. Remote Code

- [ ] **No remote code — verified by grep on 2026-10-09.** Command run: `grep -rnE "eval\(|new Function|fetch\(|XMLHttpRequest|insertAdjacentHTML|document\.write|import\(|\.src\s*=|createElement\(['\"]script" extension/ --include="*.js" --include="*.html"` → **0 matches (grep exit code 1)**.
- [ ] **No network calls.** A second grep, `grep -rnE "https?://" extension/` (excluding `_locales`), returns a single hit: `extension/background.js` line 15 — a `chrome.tabs.query` URL **match pattern**, not a network request. The extension makes zero outbound calls (`store/PRIVACY.md` §3: "there are no servers").
- [ ] **Only bundled scripts are loaded.** `extension/popup.html` line 573 and `extension/stats.html` line 193 carry the only script tags (`<script src="popup.js">` / `<script src="stats.js">`) — files shipped inside the package. No external `<script src>`, no CDN, no update endpoint (`store/LISTING.md` §6).
- [ ] **Dashboard answer: "No, I am not using remote code"** (`store/PUBLISH_RUNBOOK.md` Step 3.2; declaration text in `store/LISTING.md` §6). Manifest V3 with an explicit `extension_pages` CSP (`script-src 'self'; object-src 'self'`, `extension/manifest.json` line 11) — a hardening CSP, not a relaxation.
- [ ] **Shipped zip contains only static files.** `dist/muse-auto-allow-v1.9.0.zip` (current package): 18 entries, `manifest.json` at the zip root, contents = `manifest.json`, `content.js`, `background.js`, `popup.html`, `popup.js`, `stats.html`, `stats.js`, 5 icons, 6 `_locales/*/messages.json` (`scripts/build.mjs` fails with exit code 2 if `manifest.json` is not at the root).

## 4. Data Usage Disclosures (dashboard → Privacy practices)

- [ ] **Local-only storage — nothing transmitted (the one optional exception is the off-by-default settings sync, disclosed in `store/PRIVACY.md` §2 and `store/CWS_SUBMISSION_PACK.md` §3.2a).** All persistence is `chrome.storage.local` (`content.js`, `popup.js`, `stats.js`). `store/PRIVACY.md` §2–3: "This information never leaves your device"; "The extension makes no outbound network calls."
- [ ] **Click log contents are disclosed accurately.** Each entry = kind (`allow` / `expand` / `open-panel` / `review-bar`, the v1.8 `blocked` and `followup` kinds, and the `-dry` variants), button label, and context text of up to **240 characters** (card text with button labels excluded), stored **capped at 50 entries** (`log.slice(0, 50)`). `blocked`, `-dry` and `followup*` entries never increment `clickCount`/`stats` aggregates (`docs/ENGINE_V18.md` §6). Residual risk R10 in `docs/REDTEAM_REPORT.md` documents that this may contain approval text (e.g. repo names) — already disclosed in `store/PRIVACY.md` §2 ("the last 50 clicks … kind, button label, and context") and §4 (retention/deletion: remove the extension to delete all data).
- [ ] **No analytics / no tracking / no advertising.** No analytics SDK exists in the package (grep in §3 shows no network primitives); `store/PRIVACY.md` §1 and §3 state "no analytics, no tracking, and no advertising" and "no sale/rent/share".
- [ ] **Data-collection answers ready for the dashboard form.** `store/LISTING.md` §7.1–7.2: collects or uses user data → **No**; all listed data types → **None**; data transmitted off device → **No**.
- [x] **Popup renders the full log — RESOLVED 2026-10-09.** The popup now renders up to **50** entries (`popup.js` line 24: `log.slice(0, 50)`, inside the scrollable area `popup.html` line 33: `max-height: 220px; overflow: auto`) — matches `store/LISTING.md` §2 "a log of the last 50 clicks" as written.

## 5. User-Data Policy Answers (certifications in the dashboard)

- [ ] **"I do not sell or transfer user data to third parties…" — check.** No data leaves the device; nothing is collected (`store/LISTING.md` §7.3; `store/PRIVACY.md` §3).
- [ ] **"I do not use or transfer user data for purposes that are unrelated to my item's single purpose" — check.** The only data handled is the local settings, rules and click log that implement the single purpose (`content.js` `DEFAULT` line 122 plus the v1.8 keys at lines 140–144).
- [ ] **"I do not use or transfer user data to determine creditworthiness or for lending purposes" — check.** (`store/LISTING.md` §7.3.)
- [ ] **Limited-use statement consistent across listing, privacy policy, and code.** `store/LISTING.md` §7.2–7.3, `store/PRIVACY.md` §3 ("does not use data for advertising, profiling, creditworthiness, or lending"), and code (grep §3) all agree.
- [ ] **Privacy policy URL will be live before submit.** Host `store/PRIVACY.md` publicly and paste the URL into the dashboard (`store/PUBLISH_RUNBOOK.md` Step 3.2; placeholder in `store/LISTING.md` §1, §7.4, §9) — `OWNER INPUT REQUIRED`, see §8.

## 6. Quality Guidelines

- [ ] **Functionality works — e2e evidence summary.** `docs/REDTEAM_REPORT.md` (2026-10-08, revised 2026-10-09): runtime verification on **real Chrome 154** via CDP `Extensions.loadUnpacked` (scratch profile); 7 defects found and fixed (R1–R7); mutation proof — disabling the four new guards turns the suite RED (`dupes: ['7']`, `forbiddenHit: ['8','9','surface2']`), restoring them returns GREEN (`ok: True`, `denyCount: 0`, `n7count: 1`, `dupes: []`, `forbiddenHit: []`, `surface2Hit: False`). Re-run command: `node test/e2e.mjs` (exit 0 = pass). *This pass did not re-execute the e2e suite (light-process constraint) — it cites the report; re-run before submit per `store/PUBLISH_RUNBOOK.md` open items.*
- [ ] **Current feature surface (v1.6 → v1.9).** v1.6: auto follow-up (idle detection, preset/custom prompts, cooldowns, 6/hour cap), detection path E (chat-level review bar), premium Statistics, i18n 47 keys, explicit `extension_pages` CSP + `minimum_chrome_version` 116. v1.7: follow-up phrase library (8 groups) + combo builder + round-robin rotation, premium popup/Statistics pass, safety rails extended (approval-card wording variants; standing grants deliberately not auto-clicked), deterministic zip + SHA256 sidecar + CI. v1.8: **pause** (15 min / 1 hour / Tomorrow, Alt+Shift+P), **dry-run**, **allow-once** mode, **topic whitelist + block-keyword rules**, **stuck/error recovery** follow-ups, **follow-up schedule window**, **optional settings-sync mirror**, **startup digest notification**, **3-step onboarding**, **connector/credential hard-block**, 147 i18n keys × 6 locales (v1.8 added 62). v1.9: the **Mission Orchestrator** — a stateful, ordered sequence of follow-up prompts run inside one Muse session, with 4 shipped missions (the **GOLIVE READY — Project Orchestrator** ladder: CONTRACT → AUDIT → EXECUTE → CONTINUE → RELEASE GATE → CONVERGE, plus **AUDIT ONLY**, **FIX FINDINGS** and **RELEASE PREP**); a step advances **only on a verified send** (a blocked, refused, paused or dry-run attempt never advances and never logs), an active mission takes precedence over the rotating phrase prompts, and hard caps (12 steps lifetime / 3 cycles) end a mission with a silent stop and exactly one log line; the popup gains a compact **Missions pill** opening a full-popup sheet (enable toggle, the 4 missions, live `step n/N · cycle c` progress, **Send step now**, **Pause mission** reusing the same `pauseUntil`, last completion) and a new `mission` log kind; **measured performance** (adaptive observer debounce, a single-query gate that short-circuits candidate-less pages, and one storage write per action instead of two — measured by `scripts/bench/perf.mjs`: detect→click 121.5 → 2.5 ms, scan per sweep −55%, proven non-weakening by the unchanged dedup invariants + a reverse-mutation falsification); **progressive disclosure** of the rarely-touched follow-up settings (popup calm state 571 → 515 px); the store-asset clip fix (the 1280×800 screenshot no longer clips the popup header); and a deterministic design-criteria gate replacing vision-model scoring. i18n is now **169 keys × 6 locales**. Sources: `CHANGELOG.md` (1.6.0 / 1.7.0 / 1.8.0 / 1.9.0), `docs/ENGINE_V18.md`, `docs/UI_V18.md`, `docs/MISSION_V19.md`, `docs/UI_V19.md`, `docs/ELITE_BENCHMARK_REPORT.md`.
- [ ] **Honest framing — auto-approval is user-intent automation, not a bypass.** The user installs the extension deliberately; the popup on/off toggle stops it at any time (`popup.js` line 58 writes `enabled` to storage; `content.js` line 220: `if (!state.enabled) return`). The listing never claims to bypass any security control (`store/PUBLISH_RUNBOOK.md` §6: "It only clicks Muse's own 'Allow' button on the user's behalf, and it never clicks Deny/Reject/Decline").
- [ ] **Safety rails are documented and verifiable in code.** `content.js`: never clicks Deny/Reject/Decline (`DENY_RE` line 89; allow clicks only on `ALLOW_RE` line 77); never clicks a lone Allow without a Deny pair; never clicks inside `<a>`; consent-only pairs (notifications/newsletter/subscribe/cookies/marketing) skipped; 5s fingerprint dedup on allow clicks; auxiliary clicks rate-capped at 30/min; liveness guard stops clicking when the extension context is invalidated. **v1.8 rails (new, fail-closed — `docs/ENGINE_V18.md` §2/§3):** at most **one** allow click per card/pair scope (no silent escalation to a standing grant); standing grants (`Always allow` / `Allow for this site`) are **never** auto-clicked; connector/credential surfaces (a `Connect` / API-token card) are **hard-blocked on every click path** (`connectorIn()` line 261) and the refusal is logged (`blocked` / `connector`); `allowOnceMode` prefers the narrowest one-shot option; a pause halts every click path and the follow-up engine (`paused()` line 288); the block-keyword list is matched on card text and context (line 304).
- [ ] **No deceptive behavior.** Description matches code (the five click paths documented in the `content.js` header match the shipped detectors: A/B allow pairs, C collapsed-pending expand, D background-surface open, E chat-level review bar); no hidden functionality (grep §3: no remote code, no network); permissions minimal (§2).
- [ ] **Reviewer-facing "Notes for the reviewer" text is ready.** `store/LISTING.md` §7.4 — replace the `[PRIVACY POLICY URL — TODO]` placeholder before pasting (`OWNER INPUT REQUIRED`, §8).
- [ ] **Mature content = No** and **Pricing = Free**, **Visibility = Public** (`store/PUBLISH_RUNBOOK.md` Step 3.3).
- [ ] **Muse terms-of-service sanity check before public launch** — open item in `store/PUBLISH_RUNBOOK.md` ("Sanity-check Muse's terms of service around helping a user auto-approve their own agent actions"); `OWNER INPUT REQUIRED`, listed in §8/§11.

## 7. Listing Requirements

- [ ] **Extension icon 128×128 exists.** `extension/icons/icon128.png` verified 128×128 on 2026-10-09 (PNG header check); declared in `extension/manifest.json` → `"icons": { "128": "icons/icon128.png", … }` and included in the zip.
- [ ] **Screenshot 1280×800 exists.** `store/screenshot1.png` verified 1280×800 on 2026-10-09 (PNG header check); referenced in `store/LISTING.md` §8 and `store/PUBLISH_RUNBOOK.md` Step 3.1.
- [ ] **Small promo tile 440×280 exists.** `store/promo440x280.png` verified 440×280 on 2026-10-09 (PNG header check); referenced in `store/LISTING.md` §8.
- [x] **Screenshot content — RESOLVED 2026-10-09.** `store/screenshot1.png` is now a **real runtime capture** (real Chrome + real extension + real popup with a freshly generated click log + the approval-card replica), produced by `scripts/store-shot.mjs` and visually reviewed (popup ON state, counter, clean log contexts, three complete cards, chips, footer — no artifacts). Dimensions 1280×800.
- [ ] **Category: Productivity.** `store/LISTING.md` §3 states the category and rationale ("removes a repetitive approval step … a productivity utility").
- [ ] **Short description ≤132 characters — recounted 2026-10-10.** Text from `store/LISTING.md` §1: "Auto-click Allow on Muse (muse.ai) approval requests so your agent keeps running. Local-only by default; optional settings sync." Programmatic recount = **128** (matches the "Verified length: 128" note in `store/LISTING.md` §1; limit 132). All five localized short descriptions were recounted in the same pass and are ≤132: **vi 129, zh_CN 58, ja 77, ko 92, es 131** (`store/LISTING.md` §1 table).
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
  2. Use Muse until an approval request appears — one of the approval surfaces: a marked approval card, a paired Allow/Deny card, a collapsed "Allow Muse to perform this action…" card, the background "N tasks need your approval" banner, or the chat-level "A task needs review" bar (v1.6 path E). Connector/credential cards (a Connect / API-token surface) are never touched — they are hard-blocked and logged as blocked.
  3. Expected behavior: the extension clicks **Allow** (default pacing `minDelayMs` = 300ms, `content.js` `DEFAULT` line 122; the v1.8 pause/dry-run steps are in `store/CWS_SUBMISSION_PACK.md` §5.2). It **never** clicks Deny/Reject/Decline, never clicks a lone "Allow" that is not part of an approval pair, and never clicks a standing grant ("Always allow").
  4. Open the toolbar popup: on/off toggle, adjustable delay (0–10000 ms), click counter, click log, the Pause row (15 min / 1 hour / Tomorrow), the Safety & Control panel (dry-run, allow-once, topic/keyword rules, schedule, smart recovery, settings sync) and the "While you were away" digest band. Toggle off → clicking stops immediately (`popup.js`; `docs/UI_V18.md`).
  5. The extension requests no account, transmits no data, and makes no network calls (see §3–§4 above). It runs only on muse.ai pages.
- [ ] **UNCERTAIN — reviewer's ability to trigger a real approval card.** A store reviewer needs a muse.ai account and enough Muse functionality to surface an approval request; whether a reviewer account can produce one without specific entitlements is not verified (`UNCERTAIN`, §11). Consider attaching a short screen recording or the `docs/REDTEAM_REPORT.md` e2e evidence summary if the reviewer asks for proof of behavior.
- [ ] **Paste the §7.4 review note from `store/LISTING.md`** (with the privacy URL filled in) into the dashboard's "Notes for the reviewer" field (`store/PUBLISH_RUNBOOK.md` Step 3.2).

## 10. Version & Update Process

- [ ] **Current version is consistent everywhere.** `extension/manifest.json` `"version": "1.9.0"` = `store/LISTING.md` §1 "Version 1.9.0" = `dist/muse-auto-allow-v1.9.0.zip`. The freeze is committed at HEAD `fcbdd63` (tag `v1.9.0`, remote `main`); the zip is deterministic (double-build byte-identical) and re-verified (`python scripts/verify-zip.py` → 18 matched / 0 mismatched / 0 disk-only / 0 zip-only; `node scripts/smoke-zip.mjs` → exit 0, `ok: true`). Not yet uploaded to the Chrome Web Store.
- [ ] **Update flow documented: bump → build → upload → resubmit.** `store/PUBLISH_RUNBOOK.md` Step 5: (1) make the change in `extension/`; (2) bump the version in `extension/manifest.json` (Chrome rejects a re-upload with a version not higher than the published one); (3) run `node scripts/build.mjs` → output `dist/muse-auto-allow-v<version>.zip`; (4) dashboard → Package → Upload new package; (5) keep listing text accurate if behavior changed; (6) resubmit for review.
- [ ] **Build script validates the package.** `scripts/build.mjs` verifies the zip and exits with code 2 if `manifest.json` is not at the zip root; it packages exactly `manifest.json, content.js, background.js, popup.html, popup.js, stats.html, stats.js, icons, _locales`.
- [ ] **Keep `CHANGELOG.md` updated** on each shipped version (`store/PUBLISH_RUNBOOK.md` Step 5.7; the latest shipped entry in `CHANGELOG.md` is 1.9.0, added with the release freeze).

## 11. Open Notes / UNCERTAIN Items

- [x] **RESOLVED — popup renders up to 50 log entries** (was 12; `popup.js` `log.slice(0, 50)`); the listing wording "last 50 clicks" is now accurate as written.
- [x] **RESOLVED — screenshot is a real runtime capture** (`scripts/store-shot.mjs`, 2026-10-09) and was visually reviewed before ship.
- [x] **RESOLVED — PRIVACY/LISTING now enumerate the click counter and log timestamps** (independent verification findings M3/M4, `store/PACKET_VERIFICATION.md`).
- [ ] **UNCERTAIN — reviewer testability of the real Muse approval flow** (see §9): account/entitlement requirements not verified from the repo.
- [ ] **UNCERTAIN — Muse ToS reading** (see §6/§8): open item in `store/PUBLISH_RUNBOOK.md`; owner decision before public launch.
- [ ] **Accepted residual risks remain documented, not hidden.** `docs/REDTEAM_REPORT.md` R8–R11 (extension fingerprinting cosmetic; `*.muse.ai` wildcard needed for app frames; local click log may contain approval text — disclosed in `store/PRIVACY.md`; auto-allow grants queued approvals if the account is compromised — mitigated by the popup toggle + log). Keep these accepted-risk notes with the submission record.
- [ ] **Pre-submit final pass:** re-run `node scripts/lint.mjs` (exit 0), re-run `node test/e2e.mjs` (exit 0 = pass), re-run `node scripts/build.mjs`, confirm every `TODO` is replaced, confirm the privacy policy URL loads, then submit (`store/PUBLISH_RUNBOOK.md` open items; Step 4).

---

## Appendix — Verification log (commands run for this checklist, 2026-10-09; zip-integrity row re-checked at the v1.9.0 freeze, 2026-10-10)

| Check | Command / method | Result |
|---|---|---|
| Remote code grep | `grep -rnE "eval\(|new Function|fetch\(|XMLHttpRequest|insertAdjacentHTML|document\.write|import\(|\.src\s*=|createElement\(['\"]script" extension/ --include="*.js" --include="*.html"` | 0 matches (exit 1) |
| URL strings in code | `grep -rnE "https?://" extension/` (excl. `_locales`) | 1 hit: `background.js:15` match pattern only |
| Image dimensions | PNG IHDR header parse (Python) | screenshot1.png 1280×800; promo440x280.png 440×280; icon128.png 128×128 |
| Short description length | `len()` on the exact §1 strings (re-run 2026-10-10) | en 128, vi 129, zh_CN 58, ja 77, ko 92, es 131 — all ≤132 |
| Locales | `ls extension/_locales/` | en, es, ja, ko, vi, zh_CN (6) |
| Zip integrity | `zipfile` listing of `dist/muse-auto-allow-v1.9.0.zip` | 18 entries; `manifest.json` at root |
| popup.html scripts | `grep -n "<script" extension/popup.html` | 1 hit: bundled `popup.js` only |

*This checklist is documentation-only; it was not executed against a live Chrome Web Store dashboard. E2e results are cited from `docs/REDTEAM_REPORT.md` (not re-run in this pass, per light-process constraint).*
