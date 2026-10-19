# G04 — Anomaly Auto-Pause (spec, tiếng Việt; identifier tiếng Anh)

Nguồn: `docs/APPROVED_WORK_2026-10-19.md` (G04 = anomaly auto-pause, APPROVE_NOW, W2).

## 1. Detector

Module thuần `extension/anomaly.js` (classic script, global `MuseAnomaly`, có `module.exports` guard cho node:vm; không DOM, không chrome API):

- `MuseAnomaly.defaults()` → settings mặc định
- `MuseAnomaly.sanitize(raw)` → settings đã validate (fail closed)
- `MuseAnomaly.evaluate(win, now)` → `null | { rule, detail }`

Storage keys (chrome.storage.local, object `anomaly`; sanitize theo pattern applyV18Settings content.js:424):

| key | default | ý nghĩa |
|---|---|---|
| `enabled` | true | bật/tắt G04 |
| `rateWindowMs` | 300000 | cửa sổ trượt 5 phút |
| `rateMaxPerMin` | 30 | ngưỡng = 30 × 5 = 150 clicks / 5 min |
| `topicWindowMs` | 600000 | cửa sổ trượt 10 phút |
| `topicCountMin` | 40 | allow-clicks của 1 topic trong cửa sổ |
| `topicShareMin` | 0.7 | tỉ lệ topic đó trong tổng cửa sổ |
| `minSample` | 100 | clickCount tối thiểu trước khi rule nào chạy |
| `pauseMs` | 900000 | thời lượng auto-pause (15 min) |

**Rule RATE.** Đếm timestamp trong `allowClicks` (counter đã tồn tại: push tại content.js:805 trong doClick; prune pattern `allowRateOk` content.js:327-331) nằm trong [now − rateWindowMs, now]; fire khi đếm ≥ rateMaxPerMin × rateWindowMs/60000 (mặc định 150). Cửa sổ này DÀI HƠN cửa sổ cap 60s (`AUX_RATE_WINDOW_MS` content.js:152) nên cap 30/min (`ALLOW_RATE_MAX` content.js:150) vẫn là trần buộc; detector chỉ thêm trần "rate bền vững" — không bao giờ hạ cap hiện có.

**Rule TOPIC.** Cửa sổ trượt in-memory `topicClicks: Map<topic, number[]>`, update cùng chỗ `allowClicks.push` (content.js:805); topic = `extractTopic(context)` đã tính tại recordClick content.js:783 (persisted hook đối chiếu: `stats.byTopic` content.js:747, đọc stats.js:200-206). Fire khi: tổng đếm trong topicWindowMs ≥ 30 (min sample) VÀ max topic ≥ topicCountMin (40) VÀ share ≥ topicShareMin (0.7).

**Min sample chung:** `state.clickCount` (content.js:155,1642) ≥ minSample (100).

**Điểm chạy:** `sweep()` (content.js:1567) ngay sau gate `paused()` (content.js:1572); latch — đang pause thì không evaluate (không re-fire). Cadence: heartbeat 1s (content.js:1740) + observer (content.js:147) → độ trễ ≤ ~1s, xấu nhất ~65s khi tab bị throttle (alarm 1/min background.js:51). Không evaluate khi `dryRun === true` (chế độ chuẩn do user bật; cố ý). Áp dụng kể cả khi `yoloMode` (đây là trần an toàn, không phải rule bypass).

## 2. Pause mechanism

Khi detector fire (content.js):

1. Log entry kind MỚI `anomaly-pause` qua `recordClick(entry, ctx, false)` — thong minh `noteBlocked` content.js:397-409: label `Auto-pause (anomaly)`, context `rate:150/5min` hoặc `topic:spike-repo 40/10min`; `counts=false` nên không tính vào clickCount/stats.
2. `chrome.storage.local.set({ pauseUntil: now + pauseMs, anomalyLastPause: { firedAt: now, until, rule, detail } })`.
3. `console.warn` local-only (đúng nguyên tắc background.js:43-47).

Tái sử dụng đường pause có sẵn: badge `||` (background.js:103-120), one-shot `PAUSE_ALARM` refresh (background.js:124-135), storage.onChanged (background.js:304-310), popup `renderPause` (popup.js:867-883). Notification MỚI: trong background.js storage.onChanged, khi pauseUntil mới > now VÀ khớp `anomalyLastPause.until` → `chrome.notifications.create('maa-anomaly-pause', …)` — hardcoded English đúng convention background.js:15-16, guard `lastError`.

`followupAttempt` (content.js:1396): thay `reason:'paused'` bằng reason MỚI `anomaly-pause` khi marker khớp (`anomalyLastPause.until === v18.pauseUntil`); pause thủ công về giá trị `pauseUntil` mới (không khớp marker) vẫn trả `paused` cũ.

Mapping bắt buộc: kind `anomaly-pause` cần `KIND_KEY` (popup.js:85) → `kindAnomalyPause` và `kindClass` → `blocked` (popup.js:97). Reason `anomaly-pause` cần entry trong `SEND_BLOCKED_KEY` (popup.js:1653) với i18n key `followupSendBlockedAnomaly` tồn tại ĐỦ 6 locale — nếu không, assert F2 trong scripts/bench/experience.mjs:893-919 (enumerate `reason:'…'` từ content.js, đối chiếu map + 6 locale + parity) FAIL. experience.mjs không cần sửa.

## 3. i18n keys (6 locale: en, es, ja, ko, vi, zh_CN — mỗi key 1 dòng message)

- `kindAnomalyPause` — nhãn chip log cho kind `anomaly-pause`.
- `followupSendBlockedAnomaly` — thông báo khi "Send now" bị chặn do auto-pause.
- `anomalyPauseState` — dòng trạng thái trong popup khi là auto-pause ("Auto-paused until $1 — anomaly detected").
- `anomalyEnable` — nhãn toggle bật/tắt G04 (Safety sheet).
- `anomalyEnableHint` — tự dừng engine khi hành vi click bất thường.
- `anomalyRateLabel` — nhãn trường ngưỡng rate (clicks/phút).
- `anomalyRateHint` — rate bền vượt ngưỡng ⇒ auto-pause.
- `anomalyTopicLabel` — nhãn toggle topic-spike.
- `anomalyTopicHint` — một topic chiếm ≥ share trong cửa sổ ⇒ auto-pause.
- `anomalyDurationLabel` — nhãn trường thời lượng pause (phút).
- `anomalyDurationHint` — engine tự resume khi hết hạn.
- `anomalyActiveNote` — ghi chú trạng thái đang auto-pause (khi có marker).

## 4. Test plan

**Unit — node-vm, file MỚI `test/anomaly-unit.mjs`** (pattern test/background-unit.mjs:33,186-188: `vm.createContext` + evaluate extension/anomaly.js):

1. 149 clicks trong cửa sổ → `null`; 150 → `{rule:'rate'}`.
2. 150 clicks nhưng timestamp cũ nhất ngoài rateWindowMs → `null` (prune đúng).
3. Topic: 40 clicks cùng topic / tổng 50 / share 0.8 → `{rule:'topic'}`; share 0.5 → `null`.
4. `totalClicks < minSample` → `null` dù vượt ngưỡng.
5. `enabled:false` → `null`.
6. sanitize: `{rateMaxPerMin:'abc', topicShareMin:-5, minSample:NaN, rateWindowMs:0}` → về defaults (fail closed).
7. `rateMaxPerMin` user hạ còn 10 → fire ở 50 clicks / 5 min.

**In-Chrome — mở rộng `test/followup-fixture.html` + `test/e2e.mjs`** (launcher CDP giống experience.mjs): card family MỚI `spike` (45 cards "Allow Muse to perform this action? Repository spike-repo", pair Allow/Deny, wire vào `__cardClicks` như `wireV18` followup-fixture.html:275) + hook `window.__setAnomaly('spike'|'off')`. Seed storage `{enabled:true, minDelayMs:0, dryRun:false, onboarded:true, anomaly:defaults}`. Assertions chính xác:

1. `storage.pauseUntil > Date.now() + 800000` sau burst.
2. `storage.log[0].kind === 'anomaly-pause'` và context khớp `/topic:spike-repo/`.
3. Trong lúc pause: card mới KHÔNG được click; set `pauseUntil:0` → sweep click tiếp.
4. Popup: `#pauseActive` không hidden; `#pstateText` chứa dòng anomaly.
5. Trong auto-pause, `followup-send-now` trả `{ok:false, reason:'anomaly-pause'}` (pattern SEND_ALL_TABS experience.mjs:718).
6. Negative: `anomaly.enabled:false` → cùng burst, không pause, hết card được click.
7. `dryRun:true` → không fire; `clickCount:0` (dưới minSample) → không fire.

## 5. Failure modes — fail closed (không được làm yếu rail hiện có)

- **Bất biến cốt lõi:** G04 chỉ được THÊM pause, không bao giờ tăng/ hạ bất kỳ cap nào (30/min, dedup, cooldown, consent filters).
- **anomaly.js throw** → try/catch quanh evaluate trong sweep; detector tự vô hiệu (in-memory) + `console.warn`.
- **Write pauseUntil fail (quota)** → `console.warn`, không retry vô hạn; latch chống re-fire trong `pauseMs`.
- **Reload trang** → window in-memory reset (allowClicks cũng vậy, content.js:315); `pauseUntil` + `anomalyLastPause` persist → reason mapping sống sót.
- **Settings corrupt** → sanitize clamp về defaults (`Number.isFinite`, ≥0).
- **dryRun** → detector không hoạt động (cố ý).
- **yoloMode** → detector vẫn áp dụng (trần an toàn, không phải rule bypass).
- **Manual pause đang chạy** → latch không re-fire; marker cũ không khớp `until` nên reason về `paused` đúng.
- **Sync conflict** → local thắng (pullFromSync background.js:256-277); `anomaly` thêm vào `SYNC_SUBSET` (background.js:39) — opt-in only.
- **minSample** → cài mới, burst nhỏ không bao giờ bị G04 pause.

## 6. Files to touch

Mới: `extension/anomaly.js`, `test/anomaly-unit.mjs`. Sửa: `extension/manifest.json` (content_scripts js: `["anomaly.js","content.js"]`), `extension/content.js` (sweep :1572, followupAttempt :1396, boot read :1650, onChanged :1652, fire path), `extension/background.js` (SYNC_SUBSET :39, notification :304), `extension/popup.js` (KIND_KEY :85, kindClass :97, SEND_BLOCKED_KEY :1653, renderPause :872, Safety sheet handlers), `extension/popup.html` (controls + data-i18n), 6× `extension/_locales/*/messages.json`, `test/followup-fixture.html` (spike family + `__setAnomaly`), `test/e2e.mjs`. Không đụng `scripts/bench/experience.mjs` (F2 enumerate tự động phủ reason mới).
