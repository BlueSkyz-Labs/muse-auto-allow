# SGPS Adoption — muse-auto-allow

Adoption note per the owner's SGPS Operating Prompt Suite (2026-10-04, hashes verified MATCH
by `sgps_prompt_router.py`).

- **Mode:** EXECUTE
- **Roles routed:** `experience` (03_SGPS_PREMIUM_EXPERIENCE_v4.0), `release` (05_SGPS_RELEASE_PRODUCTION_v1.0)
- **Always-on:** 00 Common Execution Kernel v1.0 + 01 AI Factory Master v2.0
- **Not applicable:** 04 Security/Paid (no auth, no payment, no sync, no tenant data); 02 Product Evolution (greenfield tool, no legacy audit surface)

## Experience adoption (Premium Experience v4.0)

| Principle | How it is applied here |
|---|---|
| Motion with purpose | Popup micro-animations: draw-in check on open, status-dot pulse, count pop, log slide-in. All gated behind `prefers-reduced-motion: reduce` (hard-disabled). |
| Accessibility baseline | Native controls (checkbox / number input) → keyboard + assistive-tech support for free; visible text labels; `lang` set from `chrome.i18n.getUILanguage()`; color is never the only signal (labels + text everywhere). |
| Localization | 6 locales: en, vi, zh_CN, ja, ko, es — popup UI + manifest name/description + store listing copy. |
| State honesty | Empty state ("No clicks yet"), populated log, disabled state (status dot off). No silent failure: every click is logged with kind / label / context (last 50, local). |
| Copy clarity | Plain language; the destructive-side risk of auto-allow is disclosed explicitly (store listing + on/off switch). No dark patterns. |
| Brand | Soft Muse-inspired motion language (cream + electric blue + sparkle), deliberately NOT a clone of Meta branding. |

## Release adoption (Release/Production v1.0)

- `scripts/build.mjs` produces `dist/muse-auto-allow-v<version>.zip` with `manifest.json` at the zip root (verified by entry listing).
- `store/PUBLISH_RUNBOOK.md` covers account setup, listing, privacy practices, review pitfalls, and the post-publish update flow (version bump → rebuild → upload).
- Screenshots: `store/screenshot1.png` (1280x800), `store/promo440x280.png` (440x280).

## Evidence / status honesty

| Item | State | Evidence |
|---|---|---|
| Runtime E2E (real Chrome, CDP `Extensions.loadUnpacked`) | VERIFIED at current head | `test/e2e.mjs` run output (all 4 paths + negative controls) |
| i18n present (6 locales) | VERIFIED | `extension/_locales/*/messages.json` |
| Reduced-motion gate present | VERIFIED (static) | media query in `extension/popup.html` |
| Store zip builds with manifest at root | VERIFIED | `scripts/build.mjs` output |
| Chrome Web Store review | NOT STARTED (EXTERNAL — owner account) | `store/PUBLISH_RUNBOOK.md` |

## STAGE -1 gates

- Live truth baseline: local folder `C:\00. AI Project\muse-auto-allow` (not yet a git repo; no remote). `OBSERVED_AT` = build time.
- **HEAD changed ⇒ affected evidence invalidated:** the E2E run must be re-executed after any further edit to `extension/` before any GO/publish claim.
- No verdict beyond executed evidence; store approval is an external gate and is never claimed here.
