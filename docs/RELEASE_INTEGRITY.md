# Release Integrity — deterministic package, checksum, artifact smoke

Scope: how the Chrome Web Store package is produced, proven identical on rebuild,
checksummed, byte-verified and smoke-tested **as an artifact** (extracted zip loaded
in a real Chrome). Tooling: `scripts/build.mjs`, `scripts/verify-zip.py`,
`scripts/smoke-zip.mjs`. Nothing here signs or uploads anything — the upload path is
`docs/GITHUB_PUBLISH_RUNBOOK.md` + `store/PUBLISH_RUNBOOK.md`.

## Artifacts

| Path | What |
|---|---|
| `dist/muse-auto-allow-v<version>.zip` | store package, `manifest.json` at the zip ROOT, one entry per file in `extension/` (19 entries at v1.10.1) |
| `dist/muse-auto-allow-v<version>.zip.sha256` | sibling checksum sidecar (`sha256sum` format: `<hex>  <basename>`) |

`<version>` is always read from `extension/manifest.json` — no script hardcodes it.
`dist/` is gitignored; the zip ships as a GitHub Release asset, never committed.

## Determinism rules (and why)

Defined in `scripts/build.mjs`:

- **Entries sorted byte-wise by path.** Filesystem enumeration order is not stable.
- **One fixed DOS timestamp for every entry**, derived from `SOURCE_DATE_EPOCH`
  (reproducible-builds convention), clamped to the ZIP minimum
  `1980-01-01T00:00:00Z`; that minimum is also the default when the variable is
  unset. File mtimes are deliberately **not** used: a fresh checkout or a different
  machine has different mtimes, a fixed epoch does not. Two builds of the same bytes
  therefore produce the same archive anywhere.
- **Fixed compression rule**: raw deflate level 9, or STORE when deflate is not
  smaller — deterministic for a given input.
- **No extra fields, no comments, fixed version/attribute fields.**

## Exact commands

```bash
# 1. build (writes zip + .sha256 sidecar; prints entry count, sizes, hash)
node scripts/build.mjs

# 2. checksum sidecar, standalone (also proves the sidecar is sha256sum-consumable)
cd dist && sha256sum -c muse-auto-allow-v<version>.zip.sha256 && cd ..

# 3. byte-compare zip vs extension/ on disk (set-equality both directions)
python scripts/verify-zip.py

# 4. artifact smoke: extract the zip, load the EXTRACTED copy in a scratch Chrome
#    (unique user-data-dir, random CDP port), run the core e2e checks against it.
#    Exit 0 only when the artifact passes; prints {artifact, entries, checks, ok}.
node scripts/smoke-zip.mjs

# 5. determinism proof: build twice, hashes must match
node scripts/build.mjs && sha256sum dist/muse-auto-allow-v<version>.zip
node scripts/build.mjs && sha256sum dist/muse-auto-allow-v<version>.zip   # same hex
```

`smoke-zip.mjs` environment knobs: `MAA_CHROME` (Chrome executable),
`MAA_SMOKE_PORT` (fixed CDP port). One declared test-only delta: the **loaded copy**
of the artifact gets `http://127.0.0.1/*` appended to `content_scripts[0].matches`
(the same injection `test/e2e.mjs` performs) so the content script runs on the local
fixture origin — the pristine extraction dir and the shipped manifest stay untouched,
and the artifact's own bytes are what gets loaded everywhere else.

## Freeze procedure (v1.20.0 freeze)

Same procedure (version `1.20.0`; build → hash → rebuild identical; sidecar `-c`; verify-zip
20/0/0/0 — the 20th entry is the new `anomaly.js`; smoke `ok:true`; attach to the GitHub Release).
Note: `scripts/build.mjs` carries a SHIPPED allowlist; the new module required an explicit entry
(the build refuses unexpected files by design).

## Recorded evidence (v1.20.0 freeze)

- Frozen tree: `extension/manifest.json` `"version": "1.20.0"`; tag `v1.20.0`.
- Artifact: `dist/muse-auto-allow-v1.20.0.zip` — **225,747 bytes**, **20 entries**; sha256
  `c0454021e0ed88627b26de88757c741e6ea031247db2b088ba5a3ced97241ef9` (sidecar clean);
  determinism 2× byte-identical; verify-zip 20/0/0/0; smoke exit 0 `"ok": true`.
- Gates (2026-10-19, self-cleaning runs): lint 29 checks / 20 files 0 · **anomaly-unit 11/11 NEW**
  (mutation-falsified) · background-unit 0 · import-security 0 · yolo-ux 0 · e2e 0 ·
  mission-e2e 0 · lang-switch-e2e 0 (231×6) · codex-e2e 0 · bench 0 · QA v1.14.0 8/8 ·
  `qa-experience` **35/35**.
- **followup-e2e** required two test-side fixes after the first battery run (the PRODUCT path was
  firing correctly: the marker showed `rate` fired at exactly count 5/threshold 5 with a 15-minute
  pause): (a) **LSN-010** — the log is encrypted at rest, so check 2 now pins kind/reason/ctx-shape
  + the unencrypted marker rule instead of grepping plaintext; (b) **LSN-011** — the phase was
  retuned to the RATE rule at 5 clicks/60 s (the topic rule refuses below a fixed window-total
  floor of 30 and the fixture's engine cadence is ~1 click/5 s). After the fixes:
  **113 checks / 0 failed**. Two unrelated runs aborted on transient `Runtime.evaluate` stalls
  (the known flake class); a stalled suite is rerun once before being treated as red — the rerun
  was fully green, and the battery's own run of followup-e2e was the red one quoted above.
- Scope: W2 of the Owner-approved catalog — **G04 anomaly auto-pause** (pure `anomaly.js` detector:
  RATE 150/5 min, TOPIC 40 + 70% share /10 min, 100-click floor; ONE-write pause + marker;
  new kind/reason `anomaly-pause`; fail-closed settings; Safety-sheet guard groups; can only ADD a
  pause, never touch a cap) and **G07 daily briefing** (top block reason + 7-day trend inside the
  existing digest). i18n **231 keys × 6**. Fixture gains an on-demand 45-card spike family.

## Freeze procedure (v1.19.0 freeze)

Same procedure (version `1.19.0`; build → hash → rebuild identical; sidecar `-c`; verify-zip
19/0/0/0; smoke `ok:true`; attach to the GitHub Release).

## Recorded evidence (v1.19.0 freeze)

- Frozen tree: `extension/manifest.json` `"version": "1.19.0"`; tag `v1.19.0`.
- Artifact: `dist/muse-auto-allow-v1.19.0.zip` — **216,228 bytes**, **19 entries**; sha256
  `4221e521c3f053ea05f39391a7260770bef8e94de9b0ad96b0d877d3da3cc13f` (sidecar clean);
  determinism 2× byte-identical; verify-zip 19/0/0/0; smoke exit 0 `"ok": true`.
- Gates on the frozen tree (2026-10-19, one self-cleaning run): lint 0 (27 checks) ·
  background-unit 0 · import-security 0 (162) · yolo-ux 0 (5) · e2e 0 · followup-e2e 0 ·
  lang-switch-e2e 0 (213×6) · codex-e2e 0 · bench 0 · QA v1.14.0 8/8 · `qa-experience` **34/34**
  (was 20 — S10 locale sweep ×12 + the S02 log-filter checks L1–L4).
- **mission-e2e** needed a test-side fix before it was green: check C raced the auto path (with a
  'working' tab the automatic mission send could fire in the gap between `setState('working')`
  and the pause taking effect, drifting the step baseline). The paused product path itself held
  ("pause halts the automatic mission send" + "refused while paused" were green in the failing
  run). Fixed test-side (idle first; baseline taken AFTER the pause holds) → **2 consecutive
  green runs** recorded before this entry (LSN-008).
- Scope: W1 of the Owner-approved catalog (`docs/APPROVED_WORK_2026-10-19.md`): S02 log kind
  chips + search + day-group headers (**a real ISO-coercion defect caught by the new checks
  pre-freeze** — LSN-009), S03 press feedback, S04 font-stack fallbacks, S07 consent-step
  learn-more link, S08 audited (commands already shipped + tested), S10 six-locale overflow
  sweep on both surfaces. i18n **213 keys × 6 locales**.

## Freeze procedure (v1.18.0 freeze)

Same procedure (version `1.18.0`; build → hash → rebuild identical; sidecar `-c`; verify-zip
19/0/0/0; smoke `ok:true`; attach to the GitHub Release).

## Recorded evidence (v1.18.0 freeze)

- Frozen tree: `extension/manifest.json` `"version": "1.18.0"`; tag `v1.18.0`.
- Artifact: `dist/muse-auto-allow-v1.18.0.zip` — **213,482 bytes**, **19 entries**; sha256
  `5cdad3e6e29112bb7f39467a2865accf82d6c036fbecd272e2ab1d006c5f78c9` (sidecar clean);
  determinism 2× byte-identical; verify-zip 19/0/0/0; smoke exit 0 `"ok": true`.
- Gates on the frozen tree (2026-10-19, one self-cleaning run, all exit 0): lint 0 (27 checks) ·
  background-unit 0 · import-security 0 (162) · yolo-ux 0 (5) · e2e 0 · followup-e2e 0 ·
  mission-e2e 0 · lang-switch-e2e 0 (204×6) · codex-e2e 0 (with the three new auth FORBIDDEN
  negatives — `forbiddenHit: []`) · bench 0 · QA v1.14.0 8/8 · `qa-experience` **20/20**.
- Scope: R7 zone separation · store kit refreshed from real captures (stage template + script) ·
  SGPS prompt-kit vNext 1.3.1 wired (provenance 33/33) · **CX-01..03 security fixes** from the
  third independent audit (`docs/SECURITY_FINDINGS.md`: CX-02 auth keywords widened + 3
  FORBIDDEN fixtures; CX-03 unconditional plaintext drop in both engines; CX-01 expand-path
  hardening + documented residual) · DISCOVERY_FULL catalog landed as a PROPOSAL
  (`docs/PROPOSAL_CATALOG_2026-10-19.md`, nothing coded).

## Freeze procedure (v1.17.0 freeze)

Same procedure (version `1.17.0`; build → hash → rebuild identical; sidecar `-c`; verify-zip
19/0/0/0; smoke `ok:true`; attach to the GitHub Release).

## Recorded evidence (v1.17.0 freeze)

- Frozen tree: `extension/manifest.json` `"version": "1.17.0"`; tag `v1.17.0`.
- Artifact: `dist/muse-auto-allow-v1.17.0.zip` — **212,978 bytes**, **19 entries**; sha256
  `787284fd3937a67b696cec16db86221b6e464c53320d27eafcab5439f96b6676` (sidecar clean); determinism 2× byte-identical; verify-zip 19/0/0/0; smoke
  exit 0 `"ok": true`.
- Gates on the frozen tree (2026-10-19, one self-cleaning battery, all exit 0): lint 0 (27) ·
  background-unit 0 · import-security 0 (162) · yolo-ux 0 (5) · e2e 0 · followup-e2e 0 ·
  mission-e2e 0 · lang-switch-e2e 0 (204×6) · codex-e2e 0 · bench 0 · QA v1.14.0 8/8 ·
  `qa-experience` **20/20**.
- Cycle scope: R6 (micro-label 10.5→11 px, tracking .065em, ticks 11 px) · R8 (`#ccap`
  `aria-live=polite` announces the range switch) · `docs/LICENSING_DESIGN.md` — the PROPOSED
  paid-tier design (ES256 offline tokens, owner-held key, DEC-040 mapping, no paid code shipped).

## Freeze procedure (v1.16.0 freeze)

Same procedure (version `1.16.0`; build → hash → rebuild identical; sidecar `-c`; verify-zip
19/0/0/0; smoke `ok:true`; attach to the GitHub Release).

## Recorded evidence (v1.16.0 freeze)

- Frozen tree: `extension/manifest.json` `"version": "1.16.0"`; tag `v1.16.0`.
- Artifact: `dist/muse-auto-allow-v1.16.0.zip` — **212,964 bytes**, **19 entries**; sha256
  `77ac96812d6edb875beb1af741384f74928ec2d29086687f7020d9048a49aa26` (sidecar clean);
  determinism 2× byte-identical; verify-zip 19/0/0/0; smoke exit 0 `"ok": true`.
- Gates on the frozen tree (2026-10-19, one self-cleaning battery): `lint.mjs` 0 · 
  `background-unit` 0 · `import-security.mjs` — **first run crashed on a sandbox GAP** (the
  node-vm fake element lacked `closest()`, which `renderKpis`'s new `.kpi.zero` walk uses —
  LSN-005 class: the sandbox must mirror real DOM APIs); the harness was extended (parentless
  `closest()→null`, `querySelector/All` stubs) and the suite **re-ran clean on the SAME tree:
  162/0** · `yolo-ux-unit` 0 · `e2e` 0 · `followup-e2e` 0 · `mission-e2e` 0 · `lang-switch-e2e`
  0 · `codex-e2e` 0 · `bench --only=assert` 0 · QA v1.14.0 8/8 · **`qa-experience` 20/20**
  (new K: topics print %; zero KPI cards carry the calm class).
- Beauty-blind cycle: three fixes shipped (R4 zero-card calm, R5 topic percentages, R1
  empty-line spacing); R2/R3 rejected with in-product evidence; R6–R8 deferred with records —
  `docs/EXPERIENCE_REVIEW_V115.md`. Visual re-verification via the vision lane confirmed bars
  render, calmer zeros, printed percentages, no new defects. Capture-seed bug disclosed (the
  earlier "empty chart" reading) — fix in the same PR.

## Freeze procedure (v1.15.0 freeze)

Same procedure as v1.14.0 (version `1.15.0`; `build.mjs` → hash → rebuild → identical; sidecar
`sha256sum -c`; `verify-zip.py` 19/0/0/0; `smoke-zip.mjs` exit 0/`ok:true`; attach zip + sidecar
to the GitHub Release). The freeze ran on the exact battery-tested tree; docs-only edits after
the battery were re-verified by rebuilding (artifact bytes unchanged — extension/ untouched).

## Recorded evidence (v1.15.0 freeze)

- Frozen tree: `extension/manifest.json` `"version": "1.15.0"`; tag `v1.15.0` (this release commit).
- Artifact: `dist/muse-auto-allow-v1.15.0.zip` — **212,646 bytes**, **19 entries**; sha256
  `e09d1424ba8cfd26bc28505798d10c616a640221be46523e6e9f4c25eb40c69c` (sidecar clean).
- Determinism: two full builds byte-identical; verify-zip 19 matched / 0 mismatched / 0 disk-only
  / 0 zip-only; smoke exit 0 `"ok": true`.
- Gates on the frozen tree (2026-10-19, exits captured without pipes, one self-cleaning battery):
  `lint.mjs` 0 (27 checks/19 files) · `background-unit.mjs` 0 (35/35) · `import-security.mjs` 0
  (162/0) · `yolo-ux-unit.mjs` 0 (5) · `e2e.mjs` 0 · `followup-e2e.mjs` 0 · `mission-e2e.mjs` 0 ·
  `lang-switch-e2e.mjs` 0 (204 × 6) · `codex-e2e.mjs` 0 (4 phases) · `bench --only=assert` 0 ·
  QA v1.14.0 scratch-Chrome 8/8 · **`scripts/qa-experience.mjs` 19/19** (the SGPS:Experience
  instrument: contrast both themes, reduced-motion, focus coverage, vi layout, state-as-text,
  AX-name coverage, real Tab traversal incl. the onboarding focus-trap, 200%-zoom proxy,
  empty state, locale data formats).
- SGPS:Experience cycle: the E1 fix (tick formatters follow the EFFECTIVE locale) closed the
  TS-04 class for data formats; probe-hygiene lessons (LSN-007) baked into the shipped
  instrument (scheme confirmation before every read, real DOM ids, asserted preconditions).

## Freeze procedure (v1.14.0 freeze)

Run from the repo root during the freeze, tree stable, editing lanes stopped.

1. Confirm the version: `extension/manifest.json` reads `1.14.0` (the freeze owns version
   bumps — no script edits it).
2. Rebuild clean: `node scripts/build.mjs` — expect `manifest at root: true`, the file count of
   `extension/` as entries, and a fresh `dist/muse-auto-allow-v1.14.0.zip` + `.sha256`.
3. Record the hash: `sha256sum dist/muse-auto-allow-v1.14.0.zip` (must equal the sidecar;
   `sha256sum -c` clean).
4. Determinism proof: build once more; the hash must be **identical**.
5. Byte-verify + smoke: `python scripts/verify-zip.py` (19 matched, 0 mismatched, 0 disk-only,
   0 zip-only) then `node scripts/smoke-zip.mjs` — exit 0 and `"ok": true`.
6. Attach the zip **and** its `.sha256` sidecar to the GitHub Release `v1.14.0` per
   `docs/GITHUB_PUBLISH_RUNBOOK.md` §3. If anything is rebuilt after step 5, restart from step 2.

## Recorded evidence (v1.14.0 freeze)

- Frozen tree: `extension/manifest.json` `"version": "1.14.0"`; git tag `v1.14.0` (this release
  commit; GitHub Release carries the zip + `.sha256` sidecar).
- Artifact: `dist/muse-auto-allow-v1.14.0.zip` — **212,606 bytes**, **19 entries**,
  `manifest.json` at the zip root; sha256
  `836a999172e206107f0b0b41564ff6b67238dede6a7ee35ff3d2aa527fd2b5a3` (sidecar
  `dist/muse-auto-allow-v1.14.0.zip.sha256`; `sha256sum -c` clean).
- Determinism: two full builds at the frozen tree produced the identical sha256.
- `python scripts/verify-zip.py`: 19 matched, 0 mismatched, 0 disk-only, 0 zip-only (exit 0).
- `node scripts/smoke-zip.mjs`: exit 0, `"ok": true` (extracts the shipped zip, loads it in
  scratch Chrome, passes the core e2e).
- Gates on the frozen tree (2026-10-18, exit codes captured directly — no pipes, one battery,
  self-cleaning): `lint.mjs` 0 (27 checks across 19 files) · `background-unit.mjs` 0 (35/35) ·
  `import-security.mjs` 0 (**162/0** — new G14 schema refusal, G15 authority flips, G16 garbage
  schema) · `yolo-ux-unit.mjs` 0 (5 checks) · `e2e.mjs` 0 (six new FORBIDDEN negatives:
  `f1-standing`, `f2-offscreen`, `f2-faint`, `f3-authorize`, `f3-allow`, `f3b-allow`) ·
  `followup-e2e.mjs` 0 · `mission-e2e.mjs` 0 · `lang-switch-e2e.mjs` 0 (**204 keys × 6**) ·
  `codex-e2e.mjs` 0 (4 phases, `ok: true`) · `scripts/bench/experience.mjs --only=assert` 0 ·
  QA v1.14.0 (scratch Chrome) **8/8** (stats locale reload + live switch, traversal rejection,
  schema guard through the real file input).
- Independent adversarial audit (separate read-only child; live Chromium reproductions): F1–F4
  fixed with regression coverage, plus F5-codex (present-but-non-numeric `schemaVersion`) — all
  in CHANGELOG v1.14.0; falsification directions in the PR body.
- Battery hygiene: three batteries ran during the cycle — #1/#2 on intermediate trees (caught
  the node-vm `fetch` sandbox gap and the strict-viewport over-block, LSN-005/006; both fixed),
  #3 on the exact frozen tree: every exit 0. `scripts/cleanup-chrome-scratch.mjs` ran after
  each battery (kills only `maa-*` scratch profiles).
- SGPS:Experience pass (same night, on this frozen tree; instrument
  `docs/SGPS_EXPERIENCE_CHECKLIST.md`): **v2 machine checks 11/11 PASS** — WCAG contrast
  (both themes, popup + stats), reduced-motion honored, `:focus-visible` coverage (the
  `.numwrap` wrapper-ring pattern understood), `vi` long-string layout without overflow,
  state-as-text (dry-run band / live state line). The v1 probe reported 3 failures that were
  **probe defects, not product defects** (color-scheme emulation race + selectors); corrected in
  v2 with scheme confirmation before every read (evidence: `scratch/experience-v1.json`,
  `scratch/experience-v2.json`). Residual manual-class evidence (screen reader pass, beauty-blind
  review) remains for the next experience cycle.

## Freeze procedure (v1.13.0 freeze)

Run from the repo root during the freeze, tree stable, editing lanes stopped.

1. Confirm the version: `extension/manifest.json` reads `1.13.0` (the freeze owns
   version bumps — no script edits it).
2. Rebuild clean:
   `node scripts/build.mjs`
   Expect: `manifest at root: true`, an entry count equal to the number of files in
   `extension/`, and a fresh `dist/muse-auto-allow-v1.13.0.zip` + `.sha256`.
3. Record the hash: `sha256sum dist/muse-auto-allow-v1.13.0.zip` (must equal the
   sidecar; verify with `sha256sum -c` as above).
4. Determinism proof: build once more; the hash must be **identical**. A differing
   hash means the tree changed between builds — stop and find out what moved.
5. Byte-verify + smoke: `python scripts/verify-zip.py` (19 matched, 0 mismatched)
   then `node scripts/smoke-zip.mjs` — exit 0 and `"ok": true` in the JSON summary.
6. Attach to the GitHub Release: the zip **and** its `.sha256` sidecar, per
   `docs/GITHUB_PUBLISH_RUNBOOK.md` §3 —
   `gh release create "v1.13.0" "dist/muse-auto-allow-v1.13.0.zip#…" "dist/muse-auto-allow-v1.13.0.zip.sha256#checksum" …`
   The attached zip must be the exact bytes that passed steps 2–5; if anything is
   rebuilt after step 5, restart from step 2.

## Recorded evidence (v1.13.0 freeze)

- Frozen tree: `extension/manifest.json` `"version": "1.13.0"`; git tag `v1.13.0`
  (created from this release commit; the GitHub Release v1.13.0 carries the zip +
  `.sha256` sidecar attached).
- Artifact: `dist/muse-auto-allow-v1.13.0.zip` — **210,496 bytes**, **19 entries**,
  `manifest.json` at the zip root; sha256
  `aaaa3fd2ef899d28d1220637e0d1fc9674058d4b723171ca1a9c473f83b63ad2` (sidecar
  `dist/muse-auto-allow-v1.13.0.zip.sha256`; `sha256sum -c` clean).
- `python scripts/verify-zip.py`: 19 matched, 0 mismatched, 0 disk-only, 0 zip-only (exit 0).
- `node scripts/smoke-zip.mjs`: exit 0, `ok: true`, 20/20 checks (extracts the shipped zip
  and passes the core e2e in scratch Chrome).
- Determinism: two full builds at the frozen tree produced the identical sha256.
- Gates on the frozen tree (2026-10-18, exit codes captured directly): `lint.mjs` 0
  (27 checks) · `background-unit.mjs` **35/35** (new G2a/b/c: pull-before-migrate ordering —
  synced values beat fresh-install seeds; explicit locals still beat sync; empty sync keeps
  the seeds) · `import-security` **154/0** (new G13: honest data restart + no-key notice) ·
  `yolo-ux-unit` 5/5 · `e2e.mjs` 0 · `followup-e2e.mjs` 0 · `mission-e2e.mjs` 0 ·
  `lang-switch-e2e.mjs` 24/24 checks at **203 keys × 6** · `codex-e2e.mjs` 0 (4 phases) · `experience.mjs --only=assert` **28/0** (the F2 reason-coverage check caught the one un-mapped reason the red-team fixes introduced — `submit-failed` — and the +1 key closed it). Several hardening edits landed across the battery window (sweep gate, import order swap, topics empty-state, the pull-callback try, and the two red-team fixes); each was re-verified immediately (syntax + lint + the full import-security suite + the in-Chrome QA pass). The FINAL artifact below was rebuilt after the LAST edit and re-verified end-to-end: determinism 2× identical, verify-zip 19/0/0/0, smoke 20/20, sidecar `-c` clean — the values in this section are the post-rebuild ones.
- New in 1.13.0 (cycle 4 — FINAL round; candidates from two bounded read-only audit subagents,
  every claim re-verified against the cited code before any change; 8 confirmed fixes, 2
  rejected with reason — `scratch/cycle4-candidates.md`):
  **C4-A** onInstalled chains pull→migrate (install defaults can no longer shadow a synced
  kill-switch, nor be pushed back over the bucket); **C4-B** sweeps wait for BOTH the v18 read
  and the enabled read — the gate lives inside `sweep()` so observer-driven sweeps are covered
  too; **C4-C** the connector hard-block climbs 2 levels on path A like path B; **C4-D**
  restore is honest for data (log/stats/clickCount absent from a file are removed — set first,
  remove second, so a quota-failed set cannot lose data; restrictions keep fail-closed merge;
  confirm copy updated ×6; a ctx-bearing file with no key gets the kept-key notice);
  **C4-E** `approvalPresent()` applies the click paths' own resolved vocabulary (a lingering
  allowed card no longer blocks every send); **C4-F** a composer that disappears after a
  submit counts as delivered (missions/rotation advance; documented trade: a mid-window
  navigation counts as delivered); **C4-G** the chart has an accessible name
  (`aria-labelledby="ccap"`, WCAG 1.1.1); **C4-H** the topics caption denominator follows the
  Total KPI (caption/KPI can never disagree) with bars clamped ≤100%.
  Rejected with reason: broadening Muse's review-bar wording to Codex's set (adds click
  surface without live evidence); cooldown-eviction order + codex digest declaration order
  (unreachable / chatty-page-only, recorded as known-minor).
- QA v1.13.0 (in-Chrome, before the battery): chart labelledby + caption text; caption
  "Bars: share of the 5-click total" with bars clamped at 100% on synthetic legacy data;
  import data-restart (old encrypted log removed with the new copy shown); the no-key notice
  dialog; the v1.12.0 authority-flip confirm regression (YOLO warn fires, import proceeds).
- Red-team: a bounded subagent review of the five v1.13.0 hardening claims (schema-corrected
  after the cycle-3 harness incident; 13m47s) returned **2 PASS with caveats, 1 FAIL, 2 PASS with
  nuances** — ALL addressed: the pullFromSync async-callback throw that could leave `fin` unfired
  was fixed (callback-local try); the FAIL on `approvalPresent()` (an unanchored status regex over
  whole card text could miss a genuinely pending card while 'Approved ·'/'Cancelled ·' resolved
  cards still blocked) was re-implemented with the **structural actionable-pair predicate** = path
  A's ground truth minus pacing (can only over-count → fail-safe); the claim-4 caveat (a failed
  first submit still armed the verify window) was fixed — the window arms only when a submit
  actually fired, and a both-fail attempt records unverified immediately as `submit-failed`.
  Verdicts and residual nuances: `scratch/cycle4-candidates.md`.
- Store captures 1/2/3/5 regenerated at this tree (`store-shot.mjs` + `stats-shot.mjs`).
- Honest open items at this freeze: CWS owner items (publisher display name, support email,
  2-Step Verification, registration fee) and the Muse-ToS owner/legal decision remain; the
  package has **not** been uploaded to the Chrome Web Store.

## Freeze procedure (v1.12.0 freeze)

Run from the repo root during the freeze, tree stable, editing lanes stopped.

1. Confirm the version: `extension/manifest.json` reads `1.12.0` (the freeze owns
   version bumps — no script edits it).
2. Rebuild clean:
   `node scripts/build.mjs`
   Expect: `manifest at root: true`, an entry count equal to the number of files in
   `extension/`, and a fresh `dist/muse-auto-allow-v1.12.0.zip` + `.sha256`.
3. Record the hash: `sha256sum dist/muse-auto-allow-v1.12.0.zip` (must equal the
   sidecar; verify with `sha256sum -c` as above).
4. Determinism proof: build once more; the hash must be **identical**. A differing
   hash means the tree changed between builds — stop and find out what moved.
5. Byte-verify + smoke: `python scripts/verify-zip.py` (19 matched, 0 mismatched)
   then `node scripts/smoke-zip.mjs` — exit 0 and `"ok": true` in the JSON summary.
6. Attach to the GitHub Release: the zip **and** its `.sha256` sidecar, per
   `docs/GITHUB_PUBLISH_RUNBOOK.md` §3 —
   `gh release create "v1.12.0" "dist/muse-auto-allow-v1.12.0.zip#…" "dist/muse-auto-allow-v1.12.0.zip.sha256#checksum" …`
   The attached zip must be the exact bytes that passed steps 2–5; if anything is
   rebuilt after step 5, restart from step 2.

## Recorded evidence (v1.12.0 freeze)

- Frozen tree: `extension/manifest.json` `"version": "1.12.0"`; git tag `v1.12.0`
  (created from this release commit; the GitHub Release v1.12.0 carries the zip +
  `.sha256` sidecar attached).
- Artifact: `dist/muse-auto-allow-v1.12.0.zip` — **208,315 bytes**, **19 entries**,
  `manifest.json` at the zip root; sha256
  `d46006bfbbb4e288d9ac0a1ade27b50b6c3116119ad350fa12d70432733c10bb` (sidecar
  `dist/muse-auto-allow-v1.12.0.zip.sha256`; `sha256sum -c` clean).
- `python scripts/verify-zip.py`: 19 matched, 0 mismatched, 0 disk-only, 0 zip-only (exit 0).
- `node scripts/smoke-zip.mjs`: exit 0, `ok: true`, 20/20 checks (extracts the shipped zip
  and passes the core e2e in scratch Chrome).
- Determinism: two full builds at the frozen tree produced the identical sha256 (verified
  with a before/after `uniq -c` — single hash, count 2).
- Gates on the frozen tree (2026-10-18, exit codes captured directly): `lint.mjs` 0
  (27 checks) · `background-unit.mjs` 32/32 · `import-security` **150/0** (was 145; the
  new G12 section: authority booleans round-trip + blockedReason round-trip) ·
  `yolo-ux-unit` 5/5 · `e2e.mjs` 0 · `followup-e2e.mjs` 0 · `mission-e2e.mjs` 0 ·
  `lang-switch-e2e.mjs` 24/24 checks (**202 keys × 6 locales**; popup height baselines
  held) · `codex-e2e.mjs` 0 (4 phases) · `scripts/bench/experience.mjs --only=assert`
  **28/0** · build + verify-zip + smoke as above.
- New in 1.12.0 (cycle 3 — AUDIT→PLAN→DO→CHECK on verified candidate evidence):
  **C3-1 backup restore keeps the authority opt-ins** (`yoloMode` / `codexEnabled` now
  round-trip; an import that would turn one ON from off asks first — "This backup turns
  on: YOLO — continue?"; turning one off or junk stays prompt-free and fail-closed) and
  blocked log entries keep their `blockedReason` across a restore; **C3-2** the
  effective-state line's precedence is now dry > off > paused > YOLO > live (an off pause
  no longer reads "Paused" with a hidden Resume while the pause row showed one);
  **C3-3** the blocked-row chevron is reason-aware (`keyword:*` → keyword list,
  `topic` → allowed-topics list, `connector` / reason-less → NO chevron);
  **C3-4** a standing-grant log entry carries a small aria-labelled lock mark (3 new
  keys ×6 locales; 202 keys/locale).
- Candidate-discipline record: the cycle-3 candidates came from a subagent audit; EVERY
  claim was re-verified against the cited code in the main session before any change —
  3 confirmed and fixed, 1 confirmed-but-by-design (recorded as a feature candidate),
  1 rejected with reason (`scratch/cycle3-candidates.md`). A red-team subagent review of
  the diff was dispatched (bounded, read-only): its final summary line was lost to a
  harness artifact (an empty `output_schema` — see the incident note below), so the
  review was completed in the main session against the same four claims — 4/4 PASS with
  file+line evidence (stats.js has exactly one `storage.local.set` path, gated;
  the chevron is UI-only and esc()'d; `standing` is `=== true`-typed; all six locales'
  `importAuthorityWarn` carry `$1`).
- Incident note (honest, harness-only): this cycle's red-team child completed its 34
  tool calls but the delegation harness replaced its final message with an empty
  summary — caused by passing an empty `output_schema` object. The child's findings were
  legible in its live transcript; the main-session re-verification above is the review of
  record. Artifact unaffected.
- Caught by the in-Chrome QA pass before any gate ran: the authority-warning dialog first
  rendered an empty `$1` (the stats page's substituted-string helper is `tp()`, not `t()`);
  fixed, and the re-run speaks "turns on: YOLO — continue?" — recorded in `CHANGELOG.md`.
- Store captures 1/2/3/5 regenerated at this tree (`store-shot.mjs` + `stats-shot.mjs`).
- Honest open items at this freeze: CWS owner items (publisher display name, support
  email, 2-Step Verification, registration fee) and the Muse-ToS owner/legal decision
  remain; the package has **not** been uploaded to the Chrome Web Store.

## Freeze procedure (v1.11.0 freeze)

Run from the repo root during the freeze, tree stable, editing lanes stopped.

1. Confirm the version: `extension/manifest.json` reads `1.11.0` (the freeze owns
   version bumps — no script edits it).
2. Rebuild clean:
   `node scripts/build.mjs`
   Expect: `manifest at root: true`, an entry count equal to the number of files in
   `extension/`, and a fresh `dist/muse-auto-allow-v1.11.0.zip` + `.sha256`.
3. Record the hash: `sha256sum dist/muse-auto-allow-v1.11.0.zip` (must equal the
   sidecar; verify with `sha256sum -c` as above).
4. Determinism proof: build once more; the hash must be **identical**. A differing
   hash means the tree changed between builds — stop and find out what moved.
5. Byte-verify + smoke: `python scripts/verify-zip.py` (19 matched, 0 mismatched)
   then `node scripts/smoke-zip.mjs` — exit 0 and `"ok": true` in the JSON summary.
6. Attach to the GitHub Release: the zip **and** its `.sha256` sidecar, per
   `docs/GITHUB_PUBLISH_RUNBOOK.md` §3 —
   `gh release create "v1.11.0" "dist/muse-auto-allow-v1.11.0.zip#…" "dist/muse-auto-allow-v1.11.0.zip.sha256#checksum" …`
   The attached zip must be the exact bytes that passed steps 2–5; if anything is
   rebuilt after step 5, restart from step 2.

## Recorded evidence (v1.11.0 freeze)

- Frozen tree: `extension/manifest.json` `"version": "1.11.0"`; git tag `v1.11.0`
  (created from this release commit; the GitHub Release v1.11.0 carries the zip +
  `.sha256` sidecar attached).
- Artifact: `dist/muse-auto-allow-v1.11.0.zip` — **206,845 bytes**, **19 entries**,
  `manifest.json` at the zip root; sha256
  `c09819c6e49baa5b7c70d5df0fa819f6d1065f74349b35d6a4785278f469cb0f` (sidecar
  `dist/muse-auto-allow-v1.11.0.zip.sha256`; `sha256sum -c` clean).
- `python scripts/verify-zip.py`: 19 matched, 0 mismatched, 0 disk-only, 0 zip-only (exit 0).
- `node scripts/smoke-zip.mjs`: exit 0, `ok: true`, 20/20 checks (extracts the shipped zip
  and passes the core e2e in scratch Chrome).
- Gates on the frozen tree (2026-10-18, exit codes captured directly): `lint.mjs` 0
  (27 checks) · `background-unit.mjs` 32/32 · `import-security` **145/0** (was 142; the
  three new G11 checks) · `yolo-ux-unit` 5/5 · `e2e.mjs` 0 · `followup-e2e.mjs` 0 ·
  `mission-e2e.mjs` 0 · `lang-switch-e2e.mjs` 24/24 checks (199 keys × 6 locales; the
  popup height baselines held with the new state line) · `codex-e2e.mjs` 0 (4 phases) ·
  `scripts/bench/experience.mjs --only=assert` **28/0** (first battery pass hit a
  transient `Target.createTarget` CDP timeout — infra, zero failed checks; the clean
  re-run on an idle machine is the recorded gate).
- New in 1.11.0 (cycle wave 2): the **effective-state line** (G01 — one always-visible
  line in the log's sticky band: Off / Paused with a one-tap Resume / Log-only / Live /
  YOLO + watched-surface tab counts; costs zero popup height; 3 new state-word keys ×6);
  the **standing-grant boolean** on log entries at both engines' log sites (G11 — never a
  new kind; the import sanitizer round-trips it boolean-only); the **blocked-entry deep
  link** into Safety's keyword group (G07); the **onboarding step-2 static list** naming
  click / keyword-skip / standing-left-to-you (G03). i18n **199 keys × 6 locales**.
  An in-Chrome QA pass during the cycle caught one real defect before any gate ran (the
  first G01 build read a storage field the popup never carried — fixed to read the
  canonical toggle checkbox); recorded in `CHANGELOG.md`.
- Multi-agent note (honest): this wave exercised the delegation pipeline on a free
  `step-5-preview` model — a probe task succeeded (24.6 s, verified answers) and one
  bounded repo edit applied correctly before stalling, but three long multi-step child
  tasks were interrupted at ~16 min (provider/model stall on long generations). The
  carry-over work (locale values, the test additions, the independent review pass) was
  completed and verified in the main session; no independent subagent review of this
  wave completed — the main-session QA pass plus the deterministic suites above are the
  verification of record. `delegation.child_timeout_seconds` is now set to 600 as a
  stall guard.
- Honest open items at this freeze: CWS owner items (publisher display name, support
  email, 2-Step Verification, registration fee) and the Muse-ToS owner/legal decision
  remain; the package has **not** been uploaded to the Chrome Web Store.

## Recorded evidence (v1.10.1 freeze)

- Frozen tree: `extension/manifest.json` `"version": "1.10.1"`; git tag `v1.10.1`
  (created from this release commit; the GitHub Release v1.10.1 carries the zip +
  `.sha256` sidecar attached).
- Artifact: `dist/muse-auto-allow-v1.10.1.zip` — **203,784 bytes**, **19 entries**,
  `manifest.json` at the zip root; sha256
  `52038092ab0b472ef98e6a149a63c9e6589381bec5cdc88bcbc2329c5f082ecb` (sidecar
  `dist/muse-auto-allow-v1.10.1.zip.sha256`; `sha256sum -c` clean).
- `python scripts/verify-zip.py`: 19 matched, 0 mismatched, 0 disk-only, 0 zip-only (exit 0).
- `node scripts/smoke-zip.mjs`: exit 0, `ok: true`, 20/20 checks (extracts the shipped zip
  and passes the core e2e in scratch Chrome; the popup i18n-substitution probe green
  against the 192-key locale set).
- Gates on the frozen tree (2026-10-18, exit codes captured directly): `lint.mjs` 0
  (27 checks) · `background-unit.mjs` 32/32 — after one **caught-and-fixed** red, disclosed:
  the release-lockstep check (M3) fired because the manifest version was bumped before
  the CHANGELOG carried its `## 1.10.1` section; the gate worked as designed, the section
  was added and a standalone re-run came back green · `import-security` 142/0 ·
  `yolo-ux-unit` 5/5 · `e2e.mjs` 0 · `followup-e2e.mjs` 0 · `mission-e2e.mjs` 0 ·
  `lang-switch-e2e.mjs` 24/24 checks (192 keys × 6 locales) — after one **transient CDP
  timeout** with zero failed checks (`Runtime.evaluate timed out`), disclosed; the clean
  re-run is the recorded gate · `codex-e2e.mjs` 0 (4 phases) · `scripts/bench/experience.mjs
  --only=assert` **28 passed / 0 failed** (now including the F6 dark-scheme checks).
- New in 1.10.1: statistics locale-aware tick labels (`Intl.DateTimeFormat`, browser UI
  locale) + the topics scope caption (bar denominator + top-12 window — the A3/S07′ shape
  the round-2 red-team refined); the deterministic **dark-scheme gate F6** (expected
  palette tokens parsed from the shipped stylesheet, no height drift across schemes
  — 429 = 429, cap 600 honoured — and ≥4.5:1 body/title contrast in both schemes,
  measured 16.86 / 15.44); store kit refresh (the five localized detailed descriptions
  now carry the Codex bullets — v1.10.0's TO-DO closed; `screenshot1/2/3/5` regenerated
  at the fused tree, all 1280×800); ja `codexHint` strengthened ("Deny は決して
  クリックしません"). i18n **192 keys × 6 locales** (parity gate green). The experience
  cycle record lives in `docs/EXPERIENCE_CYCLE_2026-10-18.md`.
- Harness hardening found by this freeze (disclosed): `scripts/stats-shot.mjs`'s seed could
  land before `chrome.storage` existed on a freshly created target (the evaluate's exception
  was dropped silently) and the stats capture then rendered EMPTY demo data — caught by
  inspecting the regenerated store capture. Seeds now wait for the page, then READ BACK and
  re-assert once; a seed that still does not land fails LOUDLY (same verify-and-reassert
  pattern as `smoke-zip.mjs`). The v1.10.0-era committed captures were checked and contain
  demo data (the race is timing-dependent); the artifact itself was unaffected.
- Honest open items at this freeze: CWS owner items (publisher display name, support
  email, 2-Step Verification, registration fee) and the Muse-ToS owner/legal decision
  remain; the package has **not** been uploaded to the Chrome Web Store (`store/PUBLISH_RUNBOOK.md`
  carries the upload path; issue #3 tracks the owner sign-off trail).

## Recorded evidence (v1.10.0 freeze)

- Frozen tree: `extension/manifest.json` `"version": "1.10.0"`; git tag `v1.10.0` → the
  release commit (`git rev-parse v1.10.0`; the GitHub Release v1.10.0 exists with the zip
  + `.sha256` sidecar attached, created from this tree).
- Artifact: `dist/muse-auto-allow-v1.10.0.zip` — **202,680 bytes**, **19 entries**
  (`codex.js` joins the 18 from v1.9.3), `manifest.json` at the zip root; sha256
  `144ef8ba1dca38b344db96275b2fc61643375a8fa7ab926af7b8555f61025316` (sidecar
  `dist/muse-auto-allow-v1.10.0.zip.sha256`; `sha256sum -c` clean).
- Determinism proof: two consecutive `node scripts/build.mjs` runs produced byte-identical
  zips (same sha256, verified at this freeze).
- `python scripts/verify-zip.py`: 19 matched, 0 mismatched, 0 disk-only, 0 zip-only (exit 0).
- `node scripts/smoke-zip.mjs`: exit 0, `ok: true`, 20/20 checks (extracts the shipped zip
  and passes the core e2e in scratch Chrome).
- Gates on the frozen tree (2026-10-18, exit codes captured directly — no pipes): `lint.mjs`
  0 (27 checks across 19 files) · `background-unit.mjs` 0 (32 checks / 0 failed) ·
  `import-security` 0 (142 checks / 0 failed) · `yolo-ux-unit.mjs` 0 (5 checks) · `e2e.mjs`
  0 (incl. the fresh-install pre-phase, `leak: null`) · `followup-e2e.mjs` 0 ·
  `mission-e2e.mjs` 0 · `lang-switch-e2e.mjs` 0 (190 keys × 6 locales) · `codex-e2e.mjs` 0
  (4 phases: OFF dormant, DRY logging-only, LIVE expected set + forbidden set untouched,
  YOLO branch; store contract: 19 `codex-allow` entries, 0 plaintext, topic `chatgpt.com`
  = 23) · `scripts/bench/experience.mjs --only=assert` 22 passed / 0 failed.
- Falsification (recorded, both directions): a mutant copy of the shipped tree with
  `if (!state.enabled) return;` removed from `codex.js` → `codex-e2e` **exit 2**, OFF phase
  `ok:false` (`logLen 10`, `codexKinds 8` — the engine acted while the switch was off);
  the pristine tree → exit 0, OFF phase `ok:true` (`logLen 0`, `codexKinds 0`), other phases
  unchanged. Run: `MAA_EXT_DIR=<mutant> node test/codex-e2e.mjs`.
- Harness hardening found by this freeze (disclosed, not hidden): `smoke-zip.mjs`'s
  fresh-install seed (write `dryRun:false`) runs immediately after extension load and could
  race the installer migration (`background.js migrate()`: get → set). Landing inside that
  window let migrate's set carry `dryRun:true` and the phase then silently measured the
  dry-run default instead of the live click path (observed under load: fixture clicks none,
  log kinds only `*-dry`; the **artifact itself was unaffected** — the post-fix run clicks
  the full expected set). The seed now verifies `dryRun === false` with the schema stamp
  present, re-asserting if the migration wins a lap; no check was weakened. The `test/`
  harnesses seed after the migration has settled and were not affected.
- New in 1.10.0: a second, opt-in engine — **Codex (ChatGPT) auto-approve** on chatgpt.com
  (`extension/codex.js`; `codexEnabled`, default off; the switch lives in the popup's
  Safety & Control panel — a full-popup overlay, so the ≤600 px popup discipline is
  unchanged — with a "Codex" chip on the Safety entry while on) carrying the same rails
  (never Deny / never a lone affirmative; auth/connector surfaces hard-blocked; the shared
  block-list + rate caps; English-label matching, fail closed). The manifest pins two
  scopes (never `<all_urls>`; still no `tabs`/`scripting`/`webRequest`/`cookies`).
  Recording rides the same store contract (kinds `codex-*`, topic `chatgpt.com`, AES-GCM
  at rest, one serialized flush under the `maa-record-v1` Web Lock). i18n is **190 keys ×
  6 locales** (11 new strings; parity green).
- Honest open items: the popup-bearing store screenshots predate the v1.10.0 layout
  (regeneration flagged in `store/PUBLISH_RUNBOOK.md`); the five localized detailed
  descriptions in `store/LISTING.md` §2 still describe only the Muse feature set (their
  closing scope line names both scopes; refresh flagged for CWS submission).
- Not done: the package has **not** been uploaded to the Chrome Web Store; no CWS review,
  no store publish.

## Recorded evidence (v1.9.3 freeze)

- Frozen tree: `extension/manifest.json` `"version": "1.9.3"`; git tag `v1.9.3` → `a13689a`
  (the freeze commit; the GitHub Release v1.9.3 exists with the zip + `.sha256` sidecar
  attached).
- Artifact: `dist/muse-auto-allow-v1.9.3.zip` — **185,014 bytes**, **18 entries**,
  `manifest.json` at the zip root; sha256
  `e3dd7703b85fffd9ad5b78a8b353c90929f4b87487f3d9dc932fdb2c5f140326` (sidecar
  `dist/muse-auto-allow-v1.9.3.zip.sha256`; `sha256sum -c` clean).
- Determinism proof: two consecutive `node scripts/build.mjs` runs produced byte-identical
  zips (same sha256).
- `python scripts/verify-zip.py`: 18 matched, 0 mismatched, 0 disk-only, 0 zip-only (exit 0).
- `node scripts/smoke-zip.mjs`: exit 0, `ok: true`, 20/20 checks (extracts the shipped zip
  and passes the core e2e in scratch Chrome).
- Gates on the frozen tree: `lint.mjs` 0 (24 checks across 18 files) · `lint.mjs --self-test`
  15/15 · `background-unit.mjs` 29/29 · `import-security` 142 checks / 0 failed (property:
  0 of 22 crafted files clear a stored restriction) · `e2e.mjs` 0 including the new
  fresh-install pre-phase (`dryPhase.ok: true`, installerSeed `{dryRun: true,
  schemaVersion: 2}`, popup banner "Logging only — nothing will be clicked", onboarding
  title "You start in logging-only mode" with the consent line "This tool grants approvals
  in your name — you stay responsible for what your agent does." and primary "Turn on live
  clicking", a driven card NOT clicked with a `-dry` log entry, `leak` null,
  `clicksWhileDry` empty) · `followup-e2e.mjs` 0 · `lang-switch-e2e.mjs` ok (173 keys × 6
  locales, parity green) · `mission-e2e.mjs` 0 (39 checks) · `scripts/bench/experience.mjs
  --only=assert` 22 passed / 0 failed.
- New in 1.9.3: **(a) an owner-approved first-run safety default** — a fresh install starts
  in dry-run/logging-only (the installer migration seeds `dryRun:true` when the key is
  ABSENT; an explicit stored choice is never overwritten), with the onboarding consent step
  in all 6 locales and the consent line *"This tool grants approvals in your name — you stay
  responsible for what your agent does."*; **(b) a real fail-open found by the new e2e
  pre-phase and fixed at the root** — the content script used to run its first sweep before
  the v1.8 settings read applied `dryRun`, so a fresh install could click live while storage
  said logging-only; the first sweep is now deferred to the v18 read and a boot gate refuses
  every sweep until that read is applied (fail-closed). Falsification recorded in both
  directions: a mutant carrying the previous `content.js` → e2e exit 2, `dryPhase.ok =
  false`, non-null `leak`; pristine tree → exit 0, `dryPhase.ok = true`, `leak` null. i18n
  is **173 keys × 6 locales** (new key `onbConsent`; `onbDryRun` renamed `onbLive`); popup
  heights unchanged (calm 518 px, logging-only 537 px).
- Honest caveat: a fresh install's first action is a **dry-run log entry** — the first LIVE
  click needs one action (turning live clicking on). The benchmark report's TTFF row
  (`docs/ELITE_BENCHMARK_REPORT.md`, Axis 3) carries the matching caveat.
- Not done: the package has **not** been uploaded to the Chrome Web Store; no CWS review, no
  store publish.

## Recorded evidence (v1.9.2 freeze — history)

- Frozen tree: `extension/manifest.json` `"version": "1.9.2"`; git tag `v1.9.2` → `0632391`
  (the freeze commit; `origin/main` has since advanced to the hosted-privacy-page docs
  commit `5cb6a47`).
- Artifact: `dist/muse-auto-allow-v1.9.2.zip` — **183,081 bytes**, **18 entries**,
  `manifest.json` at the zip root; sha256
  `0d29f0cd8e3d0d4209519d6ce270375feec11fe85273c041f1dc71384900f29c` (sidecar
  `dist/muse-auto-allow-v1.9.2.zip.sha256`; `sha256sum -c` clean).
- Determinism proof: two consecutive `node scripts/build.mjs` runs produced byte-identical
  zips (same sha256).
- `python scripts/verify-zip.py`: 18 matched, 0 mismatched, 0 disk-only, 0 zip-only (exit 0).
- `node scripts/smoke-zip.mjs`: exit 0, `ok: true` (extracts the shipped zip and passes the
  core e2e in scratch Chrome).
- Gates on the frozen tree: `lint.mjs` 0 · `lint.mjs --self-test` 15/15 ·
  `background-unit.mjs` 29/29 · `import-security` 142 checks / 0 failed (property: 0 of 22
  crafted files clear a stored restriction) · `e2e.mjs` ok · `followup-e2e.mjs` 106 checks
  0 failed · `lang-switch-e2e.mjs` 36/36 · `mission-e2e.mjs` 39 checks 0 failed ·
  `scripts/bench/experience.mjs --only=assert` 22 passed / 0 failed.
- New in 1.9.2: the **backup-restore hardening** — the import sanitizer type-validates every
  setting against the engine's own readers and merges the composite groups (rules, smart
  recovery, schedule) at sub-key granularity, so a crafted or partial backup can only tighten
  or preserve a stored restriction, never clear it (measured on the engine's effective
  post-restore values: 0 of 22 crafted files clear a stored restriction; the previous
  behaviour cleared 13 of 16); mirror guards assert the sanitizer's mission table and locale
  set equal to the shipped corpus/locales in both directions; the zero-network lint gate now
  models realistic network forms and self-tests 15 cases; the import-security harness grew
  from 29 to 142 checks (with reverse-mutation falsifications). i18n remains
  **172 keys × 6 locales**.
- Not done: the package has **not** been uploaded to the Chrome Web Store; no CWS review, no
  store publish.

## Recorded evidence (v1.9.1 freeze — history)

- Frozen tree: `extension/manifest.json` `"version": "1.9.1"`; git tag `v1.9.1` → `6187606`
  (remote `main` = `6187606`).
- Artifact: `dist/muse-auto-allow-v1.9.1.zip` — **180,069 bytes**, **18 entries**,
  `manifest.json` at the zip root; sha256
  `eec91d1d8f16005e2f34a748145d7a7d32c04b7d85f8ada267255fdb0ac8d1d8` (sidecar
  `dist/muse-auto-allow-v1.9.1.zip.sha256`).
- Determinism proof: two consecutive `node scripts/build.mjs` runs produced byte-identical
  zips (same sha256).
- `python scripts/verify-zip.py`: 18 matched, 0 mismatched, 0 disk-only, 0 zip-only (exit 0).
- `node scripts/smoke-zip.mjs`: exit 0, `ok: true` (extracts the shipped zip and passes the
  core e2e in scratch Chrome).
- Gates on the frozen tree: `lint.mjs` 0 · `background-unit.mjs` 29/29 · `e2e.mjs` ok ·
  `followup-e2e.mjs` 106 checks 0 failed · `lang-switch-e2e.mjs` ok · `mission-e2e.mjs`
  39 checks 0 failed · `scripts/bench/experience.mjs --only=assert` 22 passed / 0 failed.
- New in 1.9.1: the **accessibility/experience patch** — the popup background is `inert`
  while a dialog (Safety, Missions, onboarding) is open (accessibility-tree background
  nodes 99 → 0 safety, 22 → 0 missions, 13 → 0 onboarding); the send-refusal reason map now
  covers **all 10** engine failure reasons (added paused / schedule / dead, 3 new i18n
  keys); a blocked log chip shows `blocked · <reason>` in text **and** accessible name;
  deleting a settings key resets it to its default immediately; a failed log flush warns
  locally instead of dropping the record silently. i18n is now **172 keys × 6 locales**.
- Not done: the package has **not** been uploaded to the Chrome Web Store; no CWS review, no
  store publish.

## Recorded evidence (v1.9.0 freeze — history)

- Frozen tree: `extension/manifest.json` `"version": "1.9.0"`; git tag `v1.9.0` → `fcbdd63`
  (remote `main` = `fcbdd63`).
- Artifact: `dist/muse-auto-allow-v1.9.0.zip` — **177,387 bytes**, **18 entries**,
  `manifest.json` at the zip root; sha256
  `d1929416a88a550505c68120542dcd1830a1142f5d96bfe2a5aa195ff531718d` (sidecar
  `dist/muse-auto-allow-v1.9.0.zip.sha256`).
- Determinism proof: two consecutive `node scripts/build.mjs` runs produced byte-identical
  zips (same sha256).
- `python scripts/verify-zip.py`: 18 matched, 0 mismatched, 0 disk-only, 0 zip-only (exit 0).
- `node scripts/smoke-zip.mjs`: exit 0, `ok: true` (extracts the shipped zip and passes the
  core e2e in scratch Chrome).
- Gates on the frozen tree: `lint.mjs` 0 · `background-unit.mjs` 29/29 · `e2e.mjs` ok
  (`n7count 1`, `forbiddenHit []`) · `followup-e2e.mjs` 106 checks 0 failed ·
  `lang-switch-e2e.mjs` ok · `mission-e2e.mjs` 39 checks 0 failed.
- New in 1.9.0: the Mission Orchestrator (engine + popup Missions sheet; 4 shipped missions;
  storage `missionEnabled` + `mission{id,step,cycles,startedAt,lastSentAt}`; caps 12 steps /
  3 cycles; log kind `mission`), the measured performance work (adaptive observer debounce,
  single-query gate, one write per action — `scripts/bench/perf.mjs`), progressive disclosure
  in the popup (calm state 571 → 515 px), the store-asset clip fix, and the deterministic
  design-criteria decision; i18n is now **169 keys × 6 locales**.
- Not done: the package has **not** been uploaded to the Chrome Web Store; no CWS review, no
  store publish.

## Recorded evidence (v1.8.0 freeze — history)

- Frozen tree: `extension/manifest.json` `"version": "1.8.0"`; git tag `v1.8.0` → `91b1726`
  (remote `main` = `91b1726`).
- Artifact: `dist/muse-auto-allow-v1.8.0.zip` — **162,471 bytes**, **18 entries**,
  `manifest.json` at the zip root; sha256
  `0300d2fa42fa2ea2235669b02dfeaba8a6ee6a06227091ad249f506c4228c53b` (sidecar
  `dist/muse-auto-allow-v1.8.0.zip.sha256`).
- Determinism proof: two consecutive `node scripts/build.mjs` runs produced byte-identical
  zips (same sha256).
- `python scripts/verify-zip.py`: 18 matched, 0 mismatched, 0 disk-only, 0 zip-only (exit 0).
- `node scripts/smoke-zip.mjs`: exit 0, `ok: true` (extracts the shipped zip and passes the
  core e2e in scratch Chrome).
- Gates on the frozen tree: `lint.mjs` 0 · `e2e.mjs` 0 · `followup-e2e.mjs` 0 failed ·
  `lang-switch-e2e.mjs` 0 · `background-unit.mjs` 29/29.
- Not done: the package has **not** been uploaded to the Chrome Web Store; no CWS review, no
  store publish.

## Recorded evidence (lane run, v1.6.0 tree — history)

- Double-build: `dee10e83…96c2` both builds, byte-identical (`cmp` clean).
- `SOURCE_DATE_EPOCH=1700000000` double-build: `6857c161…98af6` both builds —
  the fixed-epoch path is deterministic too (the default-epoch artifact above is
  the canonical one).
- `verify-zip.py`: `18 matched, 0 mismatched, 0 disk-only, 0 zip-only` (exit 0).
- `smoke-zip.mjs`: exit 0, `"ok": true`, 20/20 checks true against the extracted
  artifact (sidecar match, CRC extraction, fixture click paths, popup boot, storage
  read-back).
