# Changelog

## 1.2.0
- i18n: English, Tiếng Việt, 简体中文, 日本語, 한국어, Español (popup UI + manifest name/description; store listing localized).
- New icon + popup design with Muse-inspired motion (draw-in check, status pulse, count pop, log slide-in) — fully disabled under `prefers-reduced-motion: reduce`.
- Store packaging: `scripts/build.mjs` zip builder; store kit (listing / privacy / publish runbook); store screenshot + promo tile sources.
- Independent store-compliance checklist added (`store/COMPLIANCE_CHECKLIST.md`).

## 1.1.0
- Four detection paths: marked cards (`data-testid=hatch-inline-approval-card`), Allow+Deny pair heuristic, collapsed pending expand, background-surface open.
- Safety rails: never Deny, exact-text matching, per-node once, per-text cooldowns.
- English UI; e2e runtime harness on real Chrome (CDP `Extensions.loadUnpacked`).

## 1.0.0
- Initial: pair heuristic, popup toggle + click log, per-minute alarm nudge.
