# UX Copy & i18n Review — W3 (UI upgrade round)

Status: **complete** · Revision reviewed: working tree on top of `9b71680` (v1.6.0) ·
Write-set: `extension/_locales/*/messages.json` (values only), `store/LISTING.md`,
this document. No keys added/removed/renamed; no popup/script edits; no git operations.

Charter reference: `docs/UI_UPGRADE_ROUND.md` → W3 ("Copy & i18n — idiomatic review of
all user-visible strings in all 6 locales … parity gate stays") and evidence gate 5
("per-locale copy review table (6 locales)").

## 1. What was reviewed

| Surface | Scope | Result |
|---|---|---|
| `extension/_locales/*/messages.json` | all 47 keys × 6 locales (en, vi, zh_CN, ja, ko, es) = 282 values; the 12 machine-seeded `followup*` keys reviewed first | 15 value changes (vi 4, zh_CN 1, ja 4, ko 3, es 3; en 0) |
| `store/LISTING.md` | listing title policy, EN short description (≤132), six detailed descriptions, **localized short descriptions added for all six locales** | 11 wording fixes; localized short-description table added |
| Terminology coherence per locale | Allow · approval · follow-up · status labels (Working / Connected / No tab / unknown) | verified per locale (below) |

Method: native-level pass on vi; conservative, evidence-checked pass on zh_CN / ja / ko /
es (I am not a native speaker of those four — every judgment call is flagged in §5).
Where a term choice was version-dependent, the status labels were translated for **our
popup** (they mirror Muse's English states `Connected` / `is working`, which stay English
on Muse's site). Machine-seeded `followup*` keys were treated as prime suspects.

## 2. Findings — `extension/_locales/*/messages.json`

| # | Key | Locale | Before | After | Rationale |
|---|---|---|---|---|---|
| 1 | `museTabsNone` | vi | Chưa thấy tab muse.ai | Không tìm thấy tab muse.ai nào | State is "none found now", not "not seen yet"; matches en/zh/ja/ko/es framing. |
| 2 | `followupPromptLabel` | vi | Lời nhắc gửi tiếp: | Tin nhắn gửi tiếp: | Field holds the chat **message** sent to Muse; "Nhập lời nhắc" is a bad collocation ("đặt lời nhắc" would be the reminder idiom); pairs with the select + placeholder. |
| 3 | `followupCustomPlaceholder` | vi | Nhập lời nhắc gửi tiếp… | Nhập tin nhắn gửi tiếp… | Same family fix; "Nhập tin nhắn…" is the standard placeholder pattern. |
| 4 | `followupCooldownLabel` | vi | Giãn cách tối thiểu (phút): | Chờ giữa các lần gửi (phút): | "Giãn cách tối thiểu" alone does not say *between what* (and "giãn cách" leans social-distancing usage); new label states the actual rule and pairs cleanly with the sibling "Chờ trước khi gửi (giây):". |
| 5 | `extDesc` | zh_CN | 自动点击 Muse（muse.ai）**审批**请求中的“Allow”。… | 自动点击 Muse（muse.ai）**批准**请求中的“Allow”。… | Unify "approval" to 批准 across the extension name (自动批准), the log chip (批准) and the zh store listing (批准) — 审批 sounded bureaucratic/process-flavoured. |
| 6 | `followupPromptLabel` | ja | フォローアップのプロンプト**:** | フォローアップのプロンプト**：** | Halfwidth colon in machine-seeded keys vs fullwidth `：` used by every v1.2-era label (クリック間隔：/ クリック数：). |
| 7 | `followupIdleLabel` | ja | 送信までの待機（秒）**:** | 送信までの待機（秒）**：** | Same colon unification. |
| 8 | `followupCooldownLabel` | ja | クールダウン（分）**:** | クールダウン（分）**：** | Same colon unification. |
| 9 | `followupSentAt` | ja | フォローアップ送信 $1 | フォローアップ送信済み $1 | "…送信 $1" reads as a log noun; 送信済み marks the completed state like the sibling pills (接続済み / 作業中). `$1` kept. |
| 10 | `extDesc` | ko | …클릭 로그 제공, 데이터는 로컬에만 저장. | …클릭 로그를 제공합니다. 데이터는 로컬에만 저장됩니다. | Fragment + comma splice → two full formal sentences matching the first sentence's 다체. |
| 11 | `followupToggle` | ko | Muse가 **유휴 상태**일 때 계속하기 | Muse가 **대기 중**일 때 계속하기 | 유휴 상태 is developer jargon; 대기 중 is the standard consumer phrasing for idle/standby. |
| 12 | `followupSentAt` | ko | 후속 요청 전송 $1 | 후속 프롬프트 전송 완료 $1 | Noun pile-up ("후속 요청 전송") + no completion marker; names what was sent and marks delivery (완료 — only *verified* sends are shown). `$1` kept. |
| 13 | `extDesc` | es | Hace clic automáticamente en Allow **en las solicitudes** de aprobación de Muse (muse.ai). … | Hace clic automáticamente en Allow **cuando Muse (muse.ai) pide aprobación**. … | Double "en … en" clunky; "cuando Muse pide aprobación" is the natural Spanish construction for "on … approval requests". |
| 14 | `importConfirm` | es | ¿Restaurar esta **copia**? … | ¿Restaurar esta **copia de seguridad**? … | Align with `importBad` ("copia de seguridad"); "copia" alone can read as "copy". |
| 15 | `followupCooldownLabel` | es | **Enfriamiento** (minutos): | **Intervalo entre envíos** (minutos): | "Enfriamiento" is thermal/3D-printer/boiler vocabulary; "intervalo entre envíos" is the standard es way to label send pacing (verified in usage: messaging tools/docs use "intervalo … entre mensajes/envíos"). |

Kept deliberately after review (may look changeable, but changing them would add risk,
not quality):

| Key(s) | Locale | Kept value | Why kept |
|---|---|---|---|
| `followupCooldownLabel` | zh_CN | 冷却时间（分钟）： | 冷却时间 is used in professional zh settings UIs (autoscale/trigger cooldowns), not only games; it is comprehensible and the conservative choice. Alternative "发送间隔（分钟）：" noted for the owner. |
| `followupCooldownLabel` | ja | クールダウン（分）： | クールダウン is the established non-game loanword in ja settings UIs. |
| `followupCooldownLabel` | ko | 쿨다운(분): | Usage-verified: Korean app option tables label exactly this ("쿨다운(초) — 한 번 알림 후 다음 알림까지 최소 간격"), including a Play-Store listing ("스마트 쿨다운"). |
| `followupSentAt` | zh_CN | 已于 $1 发送跟进 | Grammatical, compact, standard "已于 …发送" status pattern; mild stylistic reservation flagged in §5. |
| `followupSentAt` | es | Seguimiento enviado $1 | Pill sits next to the long title "Seguimiento automático"; adding "a las" would push the chip to the popup edge (W1 owns layout). |
| `followupToggle` | vi/ja/zh/es | Tự gửi tiếp khi Muse ngừng chạy · Muse が待機中のとき続行する · Muse 空闲时自动继续 · Continuar cuando Muse esté inactivo | All four read naturally; the "idle" semantics survive translation. |
| `extName` | vi/en | Muse Auto-Allow | Brand kept; store title is as-is by policy (see §3). |
| `extName` | zh/ja/ko/es | Muse 自动批准 / Muse 自動承認 / Muse 자동 승인 / **Muse Auto-Aprobar** | zh/ja/ko noun forms are standard; es "Auto-Aprobar" (infinitive) kept but flagged in §5 — it is a naming decision, not a copy fix. |

Coherence matrix (per locale, after changes): vi approval = phê duyệt/duyệt · follow-up
= "gửi tiếp" family (title/toggle/prompt/sentAt) · ja approval = 承認 · follow-up =
フォローアップ family · ko approval = 승인 · follow-up = 후속 family · zh approval = 批准 ·
follow-up = 跟进 family · es approval = aprobación · follow-up = seguimiento family.

## 3. Findings — `store/LISTING.md`

Factual claims were kept **identical** to the existing copy in every edit (no new
promises, no follow-up-feature claims added); version/package refs and `TODO: fill before
submit` markers untouched.

| # | Field | Locale | Before | After | Rationale |
|---|---|---|---|---|---|
| 1 | Short-description note | — | "Every other locale below repeats the item name as-is; …" | Note now states the title policy explicitly (title stays **Muse Auto-Allow** as-is; in-browser name is localized via `_locales`) and points to the new localized table | The old sentence didn't say where localized shorts live; context for reviewers. |
| 2 | **Localized short descriptions (new)** | vi | (none in doc) | Tự động bấm Allow cho các yêu cầu phê duyệt của Muse (muse.ai) để agent của bạn chạy liên tục. Chỉ lưu cục bộ, không gửi dữ liệu. (129 chars) | Faithful rendering of the EN short's claims; ≤132. |
| 3 | same | zh_CN | — | 自动点击 Muse（muse.ai）批准请求中的“Allow”，让你的智能体持续运行。仅保存在本地，不发送任何数据。 (58) | same; uses 批准 to match §2-#5. |
| 4 | same | ja | — | Muse（muse.ai）の承認リクエストで「Allow」を自動クリックし、あなたのエージェントを止めずに動かします。ローカル保存のみ、データ送信なし。 (76) | same. |
| 5 | same | ko | — | Muse(muse.ai)의 승인 요청에서 'Allow'를 자동으로 클릭해 에이전트가 계속 실행되도록 합니다. 로컬에만 저장되며 데이터는 전송되지 않습니다. (86) | same. |
| 6 | same | es | — | Clic automático en Allow cuando Muse (muse.ai) pide aprobación, para que tu agente siga en marcha. Todo local, sin enviar datos. (128) | same. |
| 7 | Detailed description | vi | băng xin quyền của trình duyệt | dải xin quyền của trình duyệt | "băng" is an odd banner loan; "dải" matches the listing's own "dải thông báo nền" two bullets above. |
| 8 | Detailed description | vi | **Bạn luôn nắm quyền** | **Bạn luôn nắm quyền kiểm soát** | "nắm quyền" alone reads "hold power/authority"; the full idiom "nắm quyền kiểm soát" says "in control". |
| 9 | Detailed description | vi | **Riêng tư từ thiết kế** | **Riêng tư ngay từ thiết kế** | Rhythm; "ngay từ" is the idiomatic "by design/from the ground up" marker. |
| 10 | Detailed description | vi | Trang Thống kê **sẵn có**: | Trang Thống kê **tích hợp**: | "sẵn có" = merely available; "tích hợp" = built-in, which is what the EN ("built-in") means. |
| 11 | Detailed description | zh_CN | 在你自己的浏览器里**监视** Muse 页面 | …**监控** Muse 页面 | 监视 carries a surveillance flavour in a privacy-focused listing; 监控 is the neutral standard term for page monitoring. |
| 12 | Detailed description | zh_CN | 让待处理卡片**渲染**出来 | 让待处理卡片**显示**出来 | 渲染 is dev jargon; store copy should read for end users. |
| 13 | Detailed description | ja | エージェントは**待ったまま**になります。 | エージェントは**待機したまま**になります。 | "待ったまま" is awkward; 待機 also matches the toggle in the locale file (待機中). |
| 14 | Detailed description | ja | **常にあなたが主導** | **主導権はあなたに** | Heading fragment → natural, standard ja headline for "You stay in control". |
| 15 | Detailed description | ko | **항상 사용자가 제어** | **제어권은 사용자에게** | Same: incomplete fragment → natural ko headline for "You stay in control". |
| 16 | Detailed description | es | para que se **rendericen** las tarjetas pendientes | para que se **muestren** las tarjetas pendientes | "renderizar" is dev jargon; Spanish store copy uses plain verbs. |

EN detailed description and EN short description were reviewed and left byte-identical
(reference locale; "render" kept as technical precision in EN — the Spanish plainified).

## 4. Reviewed clean — per locale (no change needed)

- **en** — reference; all 47 keys reviewed. `museTabsFound` "$1 muse.ai tabs open",
  `followupSentAt` "Follow-up sent $1", state labels Working/Connected, import/export
  dialogs, stats labels: all coherent; zero edits by design.
- **vi** — 43/47 keys kept. Confirmed coherent family "gửi tiếp" (title, toggle, sentAt)
  and "Đã kết nối" (idle) / "Đang làm việc" (working) as state labels; `kindAllow`
  "duyệt" parallel to "mở rộng"/"mở bảng"; `allYears` "Tất cả các năm" parallel to the
  "N … gần nhất" captions; import/export + confirm dialog wording natural.
- **zh_CN** — 46/47 kept. 跟进 family (自动跟进 / 跟进提示词 / 输入跟进提示词… / 已于…发送跟进)
  coherent; 批准 unification done in #5; 冷却时间 kept (§2); numbers/labels (总计/今天/本周/
  本月/今年, 最近 N 天) all natural.
- **ja** — 43/47 kept. フォローアップ family coherent; 承認 matches the name; colons now
  uniformly fullwidth; 直近 N 日間 captions fine; 作業中/接続済み/状態不明 natural.
- **ko** — 44/47 kept. 후속 family coherent; 쿨다운 kept (§2); 클릭 로그/통계/내보내기/
  가져오기 natural; 대기/연결됨 state wording fine after #11.
- **es** — 44/47 kept. seguimiento family coherent; Conectado/Trabajando fine;
  "Retardo entre clics", "Solo funciona en muse.ai", import/export dialogs natural.

Also reviewed clean (unchanged, by scope): listing title policy, categories, single
purpose, permission justifications, remote-code declaration, privacy answers, assets
checklist — out of W3 copy scope.

## 5. UNVERIFIED / confidence notes (not a native speaker)

Sorted by risk; everything below is a judgment call the owner/native reviewer may
overturn — each was chosen conservatively, none blocks the parity or e2e gates.

1. **zh_CN / ja / ko / es coverage** — reviewed non-natively. vi is reviewed to
   native level. Specific strings I am *less than fully confident* about:
   - ja `followupSentAt` "フォローアップ送信済み $1" (new compound; alternate: "$1 に
     フォローアップ送信") and ja detailed-description rewrites "待機したまま" /
     "主導権はあなたに".
   - ko `followupSentAt` "후속 프롬프트 전송 완료 $1" (new phrasing; alternate:
     "후속 요청 전송 완료 $1"), ko `followupToggle` "대기 중일 때" (alternate: "유휴 상태일 때"), ko heading "제어권은 사용자에게".
   - zh_CN 监控 (#11) — alternate 关注/观察 was considered; 冷却时间 and "已于 $1
     发送跟进" kept despite mild reservations; "自动跟进" considered against
     Microsoft-style "后续提示" phrasing (kept — 跟进 is widely understood).
   - es "Intervalo entre envíos (minutos):" (#15) and es `extName` "Muse
     Auto-Aprobar" (kept; if the owner prefers the brand as-is in es too, change is
     one value). "Retardo entre clics" kept (Spain-standard; LatAm alternative
     "Demora/Intervalo").
   - vi "Tin nhắn gửi tiếp" (#2/#3, alternative "Lời nhắc") and "Chờ giữa các lần
     gửi" (#4, alternative kept in history: "Giãn cách tối thiểu").
2. **Rendered-width estimates only** — new ja/ko `followupSentAt` and vi/es cooldown
   labels are slightly longer than before. Estimated to fit the 320 px popup rows
   (ja chip ≈ 283 px vs 292 px content width; es label ≈ 274 px incl. input), but
   **not re-measured in a browser** — W1 (popup lane) owns layout; re-check there.
3. **Non-EN runtime substitution** — `$1` is kept in `museTabsFound` (all locales) and
   `followupSentAt` (all locales), but the e2e suite only asserts the en path
   ("3 muse.ai tabs open"). Non-en substitution is untested at runtime (unchanged
   mechanism).
4. **Store-short-description mechanics** — the claim that CWS localizes short
   descriptions via the dashboard's *localized* tab is pre-existing in the doc and was
   not re-verified here; the new localized table is provided regardless.
5. **Localized short descriptions** for zh_CN/ja/ko/es are translations of the EN short
   authored in this review (claims identical: auto-click Allow on Muse approval
   requests · agent keeps running · local-only · no data sent · all ≤132 chars).

## 6. Verification evidence

Environment: Windows host, repo `C:/00. AI Project/muse-auto-allow`, Node + installed
Chrome (CDP). Revision: working tree over `9b71680`; no commit/push performed (per task).

| Command | Result |
|---|---|
| `node scripts/lint.mjs` | **exit 0** — "lint OK — 24 checks across 18 files (syntax, JSON, i18n parity, no remote code, minimal permissions)" |
| `node test/e2e.mjs` | **exit 0** — `ok: true`; 13/13 expected clicks; missing/extra/forbidden `[]`; denyCount 0; dedup counts 1/1; stats/encryption/stats-page/locks all true; **`i18nFound: "3 muse.ai tabs open"`** (museTabsFound `$1` substitution intact) |
| `node test/e2e.mjs` (re-run) | **exit 0** again, on the working tree that by then also contained the parallel W1 lane's in-flight `popup.html` premium pass — same assertions (`ok: true`, `i18nFound: "3 muse.ai tabs open"`, all sub-checks true). W1 was still editing `popup.js` during this run, so the coordinator should re-run gates on the frozen revision as planned. |
| Key-set parity (programmatic) | 47 keys in every locale, order preserved, key sets identical to `en` |
| JSON formatting | load → `json.dumps(ensure_ascii=False, indent=2)` round-trip byte-identical to the pre-edit format (2-space indent, LF, trailing newline) |
| Placeholders | `$1` present in `museTabsFound` + `followupSentAt` for all 6 locales |
| Write-set audit | changed by this lane: 5 × `_locales/*/messages.json` (en untouched), `store/LISTING.md`, `docs/UX_COPY_REVIEW.md` (new). `content.js` / `stats.*` / scripts: untouched. The `popup.html` / `popup.js` modifications visible in the working tree are the **parallel W1 lane's** (mtimes 17:42:56 / 17:44:52 +07 — after this lane's writes); W3 did not edit them. |

Change totals: messages.json **15 values** (vi 4 · zh_CN 1 · ja 4 · ko 3 · es 3 · en 0);
LISTING.md **11 wording fixes (incl. the note) + 5 new localized short descriptions**; every change
rationalised in §2 and §3.

## 7. Handoff notes for the coordinator

- Values-only edits → safe to merge alongside W1/W2; the parity gate cannot break from
  this write-set.
- If a native reviewer is available, re-check the §5 items (ja/ko sentAt + headings,
  es cooldown label, vi "Tin nhắn gửi tiếp") — each is a single-value change.
- W1 (popup premium) should sanity-check the two longest new labels in the rendered
  popup (ja/ko status chip, es cooldown label) at 320 px.

---

## Addendum — EXPERIENCE-FIX lane (v1.7.0 unreviewed keys + N7 cleanup)

Status: **complete (values-only)** · Revision: working tree on top of `7de2e91` (v1.7.0 +
the experience fixes; see `docs/EXPERIENCE_REVIEW_V17.md` → Disposition). Write-set here:
`extension/_locales/*/messages.json` (values only), this document. No keys renamed; the only
key-set changes are the N7 removals and the 7 additions listed below — parity stays exact
(**82 keys × 6 locales**, order preserved, `$1` placeholders kept).

### A.1 What this addendum covers

The W3 review above covered **47 keys** at v1.6.0. The frozen v1.7.0 build carried **33 keys
with no documented review** — the phrase-library / rotation / status-pill / compact-settings
set the audit's N6 flagged. This pass reviewed those 33 keys in all 6 locales (conservative,
evidence-checked pass; I am not a native speaker of ko/vi/ja/zh/es — every judgment call is
flagged in A.5), fixed the three flagged items plus the related tone issues below, and records
the additions/removals that moved the key count 80 → 82.

### A.2 Value changes (keys untouched)

| # | Key | Locale | Before | After | Rationale |
|---|---|---|---|---|---|
| 1 | `followupHintIdle` | ko | Muse가 **유휴 상태**입니다 | Muse가 **대기 중**입니다 | N6: W3 deliberately moved the idle concept to 대기 중 (toggle `followupToggle`); 유휴 상태 is developer jargon reintroduced by the unreviewed v1.7.0 keys. |
| 2 | `followupHintWaiting` | ko | Muse가 **유휴 상태**입니다 — 대기 시간이 지나면 후속 **요청**을 보냅니다 | Muse가 **대기 중**입니다 — 대기 시간이 지나면 후속 **프롬프트**를 보냅니다 | Same fix; also aligns the sent object with the shipped ko family (`후속 프롬프트` — placeholder, `followupSentAt`). |
| 3 | `followupCooldownShort` | vi | **Giãn cách** | **Khoảng chờ** | N6: "giãn cách" alone carries the social-distancing reading W3 removed from the long label; "Khoảng chờ" (waiting period) pairs with the sibling "Chờ" and the long label "Chờ giữa các lần gửi". |
| 4 | `followupRotateStarter` | ja | スターター**セット** | スターター**ローテーション** | N6: the button loads the rotation list — the value must link to the rotation row (`followupRotateLabel` = ローテーション), not read as a generic "starter set". |
| 5 | `followupRotateStarter` | ko | 스타터 **세트** | 스타터 **순환** | Same fix (rotation family in ko = 순환 — `followupRotateLabel`, `followupGroupSaved`). |
| 6 | `followupRotateStarter` | vi | **Bộ khởi đầu** | **Luân phiên khởi đầu** | Same fix (rotation family in vi = luân phiên). |

### A.3 N7 cleanup — 5 dead keys removed from all 6 locales

`yearLabel`, `followupIdleLabel`, `followupCooldownLabel`, `followupConnected`,
`followupUnknown` were referenced nowhere in `extension/**` (re-verified programmatically
before removal; `test/**` does not reference them either). Removed in every locale to keep
parity. Consequences recorded here: W3 review entries for `followupIdleLabel` /
`followupCooldownLabel` (colon unification, ja #7/#8) and for the status labels
`Connected` / `Status unknown` (§4) no longer describe shipped strings — those surfaces were
replaced in v1.7.0 by the compact pair (`followupIdleShort` / `followupCooldownShort`) and
the pill set (`followupWorking` / `followupWaiting` / `followupIdle`).

### A.4 New keys added by the experience fixes (this lane authored the values)

N3 (inline send-failure reason) and N5 (rotation-replace confirm) added 7 keys; all are new
values, reviewed here for consistency with each locale's existing family:

| Key | en value |
|---|---|
| `followupSendBlocked` | Couldn't send the follow-up |
| `followupSendBlockedApproval` | Couldn't send — Muse is waiting for your approval |
| `followupSendBlockedDraft` | Couldn't send — Muse's message box already has text |
| `followupSendBlockedComposer` | Couldn't send — no message box found on the Muse page |
| `followupSendBlockedNoPrompt` | Couldn't send — no follow-up prompt is set |
| `followupSendBlockedSending` | A follow-up is already being sent |
| `followupRotateStarterConfirm` | Replace your $1 saved combos? Tap again |

Per-locale families used: vi "Không gửi được …" + "tin nhắn gửi tiếp"; zh_CN "无法发送 …" +
"跟进"; ja "送信できません …" / "フォローアップ"; ko "보내지 못했습니다 …" / "후속 프롬프트";
es "No se pudo enviar …" / "seguimiento". The confirm key names the saved **combos** being
replaced (matching the per-locale `followupRotateSave` / `followupGroupSave` wording —
combo / 组合 / コンボ / 조합 / combo), not the rotation list itself.

### A.5 UNVERIFIED / confidence notes (not a native speaker)

1. **The 6 changed values and the 7 new keys above are non-native review** (ko/vi/ja/zh/es) —
   each was chosen conservatively from the locale's existing reviewed family and is a
   single-value change if a native reviewer disagrees. Highest-uncertainty items:
   vi `Khoảng chờ` (alternate: "Chờ gửi"), ko `followupHintWaiting` 프롬프트 alignment,
   ja `スターターローテーション` (alternate: "おすすめローテーション").
2. **Reviewed and deliberately NOT changed** (flagged for the native reviewer):
   - ja `followupIdle` "アイドル" (pill only; standard IT Japanese, but collides with "idol" —
     alternate: "待機中", which would then equal `followupWaiting`);
   - ko `followupIdle` "유휴" (single-word pill; the hints were moved to 대기 중 per N6, the
     pill kept distinct from the armed "대기 중");
   - ja `followupRotateNext` "次: $1/$2" (halfwidth colon in a compact counter — kept, the
     W3 colon unification targeted labels);
   - vi library wording "Thư viện câu lệnh" / "câu lệnh" (literal "command"; "mẫu câu" is the
     softer alternative — kept, widely understood in vi tooling copy).
3. **Rendered width** of the longer values (ja `スターターローテーション`,
   vi `Luân phiên khởi đầu`, the "Couldn't send — …" notes) was measured only for the send
   note (208×30 px inside the 292 px row, popup 564 ≤ 600 in the real popup surface); the
   rotation-row labels wrap by design (`flex-wrap` on `.frot`) and were not re-measured
   per locale — no layout gate covers them.

## Addendum — v1.10.0 Codex (ChatGPT) strings (2026-10-18)

Status: **complete** · Revision reviewed: v1.10.0 tree (`f4cf2ec`) ·
Scope: the 11 `codex*`/`kindCodex*` keys in all six locales (values only).

- All six locales reviewed against the English source ("Codex" kept untranslated as the
  product noun; chatgpt.com kept as the host; the safety claim — Deny never clicked,
  standing grants manual — must survive translation).
- **One change:** ja `codexHint` — "Deny はクリックしません" → **"Deny は決してクリックしません"**
  (the English "never" had softened to a plain statement; the strengthened form matches the
  safety voice used by the YOLO hint). All other values kept.
- Non-native review caveat as §5: ko/vi/ja/zh/es chosen from each locale's existing reviewed
  family; each is a single-value change if a native reviewer disagrees.
- Parity: 190 keys × 6 locales, `scripts/lint.mjs` green after the change.
