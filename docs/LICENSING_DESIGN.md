# License & entitlement design — Muse Auto-Allow (GOLIVE PAID, PROPOSED)

> **Status: PROPOSED — Owner-gated.** No paid capability ships from this document. The extension
> stays 100% network-free until the Owner approves this design; enabling Paid GO, generating
> signing keys and touching payment accounts are Owner-only (see `docs/GOLIVE_PAID_READINESS.md`
> §4). This is the engineering answer to *how* a paid tier could work with the product's
> invariants intact.

## 1. Context (grounded)

Chrome Web Store payments are dead (deprecated 2020, unable to charge since 2021-02-01; the
licensing API was scheduled for shutdown) — see the dossier for sources. A paid browser extension
today is sold **outside** the store and enforces an entitlement it verifies itself. This design
keeps that verification **offline** and dependency-free, which is the natural fit for this
extension (zero runtime dependencies, minimal permissions, no remote code).

## 2. Scheme — offline-verifiable signed license tokens

- **Algorithm:** ECDSA **P-256 + SHA-256** (`ES256`) through WebCrypto — supported by every
  Chrome ≥ 116 (our `minimum_chrome_version`), no libraries.
- **Token format** (JWS-compact-like, our own prefix to avoid JWS confusion):
  `MAA1.<b64url(payload_json)>.<b64url(signature)>`
  where the signature covers `MAA1.` + payload bytes.
- **Payload** (minimal, privacy-first):
  ```json
  {"v":1,"sku":"maa-pro","tier":"pro","iat":1789999999,"exp":null,"buyer":"<sha256(email)[0:16]>"}
  ```
  - `exp:null` = lifetime (one-time purchase, option A in the dossier); a number = subscription
    (option B) with grace handled below.
  - `buyer` is a *hash truncation* — the raw email never needs to enter the extension.
- **Key custody:** Owner generates the keypair **offline** (e.g. on an air-gapped session); the
  **public key** is committed into `extension/license-pubkey.js` (a constant). The **private
  key never enters the repo, the build, or this machine's project dirs.** Issuing a license =
  signing a payload with the private key (a separate, owner-run tool — NOT shipped).
- **Build guard:** `scripts/build.mjs`/lint must fail if the dev/test public key is present in a
  release build (the test key lives only in test fixtures).

## 3. Verification semantics

1. **On activation** (paste token): parse → verify signature → check `sku`/`v` → store
   `{token, tier, exp}` in `chrome.storage.local` (`license` key). Errors are explicit and
   localized: malformed / bad signature / wrong product / expired.
2. **On boot / every use:** re-verify the stored token locally (signature + `exp` vs clock).
   **Offline by design** — no network call, ever, in v1 of paid.
3. **Clock-rollback guard:** store `lastSeenAt` (monotonic best-effort). If the system clock is
   earlier than `lastSeenAt - 24h`, treat a time-limited token as **not expired but flagged**
   (grace) — never punish an honest clock glitch; a lifetime token is unaffected.
4. **No revocation in the offline design.** Accepted, documented risk: key sharing. Mitigations
   are commercial (price, support relationship, per-buyer issuance records in the Owner's
   payment platform), not technical. A future optional online check is a NEW external side
   effect and falls under **SGPS-DEC-2026-040** (§6).

## 4. Entitlement → features

- `tier:"pro"` unlocks a **PRO feature list that contains no safety rails** (rails stay free
  forever — AGENTS.md invariant). Candidate PRO surface (to be red-teamed before build):
  multi-profile mission templates, advanced stats exports, priority support marker.
- Free tier behavior is unchanged when no/invalid license: the popup shows a calm "Free" badge
  and a non-blocking activation entry; nothing degrades that exists today.

## 5. UX (six locales)

- Entry lives in the **Safety & Control panel** (zero main-popup height, the established home
  for opt-ins): `License` block → masked token field + Activate / Deactivate + tier chip.
- States: none/free · valid · expired · invalid (reason). All text-localized; `aria-live` on the
  result line; never color-only.
- The activation never writes authority switches; it only stores `license`.

## 6. Future online check (only if a subscription model is chosen)

Any periodic validation is a consequential external side effect → requires, per SGPS-DEC-2026-040:
intent ID, provider contract, **definite non-execution evidence**, UNKNOWN handling (timeout ≠
failure; authoritative readback before repeating), idempotency scope, duplicate/partial/late
behavior, Product authority separation (`PROVIDER_ACTIVE != ENTITLEMENT_AUTHORIZED`), kill
switch, recovery path, PII-safe observability, and tests. Until that design exists and is
approved, the paid surface is offline-only.

## 7. Test plan (when implementation is approved)

- Unit (node-vm, fixture keypair): valid token accepted · tampered payload rejected · wrong-sku
  rejected · expired rejected (non-grace) · clock-rollback grace applied · malformed rejected.
- e2e (scratch Chrome): activate via the real input, badge flips to PRO, survives reload; bad
  token shows the localized error and stores nothing; deactivate clears.
- Build: release build asserts the **test** public key is absent; `verify-zip` unchanged.
- Falsification: swap the public key → all valid tokens must fail (suite goes red).

## 8. Owner gates before any implementation

1. Pricing/model decision (A/B/C) and the PRO feature list.
2. Key ceremony: Owner-generated keypair; public key handed to the repo; private key custody
   documented (never in repo).
3. Legal: ToS/privacy addendum for license data (token + hashed buyer id, no telemetry).
4. Paid Go-Live Assurance: dimensions `ENTITLEMENT`, `REFUND_DISPUTE`, `OPS_SUPPORT`,
   `SECURITY_PCI`, `RECONCILIATION` etc. move from `NOT_VERIFIED` only with evidence
   (`docs/GOLIVE_PAID_READINESS.md` §3 — conjunctive, no partial credit).
