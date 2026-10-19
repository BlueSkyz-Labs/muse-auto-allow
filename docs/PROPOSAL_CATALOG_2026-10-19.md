# Upgrade Proposal Catalog — 2026-10-19 (DISCOVERY_FULL, SGPS vNext 1.3.1)

> Mode: `DISCOVERY_FULL` per `FULL_MASTER_PROMPT_COPY_READY.md` §3–§5. **PROPOSAL != APPROVAL**
> — nothing here is coded until the Owner approves specific IDs. Baseline: v1.18.0 tree
> (rebind recorded in `docs/RELEASE_INTEGRITY.md`; live truth = tag `v1.18.0`). Evidence labels:
> E1 = source/design, E2 = rendered/runtime capture, E0 = hypothesis. Scoring per the master
> prompt: Customer 30 · Friction 20 · Evidence 15 · Fit/Differentiation 15 · Value/Effort 10 ·
> Safety/Ops 10 → /100.

## A. God-tier (transform customer outcome)

| Rank/ID | Proposal | Problem today | Before → After | Benefit | Score/Ev | Effort/Risk | Rec |
|---|---|---|---|---|---|---|---|
| 1 · G01 | **Local autonomy policy engine** (topic/surface/label/window rules, dry-run preview) | One global switch + keyword filter; power users can't express "always approve repo pushes on weekdays, never force-push" | ad-hoc manual monitoring → policy-governed autopilot with preview | Trust + real automation; fewer babysit sessions | 94 / E1+E2 | L / MEDIUM | APPROVE_AS_PILOT |
| 2 · G02 | **Mission Playbooks** (reusable templates with variables + per-playbook guards) | Missions are fixed prompts; repeated workflows get re-typed | repeated setup → one-tap parameterized runs | Task time down; adoption of long-run mode | 90 / E1+E2 | M / LOW | APPROVE_NOW |
| 3 · G03 | **Approval review queue + jump-back** | After an auto-click the card is gone; no recovery surface | invisible action → itemised queue with "open card / why" | Recoverability, oversight confidence | 88 / E1 | M / MEDIUM | APPROVE_AS_PILOT |
| 4 · G04 | **Anomaly auto-pause** (rate/topic spikes → pause + notify) | Only manual pause; a runaway loop looks like normal clicking | blind trust → automatic circuit breaker | Safety perception + real protection | 87 / E1 | S / LOW | APPROVE_NOW |
| 5 · G05 | **Codex repo/command scope guard** (local allowlist for chatgpt.com approvals) | Codex lane approves broadly once enabled | broad consent → repo/command-scoped consent | Enables safe codex use at work | 86 / E1+E2 | M / MEDIUM | VALIDATE_FIRST |
| 6 · G06 | **Signed local audit chain + export** (hash-chained entries, verify script) | Log is local JSON; no tamper evidence | trust-me log → verifiable local audit | Compliance/team trust; differentiator | 84 / E1 | M / LOW | APPROVE_AS_PILOT |
| 7 · G07 | **Daily briefing card** (overnight digest: clicks, blocks, reasons, trends) | Digest exists but thin; insights scattered | status list → decision summary | Oversight at a glance; retention | 82 / E1+E2 | S / LOW | APPROVE_NOW |
| 8 · G08 | **Multi-surface console** (per-surface toggles + future hosts registry, still minimal perms) | Muse + Codex only, separate knobs | one product → one console per surface | Clarity, extensibility | 80 / E1 | M / MEDIUM | VALIDATE_FIRST |
| 9 · G09 | **Config presets sharing** (export/import curated profiles, no logs) | Copy-pasting settings by hand | manual → shareable preset files | Onboarding of colleagues; support | 76 / E1 | S / LOW | APPROVE_AS_PILOT |
| 10 · G10 | **Weekly insight prompts** ("X blocked by topic Y — adjust?") | Static stats; user must interpret | numbers → guided config actions | Config quality loop | 74 / E1+E2 | S / LOW | DEFER |

Rejected candidates (documented): a cloud sync of settings (privacy + scope), an AI summariser of logs (network + cost + privacy), paid-only automation features (violates the "safety stays free" invariant).

## B. Tier S+ (make existing experiences exceptional)

| Rank/ID | Proposal | Problem today | Before → After | Benefit | Score/Ev | Effort/Risk | Rec |
|---|---|---|---|---|---|---|---|
| 1 · S01 | **Popup IA pass** (zones: status → control → long-run → numbers; progressive disclosure) | Dense single column; 6 sections compete | scan-everything → glanceable hierarchy | Faster comprehension | 91 / E1+E2 | M / MEDIUM | APPROVE_AS_PILOT |
| 2 · S02 | **Log readability**: day groups, kind/topic filters, search | Flat list; long logs hard to scan | linear list → structured, filterable | Daily-use efficiency | 89 / E1 | M / LOW | APPROVE_NOW |
| 3 · S03 | **Micro-interaction & feedback pass** (click tick, count pop, state transitions; reduced-motion safe) | Correct but flat feedback | functional → tactile | Perceived quality | 86 / E1 | S / LOW | APPROVE_NOW |
| 4 · S04 | **Typography & diacritics pass** (font stack, rhythm, tabular numerals, CJK) | System stack; uneven rhythm at 292px | adequate → crafted | Legibility + brand craft | 85 / E1 | S / LOW | APPROVE_NOW |
| 5 · S05 | **Stats chart upgrade** (7/14/30 toggle, hover tooltips, accessible data table) | Fixed 14-day; hover-less | static chart → explorable, accessible | Insight depth | 84 / E1 | M / LOW | APPROVE_AS_PILOT |
| 6 · S06 | **Mission sheet UX** (search, categories, reorder, duplicate) | Manageable list; grows unwieldy | list → organised library | Power-user speed | 80 / E1 | M / LOW | APPROVE_AS_PILOT |
| 7 · S07 | **Onboarding refinement** (progress, contextual help, "what will it click" demo) | 3-step flow solid; help thin | wizard → confident first run | Activation | 79 / E2 | S / LOW | APPROVE_NOW |
| 8 · S08 | **Keyboard excellence** (shortcuts, roving tabindex in sheets, focus return everywhere) | Tab order works (G1/G2); no shortcuts | reachable → fast | Accessibility + speed | 78 / E2 | S / LOW | APPROVE_NOW |
| 9 · S09 | **State completeness pass** (skeleton/loading, error retry, stale-data marker on stats) | Empty state + errors exist; loading thin | correct → resilient | Trust under failure | 77 / E1 | S / LOW | DEFER |
| 10 · S10 | **i18n QA sweep** (long-string/plural/format audit across 6 locales with captured evidence) | Parity enforced; long-string evidence partial | parity → proven per-locale quality | International credibility | 75 / E2 | S / LOW | APPROVE_NOW |

## C. Red-team summary (Need → Experience → Solution, before final)

- **G01 policy engine** — Need: real (power users script via docs); Experience: rule-authoring can overwhelm — mitigate with templates + dry-run; Solution: keys must never weaken rails (policies only narrow, never widen, the click set). **KEEP→pilot.** Strongest objection: complexity for a 292px popup → ship via the Safety panel sheet + presets.
- **G02 playbooks** — Need: real; Solution: variables could inject weird prompts → validate + preview. **KEEP.** Objection: overlaps missions → extend missions rather than a second concept.
- **G03 review queue** — Need: real (post-hoc accountability); Solution: the platform may not allow reopening a card → queue links to the log + surface, honest limits. **REFINE.**
- **G04 anomaly pause** — real, small, safe; thresholds must be explainable; **KEEP.**
- **G05 codex guard** — high value but demands precise repo detection on chatgpt.com DOM → **VALIDATE** with a fixture-first pilot.
- **G06 audit chain** — real for teams; Solution: hash chain must not leak labels in plaintext (already encrypted log) → chain over ciphertext. **KEEP→pilot.**
- **G07/G10** — G07 fits existing digest (small); G10 risks nagging → DEFER G10.
- **G08 multi-surface** — scope creep risk; VALIDATE demand first.
- **G09 presets** — small, safe; pilot (file format + import sanitizer reuse).
- **S-items**: all pass red-team with the noted mitigations (S09 deferred for thin payoff now).

## D. Owner Approval Matrix (OWNER_DECISION = PENDING for every row)

| ID | Recommendation |
|---|---|
| G01 | APPROVE_AS_PILOT |
| G02 | APPROVE_NOW |
| G03 | APPROVE_AS_PILOT |
| G04 | APPROVE_NOW |
| G05 | VALIDATE_FIRST |
| G06 | APPROVE_AS_PILOT |
| G07 | APPROVE_NOW |
| G08 | VALIDATE_FIRST |
| G09 | APPROVE_AS_PILOT |
| G10 | DEFER |
| S01 | APPROVE_AS_PILOT |
| S02 | APPROVE_NOW |
| S03 | APPROVE_NOW |
| S04 | APPROVE_NOW |
| S05 | APPROVE_AS_PILOT |
| S06 | APPROVE_AS_PILOT |
| S07 | APPROVE_NOW |
| S08 | APPROVE_NOW |
| S09 | DEFER |
| S10 | APPROVE_NOW |

## E. Waves after approval (dependency-correct)

1. **Wave 1 (safe, no architecture change):** S02, S03, S04, S07, S08, S10 + G04, G07 → one release.
2. **Wave 2 (small features):** G02 (extend missions), G09, S01 pilot → release.
3. **Wave 3 (pilots with fixtures):** G01 (policy engine preview), G03, G06, S05, S06 → releases behind explicit opt-ins.
4. **Wave 4 (validation first):** G05, G08 — fixture pilots, then decide.

All waves keep the invariants: no network without the license design being Owner-approved, safety
rails never gated by paid tiers, minimal permissions, zero runtime dependencies.
