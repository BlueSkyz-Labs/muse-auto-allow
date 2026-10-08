# muse-auto-allow — Muse Auto-Allow

Chrome (Manifest V3) extension that auto-clicks **Allow** on **Muse** (muse.ai) approval
requests, so your Muse agent keeps working without stopping for manual approvals.

Tiện ích Chrome tự động bấm **Allow** cho các yêu cầu phê duyệt của Muse (muse.ai) —
agent chạy liên tục, không phải duyệt tay.

## Features

Four detection paths, in priority order:

1. **Marked cards** — `[data-testid="hatch-inline-approval-card"]` containing an allow-ish
   and a deny-ish button → clicks the allow button.
2. **Pair heuristic** — an `Allow` button whose nearest ancestor holding a deny-ish button
   contains exactly one allow-ish button (itself) → clicks it.
3. **Collapsed pending cards** — `Allow Muse to perform this action …` → clicks to expand,
   then approves the revealed pair.
4. **Background surface** — `N tasks need your approval` banner → clicks to open the
   approvals panel so pending cards render.

Never clicks `Deny`/`Reject`/`Decline`; never clicks lone `Allow` buttons (permission
banners) or text merely starting with "Allow" (e.g. "Allow notifications"); never clicks
the same node twice; per-text cooldowns stop pathological loops. Every click is logged
(kind / label / context, last 50) and visible in the popup.

## Languages

UI + manifest localized: English, Tiếng Việt, 简体中文, 日本語, 한국어, Español
(`extension/_locales/`).

## Layout

```
extension/          the loadable extension (manifest at root) + icons + _locales
test/e2e.mjs        runtime E2E on REAL Chrome (CDP Extensions.loadUnpacked, scratch profile)
test/fixture.html   DOM fixture covering all 4 paths + negative controls
assets/             icon source (icon.html), store screenshot + promo tile sources
store/              store kit: listing copy, privacy, publish runbook, compliance checklist
scripts/build.mjs   builds dist/muse-auto-allow-v<version>.zip (manifest at zip root)
dist/               built store zips
docs/               SGPS adoption notes
```

## Install (unpacked, dev)

1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select `C:\00. AI Project\muse-auto-allow\extension`
3. Refresh any open muse.ai tab once so the content script injects.

## Test

```bash
"/c/Program Files/nodejs/node" test/e2e.mjs
```

Real installed Chrome + scratch profile + CDP `Extensions.loadUnpacked`. Asserts all four
paths, the late card, and that lone/permission-pair Allow buttons and Deny are never clicked.

## Build (store zip)

```bash
"/c/Program Files/nodejs/node" scripts/build.mjs
```

## Store

- `store/LISTING.md` — full listing copy (6 languages), permission justifications, data answers
- `store/PRIVACY.md` — privacy policy
- `store/PUBLISH_RUNBOOK.md` — step-by-step launch runbook
- `store/screenshot1.png` (1280x800) + `store/promo440x280.png` (440x280) — store assets
- `store/COMPLIANCE_CHECKLIST.md` — independent store-compliance review

## SGPS

Adoption notes (Experience v4.0 + Release v1.0): `docs/SGPS_EXPERIENCE_ADOPTION.md`.

## License

MIT © 2026 BlueSkyz Labs — see `LICENSE`.
