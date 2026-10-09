# Chrome Extension Development — Best Practices Applied (2026-10-09)

Current-practice checklist for a Chrome MV3 extension, with where each item lives in
this repo. Status legend: **APPLIED** (verified in the repo), **N/A** (justified),
**PLANNED** (open item).

## Manifest & platform

| Practice | Status | Where |
|---|---|---|
| Manifest V3 only; no remote code, no `eval`/`new Function` | APPLIED | `extension/manifest.json`; enforced by `scripts/lint.mjs` (SEC scan) |
| Explicit `content_security_policy.extension_pages` (don't rely on implicit default) | APPLIED | `manifest.json` — `script-src 'self'; object-src 'self'` |
| Minimal permissions — only what the feature uses (`storage`, `alarms`) | APPLIED | `manifest.json`; lint gate fails on any extra permission |
| Host access pinned to the single site (`muse.ai` + `*.muse.ai`), nothing else | APPLIED | `manifest.json`; lint gate asserts the exact host set |
| `minimum_chrome_version` set to a modern, tested baseline | APPLIED | `116` (all APIs used — `chrome.storage` promises, Web Locks, `:focus-visible` — are far older) |
| `default_locale` + `__MSG_` indirection (no hardcoded brand strings in the manifest) | APPLIED | `manifest.json` + `_locales/`; lint gate asserts `__MSG_extName__` |
| `run_at: document_idle` for content scripts | APPLIED | `manifest.json` |
| `all_frames: true` only where the UI can render in frames | APPLIED | `manifest.json` (Muse approval surfaces render in nested frames) |
| No `unlimitedStorage` (default quota is plenty for a capped 50-entry log) | APPLIED | design: log cap 50, aggregates pruned (see `extension/content.js`) |

## Service worker (MV3 lifecycle)

| Practice | Status | Where |
|---|---|---|
| All event listeners registered at the TOP LEVEL (worker may be killed and re-awakened) | APPLIED | `extension/background.js` |
| No reliance on in-memory SW state; durable state in `chrome.storage` | APPLIED | `background.js` + `content.js` |
| `chrome.alarms` (never `setTimeout`) for periodic work | APPLIED | `background.js` — 1-minute `muse-sweep` alarm |
| `runtime.onInstalled` seeds defaults and runs versioned migrations | APPLIED | `background.js` — `migrate()`, `SCHEMA_VERSION` |
| Migrations are idempotent + never destructive (upgrade-safe inheritance) | APPLIED | `background.js` — steps run only when `schemaVersion` is older; values are preserved, never rewritten in place |
| Worker errors surface for debugging instead of dying silently | APPLIED | `background.js` — `unhandledrejection` → `console.warn` (local only) |

## Content scripts

| Practice | Status | Where |
|---|---|---|
| Single injected script per frame; no remote imports | APPLIED | `extension/content.js` |
| MutationObserver + debounce instead of tight polling | APPLIED | `content.js` (observer + 1 s heartbeat with per-path throttles) |
| Idempotent injection (double-inject guard) | APPLIED | `content.js` (`data-muse-auto-allow` document marker) |
| Fail-closed automation: unknown state ⇒ do nothing (never approximate) | APPLIED | all detection paths require a positive signal; follow-up idle detection treats unknown as NOT idle |
| User-visible consequences minimized: never clicks destructive controls, rate caps + cooldowns | APPLIED | `content.js` guards (see `docs/REDTEAM_REPORT.md`, `docs/REDTEAM_V3.md`, `docs/REDTEAM_V4.md`) |
| Local-only processing; no network primitives anywhere | APPLIED | lint gate SEC scan |

## Data & privacy

| Practice | Status | Where |
|---|---|---|
| Local-only storage; nothing transmitted; no analytics | APPLIED | `store/PRIVACY.md` + lint SEC scan |
| Cap stored data growth (bounded log + pruned aggregates) | APPLIED | `content.js` — log cap 50; `byDay` 400 / `byMonth` 24 / `byTopic` 100 |
| Sensitive-at-rest handling with a documented, honest limitation | APPLIED | AES-GCM log context; limitation documented in `CHANGELOG.md` + `content.js` comment (protects casual profile inspection, not a full local attacker) |
| User-controlled export/backup; import validates + sanitizes | APPLIED | `extension/stats.js` (`sanitizeBackup`/`testBackupKey`) |
| Upgrade-safe data inheritance (no data dropped on version upgrades) | APPLIED | `schemaVersion` stamp + defensive reads + migration runner |

## Accessibility & UX

| Practice | Status | Where |
|---|---|---|
| Keyboard + AT support on custom controls (hidden native input + styled track) | APPLIED | `extension/popup.html` — pill switch, `aria-pressed`, `:focus-visible`, `aria-live` log |
| WCAG AA contrast, computed (not quoted) | APPLIED | `docs/BRANDING.md` contrast table; e2e/vision gates |
| Reduced-motion honored | APPLIED | `prefers-reduced-motion` blocks in popup/stats |

## Tooling & release

| Practice | Status | Where |
|---|---|---|
| Zero-dependency quality gate (syntax + JSON + i18n parity + security + manifest) | APPLIED | `scripts/lint.mjs` — `node scripts/lint.mjs` |
| Real-browser e2e on a scratch profile (never the user's) with mutation proofs | APPLIED | `test/e2e.mjs`, `test/followup-e2e.mjs` (see `docs/REDTEAM_*`) |
| Byte-verified packaging (zip mirrors the whole tree; set-equality both directions) | APPLIED | `scripts/build.mjs` + `scripts/verify-zip.py` |
| Store assets at exact spec sizes; fictional demo data only | APPLIED | `store/SHOWCASE.md` |
| Independent adversarial review before release (maker ≠ judge) | APPLIED | `docs/REDTEAM_REPORT.md`, `docs/REDTEAM_V3.md`, `docs/REDTEAM_V4.md`, `docs/EXPERIENCE_REVIEW_V14.md` |

## Deliberately NOT applied (with reasons)

| Practice | Why not |
|---|---|
| TypeScript / build step | Zero-build plain JS keeps the package auditable byte-for-byte; the lint + e2e gates carry the safety |
| Bundler (webpack/vite/rollup) | No module graph to resolve; a bundle would obscure the shipped bytes for review |
| `chrome.storage.session` for hot state | The content script's per-tab memory is already ephemeral; session storage adds no durability |
| Declarative content scripts (`scripting.registerContentScripts`) | The static match set is fixed (one site); dynamic registration adds moving parts without benefit |
| Remote error reporting | Privacy policy: nothing leaves the device. Debuggability is served by `unhandledrejection` console logging |
