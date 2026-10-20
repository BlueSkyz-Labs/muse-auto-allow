## v1.22.4 — Wave A (SGPS v1.5 · prompt 02) · freeze 2026-10-19

**Owner:** "duyệt theo khuyến nghị" → Wave A (G1, G2, G3, G4, G6, G10, S1, S2, S4).

| ID | Đã ship |
|---|---|
| G3 | **Rule Simulator** — nhập thẻ mẫu, xem engine thật sẽ làm gì (chặn / để bạn quyết / bấm), luật nào khớp, đường đi D1→D6. Gọi chính `MuseRules.decide()` nên không thể lệch hành vi. |
| G2 | **Audit timeline** — dòng log mở rộng bằng click/Enter/Space (`aria-expanded`), nhóm theo ngày, mới nhất trước. |
| G4 | **Trust dashboard** — rails bất biến (không Deny · connector thủ công · standing thủ công / sự thật YOLO) + lần chặn cuối, một cái nhìn. |
| G1 | **First-run demo** — thẻ mock trong onboarding; bấm Allow chứng minh luôn: không có gì xảy ra vì thẻ chứa từ khoá bị chặn. |
| G6 | **Preset độ trễ** Chậm/Normal/Nhanh (600/300/120 ms) thay ô ms thô. |
| G10 | **Explainable block** — `rule:<id>` được dịch ngược thành kind + topics/keywords. |
| S1 | **Nhóm an toàn thu gọn** — 4 nhóm `<details>` (Chế độ chạy · Luật · Tự động hoá & giám sát · Thiết bị & bản quyền), mặc định mở, nhớ theo thiết bị. |
| S2 | **Khối follow-up gập** đến khi bật; dòng riêng tư "chỉ trong tab Muse — không máy chủ" nằm trên dòng trạng thái (0 height) → popup giữ hợp đồng **595px ≤ 600**. |
| S4 | **Lần chặn cuối** trên đầu log. |

**Artifact:** `dist/muse-auto-allow-v1.22.4.zip` — **278,510 bytes, 27 entries**, sha256
`1e44f7ce84e992196db9214112af1c1654a77bc998912bcae999b8335c889668`; verify-zip **27/0/0/0**;
smoke `ok: true`.

**Gates:** **12/12 suite xanh** — lint 66/27 · yolo-ux 5 · rule-engine 20/20 · **rulesim 19/19** ·
**timeline 22/22** · background 36/36 · import-security 169/0 · e2e · followup (595px) · mission ·
lang-switch 340×6 · codex · **qa-experience 42/42**.

**Not done:** CWS upload (Owner gate).
