## v1.12.0 — cycle 3 (AUDIT → PLAN → DO → CHECK)

Candidates came from a bounded subagent audit; **every claim was re-verified against the cited code before any change** (`scratch/cycle3-candidates.md`): 3 confirmed defects fixed, 1 confirmed-but-by-design recorded as a feature, 1 rejected with reason.

| # | Fix | What was wrong | Now |
|---|---|---|---|
| **C3-1** | Restore + authority | `sanitizeBackup` silently dropped `yoloMode` / `codexEnabled`; restored blocked rows lost `blockedReason` | Both booleans round-trip (typed, junk dropped); **an import that would turn an authority ON from off asks first** ("This backup turns on: YOLO — continue?") — a crafted file can never enable authority silently; turning off/junk stays prompt-free; `blockedReason` round-trips (≤96) |
| **C3-2** | State-line precedence | Off ∧ paused read "Paused until …" with a hidden Resume while the pause row showed one — two readouts disagreeing | Precedence: **dry > off > paused > YOLO > live** — off is the effective truth |
| **C3-3** | Blocked deep link | The chevron always opened the keyword editor, even for `topic` / `connector` blocks it cannot resolve | Reason-aware: `keyword:*` → keyword list, `topic` → allowed-topics list; **`connector` / reason-less → no chevron** (dead-end link worse than none) |
| **C3-4** | Standing mark | The G11 `standing` flag was write-only — "what permanent access was granted?" unanswerable | A quiet aria-labelled lock on standing rows (zero height, inside the log area) |

**i18n**: 202 keys × 6 locales (`logOpenTopics`, `logStanding`, `importAuthorityWarn` — `$1` verified in all six).

### Verification (frozen tree)

lint 0 (27) · background-unit 32/32 · import-security **150/0** (new G12) · yolo-ux-unit 5/5 · e2e 0 · followup 0 · mission 0 · lang-switch **24/24 @ 202 keys × 6** (height baselines held) · codex 0 (4 phases) · experience assert **28/0**. In-Chrome QA exercised off+paused, both deep-link targets and the import authority confirm (accept path) before the battery — and caught a real defect (empty `$1` in the warn dialog: stats page helper is `tp()`, not `t()`), fixed before any gate. **Red-team**: bounded subagent review of the diff — 4/4 PASS (single gated `storage.local.set`; chevron UI-only + esc()'d; `standing === true`-typed; `$1` in all locales); its final summary line was lost to a harness artifact (empty `output_schema`) and the findings were recovered from the transcript + re-verified in-session — disclosed in `RELEASE_INTEGRITY.md`.

**Artifact** `dist/muse-auto-allow-v1.12.0.zip` — **208,315 bytes, 19 entries**, sha256 `d46006bfbbb4e288d9ac0a1ade27b50b6c3116119ad350fa12d70432733c10bb`; verify-zip 19/0/0/0; deterministic double-build byte-identical; smoke 20/20 `ok: true`; sidecar `sha256sum -c` clean. Store captures 1/2/3/5 regenerated at this tree.

### Honest notes
CWS owner items and the Muse-ToS owner decision unchanged; package not uploaded to the CWS.
