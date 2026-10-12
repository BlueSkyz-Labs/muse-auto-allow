# Chrome Web Store — Showcase Kit

Asset inventory for the public listing. All sizes verified; all demo data is strictly
fictional (Example Org, demo-project, sample-app, web-starter, notes-app,
files.example.com) — never real projects or personal data.

| Asset | File | Size | Store requirement |
|---|---|---|---|
| Extension icon | `extension/icons/icon128.png` | 128×128 | required (in package) |
| Screenshot 1 — live popup + approval cards (real runtime capture) | `store/screenshot1.png` | 1280×800 | required (≥1; 1280×800 or 640×400) |
| Screenshot 2 — Statistics dashboard (real render — single-hue trend + topic palette, `docs/BRANDING.md` §3.1) | `store/screenshot2-stats.png` | 1280×800 | up to 5 total |
| Screenshot 3 — popup (real render) | `store/screenshot3-popup.png` | 1280×800 | up to 5 total |
| Screenshot 4 — designed overview (approval card + layered mini Statistics card) | `store/screenshot4-overview.png` | 1280×800 | up to 5 total |
| Small promo tile (palette-dot chips) | `store/promo440x280.png` | 440×280 | optional (featured placement) |
| Marquee promo (layered popup + Statistics cards) | `store/marquee1400x560.png` | 1400×560 | optional (featured placement) |
| Listing copy (6 locales) | `store/LISTING.md` | — | title / short / full description per locale |
| Permission justifications | `store/LISTING.md` §5 | — | required in dashboard |
| Privacy policy | `store/PRIVACY.md` | — | required (public URL before submit) |
| Package | `dist/muse-auto-allow-v1.9.3.zip` | 18 files | built by `scripts/build.mjs`, byte-verified by `scripts/verify-zip.py` (185,014 bytes, sha256 `e3dd7703b85fffd9ad5b78a8b353c90929f4b87487f3d9dc932fdb2c5f140326`) |
| Brand spec | `docs/BRANDING.md` | — | internal reference (tokens, mark, rules) |

## Regenerate everything

```bash
node scripts/render.mjs        # icons, promo, marquee, overview
node scripts/stats-shot.mjs    # screenshot2 (stats) + screenshot3 (popup) + dark QA pair
node scripts/store-shot.mjs    # screenshot1 (real runtime capture)
node scripts/build.mjs && python scripts/verify-zip.py
```

Dark-mode renders are captured to the OS temp dir (`maa-dark/`) for QA only — the
store images are light-theme (Muse language).

## Pre-submit checklist

- [ ] Replace the `TODO: fill before submit` placeholders in `store/PRIVACY.md` (publisher legal name, support email/URL, effective date)
- [ ] Upload screenshots 1–4, promo tile, marquee
- [ ] Paste listing copy per locale from `store/LISTING.md`
- [ ] Paste permission justifications (storage / alarms / notifications / host)
- [x] Privacy policy hosted: `https://blueskyz-labs.github.io/muse-auto-allow/privacy.html` (verified live 2026-10-12) — paste it into the dashboard
- [ ] Build + verify the zip (done at the v1.9.3 freeze: `dist/muse-auto-allow-v1.9.3.zip`, 185,014 bytes, sha256 `e3dd7703b85fffd9ad5b78a8b353c90929f4b87487f3d9dc932fdb2c5f140326`, verify-zip 18/0); upload it to the CWS
- [ ] Review the screenshot captures against the frozen v1.9.3 build before upload — they were not re-captured for v1.9.3, and a fresh install now starts in logging-only (a first-run state the current captures predate)
