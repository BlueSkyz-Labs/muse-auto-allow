### v1.21.0 đã chốt gói, phát hành, xác minh — W3 + W4 của catalog đã duyệt

**Phát hành** (PR #17 → squash `4362c4b`, tag `v1.21.0`):

- **G02 Mission Playbooks** — mô-đun thuần `extension/playbook.js` (thay thế bằng callback nghĩa
  đen, đếm điểm mã, đóng an toàn); playbook thứ 5 `scoped-run` với `{{project}}`/`{{branch}}` +
  metadata `vars`/`guards`; động cơ render bước bằng giá trị đã kiểm, lưu `mission.values` nguyên
  tử, xoá nhiệm vụ khi giá trị sai (đóng an toàn), chốt an toàn theo playbook chỉ **thu hẹp**
  (từ chối trước khi gõ → `mission-guard`), không bao giờ thay bằng câu xoay vòng
  (`mission-unavailable`); tuỳ biến `missionPlaybooks`; popup có khối cấu hình + **xem trước**.
- **W4 lõi giấy phép dormant** — `license.js` (ES256 ngoại tuyến, 0 log token) + `license-pubkey.js`
  (khóa `null` tới nghi thức của chủ sở hữu); khối License trong bảng An toàn; sao lưu chỉ mang
  token đúng dạng (trần 2048), trường giả bị bỏ, không xoá giấy phép khi bản sao lưu thiếu; hai
  cổng lint (dormant + chặn vật liệu khoá kể cả **mã hoá base64**) đã kiểm chứng bằng đột biến.

**Bằng chứng (cây sẽ chốt)**: lint 54/23 · anomaly-unit 11 · **mission-playbook-unit 10 mới** ·
**license-unit 16 mới (+L4b)** · import-security **169/0** · background-unit +L1 · e2e `ok:true` ·
followup-e2e 113/0 · **mission-e2e 37/0 (+G02-A..E)** · lang-switch **255×6** · codex · bench ·
QA v1.14.0 8/8 · **qa-experience 37/37 (+N1/N2)**.
**Chốt gói**: `dist/muse-auto-allow-v1.21.0.zip` — **245.614 byte / 23 mục**;
sha256 `2afe1f0616a3bbe430109627505b23189b57756814bc003e4c68e683a440a7b5`; build đôi trùng byte;
verify-zip 23/0/0/0; smoke `ok:true`.

**Audit độc lập (người-làm≠người-chấm)** — 3 subagent đọc mã trả 6 phát hiện, tất cả đã sửa trước
chốt: W4-1 allowlist `tier` (+test L4b) · W4-2 chip về Free trước await · W4-3 mốc chống lùi cập
nhật đơn điệu (ngưỡng ghi 60 giây) · W4-4 lint bắt cả JWK base64 (đột biến hai chiều) · W4-5 trần
token đồng bộ 2048 (+biên 2049) · G02-1 connector-lite trong popup. Chẩn đoán `e2e` treo: không
chứng minh được liên hệ với G02/W4 (lượt chạy sạch `ok:true`); đã phòng ngừa null-guard + bắt stack.

**Trung thực**: hai đơn vị đỏ của lượt chạy đầu đã sửa tận gốc (lát cắt engine thiếu hàm G02;
khối C mission-e2e tự mở đường gửi tự động + đo mốc khi xác minh còn bay — LSN-012; các bài học
audit ở LSN-013). **Cổng chờ chủ sở hữu**: tải lên Chrome Web Store · giá/kênh (mô hình C đã
chọn, giá chưa) · nghi thức khoá (lệnh tạo cặp khóa dev đã sẵn trong hồ sơ W4) · nâng pin SGPS.
