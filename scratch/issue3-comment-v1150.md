## v1.15.0 released — SGPS:Experience cycle (machine subset)

**Release:** https://github.com/BlueSkyz-Labs/muse-auto-allow/releases/tag/v1.15.0 · merge `b9eb02a` (PR #11, CI run 39151743624 green).

**Artifact:** `muse-auto-allow-v1.15.0.zip` — 212,646 B, 19 entries, sha256 `e09d1424ba8cfd26bc28505798d10c616a640221be46523e6e9f4c25eb40c69c` (+ sidecar). Determinism 2× identical; verify-zip 19/0/0/0; smoke `ok:true`.

**What changed**
- **E1** — stats chart date labels follow the EFFECTIVE locale (popup's manual switcher > browser), so `vi` sees `17/10`-style and `ja` its own convention; the old "switcher doesn't reach stats" note class is fully closed for text AND data formats.
- **`scripts/qa-experience.mjs` now ships with the repo** — 19 machine checks (SGPS:Experience instrument): WCAG contrast both themes (popup+stats, scheme-confirmed), reduced-motion, focus-visible coverage, `vi` long-string layout, state-as-text, accessible-name coverage via the AX tree, REAL keyboard Tab traversal (onboarding focus-trap + full reachability), 200%-zoom proxy, empty-state presence, locale data formats.

**Evidence:** battery on the frozen tree all exit 0 — nine suites + bench + QA v1.14.0 8/8 + `qa-experience` **19/19**. Ledger: `docs/RELEASE_INTEGRITY.md` (v1.15.0 section).
