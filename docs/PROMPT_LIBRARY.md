# Follow-up Prompt Phrase Library (v1.7.0)

The Auto follow-up engine sends *one string* into Muse's composer whenever Muse goes
idle (see `docs/FOLLOWUP.md` for the engine and its guards). The **phrase library**
turns that single string into a composable, rotatable prompt system:

- **8 groups** of ready-made phrases, each phrase targeting a real failure mode of
  long-run agentic work (mid-task stops, unverified "done" claims, source-of-truth
  loss after compaction, scope creep, weakened controls, silent failures).
- **Multi-select chips** per group; the selection composes into the live Preview in
  **library order** (click order never matters).
- **Custom text** is appended as the last part (a free-form nudge on top of the
  structured phrases).
- The legacy 3 presets stay as one-tap **quick combos** (exact legacy strings).
- **Rotation**: a saved list of composed prompts sent round-robin, one per follow-up,
  advancing only after a *verified* send.

Source of truth: `extension/popup.js` (`PHRASE_GROUPS`, `composePrompt`,
`STARTER_ROTATION`). This document is the rationale + usage companion; the tests pin
the exact strings (`test/followup-e2e.mjs`).

---

## 1. Groups and phrases

### CONTINUE — the task must not stop mid-way

| id | Phrase | Pain it prevents |
|---|---|---|
| `continue-full` | Continue working until the task is fully complete | Agent declares a partial result and stops |
| `continue-noask` | Do not stop to ask — decide, proceed, and report | Waiting on questions nobody is there to answer |
| `continue-longrun` | Long-run: plan → do → check → iterate | One-shot behavior; no plan/verify loop |
| `continue-next` | When one step is done, continue with the next step on your own | Finishing one step and idling |

### VERIFY — no unverified "done"

| id | Phrase | Pain it prevents |
|---|---|---|
| `verify-evidence` | Verify before claiming done — run the tests and show the output | "Done" with no executed evidence |
| `verify-nofabricate` | No fabricated results — report failures plainly | Invented output / smoothed-over failures |
| `verify-redteam` | Red-team your own work before reporting | Shipping the first plausible version |
| `verify-edge` | Verify edge cases and error paths — not just the happy path | Happy-path-only validation |

### QUALITY — best practice + project truth

| id | Phrase | Pain it prevents |
|---|---|---|
| `quality-best` | Follow best practices (latest security standards) | Dated patterns, avoidable risk |
| `quality-sot` | Project Source of Truth is authoritative — read AGENTS.md/docs first | Guessing at conventions (worst after compaction) |
| `quality-bestdo` | Do your best — quality over speed | Speed over correctness |
| `quality-minimal` | Minimal focused changes — no over-engineering | Drive-by rewrites, new abstractions |

### WORKFLOW — durable progress

| id | Phrase | Pain it prevents |
|---|---|---|
| `workflow-commit` | Commit and push with clear messages | Work that exists only in a dead session |
| `workflow-resume` | Resume from the last pushed artifact — check git status/branch first | Re-doing or clobbering finished work |
| `workflow-status` | Keep the PR/issue updated with status + evidence | Silent long runs |
| `workflow-branch` | Work on a feature branch — never commit directly to main | Protected-branch breakage |

### SCOPE — stay inside the task

| id | Phrase | Pain it prevents |
|---|---|---|
| `scope-stay` | Stay within task scope — do not touch unrelated files | Collateral edits |
| `scope-blocked` | Stop and ask ONLY if truly blocked (missing credentials/production access) | Stopping on things it could decide |
| `scope-nodelete` | Do not delete or overwrite existing work without checking with me first | Destructive "cleanup" |

### REPORT — know what happened

| id | Phrase | Pain it prevents |
|---|---|---|
| `report-concise` | Reply concisely: what changed, evidence, next steps | Wall-of-text with no signal |
| `report-blockers` | Report blockers immediately with what you tried and what you need | Silent stalling |
| `report-milestones` | Give a short progress update at each milestone | No way to see progress |

### SECURITY — never trade safety for green

| id | Phrase | Pain it prevents |
|---|---|---|
| `security-threatmodel` | Security first — threat-model and think in attack chains | Feature-first thinking |
| `security-failclosed` | Fail closed on unknown state — never guess | Guessing past ambiguity |
| `security-noweaken` | Never weaken controls or tests to get green | Disabling the failing guard/test |
| `security-secrets` | Secrets and tokens never in code, logs, or prompts | Credential leakage |

### DESIGN/UX — the surface is part of the deliverable

| id | Phrase | Pain it prevents |
|---|---|---|
| `design-a11y` | Follow the design system and accessibility — contrast AA, focus-visible, reduced-motion | Unusable, unpolished UI |
| `design-states` | Design every state: empty, loading, error, disabled | Default-looking states |
| `design-premium` | Premium, cohesive UI — no placeholder polish, no dead affordances | Half-done surfaces |

---

## 2. Composition rules

1. Selected phrases compose in **library order** (the order above), never click order.
2. Parts are joined with `"; "`; a composition of **more than one part** gets a final
   `"."`. A single phrase is stored without the trailing period.
3. The **custom textarea is appended as the last part** (trimmed, capped at 600 chars).
4. `followupPrompt` in `chrome.storage.local` always holds the **composed string** —
   exactly what the engine will type. `followupChips` (array of phrase ids) re-hydrates
   the selection in the popup; the two can never disagree (the popup rewrites the
   stored prompt whenever it disagrees with chips+custom).
5. An absent `followupChips` key = legacy state: the stored prompt is shown as custom
   text (or as its quick combo) — nothing is lost on upgrade.
6. The popup **never leaves the engine promptless**: with no chips and no custom text it
   falls back to preset 1 (`Approve and continue working`).

## 3. Quick combos (legacy presets, exact strings)

| Button | Stored prompt |
|---|---|
| Keep going | `Approve and continue working` |
| Long-run | `Continues implementation — working long-run` |
| Best practice | `follow best practice, Project Source of Truth, Do your best` |

One tap = chips cleared, custom cleared, the exact legacy string stored. The button
shows pressed state; typing custom text or selecting a chip clears it.

## 4. Recommended combos

### Starter rotation (one tap: `Starter rotation`)

| # | Combo | Why |
|---|---|---|
| 1 | `continue-full` + `verify-evidence` | Keep going **and** prove it |
| 2 | `quality-best` + `quality-sot` | Best practice + project truth |
| 3 | `workflow-commit` + `workflow-status` | Durable, visible progress |

### Security review pass (when touching auth/data/permissions)

`security-threatmodel` + `security-failclosed` + `verify-evidence` + `scope-stay` —
attack-chain thinking, fail-closed behavior, evidence, and no scope creep while
auditing.

### Design pass (any UI surface)

`design-a11y` + `design-states` + `design-premium` + `verify-evidence` — the three
design rails plus proof (screenshots/measurements) rather than "looks right".

### Post-compaction recovery (after a context loss / fresh session)

`quality-sot` + `workflow-resume` + `continue-full` + `report-concise` — re-anchor on
the project's Source of Truth, resume from the pushed artifact, keep going, report
tightly. This is the combo that recovers a half-finished lane.

## 5. Per-group save (one tap per chip group)

Every group in the library sheet has a **save action** under its chips:

- It saves **exactly that group's selected phrases** as one composed prompt
  (e.g. VERIFY with `verify-evidence` selected → `Verify before claiming done — run
  the tests and show the output`), appended to the rotation list.
- The action is **disabled while the open group has no selection**.
- Saving is **idempotent per string** (an identical prompt is not added twice).

## 6. Rotation semantics

`followupPrompts` (array of composed strings) + `followupRotateIdx` (index of the
**next** prompt to send):

- Non-empty list → each follow-up uses `followupPrompts[rotateIdx % len]`.
- The index advances **only after a verified send** (composer emptied/changed). A
  blocked send (approval card present) or a failed send **repeats the same prompt** —
  a prompt is never skipped.
- The popup's rotation line shows `Next: i/n` (the engine's live ping wins once a tab
  answers); the list itself shows each row's **source group** (derived from the
  phrases it contains: `Continue+Verify`, `Quality`, …; a custom part → no tag, since
  metadata is never invented).
- `Save combo` appends the current preview; per-group save appends the group's combo;
  `Starter rotation` loads the three recommended combos; each row has a remove `✕`.
- Absent/empty list → the legacy single `followupPrompt` is used (rotation is opt-in
  by populating the list).

## 7. Where it lives

| Artifact | Role |
|---|---|
| `extension/popup.js` | `PHRASE_GROUPS`, `composePrompt`, `STARTER_ROTATION`, per-group save, rotation UI |
| `extension/popup.html` | Library sheet (bounded, internally scrollable), quick combos, rotation row |
| `extension/content.js` | Rotation engine (`followupActiveText`, `advanceFollowupRotation`) — advances on verified sends only |
| `extension/_locales/*` | All UI labels are real i18n keys ×6 locales (group names, save action, rotation) |
| `test/followup-e2e.mjs` | Pins the phrases, composition, per-group save, rotation end-to-end + falsification |

Prompt strings themselves are **English by design** (they are instructions to the
agent); only the popup chrome is localized.
