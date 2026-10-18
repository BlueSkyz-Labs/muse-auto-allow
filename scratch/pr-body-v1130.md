## v1.13.0 — cycle 4 (AUDIT → PLAN → DO → CHECK) — FINAL round

Candidates from **2 bounded read-only audit subagents** (engines; background/stats/popup — one executed the real function bodies to prove its findings). Every claim re-verified in-session: **8 confirmed fixes, 2 rejected with reason** (`scratch/cycle4-candidates.md`). A bounded **red-team subagent** then reviewed the five hardening claims — **2 PASS with caveats (both fixed), 1 FAIL (fixed), 2 PASS with nuances recorded**.

| # | Fix | Wrong before | Now |
|---|---|---|---|
| **C4-A** | Sync × install defaults | `migrate()` seeded defaults that shadowed synced settings on a fresh device, then pushed them over the bucket | `onInstalled` chains **pull → migrate**: synced values fill absent keys first; explicit locals still win. bgu **35/35** (G2a/b/c) |
| **C4-B** | Boot kill-switch gate | a sweep could run before the `enabled` read landed (hardcoded default `true`) | gate inside `sweep()` on **enabledReady** — observer/interval/timer paths all covered |
| **C4-C** | Connector depth | path A climbed 1 level (path B: 2) — a wrapper-level Connect wording was clickable | `connectorNear(card, 2)` — safety-aligned |
| **C4-D** | Honest restore | confirm promised "replaced" but files only merged (old encrypted log survived); ctx-no-key silently bricked entries | **data keys absent from a file are removed** (set-first/remove-second — quota-safe), restrictions keep fail-closed merge, copy rewritten ×6, no-key notice fires. ims **154/0** (G13) |
| **C4-E** | `approvalPresent()` | a lingering RESOLVED card blocked every follow-up/mission send forever | **structural actionable-pair predicate** = path A's ground truth minus pacing (over-count-only → fail-safe); red-team-FAIL version (text regex) replaced |
| **C4-F** | Composer-gone handling | post-submit SPA unmount recorded "unverified" → missions stalled forever | composer-gone **after a real submit** counts as delivered; the verify window arms only when a submit fired; both-fail = explicit `submit-failed` |
| **C4-G** | Chart a11y | `role="img"` with no accessible name (WCAG 1.1.1) | `aria-labelledby="ccap"` |
| **C4-H** | Topics caption | denominator could contradict the Total KPI | denominator follows the KPI; bars clamped ≤100% |

**Rejected with reason:** Muse review-bar wording broadening (click surface without live evidence); cooldown-eviction order + codex digest declaration order (known-minor/unreachable). **i18n:** 203 keys × 6 (+`followupSendBlockedSubmit` — the F2 reason-coverage assert flagged the un-mapped reason; parity green).

### Verification (frozen tree)

lint 0 (27) · background-unit **35/35** · import-security **154/0** · yolo-ux-unit 5/5 · e2e 0 · followup 0 · mission 0 · lang-switch **24/24 @ 203 keys × 6** · codex 0 (4 phases) · experience assert **28/0**. In-Chrome QA exercised chart a11y, KPI-consistent caption + clamp, data-restart + no-key dialogs, and the v1.12.0 flip-confirm regression. Several hardening edits landed across the battery window incl. the two red-team fixes — each re-verified immediately and the FINAL artifact rebuilt after the last edit (disclosed in `RELEASE_INTEGRITY.md`).

**Artifact** `dist/muse-auto-allow-v1.13.0.zip` — **210,496 bytes, 19 entries**, sha256 `aaaa3fd2ef899d28d1220637e0d1fc9674058d4b723171ca1a9c473f83b63ad2`; verify-zip 19/0/0/0; deterministic double-build byte-identical; smoke 20/20 `ok: true`; sidecar `sha256sum -c` clean. Store captures regenerated at this tree.

### Honest notes
CWS owner items and the Muse-ToS owner decision unchanged; package not uploaded to the CWS. This closes the owner's 3-round cycle series (v1.11.0 → v1.12.0 → v1.13.0) after v1.10.1.
