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

Quiet Luxury tokens (`docs/QUIET_LUXURY_SPEC.md` §2, applied in Phase 2):

| Token | Light | Dark (`prefers-color-scheme: dark`) |
|---|---|---|
| `--bg` (page/popup) | `#faf9f7` | `#161719` |
| `--surface` (cards/overlays) | `#ffffff` | `#1f2023` |
| `--ink` (primary text) | `#17181c` | `#eceef2` |
| `--ink-2` (section titles) | `#3a3d44` | `#c9cdd4` |
| `--muted` (secondary) | `#5c6069` | `#a6abb5` |
| `--line` (card/component border) | `#e8e6e0` | `#2c2e33` |
| `--divide` (in-flow rules) | `rgba(23,24,28,.10)` | `rgba(236,238,242,.18)` |
| `--stroke` (control outline) | `rgba(23,24,28,.16)` | `rgba(236,238,242,.16)` |
| `--fill` (controls) | `rgba(23,24,28,.045)` | `rgba(236,238,242,.06)` |
| `--accent` (text/state) | `#005abf` | `#0a5ce0` |
| `--accent-state` (toggle ON track) | `#005abf` | `#4d8ef7` |
| `--accent-text` (selected text) | `#005abf` | `#8ab8ff` |
| `--accent-tint` (one selection recipe) | `rgba(0,90,191,.10)` | `rgba(10,92,224,.22)` |
| `--accent-line` (selection edge) | `rgba(0,90,191,.28)` | `rgba(10,92,224,.50)` |
| `--btn-ink` (primary pill) | `#17181c` | `#e9ebef` |
| `--bar-day` (mini-chart day bar) | `#0f63e6` @ .75 | `#5aa5ff` @ .75 |
| `--grid` (mini-chart y-max gridline) | `rgba(23,24,28,.22)` | `rgba(228,230,235,.40)` |
| `--focus` | `#005abf` | `#7cb0ff` |
| Brand gradient | `#0082FB → #0064E0 → #0040DC` | same |
| Cream accent (soft blobs, store art only) | `#f3d9b4` | — |
| Success dot | `#31a24c` | `#45c463` |

Contrast — recomputed from the shipped CSS (WCAG 2.x relative luminance + 8-bit alpha
compositing). **Every rendered text pair ≥ 4.5:1 (light 16.86:1 … 5.22:1, dark 15.44:1 … 5.61:1).**

Light: `--ink` on page **16.86:1**, on card **17.74:1**; `--muted` on page **5.99:1**, on card
**6.30:1**, on control fill `.045`/page **5.48:1**; ink on control fill `.045`/page (input
value) **15.44:1**; white on the graphite primary **17.74:1**; accent on page **6.21:1**, on
card **6.53:1**, on selected tint `.10`/page **5.33:1** / card **5.59:1**; "sent" pill text on
its `.14` tint **5.38:1**; "expand" log chip text on its `.55` tint **5.22:1**; KPI glyph on
the 8 % tile tint/card **6.42:1**; focus ring vs page **6.21:1** (non-text ≥ 3:1).

Dark: `--ink` on page **15.44:1**, on card **14.02:1**; `--muted` on page **7.78:1**, on card
**7.07:1**, on fill `.06`/page **6.74:1**; ink on fill `.06`/page **13.37:1**; ink on the ivory
primary **14.86:1**; accent text `#8ab8ff` on page **8.87:1**, on tint `.22`/page **7.46:1** /
card **6.80:1**; "today" label `#7cb0ff` on card **7.38:1**; "sent" pill text on its `.18` tint
**6.70:1**; "expand" log chip text on its `.18` tint **7.07:1**; KPI glyph on the 8 % tile
tint/card **5.61:1**; focus ring vs page **8.12:1** (non-text ≥ 3:1).

State-defining non-text pairs (≥ 3:1), sampled from the rendered output:

| Pair | Light | Dark |
|---|---|---|
| Toggle ON track vs OFF track | `#005abf` vs `#f0efed` = **5.68:1** | `#4d8ef7` vs `#232426` = **4.83:1** (shipped was **1.85:1** — this is the fix) |
| White knob vs ON track | **6.53:1** | **3.22:1** |
| Mini-chart day bar vs popup bg | shipped `#0082FB`@.5 = 1.88:1 → `#0f63e6`@.75 = **3.32:1** | shipped `#0082FB`@.5 = 2.06:1 → `#5aa5ff`@.75 = **4.52:1** |
| Mini-chart "today" gradient vs popup bg | `#0040DC` **7.80:1** / `#00289c` **10.65:1** | `#a9caff` **10.41:1** / `#7fb0ff` **8.70:1** |

Note (record accuracy): the Phase-1 spec §5.4 illustrated the toggle OFF track as `#d6d5d4`
(light) / `#414244` (dark). The shipped CSS defines it as `--fill` + an inset `--stroke`
hairline, which composites to `#f0efed` / `#232426` — the measured ratios above are taken from
the rendered pixels, not from the spec's illustrative composites. The fix intent (dark ON/OFF
above the 3:1 floor, up from 1.85:1) holds either way.

`--ink-2` is now consumed by the popup's section title (Composition pass, below): `#3a3d44` on the
page **10.34:1** (light) / `#c9cdd4` on the page **11.25:1** (dark).

Selected-state pills share ONE recipe — `--accent-tint` fill + 1px `--accent-line` + accent
text + weight 500 (popup: quick combos, library tabs, phrase chips, `fcount`, `froti .src`,
the log `allow` tag; stats: none). Recorded pairs: light accent on tint `.10`/page **5.33:1**;
dark accent text on tint `.22`/page **7.46:1** (the v1.7.0 dark phrase-chip fallback defect is
structurally removed — the recipe now has a single dark definition).

**Status pills are NOT selections** (Composition pass): the header tab-count badge and the
follow-up status pill use a neutral `--fill` + `--stroke` shell and carry their state in the
DOT — `--ok` `#146c2e` on `--fill`/page **5.69:1** (light) / `#5fd07a` **7.98:1** (dark) when
connected, `--accent-state` while working. This removes two of the six jobs the accent used to do.

**Primary action** (Composition pass): the contextual `Send now` is the primary graphite/ivory
pill (`--on-btn` on `--btn-ink` **17.74:1** / **14.86:1**); the footer `Statistics` navigation CTA
is a new `.btn.ghost` (transparent + an inset 1px `--stroke` ring, so its height is unchanged).

**Mini-chart scale** (Composition pass): the popup mini chart mirrors the Statistics chart — a
dashed y-max gridline at `--grid` with its value as a muted tick numeral (5.99:1 / 7.78:1), plus a
`●` legend reusing the existing `todayLabel` key. The `--grid` hairline is decorative (1.59:1
light / 3.47:1 dark), the same class as `--axis`/`--divide`; the value is carried by the numeral.

### 3.1 Data-visualization palette (Statistics dashboard + designed assets)

Topic bars/dots and KPI chips cycle a curated five-hue palette; the trend chart is deliberately
single-hue (brand blue + one "today" accent). Each hue is recorded with a lighter "top" and a
deeper "bottom" stop for gradient use (the trend chart takes the blue stops; the topic bars and
dots themselves are solid `--tc`). The segmented control, focus ring and designed-asset accents
reuse the same hues.
Every stop is ≥ 4.5:1 against the card surface it sits on — the 3:1 non-text minimum
(WCAG 1.4.11) is met with headroom, so the same tokens stay safe for small glyphs
(KPI chips, dots) as well.

| Hue | Light top / bottom stop | vs `#ffffff` (card) | Dark top / bottom stop | vs `#1f2023` (card) |
|---|---|---|---|---|
| Blue (brand) | `#0f63e6` / `#0a4fc4` | 5.32:1 / 7.17:1 | `#5aa5ff` / `#3f8ceb` | 6.41:1 / 4.78:1 |
| Rose | `#c2263f` / `#a51e35` | 5.76:1 / 7.40:1 | `#ff8296` / `#f06680` | 6.89:1 / 5.37:1 |
| Teal | `#0e8571` / `#0a6d5d` | 4.55:1 / 6.25:1 | `#35d2b8` / `#22b89e` | 8.58:1 / 6.53:1 |
| Amber | `#bf5700` / `#a34705` | 4.59:1 / 6.07:1 | `#f2b435` / `#dfa11c` | 8.81:1 / 7.18:1 |
| Violet | `#6d3ad6` / `#5c2fb8` | 6.51:1 / 8.22:1 | `#ab93fb` / `#9a83f5` | 6.44:1 / 5.38:1 |

- Trend chart (single series → single hue; colour encodes nothing): the five-hue stops and the
  brand-blue value gradient are **frozen** (Quiet Luxury spec §6 rule 7) — every bar keeps the
  brand-blue value gradient (light `#0f63e6 → #0a4fc4`, dark `#5aa5ff → #3f8ceb`); the latest
  ("today") bar carries the brand-gradient accent — light stops `#0040DC / #0030b0 / #00289c`
  (7.59:1 / 10.25:1 / 11.77:1 on `#ffffff`), dark stops `#a9caff / #97c0ff / #7fb0ff`
  (9.76:1 / 8.77:1 / 7.41:1 on `#1f2023`) — with a `#005abf` (light) / `#7cb0ff` (dark) outline
  and matching "now" value/label ink (6.53:1 on white / 7.38:1 on `#1f2023`). A dashed y-max
  gridline + tick (22 % alpha light / 40 % dark) anchors the vertical scale; the baseline
  hairline is 20 % light / 36 % dark.
- Cycle order (positional): blue → rose → teal → amber → violet. Topic rows take the next hue by
  rank (decorative — bar length is the datum); KPI chips fix it as Total = blue, Today = rose,
  This week = teal, This month = amber. KPI icon tile = an **8 %** tint + a 16 % inset hairline
  (Quiet Luxury §3 #7), glyph ink = the deeper stop in light (5.48–7.27:1) and the bright stop in
  dark (5.61–7.51:1).
- Segmented control (Quiet Luxury §3 #12): the active pill is **ink**, not blue — white on
  `#17181c` 17.74:1 (light) / `#17181c` on `#e9ebef` 14.86:1 (dark); inactive = `--muted`.
  Focus ring: `#005abf` on `#faf9f7` 6.21:1 (light) / `#7cb0ff` on `#161719` 8.12:1 (dark).
- Chart baseline and topic-row dividers are decorative (non-informational) hairlines
  (20–22 % alpha light / 36–40 % dark) — not part of the data encoding. Topic dots are 8px with
  a 12 % halo, topic bars 8px on a `--line`-bordered track (Quiet Luxury §3 #13).
- Designed-asset accent pairs (light theme): amber chip text `#8f4100` on an 11–12 % amber tint
  6.13–6.23:1; log pills `#0047a3` / `#8f4100` / `#57289f` on 12–14 % tints 7.02:1 / 6.13:1 /
  7.88:1; teal trust + badge text `#0a6d5d` on an 11–12 % teal tint 5.30–5.34:1.

## 4. Type & shape

- Font stack: `"Optimistic", "optimisticAI", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`
  (falls back to the platform UI font where Optimistic is absent — no font is bundled).
- Headings: weight 500; −0.01em tracking at title size, −0.02em at display size (24px). Body
  13px/1.5 (popup) and 14px/1.55 (Statistics). Micro-caption tier: 10.5px / 500 / +0.08em /
  uppercase for short captions and KPI labels only — CSS `text-transform`, never localized
  sentences. KPI value 30px / 600 / −0.025em. Numbers tabular.
- Shape: **pills everywhere** (buttons, chips, inputs, segmented control — 999px);
  cards **16px** radius (popup cards + sheets and the Statistics page; 16–20px in designed
  assets); icon tile 26%.

## 5. Assets

| File | Purpose |
|---|---|
| `assets/icon.html` / `icon-small.html` | icon sources (rendered to `extension/icons/*`) |
| `assets/promo-tile.html` | 440×280 store promo tile (centered hero, cream/blue blobs, palette-dot chips) |
| `assets/store-screenshot.html` | designed overview → `store/screenshot4-overview.png` (approval card + layered mini Statistics card) |
| `assets/marquee.html` | 1400×560 two-zone marquee → `store/marquee1400x560.png` (copy + layered popup/Statistics cards) |
| `store/screenshot1.png` | REAL runtime capture (`scripts/store-shot.mjs`: live popup + live card clicks) |
| `store/screenshot2-stats.png` | Statistics page, real render (`scripts/stats-shot.mjs`) — premium data-viz palette |
| `store/screenshot3-popup.png` | popup, real render (`scripts/stats-shot.mjs`) — **stale**: see note |

All demo data in public assets is **fictional** (`Example Org`, `demo-project`,
`sample-app`, `web-starter`, `notes-app`, `files.example.com`). Never use real projects,
real repositories or personal data in store assets.

**Store popup capture — known blocker (Quiet Luxury Phase 2, P2-11).** Both popup-capturing
scripts (`scripts/stats-shot.mjs`, `scripts/store-shot.mjs`) seed `chrome.storage.local` with
their demo data but do **not** seed `onboarded: true`. Since v1.8.0 the popup renders its
3-step onboarding wizard whenever `onboarded !== true`, so a fresh run of either script captures
the **wizard**, not the popup. The Quiet Luxury Phase-2 lane therefore regenerated
`screenshot2-stats.png` (Statistics — unaffected by the wizard) and left `screenshot1.png` /
`screenshot3-popup.png` at their previous revision. Fix: add `onboarded: true` to both scripts'
seed objects, then re-run them; the popup assets will then show the Quiet Luxury UI (they
currently also predate the v1.8.1 language switcher).

## 6. Rules

1. Store/showcase assets must be **real renders** where the product itself is shown
   (SGPS E2: rendered reality > source inference > mockup).
2. The mark must not be redrawn ad-hoc: change `assets/icon*.html` + re-run
   `scripts/render.mjs`.
3. Never substitute Muse/Meta trademarks for our mark; style compatibility only.
4. Dark mode must keep every text/background pair ≥ AA.
5. Data-viz colour must come from the §3.1 tokens; any new colour pair ships with its computed
   WCAG ratio here (text ≥ 4.5:1, UI components ≥ 3:1) in every theme where it exists.
