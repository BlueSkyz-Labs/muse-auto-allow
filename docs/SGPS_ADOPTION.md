# SGPS Adoption Record — Muse Auto-Allow

> **Owner authorization:** 2026-10-18 — "adopt với SGPS FULL và SGPS:Experience" (autonomous
> overnight run, owner delegated end-to-end execution).
> **Record state: `IMPLEMENTING`** (per `standards/adoption/GOLDEN_ADOPTION_PROPAGATION_STANDARD.md`
> §8–§9). An agent does not self-declare `ADOPTED`: closure requires this record merged with
> fresh evidence bound to the exact release revision + the residual central registration gate
> (§7) resolved by the Owner. `ADOPT != ADOPTED`.

## 1. Identity and revision

| Field | Value |
|---|---|
| Project / repo | `BlueSkyz-Labs/muse-auto-allow` (Chrome MV3 extension) |
| Measured project base | v1.13.0 `63d2470` → this record lands with **v1.14.0** (merge revision recorded at PR closure) |
| Pinned SGPS release | **v1.13.0** (`release_tag=v1.13.0`, `tagged_commit=7d651179d21a`; immutable) |
| SGPS source read from | local clone `C:\Users\thinh\dev\sgps-core` (HEAD `425c045`, 747 commits past v1.13.0 = post-release overlays) |
| Declared upstream version | SGPS 1.14.0 (`decisions_through: SGPS-DEC-2026-037`, signed tag pending upstream) — **not** adopted as our pin (pin upgrades are Owner decisions) |
| Impact classification | ADOPT (multiple items), see §3 |

## 2. Pin vs overlays (standard §11)

```text
pinned_sgps_release  = v1.13.0
explicit_overlays    = SGPS-DEC-2026-016 (Paid Go-Live Assurance)
                       SGPS-DEC-2026-034 (verification throughput)
                       SGPS-DEC-2026-035 (lessons-as-code)
                       SGPS-DEC-2026-036 (prompt-vnext orchestration)
                       SGPS-DEC-2026-040 (consequential external side effects)
                       SGPS-DEC-2026-041 (customer-centric decision principle)
                       SGPS-DEC-2026-004/006/007/008/010/012 (BPXS experience umbrella)
```

Adopting overlays does not authorize claiming a newer SGPS release.

## 3. Canonical → local mapping (standard §10 shape)

### 3.1 `sgps.standard.portfolio-experience` — BPXS 1.4 (`standards/experience/BLUE_SKYZ_PORTFOLIO_EXPERIENCE_STANDARD.md`)

| Canonical rule | Current project state | Local gap | Local implementation/control | Verification/evidence |
|---|---|---|---|---|
| Experience Constitution / Quiet Excellence / Digital Hospitality (§5, §7, §8) | Dark+light theme, restrained motion, honest status line, no decoration-only surfaces; v1.11.0–v1.13.0 added state-line precedence, scope captions, honest restore | No formal per-surface experience pass recorded | This adoption + the SGPS:Experience audit pass (checklist below) | `docs/EXPERIENCE_CYCLE_*.md` series + in-Chrome QA (qa scripts) |
| Vietnamese-rooted, multilingual-by-construction (§15) | 6 locales at FULL key parity enforced statically (204 keys × en/vi/zh_CN/ja/ko/es, lint check) | — | `scripts/lint.mjs` parity check; popup locale switcher; stats page now follows the switcher (v1.14.0) | lint + `lang-switch-e2e` + QA v1.14.0 |
| Respectful Agency / Attention Integrity (§29.1–29.2) | Never clicks denies, lone affirmatives; standing grants manual unless YOLO; consent surfaces hard-blocked; every block logged with a reason | Standing-grant classifier had a postfix hole (F1) | Fixed v1.14.0 (ALLOW_RE/STANDING_RE split) + `e2e` FORBIDDEN negatives | e2e `f1-standing` etc.; CHANGELOG v1.14.0 |
| Verification and evidence (§25) | Freeze ledger with exit codes, determinism, falsification runs | — | `docs/RELEASE_INTEGRITY.md` per release | the ledger itself |

### 3.2 Pinned UX Golden (`standards/ux/GOLDEN_UX_UI_MASTER_STANDARD.md`)

| Canonical rule | Current state | Gap | Control | Evidence |
|---|---|---|---|---|
| Accessibility baseline (§12.1) | Keyboard reachability + focus-visible in popup/stats; aria on chart (v1.13.0) | Full contrast audit in both themes not yet executed (desk) | Experience pass (checklist §4) | QA scripts + screenshots (vision lane) |
| Localization correctness | 6-locale parity; manual switcher reaches every surface (v1.14.0) | — | lint parity + stats applyUserLocale + live switch | QA v1.14.0 (8/8) |
| States & feedback (empty/loading/error/paused) | Empty states, quota message, pause banner, blocked-reason deep links | — | `background-unit`, `e2e`, QA | suite outputs |

### 3.3 `SGPS-DEC-2026-016` — Paid Go-Live Assurance (target: GOLIVE PAID)

Disposition **ADOPT** → state `MAPPING_REQUIRED`: the 15-dimension conjunctive readiness matrix
is materialized in `docs/GOLIVE_PAID_READINESS.md` (every dimension marked `NOT_VERIFIED` with
the exact evidence that would satisfy it; owner gates flagged). No dimension may be scored or
partially credited; any applicable FAIL ⇒ BLOCKED. **Paid GO stays an Owner decision.**

### 3.4 `SGPS-DEC-2026-035` — lessons-as-code

ADOPT → `docs/LESSONS.md` created with `LSN-muse-auto-allow-001..005`, each carrying its
strongest feasible executable guard (the suites that fail if the lesson regresses).

### 3.5 `SGPS-DEC-2026-040` — consequential external side effects

Disposition: **NOT_APPLICABLE today, gated for the paid phase.** The extension performs no
external side effects (no network code; lint enforces it). It becomes applicable the day a
license/entitlement exchange adds the first external call — then each effect needs intent ID,
provider contract, definite non-execution evidence, idempotency scope, readback/reconciliation.

### 3.6 `SGPS-DEC-2026-034` — verification throughput

ADOPT (already embodied): zero-dep local battery + deterministic artifact + exact-head merge
discipline; the battery is the train gate. Residual: measured parallelism/load-aware budgets are
not configured for this tiny repo (justified N/A).

### 3.7 `SGPS-DEC-2026-036` — prompt-vnext orchestration

ADOPT (operational): the autonomous run uses the harness lane model (free-tier default; Codex
`gpt-6-luna` lane with a quota probe; vision `mimo-v2.6-pro`) instead of loading every specialist
prompt. The router tool remains the canonical route for phase × surface work.

### 3.8 `SGPS-DEC-2026-041` — customer-centric decision principle

ADOPT: CC-1 customer impact first (honest restore, no silent data loss), CC-2 make degradation
explicit (blocked reasons, newer-schema refusal, failure messages), CC-3 safety boundaries hold
(the rails above are never relaxed for UX).

## 4. SGPS:Experience — separate domain record (per GAPS §7.1/§13)

Experience convergence/evidence stays in its **own domain record** (never embedded as generic
adoption fields): the audit instrument is `docs/SGPS_EXPERIENCE_CHECKLIST.md` (30 items + the
mandatory evidence classes), and the pass execution + results are recorded in
`docs/EXPERIENCE_CYCLE_2026-10-18.md`. Status: the machine-checkable subset **PASSES 11/11** on
the frozen v1.14.0 tree (`scratch/experience-v2.json`; the v1 run's 3 reports were probe defects
— scheme-emulation race and selectors — corrected in v2). Residual manual-class evidence
(screen-reader pass, beauty-blind review) is explicitly pending. The machine-readable adoption
record (same directory, conforming to `schemas/project-adoption.schema.json`) carries the primary
canonical item (BPXS / `sgps.standard.portfolio-experience`) with this markdown as its human
companion.

## 5. Residual gates / exceptions (explicit)

1. **Central registration** — this project is not registered in any SGPS central registry row;
   that (and any `ADOPTED` closure) is an Owner/portfolio gate. The record deliberately stays
   `IMPLEMENTING` until then.
2. **Signed SGPS v1.14.0 tag** upstream is pending; we pin v1.13.0 + overlays (above).
3. **Paid phase evidence** — none exists yet by design; all 15 dimensions `NOT_VERIFIED`.
4. **Contrast/visual audit** in both themes is desk-only until the Experience pass renders it.

## 6. Prohibitions acknowledged (standard §9)

No open PR, candidate branch, successful agent turn, chat approval or central row alone proves
`ADOPTED`. Project-local rules may strengthen SGPS but never silently weaken mandatory canonical
requirements. The pin is immutable to agents; `SGPS:Research FULL`-style reports never promote
themselves into Product Truth.
