# SGPS Adoption — muse-auto-allow

Adoption note per the owner's SGPS Operating Prompt Suite (2026-10-04, hashes verified MATCH
by `sgps_prompt_router.py`).

- **Mode:** EXECUTE
- **Roles routed:** `experience` (03_SGPS_PREMIUM_EXPERIENCE_v4.0), `release` (05_SGPS_RELEASE_PRODUCTION_v1.0)
- **Always-on:** 00 Common Execution Kernel v1.0 + 01 AI Factory Master v2.0
- **Security/Paid (04):** no auth, no payment, no tenant data — but **not "not applicable"**: the opt-in
  settings-sync mirror (v1.8.0+) and the security audit/re-attack corpus exist
  (`docs/SECURITY_V19_AUDIT.md`, `docs/SECURITY_REATTACK.md`, `docs/SECURITY_REMEDIATION.md`); paid
  readiness stays **NOT_VERIFIED** (there is no payment surface). The earlier "no sync" wording in this
  file was stale and is corrected here.
- **Not applicable:** 02 Product Evolution (greenfield tool, no legacy audit surface)

## Experience adoption (Premium Experience v4.0)

| Principle | How it is applied here |
|---|---|
| Motion with purpose | Popup micro-animations: draw-in check on open, status-dot pulse, count pop, log slide-in. All gated behind `prefers-reduced-motion: reduce` (hard-disabled). |
| Accessibility baseline | Native controls (checkbox / number input) → keyboard + assistive-tech support for free; visible text labels; `lang` set from `chrome.i18n.getUILanguage()`; color is never the only signal (labels + text everywhere). |
| Localization | 6 locales: en, vi, zh_CN, ja, ko, es — popup UI + manifest name/description + store listing copy. |
| State honesty | Empty state ("No clicks yet"), populated log, disabled state (status dot off). No silent failure: every click is logged with kind / label / context (last 50, local). |
| Copy clarity | Plain language; the destructive-side risk of auto-allow is disclosed explicitly (store listing + on/off switch). No dark patterns. |
| Brand | Brand Kit v2 (`docs/BRANDING.md`): Muse-adjacent light-first tokens + original check-on-tile mark; deliberately NOT a clone of Muse/Meta branding. |

## Release adoption (Release/Production v1.0)

- `scripts/build.mjs` produces `dist/muse-auto-allow-v<version>.zip` with `manifest.json` at the zip root (verified by entry listing).
- `store/PUBLISH_RUNBOOK.md` covers account setup, listing, privacy practices, review pitfalls, and the post-publish update flow (version bump → rebuild → upload).
- Screenshots: 5×1280×800 (live runtime, stats, popup stage, overview, first-run safety step) + promo 440×280 + marquee 1400×560 — see `store/SHOWCASE.md`.

## Evidence / status honesty

| Item | State | Evidence |
|---|---|---|
| Runtime E2E — Muse engine (real Chrome, CDP `Extensions.loadUnpacked`) | VERIFIED at the v1.10.0 freeze revision (exact SHA in the release freeze record; see the `v1.10.0` tag/CHANGELOG) | `test/e2e.mjs` exit 0 at the freeze (all paths + negative controls + dry-run pre-phase); local run 2026-10-18. Any later edit to `extension/` or `test/` invalidates this row (STAGE -1 gate). |
| Runtime E2E — Codex (ChatGPT) engine (real Chrome) | VERIFIED at the same freeze revision | `test/codex-e2e.mjs` exit 0 at the freeze (OFF=dormant, DRY via the popup switch, LIVE rails, YOLO branch, store contract); local run 2026-10-18 |
| i18n present (6 locales) | VERIFIED | `extension/_locales/*/messages.json` — 189 keys each; parity enforced by `scripts/lint.mjs` |
| Reduced-motion gate present | VERIFIED (static) | media query in `extension/popup.html` |
| Store zip builds with manifest at root | VERIFIED | `scripts/build.mjs` output (`dist/muse-auto-allow-v1.10.0.zip`) |
| Chrome Web Store review | NOT STARTED (EXTERNAL — owner account) | `store/PUBLISH_RUNBOOK.md` |

## STAGE -1 gates

- Live truth baseline: the public repository `BlueSkyz-Labs/muse-auto-allow` (releases v1.7.0–v1.9.4 exist; `origin/main` is canonical — the owner's local folder path is not a reference). `OBSERVED_AT` = build time.
- **HEAD changed ⇒ affected evidence invalidated:** the E2E run must be re-executed after any further edit to `extension/` before any GO/publish claim.
- No verdict beyond executed evidence; store approval is an external gate and is never claimed here.
