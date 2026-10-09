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

**Statistics.** A built-in Statistics page (`stats.html`) shows clicks by day / week /
month / year — inline SVG charts with a Day/Week/Month/Year switcher, KPI cards and a
by-topic list (the repo or host taken from each approval's context). The popup adds
today's count and a 7-day mini chart, and the toolbar badge shows today's click count
(cleared at zero).

**Muse-style UI, light and dark.** v1.4.0 rebuilds the popup and Statistics page on
Muse's design language: light-first (`#fcfcfc` surfaces, `#111112` ink, pill controls,
`#005abf` accent) with a full dark theme via `prefers-color-scheme` (`#18191a`,
`#0a5ce0`). All motion is disabled under `prefers-reduced-motion`.

**Brand Kit v2.** Original check-on-tile mark with the blue gradient
`#0082FB → #0064E0 → #0040DC` — our own artwork, deliberately not Muse's trademark. See
`docs/BRANDING.md`.

**muse.ai only.** A hard hostname guard in the content script backs the manifest's
muse.ai-only matches, and the popup shows a live "N muse.ai tabs open" chip.

## Languages

UI + manifest localized: English, Tiếng Việt, 简体中文, 日本語, 한국어, Español
(`extension/_locales/`, 31 strings per locale).

## Layout

```
extension/          the loadable extension (manifest at root): content/background scripts,
                    popup, Statistics page, icons, _locales
test/e2e.mjs        runtime E2E on REAL Chrome (CDP Extensions.loadUnpacked, scratch profile)
test/fixture.html   DOM fixture covering all 4 paths + negative controls
assets/             icon + store asset sources (icon.html, store-screenshot.html, promo-tile.html)
store/              store kit: listing copy, privacy, publish runbook, compliance checklist, store images
scripts/            build.mjs (zip) + verify-zip.py (byte-compare) + render/shot scripts for assets
dist/               built store zips
docs/               SGPS adoption notes, brand kit (BRANDING.md), redteam reports
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
python scripts/verify-zip.py   # byte-compares the zip against extension/ (exit 0 = match)
```

## Store

- `store/LISTING.md` — full listing copy (6 languages), permission justifications, data answers
- `store/PRIVACY.md` — privacy policy
- `store/PUBLISH_RUNBOOK.md` — step-by-step launch runbook
- `store/COMPLIANCE_CHECKLIST.md` — independent store-compliance review
- `store/screenshot1.png` (1280x800, real runtime capture), `store/screenshot2-stats.png`
  (1280x800), `store/screenshot3-popup.png` (popup render), `store/screenshot4-overview.png`
  (1280x800, designed) + `store/promo440x280.png` (440x280) — store images

## SGPS

Adoption notes (Experience v4.0 + Release v1.0): `docs/SGPS_EXPERIENCE_ADOPTION.md`.

## License

MIT © 2026 BlueSkyz Labs — see `LICENSE`.
