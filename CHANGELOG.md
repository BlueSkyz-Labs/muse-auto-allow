# Changelog

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
