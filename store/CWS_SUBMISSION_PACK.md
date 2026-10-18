# CWS Submission Pack — Muse Auto-Allow

Operator execution pack for submitting **Muse Auto-Allow** to the Chrome Web Store
(CWS). Every "Google requires…" claim below cites its official source URL; the full
list is in [§8 Sources](#8-sources-official). Copy-paste values are kept **identical**
to `store/LISTING.md` and `store/PRIVACY.md` — if either file changes, update this
pack in the same commit. Version/package references follow the release freeze: use the
version currently in `extension/manifest.json` and the `dist/` zip built from it.

> **[OWNER]** marks steps that need the owner's Google account, payment, or a human
> decision. Everything else is prepared here.

> **Current freeze: v1.10.0 (2026-10-18).** The copy below was updated where the
> v1.10.0 feature set changed it: §1 single purpose + supporting sentence (now names
> both scopes), §2 host justifications (muse.ai + the opt-in chatgpt.com scope, per
> engine), §3.4 reviewer note (same rewrite as `store/LISTING.md` §7.4), §5 listing
> table note, §6 pitfalls row, §7 checklist. Freeze records that still read `1.9.3`
> are historical addenda kept for traceability; the effectives are in the v1.10.0
> items below.

---

## 0. Preconditions (owner, one-time)

- Register a CWS developer account and pay the **one-time registration fee**. The
  developer email receives all review mail — use one you monitor.
  Source: <https://developer.chrome.com/docs/webstore/register>
- **2-Step Verification is required** for the developer account before publishing or
  updating an extension.
  Source: <https://developer.chrome.com/docs/webstore/program-policies/policies> ("2-Step Verification").
- Fill the remaining owner values: the **support email** (the only
  `TODO: fill before submit` left in `store/LISTING.md`), the publisher legal-name
  confirmation, and the policy dates + contact in `store/PRIVACY.md`. The homepage and
  privacy-policy URLs are filled in `store/LISTING.md`, and the privacy policy is
  **hosted at a public URL** — the dashboard requires a privacy policy link.
  Source: <https://developer.chrome.com/docs/webstore/cws-dashboard-privacy#set-privacy-policy>
- Have the `dist/muse-auto-allow-v<VERSION>.zip` that passed
  `scripts/build.mjs` + `scripts/verify-zip.py` (see §5.1).

---

## 1. Single purpose (dashboard → Privacy practices)

Dashboard field: **"State the extension's purpose" — Single purpose description**.
"Fill out this field to help the reviewers understand the focus of your extension."
The requirement: an extension must have a single purpose that is narrow and easy to
understand (Extension Quality Guidelines, linked from that page).
Source: <https://developer.chrome.com/docs/webstore/cws-dashboard-privacy#state_the_extensions_purpose>

**Paste (verbatim from `store/LISTING.md` §4):**

> Muse Auto-Allow automatically clicks the **Allow** button (and, on chatgpt.com, the
> affirmative option on Codex approval requests) displayed by the user's own agent UI
> in the user's own browser, so the user's agent runs without stopping for manual
> approvals.

Supporting sentence (same source): every part of the extension serves this one
purpose — it does not browse the web for the user, does not modify, collect, or
transmit page content, and does not interact with any site other than muse.ai — and,
while the user has the opt-in Codex (ChatGPT) switch on, chatgpt.com.

---

## 2. Permission justifications (dashboard → Privacy practices)

Dashboard field: **"List and justify any permissions"** — one justification field per
permission declared in the manifest. "Requesting broader permissions than necessary may
cause your extension to be rejected."
Sources: <https://developer.chrome.com/docs/webstore/cws-dashboard-privacy#list_and_justify_any_permissions> ·
<https://developer.chrome.com/docs/webstore/program-policies/permissions> ("Use of
Permissions": request the *narrowest* permissions necessary; no future-proofing).

Verified against `extension/manifest.json` (working tree as of the **v1.10.0 freeze**, 2026-10-18):
`permissions: ["storage", "alarms", "notifications"]`; `commands: { toggle-pause
(Alt+Shift+P), send-followup (Alt+Shift+F) }`; `host_permissions: ["https://muse.ai/*",
"https://*.muse.ai/*", "https://chatgpt.com/*", "https://*.chatgpt.com/*"]`. Nothing else
is declared — exactly what the current feature set
(v1.8 pause, dry-run, rules, smart/scheduled follow-ups, digest, optional settings sync,
onboarding; v1.9 Mission Orchestrator; v1.9.3 first-run logging-only default; v1.10.0
Codex (ChatGPT) engine, opt-in, off by default) requires, and
`scripts/lint.mjs` fails on any added permission.
*(`manifest.version` reads `1.10.0` on the working tree — the release freeze is in
progress; the package is `dist/muse-auto-allow-v1.10.0.zip`. This section matches the
frozen package; it has not been uploaded to the Chrome Web Store — no CWS review, no
store publish.)*

### `storage`

Saves the user's own settings (on/off state, click delay, click counter, pause, rules,
follow-up options, compact click statistics) and the local click log (the last 50
clicks) so the popup and statistics page can show the current state and history. Data
stays in `chrome.storage.local` on the user's device and is never transmitted. Also
backs the optional, off-by-default settings sync — a settings-only mirror through
`chrome.storage.sync` into the user's own Google Account (§3.2a has the full
disclosure); logs and statistics never sync.

### `alarms`

Schedules a once-a-minute nudge so the extension can process approval requests that
appear in background tabs, not only the tab the user is looking at. The alarm only
triggers local detection/clicking on already-open muse.ai pages; it makes no network
requests.

### `notifications`

Shows the local activity digest — a short summary of recent clicks, follow-ups, and
blocked items — as a desktop notification on browser startup, and only when there is
something to report. The digest is composed on the user's device from data already
stored locally (no data is collected, fetched, or transmitted to build it); the
permission is used only to display that notification. The permissions list documents
`notifications` as giving access to the `chrome.notifications` API ("Display
notifications" warning).
Sources: <https://developer.chrome.com/docs/extensions/reference/permissions-list> ·
<https://developer.chrome.com/docs/extensions/reference/api/notifications>

### `commands` (keyboard shortcuts — not a permission)

The manifest declares two keyboard shortcuts: `toggle-pause` (suggested
Alt+Shift+P — pause or resume automation) and `send-followup` (suggested Alt+Shift+F —
send the follow-up prompt to the active muse.ai tab). `commands` is a manifest key, not
a permission: there is no dashboard justification field for it, and it grants no extra
access. It is listed here so this pack matches the manifest exactly.
Source: <https://developer.chrome.com/docs/extensions/reference/api/commands>

### Host permission — `https://muse.ai/*` and `https://*.muse.ai/*`

Required to run the content script that detects and clicks the Allow button, and only
on Muse pages. A host permission (rather than `activeTab`) is necessary because
approvals can appear in background tabs while the user is elsewhere, so the extension
must be able to act without the user actively clicking the toolbar icon. No other site
is requested.

### Host permission — `https://chatgpt.com/*` and `https://*.chatgpt.com/*` (v1.10.0)

Required to run the Codex (ChatGPT) content script that detects and clicks the
affirmative option on Codex approval requests on chatgpt.com — used **only** while the
user has turned on the opt-in Codex switch (off by default; with it off the script
reads settings and does nothing). Same background-tab rationale as the Muse host
permission. No other site is requested.

**Deliberately NOT requested** (state this in the reviewer note): no `tabs`, no
`scripting`, no `webRequest`, no `<all_urls>`, no `cookies`, no `downloads`. The
extension needs none of them.

**Integrity guard:** `scripts/lint.mjs` fails on any manifest permission outside the
`storage`/`alarms`/`notifications` allowlist, any host set other than the pinned
muse.ai + chatgpt.com patterns, or a missing explicit `extension_pages` CSP — so the
packaged manifest can never silently drift from these answers. (Allowlist verified in
the working tree; as of the v1.10.0 freeze the gate also pins the two host sets and
the per-engine `content_scripts` matches — lint exit 0.)

---

## 3. Privacy practices tab — answers

Sources: <https://developer.chrome.com/docs/webstore/cws-dashboard-privacy> (all four
fields below), <https://developer.chrome.com/docs/webstore/program-policies/limited-use>
(Limited Use policy).

### 3.1 Declare remote code

**Answer: "No, I am not using remote code."**

Dashboard: "If your extension doesn't need to execute remote code, make sure that it
does not and select 'No, I am not using remote code.'"
Source: <https://developer.chrome.com/docs/webstore/cws-dashboard-privacy#declare_any_remote_code>

Repo backing (identical claim to `store/PRIVACY.md` §1/§3 and `store/LISTING.md` §6):
all JavaScript ships bundled inside the package (`content.js`, `background.js`,
`popup.js`, `stats.js`); nothing is downloaded, evaluated, or loaded remotely at
runtime — no `eval`, no `new Function`, no external `<script src>`, and no network
requests of any kind; the `scripts/lint.mjs` security scan enforces this (lint must
exit 0 before every build, and CI runs it on every push and PR).

### 3.2 Data usage / data collection

Disclosure: **the extension collects or uses no user data.** No data-type checkboxes
are checked (personally identifiable information, health, financial/payment,
authentication, personal communications, location, web history, user activity,
website content → **none**).

Certification checkboxes (all three, per `store/LISTING.md` §7.3):

- [x] I do not sell or transfer user data to third parties, outside of the approved use
  cases.
- [x] I do not use or transfer user data for purposes that are unrelated to my item's
  single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending
  purposes.

Also answer **No** wherever the form asks about advertising/personalized ads.

Limited Use compliance note: the policy requires that data use be limited to the
disclosed single purpose and that any collected data be handled securely — this
extension collects nothing and sends nothing to the developer, so it complies
trivially. The disclosures here are identical to `store/PRIVACY.md` §1, §2, and §3
(settings, a local last-50 click log, and compact click statistics live in
`chrome.storage.local`; no analytics, tracking, or advertising). The one optional
data-flow surface — the off-by-default settings sync — is disclosed in §3.2a and in
`store/PRIVACY.md` §2.
Sources: <https://developer.chrome.com/docs/webstore/program-policies/limited-use> ·
<https://developer.chrome.com/docs/webstore/cws-dashboard-privacy#certify_your_data_use_practices>

### 3.2a Settings-sync surface (v1.8) — disclose it in the reviewer note

New optional surface, **off by default**: when the user enables **Sync settings**, a
compact settings-only subset (on/off, click delay, dry-run, allow-once, topic/keyword
rules, follow-up options) mirrors through Chrome's built-in `chrome.storage.sync` into
the user's own Google Account, so settings follow their Chrome profile. It never
includes the click log, statistics, counters, digest timestamps, or any page content,
and the developer receives nothing. Chrome enforces the sync quota — 8 KB per item,
~100 KB total, 512 items max — which bounds the subset further. This is the only
surface through which any data can leave the device, and only with explicit user
opt-in.
Sources: <https://developer.chrome.com/docs/extensions/reference/api/storage> (sync
quotas) · <https://developer.chrome.com/docs/webstore/cws-dashboard-privacy>

### 3.3 Privacy policy URL

Paste the public URL where `store/PRIVACY.md` is hosted:
**`https://blueskyz-labs.github.io/muse-auto-allow/privacy.html`** (GitHub Pages; returns
HTTP 200 and its content carries the v1.8+ disclosures — verified live 2026-10-12).
"The policy should include how data is collected, used, and disclosed."
Source: <https://developer.chrome.com/docs/webstore/cws-dashboard-privacy#set-privacy-policy>

### 3.4 Reviewer note (where the form offers notes to reviewers)

```text
Muse Auto-Allow has a single purpose: on muse.ai pages it auto-clicks the "Allow"
button on Muse's own approval-request UI, and — only while the user has turned on the
separate opt-in Codex (ChatGPT) switch (off by default) — it clicks the affirmative
option ("Yes, proceed"/"Allow"/"Approve") on Codex approval requests on chatgpt.com,
so the user's agent does not stop for manual approvals. It calls no remote servers,
contains no remote code, and sends no data to the developer. Settings, a local
last-50 click log and compact click statistics live in chrome.storage.local. The
optional "Sync settings" feature is off by default; when enabled it mirrors a
settings-only subset through Chrome's built-in sync into the user's own Google Account
(never logs or statistics). It never clicks Deny/Reject/Decline, never clicks lone
"Allow" permission banners, and never touches auth/connector surfaces (Connect,
Authorize, API key) — those stay manual. Permissions: storage (local settings + log;
optional settings sync), alarms (once-a-minute check so background-tab approvals are
handled), notifications (show the locally-composed activity digest), host permissions
muse.ai and chatgpt.com (detect/click the approval options on those two sites only).
Keyboard shortcuts (commands: Alt+Shift+P pause, Alt+Shift+F follow-up) need no extra
permission. See https://blueskyz-labs.github.io/muse-auto-allow/privacy.html.
```

> Identical to `store/LISTING.md` §7.4 (v1.10.0 rewrite). The privacy-policy URL is
> filled and `store/PRIVACY.md` covers the chatgpt.com scope since the v1.10.0 pass
> (log kinds, host table, OpenAI trademark footer).

> The reviewer-facing equivalent of this pack's §5.2 walkthrough can go in the
> **Test instructions** tab — see §5.2 for when that tab is useful.

---

## 4. Listing fields checklist (Store listing tab)

Dashboard reference: <https://developer.chrome.com/docs/webstore/cws-dashboard-listing>.

| Field | Value (from this repo) | Official limit / requirement | Source |
|---|---|---|---|
| Item name | "Muse Auto-Allow" — resolved from manifest `name` = `__MSG_extName__` (`extension/_locales/en/messages.json`); 15 characters | Manifest `name` is "a short, plain text string (maximum of **75 characters**)". Note: older guides still cite a legacy 45-character store limit — this name satisfies both. Keep listing names consistent across locales. | [manifest/name](https://developer.chrome.com/docs/extensions/reference/manifest/name) · [prepare](https://developer.chrome.com/docs/webstore/prepare) |
| Short description | EN: "Auto-click Allow on Muse (muse.ai) and Codex (chatgpt.com) approvals. Starts in logging-only mode; local-only." (110 chars; all 6 localized variants in `LISTING.md` §1 — recounted at the v1.10.0 freeze 2026-10-18: vi 116, zh_CN 69, ja 75, ko 85, es 118, all ≤132) | **≤ 132 characters** — "A string of no more than 132 characters"; "Your summary … (132 characters or less)". | [prepare](https://developer.chrome.com/docs/webstore/prepare) · [best-listing](https://developer.chrome.com/docs/webstore/best-listing) |
| Detailed description | Per locale, from `store/LISTING.md` §2 (en, vi, zh_CN, ja, ko, es). The **en** description covers the v1.10.0 feature set end to end (including the Codex (ChatGPT) switch bullets); the five localized descriptions keep the Muse feature set from the v1.9.1/v1.9.3 packets and their closing scope line now names both scopes — **refresh their feature bodies before Submit** (`LISTING.md` §2 carries the same TODO). All six short descriptions name both scopes and were recounted at the v1.10.0 freeze (en 110 / vi 116 / zh_CN 69 / ja 75 / ko 85 / es 118, limit 132). The localized privacy lines carry the sync disclosure. | No numeric limit is published in the official docs (the dashboard enforces its own bound at entry); keep it accurate, concise, and free of keyword stuffing. | [cws-dashboard-listing](https://developer.chrome.com/docs/webstore/cws-dashboard-listing) · [spam FAQ](https://developer.chrome.com/docs/webstore/program-policies/spam-faq#keyword-spam) |
| Category | **Productivity** (one primary category; rationale in `LISTING.md` §3) | "The primary category under which your item should be listed." | [cws-dashboard-listing](https://developer.chrome.com/docs/webstore/cws-dashboard-listing) |
| Language(s) | Default English (en); localized listings for vi, zh_CN, ja, ko, es (copy in `LISTING.md`) | "Your item's language"; localized listings use the extension's `_locales` set. | [cws-dashboard-listing#localize_your_listing](https://developer.chrome.com/docs/webstore/cws-dashboard-listing#localize_your_listing) |
| Homepage / support URL | `https://github.com/BlueSkyz-Labs/muse-auto-allow` (`LISTING.md` §1/§9) | Optional fields; appear on the listing. | [cws-dashboard-listing#additional-fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing#additional-fields) |
| Content rating | Mature content: **No** | "Content ratings help users know whether your extension and its content are mature in nature." | [cws-dashboard-listing#mature-content](https://developer.chrome.com/docs/webstore/cws-dashboard-listing#mature-content) |
| Distribution | Visibility **Public**; all regions; free | "Public — lists your item … for all users to see and install." | [cws-dashboard-distribution](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution) |
| Version | From `extension/manifest.json` (release freeze owns the number) | Every new upload must have a larger version number than the previous one. | [prepare](https://developer.chrome.com/docs/webstore/prepare) · [update](https://developer.chrome.com/docs/webstore/update) |

### 4.1 Graphic assets — required specs ↔ files in this repo

Specs source: <https://developer.chrome.com/docs/webstore/images> ("Only the extension
icon, a small promotional image, and a screenshot are mandatory"; screenshots
"1280x800 or 640x400 pixels", at least 1, up to 5; small promo tile 440x280
(required); marquee 1400x560 (optional); icon 128x128 in the ZIP).

| Asset | Requirement | File in repo | Status |
|---|---|---|---|
| Store icon | 128×128 PNG, ships in the package | `extension/icons/icon128.png` | present |
| Screenshot 1 | 1280×800 (real runtime capture: live popup + approval cards) | `store/screenshot1.png` | present |
| Screenshot 2 | 1280×800 (Statistics page, real render) | `store/screenshot2-stats.png` | present |
| Screenshot 3 | 1280×800 (popup stage shot) | `store/screenshot3-popup.png` | present |
| Screenshot 4 | 1280×800 (designed overview) | `store/screenshot4-overview.png` | present |
| Screenshot 5 | 1280×800 (first-run safety step — logging-only statement + consent line + one-tap live clicking) | `store/screenshot5-safety.png` | present |
| Small promo tile | 440×280 PNG (required) | `store/promo440x280.png` | present |
| Marquee promo | 1400×560 PNG (optional; needed for marquee featuring) | `store/marquee1400x560.png` | present |

Asset inventory + regeneration commands: `store/SHOWCASE.md`. All showcase images use
strictly fictional demo data. Take care with the listing requirement that metadata
"must be up to date and accurate" — do not ship a screenshot that implies any behavior
beyond the single purpose (Program Policies → Building Quality Products → Listing
Requirements: "We don't allow extensions with misleading, inaccurate, incomplete, …
metadata, including … description, category, developer name, title, icon, screenshots,
and promotional images").
Source: <https://developer.chrome.com/docs/webstore/program-policies/policies>

---

## 5. Review-readiness

### 5.1 Packaged ZIP structure

- The upload is `dist/muse-auto-allow-v<VERSION>.zip` — a zip of the `extension/`
  directory with **`manifest.json` at the zip root** (not nested in a folder).
  `scripts/build.mjs` enforces this, fail-closed (exit 2 = `manifest.json` not at the
  zip root, exit 3 = zip/disk entry-count mismatch or missing entries, exit 4 =
  unexpected files on either side) and `scripts/verify-zip.py` byte-compares every zip
  entry against `extension/` (exit 0 = 18 matched / 0 mismatched / 0 disk-only / 0
  zip-only). Never upload a zip that fails the verify step.
- Packaging hygiene matters to the review: "Your item has packaging errors… files
  mentioned in your manifest that are not present in your package" is a common
  rejection under the *Functionality not working* category.
  Source: <https://developer.chrome.com/docs/webstore/troubleshooting>
- Chrome must be able to discern full functionality from the submitted code: "the full
  functionality of an extension must be easily discernible from its submitted code…
  logic … should be self contained."
  Source: <https://developer.chrome.com/docs/webstore/program-policies/policies> (Additional Requirements for Manifest V3).

### 5.2 Reviewer test instructions

Official field: dashboard → **Test instructions tab** — "you can provide credentials
and instructions for CWS reviewers, allowing them to more accurately evaluate an item's
quality. This is only useful if the item requires restricted credentials or a paid
account for full access to all features."
Source: <https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions>

For Muse Auto-Allow: the extension itself needs **no account and no credentials**, but
exercising it requires a signed-in **muse.ai** session in the review browser (sign-in
is Muse's normal Google/email flow). Use the Test instructions tab for a concise
walkthrough; if the Muse approval surface requires a paid Muse plan at review time,
provide reviewer credentials there and say so explicitly.

Ready-to-paste walkthrough:

```text
Verification steps (no extension-specific credentials required):
1. Load the extension (or install it) in Chrome 116+ in a profile where you can sign
   in to muse.ai.
2. Sign in to https://muse.ai and open a Muse agent chat that can request approvals.
3. First run: the extension starts in logging-only mode — a fresh install does NOT
   click yet. The popup banner reads "Logging only — nothing will be clicked" and the
   setup wizard's consent step states "You start in logging-only mode". Turn on live
   clicking with the one-tap "Turn on live clicking" (or the dry-run toggle in
   Safety & Control afterwards) — that is the single action needed before any live click.
4. When Muse asks for approval, an approval card with Allow / Deny buttons appears.
   The extension clicks Allow automatically (default delay is configurable, ~1s; the
   first click may take a few seconds because detection is event-driven with a 1s
   heartbeat).
5. Open the extension popup (toolbar icon): the click counter increments and the click
   log shows the entry (kind "allow", label, context). The Statistics page
   (popup → Statistics) shows the per-day count.
6. Toggle the extension off in the popup: approval cards are no longer clicked.
7. Pause / dry-run: press Alt+Shift+P to pause automation for 15 minutes (press again
   to clear); enable dry-run mode to see log entries with a "-dry" suffix while nothing
   is clicked.
8. Safety demonstration: the extension never clicks Deny/Reject/Decline and never
   clicks lone "Allow" buttons (e.g. browser permission prompts); each button is
   clicked at most once; cards matching the block-keyword list are logged as blocked.
9. Digest: after a session with clicks, restart Chrome — a desktop notification
   summarizes recent activity (composed locally on the device).
Test data: the extension stores only local settings, a last-50 click log, and compact
counters (chrome.storage.local). Settings sync is off by default; if enabled, a
settings-only subset mirrors via Chrome's built-in sync. No account, no extension
network calls.
```

### 5.3 Common rejection causes → why this submission avoids each

Sources: <https://developer.chrome.com/docs/webstore/troubleshooting> (per-category
notification IDs) · <https://developer.chrome.com/docs/webstore/program-policies/policies> ·
<https://developer.chrome.com/docs/webstore/review-process>.

| Common cause (official category) | Why this submission is clear |
|---|---|
| **No / vague single purpose** | §1 statement names the exact sites (muse.ai, and the opt-in chatgpt.com scope) and the exact actions (click Allow / the affirmative option on approval requests); every feature in the package serves it. |
| **Broader permissions than needed / unused permissions** | Only `storage`, `alarms`, `notifications`, and the two pinned host sets (muse.ai + opt-in chatgpt.com) are requested, each justified in §2 (`commands` is a manifest key, not a permission). The lint gate fails on any added permission. "Use of Permissions" policy: narrowest permissions only. |
| **Remote code in MV3** (Blue Argon) | None — bundled JS only; no `eval`/`new Function`/external scripts/network calls (lint-enforced); declared "No remote code" in §3.1. |
| **Obfuscated code** (Red Titanium) | The package ships as-authored, unminified source — "Developers must not obfuscate code or conceal functionality"; submitting code "as authored" also shortens review time. Sources: [code-readability](https://developer.chrome.com/docs/webstore/program-policies/code-readability) · [review-process](https://developer.chrome.com/docs/webstore/review-process). |
| **Inaccurate / misleading metadata** (Listing Requirements) | Listing copy describes exactly what the code does; screenshots are real captures of the extension (or designed overviews with fictional data); no overclaiming, no security-bypass promises. |
| **Privacy disclosure mismatch** | Dashboard answers (§3) and `store/PRIVACY.md` are kept word-for-word consistent: collects nothing, transmits nothing to the developer, no remote code. The one optional data-flow surface — the off-by-default settings sync — is disclosed in both (§3.2a / PRIVACY §2). |
| **Functionality broken / packaging errors** (Yellow Magnesium) | `test/e2e.mjs` + `test/followup-e2e.mjs` verify the shipped behavior on real Chrome; `build.mjs` + `verify-zip.py` guarantee the zip mirrors the tree with the manifest at the root. |
| **Automation against a site's terms** | The extension acts only inside the user's own logged-in browser session on muse.ai; there is no server-side automation, no scraping, and it never clicks destructive actions. Owner action: re-check this reading against Muse's terms before submitting (see `store/PUBLISH_RUNBOOK.md` open items). |
| **Keyword spam in description** | Copy is plain and specific; no keyword stuffing. Source: [spam FAQ — keyword spam](https://developer.chrome.com/docs/webstore/program-policies/spam-faq#keyword-spam). |

---

## 6. Post-submission runbook

### 6.1 Statuses and monitoring

- Item status in the dashboard is one of **Published, Pending, Rejected, Taken Down**.
  "Pending review" means queued; the item is not visible in the store until approved.
- Enable email notifications (Account page) and keep the publisher inbox monitored;
  add `chromewebstore-noreply@google.com` to contacts so review mail is not flagged as
  spam. If you did not receive an email within a week, check the item's Status tab.
  Source: <https://developer.chrome.com/docs/webstore/check-review>

### 6.2 Review timeline (official guidance)

- "For most extensions, review is completed within a few days, but it can take up to a
  few weeks." New developers, new extensions, dangerous permission requests, and
  significant code changes can trigger closer review and longer times; broad host
  permissions, sensitive execution permissions, and harder-to-review code also extend
  review time.
  Source: <https://developer.chrome.com/docs/webstore/review-process#review-time>
- All submissions go through the same system regardless of developer tenure; plan
  around it. Do not resubmit repeatedly to "speed it up" — that risks spam-adjacent
  flagging.

### 6.3 If the submission is rejected

1. Read the rejection email — it "will state which policy the extension violated and
   provide … guidance on how to appeal the verdict." Look up the violation category
   (human-readable IDs like `Blue Argon`, `Red Titanium`, `Yellow Magnesium`) in the
   Troubleshooting guide.
   Sources: <https://developer.chrome.com/docs/webstore/review-process#rejection> ·
   <https://developer.chrome.com/docs/webstore/troubleshooting>
2. Fix the code and/or the listing in this repo.
3. **Bump the version** in `extension/manifest.json`, rebuild
   (`node scripts/build.mjs`), verify (`python scripts/verify-zip.py`) — a re-upload
   must carry a larger version number than the published one.
   Source: <https://developer.chrome.com/docs/webstore/update>
4. Re-upload the zip and resubmit, with a note explaining what changed.
5. If you believe the verdict is wrong, appeal: "Review verdicts and account
   suspensions can be appealed from the Chrome Web Store developer dashboard" — item
   details page → **Appeal** button; other issues go through One Stop Support
   (responses can take up to ~3 days).
   Source: <https://developer.chrome.com/docs/webstore/review-process#support>

### 6.4 If a warning lands after publication

Minor policy violations get an email warning and "typically 7 to 30 days to address
the issue(s)"; resolve by submitting a fixed version. Unresolved warnings end in a
takedown.
Source: <https://developer.chrome.com/docs/webstore/review-process#warning>

---

## 7. Open owner items (before clicking Submit for review)

- [x] **Privacy policy hosted + URL filled** — `store/LISTING.md` §1/§7.4/§9 carry `https://blueskyz-labs.github.io/muse-auto-allow/privacy.html` (GitHub Pages; HTTP 200, content updated to the v1.8+ disclosures — verified live 2026-10-12). Paste it into the dashboard's privacy-policy field and the reviewer note (§3.3/§3.4).
- [x] **Zip built + verified + attached to the GitHub Release** — the `v1.9.3` Release exists with the zip + `.sha256` sidecar (releases also exist for v1.8.0 / v1.9.0 / v1.9.1 / v1.9.2). Frozen artifact: `dist/muse-auto-allow-v1.9.3.zip`, 185,014 bytes, 18 entries, sha256 `e3dd7703b85fffd9ad5b78a8b353c90929f4b87487f3d9dc932fdb2c5f140326`; `python scripts/verify-zip.py` → 18 matched / 0 mismatched (exit 0) at the freeze.
- [x] **Screenshots regenerated** — `store/screenshot1.png` (real runtime capture), `screenshot2-stats.png` (Statistics), `screenshot3-popup.png` (popup stage) are the current captures; `screenshot4-overview.png` is the **designed overview** (a rendered composition, not a runtime capture). Verified in this pass: all five screenshots + promo + marquee present and exact-spec by PNG header (1280×800 / 440×280 / 1400×560); `store/screenshot5-safety.png` (the first-run safety step, captured with `node scripts/store-shot.mjs --safety`) was additionally reviewed deterministically — a pixel census confirms the approval-card Allow buttons render and the card panel is complete (vision passes disagreed with each other on the same asset and are not a gate; see the benchmark report's methodology note). **Not verified here:** whether screenshot1/2/3/4 show the current build pixel-for-pixel — give them one human look against the frozen build before upload.
- [x] **Muse ToS check done** — `docs/MUSE_TOS_RESEARCH.md` records the reading: **MEDIUM** tension (the Muse ToS oversight clause asks for "meaningful human oversight"; no clause explicitly bans extensions or UI auto-clicking). Findings only, not legal advice — the **owner/legal decision remains** before a public launch.
- [ ] **Owner items (cannot be done from the repo):** (a) confirm the publisher display name in the dashboard; (b) fill the support email — the only `TODO: fill before submit` left in `store/LISTING.md` (plus the policy dates/contact in `store/PRIVACY.md`); (c) complete CWS developer-account 2-Step Verification (and the one-time registration fee if not yet paid); (d) hash-verify before upload — run `sha256sum -c dist/muse-auto-allow-v1.10.0.zip.sha256` and `python scripts/verify-zip.py` (both exit 0) immediately before uploading the zip to the CWS.
- [ ] **v1.10.0 freeze items (2026-10-18):** (a) build + verify the v1.10.0 artifact — `node scripts/build.mjs` + `python scripts/verify-zip.py` (expect 19 matched / 0 mismatched), then attach it to the `v1.10.0` GitHub Release with its `.sha256` sidecar; (b) refresh the five localized detailed descriptions in `store/LISTING.md` §2 (they still describe the Muse feature set only — their closing scope line already names both scopes); (c) regenerate the popup-bearing store screenshots (`screenshot1` real runtime, `screenshot3-popup` stage) at the v1.10.0 layout (the current captures predate the Codex switch row); (d) run through §1's paste blocks once more before Submit — the single-purpose/reviewer-note/justification copy was rewritten this freeze.
- [x] **§2 re-verified against the frozen package** — §2 matches the frozen `extension/manifest.json` at freeze commit `a13689a` (`manifest.version` reads `1.9.3`; permissions `storage`/`alarms`/`notifications`; muse.ai-only hosts; `commands` `toggle-pause`/`send-followup`); the package is `dist/muse-auto-allow-v1.9.3.zip`. *(Historical — superseded by the v1.10.0 freeze items §7 above: the v1.10.0 §2 re-verification is the updated "Verified against `extension/manifest.json` (working tree as of the v1.10.0 freeze)" block in §2 itself.)*

---

## 8. Sources (official)

All sources are `developer.chrome.com` / `docs.github.com` docs, re-verified 2026-10-10 (every URL below returned HTTP 200 on that date):

- Register your developer account — <https://developer.chrome.com/docs/webstore/register>
- Prepare your extension — <https://developer.chrome.com/docs/webstore/prepare>
- Complete your listing information — <https://developer.chrome.com/docs/webstore/cws-dashboard-listing>
- Supplying images — <https://developer.chrome.com/docs/webstore/images>
- Fill out the privacy fields — <https://developer.chrome.com/docs/webstore/cws-dashboard-privacy>
- Provide test instructions — <https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions>
- Set up distribution — <https://developer.chrome.com/docs/webstore/cws-dashboard-distribution>
- Publish in the Chrome Web Store — <https://developer.chrome.com/docs/webstore/publish>
- Update your item — <https://developer.chrome.com/docs/webstore/update>
- Check on your review status — <https://developer.chrome.com/docs/webstore/check-review>
- Review process (times, outcomes, enforcement, appeals) — <https://developer.chrome.com/docs/webstore/review-process>
- Program Policies (single page) — <https://developer.chrome.com/docs/webstore/program-policies/policies>
- Use of Permissions — <https://developer.chrome.com/docs/webstore/program-policies/permissions>
- Limited Use — <https://developer.chrome.com/docs/webstore/program-policies/limited-use>
- Code readability requirements — <https://developer.chrome.com/docs/webstore/program-policies/code-readability>
- Troubleshooting violations — <https://developer.chrome.com/docs/webstore/troubleshooting>
- Keyword spam FAQ — <https://developer.chrome.com/docs/webstore/program-policies/spam-faq>
- Manifest `name` reference — <https://developer.chrome.com/docs/extensions/reference/manifest/name>
- Permissions list (`notifications` — "Gives access to the chrome.notifications API") — <https://developer.chrome.com/docs/extensions/reference/permissions-list>
- Notifications API — <https://developer.chrome.com/docs/extensions/reference/api/notifications>
- Commands API (keyboard shortcuts; the `commands` manifest key) — <https://developer.chrome.com/docs/extensions/reference/api/commands>
- Storage API — `chrome.storage.sync` quotas (8,192 bytes/item, 102,400 bytes total, 512 items) — <https://developer.chrome.com/docs/extensions/reference/api/storage>
