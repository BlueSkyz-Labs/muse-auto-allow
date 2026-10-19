# Approved work board — 2026-10-19 (Owner decisions locked)

Owner answers (2026-10-19, clarify form): **(1) catalog = APPROVE_NOW set only** — G02, G04, G07,
S02, S03, S04, S07, S08, S10; **(2) money model = C (Freemium PRO, offline license keys)**
price/channel still Owner-pending; **(3) SGPS pin = unchanged** (skipped → keep v1.13.0 +
overlays; no central registration); **(4) CWS public launch = after Wave 1**; **(5) support email =
`support@blueskyzlabs.com`** (filled in `store/LISTING.md`).

Everything below is `EXECUTE_APPROVED` (no re-approval needed for routine reversible work).
PILOT/VALIDATE/DEFER items stay untouchable until a separate Owner decision.

## Waves

| Wave | IDs | Objective | Release |
|---|---|---|---|
| **W1** | S02, S03, S04, S07, S08, S10 | Make existing surfaces exceptional: log readability, micro-interactions, typography/diacritics, onboarding help, keyboard excellence, i18n evidence sweep | v1.19.0 |
| **W2** | G04, G07 | Safety + oversight features: anomaly auto-pause; daily briefing card | v1.20.0 |
| **W3** | G02 | Mission Playbooks (extend Missions: variables + per-playbook guards) | v1.21.0 |
| **W4** | license core per `docs/LICENSING_DESIGN.md` | Offline ES256 verification module + activation UI — ships **dormant** (no public key → inert); real key ceremony + PRO split + price stay Owner gates | v1.22.0 |
| **W5** | F1 + F2 (market-intelligence findings, Owner-approved 2026-10-19) | **F1** rule engine 3 tầng (allow/ask/block) — nâng G01: bảng rule trong Safety + nhập/xuất JSON + preview qua dry-run · **F2** xuất audit (JSON/CSV log đã giải mã + tóm tắt tuần) | **SHIPPED v1.22.0** (freeze 2026-10-19) |

After W1: publish checklist for CWS (owner upload). After W4: PAID_READINESS re-audit of the 15
dimensions with the model-C evidence.

## Market-intelligence findings — quyết định của chủ sở hữu (2026-10-19)

Nguồn: `docs/MARKET_INTELLIGENCE_2026-10-19.md` (11 đối thủ, ma trận điểm, trending).
- **F1 (P0) + F2 (P0): ĐÃ DUYỆT → W5/v1.22.0** (rule engine 3 tầng nâng G01 + xuất audit).
- F3 (học từ phê duyệt), F4 (risk level + review hộp), F5 (injection screen): chờ vào **W6 dạng pilot**
  sau khi có người dùng thật (đo false-positive) — chưa duyệt thực hiện.
- F6 (takeover), F7 (đa nền tảng), F8 (sync rule cho đội): P2 — chưa duyệt.

## Status log

- **W1 ✅ v1.19.0** (2026-10-19) — S02/S03/S04/S07/S08/S10 shipped; QA 34/34; artifact
  `216,228 B / 19 entries / 4221e521…cc13f`; PR #15.
- **W2 ✅ v1.20.0** (2026-10-19) — G04 anomaly auto-pause + G07 daily briefing shipped;
  anomaly-unit 11/11 (mutation-falsified), followup-e2e 113/0 (G04-1..6 + G07), QA 35/35;
  artifact `225,747 B / 20 entries / c0454021…41ef9`.
- **W3 ✅ v1.21.0** (2026-10-19) — G02 Mission Playbooks (playbook.js 10/10, mission-e2e 37/0,
  255 khóa × 6).
- **W4 ✅ v1.21.0** (2026-10-19) — lõi giấy phép dormant (license-unit 15/15; cổng lint đã
  kiểm chứng bằng đột biến; khóa thật vẫn chờ nghi thức của chủ sở hữu).

## Task board (W1 detail)

- [x] S02 log: day groups + kind chips + search shipped; QA L1-L4 machine-checked (ISO-timestamp bug caught pre-freeze)
- [x] S03 micro-interactions: chip/control press feedback added; item fade-in + count pop existed; reduced-motion verified
- [x] S04 typography: Noto Sans + CJK fallbacks added; tabular numerals audited (already broad)
- [x] S07 onboarding: "Learn more" rails link on the consent step; obDemo existed (v1.11.0)
- [x] S08 keyboard: audited — commands (Alt+Shift+P/F) + unit tests exist; QA traversal/focus-trap passes; no new code
- [x] S10 i18n sweep: instrument D now sweeps all 6 locales on both surfaces (no overflow / no clipped control)
- [x] tests: QA v1.19 grows to 34 checks (L1-L4, locale sweep); battery + freeze + release v1.19.0
- [x] W5 F1+F2 shipped **v1.22.0** (freeze 2026-10-19): zip 259,545 B / 25 entries / sha256 `4da5f060…c932c7`; verify-zip 25/0/0/0; smoke `ok:true`; rule-engine-unit 20/20; battery đầy đủ xanh; qa-experience 42/42; hồi quy null-chain bắt + sửa trước freeze (LSN-014)
