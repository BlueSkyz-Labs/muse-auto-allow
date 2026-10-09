# Publish Runbook — Muse Auto-Allow (Chrome Web Store)

Step-by-step launch and update procedure. Steps marked **[MANUAL/owner]** require a human
with the Google account and payment; everything else can be done from the repo.

**One-line flow:** register developer account → upload
`dist/muse-auto-allow-v1.2.0.zip` → fill every dashboard tab → submit → wait for review →
publish → for updates: bump version → rebuild zip → upload → resubmit.

---

## Step 1 — Register the Chrome Web Store developer account (one-time) **[MANUAL/owner]**

1. Sign in to the **Google account** that will own the extension.
2. Go to the Chrome Web Store Developer Dashboard:
   `https://chrome.google.com/webstore/devconsole`.
3. Accept the developer agreement.
4. Pay the **one-time US$5 registration fee** (credit/debit card; non-refundable).
5. Complete **identity verification** if prompted (Google may ask for name, address, and
   sometimes identity documents). Verification can take a few days; do this early.
6. Confirm the **publisher name** shown in the dashboard ("BlueSkyz Labs" — TODO: confirm
   the exact display name before publishing; it appears on the public listing and is hard
   to change casually).

> Blocking: publish cannot proceed until the fee is paid and identity verification is
> complete. This is the only step that cannot be automated from the repo.

---

## Step 2 — Build and upload the package

1. Confirm the version in `extension/manifest.json` is correct (currently `1.2.0`).
2. Build the store zip from the repo root:

   ```bash
   node scripts/build.mjs
   ```

   Output: `dist/muse-auto-allow-v1.2.0.zip` with `manifest.json` at the **zip root**
   (not nested inside a folder).
3. In the Developer Dashboard, click **New item** (first release) or open the existing
   item (for updates).
4. **Upload** `dist/muse-auto-allow-v1.2.0.zip`.
5. Wait for the dashboard to parse the manifest. It will read the name/description from
   `__MSG_*__` keys resolved against `_locales/en/messages.json`; verify the default
   locale resolves cleanly (no blank name).

> Sanity check before upload: the zip must contain `manifest.json` at the top level. If
> Chrome rejects the file, re-open the zip and confirm it is not nested under an extra
> folder.

---

## Step 3 — Fill every dashboard tab

Work through all tabs before submitting; an incomplete listing cannot be submitted.

### 3.1 Store listing
- **Item name:** Muse Auto-Allow
- **Short description** (EN, ≤132 chars) and the **detailed description** in all six
  languages: copy verbatim from `store/LISTING.md` §2.
- **Category:** Productivity.
- **Language:** English (add the other five as localized listings).
- **Graphic assets:** upload the 128×128 icon, the **1280×800** screenshot
  (`store/screenshot1.png`), and the **440×280** promo tile (`store/promo440x280.png`).
  See `store/LISTING.md` §8. (Both image files are present in the repo at the correct
  sizes; confirm they reflect the shipped 1.2.0 behavior before uploading.)
- **Additional fields:** homepage/support URL and privacy policy URL — fill the
  `TODO: fill before submit` placeholders from `store/LISTING.md` §9.

### 3.2 Privacy practices
- **Single purpose:** paste the statement from `store/LISTING.md` §4.
- **Permission justifications:** paste the `storage`, `alarms`, and host-justification
  text from `store/LISTING.md` §5 (one justification per requested permission).
- **Remote code:** declare **"No, I am not using remote code"** — see
  `store/LISTING.md` §6.
- **Data usage:** answer the data-collection and certification questions per
  `store/LISTING.md` §7 (collects nothing; no sale; no unrelated use; no
  creditworthiness/lending; no advertising; nothing transmitted).
- **Privacy policy URL:** paste the public link where `store/PRIVACY.md` is hosted.
- **Notes for the reviewer:** paste the review note from `store/LISTING.md` §7.4.

### 3.3 Distribution
- **Visibility:** Public.
- **Regions:** all regions (or restrict deliberately per your policy).
- **Pricing:** Free.
- Confirm **Mature content** = No (the extension has no mature content).

---

## Step 4 — Submit for review

1. Click **Submit for review**.
2. **Typical review time:** usually a few business days; new items or items requesting a
   host permission can take longer (up to ~1–2 weeks). Plan around this before a launch
   date.
3. What reviewers check for this class of extension:
   - **Minimal permissions** — every permission is justified and actually used. This
     extension requests only `storage`, `alarms`, and the `muse.ai` host permission.
   - **No remote code** — all logic is bundled; nothing is fetched or evaluated at
     runtime.
   - **Single purpose** — the extension does one thing (click Muse's Allow button) and
     the listing says so accurately.
   - **Accurate description** — the description matches real behavior; no overclaiming,
     no promise to bypass security.
   - **Privacy accuracy** — the declared data practices match the code (here: collects
     nothing, transmits nothing).
4. If the reviewer asks for changes, fix, rebuild the zip, re-upload, and resubmit with a
   reply explaining what changed.

---

## Step 5 — Post-publish update flow

1. Make the code change in `extension/`.
2. **Bump the version** in `extension/manifest.json` (e.g. `1.2.0` → `1.2.1`); Chrome
   rejects a re-upload with a version number that is not higher than the published one.
3. Rebuild:

   ```bash
   node scripts/build.mjs
   ```

   Output: `dist/muse-auto-allow-v1.2.1.zip`.
4. In the dashboard, open the item → **Package** → **Upload new package** → select the new
   zip.
5. Update any listing text if behavior changed (keep descriptions accurate).
6. **Submit for review** again. Updates usually review faster than first submissions, but
   can still take a few days.
7. Optionally keep `CHANGELOG.md` updated with what shipped.

---

## Step 6 — Common rejection pitfalls, and how this extension avoids them

| Pitfall | How this extension stays clear of it |
|---|---|
| Requesting broad host permissions or `<all_urls>` | Only `https://muse.ai/*` and `https://*.muse.ai/*` are requested, and only to click the Allow button. |
| Unused or unjustified permissions | Only `storage` and `alarms` are used; each is justified in the listing. No `tabs`/`scripting`/`webRequest`/`cookies`. |
| Remote code | None. All JS is bundled; no `eval`, no external scripts, no network calls. |
| Vague or misleading single purpose | The single-purpose statement names the exact site and action. |
| Privacy disclosure mismatch | The extension collects/transmits nothing; the privacy answers and policy say exactly that. |
| Promising to bypass security or restrictions | The listing never claims to bypass any security control. It only clicks Muse's own "Allow" button on the user's behalf, and it never clicks Deny/Reject/Decline. |
| Misleading screenshots | Screenshots must show the real Muse approval card with the popup open — no mockups implying extra capabilities. (Render real screenshots before submit.) |
| Automating a site against its terms | The extension acts only within the user's own logged-in browser session on muse.ai; there is no server-side automation and no scraping. Confirm this reading against Muse's terms before launch — see the open item below. |
| Missing or dead privacy policy link | Host `store/PRIVACY.md`, paste the public URL, and verify it loads before submitting. |
| Version not incremented on update | Update flow above always bumps `manifest.json` before rebuilding. |

---

## Open items before submit (owner action)

- [ ] Replace every `TODO: fill before submit` in `store/LISTING.md` and `store/PRIVACY.md`.
- [ ] Host `store/PRIVACY.md` at a public URL and paste it into the dashboard.
- [x] Store images present: `store/screenshot1.png` (1280×800) and
      `store/promo440x280.png` (440×280) — verified dimensions; review content before upload.
- [ ] Confirm the publisher display name and support email.
- [ ] Sanity-check Muse's terms of service around helping a user auto-approve their own
      agent actions (or Agent Mode) before a public launch.
- [ ] Run `node scripts/build.mjs` and confirm the zip has `manifest.json` at root.
- [ ] Load the unpacked extension and scroll the four detection paths once (see
      `test/e2e.mjs`) so the shipped build matches the description.
