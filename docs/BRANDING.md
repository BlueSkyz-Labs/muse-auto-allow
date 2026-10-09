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
(light); white on `--blue` 6.53:1 (light) / 5.80:1 (dark `#0a5ce0`). The dark accent is a
filled-control background (paired with white text, 5.80:1), not body text on `--bg`.
All shipped text pairs ≥ 5.30:1 (WCAG AA).

### 3.1 Data-visualization palette (Statistics dashboard + designed assets)

Topic bars/dots and KPI chips cycle a curated five-hue palette; the trend chart is deliberately
single-hue (brand blue + one "today" accent). Each hue has a lighter "top" and a deeper "bottom"
gradient stop; the segmented control, focus ring and designed-asset accents reuse the same hues.
Every stop is ≥ 4.5:1 against the card surface it sits on — the 3:1 non-text minimum
(WCAG 1.4.11) is met with headroom, so the same tokens stay safe for small glyphs
(KPI chips, dots) as well.

| Hue | Light top / bottom stop | vs `#ffffff` (card) | Dark top / bottom stop | vs `#242526` (card) |
|---|---|---|---|---|
| Blue (brand) | `#0f63e6` / `#0a4fc4` | 5.32:1 / 7.17:1 | `#5aa5ff` / `#3f8ceb` | 6.04:1 / 4.51:1 |
| Rose | `#c2263f` / `#a51e35` | 5.76:1 / 7.40:1 | `#ff8296` / `#f06680` | 6.50:1 / 5.06:1 |
| Teal | `#0e8571` / `#0a6d5d` | 4.55:1 / 6.25:1 | `#35d2b8` / `#22b89e` | 8.09:1 / 6.16:1 |
| Amber | `#bf5700` / `#a34705` | 4.59:1 / 6.07:1 | `#f2b435` / `#dfa11c` | 8.30:1 / 6.77:1 |
| Violet | `#6d3ad6` / `#5c2fb8` | 6.51:1 / 8.22:1 | `#ab93fb` / `#9a83f5` | 6.07:1 / 5.07:1 |

- Trend chart (single series → single hue; colour encodes nothing): every bar shares the
  brand-blue value gradient (light `#0f63e6 → #0a4fc4`, dark `#5aa5ff → #3f8ceb`); the latest
  ("today") bar carries the brand-gradient accent — light stops `#0040DC / #0030b0 / #00289c`
  (7.59:1 / 10.25:1 / 11.77:1 on `#ffffff`), dark stops `#a9caff / #97c0ff / #7fb0ff`
  (9.20:1 / 8.26:1 / 6.99:1 on `#242526`) — with a `#005abf` (light) / `#7cb0ff` (dark) outline
  and matching "now" value/label ink (6.53:1 on white / 6.95:1 on `#242526`). A dashed y-max
  gridline + tick (34 % alpha light / 50 % dark) anchors the vertical scale.
- Cycle order (positional): blue → rose → teal → amber → violet. Topic rows take the next hue by
  rank (decorative — bar length is the datum); KPI chips fix it as Total = blue, Today = rose,
  This week = teal, This month = amber. Chip glyph ink is the deeper stop on a 13 % tint in light
  (5.10–6.02:1) and the bright stop on a 13 % tint in dark (4.83–6.28:1).
- Segmented control: white on `#005abf` 6.53:1 (light) / `#0a5ce0` 5.80:1 (dark).
  Focus ring: `#005abf` on `#fcfcfc` 6.37:1 (light) / `#7cb0ff` on `#18191a` 7.97:1 (dark).
- Chart baseline and topic-row dividers are decorative (non-informational) hairlines
  (26–32 % alpha light / 20–36 % dark) — not part of the data encoding.
- Designed-asset accent pairs (light theme): amber chip text `#8f4100` on an 11–12 % amber tint
  6.13–6.23:1; log pills `#0047a3` / `#8f4100` / `#57289f` on 12–14 % tints 7.02:1 / 6.13:1 /
  7.88:1; teal trust + badge text `#0a6d5d` on an 11–12 % teal tint 5.30–5.34:1.

## 4. Type & shape

- Font stack: `"Optimistic", "optimisticAI", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`
  (falls back to the platform UI font where Optimistic is absent — no font is bundled).
- Headings: weight 500, letter-spacing −0.01em. Body 13–15px. Numbers tabular.
- Shape: **pills everywhere** (buttons, chips, inputs, segmented control — 999px);
  cards 16–18px radius (18px on the Statistics page, 16–20px in designed assets); icon tile 26%.

## 5. Assets

| File | Purpose |
|---|---|
| `assets/icon.html` / `icon-small.html` | icon sources (rendered to `extension/icons/*`) |
| `assets/promo-tile.html` | 440×280 store promo tile (centered hero, cream/blue blobs, palette-dot chips) |
| `assets/store-screenshot.html` | designed overview → `store/screenshot4-overview.png` (approval card + layered mini Statistics card) |
| `assets/marquee.html` | 1400×560 two-zone marquee → `store/marquee1400x560.png` (copy + layered popup/Statistics cards) |
| `store/screenshot1.png` | REAL runtime capture (`scripts/store-shot.mjs`: live popup + live card clicks) |
| `store/screenshot2-stats.png` | Statistics page, real render (`scripts/stats-shot.mjs`) — premium data-viz palette |
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
5. Data-viz colour must come from the §3.1 tokens; any new colour pair ships with its computed
   WCAG ratio here (text ≥ 4.5:1, UI components ≥ 3:1) in every theme where it exists.
