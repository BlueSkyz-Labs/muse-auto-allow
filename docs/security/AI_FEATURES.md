# AI feature register (AI-BOM)

Standard: `standards/security/AI_AGENTIC_SECURITY_BASELINE.md` 1.1 §8.1, §8.2, §20 (PD-2026-020). Test families: `standards/security/AI_SECURITY_TEST_CATALOG.md` 1.1.
Golden Path check: GP-78. Fill one row per runtime AI feature the product ships. Developer AI tooling (harness, coding agents) is not listed here; it follows DEC-051.

If the product has no runtime AI, replace the table with one line: `AI-S0: no runtime AI feature (checked <date>, <revision>)`.

| Field | Feature 1 |
|---|---|
| Feature and route | <e.g. camera meter check, POST /api/operator/ocr-check> |
| Profile (`AI-S0..S5`) | <AI-S1> |
| Models and providers, in order | <reader ids from the code catalog; free first> |
| Input data class | <cropped image of a meter; no identity document> |
| Leaves the country? Owner decision | <yes/no; decision link and date> |
| Vietnam AI Law 134/2025 risk level (self-classified) | <low/medium/high + one-line reason> |
| User told it is AI (where a person talks to it) | <n/a / where> |
| Kill switch (default off) | <portal switch and/or env name; a deployment-level hard off the portal cannot override> |
| Provider credentials | <where keys live: deployment secrets, or a portal vault per §10.1 (encryption secret name, slots, step-up, rotation rules)> |
| Caps (device/minute, tenant/day, global/day) | <20 / 300 / 5000> |
| Schema lock | <parser name> |
| Consensus rule | <2 of 3: device, model A, model B of another family> |
| Learning bounds (§8.2) | <counts only; re-rank inside price tier; portal order wins> |
| Tests covered | <TST-AI-VPI-*, TST-AI-CONS-*, TST-AI-OUT-*, TST-AI-DOS-*> |
| Review trigger | <provider added, new input type, model swap> |
| Owner / last reviewed | <name, date, revision> |
