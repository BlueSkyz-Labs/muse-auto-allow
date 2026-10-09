# SECURITY AUDIT DRAFT — Muse Auto-Allow v1.7.0-dev

> **Tài liệu này là DRAFT đang tiến hành (incremental) theo lane AUDIT của Security & Paid round.**
> Nó **KHÔNG phải verdict**. Findings ở đây mới là "evidence-qualified draft" — chưa qua remediation,
> chưa re-attack độc lập, chưa rebind tại revision v1.7.0 freeze.
> Lane: SECURITY AUDIT (phase 1, READ-ONLY — không fix, không sửa file nào khác ngoài file này).
> SGPS pack: `docs/SGPS_SECURITY_PAID_v1.6_ROUND_PROMPT.md` (S0–S15) + `docs/SECURITY_PAID_GO_LIVE_ROUND.md`.

---

## 0. TRẠNG THÁI TÀI LIỆU

| Mục | Giá trị |
|---|---|
| Trạng thái | **AUDIT DRAFT — nội dung đã đầy đủ theo S3/S4/S5/S6/S7 evidence-qualified; chưa phải verdict** (mọi nội dung bám 2b12a7f; REBIND bắt buộc tại freeze v1.7.0) |
| OBSERVED_AT | 2026-10-09 ~22:13 +07 (15:13Z) |
| Frozen revision (mọi line citation) | `2b12a7f2e68891f11d7db104e3884b4826656a30` — "feat(v1.7.0 W1): premium popup pass — 10 findings fixed" (2026-10-09 18:40:53 +07) |
| Cách đọc file | Mọi file-level analysis dùng bản ĐÓNG BĂNG qua `git show 2b12a7f:<path>` (bản working tree có thể đang bị lane khác sửa) |
| Prior evidence | `docs/REDTEAM_REPORT.md` (v1/v2), `docs/REDTEAM_V3.md`, `docs/REDTEAM_V4.md` = **PRIOR EVIDENCE ONLY** — không tự động "đóng" (S15-S04: old SHA không close new HEAD); phải re-attack tại revision này |

---

## 1. LIVE TRUTH SNAPSHOT

### 1.1 Repo / revision

- Repo: `C:/00. AI Project/muse-auto-allow` — nhánh `main`, 1 worktree duy nhất.
- HEAD: `2b12a7f2e68891f11d7db104e3884b4826656a30` (v1.7.0-dev; CHANGELOG ghi v1.7.0 W1).
- Đây là extension Chrome MV3 "Muse Auto-Allow": tự động click nút phê duyệt khiêm hạ trên `muse.ai` theo ủy quyền của người dùng (delegated approval), zero backend, zero deps.

### 1.2 sha256 các file được review (bản đóng băng @2b12a7f)

```
extension/content.js                          61a666394aab2225210d55078b6170ab0c6bcacf187050b3cc8e7ed3c0855a48
extension/background.js                       84c0564ea0b47bc64361e45a789f7b12d25eae3a56987bd9f3727882e4b09ab5
extension/manifest.json                       6ff6fac7d3c84b8491a5e6b18fc7764dba5ade06254b25e8bfb60b58da7fbd7f
extension/popup.js                            6d4acc20d66a7dec4c330930b3a6b3943b047c03531f6d557149a2f101c7a2d3
extension/popup.html                          d06374907ebbbe3f1fab683bcc7a79bc72c03629c337ff26d6719c97ae62afa7
extension/stats.js                            54afd515e2e81776d14cd263be6e2e685bc4fc75ef0db6317c54372dc6a42cdd
extension/stats.html                          e840f6dd4ed478cb674e7df3b855d58b6ceed9096c97da6449b21f14d5a10c94
extension/_locales/en/messages.json           ae3b48f626be4bd92ec8f5fb47f8deed7ef5cd6a584bb95dc159caec987507e9
extension/_locales/vi/messages.json           0e13a2fdf769e164bc45b2f64f1dc533610eb4fa15d81117cbbd60cf64719af0
extension/_locales/zh_CN/messages.json        4527f4e7b86a5ab4114f71eb1f8752e207844340c051479c60a46eac09bd0bbd
extension/_locales/ja/messages.json           fc5054a451956c14cc7c392b6f785c95c5740f6238c48728a57c9bb82b49a216
extension/_locales/ko/messages.json           d3488f34d669b7adb70c873bf9fd8e36442858bf7a8852bf9376d08a733988c5
extension/_locales/es/messages.json           9913c12d88b8df1ee686e2dfa5bbc8eee197127ee378d0bee3d2412bdc049b79
scripts/build.mjs                             68ac4d5f4155cb78b480ea20ca15aefca4137fed793c967894e8498eb9cc0673
scripts/lint.mjs                              03188e78178d90a04b17f7298713e2fcd68006f6e5fecb74e82b336ac321ffda
scripts/verify-zip.py                         84f753e5db88a01ee52e7769e4fd88fb2f4cfa70cc039111a41bd5db5b831660
test/e2e.mjs                                  fe2fb28069547a15c1feb08cdc5b62f353f090539ca585afa03bcfabe0b496c7
test/fixture.html                             c4d0009c58b52b7d52b6a06424f913faf8f7f5e5279d7bc60f309ed11e934e7d
test/followup-e2e.mjs                         b0926ea5bbb0cfa7164bbde36a705b40634ae5356ddb670cb6adda07644aa603
test/followup-fixture.html                    e67ef14f9ccb83c5433c00251cf2995df1f65658cf582a98b691cae425cd83dd
```

(Files referenced but not exhaustively listed above — icons, assets, store docs — are outside the security-relevant surface; hash extraction log giữ trong scratch `maa_sec_audit`.)

### 1.3 Lane movement / REBIND_REQUIRED

- Tại OBSERVED_AT (22:13), working tree có thay đổi chưa commit từ lane presentation: `extension/stats.js`, `stats.html`, assets, scripts + `store/*.png`. **Mọi phân tích trong tài liệu này bám bản đóng băng 2b12a7f.**
- **Diễn biến lane trong lúc audit** (quan sát qua mtime/hash, không suy đoán): lane v1.7.0 W2 (rotation/quick-prompt UI) đã và đang ghi vào working tree: `popup.html` 22:26:57, `stats.html` 22:27:15, `stats.js` 22:21:52, `popup.js` 22:30:13, **`content.js` 22:32:44** (hash đổi 61a66639… → b788574d… — đúng thay đổi rotation send-path đã báo trước, NGOÀI scope audit này), `_locales/*.json` (6 file) — đang bổ sung key mới (`followupQuick*`, `followupRotate*`, `followupCombineHint`, `followupLibrary`, `followupPreview`).
- ⇒ **REBIND_REQUIRED khi freeze v1.7.0**: (a) toàn bộ findings/probes ở đây phải chạy lại trên bản freeze (nhất là content.js mới + popup/stats/locales mới); (b) mọi kết luận runtime thực hiện trên working tree trong cửa sổ này đều không thay thế được việc rebind; (c) một lần chạy `followup-e2e` trên working tree ngày 22:28 bị lane ghi đè giữa chừng → **đã hủy bỏ (invalid), không dùng làm bằng chứng** (xem E-09); (d) lane W2 sau đó (~22:39) cũng đã sửa `test/followup-e2e.mjs` (+292/−31 dòng — mở rộng coverage cho send-path mới) → **suite này cũng REBIND_REQUIRED**; các lần chạy frozen-bound của audit dùng blob 2b12a7f nên không bị ảnh hưởng.

### 1.3b Điều kiện chạy lại (đã tuân thủ)

- Các suite **không** chạy trên working tree đang bị lane ghi khi đã phát hiện va chạm; thay vào đó chạy trên **bản sao đóng băng** của revision 2b12a7f (scratch replica `maa_sec_audit/frozen_run/` — extension + test y nguyên từ git blob) → kết quả bind chính xác vào HEAD 2b12a7f, không phụ thuộc lane.
- `test/**` không bị sửa bởi audit này.

### 1.4 Phạm vi & phương pháp (vắn tắt)

- S3: 9 chuỗi tấn công A–I theo yêu cầu round (map đủ trường SGPS).
- S4 appsec: XSS sinks, CSP, import sanitizer re-attack, crypto at-rest, storage RMW/TOCTOU, quyền/manifest.
- S5 agentic: đây chính là công cụ agentic (`LOWER-TRUST INPUT (page DOM) → DECISION → TOOL CALL (click/type) → REAL EFFECT (approval được duyệt)`).
- S6 supply chain: zero deps — kiểm chứng bằng bằng chứng (no package.json/node_modules/remote code), build từ repo scripts, artifact zip.
- Probes: script trong Hermes scratch (`…/cache/scratch/maa_sec_audit/probes/`), Chrome scratch profile qua CDP nếu chạy browser; không đụng profile người dùng.
- Evidence classes (S7): `CONFIRMED | STRONGLY_SUPPORTED | HYPOTHESIS | SCANNER_SIGNAL | NOT_VERIFIED`.

---

## 2. S2 — THREAT MODEL REGEN (draft, bám v1.7.0-dev)

So với threat model v1–v3 (v1.2.0), các surface authority MỚI: **Path E** (review bar → panel), **auto follow-up** (send authority!), **backup import/restore**, **AES-GCM at-rest**, **stats dashboard**, **fingerprint dedup xuyên path**. → `THREAT_MODEL_REGEN_REQUIRED = TRUE` (đã regen; bảng dưới).

| ASSET | ENTRY | ATTACKER CONTROL | TRUST BOUNDARY | AUTHORITY CHANGE | EFFECT | DETECTION | RECOVERY |
|---|---|---|---|---|---|---|---|
| Quyền click phê duyệt | DOM muse.ai (all_frames) | page content (kể cả frame) | DOM (lower-trust) → heuristics → click | Click Allow thay user | Approval được cấp (hoặc click nhầm UI) | Rails + click log (encrypted) | Toggle OFF; xem log; Muse-side revoke |
| Quyền gửi (follow-up) | composer + status DOM | page content (trigger); settings (text) | settings(prompt) + DOM(trigger) → type/submit | Gửi message nhân danh user | Message gửi vào chat; máy chạy tiếp | verify composer + caps + log | Tắt followup; cooldown 10m/6h cap |
| Dữ liệu at-rest (log/context) | chrome.storage.local + file backup | profile access / crafted file (user-mediated) | disk/file → extension | Đọc/ghi/xoay key, log | Đọc context / phá dữ liệu | AES-GCM; sanitizer | Restore backup; xoá storage |
| Kênh phát hành | CWS account / thư mục unpacked | publisher compromise | pipeline → browser | Toàn quyền extension | Click/type/read bất kỳ trong scope | CWS review; lint; zip hash | Cài lại từ nguồn sạch |
| Rate/resource | DOM flood / file import lớn | page / file | caps + quota | (không đổi quyền) | CPU/storage burn | Caps; quota | Xoá storage |
| Nâng cấp phiên bản | update | (reliability) | migrations | (không) | Mất dữ liệu nếu lỗi | migrate() + inheritance | Byte backup |
| Multi-frame | iframe trong muse.ai | page frames | all_frames → nhiều instance | Nhân số click/caps | Amplified nhưng bounded | Caps per-frame | — (accepted F4) |

---

## 3. S3 — ATTACK CHAINS (A–I)

> Tất cả chain dưới đây bind vào revision `2b12a7f` (frozen). Trạng thái field SAFE PROOF ghi rõ probe nào đã chạy thật (E-xx). `FINANCIAL IMPACT = không` cho MỌI chain (sản phẩm không có đường tiền — §5).

### Chain A — Page-content trickery vs auto-clicker

- **TARGET_ASSET:** Quyền click tự động (click authority) của extension trên DOM muse.ai.
- **ATTACKER_OBJECTIVE:** Lừa extension click vào nút KHÔNG phải phê duyệt (destructive/consent/navigation/form-submit), hoặc điều khiển extension như click-bot vào UI của chính trang.
- **CONTROLLED_SURFACE:** DOM của trang (text, cấu trúc, visibility, attribute) trên một origin khớp `muse.ai`/`*.muse.ai` (kể cả trong iframe — `all_frames:true`).
- **PRECONDITIONS:** User đã cài extension, toggle ON (mặc định ON). Attacker kiểm soát DOM trên một origin muse.ai (giả định trang/1 frame bị chiếm, hoặc nội dung do bên thứ ba render trong frame cùng host).
- **EDGE EVIDENCE:** `e2e.mjs` frozen exit 0: `forbiddenHit []` cho anchor (8), consent-notifications (9), consent+permission (10), split-container (12), disabled deny (13), opacity:0 (14), form (16), 'Delete everything' (surface2), 'Open and delete all' (surface3), lone Allow, 'plain-review'. P6: deny `aria-disabled` / `display:none` không click; lone không click; `role="button"` span ĐƯỢC click (positive control đúng thiết kế); rate cap 30/30 dừng; dedup 5s xuyên path (n7/n11 = 1). Đối chiếu code: mọi quyết định click nằm sau chuỗi rail (pair-cùng-container + deny clickable + không anchor/form + consent + destructive + visibility + dedup + cooldown + cap).
- **TRUST BOUNDARY:** DOM (lower-trust input) → heuristics (trusted code) → click.
- **AUTHORITY CHANGE:** Click thay user trong tab muse.ai (đỉnh: cấp approval thật).
- **BLAST RADIUS:** Trong phạm vi tab/frame muse.ai; mỗi frame là một instance rails riêng (F4 accepted — nhân số capped per-frame).
- **CUSTOMER IMPACT:** Worst-case đã kiểm chứng = click vào nút thoả ALL rail (đúng định nghĩa approval card theo thiết kế); các lớp "click nhầm" đã bị chặn bởi probe.
- **SAFE PROOF:** E-09 (suite), E-10 (P6).
- **COMPENSATING CONTROL:** never-Deny; pair-cùng-container + deny phải clickable; skip anchor/form; consent filter; destructive filter; dedup fingerprint; rate caps; liveness guard; audit log.
- **REMEDIATION:** Không phát hiện cần fix tại revision này cho các lớp đã test. Đề xuất cân nhắc trong remediation lane: siết `APPROVAL_CONTEXT_RE` (biên 'allow muse' — xem E-10), và cân nhắc cap per-extension nếu Muse ship approval trong iframe.
- **ALTERNATE BYPASS:** Đã thử & fail-closed: path-dependent fingerprint (F1 fixed, e2e n11), anchor (8), form (16), hidden/disabled deny (13,14,P6), text obfuscation (homoglyph/zero-width → không match regex → skip = fail-closed). CHƯA quét hết: CSS trùng stack, node bị reuse kiểu lạ (race class — xem Chain I).
- **RESIDUAL RISK:** LOW — heuristic lọc là arms-race; bounded bởi cap + rails; các residual R8–R11 lineage giữ nguyên.

### Chain B — Approval-text XSS (log → popup/stats; import path)

- **TARGET_ASSET:** DOM privileged của extension pages (`popup.html`, `stats.html` — có chrome.* APIs).
- **ATTACKER_OBJECTIVE:** Chạy script trong extension context (đọc/xoay key at-rest, đổi settings, exfil log, điều khiển follow-up).
- **CONTROLLED_SURFACE:** Chuỗi vào log entry: `label`, `context` (từ approval text DOM), `kind`, `at`; và qua import file crafted.
- **PRECONDITIONS:** Chèn được chuỗi độc vào một entry log (card text trên muse.ai hoặc import crafted) + user mở popup/stats.
- **EDGE EVIDENCE:** E-07 — chạy `esc()/renderLog()` + `renderChart()/renderTopics()` **nguyên văn** với payload `<img onerror>`, `<svg onload>`, `"><script>`, entity/quote breakout; **real-parser (Python)** xác nhận: chỉ còn `div/span/b/i` + SVG vô hại, **0 `on*` handler / 0 dangerous tag / 0 javascript: URL**. E-09: statsPage/encCheck render đúng trong browser thật. Static: không inline handler, CSP `script-src 'self'`.
- **TRUST BOUNDARY:** page text / file (untrusted) → storage → render sink.
- **AUTHORITY CHANGE:** Nếu XSS: toàn quyền extension context.
- **BLAST RADIUS:** popup/stats pages + storage + (gián tiếp) chỉ dẫn được content script qua settings.
- **CUSTOMER IMPACT:** Nếu thành công: lộ log + key; hiện tại: **không tìm thấy đường** với coverage đã test.
- **SAFE PROOF:** E-07 (frozen blobs).
- **COMPENSATING CONTROL:** `esc()` mọi interpolation (kể cả attribute); stats strip `[<>&]` + quote escape; số hoá `num()`; filter email năm `\d{4}`; CSP; lint gate chặn primitive mạng/remote code.
- **REMEDIATION:** Không. Giữ lint rule cho sink mới (W2 đang thêm UI mới → rebind + re-audit sink mới khi freeze).
- **ALTERNATE BYPASS:** Double-encoding, entity trong attribute, SVG context — đã cover; **DOM-clobbering qua innerHTML** — lý thuyết không áp dụng được vì esc() chặn tạo element từ data (HYPOTHESIS-safe; chưa probe clobbering chuyên sâu).
- **RESIDUAL RISK:** LOW (evidence CONFIRMED cho core sinks; clobbering = NOT_VERIFIED).

### Chain C — Crafted backup import

- **TARGET_ASSET:** Toàn bộ `chrome.storage.local` state (settings, log, stats, `cryptKeyRaw`).
- **ATTACKER_OBJECTIVE:** (a) đổi cấu hình/tham số; (b) phá log/stats; (c) xoay khóa at-rest sang khóa kẻ tấn công biết; (d) phình storage.
- **CONTROLLED_SURFACE:** File backup người dùng chọn trong stats page (import handler).
- **PRECONDITIONS:** Attacker đưa được file cho user + user tự chọn file + xác nhận `confirm`. Không thể kích hoạt từ web page (không `externally_connectable`; file picker cần user gesture).
- **EDGE EVIDENCE:** E-06 — 27 case crafted: type-confusion/Infinity/negative/proto/bucket caps/value clamps/khóa-shape bị chặn đúng; **SA-1 (LOW) bypass xác nhận**: key lạ + first entry không ctx → đổi key không cần proof; SA-2 followup fields bị drop; SA-3 clickCount 1e308 + `at` 300k ký tự sống sót + message quota sai.
- **TRUST BOUNDARY:** file (untrusted) → sanitize/validate → storage.
- **AUTHORITY CHANGE:** settings + key at-rest; (không mở thêm quyền click ngoài rails — minDelay/enabled đều validate).
- **BLAST RADIUS:** Dữ liệu extension cục bộ; hành vi click vẫn trong rails.
- **CUSTOMER IMPACT:** Import file độc → mất log cũ (undecryptable), entry mới mã hóa bằng khóa attacker chọn; mất cấu hình followup khi restore; dữ liệu cồng kềnh.
- **SAFE PROOF:** E-06.
- **COMPENSATING CONTROL:** Typed whitelist + caps; decrypt-proof có điều kiện; confirm dialog; user-gesture-only.
- **REMEDIATION (đề xuất cho lane S12 — KHÔNG thực hiện trong audit này):** (1) nếu file có `cryptKeyRaw` khác key hiện tại → BẮT BUỘC chứng minh decrypt với entry ctx đầu tiên CÓ ctx (hoặc entry ctx bất kỳ trong file); nếu không có entry ctx nào → chỉ nhận key khi file cũng chứa ít nhất 1 entry… hoặc từ chối xoay key khi thiếu proof; (2) validate `at` là ISO string + cap độ dài (ví dụ ≤64); (3) cap `clickCount` (ví dụ ≤1e7 vẫn thừa); (4) thêm `followup*` vào whitelist (validate: boolean/string≤600/numbers), hoặc xác nhận chủ đích bỏ; (5) message riêng cho quota rejection.
- **ALTERNATE BYPASS:** Garbage ctx → bị decrypt-proof chặn (đã test); không-ctx-first + key → BYPASS (SA-1); entries hợp lệ + key thật = restore hợp lệ.
- **RESIDUAL RISK:** LOW (user-in-the-loop, không remote-triggerable; các bypass đã định vị chính xác).

### Chain D — Local storage tampering (extension khác / user / malware profile)

- **TARGET_ASSET:** `chrome.storage.local` (log, stats, settings, khóa at-rest).
- **ATTACKER_OBJECTIVE:** Đọc/sửa dữ liệu extension; đổi hành vi (enabled/minDelay).
- **CONTROLLED_SURFACE:** Profile Chrome trên đĩa (LevelDB) hoặc devtools của user.
- **PRECONDITIONS:** Đã có quyền ghi vào profile (malware local quyền user / user tự sửa). Extension khác KHÔNG truy cập được storage của extension này (Chrome isolation — không có API cross-extension storage).
- **EDGE EVIDENCE:** E-06 (sanitize consumers chịu shape lạ), E-08 (mọi khóa hỏng → degrade an toàn, không throw), phân tích: consumers coerce/filter (flush `Number()`, popup filter junk, stats guards). Crypto comment trong code nói rõ: key nằm cùng profile → at-rest chỉ chống "casual inspection".
- **TRUST BOUNDARY:** OS user boundary → profile storage. Kẻ trong boundary này được coi là đã thắng một phần.
- **AUTHORITY CHANGE:** Đổi settings (trong rails), xoay/xoá key (⇒ log undecryptable), đọc log nếu có key.
- **BLAST RADIUS:** Cục bộ máy user; không lan sang tài khoản khác.
- **CUSTOMER IMPACT:** Nếu máy đã bị chiếm: đọc được context đã log (có key cùng chỗ); đổi toggle.
- **SAFE PROOF:** E-06, E-08 (degradation); KHÔNG chạy mô phỏng malware-profile (không an toàn/không cần thiết).
- **COMPENSATING CONTROL:** AES-GCM at-rest (chống đọc casual), sanitize/filter ở consumers, local-only (không exfil path).
- **REMEDIATION:** Chấp nhận (accepted class R10-lineage; đã disclaimer trong code).
- **ALTERNATE BYPASS:** Không áp dụng (attacker trong boundary); plaintext fallback khi crypto lỗi là chủ ý "never lose the record".
- **RESIDUAL RISK:** ACCEPTED (threat model tuyên bố rõ giới hạn at-rest).

### Chain E — Compromised update channel (unpacked dir / CWS)

- **TARGET_ASSET:** Kênh phát hành extension (CWS published build; thư mục unpacked trên máy user).
- **ATTACKER_OBJECTIVE:** Đẩy code độc vào extension → thừa hưởng toàn bộ authority (click/type trên muse.ai + storage).
- **CONTROLLED_SURFACE:** CWS account / pipeline local / thư mục unpacked (user tự cập nhật).
- **PRECONDITIONS:** Chiếm CWS account (hoặc quyền ghi thư mục unpacked = đã có quyền máy — cùng lớp Chain D).
- **EDGE EVIDENCE:** E-02 (zero deps — không có npm supply chain để đầu độc), E-01 (lint gate: không remote code; build = repo scripts), `verify-zip.py` byte-verify (thiết kế có sẵn; chạy khi freeze), không CI/CD trong scope.
- **TRUST BOUNDARY:** Release pipeline → browser user. Không có signing/provenance ngoài CWS-default; unpacked install = user chấp nhận nguồn.
- **AUTHORITY CHANGE:** Toàn quyền extension (trong scope host muse.ai + storage).
- **BLAST RADIUS:** Mọi user cài từ nguồn bị compromise (CWS) hoặc máy user đó (unpacked).
- **CUSTOMER IMPACT:** Rất lớn nhưng thuộc lớp chuẩn của mọi extension; giảm bởi scope hẹp (host muse.ai) + không exfil primitive trong code hiện tại.
- **SAFE PROOF:** KHÔNG chạy (không thể/không an toàn) — đây là phân tích + kiểm kê kiểm soát.
- **COMPENSATING CONTROL:** CWS review; code tối thiểu; lint gate; zip byte-verify; repo local (không external CI token để đánh cắp).
- **REMEDIATION (owner TODO):** Bật/siết 2FA CWS; quy trình verify zip hash trước upload (PUBLISH_RUNBOOK); chỉ cài unpacked từ nguồn tin cậy; cân nhắc reproducible build ghi chú.
- **ALTERNATE BYPASS:** NOT_TESTED (ngoài scope).
- **RESIDUAL RISK:** Chuẩn ngành; accepted nhưng phải ghi trong verdict (S6).

### Chain F — Delegated-approval impersonation (CORE RISK)

- **TARGET_ASSET:** Quyền phê duyệt hành động của Muse Agent nhân danh user.
- **ATTACKER_OBJECTIVE:** Để extension tự-phê duyệt các request do kẻ tấn công tạo/điều khiển (account/session Muse bị chiếm, hoặc kẻ có khả năng queue request trong account user).
- **CONTROLLED_SURFACE:** Hàng đợi approval phía Muse (server) + UI approval hiển thị cho extension click.
- **PRECONDITIONS:** Muse account/session của user bị compromise (hoặc attacker tạo được approval card hợp lệ trong account) + extension bật (mặc định ON) + tab mở.
- **EDGE EVIDENCE:** Rails bind tại runtime (E-09: chỉ click pair hợp lệ, không Deny, cap 30/phút, dedup, log). Extension **không thể** phân biệt request chính chủ vs giả — đó là bản chất auto-allow (accepted R8–R11 lineage; R11 = đúng chain này).
- **TRUST BOUNDARY:** Muse account identity → extension authority. Model: user uỷ quyền cho extension "duyệt khi thấy approval card" — bất kỳ ai tạo được card trong account đều được hưởng uỷ quyền đó.
- **AUTHORITY CHANGE:** Approval được cấp mà không có human review (by design).
- **BLAST RADIUS:** Toàn bộ approval queue trong account khi extension bật; giới hạn bởi Muse-side scopes + rails (chỉ Allow đúng UI; không tự tạo request; cap 30/phút).
- **CUSTOMER IMPACT:** Account compromise + auto-allow = các approval độc hại được duyệt tự động (ví dụ card mẫu: "…on your GitHub account"). Mitigation = user kiểm soát (toggle/log) + khuyến nghị tắt khi unattended.
- **SAFE PROOF:** Không mô phỏng account compromise; rails đã chứng minh bind (E-09/E-10); phân tích dựa code frozen.
- **COMPENSATING CONTROL:** Toggle rõ ràng (default ON nhưng hiển thị popup); audit log (context + at, encrypted at rest, cap 50) để user review; rate cap; không bao giờ Deny (giảm thiệt hại ngược).
- **REMEDIATION (owner decision):** (1) cân nhắc first-run consent giải thích default-ON; (2) nhấn mạnh khuyến nghị toggle OFF khi unattended trong listing/privacy (đã có R11); (3) defense-in-depth phía Muse (session security) nằm ngoài tầm extension.
- **ALTERNATE BYPASS:** Page-content trickery (Chain A) là đường khác để click; rails chặn.
- **RESIDUAL RISK:** ACCEPTED nhưng **phải xuất hiện trong verdict của round** (đây là core product risk, owner đã accept R8–R11).

### Chain G — Follow-up send-authority misuse

- **TARGET_ASSET:** Quyền gửi prompt vào chat Muse nhân danh user (send authority).
- **ATTACKER_OBJECTIVE:** (a) điều khiển nội dung gửi; (b) ép gửi sai thời điểm/spam; (c) gửi khi user không muốn.
- **CONTROLLED_SURFACE:** Trạng thái DOM (text 'Connected'/busy, spinner), composer, send button; settings followup* (chỉ user đặt từ popup).
- **PRECONDITIONS:** `followupEnabled=true` (opt-in, mặc định OFF); trang hiển thị trạng thái được nhận là idle.
- **EDGE EVIDENCE:** E-09 followup-e2e 34/34 (frozen): không gửi khi working; idle-wait; prompt CHÍNH XÁC từ settings; React-safe input; verify composer-emptied mới tính sent; cooldown + cap; **approval-present → không gửi (absolute priority)**; composer có draft → không gửi + giữ draft; manual send qua guard. Code: text gửi **chỉ từ storage** (`followup.prompt`), page DOM không điều khiển được nội dung; idle detection fail-closed ('unknown'/busy → không gửi).
- **TRUST BOUNDARY:** DOM (trigger, lower-trust) + settings (text, user) → type/submit action.
- **AUTHORITY CHANGE:** Gửi message nhân danh user vào chat (nội dung do user chọn).
- **BLAST RADIUS:** Tab hiện tại; cap 6 lần/giờ/tab + cooldown 10 phút; **N tab = N budget riêng** (per-tab, không per-extension — quan sát, không phải defect).
- **CUSTOMER IMPACT:** Nếu idle bị nhận nhầm: prompt thừa (noise/cost nhẹ); nội dung không bao giờ do attacker kiểm soát; caps giới hạn.
- **SAFE PROOF:** E-09 (all rails), code reading cho nguồn text.
- **COMPENSATING CONTROL:** opt-in default OFF; caps; verify; approval-priority; composer-empty; no-blind-composer (fail-closed).
- **REMEDIATION:** Không fix tại revision này. **BẮT BUỘC re-audit tại freeze v1.7.0**: lane W2 đang thêm rotation send-path vào content.js (ngoài scope audit này) — mở rộng send surface phải được audit riêng (REBIND).
- **ALTERNATE BYPASS:** Page giả 'Connected' để trigger (chỉ trong origin muse.ai/ harness localhost; bounded bởi caps; nội dung vẫn không đổi được).
- **RESIDUAL RISK:** LOW–MED (bounded); phụ thuộc rebind cho W2.

### Chain H — Rate-cap / resource abuse

- **TARGET_ASSET:** Tài nguyên máy user (CPU/battery) + ngân sách hành vi (click/aux budget) + storage quota.
- **ATTACKER_OBJECTIVE:** Ép extension hoạt động liên tục (click/log) hoặc phình storage gây quota/render chậm.
- **CONTROLLED_SURFACE:** DOM (render nhiều 'card' hợp lệ), file import lớn, storage shapes.
- **PRECONDITIONS:** Page render được nhiều card hợp lệ theo rails; hoặc user import file lớn/crafted.
- **EDGE EVIDENCE:** E-10: 40 card đủ điều kiện → **đúng 30 click rồi dừng** (cap 30/phút; 10 card còn lại bị chặn trong cùng cửa sổ; deny 0). E-06: caps trong sanitize (50 log, 500 keys/bucket, clamp 1e9); SA-3: `at` không cap (300k ký tự), clickCount không trần; quota vượt → alert message sai. Static: aux cap 30/phút; dedup 5s; cooldown text 30s; queue 60; log 50; pruning buckets.
- **TRUST BOUNDARY:** page/file → budget & quota.
- **AUTHORITY CHANGE:** Không (resource only).
- **BLAST RADIUS:** Trong tab/extension; multi-frame nhân per-frame (F4 accepted) — cần chú ý nếu Muse ship iframe approvals.
- **CUSTOMER IMPACT:** CPU nhẹ; log noise; quota edge → import thất bại với message misleading (UX).
- **SAFE PROOF:** E-10, E-06.
- **COMPENSATING CONTROL:** Các cap trên; liveness guard; storage headroom lớn (v4: worst-case log ~22KB vs ≥5MB quota).
- **REMEDIATION (S12 đề xuất):** SA-3 fixes (cap clickCount, cap `at`, message quota chính xác); cân nhắc per-extension (không chỉ per-frame) budget nếu cần.
- **ALTERNATE BYPASS:** Iframe multiplication (F4); file lớn → parse/JS stall (self-DoS, có confirm).
- **RESIDUAL RISK:** LOW.

### Chain I — Fail-open vs fail-closed under odd DOM (reliability adversary)

- **TARGET_ASSET:** Tính đúng đắn của quyết định click/send dưới DOM bất thường (lỗi, thay đổi giữa check→click, DOM khổng lồ, node tan biến).
- **ATTACKER_OBJECTIVE (reliability class):** Làm extension click nhầm (fail-open) hoặc tê liệt (fail-closed quá mức) — hoặc lợi dụng khoảng TOCTOU giữa lúc kiểm tra và click.
- **CONTROLLED_SURFACE:** DOM động (MutationObserver), node detach/replace race, lỗi layout/getComputedStyle.
- **PRECONDITIONS:** Page biến động mạnh/nút bị thay thế đúng thời điểm.
- **EDGE EVIDENCE (đọc code frozen + một phần runtime):** Quyết định authority đều fail-closed: sweep chỉ click sau khi pass rails; `approvalPresent()` catch → **true** (chặn send); `detectMuseState` lỗi → 'unknown' (không send); `findComposer` không blind fallback; flush/getKey/encryptCtx có catch → không throw (encrypt fail → giữ plaintext = không mất record — fail-open *có chủ đích* cho confidentiality, đổi lấy toàn vẹn log). TOCTOU: `btn.click()` trên đúng node reference (đã check) — node bị detach trước click ⇒ click trên detached node (no-op với document) ⇒ không click nhầm node khác; re-render race đã có dedup fingerprint + WeakSet (e2e n7/n11). `isVisible` catch → `true` (fail-open nhỏ: lỗi computed-style coi như visible — vẫn còn các rail khác; ghi nhận). DOM khổng lồ: statusViaTitle bound 4000 node; các scan khác chạy theo cadence (1s) nên tự giới hạn tần suất.
- **TRUST BOUNDARY:** DOM → decision state machine.
- **AUTHORITY CHANGE:** Không (đúng/sai của quyết định).
- **BLAST RADIUS:** Hành vi click/send trong tab.
- **CUSTOMER IMPACT:** Nếu fail-open: click thừa (rails giảm nhẹ); nếu fail-closed quá đà: bỏ lỡ approval (không nguy hiểm, chỉ bất tiện).
- **SAFE PROOF:** KHÔNG chạy fault-injection chuyên sâu (NOT_VERIFIED một phần — ví dụ getComputedStyle throw, node detach đúng lúc). Đã đối chiếu code + e2e late-card/re-render cases.
- **COMPENSATING CONTROL:** fail-closed ở authority; fail-open có kiểm soát ở confidentiality; dedup; WeakSet.
- **REMEDIATION (cân nhắc):** đổi `isVisible` catch → `false` (siết hơn) — nhưng cần cân bằng với môi trường xấu; ghi thành đề xuất, không blocking.
- **ALTERNATE BYPASS:** NOT_FULLY_TESTED (fault injection).
- **RESIDUAL RISK:** LOW; phần chưa chứng minh ghi rõ NOT_VERIFIED.

### RAILS LIST — extension KHÔNG THỂ click / KHÔNG THỂ gửi (frozen 2b12a7f)

Không bao giờ click: nút Deny/Reject/Decline (không tồn tại đường click deny); "Allow" đơn lẻ (không có deny cùng container + clickable); nút ngoài `muse.ai` host scope; phần tử không phải button/[role=button]; disabled/aria-disabled; không visible (size/visibility/display/pointer-events/opacity); trong `<a>` hoặc gắn `<form>`; pair consent-only (notifications/newsletter/subscribe/cookies/marketing/alerts/reminders/tips không kèm approval wording); nút surface chứa động từ destructive; Review button không nằm trong ngữ cảnh "task needs review"; vượt dedup 5s; vượt rate cap 30/phút (allow) và 30/phút (aux); sau khi extension context invalidated (liveness).

Không bao giờ gửi (follow-up): khi disabled (opt-in OFF mặc định); khi có approval surface; khi chưa idle liên tục ≥ idleMs; trong cooldown; quá 6 lần/giờ/tab; khi composer có text; khi không xác định được composer/send; khi verify thất bại (còn text lại → dừng tới khi được clear).

---

## 4. FINDINGS (evidence-qualified) — tại frozen 2b12a7f

### 4.1 Findings MỚI của audit này (draft)

| ID | Sev | Evidence class | Lớp | Tóm tắt | file:line (frozen) |
|---|---|---|---|---|---|
| SA-1 | LOW | CONFIRMED (probe E-06) | Import — key rotation | Import file crafted có `cryptKeyRaw` + entry đầu **không có `ctx`** → thay khóa at-rest **không cần chứng minh decrypt** (`decOk` chỉ chạy khi entry đầu có ctx). Hệ quả: log cũ thành '(unable to decrypt)'; entry mới mã hóa bằng khóa kẻ tạo file chọn. Điều kiện: user tự import + confirm. | stats.js:244-245 (frozen) |
| SA-2 | LOW | CONFIRMED (probe E-06) | Import — inheritance | `sanitizeBackup` thiếu `followupEnabled/followupPrompt/followupIdleMs/followupCooldownMs` trong whitelist, trong khi export ghi TẤT CẢ key (`get(null)`) → backup round-trip **mất cấu hình Auto follow-up** (silent). | stats.js:175-209 vs stats.js:220 |
| SA-3 | LOW (cosmetic/robustness) | CONFIRMED (probe E-06) | Import — dataset bounds | `clickCount` không trần (1e308 lưu được, hiển thị '1e+308'); `at` không cap (300k ký tự sống sót) → file crafted phình log/quota; khi set vượt quota → alert sai ngữ nghĩa ("Not a Muse Auto-Allow backup file."). | stats.js:179, :181, :249-255 |
| OB-1 | INFO (heuristic boundary) | CONFIRMED (probe E-10) | Click heuristics | Card text kiểu "Allow Muse to send notifications…" thoả `APPROVAL_CONTEXT_RE` ('allow muse') nên **override consent filter** → auto-click. Đúng thiết kế F5 hiện tại; cần biết khi Muse đổi wording. | content.js:50-51, :156 |
| OB-2 | INFO (functional) | CONFIRMED (probe E-10) | Pacing | minDelay 300ms nhưng nhịp click thực tế ~1s khi page không mutate DOM (nhịp do heartbeat 1s; reschedule chỉ cho sweep bị chặn). Không ảnh hưởng cap (cap theo cửa sổ thời gian). | content.js:777-810 |

Chưa có finding nào ≥ MED tại revision này. **Không có P0/P1 mới.** (Đây là draft; re-attack độc lập theo S12 sẽ đến sau ở lane riêng.)

### 4.2 Prior evidence rebind (V4 x 2b12a7f) — KHÔNG dùng old SHA để đóng new HEAD

| Prior finding (v4, d7084da) | Trạng thái tại 2b12a7f (re-verified lần này) | Bằng chứng |
|---|---|---|
| V4-1 import không validate (MED) | **ĐÃ CÓ sanitizer** — type-confusion/Infinity/negative/proto/bucket-cap/value-clamp/khóa-shape đều bị chặn; còn residual SA-1..SA-3 (LOW) | E-06 |
| V4-2 merge semantics + cross-context race | **STILL PRESENT, ACCEPTED** (code không đổi: `set(clean)` merge; import ngoài Web Lock của content script) | đọc code stats.js:249; chưa re-probe browser |
| V4-3 popup log crash với entry null | **FIXED** — filter `e && typeof e === 'object'`; P4 với entry `null` không throw | popup.js:184; E-07 |
| V4-4 key cache invalidation | **FIXED + re-verified động** — trước event dùng cache, sau event dùng key mới | E-08 (cacheInvalidation) |
| V4-5 first-install key race | **FIXED + re-verified động** — adopt khóa thắng | E-08 (raceAdoption) |
| V4-6 e2e thiếu coverage crypto/import | **FIXED** — `encCheck` tồn tại và PASS (schemaVersion 2, ctx, no plaintext, key 44, round-trip) | E-09 |
| V4-7 lock-holder stall | **STILL ACCEPTED** (không đổi; lý thuyết) | đọc code |
| V4-8 localTime non-string | **FIXED cho thiếu/non-parse** (`!iso`→''; NaN→''); số thuần (12345) vẫn render theo Date — chỉ tới được bằng tamper tay; ghi INFO | popup.js:173-180; E-07 |

### 4.3 Ghi chú remediation input (cho lane S12, không fix trong audit này)

1. SA-1: bắt buộc decrypt-proof với entry ctx đầu tiên CÓ ctx khi file có key khác khóa hiện tại (hoặc từ chối xoay key khi thiếu bằng chứng).
2. SA-2: thêm `followup*` vào whitelist sanitizer (có validate) — hoặc xác nhận chủ đích bỏ & ghi docs.
3. SA-3: cap `clickCount`; cap độ dài `at`; message quota riêng.
4. OB-1: cân nhắc thắt `APPROVAL_CONTEXT_RE` (ví dụ yêu cầu 'perform this action' hoặc 'allow muse to <verb hành động>'; loại trừ khi có consent-word mạnh như notifications/newsletter trừ khi câu chứa 'perform this action').
5. OB-2: (tùy chọn) self-reschedule sau click thành công để đạt đúng minDelay.
6. Chain I: cân nhắc `isVisible` catch → `false`.
7. **Bắt buộc**: recapture/rebind toàn bộ tại freeze v1.7.0 (content.js rotation + popup/stats/locales mới) — audit W2 send-path mới như surface mở rộng của Chain G.

---

## 5. S9–S11 — TIỀN / PAID: **NOT_APPLICABLE** (evidence-backed)

**Trạng thái: NOT_APPLICABLE — sản phẩm tại revision này không có bất kỳ "đường tiền" nào.**

Bằng chứng (grep trên TOÀN BỘ code tại bản đóng băng `extension/`, `scripts/`, `test/` cho các từ khoá `webhook|ledger|entitle|payment|stripe|payos|checkout|billing|subscri|licen[cs]e|purchase|monetiz`):

- 0 match liên quan tiền. Hai match duy nhất là từ "subscribe" nằm trong danh sách consent-word của regex chống-click-nhầm (content.js:23,50) — không phải payment.
- Manifest chỉ khai `permissions: ["storage","alarms"]`; host chỉ muse.ai; không có network primitive nào (E-01, E-03).
- Không tồn tại provider / webhook / entitlement / ledger / order / price / refund / settlement trong code.

⇒ S9 (money model), S10 (core money invariants), S11 (webhook/concurrency/failure injection) = **NOT_APPLICABLE**. Không được "sáng tạo" một mô hình paid để lấp chỗ trống.
⇒ Paid-path readiness = **NOT_VERIFIED** (không có gì để verify). Nếu tương lai chủ sản phẩm mở monetization (Pro tier/licensing), S9–S11 trở thành **design gate bắt buộc** trước mọi build có đường tiền: canonical authority theo từng state, replay/dedup/idempotency, sandbox/prod isolation, negative tests (charter: docs/SECURITY_PAID_GO_LIVE_ROUND.md).
⇒ Trục verdict tối đa cho round này: **security assurance cho free go-live (+ CONDITIONAL items)** — `PAID_GO` KHÔNG claimable khi paid surface = N/A (đúng S14/S15 rail).

---

## 6. SUITES (e2e) — ĐÃ CHẠY (frozen-bound)

- `test/e2e.mjs` và `test/followup-e2e.mjs` chạy trên **bản sao đóng băng 2b12a7f** (scratch replica) — **cả hai exit 0**; chi tiết đầy đủ tại E-09. Không có suite nào khác trong repo.
- Một lần chạy `followup-e2e` trên working tree (22:28) bị lane ghi giữa chừng → discarded (ghi rõ trong E-09).
- Lưu ý: đây là bằng chứng cho **negative rails + hành vi runtime tại 2b12a7f**; tại freeze v1.7.0 phải chạy lại (REBIND).

---

## 7. EVIDENCE LOG (running) — các probe đã THỰC THI

> Nguyên tắc: chỉ ghi những gì đã chạy thật; mọi mục ghi rõ revision/hash nguồn.

### E-01 — Lint gate trên bản ĐÓNG BĂNG (supply chain / remote code)

- Cách chạy: copy frozen tree ra scratch (`maa_sec_audit/frozen_lint/`), chạy `node scripts/lint.mjs`.
- Kết quả (nguyên văn): `lint OK — 24 checks across 13 files (syntax, JSON, i18n parity, no remote code, minimal permissions)` — exit 0.
- Ý nghĩa: lint này tự nó KHÔNG phải "secure" (S15-S01: scanner green ≠ secure) — nhưng là bằng chứng cơ học rằng tại 2b12a7f: cú pháp hợp lệ, i18n parity 6 locale, KHÔNG có `eval`/`new Function`/`fetch`/`XMLHttpRequest`/`WebSocket`/`importScripts`, không remote `<script src>`, `alert()` chỉ nằm ở popup/stats, permissions tối thiểu, host pin muse.ai, CSP explicit.

### E-02 — Supply chain: zero dependency (CONFIRMED)

- `find` toàn repo (trừ `.git`): **không có** `package.json`, `node_modules`, `package-lock.json`, `yarn.lock`. Zero deps ⇒ zero transitive exposure của npm ecosystem.
- Build/lint/test bằng node scripts thuần repo (`scripts/*.mjs`, `test/*.mjs`); không có CI/CD trong scope (repo local). Artifact = `dist/muse-auto-allow-v1.6.0.zip` (working tree; hash sẽ bind khi freeze v1.7.0). Lưu ý: manifest tại HEAD ghi `"version": "1.6.0"` trong khi commit là v1.7.0-dev W1 → version stamp sẽ phải rebind tại freeze (REBIND_REQUIRED).
- Xem thêm E-01 (remote-code = 0). `CVE EXISTS != REACHABLE` không cần áp dụng vì không có dependency nào để CVE.

### E-03 — Sink inventory (innerHTML) trên bản đóng băng

6 sink `innerHTML` (đã grep toàn bộ extension/):
| # | Vị trí (frozen) | Nội dung chèn | Đánh giá sơ bộ |
|---|---|---|---|
| 1 | popup.js:47 (`buildFollowupSelect`) | chuỗi PRESETS hardcoded + `esc()` | an toàn (hằng số) |
| 2 | popup.js:187 (`renderLog`) | entry log (đã decrypt) + esc() mọi interpolation | cần re-attack (P4) |
| 3 | popup.js:242 (`renderMini`) | số liệu + nhãn ngày (Date) + esc() | an toàn (numeric) |
| 4 | stats.js:94 (`renderChart`) | số liệu + label năm (filter `\d{4}`) + `num()` | cần re-attack (P4) |
| 5 | stats.js:101 | hằng số i18n | an toàn |
| 6 | stats.js:105 (`renderTopics`) | key `byTopic` (string) — replace `"` → `&quot;`, strip `[<>&]` | cần re-attack (P4) |

- Không có `outerHTML`, `insertAdjacentHTML`, `document.write`, không inline `on*=` handler trong HTML, không remote script.

### E-04 — Manifest / permissions / CSP (bản đóng băng)

- MV3; `minimum_chrome_version: 116`; `permissions: ["storage","alarms"]`; `host_permissions: ["https://muse.ai/*","https://*.muse.ai/*"]`; CSP `script-src 'self'; object-src 'self';` (bằng đúng sàn MV3 — không nới); KHÔNG `web_accessible_resources`; KHÔNG `externally_connectable`; content script `all_frames: true` trên muse.ai (đã accepted F4 từ v2 — ngoại lệ đã biết, xem chain A/E).

### E-05 — alert()

- `alert()` chỉ tồn tại trong import handler của stats.js (4 call — các nhánh báo lỗi import). Lint rule giới hạn alert ở popup/stats — đúng thiết kế.

→ Đã hoàn tất toàn bộ: **E-06** (P3 import), **E-07** (P4 XSS), **E-08** (P5 crypto), **E-09** (suites), **E-10** (P6 runtime rails).

### E-06 — P3: Import sanitizer RE-ATTACK (frozen stats.js, 27 crafted cases)

- Probe: `maa_sec_audit/probes/p3_import_reattack.mjs` — chạy **nguyên văn** `sanitizeBackup` + `testBackupKey` trích từ blob đóng băng (`stats.js` sha `54afd515…`), WebCrypto thật, file crafted. Output: `p3_output.json`.
- ✅ Chặn tốt (so với V4-1): type-confusion (`enabled:"false"` → bị bỏ), `Infinity` (JSON `1e999`) → bị bỏ, âm → 0, `minDelayMs` clamp 0..10000, bucket value clamp ≤1e9 + bỏ NaN/âm/không, cap 500 key/bucket, cap 50 log, `__proto__` không pollute (own keys chỉ còn `legit`), mọi shape `cryptKeyRaw` sai (độ dài/padding/ký tự url-safe) đều bị từ chối; iv/ct regex lọc đúng; `schemaVersion` luôn bị ép = 2; key lạ ngoài whitelist bị bỏ.
- ⚠️ **SA-1 (LOW) — key-swap không cần chứng minh decrypt**: `stats.js:245` chỉ kiểm tra decrypt khi entry đầu tiên CÓ `ctx`. File crafted `{cryptKeyRaw:<key lạ>, log:[{at, context:"…"}]}` (entry đầu **không** có `ctx`) → `decOk=true` → **thay khóa at-rest mà không cần bằng chứng** (probe: `key-noctx-first-entry` → BYPASS=true). Hệ quả: entry cũ thành '(unable to decrypt)'; entry mới mã hóa bằng khóa do kẻ tạo file chọn. Điều kiện: user tự tay chọn file + confirm — không thể từ web page.
- ⚠️ **SA-2 (LOW) — backup/restore bỏ rơi cấu hình follow-up**: whitelist `sanitizeBackup` không có `followupEnabled/followupPrompt/followupIdleMs/followupCooldownMs` trong khi export dùng `get(null)` (stats.js:220) → backup CÓ chứa các key này nhưng import **luôn bỏ**. Probe `followup-only` → file hợp lệ bị báo "Not a backup"; `followup-with-valid` → follow-up fields dropped. Hệ quả: restore không khôi phục được Auto follow-up (silent; hướng fail-safe nhưng phá kỳ vọng "replaced" và mất cấu hình người dùng).
- ⚠️ **SA-3 (LOW, cosmetic/robustness)**: `clickCount` không có trần trên — `1e308` được nhận và lưu (probe), hiển thị '1e+308'; `at` trong log entry **không bị cap độ dài** (300.000 ký tự sống sót, probe) → file crafted có thể phình log/quota; khi `set` vượt quota, alert hiện thông điệp sai ("Not a Muse Auto-Allow backup file.").

### E-07 — P4: XSS sink re-attack bằng real code + real parser

- Probe: `p4_xss_render.mjs` — chạy nguyên văn `esc()/renderLog()` (popup.js) + `series()/renderChart()/renderTopics()` (stats.js); payloads: `<img onerror>`, `<svg onload>`, `"><script>`, `'"><svg …>`, entity/quote breakout, chuỗi dài; **validate bằng Python html.parser** (spec-faithful): tất cả 7 output chỉ chứa tag vô hại (`div/span/b/i`, SVG `rect/text/title/line/defs/linearGradient/stop`), **0 `on*` handler, 0 dangerous tag (script/img/svg/iframe/style/…), 0 javascript: URL**. Payload xuất hiện dưới dạng entity-encoded text/attribute vô hại.
- Kết luận: các sink `innerHTML` tại 2b12a7f an toàn trước payload kiểm tra, kể cả với nội dung **đã decrypt** (mô phỏng qua decCtx stub trả plaintext độc hại) và nội dung **import crafted**. (Lưu ý: bind với blob đóng băng; stats.js đang được lane presentation sửa → REBIND khi freeze.)

### E-08 — P5: Crypto at-rest probes (frozen content.js + popup.js)

- Probe: `p5_crypto.mjs` (WebCrypto thật + chrome.storage stub). Kết quả (p5_output.json):
  - Key: AES-GCM 256-bit (raw 32B) lưu dạng base64 44 ký tự; usages encrypt/decrypt.
  - Round-trip chính xác với unicode (tiếng Việt/Nhật/emoji); iv 12 bytes (16 b64 chars).
  - **IV uniqueness: 2000/2000** (không tái sử dụng IV với khóa per-install).
  - Cross-module: ciphertext do content.js mã hóa → popup `decCtx` giải mã chính xác.
  - **Cache invalidation (V4-4 fix) hoạt động**: trước sự kiện `onChanged` còn dùng khóa cache (đúng cơ chế), sau sự kiện dùng khóa mới.
  - **Race adoption (V4-5 fix) hoạt động**: khi tab khác ghi đè khóa trong lúc generate, tab này đọc lại và **adopt khóa thắng**; ciphertext giải mã được bằng khóa thắng.
  - Degradation: 11/12 shape khóa hỏng → getKey/encryptCtx trả null (ghi plaintext, không mất record, không throw); shape base64-44-hợp-lệ vẫn import được (đúng thiết kế — đó là việc của import proof). `crypto.subtle` unavailable → null/null, không throw.

→ Kết quả E-09/E-10 ngay dưới đây.

### E-09 — E2E SUITES (frozen-bound, REAL Chrome) — cả hai PASS

> Cách chạy: replica đóng băng `maa_sec_audit/frozen_run/` (extension + test nguyên bản git blob 2b12a7f), `node test/<suite>.mjs` — scratch Chrome + scratch profile, không đụng profile người dùng; `test/**` không bị sửa.

**e2e.mjs — exit 0, `ok: true`** (nguyên văn JSON lưu tại `probes/e2e_frozen.txt`; file tương ứng `probes/e2e_run1.txt` = bản chạy working-tree lúc content.js còn đúng frozen, cũng exit 0):
- `clicked` = [4,11,17,1,2,7,pending5,5,3,surface,6,reviewbar,18] — đúng expected set; `missing:[], extra:[]`.
- **`forbiddenHit: []`** — toàn bộ never-click list KHÔNG bị chạm: lone allow, 'Allow notifications' (notif), consent+permission (10), split-container (12), disabled deny (13), opacity:0 allow (14), form-bound (16), surface2 'Delete everything', surface3 'Open and delete all', 'plain-review', và anchor (8) không nằm trong expected nhưng cũng không bị click (8 không xuất hiện ở bất kỳ đầu).
- `denyCount: 0` (final snapshot — deny không bao giờ bị click, kể cả click muộn).
- `dupes: []`, `n7count: 1`, `n11count: 1`, `dedupSepOk: true` (dedup fingerprint đúng xuyên path A/B, retry hợp lệ sau 5s được phép), `orderOk: true` (panel/expanded chỉ được duyệt SAU khi mở).
- `statsCheck.ok` (day/topic counters ghi đúng), `encCheck.ok` (schemaVersion 2, entry mới có ctx, KHÔNG plaintext context, key 44 chars, decrypt round-trip), `statsPage.ok` (KPI/bars/topics render), `locksProbe: true` (Web Locks API khả dụng cho serialization), `museAttr: true` (content script inject trên muse.ai thật).

**followup-e2e.mjs — exit 0, `ok: true`, 34/34 checks PASS** (nguyên văn `probes/followup_e2e_frozen.txt`): preflight i18n; popup smoke; (a) không gửi khi 'working'; (b) chỉ gửi sau idle-wait + prompt CHÍNH XÁC được gõ + input event React-safe + composer cleared + lastSentAt; (c) không gửi lần 2 trong cooldown, gửi lại sau cooldown; (d) tắt followup → không gửi; **(e) approval card hiện diện → KHÔNG gửi (absolute priority), xóa card → gửi lại**; (f) manual send-now bỏ idle-wait nhưng vẫn qua guard; (g) composer có draft → không gửi + draft được giữ nguyên; (h) status ping; (z) fixture không có JS error + **deny không bị click**.

**Bản chạy working-tree ngày 22:28 bị loại bỏ:** `followup-e2e` trên working tree exit 2 vì lane W2 đang ghi dở `popup.html` (22:26:57) + `popup.js` (22:30:13) trong lúc chạy — popup.html mới tham chiếu i18n key chưa tồn tại, popup.js chưa cập nhật đồng bộ → 5 checks fail thuộc phần popup UI. **Kết quả này KHÔNG phải lỗi bảo mật của 2b12a7f** (bản frozen pass 34/34); đây là bằng chứng lane-write chồng lấn, được ghi lại trung thực và loại khỏi kết luận.

Ý nghĩa (S15-cẩn trọng): đây là bằng chứng runtime thật cho các negative rail tại 2b12a7f — nhưng suite pass không đồng nghĩa "secure toàn diện" (S15-S01); nó chỉ đóng các invariant mà suite assert.

### E-10 — P6: Runtime rails probe bổ sung (frozen content.js 61a66639…, scratch Chrome)

Probe tự viết (fixture + driver trong scratch; không thuộc test/**), đo 2 nhóm:

**A. Rate cap (40 card đủ điều kiện, chỉ có 30 được click):**
- `allowClicks: 30`, `cappedAt30: true`, `denyTouched: 0`, không JS error. 30 click trải ~29s rồi dừng hẳn (quan sát thêm ≥8s sau click thứ 30 — trong cùng cửa sổ 60s, 10 card còn lại vẫn bị chặn).
- (Method note: nhịp ~1s/click trong fixture này vì fixture không mutate DOM khi click; trong e2e fixture có mutation nên nhịp nhanh hơn — pacing chi tiết không ảnh hưởng cap vì cap là theo cửa sổ thời gian.)

**B. Edge rails (specials fixture):**
- `aria-disabled="true"` trên Deny → **không click** Allow (aria-disabled được tôn trọng ngoài e2e coverage).
- Deny `display:none` → **không click** (deny phải clickable trong cùng container — rail F2 giữ vững với biến thể ẩn).
- Lone allow (không có deny) → **không click**.
- `role="button"` span + Deny button → **CÓ click** (positive control: isBtn(role) hoạt động đúng như thiết kế).
- **Boundary quan sát được (residual, LOW/INFO)**: card text "Allow Muse to send notifications about updates" + cặp Allow/Deny → **BỊ click** — vì `APPROVAL_CONTEXT_RE` coi 'allow muse' là wording phê duyệt nên override consent filter. Đúng như thiết kế hiện tại (F5 chỉ bỏ 'permission'), nhưng là biên heuristic cần ghi nhận: nếu Muse render consent prompt bắt đầu bằng "Allow Muse …" thì nó sẽ bị auto-click (trang do Muse kiểm soát; rủi ro thực tế thấp; đề xuất remediation cân nhắc thêm điều kiện 'perform this action'/có-động-từ-hành-động).
- `errors: []`.

→ 9 attack chains + bảng findings đã hoàn tất tại §2/§3/§4 (phía trên). Mọi mục E-xx thực hiện trong cửa sổ 2026-10-09 22:13–22:36 +07; chi tiết probe + output thô nằm trong Hermes scratch `maa_sec_audit/`.

<!-- FOOTER-MARKER -->

## NEXT ACTION (running list)

1. [x] Đọc đủ frozen content.js / popup.js / stats.js / background.js / manifest.json — bản đồ rail & sink.
2. [x] Re-attack import sanitizer — E-06 (27 cases; SA-1..SA-3).
3. [x] XSS sink audit + probes real-code/real-parser — E-07 (sạch trong coverage).
4. [x] Crypto at-rest probes — E-08 (IV 2000/2000; race fix; cache fix; degradation).
5. [x] Rails re-verify + RAILS LIST — §3 cuối + E-09/E-10.
6. [x] Follow-up rails + ghi chú rotation lane ngoài scope → REBIND.
7. [x] Supply chain — E-01/E-02 (zero deps; lint frozen PASS).
8. [x] Permissions/CSP/manifest — E-04.
9. [x] Chạy e2e suites frozen-bound — E-09 (cả hai exit 0; bản chạy working-tree 22:28 bị hủy vì lane ghi).
10. [x] 9 attack chains A–I đầy đủ field + threat model regen (§2).
11. [x] REBIND notes tại §1.3/§1.3b + §4.
12. [ ] Coordinator: chuyển §4.3 cho lane remediation (S12); lên lịch REBIND + re-attack tại freeze v1.7.0; quyết định owner cho Chain F (first-run consent?) và OB-1.
13. [ ] (Khi freeze) upload/AUDIT lại artifact zip v1.7.0: verify-zip.py + lint + suites + probes P3-P6 với hash mới.

**PHASE STATUS: AUDIT DRAFT — not a verdict; remediation + re-attack + rebind required at the frozen v1.7.0 revision**
