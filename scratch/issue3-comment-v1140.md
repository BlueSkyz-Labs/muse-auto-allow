## v1.14.0 released — cycle 5 + independent adversarial-audit hardening

**Release:** https://github.com/BlueSkyz-Labs/muse-auto-allow/releases/tag/v1.14.0 · merge `9449390` (PR #10, CI green: runs 39140355222 + 39141020435).

**Artifact:** `muse-auto-allow-v1.14.0.zip` — 212,606 B, 19 entries, sha256 `836a999172e206107f0b0b41564ff6b67238dede6a7ee35ff3d2aa527fd2b5a3` (+ sidecar). Rebuild from tag `v1.14.0` reproduced the identical hash (byte-for-byte); verify-zip 19/0/0/0, smoke `ok:true`, determinism 2× identical.

**What changed**
- Stats page follows the popup language switcher (TS-04 closed); hostile locale values rejected; live switch updates an open page.
- Backups from newer versions are refused honestly ("update first"); a present-but-garbage `schemaVersion` is refused as not-a-backup; legacy (absent) files still import.
- Every autonomy flip asks on import (live clicking, auto follow-up, auto mission, clearing an active pause).
- **Independent audit F1–F4 fixed with regression checks**: postfix standing grants (`Allow always`) never clicked without YOLO (standing flag logged with YOLO); parked/near-invisible buttons never clicked (below-the-fold stays clickable); reworded consent surfaces ("Authorize app", "Bearer key") hit the connector hard-block; crafted-backup authority flips confirm.
- C5-1 `approvalPresent` parity; C5-5 follow-up detection throttle while disabled; i18n 204 keys × 6.

**Evidence on the frozen tree:** battery all exit 0 — lint 27 · background-unit 35/35 · import-security **162/0** (G14/G15/G16) · yolo-ux 5 · e2e (six new FORBIDDEN negatives) · followup-e2e · mission-e2e · lang-switch (204×6) · codex-e2e (4 phases) · bench assert · QA v1.14.0 8/8. Full ledger: `docs/RELEASE_INTEGRITY.md` (v1.14.0 section).

**SGPS:** adoption records landed — `docs/SGPS_ADOPTION.md` + `.json` (pin v1.13.0 + explicit overlays; state `IMPLEMENTING`; no self-declared ADOPTED), `docs/GOLIVE_PAID_READINESS.md` (DEC-016 15-dimension matrix; Paid GO stays Owner-only), `docs/LESSONS.md` (LSN-001..007 with executable guards), `docs/SGPS_EXPERIENCE_CHECKLIST.md`; SGPS:Experience pass v2 **11/11** (contrast both themes, reduced-motion, focus, vi layout, state-as-text).
