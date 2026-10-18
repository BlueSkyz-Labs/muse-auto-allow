# GitHub Publish Runbook — first public push

Owner-run procedure to publish this repository (`muse-auto-allow` — Muse Auto-Allow)
as a **public GitHub repository** and cut the first Release.

**Assumptions and scope**

- A history-rewrite scrub has already been executed by the release owner (out of
  scope here). Step 0 **verifies** the scrub before anything goes public.
- Nothing in steps 0–3 is public until `gh repo create` (step 1) and `git push`
  (step 2). You can stop before those at any time.
- The commands below assume the repo is published as **`BlueSkyz-Labs/muse-auto-allow`**
  (publisher: BlueSkyz Labs). If the publishing account/slug differs, replace the
  `OWNER/REPO` values everywhere below **and** update the CI badge URL in `README.md`
  (`https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg`).
- Version numbers are owned by the release freeze — `<VERSION>` below is exactly the
  value in `extension/manifest.json` at release time; do not edit version files as
  part of this runbook.
- `dist/` is gitignored; the release zip is attached as a Release asset, not committed.

All GitHub-side references: [gh repo create](https://cli.github.com/manual/gh_repo_create) ·
[gh repo edit](https://cli.github.com/manual/gh_repo_edit) ·
[gh release create](https://cli.github.com/manual/gh_release_create) ·
[Adding locally hosted code to GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github) ·
[About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) ·
[Adding a workflow status badge](https://docs.github.com/en/actions/how-tos/monitor-workflows/add-a-status-badge).

---

## 0. Pre-flight — verify the scrub and the tree (local, still private)

Run everything from the repo root during the release freeze (other editing lanes
stopped, tree stable):

```bash
cd "path/to/muse-auto-allow"   # your local clone
```

### 0.1 Tools

```bash
gh --version           # GitHub CLI, authenticated: gh auth status
gitleaks version       # if missing: winget install --id Gitleaks.Gitleaks -e
                       # (or scoop/choco install gitleaks, or the binary from
                       #  https://github.com/gitleaks/gitleaks/releases)
node --version         # >= 22 (CI pins 24)
```

### 0.2 Secret scan (gitleaks) — must be clean

`gitleaks git` scans the **full git history**, which is exactly what a first push
publishes. Because this host disables MSYS path conversion, any path you pass to a
**native** tool (gitleaks.exe, gh.exe) must be in **native `C:/…` form** — a `/c/…`
MSYS-style path will not resolve inside the native process.

```bash
# Set REPO locally to your actual clone path (native form). Do not commit the value.
REPO="C:/<your-local-clone-path>"

# With a config file (only if one exists — this tree currently ships no .gitleaks.toml):
gitleaks git -c "$REPO/.gitleaks.toml" --redact -v

# Without a config file (built-in ruleset):
gitleaks git --redact -v

# Expected: no leaks found (older gitleaks prints "leaks found: 0"), exit code 0.
# On gitleaks < 8.19 the subcommand is `detect` instead of `git`.
```

If anything is found: **do not push.** Rotate/remove the value, re-run, and only then
proceed. (Recovery reference, step 5, if it already reached GitHub.)

### 0.3 Personal-identifier grep gate — must be clean

Substitute the real values **on the command line only — never write them into any
committed file** (they are exactly what you are hunting for). Candidates: the Windows
username, the machine name, local path fragments (drive letter + parent folder chain
of this repo), and personal email addresses.

```bash
git grep -n -I -e "<windows-username>" -e "<machine-name>" -e "<local-path-fragment>" -e "<personal-email>" -- .

# History check for the same values (shows commits that add/remove the string;
# a correctly scrubbed history returns nothing):
git log --all --oneline -S "<windows-username>"
git log --all --oneline -S "<local-path-fragment>"
```

Expected: **zero output** from the tree grep and the history searches. Any hit = fix
before pushing. (Known trap to fix first: development-era docs — e.g. under `docs/`
and `store/` — sometimes quote local absolute paths; replace them with relative
paths. The scrub pass owns that cleanup; this step verifies it.)

### 0.4 Tree clean

```bash
git status --short     # expect: empty
git stash list         # expect: empty
git log --oneline -1   # note the commit being tagged later
```

### 0.5 Local gates green

```bash
node scripts/lint.mjs
node test/e2e.mjs            # Windows host + Chrome 137+ (same requirement as CI)
node test/followup-e2e.mjs
node scripts/build.mjs && python scripts/verify-zip.py
```

CI re-runs lint + e2e after the push; the local run avoids a red first impression on a
brand-new public repo.

---

## 1. Create the repository (owner; makes it public but still empty)

```bash
gh auth status

cd "path/to/muse-auto-allow"
gh repo create BlueSkyz-Labs/muse-auto-allow --public --source . --remote origin \
  --description "Auto-click Allow on Muse (muse.ai) approval requests so your AI agent keeps working — Manifest V3, local-only, zero dependencies."
```

- `--source .` registers the new repo as the `origin` remote for this local clone and
  does **not** push anything (there is no `--push` here on purpose — the push is an
  explicit step below).
- `--public` is required for a public repo (the flag is one of `--public`, `--private`,
  `--internal`).

Topics (helps discovery; run after the repo exists):

```bash
gh repo edit BlueSkyz-Labs/muse-auto-allow \
  --add-topic chrome-extension --add-topic manifest-v3 --add-topic chrome-web-store \
  --add-topic muse --add-topic ai-agent --add-topic automation --add-topic privacy
```

Sanity check the slug now: open `https://github.com/BlueSkyz-Labs/muse-auto-allow` — if
the account or name differs, fix the README badge URL before pushing.

---

## 2. Push `main`

```bash
git push -u origin main
```

Then watch the first CI run (**Actions** tab):

- `lint` — ubuntu-latest, seconds.
- `e2e` — windows-latest, a few minutes (real Chrome; see `.github/workflows/ci.yml`
  for why this job is Windows-hosted).

If a job is red: fix, commit, push again. Do not tag a release until both checks are
green on the exact commit you will tag.

---

## 3. Tag + GitHub Release (attach the store zip)

```bash
# <VERSION> = the version in extension/manifest.json (release freeze owns it), e.g. 1.10.0
git tag -a "v<VERSION>" -m "Muse Auto-Allow v<VERSION>"
git push origin "v<VERSION>"

gh release create "v<VERSION>" \
  "dist/muse-auto-allow-v<VERSION>.zip#Muse Auto-Allow v<VERSION> (Chrome Web Store package)" \
  "dist/muse-auto-allow-v<VERSION>.zip.sha256#SHA-256 checksum" \
  --title "Muse Auto-Allow v<VERSION>" --generate-notes --verify-tag
```

- The attached zip must be the one that passed `scripts/build.mjs` +
  `scripts/verify-zip.py` (step 0.5) — the same bytes that go to the Chrome Web Store.
- Attach the `.sha256` sidecar alongside the zip, as done for the existing
  v1.8.0 / v1.9.0 / v1.9.1 / v1.9.2 Releases and the current v1.9.3 Release (which exists
  with the zip + `.sha256` sidecar attached), so a downloader can
  verify the exact artifact bytes.
- `--verify-tag` aborts if the tag does not already exist, so the Release always
  matches a pushed tag.
- `--generate-notes` builds the notes from merged PRs/commits; prepend anything extra
  with `--notes "…"` if needed.

---

## 4. Branch protection (recommended, owner)

Protect `main` (Settings → Branches, or Rulesets):

- **Require status checks to pass before merging**: `lint` and `e2e` (the job names;
  keep check names unique across workflows — ambiguous names block PRs).
- **Disallow force pushes** and **disallow deletions** (both on by default in a
  protection rule).
- Optional once more maintainers join: require pull requests + reviews.
- Note: by default protection does not apply to admins; enable "Do not allow
  bypassing the above settings" if you want it to bind you too.

Reference: <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches>

---

## 5. Post-push hardening (owner)

1. **Turn on private vulnerability reporting** so `SECURITY.md`'s preferred channel
   actually works: repo → **Settings → Security and quality → Advanced Security →
   Private vulnerability reporting → Enable**. Verify the **Security and quality** tab
   shows a **Report a vulnerability** button.
   Reference: <https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository>
2. **Enable secret scanning + push protection** (free for public repos):
   ```bash
   gh repo edit BlueSkyz-Labs/muse-auto-allow \
     --enable-secret-scanning --enable-secret-scanning-push-protection
   ```
3. **Confirm community health files surface**: repo home should show links for
   `SECURITY.md`, `CONTRIBUTING.md`, `LICENSE`. If the Security link is missing, the
   file was not picked up — check it is at the repo root.
   Reference: <https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/add-security-policy>
4. **Badge live check**: the README CI badge renders on the repo home once the first
   `ci.yml` run exists.
   Reference: <https://docs.github.com/en/actions/how-tos/monitor-workflows/add-a-status-badge>

### If a secret slipped through anyway

Rotate the credential immediately (treat it as compromised), then rewrite history
before anyone fetches it — or, if the repo is minutes old, delete and recreate it.
Reference: <https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository>

---

## 6. What stays owner-gated

- `gh auth login` / the owning GitHub account (and org ownership if publishing under
  an org account).
- Confirming the final slug and, if different, updating the README badge URL.
- Publishing the Release (step 3) — the archive's public face.
- Enabling private vulnerability reporting (step 5.1) and secret scanning (step 5.2).
- The Chrome Web Store side (developer account, fee, 2-Step Verification, identity
  verification, privacy-policy hosting, publisher name) — see
  `store/CWS_SUBMISSION_PACK.md`.
- Any decision to keep or remove development-era drafts from `docs/` before the push
  (the scrub owner it — this runbook only verifies the identifier/secret gates).
