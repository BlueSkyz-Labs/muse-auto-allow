# Mission Orchestrator — v1.9.0 ENGINE spec + evidence record

Engine-side specification for the **Mission Orchestrator** (charter:
`docs/MISSION_ORCHESTRATOR_ROUND.md`). This document covers the **engine only** — the popup/UI
lane (a Missions section) is built separately against the contracts frozen here. It is the
authoritative contract for the mission state machine, the shipped corpus, the log kind, the
observability surface, and the evidence.

Owner decisions applied (from the charter's three open questions, defaulted to the
recommendations): step **directives ship in English** (localized labels are the UI lane's job);
the 4 missions ship **pre-seeded but OFF** (`missionEnabled` defaults **false**); a completed
mission **stops silently with one `mission` log line**.

## 1. Product concept (engine slice)

A **mission** is an ordered, stateful sequence of shipped, reviewed directives that the existing
follow-up engine sends into the Muse session when Muse goes **idle**. Where the v1.7 phrase library
sends a rotating *phrase*, a mission sends the **next step of a plan** and advances **only on a
verified send**. The engine only decides **which prompt is sent and when**; the Muse agent does the
reading. The extension never touches the project repository, the filesystem, or the network.

## 2. Frozen storage contracts

| Key | Shape | Default | Meaning |
|---|---|---|---|
| `missionEnabled` | `boolean` | **`false`** | The mission switch. Nothing auto-starts on install. |
| `mission` | `{ id, step, cycles, startedAt, lastSentAt }` | **absent** | The active mission. **Absent = no active mission.** |

- `id` — a shipped corpus id (`golive-ready` \| `audit-only` \| `fix-findings` \| `release-prep`).
  An unknown/blank id is treated as **no mission** (fail closed — `sanitizeMission`).
- `step` — the 0-based index of the **NEXT** step to send, within the current cycle.
- `cycles` — count of **completed** cycles.
- `startedAt` / `lastSentAt` — epoch ms (`lastSentAt` = last **verified** mission send).

Caps (constants in `extension/content.js`):

| Constant | Value | Meaning |
|---|---|---|
| `MISSION_MAX_STEPS_PER_MISSION` | **12** | hard **lifetime** cap on steps a mission may ever send |
| `MISSION_MAX_CYCLES` | **3** | hard cap on full cycles — a mission never loops unbounded |

A mission **completes** when *either* cap is reached (`cycles*L + step >= 12` **or**
`cycles >= 3`), whichever happens first. The existing follow-up **cooldown** and **rolling-hour
rate cap** still apply unchanged to every automatic mission send.

## 3. State machine semantics

**Gate.** A mission send rides the follow-up engine, so it requires **all** of: `followupEnabled`
(the auto-send switch) **and** `missionEnabled` **and** an **active** mission. The mission chooses
*what* is sent; the follow-up switch governs *whether* auto sends happen.

**Precedence.** When the engine decides to send on idle detection **and** a mission is active, it
sends the **CURRENT step** — an active mission takes precedence over the rotating phrase prompts.
The phrase rotation index is **not** advanced by a mission send, and no `followup` log entry is
written for it.

**Advance-on-verified only.** The step advances **only** after the send is **verified** (the
composer verifiably emptied/changed — the same rule as the rotation). A blocked/refused/paused/
dry-run attempt **never** advances:
- refusals (`disabled`, `paused`, `schedule`, `sending`, `approval-present`, `no-composer`,
  `composer-not-empty`, `no-prompt`, `type-failed`) → no send, no advance, no `mission` entry;
- dry-run → logs `mission-dry`, does not send, does not advance.

On a verified send: log a `mission` entry (id + step + cycle) → `lastSentAt = now` → `step += 1`;
if `step >= L` wrap to `step = 0, cycles += 1`; if a cap is now reached → **complete**, else persist
the mission object.

**Completion (silent stop).** `missionComplete()` drops the stored `mission` (`chrome.storage.local
.remove('mission')`), leaves `missionEnabled` as the user set it, and writes **exactly one** `mission`
entry with `mission.complete === true` (plus a `console.log`). No notification. After completion the
engine has no active mission, so idle sends fall back to the phrase rotation.

**Pause / dry-run.** `pauseUntil` (epoch ms in the future) halts mission sends on every path — the
automatic idle send **and** the manual `followup-send-now` (which is refused with reason `paused`).
`dryRun` logs the step it *would* have sent as `mission-dry` and sends nothing.

**Manual 'send now'.** The popup `followup-send-now` path respects the **same** rules: when a mission
is active it sends the current step (and advances only on a verified send); otherwise it falls back to
the rotation/legacy prompt.

## 4. Log kinds

| kind | when | payload |
|---|---|---|
| `mission` | a mission step was **verified-sent** | `mission: { id, step, cycle }` |
| `mission` (complete) | a mission completed | `mission: { id, complete: true, cycles }` |
| `mission-dry` | dry-run: a step *would* have been sent | `mission: { id, step, cycle }`, `dryRun: true` |

Mission entries are recorded via `recordClick(entry, ctx, false)` (they never count as clicks —
`counts=false`), and they ride the same `flushClicks` path. Only `context` is encrypted at rest; the
`mission` object survives for the popup/log/tests.

## 5. Observability (followup-status ping)

The content-script status ping (the established test/observability surface) now also carries the
**applied** mission state, so a harness waits on real state instead of sleeping:

```
missionEnabled, missionId, missionStep, missionCycles, missionSteps, missionActive,
missionCycleNo, missionStepText, missions (the 4 ids), completedMissionId
```

## 6. Shipped mission corpus (English directives; reviewed content)

Defined in `extension/content.js` between the `// MISSION_CORPUS_BEGIN` / `// MISSION_CORPUS_END`
markers. **Never page-derived** — it is shipped, reviewed text. A user may copy a mission to
customize it (that goes through the existing escaping rails; the UI lane owns that surface).

| id | Title | Steps |
|---|---|---|
| `golive-ready` | GOLIVE READY — Project Orchestrator | 6 (S1 CONTRACT · S2 AUDIT · S3 EXECUTE · S4 CONTINUE · S5 RELEASE GATE · S6 CONVERGE) |
| `audit-only` | AUDIT ONLY (read-only) | 4 |
| `fix-findings` | FIX FINDINGS (remediation loop) | 4 |
| `release-prep` | RELEASE PREP (freeze / verify / packet) | 4 |

The `golive-ready` steps implement the charter's SoT-compliance-by-construction: **S1** reads the
project source of truth and lists the binding decisions *before any work*; **S2/S3/S4** require
live-truth refresh + evidence per step; **S5** runs the repo's own gates and refuses to promote on
RED; **S6** delivers the GOLIVE READY verdict with an evidence chain or an explicit blocker list.

### Safety rails (shipped-content audit)

`test/mission-e2e.mjs` scans every shipped step for **destructive instruction patterns**
(`rm`/`delete`/`remove`/`drop`/`wipe`/`format`/`truncate`/`destroy`/`kill`/`overwrite`/`force-push`/
`sudo`/`chmod`/`chown`/`shutdown`/`reset --hard`/`unlink`/`purge`) and for **secret / network /
personal-identifier markers** (password, secret, credential, api key, access token, bearer, private
key, `-----BEGIN`, `http(s)://`, email shape). The scanner ships a **positive control** (a crafted
bad string must be flagged) and a **negative control** (a clean directive must pass), so a zero
result is evidence rather than a tool-shaped blank.

## 7. Non-goals (unchanged from the charter)

- No repository/filesystem/host access from the extension; no network; **no new permissions**.
- No autonomous destructive action — a mission only sends prompts into the user's session.
- Not a replacement for the project's governance: the project's SoT and approved decisions win over
  anything a mission prompt says.
- The popup/UI Missions section is **not** part of this lane.

## 8. Evidence record

Environment: Windows 11, git-bash/MSYS. Chrome 137+ installed at
`C:/Program Files/Google/Chrome/Application/chrome.exe`, launched **detached** by each harness into a
**scratch profile** (never the user's real profile) and reaped by profile path. Node v26.7.0.
The Chrome/CDP suites run **FOREGROUND in a real TTY, unpiped** — a non-TTY/background shell aborts
them with `stdout is not a tty` rc=1 before a single check (a launcher limitation, not a failure).

### 8.1 New harness — `test/mission-e2e.mjs`

CDP lane identical to `test/followup-e2e.mjs` (installed Chrome via `Extensions.loadUnpacked`, temp
extension copy with the localhost test match, scratch profile, teardown by profile path). The
mission state is read back through the `followup-status` ping (races avoided, not slept).

Result: **`ok: true` — 39 checks, 0 failed, 0 verification timeouts.**

```
node test/mission-e2e.mjs
MAA_EXT_DIR=<dir> node test/mission-e2e.mjs     # falsification: point at a mutated copy
MAA_MIS_OUT=<file> node test/mission-e2e.mjs    # also write the JSON summary to a file
```

Cases (all green):

- **pre** — shipped corpus found (4 ids, 18 steps); safety scan flags nothing; the scanner
  discriminates (positive control flags, negative control passes).
- **P** — the ping exposes the applied mission state + the current step text + the 4 ids.
- **A** — an idle-triggered send carries the **exact shipped step 0**; the step advances **after**
  verification (0→1); a `mission` entry records step 0 / cycle 1 with the id; the **rotation index
  is untouched** and **no `followup` entry** is written.
- **A2** — the next idle send carries step 1 (shipped order) and advances (1→2).
- **B1** — a **refused** send (composer holds a draft) does not advance and adds no `mission` entry;
  the draft is preserved.
- **B2** — an approval card blocks the idle send (no send, no advance); manual send-now refused
  `approval-present`.
- **C** — `pauseUntil` halts the automatic send and refuses the manual one (`paused`); clearing it
  resumes and the verified send advances.
- **D** — dry-run logs `mission-dry` for the step it would send, sends **nothing**, does not advance.
- **F** — with a rotation list stored **and** a mission active, the send is the **mission step**
  (never the rotation phrase) and the index does not move.
- **E** — a 4-step mission driven to the **cap**: exactly **12 sends across 3 cycles**, cycle
  increments at each wrap, then a **silent stop** with **exactly one** completion entry (mission
  dropped, `completedMissionId` set) and **no further send**.
- **z** — the fixture page saw no JS errors.

### 8.2 Reverse-mutation (falsification) proofs

Each mutation was applied to a **copy** of `extension/` (the repo tree was never mutated —
`grep -c MUTATION extension/content.js` = 0), the mutation's presence was **asserted before running**
(no silent no-op), the harness was run with `MAA_EXT_DIR` pointed at the copy, then the repo state
was confirmed unchanged. Recorded mapping (mutation → failing checks):

| # | Mutation | Result | Checks that went RED |
|---|---|---|---|
| **F1** | remove the `missionOnVerifiedSend(opts.mission)` call (advance-on-verified guard) | rc=2 | 9 — `A` advance/log, `A2` advance, `C` resume-advance, `E` 12-send/3-cycle/cap-stop/complete |
| **F2** | widen the caps (`MISSION_MAX_STEPS_PER_MISSION=1200`, `MAX_MISSION_CYCLES=300`) | rc=2 | 2 — `E` cap-stop + completion entry |
| **F3** | remove the mission-precedence branch in `followupTick` | rc=2 | 9 — `A`/`A2` step text + advance, `A` rotation untouched, `D` dry-run, `F` precedence |

F1 lowers the count of a **reachability** property (the advance is bound to the verify path);
F2 proves the **cap** is the thing that stops the loop (not something else); F3 proves the engine
actually **chooses the mission** over the rotation. Restoring the repo state returns **39/39 green**.

### 8.3 Existing gates (all suites, foreground + unpiped)

| Gate | Result |
|---|---|
| `node scripts/lint.mjs` | exit 0 — 24 checks across 18 files |
| `node test/e2e.mjs` | exit 0 |
| `node test/followup-e2e.mjs` | exit 0 — 0 failed (nested `"ok": false` engine refusals `paused` / `composer-not-empty` are EXPECTED — they are the guard cases, not failures) |
| `node test/lang-switch-e2e.mjs` | exit 0 |
| `node test/background-unit.mjs` | exit 0 — 29 checks, 0 failed (background.js untouched) |
| `node test/mission-e2e.mjs` | exit 0 — 39 checks, 0 failed |

No existing guard was weakened: the follow-up attempt/verify path, the rotation rule, the pause/
schedule/approval/composer guards and the rolling-hour cap are all unchanged; the mission rides on
top of them.

## 9. Files

- `extension/content.js` — mission corpus + state machine, dry-run + verify branches, precedence in
  the tick, manual send-now, status ping, boot + `storage.onChanged` wiring.
- `test/mission-e2e.mjs` — **new** CDP harness (39 checks).
- `docs/MISSION_V19.md` — this file.
- `docs/MISSION_ORCHESTRATOR_ROUND.md` — status line QUEUED → IMPLEMENTING.
- `extension/background.js`, `extension/popup.*`, `_locales/**`, `manifest.json`, `test/followup-fixture.html`, `scripts/**` — **untouched**.

## 10. Left for the UI lane (not claimed here)

The popup Missions section (template list, `step n/N · cycle c` progress, **Send step now**,
**Pause mission**, live step log, ≤600 px gate, ×6 localized labels) is built against the contracts
in §2/§5. Nothing in this document claims that surface.
