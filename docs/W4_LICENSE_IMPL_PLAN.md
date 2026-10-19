# W4 license core implementation plan

## Scope / invariant

Implement W4 per `LICENSING_DESIGN.md` and approved W4 (2026-10-19): offline ES256 token verification and Safety-panel activation surface, shipped dormant. Preserve zero network, minimum permissions, and the **0-plaintext-log contract**: never log token, signature, payload, buyer hash, or validation input (including errors); use generic structured reason codes only in UI/tests. No safety rail or existing free feature is gated. Do not add payment/issuance code.

## Exact files

**New:**
- `extension/license.js` — dependency-free classic script/IIFE; exposes a frozen `globalThis.MAALicense` API. No remote code, network primitive, or runtime dependency.
- `extension/license-pubkey.js` — `globalThis.MAA_LICENSE_PUBLIC_JWK = null` initially. Owner replaces null only after key ceremony; no development key in extension sources/build.
- `test/license-unit.mjs` — node-vm tests with fixture private/public keys strictly under `test/fixtures/` (fixture files are test-only; private key never shipped).

**Integration edits:** `extension/manifest.json`, `extension/popup.html`, `extension/popup.js`, `extension/stats.js`, `scripts/lint.mjs`, `test/import-security.mjs`, `test/background-unit.mjs`, and all six `extension/_locales/{en,vi,zh_CN,ja,ko,es}/messages.json`.

## Module API and behavior (`extension/license.js`)

Storage contract: `chrome.storage.local` key `license`, shape `{token, tier, exp, lastSeenAt}`. Persist only after full successful validation; no buyer field needed. Always re-verify saved token on boot and before entitlement reads. Errors returned as codes (never throw outward): `malformed`, `bad_signature`, `wrong_product`, `expired`, `storage`.

- `parseToken(token)` — synchronous; require string, bounded length, exactly three nonempty dot-separated segments, prefix `MAA1`, strict unpadded base64url alphabet/canonical decoding, valid UTF-8 JSON object. Return `{ok:true, payload, signingInput, signature}` or `{ok:false, code:'malformed'}`. Validate payload types/required fields (`v===1`, string sku/tier, finite integer `iat`, `exp===null` or finite integer, optional bounded buyer string); reject extras only if design/schema is tightened explicitly. No raw token in result/error.
- `verifyToken(token, nowMs=Date.now(), lastSeenAt=0)` — async; if no configured public JWK, return dormant free result without parsing or throwing. Else parse, enforce `sku==='maa-pro'`, `tier==='pro'`, `v===1`; import P-256 public JWK via WebCrypto and verify ECDSA/SHA-256 over UTF-8 `MAA1.<payload-segment>` against decoded signature. Bad import/crypto/signature => `bad_signature`. For numeric expiry, reject `nowSec > exp`, except rollback grace: if `nowMs < lastSeenAt - 24h`, report verified pro with `clockRollbackGrace:true` and do not expire during that rollback state. Lifetime `exp:null` unaffected. Result always structured `{ok, tier:'free'|'pro', exp, lastSeenAt, clockRollbackGrace, code?}`; never throws.
- `activate(token)` — async; dormant => `{ok:true,tier:'free',dormant:true}` and no storage write. Otherwise verify first; on success store only `{token,tier:'pro',exp,lastSeenAt:max(Date.now(),previousLastSeenAt)}`. On invalid input leave existing license untouched; storage failure returns `storage` without leaking data.
- `deactivate()` — async; remove only `license`; dormant is successful no-op; catch storage failure and return structured result.
- `getEntitlement()` — async; dormant => `{tier:'free',dormant:true}` without throwing. Read stored token, re-verify locally; missing/invalid/expired => free (invalid stored records are not authority; may remove stale record, never throw). On valid token update `lastSeenAt` monotonically and return verification result. No consumer may treat stored `tier` as proof.

DORMANT contract is explicit: absent/null/invalid public JWK means module reports free and all public operations are safe no-ops; no parse/crypto/storage exception escapes. Put public-key constant before license module in popup script order.

## Integration edits (file + insertion point)

1. `extension/manifest.json`: `action.default_popup` remains `popup.html`; scripts are HTML-loaded, so no new permission or background/content script. Keep permissions unchanged.
2. `extension/popup.html`: in `#safetyPanel .ovbody`, append one `<div class="rgroup" id="licenseGroup">` after the existing sync-settings group and before `</div><!-- .ovbody -->` (currently lines ~795–799). Include localized heading, tier/status chip, password-style token input (`autocomplete="off"`, no saved value), Activate and Deactivate buttons, and a `<div id="licenseStatus" role="status" aria-live="polite" aria-atomic="true">`. Apply labels via `data-i18n`/`data-i18n-ph`. Add only compact `.license*` rules beside `.rgroup` CSS; inherit theme tokens, focus-visible, wrap long status, no height added outside overlay. Add `<script src="license-pubkey.js"></script><script src="license.js"></script>` immediately before existing `popup.js` script.
3. `extension/popup.js`: append localized title/close-independent label/status handling to `applyI18n()` near the existing aria/title block (lines ~67–79); implement `renderLicense()` and listeners alongside Safety panel helpers around `applyV18UI` / safety listeners (around lines 1188, 1720). On refresh call `MAALicense.getEntitlement()` and render free/pro status. Activate uses `activate(input.value)`, immediately clears input regardless of result; deactivate calls API. Render only localized reason-code messages; no token in DOM attributes, logs, exception text, or status. Refresh on `chrome.storage.onChanged` for `license` and on Safety panel open. Existing UI entitlement read: refresh callback after `applyV18UI(s)` (currently 777) invokes getter; future gated UI must call the getter and gate only explicitly approved PRO features. Do not gate current controls or alter authority switches.
4. `extension/stats.js`: export currently serializes all local storage at lines ~469–478; sanitizer is `sanitizeBackup` around line 309 and whitelist ends around 414. Add `license` sanitizer: accept only plain object with bounded nonempty `token` string (e.g. <=4096 chars, exact MAA1 compact grammar shape) and finite/null exp; emit only `{token,exp}` (never trust imported tier/lastSeenAt; getter re-verifies and maintains local clock). Count as `seen`. This lets valid license tokens ride backup/restore rules without importing entitlement claims. Ensure import handler restores sanitized license key and no failure path prints it. Do not copy token into logs or export diagnostics.

## Tests and gates

`test/license-unit.mjs` must run real `license.js` in node-vm with `crypto.webcrypto`, controlled clock/storage and test fixture public JWK. Exact required checks:
1. `valid` — signed valid token verifies PRO and activation persists only expected fields.
2. `tampered` — modified payload/signature rejected, existing stored value unchanged.
3. `expired` — expired token rejected outside rollback grace.
4. `wrong-sku` — valid signature but wrong sku rejected.
5. `malformed` — malformed segments/base64/JSON/claims return code, no throw/write.
6. `clock-rollback-grace` — rollback >24h receives grace; `lastSeenAt` monotonic; lifetime unaffected.
7. `dormant-no-key` — null key makes verify/get free and activate/deactivate no-op, no throws or writes.
Also assert deactivation clears only `license`, API/storage errors are structured, and captured console output contains no token/payload/buyer/signature (0-plaintext-log).

Required harness additions:
- `test/import-security.mjs`: expose/call `sanitizeBackup`; `license` round-trip accepts bounded token only; malformed/oversized/non-string token and forged `tier`/`lastSeenAt` are dropped; import preserves unrelated license state when license absent/invalid; no plaintext token in harness logs.
- `test/background-unit.mjs`: manifest check `L1` (or next free ID): `license.js` and `license-pubkey.js` are local popup resources, no new permission/host permission/content-script scope; license fixture key absent from manifest/build inputs.
- `scripts/lint.mjs`: add checks `LICENSE-TEST-KEY-NOT-IN-RELEASE` (scan release staging/dist/ZIP and every `extension/**` source for fixture public JWK/key fingerprint; fail on any hit; fixture allowed only below `test/fixtures/`), `LICENSE-PUBKEY-DORMANT` (committed extension key null until Owner ceremony), and retain syntax/no-network/i18n parity. Add self-test mutation proving embedding fixture key in extension source and release artifact fails. This is the explicit enforcement that test public key can never enter release.

Fixture keypair generation (local test-only; do not commit private key except clearly marked test fixture, and never use as product signing key):

```sh
node --input-type=module -e "import { webcrypto } from 'node:crypto'; const k=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']); console.log('PUBLIC_JWK='+JSON.stringify(await webcrypto.subtle.exportKey('jwk',k.publicKey))); console.log('PRIVATE_JWK_TEST_ONLY='+JSON.stringify(await webcrypto.subtle.exportKey('jwk',k.privateKey)));"
```

## Localization (all six keys in every locale; English source text)

- `licenseTitle` — “License”
- `licenseFree` — “Free”
- `licensePro` — “PRO”
- `licenseTokenPlaceholder` — “Paste license token”
- `licenseActivate` — “Activate”
- `licenseDeactivate` — “Deactivate”
- `licenseActivated` — “License activated.”
- `licenseDormant` — “License activation is not configured yet.”
- `licenseMalformed` — “This license token is malformed.”
- `licenseBadSignature` — “This license token could not be verified.”
- `licenseWrongProduct` — “This license is for a different product.”
- `licenseExpired` — “This license has expired.”
- `licenseClockGrace` — “Clock moved backward; temporary verification grace is active.”
- `licenseStorageError` — “Could not save the license. Try again.”

## Owner gates — hard stop beyond dormant module

Only the dormant module/inert UI may ship until Owner completes: (1) private/public key ceremony and custody evidence (private key never enters repo/build/machine project dirs); (2) pricing/channel and model decision details; (3) explicit PRO feature split/red-team confirming no safety rails become paid. Legal ToS/privacy addendum and paid-readiness evidence remain required before paid activation. W4’s dormant integration can be completed now; setting a production public key, issuing real tokens, unlocking PRO behavior, or adding online validation is blocked until those gates are approved.