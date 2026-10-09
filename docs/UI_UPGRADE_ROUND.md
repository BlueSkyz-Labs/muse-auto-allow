# UI Upgrade Round — Comprehensive, SGPS: Experience adopted (targets v1.7.0)

Status: **QUEUED** — starts immediately after the v1.6.0 integration lands (the current
two lanes: Auto follow-up + Premium stats). This document is the round's charter:
scope, workstreams, write-sets, evidence gates, sequencing.

## SGPS routing record (2026-10-09)

```
python scripts/sgps_prompt_router.py --mode EXECUTE \
  --signals "comprehensive UI UX upgrade round, premium polish, accessibility, i18n copy,
             rendered surfaces, store assets, popup stats" \
  --repo "C:/00. AI Project/muse-auto-allow"
→ pack=owner-dir-2026-10-04 pack_verified=YES · ROLES: experience
→ LOAD: 00_SGPS_COMMON_EXECUTION_KERNEL_v1.0 + 01_SGPS_AI_FACTORY_MASTER_v2.0 +
        03_SGPS_PREMIUM_EXPERIENCE_v4.0
```

Stage -1 gates apply from round start (live refresh before claims; HEAD-changed ⇒
evidence invalidated; pre-verdict rebind). Experience signals matched: ux, ui,
accessibility, i18n, copy, rendered.

## Goal

A full-surface UI/UX upgrade of every user-visible surface of the extension —
professional, premium, cohesive in Muse's design language — with the SGPS Experience
v4.0 gates as the acceptance frame. No behavior changes.

## Surfaces in scope

| Surface | What this round adds beyond v1.6.0 |
|---|---|
| Popup | Premium pass: refined layout rhythm, richer states (empty / populated / error), micro-interactions kept behind `prefers-reduced-motion`, the Auto follow-up section visually integrated with the rest |
| Statistics page | Cross-surface consistency with the popup; interaction polish (hover/focus on chart + rows); motion discipline |
| Store assets | Re-render ALL images from the final UI: screenshot1 (real runtime), screenshot2 (stats), screenshot3 (popup stage), screenshot4 (overview), promo, marquee — exact specs, neutral demo data, sRGB (`--force-color-profile=srgb` stays) |
| Copy & i18n | Idiomatic review of all user-visible strings in all 6 locales (en, vi, zh_CN, ja, ko, es) — tone, length limits (short description ≤132), no machine-translation artifacts; parity gate stays |
| Accessibility | Keyboard traversal of every surface, focus-visible everywhere, ARIA audit, contrast table recomputed and recorded |
| States | Empty / populated / error / disabled states for every surface, designed — not default |

## Workstreams & write-sets (one writer per file)

| WS | Owner | Write-set | Deliverable |
|---|---|---|---|
| W1 popup premium | lane | `extension/popup.html`, `extension/popup.js` | Premium popup + integrated follow-up section; NO new i18n keys (reuse) |
| W2 assets + consistency | lane | `assets/*.html`, `scripts/render.mjs`, `scripts/stats-shot.mjs`, `scripts/store-shot.mjs`, `store/*.png` | All store images re-rendered from the final UI, exact specs, vision ≥9/10 light+dark |
| W3 copy & i18n review | lane | `extension/_locales/**`, `docs/UX_COPY_REVIEW.md` (new) | Idiomatic pass per locale; findings table; parity preserved |
| W4 experience audit | lane (independent, read-only) | `docs/EXPERIENCE_AUDIT_V17.md` (new) | SGPS Experience gates + 12 UX release gates evidence on the FINAL revision; maker ≠ judge |
| Coordinator | me | integration, `_locales` merge conflicts, version bump, CHANGELOG, store docs, zip, history scrub | v1.7.0 release candidate |

Rules: W3 must not add/remove KEYS (values only) so parity can't break while W1/W2
render; W2 starts only after W1 lands (assets must show the final popup); W4 runs on
the frozen revision after all writers stop (pre-verdict rebind).

## Evidence gates (all mandatory; report exact revision + counts)

1. Rendered evidence for every surface — light AND dark captures (vision ≥ 9/10 each; defects fixed or recorded).
2. Contrast: every text pair recomputed from live tokens (≥ 4.5:1 text, ≥ 3:1 UI), numbers recorded in `docs/BRANDING.md`.
3. Keyboard/AT: full traversal possible (tab order, focus-visible, aria-pressed/live), verified in real Chrome.
4. Reduced-motion: every new animation gated.
5. i18n: parity (lint) + per-locale copy review table (6 locales).
6. States: empty/loading/error/disabled present and designed.
7. `node scripts/lint.mjs` exit 0 · `node test/e2e.mjs` exit 0 (+ followup-e2e where touched) · zip byte-verified 18/18 (or new count).
8. Independent audit (W4) report with the gate table + NOT_VERIFIED list.
9. `docs/SGPS_EXPERIENCE_ADOPTION.md` updated: adoption evidence table for this round.
10. Store-asset exact sizes re-verified from PNG headers; neutral demo data only.

## Known findings to fix in this round (from independent vision reviews, 2026-10-09)

Recorded during v1.6.0 integration — these are the concrete polish lists this round must
close (maker ≠ judge: reviewed independently, not by the implementing lanes).

### W1 (popup) — from the popup review (6/10 → target 9)

1. Disabled `Send now` affordance: dimmed blue keeps white text at ~2:1 — restyle the disabled state to stay readable (or mark it with an explicit disabled treatment + tooltip "Enable Auto follow-up first").
2. Disable/visually group the whole follow-up controls block when the toggle is off (select, textarea, wait/cooldown, Send now read as live today); add one inline note.
3. "Status unknown" pill is a dead end — map to informative states (Idle / Waiting / Sending / Last sent …) with tooltip.
4. Header green dot + status pill = two competing status indicators; give the dot a legend/tooltip or remove.
5. Log typography: entries ~10-11px grey with no row separator; raise size one step + hairline dividers; consider two-line clamp instead of hard ellipsis.
6. "Today 14" pill placement ("1 muse.ai tab open" shares the line) — separate rows/scope.
7. Label punctuation consistency ("Clicked:" vs "Today"); numeric-input alignment (300/60/10 not on one axis; `ms` baseline vs centered).
8. Mini-chart: add day initials or drop to labelled sparkline; "Works only on muse.ai" placement.
9. Consider collapsing the follow-up section when off (declutter) — optional.

### W2 (stats + assets) — from the stats review (7/10 → target 9)

1. **Trend chart rainbow regression**: 5 hues cycling on a single-series chart (color encodes nothing; collides with the topic palette; hurts comparability). Fix: single-hue bars with a subtle value gradient + accent on "today", OR add a legend + genuine encoding. Keep the 5-hue palette exclusively for topics/KPI chips.
2. KPI row: align chip hues to the topic palette (consistency); consider period-over-period deltas or trend arrows ("premium substance").
3. Range control vs "Last 14 days" label: make the caption reflect the active range dynamically or state granularity explicitly.
4. Vocabulary drift "Day/Week/Month" vs "Today/This week/…" — unify.
5. Bar chart: y-max/gridline or explicit "one series" note; value labels already exist (keep).
6. Subject bars: consider total-normalized vs max-normalized clarity (231 fills 100% of track).
7. Footer: primary/secondary button order (Export left of Import) — check convention.
8. Re-render ALL store images from the final popup + stats (screenshot3 in particular) and re-run the vision QA loop to ≥9/10 each.

### Notes

- The v1.6.0 popup boot-refresh bug (follow-up textarea shown with a preset selected) was fixed during integration (`refresh()` boot call + HTML `hidden` default); the W1 list above is the polish layer on top.
- Dark-mode parity claims: the light and dark renders are separate captures — review BOTH in W2 (do not let a light-only review stand in for dark).



## Sequencing

1. v1.6.0 integration completes (lanes land → verify → bump → store docs → zip) ← CURRENT FOCUS
2. W1 popup premium (lane) → vision rounds
3. W2 assets re-render + consistency (lane) — after W1
4. W3 copy review (lane) — parallel with W2
5. Coordinator: integrate, bump v1.7.0, CHANGELOG, e2e + lint + zip, then W4 audit on the frozen revision
6. Fix W4 findings → final gates → history scrub → release-candidate report
