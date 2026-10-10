# Mission Orchestrator — charter (queued; v1.9 candidate)

Owner idea (2026-10-10, verbatim intent): *"1 tính năng harness chủ động điều phối dự án
(1 task phiên trong muse) để đưa dự án về trạng thái GOLIVE READY, tuân thủ Source of truth,
các quyết định đã quyết của dự án, phối hợp với bộ prompt follow up"* — a **project-orchestration
harness**: a mission the user runs inside one Muse session that drives a project toward
**GOLIVE READY** while obeying the project's source of truth and its already-made decisions,
and that cooperates with the existing Auto follow-up prompt library / rotation.

Status: **IMPLEMENTING — v1.9.0.** The **ENGINE** lane is implemented (mission state machine on
top of the follow-up engine, the shipped mission corpus, the `mission` log kind, the mission state
exposed through the followup-status ping, and `test/mission-e2e.mjs`). The frozen contracts and the
evidence record live in `docs/MISSION_V19.md`. The popup/UI lane (a Missions section) is still to
be built against those contracts. Entry: after the v1.8.0 freeze; design work ran alongside the
Global-Elite Benchmark Round (`docs/GLOBAL_ELITE_BENCHMARK_ROUND.md`).

## Routing record

```
python scripts/sgps_prompt_router.py --mode AUDIT_PLAN \
  --signals "product feature design: mission orchestrator harness, project orchestration in a
             session task, golive ready convergence, source of truth compliance, decision
             respect, follow-up prompt coordination, product evolution" \
  --repo "C:/00. AI Project/PRJ_AutoAllowMUSE"
→ pack=owner-dir-2026-10-04 pack_verified=YES · ROLES: product, experience, security
→ LOAD: 00_SGPS_COMMON_EXECUTION_KERNEL_v1.0 + 01_SGPS_AI_FACTORY_MASTER_v2.0 +
        02_SGPS_PRODUCT_EVOLUTION_v1.0 + 03_SGPS_PREMIUM_EXPERIENCE_v4.0 +
        04_SGPS_SECURITY_PAID_v1.6
→ product signals: product, evolution · experience signals: design · security signals: session, golive
```

## Product concept

A **mission** is an ordered, stateful sequence of prompts that the existing follow-up engine
sends into the Muse session when Muse goes idle. Where the v1.7 phrase library sends a
rotating *phrase*, a mission sends the *next step of a plan* and advances only on a
successful send. The first shipped mission is **"GOLIVE READY — Project Orchestrator"**:

| Step | Intent (what the prompt tells the Muse agent) |
|---|---|
| S1 CONTRACT | Read the project source of truth first (AGENTS.md, docs/, ADRs, active plan/wave state, recent commits, open PRs/issues). Treat approved decisions as binding. Declare the execution contract: mode, authority order, what you will not change. Do not code yet. |
| S2 AUDIT | Audit current state against that source of truth; list gaps with evidence + a dependency graph; rank (security/correctness → blocking defects → approved work → quality → optimization). |
| S3 EXECUTE | Execute the highest-priority READY item end-to-end now: implement, test, prove with real command output, commit/PR per the repo's own rules. Then continue. Do not stop to ask. |
| S4 CONTINUE (loop) | Refresh live truth, reconcile open work, pick the next READY item, execute. Report only what changed + its evidence. |
| S5 RELEASE GATE | Prepare the release gate: exact-artifact readiness, run the repo's gates, produce landing proof; do not promote on RED; list blockers. |
| S6 CONVERGE | Verdict: GOLIVE READY with the evidence chain, or an explicit blocker list with owners. |

Other shipped templates (same machinery): **AUDIT ONLY** (read-only), **FIX FINDINGS**
(remediation loop), **RELEASE PREP** (freeze/verify/packet).

## Storage contracts (to freeze before implementation)

- `missionEnabled: boolean` (default **false** — nothing auto-starts on install).
- `mission: { id, step, cycles, startedAt, lastSentAt }` (absent = no active mission).
- Caps (reuse the existing rails where possible): `MAX_STEPS_PER_MISSION` (proposed 12) and
  `MAX_MISSION_CYCLES` (proposed 3) so a mission can never loop unbounded; the existing
  follow-up cooldown and rate caps still apply.
- `pauseUntil` halts mission sends (existing pause semantics); `dryRun` **logs** the step it
  would send and does not send it.
- The phrase library / round-robin rotation stays for users with no active mission; an active
  mission takes precedence for idle-triggered sends.

## Source-of-truth compliance by construction

- S1 requires reading the project's SoT and listing the binding decisions before any work.
- S3/S4 require live-truth refresh + evidence per step; the mission never invents scope.
- The mission text is **shipped, reviewed content** — never page-derived. A user may copy a
  mission to customize it; custom text goes through the existing escaping/XSS rails.
- The extension never reads the project repository itself (no filesystem/host access): the
  Muse agent does the reading; the extension only orchestrates which prompt is sent and when.

## Safety rails

Shipped-content audit (no secrets, no destructive instruction patterns, no network), caps +
cooldown + pause/dry-run, a new visible log kind `mission` (which step was sent, when), and
fail-closed behavior on odd DOM (never a silent wrong send). A lint check should assert the
shipped mission corpus contains no shell/destructive verbs.

## UX (popup)

A **Missions** section: template list, active-mission progress (`step n/N · cycle c`),
**Send step now**, **Pause mission** (reuses `pauseUntil`), and the live step log. Popup stays
`<=600 px` in every state (existing gate); all labels localized ×6.

## i18n decision (recommendation, needs owner confirmation)

Ship the step **directive text in English** (consistent with the existing rule that agent
directives stay English for reliability) with **localized step titles/labels/descriptions**
in all 6 locales, plus a copy-to-customize path. Revisit only if the owner wants localized
directives.

## Evidence required before any claim

Harness tests for the state machine (advance-on-success only, no send after completion, caps,
pause/dry-run interplay), >=2 falsifications (disable the step advance -> RED), the popup
height gate, and a real end-to-end demo in the fixture chat (steps arrive in order, one per
idle). Maker != judge: an independent pass re-runs the harness on the frozen revision.

## Non-goals

- No repository/filesystem access from the extension; no network; no new permissions.
- No autonomous destructive action — the mission only sends prompts into the user's session.
- Not a replacement for the repo's own governance: the project's SoT and approved decisions
  always win over anything a mission prompt says.

## Open questions for the owner

1. Directive language: English directives + localized labels (recommended) or localized directives too?
2. Ship the GOLIVE READY mission pre-seeded but OFF (recommended) or require the user to add it?
3. Should a completed mission stop silently (recommended, with a log line) or notify?
