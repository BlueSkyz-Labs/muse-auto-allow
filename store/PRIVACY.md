# Privacy Policy — Muse Auto-Allow

**Effective date:** 2026-10-10
**Last updated:** 2026-10-18
**Revision:** v1.10 (2026-10-18) — adds the **Codex (ChatGPT)** scope on chatgpt.com (separate switch, off by default) to the host-access and content-reading disclosures; the storage / log / statistics descriptions now name both engines.

This privacy policy applies to the **Muse Auto-Allow** browser extension for Google
Chrome ("the extension"), published by **BlueSkyz Labs** ("we", "us").

Contact: **TODO: fill before submit** (support email)
Publisher / homepage: **TODO: fill before submit**

Muse Auto-Allow has one job: on **muse.ai** pages, it automatically clicks the
**Allow** button on Muse's approval requests — and, when you turn on its separate
**Codex (ChatGPT)** switch (off by default), it clicks the affirmative option on
**Codex approval requests on chatgpt.com** — so your agents do not stop for manual
approvals. This policy explains exactly what that involves — which is very little,
because the extension keeps everything on your own device (the one optional exception,
off by default, is disclosed in §2).

---

## 1. Summary (the short version)

- The extension reads the content of **muse.ai** pages (to find Muse approval buttons)
  and, only while the opt-in **Codex (ChatGPT)** switch is on, the content of
  **chatgpt.com** pages (to find Codex approval buttons). It reads nothing else.
- It stores your settings (on/off, the Codex (ChatGPT) switch, click delay, click counter,
  pause, rules, follow-up options), a local log of the **last 50 clicks** (each with a
  timestamp), and **compact click statistics** (per day / month / year and per topic) in
  your browser.
- It **collects nothing** about you.
- By default it **transmits nothing** to us or anyone else. The only exception is the
  optional **Sync settings** feature (off by default) — if you turn it on, a small
  settings-only subset is mirrored through your browser's own sync service (Google) so
  it follows your Chrome profile. Logs and statistics are never synced. See §2.
- The startup **digest notification** is composed on your device; the `notifications`
  permission is used only to display it.
- There is **no analytics**, **no tracking**, and **no advertising**.
- There is **no remote code** — all code is bundled inside the package.

---

## 2. What the extension can access, and why

**Page content of muse.ai and chatgpt.com tabs.** To find and click the correct button,
the extension's content scripts read the page structure (DOM) of Muse pages you have open
(`https://muse.ai/*`, `https://*.muse.ai/*`) and of chatgpt.com pages
(`https://chatgpt.com/*`, `https://*.chatgpt.com/*`) — the latter only while you have the
opt-in **Codex (ChatGPT)** switch on; with it off, the script on chatgpt.com does nothing.
The extension requests no access to any other website.

**Your browser storage.** The extension saves, locally in your browser
(`chrome.storage.local`):

- your settings — whether auto-clicking is on or off, the delay between clicks, and a click counter;
- a click log — the **last 50 clicks** it performed (Muse clicks and, if the Codex switch
  is on, Codex clicks), each described by timestamp, kind (allow / expand / open panel,
  with a `codex` variant for chatgpt.com), button label, and context;
- click statistics — compact counters only: clicks per day, per month, per year, and per topic
  (a repository or host name, up to 40 characters, taken from the approval text). No page
  content is stored.

All of this stays on your device. The only exception is the optional settings sync
described below — and even then, only settings can be mirrored, never the log,
statistics, or click counters.

**Optional settings sync (off by default).** If you turn on **Sync settings** in the
extension, a compact settings-only subset — on/off state, click delay, dry-run and
allow-once preferences, topic and keyword rules, and your follow-up options (prompts,
chips, smart follow-up, and schedule) — is mirrored through `chrome.storage.sync`.
That data is stored by Chrome's built-in sync service in your own Google Account so
your settings follow your Chrome profile to other devices; it is **not sent to us** and
we cannot read it. Sync is **opt-in and off by default**. What is never synced: the
click log, click statistics, counters, digest timestamps, and any page content. Chrome
enforces a quota on synced data (8 KB per item, ~100 KB in total, 512 items maximum),
so only a compact settings subset can sync at all. Turning the feature off stops
future mirroring; settings already stored in Chrome sync can be removed through your
Google Account's sync-data controls (see §4).

**Desktop notifications (the digest).** On browser startup, the extension can show a
desktop notification summarizing recent local activity (clicks, follow-ups, blocked
items). This summary is composed on your device from your own local counters; the
`notifications` permission is used only to display it. No data leaves your device.

**A once-a-minute timer.** The extension uses a one-minute alarm purely to check for
approval requests in background tabs. It makes no network requests.

---

## 3. What the extension does NOT do

- It does **not** collect personal data of any kind (no names, emails, identifiers,
  location, health, financial, or authentication data).
- It does **not** read, store, or send the content of any page other than the muse.ai
  and chatgpt.com button detection described above.
- It does **not** collect your web history, keystrokes, or activity outside muse.ai and
  chatgpt.com.
- It does **not** transmit any data to our servers or to any third party — **there are no
  servers**, and we receive nothing. The extension itself makes no outbound network
  calls. The only way data can leave your device is the optional settings sync you
  explicitly enable (§2), which stores a settings-only subset through Chrome's built-in
  sync in your own Google Account.
- It does **not** sell, rent, or share data, because it holds no data to sell.
- It does **not** use data for advertising, profiling, creditworthiness, or lending.
- It does **not** load or execute remote code. All JavaScript ships inside the extension
  package; nothing is downloaded or evaluated at runtime.

---

## 4. Data storage, retention, and deletion

Everything the extension keeps is stored locally in your browser and stays under your
control (the optional settings sync is the one exception, covered below):

- **Retention:** the click log keeps only the most recent 50 entries; older entries are
  discarded automatically.
- **Retention (statistics):** the statistics counters keep at most 400 days, 24 months and
  100 topics; older entries are discarded automatically.
- **Deletion:** remove the extension from Chrome (`chrome://extensions` → Remove) to
  delete all stored settings and logs. You can also clear the extension's data from your
  browser's site/extension data controls.
- **Deletion (sync):** if you enabled Sync settings, turn it off to stop future
  mirroring, and remove settings already stored in Chrome sync through your Google
  Account's sync-data controls (Chrome → Settings → Sync and Google services, or your
  Google Account's Data & privacy page).

Because we never receive this data, there is nothing for us to delete on our side.

---

## 5. Permissions explained

| Permission | Why it is needed |
|---|---|
| `storage` | Save your on/off setting, click delay, click counter, pause, rules, follow-up options, the local last-50 click log, and compact click statistics. Also used by the optional, off-by-default settings sync. |
| `alarms` | Run a once-a-minute check so approvals in background tabs are handled. |
| `notifications` | Show the local activity digest as a desktop notification on browser startup. The digest is generated on your device; no data leaves it. |
| Host: `https://muse.ai/*`, `https://*.muse.ai/*` | Detect and click the Allow button on Muse pages. |
| Host: `https://chatgpt.com/*`, `https://*.chatgpt.com/*` | Detect and click the affirmative option on Codex approval requests on chatgpt.com — used only while the opt-in Codex (ChatGPT) switch is on. No other site is accessed. |

The extension also defines two keyboard shortcuts — `Alt+Shift+P` (pause/resume
automation) and `Alt+Shift+F` (send a follow-up prompt). Keyboard shortcuts are declared
through the manifest's `commands` key and grant no additional access.

The extension deliberately does **not** request `tabs`, `scripting`, `webRequest`,
`cookies`, `downloads`, or `<all_urls>`.

---

## 6. Changes to this policy

If we change how the extension handles data, we will update this policy and revise the
"Last updated" date above, and we will reflect any change in the extension's Chrome Web
Store listing. Continued use after an update means you accept the revised policy.

---

## 7. Contact

Questions about this policy or the extension's data practices:

**TODO: fill before submit** (support email)
**TODO: fill before submit** (support / homepage URL)

---

## Ghi chú tiếng Việt (tóm tắt)

Muse Auto-Allow chỉ đọc nội dung trang **muse.ai** (để tìm nút Allow của Muse) và — chỉ
khi bạn bật công tắc **Codex (ChatGPT)** (mặc định tắt) — nội dung trang **chatgpt.com**
(để tìm nút đồng ý của Codex). Tiện ích
lưu cục bộ trong trình duyệt của bạn: cài đặt bật/tắt, độ trễ bấm, nhật ký 50 lần bấm
gần nhất, và thống kê đếm gọn (theo ngày / tháng / năm và theo chủ đề). Tiện ích **không thu thập** dữ liệu nào và mặc định **không gửi** dữ liệu đi đâu; không có
analytics, không có mã từ xa. Nếu bạn bật tuỳ chọn **Đồng bộ cài đặt** (mặc định tắt),
chỉ một nhóm cài đặt gọn được đồng bộ qua dịch vụ sync của Chrome vào tài khoản Google
của chính bạn — nhật ký bấm và thống kê **không bao giờ** được đồng bộ. Thông báo tóm tắt
hoạt động (digest) được tạo ngay trên máy bạn. Gỡ tiện ích khỏi Chrome là xoá sạch dữ liệu đã lưu. Liên hệ:
TODO: fill before submit.

## 中文说明（摘要）

Muse Auto-Allow 仅读取 **muse.ai** 页面（用于查找 Muse 的 Allow 按钮）的内容，以及——仅当你
开启 **Codex (ChatGPT)** 开关（默认关闭）时——**chatgpt.com** 页面（用于查找 Codex 的确认
按钮）的内容。
扩展在你的浏览器中本地保存：开关设置、点击间隔、最近 50 次点击的日志，以及精简的点击统计
（按日 / 月 / 年与主题）。扩展
**不收集**任何数据，默认**不向任何地方发送**数据，没有分析统计，也没有远程代码。若你开启
**同步设置**（默认关闭），仅有一小部分设置会通过 Chrome 自带的同步服务镜像到你自己的
Google 账号——点击日志与统计**绝不会**同步。活动摘要（digest）通知在你的设备上本地生成。从
Chrome 移除该扩展即可清除已保存的数据。联系方式：TODO: fill before submit。
