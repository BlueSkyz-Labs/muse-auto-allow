# Mission Orchestrator — v1.9.0 POPUP/UI lane (spec + evidence)

The **UI** lane built against the frozen engine contracts in `docs/MISSION_V19.md`
(charter: `docs/MISSION_ORCHESTRATOR_ROUND.md`, §"UX (popup)"). The engine — the mission
state machine on top of the follow-up engine, the shipped corpus, the `mission` log kind and
the `followup-status` ping fields — is untouched by this lane; the popup only **drives** it.

## 1. What shipped

- **A Missions entry** on the Auto-follow-up section header row (next to the section title): a
  compact pill with the localized label `missionTitle`, a state dot and a chevron. It is a real
  `<button>` with `aria-expanded` + `aria-controls="missionSheet"`.
- **A full-popup Mission sheet** (`#missionSheet`, the established Safety-panel / onboarding
  pattern: `position:absolute; inset:0`), reached from that entry. It carries:
  - the **enable toggle** → the frozen key `missionEnabled`;
  - the **4 shipped missions**, each selectable, showing its **localized name**, **step count**
    (`missionSteps`) and a one-line **description**; the active one uses the one selected-state
    recipe (tint + border + weight + `aria-checked`);
  - the **active-mission progress line** `step n/N · cycle c` (`missionProgress`) + the mission
    name, and the **current step's directive text** (from the ping's `missionStepText`, clamped
    to 3 lines — English, as shipped);
  - **Send step now** (`missionSendStep`) — rides the same manual `followup-send-now` path the
    engine already exposes (an active mission sends the CURRENT step; pause/approval/composer
    guards and the advance-on-verified rule all apply);
  - **Pause mission** (`missionPause`) — writes `pauseUntil` (the ONE pause semantic; no second
    pause is invented). When a pause is active the same button reads **Resume** and writes `0`;
  - the **last completion** (`missionLastDone`) as a quiet line, from the ping's
    `completedMissionId` or the durable `mission`-complete log entry.
- **The new engine log kind `mission`** in the existing log list: the kind chip is
  `kindMission` / `kindMissionDry` (`.k-mission`, the accent outline-tag recipe), the bold title
  is the **localized mission name**, and the context line is a localized `step n/N · cycle c`
  (`missionStepCtx`) or `complete · c cycles` (`missionCompleteCtx`). Everything is interpolated
  through `esc()` — never raw HTML. The engine's own English `context` string is not shown.

### 1.1 i18n (6 locales, parity green)

All **labels/names/descriptions** go through keys added to **all six** locales
(`en/vi/zh_CN/ja/ko/es`), identical key sets (lint + both e2e pre-flights assert parity):
`missionTitle, missionToggle, missionChoose, missionSendStep, missionPause, missionProgress,
missionStepCtx, missionCompleteCtx, missionSteps, missionGateNote, missionLastDone,
kindMission, kindMissionDry, missionGolive(+Desc), missionAudit(+Desc), missionFix(+Desc),
missionRelease(+Desc)`. The **step DIRECTIVES stay English** as shipped by the engine (the
charter's decision) — they are the frozen, reviewed corpus text and are not translated.

## 2. Placement rationale (chosen: pattern (a), a row that opens a full-popup sheet)

The popup is capped at **≤600 px in every state**, and the crowded states have very little
slack: `test/followup-e2e.mjs` measures the Auto-follow-up section at **312–314 px** with the
advanced group open, leaving the layout essentially at the cap (log viewport ~14 px). A
dedicated full-width section row costs ~30–42 px, which would push that state past 600. The
**Safety-panel pattern** avoids that entirely: the entry is a small pill that sits on the
**existing** header row (its height is the section-title row's height; the log absorbs the
~2 px it adds), and the whole rich surface lives in an `inset:0` overlay that **cannot** grow
the popup (its `.ovbody` owns the scroll). The mission rides the follow-up engine, so the entry
living on the follow-up header is also the semantically honest home.

## 3. Measured heights (`<= 600 px` everywhere)

CDP probe of the real popup at 320 px (light), sheet rendered with a full 12-entry log:

| State | body | lowest content edge |
|---|---|---|
| default (empty, follow-up OFF, onboarded) | 429 | **423** |
| full 12-entry log incl. 2 `mission` entries | 600 | **594** |
| **mission sheet open** (list, no active) | 600 | **600** |
| **mission sheet open + active mission + full log** | 600 | **600** |
| mission sheet open + active + worst-case long step text | 600 | **600** |

`node test/followup-e2e.mjs` (follow-up ON, the advanced group open — the harness's crowded
state): **empty 594 / full 594 / sheet 594** (the header pill added ~2 px, absorbed by the log:
its viewport went 16 → 14 px). `node test/lang-switch-e2e.mjs`: default **423**, menu +
full-log **594**. Every state ≤ 600.

## 4. i18n overflow sweep (6 locales, worst case, sheet open)

Worst case seeded: 12-entry log (with `mission` + completion entries), an active mission, the
sheet open. Per locale `en/vi/zh_CN/ja/ko/es`:

| locale | lowest | `document.scrollWidth` | max element right edge vs the 306 content column |
|---|---|---|---|
| en | 594 | 320 | none past the column |
| vi | 600 | 320 | none |
| zh_CN | 600 | 320 | none |
| ja | 600 | 320 | none |
| ko | 600 | 320 | none |
| es | 600 | 320 | none |

`document.scrollWidth` stays **320** in every locale and no element's right edge passes the
content column (320 − 2×14 = 306). The progress line renders correctly in each language
(e.g. `bước 6/6 · vòng 2`, `第 6/6 步 · 第 2 轮`, `ステップ 6/6 · サイクル 2`,
`6/6 단계 · 2 사이클`, `paso 6/6 · ciclo 2`).

## 5. Contrast (measured in the rendered output)

Every changed text pair, computed from the real render's composited colours (WCAG 2.x
luminance + 8-bit alpha compositing) and **pixel-verified** by decoding the 2× Chrome PNGs:

| Pair | Light | Dark |
|---|---|---|
| entry pill label: `--accent-text` on `--accent-tint` | **5.33:1** | **7.45:1** |
| sheet title / progress: `--ink` on `--bg` | 16.86:1 | 15.44:1 |
| gate note / mission name / last-done: `--muted` on `--bg` | 5.99:1 | 7.78:1 |
| current step text: `--ink-2` on `--bg` | 10.34:1 | 11.25:1 |
| selected row name: `--accent-text` on `--accent-tint` | 5.33:1 | 7.45:1 |
| selected row count + description: `--muted` on tint | 5.14:1 | 6.54:1 |
| `Send step now` primary: `--on-btn` on `--btn-ink` | 17.74:1 | (dark: ink-on-ivory) |
| `Pause mission` outlined: `--ink` on `--bg` | 16.86:1 | — |
| mission log chip: `--accent-text` on `--accent-tint` (pixel-sampled) | **5.33:1** | **7.46:1** |

Non-text state pair (≥3:1): the **state dot** `--accent-state` on the entry tint = **5.33:1**
(light) / **4.69:1** (dark). Pixel sampling of the real render reproduced the exact flat
colours: tint bg `rgb(225,233,241)` / `rgb(19,38,69)`, accent-text `rgb(0,90,191)` /
`rgb(138,184,255)`, dot `rgb(0,90,191)` / `rgb(77,142,247)`. State is never colour-only:
active = tint + border + weight + the dot's presence + `aria-checked`; paused = the "Paused"
word in the existing pause row. The control hairlines (`--stroke`, `--accent-line`) are the
spec's documented **decorative** class (`docs/QUIET_LUXURY_SPEC.md` §5.4).

## 6. Keyboard path (trusted CDP key events)

`Input.dispatchKeyEvent` against the real popup: **Tab reaches the entry** (tab stop 8);
**Enter opens the sheet** (`aria-expanded="true"`, focus moves to the sheet's close button);
**Tab reaches a mission row**; **Enter selects it** (the mission is written to storage);
**Escape closes the sheet** (`aria-expanded="false"`, sheet hidden) and **returns focus to the
entry**. `:focus-visible` is the shipped global ring; the mission sheet is `role="dialog"`
`aria-modal` like the Safety panel.

## 7. Functional proof (real popup → real engine)

Driven through the popup UI, read back through the engine's `followup-status` ping and the
fixture's send recorder:

1. Selecting **GOLIVE READY — Project Orchestrator** in the sheet writes
   `missionEnabled: true` and `mission: {id:'golive-ready', step:0, cycles:0, …}`.
2. The engine applies it: ping `missionActive:true`, `missionId:'golive-ready'`, `missionStep:0`,
   `missionSteps:6`, `missionStepText` = the shipped **S1 CONTRACT** directive.
3. On idle, the next send carries the **EXACT shipped step 0** (submitted via the send button),
   and the step advances to **1** only after that verified send. A `mission` log entry records
   step 0 / cycle 1 with the id.
4. **Pause mission** writes `pauseUntil` in the future; the engine reports `paused:true`; the
   same button resumes (`pauseUntil: 0`).
5. The sheet lists exactly the 4 shipped ids in order:
   `golive-ready, audit-only, fix-findings, release-prep`.

## 8. Gates (all six suites, foreground + unpiped)

| Gate | Result |
|---|---|
| `node scripts/lint.mjs` | exit 0 — 24 checks across 18 files (syntax, JSON, i18n parity) |
| `node test/e2e.mjs` | exit 0 |
| `node test/followup-e2e.mjs` | exit 0 — 0 failed (heights 594/594/594; the nested `"ok": false` refusals `paused` / `composer-not-empty` are the expected guard cases) |
| `node test/lang-switch-e2e.mjs` | exit 0 |
| `node test/background-unit.mjs` | exit 0 — 29/29 |
| `node test/mission-e2e.mjs` | exit 0 — 39 checks, 0 failed |

## 9. Files

- `extension/popup.html` — the mission CSS (tokens reused, no new colour/size), the entry pill
  on the follow-up header, the `#missionSheet` overlay, `.k-mission` log chip.
- `extension/popup.js` — `MISSION_META`, the mission state/render/wiring, the ping capture, the
  `mission` log rendering, the shared `doFollowupSend`, the Escape handling.
- `extension/_locales/**` — the 23 new keys × 6 locales.
- `store/screenshot1.png`, `store/screenshot3-popup.png` — regenerated (`scripts/store-shot.mjs`
  + `scripts/stats-shot.mjs`, both seed `onboarded:true`).
- `docs/UI_V19.md` — this file.

## 10. Limits / not claimed

- **Vision is directional only.** No vision score is claimed as a gate (per
  `docs/GLOBAL_ELITE_BENCHMARK_ROUND.md` "Instrument calibration"); acceptance here is
  deterministic (heights, i18n sweep, contrast, keyboard, functional, six suites).
- The engine, `content.js`, `background.js`, `manifest.json`, `stats.*`, `test/**` and the other
  `store/*.png` were **not** touched.
- The sheet is a full-popup overlay (like the Safety panel); it does not implement a focus trap,
  matching the shipped overlays.
