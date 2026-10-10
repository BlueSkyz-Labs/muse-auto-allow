#!/usr/bin/env node
/**
 * background-unit.mjs — deterministic unit verification for the v1.8.0 background
 * (service worker) additions, without a browser: pause badge, commands, startup digest,
 * syncSettings write-through mirror + load-time pull. The REAL extension/background.js is
 * loaded into a vm sandbox with chrome.* stubs (same pattern as test/import-security.mjs),
 * so every assertion drives the shipped code, not a re-implementation.
 *
 * Checks:
 *   M1-M3  manifest: notifications permission, the two commands (Alt+Shift+P / Alt+Shift+F),
 *          version 1.8.0 (release freeze) + MV3 + __MSG_ indirection
 *   P1-P2  toggle-pause command: arms pauseUntil ~15 min; clears an active pause
 *   B1-B2  badge: paused => '||' (grey); otherwise today's count ('' when zero)
 *   A1-A2  one-shot pause-expiry alarm armed at pauseUntil, cleared when not paused
 *   C1-C2  send-followup command: active muse tab receives followup-send-now; no tab => none
 *   D1-D4  startup digest: notification + lastDigestAt + counters reset when clicks>0;
 *          no notification (nothing touched) when clicks=0; notify failure keeps lastDigestAt;
 *          singular/plural message text exact
 *   S1-S8  syncSettings: write-through on subset changes only, snapshot on enable,
 *          BYTE-accurate 8KB per-item skip (multibyte content included) + surfaced write
 *          failures, load-time pull fills only ABSENT keys, sync-area echoes ignored
 *   L1-L2  startup listeners run cleanly; sweep alarm nudges muse tabs, pause alarm refreshes
 *   G1     migrate() seeds schemaVersion while preserving explicit values
 *
 * Usage: node test/background-unit.mjs [path/to/background.js]
 *   (a mutated copy MUST fail the matching checks — reverse-mutation falsification run.)
 * Exit 0 = all checks pass, 2 = at least one fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'extension', 'background.js');
const MAN_PATH = path.join(path.dirname(SRC), 'manifest.json');

const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail }); return !!ok; };
const tick = () => new Promise((r) => setTimeout(r, 0));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- manifest assertions (static, no sandbox needed) ----------
const man = JSON.parse(fs.readFileSync(MAN_PATH, 'utf8'));
check('M1 manifest. permissions include "notifications" (digest) alongside storage/alarms',
  Array.isArray(man.permissions) && man.permissions.includes('notifications') && man.permissions.includes('storage') && man.permissions.includes('alarms'),
  { permissions: man.permissions });
const cmds = man.commands || {};
check('M2 manifest. commands: toggle-pause (Alt+Shift+P) + send-followup (Alt+Shift+F)',
  !!(cmds['toggle-pause'] && cmds['toggle-pause'].suggested_key && cmds['toggle-pause'].suggested_key.default === 'Alt+Shift+P' &&
     cmds['send-followup'] && cmds['send-followup'].suggested_key && cmds['send-followup'].suggested_key.default === 'Alt+Shift+F'),
  { commands: cmds });
check('M3 manifest. version 1.8.0 (release freeze) + MV3 + __MSG_ name',
  man.version === '1.8.0' && man.manifest_version === 3 && man.name === '__MSG_extName__',
  { version: man.version, mv: man.manifest_version });

// ---------- sandbox: chrome stubs around the REAL background.js ----------
function makeEnv() {
  const state = {
    store: {}, syncStore: {}, changeListeners: [], alarms: {}, alarmListeners: [],
    badge: { text: null, color: null }, notifications: [], notifyFail: false,
    sentMessages: [], startupListeners: [], installedListeners: [], updatedListeners: [],
    commandListeners: [], warns: [], logs: [], tabQueryResult: [], syncSetFail: false,
  };
  const fireChange = (area, oldVals, newVals) => {
    const changes = {};
    for (const k of new Set([...Object.keys(oldVals), ...Object.keys(newVals)])) {
      if (JSON.stringify(oldVals[k]) !== JSON.stringify(newVals[k])) changes[k] = { oldValue: oldVals[k], newValue: newVals[k] };
    }
    if (!Object.keys(changes).length) return;
    Promise.resolve().then(() => {
      for (const fn of state.changeListeners) { try { fn(changes, area); } catch (e) { state.warns.push('onChanged threw: ' + e.message); } }
    });
  };
  const makeStorage = (area, store, shouldFailSet) => ({
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
    set(obj, cb) {
      const oldVals = {}; const newVals = {};
      for (const [k, v] of Object.entries(obj)) { oldVals[k] = store[k]; newVals[k] = v; }
      // simulate a REJECTED write (e.g. QUOTA_BYTES_PER_ITEM exceeded): the store is left
      // untouched and chrome.runtime.lastError is set for the callback to read
      if (typeof shouldFailSet === 'function' && shouldFailSet()) {
        chromeStub.runtime.lastError = { message: 'QUOTA_BYTES_PER_ITEM quota exceeded' };
        if (typeof cb === 'function') cb();
        return Promise.resolve();
      }
      Object.assign(store, obj);
      chromeStub.runtime.lastError = undefined;
      fireChange(area, oldVals, newVals);
      if (typeof cb === 'function') cb();
      return Promise.resolve();
    },
  });
  const chromeStub = {
    runtime: {
      lastError: undefined,
      onStartup: { addListener: (fn) => state.startupListeners.push(fn) },
      onInstalled: { addListener: (fn) => state.installedListeners.push(fn) },
      onMessage: { addListener: () => {} },
    },
    alarms: {
      get: (name, cb) => { if (typeof cb === 'function') cb(state.alarms[name] || null); },
      create: (name, info) => { state.alarms[name] = info || {}; },
      clear: (name, cb) => { delete state.alarms[name]; if (typeof cb === 'function') cb(true); },
      onAlarm: { addListener: (fn) => state.alarmListeners.push(fn) },
    },
    tabs: {
      query: (q, cb) => { if (typeof cb === 'function') cb(state.tabQueryResult); },
      sendMessage: (id, msg, cb) => { state.sentMessages.push({ id, msg }); if (typeof cb === 'function') cb(); },
      onUpdated: { addListener: (fn) => state.updatedListeners.push(fn) },
    },
    action: {
      setBadgeText: (o) => { state.badge.text = o.text; },
      setBadgeBackgroundColor: (o) => { state.badge.color = o.color; },
    },
    notifications: {
      create: (id, opts, cb) => {
        if (state.notifyFail) { chromeStub.runtime.lastError = { message: 'notifications unavailable' }; }
        else { state.notifications.push({ id, opts }); chromeStub.runtime.lastError = undefined; }
        if (typeof cb === 'function') cb(id);
      },
    },
    storage: {
      local: makeStorage('local', state.store),
      sync: makeStorage('sync', state.syncStore, () => state.syncSetFail),
      onChanged: { addListener: (fn) => state.changeListeners.push(fn) },
    },
    commands: { onCommand: { addListener: (fn) => state.commandListeners.push(fn) } },
  };
  const sandbox = {
    self: { addEventListener: () => {} },
    chrome: chromeStub,
    // the MV3 service worker provides the WHATWG encoding globals; the vm context must too
    TextEncoder, TextDecoder,
    console: { log: (...a) => state.logs.push(a.map(String).join(' ')), warn: (...a) => state.warns.push(a.map(String).join(' ')), error: () => {} },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (t) => clearTimeout(t),
  };
  return { sandbox, chromeStub, state };
}

const env = makeEnv();
const { state } = env;
// Pre-seed sync BEFORE the script runs: the load-time pull must fill only ABSENT local keys.
state.syncStore.followupPrompt = 'SYNC PROMPT (from another device)';
state.syncStore.dryRun = true;
state.syncStore.followupRotateIdx = 7; // NOT in the subset — must never be pulled
const ctx = vm.createContext(env.sandbox);
const src = fs.readFileSync(SRC, 'utf8');
vm.runInContext(
  src + '\n;globalThis.__maaTest = {' +
  ' togglePause: typeof togglePause === "function" ? togglePause : null,' +
  ' updateBadge: typeof updateBadge === "function" ? updateBadge : null,' +
  ' schedulePauseBadgeRefresh: typeof schedulePauseBadgeRefresh === "function" ? schedulePauseBadgeRefresh : null,' +
  ' composeDigestText: typeof composeDigestText === "function" ? composeDigestText : null,' +
  ' digestOnStartup: typeof digestOnStartup === "function" ? digestOnStartup : null,' +
  ' maybeSetSyncItem: typeof maybeSetSyncItem === "function" ? maybeSetSyncItem : null,' +
  ' pushAllToSync: typeof pushAllToSync === "function" ? pushAllToSync : null,' +
  ' mirrorToSync: typeof mirrorToSync === "function" ? mirrorToSync : null,' +
  ' pullFromSync: typeof pullFromSync === "function" ? pullFromSync : null,' +
  ' migrate: typeof migrate === "function" ? migrate : null,' +
  ' ensureAlarm: typeof ensureAlarm === "function" ? ensureAlarm : null,' +
  ' SYNC_SUBSET: typeof SYNC_SUBSET !== "undefined" ? SYNC_SUBSET : null,' +
  ' PAUSE_TOGGLE_MS: typeof PAUSE_TOGGLE_MS !== "undefined" ? PAUSE_TOGGLE_MS : null };',
  ctx, { filename: SRC });
const T = env.sandbox.__maaTest;
// Snapshot of the store IMMEDIATELY after script load — the boot-time pullFromSync ran here.
const bootStore = { ...state.store };

const resetStore = (init) => { for (const k of Object.keys(state.store)) delete state.store[k]; Object.assign(state.store, init || {}); };
const resetSync = (init) => { for (const k of Object.keys(state.syncStore)) delete state.syncStore[k]; Object.assign(state.syncStore, init || {}); };
const dayKey = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };

async function main() {
  if (!T || !T.togglePause || !T.updateBadge || !T.digestOnStartup || !T.mirrorToSync || !T.pullFromSync) {
    throw new Error('background.js did not expose the expected top-level functions');
  }

  // ---------- P1-P2: toggle-pause command ----------
  resetStore({ pauseUntil: 0 });
  env.sandbox.__maaTest.togglePause();
  await tick();
  const p1 = Number(state.store.pauseUntil) || 0;
  check('P1 toggle-pause. arms pauseUntil ~15 min ahead', p1 > Date.now() + 14 * 60000 && p1 <= Date.now() + 15 * 60000 + 2000, { pauseUntil: p1, delta: p1 - Date.now() });
  env.sandbox.__maaTest.togglePause();
  await tick();
  check('P2 toggle-pause. a second press clears an active pause (0)', state.store.pauseUntil === 0, { pauseUntil: state.store.pauseUntil });

  // ---------- B1-B2: badge ----------
  resetStore({ pauseUntil: Date.now() + 60000 });
  T.updateBadge();
  check('B1 badge. paused => pause marker "||" with the grey pause colour', state.badge.text === '||' && state.badge.color === '#8a8f98', { badge: state.badge });
  resetStore({ pauseUntil: 0, stats: { byDay: { [dayKey()]: 12 } } });
  T.updateBadge();
  const badgeCount = state.badge.text;
  resetStore({ pauseUntil: 0, stats: { byDay: {} } });
  T.updateBadge();
  const badgeZero = state.badge.text;
  check('B2 badge. not paused => today\'s count, cleared at zero', badgeCount === '12' && badgeZero === '', { badgeCount, badgeZero });

  // ---------- A1-A2: pause-expiry alarm ----------
  resetStore({ pauseUntil: Date.now() + 300000 });
  T.schedulePauseBadgeRefresh();
  const alarm = state.alarms['maa-pause-expiry'] || null;
  check('A1 pause alarm. one-shot alarm armed just after pauseUntil', !!alarm && Number(alarm.when) > Number(state.store.pauseUntil) && Number(alarm.when) < Number(state.store.pauseUntil) + 2000,
    { alarm, pauseUntil: state.store.pauseUntil });
  resetStore({ pauseUntil: 0 });
  T.schedulePauseBadgeRefresh();
  check('A2 pause alarm. cleared when the engine is not paused', !state.alarms['maa-pause-expiry'], { alarms: Object.keys(state.alarms) });

  // ---------- C1-C2: send-followup command ----------
  const commandListener = state.commandListeners[0];
  state.sentMessages.length = 0;
  state.tabQueryResult = [{ id: 42, url: 'https://muse.ai/chat' }];
  commandListener('send-followup');
  await tick();
  check('C1 send-followup. the active muse.ai tab receives {type:"followup-send-now"}',
    state.sentMessages.length === 1 && state.sentMessages[0].id === 42 && state.sentMessages[0].msg && state.sentMessages[0].msg.type === 'followup-send-now',
    { sent: state.sentMessages });
  state.sentMessages.length = 0;
  state.tabQueryResult = [];
  commandListener('send-followup');
  await tick();
  check('C2 send-followup. no active muse.ai tab => nothing is sent', state.sentMessages.length === 0, { sent: state.sentMessages });

  // ---------- D1-D4: startup digest ----------
  state.notifications.length = 0;
  resetStore({ lastDigestAt: 111, digestCounters: { clicks: 5, followups: 2, blocked: 3 } });
  T.digestOnStartup();
  await tick();
  const digestLog = state.logs.filter((l) => l.includes('digest')).slice(-1)[0] || '';
  check('D1b digest. the composed object carries {since, clicks, followups, blocked}',
    digestLog.includes('"since":111') && digestLog.includes('"clicks":5') && digestLog.includes('"followups":2') && digestLog.includes('"blocked":3'),
    { digestLog });
  const n1 = state.notifications[0] || null;
  check('D1 digest. notification shown when clicks>0, lastDigestAt updated, counters reset',
    !!n1 && n1.id === 'maa-digest' && n1.opts.type === 'basic' && typeof n1.opts.message === 'string' &&
    n1.opts.message.includes('5 clicks') && n1.opts.message.includes('2 follow-ups') && n1.opts.message.includes('3 blocked') &&
    Number(state.store.lastDigestAt) > 111 &&
    state.store.digestCounters && state.store.digestCounters.clicks === 0 && state.store.digestCounters.followups === 0 && state.store.digestCounters.blocked === 0,
    { notification: n1, lastDigestAt: state.store.lastDigestAt, counters: state.store.digestCounters });
  state.notifications.length = 0;
  resetStore({ lastDigestAt: 222, digestCounters: { clicks: 0, followups: 1, blocked: 2 } });
  T.digestOnStartup();
  await tick();
  check('D2 digest. clicks=0 => no notification; counters keep accumulating (lastDigestAt untouched)',
    state.notifications.length === 0 && state.store.lastDigestAt === 222 && state.store.digestCounters && state.store.digestCounters.blocked === 2,
    { notifications: state.notifications.length, lastDigestAt: state.store.lastDigestAt, counters: state.store.digestCounters });
  state.notifications.length = 0;
  state.notifyFail = true;
  resetStore({ lastDigestAt: 333, digestCounters: { clicks: 4, followups: 0, blocked: 0 } });
  T.digestOnStartup();
  await tick();
  state.notifyFail = false;
  check('D3 digest. a failed notification does NOT consume the digest (lastDigestAt kept, counters kept)',
    state.store.lastDigestAt === 333 && state.store.digestCounters && state.store.digestCounters.clicks === 4,
    { lastDigestAt: state.store.lastDigestAt, counters: state.store.digestCounters });
  check('D4 digest. message text exact (singular/plural)',
    T.composeDigestText({ clicks: 1, followups: 1, blocked: 1 }) === 'Since your last session: 1 click · 1 follow-up · 1 blocked' &&
    T.composeDigestText({ clicks: 9, followups: 0, blocked: 2 }) === 'Since your last session: 9 clicks · 0 follow-ups · 2 blocked',
    { one: T.composeDigestText({ clicks: 1, followups: 1, blocked: 1 }), many: T.composeDigestText({ clicks: 9, followups: 0, blocked: 2 }) });

  // ---------- S1-S6: syncSettings mirror ----------
  resetSync({});
  resetStore({ syncSettings: true, enabled: false });
  state.changeListeners.forEach((fn) => fn({ enabled: { oldValue: true, newValue: false } }, 'local'));
  await tick();
  check('S1 sync mirror. a subset change is written through while syncSettings=true',
    state.syncStore.enabled === false && Object.keys(state.syncStore).length === 1, { syncStore: { ...state.syncStore } });
  resetSync({});
  state.changeListeners.forEach((fn) => fn({ log: { oldValue: [], newValue: [1] } }, 'local'));
  await tick();
  check('S2 sync mirror. a non-subset key (log) is never mirrored', Object.keys(state.syncStore).length === 0, { syncStore: { ...state.syncStore } });
  resetStore({ syncSettings: false, enabled: true });
  resetSync({});
  state.changeListeners.forEach((fn) => fn({ enabled: { oldValue: false, newValue: true } }, 'local'));
  await tick();
  check('S3 sync mirror. syncSettings=false => no write-through', Object.keys(state.syncStore).length === 0, { syncStore: { ...state.syncStore } });
  resetStore({ syncSettings: true, enabled: true, minDelayMs: 500, rules: { allowTopics: ['x'], blockKeywords: [] }, followupEnabled: true, followupRotateIdx: 3, log: [1, 2], clickCount: 9, schemaVersion: 2 });
  resetSync({});
  state.changeListeners.forEach((fn) => fn({ syncSettings: { oldValue: false, newValue: true } }, 'local'));
  await tick();
  const snap = { ...state.syncStore };
  check('S4 sync mirror. enabling syncSettings pushes a snapshot of PRESENT subset keys only (no rotateIdx/log/clickCount/schemaVersion)',
    snap.enabled === true && snap.minDelayMs === 500 && JSON.stringify(snap.rules) === JSON.stringify({ allowTopics: ['x'], blockKeywords: [] }) && snap.followupEnabled === true &&
    !('followupRotateIdx' in snap) && !('log' in snap) && !('clickCount' in snap) && !('schemaVersion' in snap) && !('syncSettings' in snap),
    { snap });
  // 8KB per-item quota: an oversized item is skipped (warned), the rest still syncs
  resetSync({});
  state.warns.length = 0;
  const out = {};
  T.maybeSetSyncItem(out, 'followupPrompt', 'z'.repeat(9000));
  T.maybeSetSyncItem(out, 'enabled', false);
  check('S5 sync quota. an item over 8KB is skipped with a warning; normal items still mirror',
    !('followupPrompt' in out) && out.enabled === false && state.warns.some((w) => /8KB|per-item quota/.test(w)),
    { keys: Object.keys(out), warns: state.warns.slice(-2) });
  // The 8KB per-item quota is measured in BYTES (QUOTA_BYTES_PER_ITEM), NOT UTF-16 code units:
  // multibyte content (Vietnamese/CJK prompts — exactly what users write) can fit the code-unit
  // count and still exceed the byte quota. A `.length` guard lets it through and the write then
  // fails at the API. Falsification: with the code-unit check this assertion is RED.
  const outMb = {};
  const mbBig = '\u1ebf'.repeat(4000); // 'ế': 4000 code units, 12000 UTF-8 bytes
  T.maybeSetSyncItem(outMb, 'followupPrompt', mbBig);
  T.maybeSetSyncItem(outMb, 'followupChips', ['\u1ebf'.repeat(100)]); // 300 bytes — still syncs
  const mbJsonBytes = new TextEncoder().encode(JSON.stringify(mbBig)).length;
  const mbJsonUnits = JSON.stringify(mbBig).length;
  check('S5b sync quota. a value over 8192 BYTES but under 8192 code units is skipped (byte-accurate guard)',
    !('followupPrompt' in outMb) && Array.isArray(outMb.followupChips) && outMb.followupChips.length === 1 &&
    mbJsonBytes > 8192 && mbJsonUnits < 8192,
    { jsonBytes: mbJsonBytes, jsonUnits: mbJsonUnits, keys: Object.keys(outMb) });
  // a rejected chrome.storage.sync.set must be SURFACED, never swallowed (silent no-sync)
  resetStore({ syncSettings: true, enabled: true });
  resetSync({});
  state.warns.length = 0;
  state.syncSetFail = true;
  state.changeListeners.forEach((fn) => fn({ enabled: { oldValue: false, newValue: true } }, 'local'));
  await tick();
  state.syncSetFail = false;
  check('S5c sync write failure. a rejected sync write warns with the reason (never silent); local stays authoritative',
    state.warns.some((w) => /sync/i.test(w) && /failed/i.test(w)) && Object.keys(state.syncStore).length === 0,
    { warns: state.warns.slice(-2), syncStore: { ...state.syncStore } });
  // load-time pull: fills ABSENT local keys only (boot pull already ran once — re-run explicitly)
  resetStore({ enabled: true }); // followupPrompt absent
  resetSync({ followupPrompt: 'SYNC PROMPT (from another device)', enabled: false, dryRun: true, followupRotateIdx: 7 });
  T.pullFromSync();
  await tick();
  check('S6 sync pull. absent keys are filled from sync; PRESENT keys are never overwritten; non-subset keys never pulled',
    state.store.followupPrompt === 'SYNC PROMPT (from another device)' && state.store.dryRun === true && state.store.enabled === true && !('followupRotateIdx' in state.store),
    { store: { ...state.store } });
  // boot pull (pre-seeded before the script ran): followupPrompt/dryRun filled, rotateIdx ignored
  check('S7 sync pull. the load-time pull ran at boot: absent keys filled, non-subset keys never pulled',
    bootStore.followupPrompt === 'SYNC PROMPT (from another device)' && bootStore.dryRun === true && !('followupRotateIdx' in bootStore),
    { bootStore });
  // sync-area echoes must never loop back into sync
  resetSync({});
  resetStore({ syncSettings: true, enabled: true });
  state.changeListeners.forEach((fn) => fn({ enabled: { oldValue: false, newValue: true } }, 'sync'));
  await tick();
  check('S8 sync echo. onChanged(area=sync) is ignored — no mirror loop', Object.keys(state.syncStore).length === 0, { syncStore: { ...state.syncStore } });

  // ---------- L1-L2: listeners ----------
  let startupErr = null;
  try {
    for (const fn of state.startupListeners) fn();
    await tick();
  } catch (e) { startupErr = e.message; }
  check('L1 startup. every onStartup listener runs cleanly (digest + badge + alarm + pull)',
    startupErr === null && state.startupListeners.length >= 4, { listeners: state.startupListeners.length, startupErr });
  state.sentMessages.length = 0;
  state.tabQueryResult = [{ id: 7, url: 'https://muse.ai/' }, { id: 8, url: 'https://x.muse.ai/' }];
  for (const fn of state.alarmListeners) fn({ name: 'muse-sweep' });
  const sweeps = state.sentMessages.filter((m) => m.msg && m.msg.type === 'sweep').map((m) => m.id);
  state.sentMessages.length = 0;
  state.badge.text = 'stale';
  for (const fn of state.alarmListeners) fn({ name: 'maa-pause-expiry' });
  const pauseAlarmSwept = state.sentMessages.length;
  check('L2 alarms. sweep alarm nudges every muse tab; the pause alarm only refreshes the badge',
    sweeps.length === 2 && sweeps.includes(7) && sweeps.includes(8) && pauseAlarmSwept === 0 && state.badge.text !== 'stale',
    { sweeps, pauseAlarmSwept, badge: state.badge.text });

  // ---------- G1: migrate ----------
  resetStore({ enabled: false });
  await T.migrate();
  check('G1 migrate. seeds schemaVersion without touching explicit values',
    state.store.schemaVersion === 2 && state.store.enabled === false && state.store.minDelayMs === 300,
    { store: { ...state.store } });

  // ---------- report ----------
  for (const c of checks) {
    console.log((c.ok ? 'PASS  ' : 'FAIL  ') + c.name + (c.ok || c.detail === undefined ? '' : '  ' + JSON.stringify(c.detail)));
  }
  const failed = checks.filter((c) => !c.ok);
  console.log(JSON.stringify({ file: path.relative(ROOT, SRC).replace(/\\/g, '/'), total: checks.length, failed: failed.length, ok: failed.length === 0 }, null, 2));
  process.exit(failed.length === 0 ? 0 : 2);
}

main().catch((e) => {
  console.error('background-unit harness error: ' + (e && e.stack || e));
  process.exit(2);
});
