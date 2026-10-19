### v1.20.0 frozen, released, verified — W2 of the Owner-approved catalog

**Shipped** (PR #16 → squash `837c641`, tag `v1.20.0`):

- **G04 anomaly auto-pause** — pure detector module `extension/anomaly.js` (RATE 150/5 min,
  TOPIC 40 + 70% share/10 min, 100-click floor, fail-closed sanitize, no DOM/chrome/clock).
  It rides the existing sweep, writes `pauseUntil` + `anomalyLastPause` in ONE `storage.set`,
  logs kind/reason `anomaly-pause`, drives the existing badge/notification path, and maps the
  follow-up refusal to the new reason (manual pause stays `paused`). It can only ADD a pause —
  never touch a cap. Safety sheet gains the Anomaly guard (enable / rate / duration).
- **G07 daily briefing** — digest gains top block reason + 7-day trend (text-first, ↑/↓/same).

**Evidence**: `anomaly-unit` 11/11 **new, mutation-falsified** · `followup-e2e` **113/0** with
G04-1..6 + G07 · battery all green (lint 29/20, background-unit, import-security, yolo-ux, e2e,
mission, lang-switch 231×6, codex, bench, QA v1.14.0 8/8, qa-experience **35/35**).
**Freeze**: `225,747 B / 20 entries`, sha256
`c0454021e0ed88627b26de88757c741e6ea031247db2b088ba5a3ced97241ef9`; determinism 2×;
verify-zip 20/0/0/0; smoke `ok:true`;

**Honesty notes**: two e2e assertions needed test-side fixes after the first red run (product path
was correct: marker showed `rate` fired at exactly 5/5 with a 15-min pause): LSN-010 (log is
encrypted at rest — assert shape not plaintext) and LSN-011 (tune e2e thresholds to fixed module
constants + real pacing). Two unrelated runs aborted on transient `Runtime.evaluate` stalls —
rerun policy applied, rerun fully green. `anomaly.js` required an explicit SHIPPED-allowlist entry
in the build — the guard worked as designed.

**Next**: W3 = G02 (mission playbooks); W4 = dormant license core (plan at
`docs/W4_LICENSE_IMPL_PLAN.md`). CWS publish gate remains open (Wave 1 done) — awaiting the
Owner's upload action.
