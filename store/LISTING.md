# Muse Auto-Allow — Chrome Web Store Listing Kit

Everything the Chrome Web Store dashboard asks for, ready to paste. Copy fields are
provided in all six supported languages (en, vi, zh_CN, ja, ko, es). Values marked
`TODO: fill before submit` must be replaced by the owner before uploading.

---

## 1. Item metadata

| Field | Value |
|---|---|
| Item name | **Muse Auto-Allow** |
| Category | **Productivity** |
| Default language | English (en) |
| Version | 1.5.0 |
| Manifest version | Manifest V3 |
| Extension package | `dist/muse-auto-allow-v1.5.0.zip` |
| License | MIT © 2026 BlueSkyz Labs |
| Homepage / support URL | `TODO: fill before submit` |
| Privacy policy URL | `TODO: fill before submit` (host `store/PRIVACY.md` and paste the public link) |
| Support email | `TODO: fill before submit` |

### Short description (English, ≤132 characters)

```
Auto-click Allow on Muse (muse.ai) approval requests so your agent keeps running. Local-only, no data sent.
```

> Verified length: 107 characters (limit 132). Every other locale below repeats the
> item name as-is; the Chrome Web Store lets you localize the short description per
> language in the **Store listing → localized** tab.

---

## 2. Detailed description (all six languages)

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

**What it will never do**
- It never clicks **Deny**, **Reject**, or **Decline**.
- It never clicks a lone **Allow** button that is not part of an approval pair — for
  example browser permission banners or “Allow notifications” prompts.
- It never clicks the same button twice.

**You stay in control**
- On/off switch in the popup — turn it off at any time.
- Adjustable delay between clicks (milliseconds).
- A click counter and a log of the last 50 clicks, so you can see exactly what it did
  (kind, button label, and context).
- A built-in Statistics page: clicks by day / week / month / year, and by topic
  (repo / project) — light inline charts, instant load.

**Private by design**
- Everything happens on your device. Settings and the click log are stored locally in
  your browser.
- No account, no analytics, no tracking, no remote code, and nothing is ever sent to
  any server.

Muse Auto-Allow runs only on muse.ai pages, only while you have the extension enabled.

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

**Tiện ích tuyệt đối không làm**
- Không bao giờ bấm **Deny**, **Reject** hay **Decline**.
- Không bao giờ bấm nút **Allow** đứng một mình, không thuộc một cặp phê duyệt — ví dụ
  băng xin quyền của trình duyệt hay “Allow notifications”.
- Không bao giờ bấm trùng cùng một nút.

**Bạn luôn nắm quyền**
- Công tắc bật/tắt ngay trong popup — tắt bất cứ lúc nào.
- Chỉnh được độ trễ giữa các lần bấm (mili-giây).
- Bộ đếm số lần bấm và nhật ký 50 lần bấm gần nhất, để bạn thấy rõ tiện ích đã làm gì
  (loại thao tác, nhãn nút, ngữ cảnh).
- Trang Thống kê sẵn có: số lượt bấm theo ngày / tuần / tháng / năm và theo chủ đề
  (repo / dự án) — biểu đồ nhẹ, hiển thị tức thì.

**Riêng tư từ thiết kế**
- Mọi thứ diễn ra trên máy bạn. Cài đặt và nhật ký bấm được lưu cục bộ trong trình duyệt.
- Không tài khoản, không phân tích, không theo dõi, không mã từ xa, và không gửi gì lên
  máy chủ nào.

Muse Auto-Allow chỉ chạy trên các trang muse.ai, và chỉ khi bạn đang bật tiện ích.

### 简体中文 (zh_CN)

Muse Auto-Allow 让你的 Muse 智能体不再中断。

Muse（muse.ai）在执行操作前会暂停并向你请求批准。你一旦离开，批准提示就会不断堆积，
智能体只能空等。Muse Auto-Allow 在你自己的浏览器里监视 Muse 页面，替你点击
**Allow（允许）**，让任务继续推进。

**它做什么**
- 识别 Muse 的批准请求，并点击 **Allow（允许）** 按钮。
- 覆盖 Muse 展示批准的全部四种方式：带标记的批准卡片、成对的 Allow/Deny 按钮、
  折叠的“Allow Muse to perform this action…”卡片（会先展开再批准），以及后台的
  “N tasks need your approval”横幅（打开批准面板，让待处理卡片渲染出来）。
- 后台标签页同样处理，每分钟检查一次。

**它绝不会做**
- 绝不点击 **Deny**、**Reject** 或 **Decline**。
- 绝不点击不构成批准配对的孤立 **Allow** 按钮——例如浏览器权限横幅或
  “Allow notifications（允许通知）”提示。
- 绝不重复点击同一个按钮。

**你始终掌控**
- 弹窗内置开关，随时可关闭。
- 可调整点击间隔（毫秒）。
- 点击计数器和最近 50 次点击的日志，清楚记录它做了什么（类型、按钮文字、上下文）。
- 内置统计页：按日 / 周 / 月 / 年以及按主题（仓库 / 项目）的点击次数，轻量图表即时呈现。

**隐私优先**
- 一切都在你的设备上完成。设置和点击日志仅保存在浏览器本地。
- 无需账号，无分析、无追踪、无远程代码，也不会向任何服务器发送数据。

Muse Auto-Allow 仅在 muse.ai 页面上运行，且只在你启用该扩展时运行。

### 日本語 (ja)

Muse Auto-Allow は、あなたの Muse エージェントを止めずに動かし続けます。

Muse（muse.ai）は操作の前に承認を求めて一時停止します。席を外すと承認リクエストが
溜まっていき、エージェントは待ったままになります。Muse Auto-Allow は、あなた自身の
ブラウザで Muse のページを見守り、代わりに **Allow（許可）** をクリックします。

**できること**
- Muse の承認リクエストを検出し、**Allow（許可）** ボタンをクリックします。
- Muse が承認を表示する 4 通りの方法すべてに対応します。マーク付きの承認カード、
  Allow／Deny のボタンペア、折りたたまれた「Allow Muse to perform this action…」
  カード（まず展開してから承認）、そしてバックグラウンドの
  「N tasks need your approval」バナー（承認パネルを開いて保留カードを表示）。
- バックグラウンドのタブでも処理し、1 分ごとに確認します。

**決してしないこと**
- **Deny**、**Reject**、**Decline** は絶対にクリックしません。
- 承認ペアの一部ではない単独の **Allow** ボタン（ブラウザの許可バナーや
  「Allow notifications（通知を許可）」など）はクリックしません。
- 同じボタンを二度クリックすることはありません。

**常にあなたが主導**
- ポップアップのオン／オフスイッチでいつでも停止できます。
- クリック間隔（ミリ秒）を調整できます。
- クリック回数と直近 50 件のクリックログで、何をしたかを確認できます
  （種類・ボタン名・コンテキスト）。
- 内蔵の統計ページ：日 / 週 / 月 / 年別、トピック別（リポジトリ / プロジェクト）のクリック数を軽量チャートですぐ表示。

**プライバシー重視の設計**
- すべて端末上で完結します。設定とクリックログはブラウザ内にローカル保存されます。
- アカウント不要、解析なし、トラッキングなし、リモートコードなし。サーバーへの送信は
  一切ありません。

Muse Auto-Allow は muse.ai のページでのみ、あなたが拡張機能を有効にしている間だけ動作
します。

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

**절대 하지 않는 일**
- **Deny**, **Reject**, **Decline** 은 절대 클릭하지 않습니다.
- 승인 쌍의 일부가 아닌 단독 **Allow** 버튼(브라우저 권한 배너나
  “Allow notifications(알림 허용)” 등)은 클릭하지 않습니다.
- 같은 버튼을 두 번 클릭하지 않습니다.

**항상 사용자가 제어**
- 팝업의 켜기/끄기 스위치로 언제든 중지할 수 있습니다.
- 클릭 간 간격(밀리초)을 조절할 수 있습니다.
- 클릭 횟수와 최근 50건의 클릭 로그로 무엇을 했는지 확인할 수 있습니다
  (종류, 버튼 이름, 맥락).
- 내장 통계 페이지: 일 / 주 / 월 / 년 및 주제별(저장소 / 프로젝트) 클릭 수를 가벼운 차트로 즉시 표시.

**설계부터 개인정보 보호**
- 모든 동작은 사용자 기기에서 이루어집니다. 설정과 클릭 로그는 브라우저에 로컬로
  저장됩니다.
- 계정도, 분석도, 추적도, 원격 코드도 없으며 어떤 서버로도 전송하지 않습니다.

Muse Auto-Allow는 muse.ai 페이지에서만, 그리고 확장 기능을 켜 둔 동안에만 실행됩니다.

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
  “N tasks need your approval” (abre el panel de aprobaciones para que se rendericen las
  tarjetas pendientes).
- También atiende las pestañas en segundo plano, revisando una vez por minuto.

**Lo que nunca hará**
- Nunca pulsa **Deny**, **Reject** ni **Decline**.
- Nunca pulsa un botón **Allow** aislado que no forme parte de un par de aprobación, por
  ejemplo los avisos de permisos del navegador o “Allow notifications”.
- Nunca pulsa el mismo botón dos veces.

**Tú tienes el control**
- Interruptor de encendido/apagado en la ventana emergente: desactívalo cuando quieras.
- Retardo ajustable entre clics (milisegundos).
- Contador de clics y registro de los últimos 50, para que veas exactamente qué hizo
  (tipo, texto del botón y contexto).
- Página de estadísticas integrada: clics por día / semana / mes / año y por tema (repositorio / proyecto), con gráficos ligeros.

**Privacidad desde el diseño**
- Todo ocurre en tu dispositivo. Los ajustes y el registro de clics se guardan localmente
  en tu navegador.
- Sin cuenta, sin analítica, sin rastreo, sin código remoto y sin enviar nada a ningún
  servidor.

Muse Auto-Allow solo se ejecuta en páginas de muse.ai, y solo mientras tengas la extensión
activada.

---

## 3. Category

**Productivity.** Muse Auto-Allow removes a repetitive approval step from a workflow and
saves the user time; it is a productivity utility, not a communication, developer or
entertainment item.

---

## 4. Single purpose statement

> **Single purpose:** Muse Auto-Allow automatically clicks the **Allow** button on
> approval requests displayed by Muse (muse.ai) in the user's own browser, so the user's
> Muse agent runs without stopping for manual approvals.

Every part of the extension serves this one purpose. It does nothing else: it does not
browse the web for the user, it does not modify, collect, or transmit page content, and
it does not interact with any site other than muse.ai.

---

## 5. Permission justifications (dashboard → Privacy practices)

### `storage`
Saves the user's own settings (on/off state, click delay, click counter, compact click
statistics) and the local click log (the last 50 clicks) so the popup and statistics page can
show the current state and history. Data stays in
`chrome.storage.local` on the user's device and is never transmitted.

### `alarms`
Schedules a once-a-minute nudge so the extension can process approval requests that
appear in background tabs, not only the tab the user is looking at. The alarm only
triggers local detection/clicking on already-open muse.ai pages; it makes no network
requests.

### Host permission — `https://muse.ai/*` and `https://*.muse.ai/*`
Required to run the content script that detects and clicks the Allow button, and only on
Muse pages. A host permission (rather than `activeTab`) is necessary because approvals
can appear in background tabs while the user is elsewhere, so the extension must be able
to act without the user actively clicking the toolbar icon. No other site is requested.

**Permissions deliberately NOT requested** (worth stating in the review note): no
`tabs`, no `scripting`, no `webRequest`, no `<all_urls>`, no `cookies`, no `downloads`.
The extension needs none of them.

---

## 6. Remote code declaration

> **Remote code: none.** This extension ships no remote code. All JavaScript is bundled
> inside the package (`content.js`, `background.js`, `popup.js`); nothing is downloaded,
> evaluated, or loaded from a remote source at runtime. There is no `eval`, no `new
> Function`, no external `<script src>`, and no network requests of any kind. The
> extension makes zero calls to any server.

Compliance notes for this declaration:
- Manifest V3, no `content_security_policy` relaxation.
- No analytics SDK, no CDN, no update endpoint.
- `dist/muse-auto-allow-v1.5.0.zip` contains only static files with `manifest.json` at the
  zip root.

---

## 7. Data usage / Privacy practices tab — answers

These map to the Chrome Web Store **Privacy practices** form.

**7.1 Data collection**
- Does the extension collect or use user data? → **No.**
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
- Is data transmitted off the user's device? → **No.** Settings and the click log are
  stored only in `chrome.storage.local`.

**7.3 Certifications to check in the dashboard**
- [x] I do not sell or transfer user data to third parties, outside of the approved use
  cases.
- [x] I do not use or transfer user data for purposes that are unrelated to my item's
  single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending
  purposes.

**7.4 Review note (paste into “Notes for the reviewer”)**

```
Muse Auto-Allow has a single purpose: on muse.ai pages only, it auto-clicks the
"Allow" button on Muse's own approval-request UI so the user's Muse agent does not
stop for manual approvals. It calls no remote servers, contains no remote code, and
collects/transmits no data. Settings, a local last-50 click log and compact click statistics live in
chrome.storage.local. It never clicks Deny/Reject/Decline and never clicks lone
"Allow" permission banners. Permissions: storage (local settings + log), alarms
(once-a-minute check so background-tab approvals are handled), host permission
muse.ai (detect/click the Allow button). See [PRIVACY POLICY URL — TODO: fill before
submit].
```

> **TODO: fill before submit** — replace `[PRIVACY POLICY URL …]` with the public URL
> where `store/PRIVACY.md` is hosted.

---

## 8. Store assets checklist

The dashboard requires these images. Provide them at the exact sizes below.

| Asset | Requirement | Source in this repo | Status |
|---|---|---|---|
| Extension icon | 128×128 px PNG | `extension/icons/icon128.png` | ✅ present |
| Screenshots | 1280×800 px PNG (up to 5) | `store/screenshot1.png` (live runtime capture), `store/screenshot2-stats.png` (Statistics), `store/screenshot3-popup.png` (popup on stage), `store/screenshot4-overview.png` (designed overview) | ✅ 4 present, all verified 1280×800 |
| Small promo tile | 440×280 px PNG | `store/promo440x280.png` | ✅ present (verified 440×280) |
| Marquee promo tile | 1400×560 px (optional) | `store/marquee1400x560.png` | ✅ present (verified 1400×560) |

All showcase images use strictly fictional demo data (Example Org, demo-project,
sample-app, web-starter, notes-app, files.example.com) — never real projects or personal
data. Full inventory + regenerate commands: `store/SHOWCASE.md`.

Upload steps: **Store listing → Graphic assets** → upload the icon (also validated by
Chrome from the package), the four 1280×800 screenshots, the 440×280 promo tile and the
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
| Developer / publisher name | BlueSkyz Labs `TODO: fill before submit` (exact legal/display name) |
| Support email | `TODO: fill before submit` |
| Support / homepage URL | `TODO: fill before submit` |
| Privacy policy URL | `TODO: fill before submit` (host `store/PRIVACY.md`) |
| License | MIT © 2026 BlueSkyz Labs |

Replace every `TODO: fill before submit` marker with the real value before clicking
**Submit for review**. The Chrome Web Store will not accept a listing without a valid
privacy policy URL and a working support contact once any data-practices disclosure is
present.
