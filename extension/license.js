// W4 — DORMANT license core (offline ES256 verification). docs/LICENSING_DESIGN.md §2-§3,
// docs/W4_LICENSE_IMPL_PLAN.md (approved 2026-10-19). Classic script (no ES modules, no bundler,
// no imports, zero runtime dependencies): it defines the global `MuseLicense` for the popup and
// carries a `module.exports` guard so node:vm unit tests can load the SHIPPED file verbatim
// (same pattern as extension/anomaly.js:128-129).
//
//   MuseLicense.TOKEN_MAX_LENGTH                    2048 (hard cap on the raw token string)
//   MuseLicense.CLOCK_ROLLBACK_GRACE_MS             86400000 (24h; the design's grace window)
//   MuseLicense.CODES                               the generic reason-code strings (no raw token)
//   MuseLicense.parseToken(str)                     sync   -> {ok:true, payload, signingInput,
//                                                                  signature, sku, tier, exp,
//                                                                  iat, sub} | {ok:false, code}
//   MuseLicense.verifyToken(str, key, now, lastSeenAt) async -> {ok, plan, code?, claims?}
//   MuseLicense.entitlement(key, token, now)        async -> {plan:'free'|'pro', code?, dormant?}
//
// Token grammar: 'MAA1.' + base64url(payload_json) + '.' + base64url(signature), the signature
// covering the UTF-8 bytes of 'MAA1.' + the payload segment (the JWS-compact shape with our own
// prefix). Payload: {v:1, sku, tier, iat, exp, sub?}.
//
// DORMANT CONTRACT (the core requirement): `publicKeyJwk == null` (the shipped state — no key
// configured) makes every public operation resolve to free / no-op WITHOUT throwing: verifyToken
// and entitlement return the dormant free result and parseToken stays inert. The module has no
// network, no storage and no chrome API — the CALLER supplies the key and the token, so an absent
// key can never reach a fallback path.
//
// 0-PLAINTEXT-LOG CONTRACT (AGENTS.md invariant): there is no console.* call anywhere in this
// file. Errors travel out as structured reason codes only; a raw token, payload, signature or
// buyer id is never returned in an error object, never logged, never thrown as a string.
(function () {
  'use strict';

  // --- exported constants (the UI reads these; see popup.js renderLicense) ----------------------
  var TOKEN_PREFIX = 'MAA1';
  var TOKEN_PREFIX_FULL = 'MAA1.';
  var TOKEN_MAX_LENGTH = 2048;          // hard cap on the raw token string
  var CLOCK_ROLLBACK_GRACE_MS = 24 * 60 * 60 * 1000; // 24h grace window (design §3.3)
  var CODES = Object.freeze({
    OK: 'ok',                 // 'ok' = no reason code (success)
    MALFORMED: 'malformed',   // token/claims do not match the grammar
    BAD_SIGNATURE: 'bad_signature',
    WRONG_PRODUCT: 'wrong_product',
    EXPIRED: 'expired',
    DORMANT: 'dormant',       // no key configured -> inert free, by design
  });
  var SKU_ALLOWED = Object.freeze(['maa-pro']);

  var TE = (typeof TextEncoder === 'function') ? new TextEncoder() : null;
  var TD = (typeof TextDecoder === 'function') ? new TextDecoder('utf-8', { fatal: true }) : null;

  var ROOT = (typeof globalThis === 'object' && globalThis) ? globalThis
    : (typeof window === 'object' && window) ? window : {};

  // --- tiny base64url codec. The module holds NO reference to atob/btoa: they are absent from
  // --- the Chrome MV3 service-worker realm, and reading them from globalThis would be a dynamic
  // --- property read (and one a caller could shadow). UTF-8 is handled byte-by-byte so this
  // --- works in every realm the module can live in (extension page, worker, node:vm).
  var B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var B64_LOOKUP = null;
  function b64Lookup() {
    if (B64_LOOKUP) return B64_LOOKUP;
    var t = new Uint8Array(256);
    for (var i = 0; i < 256; i++) t[i] = 255;
    for (var j = 0; j < B64_ALPHABET.length; j++) t[B64_ALPHABET.charCodeAt(j)] = j;
    t['-'.charCodeAt(0)] = 62;
    t['_'.charCodeAt(0)] = 63;
    B64_LOOKUP = t;
    return t;
  }

  function isB64UrlSegment(s) {
    return typeof s === 'string' && s.length > 0 && s.length % 4 !== 1 && /^[A-Za-z0-9_-]+$/.test(s);
  }

  function b64urlDecode(seg) {          // canonical strict base64url -> bytes (null when malformed)
    if (!isB64UrlSegment(seg)) return null;
    var lut = b64Lookup();
    var n = seg.length, out = new Uint8Array((n * 3) >> 2);
    var acc = 0, bits = 0, k = 0, i = 0;
    for (i = 0; i < n; i++) {
      var v = lut[seg.charCodeAt(i)];
      if (v === 255) return null;         // a '+' or '/' (standard base64) is NOT base64url
      acc = (acc << 6) | v; bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out[k++] = (acc >> bits) & 0xff;
        acc &= bits === 0 ? 0 : ((1 << bits) - 1); // retain only the unfinished quantum
      }
    }
    // Canonical form: the bits left over after the last quantum must be ZERO padding bits, and
    // they must not carry a value. (Non-canonical input => malformed; a permissive decoder would
    // accept two byte strings under one token and break signature binding.)
    if (bits > 0 && (acc & ((1 << bits) - 1)) !== 0) return null;
    return out.subarray(0, k);
  }

  function b64urlEncode(bytes) {        // bytes -> unpadded base64url (used for the tests' JWS)
    var bin = '', i = 0;
    for (i = 0; i + 2 < bytes.length; i += 3) {
      var n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      bin += B64_ALPHABET[(n >> 18) & 63] + B64_ALPHABET[(n >> 12) & 63] +
             B64_ALPHABET[(n >> 6) & 63] + B64_ALPHABET[n & 63];
    }
    var rem = bytes.length - i;
    if (rem === 1) {
      var m = bytes[i] << 16;
      bin += B64_ALPHABET[(m >> 18) & 63] + B64_ALPHABET[(m >> 12) & 63];
    } else if (rem === 2) {
      var m2 = (bytes[i] << 16) | (bytes[i + 1] << 8);
      bin += B64_ALPHABET[(m2 >> 18) & 63] + B64_ALPHABET[(m2 >> 12) & 63] + B64_ALPHABET[(m2 >> 6) & 63];
    }
    return bin;
  }

  function utf8Encode(str) {
    if (TE) return TE.encode(str);
    // RFC 3629 fallback (no TextEncoder in this realm)
    var out = [], i = 0;
    for (i = 0; i < str.length; i++) {
      var cp = str.charCodeAt(i);
      if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < str.length) {
        var lo = str.charCodeAt(i + 1);
        if (lo >= 0xdc00 && lo <= 0xdfff) { cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00); i++; }
      }
      if (cp < 0x80) out.push(cp);
      else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
      else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    }
    return new Uint8Array(out);
  }

  function utf8Decode(bytes) {          // fatal decode: a lone surrogate / bad sequence throws
    if (TD) return TD.decode(bytes);
    var s = '', i = 0;
    while (i < bytes.length) {
      var b = bytes[i];
      var cp, extra;
      if (b < 0x80) { cp = b; extra = 0; }
      else if ((b & 0xe0) === 0xc0) { cp = b & 0x1f; extra = 1; }
      else if ((b & 0xf0) === 0xe0) { cp = b & 0x0f; extra = 2; }
      else if ((b & 0xf8) === 0xf0) { cp = b & 0x07; extra = 3; }
      else throw new Error('bad utf8 lead byte');
      if (i + extra > bytes.length - 1) throw new Error('truncated utf8');
      for (var k = 1; k <= extra; k++) {
        var c = bytes[i + k];
        if ((c & 0xc0) !== 0x80) throw new Error('bad utf8 continuation');
        cp = (cp << 6) | (c & 0x3f);
      }
      if (cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) throw new Error('bad utf8 scalar');
      s += String.fromCodePoint(cp);
      i += extra + 1;
    }
    return s;
  }

  // --- claim validation (plan §"Module API": required fields, types, bounds) --------------------
  function isPlainObject(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    var proto = Object.getPrototypeOf(v);
    return proto === null || proto === Object.prototype;
  }
  function isFiniteInteger(v) { return typeof v === 'number' && Number.isFinite(v) && Math.floor(v) === v; }

  function validateClaims(payload) {
    if (!isPlainObject(payload)) return false;
    if (payload.v !== 1) return false;
    if (typeof payload.sku !== 'string' || payload.sku.length === 0 || payload.sku.length > 64) return false;
    if (typeof payload.tier !== 'string' || payload.tier.length === 0 || payload.tier.length > 64) return false;
    if (payload.iat !== undefined && !isFiniteInteger(payload.iat)) return false;
    if (!(payload.exp === null || payload.exp === undefined || isFiniteInteger(payload.exp))) return false;
    if (payload.sub !== undefined) {
      if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 256) return false;
    }
    return true;
  }

  // --- parseToken: STRICT grammar, synchronous, never throws, never echoes the token ------------
  function parseToken(token) {
    var malformed = { ok: false, code: CODES.MALFORMED };
    if (typeof token !== 'string') return malformed;
    if (token.length === 0 || token.length > TOKEN_MAX_LENGTH) return malformed;             // L2 oversized
    if (token.indexOf(TOKEN_PREFIX_FULL) !== 0) return malformed;                            // L2 missing prefix
    var rest = token.slice(TOKEN_PREFIX_FULL.length);
    if (rest.indexOf('.') < 0) return malformed;                                             // need sig segment
    var dot = rest.indexOf('.');
    var payloadSegment = rest.slice(0, dot);
    var sigSegment = rest.slice(dot + 1);
    if (sigSegment.indexOf('.') !== -1) return malformed;                                    // exactly 3 segments
    var payloadBytes = b64urlDecode(payloadSegment);                                         // L2 bad base64url
    var signatureBytes = b64urlDecode(sigSegment);
    if (!payloadBytes || !signatureBytes) return malformed;
    var payloadText;
    try { payloadText = utf8Decode(payloadBytes); } catch (e) { return malformed; }          // L2 bad utf-8
    var payload;
    try { payload = JSON.parse(payloadText); } catch (e) { return malformed; }               // L2 bad JSON
    if (!validateClaims(payload)) return malformed;                                          // L2 bad claims
    return {
      ok: true,
      payload: payload,
      sku: payload.sku,
      tier: payload.tier,
      exp: (payload.exp === undefined || payload.exp === null) ? null : payload.exp,
      iat: (payload.iat === undefined) ? null : payload.iat,
      sub: (payload.sub === undefined) ? null : payload.sub,
      // The EXACT signing input: the prefix plus the payload segment, byte for byte (design §2).
      signingInput: TOKEN_PREFIX_FULL + payloadSegment,
      signature: sigSegment,
    };
  }

  // --- DORMANT probe: is a configured key a REAL ES256 P-256 public JWK? Anything that is not a
  // --- plain object / not P-256 / not EC / not a usable public JWK is treated as ABSENT, so the
  // --- module stays free-and-inert instead of throwing (the shipped state is key === null).
  function isUsableJwk(key) {
    if (!key || typeof key !== 'object' || Array.isArray(key)) return false;
    if (key.kty !== 'EC' || key.crv !== 'P-256') return false;
    if (key.d) return false;                                   // a private JWK is never a verification key
    if (typeof key.x !== 'string' || !key.x || typeof key.y !== 'string' || !key.y) return false;
    return true;
  }

  function dormantResult() {
    return { ok: true, plan: 'free', code: CODES.DORMANT, dormant: true, claims: null };
  }

  function nowMsOf(nowMs) {
    return (typeof nowMs === 'number' && Number.isFinite(nowMs)) ? nowMs : Date.now();
  }
  function nowSecOf(nowMs) {
    return Math.floor((typeof nowMs === 'number' && Number.isFinite(nowMs) ? nowMs : Date.now()) / 1000);
  }
  function lastSeenOf(lastSeenAt) {
    return (typeof lastSeenAt === 'number' && Number.isFinite(lastSeenAt) && lastSeenAt > 0) ? lastSeenAt : 0;
  }

  function allowedSku(sku) {
    for (var i = 0; i < SKU_ALLOWED.length; i++) if (SKU_ALLOWED[i] === sku) return true;
    return false;
  }

  // --- verifyToken: ES256 P-256 / SHA-256 over the EXACT signing input; never throws ----------
  function verifyToken(token, publicKeyJwk, nowMs, lastSeenAt) {
    // DORMANT: no configured key => free, inert, no parse, no crypto, no throw (L9/L10).
    if (!isUsableJwk(publicKeyJwk)) return Promise.resolve(dormantResult());

    var parsed;
    try { parsed = parseToken(token); }
    catch (e) { return Promise.resolve({ ok: false, plan: 'free', code: CODES.MALFORMED, dormant: false, claims: null }); }
    if (!parsed.ok) return Promise.resolve({ ok: false, plan: 'free', code: CODES.MALFORMED, dormant: false, claims: null });

    // sku allowlist (plan §"Module API": enforce sku === 'maa-pro').
    if (!allowedSku(parsed.sku)) {
      return Promise.resolve({ ok: false, plan: 'free', code: CODES.WRONG_PRODUCT, dormant: false, claims: parsed.payload });
    }

    var subtle = (typeof crypto === 'object' && crypto && crypto.subtle) ? crypto.subtle : null;
    if (!subtle || typeof subtle.importKey !== 'function' || typeof subtle.verify !== 'function') {
      return Promise.resolve({ ok: false, plan: 'free', code: CODES.BAD_SIGNATURE, dormant: false, claims: parsed.payload });
    }

    var bytes, key;
    try {
      bytes = utf8Encode(parsed.signingInput);
      key = null;
    } catch (e) {
      return Promise.resolve({ ok: false, plan: 'free', code: CODES.BAD_SIGNATURE, dormant: false, claims: parsed.payload });
    }

    var imported;
    try {
      imported = subtle.importKey('jwk', publicKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    } catch (e) {
      return Promise.resolve({ ok: false, plan: 'free', code: CODES.BAD_SIGNATURE, dormant: false, claims: parsed.payload });
    }
    if (!imported || typeof imported.then !== 'function') {
      return Promise.resolve({ ok: false, plan: 'free', code: CODES.BAD_SIGNATURE, dormant: false, claims: parsed.payload });
    }

    var sigBytes;
    try { sigBytes = b64urlDecode(parsed.signature); } catch (e) { sigBytes = null; }
    if (!sigBytes) {
      return Promise.resolve({ ok: false, plan: 'free', code: CODES.BAD_SIGNATURE, dormant: false, claims: parsed.payload });
    }

    return Promise.resolve(imported).then(function (cryptoKey) {
      var p;
      try {
        p = subtle.verify({ name: 'ECDSA', hash: { name: 'SHA-256' } }, cryptoKey, sigBytes, bytes);
      } catch (e) {
        return { ok: false, plan: 'free', code: CODES.BAD_SIGNATURE, dormant: false, claims: parsed.payload };
      }
      if (!p || typeof p.then !== 'function') {
        return { ok: false, plan: 'free', code: CODES.BAD_SIGNATURE, dormant: false, claims: parsed.payload };
      }
      return Promise.resolve(p).then(function (valid) {
        if (valid !== true) {
          return { ok: false, plan: 'free', code: CODES.BAD_SIGNATURE, dormant: false, claims: parsed.payload };
        }
        // --- expiry vs clock, with the design's clock-rollback grace ---------------------------
        var nowSec = nowSecOf(nowMs);
        var now = nowMsOf(nowMs);
        var lastSeen = lastSeenOf(lastSeenAt);
        if (parsed.exp !== null) {
          var rolled = lastSeen > 0 && now < lastSeen - CLOCK_ROLLBACK_GRACE_MS;
          if (!rolled && nowSec > parsed.exp) {
            return { ok: false, plan: 'free', code: CODES.EXPIRED, dormant: false, claims: parsed.payload };
          }
          return {
            ok: true, plan: 'pro', code: CODES.OK, dormant: false,
            claims: parsed.payload,
            clockRollbackGrace: rolled,
          };
        }
        // lifetime token (exp === null): unaffected by the clock / grace logic.
        return { ok: true, plan: 'pro', code: CODES.OK, dormant: false, claims: parsed.payload, clockRollbackGrace: false };
      }, function () {
        return { ok: false, plan: 'free', code: CODES.BAD_SIGNATURE, dormant: false, claims: parsed.payload };
      });
    }, function () {
      return { ok: false, plan: 'free', code: CODES.BAD_SIGNATURE, dormant: false, claims: parsed.payload };
    });
  }

  // --- entitlement: the caller-facing convenience (plan / design §3) ---------------------------
  // null/absent key => { plan:'free', code:'dormant', dormant:true }; otherwise verify.
  function entitlement(publicKeyJwk, token, now) {
    if (!isUsableJwk(publicKeyJwk)) return Promise.resolve(dormantResult());
    return verifyToken(token, publicKeyJwk, now, 0).then(function (r) {
      if (!r || typeof r !== 'object') return { plan: 'free', code: CODES.BAD_SIGNATURE, dormant: false };
      return {
        plan: (r.ok && r.plan === 'pro') ? 'pro' : 'free',
        code: r.code || CODES.OK,
        dormant: false,
        claims: r.claims === undefined ? null : r.claims,
        clockRollbackGrace: !!r.clockRollbackGrace,
      };
    }, function () {
      return { plan: 'free', code: CODES.BAD_SIGNATURE, dormant: false };
    });
  }

  var api = {
    parseToken: parseToken,
    verifyToken: verifyToken,
    entitlement: entitlement,
    // internal helpers, exported for the harness (b64urlEncode) and for the owner tooling path
    b64urlEncode: b64urlEncode,
    b64urlDecode: b64urlDecode,
    SKU_ALLOWED: SKU_ALLOWED,
    TOKEN_PREFIX: TOKEN_PREFIX,
    TOKEN_PREFIX_FULL: TOKEN_PREFIX_FULL,
    TOKEN_MAX_LENGTH: TOKEN_MAX_LENGTH,
    CLOCK_ROLLBACK_GRACE_MS: CLOCK_ROLLBACK_GRACE_MS,
    CODES: CODES,
  };

  if (typeof module === 'object' && module && module.exports) module.exports = api;
  globalThis.MuseLicense = api;
})();
