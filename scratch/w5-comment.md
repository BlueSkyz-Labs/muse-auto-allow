## v1.22.0 — W5 shipped (F1 layered rules + F2 audit export) · freeze 2026-10-19

**Owner-approved scope** (market intelligence 2026-10-19, F1+F2 → W5):

- **F1 — three-layer rules (allow / ask / block)** — `extension/rules.js` (`MuseRules`: `defaults`/`sanitize`/`decide`), decision table D1–D6: block outranks everything; `ask` never clicks (new log kind `ask`, neutral chip, its own `asked` digest counter); `allow` only narrows (legacy `allowTopics`/`blockKeywords` keep byte-identical behaviour; connector/auth screens untouchable by any rule); YOLO bypasses layers as before. Safety sheet gains the rule table (add/remove/enable/reorder) + JSON import/export with validate-and-preview before apply.
- **F2 — audit export** — `extension/audit.js` (`MuseAudit`: `buildJson`/`buildCsv`/`weeklySummary`/`containsForbidden`). Stats page: “Export audit JSON/CSV” (decoded log, strict field allowlist — never license, crypto key, `iv`/`ct`) + “This week” card (clicks / blocked / asks / follow-ups). CSV: BOM + correct escaping.

**Artifact (frozen):** `dist/muse-auto-allow-v1.22.0.zip` — **259,545 bytes**, **25 entries**, sha256
`4da5f060578655473301fd983417474aab41db1efe48365bfb68960ff2c932c7` (sidecar `.sha256`).
`verify-zip.py`: **25 matched, 0 mismatched, 0 disk-only, 0 zip-only** (exit 0).
`smoke-zip.mjs`: exit 0, `"ok": true` (extracted artifact passes the core e2e in scratch Chrome).

**Gates (self-cleaning runs):** lint 0 (60 checks / 25 files) · anomaly-unit 11/0 · mission-playbook-unit 10/0 · license-unit 16/0 · background-unit 36/0 · import-security 169/0 · yolo-ux-unit PASS · **rule-engine-unit 20/20** · e2e `ok:true` · followup-e2e 0 · mission-e2e 37/0 · lang-switch 0 (288×6) · codex-e2e 0 · **qa-experience 42/42** (+P1–P4).

**Regression caught in-battery, fixed pre-freeze (LSN-014):** `applyV18UI` read `rules.layers` while `rules === null` (fresh install) — a TypeError that silently killed every render after it (dry-run banner, digest, onboarding, log). Fixed with a safe chain and confirmed by running the same harness against the archived v1.21.0 build (onboard hidden true → false). Round-1 also fixed: yolo-ux slice guard, lang-switch quoting regex, stats footrow wrap at 200% zoom, CHANGELOG gate M3.

**Not done:** no Chrome Web Store upload; no CWS review; no store publish (Owner gate).
