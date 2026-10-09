# Experience Review — Muse Auto-Allow v1.7.0 (SGPS Experience gate, maker ≠ judge)

**Review basis (scope freeze):** repository at commit `f4f058e380d3458f3bd9e5be4695e6e1690ed288` — "chore(release): freeze v1.7.0" (2026-10-10 00:05:02 +07). Working tree clean at review start; HEAD did not move during the review.
**Revision-integrity note:** a parallel lane began writing to the working tree mid-audit (observed ~00:22–00:33 +07: `_locales/*`, `content.js`, `stats.js`, `test/e2e.mjs`, `test/fixture.html`, + new `docs/SECURITY_REMEDIATION.md`, `test/import-security.mjs`). Every hash captured and every file read by this audit was verified against the **f4f058e blobs** (`git show f4f058e:<file> | sha256sum` = captured value for all drifted files), and the runtime harness evidence was **re-executed against a fresh extraction of f4f058e** (`git archive` → scratch tree; content-identical — the export differs only by the repo's CRLF eol setting). No finding below describes the post-freeze drift; the drift is out of scope.
**OBSERVED_AT:** 2026-10-09 17:11Z → 17:45Z (2026-10-10 00:11 → 00:45 +07).
**Reviewer:** independent subagent (W4 lane; maker ≠ judge) · **read-only** — the only file written by this review is this report. No fixes, no git state changes, no Chrome beyond the existing harnesses + scratch profiles.
**Charter note:** `docs/UI_UPGRADE_ROUND.md` names the W4 artifact `docs/EXPERIENCE_AUDIT_V17.md`; the lane task specifies `docs/EXPERIENCE_REVIEW_V17.md` — this file is the deliverable.

**Method (all evidence is measured or code-cited; no vibes):**
1. Re-ran the two shipped runtime harnesses read-only — `node test/followup-e2e.mjs` (exit 0, **74/74**) and `node test/e2e.mjs` (exit 0, 13/13 clicks, 0 forbidden, 0 deny) — plus `node scripts/lint.mjs` (exit 0, 24 checks / 18 files). All three were **re-executed on an extracted f4f058e tree** (see revision-integrity note) with identical results to the in-tree runs.
2. Three scratch CDP probes on the frozen extension in a scratch Chrome profile (never the user's): reflow/zoom geometry, full keyboard traversal, focus-visible, Enter/Space/Escape activation, reduced-motion, computed styles light+dark, empty/disabled/gated states, stats-page reflow.
3. Contrast recomputed in Python from the actual token hexes with alpha compositing (every pair in `docs/BRANDING.md` §3/§3.1 re-derived; new-surface pairs derived from the real CSS).
4. PNG header parse + stdlib pixel decode of every store asset and icon (exact-token-color checks; size/spec checks).
5. Vision (image analysis) on all 6 store assets, plus zoomed crops of screenshot1/3.
6. Source read of popup/stats/content/background/manifest, all 6 locale files, BRANDING/PROMPT_LIBRARY/FOLLOWUP/UI_UPGRADE_ROUND/UX_COPY_REVIEW/SGPS_EXPERIENCE_ADOPTION/LISTING/SHOWCASE/CHANGELOG.

---

## Tóm tắt cho CXO (VI)

- **1 lỗi HIGH duy nhất, có thể sửa bằng 1 dòng CSS:** ở chế độ tối, chip đã-chọn trong Phrase library dùng màu chữ `#0a5ce0` trên nền tối → **2,77:1** (chuẩn AA cần ≥4,5:1) vì rule dark mode của `.chipbtn.on` bị thiếu (`popup.html:172` vs khối dark `:196-199`). Đã đo bằng runtime + tính toán, không phải cảm tính.
- **5 lỗi MED:** (1) Preview không được đọc cho trình đọc màn hình (thiếu `aria-live`); (2) nút "Send now" không phản hồi khi gửi thất bại (lý do bị bỏ qua); (3) trang Statistics tràn ngang ở 320 CSS px (WCAG 1.4.10, thủ phạm là control Day/Week/Month/Year); (4) "Starter rotation" ghi đè danh sách rotation đã lưu mà không hỏi; (5) tài liệu review copy (W3) chỉ phủ 47 key — build hiện có **78 key**, 31 key mới chưa được review có hồ sơ; kèm 5 key chết × 6 locale.
- **F1–F19 (audit v1.4.0): 13 FIXED đầy đủ; 4 PARTIAL (F9/F10/F14/F19); 1 REGRESSED (F17 — ảnh store lại "kéo giãn" log để chụp); 1 NO-ACTION (F15).** Không có finding cũ nào còn nguyên.
- **Bằng chứng runtime xanh:** followup-e2e 74/74, e2e 13/13, lint exit 0; popup đo được **561/590/590 px ≤ 600** mọi trạng thái; sheet cuộn nội bộ, mọi dòng giữ nút ×; bàn phím đi hết mọi control, Enter/Space/Escape/focus-visible/reduced-motion đều đạt.
- **Độ trung thực tài liệu:** các con số BRANDING §3.1 và §3 khớp chính xác khi tính lại; số liệu Statistics (489/14/77/117 + 14 cột) khớp 100% với seed; màu token trong PNG đã chính xác tuyệt đối (F3 đóng).
- **Kết luận:** nền tảng v1.7.0 tốt và bằng chứng thật; nên sửa N1 (bắt buộc, vì vi phạm rule 4 của chính BRANDING) và cân nhắc N2/N3/N4 trước khi phát hành. Danh sách UNVERIFIED ghi rõ phần không thể kiểm (muse.ai live DOM, bản dịch ja/ko/zh/es bởi người bản xứ, QA dark pair của v1.7.0).

---

## Findings — v1.7.0 new surfaces (phrase library · rotation · overflow-fixed sheet · copy ×6 · store assets)

Evidence classes: **MEASURED** (runtime/harness/geometry/contrast computation/pixel decode) · **CODE-CITED** · **VISION** · **DOC-READ** · **UNVERIFIED**.

| ID | Sev | Area | Class | Evidence (file:line / measured value) | Issue | Recommendation |
|---|---|---|---|---|---|---|
| N1 | **HIGH** | A11y (dark mode) | MEASURED | Runtime computed style: selected phrase chip in dark = `color rgb(10,92,224)` on `rgba(0,90,191,.14)` over `#18191a` → **2.77:1** (AA needs 4.5:1 for 11.5px text). Cause: `.chipbtn.on` (`extension/popup.html:172`) is absent from the dark override block (`:196-199`, which covers `.qbtn.on`, `.ftab.on`, `.fcount`, `.froti .src` but not `.chipbtn.on`). Violates the project's own rule (`docs/BRANDING.md:128` rule 4). Light mode is fine (5.12:1, computed). | The primary selected-state affordance of the new phrase library is near-invisible/dim in dark mode — for dark-theme users the "selected" signal degrades to ~2.8:1 dark-blue-on-dark. | Add `.chipbtn.on { background: rgba(10,92,224,.32); border-color: rgba(10,92,224,.50); color: #8ab8ff; }` to the dark block (sibling pattern measures 6.63:1). One-line fix; re-run the dark capture. |
| N2 | MED | A11y (live updates) | CODE-CITED + MEASURED | `extension/popup.js:152-155` rewrites `.fprevtext` on every chip/text change; `extension/popup.html:283,286` have no `aria-live`/role (runtime DOM check: `previewHasAriaLive:false`, `previewRole:null`). The log and status pill DO have `aria-live="polite"` (`popup.html:257,302`). | Screen-reader users never hear the composed prompt — the live Preview is the core feedback of the compose UX (library order, custom append, exact string sent). | `aria-live="polite"` on `#fprevB` (panel) and the in-sheet preview, or one visually-hidden live region announcing the composed string (debounced ~400 ms, matching the write debounce). |
| N3 | MED | UX feedback | CODE-CITED | `extension/popup.js:645-654`: `sendMessage(..., () => { void chrome.runtime.lastError; })` discards the per-tab response; the engine returns `{ok, reason}` with reasons `disabled｜sending｜approval-present｜no-composer｜composer-not-empty｜no-prompt｜type-failed｜attempted｜dead` (`extension/content.js:745-765`; `docs/FOLLOWUP.md:94-97`). Success only surfaces via the 2.5 s poll → "Follow-up sent HH:MM" pill for 15 min (`popup.js:336-339`). | A manual "Send now" that fails (approval card open, composer holding a draft, no composer) is completely silent — indistinguishable from a broken button. `docs/SGPS_EXPERIENCE_ADOPTION.md:18` claims "No silent failure". | Surface the first non-ok reason as a transient inline note next to the button (i18n key needed) or a status-pill variant; at minimum a `title`/toast. |
| N4 | MED | A11y (reflow, WCAG 1.4.10) | MEASURED | Scratch CDP at 320 CSS px: stats page `scrollWidth 475` vs `clientWidth 320` → horizontal scroll. Culprit = `.seg` range control (`extension/stats.html:43-53`): its right edge lands at x=475; buttons 71/79/63 px wide; the `.head` row (`justify-content:space-between`) never wraps. At 640 px (≈200 % zoom on 1280) there is no overflow (measured 640/640). | The Statistics page cannot be used without horizontal panning at 320 CSS px (AA Reflow). | Let `.head` wrap (`flex-wrap: wrap`) and/or shrink `.seg button` padding at narrow widths (media query ≤480 px). |
| N5 | MED | UX (destructive-ish) | CODE-CITED | `extension/popup.js:607-612`: "Starter rotation" sets `fRotItems = STARTER_ROTATION.slice()` and writes it — **replaces** any existing list, no confirm/undo. Docs (`docs/PROMPT_LIBRARY.md:125`, `:174`) say "loads the three recommended combos" — the replacement is not stated. | A user's hand-built rotation can be destroyed with one tap; the button sits next to "Save combo" in the same row. | Confirm when the list is non-empty ("Replace your N saved combos?"), or append+dedupe instead of replace; state the replace behavior in PROMPT_LIBRARY.md. |
| N6 | MED | Copy governance | DOC-READ + MEASURED | `docs/UX_COPY_REVIEW.md:3,15` reviews "all 47 keys × 6 locales" at a v1.6.0 revision; the frozen build has **78 keys × 6 locales** (verified programmatically, parity exact). The 31 new keys (quick combos → rotation + status pill, en keys #48-78) have **no documented copy review**; round gate 5 (`docs/UI_UPGRADE_ROUND.md:60`) is therefore only partially evidenced. Spot-check of the new keys (all 6 locales) found the following **flagged** items (native-uncertain, see UNVERIFIED): ko reintroduces `유휴 상태` in `followupHintIdle`/`followupHintWaiting` after W3 deliberately moved the toggle to `대기 중` for the same concept (`ko/messages.json`); vi compact label `Giãn cách` (`followupCooldownShort`) reintroduces the word W3 removed from the long label for its social-distancing connotation; ja/ko/vi render "Starter rotation" as "starter set" (`スターターセット` / `스타터 세트` / `Bộ khởi đầu`) — the link to the Rotation row is lost. | The copy-review record does not cover the shipped v1.7.0 string set; three concrete tone/consistency risks sit in unreviewed keys. | Extend `UX_COPY_REVIEW.md` to the 31 new keys (values-only pass); have a native reviewer settle the three flagged items (each is a one-value change). |
| N7 | LOW | Hygiene (i18n) | CODE-CITED + MEASURED | 5 keys × 6 locales are referenced nowhere in the extension sources: `yearLabel`, `followupIdleLabel`, `followupCooldownLabel`, `followupConnected`, `followupUnknown` (programmatic check over popup/stats/content/background/manifest). 30 dead values; two of them (`followupConnected`, `followupUnknown`) are remnants of the removed "Status unknown" pill (W1 fix #3). The harness's key checks are one-directional (`followup-e2e.mjs` case 0 checks used→exists, not exists→used). | Dead strings inflate the locale files and the copy-review surface; a future translator may "fix" strings nobody sees. | Remove the 5 keys from all 6 locales (or wire them); optionally add a reverse-usage check to the lint/harness. |
| N8 | LOW | A11y (labels) | CODE-CITED | `extension/popup.js:226` — every rotation-row remove button gets the same generic `aria-label="Remove"` (from `followupRotateRemove`) with no item context; `popup.js:238-239` — the "Next: i/n" button's accessible name is the counter only ("Next: 1/3"); "opens the saved list" lives in `title` only. | In a list of N combos, AT users hear N identical "Remove" buttons and cannot tell which combo each deletes; the list-opener's purpose is not in its name. | `aria-label = Remove: <row text>` (or `aria-describedby` to the row); give the list opener a name like "Next: 1/3 — open saved list" (or `aria-haspopup`). |
| N9 | LOW | UX gap | CODE-CITED | Rotation list is order-sensitive (`docs/PROMPT_LIBRARY.md:160-176`) but the sheet offers only per-row remove (`popup.js:613-619`); no reorder affordance exists and none is claimed. | Reordering requires deleting + re-saving rows (per-group save appends; "Save combo" appends the preview). | Optional: drag or up/down buttons on rows; or document "order = save order" in the popup (title). |
| N10 | LOW | Hygiene (CSS) | MEASURED | Unused custom properties: popup `--on` and `--surface` (defined `popup.html:7-8,16-17`, 0 `var()` uses); stats `--tcb` per-hue bottom stops (`stats.html:94-98`, 0 uses — topic bars are solid `--tc`). | Dead tokens invite drift (BRANDING §3.1 describes per-hue "top/bottom gradient stops" that topics do not actually use). | Delete or use; align BRANDING §3.1 wording with the solid topic bars. |
| N11 | LOW | Render vs reality (store) | CODE-CITED + VISION | `scripts/stats-shot.mjs:185-193` and `scripts/store-shot.mjs:231-233` lift the popup's `max-height:600px` cap and expand the log viewport to its content height for the capture ("screenshot framing"), so screenshot1/3 show a popup **taller than the real popup ever renders** (real popup scrolls the log inside 600 px — `popup.html:27,202-203`). The in-code comment "the real popup keeps its 220px scroll area" is stale (there is no 220px rule in the shipped popup; the constraint is the 600px body). | Store assets over-represent the popup (full log, no scrollbar); no note in BRANDING §5/LISTING §8. Vision confirms the s3 popup runs the full canvas height with a complete log. | Note the framing crop in BRANDING §5 + LISTING §8, or capture at the real 600 px cap with the log clipped; fix the stale comment. |
| N12 | LOW | Store-asset polish | VISION + CODE-CITED | s1 (real capture) log entry 3 reads "Bar-opened approval" (`test/fixture.html:156` — fixture card text; `store-shot.mjs` captures the real fixture log) in a public asset; s4 shows "auto-clicked in 0.2s" while the product's own default inter-click delay is **300 ms** (`manifest` defaults: `minDelayMs 300`, `popup.js:497`). | Fixture jargon in a public screenshot; a performance badge (0.2 s) below the product's own default pacing (0.3 s) is an unnecessary precision claim. | Tidy the s1 log seed (drop the fixture card entry), or reword the s4 badge ("auto-clicked — instantly"/"<1 s"). |
| N13 | MED | Store listing completeness | DOC-READ | `store/LISTING.md` (all 6 detailed descriptions + short descriptions) never mentions the auto follow-up / phrase library / rotation — the v1.7.0 headline feature — while §4 states "Every part of the extension serves this one purpose. It does nothing else" (`LISTING.md:284-292`). The popup ships the second engine visibly (`popup.html:253-301`). The "all four ways" enumeration (`LISTING.md:62-65`) lists 4 surfaces while the engine implements 5 paths A–E (`docs/FOLLOWUP.md:50`). W3 kept follow-up claims out **deliberately** (`UX_COPY_REVIEW.md:66`), so this may be a conscious scope decision — but it is not recorded anywhere as such. | A store reviewer comparing listing vs popup sees an undisclosed second behavior; users cannot discover the feature from the listing. | Owner decision: either disclose the follow-up engine in the listing (recommended — it is user-visible and part of "keeps your agent running") or record the deliberate omission (e.g. in `store/COMPLIANCE_CHECKLIST.md`). Fix "four ways" → five. |
| N14 | LOW | Doc precision | MEASURED | `docs/BRANDING.md:88` claims light chip-ink range "5.10–6.02:1"; recomputed: blue 5.96, rose 6.02, teal 5.28, amber 5.10, **violet 6.72** — the range omits violet's higher value (all ≥4.5, so no a11y impact). | The recorded range is incomplete (understates violet). | Extend to "5.10–6.72:1". |
| N15 | LOW | Record accuracy | MEASURED | v1.4 disposition table (`docs/EXPERIENCE_REVIEW_V14.md:140`) records F18 fixed with "arrow color `#6b7078` (~4.6:1)"; the asset actually uses `#61666d` (`assets/store-screenshot.html:27`) = **5.64:1** (computed). Fix is stronger than recorded; the record is wrong. | The disposition record does not match the shipped asset. | Correct the record when next editing (or leave with this note). |
| N16 | LOW | Store-set consistency | VISION + MEASURED | F9 residual: s1 shows "Clicked **492** / Today 14"; s2/s3/s4 show "**489** / 14". Arithmetic is consistent (seed 489 + 3 live clicks = 492; today 11+3=14) but two totals appear across the set. | A careful viewer sees 492 vs 489 across the set. | Optional: note in SHOWCASE.md ("s1 = 489 + the 3 captured clicks"), or seed 486 so the live capture lands on 489. |
| N17 | INFO | Reflow (popup) | MEASURED | Popup at 320 px: `scrollWidth 320 = clientWidth 320` → no overflow at its design width. Page-zoom ×2 approximation: `scrollWidth 640` vs `clientWidth 308` → overflows (Chrome popups do not respond to page zoom; the body is intentionally fixed at 320 px — `popup.html:27`). "200 % text" has no real user mechanism for a px-typed popup (recorded as UNVERIFIED below). | Informational only — not a defect for a Chrome popup surface. | Keep the 320 px contract; if a future surface is web-hosted, re-test reflow. |

---

## Re-verification of the v1.4.0 findings (F1–F19) at f4f058e

| ID | v1.4 verdict | Now (evidence) | Status |
|---|---|---|---|
| F1 | screenshot3 680×1964 (CWS spec violation) | `store/screenshot3-popup.png` IHDR = **1280×800** (header parse); all 4 screenshots 1280×800, promo 440×280, marquee 1400×560. LISTING §8 claim "all verified 1280×800" is true. | **FIXED** |
| F2 | BRANDING dark-accent claim stale/wrong + unused `#0866ff` | `BRANDING.md:56-59` now derives from live tokens; `#0866ff` occurs nowhere (grep). Recomputed exactly: ink/bg 18.39, muted/bg 8.16, white/blue 6.53 light, 5.80 dark. | **FIXED** |
| F3 | brand blues desaturated at capture; no sRGB chunks | Stdlib pixel decode: **exact** token pixels now present — s2 5,517 px of `#005abf`, s3 2,725, s4 2,651, marquee 2,413; gradient stops exact (r=0) in s2/s3/s4/promo/marquee/icons (icon128 127 px `#0082FB`, 197 px `#0064E0`); the v1.4 shifted color (60,91,184) exists nowhere. Capture scripts carry `--force-color-profile=srgb` (stats-shot.mjs:77, store-shot.mjs/render.mjs per F3 disposition). | **FIXED** |
| F4 | checkbox rendered as native square | `popup.html:47-54` visually-hidden input + `.track`/`.knob` pill switch (38×22, 18 px knob, radius 999, focus ring on the track); vision of s1/s3 shows pill switches. | **FIXED** |
| F5 | delay input had no edit affordance | `.numwrap` pill with border + right-aligned tabular value + `ms` unit inside (`popup.html:58-64`); s1/s3 vision: "300 ms" pill. | **FIXED** |
| F6 | delay input had no accessible name | `<label class="muted" for="delay" …>` (`popup.html:246`). | **FIXED** |
| F7 | segment selection visual-only | `stats.html:142-145` initial `aria-pressed`; `stats.js:182` updates on click. | **FIXED** |
| F8 | log times showed UTC | `popup.js:406-413` `localTime`/`localFull` (local getHours, full local on hover); s3 log shows 23:10:29 / 23:06:29 while the file mtime is 23:12 +07 (UTC would be 16:10) — local-time rendering confirmed. s1 live entries 23:13:2x match its 23:13 capture. | **FIXED** |
| F9 | three different demo sessions (130/489/128) | s2/s3/s4 all **489/14** (vision + seed math: 45-day total = 489 exactly, today = 14); s1 = **492/14** (real capture: 489 seed + 3 live card clicks; today 11+3=14). Internally consistent; residual LOW (N16). | **MOSTLY FIXED** |
| F10 | store-scale legibility | Current sizes: chart value labels 11 px, axis 11 px, tick 10.5 px (`stats.html:84-86`); log context 13 px, timestamps 12 px (`popup.html:210,214`). Still shrinks at CWS's 640×400 downscale; accepted per disposition. | **PARTIAL (accepted)** |
| F11 | BRANDING stroke numbers wrong (claimed 76) | `BRANDING.md:32` now 70/86; sources match: `assets/icon.html:23` = 70, `assets/icon-small.html:22` = 86. (The popup header inline SVG uses 76 — a different, undocumented rendering of the same mark.) | **FIXED** |
| F12 | gradient provenance brand-risk | `BRANDING.md:33-35` carries the explicit provenance/compatibility rationale; vision re-check of icon16/128, promo, marquee, s4: check-on-tile only — no Muse/Meta squiggle or infinity resemblance. | **RECORDED (as dispositioned)** |
| F13 | no focus-visible styling | Global `:focus-visible` on both surfaces (`popup.html:54-55`, `stats.html:125`); **runtime-verified**: Tab-focused control computes `outline: 2px solid` (dark theme: `rgb(124,176,255)`, matches `:focus-visible` = true). | **FIXED** |
| F14 | no aria-live anywhere | `popup.html:302` log `aria-live="polite"`; additionally the status pill text `#fstatText` (`:257`) is live. Stats KPIs accepted without. New gap on the new preview (N2). | **PARTIAL+ (extended)** |
| F15 | card deltas informational | Tokens unchanged (`#242526` vs `#18191a` 1.15:1 etc.); no action was requested. | **NO ACTION (as reviewed)** |
| F16 | hardcoded user path in stats-shot.mjs | QA dir = `path.join(os.tmpdir(),'maa-dark')` (`stats-shot.mjs:226`); no username path anywhere in scripts (only the Chrome program path). | **FIXED** |
| F17 | popup shown as content-crop (log force-expanded) | **The crop is back, documented as "screenshot framing":** `stats-shot.mjs:185-193` + `store-shot.mjs:231-233` lift the 600 px cap and expand the log to content height for the capture; s3's popup is taller than the real popup and shows no scrollbar. The v1.4 disposition claim "v1.5.0 captures no longer force-expand the log" is **not true at f4f058e**. The in-code rationale is honest ("this only changes what the capture shows") but the claim in the record is stale and BRANDING/LISTING carry no note. | **REGRESSED → re-open (N11)** |
| F18 | arrows 2.57:1 | `assets/store-screenshot.html:27` `.arrow { color:#61666d }` = **5.64:1** (computed). (Disposition recorded `#6b7078`/4.6:1 — see N15.) | **FIXED** |
| F19 | adoption note stale (v1 brand, "not yet a git repo") | `SGPS_EXPERIENCE_ADOPTION.md:20` now Brand Kit v2; `:40` "git repo on branch main; no remote yet" — verified true (branch `main`, no remote). But the doc has **0 mentions** of the v1.7.0 round/features and no round evidence table (round gate 9 unmet — see gate table). | **PARTIAL** |

---

## Verified good (independently re-checked at f4f058e)

1. **Runtime harnesses green on the frozen tree** — `followup-e2e.mjs` exit 0 **74/74** (incl. the overflow probe, rotation end-to-end, per-group save, rotation falsification phase, GitHub-card family); `e2e.mjs` exit 0 — 13/13 expected clicks, `missing []`, `forbidden []`, `denyCount 0`, dedup 1/1, statsCheck/encCheck/statsPage/locksProbe all true, `i18nFound "3 muse.ai tabs open"`; `lint.mjs` exit 0 (24 checks/18 files).
2. **Popup height ≤ 600 in every measured state** — harness: empty log **561**, full log **590**, sheet open **590**; overflow probe: sheet stays inside the popup, phrase area internally scrollable (`chipsMaxH 128px`, `scrollH 150`, `clientH 106`), every selected row keeps its ×, last × reachable after scroll, Preview visible.
3. **Keyboard traversal is complete and ordered** (scratch CDP): panel open, sheet closed → `enabled → delay → followupEnabled → fq0-fq2 → flibbtn → fprompt → frotadd → frotstarter → frotnext → fidle → fcool → fsendnow → openstats`; sheet open → 8 group tabs → 4 chips → textarea → rotation buttons → inputs → send. Enter **and** Space activate the library trigger; Escape closes the sheet; `aria-expanded`/`aria-controls` track state. Gated state correctly removes all hidden controls from the tab order.
4. **Focus-visible works at runtime** (2 px solid outline on Tab; dark `#7cb0ff`, light `#005abf` per tokens).
5. **Reduced motion complete** — runtime under emulation: `.track` transition duration 0 s, check-mark dashoffset pinned to 0 (popup.html:21-26), stats transitions disabled (stats.html:130-132).
6. **States** — empty: "No clicks yet" (popup.js:438) + "No data yet" (stats.js:116); disabled: Send-now inert treatment (7.34:1 light / 5.34:1 dark computed) with lock glyph + tooltip "Enable Auto follow-up first", panel gated with inline note (runtime-verified: `gated:true`, `sendNowDisabled:true`, gate note visible).
7. **All new-surface contrast pairs pass except N1** — computed with alpha compositing: chip.on light 5.12, tab.on light 4.96, quick.on 4.96, count 4.65, src 5.47, sent pill 5.48 (matches the in-code claim), disabled 7.34/5.34, focus ring 6.37/7.97, dark tab/quick 6.63, dark count 4.76, dark src 6.76, dark sent 6.26.
8. **BRANDING §3/§3.1 numbers verified** — all 20 palette stops, 6 trend-accent stops, both `now-ink` pairs and the designed-asset pairs (`#0047a3` 7.02, `#8f4100` 6.13, `#57289f` 7.88, teal 5.34) recompute to the recorded values (only the light chip-ink range is incomplete — N14).
9. **Phrase library strings are doc↔code identical** — all 29 phrases (8 groups) in `popup.js` appear verbatim in `PROMPT_LIBRARY.md`; no doc-only rows; quick-combo strings exact; composition rules (library order, `"; "` join, trailing period for multi-part, 600-char custom cap, fallback preset) match `PROMPT_LIBRARY.md` §2 and the harness assertions.
10. **i18n parity** — 78 keys × 6 locales, key sets identical, order preserved, `$1` placeholders present where required; harness case 0 additionally checks every used key exists.
11. **Rotation semantics match docs** — `content.js:485-501,753-781`: index advances only inside the verified-send callback; blocked/failed attempts repeat the same prompt; ping reports `{rotateIdx, rotateCount}`; harness proves wrap-around + blocked-send non-advance + a mutation-falsified round-robin.
12. **Stats numbers reconcile 100 % with the seed** — Total 489, Today 14, week 77, month 117; all 14 bar values (6,8,16,9,11,13,15,5,7,15,17,19,12,14) and the 5 topic values (231/108/84/43/23) recomputed from `stats-shot.mjs`'s formula; trend chart is single-hue with a "today" accent (W2 fix #1 verified visually).
13. **Store assets: specs + hygiene** — all PNGs 24-bit RGB (icons RGBA, fine for icons), exact CWS sizes (headers), no color-profile chunks needed since pixels are now exact token values; all demo data fictional (scripts + assets + vision); no trademark shapes.
14. **Marquee truncation defect (CHANGELOG v1.7.0) is fixed** — vision: no truncated/clipped text on the marquee or promo; s4/promo/marquee layout clean.
15. **Dark theme runtime renders correctly for all surfaces except the N1 chip** — body `#18191a`/`#e4e6eb`, sheet `#18191a` + border, tabs/quick/count/src in the `#8ab8ff` family (computed styles captured light + dark).

---

## UNVERIFIED (honest list — what could not be checked and why)

- **Live muse.ai DOM** (status wording, composer markup, send behavior) — no logged-in session; same standing limitation as `docs/FOLLOWUP.md:220-228`. All engine checks ran against the deterministic fixture.
- **Native-speaker judgement** for zh_CN / ja / ko / es (and vi beyond the W3 native pass) — I am not a native speaker of these; the N6 flagged items are opinion-grade and flagged as such.
- **Dark-mode visual QA pair for v1.7.0** — the dark pair is written to the OS temp dir by `stats-shot.mjs` at run time and is not part of the frozen artifacts; I did not run it (it re-renders store assets — outside this lane's read-only scope). Compensated by computed-style capture in both themes + the N1 defect found that way.
- **Vision scoring "≥9/10"** as claimed in the round charter — image analysis here is qualitative (defects/no-defects + transcription), not a calibrated numeric score.
- **"200 % text" on the popup** — no real user mechanism for a px-typed Chrome popup (page zoom measured as INFO in N17; the popup does not respond to browser zoom). The stats page reflow was measured at 320/640/1280 instead.
- **Rendered screenshots of the open sheet / rotation list** — DOM geometry + harness measurements + computed styles were used; no new screenshots were taken (read-only lane).
- **CWS dashboard acceptance, asset upload, localized short-description mechanism** — external gates (pre-existing UNVERIFIED in `UX_COPY_REVIEW.md:144-146`).
- **Zip / release-integrity claims** (18/18 byte-verify, deterministic build) — release lane owns those; not re-run here.
- **icon16/32 as painted by the OS toolbar** — reviewed from the PNG files only.
- **Whether the new `#61666d` arrow and the re-rendered assets still score the same under the store's own image checks** — no upload performed.

---

## Round evidence-gate table (docs/UI_UPGRADE_ROUND.md §Evidence gates) — independent verification

| # | Gate | Status (this audit) | Evidence |
|---|---|---|---|
| 1 | Rendered evidence every surface, light AND dark, vision ≥9/10 | **PARTIAL** | All 6 store assets are light renders, vision-reviewed (no clipping; marquee truncation fixed). Dark v1.7.0 pair not in the frozen set; one dark defect found (N1). |
| 2 | Contrast recomputed from live tokens, recorded in BRANDING | **PARTIAL** | All recorded numbers verify (incl. the new surface pairs) except: N1 (dark chip 2.77:1 fails) and N14 (range nit). |
| 3 | Keyboard/AT full traversal in real Chrome | **PASS (with N2/N8 notes)** | Scratch CDP: full traversal, Enter/Space/Escape, focus-visible, aria-pressed/expanded/controls — measured. Preview lacks aria-live (N2); generic remove labels (N8). |
| 4 | Reduced-motion: every new animation gated | **PASS** | Runtime emulation: transitions 0 s; check pinned; popup.html:21-26, stats.html:130-132. |
| 5 | i18n parity + per-locale copy review table | **PARTIAL** | Parity PASS (78×6). Copy review covers 47 keys (stale vs 78 — N6). |
| 6 | Empty/loading/error/disabled states designed | **PARTIAL / N-A** | Empty ✓, disabled ✓, gated ✓ (runtime). No loading state (local sync UI); errors are native `alert()` (import only); manual-send failure feedback missing (N3). |
| 7 | lint exit 0 · e2e exit 0 (+followup) · zip byte-verified | **PASS (what was run)** | lint exit 0; e2e exit 0 13/13; followup-e2e exit 0 74/74. Zip not re-verified (release lane). |
| 8 | Independent audit report + NOT_VERIFIED list | **THIS DOCUMENT** | — |
| 9 | `SGPS_EXPERIENCE_ADOPTION.md` updated with a round evidence table | **NOT MET** | 0 mentions of v1.7/phrase/rotation; evidence table is generic (F19 partial). |
| 10 | Store-asset exact sizes from PNG headers; neutral demo data | **PASS** | Headers measured (1280×800 ×4, 440×280, 1400×560); fictional data verified. |

---

## Environment & evidence trail

- Host: Windows 11, git-bash; repo `C:/00. AI Project/muse-auto-allow` at `f4f058e` (branch `main`, no remote). Tree clean at review start; a parallel lane's post-freeze edits appeared mid-audit (see revision-integrity note). **The only file written by this review is this report** — all other writes in the tree belong to that other lane.
- Toolchain: Node v26.7.0 · Python 3.14.7 · Chrome 154.0.8037.99 (installed; CDP via `Extensions.loadUnpacked`, scratch profiles only — `maa-audit-probe*`/`maa-fup-e2e-*` under the OS temp dir, reaped by profile path).
- Commands executed (all read-only w.r.t. the repo): `node test/followup-e2e.mjs` (×2, exit 0), `node test/e2e.mjs` (×2, exit 0), `node scripts/lint.mjs` (×2, exit 0), three scratch probes + one style probe (scratch `.mjs` in the Hermes scratch dir), Python contrast/pixel/parity scripts, `git log/rev-parse/branch/remote/show/archive` (read-only).
- **Frozen re-run (revision integrity):** `git archive f4f058e | tar -x -C <scratch>/frozen-f4f058e` → `followup-e2e` **74/74** (heights 561/590/590, identical to the in-tree run), `e2e` **ok:true** (13/13, `forbiddenHit []`, `denyCount 0`, `statsCheck`/`statsPage`/`encCheck`/`locksProbe` all true, `i18nFound "3 muse.ai tabs open"`), `lint` exit 0 (24 checks / 18 files).
- Harness outputs saved: `maa-audit-followup.json` (74/74), `maa-audit-e2e.json` (ok:true), `frozen-followup.json` (74/74), `frozen-e2e.json` (ok:true) in the Hermes scratch dir.

### Audited-file hashes (sha256, f4f058e)

| File | sha256 |
|---|---|
| extension/popup.html | 67ac8e5ae3f66f443bb68db69f64c6c430d9ed63dd99f5e9484bdd6d79784b45 |
| extension/popup.js | b6bd7f464ad19bd910826f269a5bc4f6bfd046d2192026f5e3e28bc500f0cdcf |
| extension/stats.html | 5fc22c157beb2be528ab570c7f4ba88c9149cf1c9026030001af871c0ed0f9b2 |
| extension/stats.js | 8548c0dafd50fd9d13175dfaad7969e2eb852f74529cf477bbea9f8048ee8b68 |
| extension/content.js | b06fa7ada8fafaa593e75546fe6abc45c5b396fe995a43ccfe741c199d6bf19e |
| extension/background.js | 84c0564ea0b47bc64361e45a789f7b12d25eae3a56987bd9f3727882e4b09ab5 |
| extension/manifest.json | 3f253b8dcac21732f5f1db54b40863982af591e30a382bfb601e94556b553d60 |
| extension/_locales/en/messages.json | 7964365b59b2c9176c5c35bdd8a04700309ac1afeaf73aeaebb75c4f307ee4b5 |
| extension/_locales/vi/messages.json | 644b65048fe6c3614574fc2a88df0bd7e28f80bad549e49e9f4964427313fd3b |
| extension/_locales/zh_CN/messages.json | 7b729cf9751b7c46ecc85ca4d93eda60f1ff9a3288021c00cd83018be6b44a26 |
| extension/_locales/ja/messages.json | 3d2807a775c42451548589085e82979d70be11555c3987ef1f38c65e620c1d43 |
| extension/_locales/ko/messages.json | 48e8b809c04a54cd9599d9fb1f94763422e6352030e1a076a250f1f669fa7edb |
| extension/_locales/es/messages.json | 4f1ea418bb95f9a157089ef623229a8b1b9a1e3c90e54c0dcf9932bddcbbea53 |
| docs/BRANDING.md | d821bceeead49db3eaea1afdd207be8496102d438c57faab2b09cbc3b0291db5 |
| docs/PROMPT_LIBRARY.md | 5f71d81e2587ca65a820cc200ae88caefdd2b83936000c2ac9918748153072b9 |
| docs/FOLLOWUP.md | 384c5ca318767e239c79c8467ec1b9d4c12604d69449a4a44445a613f160be0b |
| docs/UI_UPGRADE_ROUND.md | 26492154b25f00705acacc4e67cb46238d50cc008a78acc0396cd9e5d63a467d |
| docs/UX_COPY_REVIEW.md | a8d158069ce3579f43dd49bec5ec1748210c4908a029145448d7e735f8f44bb8 |
| docs/SGPS_EXPERIENCE_ADOPTION.md | 50ac374a7c7370b1e9acc2fd9111d1b0ab2da71b822c25d399291607aa2d9c5a |
| store/LISTING.md | 35448399b8752b5d442b5fcc4f54e09d2077e7446d134f6bf192179c8b0d4d18 |
| store/SHOWCASE.md | d1cb18797e1072858e8881bb88fab938c7bcc9c3c72127c592fef851781ef025 |
| scripts/stats-shot.mjs | 2e6e0f1ae1a2e9fd8412a9e55d5d16afcd712671df743f22ed21a8eaf178b4cb |
| scripts/store-shot.mjs | 95b7a08b50879ac19d67f48062737d5093f20b6ae5b6294209454043202085a4 |
| assets/store-screenshot.html | 5b654f596df8b732784f9b6643cdddbec8dc94dd00aa83f8418639448117c01d |
| assets/icon.html | 247e639831e6a42b98c4d5e743010fc664ed706be8da7fe004ff9527758e41ff |
| assets/icon-small.html | 99e1379cff88d3afff32788964e34fd68bc9286650e90a5f5af4c49a9057d2cd |
| assets/marquee.html | 5d39d6f0bdb834b0bc02b677d8b1c507372c08eef28799c23e4d21f4d9266a8a |
| assets/promo-tile.html | f68ba8f99e4168335c2a62d00a07093495bf8e8d9417fc8aa98762333027aa9c |
| store/screenshot1.png | aa87c3abbffe4b13017b8448017837f2d146edcc1188ac2517cf0f30e5fcd481 |
| store/screenshot2-stats.png | 2754e6d1f60dd68ff75b0a2312678b154deb588cef918124cc7c18e52c4d62e6 |
| store/screenshot3-popup.png | 2da4ed4ebecf13a0efe3f922e8f8b9823ef4ff433b12dce57afad5d2de867746 |
| store/screenshot4-overview.png | 1ecee80b0f04be5e83a5879711846bb911d7b415da1e8c9c6ec86c3ce3978bd5 |
| store/promo440x280.png | 95ac0c5e729071937d20d700996dac81bc9972face7296726b43bb8ed001e29b |
| store/marquee1400x560.png | 17bd1f04c6b6aa27f491732172f58d06fde25b635433c5730d76274d22499555 |

### Appendix — key measured values

- **Popup heights (harness):** empty 561 / full-log 590 / sheet-open 590 px (all ≤600).
- **Overflow probe (harness):** `sheetFitsPopup:true`, `chipsOverflowY:auto`, `chipsMaxH:128px`, `chipsScrollH:150`, `clientH:106`, `selCount:4`, `selAllHaveX:true`, last × reachable after scroll (`insideY:true`), `prevVisible:true` (268-char preview).
- **Keyboard (CDP):** see Verified-good #3; Enter + Space activate the sheet trigger; Escape closes; `:focus-visible` matches with `outline 2px solid`.
- **Reflow:** popup 320/320 no overflow; stats 1280 ✓, 640 ✓, **320 ✗ (475 vs 320)** — `.seg` right edge 475.
- **N1:** `#0a5ce0` on `rgba(0,90,191,.14)` over `#18191a` = **2.77:1** (fail); sibling dark pattern `#8ab8ff` on `rgba(10,92,224,.32)` = 6.63:1 (pass).
- **Pixel decode:** exact-token pixel counts s2 5,517 / s3 2,725 / s4 2,651 / marquee 2,413 (`#005abf`); gradient r=0 stops exact in s4 (18/301), promo (52/78), marquee (85/651), icon128 (127/197), icon512 (2,032/3,321); no ICC/sRGB/gAMA chunks.
- **PNG headers:** 1280×800 (s1-s4), 440×280 (promo), 1400×560 (marquee); icons 16/32/48/128/512 present.
- **Stats reconciliation:** 489 / 14 / 77 / 117; bars [6,8,16,9,11,13,15,5,7,15,17,19,12,14]; topics 231/108/84/43/23 — all recomputed from the seed formula, all match.

---

*Independent W4 experience audit for the v1.7.0 freeze — findings are evidence-qualified; no GO/NO-GO claim is made here. Fixes are coordinator work (maker ≠ judge).*
