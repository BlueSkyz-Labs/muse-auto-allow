# Lessons — Muse Auto-Allow (SGPS-DEC-2026-035 lessons-as-code)

One record per lesson. Every record carries its **strongest feasible executable guard** — the
check that fails if the lesson regresses. A recurrence escalates the guard in the same fix PR.

---

## LSN-muse-auto-allow-001 — a variant token inside a one-shot classifier silently widens the click set

**Date:** 2026-10-18 · **Found by:** independent adversarial audit (live Chromium repro)
**Lesson:** `ALLOW_RE` listed `always` in its one-shot alternation, so the postfix standing label
"Allow always" was classified as a plain one-shot and clicked with **no standing flag** while
silently granting standing scope — exactly what the surrounding comment promised never happens.
Wording sets must be split by *authority class* (one-shot vs standing), never by convenience.
**Guard:** `test/e2e.mjs` FORBIDDEN `f1-standing` (a postfix standing pair must not be clicked
without YOLO); YOLO behavior covered by `fixture-yolo.html` phase.

## LSN-muse-auto-allow-002 — a consent-surface allowlist is bypassable by rewording; mirror the parity list

**Date:** 2026-10-18 · **Found by:** independent adversarial audit
**Lesson:** the connector/consent hard-block knew only `Connector` / `Connect` / `api key`; a
reworded surface ("Authorize app", "Bearer key") rendered a clickable pair. codex.js already had
the proven, wider parity lists — content.js did not. When two engines guard the same class, the
proven list is the floor, not a suggestion.
**Guard:** `test/e2e.mjs` FORBIDDEN `f3-authorize`, `f3-allow`, `f3b-allow` + the connector
`blockedReason: 'connector'` log assertion.

## LSN-muse-auto-allow-003 — geometry is not visibility; parked controls were clickable

**Date:** 2026-10-18 · **Found by:** independent adversarial audit
**Lesson:** the visibility check tested size + computed style only, so an off-canvas
(`position:fixed;left:-9999px`) or near-invisible (`opacity:0.0001`) button was clicked.
Visibility must include canvas bounds (document scroll area — below-the-fold content must STAY
clickable), ancestor visibility (`checkVisibility`) and a real opacity floor.
**Guard:** `test/e2e.mjs` FORBIDDEN `f2-offscreen`, `f2-faint`.

## LSN-muse-auto-allow-004 — the import path is an authority path; every autonomy switch asks

**Date:** 2026-10-18 · **Found by:** independent adversarial audit
**Lesson:** the import confirm only covered YOLO/Codex flips; a crafted backup could turn on live
clicking, auto follow-up, auto mission, or clear an active pause behind the generic dialog.
Enumerate autonomy switches as a *set* and confirm every ON-flip / kill-switch clear.
**Guard:** `test/import-security.mjs` G15 (four flips refused without the authority confirm,
applied once accepted) + G14/G16 (schemaVersion refuse-and-honest messages).

## LSN-muse-auto-allow-005 — test sandboxes must mirror browser globals

**Date:** 2026-10-18 · **Found by:** the freeze battery (the suite crashed, not the product)
**Lesson:** adding `const readAsset = globalThis.fetch.bind(globalThis)` to stats.js crashed the
node-vm `import-security` suite at load because its sandbox had no `fetch` — a browser-guaranteed
global. A sandbox that is *missing* globals the extension may legally use produces false crashes;
sandbox drift is a harness defect to fix in the harness, immediately.
**Guard:** the `fetch` stub in the `import-security` sandbox + the suite runs in every battery.

## LSN-muse-auto-allow-006 — a safety fix must not over-block; the expected set is the guard

**Date:** 2026-10-18 · **Found by:** the freeze battery (e2e exit 2) while fixing LSN-003
**Lesson:** the first off-canvas fix required strict viewport containment, which made every
below-the-fold fixture card unclickable — a functional regression the very next e2e run caught
(expected-set assertions, `f1..` FORBIDDEN tuning). Safety fixes are judged in BOTH directions:
never-click-the-bad-thing AND still-click-the-real-thing.
**Guard:** `test/e2e.mjs` EXPECTED set (below-fold cards must still be clicked) alongside the
FORBIDDEN set.

## LSN-muse-auto-allow-007 — automation probes fabricate failures too; confirm state before reading

**Date:** 2026-10-18 · **Found by:** the SGPS:Experience pass v1 (three reported failures, all fake)
**Lesson:** the v1 contrast probe set a colour-scheme emulation and read computed styles ~300 ms
later without confirming the media state — it mixed dark-theme computed colours with a
light-theme background and reported three product failures that did not exist (verified live:
"Allow always"/"Missions"/primary-CTA all pass WCAG AA in both themes). The focus probe also
mis-read the `.numwrap` wrapper-ring pattern, and the state probe used a guessed selector. A
probe is code under test: confirm the emulated state (`matchMedia` loop), verify selectors against
the real DOM, and re-derive before filing anything as a product defect.
**Guard:** `qa-experience` v2 confirms the scheme before every contrast read, understands the
wrapper-ring pattern, and reads `#dryBand`/`#stateLine` — the corrected pass is 11/11.

## LSN-muse-auto-allow-008 — tests must baseline AFTER the state transfer, not around it

**Date:** 2026-10-19 · **Found by:** the v1.19.0 battery (mission-e2e check C red)
**Lesson:** with a 'working' tab the automatic mission send can fire in the gap between
`setState('working')` and the pause actually applying — so a step baseline read before that
handshake drifts, and both "no advance while paused" and "resume advances by one" fail even
though the product behaved correctly (the paused path held in the same run). When a test
measures a transition (pause/resume, enable/disable), stop the interfering path first and take
the baseline only after the new state is confirmed applied.
**Guard:** `test/mission-e2e.mjs` C block: idle → pause → wait `paused` → baseline `stepC0` →
pause-holds → refused-while-paused → resume must land on exactly `stepC0 + 1` (2 green runs).

## LSN-muse-auto-allow-009 — parse timestamps, never coerce them

**Date:** 2026-10-19 · **Found by:** the new qa-experience L1 check on the first S02 build
**Lesson:** log entries carry `at` as an ISO string; the new day-group code computed the day key
via `Number(e.at)` → `NaN` → every entry collapsed under one bogus 1970 header. The check caught
it before the freeze (L1 asserted 2 group headers, got 1). Date fields from storage are data —
parse with `new Date(value)` plus an `isNaN` guard, never numeric coercion.
**Guard:** `qa-experience` L1–L4 (day groups, chip filter, search, localized no-match state).

## LSN-muse-auto-allow-010 — the log is encrypted at rest; assert its shape, not its plaintext

**Date:** 2026-10-19 · **Found by:** G04 e2e check 2 (first red run, entry present but "no context")
**Lesson:** log entries carry their context as an encrypted `{ct, iv}` object (V4-5 at-rest
encryption); the popup decrypts via `decCtx`. An e2e that greps the raw `entry.context` for
plaintext fails even though the product wrote it correctly. Assert the STABLE surface —
`kind`, `blockedReason`, the `{ct,iv}` shape, and the UNENCRYPTED marker (`anomalyLastPause`)
— and let the popup-rendered checks prove the decrypted path.
**Guard:** followup-e2e G04-2 (kind/reason/ctx-shape/marker.rule) + G04-4 (popup shows the
decrypted state line).

## LSN-muse-auto-allow-011 — e2e thresholds must fit the FIXED constants and the real pacing

**Date:** 2026-10-19 · **Found by:** G04 e2e check 1 (first red run — detector never fired)
**Lesson:** the topic rule refuses to engage below a fixed window-total floor of 30, and under
the fixture the engine clicked roughly one card per ~5 s — so a phase tuned to 12 topic clicks
never fired and could never be green. Retuned the phase to the RATE rule (5 clicks per 60 s,
threshold = rateMaxPerMin × rateWindowMs / 60000) and left the topic rule to the unit suite.
Tuning an e2e threshold must start from: the module's hard constants, the smallest sample the
rule accepts, and the engine's observed slowest cadence — never the ideal cadence.
**Guard:** G04-1..6 green in a full 113-check run; anomaly-unit pins the topic semantics.

## LSN-muse-auto-allow-012 — đừng tự tay mở đường tự động trong bài kiểm thử, và chờ lượt gửi lắng trước khi đo mốc

**Ngày:** 2026-10-19 · **Phát hiện bởi:** đợt kiểm thử v1.21.0 (mission-e2e khối C đỏ 2 lần chạy liên tiếp)
**Bài học:** hai dạng đua thời điểm chồng nhau. (1) Khối C tự gọi chế độ "rảnh" trước khi đặt tạm
dừng — mà đường gửi tự động chỉ chạy khi tab rảnh, nên chính thao tác đó mở một nhịp gửi tự động
đúng lúc lấy mốc; mốc bước bị trôi và cả hai kiểm tra liền kề đỏ dù sản phẩm đúng. (2) Lượt gửi
"đã thử" của chặng trước có thể được xác minh MUỘN, ngay sau khi chặng sau đặt lại bước, làm bước
nhảy đúng lúc đo. Cách chữa tận gốc: giữ tab ở trạng thái "đang làm việc" suốt khối tạm dừng, mỗi
lần đo mốc/gửi đều chờ `followup.sending === false` (hàm `waitQuiet`), thêm một khoảng lắng 1,5 giây
sau khi đặt lại bước, và so mốc TRƯỚC/SAU quanh hành động thay vì so với giá trị tuyệt đối.
**Guard:** mission-e2e 37/0 (khối C tất định; G02-C so `stepBefore` với `stepAfter`).

## LSN-muse-auto-allow-013 — bài học từ audit độc lập W4 (điều kiện cấp quyền, trạng thái UI, phạm vi cổng lint)

**Ngày:** 2026-10-19 · **Phát hiện bởi:** audit độc lập sau khi ráp W4 (3 phát hiện MEDIUM + 1 LOW)
**Bài học:** ba mẫu lỗi đáng nhớ. (1) Chữ ký hợp lệ KHÔNG đủ: allowlist sku mà quên allowlist `tier`
thì token ký với tier lạ vẫn được cấp PRO — mọi trường tham gia quyết định quyền phải có allowlist
riêng. (2) Trạng thái UI phải về mặc định AN TOÀN trước mọi await: chip giữ "PRO" từ lần render
trước khi lượt xác minh mới đang chờ/lỗi là hiển thị sai quyền — đặt về "Free" trước, nâng lên sau
khi xác minh xong. (3) Cổng lint theo mẫu văn bản phải được kiểm chứng bằng đột biến Ở CẢ biến thể
mã hoá: chặn JWK literal mà bỏ qua JWK base64 là cổng nửa vời. Kèm một chi tiết vận hành: mốc
chống lùi đồng hồ chỉ nên ghi khi lệch > ngưỡng (60 giây) để tránh storage.onChanged quay vòng render.
**Guard:** `license-unit` L4b (tier lạ, chữ ký hợp lệ → từ chối) · renderLicense đặt Free trước await ·
lint `LICENSE-TEST-KEY-NOT-IN-RELEASE` mở rộng quét base64 (đột biến trực tiếp: chèn → đỏ, gỡ → xanh) ·
`import-security` biên token 2048/2049 khớp `license.js`.
