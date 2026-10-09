# Brand Kit — Muse Auto-Allow v2 (2026-10-09)

> Public-release brand kit. Everything here is original to BlueSkyz Labs; the visual
> language is *compatible with* Muse's design system without copying any Muse/Meta
> trademark (logo, squiggle mark, wordmark or product imagery).

## 1. Why v2

The v1 kit (cream tile + blue gradient check + sparkle) was warm and readable, but the
product lives inside **muse.ai** — a light, calm, pill-shaped, Meta-family interface.
v2 adopts that language so the extension feels like a native part of the Muse workflow.

Evidence base (recon 2026-10-09, captured from the live site):

| Token | Live muse.ai value | Source |
|---|---|---|
| Page background | `#fcfcfc` | computed styles |
| Primary text | `#111112` | computed styles |
| Accent button (pill) | `#005abf`, white text, fully rounded | computed styles |
| Link blue | `#0064d4` | computed styles |
| Brand gradient (logo/app icon) | `#0082FB → #0064E0 → #0040DC` | muse-logo.svg / muse-app-icon.svg |
| Inputs | `rgba(0,0,0,.05)` fill, no border, 20px radius | computed styles |
| Type | Optimistic family; headings weight 500, tight tracking (−0.01em) | computed styles |
| App icon structure | rounded-square container (radius ≈ 24%), glyph inside | muse-app-icon.svg |

## 2. The mark (original)

- **Concept:** a white **check** on a rounded-square tile — "the Allow button, automated".
  The check is our own mark; it deliberately does **not** reproduce Muse's squiggle "m".
- **Tile:** radius 26% (133/512), flat, filled with the brand gradient (diagonal
  72,60 → 452,464).
- **Check:** stroke 70/512 (86/512 in the 16–32 px variant), round caps/joins, pure white.
- **Provenance:** the gradient is Muse-adjacent by design (visual compatibility inside Muse's
  own UI); the mark geometry is original — no Muse/Meta logo shapes. Shape re-checked
  2026-10-09 (icon16/128, promo, overview): no squiggle/infinity resemblance.
- **Sizes:** 16 / 32 (bold variant), 48 / 128 / 512 (standard). Rendered by
  `scripts/render.mjs` from `assets/icon.html` + `assets/icon-small.html`.
- **Motion:** in the popup header the check draws in (stroke-dashoffset, 0.55 s); disabled
  under `prefers-reduced-motion` with a pinned final state.

## 3. Color tokens

| Token | Light | Dark (`prefers-color-scheme: dark`) |
|---|---|---|
| `--bg` (page/popup) | `#fcfcfc` | `#18191a` |
| `--surface` (cards) | `#ffffff` | `#242526` |
| `--ink` (primary text) | `#111112` | `#e4e6eb` |
| `--muted` (secondary) | `#4a4e54` | `#b0b3b8` |
| `--line` (borders) | `rgba(17,17,18,.08)` | `#3e4042` |
| `--fill` (controls) | `rgba(17,17,18,.05)` | `#3a3b3c` |
| `--blue` (accent / buttons) | `#005abf` | `#0a5ce0` |
| Brand gradient | `#0082FB → #0064E0 → #0040DC` | same |
| Cream accent (soft blobs) | `#f3d9b4` | — |
| Success dot | `#31a24c` | `#45c463` |

Contrast (computed from these tokens): `--ink` on `--bg` 18.39:1; `--muted` on `--bg` 8.16:1
(light); white on `--blue` 6.0:1 (light) / 5.80:1 (dark `#0a5ce0`). The dark accent is a
filled-control background (paired with white text, 5.80:1), not body text on `--bg`.
All shipped text pairs ≥ 5.30:1 (WCAG AA).

## 4. Type & shape

- Font stack: `"Optimistic", "optimisticAI", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`
  (falls back to the platform UI font where Optimistic is absent — no font is bundled).
- Headings: weight 500, letter-spacing −0.01em. Body 13–15px. Numbers tabular.
- Shape: **pills everywhere** (buttons, chips, inputs, segmented control — 999px);
  cards 16px radius; icon tile 26%.

## 5. Assets

| File | Purpose |
|---|---|
| `assets/icon.html` / `icon-small.html` | icon sources (rendered to `extension/icons/*`) |
| `assets/promo-tile.html` | 440×280 store promo tile (centered hero, cream/blue blobs) |
| `assets/store-screenshot.html` | designed overview → `store/screenshot4-overview.png` |
| `store/screenshot1.png` | REAL runtime capture (`scripts/store-shot.mjs`: live popup + live card clicks) |
| `store/screenshot2-stats.png` | Statistics page, real render (`scripts/stats-shot.mjs`) |
| `store/screenshot3-popup.png` | popup, real render (`scripts/stats-shot.mjs`) |

All demo data in public assets is **fictional** (`Example Org`, `demo-project`,
`sample-app`, `web-starter`, `notes-app`, `files.example.com`). Never use real projects,
real repositories or personal data in store assets.

## 6. Rules

1. Store/showcase assets must be **real renders** where the product itself is shown
   (SGPS E2: rendered reality > source inference > mockup).
2. The mark must not be redrawn ad-hoc: change `assets/icon*.html` + re-run
   `scripts/render.mjs`.
3. Never substitute Muse/Meta trademarks for our mark; style compatibility only.
4. Dark mode must keep every text/background pair ≥ AA.
