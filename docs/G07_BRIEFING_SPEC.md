# G07 — Daily briefing card (Spec)

**Trạng thái:** APPROVE_NOW (W2, v1.20.0). **Nguyên tắc:** một card compact, không network, text-first, không báo chỉ bằng màu.

## 1. Mô hình nội dung

Card = khối `#digest` hiện có (popup.html:681-688) + 2 dòng mới. Giữ nguyên rule ẩn/hiện: chỉ hiện khi `clicks + followups + blocked > 0` — "không tin tức = không card".

Nội dung 3 phần:
1. **Dòng tiêu đề** (đã có): `digestTitle` + `dSince` (`digestSince` / `digestSinceStart`).
2. **Dòng đếm** (đã có): `dClicks` / `dFollowups` / `dBlocked`.
3. **Dòng lý do chặn hàng đầu** (mới, `.dreason`): nhãn `digestTopReason` + giá trị `reason (n)` — `blockedReason` xuất hiện nhiều nhất trong các entry `kind === 'blocked'` của log (lọc `at >= lastDigestAt` khi `lastDigestAt > 0`; log giới hạn 50 entry nên đây là "gần đây nhất" — ghi rõ trong `title`). Khi `blocked === 0`: `digestTopReasonNone`.
4. **Dòng xu hướng 7 ngày** (mới, `.dtrend`): nhãn tái sử dụng `last7` + tổng `stats.byDay` 7 ngày lịch gần nhất (gồm hôm nay) + so sánh 7 ngày trước: `digestTrendMore` ("↑ $1 vs the previous 7 days"), `digestTrendLess` ("↓ $1 vs the previous 7 days"), `digestTrendSame` ("same as the previous 7 days"). Mũi tên ↑↓ chỉ là glyph — ý nghĩa do từ mang (không colour-only).

## 2. Vị trí render & DOM

**Không thêm row mới.** Card mở rộng bên trong `#digest` hiện có, nằm trong `#logTop` (sticky `top:0` trong vùng scroll của `#log`) — chi phí chiều cao layout = 0 (popup.html:364-373, 395-401).

Insertion: trong `#digest`, sau `.drow`, trước `</div>`:
```html
<div class="dreason"><span data-i18n="digestTopReason">Top block reason</span><b id="dTopReason">—</b></div>
<div class="dtrend"><span data-i18n="last7">Last 7 days</span><b id="dTrend">0</b><span id="dTrendDelta"></span></div>
```
CSS mới (trong `<style>` của popup.html, tái dùng token Quiet Luxury): `.digest .dreason, .digest .dtrend { display:flex; align-items:baseline; gap:6px; font-size:11px; line-height:1.3; }` — `flex-wrap:wrap` (không `nowrap` như `.drow`) để wrap an toàn trong 292px; `b` dùng `tabular-nums`.

**Ngân sách chiều cao (320×600):** body `max-height:600px`, padding 8/14/6; `#log` là `flex:0 1 auto; min-height:0` — hút mọi trạng thái đông. Card tổng ≤ ~4 dòng chữ (~66px) nằm trong vùng scroll của log → không bao giờ đẩy popup quá 600px. Ràng cứng: toàn bộ `#logTop` ≤ ~90px để log giữ ≥ ~250px danh sách nhìn thấy; probe overflow của qa-experience (scrollWidth/Height) là cửa kiểm cuối.

## 3. Nguồn dữ liệu

**Không thêm counter mới.** Mọi dữ liệu đã có và đã được load trong `chrome.storage.local.get` của popup (popup.js:754-759):

| Dữ liệu | Key | Ghi bởi |
|---|---|---|
| clicks / followups / blocked | `digestCounters` | content.js `flushClicks` (754-762) + codex.js (392-400), qua `bumpDigest` → `digestDelta` (content.js:491-501; codex.js:420-427) |
| mốc thời gian | `lastDigestAt` | background.js `digestOnStartup` (190) |
| lý do chặn | `log[].blockedReason` (entry `kind==='blocked'`) | cùng flush trên (C3-1) |
| xu hướng | `stats.byDay` | cùng flush (744-747) |

Write path tham chiếu (nếu sau này cần counter theo lý do): phải đi qua `bumpDigest()` → cộng vào `digestDelta` → được cộng vào `digestCounters` **trong cùng một `chrome.storage.local.set`** của `flushClicks` (một hành động = một write, dưới Web Lock `maa-record-v1`) — không bao giờ thêm set() riêng.

## 4. i18n (6 locales: en, vi, zh_CN, ja, ko, es)

5 key mới (mỗi locale):
- `digestTopReason` — "Top block reason" / "Lý do chặn hàng đầu" / …
- `digestTopReasonNone` — "no blocks" / "không có lần chặn nào"
- `digestTrendMore` — "↑ $1 vs the previous 7 days"
- `digestTrendLess` — "↓ $1 vs the previous 7 days"
- `digestTrendSame` — "same as the previous 7 days"

Tái sử dụng: `digestTitle`, `digestSince`, `digestSinceStart`, `digestClicks`, `digestFollowups`, `digestBlocked`, `last7`. Dùng `tp()` cho key có `$1`.

## 5. Test plan

- **test/followup-e2e.mjs** — thêm check mới `G07 briefing. #digest shows counters + top reason + 7-day trend`: seed storage với `digestCounters`, `lastDigestAt`, log entry `blockedReason:"keyword:delete"`, `stats.byDay` → assert `#digest` hidden=false, `#dTopReason` chứa "keyword:delete (1)", `#dTrend` = tổng byDay 7 ngày, `#dTrendDelta` khớp trend key.
- **test/codex-e2e.mjs** — thêm assertion vào nhóm digest (dòng ~359-387): entry blocked của codex làm `digestCounters.blocked` tăng (nguồn cho top reason).
- **test/background-unit.mjs** — không đổi (D1-D4 giữ nguyên; startup digest không bị ảnh hưởng).
- **scripts/qa-experience.mjs** — **có, thêm check mới** `M. G07 briefing: card fits 320px, text-first, no colour-only`: mở popup, seed digest → assert `#digest` scrollWidth ≤ clientWidth, `#dTopReason` / `#dTrendDelta` text non-empty, tín hiệu không dùng màu làm phương tiện duy nhất (có chữ). Check D (locale sweep, dòng 146) tự bắt overflow cho 6 locale.
- **test/e2e.mjs** — thêm phase seed storage: assert `#digest` hiện với counters đúng (theo mẫu phase sẵn có).

## 6. Files to touch

1. `extension/popup.html` — 2 dòng mới trong `#digest` + CSS `.dreason` / `.dtrend`
2. `extension/popup.js` — `renderDigest()`: tính top reason từ log entries + trend từ `byDay`
3. `extension/_locales/{en,vi,zh_CN,ja,ko,es}/messages.json` — 5 key mới
4. `test/followup-e2e.mjs` — check G07 mới
5. `test/codex-e2e.mjs` — assertion blocked bump
6. `scripts/qa-experience.mjs` — check M mới
7. `docs/G07_BRIEFING_SPEC.md` — spec này
