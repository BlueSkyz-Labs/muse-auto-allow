# Changelog

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
