# v1.21.0 — W3 + W4 của catalog đã duyệt: G02 Mission Playbooks + W4 lõi giấy phép (dormant)

Hai gói việc tiếp theo trong `docs/APPROVED_WORK_2026-10-19.md`. Đặc tả do subagent độc lập viết
(`docs/G02_MISSION_PLAYBOOKS_SPEC.md`, `docs/W4_LICENSE_IMPL_PLAN.md`), phần ráp nối do phiên
chính thực hiện, bằng chứng dưới đây.

## G02 — Mission Playbooks (biến + chốt an toàn theo từng playbook)
- **Mô-đun thuần mới `extension/playbook.js`** (không DOM/chrome/đồng hồ): `declare` /
  `parseTokens` / `validateValue` / `mergeValues` / `render` — thay thế bằng callback theo nghĩa
  đen (giá trị chứa `$&` hay dấu ngoặc không thể chèn), đếm theo điểm mã Unicode, và **đóng an
  toàn**: token lạ, ngoặc sót, giá trị rỗng/quá dài/ký tự điều khiển/bidi/surrogate đều bị từ chối.
- **Playbook thứ 5 `scoped-run`** trong `MISSION_CORPUS`: 3 bước có `{{project}}` / `{{branch}}`,
  metadata `vars` (giá trị mặc định) + `guards`; 4 playbook cũ giữ nguyên từng byte.
- **Động cơ (`content.js`)**: render bước hiện tại bằng giá trị đã kiểm; giá trị lưu trong
  `mission.values` (một lượt ghi nguyên tử khi Bắt đầu); nạp lại là **đóng an toàn** (giá trị sai
  → xoá nhiệm vụ); màn hình từ khoá + kết nối/credential áp lên từng giá trị ở cả lúc nạp và lúc
  gửi; **chốt an toàn playbook** (`extraBlockedKeywords` + `pauseWhenUnavailable`) chỉ **thu hẹp** —
  từ chối TRƯỚC khi gõ và không đẩy bước; nhiệm vụ đang chạy mà không render được thì **không bao
  giờ thay bằng câu xoay vòng** (lý do `mission-unavailable`).
- **Tuỳ biến cục bộ** `missionPlaybooks` (sửa mặc định/chốt theo id đã phát hành) — sanitize chặt,
  id lạ bị bỏ, chốt chỉ thêm chứ không gỡ.
- **Giao diện popup**: chọn playbook có biến sẽ mở khối cấu hình (`#misConfig`) với ô nhập từng
  biến, **xem trước bước kế tiếp** (`#misPreview`, aria-live) và Bắt đầu/Huỷ; nút Bắt đầu chỉ bật
  khi mọi giá trị hợp lệ; bước đang chạy hiển thị bản đã render (lấy từ động cơ).

## W4 — Lõi giấy phép ngoại tuyến (dormant)
- **`extension/license.js`** (thuần, WebCrypto ES256, xác minh ngoại tuyến, 0 log chứa token) +
  **`extension/license-pubkey.js`** giữ khóa công khai ở trạng thái `null` cho tới nghi thức khoá
  của chủ sở hữu — đúng thiết kế: chưa cấu hình khóa thì mọi thứ là "miễn phí", không bao giờ ném lỗi.
- **Popup**: khối License trong bảng An toàn (ô dán token, Kích hoạt/Huỷ, dòng trạng thái aria-live;
  giá trị nhập luôn bị xoá sau khi thử, không bao giờ hiện lại/log).
- **Sao lưu/phục hồi**: token chỉ đi qua dạng chuỗi bị chặn kích thước + đúng dạng `MAA1.<…>.<…>`,
  các trường giả (`tier`, `lastSeenAt`) bị bỏ; bản sao lưu **không có** license thì **không xoá**
  giấy phép đang lưu.
- **Cổng lint mới** (đã kiểm chứng bằng đột biến trực tiếp): `LICENSE-PUBKEY-DORMANT` (khóa phải
  `null` cho tới nghi thức) và `LICENSE-TEST-KEY-NOT-IN-RELEASE` (không được có JWK EC trong mã
  phát hành) — nhét khóa giả vào `extension/` thì lint đỏ ngay (exit 1), gỡ ra thì xanh.

## Bằng chứng (trên cây sẽ chốt gói)
- `mission-playbook-unit` **10/10** (P1–P10, có ghi chú đột biến), `anomaly-unit` 11/11,
  `license-unit` **15/15**, `import-security` **168/0** (thêm 6 kiểm tra W4 + 6 vòng license),
  `background-unit` (thêm L1: script license chỉ thuộc popup, quyền giữ nguyên), `e2e`,
  `followup-e2e 113/0`, **`mission-e2e 37/0`** (thêm G02-A..E), `lang-switch` **255 khóa × 6**,
  `codex-e2e`, `bench`, QA v1.14.0 8/8, `qa-experience` 35/35.
- Chốt gói: `dist/muse-auto-allow-v1.21.0.zip` — số byte/sha256 ghi ở `docs/RELEASE_INTEGRITY.md`
  (mục v1.21.0) sau khi build ×2 trùng byte, verify-zip 22/0/0/0, smoke `ok:true`.

## Ghi chú trung thực
- Pin 2 chỗ đỏ trong lượt chạy đầu và đã sửa tận gốc: (1) bộ đọc engine của `import-security` cắt
  mã theo danh sách thủ công — thiếu các hàm G02 nên `sanitizeMission` gọi `missionMetaFor` không
  tồn tại; đã bổ sung các lát cắt + số playbook 4→5; (2) `mission-e2e` có hai dạng đua thời điểm:
  khối C tự tay bật chế độ "rảnh" (mở đường cho lượt gửi tự động) và đo mốc khi lượt xác minh của
  chặng trước còn đang bay — nay giữ trạng thái "đang làm việc", chờ `followup.sending` lắng và đo
  mốc sau khi ổn định. Bài học ghi vào `docs/LESSONS.md` (LSN-012).
- Playbook có biến KHÔNG kiểm tra tên biến trùng với chữ trong chính văn bản bước (ví dụ giá trị
  chứa chính từ khoá toàn cục sẽ bị màn hình toàn cục chặn trước — đó là chủ ý).

## Audit độc lập (MAKER≠JUDGE) — đã sửa toàn bộ phát hiện
Ba subagent audit độc lập (G02, W4, chẩn đoán `e2e`) trả về 6 phát hiện; tất cả đã sửa kèm bằng chứng:
- **W4-1 (MEDIUM)** — chữ ký hợp lệ nhưng `tier` ngoài allowlist vẫn được cấp PRO → thêm
  `TIER_ALLOWED` vào `license.js` + bài kiểm mới **L4b** (tier lạ, chữ ký thật → từ chối).
- **W4-2 (MEDIUM)** — chip có thể kẹt "PRO" khi xác minh đang chờ/lỗi → `renderLicense` đặt chip về
  **Free TRƯỚC mọi await**, chỉ nâng PRO sau khi xác minh xong.
- **W4-3 (MEDIUM)** — mốc chống lùi đồng hồ không cập nhật đơn điệu khi dùng → ghi `lastSeenAt` khi
  xác minh thành công, **chỉ ghi khi lệch > 60 giây** (chặn vòng lặp storage.onChanged).
- **W4-4 (MEDIUM)** — cổng lint chỉ bắt JWK literal → mở rộng quét **cả JWK mã hoá base64** (giải mã
  mọi chuỗi base64 dài, tìm vật liệu khoá); đã kiểm chứng bằng đột biến đôi chiều (chèn → đỏ, gỡ → xanh).
- **W4-5 (LOW)** — trần token khi phục hồi 4096 lệch `license.js` (2048) → đồng bộ 2048 + bài kiểm
  biên 2049 trong `import-security`.
- **G02-1 (LOW)** — xem trước trong popup từng nhận giá trị kiểu kết nối mà động cơ sẽ từ chối →
  thêm connector-lite (khớp `CONNECTOR_WORD_RE`/`TOKEN_WORDING_RE`) để preview/Start từ chối ngay.
- **Chẩn đoán `e2e`**: không chứng minh được liên hệ nhân quả với G02/W4 (listener YOLO gắn trước mã
  mới; trạng thái phát hành không đi vào nhánh await) — đã phòng ngừa bằng null-guard cho listener
  mới + bắt stack chẩn đoán; lượt chạy sạch xanh toàn bộ `ok:true`.

## Hướng bác bỏ (falsification)
- Gỡ màn hình giá trị trong `sanitizeMission` → G02-D đỏ; bỏ kiểm chốt trong `followupAttempt` →
  G02-C đỏ (reason khác `mission-guard`); đổi thứ tự `MISSION_STEPS` khác corpus → F-V19-1 đỏ;
  đặt khóa thật vào `license-pubkey.js` → lint đỏ (đã chứng minh trực tiếp).
