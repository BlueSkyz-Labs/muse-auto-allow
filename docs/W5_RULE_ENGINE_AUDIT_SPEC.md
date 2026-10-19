# W5 — Rule engine 3 tầng + audit export (đặc tả thực thi, 2026-10-19)

Chủ sở hữu duyệt F1+F2 → W5/v1.22.0 (`docs/APPROVED_WORK_2026-10-19.md`). Nguyên tắc: **chỉ thu hẹp —
không rule nào mở rộng quyền**; connector/auth/token screens trong `content.js` là bất biến, không tầng
rule nào gỡ được; legacy `allowTopics`/`blockKeywords` giữ nguyên hành vi từng byte.

## F1 — engine thuần `extension/rules.js` (global `MuseRules`, classic, module.exports guard)

```
MuseRules.defaults()      -> { layers: [] }
MuseRules.sanitize(raw)   -> { ok, layers }        // fail-closed, không throw
MuseRules.decide(win, layers) -> { action, reason, ruleId }
```

- Rule: `{ id: slug [a-z0-9-]{1,32}, kind: 'allow'|'ask'|'block', match: { topics?: string[], keywords?: string[] }, enabled?: boolean (default true), note?: string }`.
  Giới hạn: ≤ 50 rules; mỗi list ≤ 50; mỗi chuỗi ≤ 64; topic/kw chuẩn hoá lowercase; id trùng → bỏ mục sau;
  khóa prototype (`__proto__`/`constructor`) bị từ chối; rule sai kiểu bị bỏ; top-level không phải mảng → `ok:false`.
- `win = { topic: string(lowercase hoặc ''), text: string(lowercase: card text + ' ' + ctx), legacy: { blockKeywords, allowTopics } }`.
- **Thứ tự quyết định (decision table):**

| # | Điều kiện | action | reason |
|---|---|---|---|
| D1 | legacy blockKeywords khớp substring | `block` | `keyword:<kw>` |
| D2 | rule kind=block (enabled) khớp (topic exact ∨ keyword substring) | `block` | `rule:<id>` |
| D3 | rule kind=ask (enabled) khớp | `ask` | `rule:<id>` |
| D4 | legacy allowTopics non-empty ∧ topic không khớp | `block` | `topic` |
| D5 | có ≥1 rule kind=allow (enabled) ∧ không rule allow nào khớp | `ask` | `allow-miss` |
| D6 | còn lại (không tầng nào can thiệp) | `none` | `null` |

- `ask` = KHÔNG bấm, để người dùng tự xử lý; log kind MỚI `ask` (chip trung tính), **không** tăng bộ đếm
  clicks, CÓ tăng bộ đếm `asked` mới trong digest; khác `blocked`: blocked = vi phạm quy tắc an toàn,
  ask = "chưa chắc, mời bạn xử lý".
- YOLO: D1–D5 đều bị bypass bởi yoloMode (giống blockReasonFor hiện tại) — engine thuần nhận `yolo:boolean`
  trong `win`; khi `yolo:true` → `{action:'none'}`.

## F2 — builder thuần `extension/audit.js` (global `MuseAudit`)

```
MuseAudit.buildJson(input) -> { ok, json, filename }   // input = { version, generatedAt, rules, counters, byDay, log(đã giải mã) }
MuseAudit.buildCsv(entries) -> string                  // header: at,kind,label,context,blockedReason — escape nháy kép, dấu phẩy, xuống dòng; BOM UTF-8
MuseAudit.weeklySummary(counters, byDay, now) -> { clicks, blocked, asked, followups, week }
MuseAudit.containsForbidden(text) -> { ok, hit }       // quét 'license', 'cryptKeyRaw', '"token"', '"iv"', '"ct"'
```

- JSON allowlist trường entry: `at, kind, label, context, blockedReason, standing, dryRun` — KHÔNG có gì khác.
- Module KHÔNG nhận license/cryptKeyRaw (không có tham số) → về cấu trúc không thể lộ.
- `filename = 'muse-auto-allow-audit-YYYY-MM-DD.json'` (CSV tương tự).
- Tải xuống dùng Blob + `a.download` như `stats.js` đang làm (không xin quyền mới).

## Tích hợp (phiên chính)
- `content.js`: `blockReasonFor` → gọi `MuseRules.decide`; thêm `noteAsk` (kind `ask`, dedup như blocked);
  `bumpDigest({ asked: 1 })`; digest hiển thị asked; `KIND_KEY`/`kindClass` thêm `ask`; yolo bypass.
- `popup.js`/`popup.html`: bảng rule trong Safety (thêm/xoá/bật-tắt/đổi thứ tự) + Nhập/Xuất JSON (validate
  bằng `MuseRules.sanitize`, preview trước khi áp) + link gợi ý dry-run; i18n 31 khóa ×6.
- `stats.js`: nút "Xuất audit (JSON/CSV)" + khối tóm tắt tuần (`MuseAudit.weeklySummary`).
- `manifest.json`: muse content_scripts `["playbook.js","rules.js","anomaly.js","content.js"]`; popup.html +
  stats.html nạp thêm `rules.js`/`audit.js`; SHIPPED +2.
- Tests: `test/rule-engine-unit.mjs` (decision table D1–D6, sanitize, yolo, legacy compat, forbidden-scan)
  + e2e/qa: chip ask, chiều cao popup, tải tệp có tên ngày, assert tệp không chứa trường cấm.
