# Changelog

## 1.7.0
- **Follow-up phrase library + combo builder**: the Auto follow-up prompt is now built from 8 groups of agent directives (continue / verify / quality / workflow / scope / report / security / design-UX) — tap chips to combine multiple phrases, live preview of exactly what will be sent, the 3 legacy presets kept as one-tap quick combos, custom text appended, per-group "save combo to rotation". 78 keys x 6 locales; rationale + recommended combos (long-run / strict verify / post-compaction / security review / design pass) in `docs/PROMPT_LIBRARY.md`.
- **Round-robin prompt rotation**: save multiple combos into a rotation and the follow-up alternates through them in order (a starter rotation ships as one tap). The index advances only when a send is verified — a blocked or failed send never skips a prompt. Status ping reports the next-up position.
- **Premium popup pass**: readable disabled states (computed contrast), collapsed settings with inline hint when off, informative status pill (hidden when unknown), single status indicator, log typography with 2-line clamp + separators, unified input axis, day-labelled mini-chart with today emphasis, popup capped at 600 px with internal scrolling.
- **Premium Statistics pass**: single-hue trend chart with today accent, palette-aligned KPI chips, dynamic range caption, y-max gridline; all store assets re-rendered from the frozen UI (marquee truncation defect fixed; vision 9-10/10 light+dark).
- **Overflow fix**: with many phrases selected the sheet clips internally (popup stays <=600 px), remove controls always visible, preview never cut off.
- **Safety rails extended**: approval-card wording variants (trailing decoration, leading badge, multi-option pairs) handled; standing grants ("Always allow" / "Allow for this site/task") deliberately NOT auto-clicked — no silent scope escalation.
- **Release engineering**: deterministic zip + SHA256 sidecar (double-build byte-identical), artifact smoke test (extracts the shipped zip and proves it passes core e2e in scratch Chrome — 20/20), CI workflow (lint + Windows e2e), SECURITY.md / CONTRIBUTING.md, CWS submission pack, first-push runbook; `docs/RELEASE_INTEGRITY.md`.
- **Security round**: full attack-chain audit at frozen 2b12a7f (9 chains, executed probes; SA-1..SA-3 LOW, OB-1/2 INFO; money sections NOT_APPLICABLE with design gate) — `docs/SECURITY_AUDIT_DRAFT.md`; launch-risk research (Muse ToS 7.6 oversight clause — MEDIUM; CWS fit LOW conditional with live precedents) — `docs/MUSE_TOS_RESEARCH.md`.

## 1.6.0
- **Auto follow-up**: detects Muse idle state ('Connected') vs busy ('is working') and — opt-in, default off — sends a user-chosen follow-up prompt into the chat composer so Muse keeps working long-run. Guards: continuous-idle wait (default 60 s), per-tab cooldown (default 10 min), hard cap 6/hour, never sends while an approval card/bar is present or a draft sits in the composer, and a send counts only after the composer verifiably clears. Preset + custom prompts; popup shows live Working/Connected/Sent status; `Send now` for manual sends. Tested by a dedicated CDP harness (34 assertions, mutation-proven on the approval guard and the idle-wait guard).
- **Premium Statistics + store assets**: curated 5-hue chart palette (every pair WCAG-checked and recorded in `docs/BRANDING.md`), refined KPI cards with icon chips, colored topic bars, complete dark parity; all store images regenerated at exact specs with neutral demo data.
- i18n: now 47 keys × 6 locales (12 new follow-up keys).
- Chrome best practices: explicit `extension_pages` CSP + `minimum_chrome_version` 116; versioned idempotent SW migration runner; `unhandledrejection` console surface; zero-dependency lint gate (`scripts/lint.mjs` — syntax/JSON/i18n parity/no-remote-code/manifest hygiene) wired into the publish runbook; practices checklist in `docs/CHROME_BEST_PRACTICES.md`.
- New detection path E: the chat-level "A task needs review" bar — its Review button is clicked (own kind `review-bar`, 1 s throttle) so the approval panel renders and the Allow/Deny pair is approved on the next sweep.
- Redteam v4 hardening (V4-1..V4-8 disposition in `docs/REDTEAM_V4.md`).

## 1.5.0
- Upgrade-safe data inheritance: a `schemaVersion` stamp is written with every flush; all prior shapes (log, counters, aggregates) stay readable — nothing is dropped on upgrade. Legacy plaintext log entries keep rendering.
- Encrypted at rest: the approval text in the click log is stored AES-GCM-256 encrypted (per-install key in `chrome.storage.local`; documented limitation — protects casual profile inspection, not a full local attacker). The popup decrypts for display; undecryptable entries degrade gracefully.
- Backup / restore: the Statistics page gains "Export data" / "Import data" — one JSON file with settings, log (incl. the key so backups stay readable), statistics and counters; import sanitizes every field (typed whitelist, size caps) and a supplied key must decrypt the first encrypted entry before anything is replaced (redteam v4 / V4-1).
- Log timestamps now display the viewer's LOCAL system clock (stored values remain UTC ISO; hover shows the full local date-time).
- Store showcase kit completed to Chrome Web Store standards: 4 screenshots (1280×800), promo 440×280, new marquee 1400×560, `store/SHOWCASE.md` index; all demo data strictly fictional.
- New detection path E: the chat-level "A task needs review" bar — its Review button is clicked (1 s throttle, own kind `review-bar`) so the approval panel renders and the Allow/Deny pair is approved by paths A/B on the next sweep.
- Redteam v4 hardening: import sanitizer (V4-1), null-safe log rendering (V4-3), key-cache invalidation on rotation (V4-4), first-install key race (V4-5), e2e encryption round-trip coverage (V4-6), epoch-safe timestamps (V4-8).

## 1.4.0
- UI/UX overhaul in Muse's design language (tokens captured from the live site, 2026-10-09): light-first surfaces (`#fcfcfc` page, white cards, `#111112` ink, `#005abf` accent, pill controls, weight-500 tight-tracked headings) with a full dark theme via `prefers-color-scheme` (`#18191a` / `#242526` / `#0a5ce0`); popup + Statistics page rebuilt on shared tokens.
- Brand Kit v2 (`docs/BRANDING.md`): original check-on-tile mark with the brand gradient `#0082FB → #0064E0 → #0040DC` (Muse-compatible palette, deliberately not Muse's trademarked squiggle); refined 16/32/48/128/512 icons; new promo tile + designed overview; every store asset regenerated.
- Store showcase assets now use strictly fictional demo data (Example Org, demo-project, sample-app, web-starter, notes-app, files.example.com) — no real projects anywhere in public assets.
- Screenshots: screenshot1 = real runtime capture (live popup + live clicks, light stage), screenshot2-stats + screenshot3-popup = real renders (light; dark captured separately for QA), screenshot4-overview + promo440x280 = designed; `render.mjs` no longer overwrites screenshot1; `stats-shot.mjs` reports page fit (h:800/w:1280) and captures the dark QA pair.
- Contrast/a11y: secondary text ≥6:1 light / ≥5:1 dark; dark chip/badge text is light blue on dark pills; status dot aria-hidden (state carried by the toggle); singular/plural chip copy ("1 muse.ai tab open" vs "N muse.ai tabs open") across 6 locales (31 keys each).
- e2e re-run after the redesign: exit 0 (clicks, statsCheck, statsPage, locksProbe all green).

## 1.3.0
- Usage statistics (user-facing): clicks by day / week / month / year, plus by topic — the topic is the GitHub repo (or host) extracted from each approval's context. Aggregates are compact local counters (`stats.byDay` / `byMonth` / `byYear` / `byTopic`; 400 days / 24 months / 100 topics retained).
- New Statistics page (`stats.html`): dependency-free inline-SVG bar charts with a Day / Week / Month / Year switcher, KPI cards (total / today / this week / this month) and a top-topics list. Renders instantly; no libraries.
- Popup: today's count, a 7-day mini chart, and a Statistics button. Toolbar badge shows today's click count (cleared at zero).
- muse.ai-only interaction made visible and enforced: hard hostname guard in the content script (defense-in-depth on top of the manifest matches), live "N muse.ai tab(s) open / No muse.ai tab found" status chip in the popup, and the service worker sweeps a muse.ai tab the moment it finishes loading (`tabs.onUpdated`) on top of the per-minute alarm.
- Click recording consolidated into ONE serialized storage write (log + counter + aggregates) — keeps the redteam F9 no-lost-write guarantee.
- e2e: new fixture case 17 (GitHub-context card); the suite now reads storage back through the popup page and asserts `byDay[today] ≥ 10`, `byTopic['test-repo'] ≥ 1`, clickCount and log length.
- i18n: 17 new strings × 6 locales (26 keys per locale).
- Independent redteam v3 (`docs/REDTEAM_V3.md`): 1 HIGH (packaging — stats.* missing from the zip; fixed with a build-coverage guard + `scripts/verify-zip.py` byte-compare) + 6 LOW — cross-tab storage serialization via Web Locks, corrupt-shape coercion, non-numeric sink hardening, topic/sweep regex fixes, e2e i18n + stats-page render assertions (mutation-proven).

## 1.2.0
- i18n: English, Tiếng Việt, 简体中文, 日本語, 한국어, Español (popup UI + manifest name/description; store listing localized).
- New icon + popup design with Muse-inspired motion (draw-in check, status pulse, count pop, log slide-in) — fully disabled under `prefers-reduced-motion: reduce`.
- Store packaging: `scripts/build.mjs` zip builder; store kit (listing / privacy / publish runbook); store screenshot + promo tile sources.
- Independent store-compliance checklist added (`store/COMPLIANCE_CHECKLIST.md`).
- Security hardening (full redteam pass, see `docs/REDTEAM_REPORT.md`): surface buttons only clicked on review/open intent; 5s text-fingerprint dedup on allow clicks (re-render race guard); candidates inside `<a>` never clicked; consent-only pairs (notifications/newsletter/subscribe/cookies/marketing) skipped; expand/open-panel rate-capped at 30/min; `minDelayMs=0` persistence fixed; liveness guard stops clicking once the extension context is invalidated.
- Queue pacing: blocked sweeps now reschedule at the configured delay — a pending queue is processed at `minDelayMs` pace (~3 clicks/s default) instead of crawling at the 1s heartbeat.
- Popup shows the full 50-entry click log (scrollable); reduced-motion users now see the header check icon (it was animation-only and never appeared with `prefers-reduced-motion`); click-log context no longer includes button labels (`contextText`). Store screenshot replaced with a real runtime capture (`scripts/store-shot.mjs`).
- e2e hardened + mutation-proven: anti-throttle Chrome flags, two-phase assertions (dedup asserted inside its 5s window; surface intent filter asserted after the 10s surface throttle), and a documented mutation run where disabling each new guard turns the suite RED.
- Independent redteam v2 (16 findings; see `docs/REDTEAM_REPORT.md`): cross-path dedup fingerprint fixed (one shared button-anchored scope), adjacent-pair rule (deny must be clickable in the same container), allow-click global rate cap 30/min, consent-filter hardening, real visibility checks (visibility/opacity/pointer-events), destructive-verb rejection on surfaces (all surfaces scanned), form-associated buttons skipped, serialized log writes, e2e late-assertion fixes, 7 new falsified fixture cases, `minimum_chrome_version` added.

## 1.1.0
- Four detection paths: marked cards (`data-testid=hatch-inline-approval-card`), Allow+Deny pair heuristic, collapsed pending expand, background-surface open.
- Safety rails: never Deny, exact-text matching, per-node once, per-text cooldowns.
- English UI; e2e runtime harness on real Chrome (CDP `Extensions.loadUnpacked`).

## 1.0.0
- Initial: pair heuristic, popup toggle + click log, per-minute alarm nudge.
