#!/usr/bin/env node
/**
 * license-unit.mjs — deterministic unit verification for the W4 DORMANT license core
 * (extension/license.js), with no browser and no Chrome. The REAL shipped module is loaded into
 * a vm sandbox (same pattern as test/background-unit.mjs:186-188 and test/anomaly-unit.mjs:41-43),
 * so every assertion drives the shipped code, not a re-implementation.
 *
 * The DEV ES256 (P-256 / SHA-256) keypair is generated HERE, IN THE TEST, with node:crypto
 * webcrypto; test tokens are signed in the harness. The dev PRIVATE key never leaves this file
 * and is never written to disk (no fixture file, no extension source, no build input) — see
 * docs/LICENSING_DESIGN.md §2 and docs/W4_LICENSE_IMPL_PLAN.md §"Fixture keypair generation".
 *
 * Checks:
 *   L1  parse valid token. MAA1.<b64url(payload)>.<b64url(sig)> parses; claims exact.
 *   L2  reject malformed. missing prefix / bad base64url / oversized / bad JSON / bad claims.
 *   L3  verify OK with the right key. plan 'pro', code 'ok'.
 *   L4  tampered payload rejected. one-byte flip in the payload segment => bad_signature.
 *   L5  wrong key rejected. a second dev keypair => bad_signature.
 *   L6  expired rejected. nowSec > exp outside the rollback grace => expired.
 *   L7  clock-rollback grace. rollback > 24h => pro + clockRollbackGrace:true; boundary exact.
 *   L8  wrong sku rejected. valid signature, sku 'maa-free' => wrong_product.
 *   L9  dormant: null key. every function resolves free/no-op and never throws.
 *   L10 dormant: garbage inputs. never throws (a rejected promise is also a failure).
 *   L11 length cap enforced. 2048 ok, 2049 malformed.
 *   L12 module source surface. no console.* / chrome.* / storage / fetch / XMLHttpRequest in
 *       extension/license.js (source-level assertion of the 0-plaintext-log + no-surface rule).
 *
 * FALSIFICATION MAP (which guard mutation turns which check red) — every guard in license.js is
 * named here so a future edit that silently drops one is caught by exactly one check:
 *   L2  dropping the `token.length > TOKEN_MAX_LENGTH` guard, the `TOKEN_PREFIX_FULL` prefix test,
 *       the base64url-alphabet/canonical-decode test, the UTF-8 fatal decode, the JSON.parse try,
 *       or validateClaims() => RED.
 *   L3  changing the signing input (e.g. hashing the whole token instead of 'MAA1.' + payload
 *       segment), the hash ('SHA-256'), the curve ('P-256') or the JWK kty/crv checks => RED.
 *   L4  re-encoding / re-serializing the payload before signing (or verifying over the JSON
 *       object instead of the EXACT segment bytes) => RED (the harness flips a payload byte and
 *       expects the signature to stop matching).
 *   L5  skipping the WebCrypto verify call, or trusting claims without a signature => RED.
 *   L6  inverting the expiry comparison, or dropping the `nowSec > parsed.exp` test => RED.
 *   L7  dropping the `now < lastSeen - CLOCK_ROLLBACK_GRACE_MS` grace, or using a different
 *       window than CLOCK_ROLLBACK_GRACE_MS => RED (the boundary assertion pins the exact 24h).
 *   L8  dropping the sku allowlist (allowedSku) or widening SKU_ALLOWED => RED.
 *   L9  removing the `isUsableJwk` dormant probe from verifyToken/entitlement (or letting
 *       parseToken/crypto run before it) => RED.
 *   L10 a path that throws on a non-string / Symbol / circular token (e.g. a bare JSON.parse or
 *       a .length read without a typeof guard) => RED.
 *   L11 the TOKEN_MAX_LENGTH constant or its use in parseToken => RED.
 *   L12 adding a console.*, chrome.*, storage, fetch, XMLHttpRequest, atob/btoa or remote-URL
 *       reference to extension/license.js => RED.
 *
 * Usage: node test/license-unit.mjs [path/to/license.js]
 * Exit 0 = all checks pass, 2 = at least one fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto as nodeCrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'extension', 'license.js');

const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail }); return !!ok; };

// ---------- sandbox: the REAL extension/license.js in a fresh vm realm ----------
// The sandbox is deliberately BARE: the module must not need document/window/chrome/atob —
// this is itself part of the dormant/no-surface guarantee. `crypto` is the sandbox's OWN
// webcrypto (host-created JWKs and signatures cross the realm boundary fine).
const sandbox = { crypto: nodeCrypto, module: { exports: {} } };
const ctx = vm.createContext(sandbox);
const SRC_SRC = fs.readFileSync(SRC, 'utf8');
vm.runInContext(SRC_SRC, ctx, { filename: SRC });
const L = sandbox.MuseLicense;

const b64url = (buf) => Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString('base64url');

// ---------- DEV keypair generated IN THE TEST (never written anywhere) ----------
const DEV = await nodeCrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const OTHER = await nodeCrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const DEV_PUBLIC_JWK = await nodeCrypto.subtle.exportKey('jwk', DEV.publicKey);
const OTHER_PUBLIC_JWK = await nodeCrypto.subtle.exportKey('jwk', OTHER.publicKey);

// The harness signs exactly like the OWNER's issuer tool would: payload segment + signature
// segment, signature over the UTF-8 bytes of 'MAA1.' + the payload segment.
async function signToken(payload, keyPair = DEV, opts = {}) {
  const payloadText = JSON.stringify(payload);
  const payloadSegment = b64url(new TextEncoder().encode(payloadText));
  const signingInput = 'MAA1.' + payloadSegment;
  const sigBuf = await nodeCrypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } }, keyPair.privateKey, new TextEncoder().encode(signingInput));
  return opts.raw
    ? { token: 'MAA1.' + payloadSegment + '.' + b64url(sigBuf), signingInput, payloadSegment, sig: b64url(sigBuf) }
    : 'MAA1.' + payloadSegment + '.' + b64url(sigBuf);
}

const NOW_MS = 1800000000000;                  // fixed clock: the module must never read the real one
const NOW_SEC = Math.floor(NOW_MS / 1000);
const payload = (over = {}) => Object.assign(
  { v: 1, sku: 'maa-pro', tier: 'pro', iat: NOW_SEC - 86400, exp: null, sub: 'a' }, over);

async function main() {
  if (!L || typeof L.parseToken !== 'function' || typeof L.verifyToken !== 'function' ||
      typeof L.entitlement !== 'function') {
    throw new Error('license.js did not expose MuseLicense.parseToken/verifyToken/entitlement');
  }

  // ================= L1 — parse a valid token =================
  const good = await signToken(payload());
  const p1 = L.parseToken(good);
  check('L1 parse valid token. MAA1.<b64url(payload)>.<b64url(sig)> parses; claims exact (v/sku/tier/iat/exp/sub)',
    p1.ok === true && p1.payload && p1.payload.v === 1 && p1.payload.sku === 'maa-pro' &&
    p1.payload.tier === 'pro' && p1.payload.iat === NOW_SEC - 86400 && p1.exp === null &&
    p1.sub === 'a' && typeof p1.signingInput === 'string' && typeof p1.signature === 'string',
    { ok: p1.ok, payload: p1.ok ? p1.payload : p1, signingInput: p1.ok && p1.signingInput });

  // ================= L2 — malformed inputs are rejected with a reason code =================
  const seg = good.split('.');
  const badCases = {
    'missing prefix': seg[1] + '.' + seg[2],
    'wrong prefix': 'XAA1.' + seg[1] + '.' + seg[2],
    'oversized token': 'x'.repeat(2049),
    'standard base64 +/ chars': 'MAA1.+.' + seg[2],
    'standard base64 slash': 'MAA1./.' + seg[2],
    'non-canonical base64url (nonzero pad bits)': 'MAA1.' + seg[1] + '.' + seg[2].slice(0, -1) + 'B',
    'bad payload JSON': 'MAA1.' + b64url('{"v":1,') + '.' + seg[2],
    'payload is not an object': 'MAA1.' + b64url('[1,2,3]') + '.' + seg[2],
    'missing signature segment': 'MAA1.' + seg[1],
    'two dots in signature': 'MAA1.' + seg[1] + '.' + seg[2] + '.' + seg[2],
    'v !== 1': await signToken(payload({ v: 2 })),
    'sku not a string': await signToken(payload({ sku: 7 })),
    'exp is a string': await signToken(payload({ exp: 'soon' })),
    'exp is NaN-ish (float)': await signToken(payload({ exp: 1.5 })),
  };
  const l2bad = [];
  for (const [label, tok] of Object.entries(badCases)) {
    let r = null, err = null;
    try { r = L.parseToken(tok); } catch (e) { err = String(e && e.message || e); }
    if (err !== null || !r || r.ok !== false || r.code !== 'malformed') l2bad.push({ label, err, code: r && r.code });
  }
  check('L2 reject malformed. missing prefix / wrong prefix / bad base64url / oversized / bad JSON / bad claims => {ok:false, code:"malformed"}, never throws',
    l2bad.length === 0, { bad: l2bad, cases: Object.keys(badCases).length });

  // ================= L3 — verify OK with the right key =================
  const v3 = await L.verifyToken(good, DEV_PUBLIC_JWK, NOW_MS, 0);
  check('L3 verify OK with the right key. plan "pro", code "ok", claims carried',
    !!v3 && v3.ok === true && v3.plan === 'pro' && v3.code === 'ok' && !v3.dormant &&
    !!v3.claims && v3.claims.sku === 'maa-pro' && v3.clockRollbackGrace === false,
    { v3 });

  // ================= L4 — tampered payload rejected =================
  const tamperedPayload = await signToken(payload({ tier: 'basic' }));
  const tamperedParts = tamperedPayload.split('.');
  // Keep the original signature but substitute a different, still-valid JSON payload segment.
  const v4 = await L.verifyToken('MAA1.' + tamperedParts[1] + '.' + seg[2], DEV_PUBLIC_JWK, NOW_MS, 0);
  check('L4 tampered payload rejected. a valid but altered payload segment with the original signature => {ok:false, code:"bad_signature"}',
    !!v4 && v4.ok === false && v4.plan === 'free' && v4.code === 'bad_signature', { v4 });

  // ================= L5 — wrong key rejected =================
  const v5 = await L.verifyToken(good, OTHER_PUBLIC_JWK, NOW_MS, 0);
  check('L5 wrong key rejected. the same token under a different P-256 public JWK => {ok:false, code:"bad_signature"}',
    !!v5 && v5.ok === false && v5.plan === 'free' && v5.code === 'bad_signature', { v5 });

  // ================= L6 — expired rejected =================
  const expiredTok = await signToken(payload({ exp: NOW_SEC - 1 }));
  const v6 = await L.verifyToken(expiredTok, DEV_PUBLIC_JWK, NOW_MS, 0);
  check('L6 expired rejected. exp = now-1s, no rollback => {ok:false, code:"expired"}',
    !!v6 && v6.ok === false && v6.plan === 'free' && v6.code === 'expired', { v6 });
  // boundary: exactly AT exp is still valid (half-open expiry: reject only nowSec > exp)
  const atExpTok = await signToken(payload({ exp: NOW_SEC }));
  const v6b = await L.verifyToken(atExpTok, DEV_PUBLIC_JWK, NOW_MS, 0);
  check('L6b expiry boundary. exp === nowSec is NOT expired (only nowSec > exp is)',
    !!v6b && v6b.ok === true && v6b.plan === 'pro', { v6b });

  // ================= L7 — clock-rollback grace behaves per plan =================
  // rolled back 25h from a lastSeenAt of NOW => grace: pro + clockRollbackGrace:true.
  const rollbackTok = await signToken(payload({ exp: NOW_SEC - 26 * 3600 })); // wall clock expired 26h ago; rollback lands 1h before exp
  const v7 = await L.verifyToken(rollbackTok, DEV_PUBLIC_JWK, NOW_MS - 25 * 3600 * 1000, NOW_MS);
  check('L7 clock-rollback grace. a >24h rollback keeps an expired-by-clock token PRO with clockRollbackGrace:true',
    !!v7 && v7.ok === true && v7.plan === 'pro' && v7.clockRollbackGrace === true, { v7 });
  // a small rollback (<24h) is NOT grace: the token is expired normally.
  const nearExpiredTok = await signToken(payload({ exp: NOW_SEC - 7200 }));
  const v7b = await L.verifyToken(nearExpiredTok, DEV_PUBLIC_JWK, NOW_MS - 3600 * 1000, NOW_MS);
  check('L7b clock-rollback grace boundary. a <24h rollback is NOT grace => expired',
    !!v7b && v7b.ok === false && v7b.code === 'expired', { v7b });
  // a lifetime token (exp:null) is unaffected by the clock either way.
  const v7c = await L.verifyToken(good, DEV_PUBLIC_JWK, NOW_MS - 90 * 24 * 3600 * 1000, NOW_MS);
  check('L7c lifetime token. exp:null stays PRO under a 90-day rollback (grace does not apply)',
    !!v7c && v7c.ok === true && v7c.plan === 'pro' && v7c.clockRollbackGrace === false, { v7c });

  // ================= L8 — wrong sku rejected =================
  const freeTok = await signToken(payload({ sku: 'maa-free' }));
  const v8 = await L.verifyToken(freeTok, DEV_PUBLIC_JWK, NOW_MS, 0);
  check('L8 wrong sku rejected. a correctly-signed token with sku "maa-free" => {ok:false, code:"wrong_product"}',
    !!v8 && v8.ok === false && v8.plan === 'free' && v8.code === 'wrong_product', { v8 });

  // ================= L9 — dormant: null key => free / no-op / never throws =================
  const dormantInputs = [null, undefined, {}, { kty: 'RSA' }, { kty: 'EC', crv: 'P-384', x: 'a', y: 'b' }, 'junk'];
  let l9err = null;
  const l9 = [];
  try {
    for (const key of dormantInputs) {
      l9.push(await L.verifyToken(good, key, NOW_MS, 0));
      l9.push(await L.entitlement(key, good, NOW_MS));
    }
    l9.push(await L.verifyToken('garbage-not-a-token', null, NOW_MS, 0));   // no parse attempted
    l9.push(await L.entitlement(undefined, undefined, undefined));
  } catch (e) { l9err = String(e && e.message || e); }
  const l9free = l9.every((r) => !!r && r.plan === 'free' && r.code === 'dormant' && r.dormant === true &&
    r.ok === true && r.claims === null);
  check('L9 dormant: null key. null/undefined/{}/RSA/EC-P384/string key => every call resolves free+dormant and never throws',
    l9err === null && l9.length === 14 && l9free, { err: l9err, results: l9 });

  // ================= L10 — dormant: garbage inputs never throw =================
  const garbage = [null, undefined, 0, 1, NaN, Infinity, true, false, '', 'x', 'MAA1.', 'MAA1..',
    '.', 'MAA1.a.b', 'MAA1.!!!.###', {}, [], Symbol ? Symbol('x') : null,
    { toString() { throw new Error('boom'); } }];
  let l10err = null;
  const l10 = [];
  try {
    for (const g of garbage) {
      let a = null, b = null;
      try { a = L.parseToken(g); } catch (e) { a = { threw: String(e && e.message || e) }; }
      try { b = await L.verifyToken(g, DEV_PUBLIC_JWK, NOW_MS, 0); } catch (e) { b = { threw: String(e && e.message || e) }; }
      l10.push({ g: typeof g, parseThrew: !!a.threw, verifyThrew: !!b.threw });
    }
    // a valid key + a garbage token must still resolve (fail closed), never reject
    for (const g of garbage) {
      const r = await L.verifyToken(g, DEV_PUBLIC_JWK, NOW_MS, 0);
      if (!r || typeof r.then === 'function') l10.push({ resolveBad: true });
    }
  } catch (e) { l10err = String(e && e.message || e); }
  check('L10 dormant: garbage inputs. null/number/boolean/object/array/Symbol/thrower token => parse+verify never throw, always resolve',
    l10err === null && l10.length > 0 && l10.every((x) => !x.parseThrew && !x.verifyThrew && !x.resolveBad),
    { err: l10err, cases: l10.length, bad: l10.filter((x) => x.parseThrew || x.verifyThrew || x.resolveBad) });

  // ================= L11 — length cap enforced =================
  const overTok = 'MAA1.' + 'A'.repeat(2048) + '.' + seg[2];
  const capOk = L.parseToken(good).ok === true;                       // well under the cap
  const capBad = L.parseToken(overTok);
  check('L11 length cap enforced. a token of 2049+ chars is malformed while a normal token parses',
    capOk && capBad.ok === false && capBad.code === 'malformed' &&
    L.TOKEN_MAX_LENGTH === 2048 && good.length < 2048,
    { cap: L.TOKEN_MAX_LENGTH, tokenLen: good.length, overLen: overTok.length, capBad });

  // ================= L12 — module source surface (0-plaintext-log + no chrome/storage/network) =================
  const FORBIDDEN = [
    [/\bconsole\s*\.\s*(log|warn|error|info|debug|trace)\s*\(/, 'console.* call'],
    [/\bchrome\s*\./, 'chrome.* API reference'],
    [/\bstorage\b/, 'storage reference'],
    [/\bfetch\s*\(/, 'fetch('],
    [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
    [/\bWebSocket\b/, 'WebSocket'],
    [/\bsendBeacon\s*\(/, 'sendBeacon('],
    [/\bdocument\s*\./, 'document.* reference'],
    [/\batob\s*\(|\bbtoa\s*\(/, 'atob/btoa reference'],
    [/\bimportScripts\s*\(/, 'importScripts('],
    [/new\s+Function\s*\(/, 'new Function('],
    [/https?:\/\//, 'hardcoded URL'],
  ];
  const l12hits = [];
  const executableSource = SRC_SRC.replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, '');
  for (const [re, label] of FORBIDDEN) if (re.test(executableSource)) l12hits.push(label);
  check('L12 module source surface. extension/license.js has no console/chrome/storage/fetch/document/atob/URL reference (dormant, 0-plaintext-log)',
    l12hits.length === 0, { hits: l12hits });

  // ---------- report ----------
  for (const c of checks) {
    console.log((c.ok ? 'PASS  ' : 'FAIL  ') + c.name + (c.ok || c.detail === undefined ? '' : '  ' + JSON.stringify(c.detail)));
  }
  const failed = checks.filter((c) => !c.ok);
  console.log(JSON.stringify({ file: path.relative(ROOT, SRC).replace(/\\/g, '/'), total: checks.length, failed: failed.length, ok: failed.length === 0 }, null, 2));
  process.exit(failed.length === 0 ? 0 : 2);
}

main().catch((e) => {
  console.error('license-unit harness error: ' + (e && e.stack || e));
  process.exit(2);
});
