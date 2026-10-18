# Muse Auto-Allow — Chrome Web Store Listing Kit

Everything the Chrome Web Store dashboard asks for, ready to paste. Copy fields are
provided in all six supported languages (en, vi, zh_CN, ja, ko, es). The homepage and
privacy-policy URLs are filled (verified live 2026-10-12); the only remaining
`TODO: fill before submit` value is the **support email** — the owner must replace it
before uploading. The developer/publisher name line is an owner confirmation in the
dashboard (no repo value to fill).

---

## 1. Item metadata

| Field | Value |
|---|---|
| Item name | **Muse Auto-Allow** |
| Category | **Productivity** |
| Default language | English (en) |
| Version | 1.10.1 |
| Manifest version | Manifest V3 |
| Extension package | `dist/muse-auto-allow-v1.10.1.zip` |
| License | MIT © 2026 BlueSkyz Labs |
| Homepage / support URL | `https://github.com/BlueSkyz-Labs/muse-auto-allow` |
| Privacy policy URL | `https://blueskyz-labs.github.io/muse-auto-allow/privacy.html` (GitHub Pages copy of `store/PRIVACY.md`; verified live 2026-10-12) |
| Support email | `TODO: fill before submit` |

### Short description (English, ≤132 characters)

```
Auto-click Allow on Muse (muse.ai) and Codex (chatgpt.com) approvals. Starts in logging-only mode; local-only.
```

> Verified length: 110 characters (limit 132; all six count cells below were re-verified
> programmatically at the v1.10.0 freeze, 2026-10-18). The listing title stays **Muse
> Auto-Allow** as-is in every locale; the in-browser name is localized separately via
> `extension/_locales/*/messages.json`. The Chrome Web Store lets you localize the
> short description per language in the **Store listing → localized** tab — all six
> localized short descriptions below make the same claims as the English one.

#### Localized short descriptions (all six locales, same claims, ≤132 characters)

| Locale | Short description | Characters |
|---|---|---|
| en | Auto-click Allow on Muse (muse.ai) and Codex (chatgpt.com) approvals. Starts in logging-only mode; local-only. | 110 |
| vi | Tự động bấm Allow cho yêu cầu phê duyệt của Muse (muse.ai) và Codex (chatgpt.com). Khởi đầu chỉ ghi log; lưu cục bộ. | 116 |
| zh_CN | 自动点击 Muse（muse.ai）与 Codex（chatgpt.com）批准请求中的“Allow”。初始为仅记录模式，默认仅本地保存。 | 69 |
| ja | Muse（muse.ai）と Codex（chatgpt.com）の承認リクエストで「Allow」を自動クリック。初期は記録のみ、既定はローカル保存。 | 75 |
| ko | Muse(muse.ai)와 Codex(chatgpt.com) 승인 요청에서 'Allow'를 자동 클릭합니다. 시작은 기록 전용 모드, 기본은 로컬 저장. | 85 |
| es | Auto-clic en Allow cuando Muse (muse.ai) o Codex (chatgpt.com) piden aprobación. Empieza en modo solo registro; local. | 118 |

---

## 2. Detailed description (all six languages)

> **v1.8 — localization done (history):** all six descriptions were refreshed for the
> v1.8 release — pause, dry-run, allow-once, rules, smart/scheduled follow-ups, the
> startup digest, optional settings sync, and onboarding — using the same in-product
> wording as `extension/_locales/*/messages.json`.
>
> **v1.9 / v1.9.1 — localization done (history):** the English description covers the v1.9
> Mission Orchestrator, and all five localized descriptions (vi, zh_CN, ja, ko, es) were
> brought to the same feature set for the v1.9.1 packet — the Mission Orchestrator plus the
> user-visible v1.9.1 experience work (missions with live progress and pause, faster
> reaction, the exact reason on a refused send or a blocked card, keyboard/assistive-tech
> support). Each localized description uses the same in-product wording as
> `extension/_locales/*/messages.json` and makes the same claims as the English text,
> including the identical privacy/permission lines. English is the reference text.
>
> **v1.9.2 — no listing-copy change (history; superseded by the v1.9.3 copy below):** the
> 1.9.2 release was a security-hardening release (backup-restore import sanitizer, locale
> guard, hardened zero-network lint gate — `CHANGELOG.md` 1.9.2); no user-visible feature
> text changed, so all six descriptions stayed unchanged at that freeze.
>
> **v1.9.3 — first-run safety default (CURRENT copy):** a fresh install now **starts in
> dry-run (logging-only)** — the extension logs exactly what it *would* click and clicks
> nothing until the user turns live clicking on (one tap in the setup wizard; the consent
> step carries the consent line in all 6 locales). All six short descriptions gained that
> clause (all ≤132 characters; recounted 2026-10-12 at the v1.9.3 freeze: en 129, vi 130,
> zh_CN 75, ja 92, ko 106, es 128). The dry-run bullet in every detailed description was
> updated to state the new first-run start — en, vi, zh_CN, ja, ko and es each carry the
> equivalent sentence (a fresh install STARTS in logging-only, one tap turns live clicking
> on). The rest of the copy is unchanged.
>
> **Honest first-click caveat (v1.9.3):** a fresh install's first action is a **dry-run log
> entry** (`allow-dry`, nothing clicked) — the first **LIVE** click needs **one user
> action** (the onboarding "Turn on live clicking", or the Safety & Control dry-run toggle
> later). This matches the benchmark report's TTFF caveat (`docs/ELITE_BENCHMARK_REPORT.md`,
> Axis 3): 0 actions *to see the tool work* (logging-only, zero setup), 1 action *to grant
> it live approval authority*.

> **v1.10.0 — Codex (ChatGPT), en copy updated (CURRENT copy):** the English detailed
> description below gains the Codex (ChatGPT) scope (chatgpt.com, separate switch, off by
> default) — bullets under *What it does* and *You stay in control*, plus the corrected
> closing scope line — and all six short descriptions name both scopes (counted
> 2026-10-18: en 110, vi 116, zh_CN 69, ja 75, ko 85, es 118 — all ≤132). The five
> localized detailed descriptions were then refreshed on 2026-10-18 to carry the same two
> Codex bullets under their *What it does* and control sections, with the closing scope
> lines already naming both scopes — the earlier "localized bodies do not yet describe the
> Codex switch" TODO is closed (mirrored in `store/CWS_SUBMISSION_PACK.md`).

### English (en)

Muse Auto-Allow keeps your Muse agent running.

Muse (muse.ai) pauses and asks you to approve actions before it continues. When you
step away, those approval prompts pile up and your agent sits idle. Muse Auto-Allow
watches the Muse page in your own browser and clicks **Allow** for you — so the work
keeps moving.

**What it does**
- Detects Muse approval requests and clicks the **Allow** button.
- Works on all four ways Muse shows an approval: marked approval cards, paired
  Allow/Deny buttons, collapsed “Allow Muse to perform this action…” cards (it expands
  them first), and the background “N tasks need your approval” banner (it opens the
  approvals panel so pending cards can render).
- Handles approvals in background tabs too, checking once a minute.
- With its own **Codex (ChatGPT)** switch on (a separate opt-in, off by default), the
  same care applies on chatgpt.com: it clicks the affirmative option on Codex approval
  requests ("Yes, proceed", "Allow", "Approve" — one-shot forms preferred) only when a
  clickable negative counterpart sits in the same button container, expands collapsed
  "Allow Codex to …" cards first, and opens "A task needs your approval" review bars so
  the approval panel renders.

**What it will never do**
- It never clicks **Deny**, **Reject**, or **Decline**.
- It never clicks a lone **Allow** button that is not part of an approval pair — for
  example browser permission banners or “Allow notifications” prompts.
- It never clicks the same button twice.

**You stay in control**
- On/off switch in the popup — turn it off at any time.
- Pause automation (keyboard shortcut Alt+Shift+P, 15 minutes; press again to resume)
  — the popup and toolbar badge show the paused state.
- Dry-run mode: log exactly what would be clicked without clicking anything — a fresh
  install STARTS in this logging-only mode, and one tap in the setup wizard turns live
  clicking on.
- Allow-once mode: when Muse offers an "Allow once" option, prefer that one-shot
  approval over a standing "always" grant.
- Rules: auto-click only the topics you list, and a block-keyword list (delete,
  payment, deploy, …) that is never clicked — blocked cards are logged with the reason.
- Adjustable delay between clicks (milliseconds).
- A click counter and a log of the last 50 clicks, so you can see exactly what it did
  (kind, button label, and context).
- Smart follow-ups: optionally nudge your Muse agent to keep going — including recovery
  prompts when it looks stuck or has hit an error — and restrict sending to hours you
  choose.
- Missions: run a multi-step project-orchestration mission inside one Muse session — an
  ordered sequence of prompts (the GOLIVE READY ladder, or Audit only / Fix findings /
  Release prep) the follow-up engine sends on each idle detection. Watch live progress
  (step n/N · cycle c), send the next step on demand, or pause the mission; a step only
  advances when the send is verified.
- Fast and accessible: approvals are handled faster, a refused send or a blocked card
  always shows its exact reason, the common actions have keyboard shortcuts, and while a
  dialog is open the background is kept out of reach of assistive technology.
- Startup digest: a desktop notification summarizing recent activity (clicks,
  follow-ups, blocked items) — composed on your device.
- Optional settings sync: carry your settings to other Chrome profiles through Chrome's
  built-in sync — off by default, settings only (logs and statistics never sync).
- Codex (ChatGPT) switch: a separate opt-in for chatgpt.com — off by default, living in the
  popup's **Safety & Control** panel next to YOLO. It never
  clicks Deny, never clicks a lone affirmative, never touches auth/connector surfaces
  (Connect, Authorize, link account, API key/token), and keeps standing grants ("Always
  allow", "don't ask again") manual unless YOLO is on.
- A short first-run setup wizard.
- A built-in Statistics page: clicks by day / week / month / year, and by topic
  (repo / project) — light inline charts, instant load.

**Private by design**
- Everything happens on your device. Settings and the click log are stored locally in
  your browser.
- No account, no analytics, no tracking, no remote code. By default nothing is sent to
  any server. The one optional exception: if you enable settings sync (off by default),
  a settings-only subset is mirrored through Chrome's own sync to your Google profile —
  logs and statistics never sync.

Muse Auto-Allow runs only on muse.ai pages (and, with the opt-in Codex switch on,
chatgpt.com), only while you have the extension enabled.

### Tiếng Việt (vi)

Muse Auto-Allow giúp agent Muse của bạn chạy liên tục.

Muse (muse.ai) thường tạm dừng và xin bạn phê duyệt trước khi làm tiếp. Khi bạn rời
máy, các yêu cầu phê duyệt cứ dồn lại và agent phải ngồi chờ. Muse Auto-Allow quan sát
trang Muse ngay trên trình duyệt của bạn và tự bấm **Allow** thay bạn — công việc không
bị ngắt quãng.

**Tiện ích làm gì**
- Nhận biết yêu cầu phê duyệt của Muse và bấm nút **Allow**.
- Xử lý đủ cả bốn cách Muse hiển thị phê duyệt: thẻ phê duyệt có đánh dấu, cặp nút
  Allow/Deny, thẻ thu gọn “Allow Muse to perform this action…” (tiện ích mở ra trước rồi
  mới duyệt), và dải thông báo nền “N tasks need your approval” (tiện ích mở bảng phê
  duyệt để các thẻ đang chờ hiện ra).
- Duyệt được cả ở tab chạy nền, kiểm tra mỗi phút một lần.
- Với công tắc **Codex (ChatGPT)** riêng ở trạng thái bật (tuỳ chọn riêng, mặc định tắt), sự
  cẩn trọng tương tự cũng áp dụng trên chatgpt.com: tiện ích bấm lựa chọn khẳng định trên
  yêu cầu phê duyệt của Codex (“Yes, proceed”, “Allow”, “Approve” — ưu tiên dạng cấp một
  lần) chỉ khi có nút phủ định bấm được nằm trong cùng khối nút, mở trước các thẻ thu gọn
  “Allow Codex to …”, và mở thanh duyệt “A task needs your approval” để bảng phê duyệt hiện ra.

**Tiện ích tuyệt đối không làm**
- Không bao giờ bấm **Deny**, **Reject** hay **Decline**.
- Không bao giờ bấm nút **Allow** đứng một mình, không thuộc một cặp phê duyệt — ví dụ
  dải xin quyền của trình duyệt hay “Allow notifications”.
- Không bao giờ bấm trùng cùng một nút.

**Bạn luôn nắm quyền kiểm soát**
- Công tắc bật/tắt ngay trong popup — tắt bất cứ lúc nào.
- Tạm dừng tự động bấm: ba lựa chọn một chạm — 15 phút, 1 giờ hoặc đến hết ngày mai;
  phím tắt Alt+Shift+P tạm dừng 15 phút (bấm lại để tiếp tục). Popup và huy hiệu trên
  thanh công cụ hiển thị trạng thái đang tạm dừng.
- Chế độ Chạy thử: ghi log đúng những gì sẽ bấm mà không bấm gì cả — bản cài mới BẮT ĐẦU ở
  chế độ chỉ ghi log này, và một lần bấm trong trình hướng dẫn là bật bấm trực tiếp.
- Chế độ ưu tiên "Cho phép một lần": khi Muse đưa ra lựa chọn cấp một lần, tiện ích
  chọn nó thay vì cấp thường trực.
- Quy tắc: chỉ tự bấm cho những chủ đề bạn liệt kê, và danh sách từ khoá chặn (delete,
  payment, deploy, …) không bao giờ bị bấm — thẻ bị chặn được ghi log kèm lý do.
- Chỉnh được độ trễ giữa các lần bấm (mili-giây).
- Bộ đếm số lần bấm và nhật ký 50 lần bấm gần nhất, để bạn thấy rõ tiện ích đã làm gì
  (loại thao tác, nhãn nút, ngữ cảnh).
- Nhắc tiếp thông minh: tuỳ chọn nhắc Muse tiếp tục chạy — kể cả câu nhắc phục hồi khi
  Muse có vẻ bị kẹt hoặc gặp lỗi — và chỉ gửi trong khung giờ bạn chọn.
- Nhiệm vụ: chạy một nhiệm vụ điều phối dự án nhiều bước ngay trong một phiên Muse — chuỗi
  câu nhắc theo thứ tự (thang SẴN SÀNG GOLIVE — Điều phối dự án, hoặc Chỉ kiểm toán / Sửa
  phát hiện / Chuẩn bị phát hành) mà bộ máy gửi tiếp phát đi mỗi lần phát hiện Muse ngừng
  chạy. Theo dõi tiến độ trực tiếp (bước n/N · vòng c), gửi bước kế tiếp khi cần, hoặc tạm
  dừng nhiệm vụ; một bước chỉ tiến khi lần gửi được xác nhận.
- Nhanh và dễ tiếp cận: phê duyệt được xử lý nhanh hơn, lần gửi bị từ chối hoặc thẻ bị
  chặn luôn hiện đúng lý do, phím tắt bao quát các thao tác thường dùng, và khi một hộp
  thoại mở ra thì phần nền được tách khỏi công nghệ hỗ trợ.
- Tóm tắt khi khởi động: thông báo trên máy tóm tắt hoạt động gần đây (lượt bấm, câu
  nhắc, mục bị chặn) — tạo ngay trên thiết bị của bạn.
- Tuỳ chọn đồng bộ cài đặt: mang cài đặt sang các hồ sơ Chrome khác qua tính năng đồng
  bộ sẵn có của Chrome — mặc định tắt, chỉ cài đặt (nhật ký và thống kê không bao giờ
  đồng bộ).
- Công tắc Codex (ChatGPT): tuỳ chọn riêng cho chatgpt.com — mặc định tắt, nằm trong bảng
  **An toàn & Kiểm soát** của popup, cạnh YOLO. Không bao giờ bấm Deny, không bao giờ bấm
  một lựa chọn khẳng định đứng một mình, không bao giờ chạm vào các bề mặt đăng nhập/kết nối
  (Connect, Authorize, liên kết tài khoản, API key/token), và giữ các cấp thường trực
  (“Always allow”, “don't ask again”) ở chế độ thủ công trừ khi bật YOLO.
- Trình hướng dẫn thiết lập 3 bước cho lần dùng đầu tiên.
- Trang Thống kê tích hợp: số lượt bấm theo ngày / tuần / tháng / năm và theo chủ đề
  (repo / dự án) — biểu đồ nhẹ, hiển thị tức thì.

**Riêng tư ngay từ thiết kế**
- Mọi thứ diễn ra trên máy bạn. Cài đặt và nhật ký bấm được lưu cục bộ trong trình duyệt.
- Không tài khoản, không phân tích, không theo dõi, không mã từ xa, và mặc định không gửi
  gì lên máy chủ nào. Nếu bạn bật tuỳ chọn Đồng bộ cài đặt (mặc định tắt), chỉ cài đặt
  được đồng bộ qua Chrome — nhật ký và thống kê không bao giờ được đồng bộ.

Muse Auto-Allow chỉ chạy trên các trang muse.ai (và, khi bật công tắc Codex, trên
chatgpt.com), chỉ khi bạn đang bật tiện ích.

### 简体中文 (zh_CN)

Muse Auto-Allow 让你的 Muse 智能体不再中断。

Muse（muse.ai）在执行操作前会暂停并向你请求批准。你一旦离开，批准提示就会不断堆积，
智能体只能空等。Muse Auto-Allow 在你自己的浏览器里监控 Muse 页面，替你点击
**Allow（允许）**，让任务继续推进。

**它做什么**
- 识别 Muse 的批准请求，并点击 **Allow（允许）** 按钮。
- 覆盖 Muse 展示批准的全部四种方式：带标记的批准卡片、成对的 Allow/Deny 按钮、
  折叠的“Allow Muse to perform this action…”卡片（会先展开再批准），以及后台的
  “N tasks need your approval”横幅（打开批准面板，让待处理卡片显示出来）。
- 后台标签页同样处理，每分钟检查一次。
- 开启自带的 **Codex（ChatGPT）** 开关后（单独的选用项，默认关闭），同样的谨慎也适用于 chatgpt.com：仅在可点击的否定按钮位于同一按钮容器内时，才点击 Codex 批准请求中的肯定选项（“Yes, proceed”“Allow”“Approve”——优先一次性形式）；会先展开折叠的“Allow Codex to …”卡片，并打开“A task needs your approval”审核栏，让批准面板呈现。

**它绝不会做**
- 绝不点击 **Deny**、**Reject** 或 **Decline**。
- 绝不点击不构成批准配对的孤立 **Allow** 按钮——例如浏览器权限横幅或
  “Allow notifications（允许通知）”提示。
- 绝不重复点击同一个按钮。

**你始终掌控**
- 弹窗内置开关，随时可关闭。
- 暂停自动点击：一键选择 15 分钟、1 小时或到明天；快捷键 Alt+Shift+P 暂停 15 分钟（再按一次继续）。弹窗与工具栏徽章会显示暂停状态。
- 试运行模式：只记录将会点击的内容，不实际点击 —— 全新安装会以此仅记录模式开始，在设置向导中一键即可开启实时点击。
- “仅允许一次”模式：当 Muse 提供一次性批准选项时，优先选择它，而不是长期授权。
- 规则：只自动点击你列出的主题，并可用拦截关键词列表（delete、payment、deploy……）——这些卡片绝不会被点击，被拦截的卡片会连同原因记入日志。
- 可调整点击间隔（毫秒）。
- 点击计数器和最近 50 次点击的日志，清楚记录它做了什么（类型、按钮文字、上下文）。
- 智能跟进：可选择催促 Muse 继续工作——包括它看似卡住或出现错误时的恢复提示——并限制在你选择的时间段内发送。
- 任务：在同一个 Muse 会话中运行多步项目编排任务——由自动跟进引擎在每次检测到空闲时按顺序发送的一组提示（“GOLIVE 就绪 — 项目编排”阶梯，或“仅审计 / 修复问题 / 发布准备”）。可实时查看进度（第 n/N 步 · 第 c 轮）、按需发送下一步，或暂停任务；只有发送得到确认后，步骤才会推进。
- 更快、更易用：批准处理更快；发送被拒绝或卡片被拦截时总会显示确切原因；常用操作都有快捷键；对话框打开时，背景会对辅助技术隐藏。
- 启动摘要：桌面通知汇总近期活动（点击、跟进、被拦截项）——在你的设备上生成。
- 可选设置同步：通过 Chrome 内置同步把设置带到其他 Chrome 配置文件——默认关闭，仅同步设置（日志与统计绝不同步）。
- Codex（ChatGPT）开关：面向 chatgpt.com 的独立选用项——默认关闭，位于弹窗的 **安全与控制** 面板中、YOLO 旁边。绝不点击 Deny，绝不点击孤立的肯定选项，绝不触碰认证/连接界面（Connect、Authorize、关联账户、API key/token）；除非开启 YOLO，长期授权（“Always allow”“don't ask again”）保持手动。
- 首次使用时提供三步设置向导。
- 内置统计页：按日 / 周 / 月 / 年以及按主题（仓库 / 项目）的点击次数，轻量图表即时呈现。

**隐私优先**
- 一切都在你的设备上完成。设置和点击日志仅保存在浏览器本地。
- 无需账号，无分析、无追踪、无远程代码，默认也不会向任何服务器发送数据。若开启“同步设置”（默认关闭），仅设置通过 Chrome 同步镜像——日志与统计绝不会同步。

Muse Auto-Allow 仅在 muse.ai 页面上运行（开启 Codex 开关后还包括 chatgpt.com），且只在你启用该扩展时运行。

### 日本語 (ja)

Muse Auto-Allow は、あなたの Muse エージェントを止めずに動かし続けます。

Muse（muse.ai）は操作の前に承認を求めて一時停止します。席を外すと承認リクエストが
溜まっていき、エージェントは待機したままになります。Muse Auto-Allow は、あなた自身の
ブラウザで Muse のページを見守り、代わりに **Allow（許可）** をクリックします。

**できること**
- Muse の承認リクエストを検出し、**Allow（許可）** ボタンをクリックします。
- Muse が承認を表示する 4 通りの方法すべてに対応します。マーク付きの承認カード、
  Allow／Deny のボタンペア、折りたたまれた「Allow Muse to perform this action…」
  カード（まず展開してから承認）、そしてバックグラウンドの
  「N tasks need your approval」バナー（承認パネルを開いて保留カードを表示）。
- バックグラウンドのタブでも処理し、1 分ごとに確認します。
- 付属の **Codex（ChatGPT）** スイッチをオンにした場合（別個のオプトイン、既定はオフ）、
  同じ慎重さで chatgpt.com にも対応します。クリック可能な否定側ボタンが同じボタン
  コンテナ内にあるときだけ、Codex の承認リクエストの肯定オプション（「Yes, proceed」
  「Allow」「Approve」— ワンショット形式を優先）をクリックします。折りたたまれた
  「Allow Codex to …」カードは先に展開し、「A task needs your approval」レビューバーを
  開いて承認パネルを表示させます。

**決してしないこと**
- **Deny**、**Reject**、**Decline** は絶対にクリックしません。
- 承認ペアの一部ではない単独の **Allow** ボタン（ブラウザの許可バナーや
  「Allow notifications（通知を許可）」など）はクリックしません。
- 同じボタンを二度クリックすることはありません。

**主導権はあなたに**
- ポップアップのオン／オフスイッチでいつでも停止できます。
- 自動クリックの一時停止：ワンタップで「15 分」「1 時間」「明日まで」から選べます。ショートカット Alt+Shift+P は 15 分間の一時停止（もう一度押すと再開）。ポップアップとツールバーのバッジに一時停止中と表示されます。
- ドライラン：クリックされる内容だけを記録し、実際には何もクリックしません — 新規インストールはこの記録のみモードで始まり、セットアップ ウィザードのワンタップでライブ クリックをオンにできます。
- 「一度だけ許可」モード：Muse が 1 回限りの許可を提示したときは、常設の許可ではなくそちらを優先します。
- ルール：指定したトピックだけを自動クリックし、ブロックするキーワード一覧（delete、payment、deploy など）に該当するカードは決してクリックしません — ブロックしたカードは理由付きで記録されます。
- クリック間隔（ミリ秒）を調整できます。
- クリック回数と直近 50 件のクリックログで、何をしたかを確認できます
  （種類・ボタン名・コンテキスト）。
- スマートフォロー：Muse の続行をうながす通知（停止しているように見えるときやエラーが出たときの復帰プロンプトを含む）を任意で送信でき、送信する時間帯も指定できます。
- ミッション：1 つの Muse セッション内で多段階のプロジェクト統括ミッションを実行します。自動フォローアップがアイドル検出ごとに順番に送るプロンプト群（「GOLIVE レディ — プロジェクト統括」のラダー、または「監査のみ／指摘の修正／リリース準備」）です。進捗（ステップ n/N · サイクル c）をライブで確認し、次のステップをその場で送信したり、ミッションを一時停止できます。送信が確認されたときだけステップが進みます。
- すばやく、使いやすく：承認の処理が速くなり、送信が拒否されたときやカードがブロックされたときは必ず正確な理由が表示されます。よく使う操作はキーボードショートカットに対応し、ダイアログを開いている間は背景が支援技術から切り離されます。
- 起動時のダイジェスト：最近の動き（クリック、フォロー、ブロック）をまとめたデスクトップ通知 — 端末上で作成されます。
- 設定の同期（任意）：Chrome 標準の同期で設定を他の Chrome プロファイルへ引き継ぎます — 既定でオフ、同期するのは設定のみ（ログと統計は決して同期しません）。
- Codex（ChatGPT）スイッチ：chatgpt.com 用の別個のオプトイン — 既定はオフ、ポップアップの
  **安全と制御** パネルで YOLO の隣にあります。Deny は決してクリックせず、単独の肯定
  オプションも決してクリックせず、認証・接続の画面（Connect、Authorize、アカウント連携、
  API key/token）には決して触れません。常設の許可（「Always allow」「don't ask again」）は
  YOLO をオンにしない限り手動のままです。
- 初回起動時の 3 ステップ設定ウィザード。
- 内蔵の統計ページ：日 / 週 / 月 / 年別、トピック別（リポジトリ / プロジェクト）のクリック数を軽量チャートですぐ表示。

**プライバシー重視の設計**
- すべて端末上で完結します。設定とクリックログはブラウザ内にローカル保存されます。
- アカウント不要、解析なし、トラッキングなし、リモートコードなし。既定ではサーバーへの送信は
  一切ありません。「設定の同期」（既定でオフ）を有効にした場合のみ、設定が Chrome の同期で
  ミラーされます。ログと統計は同期されません。

Muse Auto-Allow は muse.ai のページでのみ（Codex スイッチをオンにした場合は
chatgpt.com でも）、あなたが拡張機能を有効にしている間だけ動作します。

### 한국어 (ko)

Muse Auto-Allow는 Muse 에이전트가 멈추지 않고 계속 작동하게 합니다.

Muse(muse.ai)는 작업 전에 승인을 요청하며 잠시 멈춥니다. 자리를 비우면 승인 요청이
쌓이고 에이전트는 그대로 대기합니다. Muse Auto-Allow는 사용자의 브라우저에서 Muse
페이지를 지켜보며 대신 **Allow(허용)** 를 클릭합니다.

**하는 일**
- Muse의 승인 요청을 감지하고 **Allow(허용)** 버튼을 클릭합니다.
- Muse가 승인을 표시하는 네 가지 방식 모두 처리합니다. 표시된 승인 카드,
  Allow/Deny 버튼 쌍, 접힌 “Allow Muse to perform this action…” 카드(먼저 펼친 뒤 승인),
  그리고 백그라운드의 “N tasks need your approval” 배너(승인 패널을 열어 대기 중인
  카드가 표시되게 함)입니다.
- 백그라운드 탭에서도 처리하며 1분마다 확인합니다.
- 자체 **Codex(ChatGPT)** 스위치를 켠 경우(별도의 옵트인, 기본 꺼짐), 동일한 주의 원칙이
  chatgpt.com에도 적용됩니다. 클릭 가능한 부정 버튼이 같은 버튼 컨테이너 안에 있을 때만
  Codex 승인 요청의 긍정 옵션(“Yes, proceed”, “Allow”, “Approve” — 일회성 형식 우선)을
  클릭하고, 접힌 “Allow Codex to …” 카드를 먼저 펼치며, “A task needs your approval”
  검토 바를 열어 승인 패널이 렌더링되게 합니다.

**절대 하지 않는 일**
- **Deny**, **Reject**, **Decline** 은 절대 클릭하지 않습니다.
- 승인 쌍의 일부가 아닌 단독 **Allow** 버튼(브라우저 권한 배너나
  “Allow notifications(알림 허용)” 등)은 클릭하지 않습니다.
- 같은 버튼을 두 번 클릭하지 않습니다.

**제어권은 사용자에게**
- 팝업의 켜기/끄기 스위치로 언제든 중지할 수 있습니다.
- 자동 클릭 일시정지: 15분, 1시간, 내일까지 중 한 번에 선택할 수 있습니다. 단축키 Alt+Shift+P는 15분 동안 일시정지합니다(다시 누르면 재개). 팝업과 도구 모음 배지에 일시정지 상태가 표시됩니다.
- 드라이런 모드: 클릭될 내용만 기록하고 실제로는 아무것도 클릭하지 않습니다 — 새로 설치하면 이 기록 전용 모드로 시작하고, 설정 마법사에서 한 번 누르면 실시간 클릭이 켜집니다.
- "한 번만 허용" 모드: Muse가 일회성 승인 옵션을 제시하면 상시 권한 대신 그것을 우선합니다.
- 규칙: 지정한 주제만 자동으로 클릭하고, 차단 키워드 목록(delete, payment, deploy 등)에 해당하는 카드는 절대 클릭하지 않습니다 — 차단된 카드는 사유와 함께 기록됩니다.
- 클릭 간 간격(밀리초)을 조절할 수 있습니다.
- 클릭 횟수와 최근 50건의 클릭 로그로 무엇을 했는지 확인할 수 있습니다
  (종류, 버튼 이름, 맥락).
- 스마트 팔로우: Muse가 계속 진행하도록 선택적으로 재촉하며(멈춘 것처럼 보이거나 오류가 날 때의 복구 프롬프트 포함), 보낼 시간대를 지정할 수 있습니다.
- 미션: 하나의 Muse 세션 안에서 여러 단계로 이루어진 프로젝트 오케스트레이션 미션을 실행합니다. 자동 후속 엔진이 유휴 감지 때마다 순서대로 보내는 프롬프트 묶음('GOLIVE 준비 — 프로젝트 오케스트레이터' 사다리 또는 '감사 전용 / 지적 사항 수정 / 릴리스 준비')입니다. 진행 상황(n/N 단계 · c 사이클)을 실시간으로 보고, 다음 단계를 즉시 보내거나 미션을 일시정지할 수 있습니다. 전송이 확인될 때만 단계가 진행됩니다.
- 빠르고 접근성 좋게: 승인 처리가 더 빨라졌고, 전송이 거부되거나 카드가 차단되면 정확한 사유를 항상 표시합니다. 자주 쓰는 동작은 키보드 단축키로 처리하며, 대화상자가 열려 있는 동안 배경은 보조 기술에서 분리됩니다.
- 시작 시 요약: 최근 활동(클릭, 팔로우, 차단 항목)을 정리한 데스크톱 알림 — 기기에서 생성됩니다.
- 설정 동기화(선택): Chrome 기본 동기화로 설정을 다른 Chrome 프로필로 가져갑니다 — 기본 꺼짐, 설정만 동기화되며 로그와 통계는 절대 동기화되지 않습니다.
- Codex(ChatGPT) 스위치: chatgpt.com용 별도 옵트인 — 기본 꺼짐, 팝업의 **안전 및 제어**
  패널에서 YOLO 옆에 있습니다. Deny는 절대 클릭하지 않고, 단독 긍정 옵션도 절대 클릭하지
  않으며, 인증/연결 화면(Connect, Authorize, 계정 연결, API key/token)은 절대 건드리지
  않습니다. 상시 권한(“Always allow”, “don't ask again”)은 YOLO를 켜지 않는 한 수동으로
  유지됩니다.
- 첫 실행 시 3단계 설정 마법사.
- 내장 통계 페이지: 일 / 주 / 월 / 년 및 주제별(저장소 / 프로젝트) 클릭 수를 가벼운 차트로 즉시 표시.

**설계부터 개인정보 보호**
- 모든 동작은 사용자 기기에서 이루어집니다. 설정과 클릭 로그는 브라우저에 로컬로
  저장됩니다.
- 계정도, 분석도, 추적도, 원격 코드도 없으며 기본적으로 어떤 서버로도 전송하지 않습니다.
  '설정 동기화'(기본 꺼짐)를 켜면 설정만 Chrome 동기화로 미러링되며, 로그와 통계는
  동기화되지 않습니다.

Muse Auto-Allow는 muse.ai 페이지에서만(Codex 스위치를 켠 경우 chatgpt.com에서도),
그리고 확장 기능을 켜 둔 동안에만 실행됩니다.

### Español (es)

Muse Auto-Allow mantiene tu agente de Muse en marcha.

Muse (muse.ai) se detiene y te pide aprobación antes de continuar. Cuando te alejas, esas
solicitudes se acumulan y tu agente se queda esperando. Muse Auto-Allow vigila la página
de Muse en tu propio navegador y pulsa **Allow (Permitir)** por ti, para que el trabajo no
se detenga.

**Qué hace**
- Detecta las solicitudes de aprobación de Muse y pulsa el botón **Allow (Permitir)**.
- Cubre las cuatro formas en que Muse muestra una aprobación: tarjetas de aprobación
  marcadas, pares de botones Permitir/Denegar, tarjetas contraídas
  “Allow Muse to perform this action…” (las expande primero) y el aviso de fondo
  “N tasks need your approval” (abre el panel de aprobaciones para que se muestren las
  tarjetas pendientes).
- También atiende las pestañas en segundo plano, revisando una vez por minuto.
- Con su propio interruptor **Codex (ChatGPT)** activado (una opción aparte, desactivada por
  defecto), el mismo cuidado se aplica en chatgpt.com: pulsa la opción afirmativa en las
  solicitudes de aprobación de Codex (“Yes, proceed”, “Allow”, “Approve” — se prefieren las
  formas de una sola vez) solo cuando hay un botón negativo pulsable en el mismo contenedor
  de botones, expande primero las tarjetas contraídas “Allow Codex to …” y abre la barra
  “A task needs your approval” para que se muestre el panel de aprobaciones.

**Lo que nunca hará**
- Nunca pulsa **Deny**, **Reject** ni **Decline**.
- Nunca pulsa un botón **Allow** aislado que no forme parte de un par de aprobación, por
  ejemplo los avisos de permisos del navegador o “Allow notifications”.
- Nunca pulsa el mismo botón dos veces.

**Tú tienes el control**
- Interruptor de encendido/apagado en la ventana emergente: desactívalo cuando quieras.
- Pausar el clic automático: tres opciones de un toque — 15 minutos, 1 hora o hasta mañana; el atajo Alt+Shift+P pausa 15 minutos (púlsalo otra vez para reanudar). La ventana y el distintivo de la barra muestran el estado de pausa.
- Modo Prueba: registra exactamente lo que se pulsaría sin pulsar nada — una instalación nueva EMPIEZA en este modo de solo registro, y un toque en el asistente de configuración activa el clic en vivo.
- Modo «Permitir una vez»: cuando Muse ofrece una aprobación de una sola vez, la prefiere frente a un permiso permanente.
- Reglas: pulsa solo los temas que indiques y una lista de palabras bloqueadas (delete, payment, deploy…) que nunca se pulsa: las tarjetas bloqueadas se registran con el motivo.
- Retardo ajustable entre clics (milisegundos).
- Contador de clics y registro de los últimos 50, para que veas exactamente qué hizo
  (tipo, texto del botón y contexto).
- Seguimientos inteligentes: avisa opcionalmente a Muse para que siga trabajando —incluidos mensajes de recuperación cuando parece bloqueado o ha dado un error— y limita el envío a las horas que elijas.
- Misiones: ejecuta una misión de orquestación de proyecto de varios pasos dentro de una sola sesión de Muse: una secuencia ordenada de mensajes (la escalera «LISTO PARA GOLIVE — Orquestador de proyecto», o «SOLO AUDITORÍA / CORREGIR HALLAZGOS / PREPARACIÓN DE LANZAMIENTO») que el motor de seguimiento envía en cada detección de inactividad. Sigue el progreso en vivo (paso n/N · ciclo c), envía el siguiente paso cuando quieras o pausa la misión; un paso solo avanza cuando el envío queda confirmado.
- Ágil y accesible: las aprobaciones se gestionan más rápido, un envío rechazado o una tarjeta bloqueada siempre muestra el motivo exacto, los atajos de teclado cubren las acciones habituales y, mientras un cuadro de diálogo está abierto, el fondo queda fuera del alcance de las tecnologías de asistencia.
- Resumen al arrancar: una notificación de escritorio que resume la actividad reciente (clics, seguimientos, bloqueos), compuesta en tu dispositivo.
- Sincronización de ajustes opcional: lleva tus ajustes a otros perfiles de Chrome mediante la sincronización propia de Chrome — desactivada por defecto, solo ajustes (los registros y las estadísticas nunca se sincronizan).
- Interruptor Codex (ChatGPT): una opción aparte para chatgpt.com — desactivada por defecto,
  dentro del panel **Seguridad y control** de la ventana emergente, junto a YOLO. Nunca pulsa
  Deny, nunca pulsa una opción afirmativa aislada, nunca toca las pantallas de autenticación o
  conexión (Connect, Authorize, vincular cuenta, API key/token) y mantiene los permisos
  permanentes (“Always allow”, “don't ask again”) en manual salvo con YOLO activado.
- Un asistente de configuración de 3 pasos en el primer uso.
- Página de estadísticas integrada: clics por día / semana / mes / año y por tema (repositorio / proyecto), con gráficos ligeros.

**Privacidad desde el diseño**
- Todo ocurre en tu dispositivo. Los ajustes y el registro de clics se guardan localmente
  en tu navegador.
- Sin cuenta, sin analítica, sin rastreo, sin código remoto y, por defecto, sin enviar nada
  a ningún servidor. Si activas la sincronización de ajustes (desactivada por defecto),
  solo los ajustes se replican mediante Chrome; los registros y estadísticas nunca se
  sincronizan.

Muse Auto-Allow solo se ejecuta en páginas de muse.ai (y, con el interruptor de Codex
activado, en chatgpt.com), y solo mientras tengas la extensión activada.

---

## 3. Category

**Productivity.** Muse Auto-Allow removes a repetitive approval step from a workflow and
saves the user time; it is a productivity utility, not a communication, developer or
entertainment item.

---

## 4. Single purpose statement

> **Single purpose:** Muse Auto-Allow automatically clicks the **Allow** button (and, on
> chatgpt.com, the affirmative option on Codex approval requests) displayed by the user's
> own agent UI in the user's own browser, so the user's agent runs without stopping for
> manual approvals.

Every part of the extension serves this one purpose. It does nothing else: it does not
browse the web for the user, it does not modify, collect, or transmit page content, and
it does not interact with any site other than muse.ai — and, while the user has the
opt-in Codex (ChatGPT) switch on, chatgpt.com.

---

## 5. Permission justifications (dashboard → Privacy practices)

### `storage`
Saves the user's own settings (on/off state, click delay, click counter, pause, rules,
follow-up options, compact click statistics) and the local click log (the last 50 clicks)
so the popup and statistics page can show the current state and history. Data stays in
`chrome.storage.local` on the user's device and is never transmitted. Also backs the
optional, off-by-default settings sync — a settings-only mirror through
`chrome.storage.sync` into the user's own Google Account; logs and statistics never sync.

### `alarms`
Schedules a once-a-minute nudge so the extension can process approval requests that
appear in background tabs, not only the tab the user is looking at. The alarm only
triggers local detection/clicking on already-open muse.ai pages; it makes no network
requests.

### `notifications`
Shows the local activity digest — a short summary of recent clicks, follow-ups, and
blocked items — as a desktop notification on browser startup. The digest is composed on
the user's device from locally stored data; the permission is used only to display it.

### `commands` (keyboard shortcuts — not a permission)
The manifest declares two keyboard shortcuts: `toggle-pause` (Alt+Shift+P) and
`send-followup` (Alt+Shift+F). `commands` is a manifest key, not a permission — there is
no dashboard justification field for it, and it grants no extra access.

### Host permission — `https://muse.ai/*` and `https://*.muse.ai/*`
Required to run the content script that detects and clicks the Allow button, and only on
Muse pages. A host permission (rather than `activeTab`) is necessary because approvals
can appear in background tabs while the user is elsewhere, so the extension must be able
to act without the user actively clicking the toolbar icon. No other site is requested.

### Host permission — `https://chatgpt.com/*` and `https://*.chatgpt.com/*`
Required to run the Codex (ChatGPT) content script that detects and clicks the
affirmative option on Codex approval requests on chatgpt.com — used **only** while the
user has turned on the opt-in Codex switch (off by default; with it off the script reads
settings and does nothing). Same background-tab rationale as the Muse host permission.
No other site is requested.

**Permissions deliberately NOT requested** (worth stating in the review note): no
`tabs`, no `scripting`, no `webRequest`, no `<all_urls>`, no `cookies`, no `downloads`.
The extension needs none of them.

---

## 6. Remote code declaration

> **Remote code: none.** This extension ships no remote code. All JavaScript is bundled
> inside the package (`content.js`, `codex.js`, `background.js`, `popup.js`); nothing is
> downloaded, evaluated, or loaded from a remote source at runtime. There is no `eval`,
> no `new Function`, no external `<script src>`, and no network requests of any kind.
> The extension makes zero calls to any server.

Compliance notes for this declaration:
- Manifest V3, no `content_security_policy` relaxation.
- No analytics SDK, no CDN, no update endpoint. (The optional settings sync uses
  Chrome's built-in sync service — a browser feature, not an extension network call.)
- `dist/muse-auto-allow-v1.10.1.zip` contains only static files with `manifest.json` at the
  zip root.

---

## 7. Data usage / Privacy practices tab — answers

These map to the Chrome Web Store **Privacy practices** form.

**7.1 Data collection**
- Does the extension collect or use user data? → **No** (nothing is sent to the developer;
  the optional, off-by-default settings sync is disclosed in 7.2).
- Data types collected (personally identifiable information, health, financial and
  payment, authentication, personal communications, location, web history, user activity,
  website content): → **None.**

**7.2 Data usage / purpose**
- Is data sold to third parties? → **No.**
- Is data used or transferred for purposes that are unrelated to the item's single
  purpose? → **No.**
- Is data used or transferred to determine creditworthiness or for lending purposes?
  → **No.**
- Is data used to personalize ads or for advertising? → **No.**
- Is data transmitted off the user's device? → **No, by default.** Settings and the
  click log are stored only in `chrome.storage.local`. If the user explicitly enables
  the optional Sync settings feature, a settings-only subset mirrors via
  `chrome.storage.sync` into the user's own Google Account; the click log, statistics,
  and counters never sync.

**7.3 Certifications to check in the dashboard**
- [x] I do not sell or transfer user data to third parties, outside of the approved use
  cases.
- [x] I do not use or transfer user data for purposes that are unrelated to my item's
  single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending
  purposes.

**7.4 Review note (paste into “Notes for the reviewer”)**

```
Muse Auto-Allow has a single purpose: on muse.ai pages it auto-clicks the "Allow"
button on Muse's own approval-request UI, and — only while the user has turned on the
separate opt-in Codex (ChatGPT) switch (off by default) — it clicks the affirmative
option ("Yes, proceed"/"Allow"/"Approve") on Codex approval requests on chatgpt.com,
so the user's agent does not stop for manual approvals. It calls no remote servers,
contains no remote code, and sends no data to the developer. Settings, a local
last-50 click log and compact click statistics live in chrome.storage.local. The
optional "Sync settings" feature is off by default; when enabled it mirrors a
settings-only subset through Chrome's built-in sync into the user's own Google Account
(never logs or statistics). It never clicks Deny/Reject/Decline, never clicks lone
"Allow" permission banners, and never touches auth/connector surfaces (Connect,
Authorize, API key) — those stay manual. Permissions: storage (local settings + log;
optional settings sync), alarms (once-a-minute check so background-tab approvals are
handled), notifications (show the locally-composed activity digest), host permissions
muse.ai and chatgpt.com (detect/click the approval options on those two sites only).
Keyboard shortcuts (commands: Alt+Shift+P pause, Alt+Shift+F follow-up) need no extra
permission. See https://blueskyz-labs.github.io/muse-auto-allow/privacy.html.
```

> The privacy-policy URL is filled: `https://blueskyz-labs.github.io/muse-auto-allow/privacy.html`
> (GitHub Pages; verified live 2026-10-12). `store/PRIVACY.md` remains the source document.

---

## 8. Store assets checklist

The dashboard requires these images. Provide them at the exact sizes below.

| Asset | Requirement | Source in this repo | Status |
|---|---|---|---|
| Extension icon | 128×128 px PNG | `extension/icons/icon128.png` | ✅ present |
| Screenshots | 1280×800 px PNG (up to 5) | `store/screenshot1.png` (live runtime capture), `store/screenshot2-stats.png` (Statistics), `store/screenshot3-popup.png` (popup on stage), `store/screenshot4-overview.png` (designed overview), `store/screenshot5-safety.png` (first-run safety step: logging-only statement, consent line, one-tap live clicking) | ✅ 5 present, all verified 1280×800 |
| Small promo tile | 440×280 px PNG | `store/promo440x280.png` | ✅ present (verified 440×280) |
| Marquee promo tile | 1400×560 px (optional) | `store/marquee1400x560.png` | ✅ present (verified 1400×560) |

All showcase images use strictly fictional demo data (Example Org, demo-project,
sample-app, web-starter, notes-app, files.example.com) — never real projects or personal
data. Full inventory + regenerate commands: `store/SHOWCASE.md`.

Upload steps: **Store listing → Graphic assets** → upload the icon (also validated by
Chrome from the package), the five 1280×800 screenshots, the 440×280 promo tile and the
1400×560 marquee.

Screenshot guidance (verify before submit that the uploaded images match these sizes): show the real Muse approval card with the extension's popup open
(click counter + log visible). Do **not** use a mockup that implies the extension does
anything beyond its single purpose, and do not put misleading wording in the image.
A second image (`store/screenshot2-stats.png`, 1280x800) shows the Statistics page with
real chart data; it must stay a truthful capture (the numbers come from the extension's
own local storage).

---

## 9. Support / contact placeholders

| Field | Value |
|---|---|
| Developer / publisher name | BlueSkyz Labs — owner to confirm the exact legal/display name in the dashboard before publishing (no repo value to fill) |
| Support email | `TODO: fill before submit` |
| Support / homepage URL | `https://github.com/BlueSkyz-Labs/muse-auto-allow` |
| Privacy policy URL | `https://blueskyz-labs.github.io/muse-auto-allow/privacy.html` (hosted from `store/PRIVACY.md`; verified live 2026-10-12) |
| License | MIT © 2026 BlueSkyz Labs |

Before clicking **Submit for review**, replace the one remaining `TODO: fill before
submit` marker (the support email) and confirm the publisher display name in the
dashboard. The homepage and privacy-policy URLs are already filled and verified live.
The Chrome Web Store will not accept a listing without a valid privacy policy URL and a
working support contact once any data-practices disclosure is present.
