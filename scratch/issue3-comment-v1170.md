## v1.17.0 released — R6/R8 + license design (PROPOSED)

**Release:** https://github.com/BlueSkyz-Labs/muse-auto-allow/releases/tag/v1.17.0 · merge `05a4b08` (PR #13, CI 39154935268 green).

**Artifact:** `muse-auto-allow-v1.17.0.zip` — 212,978 B, 19 entries, sha256 `787284fd3937a67b696cec16db86221b6e464c53320d27eafcab5439f96b6676` (+ sidecar). Determinism 2× identical; verify-zip 19/0/0/0; smoke `ok:true`.

**What changed**
- **R6** — uppercase micro labels 10.5 → 11 px with tighter tracking; chart ticks 11 px (beauty-blind review follow-up).
- **R8** — `#ccap` is an `aria-live="polite"` region: switching Day/Week/Month/Year announces the new range.
- **License & entitlement design (PROPOSED — no paid code ships)**: `docs/LICENSING_DESIGN.md` — offline ES256 tokens via WebCrypto (zero-dep, no network), owner-held signing key ceremony, clock-rollback grace, accepted key-sharing risk, DEC-2026-040 mapping for any future online check, full test plan, Owner gates.

**Evidence:** battery on the frozen tree all exit 0 — nine suites + bench + QA v1.14.0 8/8 + `qa-experience` **20/20**. Ledger: `docs/RELEASE_INTEGRITY.md` (v1.17.0).
