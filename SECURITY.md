# Security Policy

## Supported versions

Security fixes are applied to the **latest released version** of Muse Auto-Allow and to
`main`. Older releases are not maintained.

| Version | Supported |
|---|---|
| Latest release (Chrome Web Store / GitHub Releases) | ✅ |
| Anything older | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for security problems.** Report privately so a fix
can ship before details are public.

**Preferred channel — GitHub private vulnerability reporting.** On the repository page,
open the **Security and quality** tab → **Advisories** → **Report a vulnerability** and
submit the form. This creates a private advisory visible only to you and the
maintainers. (GitHub docs:
[Privately reporting a security vulnerability](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/report-privately).)

**If private reporting is unavailable**, open a regular issue that does **not** disclose
any vulnerability details and ask the maintainers for a private channel. We will move
the conversation there. (This mirrors the fallback GitHub documents on the same page.)

### What to include

- Affected version (from `chrome://extensions` or the popup) and where you got it
  (Chrome Web Store / GitHub Release / unpacked `main`).
- A description of the issue and its impact (what an attacker gains).
- Reproduction steps or a minimal proof of concept, plus browser and OS versions.
- A suggested fix, if you have one.

### Scope

**In scope** — the extension code and packaging in this repository:

- Bypassing the extension's safety invariants (e.g. causing it to click **Deny**, a
  lone **Allow**, or any non-approval button; acting outside `muse.ai`).
- Any network access, remote-code loading, or data leaving the device (the extension's
  claim is: none — see `store/PRIVACY.md`).
- Injection / privilege issues in the content script, service worker, popup, or the
  Statistics page (including import/backup sanitization in `extension/stats.js`).

**Out of scope** — please report these elsewhere:

- Vulnerabilities in **muse.ai** itself → report to Muse.
- Chrome/Chromium platform issues → Chrome Vulnerability Reward Program.
- Findings that require an already-compromised local machine. The log-encryption key
  lives in the same `chrome.storage.local` store as the data — a documented, honest
  limitation (it protects casual profile inspection, not a full local attacker).
- Social engineering of the maintainers.

## What to expect

- **Acknowledgement** — we aim to reply within **5 business days**.
- **Triage** — severity assessment and a plan within **10 business days** where
  possible.
- **Fix + disclosure** — we fix in a new release, then disclose via a GitHub Security
  Advisory. We will credit you unless you prefer otherwise.
- **No bug bounty.** This is an independent project with no servers and no
  monetization; we cannot offer monetary rewards. Credit in the advisory is what we
  can give.

We welcome good-faith research. Please avoid privacy violations, data destruction, and
service disruption.

## For maintainers

- Keep private vulnerability reporting enabled: repo → **Settings → Security and
  quality → Advanced Security → Private vulnerability reporting**. See GitHub docs,
  [Configuring private vulnerability reporting for a repository](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).
- Triage reports inside the advisory; publish the fix, then publish the advisory.

## References

- GitHub — [Adding a security policy to your repository](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/add-security-policy) (this file is picked up automatically from the repo root).
- GitHub — [Configuring private vulnerability reporting for a repository](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).
- GitHub — [Privately reporting a security vulnerability](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/report-privately).
