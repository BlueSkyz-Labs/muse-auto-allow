# UX audit backlog — chuỗi vòng customer-centric (bắt đầu 2026-10-19)

Nguồn Vòng 1: 4 audit độc lập (mimo-v2.6-pro) — 35 findings. Trạng thái: DONE = đã sửa vòng này;
OPEN = chờ vòng sau; REJECT = không làm (kèm lý do).

## Vòng 1 — đã sửa (v1.22.1)

| # | Finding | Xử lý |
|---|---|---|
| A1 | Onboarding thiếu trấn an (Deny/log/chạy-thử) | Thêm 3 bullet `onbRail*` ở bước 1 + sửa `onbStep1Body` bớt suy đoán |
| A2 | Nút chính 1 chữ "Bật" | `onbEnable` → "Bật tự động bấm" / "Turn on auto-click" |
| A7 | "Không tìm thấy tab muse" không actionable | `museTabsNone` → "Chưa thấy tab Muse mở — mở muse.ai…"; `noClicks` → "Chưa có lượt bấm nào" |
| B3 | Nhãn BLOCK/ASK/ALLOW tiếng Anh + ASK chìm | renderLayers dịch nhãn theo `ruleKind*`; `.lkind.ask` màu hổ phách |
| B4 | ↑/↓ gợi ý priority giữa tầng | Tooltip `ruleOrderHint` trên nút |
| B5 | Khối tạo luật khó hiểu | Hint `ruleMatchHint` dưới hàng nhập |
| B6 | "Chỉ nhắc trong khung giờ" vs "gửi" | `scheduleTitle` → "Chỉ gửi follow-up trong khung giờ" + hint `scheduleOnlyActiveHint` |
| B1 | Panel thiếu trạng thái + nút tạm dừng; anomaly ở đáy | Status strip `#safetyStatus` (Live/Dry-run/YOLO + nút Tạm dừng 15′) đầu panel; **anomaly chuyển lên trước khối schedule** |
| B2 | YOLO tự tắt dry-run im lặng | `yoloDryWarn` trong khối + banner đỏ `#yoloWarn` đầu panel khi bật |
| C1 | Card "Tuần này" chôn dưới đáy stats | Chuyển lên ngay sau hàng KPI |
| C4 | Caption/topics contrast thấp, "12 80%" dính | `.ccap` → `--ink-2`; `.topics .n` flex gap; `.pct` không italic |
| C6 | Nhãn chart "7 ngày" chồng nghĩa + ngày tiếng Anh | `last7` → "Xu hướng 7 ngày"; renderMini dùng `effLang()` |
| C2/C3/C4 | Ảnh chụp có số vô lý (tháng 0, tổng lệch) | Sửa seed capture (byMonth/byYear/byDay khớp clickCount; topic tên thật) |
| D1 | vi "Ngày mai" bị cắt "Ngày n…" | vi → "Mai"; `.pgroup` cho wrap, `.pbtn` bỏ clip |
| D2 | vi giữ "audit" | → "Xuất báo cáo JSON/CSV" |
| D3 | vi "chờ bạn" sai ngữ pháp khi ghép số | → "lượt hỏi" |
| D4 | vi "để bạn tự xử lý" | → "Hỏi là để bạn tự quyết" |
| D5 | vi lẫn "luật/quy tắc" | Chuẩn "luật" (logOpenRules, rulesIgnoredYolo) |
| D6 | zh lẫn 阻止/拦截 | Chuẩn "拦截" (rulesTitle, ruleKindBlock, auditWeekBlocked, rulesDescription) |
| D7 | zh rulesDescription máy móc | Viết lại tự nhiên |
| D8 | ko "직접 처리하라는 뜻" sai sắc thái | → "사용자에게 맡깁니다" |
| D9 | es "la tarjeta" nguy hiểm ngữ cảnh | → "la decisión" |
| D10 | es "por revisar" lệch hệ thuật ngữ | → "preguntas" |
| C5 | 4 nút Export lẫn lộn | Export/Import → "Sao lưu dữ liệu"/"Phục hồi dữ liệu" (en/zh/ja/ko/es tương ứng) |

## OPEN (vòng sau)

- **A3 một phần**: switch dry-run đổi màu hổ phách + `#drySub` — cần audit lại bằng ảnh mới (done code).
- **A4**: badge "Chạy thử" màu accent dễ nhầm nút; mũi tên `>` gộp hàng — cần tách hàng/đổi màu.
- **A6**: popup quá tải với người mới — ẩn "độ trễ", chart 7 ngày rỗng (đổi thành dòng empty), gấp "Tự động gửi tiếp" sau Nâng cao.
- **B7**: panel 12 khối → accordion nhóm nâng cao (Codex/Sync/License/JSON).
- **B8**: placeholder/chú thích dark theme contrast < 4.5:1.
- **C8**: KPI trùng "Tuần nay" 3 lần — gộp.
- **B1**: `#safetyChip` đổi màu cảnh báo khi YOLO (hiện mới banner + dot).
- **A6 phụ**: nhãn "300 ms" → "Chậm vừa (0,3 giây)".
- **D-phụ**: `ruleKindAllow` en "allow" vs `kindAllow` "Allow" — rà nhất quán chữ hoa toàn bộ.

## REJECT (có lý do)

- **A8/B8 một phần**: đổi toàn bộ chữ phụ sang #3C4043 làm mất phân cấp thị giác; chỉ nâng nơi < 4.5:1 thực đo (qa check A đã pass WCAG AA cho mọi text visible — giữ).
- **B7 full accordion ngay**: rủi ro che mất rail an toàn khi người dùng cần; chỉ gấp nhóm nâng cao ở vòng sau.

## Vòng 2 — đã sửa (v1.22.2)

| # | Finding | Xử lý |
|---|---|---|
| A-F1 | Dry-run nhập nhằng: badge "Chạy thử >" như nút bấm, switch hổ phách như "đang bật" | **#modeTag dưới công tắc chính: "MÔ PHỎNG — CHƯA BẤM THẬT" / "ĐANG BẤM THẬT"**; chip tách khỏi nút "An toàn" (hết mũi tên dính) |
| A-F5 | Bullet 3 dài, khoảng trống chết onboarding, "Bỏ qua" nhạt | Bullet rút gọn ("chạy thử", bỏ "ghi log"); `.obfoot` dồn đáy (margin-top:auto) |
| A-F6 | Dòng trạng thái cắt "…", hàng pause wrap lệch | `.stsurf` wrap 2 dòng; chip rời hàng pause → hàng nút đồng nhất 2 chế độ |
| A-F3 | "300 ms" khó hiểu | Giữ nguyên số (SI) nhưng thêm đơn vị i18n (`unitMs/unitSec/unitMin/unitPerMin`) — text "phút/giây" theo ngôn ngữ |
| A-F4 / C-F3 | Chart 7 ngày & 14 ngày rỗng trông như lỗi render | Empty state: `#miniEmpty` (popup) + `#chartEmpty` (stats) "Chưa có lịch sử — biểu đồ hiện sau lượt bấm đầu tiên" |
| B-F3 | Hàng thẻ topics bị cắt mép trên | **Không phải bug** — do ảnh chụp cuộn giữa panel; đã thêm ảnh `popup-safety-top` để audit thấy đầu panel |
| B-F4 | Câu mô tả anomaly bị cắt/lẫn "engine" | vi rút gọn tự nhiên ("Tự tạm dừng khi hành vi bấm…"); sửa 4 chuỗi "nhấp"→"bấm" |
| B-F6 | HỎI light theme nhạt | Đậm amber-700 + viền hổ phách (đã áp từ 1b) |
| B-F7 | Hint luật thiếu ví dụ/HAY | `ruleMatchHint` mở rộng: quy tắc VÀ giữa chủ đề+từ khoá, BẤT KỲ trong danh sách, ví dụ github.com + payment/billing |
| C-F1 | Thẻ "Tuần này" khi rỗng coi như chú thích | (đã lên trên KPI); khi rỗng vẫn là "Chưa có dữ liệu" — chấp nhận tạm, xem OPEN |
| C-F4 | Nhãn ngày "06-10" dễ nhầm | Giữ DD-MM + title đầy đủ khi hover (đã có); ghi nhận OPEN đổi DD/MM |
| C-F5 | Cụm nút dữ liệu thứ tự ngược | Sắp lại: [Sao lưu | Phục hồi] — [JSON | CSV] là OPEN (chưa đổi DOM) |
| H1 | **Stats không hiển thị trạng thái engine** | `#statsStatus` strip (Live/Paused/Dry-run/YOLO + dot màu) đồng bộ storage.onChanged |
| H2 | Xoá luật / Apply import 1 click không xác nhận | **2-step inline confirm** cho xoá luật ("Bấm lần nữa để xoá") và Apply import ("Thay N luật? Bấm lần nữa") |
| H3 | Target size < 24px; #safetyClose aria sai ("Safety") | `[data-act]`, `.rchip .rx` min 24×24; aria-label dùng `closeLabel` (6 ngôn ngữ) |
| H4 | 5 tên cho dry-run; dropdown thường vs chip HOA | Thống nhất: "Chạy thử/Dry-run" (bỏ "Mô phỏng/Simulation" khỏi drySwitchSub); ruleKind* Title Case; vi hết "nhấp" |
| H5 | Đơn vị "15 min/1 hour", ms/min không dịch | en pause60 "60 min"; đơn vị qua i18n 4 key |
| H6 | Chip "0" không nhãn; ruleOrderHint chỉ trong tooltip | Chip "0 tab" (+`tabWord`); `ruleOrderHint` hiển thị thành dòng chú thích dưới danh sách luật |
| H7 | Hứa "mỗi lần bấm đều ghi log" nhưng giữ 50 | onbRailLocalLog nêu rõ "(50 lượt gần nhất)" |

## Vòng 2 — OPEN (sang Vòng 3)

- **A-F2 (HIGH)**: khối TỰ ĐỘNG GỬI TIẾP chiếm 1/4 popup + "Gửi ngay" khoá gây lo gửi dữ liệu — cần tái bố cục popup (gập mặc định, đổi nhãn) — **thiết kế lại layout, làm cùng accordion**.
- **H8**: panel 12 khối → 4 nhóm collapsible ("Chế độ chạy / Luật / Tự động hoá & giám sát / Khác").
- **C-F1**: thẻ Tuần này khi rỗng nên hiện 4 ô 0 thay vì 1 dòng "Chưa có dữ liệu".
- **C-F5**: sắp cụm nút dữ liệu + icon/gạch phân cách.
- **A-F7**: label "An toàn" mờ + tiêu đề onboarding trùng nút (đổi "Bắt đầu với Chạy thử").
- **C-F4**: đổi định dạng trục ngày DD/MM.

## Vòng 3 — đã sửa (v1.22.3)

| # | Finding | Xử lý |
|---|---|---|
| BUG-1 (HIGH) | Dot trạng thái popup **đảo ngược** (live → vàng, dry/paused/yolo → thiếu cảnh báo) | `renderSafetyStatus` (popup) sửa logic: xanh = live, vàng = dry/paused/yolo; text dry không còn "Đang chạy · Chạy thử" tự mâu thuẫn (dùng banner "Chỉ ghi log") |
| BUG-2 (HIGH) | Audit JSON **luôn `rules: []`** (projectRules nhận Array, stats truyền object) | stats.js truyền `rules.layers` (array); verify bằng node: file audit có rules đúng |
| BUG-3 (HIGH) | Chip ✕ topic/keyword **xoá 1 phát** không xác nhận | Arm 5s (✕ → "?" đỏ, tooltip "Bấm lần nữa để xoá") rồi mới xoá |
| BUG-4 (HIGH) | Quick-add "billing, payment" lưu **1 entry sai** không bao giờ khớp | `addRule` tách dấu phẩy (giới hạn 50), giống form 3 tầng |
| BUG-5 (HIGH) | Export/Import JSON **chỉ layers** — mất allowTopics/blockKeywords khi migrate | Export schemaVersion 2 đủ 3 khối; Import nhận cả 3, preview đếm, Apply 2 bước ghi đủ |
| A11Y-1 (HIGH) | Checkbox bật/tắt luật **vô hình** (pattern opacity:0) + focus ring ẩn | CSS override `.lrow input[data-act="en"]` hiển thị |
| A11Y-2 (HIGH) | 3 nút icon <24px: `.ovclose`, `.froti .rm`, `.item .kopen` | min 24×24 |
| A11Y-3 (MED) | Pill controls 18.7–21.4px (.pbtn/.langbtn/.safetybtn/.qbtn/.rbtn) | min-height 24px |
| A11Y-4 (MED) | `#layerKind` không tên; input placeholder-only | aria-label dịch (ariaRuleKind/ariaTopics/ariaKeywords) |
| A11Y-5 (MED) | Pause/dry/yolo đổi trạng thái không có live region | `#ssText` + `#pstateText` role=status aria-live=polite |
| A11Y-6 (LOW) | Dot warn light 2.2–2.55:1 | #8a5a10 (≥3:1) |
| C-1 (MED) | Live không phân biệt bằng mắt trong 5s | `#stateLine` tô nền đỏ nhạt khi live / vàng khi dry (không thêm chiều cao) |
| C-2 (MED) | Đơn vị ô nhập tràn ở ja/ko/zh/vi/es (`.unit` cứng 18px) | `.unit` auto + min 18px; unitMs ja/ko/zh = "ms", zh /min = "/分" |
| i18n-1 | `modeSim` "CHƯA BẤM THẬT" gây hiểu nhầm; trùng "Chạy thử" | Chốt "CHẠY THỬ — KHÔNG BẤM GÌ" / "DRY RUN — NOTHING IS CLICKED"; es "SIMULACIÓN — NO SE HACE CLIC" |
| i18n-2 | `ruleConfirmDelete/Apply` quá dài tràn nút 320px | Rút: "Bấm lần nữa"/"Thay $1 luật? Bấm lại" (en/es/ja/ko/zh tương ứng) |
| i18n-3 | `tabWord` số ít ghép số nhiều ("2 pestaña") | `tabWordOne` cho n=1; en "tabs"/es "pestañas" cho n>1 |
| i18n-4 | Đơn vị lặp trong nhãn anomaly ("(lượt bấm/phút)" + "/phút") | Bỏ đơn vị khỏi `anomalyRateLabel`/`anomalyDurationLabel` (giữ ở suffix) |
| i18n-5 | vi còn "nhấp"/"click"/"Chạm", "từ khóa" lẫn "từ khoá" | Chuẩn hoá "bấm", "từ khoá" (anomalyPauseState, yoloNote/Confirm, followup*, logOpenRules, rulesIgnoredYolo) |
| i18n-6 | zh "点按" lẫn "点击"; ko "탭" lẫn "누르" | Chuẩn "点击"/"누르세요" |
| UX-NEW | Thiếu phím tắt dry-run | `Alt+Shift+D` (`toggle-dry-run`) + background handler + i18n `shortcutDryRun` |

**Tổng i18n sau Vòng 3: 313 khoá × 6 locale, parity xanh.**
