# Privacy Policy — Muse Auto-Allow

**Effective date:** TODO: fill before submit (e.g. 2026-01-01)
**Last updated:** TODO: fill before submit

This privacy policy applies to the **Muse Auto-Allow** browser extension for Google
Chrome ("the extension"), published by **BlueSkyz Labs** ("we", "us").

Contact: **TODO: fill before submit** (support email)
Publisher / homepage: **TODO: fill before submit**

Muse Auto-Allow has one job: on **muse.ai** pages, it automatically clicks the
**Allow** button on Muse's approval requests so your Muse agent does not stop for
manual approvals. This policy explains exactly what that involves — which is very little,
because the extension keeps everything on your own device.

---

## 1. Summary (the short version)

- The extension reads the content of **muse.ai** pages only, and only to find Muse
  approval buttons.
- It stores your settings and a local log of the **last 50 clicks** in your browser.
- It **collects nothing** about you.
- It **transmits nothing** to us or anyone else.
- There is **no analytics**, **no tracking**, and **no advertising**.
- There is **no remote code** — all code is bundled inside the package.

---

## 2. What the extension can access, and why

**Page content of muse.ai tabs.** To find and click the correct button, the extension's
content script reads the page structure (DOM) of Muse pages you have open. This access is
limited to `https://muse.ai/*` and `https://*.muse.ai/*`. The extension requests no access
to any other website.

**Your browser storage.** The extension saves, locally in your browser
(`chrome.storage.local`):

- your settings — whether auto-clicking is on or off, and the delay between clicks;
- a click log — the **last 50 clicks** it performed, each described by kind (allow /
  expand / open panel), button label, and context.

This information never leaves your device.

**A once-a-minute timer.** The extension uses a one-minute alarm purely to check for
approval requests in background tabs. It makes no network requests.

---

## 3. What the extension does NOT do

- It does **not** collect personal data of any kind (no names, emails, identifiers,
  location, health, financial, or authentication data).
- It does **not** read, store, or send the content of any page other than the muse.ai
  button detection described above.
- It does **not** collect your web history, keystrokes, or activity outside muse.ai.
- It does **not** transmit any data to our servers or to any third party — **there are no
  servers**. The extension makes no outbound network calls.
- It does **not** sell, rent, or share data, because it holds no data to sell.
- It does **not** use data for advertising, profiling, creditworthiness, or lending.
- It does **not** load or execute remote code. All JavaScript ships inside the extension
  package; nothing is downloaded or evaluated at runtime.

---

## 4. Data storage, retention, and deletion

Everything the extension keeps is stored locally in your browser and stays under your
control:

- **Retention:** the click log keeps only the most recent 50 entries; older entries are
  discarded automatically.
- **Deletion:** remove the extension from Chrome (`chrome://extensions` → Remove) to
  delete all stored settings and logs. You can also clear the extension's data from your
  browser's site/extension data controls.

Because we never receive this data, there is nothing for us to delete on our side.

---

## 5. Permissions explained

| Permission | Why it is needed |
|---|---|
| `storage` | Save your on/off setting, click delay, and the local last-50 click log. |
| `alarms` | Run a once-a-minute check so approvals in background tabs are handled. |
| Host: `https://muse.ai/*`, `https://*.muse.ai/*` | Detect and click the Allow button on Muse pages. No other site is accessed. |

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

Muse Auto-Allow chỉ đọc nội dung trang **muse.ai** để tìm nút Allow của Muse. Tiện ích
lưu cục bộ trong trình duyệt của bạn: cài đặt bật/tắt, độ trễ bấm, và nhật ký 50 lần bấm
gần nhất. Tiện ích **không thu thập** dữ liệu nào, **không gửi** dữ liệu đi đâu, không có
analytics, không có mã từ xa. Gỡ tiện ích khỏi Chrome là xoá sạch dữ liệu đã lưu. Liên hệ:
TODO: fill before submit.

## 中文说明（摘要）

Muse Auto-Allow 仅读取 **muse.ai** 页面的内容，用于查找 Muse 的 Allow（允许）按钮。
扩展在你的浏览器中本地保存：开关设置、点击间隔，以及最近 50 次点击的日志。扩展
**不收集**任何数据，**不向任何地方发送**数据，没有分析统计，也没有远程代码。从
Chrome 移除该扩展即可清除已保存的数据。联系方式：TODO: fill before submit。
