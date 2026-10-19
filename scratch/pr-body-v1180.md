# v1.18.0 — R7 + store kit refresh + SGPS prompt-kit wiring + codex.js security fixes (CX-01..03)

Cycle on the frozen v1.17.0 baseline, orchestrated by the SGPS FULL Portfolio prompt kit vNext
1.3.1 (modes: EXECUTE_APPROVED for the approved horizon + SECURITY_FIX for the new findings +
DISCOVERY_FULL catalog presented for decision — not implemented).

## Changes

- **R7 — the Safety entry marks its own zone.** Hairline divider + gear glyph separate the
  Safety & Control entry from the pause quick-pills (last beauty-blind finding). `vi` + 200%
  zoom verified; experience instrument stays 20/20.
- **Store kit refreshed from REAL captures.** `scripts/capture-store-shots.mjs` + `store/stage.html`
  compose truthful 1280×800 stage screenshots out of the extension's own captures;
  `screenshot2-stats.png`, `screenshot3-popup.png`, `screenshot5-safety.png` regenerated
  (vision-verified: real UI, readable copy, no glitches). `store/LISTING.md` version/package
  bumped to 1.18.0.
- **SGPS orchestration driver wired in.** `docs/SGPS_PROMPT_KIT.md` (package path, provenance
  33/33 hash-verified, load/mode routing table, non-negotiables) + `AGENTS.md` §2 pointer.
- **Security fixes — third independent audit (codex.js engine, live Chromium repro).**
  Register: `docs/SECURITY_FINDINGS.md`.
  - **CX-02 (HIGH, confirmed live):** reworded auth/consent surfaces — `Provide the Bearer
    value`, `Enter your API-key`, `Complete login to GitHub` — were APPROVED by the pre-fix
    engine. `AUTH_WORD_RE`/`CONNECT_BTN_RE` widened to content.js parity + `bearer`,
    `api[-_ ]key`, `login`/`sign-in` variants; three new FORBIDDEN fixture cards
    (`cbearer`, `capikey`, `clogin`) in `codex-e2e`.
  - **CX-03 (LOW, confirmed source):** a failed context encryption could persist plaintext DOM
    context. Both engines now drop the sentence unconditionally (`delete entry.context`) — the
    documented 0-plaintext contract holds on the failure path too.
  - **CX-01 (MEDIUM):** collapsed-pending expand clicks accept text-matched buttons — the click
    is the `codex-expand` aux rail (never an approval, rate-limited, anchors/forms blocked); a
    destructive-wording skip was added and the residual documented.
- **Discovery catalog (PROPOSAL only).** `docs/PROPOSAL_CATALOG_2026-10-19.md` — 10 God-tier +
  10 Tier S+ with red-team, scores, Owner Approval Matrix, waves. Nothing coded.

## Evidence on the frozen tree

Nine suites + bench + QA v1.14.0 + `qa-experience` (20) + codex-e2e with the three new auth
negatives (`forbiddenHit: []`), then build → determinism ×2 → sidecar → verify-zip → smoke.
Numbers in `docs/RELEASE_INTEGRITY.md` (v1.18.0 section).

## Falsification direction

Narrow `AUTH_WORD_RE` back → `cbearer`/`capikey`/`clogin` get clicked (codex-e2e goes red).
Re-introduce the conditional context delete → the 0-plaintext contract fails on the failure path.
