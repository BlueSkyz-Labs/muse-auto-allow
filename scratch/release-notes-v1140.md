# Release notes — v1.14.0 (cycle 5 + independent adversarial audit hardening)

**Headline:** the stats dashboard now follows your language everywhere, backups from newer
versions are refused honestly, and four live-reproduced safety-rail gaps from an independent
adversarial audit are closed with regression coverage.

## What changed

1. **Stats follows the popup language switcher (TS-04 closed).** Pick a language in the popup
   (including Tiếng Việt) and `stats.html` renders in it — same approved `readAsset` +
   same-package-URL pattern as the popup; switching back to "Auto" restores the browser locale,
   and a live switch updates an open stats page immediately.
2. **Newer-schema backups are refused honestly.** A backup from a newer extension version gets a
   clear "update the extension first" notice instead of silently dropping its newer keys; a
   present-but-garbage schema value is refused as not-a-backup; older (no-version) backups still
   import.
3. **Every autonomy switch asks on import.** The authority confirm now covers live clicking
   (dry-run off), auto follow-up, auto mission, and clearing an active pause — a crafted backup
   can no longer flip them behind the generic dialog.
4. **Safety-rail hardening (independent audit, live-reproduced):**
   - `Allow always` (postfix) is a **standing grant** — never clicked without the explicit YOLO
     opt-in, and logged as standing when YOLO is on (previously it was clicked as a one-shot with
     no standing flag).
   - Parked / near-invisible buttons (fixed off-canvas, opacity ≈ 0) are never clicked;
     below-the-fold content stays clickable.
   - Reworded consent surfaces ("Authorize app", "Bearer key", …) hit the hard connector block —
     keyword sets now mirror the proven codex.js parity lists.
5. **Follow-up state detection throttled while disabled** (~3 s cadence instead of 1 s) —
   measurable CPU savings on long chats; cadence unchanged when follow-up is on.
6. **approvalPresent parity** with the click path (unsafe-target buttons no longer block sends).

## Proof

- Suites on the frozen tree (exit codes captured, no pipes): lint **27 checks** · background-unit
  **35** · import-security **162 (G14/G15/G16)** · yolo-ux-unit **5** · e2e · followup-e2e ·
  mission-e2e · lang-switch-e2e (**204 keys × 6**) · codex-e2e (4 phases) · bench experience
  assert · QA v1.14.0 **8/8** (stats locale follow, live switch, traversal rejection, schema
  guard end-to-end).
- Artifact: deterministic build (2× byte-identical), verify-zip, smoke — numbers in
  `docs/RELEASE_INTEGRITY.md`.
- i18n: **204 keys × 6 locales** (+`importNewer`).
