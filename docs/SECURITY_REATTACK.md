# SECURITY RE-ATTACK — Muse Auto-Allow v1.7.0 (Security & Paid round — phase 3)

> **Lane S13 RE-ATTACK độc lập (maker ≠ judge) — READ-ONLY.** Write duy nhất của lane này là
> file bạn đang đọc. Nhiệm vụ: cố **phá** các fix `SA-1 / SA-2 / SA-3 / OB-1` của lane S12
> (commit `d4a5e3c`) bằng probe **độc lập** (script riêng trong Hermes scratch, không tái dùng
> artifact của S12 làm bằng chứng) + biến thể tấn công mới, theo checklist `docs/SECURITY_REMEDIATION.md §5`.
> **Nguyên tắc binding:** mọi verdict bind vào sha256 file thật đã test; file nào bị lane khác
> sửa trong cửa sổ re-attack → **REBIND_REQUIRED** (ghi rõ hash đã thấy).
> Base: HEAD `7de2e91` (working tree). Không git operation, không fix, không sửa file nào khác.

---

## 0. HASHES TESTED + DRIFT LOG

| File | sha256 lúc re-attack | Trạng thái |
|---|---|---|
| `extension/stats.js` | `a47da7aa8b7b83c13a073eaede9c97ef73dd9a992d859eab03e3eaea3aa53543` | **khớp §0 S12**; không đổi suốt cửa sổ re-attack → **AUTHORITATIVE cho SA-1..SA-3** |
| `extension/content.js` | `b34546db45aa7da722ebd9ba740547674a800e363eca210f6027a9ddca34b44c` | **khớp §0 S12**; không đổi → **AUTHORITATIVE cho OB-1** |
| `extension/manifest.json` | `3f253b8dcac21732f5f1db54b40863982af591e30a382bfb601e94556b553d60` | không đổi |
| `extension/background.js` | `84c0564ea0b47bc64361e45a789f7b12d25eae3a56987bd9f3727882e4b09ab5` | không đổi |
| `extension/popup.js` | `b6bd7f46…` (đầu cửa sổ) → **`884a2ddf3608e92a1f8e4ba455663245f6e4f79a61fe3f4823a2c95eafaf9c06`** (cuối) | **REBIND_REQUIRED** (lane experience-fix ghi ~01:07) |
| `extension/stats.html` | `5fc22c15…` (đầu) → **`c0cde7efc9400216f8395831c18f3c3d951e1ea58757bd3703d306d5dafb7fa6`** (cuối) | **REBIND_REQUIRED** (~01:08) |
| `extension/popup.html` | `67ac8e5a…` (đầu) → `d4b31024d2b8e7d5857c8d38fbc2dffe200467174fa37804bfe2a1dfbc8ac38a` (cuối) | **REBIND_REQUIRED** |
| `extension/_locales/*/messages.json` | en: `c0b980a1…` (giữa) → **`8014784be6844be69c9e8831f082797b5d1f98b3d3aa671f3a145bcb528fd5f0`** (cuối); 6 locale đều drift | **REBIND_REQUIRED** (cả 6) |
| `test/e2e.mjs` / `test/fixture.html` / `test/import-security.mjs` | `9a1a3f96…` / `271d85de…` / `3a80756d…` | không đổi, khớp §0 S12 |

**Drift log (quan sát thật, không suy đoán):** lane experience-fix ghi `popup.html/popup.js/stats.html`
**trong lúc** suite window A đang chạy; 6 file `_locales` ghi trong window B (giữa 2 snapshot hash);
sau đó tree ổn định (không drift trong cửa sổ quota-rebind). `stats.js` + `content.js` **không hề đổi**
từ đầu đến cuối — đúng như round note ("frozen by remediation").

Bằng chứng hash: `hashes_before_suites.txt`, `hashes_after_suites.txt`, `hashes_before_rebind.txt`,
`hashes_after_rebind.txt`, `hashes_before_quota2.txt`, `hashes_after_quota2.txt`, `drift_quota2.txt`,
`final_hashes.txt`, `final_hashes_late.txt` (scratch §8).

---

## 1. ENVIRONMENT BOOTSTRAP & TEST EXECUTION

- **Host:** Windows 11, terminal git-bash (MSYS). Repo: `C:/00. AI Project/muse-auto-allow`.
- **Runtime:** `node v26.7.0` (Hermes tools path); Chrome cài sẵn **154.0.8037.99**
  (`C:/Program Files/Google/Chrome/Application/chrome.exe`). Zero-dependency repo — không cần bootstrap.
- **Phương pháp probe (độc lập với S12):**
  - `probe_sa123.mjs` — **vm sandbox tự viết** nạp **nguyên văn** `extension/stats.js`, drive **REAL
    export handler** (Blob) + **REAL import handler** (change event) với **WebCrypto thật**; assertions
    đọc **storage sau `set()`**, không chỉ đọc return của hàm nội bộ. 54 checks.
  - `run_mutations.mjs` — 3 bản reverse-mutation trong scratch (không đụng repo) để chứng minh probe
    **đỏ được** (falsifiability của chính probe).
  - `probe_quota_browser.mjs` — **Chrome thật** (CDP `Extensions.loadUnpacked`, scratch profile —
    KHÔNG đụng profile người dùng): seed `chrome.storage.local` tới ~150 KB dưới quota thật
    (10 485 760 B) rồi import payload ~338 KB qua handler thật trên `stats.html` thật.
  - `probe_ob1.mjs` + `ob1-fixture.html` — **Chrome thật** với fixture riêng của lane này: 8 card
    consent-variant âm + 2 positive control + 1 boundary card; chạy 2 chế độ (real / mutated).
- **Services:** không backend; mỗi probe browser tự dựng HTTP fixture server 127.0.0.1 + Chrome
  scratch riêng, teardown reap theo scratch-profile path (`orphans: 0` mọi lần chạy).
- **Lệnh đã thực thi thật:** xem §4 (suites) + §2 (probe). Output thô nguyên văn: scratch `maa_s13/` (§8).

---

## 2. VERDICTS — TỪNG FINDING

### SA-1 (key rotation) — **CONFIRMED_FIXED** (independent)

**Bằng chứng chính (độc lập):** `probe_sa123.mjs` → **exit 0, 54/54 PASS**, bound
`stats.js = a47da7aa…` (raw: `evidence_probe_sa123_real.txt`, rebind: `evidence_rebind_probe_sa123.txt`).
Probe này **mạnh hơn** hình tấn công gốc E-06 ở 3 điểm: (a) drive handler thật end-to-end;
(b) thêm dạng mạnh nhất "file chỉ có key, không có `log`" (log cũ K1-encrypted **còn nguyên trong
storage** — đúng kịch bản "old entries thành unable to decrypt"); (c) assert cả alert + set-call count
+ nội dung storage sau cùng.

| Case | Hình tấn công / kiểm chứng | Kết quả đo được |
|---|---|---|
| S1a | **Đúng hình audit**: `{cryptKeyRaw:K2, log:[entry KHÔNG ctx]}` | rotation **refused**; key giữ K1; alert `importKeyKept`; data vẫn import |
| S1b | **Dạng mạnh nhất**: `{cryptKeyRaw:K2}` (không `log`) — storage log K1-encrypted còn nguyên | key giữ K1; **entry cũ vẫn decrypt bằng K1**; alert `importKeyKept` |
| S1c | ctx entry **ở vị trí SAU** (entry đầu không ctx), ctx mã hóa bằng K2 | **adopt K2** (proof "bất kỳ entry ctx"); entry import decrypt được bằng K2 |
| S1d | **garbage ctx trên entry ctx duy nhất** (mã hóa bằng K3) | **reject toàn bộ** (`importBad`), **0 set call**, storage nguyên vẹn |
| S1e | **legit restore**: key hợp lệ + ctx hợp lệ | adopt K2, không message sai, round-trip decrypt đúng |
| S1f | *biến thể mới*: nhiều ctx entry — **junk trước, valid sau** | adopt (quét mọi entry ctx) |
| S1g | *biến thể mới*: ctx hợp lệ vị trí đầu nhưng key cung cấp là K3 | reject toàn bộ |
| S1h | *biến thể mới*: `cryptKeyRaw` sai định dạng | key bị sanitizer bỏ; import chạy; **không** message kept/bad |
| S1i | key trùng khóa hiện tại + không ctx | no-op, không message |
| S1j | *biến thể mới*: file tự mâu thuẫn (key = K1 hiện tại nhưng ctx mã hóa bằng K3) | reject toàn bộ (fail closed) |
| S1k | *biến thể mới*: fresh install (chưa có key) + K2 + ctx hợp lệ | adopt K2 |
| S1l | *biến thể mới*: fresh install, không ctx | key **không** được adopt; data import; alert `importKeyKept` |
| S1m | *biến thể mới*: ctx bị sanitizer drop (iv sai shape) → coi như "không ctx" | rotation refused, key giữ |
| S1n | *biến thể mới*: kept-refusal + set reject vì quota | alert `importQuota` (không phải kept/bad); storage nguyên |
| S1o | *biến thể mới*: user bấm Cancel ở confirm | không set, không alert, storage nguyên |
| S1p | **Residual characterization** (xem §5 R-1) | file tự-đủ (K2 + 1 entry K2 + 1 entry K1 copy) **vẫn xoay được key**; entry K1 copy thành unreadable |

**Falsification của probe (reverse-mutation, chạy thật):** `run_mutations.mjs` → M1 (đảo guard
no-ctx về adopt-unconditionally): **exit 2, 7 FAIL** (SA1-a/SA1-b/SA1-l/SA1-m) — đúng lớp lỗi gốc;
M2/M3 (SA-2/SA-3) cũng RED; chạy lại file thật → **GREEN**. Raw: `evidence_mut_M1.txt` v.v.

**Chính xác semantics (không overclaim):** "old entries vẫn decrypt" được tôi kiểm theo nghĩa
**khóa không đổi ⇒ mọi ciphertext K1 còn đọc được** (case S1b: storage log cũ nằm nguyên trong storage
và decrypt đúng). Với hình dạng file **có** `log`, log được **thay** theo đúng semantics import (dữ liệu
file thắng) — đó là hành vi import, không phải mất khóa. Case "ctx entry chỉ ở vị trí sau, mã hóa bằng
key file" → **adopt** là **đúng chủ đích S12** (§2 bảng semantics: "proof OK với bất kỳ entry ctx nào"),
tôi xác nhận hành vi khớp tài liệu.

### SA-2 (followup inheritance) — **CONFIRMED_FIXED** (independent)

**Bằng chứng chính:** `probe_sa123.mjs` section SA-2 (nằm trong 54/54 PASS), drive **REAL export
handler → wipe → REAL import handler**; equality đọc từ **storage sau set**, không phải output sanitize.

| Case | Kiểm chứng | Kết quả |
|---|---|---|
| S2a | REAL export (`get(null)`) với **7/7 followup\* key mang giá trị đặc trưng** (prompt có tiếng Việt + emoji, 3 prompts, 3 chips, rotateIdx 7, idle 45 000, cooldown 300 000) | envelope đúng `{app, schemaVersion:2, exportedAt, data}`; **cả 7 key nguyên giá trị trong file export** |
| S2b | wipe storage → import chính file export đó qua handler thật | **7/7 key bằng đúng giá trị trong storage**; log entry + key round-trip decrypt đúng; không message sai |
| S2c | clamps qua handler thật vào storage: prompts 13 mục (mục 1 dài 700) / chips 40 + id 100 ký tự / rotateIdx 1e9 / idleMs 1e308 / cooldownMs −5 / prompt 5 000 / `followupEnabled:'true'` | prompts→**10**, item→**600**, chips→**32**, id 100 ký tự **bị drop**, rotateIdx→**100000**, idleMs→**3 600 000**, cooldownMs→**0**, prompt→**4 000**; `followupEnabled` không-boolean bị drop (merge giữ giá trị cũ — semantics `set` merge, V4-2 accepted) |
| S2d | *biến thể mới*: file chỉ có followup keys (không log/stats/settings) | **được nhận** (không còn "Not a backup" như pre-fix) |

**Falsification:** M2 (xóa dòng whitelist `followupPrompts`) → **exit 2, 2 FAIL** (SA2-b + SA2-c).
**Bound chủ đích (đã biết):** import cap prompts = 10 trong khi engine nhận 20 — item 11+ bị drop khi
restore (S12 §6 đã ghi). Tôi xác nhận cap này được enforce đúng; **không** tính là bug inheritance.

### SA-3 (bounds + quota) — **CONFIRMED_FIXED**, quota **VERIFIED ở mức browser thật**

**Bounds (unit-level qua handler thật):** trong 54/54 PASS —
`clickCount` 1e308→**1e7**; −3→**0**; 123.9→**123**; `1e999` (Infinity sau parse, raw JSON)→**bị drop,
giá trị cũ giữ nguyên**; `at` matrix: 300k ký tự / ISO+junk 80 / number / null / missing / fraction-7 /
lowercase `t…z` / chuỗi rỗng → **bị drop**, chỉ 3 dạng ISO hợp lệ sống sót (Z, +07:00 offset, fraction 6),
mọi `at` giữ được ≤64 ký tự; log cap **60 hợp lệ → 50**; kind→24, label→60, context→500; ctx hỏng →
fallback `context`; `schemaVersion` bị ép = 2 dù file ghi 99.
**Quota (unit):** set reject khớp `/quota/i` → alert `importQuota`; lỗi set khác → `importBad`;
storage không đổi. **Falsification:** M3 (bỏ clamp clickCount + nới `at`) → **exit 2, 5 FAIL**.

**Quota REAL-BROWSER (nâng cấp vượt "NOT_VERIFIED" của S12 §6):** `probe_quota_browser.mjs` →
**exit 0, 5/5 PASS**, bound `stats.js a47da7aa…` + `stats.html c0cde7ef…`, **không drift trong cửa sổ chạy**
(`drift_quota2.txt` = rỗng). Số đo thật trong Chrome 154:

- `chrome.storage.local.QUOTA_BYTES` = **10 485 760**; seed ballast → `getBytesInUse` = **10 350 424**
  (headroom **135 336 B**, 36 chunks); payload import **338 627 B** (50 log entry ctx ct 4096 + 4×500 stats key).
- Import → set reject thật → alert **"Could not restore the backup: browser storage is full."**
  (so khớp `chrome.i18n.getMessage('importQuota')` đọc trong page; **khác** `importBad`/`importKeyKept`).
- Storage **nguyên vẹn**: marker `clickCount=777` giữ nguyên, không key payload nào được ghi,
  `getBytesInUse` before/after = **10 350 425** (= nhau).
- **Positive controls (chống probe rỗng):** CTL1 — file nhỏ hợp lệ trên storage sạch → import im lặng,
  storage ghi đúng; CTL2 — **chính payload lớn đó** trên storage sạch → import thành công (50 log, clickCount 123456),
  **không** alert quota. ⇒ alert quota đến từ quota thật, không phải lỗi chung.

### OB-1 (consent cards) — **CONFIRMED_FIXED** (+ 1 boundary heuristic ghi ở §5 R-3)

**Bằng chứng 1 — suite của repo:** `node test/e2e.mjs` → **exit 0**, `forbiddenHit: []`,
**`'19'` vắng mặt** trong mọi click (`n19hit:false`), clicked đúng 13 mục như S12, `denyCount 0`,
`dupes []`, `n7count 1`, `n11count 1`, `orderOk/dedupSepOk true`, `statsPage.ok/encCheck.ok/locksProbe true`.

**Bằng chứng 2 — fixture RIÊNG của lane này (biến thể thứ hai trở lên), Chrome thật:**
`probe_ob1.mjs --mode real` → **exit 0**; clicked = `[p1, p2]` (2 positive control), **forbiddenHits: []**,
denyClicks 0, không JS error, content script inject (`data-muse-auto-allow=1`). 8 card âm **không bao giờ**
bị click dù đều chứa "Allow Muse …" + cặp Allow/Deny thật:

| Card | Wording | Kết quả |
|---|---|---|
| c1 | "Allow Muse to use your **camera**" | không click |
| c2 | "Allow Muse to access your **location**?" | không click |
| c3 | "Allow Muse to read your **clipboard** contents" | không click |
| c4 | "Allow Muse to use the **microphone** during calls" | không click |
| c5 | "Allow Muse to **send notifications** about updates?" | không click |
| c6 | twin **lone-allow** của card camera (không Deny cùng container) | không click |
| c9 | viết thường "**allow muse** to use the camera…" | không click |
| c10 | "Allow Muse to perform this action on your **camera**" (approval + permission cùng câu) | không click — rail consent thắng (fail-closed trade-off đúng như S12 §6 ghi) |
| c11 | **BOUNDARY**: "notifi`<b>`cations`</b>`" — từ khóa bị cắt giữa từ bởi markup | **BỊ CLICK** — xem §5 R-3 (không phải regression) |

**Bằng chứng 3 — RED contrast (falsifiability):** cùng fixture, chạy với `content.js` **đã reverse-mutate**
trong scratch (trả `consentOnly` về logic pre-fix: consent-word bị "allow muse" override) → **7/7 card
đáng lẽ lọt đều BỊ CLICK** (c1,c2,c3,c4,c5,c9,c10); c6 (lone) vẫn không → fixture/harness thực sự phát
hiện được lớp lỗi OB-1 (`evidence_probe_ob1_mutated.txt`, mutated content.js sha `d76750e4…`).
Positive control click được trong cả 2 chế độ ⇒ kết quả "không click" **không rỗng**.

**Đối chiếu yêu cầu round:** các biến thể `camera/microphone/location/clipboard/send notifications`,
số nhiều/ít, hoa/thường, và positive control "approval card thật vẫn được click" — **đã chạy đủ**.

### OB-2 (pacing) — **ngoài scope re-attack** (S12 đã ACCEPTED, không phải security invariant). Không đổi.

**Không có finding nào NOT_FIXED / PARTIAL.** Không phát hiện lỗ hổng mới có thể khai thác từ
web page (mọi đường import vẫn user-mediated: file picker + confirm; không `externally_connectable`).

---

## 3. BIẾN THỂ/BÀI TẤN CÔNG MỚI DO LANE NÀY TẠO (tóm tắt outcome)

| # | Bài mới | Outcome |
|---|---|---|
| 1 | SA-1 "key-only file" (mạnh nhất — log cũ K1-encrypted giữ nguyên trong storage) | refused; key giữ; log cũ decrypt được |
| 2 | SA-1 junk-ctx trước + valid-ctx sau (nhiều ctx entry) | adopt đúng (proof any-entry) |
| 3 | SA-1 file tự mâu thuẫn cùng key (K1 claim + ctx K3) | reject toàn bộ |
| 4 | SA-1 ctx bị sanitizer drop (iv sai shape) → "no ctx" | refused, key giữ |
| 5 | SA-1 kept-refusal + quota set-fail | `importQuota` thắng, storage nguyên |
| 6 | SA-1 confirm=cancel | no-op tuyệt đối |
| 7 | SA-1 residual: file tự-đủ trộn entry K1 copy + entry K2 | **vẫn xoay key** — ghi residual §5 R-1 |
| 8 | SA-2 followup-only file | được nhận (pre-fix: "Not a backup") |
| 9 | SA-2 clamp matrix qua handler thật vào storage | 8/8 clamp đúng |
| 10 | SA-3 `1e999` raw-JSON Infinity | drop, giá trị cũ giữ |
| 11 | SA-3 `at` matrix 11 dạng (gồm lowercase `t/z`, fraction-7, non-string) | chỉ 3 dạng ISO hợp lệ sống |
| 12 | SA-3 quota **browser thật** + 2 positive control | importQuota, storage nguyên, control pass |
| 13 | OB-1 8 card consent-variant + 2 positive control + 1 boundary (Chrome thật) | 8/8 chặn; boundary c11 bị click → R-3 |
| 14 | OB-1 RED contrast bằng mutated content.js | 7/7 red-hit (harness không rỗng) |

---

## 4. SUITES — KẾT QUẢ NGUYÊN VĂN (2 cửa sổ)

**Window A (đầu cửa sổ, trước drift popup/stats.html):** cả 4 exit 0 —

1. `node scripts/lint.mjs` → **exit 0** — `lint OK — 24 checks across 18 files (syntax, JSON, i18n parity, no remote code, minimal permissions)` (`evidence_suite_lint.txt`)
2. `node test/e2e.mjs` → **exit 0**, `ok:true`; `forbiddenHit:[]` (gồm `19`), clicked = `[4,11,17,1,2,7,pending5,5,3,surface,6,reviewbar,18]`, `missing/extra/dupes []`, `denyCount 0`, `n7count 1`, `n11count 1`, `statsCheck/encCheck/statsPage/locksProbe true` (`evidence_suite_e2e.txt`)
3. `node test/followup-e2e.mjs` → **exit 0**, `ok:true`, **74/74 checks PASS**, `verifyTimeouts: []` (`evidence_suite_followup.txt`)
4. `node test/import-security.mjs` (harness S12) → **exit 0**, **29/29 PASS** (`evidence_suite_importsec.txt`)

**Window B (rebind — tree đã có popup/stats.html mới của lane experience-fix; locales drift GIỮA cửa sổ):**
cả 4 lại exit 0 — lint 24/18; e2e `ok:true` + `forbiddenHit:[]` + `19` vắng + `statsPage.ok` (cap
"Day · Last 14 days") + `encCheck.ok`; followup **74/74**, `verifyTimeouts:[]`, z-checks
("deny was never clicked…") có mặt; import-security **29/29** (`evidence_rebind_*.txt`).
**Không cần flake retry lần nào** (mỗi suite xanh ngay lần chạy; e2e + followup chạy 2 lần độc lập, cả 2 xanh).
Lưu ý binding: window B chạy trong lúc **locales đang được ghi** → các check phụ thuộc locale
(lint i18n parity, followup preflight) **REBIND_REQUIRED** tại final revision.

---

## 5. RESIDUAL RISK (trung thực — không tô hồng)

- **R-1 (SA-1, by-design limit — mức INFO/LOW):** "proof" của cơ chế mới là **tính tự-đủ nội bộ**
  (key giải mã được ít nhất 1 entry ctx của file), **không phải authenticity**. File crafted **tự-đủ**
  (attacker biết K2 và tự mã hóa 1 entry bằng K2 — kể cả trộn entry K1 copy từ backup cũ) **vẫn xoay
  được key** (case S1p đo thật). Đánh giá: (a) khớp đúng đề xuất remediation của audit §4.3 ("chứng minh
  decrypt với entry ctx bất kỳ") — không phải deviation; (b) hình tấn công **tối thiểu** (không crypto
  gì) đã bị chặn; (c) lợi ích còn lại của attacker (đọc entry TƯƠNG LAI nếu sau này có thêm quyền đọc
  profile/backup) nằm trong boundary Chain D đã accepted; (d) không thể phân biệt "restore hợp lệ" và
  "file tự-đủ do attacker tạo" nếu không có signing — muốn chặn hẳn phải đổi mô hình (ví dụ backup có
  chữ ký/hash do user giữ). **Khuyến nghị:** ghi nhận trong release verdict; owner quyết định có muốn
  hardening riêng (ngoài scope lane này).
- **R-2 (SA-2, chủ đích):** import cap `followupPrompts` = 10 < engine max 20 → restore mất item 11+
  (đã ghi S12 §6). Enforce đúng; chỉ là UX/lossy-restore note.
- **R-3 (OB-1, heuristic boundary — mức INFO):** từ khóa quyền bị **cắt giữa từ bằng markup**
  ("notifi`<b>`cations") **thoát cả `CONSENT_ONLY_RE` lẫn `PERMISSION_CARD_RE`** → card bị click
  (đo thật, card c11). Đây là **boundary của mọi regex trên text**, không phải regression: code pre-fix
  cũng click card này (và click cả 8 card thường), còn DOM do attacker kiểm soát vốn đã tự do render
  card "giống approval" bất kỳ (arms-race Chain A đã accepted). Hệ quả: câu "KHÔNG BAO GIỜ được click"
  trong S12 §2 nên được đọc kèm điều kiện **"với wording mà regex đọc được"**; với consent card thật
  của Muse (wording bình thường) hard-block giữ vững 8/8. Trade-off ngược lại (fail-closed): card
  approval THẬT có nhắc camera/microphone/location/clipboard/notifications sẽ **không bao giờ** được
  auto-click (c10) — người dùng click tay; đúng như S12 §6 tuyên bố.
- **R-4 (import merge semantics, V4-2 accepted):** `set(clean)` merge — key không có trong file giữ
  giá trị cũ (đo thật ở S2c: `followupEnabled` bị drop → giữ `false` cũ). Là semantics đã accepted từ
  V4-2, không phải lỗi mới; người restore cần biết file không "xoá trắng" storage.
- **R-5 (quota test):** dùng ballast tổng hợp (~10.35 MB) chứ không phải profile user "gần đầy" tự
  nhiên — cùng cơ chế quota thật của `chrome.storage.local` (10 MB), nên kết luận "quota path đúng
  message + atomic reject" là hợp lệ; nhưng đây là kịch bản dàn dựng, ghi rõ.
- **R-6:** 2 message mới (`importQuota`, `importKeyKept`) runtime-verify **chỉ với locale mặc định (en)**
  (browser probe đọc `chrome.i18n.getMessage`). 5 locale còn lại mới có parity key (lint) — chưa render thật.

---

## 6. NOT_VERIFIED / LIMITATIONS (những gì lane này CHƯA chứng minh)

1. **Popup-UI-driven SA-2 round-trip** (click chips/custom/rotation trên popup) — chưa chạy vì
   `popup.js/popup.html` đang bị lane experience-fix sửa liên tục (drift đo được); round-trip hiện tại
   dùng giá trị storage-level (đúng thứ popup ghi) + **REAL export/import handlers**. Popup-UI path =
   **REBIND_REQUIRED**.
2. **Rebind tại final revision** cho mọi thứ phụ thuộc `popup.js` / `popup.html` / `stats.html` /
   `_locales` (đang drift): e2e statsPage check, followup-e2e popup smoke + preflight, lint i18n parity,
   quota probe (drive stats.html). Danh sách lệnh: §7.
3. **OB-1 wording ngoài phạm vi đã test:** non-ASCII/ngôn ngữ khác, text trong shadow DOM/iframe con,
   canvas-rendered text, và **cắt từ giữa từ** (đã đo — R-3). Không thử DOM-clobbering.
4. **Non-en locale runtime render** của 2 message mới (R-6).
5. Không re-chạy toàn bộ probe P3–P6 của audit gốc (ngoài scope S13; S12 đã có bằng chứng riêng).
6. `stats.js`/`content.js` verdicts bind `a47da7aa…`/`b34546db…` — nếu final revision đổi 2 file này,
   toàn bộ §2 phải được re-derive (không thể suy diễn từ hash cũ).

---

## 7. FINAL-REVISION REBIND CHECKLIST (cho release verdict)

> Chạy khi lane experience-fix **đã dừng ghi** (git status chỉ còn thay đổi dự kiến). Mọi bước fail →
> không được claim PASS cho tới khi điều tra xong.

```bash
cd "C:/00. AI Project/muse-auto-allow"
SCRATCH="$LOCALAPPDATA/hermes/cache/scratch/maa_s13"

# 1) FREEZE + hash toàn bộ cây; xác nhận 2 file frozen của S12 khớp nguyên trạng:
find extension test scripts -type f | sort | xargs sha256sum > "$SCRATCH/final_revision_hashes.txt"
sha256sum extension/stats.js extension/content.js
#   PHẢI là:  stats.js   a47da7aa8b7b83c13a073eaede9c97ef73dd9a992d859eab03e3eaea3aa53543
#             content.js b34546db45aa7da722ebd9ba740547674a800e363eca210f6027a9ddca34b44c
#   Nếu KHÁC → §2 SA-1..3/OB-1 invalid, chạy lại bước 3 + regenerate mutation copies trước khi verdict.

# 2) Suites (kỳ vọng: exit 0 cả 4; e2e phải có forbiddenHit [] và '19' vắng; followup 74/74; importsec 29/29)
node scripts/lint.mjs
node test/e2e.mjs
node test/followup-e2e.mjs
node test/import-security.mjs

# 3) Re-run probe độc lập (bind hash mới — probe tự in sha256 của file nó nạp):
node "$SCRATCH/probe_sa123.mjs" extension/stats.js          # kỳ vọng exit 0, 54/54
node "$SCRATCH/probe_quota_browser.mjs"                     # kỳ vọng exit 0, 5/5 (drive stats.html HIỆN TẠI)
node "$SCRATCH/probe_ob1.mjs" --ext "C:/00. AI Project/muse-auto-allow/extension" --mode real
#   kỳ vọng: forbiddenHits [], clicked [p1,p2]; boundaryHits [c11] là residual đã biết (R-3)
#   (RED contrast, chỉ khi cần chứng minh lại độ nhạy: regenerate ext-mutated-ob1 từ content.js MỚI rồi chạy --mode mutated)

# 4) Nếu CHỈ popup*/stats.html/locales đổi (stats.js/content.js nguyên): bước 3 (sa123, ob1) vẫn giá trị
#    nhưng PHẢI chạy lại lint + e2e + followup-e2e + quota probe; ghi hash mới vào verdict.
# 5) So khớp artifact zip: node scripts/smoke-zip.mjs / python scripts/verify-zip.py (theo RELEASE_INTEGRITY.md).
```

**Kỳ vọng hash đã thấy tại thời điểm re-attack này** (để so drift): popup.js `884a2ddf…`,
popup.html `d4b31024…`, stats.html `c0cde7ef…`, en/messages.json `8014784b…`, vi `534eef2e…`
(6 locale đang drift — coi như revision mới, rebind bắt buộc).

---

## 8. EVIDENCE POINTERS (raw, ngoài repo)

Scratch: `%LOCALAPPDATA%\hermes\cache\scratch\maa_s13\`

- Probe scripts + hash: `probe_sa123.mjs` (`c6f5cdf2…`), `probe_quota_browser.mjs` (`87e651d5…`),
  `probe_ob1.mjs` (`8893197a…`), `run_mutations.mjs` (`dbacd611…`), `ob1-fixture.html` (`67b8f334…`);
  `probe_hashes.txt`.
- SA-1/2/3 outputs: `evidence_probe_sa123_real.txt`, `evidence_rebind_probe_sa123.txt`;
  mutation: `evidence_mutations_summary.txt`, `evidence_mut_M1/M2/M3.txt` + `mut_M1/M2/M3.js`.
- Quota browser: `evidence_probe_quota_browser.txt`, `evidence_rebind_quota_browser.txt`.
- OB-1: `evidence_probe_ob1_real.txt`, `evidence_probe_ob1_mutated.txt`,
  `evidence_rebind_ob1_boundary.txt`, `ext-mutated-ob1/` (content.js `d76750e4…`).
- Suites: `evidence_suite_{lint,e2e,followup,importsec}.txt` (window A),
  `evidence_rebind_{lint,e2e,followup,importsec}.txt` (window B).
- Hash/drift: `hashes_before_suites.txt`, `hashes_after_suites.txt`, `hashes_before_rebind.txt`,
  `hashes_after_rebind.txt`, `hashes_before_quota2.txt`, `hashes_after_quota2.txt`, `drift_quota2.txt`,
  `final_hashes.txt`, `final_hashes_late.txt`.

---

## 9. TÓM TẮT VERDICT (cho coordinator)

| Finding | Verdict | Evidence class | Ghi chú |
|---|---|---|---|
| SA-1 | **CONFIRMED_FIXED** | Independent vm-probe (real handler, real WebCrypto) + reverse-mutation RED | Residual R-1 (self-consistent file vẫn xoay được key — by-design, ghi rõ) |
| SA-2 | **CONFIRMED_FIXED** | Independent round-trip qua REAL export+import + mutation RED | Bound chủ đích prompts=10 (R-2); popup-UI path REBIND |
| SA-3 | **CONFIRMED_FIXED** | Independent bounds + **REAL-browser quota (nâng cấp từ NOT_VERIFIED)** | 2 positive control; atomic reject đo thật |
| OB-1 | **CONFIRMED_FIXED** | Repo e2e (`19` vắng) + fixture riêng 8 biến thể Chrome thật + mutated RED contrast | Boundary c11 (cắt từ giữa từ) = R-3 residual đã đo |
| OB-2 | ngoài scope (accepted) | — | không phải security invariant |

**Không có NOT_FIXED / PARTIAL.** Các mục **REBIND_REQUIRED** tại final revision: mọi check phụ thuộc
`popup.js`, `popup.html`, `stats.html`, `_locales/*` (§6-2, §7). `stats.js` + `content.js` giữ nguyên
hash suốt cửa sổ → verdict SA-1..SA-3/OB-1 ổn định cho tới khi 2 file này đổi.
