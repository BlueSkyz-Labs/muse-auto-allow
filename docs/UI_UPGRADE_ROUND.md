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

## Non-goals

- No behavior/feature changes, no new permissions, no new APIs (UI/UX only).
- No changes to detection paths, storage schema, crypto, or the test harnesses' assertions (may extend fixtures only if a UI change alters DOM the tests rely on — then keep tests strictly stronger).
- No new locales, no store-listing rewrites beyond copy fixes.

## Sequencing

1. v1.6.0 integration completes (lanes land → verify → bump → store docs → zip) ← CURRENT FOCUS
2. W1 popup premium (lane) → vision rounds
3. W2 assets re-render + consistency (lane) — after W1
4. W3 copy review (lane) — parallel with W2
5. Coordinator: integrate, bump v1.7.0, CHANGELOG, e2e + lint + zip, then W4 audit on the frozen revision
6. Fix W4 findings → final gates → history scrub → release-candidate report
