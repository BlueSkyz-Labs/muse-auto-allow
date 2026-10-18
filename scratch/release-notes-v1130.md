## v1.13.0 — cycle 4 (final round)

Eight audit-confirmed fixes, every claim re-verified against the code; a bounded red-team review of the hardening claims found 2 caveats, 1 FAIL and 2 nuances — **all addressed before this freeze**.

**Sync no longer loses to install defaults (C4-A)** — on a fresh device `onInstalled` now chains pull → migrate: synced values fill absent keys first, so a synced kill-switch (`enabled:false`) or live choice (`dryRun:false`) can't be shadowed by defaults, nor pushed back over the bucket. `background-unit` 32 → **35 checks**.

**Boot honors the kill-switch before the first sweep (C4-B)** — the gate (`enabledReady`) lives inside `sweep()`, covering observer/interval/timer paths too. **Connector depth aligned (C4-C)** — path A climbs 2 levels like path B.

**Honest restore (C4-D)** — history is really replaced: `log`/`stats`/`clickCount` absent from a backup are removed (set-first, remove-second — quota-safe); restriction keys keep fail-closed merge; the confirm copy says exactly that (×6 locales); a ctx-bearing file without a key gets the kept-key notice. `import-security` 150 → **154 checks**.

**Follow-up / missions stop stalling (C4-E, C4-F)** — `approvalPresent()` now uses the structural actionable-pair predicate (path A's ground truth minus pacing — over-count-only, fail-safe), so a resolved card no longer blocks sends forever and a pending card can't be missed; a composer that disappears after a **real** submit counts as delivered, and a both-failed submit is recorded explicitly (`submit-failed`).

**Stats page (C4-G, C4-H)** — chart accessible name (`aria-labelledby="ccap"`, WCAG 1.1.1); the topics caption follows the Total KPI with bars clamped ≤100%.

**i18n:** 203 keys × 6 locales (+`followupSendBlockedSubmit` — flagged by the F2 reason-coverage assert; parity green). **Rejected with reason:** review-bar wording broadening; cooldown/digest order (known-minor).

### Verification (frozen tree)

lint 0 (27) · background-unit **35/35** · import-security **154/0** · yolo-ux-unit 5/5 · e2e 0 · followup 0 · mission 0 · lang-switch **24/24 @ 203 keys × 6** · codex 0 (4 phases) · assert **28/0** · CI on this commit: lint ✅ · e2e ✅.

### Artifact

`muse-auto-allow-v1.13.0.zip` — **210,496 bytes, 19 entries**, sha256 `aaaa3fd2ef899d28d1220637e0d1fc9674058d4b723171ca1a9c473f83b63ad2`; verify-zip 19/0/0/0; deterministic double-build byte-identical; smoke 20/20 `ok: true`; sidecar attached. Store captures regenerated. Full record: `docs/RELEASE_INTEGRITY.md` (v1.13.0 evidence) — including the disclosed mid-window hardening edits and the red-team verdicts.

### Honest notes

CWS owner items and the Muse-ToS owner decision unchanged; not uploaded to the Chrome Web Store.
