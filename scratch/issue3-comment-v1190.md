### v1.19.0 frozen, released, and verified — W1 of the Owner-approved catalog

**Owner decisions locked 2026-10-19** (see `docs/APPROVED_WORK_2026-10-19.md`): execute the
APPROVE_NOW set (G02, G04, G07, S02, S03, S04, S07, S08, S10); money model **C** (freemium PRO,
offline keys — price/channel still pending); SGPS pin unchanged (v1.13.0 + overlays); CWS public
launch **after Wave 1** (this release); support email `support@blueskyzlabs.com` filled in
`store/LISTING.md`.

**Shipped in W1** (PR #15 → squash `a0b0371`, tag `v1.19.0`):
- **S02** log kind chips (All / Allowed / Blocked / Log-only) + search + day-group headers
  (Today / Yesterday / locale date). A **real defect was caught by the new checks pre-freeze**:
  the first build coerced the ISO `at` string with `Number()` → all entries collapsed under one
  bogus 1970 header (LSN-009). Fixed + locked with qa-experience L1–L4.
- **S03** quiet press feedback; **S04** font stacks gain Noto Sans + CJK fallbacks; **S07**
  consent-step "Learn more — how the rails work" link; **S08** audited (the two commands already
  ship with unit coverage — no new code); **S10** the experience instrument now sweeps **all 6
  locales on both surfaces** (12 checks) instead of vi-only.
- i18n **213 keys × 6**; qa-experience **34/34**.

**Freeze**: `dist/muse-auto-allow-v1.19.0.zip` — **216,228 B**, **19 entries**, sha256
`4221e521c3f053ea05f39391a7260770bef8e94de9b0ad96b0d877d3da3cc13f`; determinism 2×
byte-identical; sidecar clean; verify-zip 19/0/0/0; smoke `ok:true`; attached to
https://github.com/BlueSkyz-Labs/muse-auto-allow/releases/tag/v1.19.0

**One honesty note**: the first battery run failed mission-e2e check C on a **test-side race**
(the auto path could fire in the gap between `setState('working')` and the pause applying);
the paused *product* path held in the same run. Fixed test-side (baseline only after the pause
holds — LSN-008) → 2 consecutive green runs recorded in the ledger before this freeze.

**Next**: W2 = G04 (anomaly auto-pause, spec landed) + G07 (daily briefing, spec landed);
then W3 = G02 (mission playbooks); W4 = dormant license core (implementation plan landed).
CWS publish gate is now OPEN (Wave 1 done) — awaiting the Owner's upload action.
