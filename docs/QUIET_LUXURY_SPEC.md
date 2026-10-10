# Quiet Luxury — Design Language Spec (Phase 1, proposal)

**Status:** design proposal for the Muse Auto-Allow extension (popup + Statistics page).
**Scope:** visual language only — tokens, component treatment, motion, accessibility. No markup/behaviour change is proposed in this document; Phase 2 applies it.
**Phase-1 write set:** `docs/QUIET_LUXURY_SPEC.md`, `assets/quiet-luxury-mockup.html` (mockup render stays in the Hermes scratch dir — no PNG is added to the repo).
**Baseline:** extension v1.7.0 (`extension/popup.html`, `extension/stats.html`, `docs/BRANDING.md`); every "current" value below is read from those files.
**Method:** all contrast values were computed in Python from the actual hex/alpha tokens with WCAG 2.x relative luminance and 8-bit alpha compositing (script kept in the Hermes scratch dir). No ratio in this document is estimated by eye.

---

## 1. Design intent

Quiet Luxury = **the product looks expensive because nothing shouts.** Five rules drive every change below:

1. **Neutral-dominant, accent-scarce.** Blue currently appears on the primary buttons, toggles, chips, bars, links and dividers at once, so it stops meaning anything. The proposal moves primary actions to graphite/ivory and keeps the brand blue strictly for *state* (on, selected, focus) and for the brand mark. Reason: scarcity is what makes an accent read as premium.
2. **Paper, not screen.** The page background shifts from clinical `#fcfcfc` to a warm ivory `#faf9f7` (and dark `#18191a` → deeper graphite `#161719`); surfaces stay pure white / raised graphite. Reason: warm neutrals photograph and scan softer, reduce glare, and let white cards read as *elevated* rather than as the default.
3. **Hairlines and air, not boxes.** Dividers, card borders and control outlines drop to 1px hairlines; filled grey boxes are replaced by outlined controls where the fill carried no meaning; vertical rhythm gains 1–2px per step. Reason: fewer filled rectangles = less visual noise at the same information density.
4. **Value first.** Numbers get bigger (KPI 28 → 30px) and their chrome gets quieter (icon tints 13% → 8%, captions become small caps). Reason: in a data surface the datum is the luxury; labels should step back.
5. **Motion you feel, not see.** Everything moves ≤ 240ms on one soft easing curve; entrances fade instead of sliding; reduced motion pins every final state. Reason: tasteful micro-interaction is a timing decision, not an animation inventory.

Recognisability guard: the 320px popup, the ≤600px cap, the DOM order, the component inventory (toggles, chips, sheet, log, charts), the mark, the type stack and the data-viz palette are all unchanged. Only the *treatment* changes.

---

## 2. Token deltas

### 2.1 Neutrals, ink, surfaces

| Token | Light current (v1.7.0) | Light proposed | Dark current | Dark proposed | Why |
|---|---|---|---|---|---|
| `--bg` | `#fcfcfc` | `#faf9f7` | `#18191a` | `#161719` | Warm ivory / deeper graphite: less glare, cards separate by contrast instead of by border weight |
| `--surface` | `#ffffff` | `#ffffff` | `#242526` | `#1f2023` | Unchanged in light; dark surface drops so the popup background can read as a *layer* under it (sheet/cards) |
| `--ink` | `#111112` | `#17181c` | `#e4e6eb` | `#eceef2` | Near-black with a trace of blue-grey; softer edge on ivory, still 16.9:1 / 15.4:1 |
| `--muted` | `#4a4e54` | `#5c6069` | `#b0b3b8` | `#a6abb5` | Secondary text steps back visually but stays ≥ 5.99:1 (light) / 7.78:1 (dark) |
| `--ink-2` (new) | — | `#3a3d44` | — | `#c9cdd4` | Optional intermediate tier for log context / long copy that should not read as a label |

### 2.2 Accent, state, semantic

| Token | Light current | Light proposed | Dark current | Dark proposed | Why |
|---|---|---|---|---|---|
| `--accent` (text/state) | `#005abf` | `#005abf` (unchanged) | `#0a5ce0` / `#8ab8ff` | `#8ab8ff` text, `#4d8ef7` state | Dark **ON-state track** becomes `#4d8ef7`: the shipped `#0a5ce0` track measured only **1.85:1** against the off-track (state barely distinguishable); `#4d8ef7` measures **3.13:1** vs the off-track *and* **3.22:1** against the white knob — both ≥ 3:1 |
| `--accent-tint` | `rgba(0,90,191,.10–.16)` | `rgba(0,90,191,.10)` | `rgba(10,92,224,.25–.32)` | `rgba(10,92,224,.22)` | One selected-state recipe everywhere (was five different alphas). Dark drops `.32 → .22`: four blue-tinted pills in one popup read as competing "primary" fills on graphite; at `.22` the tint still measures **7.46:1** for its text (vs 6.72:1) and the border carries the selection |
| `--accent-line` (new) | `rgba(0,90,191,.30)` (ad hoc) | `rgba(0,90,191,.28)` | `rgba(10,92,224,.50)` | `rgba(10,92,224,.50)` | A selected chip needs an edge, not a stronger fill |
| `--btn-ink` (new) | — (primary = blue) | `#17181c`, text `#ffffff` | — | `#e9ebef`, text `#17181c` | Primary actions become graphite (light) / ivory (dark) — the quiet-luxury signature; white-on-ink **17.74:1**, ink-on-ivory **14.86:1** |
| `--accent-filled` | `#005abf` | reserved | `#0a5ce0` | reserved | Kept in the palette (white on it = 6.53:1 / 5.80:1) for any future accent-filled control; not used by default |
| `--bar-day` / `--bar-today` (new) | brand gradient @ 50% opacity (both themes) | `#0f63e6` @ .75 / gradient `#0040DC → #00289c` | brand gradient @ 50% opacity | `#5aa5ff` @ .75 / gradient `#a9caff → #7fb0ff` | Data bars become theme-aware solids; the gradient is reserved for the "today" datum. Fixes a measured defect: the shipped mini bars are **1.88:1** (light) / **2.06:1** (dark) against the popup background, under the 3:1 graphical-object floor (see §3 #11, §5.4) |
| `--ok` / `--ok-bg` | `#146c2e` / `rgba(49,162,76,.14)` | unchanged | `#5fd07a` / `rgba(69,196,99,.20)` | `#5fd07a` / `rgba(69,196,99,.18)` | "sent" pill keeps its verified pair (5.38:1 / 6.70:1) |
| `--amber` / `--amber-bg` | `#7a5a20` / `rgba(243,217,180,.55)` | unchanged | `#e8c98a` / `rgba(243,217,180,.18)` | unchanged | Log "expand" chip stays as shipped (5.22:1 / 7.07:1) |
| `--focus` | `#005abf` | unchanged | `#7cb0ff` | unchanged | Focus ring already passes (6.21:1 / 8.12:1) — do not touch a verified affordance |

### 2.3 Borders, fills

| Token | Light current | Light proposed | Dark current | Dark proposed | Why |
|---|---|---|---|---|---|
| `--line` (card/component border) | `rgba(17,17,18,.08)` | `#e8e6e0` | `#3e4042` | `#2c2e33` | A solid warm hairline reads crisper than alpha grey on ivory and does not shift with the surface under it |
| `--divide` (in-flow dividers) | `rgba(17,17,18,.16)` | `rgba(23,24,28,.10)` | `rgba(228,230,235,.18)` | `rgba(236,238,242,.18)` | Section/log rules are decorative: on ivory `.10` (1.16:1) reads as a fine rule; on graphite a `.14` hairline disappears (1.46:1), so dark keeps the shipped `.18` (1.68:1). Every text pair is measured against its own surface, never against a hairline |
| `--stroke` (control outline) | `rgba(17,17,18,.16)` | `rgba(23,24,28,.16)` | `rgba(228,230,235,.22)` | `rgba(236,238,242,.16)` | Strength kept (no a11y regression); only the hue is warmed to match the new neutrals |
| `--fill` (controls) | `rgba(17,17,18,.05)` | `rgba(23,24,28,.045)` | `#3a3b3c` | `rgba(236,238,242,.06)` | Slightly quieter; dark becomes an alpha so it composites correctly over both `--bg` and `--surface` |
| `--fill-hover` (new) | — | `rgba(23,24,28,.075)` | — | `rgba(236,238,242,.10)` | One documented hover step instead of per-component ad-hoc values |
| `--panel` | `rgba(17,17,18,.035)` | `rgba(23,24,28,.03)` | `rgba(255,255,255,.045)` | `rgba(236,238,242,.04)` | The follow-up panel keeps a whisper of fill only while it is open |

### 2.4 Shadows (soft, layered: tight ambient + broad soft)

| Token | Light proposed | Dark proposed | Why |
|---|---|---|---|
| `--sh-1` (controls) | `0 1px 2px rgba(23,24,28,.05)` | `0 1px 2px rgba(0,0,0,.35)` | A single 1px ambient; enough to seat a pill on paper |
| `--sh-2` (cards) | `0 1px 1px rgba(23,24,28,.03), 0 14px 34px -22px rgba(23,24,28,.26)` | `0 1px 1px rgba(0,0,0,.30), 0 16px 36px -24px rgba(0,0,0,.75)` | Two layers: a contact edge + a wide negative-spread halo. Cards read lifted, never "glowy" |
| `--sh-3` (sheets/overlays) | `0 2px 6px rgba(23,24,28,.05), 0 28px 60px -30px rgba(23,24,28,.38)` | `0 2px 8px rgba(0,0,0,.45), 0 30px 64px -32px rgba(0,0,0,.90)` | Overlays need a clear step above `--sh-2` without a hard black rim |

Hard rule: no shadow in the set exceeds 40% alpha, and no element carries more than two shadow layers.

### 2.5 Radii and spacing scale

| Token | Current | Proposed | Why |
|---|---|---|---|
| `--r-pill` | `999px` | `999px` | Pills are the product's shape language — keep them |
| `--r-card` | `18px` | `16px` | At 16px with a hairline the card edge reads composed; 18px+ starts to read "consumer-soft" |
| `--r-panel` | `14px` | `14px` | Unchanged (nested inside the popup) |
| `--r-field` | `12px` | `12px` | Unchanged (textarea/select) |
| `--r-tile` | `12px` | `12px` | Unchanged (38px KPI icon tile) |
| spacing scale | ad hoc | `2, 4, 6, 8, 12, 16, 20, 24, 32, 40` | One 4-based ladder; every gap in the spec is a step on it |

**Rhythm rules (popup).** Row vertical margin 4 → 5px; section `margin-top` 8px, `padding-top` 6 → 8px; log `padding-top` 4 → 6px; footer `margin/padding-top` 5 → 8px; horizontal padding stays 14px (the 320px body and the 292px mini-chart width are a shipped contract — see Phase-2 plan, step P2-8, for the optional 16px variant). **Budget rule:** the popup must stay ≤ 600px in every state (shipped measurements: empty 561, full log 590). Apply the spacing steps in the order listed and drop the last steps first if the harness measures > 600.

**Rhythm rules (Statistics).** Page padding 20/32 → 24/32; card padding 14/18 → 16/20; grid gap 12 → 14; card gap 12 → 16.

**Follow-up panel geometry (measured against the shipped popup at 320px).** The panel is a tint band with **vertical padding only** (7px, no side padding, no border) — that is what keeps the quick-combo row on one line: label 68px + chips 70.7 / 59.7 / 76.3px + 4px gaps = **286.7px inside the 292px content column**. The same geometry lets the Wait/Cooldown pills keep the shipped fixed **86px** width, which is what aligns their two labels in a column. Adding horizontal panel padding or a panel border re-wraps the chip row (measured) — so both are explicitly rejected. The Wait/Cooldown row also stays **single-row** (a two-row label/control table would add ~29px and break the ≤600px popup budget); its alignment is carried by the two equal-width pills, not by stacking the labels.

### 2.6 Type scale

Font stack unchanged: `"Optimistic", "optimisticAI", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif` (no bundled font, no new dependency).

| Role | Current | Proposed | Why |
|---|---|---|---|
| Display (stats h1) | 24px / 500 / −0.01em | 24px / 500 / **−0.02em** / 1.25 | Tighter tracking at display size is the cheapest way to look typeset rather than default |
| Title (popup h1) | 13.5px / 500 / −0.01em | **14px** / 500 / −0.01em / 1.35 | One clean step; the popup title should outrank its own labels by size, not by colour |
| Body (popup) | 13px / 400 / 1.45 | 13px / 400 / **1.5** | +0.05 line-height = air in a dense column |
| Body (stats) | 14px / 400 / 1.5 | 14px / 400 / **1.55** | Same reason, one step up |
| Label (chips, stat labels) | 11px / 500 | 11px / 500 / **+0.01em** / 1.4 | A label tier distinct from body: same size family, positive tracking, never used for sentences |
| Micro-caption (new) | (12–12.5px sentence case) | **10.5px / 500 / +0.08em / uppercase** | The editorial tier: chart captions, KPI labels, "Last 7 days". Caps + tracking reads *larger* than its size and separates the label tier from the body tier without adding weight. **i18n rule:** apply only to these short caption strings; never to localized sentences |
| Numeral (popup counters) | 15px / 600 / tabular | unchanged | Already correct |
| KPI value | 28px / 600 / −0.02em | **30px** / 600 / **−0.025em** / 1.1 | Value first: the datum grows, the chrome shrinks |
| Chart value / tick | 11px / 500, 10.5px | unchanged | Verified legible (F10 disposition) — no churn |

---

## 3. Component refinements (before → after)

| # | Component | Before (v1.7.0) | After (Quiet Luxury) | Principle |
|---|---|---|---|---|
| 1 | **Primary button** (Statistics, Export data) | solid `#005abf` pill, white text, hover `filter: brightness(.94)` | graphite pill (`--btn-ink`, light) / ivory pill (dark), hover = 6% step toward the page colour + `--sh-1`, pressed = 10% step, radius 999 | Accent is reserved for state; a neutral primary reads deliberate. Hover is a defined colour step, not a filter |
| 2 | **Tonal button** (Send now) | tint .10–.16 fill, no border, accent text | tint `.10` fill + 1px `--accent-line` border, accent text; hover tint `.14` | An outlined tonal keeps the accent signal but removes a filled box from a dense row |
| 3 | **Neutral controls** (Import data, quick-combo chips, sheet tabs) | grey fill, no border, hover = blue tint | transparent + hairline `--stroke`; hover = `--fill` + border `rgba(23,24,28,.20)` | Outline > fill for neutral affordances: fewer filled rectangles = calmer panel |
| 4 | **Selected chip / tab / pill** (`.qbtn.on`, `.ftab.on`, `.chipbtn.on`, `.fcount`, `.froti .src`, `.chip.on`, `.fstat.on`) | five different tints (.10/.14/.16/.25/.32) with ad-hoc borders | one recipe: `--accent-tint` + 1px `--accent-line` + accent text + weight 500. Light `#005abf` on tint = **5.33:1**; dark `#8ab8ff` on tint = **7.46:1** | A single selection recipe is legible and teachable; the border carries selection so the fill can stay quiet |
| 5 | **Toggle** | track off `rgba(17,17,18,.22)` / `#3a3b3c`; on `--blue`; white knob, one shadow | track off = `--fill` + inset hairline; on = `--accent` (light) / **`#4d8ef7`** (dark); knob 18px white with a two-layer shadow; knob travel unchanged (16px, 180ms) | Dark on/off distinction goes 1.85:1 → 3.13:1; light stays 4.46:1 (on-track vs off-track). Geometry untouched — the control already passed its audit |
| 6 | **Cards** (KPI, chart, topics) | radius 18, border `rgba(17,17,18,.08)`, shadow `sh-2` (2 layers, wide) | radius 16, border `--line` (solid warm hairline), padding 16/20, `--sh-2` relayer (tight contact + wide halo) | A hairline + layered shadow says "lifted sheet"; a wide single shadow says "floating app" |
| 7 | **KPI card internals** | icon tile 38px, tint 13%, glyph = deep stop; value 28px; label 12px sentence case | tile tint **8%** + inset hairline 16%, glyph deep stop (light `#0a4fc4` on the 8% tint = **6.42:1**); value **30px**; label micro-caption caps | Quieter chrome, louder datum. The tint drop is a *contrast gain* for the glyph, not a loss |
| 8 | **Inputs** (numwrap pill, select, textarea) | fill `.05`, border `--stroke` `.16`, radius 12/999 | fill `.045`, border `--stroke` (same strength), radius unchanged; focus = 2px `--focus` ring, offset 2, border→`--accent-line` | Affordance untouched; only the fill steps back. Never weaken `--stroke`: it is the control boundary |
| 9 | **Sheet** (phrase library overlay) | `background: var(--bg)`, radius 14, `sh` one layer 50% alpha | `background: var(--surface)`, radius 16, `--sh-3`; padding 6 → 8; internal scroll + clipping rules unchanged | Overlays must sit *above* the popup layer: on ivory the sheet becomes white; in dark it lifts to `#1f2023` (1.10:1 vs bg + border + shadow = three depth cues) |
| 10 | **Log** | entries slide in 4px; kind chips filled; rules `--divider .16` | entries **fade + 2px** (160ms); kind chips become **outline tags** (transparent fill + `--accent-line` + accent text: **6.21:1** light / **8.87:1** dark) — the amber "expand" and neutral kinds keep their tinted fills; rules `--divide`; timestamp = muted tabular | Slide-in animation is the loudest thing in the popup for zero information. On dark, three filled navy chips per log made the row read as a row of buttons; an outline tag is quieter and *raises* its contrast |
| 11 | **Charts** (stats trend + popup mini) | stats: solid blue bars + "today" solid `#0040DC`; popup mini: **brand gradient at 50% opacity in both themes** → measured only **1.88:1** (light) / **2.06:1** (dark) against the popup background | one chart language: day bars = solid `--c-blue` at 75% opacity (light `#0f63e6` → **3.33:1**, dark `#5aa5ff` → **4.52:1** on the popup background); **"today" bar = the brand gradient** (light `#0040DC → #0030b0 → #00289c`, dark `#a9caff → #97c0ff → #7fb0ff`); gridline `.22` light / `.40` dark; baseline hairline; x-axis ticks every other bar starting at the **second** bar and ending on the accent "today" tick (even spacing, no crowding at the right end); hover `brightness(1.04)` 120ms | The gradient is the one place it earns its keep: a single data point, once per chart — the "sparing accent" rule made literal. It also repairs a real dark-mode defect (mini bars below the 3:1 graphical-object floor in both themes) |
| 12 | **Segmented control** (stats) | container = fill + inset hairline; active = solid `--blue` pill | container unchanged; active = **ink pill** (light: white on `#17181c` = 17.74:1; dark: `#17181c` on `#e9ebef` = 14.86:1); inactive = muted | Matches the graphite/ivory primary language; the blue pill was the loudest element on the page |
| 13 | **Topics rows** | 9px dot + 14% halo, 10px bar, value 13px/600 | dot 8px + 12% halo, bar 8px on a hairline-bordered track, value unchanged, row rules `--divide` | Same datum, finer instruments |
| 14 | **Footer** | muted `color-mix(muted 35%, ink)` text + primary blue pill | muted 12px + graphite/ivory primary pill | One less improvised colour value |

---

## 4. Motion

| Token | Value |
|---|---|
| `--dur-1` (hover/press, chips) | `120ms` |
| `--dur-2` (toggle, panel) | `180ms` |
| `--dur-3` (sheet reveal) | `200ms` open / `140ms` close |
| `--ease-out` (default) | `cubic-bezier(.22,.61,.36,1)` — soft settle, no overshoot |
| `--ease-io` (width/grow) | `cubic-bezier(.45,.05,.55,.95)` |

Per-element rules:

- **Buttons/chips:** background + border + shadow only, `--dur-1 --ease-out`; primary press = 10% colour step (no transform, so text never re-rasterises mid-press).
- **Toggle:** track colour + knob translate `--dur-2 --ease-out`; knob travel unchanged (16px).
- **Sheet/panel:** opacity 0→1 + translateY(4px→0), `--dur-3 --ease-out`; closing 140ms. Never animate height.
- **Log entry:** opacity 0→1 + translateY(−2px→0), 160ms (replaces the 4px slide).
- **Count pop:** scale 1.15, `--dur-2` (was 1.25 — same signal, less shout).
- **Check-mark draw (header mark):** `stroke-dashoffset` 0.5s `--ease-out` (was 0.55s ease); final state pinned.
- **Chart bars:** grow `width` 400ms `--ease-io`; hover `brightness(1.04)` 120ms.
- **Focus:** instant. A focus ring is information, not decoration — never transition it.

**Reduced motion (`prefers-reduced-motion: reduce`)** — mandatory, keep the shipped pattern and extend it:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
  .head svg .ck { stroke-dashoffset: 0 !important; }   /* pinned final state */
  b.count.pop { transform: none !important; }          /* pinned final state */
  .fsheet, .fpanel { opacity: 1 !important; transform: none !important; }
}
```

Rule: any element whose final state is reachable *only* through animation must be pinned (the check mark is the precedent; the count pop and sheet are the new cases).

---

## 5. Accessibility guardrails

### 5.1 Method (so the numbers can be re-derived)

Relative luminance `L = 0.2126·R + 0.7152·G + 0.0722·B` on linearised sRGB channels (`c/12.92` below 0.04045, else `((c+0.055)/1.055)^2.4`); contrast `(L_hi + 0.05)/(L_lo + 0.05)`. Every `rgba()` token is alpha-composited over its real parent surface before measuring (e.g. `rgba(0,90,191,.10)` over `#faf9f7` → `#e1e9f1`). Target: **≥ 4.5:1** for body text, **≥ 3:1** for large text and for state-defining non-text pairs.

### 5.2 Light theme — every proposed text pair (all ≥ 4.5:1)

| Text on background (composited) | fg | bg | Ratio |
|---|---|---|---|
| Ink on page | `#17181c` | `#faf9f7` | **16.86:1** |
| Ink on card surface | `#17181c` | `#ffffff` | **17.74:1** |
| Muted on page | `#5c6069` | `#faf9f7` | **5.99:1** |
| Muted on card surface | `#5c6069` | `#ffffff` | **6.30:1** |
| Muted on control fill `.045` / page | `#5c6069` | `#f0efed` | **5.48:1** |
| Muted on control fill `.045` / card | `#5c6069` | `#f5f5f5` | **5.78:1** |
| Muted on follow-up panel `.03` / page | `#5c6069` | `#f3f2f0` | **5.63:1** |
| Ink on control fill `.045` / page (input value) | `#17181c` | `#f0efed` | **15.44:1** |
| White on primary button (graphite) | `#ffffff` | `#17181c` | **17.74:1** |
| White on accent-filled control (reserved) | `#ffffff` | `#005abf` | **6.53:1** |
| Accent on page (links, "today" label) | `#005abf` | `#faf9f7` | **6.21:1** |
| Accent on card surface | `#005abf` | `#ffffff` | **6.53:1** |
| Accent on selected tint `.10` / page | `#005abf` | `#e1e9f1` | **5.33:1** |
| Accent on selected tint `.10` / card | `#005abf` | `#e6eef9` | **5.59:1** |
| "sent" pill text on its tint `.14` / page | `#146c2e` | `#deeddf` | **5.38:1** |
| "expand" log chip text on its tint `.55` / page | `#7a5a20` | `#f6e7d2` | **5.22:1** |
| KPI glyph on 8% tint / card (non-text, ≥3) | `#0a4fc4` | `#ecf3fd` | **6.42:1** |
| Focus ring vs page (non-text, ≥3) | `#005abf` | `#faf9f7` | **6.21:1** |

### 5.3 Dark theme — every proposed text pair (all ≥ 4.5:1)

| Text on background (composited) | fg | bg | Ratio |
|---|---|---|---|
| Ink on page | `#eceef2` | `#161719` | **15.44:1** |
| Ink on card surface | `#eceef2` | `#1f2023` | **14.02:1** |
| Muted on page | `#a6abb5` | `#161719` | **7.78:1** |
| Muted on card surface | `#a6abb5` | `#1f2023` | **7.07:1** |
| Muted on control fill `.06` / page | `#a6abb5` | `#232426` | **6.74:1** |
| Muted on control fill `.06` / card | `#a6abb5` | `#2b2c2f` | **6.06:1** |
| Muted on follow-up panel `.04` / page | `#a6abb5` | `#1f2022` | **7.08:1** |
| Ink on control fill `.06` / page (input value) | `#eceef2` | `#232426` | **13.37:1** |
| Ink on ivory primary button | `#17181c` | `#e9ebef` | **14.86:1** |
| White on accent-filled control (reserved) | `#ffffff` | `#0a5ce0` | **5.80:1** |
| Accent text `#8ab8ff` on page | `#8ab8ff` | `#161719` | **8.87:1** |
| Accent text on selected tint `.22` / page | `#8ab8ff` | `#132645` | **7.46:1** |
| Accent text on selected tint `.22` / card | `#8ab8ff` | `#1a2d4d` | **6.80:1** |
| "today" label `#7cb0ff` on card surface | `#7cb0ff` | `#1f2023` | **7.38:1** |
| "sent" pill text on its tint `.18` / page | `#5fd07a` | `#1e3626` | **6.70:1** |
| "expand" log chip text on its tint `.18` / page | `#e8c98a` | `#3e3a35` | **7.07:1** |
| KPI glyph on 8% tint / card (non-text, ≥3) | `#5aa5ff` | `#242b35` | **5.61:1** |
| Focus ring vs page (non-text, ≥3) | `#7cb0ff` | `#161719` | **8.12:1** |

### 5.4 State-defining non-text pairs (≥ 3:1) and honest exceptions

| Pair | Light | Dark |
|---|---|---|
| Toggle ON track vs OFF track | `#005abf` vs `#d6d5d4` = **4.46:1** | `#4d8ef7` vs `#414244` = **3.13:1** (shipped was **1.85:1** — this is the fix) |
| White knob vs ON track | **6.53:1** | **3.22:1** |
| White knob vs OFF track | 1.47:1 | **10.71:1** |
| Popup mini-chart day bar vs popup bg (graphical object) | shipped `#0082FB`@.5 = **1.88:1** → proposed `#0f63e6`@.75 = **3.33:1** | shipped `#0082FB`@.5 = **2.06:1** → proposed `#5aa5ff`@.75 = **4.52:1** |
| Popup mini-chart "today" gradient vs popup bg | `#0040DC` **7.21:1** / `#00289c` **11.19:1** | `#a9caff` **10.74:1** / `#7fb0ff` **8.16:1** |

Honest notes:

- The light OFF-state knob (white) sits on a light track at 1.47:1. This matches the shipped treatment and is a **redundant-cue** design: the state is carried by knob *position* (a non-colour cue), by the track colour change (4.46:1), and by the label text. The knob keeps a two-layer shadow so its edge stays perceptible. No text pair depends on it.
- Hairlines (`--line`, `--divide`, `--stroke`) measure 1.16–1.68:1. They are decorative: every control they outline is identified by its own label text and fill. `--stroke` strength is deliberately *unchanged* from v1.7.0 so no boundary is weakened.
- Card vs page surface separation is 1.05:1 (light) / 1.10:1 (dark); elevation is carried by border + shadow, not by fill contrast. This is the same model as the shipped cards.
- Every pair above is recorded with its computed ratio, per `docs/BRANDING.md` rule 5. Phase 2 must copy the two tables into BRANDING §3/§3.1 when it lands.

### 5.5 Non-contrast guardrails

- **Targets:** no control is proposed smaller than its shipped size; primary/secondary buttons ≥ 26px tall, toggle 38×22, chips ≥ 20px tall. The U70 64px rule of the Sổ Trọ project does not apply to this extension surface (it is a Chrome popup, not a parent-facing page) — recorded so the constraint is not silently ignored.
- **State is never colour alone:** toggle = position + colour + label; selected chip = colour + border + weight; chart "today" = gradient + outline + accent label; disabled = lock glyph + inert fill.
- **Keyboard/AT:** unchanged. Focus ring, tab order, `aria-live` regions, `aria-expanded` and Escape handling are all shipped behaviour — this spec touches presentation only.
- **i18n:** the uppercase micro-caption tier is CSS-only (`text-transform`) and applies to six short caption strings that exist in all six locales; no locale string is changed, no `data-i18n` key is added or removed.
- **Reduced motion:** see §4 — mandatory block, final states pinned.

---

## 6. What NOT to do

1. **No glassmorphism** — no `backdrop-filter`, no translucent frosted panels, no blurred overlays. Layering is done with surface + border + shadow.
2. **No gold/beige clichés** — no gold accents, no champagne text, no metallic gradients. The cream `#f3d9b4` stays out of product UI entirely (it lives in store art only).
3. **No gradients on text, buttons, chips, cards or backgrounds.** The brand gradient appears exactly twice: the mark, and the "today" data point (plus its in-popup mini-chart twin).
4. **No pure black/white extremes** — no `#000`, no white text on black blocks; the ink/ivory pair is `#17181c`/`#e9ebef`-class, never `#000`/`#fff`.
5. **No heavy shadows** — nothing above 40% alpha, nothing with a hard 1px dark rim, no stacked glows, no coloured shadows on neutral elements.
6. **No layout churn** — DOM order, 320px width, ≤600px cap, component inventory and every functional affordance stay exactly as shipped. This is a re-skin, not a redesign.
7. **No new data-viz hues** — the §3.1 five-hue palette and the trend-chart stops are frozen; only bar geometry, gridline alpha and the "today" gradient change.
8. **No new fonts or icon sets** — no webfont download, no icon library; the type stack and the existing glyphs stay.
9. **No long or springy animation** — nothing over 320ms inside the popup, no bounce/elastic/overshoot easings, no parallax, no skeleton shimmer.
10. **No uppercase/letter-spacing on localized sentences** — the caps tier is for short captions only; never `text-transform: uppercase` on body copy or user data.
11. **Never animate an element whose final state is only reachable by animation** (reduced-motion regression).
12. **Don't trade density for air in the popup** — the ≤600px cap and the 320px no-overflow contract are hard constraints; whitespace comes from removing fills and lightening rules, not from adding height.

---

## 7. Phase-2 application plan (file-by-file)

Order matters: apply popup first (dense, budget-constrained), then stats, then re-verify, then record.

| Step | File | Change | Verification |
|---|---|---|---|
| P2-1 | `extension/popup.html` | Replace the `:root` block + dark `@media` block with §2 tokens (all new values). No markup change. | `node scripts/lint.mjs` (exit 0); visual diff light+dark |
| P2-2 | `extension/popup.html` | Component rules per §3: `.btn`/`.btn.tonal`/`.btn:disabled`, `.qbtn`/`.ftab`/`.chipbtn`/`.flibbtn`/`.fcount`, `.chip`/`.fstat`/`.k-*`, `.track`/`.knob`, `.numwrap`/`select.sel`/`textarea.tbox`, `.fpanel`/`.fsheet`, `.log`/`.item`, mini-chart text/baseline, `::-webkit-scrollbar` | keyboard + focus-visible + reduced-motion probes re-run (all shipped checks) |
| P2-3 | `extension/popup.html` | Spacing/rhythm per §2.5 (row margin 5, section 8/8, log 6, footer 8) and the micro-caption `text-transform` on `.mcap` | **`node test/followup-e2e.mjs` — heights must stay ≤ 600** (shipped: 561/590/590). If a step pushes > 600, revert the last spacing step; update the harness expectations only after the cap is verified |
| P2-4 | `extension/stats.html` | Same token block; component rules: `.seg`, `.kpi` (+icon tint 8%, value 30px, label caps), `.chart` (gridline alpha, today gradient), `.topics` (dot 8px, bar 8px, rules), `.tool`/`.tool.primary`, footer, page/card padding per §2.5 | `node test/e2e.mjs` (`statsPage`/`statsCheck` true); reflow probe 320/640/1280 (must stay 320 = 320) |
| P2-5 | `extension/stats.html` | Caption caps + KPI label caps + chart "today" gradient definition (SVG `linearGradient` in CSS classes, as today) | render + vision check light+dark |
| P2-6 | `extension/popup.js` | One small change in `renderMini` (lines ~471–479): give the day rects a class (`bar` / `bar today`) and the gradient stops classes (the `.sc-*` pattern `stats.html` already uses), so fills/opacities become theme-aware and the gradient is reserved for today. No logic change; keep the `<title>` tooltips and the geometry constants (`W = 292`) | `node --check` via lint; mini-chart geometry probe (7 bars, no clipping) |
| P2-7 | `extension/stats.js` | **No change required** (bars/topics are class-driven; colours come from CSS vars) | lint + e2e |
| P2-8 | *(optional variant)* `extension/popup.html` + `extension/popup.js` | 16px horizontal padding for extra air — requires `const W = 292` → `288` in `popup.js` **and** the inline `<svg id="mini" width="292">` in `popup.html`, plus a mini-chart re-render check | mini-chart geometry probe (7 bars, no clipping) |
| P2-9 | `extension/_locales/*/messages.json` | **No change** (no new/changed strings) | `node scripts/lint.mjs` i18n parity |
| P2-10 | `docs/BRANDING.md` | Add the §2 token table + the §5.2/5.3/5.4 computed contrast tables (rule 5); note the new dark ON-track `#4d8ef7` and its 3.13:1/3.22:1 pairs | recompute the recorded values from the shipped CSS |
| P2-11 | `store/screenshot2-stats.png`, `store/screenshot3-popup.png` (+ dark QA pair) | Re-render after the UI lands so store art matches the product; keep the shipped capture invariants (`--force-color-profile=srgb`, 1280×800, scratch profile). Note the framing caveat already recorded as N11 | PNG IHDR check; vision review |
| P2-12 | `assets/*.html` (promo, marquee, store-screenshot) | Optional: refresh designed assets to the new palette if the store set should look consistent; keep the mark untouched | brand contract check (no AI redraw; geometry unchanged) |
| P2-13 | `test/followup-e2e.mjs` / `test/e2e.mjs` | Only if a *measured* height/geometry value legitimately shifts and the ≤600/320px contracts still hold — update the recorded expectation, never the contract | full harness re-run, exit 0 |

Explicit non-goals for Phase 2: no new components, no copy changes, no engine/logic changes, no manifest/permission changes, no new tests beyond the re-run of the existing gates.

---

## 8. Evidence and limits (Phase 1)

- **Contrast:** every value in §5 is computed (Python, WCAG 2.x formula + alpha compositing), not estimated. The script and the mockup render live in the Hermes scratch dir, not in the repo.
- **Mockup:** `assets/quiet-luxury-mockup.html` — standalone page showing the popup at 320px CSS width in light + dark side by side and a Statistics fragment (KPI cards + chart). It is a *mockup*, not a source of truth: Phase 2 applies the tokens to the real files, and store/runtime evidence is re-rendered from the real product afterwards.
- **Phase-1 vision QA (this mockup, rendered in real Chrome 154 via CDP at 2x, `--force-color-profile=srgb`, scratch profile + scratch output dir):** four review rounds. Final round — popup row **9/10 premium, 10/10 light↔dark coherence, 9/10 craft, "no defects"**; Statistics light **9/10 premium, 9/10 craft**; Statistics dark **9/10 premium, 8/10 craft**. Defects fixed across rounds: wrapped quick-combo chips (row geometry), crowded x-axis ticks, log context alignment, faint dark hairlines, over-prominent dark tints, filled log chips. Claims the reviewer made that pixel sampling disproved were recorded as misreads rather than "fixed": the dark tint is deep navy (`#192c4b` sampled, not a solid fill), the "14" value label *is* accent (`#005abf` glyph pixels), the chart has 14 bars (column count), and all four KPI icon tiles share the same tint+glyph treatment. Frozen-intent items the reviewer repeatedly listed (ink/ivory primary inversion, hairline dividers, no y-axis, brighter dark data stops) are design decisions, not defects.
- **Limits:** (1) the mockup uses the local system font (Segoe UI on this host) because Optimistic is not installed — the real extension falls back the same way; (2) no dark-mode runtime capture of the *real* extension was taken in this phase (popup/stats files are owned by another lane); (3) the popup-height budget is computed, not measured — P2-3 must verify it against the harness; (4) vision QA of the mockup is qualitative (defect list + score), not a calibrated instrument; (5) hairlines and 1–2px details are hard for vision models to confirm — verify them by pixel sampling in Phase 2 if they matter.
