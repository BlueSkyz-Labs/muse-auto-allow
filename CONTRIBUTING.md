# Contributing to Muse Auto-Allow

Thanks for improving Muse Auto-Allow! This is a small, **zero-dependency** Chrome
Manifest V3 extension: everything ships as plain JavaScript from `extension/` — no
build step, no bundler, no npm packages. The shipped bytes are the reviewed bytes;
please keep it that way.

## Development setup (no build step)

Requirements:

- **Node.js ≥ 22** (CI pins 24) — the lint gate and E2E harnesses use the Node stdlib only.
- **Python 3** — only for `scripts/verify-zip.py`.
- **Chrome 116+** for the extension itself; the E2E harnesses need **Chrome 137+**
  (CDP `Extensions.loadUnpacked`).

1. Clone the repo.
2. Load the extension: `chrome://extensions` → enable **Developer mode** →
   **Load unpacked** → select the `extension/` directory (the manifest sits at its
   root).
3. Open (or refresh) a `muse.ai` tab so the content script injects. The toolbar popup
   shows status, toggle, click counter, and the click log.

There is nothing to install — `node_modules/` does not exist, and PRs that add runtime
dependencies will be declined.

## Tests and gates

All gates are zero-dependency scripts; run them from the repo root:

| Command | What it proves |
|---|---|
| `node scripts/lint.mjs` | JS syntax + JSON validity, i18n key parity across all 6 locales, no remote-code / network primitives, manifest hygiene (MV3, permission allowlist, muse.ai-only hosts, explicit CSP). |
| `node test/e2e.mjs` | Real-Chrome runtime E2E of the approval-detection paths + safety invariants (never Deny, never lone Allow, one click per node, dedupe). Scratch profile only. |
| `node test/followup-e2e.mjs` | Real-Chrome E2E of the follow-up engine and the popup builder (idle waits, cooldowns, guards, rotation). |
| `node scripts/build.mjs` && `python scripts/verify-zip.py` | Store zip is built with `manifest.json` at the zip root and byte-verified against `extension/` (exit 0 = match). |

Notes:

- The E2E harnesses drive an **installed** Chrome via CDP. They use their own scratch
  profile under the OS temp directory and never touch your real browser profile. Set
  `MAA_CHROME` if Chrome is not at the default path.
- As of this writing the harnesses launch Chrome through Windows PowerShell
  (`Start-Process`) and its teardown uses Windows process APIs, so the E2E suites are
  **Windows-only to run locally**; CI runs them on a `windows-latest` runner. A POSIX
  launch path is a welcome contribution — `.github/workflows/ci.yml` carries the
  ready-made ubuntu recipe to switch to.
- CI runs `lint` (ubuntu) and `e2e` (windows) on every pull request and every push to
  `main`. Both checks must be green.

## Code style

- **Zero-dependency vanilla JavaScript.** No TypeScript, no bundler, no minifier. The
  extension code must stay as-authored and readable — Chrome Web Store policy forbids
  obfuscated code (see [Code readability requirements](https://developer.chrome.com/docs/webstore/program-policies/code-readability)).
- Follow Manifest V3 rules: all service-worker event listeners registered at the top
  level (the worker is killed and re-awakened), `chrome.alarms` — never `setTimeout` —
  for periodic work, no in-memory state that must survive.
- i18n: every user-visible string goes through `chrome.i18n` and must exist in **all
  six locales** (`en, vi, zh_CN, ja, ko, es`). The lint gate fails on key-parity drift
  in either direction.
- LF line endings; no generated artifacts committed (`dist/` is gitignored).
- Do **not** bump version numbers in `extension/manifest.json` — releases own
  versioning.

## Safety invariants (do not weaken)

These are the extension's contract. PRs that relax any of them will be declined:

1. **Never click Deny / Reject / Decline** — or any destructive counterpart.
2. **Only click an Allow that is part of an approval pair**: the nearest ancestor that
   contains a deny-ish button must contain exactly one allow-ish button. Lone Allows
   and prefix-matching buttons ("Allow notifications") are never clicked.
3. **One click per node** (WeakSet) plus per-text cooldowns; no pathological loops.
4. **Fail closed**: unknown state → do nothing.
5. **Local-only data**: no network primitives (`fetch`, `XMLHttpRequest`, `WebSocket`,
   `importScripts`, `eval`, remote `<script src>`) anywhere in `extension/` — the lint
   gate enforces this. Keep storage growth bounded (click log ≤ 50 entries; pruned
   aggregates).
6. **muse.ai only**: keep the host set and content-script matches pinned to
   `https://muse.ai/*` and `https://*.muse.ai/*`; never add `<all_urls>` or extra
   permissions without a strong, stated reason (the lint gate fails on any permission
   outside the allowlist).
7. **Tests must not be weakened to go green.** The negative controls (Deny never
   clicked, lone/prefix Allow never clicked, no send while blocked) are the point of
   the suites.

## Pull requests

- One focused change per PR; describe the user-visible behavior change.
- Run `node scripts/lint.mjs` locally. If you can run the E2E suites (Windows host),
  paste their summary output in the PR description. CI (lint + e2e) must be green
  before merge.
- When you fix a guard or add a test, state how the test fails without the fix — this
  repo expects new tests to be proven to detect their defect.
- Update `CHANGELOG.md` for user-visible changes. Don't touch version numbers.
- Security issues: **do not** open a public issue or PR — see `SECURITY.md`.
- By contributing, you agree that your contribution is licensed under this
  repository's MIT license.

## References

- GitHub — [Setting guidelines for repository contributors](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors).
- Chrome Web Store — [Code readability requirements](https://developer.chrome.com/docs/webstore/program-policies/code-readability) (no obfuscation; minification allowed but discouraged here).
