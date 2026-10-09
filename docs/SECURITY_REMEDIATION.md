# SECURITY REMEDIATION — Muse Auto-Allow v1.7.0 (Security & Paid round — phase 2)

> **Lane:** SECURITY REMEDIATION (S12) — fix các finding `SA-1 / SA-2 / SA-3 / OB-1` của
> `docs/SECURITY_AUDIT_DRAFT.md` §4, falsify từng fix, để **RE-ATTACK độc lập** cho lane riêng
> (maker ≠ judge). Tài liệu này KHÔNG phải verdict.
> **Revision đóng băng:** `f4f058e380d3458f3bd9e5be4695e6e1690ed288` ("chore(release): freeze v1.7.0").
> Working tree = final state (không commit git theo yêu cầu round; mọi hash dưới đây là hash file
> trên đĩa tại thời điểm gates chạy).

---

## 0. TRẠNG THÁI

| Mục | Giá trị |
|---|---|
| Ngày | 2026-10-10 (+07) |
| Base | `f4f058e` (tree sạch trước khi sửa) |
| Kết quả | **5/5 xử lý**: SA-1, SA-2, SA-3, OB-1 = **FIXED + falsified**; OB-2 = **ACCEPTED** (documented) |
| Gates | `lint` exit 0 · `e2e` exit 0 · `followup-e2e` exit 0 (chi tiết §7) |
| Re-attack | **CHƯA chạy** — phải do lane độc lập thực hiện theo §8 (RE-ATTACK INPUT) |

### File đã sửa (đúng write set, không file nào khác)

| File | Thay đổi | sha256 (final) |
|---|---|---|
| `extension/stats.js` | SA-1 + SA-2 + SA-3 | `a47da7aa8b7b83c13a073eaede9c97ef73dd9a992d859eab03e3eaea3aa53543` |
| `extension/content.js` | OB-1 | `b34546db45aa7da722ebd9ba740547674a800e363eca210f6027a9ddca34b44c` |
| `extension/_locales/{en,vi,zh_CN,ja,ko,es}/messages.json` | +2 key × 6 locale | (parity giữ nguyên — lint §7) |
| `test/fixture.html` | fixture case card19 (OB-1) | `271d85dede6a031f1089eeda4678f0197928ce3a2d9abe3a50acfb0e02340e9f` |
| `test/e2e.mjs` | negative assertion `19` vào FORBIDDEN | `9a1a3f96c113c50c1fe159eb7a631062cc4ed5fe0ef212d9eb6ebc46efb1602b` |
| `test/import-security.mjs` | **MỚI** — harness falsification SA-1/SA-2/SA-3 | `3a80756d7854fb3b35a053f6f39453205e6422ee1841a9b9c0f9ed68a114f240` |
| `docs/SECURITY_REMEDIATION.md` | tài liệu này | — |

Không sửa `docs/SECURITY_AUDIT_DRAFT.md` (file của lane audit). Không git operation nào được chạy.

---

## 1. ENVIRONMENT BOOTSTRAP & TEST EXECUTION

- **Host:** Windows 11, terminal git-bash (MSYS). Repo: `C:/00. AI Project/muse-auto-allow`.
- **Runtime:** `node v26.7.0`; Chrome cài sẵn `154.0.8037.99` (e2e dùng CDP `Extensions.loadUnpacked`
  + scratch profile — không đụng profile người dùng).
- **Bootstrap:** không cần — repo zero-dependency (không package.json/node_modules); mọi suite là
  node script thuần trong repo (`docs/ENVIRONMENT_BOOTSTRAP.md` không yêu cầu thêm gì cho extension).
- **Lệnh đã thực thi thật** (kết quả nguyên văn ở §7; output thô lưu scratch
  `%LOCALAPPDATA%\hermes\cache\scratch\maa_s12\`):
  - `node scripts/lint.mjs`
  - `node test/e2e.mjs` (GREEN final + 1 lần RED falsification + 1 lần GREEN trước đó)
  - `node test/followup-e2e.mjs`
  - `node test/import-security.mjs` (GREEN final + RED pre-fix + RED ×3 reverse-mutation)
- **Services:** không có backend/service nào; e2e tự dựng fixture HTTP server trên 127.0.0.1 + Chrome scratch.
- **Limitations:** xem §9 (quota path ở mức unit, không drive browser-quota thật).

---

## 2. FINDINGS — TRẠNG THÁI TỪNG MỤC

### SA-1 — Key rotation without proof → **FIXED (fail closed)**

- **Vấn đề (audit §4, E-06):** `decOk` chỉ kiểm tra decrypt khi **entry đầu tiên** có `ctx`; file crafted
  `{cryptKeyRaw:<key lạ>, log:[{at,context}]}` (entry đầu không ctx) → thay khóa at-rest **không cần
  chứng minh**; log cũ thành "(unable to decrypt)".
- **Fix:** `extension/stats.js`
  - `resolveImportedKey(clean, currentKeyRaw)` — stats.js:260 (comment semantics stats.js:254-259).
  - Import handler gọi guard trước mọi thay đổi — stats.js:302 (`const kr = await resolveImportedKey(...)`).
  - Refusal message: stats.js:310 (`importKeyKept`); proof-fail: stats.js:303-305 → `importBad`, hủy toàn bộ import.
- **Semantics (chốt):**

  | Trường hợp file import | Kết quả |
  |---|---|
  | Không có `cryptKeyRaw` | import bình thường, khóa hiện tại không đổi |
  | Key **trùng** khóa hiện tại + không ctx | không xoay, không proof, không message (no-op) |
  | Key **khác** + **không có entry ctx nào** | **REFUSE xoay khóa** — dữ liệu vẫn import, khóa hiện tại được giữ, message `importKeyKept` hiện sau khi set thành công |
  | Key khác + có entry ctx, **proof fail toàn bộ** | **reject toàn bộ import** (`importBad`) — file tự mâu thuẫn (khóa không giải mã nổi entry của chính nó) |
  | Key khác + có entry ctx, **proof OK với bất kỳ entry ctx nào** (không chỉ entry đầu) | adopt key (như hành vi cũ, nhưng chặt hơn: quét mọi entry ctx) |
- **Falsification (RED/GREEN):**
  - GREEN: `node test/import-security.mjs` → **exit 0, 29/29 PASS** (gồm case đúng của audit: key K2 +
    entry-đầu-không-ctx → `kept=true, adopt=null`, `store.cryptKeyRaw` vẫn K1, entry cũ decrypt được bằng K1).
  - RED-1 (pre-fix): `git show f4f058e:extension/stats.js` → chạy harness → **exit 2, 17/29 FAIL**, trong đó:
    `stored key is UNCHANGED → keyUnchanged:false` (khóa bị xoay sang K2), `old entries still decrypt → FAIL`,
    `key-kept message → alerts []`. Harness cũng assert biểu thức legacy (`decOk` cũ) cho cùng input trả
    `true` — tức "old behavior would swap" (RED contrast) — trong khi guard mới giữ khóa.
  - RED-2 (reverse mutation): `stats-mut-sa1.js` (dòng guard đảo về adopt-unconditionally) → **exit 2, 4 FAIL**.
  - Restore → GREEN trở lại.

### SA-2 — Follow-up config lost on restore → **FIXED**

- **Vấn đề (E-06):** `sanitizeBackup` thiếu toàn bộ `followup*` trong whitelist trong khi export dùng
  `get(null)` → round-trip mất cấu hình Auto follow-up (silent); file chỉ chứa followup keys bị báo
  "Not a backup".
- **Fix:** `extension/stats.js:229-241` — thêm **7 key** đúng như popup.js/content.js dùng:
  `followupEnabled` (boolean), `followupPrompt` (string, slice 4000), `followupPrompts` (string[],
  ≤600/ký tự, cap 10), `followupChips` (id string[] ≤64 ký tự, cap 32), `followupRotateIdx`
  (int ≥0, clamp ≤100000), `followupIdleMs` / `followupCooldownMs` (ms, clamp `[0, 3 600 000]` /
  `[0, 86 400 000]` — trần = dải reachable của popup: `fidle ≤ 3600 s`, `fcool ≤ 1440 min`; engine
  `content.js applyFollowupSettings` chấp nhận mọi finite ≥ 0 nên mọi giá trị UI-đặt được round-trip
  nguyên vẹn). Kiểu validate theo đúng convention sanitizer hiện có (filter/slice/clamp như log/stats).
- **Falsification:**
  - GREEN: round-trip equality cho cả 7 key (sanitize + chạy handler thật vào storage) — PASS trong 29/29.
  - RED-1 (pre-fix blob): **cả 7 key missing** → 2 round-trip checks + 5 bounds checks FAIL (17/29).
  - RED-2: `stats-mut-sa2.js` (xóa dòng whitelist `followupPrompt`) → **exit 2, 3 FAIL** (`followupPrompt` missing).
- **Note (deliberate bound):** import cap `followupPrompts` = 10 trong khi engine chấp nhận tới 20
  (`FOLLOWUP_ROTATION_MAX`) — giới hạn storage-hygiene của import; item thứ 11+ bị bỏ khi restore (ghi ở §9).

### SA-3 — Dataset bounds + quota message → **FIXED**

- **Vấn đề (E-06):** `clickCount` không trần (1e308 lưu được); `at` không cap (300k ký tự sống sót →
  phình log/quota); khi set vượt quota → alert sai nghĩa ("Not a Muse Auto-Allow backup file.").
- **Fix:** `extension/stats.js`
  - `ISO_AT_RE` + `isoAt()` — stats.js:198-199: `at` phải là ISO-ish (`YYYY-MM-DDTHH:MM:SS[.frac][Z|±hh:mm]`,
    uppercase T/Z) và ≤64 ký tự; sai → **entry bị drop** (không thể làm phình log/quota).
  - `clickCount` clamp `≤ 1e7` — stats.js:204.
  - Quota có message riêng: stats.js:313 — `importQuota` khi `chrome.storage.local.set` reject với lỗi
    khớp `/quota/i`; lỗi set khác giữ `importBad` như cũ.
- **i18n:** 2 key mới × 6 locale — `importQuota` (en:107), `importKeyKept` (en:110), các locale còn lại
  cùng vị trí (parity do lint gate giữ).
- **Falsification:**
  - GREEN: `clickCount 1e308 → 1e7`; log crafted 5 entry (`300k-char at`, `>64-char at`, `at` non-string)
    → chỉ 2 entry ISO hợp lệ sống sót; quota path → alert đúng `importQuota` (khác `importBad`), storage
    không đổi. PASS trong 29/29.
  - RED-1 (pre-fix blob): `clickCount:1e+308` sống sót, log giữ 4 entry (kể cả 300k `at`), và quota path
    hiện **"Not a Muse Auto-Allow backup file."** — FAIL đúng 3 check này.
  - RED-2: `stats-mut-sa3.js` (bỏ clamp clickCount + nới lại `at`) → **exit 2, 2 FAIL**.
- **Giới hạn bằng chứng:** quota path được chạy ở mức unit (stub `set` reject `QUOTA_BYTES quota exceeded`);
  chưa drive quota thật trong Chrome — xem §9.

### OB-1 — Notification-card boundary → **FIXED**

- **Vấn đề (E-10):** card kiểu "Allow Muse to send notifications…" chứa 'allow muse' → `APPROVAL_CONTEXT_RE`
  override consent filter → **auto-click**.
- **Fix:** `extension/content.js`
  - `PERMISSION_CARD_RE = /\b(send notifications|notifications?|camera|microphone|location|clipboard)\b/i`
    — content.js:71 (comment OB-1 ngay trên).
  - `consentOnly()` — content.js:176: `PERMISSION_CARD_RE` **thắng tuyệt đối** (OR đầu tiên) → card
    notification/permission-style **KHÔNG BAO GIỜ được click** dù có 'allow muse'; các rail khác
    (Allow/Deny pair cùng container + deny clickable, không anchor/form, visibility, dedup, cap) giữ nguyên.
  - Comment rail ở đầu file cập nhật (content.js:23-26).
- **Fixture + assertion (test/**):**
  - `test/fixture.html`: card19 — `"Allow Muse to send notifications about updates?"` + cặp Allow/Deny
    thật (fixture.html:178-186), wired `wirePair(document, 19)` (fixture.html:280).
  - `test/e2e.mjs:164`: `'19'` thêm vào `FORBIDDEN` (assertion âm — dùng cơ chế `forbiddenHit` sẵn có,
    không đổi bất kỳ assertion cũ nào).
- **Falsification (RED/GREEN, chạy thật):**
  - RED: tạm đảo `consentOnly` về dạng cũ → `node test/e2e.mjs` → **exit 2**, `extra:["19"]`,
    **`forbiddenHit:["19"]`** (notification card bị click) — đúng lỗi OB-1.
  - Restore → sha256 `content.js` khớp lại byte-identical (`b34546db…`) → `node test/e2e.mjs` →
    **exit 0**, `forbiddenHit: []`, clicked = đúng 13 mục như trước (`[4,11,17,1,2,7,pending5,5,3,surface,6,reviewbar,18]`),
    `missing/extra/dupes` rỗng, `denyCount 0`.

### OB-2 — Pacing (~1s/click) → **ACCEPTED (không đổi code)**

- **Đo được (E-10):** `minDelayMs 300` nhưng nhịp click thực tế ~1s khi page không mutate DOM (nhịp do
  heartbeat 1s; `scheduleSweep` chỉ reschedule cho sweep bị chặn bởi minDelay).
- **Chấp nhận vì:** (1) cap là **theo cửa sổ thời gian** (`ALLOW_RATE_MAX 30/60s`, `AUX_RATE_MAX 30/60s`)
  — nhịp chậm hơn KHÔNG nới trần hành vi, chỉ làm throughput thấp hơn trần; (2) trên page thật (có
  mutation) observer reschedule cho nhịp nhanh hơn, đúng thiết kế; (3) đây thuần pacing/perf, không phải
  authority/security invariant — thay đổi code chỉ để đạt đúng minDelay không tăng bảo đảm an toàn nào;
  (4) mọi rail khác (dedup 5s, throttle expand/review-bar/surface) độc lập với nhịp. Ghi nhận là
  **accepted INFO**; nếu owner muốn đúng minDelay tuyệt đối thì là một task perf riêng (ngoài scope S12).

---

## 3. I18N KEYS MỚI (×6 locale — en, vi, zh_CN, ja, ko, es)

| Key | en | Dùng ở |
|---|---|---|
| `importQuota` | "Could not restore the backup: browser storage is full." | stats.js:313 (quota rejection) |
| `importKeyKept` | "Imported. The backup's encryption key could not be verified, so it was not restored (the existing key was kept)." | stats.js:310 (SA-1 refusal) |

Fallback trong code trùng nguyên văn chuỗi en (harness assert điều này); parity 6 locale do `lint` +
preflight của `followup-e2e` giữ (mục 0 của suite: key sets identical).

---

## 4. GATES — KẾT QUẢ NGUYÊN VĂN (final state)

1. `node scripts/lint.mjs` → **exit 0**
   `lint OK — 24 checks across 18 files (syntax, JSON, i18n parity, no remote code, minimal permissions)`
2. `node test/e2e.mjs` → **exit 0**, `ok: true`
   - `forbiddenHit: []` (bao gồm `19` mới — notification card KHÔNG bị click), `missing: []`, `extra: []`,
     `dupes: []`, `denyCount: 0`, `n7count: 1`, `n11count: 1`, `orderOk: true`, `dedupSepOk: true`,
     `surface2Hit: false`, `statsCheck.ok: true`, `encCheck.ok: true`, `statsPage.ok: true`,
     `locksProbe: true`, `museAttr: true`
   - `clicked = [4,11,17,1,2,7,pending5,5,3,surface,6,reviewbar,18]`
3. `node test/followup-e2e.mjs` → **exit 0**, `ok: true`, **74/74 checks PASS**, `verifyTimeouts: []`
4. `node test/import-security.mjs` (harness của lane này) → **exit 0**, 29/29 PASS

Bằng chứng thô: `%LOCALAPPDATA%\hermes\cache\scratch\maa_s12\` — `e2e-red.txt`, `e2e-green.txt`,
`fup-green.txt`, `run-new.txt`, `run-old.txt`, `run-mut-sa1.txt`, `run-mut-sa2.txt`, `run-mut-sa3.txt`
(cùng `stats-old.js` = blob f4f058e, `stats-mut-*.js` = reverse-mutation copies, `mutate.mjs` = helper).

---

## 5. RE-ATTACK INPUT — cho lane RE-ATTACK độc lập (S13)

> Nguyên tắc: **old SHA không đóng new HEAD** — phải chạy lại trên working tree hiện tại (hash ở §0).
> Mục tiêu: cố **phá** từng fix; nếu không phá được, ghi residual chính xác.

1. **Gates lại toàn bộ** (kỳ vọng exit 0 cả 4):
   `node scripts/lint.mjs` · `node test/e2e.mjs` · `node test/followup-e2e.mjs` · `node test/import-security.mjs`
2. **SA-1 — re-craft đúng 4 biến thể** (dùng harness hoặc WebCrypto riêng; current key = K1, key tấn công = K2):
   - `{cryptKeyRaw:K2, log:[entry không ctx]}` → phải giữ K1 (assert entry cũ vẫn decrypt bằng K1; alert `importKeyKept`).
   - `{cryptKeyRaw:K2, log:[entry không ctx, entry ctx mã hóa bằng K2]}` → phải **adopt K2** (proof qua entry thứ 2 — "any entry with ctx").
   - `{cryptKeyRaw:K2, log:[entry không ctx, entry ctx mã hóa bằng K3]}` → phải **reject toàn bộ** (`importBad`, storage không đổi).
   - `{cryptKeyRaw:K1, log:[entry không ctx]}` → no-op, không message.
   - Thử thêm: entry ctx ở vị trí bất kỳ; nhiều entry ctx (1 hợp lệ giữa các entry rác) — chỉ cần ≥1 proof OK là adopt.
3. **SA-2 — round-trip bằng dữ liệu thật**: set cấu hình qua popup UI (chips + custom + starter rotation +
   idle/cooldown), Export → Import → assert từng key bằng đúng giá trị (7 key); thử biên: prompts 13 mục
   (kỳ vọng còn 10), item 700 ký tự (còn 600), chips 40 id (còn 32), id 100 ký tự (bị drop), rotateIdx 1e9 (→100000),
   idleMs 1e308 (→3600000), cooldownMs âm (→0).
4. **SA-3 — biên dữ liệu**: clickCount 1e308 (→1e7); `at` 300k ký tự + `at` 80 ký tự ISO+junk + `at` non-string
   (entry bị drop, log không phình); `at` hợp lệ giữ nguyên. **Quota thật trong Chrome (khuyến nghị, hiện NOT_VERIFIED
   ở mức browser):** làm đầy `chrome.storage.local` gần quota rồi import file vừa phình để set reject → alert phải là
   `importQuota`, không phải `importBad`.
5. **OB-1 — click-heuristic**: fixture card19 (đã có) phải không bao giờ bị click; thử thêm biến thể wording
   (`camera`, `microphone`, `location`, `clipboard`, `send notifications`, số nhiều/ít, hoa/thường) — tất cả phải
   không click dù chứa 'allow muse'; **positive control**: card approval thật (pair Allow/Deny) vẫn được click
   (đối chiếu `clicked` set của e2e).
6. **Không được phá vỡ các rail cũ**: toàn bộ FORBIDDEN của e2e (gồm `19`), `denyCount 0`, dedup n7/n11,
   followup-e2e case (e) approval-priority + z-checks (deny không bao giờ bị click) — chạy lại là điều kiện bắt buộc.
7. **Rebind**: recapture hash toàn bộ file đã sửa (§0) — nếu lane khác ghi đè file, coi như revision mới và REBIND lại.

---

## 6. LIMITS / NOT VERIFIED (trung thực)

- **Quota message:** đường quota được falsify ở mức unit (stub `chrome.storage.local.set` reject
  `QUOTA_BYTES quota exceeded` → `importQuota`); **chưa** drive quota thật trong Chrome (NOT_VERIFIED ở mức browser).
- **`followupPrompts` cap 10 khi import** (engine chấp nhận 20): chủ đích — item thứ 11+ bị drop khi restore;
  re-attack lane cần biết đây là bound cố ý, không phải bug inheritance.
- **`at` format chấp nhận:** đúng dạng ISO với T/Z uppercase + offset tùy chọn, fraction ≤6 chữ số, ≤64 ký tự;
  mọi dạng khác bị drop (fail-closed) — entry cũ trong backup thật luôn là `toISOString()` nên không mất dữ liệu.
- **SA-1 proof-fail** reject toàn bộ import (không "giữ khóa rồi import dữ liệu") — chủ đích, giữ đúng hành vi cũ
  cho file tự-mâu-thuẫn; chỉ nhánh "không có entry ctx" mới keep-key + import.
- **OB-1:** `approvalPresent()` (chặn follow-up gửi) giữ nguyên — card notification-style vẫn làm follow-up
  không gửi khi hiện diện (fail-closed, không phải regression). Card chứa các từ khóa permission-style sẽ
  không bao giờ được auto-click kể cả khi là approval thật liên quan notification/camera/… → người dùng click tay
  (fail-closed trade-off đúng yêu cầu "NEVER clicked").
- Không thực hiện git commit/push/branch nào (theo yêu cầu round).
