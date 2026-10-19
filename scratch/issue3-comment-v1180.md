## v1.18.0 released — R7 + store kit + SGPS prompt-kit + codex.js security fixes

**Release:** https://github.com/BlueSkyz-Labs/muse-auto-allow/releases/tag/v1.18.0 · merge from PR #14 (CI 39179431860 green).
**Artifact:** `muse-auto-allow-v1.18.0.zip` — 213,482 B, 19 entries, sha256 `5cdad3e6e29112bb7f39467a2865accf82d6c036fbecd272e2ab1d006c5f78c9` (+ sidecar). Determinism 2×; verify-zip 19/0/0/0; smoke `ok:true`.

**Highlights**
- **CX-02 (high, fixed)**: reworded auth surfaces (`Bearer value`, `API-key`, `login to GitHub`) were APPROVED by the codex.js engine pre-fix (independent audit, live repro) — keyword sets widened + three FORBIDDEN fixture cards; `forbiddenHit: []` in every phase.
- **CX-03 (low, fixed)**: plaintext DOM context can no longer survive a failed encryption — both engines drop it; 0-plaintext contract holds.
- **CX-01 (med)**: expand-path hardening + documented residual (`docs/SECURITY_FINDINGS.md`).
- R7 Safety-zone separation; store screenshots 2/3/5 regenerated from real captures (1280×800); `LISTING.md` → 1.18.0.
- SGPS FULL Portfolio **prompt kit vNext 1.3.1** wired (`docs/SGPS_PROMPT_KIT.md`, provenance 33/33).
- **DISCOVERY_FULL catalog** delivered as a PROPOSAL (10 G + 10 S, `docs/PROPOSAL_CATALOG_2026-10-19.md`) — awaiting Owner decisions.

**Evidence:** battery on the frozen tree all exit 0 (9 suites incl. codex-e2e with the new auth negatives · QA v1.14.0 8/8 · `qa-experience` 20/20). Ledger: `docs/RELEASE_INTEGRITY.md` (v1.18.0).
