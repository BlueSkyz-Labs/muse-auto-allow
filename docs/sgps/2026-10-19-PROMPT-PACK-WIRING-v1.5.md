# PROMPT-PACK WIRING — SGPS 7-task prompts v1.5 (ACTIVE)

**Date:** 2026-10-19 · **Project:** muse-auto-allow · **Owner-supplied pack.**

**Path (outside repo):** `C:\00_AI_PRJ\00_PROMPT\SGPS_7_TASK_PROMPTS_INDEPENDENT_v1.5_FULL\`
**Provenance:** 8/8 files present; **zip ↔ folder byte-identical** (python sha256 of each zip entry
vs the folder). Hash fingerprints (sha256[:16]):

| File | sha256[:16] |
|---|---|
| 00_START_HERE.md | `4ffc28d43529be12` |
| 01_PRODUCT_DISCOVERY_GOD_TIER_S_PLUS_FULL.md | `ea6f14cfab6ad94d` |
| 02_PREMIUM_EXPERIENCE_UX_UI_FULL.md | `6666ffd2545b5698` |
| 03_SECURITY_AUDIT_FINDING_FIX_FULL.md | `ef841371f7dcda22` |
| 04_PAID_GOLIVE_READINESS_FULL.md | `a355c14e8ba28cb2` |
| 05_SECURITY_PLUS_PAID_COMBINED_FULL.md | `02b4a957f1d457c7` |
| 06_RELEASE_PRODUCTION_ASSURANCE_FULL.md | `c6524d042058eb8c` |
| 07_CONTINUE_APPROVED_WORK_FULL.md | `c00f10b353a9844a` |

## Task → prompt mapping (pick ONE; running all seven is not required)

| Workstream | Prompt | Current state in this repo |
|---|---|---|
| Product strategy / roadmap (Top 10 God-tier + Top 10 Tier S+) | 01 | **NOT_RUN** (strategy notes exist in `MARKET_INTELLIGENCE_2026-10-19.md`, not the SGPS format) |
| UX/UI premium audit + upgrade | 02 | **IN_PROGRESS** — 3 customer-centric rounds shipped (v1.22.3); SGPS-format Top 10/10 report pending Owner review |
| Security audit + fix + re-attack | 03 | **PARTIAL** — W5 independent audit (0 CRIT/HIGH/MED); no full hacker-style 03 pass yet |
| Paid go-live 15-dim | 04 | **PARTIAL** — `GOLIVE_PAID_READINESS.md` matrix at `PAID_GO_LIVE_NOT_VERIFIED` (all Owner gates) |
| Security + Paid combined | 05 | NOT_RUN |
| Release/production assurance (GO/NO-GO) | 06 | **PARTIAL** — release freeze + verify/smoke evidence recorded per release (`RELEASE_INTEGRITY.md`); no separate 06 verdict |
| Continue approved work / convergence | 07 | **ACTIVE** — the default driver for this repo's approved waves |

## Current-state marks

- Pack is **ACTIVE** as the operating contract for the matching workstream; the earlier vNext 1.3.1
  package is **history** (`docs/SGPS_PROMPT_KIT.md` keeps its record).
- The pack grants **no new powers**: Paid/production/protected merges keep their gates; it does not
  move the SGPS pin (still v1.13.0 + overlays, per `docs/SGPS_ADOPTION.md`).
- Each prompt is self-contained (§0 REBIND/AUTHORITY/EVIDENCE/CONTINUATION/CUSTOMER FIRST);
  do not splice the old master prompt or overlays.
- When a prompt is run, record its verdict + evidence pointer here (one line per run) so the
  mapping table stays an honest ledger.

## Run ledger

| Date | Prompt | Verdict | Evidence |
|---|---|---|---|
| 2026-10-19 | 02 (UX) | DISCOVERY report delivered to Owner (Top 10 God-tier + Top 10 Tier S+, approval pending) | `docs/UX_SGPS_V15_REPORT_2026-10-19.md` (created by that run) |
