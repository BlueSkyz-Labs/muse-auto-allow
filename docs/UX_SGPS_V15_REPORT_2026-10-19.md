# SGPS v1.5 · PROMPT 02 — PREMIUM EXPERIENCE & CUSTOMER-CENTRIC UX/UI · DISCOVERY REPORT

**Mode:** DISCOVERY_FULL (proposal-first) · **Date:** 2026-10-19 · **Live SHA at report:** `d7a5fa3`
(tag `v1.22.3`) · **Artifact:** `dist/muse-auto-allow-v1.22.3.zip` (267,354 B, sha `74c54fa6…b3a0`).

## 1. Experience verdict

**VERDICT: GOOD → READY FOR WAVE-4 UPGRADES.** Ba vòng customer-centric vừa ship (63 findings:
onboarding trấn an, chế độ CHẠY THỬ rõ bằng màu + nhãn, status strip, 2-step destructive actions,
audit/rules round-trip đủ, a11y 24px + aria + live regions) đã đóng các lỗ hổng niềm tin lớn.
Battery 9 suite + qa 42/42 xanh trên cây v1.22.3. Khoảng trống còn lại **không phải lỗi** mà là
**cơ hội bước nhảy** ở 5-10 giây đầu, khả năng giải thích quyết định, và hiệu quả cho power user.

**Journeys đã quan sát (rendered, ảnh chụp thật từ build v1.22.3):** onboarding 3 bước; popup
dry-run + live; panel An toàn (đầu panel + khối luật); mission playbook config; stats (KPI, chart,
topics, thẻ Tuần này, cụm dữ liệu). **Chưa quan sát được:** trạng thái error/offline/retry (không
có màn riêng), screen-reader thực tế (chưa có AT test), mobile/hẹp <320px (extension popup cố định).

## 2. Top 10 God-tier (bước nhảy ở critical journey — cần Owner duyệt theo ID)

| ID | Đề xuất | Điểm /100 | Effort | Priority |
|---|---|---|---|---|
| **G1** | **First-run "xem trước một lượt bấm" (interactive demo trong onboarding)**: mô phỏng 1 approval card ngay trong popup, cho người mới thấy nó SẼ bấm gì trước khi bật live — first value tức thì, không cần cài Muse | 84 | M | Wave A |
| **G2** | **Audit Timeline** thay log 50 dòng: dòng thời gian theo ngày, filter kind/search (đã có), mở rộng entry xem context đã giải mã + luật khớp; export đúng phạm vi đang xem | 80 | M | Wave A |
| **G3** | **Rule Simulator**: dán câu mẫu → hiện "luật nào khớp, action gì" NGAY trong form thêm luật (validate trước khi lưu) | 84 | S-M | Wave A |
| **G4** | **Trust Dashboard** gộp một màn: trạng thái engine + rails đang bật + lần chặn cuối + coverage (tab nào đang được bảo vệ) | 82 | M | Wave A |
| **G5** | **Weekly audit digest tự động** (alarm có sẵn): tóm tắt tuần + tệp JSON đính kèm qua notification; nền cho gói đội | 67 | M | Wave B |
| **G6** | **Preset an toàn 1-chạm** (Strict / Standard / Fast) thay vì chỉnh 8 switch rời — người mới chọn 1 lần là đủ | 79 | S | Wave A |
| **G7** | **Playbook templates sẵn** (5-7 mẫu công việc phổ biến) để mission chạy được ngay không cần cấu hình | 65 | S | Wave B |
| **G8** | **Onboarding demo tương tác** (bước 2 mô phỏng click bằng mock card, không cần backend) | 73 | S-M | Wave B |
| **G9** | **Command palette** (Ctrl+K trong popup): nhảy nhanh tới mọi mục + chạy lệnh (pause/dry-run/export) | 63 | M | Wave C |
| **G10** | **Explainable block**: mỗi log entry bị chặn hiện *luật nào* (dịch id→mô tả) + *lý do* người đọc hiểu | 75 | S | Wave A |

## 3. Top 10 Tier S+ (cải tiến cụ thể — ship được trong wave nhỏ)

| ID | Đề xuất | Điểm /100 | Effort | Priority |
|---|---|---|---|---|
| **S1** | **Accordion 4 nhóm** panel An toàn (Chế độ chạy · Luật · Tự động hoá & giám sát · Khác), nhớ nhóm mở | 71 | M | Wave A |
| **S2** | **Gập khối TỰ ĐỘNG GỬI TIẾP** khi tắt + đổi nhãn "Gửi ngay" → "Gửi lời nhắc" + 1 dòng "chỉ trong tab Muse, không máy chủ" | 74 | S | Wave A |
| **S3** | **Import rules: diff preview** (thêm/thay/xoá từng luật) + cảnh báo YOLO đang bật | 65 | S | Wave B |
| **S4** | **"Lần chặn cuối"** (luật + topic + giờ) trên đầu log + id→mô tả trong từng dòng | 70 | S | Wave A |
| **S5** | **Stats polish**: bỏ KPI trùng "Tuần nay"; nhãn card sentence-case; tooltip ngày đầy đủ; baseline cho chart rỗng | 57 | S | Wave B |
| **S6** | **Cụm nút dữ liệu phân nhóm + icon** ([Sao lưu|Phục hồi] — [JSON|CSV]) + tooltip 1 dòng mỗi nút | 51 | S | Wave B |
| **S7** | **Preset độ trễ** (Chậm rãi / Bình thường / Nhanh) thay ô "300 ms" | 55 | S | Wave B |
| **S8** | **Onboarding dứt khoát**: nút "Bắt đầu với chạy thử", bỏ khoảng trống chết, "Bỏ qua" rõ hơn | 50 | S | Wave B |
| **S9** | **Focus order + skip link** trong panel dài (a11y nâng cao) | 58 | S | Wave C |
| **S10** | **Tuỳ chọn cỡ chữ** (11px mặc định → 12/13px) cho người lớn tuổi — lưu theo locale | 56 | S | Wave C |

## 4. Scoring method

`impact 30 + friction 20 + evidence 15 + fit 15 + value/effort 10 + safety/a11y 10`. Evidence
lấy từ: 3 vòng audit độc lập (4-5 child/vòng, model vision + heuristic + a11y), 12 ảnh render
thật của v1.22.3, code review line-level, và battery xanh. Không có đề xuất nào dựa trên
`E0/HYPOTHESIS` mà không ghi rõ.

## 5. Red-team & rejected ideas

- **"Banner đỏ toàn popup khi live"** — từ chối: chiếm chiều cao (>600px contract) và gây cảm giác
  báo động thường trực; thay bằng stateLine tô đỏ nhạt (đã ship ở v1.22.3) + dot đúng màu.
- **"Tự đổi độ trễ mặc định 2 giây trong tuần đầu"** — từ chối: đổi hành vi ngầm; đề xuất preset
  S7 để người dùng tự chọn.
- **"TOC đầy đủ trong panel 320px"** — từ chối: tốn chỗ; accordion S1 + anchor chips đủ.
- **"Mô phỏng gửi dữ liệu lên server để đồng bộ rule"** — từ chối: phá nguyên tắc offline/no-telemetry;
  sync hiện có (opt-in) là đủ.
- **Collision check:** G1/G8 trùng phần "obDemo" tĩnh hiện có → nâng cấp thay vì thêm mới; G10/S4
  dùng chung hạ tầng `layerDesc()`; G3 dùng chung `MuseRules.sanitize`.

## 6. Owner Approval Matrix (duyệt theo ID)

| Wave | Gồm | Ghi chú |
|---|---|---|
| **A — tin cậy & first value** | G1, G2, G3, G4, G6, G10, S1, S2, S4 | Đề xuất duyệt cả wave (9 mục, 2-3 phiên) |
| **B — hiệu quả & gói đội** | G5, G7, G8, S3, S5, S6, S7, S8 | Sau Wave A |
| **C — nâng cao** | G9, S9, S10 | Khi có nhu cầu thực tế |

## 7. Continuation

`CAN_CONTINUE_NOW = YES` — nhưng chỉ với **approved fixes hiện có** (không code proposal mới khi
chưa duyệt ID). Next executable: chờ Owner duyệt matrix → thực thi Wave A theo từng ID (test +
rendered verification + evidence). **True Owner gate:** duyệt G/S ID + mọi thứ thuộc Paid/CWS.
