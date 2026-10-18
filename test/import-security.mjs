#!/usr/bin/env node
/**
 * import-security.mjs — falsification harness for the backup-import path (stats.js),
 * covering the Security & Paid round findings SA-1 / SA-2 / SA-3 at frozen v1.7.0.
 *
 * It loads the REAL stats.js into a vm sandbox (chrome.storage / document / alert /
 * confirm stubs, real WebCrypto) and drives the REAL importFile 'change' handler with
 * crafted backup files, asserting the hardened behavior:
 *
 *   SA-1  a supplied cryptKeyRaw rotates the at-rest key ONLY after decrypt proof
 *         against a ctx-bearing entry — ANY of them, not just the first. No ctx-bearing
 *         entry at all => the rotation is refused and the current key is kept; proof
 *         failure on an existing ctx entry rejects the whole import (fail closed).
 *   SA-2  the auto follow-up config (followup* keys) survives export->import exactly,
 *         with per-key bounds (prompts <= 600 chars, cap 10; chips <= 64 chars, cap 32;
 *         rotateIdx <= 100000; idle/cooldown ms clamped; boolean/string types enforced).
 *   SA-3  clickCount <= 1e7; log `at` must be ISO-ish and <= 64 chars (else the entry is
 *         dropped); a quota rejection shows the dedicated importQuota message.
 *
 * For every SA-1 crafted file the harness ALSO evaluates the exact legacy decision from
 * f4f058e:extension/stats.js (the decOk expression that only looked at the FIRST entry)
 * and asserts it would have swapped the key — that is the RED contrast proving the
 * crafted cases really exercise the fixed code path.
 *
 * Usage: node test/import-security.mjs [path/to/stats.js]   (default extension/stats.js)
 *   Running it against a pre-fix blob (e.g. `git show f4f058e:extension/stats.js`) or a
 *   mutated copy MUST fail — that is the reverse-mutation falsification run.
 * Exit 0 = all assertions pass, 2 = at least one fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'extension', 'stats.js');

const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail }); return !!ok; };

// ---------- sandbox: minimal chrome / DOM stubs around the real stats.js ----------
function makeEnv() {
  const alerts = [];
  const listeners = {};
  const store = {};
  const state = { setBehavior: null, confirmAnswer: true };

  const elFor = (id) => {
    if (!listeners[id]) listeners[id] = {};
    return {
      id, textContent: '', innerHTML: '', value: '', checked: false, hidden: false, disabled: false,
      dataset: {}, style: {},
      addEventListener(type, fn) { (listeners[id][type] = listeners[id][type] || []).push(fn); },
      setAttribute() {}, removeAttribute() {}, getAttribute() { return null; },
      classList: { toggle() {}, add() {}, remove() {} },
    };
  };
  const chromeStub = {
    i18n: { getMessage: () => undefined, getUILanguage: () => 'en' }, // t() falls back to the code's fallback string
    storage: {
      local: {
        get(keys, cb) {
          const read = () => {
            if (keys === null || keys === undefined) return { ...store };
            if (Array.isArray(keys)) { const o = {}; for (const k of keys) if (k in store) o[k] = store[k]; return o; }
            const o = {};
            for (const [k, d] of Object.entries(keys)) o[k] = k in store ? store[k] : d;
            return o;
          };
          if (typeof cb === 'function') { cb(read()); return; }
          return Promise.resolve(read());
        },
        set(obj) {
          if (state.setBehavior) return Promise.reject(state.setBehavior(obj)); // simulate QUOTA rejection
          Object.assign(store, obj);
          return Promise.resolve();
        },
        remove(keys) { // v1.13.0 (C4-D): the data-restart path uses the real local.remove surface
          const ks = Array.isArray(keys) ? keys : [keys];
          for (const k of ks) delete store[k];
          return Promise.resolve();
        },
      },
      onChanged: { addListener() {} },
    },
  };
  const sandbox = {
    document: {
      getElementById: elFor,
      querySelector: () => null,
      querySelectorAll: () => [],
      documentElement: { lang: '' },
      createElement: () => ({ click() {}, style: {}, setAttribute() {} }),
    },
    chrome: chromeStub,
    alert: (m) => { alerts.push(String(m)); },
    confirm: () => state.confirmAnswer,
    crypto: globalThis.crypto,
    atob: globalThis.atob,
    btoa: globalThis.btoa,
    TextEncoder: globalThis.TextEncoder,
    TextDecoder: globalThis.TextDecoder,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (t) => clearTimeout(t),
    fetch: async () => ({ json: async () => ({}) }), // extension pages have fetch; the sandbox must too (stats.js readAsset alias binds it at load)
    console: { log() {}, warn() {}, error() {} },
  };
  return { sandbox, alerts, listeners, store, state };
}

const env = makeEnv();
const ctx = vm.createContext(env.sandbox);
const statsSrc = fs.readFileSync(SRC, 'utf8');
// typeof-guards keep this loadable for pre-fix blobs (resolveImportedKey absent => null)
vm.runInContext(
  statsSrc + '\n;globalThis.__maaTest = {' +
  ' sanitizeBackup: typeof sanitizeBackup === "function" ? sanitizeBackup : null,' +
  ' testBackupKey: typeof testBackupKey === "function" ? testBackupKey : null,' +
  ' resolveImportedKey: typeof resolveImportedKey === "function" ? resolveImportedKey : null,' +
  ' MISSION_STEPS: (typeof MISSION_STEPS === "object" && MISSION_STEPS) ? MISSION_STEPS : null,' +
  ' LOCALE_IDS: Array.isArray(typeof LOCALE_IDS !== "undefined" ? LOCALE_IDS : null) ? LOCALE_IDS : null };',
  ctx, { filename: SRC });
const T = env.sandbox.__maaTest;
const { store, alerts, listeners, state } = env;

const EN = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', '_locales', 'en', 'messages.json'), 'utf8'));
const MSG = { bad: EN.importBad.message, quota: EN.importQuota.message, kept: EN.importKeyKept.message };

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------- REAL engine readers, sliced out of content.js (F-V19-5 matrix) ----------
// The sanitizer's output only matters through what the ENGINE computes on its next boot, so the
// matrix below boots the REAL readers (content.js applyV18Settings / applyMissionSettings + their
// helpers) on the merged stored state instead of inspecting the sanitizer's shape — a shape-only
// view was the S12 test's blind spot. Slicing keeps this harness bound to the shipped engine: any
// drift in content.js changes the sliced source and therefore these assertions.
function sliceBalanced(src, startIdx, openCh, closeCh) {
  let depth = 0, q = null;
  for (let i = startIdx; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if (c === openCh) depth++;
    else if (c === closeCh) { depth--; if (depth === 0) return src.slice(startIdx, i + 1); }
  }
  throw new Error('unbalanced engine slice at ' + startIdx);
}
const sliceBlock = (src, marker, openCh, closeCh) => {
  const i = src.indexOf(marker);
  if (i < 0) throw new Error('engine marker not found: ' + marker);
  const j = src.indexOf(openCh, i);
  return src.slice(i, j) + sliceBalanced(src, j, openCh, closeCh) + ';';
};
const sliceFn = (src, name) => {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('engine function not found: ' + name);
  const j = src.indexOf('{', i);
  return src.slice(i, j) + sliceBalanced(src, j, '{', '}') + ';';
};
const sliceLine = (src, marker) => {
  const i = src.indexOf(marker);
  if (i < 0) throw new Error('engine line not found: ' + marker);
  const j = src.indexOf('\n', i);
  return src.slice(i, j < 0 ? src.length : j);
};
const engineSrc = fs.readFileSync(path.join(ROOT, 'extension', 'content.js'), 'utf8');
const ENGINE_SRC = [
  sliceBlock(engineSrc, 'const BLOCK_SEED = [', '[', ']'),
  sliceLine(engineSrc, 'const TOPIC_MAX'),
  sliceLine(engineSrc, 'const TOPIC_LEN'),
  sliceLine(engineSrc, 'const STUCK_PROMPT_DEFAULT'),
  sliceLine(engineSrc, 'const ERROR_PROMPT_DEFAULT'),
  sliceBlock(engineSrc, 'const v18 = {', '{', '}'),
  sliceFn(engineSrc, 'sanitizeList'),
  sliceLine(engineSrc, 'const hourOf'),
  sliceFn(engineSrc, 'applyV18Settings'),
  sliceBlock(engineSrc, 'const v18Defaults = {', '{', '}'),
  sliceFn(engineSrc, 'resetV18Key'),
  sliceLine(engineSrc, 'const asObj'),
  sliceBlock(engineSrc, 'const MISSION_CORPUS = [', '[', ']'),
  sliceLine(engineSrc, 'const MISSION_MAX_STEPS_PER_MISSION'),
  sliceLine(engineSrc, 'const MISSION_MAX_CYCLES'),
  sliceLine(engineSrc, 'const missionById'),
  sliceLine(engineSrc, 'const missionStepsOf'),
  sliceBlock(engineSrc, 'const mission = {', '{', '}'),
  sliceFn(engineSrc, 'sanitizeMission'),
  sliceFn(engineSrc, 'applyMissionSettings'),
  'globalThis.__engine = { v18, v18Defaults, mission, applyV18Settings, applyMissionSettings, resetV18Key };',
].join('\n');
// A FRESH content-script boot on the given stored state — content.js:1569's read defaults
// ({pauseUntil:0,dryRun:false,allowOnceMode:false,rules:{},followupSmart:{},followupSchedule:{},
// missionEnabled:false,mission:null}) + :1570's applyV18Settings/applyMissionSettings — returning
// the engine's EFFECTIVE settings, which is what the F-V19-5 matrix asserts on.
function bootEngine(merged) {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(ENGINE_SRC, sandbox, { filename: 'content.js(engine readers)' });
  const E = sandbox.__engine;
  const boot = Object.assign({ pauseUntil: 0, dryRun: false, allowOnceMode: false, rules: {}, followupSmart: {}, followupSchedule: {}, missionEnabled: false, mission: null }, merged);
  E.applyV18Settings(boot);
  E.applyMissionSettings(boot);
  return {
    allowTopics: E.v18.allowTopics.slice(), blockKeywords: E.v18.blockKeywords.slice(),
    smart: Object.assign({}, E.v18.smart), schedule: Object.assign({}, E.v18.schedule),
    pauseUntil: E.v18.pauseUntil, dryRun: E.v18.dryRun, allowOnceMode: E.v18.allowOnceMode,
    mission: { enabled: E.mission.enabled, id: E.mission.id, step: E.mission.step, cycles: E.mission.cycles },
  };
}

// ---------- crypto helpers (real WebCrypto) ----------
const b64 = (buf) => Buffer.from(new Uint8Array(buf)).toString('base64');
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function newKey() {
  const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  return b64(await crypto.subtle.exportKey('raw', k));
}
async function encryptWith(raw, text) {
  const k = await crypto.subtle.importKey('raw', unb64(raw), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(text));
  return { iv: b64(iv), ct: b64(ct) };
}
async function decryptWith(raw, c) {
  const k = await crypto.subtle.importKey('raw', unb64(raw), 'AES-GCM', false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(c.iv) }, k, unb64(c.ct));
  return new TextDecoder().decode(pt);
}

// ---------- drive the REAL import handler ----------
const backup = (data) => ({ app: 'muse-auto-allow', schemaVersion: 2, exportedAt: new Date().toISOString(), data });
const resetStore = (init) => { for (const k of Object.keys(store)) delete store[k]; Object.assign(store, init || {}); };
async function importFile(payload) {
  const before = alerts.length;
  const fns = listeners.importFile && listeners.importFile.change;
  if (!fns || !fns.length) throw new Error('importFile change listener not registered by stats.js');
  await fns[0]({ target: { files: [{ text: async () => JSON.stringify(payload) }], value: 'x' } });
  return alerts.slice(before);
}
// New guard (null when running a pre-fix blob — then mirror the old adopt-unconditionally
// behavior so the assertions below fail with a readable RED detail instead of a crash).
async function resolve(clean, current) {
  if (typeof T.resolveImportedKey === 'function') return T.resolveImportedKey(clean, current);
  return { adopt: clean.cryptKeyRaw || null, kept: false, ok: true, note: 'PRE-FIX FILE: no key guard exists' };
}
// EXACT legacy decision from f4f058e:extension/stats.js (import handler `decOk` line):
// only the FIRST log entry was consulted, and an entry without ctx skipped proof entirely.
async function legacyDecOk(clean) {
  const first = clean.log && clean.log[0];
  return !clean.cryptKeyRaw || !(first && first.ctx) ? true : await T.testBackupKey(clean.cryptKeyRaw, first.ctx);
}

async function main() {
  if (!T.sanitizeBackup || !T.testBackupKey) throw new Error('sanitizeBackup/testBackupKey not found in ' + SRC);

  const K1 = await newKey(); // the CURRENT install key
  const K2 = await newKey(); // the key a crafted backup wants to install
  const K3 = await newKey(); // unrelated key (makes ctx entries undecryptable with K2)
  const iso = new Date().toISOString();
  const iso2 = new Date(Date.now() - 3600e3).toISOString();
  const OLD_TEXT = 'old context readable only with K1';
  const encK1 = await encryptWith(K1, OLD_TEXT);   // an existing encrypted entry under the current key
  const encK2 = await encryptWith(K2, 'entry encrypted with the backup key');
  const encK3 = await encryptWith(K3, 'not decryptable with K2');

  // ================= SA-1 — key rotation requires decrypt proof =================
  // case 1: the exact audit attack — crafted key + FIRST entry WITHOUT ctx (and no other
  // entry carries ctx either). Old code: decOk=true => the key is swapped with no proof.
  resetStore({ cryptKeyRaw: K1, log: [{ at: iso, kind: 'allow', label: 'Allow', ctx: encK1 }] });
  const crafted1 = { cryptKeyRaw: K2, enabled: true, log: [{ at: iso, kind: 'allow', label: 'Allow' }] };
  const clean1 = T.sanitizeBackup(crafted1);
  const kr1 = await resolve(clean1, K1);
  check('SA-1 no-ctx: key rotation REFUSED, current key kept (ok, kept, adopt=null)',
    kr1.ok === true && kr1.kept === true && kr1.adopt === null, kr1);
  const legacy1 = await legacyDecOk(clean1);
  check('SA-1 no-ctx: LEGACY decision would swap the key with no proof (RED contrast)', legacy1 === true, { legacyDecOk: legacy1 });
  const a1 = await importFile(backup(crafted1));
  check('SA-1 no-ctx: import takes the data, stored key is UNCHANGED', store.cryptKeyRaw === K1 && store.enabled === true,
    { keyUnchanged: store.cryptKeyRaw === K1, enabled: store.enabled });
  check('SA-1 no-ctx: the key-kept message is shown', a1.includes(MSG.kept), { alerts: a1 });
  let oldStillReads = false;
  try { oldStillReads = (await decryptWith(store.cryptKeyRaw, encK1)) === OLD_TEXT; } catch { oldStillReads = false; }
  check('SA-1 no-ctx: old entries still decrypt with the kept key', oldStillReads);

  // case 2: proof may come from ANY ctx-bearing entry (not just the first)
  const crafted2 = { cryptKeyRaw: K2, log: [
    { at: iso, kind: 'allow', label: 'Allow' },
    { at: iso2, kind: 'allow', label: 'Allow', ctx: encK2 },
  ] };
  const clean2 = T.sanitizeBackup(crafted2);
  const kr2 = await resolve(clean2, K1);
  check('SA-1 any-ctx: proof against a LATER ctx entry adopts the key', kr2.ok === true && kr2.adopt === K2 && kr2.kept === false, kr2);
  resetStore({ cryptKeyRaw: K1 });
  const a2 = await importFile(backup(crafted2));
  check('SA-1 any-ctx: import adopts the proven key', store.cryptKeyRaw === K2, { key: store.cryptKeyRaw === K2, alerts: a2 });

  // case 3: ctx entries exist but NONE proves the key => reject the whole import.
  // Old code: first entry has no ctx => decOk=true => SWAP (the vulnerability).
  const crafted3 = { cryptKeyRaw: K2, enabled: true, log: [
    { at: iso, kind: 'allow', label: 'Allow' },
    { at: iso2, kind: 'allow', label: 'Allow', ctx: encK3 },
  ] };
  const clean3 = T.sanitizeBackup(crafted3);
  const kr3 = await resolve(clean3, K1);
  check('SA-1 proof-fail: unverifiable ctx entry rejects the rotation (fail closed)', kr3.ok === false && kr3.adopt === null, kr3);
  const legacy3 = await legacyDecOk(clean3);
  check('SA-1 proof-fail: LEGACY decision would swap the key anyway (RED contrast)', legacy3 === true, { legacyDecOk: legacy3 });
  resetStore({ cryptKeyRaw: K1, enabled: false });
  const a3 = await importFile(backup(crafted3));
  check('SA-1 proof-fail: import rejected, storage untouched, importBad shown',
    store.cryptKeyRaw === K1 && store.enabled === false && a3.includes(MSG.bad), { alerts: a3 });

  // case 4: classic legitimate restore — first ctx entry proves the key => adopt
  const crafted4 = { cryptKeyRaw: K2, log: [{ at: iso, kind: 'allow', label: 'Allow', ctx: encK2 }] };
  const kr4 = await resolve(T.sanitizeBackup(crafted4), K1);
  check('SA-1 first-ctx: the classic proof path still adopts the key', kr4.ok === true && kr4.adopt === K2 && kr4.kept === false, kr4);

  // case 5: key identical to the current one, no ctx entries => nothing rotates, no message
  const crafted5 = { cryptKeyRaw: K1, enabled: true, log: [{ at: iso, kind: 'allow', label: 'Allow' }] };
  const kr5 = await resolve(T.sanitizeBackup(crafted5), K1);
  check('SA-1 same-key: no rotation, no proof, no key-kept message', kr5.ok === true && kr5.kept === false && kr5.adopt === K1, kr5);
  resetStore({ cryptKeyRaw: K1 });
  const a5 = await importFile(backup(crafted5));
  check('SA-1 same-key: import proceeds without the key-kept message', store.cryptKeyRaw === K1 && !a5.includes(MSG.kept), { alerts: a5 });

  // case 6: no key in the file => key untouched, import proceeds
  const kr6 = await resolve(T.sanitizeBackup({ enabled: true }), K1);
  check('SA-1 no-key: file without a key imports without touching the key', kr6.ok === true && kr6.adopt === null && kr6.kept === false, kr6);

  // ================= SA-2 — follow-up config inheritance =================
  const cfg = {
    enabled: true, minDelayMs: 300, clickCount: 12,
    log: [{ at: iso, kind: 'allow', label: 'Allow', ctx: encK1 }],
    stats: { byDay: { '2026-10-09': 3 }, byMonth: {}, byYear: {}, byTopic: { 'test-repo': 2 } },
    cryptKeyRaw: K1,
    followupEnabled: true,
    followupPrompt: 'Continue working until the task is fully complete; Verify before claiming done — run the tests and show the output.',
    followupPrompts: ['Approve and continue working', 'Commit and push with clear messages'],
    followupChips: ['continue-full', 'verify-evidence'],
    followupRotateIdx: 1,
    followupIdleMs: 60000,
    followupCooldownMs: 600000,
  };
  const FU = ['followupEnabled', 'followupPrompt', 'followupPrompts', 'followupChips', 'followupRotateIdx', 'followupIdleMs', 'followupCooldownMs'];
  const cleanCfg = T.sanitizeBackup(cfg);
  const missing = FU.filter((k) => JSON.stringify(cleanCfg[k]) !== JSON.stringify(cfg[k]));
  check('SA-2 round-trip: export->import preserves the whole follow-up config exactly', missing.length === 0, { missing, got: cleanCfg });

  resetStore({ cryptKeyRaw: K1, followupEnabled: false, followupPrompt: 'Approve and continue working', followupChips: null });
  const aCfg = await importFile(backup(cfg));
  const rt = FU.filter((k) => JSON.stringify(store[k]) !== JSON.stringify(cfg[k]));
  check('SA-2 round-trip: the handler restores every followup* key into storage', rt.length === 0, { rt, alerts: aCfg });

  // bounds
  const b = T.sanitizeBackup({
    followupPrompt: 'z'.repeat(5000),
    followupPrompts: ['x'.repeat(700)].concat(Array.from({ length: 12 }, (_, i) => 'p' + i)),
    followupChips: ['y'.repeat(100)].concat(Array.from({ length: 40 }, (_, i) => 'chip-' + i)),
    followupRotateIdx: 1e9,
    followupIdleMs: 1e308,
    followupCooldownMs: -5,
    followupEnabled: 'true',
  }) || {}; // pre-fix blobs return null here (no followup* whitelist) — checks must FAIL, not crash
  check('SA-2 bounds: prompts cap 10, each <= 600 chars', Array.isArray(b.followupPrompts) && b.followupPrompts.length === 10 && b.followupPrompts[0].length === 600 && b.followupPrompts[1] === 'p0', { prompts: b.followupPrompts && b.followupPrompts.length, first: b.followupPrompts && b.followupPrompts[0].length });
  check('SA-2 bounds: chips cap 32, ids > 64 chars dropped', Array.isArray(b.followupChips) && b.followupChips.length === 32 && b.followupChips.every((c) => c.length <= 64) && b.followupChips[0] === 'chip-0', { chips: b.followupChips && b.followupChips.length });
  check('SA-2 bounds: rotateIdx clamped to 100000', b.followupRotateIdx === 100000, { rotateIdx: b.followupRotateIdx });
  check('SA-2 bounds: idleMs 1e308 clamps to 3600000', b.followupIdleMs === 3600000, { idleMs: b.followupIdleMs });
  check('SA-2 bounds: negative cooldownMs floors to 0', b.followupCooldownMs === 0, { cooldownMs: b.followupCooldownMs });
  check('SA-2 bounds: non-boolean followupEnabled dropped', !('followupEnabled' in b), { has: 'followupEnabled' in b });
  check('SA-2 bounds: followupPrompt capped at 4000 chars', typeof b.followupPrompt === 'string' && b.followupPrompt.length === 4000, { len: b.followupPrompt && b.followupPrompt.length });

  // ================= SA-3 — dataset bounds + quota message =================
  const s3 = T.sanitizeBackup({
    clickCount: 1e308,
    log: [
      { at: iso, kind: 'allow', label: 'ok' },
      { at: 'x'.repeat(300000), kind: 'allow', label: 'junk' },
      { at: '2026-10-09T12:00:00.000Z' + 'j'.repeat(80), kind: 'allow', label: 'long' },
      { at: 12345, kind: 'allow', label: 'nonstring' },
      { at: '2026-10-09T12:00:00+07:00', kind: 'allow', label: 'offset' },
    ],
  }) || {};
  const s3log = Array.isArray(s3.log) ? s3.log : [];
  check('SA-3 bounds: clickCount 1e308 clamped to 1e7', s3.clickCount === 1e7, { clickCount: s3.clickCount });
  check('SA-3 bounds: 300k-char / >64-char / non-ISO `at` entries dropped', s3log.length === 2 && s3log.every((e) => e.at.length <= 64), { logLen: s3log.length, ats: s3log.map((e) => String(e.at).slice(0, 40)) });
  check('SA-3 bounds: negative clickCount floors to 0', T.sanitizeBackup({ clickCount: -3 }).clickCount === 0);

  // ============ G11 (v1.11.0) — the standing-grant flag round-trips ============
  const s11 = T.sanitizeBackup({
    log: [
      { at: iso, kind: 'allow', label: 'Always allow', standing: true },
      { at: iso, kind: 'allow', label: 'Allow' },
    ],
  }) || {};
  const s11log = Array.isArray(s11.log) ? s11.log : [];
  check('G11 round-trip: a standing:true flag survives the import sanitizer (boolean)', s11log.length === 2 && !!s11log[0] && s11log[0].standing === true, { log: s11log });
  check('G11 round-trip: an entry without the flag stays without it', !!s11log[1] && !('standing' in s11log[1]), { second: s11log[1] });
  const s11junk = T.sanitizeBackup({
    log: [
      { at: iso, kind: 'allow', label: 'x', standing: 'yes' },
      { at: iso, kind: 'allow', label: 'y', standing: 1 },
      { at: iso, kind: 'allow', label: 'z', standing: {} },
    ],
  }) || {};
  const s11junkLog = Array.isArray(s11junk.log) ? s11junk.log : [];
  check('G11 junk: non-boolean standing values are dropped (entries still import)',
    s11junkLog.length === 3 && s11junkLog.every((e) => !('standing' in e)), { log: s11junkLog });

  // ============ G12 (v1.12.0) — authority opt-ins + blockedReason round-trip ============
  const s12 = T.sanitizeBackup({ yoloMode: true, codexEnabled: true }) || {};
  check('G12 authority: yoloMode / codexEnabled booleans round-trip (a user\'s own backup keeps them)',
    s12.yoloMode === true && s12.codexEnabled === true, { s12 });
  const s12off = T.sanitizeBackup({ yoloMode: false, codexEnabled: false }) || {};
  check('G12 authority: explicit false round-trips too (a restore can turn them off)',
    s12off.yoloMode === false && s12off.codexEnabled === false, { s12off });
  const s12junk = T.sanitizeBackup({ yoloMode: 'yes', codexEnabled: 1 }) || {};
  check('G12 authority junk: non-boolean values are dropped (import path stays typed)',
    !('yoloMode' in s12junk) && !('codexEnabled' in s12junk), { s12junk });
  const longBr = 'q'.repeat(200);
  const s12br = T.sanitizeBackup({ log: [
    { at: iso, kind: 'blocked', label: 'Allow', blockedReason: 'keyword:deploy' },
    { at: iso, kind: 'blocked', label: 'Allow', blockedReason: 'topic' },
    { at: iso, kind: 'blocked', label: 'Allow', blockedReason: longBr },
  ] }) || {};
  const s12brLog = Array.isArray(s12br.log) ? s12br.log : [];
  check('G12 blockedReason: reasons survive a restore, bounded to 96 chars',
    s12brLog.length === 3 && s12brLog[0].blockedReason === 'keyword:deploy' && s12brLog[1].blockedReason === 'topic' && s12brLog[2].blockedReason.length === 96,
    { log: s12brLog.map((e) => ({ br: e.blockedReason && e.blockedReason.length })) });
  const s12brJunk = T.sanitizeBackup({ log: [
    { at: iso, kind: 'blocked', label: 'x', blockedReason: 42 },
    { at: iso, kind: 'blocked', label: 'y', blockedReason: {} },
  ] }) || {};
  const s12brJunkLog = Array.isArray(s12brJunk.log) ? s12brJunk.log : [];
  check('G12 blockedReason junk: non-string reasons are dropped (entries still import)',
    s12brJunkLog.length === 2 && s12brJunkLog.every((e) => !('blockedReason' in e)), { log: s12brJunkLog });

  // ============ G13 (v1.13.0) — C4-D: honest data restore + the no-key notice ============
  resetStore({ cryptKeyRaw: K1, log: [{ at: iso, kind: 'allow', label: 'SECRET PROJECT X' }], clickCount: 777, stats: { byDay: { '2026-01-01': 5 } }, rules: { blockKeywords: ['deploy'] } });
  const aD = await importFile(backup({ enabled: true }));
  check('G13 data restart: log/stats/clickCount absent from the file are REMOVED (start clean)',
    !('log' in store) && !('stats' in store) && !('clickCount' in store), { keys: Object.keys(store), alerts: aD });
  check('G13 data restart: restriction keys absent from the file are NOT cleared (fail-closed merge kept)',
    !!(store.rules && Array.isArray(store.rules.blockKeywords) && store.rules.blockKeywords.includes('deploy')), { rules: store.rules });
  const aE = await importFile(backup({ log: [{ at: iso, kind: 'allow', label: 'NEW ENT' }], clickCount: 3 }));
  check('G13 data restart: a file-carried log replaces the old one (the old label is gone)',
    Array.isArray(store.log) && store.log.length === 1 && store.log[0].label === 'NEW ENT' && store.clickCount === 3, { log: store.log, cc: store.clickCount, alerts: aE });
  resetStore({ cryptKeyRaw: K1 });
  const aF = await importFile(backup({ log: [{ at: iso, kind: 'allow', label: 'x', ctx: { iv: 'AAAAAAAAAAAA', ct: 'BBBBBBBBBBBB' } }] }));
  check('G13 no-key notice: a ctx-bearing file without a key surfaces the kept-key alert',
    aF.includes(MSG.kept), { alerts: aF });

  // ============ G14 (v5.0) — C5-3: newer-schema backups are refused, not silently degraded ============
  resetStore({ cryptKeyRaw: K1, enabled: false, marker: 'KEEP-ME' });
  const aG = await importFile(Object.assign(backup({ clickCount: 999 }), { schemaVersion: 3 }));
  check('G14 schema guard: a schemaVersion:3 backup is REFUSED with the update-first notice (nothing imported)',
    aG.some((m) => /newer version/.test(m)) && store.marker === 'KEEP-ME' && store.clickCount === undefined && store.enabled === false,
    { alerts: aG, store: { ...store } });
  const aH = await importFile(backup({ clickCount: 7 }));
  check('G14 schema guard: a schemaVersion:2 backup still imports normally',
    store.marker === 'KEEP-ME' && store.clickCount === 7, { store: { ...store }, alerts: aH });

  // ============ G15 (v1.14.0, F4) — every autonomy-switch flip asks first (crafted-backup guard) ============
  resetStore({ cryptKeyRaw: K1, marker: 'G15-MARK' });
  state.confirmAnswer = false;
  const aK = await importFile(backup({ dryRun: false }));
  check('G15 dry-run off-flip: refused without the authority confirm (store untouched)',
    store.marker === 'G15-MARK' && !('dryRun' in store) && aK.length === 0, { alerts: aK, store: { ...store } });
  const aL = await importFile(backup({ followupEnabled: true, missionEnabled: true }));
  check('G15 follow-up/mission on-flip: refused without the authority confirm',
    store.followupEnabled === undefined && store.missionEnabled === undefined && aL.length === 0, { alerts: aL });
  resetStore({ cryptKeyRaw: K1, pauseUntil: Date.now() + 600000, marker: 'G15-MARK' });
  const aM = await importFile(backup({ pauseUntil: 0 }));
  check('G15 active-pause clear: refused without the authority confirm (pause kept)',
    Number(store.pauseUntil) > Date.now(), { alerts: aM, pauseUntil: store.pauseUntil });
  state.confirmAnswer = true;
  resetStore({ cryptKeyRaw: K1, marker: 'G15-MARK' });
  const aN = await importFile(backup({ dryRun: false }));
  check('G15 dry-run off-flip: applies once the authority confirm is accepted', store.dryRun === false, { alerts: aN, store: { ...store } });

  // ============ G16 (v1.14.0, F5-codex) — a present-but-non-numeric schemaVersion is refused; absent = legacy = accepted ============
  resetStore({ cryptKeyRaw: K1, marker: 'G16' });
  const aS = await importFile({ app: 'muse-auto-allow', schemaVersion: 'abc', data: { clickCount: 77 } });
  check('G16 garbage schemaVersion: refused as not-a-backup (store untouched)',
    aS.some((m) => /not a muse auto-allow backup/i.test(m)) && store.marker === 'G16' && store.clickCount === undefined, { alerts: aS });
  const aT = await importFile({ app: 'muse-auto-allow', data: { clickCount: 21 } });
  check('G16 absent schemaVersion: legacy import still accepted', store.clickCount === 21, { alerts: aT, store: { ...store } });

  resetStore({ cryptKeyRaw: K1, enabled: false });
  state.setBehavior = () => new Error('QUOTA_BYTES quota exceeded');
  const aQ = await importFile(backup({ enabled: true }));
  state.setBehavior = null;
  check('SA-3 quota: rejection shows the dedicated importQuota message', aQ.includes(MSG.quota) && !aQ.includes(MSG.bad), { alerts: aQ });
  check('SA-3 quota: storage untouched after the failed save', store.enabled === false && store.cryptKeyRaw === K1);
  check('SA-3 quota: the quota message differs from the not-a-backup message', MSG.quota !== MSG.bad);

  // ================= F-V19-1 — v1.8.0 / v1.9.0 key inheritance =================
  // (a) round-trip: every v1.8/v1.9 key survives export->import byte-for-byte (types intact)
  const V19 = {
    pauseUntil: 1799999999999,
    dryRun: true, allowOnceMode: false, syncSettings: true, missionEnabled: true, onboarded: true,
    userLocale: 'vi',
    rules: { allowTopics: ['repo-x', 'docs-site'], blockKeywords: ['delete', 'billing'] },
    followupSmart: { stuckMin: 10, stuckPrompt: 'Stuck? continue where you left off.', errorRecovery: true, errorPrompt: 'Fix the error, then continue.' },
    followupSchedule: { enabled: true, start: 8, end: 18, onlyActiveTab: true },
    mission: { id: 'golive-ready', step: 2, cycles: 1, startedAt: 1799990000000, lastSentAt: 1799995000000 },
  };
  const V19_KEYS = ['pauseUntil', 'dryRun', 'allowOnceMode', 'syncSettings', 'missionEnabled', 'onboarded',
    'userLocale', 'rules', 'followupSmart', 'followupSchedule', 'mission'];
  const cleanV19 = T.sanitizeBackup(V19) || {};
  const missV19 = V19_KEYS.filter((k) => JSON.stringify(cleanV19[k]) !== JSON.stringify(V19[k]));
  check('F-V19-1 round-trip: every v1.8/v1.9 key survives the sanitizer byte-for-byte (types preserved)', missV19.length === 0, { missing: missV19, got: cleanV19 });
  resetStore({ cryptKeyRaw: K1, dryRun: false, rules: null, pauseUntil: 0, mission: null, userLocale: 'auto' });
  const aV19 = await importFile(backup(V19));
  const rtV19 = V19_KEYS.filter((k) => JSON.stringify(store[k]) !== JSON.stringify(V19[k]));
  check('F-V19-1 round-trip: the handler restores every v1.8/v1.9 key into storage', rtV19.length === 0, { rt: rtV19, alerts: aV19 });
  check('F-V19-1 round-trip: no "Not a backup" alert on a v1.8/v1.9 restore', !aV19.includes(MSG.bad), { alerts: aV19 });

  // (b) a v1.8/v1.9-ONLY file imports successfully (seen>0 => NOT refused as "Not a backup")
  const onlyV19 = {
    dryRun: true, allowOnceMode: true, syncSettings: true, pauseUntil: 1799999999999,
    rules: { allowTopics: ['only-x'], blockKeywords: ['delete'] },
    followupSmart: { stuckMin: 5, errorRecovery: true },
    followupSchedule: { enabled: true, start: 9, end: 17, onlyActiveTab: false },
    missionEnabled: true, mission: { id: 'audit-only', step: 1, cycles: 0, startedAt: 1799990000000, lastSentAt: 0 },
    userLocale: 'ja', onboarded: true,
  };
  const cleanOnly = T.sanitizeBackup(onlyV19);
  check('F-V19-1 v1.9-only: a file of ONLY the v1.8/v1.9 keys is accepted (seen>0, not null)', cleanOnly !== null, { clean: cleanOnly });
  resetStore({ cryptKeyRaw: K1 });
  const aOnly = await importFile(backup(onlyV19));
  check('F-V19-1 v1.9-only: the import succeeds — NO "Not a backup" refusal, dryRun applied', !aOnly.includes(MSG.bad) && store.dryRun === true, { alerts: aOnly, dryRun: store.dryRun });

  // (c) a TAMPERED file is sanitized to defaults/clamped, never adopted raw
  const tampered = {
    rules: 'not-an-object',                                                // whole rules a string => dropped
    mission: { id: 'evil-mission', step: 3, cycles: 999, startedAt: 1 },   // unknown id => dropped
    userLocale: 'xx',                                                      // not a shipped locale => dropped
    pauseUntil: 'soon',                                                    // not a number => dropped
    dryRun: 'true',                                                        // not a boolean => dropped
  };
  check('F-V19-1 tamper: an ALL-junk file is refused (seen===0 => null)', T.sanitizeBackup(tampered) === null, { clean: T.sanitizeBackup(tampered) });
  const mixed = T.sanitizeBackup(Object.assign({ enabled: true }, tampered)) || {};
  check('F-V19-1 tamper: rules as a string is dropped (never adopted raw)', !('rules' in mixed), { rules: mixed.rules });
  check('F-V19-1 tamper: mission with an unknown id is dropped (fail closed)', !('mission' in mixed), { mission: mixed.mission });
  check('F-V19-1 tamper: userLocale "xx" is dropped', mixed.userLocale === undefined, { userLocale: mixed.userLocale });
  check('F-V19-1 tamper: pauseUntil "soon" is dropped', mixed.pauseUntil === undefined, { pauseUntil: mixed.pauseUntil });
  check('F-V19-1 tamper: dryRun "true" (string) is dropped', mixed.dryRun === undefined, { dryRun: mixed.dryRun });

  const clamped = T.sanitizeBackup({
    enabled: true,
    pauseUntil: -5,
    rules: { allowTopics: 'nope', blockKeywords: ['Delete', 'billing'] },
    followupSmart: { stuckMin: 1e9, errorRecovery: 'yes' },
    followupSchedule: { start: 99, end: 8, enabled: 'yes' },
    mission: { id: 'golive-ready', step: 999, cycles: 999, startedAt: -1, lastSentAt: 'x' },
  }) || {};
  const cSmart = clamped.followupSmart || {}, cSch = clamped.followupSchedule || {}, cMis = clamped.mission || {};
  check('F-V19-1 tamper: pauseUntil -5 clamps to 0', clamped.pauseUntil === 0, { pauseUntil: clamped.pauseUntil });
  check('F-V19-1 tamper: rules.allowTopics non-array dropped, blockKeywords kept verbatim',
    !('allowTopics' in (clamped.rules || {})) && JSON.stringify(clamped.rules && clamped.rules.blockKeywords) === JSON.stringify(['Delete', 'billing']), { rules: clamped.rules });
  check('F-V19-1 tamper: followupSmart.stuckMin 1e9 clamps to 1440, errorRecovery string dropped',
    cSmart.stuckMin === 1440 && cSmart.errorRecovery === undefined, { smart: clamped.followupSmart });
  check('F-V19-1 tamper: followupSchedule.start 99 dropped, end 8 kept, enabled string dropped',
    cSch.start === undefined && cSch.end === 8 && cSch.enabled === undefined, { sch: clamped.followupSchedule });
  check('F-V19-1 tamper: mission step 999 clamps to L-1 (5) and cycles 999 clamps to 3',
    cMis.step === 5 && cMis.cycles === 3, { mission: clamped.mission });
  check('F-V19-1 tamper: mission startedAt -1 => finite now (>0), lastSentAt "x" => 0',
    Number.isFinite(cMis.startedAt) && cMis.startedAt > 0 && cMis.lastSentAt === 0, { mission: clamped.mission });
  check('F-V19-1 tamper: no prototype pollution from the crafted objects',
    ({}).polluted === undefined && Object.prototype.polluted === undefined && !Object.getOwnPropertyNames(clamped.rules || {}).includes('__proto__'),
    { rulesKeys: Object.getOwnPropertyNames(clamped.rules || {}) });
  const proto = T.sanitizeBackup(JSON.parse('{"enabled":true,"rules":{"__proto__":{"polluted":"yes"}},"followupSmart":{"__proto__":{"polluted":"yes"}},"mission":{"__proto__":{"polluted":"yes"}}}')) || {};
  check('F-V19-1 tamper: a __proto__-bearing rules/followupSmart/mission does not pollute Object.prototype',
    ({}).polluted === undefined && Object.prototype.polluted === undefined && !Object.getOwnPropertyNames(proto.rules || {}).includes('__proto__'),
    { rulesKeys: Object.getOwnPropertyNames(proto.rules || {}) });

  // Mirror guard: the mission id/step table mirrored into stats.js must equal the engine's own
  // MISSION_CORPUS (content.js) — a drift here would let the sanitizer accept a mission the
  // engine refuses, or vice versa.
  const contentSrc = fs.readFileSync(path.join(ROOT, 'extension', 'content.js'), 'utf8');
  const corpusBlock = contentSrc.match(/MISSION_CORPUS_BEGIN([\s\S]*?)MISSION_CORPUS_END/);
  const corpusMap = {};
  if (corpusBlock) {
    const re = /id:\s*'([^']+)'[\s\S]*?steps:\s*\[([\s\S]*?)\],/g;
    let mm;
    while ((mm = re.exec(corpusBlock[1]))) corpusMap[mm[1]] = (mm[2].match(/^\s*'/gm) || []).length;
  }
  check('F-V19-1 mirror: stats.js MISSION_STEPS === content.js MISSION_CORPUS ids + step counts',
    Object.keys(corpusMap).length === 4 && JSON.stringify(corpusMap) === JSON.stringify(T.MISSION_STEPS || null), { corpus: corpusMap, stats: T.MISSION_STEPS });
  // Mirror guard (F-V19-6): stats.js LOCALE_IDS must equal the SHIPPED locale set — the
  // extension/_locales directory set AND popup.js's own LOCALE_IDS — not a hardcoded literal. A
  // literal pinned only one direction: shipping a 7th locale left the guard GREEN while
  // sanitizeBackup dropped its userLocale (a silent loss of the user's language choice).
  const localesDir = path.join(ROOT, 'extension', '_locales');
  const shippedLocales = fs.readdirSync(localesDir).filter((d) => fs.statSync(path.join(localesDir, d)).isDirectory()).sort();
  const popupSrc = fs.readFileSync(path.join(ROOT, 'extension', 'popup.js'), 'utf8');
  const popupLocaleMatch = popupSrc.match(/const\s+LOCALE_IDS\s*=\s*\[([^\]]*)\]/);
  const popupLocaleIds = popupLocaleMatch ? popupLocaleMatch[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean) : null;
  check('F-V19-6 mirror: stats.js LOCALE_IDS === the shipped _locales directory set',
    Array.isArray(T.LOCALE_IDS) && eq(T.LOCALE_IDS.slice().sort(), shippedLocales), { stats: T.LOCALE_IDS, shipped: shippedLocales });
  check('F-V19-6 mirror: stats.js LOCALE_IDS === popup.js LOCALE_IDS (same order)',
    Array.isArray(T.LOCALE_IDS) && eq(T.LOCALE_IDS, popupLocaleIds), { stats: T.LOCALE_IDS, popup: popupLocaleIds });
  // drift in BOTH directions: every shipped locale must be ACCEPTED by the sanitizer (a locale
  // shipped without the sanitizer being updated is exactly the F-V19-6 silent-loss case)
  const droppedLocales = shippedLocales.filter((loc) => { const c = T.sanitizeBackup({ userLocale: loc }); return !c || c.userLocale !== loc; });
  check('F-V19-6: sanitizeBackup keeps EVERY shipped locale id (no silent drop on locale drift)', droppedLocales.length === 0, { dropped: droppedLocales });
  check('F-V19-6: sanitizeBackup drops an unshipped locale id ("xx")', T.sanitizeBackup({ userLocale: 'xx' }) === null, { clean: T.sanitizeBackup({ userLocale: 'xx' }) });

  // ================= F-V19-5 — the container-emission PROPERTY =================
  // PROPERTY (not shape): a crafted/partial file can never make the engine's EFFECTIVE setting
  // LOOSER than the stored one — for every container sub-key an accepted value survives, an invalid
  // value is dropped, and a sub-key the file did not validly provide keeps its STORED effective
  // value (never a reset-to-default). Asserted on the engine's values after a REAL boot.
  const STORED = {
    pauseUntil: 1799999999999, dryRun: true, allowOnceMode: true, missionEnabled: true,
    rules: { allowTopics: ['repo-x', 'docs-site'], blockKeywords: ['delete', 'billing', 'custom-kw'] },
    followupSmart: { stuckMin: 7, stuckPrompt: 'stored stuck prompt', errorRecovery: true, errorPrompt: 'stored error prompt' },
    followupSchedule: { enabled: true, start: 9, end: 17, onlyActiveTab: true },
    mission: { id: 'golive-ready', step: 2, cycles: 1, startedAt: 1799990000000, lastSentAt: 1799995000000 },
  };
  const BASELINE = bootEngine(STORED);
  const CONTAINER_SUBS = {
    rules: ['allowTopics', 'blockKeywords'],
    followupSmart: ['stuckMin', 'stuckPrompt', 'errorRecovery', 'errorPrompt'],
    followupSchedule: ['enabled', 'start', 'end', 'onlyActiveTab'],
  };
  const effOf = (st, cont, sk) => cont === 'rules' ? (sk === 'allowTopics' ? st.allowTopics : st.blockKeywords)
    : (cont === 'followupSmart' ? st.smart[sk] : st.schedule[sk]);
  // The "effective restriction" ordering, restricted to the sub-keys the file did NOT validly
  // provide. Empty result = the import never loosened a stored restriction.
  function looseness(after, before, provided) {
    const has = (p) => provided.indexOf(p) >= 0;
    const out = [];
    if (!has('rules.allowTopics') && before.allowTopics.length > 0 && after.allowTopics.length === 0) out.push('allowTopics whitelist CLEARED');
    if (!has('rules.blockKeywords')) { const a = new Set(after.blockKeywords); for (const k of before.blockKeywords) if (!a.has(k)) out.push('blockKeyword lost: ' + k); }
    if (!has('followupSmart.stuckMin') && before.smart.stuckMin !== after.smart.stuckMin) out.push('smart.stuckMin changed');
    if (!has('followupSmart.stuckPrompt') && before.smart.stuckPrompt !== after.smart.stuckPrompt) out.push('smart.stuckPrompt replaced');
    if (!has('followupSmart.errorRecovery') && before.smart.errorRecovery === true && after.smart.errorRecovery !== true) out.push('smart.errorRecovery CLEARED');
    if (!has('followupSmart.errorPrompt') && before.smart.errorPrompt !== after.smart.errorPrompt) out.push('smart.errorPrompt replaced');
    if (!has('followupSchedule.enabled') && before.schedule.enabled === true && after.schedule.enabled !== true) out.push('schedule.enabled CLEARED (sends outside the window)');
    if (!has('followupSchedule.start') && before.schedule.start !== after.schedule.start) out.push('schedule.start changed');
    if (!has('followupSchedule.end') && before.schedule.end !== after.schedule.end) out.push('schedule.end changed');
    if (!has('followupSchedule.onlyActiveTab') && before.schedule.onlyActiveTab !== after.schedule.onlyActiveTab) out.push('schedule.onlyActiveTab changed');
    if (!has('pauseUntil') && before.pauseUntil > 0 && !(after.pauseUntil > 0)) out.push('pauseUntil CLEARED');
    if (!has('dryRun') && before.dryRun === true && after.dryRun !== true) out.push('dryRun CLEARED');
    if (!has('mission') && before.mission.id && !after.mission.id) out.push('mission CLEARED');
    return out;
  }
  // Drive the REAL handler on a fresh store = STORED, then boot the REAL engine on the resulting
  // store (the stub's storage.set merges exactly like chrome.storage.local.set).
  async function runCase(data) {
    resetStore(Object.assign({ cryptKeyRaw: K1 }, clone(STORED)));
    const clean = T.sanitizeBackup(data);
    await importFile(backup(data));
    return { clean, after: bootEngine(Object.assign({}, store)) };
  }
  // emitted = the container the sanitizer must emit (null = DROPPED entirely, never {});
  // provided = the container sub-key paths the file VALIDLY provides; refused = seen===0 => null.
  const CASES = [
    // (a) valid -> survives byte-for-byte
    { name: 'F-V19-5 rules (a) both sub-keys valid', data: { rules: { allowTopics: ['repo-x'], blockKeywords: ['keepme', 'dropme'] } },
      emitted: { rules: { allowTopics: ['repo-x'], blockKeywords: ['keepme', 'dropme'] } }, provided: ['rules.allowTopics', 'rules.blockKeywords'] },
    { name: 'F-V19-5 smart (a) all four sub-keys valid', data: { followupSmart: { stuckMin: 5, stuckPrompt: 'p', errorRecovery: true, errorPrompt: 'q' } },
      emitted: { followupSmart: { stuckMin: 5, stuckPrompt: 'p', errorRecovery: true, errorPrompt: 'q' } }, provided: ['followupSmart.stuckMin', 'followupSmart.stuckPrompt', 'followupSmart.errorRecovery', 'followupSmart.errorPrompt'] },
    { name: 'F-V19-5 schedule (a) all four sub-keys valid', data: { followupSchedule: { enabled: true, start: 10, end: 16, onlyActiveTab: false } },
      emitted: { followupSchedule: { enabled: true, start: 10, end: 16, onlyActiveTab: false } }, provided: ['followupSchedule.enabled', 'followupSchedule.start', 'followupSchedule.end', 'followupSchedule.onlyActiveTab'] },
    // (b) invalid / mixed — the sub-keys the file did not validly provide must stay STORED
    { name: 'F-V19-5 rules (b) allowTopics:"nope" (S13 row 1)', data: { rules: { allowTopics: 'nope' } }, emitted: { rules: null }, provided: [], refused: true },
    { name: 'F-V19-5 rules (b) allowTopics all-junk array (S13 row 4)', data: { rules: { allowTopics: [['repo-x'], 5, null, {}, '  '] } }, emitted: { rules: null }, provided: [], refused: true },
    { name: 'F-V19-5 rules (b) empty rules object (S13 row 3)', data: { rules: {} }, emitted: { rules: null }, provided: [], refused: true },
    { name: 'F-V19-5 rules (b) MIXED allowTopics valid + blockKeywords junk', data: { rules: { allowTopics: ['repo-x'], blockKeywords: 'junk' } },
      emitted: { rules: { allowTopics: ['repo-x'] } }, provided: ['rules.allowTopics'] },
    { name: 'F-V19-5 rules (b) PARTIAL blockKeywords only (S13 row 5 shape)', data: { rules: { blockKeywords: ['keepme'] } },
      emitted: { rules: { blockKeywords: ['keepme'] } }, provided: ['rules.blockKeywords'] },
    { name: 'F-V19-5 rules (b) __proto__ carrier (S13 row 7)', data: JSON.parse('{"rules":{"__proto__":{"allowTopics":["evil"]}}}'), emitted: { rules: null }, provided: [], refused: true },
    { name: 'F-V19-5 smart (b) stuckMin:"x" (S13 row 11)', data: { followupSmart: { stuckMin: 'x' } }, emitted: { followupSmart: null }, provided: [], refused: true },
    { name: 'F-V19-5 smart (b) MIXED stuckMin valid + errorRecovery junk', data: { followupSmart: { stuckMin: 3, errorRecovery: 'yes' } },
      emitted: { followupSmart: { stuckMin: 3 } }, provided: ['followupSmart.stuckMin'] },
    { name: 'F-V19-5 smart (b) empty smart object', data: { followupSmart: {} }, emitted: { followupSmart: null }, provided: [], refused: true },
    { name: 'F-V19-5 schedule (b) enabled:"yes" (S13 row 9)', data: { followupSchedule: { enabled: 'yes' } }, emitted: { followupSchedule: null }, provided: [], refused: true },
    { name: 'F-V19-5 schedule (b) start:99 (S13 row 10)', data: { followupSchedule: { start: 99 } }, emitted: { followupSchedule: null }, provided: [], refused: true },
    { name: 'F-V19-5 schedule (b) MIXED start/end valid + enabled junk', data: { followupSchedule: { start: 10, end: 16, enabled: 'yes' } },
      emitted: { followupSchedule: { start: 10, end: 16 } }, provided: ['followupSchedule.start', 'followupSchedule.end'] },
    { name: 'F-V19-5 schedule (b) empty schedule object', data: { followupSchedule: {} }, emitted: { followupSchedule: null }, provided: [], refused: true },
    // (c) junk-only container alongside an ACCEPTED scalar => the file imports, NO container emitted
    { name: 'F-V19-5 rules (c) junk-only container + accepted scalar', data: { enabled: true, rules: { allowTopics: 'nope' } }, emitted: { rules: null }, provided: [] },
    { name: 'F-V19-5 smart (c) junk-only container + accepted scalar', data: { enabled: true, followupSmart: { stuckMin: 'x' } }, emitted: { followupSmart: null }, provided: [] },
    { name: 'F-V19-5 schedule (c) junk-only container + accepted scalar', data: { enabled: true, followupSchedule: { enabled: 'yes' } }, emitted: { followupSchedule: null }, provided: [] },
    // (d) the explicitly-empty-array facet (decision: NEVER imported — see the stats.js comment)
    { name: 'F-V19-5 rules (d) blockKeywords:[] is NOT imported (S13 row 6)', data: { rules: { blockKeywords: [] } }, emitted: { rules: null }, provided: [], refused: true },
    { name: 'F-V19-5 rules (d) allowTopics:[] dropped, sibling valid key wins', data: { rules: { allowTopics: [], blockKeywords: ['keepme'] } },
      emitted: { rules: { blockKeywords: ['keepme'] } }, provided: ['rules.blockKeywords'] },
    { name: 'F-V19-5 rules (d) empty [] + accepted scalar => stored blocklist preserved', data: { enabled: true, rules: { blockKeywords: [] } }, emitted: { rules: null }, provided: [] },
  ];
  let cleared = 0;
  for (const c of CASES) {
    const { clean, after } = await runCase(c.data);
    // shape: every container is emitted EXACTLY as decided, or DROPPED entirely (never {})
    const shapeBad = [];
    for (const cont of Object.keys(CONTAINER_SUBS)) {
      const want = c.emitted[cont];
      const got = clean ? clean[cont] : undefined;
      if ((want === undefined || want === null) ? got !== undefined : !eq(got, want)) shapeBad.push({ cont, want, got });
    }
    check(c.name + ' — sanitizer container shape', shapeBad.length === 0, { bad: shapeBad });
    check(c.name + ' — file ' + (c.refused ? 'REFUSED (seen===0 => null)' : 'accepted'), c.refused ? clean === null : clean !== null, { clean });
    // engine: effective == the file's value (when validly provided) else the STORED effective value
    const effBad = [];
    for (const [cont, subs] of Object.entries(CONTAINER_SUBS)) {
      for (const sk of subs) {
        const path = cont + '.' + sk;
        const expected = c.provided.indexOf(path) >= 0 ? (c.emitted[cont] || {})[sk] : effOf(BASELINE, cont, sk);
        const got = effOf(after, cont, sk);
        if (!eq(got, expected)) effBad.push({ path, expected, got });
      }
    }
    check(c.name + ' — engine EFFECTIVE state after a real boot', effBad.length === 0, { bad: effBad });
    // the PROPERTY itself
    const lo = looseness(after, BASELINE, c.provided);
    if (lo.length) cleared++;
    check(c.name + ' — engine state is NOT looser than the stored state', lo.length === 0, { loosened: lo });
  }
  check('F-V19-5 PROPERTY: 0 of ' + CASES.length + ' crafted files clear a stored restriction (S13 measured 13/16 before this fix)',
    cleared === 0 && CASES.length >= 16, { cleared, cases: CASES.length });

  // ---------- report ----------
  for (const c of checks) {
    console.log((c.ok ? 'PASS  ' : 'FAIL  ') + c.name + (c.ok || c.detail === undefined ? '' : '  ' + JSON.stringify(c.detail)));
  }
  const failed = checks.filter((c) => !c.ok);
  console.log(JSON.stringify({ file: path.relative(ROOT, SRC).replace(/\\/g, '/'), total: checks.length, failed: failed.length, ok: failed.length === 0 }, null, 2));
  process.exit(failed.length === 0 ? 0 : 2);
}

main().catch((e) => {
  console.error('import-security harness error: ' + (e && e.stack || e));
  process.exit(2);
});
