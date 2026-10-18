# Cycle 5 — LIVE TRUTH BASELINE + authority resolution (2026-10-18)

**LIVE_TRUTH_BASELINE_ID:** `LT-2026-10-18-1130-museautoallow-63d2470`

## Live source (verified this round, not from memory)
- Repo: `BlueSkyz-Labs/muse-auto-allow`; default branch `main` = `origin/main` =
  **`63d2470643b0d5193ebbc0963385f5bd422f1e0b`** (= v1.13.0 squash-merge, PR #9).
- Working tree: `extension/content.js` modified (+4/−1: approvalPresent collapsed-card branch —
  pre-baseline approved fix, re-verified: lint 0 / followup-e2e 0 / mission-e2e 0 / e2e 0) +
  untracked `scratch/release-notes-v1130.md` (release notes of v1.13.0, awaiting next commit).
- Open PRs: **none**. Latest CI on main: **success** (run 39125395790, 4m13s, v1.13.0);
  pages-build-deployment success. Previous cycle PRs #7/#8/#9 all merged + green.
- Releases: v1.10.0, v1.10.1, v1.11.0, v1.12.0, **v1.13.0** (zip + `.sha256` attached each).
- Artifact v1.13.0: `dist/muse-auto-allow-v1.13.0.zip` — 210,496 bytes, 19 entries,
  sha256 `aaaa3fd2ef899d28d1220637e0d1fc9674058d4b723171ca1a9c473f83b63ad2`.

## Authority resolution (§1.1)
- No `AGENTS.md` in the repo → Product Truth = `docs/` set (BRANDING.md, QUIET_LUXURY_SPEC.md,
  ENGINE_V18.md, CODEX.md, MUSE_TOS_RESEARCH.md, EXPERIENCE_* cycle docs, REDTEAM_*),
  `CHANGELOG.md`, `docs/RELEASE_INTEGRITY.md`, and the owner-authorized cycle decisions.
- Frozen decisions respected: brand mark/tokens (Quiet Luxury), popup 320px / ≤600px cap,
  minimal permissions (`storage`,`alarms`,`notifications`; pinned hosts), zero-dependency,
  English-label fail-closed, mission directives in English, rails immutable.
- Owner strategic approval ≠ release authorization: CWS upload stays owner-gated (§12.5);
  Muse-ToS decision owner/legal.

## Classification of current functionality
ACTUAL+VERIFIED: engines (content.js/codex.js), popup, stats, onboarding, missions, follow-up,
backup/restore, state line, standing flag, reason-aware links, sync ordering, boot gates.
PARTIAL/NOT_VERIFIED: live muse.ai DOM behavior (VN-1 residual below), real-device/physical
tests (N/A for an extension), CWS listing (owner-gated, not uploaded).

## Delta vs previous round
NEW DELTA: the pre-baseline `approvalPresent` residual fix (uncommitted; re-verified green).
STILL VALID: all v1.13.0 gates. STALE EVIDENCE: none found (CI + releases checked live).
REGRESSION: none observed. ALREADY RESOLVED: cycle-4 candidate set (C4-A..H shipped).

## In-flight this cycle (DELTA_DISCOVERY §5)
- 3 bounded read-only audits: engines-residual · background/stats/TS-04/export-import ·
  performance/limits. + 1 security lens (adversarial inputs, least privilege, supply chain)
  per the portfolio clause for muse-auto-allow.
- Known honest limit carried forward: **VN-1** — the click classifier and the resolved-status
  vocabulary are verified against fixtures + the engine's own contracts; live muse.ai DOM
  evidence (real resolved-card rendering) is NOT available in this environment. Recorded as a
  standing verification gap, not a pass.
