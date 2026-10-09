# Experience Review — Muse Auto-Allow v1.4.0 (SGPS Experience gate, maker ≠ judge)

**Review basis (scope freeze):** repository state at commit `8c76d2a` — "feat(v1.4.0): Muse-language UI overhaul + Brand Kit v2 + neutral store assets".
**Reviewed at 8c76d2a; newer edits out of scope.** During the review the working tree carried v1.5.0 drift (extension files, store docs, README, scripts); that work has since landed as commits after `8c76d2a` (HEAD is now `311f006`). The working-tree copies of `store/screenshot1.png`, `screenshot2-stats.png`, `screenshot3-popup.png` differ from the committed v1.4.0 blobs (hash-verified: `git rev-parse` vs `git hash-object`). This review used the **committed blobs** (extracted read-only to scratch); drift content was not reviewed and no findings are filed about it.
**Post-review note (not assessed here):** the later commits mention changes that touch items this review flags for the next revision — e.g. a "store-spec screenshot3 stage (1280x800)" (F1) and "local-time log" (F8). Whether they close those findings is out of scope for this v1.4.0 review.
**Date:** 2026-10-09 (+07:00) · **Reviewer:** independent subagent (maker ≠ judge) · No GO/NO-GO claim is made here.

**Method.**
1. Direct visual inspection of every rendered asset (image analysis) — no code-only judgments.
2. Independent pixel measurement of the PNGs via a stdlib zlib decoder (no image libraries; sanity-checked against known flat colors — neutral grays measure exact).
3. WCAG 2.x contrast **computed from the actual token hex values**; the doc's own numbers were not trusted.
4. Source read: `extension/popup.html`, `popup.js`, `stats.html`, `stats.js`, `docs/BRANDING.md`, `CHANGELOG.md` (v1.4.0), `manifest.json`, plus the provenance scripts (`store-shot.mjs`, `stats-shot.mjs`, `render.mjs`) and asset sources (`assets/*.html`).

**Assets reviewed** (committed blobs unless noted):

| Asset | Measured size | Provenance (BRANDING §5 / scripts) |
|---|---|---|
| `store/screenshot1.png` | 1280×800 | real runtime capture (`store-shot.mjs`) |
| `store/screenshot2-stats.png` | 1280×800 | real render (`stats-shot.mjs`) |
| `store/screenshot3-popup.png` | 680×1964 | real render (`stats-shot.mjs`) |
| `store/screenshot4-overview.png` | 1280×800 | designed (`render.mjs` ← `assets/store-screenshot.html`) |
| `store/promo440x280.png` | 440×280 | designed (`render.mjs` ← `assets/promo-tile.html`) |
| `extension/icons/icon16/32/48/128/512.png` | 16–512 | `render.mjs` ← `assets/icon(-small).html` |
| dark QA pair — scratch `maa-dark/stats-dark.png`, `popup-dark.png` | 1280×800 / 680×1964 | `stats-shot.mjs` dark captures (QA only, declared not store assets) |

---

## Findings

| ID | Severity | Axis | Evidence | Issue | Suggested fix |
|---|---|---|---|---|---|
| F1 | MED | Store-asset quality (CWS conformance) | `store/screenshot3-popup.png` measured **680×1964**; `store/LISTING.md:379-391` ("verify before submit that the uploaded images match these sizes"); Chrome Web Store image spec — screenshots must be **1280×800 or 640×400** (developer.chrome.com/docs/webstore/images) | The popup screenshot cannot be uploaded to a CWS screenshot slot at this size; every other asset conforms (1280×800 / 440×280) | Re-canvas the popup render onto a 1280×800 light stage (or 640×400), or drop it; keep 16:10 |
| F2 | MED | Accessibility (doc claims vs reality) | `docs/BRANDING.md:53-54`; computed from the real tokens: `#0866ff` on `#18191a` = **3.65:1** (doc claims ≈4.9:1) and `#0866ff` occurs **nowhere** in code/assets (grep — only this doc line); the real dark accent `#0a5ce0` (`popup.html:10`, `stats.html:11`) = 3.03:1 vs `#18191a`; also `--muted`/`--bg` is 8.16:1 (doc: ≈6.6) and `--ink`/`--bg` 18.39:1 (doc: ≈19) | The doc's dark-accent contrast claim is stale and wrong (unused hex + overstated ratio). No shipped text pair actually fails AA (see Verified good) — the damage is to the accessibility record itself | Recompute the line from live tokens; delete the `#0866ff` reference |
| F3 | MED | Defects (color fidelity — all assets) | Measured pixels: flat accent `#005abf` (`popup.html:7`) renders as **rgb(60,91,184)** in screenshot1/2/3/4 (s2c "Day" pill fill, s3c checkbox fill, s4 Allow button, s1c Statistics button); gradient stops `#0082FB→#0064E0→#0040DC` (`assets/icon.html:17-19`) render with **r≈59–98 where the tokens have r=0** (icon128 px(30,28)=(82,124,236), promo px(240,120)=(62,87,213)); neutral grays are exact ((75,78,83)≈`#4a4e54`, (177,179,184)≈`#b0b3b8`); **all six PNGs carry no ICC/sRGB/gAMA chunk** | Saturated brand blues are desaturated at capture/render time (consistent with a wide-gamut display capture without sRGB conversion; mechanism inferred, measurements factual). Untagged → interpreted as sRGB → the store assets **and the store icon** (icon128) show duller colors than the brand tokens / the live UI | Add `--force-color-profile=srgb` to the Chrome launch args of `render.mjs:22-31`, `stats-shot.mjs:78-90`, `store-shot.mjs:71-85` (or convert+tag to sRGB), then re-run all three; re-check the shipped icons |
| F4 | MED | Muse fidelity / defects | `extension/popup.html:36` (`input[type=checkbox]{width:34px;height:18px}`), `:88`; measured in screenshot3-committed: visible control = **36×36 device px @2× = 18×18 CSS square**, solid accent fill; two independent vision passes read it as a native/square checkbox, not a switch; the 34px box + 8px gap leaves the label visually detached from the other rows | The product's primary on/off control renders as a stock square checkbox — off-language for a "pills everywhere" system (`BRANDING.md:61`) and inconsistent with the pill button/chips next to it. (The native-control choice is deliberate for keyboard/AT support — `SGPS_EXPERIENCE_ADOPTION.md:16` — but a custom pill switch can stay fully accessible) | Build a pill switch (e.g. 34×20, 16px knob, 999px radius, role=switch + keyboard) or explicitly style the control; align the label |
| F5 | MED | UX affordance | `extension/popup.html:37-38`, `:89-90`; screenshot3-committed delay row | The delay input (editable, 0–10000 ms) renders as a borderless gray pill with **no edit affordance** — no border/underline, spinner only on hover, "300" left-aligned with trailing dead space; vision (2 passes) independently read it as a "static readout" | Add a subtle affordance (border/underline/stepper), center or right-align the value, consider putting "ms" inside the pill |
| F6 | MED | Accessibility (label) | `extension/popup.html:89-90` — "Delay between clicks:" is a `<span>`, not `<label for="delay">` | The number input has no accessible name (screen readers announce an unnamed spinbutton) | Use `<label for="delay">` |
| F7 | MED | Accessibility (state) | `extension/stats.js:151-156` (`classList.toggle('active')` only), `extension/stats.html:23-24`; contradicts the project's own "color is never the only signal" principle (`SGPS_EXPERIENCE_ADOPTION.md:16`) | Day/Week/Month/Year selection is conveyed visually only — no `aria-pressed`/`aria-current`; AT users cannot determine the selected range (WCAG 4.1.2) | Add `aria-pressed` (or use a radiogroup) on the segment buttons |
| F8 | MED | Correctness (visible in assets) | `extension/content.js:309` (`at: new Date().toISOString()`), `extension/popup.js:30` (`e.at.slice(11,19)`); committed screenshot3 top log entry `07:30:16` was seeded as "now−2min" (`stats-shot.mjs:55-57`) at a capture that ran ~14:30 local +07 (file mtimes 14:32; commit 14:35:47 +07); committed screenshot1 shows `07:32:53/54` | Click-log timestamps display **UTC time-of-day with no conversion** (7 h behind local in VN), inconsistent with the local-day aggregates (`dayKeyOf` uses local dates) — users auditing "what did it do" see wrong clock times | Convert to local time on render. **Fix already in flight (v1.5.0 "local-time log display") — recorded for the v1.4.0 record; no duplicate action requested** |
| F9 | LOW | Store-set consistency | s1c "Clicked 130 / Today 2" (2 log entries while 3 cards are staged), s3c "Clicked 489 / Today 14", s2c KPI Total 489 / Today 14, s4 "Clicked: 128" | The five assets tell three different demo sessions (130 / 489 / 128) — the set reads as three unrelated captures | Seed one shared demo session (same totals/dates) across `store-shot.mjs` + `stats-shot.mjs` before regenerating |
| F10 | LOW | Store legibility at store sizes | `extension/stats.html:30-31` (chart value labels 10px, axis labels 11px), popup log context 12px (`popup.html:46`), rendered in s2c/s3c; CWS downscales screenshots to 640×400 (developer.chrome.com/docs/webstore/images) | At listing size the chart labels become ≈5px and log text ≈6px — effectively unreadable; the densest text dies at store scale | For store captures, bump chart/log label sizes to 12–13px (or capture a simplified stats view) |
| F11 | LOW | Doc vs artifact | `docs/BRANDING.md:32` claims stroke "76/512 (92/512 in the 16–32 px variant)"; actual sources: `assets/icon.html:23` = **70**, `assets/icon-small.html:22` = **86** (the popup/stats header inline SVG uses 76 — `popup.html:82`) | Brand-doc numbers don't match the icon sources that render the shipped icons | Update BRANDING.md to 70/86 (or change the sources) |
| F12 | LOW | Brand-risk | `docs/BRANDING.md:21` (gradient sourced from "muse-logo.svg / muse-app-icon.svg"), `:49`; `assets/icon.html:17-19`, `popup.html:79` | The mark uses Muse's **exact brand gradient** (Meta-family blues), copied from Muse's own logo assets. The mark *shape* is original — vision on icon16/icon128/promo/s4 found no Meta-infinity / muse.ai-squiggle resemblance — but the color provenance leans brand-mimicry rather than style-compatibility | Shift the gradient to a distinct-but-adjacent palette, or record an explicit compatibility rationale; keep the check mark |
| F13 | LOW | Accessibility (focus) | No `:focus` / `:focus-visible` / `outline` rules in `extension/popup.html` or `stats.html` (grep: 0 hits) | Keyboard focus relies on the UA default ring only (not suppressed — good), but there is no designed focus treatment on the filled pills / borderless input, especially in dark mode | Add `:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px }` |
| F14 | LOW | Accessibility (live updates) | `extension/popup.js:115`, `extension/stats.js:138-150` | Storage-driven updates (count, log, KPIs) are not announced to AT — no `aria-live` region | `aria-live="polite"` on the log/count, or accept as low priority |
| F15 | LOW | Informational (surface definition) | Computed: dark card `#242526` vs page `#18191a` = **1.15:1**; card border `#3e4042` vs page = **1.69:1**; light card border ≈1.18:1 vs page | Cards are defined by very subtle fill/border deltas (faithful to Muse's own dark tokens; below the 3:1 non-text guideline if a boundary were ever load-bearing). No action required | None — keep in mind for low-quality displays |
| F16 | LOW | Hygiene (repo, not a store asset) | `scripts/stats-shot.mjs:201` hardcodes `C:/Users/<user>/...` (QA output path) | Local username path committed into the public repo | Make the QA output dir env-based |
| F17 | LOW | Render vs reality | `scripts/stats-shot.mjs:188-197` (log `maxHeight` force-expanded; 340px viewport; height up to 1200 CSS), `scripts/store-shot.mjs:229-231`, real cap `popup.html:42` (220px) | The popup shown in screenshot1/screenshot3 is a content-crop: the log scroll area is force-expanded (asset 982 CSS px tall vs a real popup of roughly half that, ≈480–500 px) and the canvas is 340px wide vs the real 320px popup | Note the crop in BRANDING §5 / LISTING, or capture at the real viewport |
| F18 | LOW | Store legibility (designed asset) | `assets/store-screenshot.html:24` (`.arrow { color:#9aa0a6 }`), rendered in screenshot4; computed **2.57:1** on `#fcfcfc` | The flow arrows between "1 · Detect → 2 · Allow → 3 · Log" are very low contrast — decorative glyphs, but they carry the sequence semantics | Darken to ≈`#6b7078` (~4.6:1) or make the arrows larger/bolder |
| F19 | LOW | Doc freshness (governance) | `docs/SGPS_EXPERIENCE_ADOPTION.md:20` still describes the v1 brand ("cream + electric blue + sparkle"), `:40` says "not yet a git repo" | The SGPS adoption note misdescribes the current v1.4.0 brand kit (Brand Kit v2 — `BRANDING.md:7-11`) and repo status; readers of the experience record get stale context | Refresh the adoption note for v1.4.0 (or date-stamp it explicitly as a v1.2.0-era record) |

---

## Verified good

1. **Token adoption (light/dark) matches the v1.4.0 claims** — `popup.html:6-11` and `stats.html:7-12` are identical token blocks; light-first (`#fcfcfc` / `#ffffff` / `#111112` / `#005abf`) + full `prefers-color-scheme: dark` (`#18191a` / `#242526` / `#0a5ce0`). The dark QA pair renders a complete dark theme with no light-themed leaks (no white inputs/panels/separators).
2. **Every shipped text pair passes WCAG AA (computed, not quoted)** — see Appendix A. Minimums: 5.30:1 (light 10px "expand" badge), 5.34:1 (dark chip on fill), 5.80:1 (white on dark blue). The CHANGELOG:8 claim "secondary text ≥6:1 light / ≥5:1 dark" is verified (7.34–8.37 light; 5.34–8.37 dark).
3. **Vision's qualitative "low contrast" flags were cross-checked and did not hold** — stats footer light 8.14:1, dark 8.39:1 (pixel-measured), promo subtitle 6.15:1 (pixel-measured), designed Deny button 12.03:1 (computed). No change needed; recorded so it is not re-litigated.
4. **Reduced motion is complete** — `popup.html:13-18` kills all animation/transition AND pins the draw-in check's final state (it would otherwise never appear); `stats.html:45-47` kills transitions; dot pulse / count pop / log slide-in all covered.
5. **aria hygiene where claimed** — decorative status dot and both decorative SVGs are `aria-hidden` (`popup.html:77,86,93`); the on/off checkbox is labelled via its wrapping `<label>`; `html lang` is set from `chrome.i18n` (`popup.js:12`, `stats.js:16`); the chip's singular/plural copy exists in all 6 locales — **31 identical keys per locale** (parsed and compared, zero drift).
6. **No real project or personal data in any public asset** — vision transcription of all five assets + capture-script seeds (`stats-shot.mjs:44-64`) + a leak grep across `store/ assets/ scripts/ test/ docs/` show only fictional data ("Example Org", demo-project, sample-app, web-starter, notes-app, files.example.com); nothing resembling a real project/repo name.
7. **PNG hygiene** — all five store assets are 24-bit RGB, no alpha (CWS-safe); s1/s2/s4 are 1280×800 and promo 440×280 as required; icons 16/32/48/128/512 all present; icon16's bold variant stays recognizable at 16px (vision).
8. **No trademark copy in the marks** — icon16 / icon128 / promo / screenshot4 inspected: check-on-tile, no Meta infinity / muse.ai squiggle resemblance anywhere.
9. **Stats-page data is internally consistent** — Today 14 = last bar; week 77 = 05/10–09/10 sum; month 117 = 01/10–09/10 sum — matches `stats.js` Monday-week logic and the seeds.
10. **"Pills everywhere" holds outside the toggle** — buttons/chips/input/segmented control all 999px, cards 16px, icon tile rx 26% — matches BRANDING §4.
11. **Store-doc sizes match reality where declared** — LISTING §8 (s1 1280×800, promo 440×280, s2 as the 1280×800 second image) all verified by header parse.
12. **Dark QA pair delivered as declared** — 1280×800 + 680×1964, captured separately and not shipped as store assets (`stats-shot.mjs:200-212`).

---

## NOT_VERIFIED

- **Rendered focus / keyboard / hover behavior in a live browser** — static assets + code inspection only; no runtime interaction performed (focus ring visibility, tab order, spinner-on-hover were not exercised).
- **Live-browser dark-mode rendering beyond the delivered QA pair** — the pair was reviewed as images; no runtime re-render was performed.
- **`stats-shot.mjs`'s reported page-fit values (h:800 / w:1280)** — the script was not executed (runtime gates owned by the coordinator); the committed s2 was instead visually inspected for clipping (none found).
- **Chrome Web Store dashboard acceptance of the asset set** — no upload performed; F1 is a spec-conformance finding, not an upload test.
- **e2e suite state at 8c76d2a** — not run per instruction; CHANGELOG:9 claims exit 0 — cited, not re-verified.
- **icon16/32 as painted by the OS toolbar / store surfaces** — reviewed from the PNG files only.
- **The exact color-space transform behind F3** — the measured shift is factual; the display-profile mechanism is inferred, not proven.
- **Behavior of the concurrently landing v1.5.0 work** — out of scope (worktree drift: extension files, store docs, README, scripts, and regenerated s1/s2/s3 blobs).
- **Worktree copies of s1/s2/s3** — hash-verified as different from the committed v1.4.0 blobs; only the committed blobs were used as the review basis.

---

## Appendix A — contrast ratios computed from the actual token hexes (WCAG 2.x, sRGB)

| Pair | Ratio | Verdict |
|---|---|---|
| LIGHT `--ink #111112` on `--bg #fcfcfc` | **18.39:1** | AAA (doc said ≈19 — close) |
| LIGHT `--muted #4a4e54` on `--bg` | **8.16:1** | AAA (doc said ≈6.6 — understated) |
| LIGHT `--muted` on `--surface #ffffff` | 8.37:1 | AAA |
| LIGHT `--muted` on `--fill` (5% ink over bg) | 7.34:1 | AAA |
| LIGHT white on `--blue #005abf` | 6.53:1 | AA+ (doc said ≈6) |
| LIGHT `k-allow`/`chip.on` `#005abf` on 10% blue over bg | 5.47:1 | AA (10px text — OK) |
| LIGHT `k-expand` `#7a5a20` on 55% `#f3d9b4` over bg | 5.30:1 | AA |
| DARK `--ink #e4e6eb` on `--bg #18191a` | 14.10:1 | AAA |
| DARK `--muted #b0b3b8` on `--bg` | 8.37:1 | AAA |
| DARK `--muted` on `--surface #242526` | 7.30:1 | AAA |
| DARK `--muted` on `--fill #3a3b3c` | 5.34:1 | AA |
| DARK white on `--blue #0a5ce0` | 5.80:1 | AA |
| DARK `k-allow` `#8ab8ff` on 25% blue over bg | 7.08:1 | AAA |
| DARK `k-expand` `#e8c98a` on 18% tan over bg | 6.88:1 | AA+ |
| DARK accent `#0a5ce0` vs `#18191a` (component) | 3.03:1 | ≥3:1 UI-component floor |
| DARK doc-claimed `#0866ff` on `#18191a` | **3.65:1** | doc claims ≈4.9 — **wrong** (and hex unused; F2) |
| Store: tagline `#5c6066` on `#fcfcfc` | 6.17:1 (pixel: 6.15) | AA+ |
| Store: designed Deny `#2c2e33` on 6% ink over `#fff` | 12.03:1 | AAA |
| Store: badge `#005abf` on 9% blue over `#fff` | 5.68:1 | AA |
| Store: flow arrows `#9aa0a6` on `#fcfcfc` | **2.57:1** | decorative glyphs — F18 |
| Dark card surface vs page / border vs page | 1.15:1 / 1.69:1 | informational — F15 |

## Appendix B — pixel measurements (stdlib decoder, committed blobs)

- **Color shift (F3):** flat `#005abf` (0,90,191) → rendered rgb(**60,91,184**) in s1c/s2c/s3c/s4; gradient stops (r=0) → rendered r≈59–98 (icon128 (30,28)=(82,124,236), promo (240,120)=(62,87,213)); grays exact: `#4a4e54`→(75,78,83), `#b0b3b8`→(177,179,184), `#5c6066`→(93,96,101), `#111112`→(17,17,18). No ICC/sRGB/gAMA chunk in any of the six PNGs.
- **Toggle control (F4):** blue fill cluster in committed screenshot3 = **36×36 device px** at 2× (= 18×18 CSS); Statistics button = 166×66 device (83×33 CSS, pill).
- **Commits/anchors:** `git rev-parse 8c76d2a` = `8c76d2a05d8df20f18fbb5634322e59d035705be` (2026-10-09 14:35:47 +07).

## Coordinator disposition (2026-10-09, v1.5.0)

Maker ≠ judge preserved: the fixes below are coordinator work; this review's findings stand as the independent record. Gate evidence at the commit carrying each fix (e2e exit 0, zip byte-verify, vision re-check).

| Finding | Disposition | Where |
|---|---|---|
| F1 | FIXED — screenshot3 recomposed as a 1280×800 stage shot | `311f006` |
| F2 | FIXED — contrast line recomputed from live tokens; unused `#0866ff` reference removed | BRANDING.md |
| F3 | FIXED — `--force-color-profile=srgb` added to all three capture scripts; every asset re-rendered + pixel-re-checked | render/stats-shot/store-shot |
| F4 | FIXED — native checkbox → accessible pill switch (visually-hidden input + track/knob, focus ring on the track) | popup.html |
| F5 | FIXED — delay input affordance (border, centered bold value) | `311f006` + popup.html |
| F6 | FIXED — `<label for="delay">` | popup.html |
| F7 | FIXED — `aria-pressed` on the segmented control (initial + JS update) | stats.html/stats.js |
| F8 | FIXED — local-time log display | `d7084da` |
| F9 | FIXED — unified 489/14 demo session (store-shot seed + designed overview) | store-shot.mjs, store-screenshot.html |
| F10 | PARTIAL — chart value labels 10→11px; the rest accepted at store scale | stats.html |
| F11 | FIXED — stroke numbers 70/86 | BRANDING.md |
| F12 | ACCEPTED + RECORDED — explicit provenance/compatibility rationale added (gradient Muse-adjacent by design; original shape re-checked) | BRANDING.md |
| F13 | FIXED — `:focus-visible` rules both surfaces | popup.html, stats.html |
| F14 | PARTIAL — `aria-live="polite"` on the popup log; stats KPIs accepted | popup.html |
| F15 | NO ACTION (informational, as reviewed) | — |
| F16 | FIXED — QA dir env-based (`os.tmpdir()`); literal path also scrubbed from this document | stats-shot.mjs |
| F17 | FIXED — v1.5.0 captures no longer force-expand the log; screenshot3 is a natural-height stage shot | `d7084da`+`311f006` |
| F18 | FIXED — arrow color `#6b7078` (~4.6:1) | store-screenshot.html |
| F19 | FIXED — adoption note refreshed (brand kit v2, screenshot set, git status) | SGPS_EXPERIENCE_ADOPTION.md |
