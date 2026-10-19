# SGPS prompt kit — orchestration driver (vNext 1.3.1 FULL)

The project's autonomous cycles are orchestrated with the **SGPS FULL Portfolio prompt package
vNext 1.3.1** kept outside the repo at:

`C:\00_AI_PRJ\00_PROMPT\SGPS_FULL_PORTFOLIO_vNext_1.3.1_COMPLETE_WITH_LAUNCHERS\`

Provenance verified on 2026-10-19: **33/33 files hash-clean** against `SHA256SUMS.json` +
`LAUNCHERS_SHA256.json` (python sha256, no failures). Re-verify before relying on the kit after
any change to that folder.

## What to load (progressive — do not blanket-load)

| Need | Load |
|---|---|
| Always | `canonical/00_SGPS_COMMON_EXECUTION_KERNEL…` + `canonical/01_SGPS_AI_FACTORY_MASTER…` + this project's `AGENTS.md` + `docs/SGPS_ADOPTION.md` |
| Full discovery / God-tier + Tier S+ catalog | `FULL_MASTER_PROMPT_COPY_READY.md` (or `CONTINUATION_PROMPT_COPY_READY.md` in later sessions) + `canonical/02` + `canonical/03` + `overlays/06` + `overlays/07` |
| Security finding remediation | `launchers/SECURITY_AUDIT_AND_FIX.md` + `canonical/04` + `overlays/10` |
| Paid go-live readiness | `launchers/PAID_GO_LIVE_AUDIT.md` + `canonical/04` + `canonical/05` + `overlays/11` |
| Release / production | `canonical/05` (+ `04` for money/security) |
| Continuation in a new session | `CONTINUATION_PROMPT_COPY_READY.md` (REBIND → DELTA AUDIT → DECIDE MODE → …) |

Routing per surface: see the package's `ROUTING_MATRIX.md` (loaded selectively, never wholesale).

## Modes (as practiced here)

- `DISCOVERY_FULL` — produce the **complete ranked catalog** (target 10 God-tier + 10 Tier S+,
  each with details + red-team + score + Owner Approval Matrix). **No new-feature implementation
  before approval.**
- `EXECUTE_APPROVED` — the approved horizon (e.g. SGPS:Experience fixes R1–R8, docs) is executed
  autonomously inside the invariants; stop only at real Owner gates.
- `SECURITY_FIX` — P0/P1 remediation is an independent lane (not gated behind discovery).
- `PAID_READINESS` — the 15-dimension DEC-016 matrix; `PAID_GO_LIVE_READY != OWNER_PRODUCTION_GO`.

## Non-negotiables carried from the kit

`PROPOSAL != APPROVAL` · `MERGED != DEPLOYED` · `NOT_VERIFIED != PASS` · `SOURCE TEST !=
RENDERED UX` · `SANDBOX != PAID PRODUCTION` · no live money/launch from strategy approval · no
silent SGPS pin upgrade or central ADOPTED · never weaken safety/financial gates for polish.
