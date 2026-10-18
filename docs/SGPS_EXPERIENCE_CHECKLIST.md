# SGPS:Experience checklist — Muse Auto-Allow (audit instrument)

Derived from `standards/ux/GOLDEN_UX_UI_MASTER_STANDARD.md` (GUX-2026-08-17) +
`standards/experience/BLUE_SKYZ_PORTFOLIO_EXPERIENCE_STANDARD.md` (BPXS-2026-09-01) +
`decisions/SGPS-DEC-2026-041` and the checklists `standards/ux/checklists/design-review.md`,
`standards/experience/checklists/BPXS_RELEASE_GATE.md` (read from the pinned local clone
`C:\Users\thinh\dev\sgps-core`; pin v1.13.0 + overlays — see `docs/SGPS_ADOPTION.md`).

Execution record: `docs/EXPERIENCE_CYCLE_2026-10-18.md` (append the pass results there; a
checklist item is never "done" without its evidence). Status vocabulary: **PASS / FAIL / N/A /
DEVIATION** — every deviation records rule ID + reason + owner (GUX §20).

## Evidence requirements (all four are mandatory per GUX §18.1 / UXD-011/012)

1. **Conformance** evidence (static: lint, parity, token audit) **plus behavioral** (suite/QA)
   **plus runtime** (real MV3 environment, not mockups — BPXS §25/§30.5).
2. Accessibility: automated scan **and** manual keyboard/screen-reader pass on the critical
   journey (UXD-011; GUX §12.2).
3. Non-happy-path evidence: empty / loading / error / paused / permission-denied states
   (UXD-010).
4. 6-locale QA: long strings (vi/ja/ko), diacritics, CJK glyphs, layout integrity (BPXS §15;
   GUX §15.2). Gate results recorded as PASS/FAIL/N/A/DEVIATION with traceable evidence
   (UXD-015, GUX §18.3).

## The checklist (30 items)

### Accessibility
1. Check every interactive element (buttons, toggles, indicators) is keyboard-reachable with a
   clear focus-visible ring. — GUX §12.1/§12.2
2. Check body-text contrast ≥ 4.5:1 and large text ≥ 3:1 in **both** themes. — GUX §12.1
3. Check auto-allow state is never conveyed by color alone (icon + text label mandatory). —
   GUX §12.2; §17
4. Check popup/options work keyboard-only and don't break at 200% zoom / text scaling. —
   GUX §11.1
5. Check automated a11y scan + manual keyboard/screen-reader evidence exists for onboarding. —
   UXD-011; §12.2; §18.1

### i18n / localization
6. Check all UI strings (popup, onboarding, dashboard, indicator) live in the shared message
   catalogs across the 6 locales. — BPXS §15
7. Check the user's language choice persists and outranks browser-locale inference on return
   visits. — BPXS §15
8. Check long strings (vi/ja/ko) don't truncate or break popup/dashboard layout; no hardcoded
   strings. — GUX §15.2; §11.1
9. Check Vietnamese diacritics and CJK glyphs render correctly; dates/numbers use locale
   formats. — BPXS §15; GUX §15.2

### States & feedback
10. Check the dashboard defines empty / loading (skeleton) / partial-failure / full-failure /
    stale-data / refreshing — not just the happy path. — GUX §11.2; UXD-010
11. Check permission-denied / extension-error states show cause + remedy (retry or path). —
    GUX §11.1; §11.2
12. Check skeletons/spinners can't fake completion; spinners have a time bound. — GUX §13.3
13. Check every toggle/button has a disabled/paused state with a visible reason. — GUX §11.1
14. Check the in-page indicator reflects auto-allow state changes quickly and has a text
    alternative. — GUX §11.1; §13.3
15. Check error messages explain what happened, the next step, retry safety; no internal
    diagnostics/stack traces leak. — GUX §14.2

### Destructive-action safety
16. Check irreversible actions (clearing the whole log/all data) require a confirmation that
    states the consequence. — GUX §14.1
17. Check confirmation proportionality: small reversible actions don't prompt; large-impact
    ones get stronger friction. — GUX §14.1
18. Check no dark patterns (fake urgency, buried terms, forced actions); undo/cancel always
    exists. — BPXS §29.1
19. Check only task-necessary data is stored/shown; no sensitive data into logs/clipboard/
    notifications. — GUX §14.3

### Information hierarchy
20. Check the primary auto-allow control is the dominant element of the popup; metrics sort by
    decision value, not decoration. — BPXS §7.2; §17
21. Check hierarchy comes from typography/spacing/meaning, not color or decoration alone. —
    BPXS §7.2
22. Check functional icons (settings/back/on-off) follow platform recognition, not ornamental
    motifs. — BPXS §14
23. Check labels/CTAs use the user's task language, not internal jargon; covered in empty
    states, errors, onboarding. — GUX §15.1

### Motion / perceived performance
24. Check animations serve feedback/continuity and respect `prefers-reduced-motion`. —
    BPXS §7.2; GUX §11.1
25. Check motion doesn't compete with task state; no decorative shimmer/glow/loops. — BPXS §7.3
26. Check popup/stats render fast (state changes <100 ms; INP ≤ 200 ms; CLS ≤ 0.1). — GUX §13.1

### Consistency / tokens
27. Check dark+light themes are driven by semantic tokens (primitive→semantic→component); no
    hardcoded colors in popup/stats/onboarding. — GUX §10.1; BPXS §12
28. Check foreground/on-color contrast is verified in both themes, including the in-page
    indicator. — BPXS §12.3
29. Check spacing/typography scales are shared across popup/stats/onboarding; one component,
    one behavior. — GUX §10.1; BPXS §9.1
30. Check every deviation from the standard is recorded (rule ID, reason, evidence, owner); no
    silent overrides. — GUX §20; UXD-016; DEC-2026-041 CC-2
