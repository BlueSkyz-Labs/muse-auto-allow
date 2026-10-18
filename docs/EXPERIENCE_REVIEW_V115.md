# Beauty-blind visual review — v1.15.0 tree (SGPS:Experience, BPXS §18)

Instrument: `scripts/capture-shots.mjs` (scratch Chrome, 2× DPI) + the vision lane
(`mimo-v2.6-pro`) reviewing 8 shots: popup onboarding/dry/live × dark/light, stats × dark/light.
Reviewers were asked for impact-ranked findings only (no nitpicks) — the two independent
per-surface reviews are recorded verbatim in the cycle log; verdicts below are mine.

**Probe-artifact disclosure (LSN-007 class, again caught):** the review's top "finding" for the
stats page — an empty 14-day chart despite 15 recorded clicks — was a **seed-shape bug in the
capture script** (`byDay` consumes plain daily COUNTS, the seed wrote objects). Re-captured with
the correct shape; nothing was filed as a product defect before re-derivation.

## Confirmed findings and verdicts

| # | Surface | Finding (both-theme corroborated) | Sev | Verdict |
|---|---|---|---|---|
| R1 | popup | Status block jumble: live status, follow-up reason and empty-log line read as one run-on paragraph | L | **FIX (v1.16.0)** — the empty-log line gets its own breathing room (`.empty` padding) so it no longer reads as a continuation of the sticky state band |
| R2 | popup | Locked "Send now" lock icon reads as a security cue, not a disabled state | M | **REJECT (verified)** — the disabled state is fully explained in-product: `btn.disabled=true` + `title` on the button AND the row (`popup.js` refresh block) + an always-visible inline hint (`#fhint`) + the gated panel; the reviewer could not see tooltips in a still screenshot. Recorded as a nothing-to-change with evidence |
| R3 | popup | Header count pill (`• 0`) has no label — ambiguous | M | **REJECT (verified)** — the pill is the muse.ai TAB-COUNT badge (`#musestat`, v1.9.0 design): compact count + full localized sentence in `title` AND `aria-label` (popup.js `refreshMuseStat`); the reviewer misread a deliberate compactness choice |
| R4 | stats | Zero-value KPI cards use saturated icon tints — attention lands on zeros over the live metric | M | **FIX (v1.16.0)** — `.kpi.zero` dims the icon tint and calms the number |
| R5 | stats | Topic bars carry counts but no percentages | M | **FIX (v1.16.0)** — the share is printed beside each count |
| R6 | stats | Uppercase tracked micro-labels slow scanning | S | DEFER (design-system change; recorded) |
| R7 | popup | "Safety" link sits on the pause row (mixed mental model) | M | DEFER (layout re-architecture; recorded) |
| R8 | stats | Active filter ⇄ chart linkage affordance | S | DEFER (recorded) |
| R9 | both | Perceived contrast of secondary micro-text (automated WCAG AA passes; size/tracking questioned) | S/M | PARTIAL — folded into R4's dim/typography pass and R6's deferred exploration |

Exemplary (kept as house patterns): the blue/grey toggle state language; the pause quick-pills;
the segmented time-range control's active state; the KPI icon-tint grouping.

## Traceability

- Shots: `scratch/shots/*.png` (regenerable anytime via `node scripts/capture-shots.mjs`).
- Reviews: full-text analyses captured in the session/cycle log for this date.
- Fixes land in v1.16.0 with the standard battery; R1/R2 also get machine-checkable assertions
  where feasible (aria/disabled semantics; separator node presence).
