# SGPS prompt kit — orchestration driver (v1.5 — 7 task prompts, independent)

**Current kit (owner-supplied, 2026-10-19):**

`C:\00_AI_PRJ\00_PROMPT\SGPS_7_TASK_PROMPTS_INDEPENDENT_v1.5_FULL\`

Provenance verified on 2026-10-19: **8/8 files**, zip ↔ folder byte-identical (python sha256 of
every entry). Baseline hashes (re-verify with `sha256sum` before relying on the kit after any
change to that folder):

| File | sha256 |
|---|---|
| 00_START_HERE.md | `4ffc28d43529be1243e6de534f96fa10b597ee9f28f99ae2703990ef0ae79b55` |
| 01_PRODUCT_DISCOVERY_GOD_TIER_S_PLUS_FULL.md | `ea6f14cfab6ad94dcd2604d07f8add9cdb0d048e0e5b89721512f380a5d22369` |
| 02_PREMIUM_EXPERIENCE_UX_UI_FULL.md | `6666ffd2545b569883e16dab6fba49a520ddadf12018f314183cdacd46a97492` |
| 03_SECURITY_AUDIT_FINDING_FIX_FULL.md | `ef841371f7dcda222b39a05557142ae7b9873ecea8a5b96d9692a61395ff7fc6` |
| 04_PAID_GOLIVE_READINESS_FULL.md | `a355c14e8ba28cb251d4fdc05715097f2e63ca4a3c61d5ba20d3ed8e8413147d` |
| 05_SECURITY_PLUS_PAID_COMBINED_FULL.md | `02b4a957f1d457c7ab35537e15048848c3727581abd50cfdb0aa5d978a4b568f` |
| 06_RELEASE_PRODUCTION_ASSURANCE_FULL.md | `c6524d042058eb8c7e371c0c76b04f62a335c485b61a47678dc1aaa742d356c1` |
| 07_CONTINUE_APPROVED_WORK_FULL.md | `c00f10b353a9844a02ed38ab3c0c1625eaa2a72f1bacfb89b7d688f22924a53a` |

## What to load — ONE prompt per task (v1.5 replaces the spliced master/overlay flow)

| Need | Load exactly one |
|---|---|
| Product strategy / roadmap · Top 10 God-tier + Top 10 Tier S+ | `01_PRODUCT_DISCOVERY_GOD_TIER_S_PLUS_FULL.md` |
| UX/UI audit + upgrade (visual/runtime proof, customer-centric) | `02_PREMIUM_EXPERIENCE_UX_UI_FULL.md` |
| Hacker-style security audit + fix + re-attack | `03_SECURITY_AUDIT_FINDING_FIX_FULL.md` |
| 15-dimension Paid Go-Live audit | `04_PAID_GOLIVE_READINESS_FULL.md` |
| Security + Paid in one session (two independent verdicts) | `05_SECURITY_PLUS_PAID_COMBINED_FULL.md` |
| Release artifact/deploy/runtime/rollback GO-NO-GO | `06_RELEASE_PRODUCTION_ASSURANCE_FULL.md` |
| Continue approved work · code/test/PR/verify · convergence | `07_CONTINUE_APPROVED_WORK_FULL.md` |

Each file is self-contained (§0 operating contract: REBIND / AUTHORITY / EVIDENCE / CONTINUATION /
CUSTOMER FIRST, then the specialist sections + mandatory output + Owner report). Do **not** paste
the master prompt or splice overlays. Read `AGENTS.md`, Product Truth, approved plans,
`sgps.lock.json` and the pinned `sgps-core` canonicals per the official router as the prompt itself
instructs; the prompt adds no powers and never upgrades the pin.

**Historical kit (superseded, kept for traceability):**
`C:\00_AI_PRJ\00_PROMPT\SGPS_FULL_PORTFOLIO_vNext_1.3.1_COMPLETE_WITH_LAUNCHERS\` (33/33 hash-clean
at its own verification) — its progressive-load table and ROUTING_MATRIX no longer drive new
sessions; v1.5 single-file prompts do.

## Modes (as practiced here)

- `DISCOVERY_FULL` (kit 01/02) — produce the complete ranked catalog (target 10 God-tier + 10 Tier
  S+, each with details + red-team + score + Owner Approval Matrix). **No new-feature
  implementation before approval.** `FAIL` if the report stays source-only, invents candidates, or
  claims rendered PASS without fresh rendered evidence.
- `EXECUTE_APPROVED` (kit 07) — the approved horizon is executed autonomously inside the
  invariants; stop only at real Owner gates; always state `CAN_CONTINUE_NOW` + next executable
  action + true Owner gate.
- `SECURITY_FIX` (kit 03) — P0/P1 remediation is an independent lane (not gated behind discovery);
  re-attack after fix.
- `PAID_READINESS` (kit 04/05) — the 15-dimension DEC-016 matrix; `PAID_GO_LIVE_READY !=
  OWNER_PRODUCTION_GO`.
- `RELEASE_ASSURANCE` (kit 06) — source→build→render→deploy chain with GO/NO-GO contract; verifies
  artifact, rollback and runtime, never assumes `MERGED = DEPLOYED`.

## Non-negotiables carried from the kit

`PROPOSAL != APPROVAL` · `MERGED != DEPLOYED` · `NOT_VERIFIED != PASS` · `SOURCE TEST !=
RENDERED UX` · `SANDBOX != PAID PRODUCTION` · no live money/launch from strategy approval · no
silent SGPS pin upgrade or central ADOPTED · never weaken safety/financial gates for polish ·
`CAN_CONTINUE_NOW` is always stated explicitly with the next executable action.
