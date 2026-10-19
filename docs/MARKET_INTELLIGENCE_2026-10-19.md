# Tình báo thị trường — đối thủ & tính năng · 2026-10-19

Phạm vi: công cụ auto-approve / auto-continue / run-mode cho AI agent (browser + CLI + IDE + framework),
lớp bảo mật agent, và tín hiệu governance 2026. Nguồn: GitHub (claude-warden, claude-approve,
claude-code-allowlist, agent-jackstop), tài liệu Cursor (run modes, permissions.json), tài liệu
Claude/Codex (permissions, hooks), Browser Use (human-in-the-loop), CWS/AMO listings (adamlui
auto-continue, Superpower ChatGPT), báo cáo ngành (Arthur, AvePoint, NHI, Dataiku, axis-intelligence,
dartbrowser, arxiv CUA benchmark). Đánh giá điểm là của dự án (không phải số công bố của đối thủ).

## 1. Bản đồ đối thủ (điểm chạm trực tiếp tới MAA)

| # | Đối thủ | Nhóm | Giá | Cơ chế cốt lõi | Điểm mạnh đáng học | Điểm yếu / khe hở |
|---|---|---|---|---|---|---|
| 1 | **claude-warden** | CLI hook | OSS free | Parse lệnh shell thành **AST** (tách `a && b`), đánh giá từng lệnh con theo rule; đa agent (Claude Code, Codex CLI, Copilot CLI) | **Phân tích có cấu trúc** + rule cấu hình; xử lý env-prefix; deny theo ngữ cảnh (`docker exec`…) | Không có UI/báo cáo cho người thường; không anomaly; không browser |
| 2 | **claude-approve** | CLI hook | OSS free | Rule **TOML** → auto-approve / deny / **escalate** | Ba tầng quyết định + escalate | Hook nội bộ dev; không dry-run log trực quan |
| 3 | **claude-code-allowlist** | CLI hook | OSS free | **Học từ phê duyệt thủ công**, lan sang subagent | Learn-from-approvals | Không kiểm soát browser |
| 4 | **claude-code-sidecar** | CLI hook | OSS free | block/allow/ask/**alter** + **risk-level scoring** | **Chấm mức rủi ro** từng hành động | CLI-only |
| 5 | **Cursor Run Modes + permissions.json** | IDE | $20/tháng | Allowlist / **Auto-review bằng classifier** / sandbox | Mô hình 3 chế độ + cấu hình dạng file | Khoá trong Cursor; classifier = "tiện nghi, không phải ranh giới" (agent-jackstop) |
| 6 | **agent-jackstop** | Class bảo mật | OSS configs | Hardening chống **agentjacking** (injection qua tool output) | Đóng gói cấu hình siết chặt | Chỉ là config, không runtime guard |
| 7 | **Browser Use — human-in-the-loop** | Framework | Cloud/HITL | Người **takeover** phiên đang chạy rồi trả lại | Takeover liền mạch | Dành cho dev framework, không phải tiện ích cho người dùng cuối |
| 8 | **adamlui/chatgpt-auto-continue** | Browser ext | **Free** (đa nền tảng: Chrome/FF/Edge/Android) | Auto-click "Continue generating" | Phủ đa trình duyệt | Không safety, không audit; **ép giá tầng "continue" về 0** |
| 9 | **ChatGPT Auto-Continue & Token Counter** | Browser ext | Có bản trả phí | Auto Full Mode + token counter | Bán được tiện ích đơn giản; 33 ratings | Bề mặt tính năng mỏng |
| 10 | **Superpower ChatGPT** | Browser ext | Freemium **$10–15/tháng** | Lớp productivity trên ChatGPT UI | Chứng minh **giá $10+/tháng tồn tại** cho tiện ích ChatGPT | Không phải tầng an toàn/approval |
| 11 | **Claude in Chrome (native)** | Native | Trong gói $20–200/tháng | Auto-approve từng bước trong hệ Claude | Phân phối khổng lồ | 1 hệ sinh thái; tự kiểm toán chính mình; không phủ muse.ai |

## 2. Ma trận chấm điểm (0–5) — tiêu chí benchmark

Tiêu chí: T1 auto-approve an toàn · T2 dry-run/preview · T3 chặn nguy hiểm theo ngữ cảnh · T4 phân
tích cấu trúc (rule/AST) · T5 anomaly/rate guard · T6 log & **xuất audit** · T7 tùy biến rule ·
T8 học từ phê duyệt · T9 đa nền tảng · T10 offline/riêng tư · T11 giá trị/giá.

| Hệ | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10 | T11 | **Tổng/55** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Muse Auto-Allow** | 5 | **5** | 4 | 2 | **5** | 3 | 3 | 1 | 3 | **5** | **5** | **41** |
| claude-warden | 5 | 2 | 5 | **5** | 1 | 2 | 4 | 2 | 4 | 5 | 4 | 39 |
| claude-approve | 5 | 3 | 4 | 4 | 1 | 2 | **5** | 2 | 3 | 4 | 4 | 37 |
| claude-code-sidecar | 5 | 3 | 4 | 4 | 1 | 3 | **5** | 2 | 3 | 4 | 4 | 38 |
| Cursor run modes | 4 | 4 | 4 | 4 | 1 | 3 | 4 | 1 | 1 | 2 | 3 | 31 |
| Browser Use HITL | 3 | 3 | 3 | 3 | 1 | 4 | 3 | 1 | 4 | 2 | 3 | 30 |
| adamlui auto-continue | 2 | 1 | 1 | 1 | 0 | 0 | 1 | 0 | **5** | 5 | 4 | 20 |
| Superpower ChatGPT | 2 | 2 | 2 | 1 | 0 | 2 | 3 | 0 | 3 | 3 | 3 | 21 |

**Đọc điểm:** MAA dẫn đầu ở **dry-run (5), anomaly (5 — duy nhất có), riêng tư offline (5), giá trị/giá (5)**
và đồng hạng auto-approve an toàn. **Yếu tốp so với đối thủ CLI/IDE:** phân tích cấu trúc (2/5),
xuất audit (3/5), tùy biến rule (3/5), học từ phê duyệt (1/5), đa nền tảng (3/5).

## 3. Trending hot 2026 (đã kiểm chứng bằng nguồn)

1. **Human-in-the-loop trở thành "control được thiết kế–enforce–monitor"**, không còn là checkbox;
   95,5% tổ chức đã hành động sau sự cố agent (AvePoint 2026); khung phạt tới 15M€/3% doanh thu (Dataiku).
2. **Prompt injection / agentjacking là mối đe dọa chính**: injection trực tiếp thành công **79%+**;
   **73%** triển khai doanh nghiệp có phơi nhiễm; browser agent bị hijack tới **31,5%** trước safeguards
   (Anthropic); nghiên cứu 1.400 đòn: **không phòng vệ đơn lẻ nào <18% ASR**, phải nhiều lớp (dartbrowser).
3. **Allowlist/rule engine mọc khắp CLI/IDE** (Cursor permissions.json, run modes; claude-* hooks) —
   chuẩn hoá công nghiệp: rule cấu hình + 3 tầng quyết định (allow/ask/deny) + escalate.
4. **Risk scoring & escalate** (claude-code-sidecar) — thay vì nhị phân duyệt/chặn.
5. **Audit/log là yêu cầu governance**: đội bảo mật đòi "hành động browser được log đầy đủ" + checkpoint
   cho tác vụ rủi ro cao (NHI); takeover phiên (Browser Use).
6. **Giá**: tầng "continue" bị OSS ép về 0; nhưng tiện ích ChatGPT productivity sống ở **$10–15/tháng**;
   one-time $19–69 vẫn là mô hình hợp lệ cho tiện ích nhỏ (CSS Scan, Night Eye).

## 4. Findings đưa vào dự án (xếp ưu tiên — cần chủ sở hữu duyệt)

| # | Finding (học từ đâu) | Đề xuất cho MAA | Ưu tiên | Chi phí/Rủi ro |
|---|---|---|---|---|
| F1 | Rule engine 3 tầng + cấu hình file (claude-approve, Cursor, warden) | Nâng **G01 (đã có trong catalog)**: bảng rule allow/ask/block trong Safety + nhập/xuất JSON; tái dùng screens sẵn có; preview bằng dry-run | **P0** | M; chỉ thu hẹp quyền, giữ bất biến rail |
| F2 | Audit là control (NHI/Arthur) | **Xuất audit**: JSON/CSV log + tóm tắt tuần (dùng digest sẵn có); nền cho gói đội | **P0** | S; không lộ dữ liệu (cục bộ) |
| F3 | Học từ phê duyệt (claude-code-allowlist) | Khi người dùng tự duyệt cùng một chủ đề 3 lần → **gợi ý 1-chạm** thêm vào allowTopics (người chốt, không tự động) | P1 | S; an toàn nhờ người chốt |
| F4 | Risk level + escalate (sidecar) | Nhãn **mức rủi ro** trong log (an toàn/xem lại/nguy hiểm) + hộp "cần xem lại" (chính là G03 review queue) | P1 | M |
| F5 | Prompt-injection defense (agent-jackstop; ASR 79%) | **Màn hình injection** (opt-in): phát hiện mẫu "ignore previous/approve all…" trong ngữ cảnh card/trang → không click + log `injection-suspect` | P1 | M; cần kiểm false-positive kỹ |
| F6 | Takeover (Browser Use) | Badge "**đang thao tác tay**" + pause sâu một chạm; nhắc trả lại điều khiển | P2 | S |
| F7 | Đa nền tảng | Thêm surface khi được phép (Claude web…); giữ quy tắc "không bypass ToS" | P2 | L; phụ thuộc nền tảng |
| F8 | Đồng bộ rule cho đội (sync subset sẵn có) | Bật **sync rule allow/block** (opt-in) cho nhiều máy/đội | P2 | S |

**Hệ quả nếu KHÔNG làm F1–F2:** khi Cursor/Claude chuẩn hoá allowlist + audit, điểm khác biệt còn lại chỉ
là anomaly guard; gói "đội/quản trị" (doanh thu năm 2–3) sẽ thiếu nền tảng để bán.

## 5. Đề xuất duyệt

- **Duyệt F1 + F2 vào W5 (v1.22.0)**: rule engine 3 tầng (nâng G01) + xuất audit. Cả hai tái dùng
  hạ tầng hiện có (screens, log, digest), không phá bất biến safety-free.
- **F3–F5 vào W6 dạng pilot** (sau khi có người dùng thật đo false-positive).
- **F6–F8** giữ P2.
- **Không thay đổi** mô hình giá đã đề xuất (lifetime $19 + gói đội năm 2); F2 chính là hạt giống gói đội.
