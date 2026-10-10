#!/usr/bin/env node
/**
 * scripts/bench/experience.mjs — EXPERIENCE-AXIS measurement harness.
 *
 * Lane: Global-Elite Benchmark Round, Axis 3 (docs/GLOBAL_ELITE_BENCHMARK_ROUND.md).
 * Rule of the round: every number is produced by a command in THIS repo and pasted with it;
 * a value that is not measured says PENDING, never an estimate.
 *
 * Home choice: scripts/bench/ — the established home of the round's harnesses
 * (scripts/bench/perf.mjs + scripts/bench/README.md document that folder as the benchmark
 * harness location). This harness reuses the same installed-Chrome + scratch-profile +
 * `Extensions.loadUnpacked` launcher pattern, so it belongs beside perf.mjs, not under test/.
 *
 * Metrics (each with its own exact command):
 *   --only=ttff         Time-to-first-value from a fresh scratch profile: ms from page
 *                       navigation to the first auto-click / follow-up send / mission step,
 *                       plus the USER-ACTION count from a fresh install for each goal.
 *   --only=reach        Setup friction / discoverability: interactions from the default popup
 *                       state to reach AND operate every surface (drives the REAL popup).
 *   --only=trust        Trust signals: every engine action produces a visible, explained entry
 *                       (drives each path, then reads the storage log + the rendered popup log).
 *   --only=errors       Error recovery: drives each engine refusal path (followup-send-now) and
 *                       records the {ok, reason} + whether the popup has a message for it.
 *   --only=keyboard     Keyboard-only path: trusted CDP key events over every focusable control.
 *   --only=ax           Screen-reader path: CDP Accessibility.getFullAXTree per popup state.
 *   --only=all          every metric (default), in the order above.
 *
 * Usage:
 *   node scripts/bench/experience.mjs
 *   node scripts/bench/experience.mjs --only=reach
 *   node scripts/bench/experience.mjs --only=ttff,trust
 *
 * Env: MAA_CHROME (chrome.exe path), MAA_EXT_DIR (alternate extension tree), MAA_PORT.
 * Prints a human-readable summary plus a single JSON block with every raw sample.
 *
 * Run FOREGROUND, UNPIPED — a non-TTY / background shell kills the Chrome/CDP suite with
 * 'stdin is not a tty' (rc 1). Run ONE Chrome instance at a time (load-sensitive host).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const EXT_DIR = process.env.MAA_EXT_DIR ? path.resolve(process.env.MAA_EXT_DIR) : path.join(ROOT, 'extension');
const IS_WIN = process.platform === 'win32';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- CLI ----------
const argv = process.argv.slice(2);
const argOf = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(name + '='));
  return hit ? hit.slice(name.length + 1) : dflt;
};
const ONLY = new Set(String(argOf('--only', 'all')).split(',').map((s) => s.trim()).filter(Boolean));
const want = (k) => ONLY.has('all') || ONLY.has(k);

if (!fs.existsSync(path.join(EXT_DIR, 'manifest.json'))) {
  console.error('experience: no manifest.json in ' + EXT_DIR);
  process.exit(1);
}

const round = (n, d = 1) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

// ---------- temp extension copy with the localhost test match ----------
const TMP_EXT = fs.mkdtempSync(path.join(os.tmpdir(), 'maa-exp-ext-'));
fs.cpSync(EXT_DIR, TMP_EXT, { recursive: true });
{
  const manPath = path.join(TMP_EXT, 'manifest.json');
  const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
  man.content_scripts[0].matches.push('http://127.0.0.1/*');
  fs.writeFileSync(manPath, JSON.stringify(man, null, 2));
}

// ---------- launch installed Chrome (scratch profile) ----------
const chromePath = process.env.MAA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.env.MAA_PORT || 9900 + Math.floor(Math.random() * 300));
const profileDir = path.join(os.tmpdir(), `maa-exp-${process.pid}-${Date.now().toString(36)}`);
fs.mkdirSync(profileDir, { recursive: true });

const CHROME_ARGS = [
  `--user-data-dir=${profileDir}`,
  `--remote-debugging-port=${PORT}`,
  '--enable-unsafe-extension-debugging',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-features=Translate,MediaRouter,CalculateNativeWinOcclusion,OptimizationHints',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--window-position=-32000,-32000',
  '--window-size=1100,800',
  'about:blank',
];
function launchChromeDetached(args) {
  const psq = (s) => s.replace(/'/g, "''");
  const argList = args.map((a) => `'${psq(a)}'`).join(',');
  execFileSync('powershell.exe', ['-NoProfile', '-Command',
    `Start-Process -FilePath '${psq(chromePath)}' -ArgumentList ${argList}`],
    { stdio: 'ignore', timeout: 30000 });
}
launchChromeDetached(CHROME_ARGS);

async function cdpEndpoint(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) { const j = await res.json(); if (j.webSocketDebuggerUrl) return j; }
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error(`Chrome did not expose CDP on port ${PORT}`);
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error('websocket error'));
  });
}

// ---------- CDP send with event dispatch ----------
const contextsBySession = new Map();
const consoleBySession = new Map(); // sessionId -> [{level, text}]
function makeSend(ws) {
  let seq = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      return;
    }
    if (msg.method) {
      if (msg.method === 'Runtime.executionContextCreated' && msg.sessionId && msg.params && msg.params.context) {
        const m = contextsBySession.get(msg.sessionId) || new Map();
        m.set(msg.params.context.id, msg.params.context);
        contextsBySession.set(msg.sessionId, m);
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.sessionId) {
        const arr = consoleBySession.get(msg.sessionId) || [];
        const text = (msg.params.args || []).map((a) => (a.value != null ? String(a.value) : (a.description || a.type))).join(' ');
        arr.push({ level: msg.params.type, text });
        consoleBySession.set(msg.sessionId, arr);
      }
      for (const l of listeners) if (l.method === msg.method) l.fn(msg.params, msg.sessionId);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    const m = { id, method, params };
    if (sessionId) m.sessionId = sessionId;
    ws.send(JSON.stringify(m));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(method + ' timed out')); } }, 20000);
  });
  send.on = (method, fn) => listeners.push({ method, fn });
  return send;
}

// ---------- teardown: reap only OUR chrome (matched by scratch profile path) ----------
const psQuote = (s) => s.replace(/'/g, "''");
function countMyChrome() {
  try {
    if (!IS_WIN) return 0;
    const ps = `@(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine -like '*${psQuote(profileDir)}*' }).Count`;
    const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8', timeout: 25000 });
    return Number(out.trim()) || 0;
  } catch { return 0; }
}
function killMyChrome() {
  try {
    if (!IS_WIN) return;
    const ps = `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine -like '*${psQuote(profileDir)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
    execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { stdio: 'ignore', timeout: 30000 });
  } catch { /* nothing to kill */ }
}
function countOtherChrome() {
  try {
    if (!IS_WIN) return 0;
    const ps = `@(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { -not ($_.CommandLine -and $_.CommandLine -like '*${psQuote(profileDir)}*') }).Count`;
    const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8', timeout: 25000 });
    return Number(out.trim()) || 0;
  } catch { return 0; }
}

// ---------- fixture server (project root) ----------
const server = http.createServer((req, res) => {
  let urlPath = '/';
  try { urlPath = decodeURIComponent((req.url || '/').split('?')[0]); } catch { res.writeHead(400); res.end(); return; }
  const rel = urlPath.replace(/^\/+/, '') || 'test/fixture.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (e, buf) => {
    if (e) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(buf);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const FIXTURE_URL = `${BASE}/test/fixture.html`;
const FOLLOWUP_URL = `${BASE}/test/followup-fixture.html`;

// =========================================================================================
// helpers
// =========================================================================================
let ws = null;
let send = null;
const out = {
  harness: 'scripts/bench/experience.mjs',
  measured_on: null,
  chrome: null,
  extensionId: null,
  host: { platform: process.platform, node: process.version, other_chrome_processes: null },
  params: { only: [...ONLY] },
  metrics: {},
  errors: [],
};

async function openTarget(url) {
  const { targetId } = await send('Target.createTarget', { url });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  try { await send('Runtime.enable', {}, sessionId); } catch { /* contexts still report */ }
  return { targetId, sessionId };
}
async function closeTarget(targetId) {
  try { await send('Target.closeTarget', { targetId }); } catch { /* gone */ }
}
async function evalIn(sessionId, expression, opts = {}) {
  const params = { expression, returnByValue: opts.returnByValue !== false, awaitPromise: !!opts.awaitPromise };
  if (opts.contextId != null) params.contextId = opts.contextId;
  const r = await send('Runtime.evaluate', params, sessionId);
  if (r && r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 240));
  return r && r.result ? r.result.value : undefined;
}
async function evalCtx(sessionId, contextId, expression, opts = {}) {
  return evalIn(sessionId, expression, { ...opts, contextId });
}
async function contentCtx(sessionId, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const m = contextsBySession.get(sessionId);
    if (m) {
      for (const ctx of m.values()) {
        if (ctx.auxData && ctx.auxData.isDefault === false) {
          try {
            const t = await evalCtx(sessionId, ctx.id, 'typeof window.__museAutoAllow');
            if (t === 'object') return ctx.id;
          } catch { /* context may be gone */ }
        }
      }
    }
    await sleep(150);
  }
  return null;
}
async function waitFor(fn, timeoutMs, step = 100) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const v = await fn(); if (v) return v; } catch { /* keep waiting */ }
    await sleep(step);
  }
  return null;
}
// open a fixture page and wait for its content-script isolated world; if the injection is
// missed (a known CDP flake), reload once and retry before giving up.
async function openFixtureWithContent(url) {
  const t = await openTarget(url);
  let cid = await contentCtx(t.sessionId, 9000);
  if (!cid) {
    try { await evalIn(t.sessionId, 'location.reload()'); } catch { /* ignore */ }
    cid = await contentCtx(t.sessionId, 12000);
  }
  return { targetId: t.targetId, sessionId: t.sessionId, cid };
}

// ---------- extension-page helpers ----------
async function openPopup(extId, settleMs = 700) {
  const t = await openTarget(`chrome-extension://${extId}/popup.html`);
  await waitFor(async () => (await evalIn(t.sessionId, 'document.readyState')) === 'complete', 8000, 60);
  await sleep(settleMs);
  return t;
}
async function reloadPopup(sessionId, settleMs = 800) {
  await evalIn(sessionId, 'location.reload()');
  await waitFor(async () => { try { return (await evalIn(sessionId, 'document.readyState')) === 'complete'; } catch { return false; } }, 8000, 80);
  await sleep(settleMs);
}
async function clearStorage(sessionId, patch) {
  await evalIn(sessionId, `new Promise((res) => chrome.storage.local.clear(() => chrome.storage.local.set(${JSON.stringify(patch || {})}, () => res(1))))`, { awaitPromise: true });
}
async function setStorage(sessionId, patch) {
  await evalIn(sessionId, `new Promise((res) => chrome.storage.local.set(${JSON.stringify(patch)}, () => res(1)))`, { awaitPromise: true });
}
async function readStorage(sessionId) {
  const v = await evalIn(sessionId, `new Promise((res) => chrome.storage.local.get(null, (r) => res(JSON.stringify(r))))`, { awaitPromise: true });
  try { return JSON.parse(v || '{}'); } catch { return {}; }
}

// ---------- trusted input (CDP) ----------
async function rectOf(sessionId, sel) {
  const v = await evalIn(sessionId, `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'null'; const r = el.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, top: r.top }); })()`);
  try { return JSON.parse(v || 'null'); } catch { return null; }
}
async function clickSel(sessionId, sel) {
  // scroll the target into view first: the Safety panel body scrolls, so a control below the
  // fold has a rect outside the viewport and a dispatched click at that y would miss it.
  await evalIn(sessionId, `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', inline: 'center' }); return 1; })()`);
  await sleep(40);
  const r = await rectOf(sessionId, sel);
  if (!r || !(r.w > 0 && r.h > 0)) return false;
  const x = Math.max(1, Math.round(r.x)), y = Math.max(1, Math.round(r.y));
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }, sessionId);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }, sessionId);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }, sessionId);
  await sleep(110);
  return true;
}
const KEY = { Tab: { key: 'Tab', code: 'Tab', vk: 9 }, Enter: { key: 'Enter', code: 'Enter', vk: 13, text: '\r' }, Space: { key: ' ', code: 'Space', vk: 32, text: ' ' }, Escape: { key: 'Escape', code: 'Escape', vk: 27 } };
async function keyPress(sessionId, name) {
  const k = KEY[name];
  if (!k) throw new Error('unknown key ' + name);
  const base = { key: k.key, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk };
  const down = { type: k.text ? 'keyDown' : 'rawKeyDown', ...base };
  if (k.text) down.text = k.text;
  await send('Input.dispatchKeyEvent', down, sessionId);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base }, sessionId);
  await sleep(90);
}
async function typeText(sessionId, text) {
  for (const ch of String(text)) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch }, sessionId);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch }, sessionId);
  }
  await sleep(90);
}
async function activeId(sessionId) {
  return evalIn(sessionId, `(() => { const a = document.activeElement; if (!a) return ''; return (a.id || a.tagName) + '|' + (a.tagName === 'INPUT' ? a.type : ''); })()`);
}

// =========================================================================================
// metric implementations
// =========================================================================================

// ---- 1. TTFF ---------------------------------------------------------------------------
async function measureTTFF(extId) {
  const rec = { cmd: 'node scripts/bench/experience.mjs --only=ttff', user_actions: {}, ms: {}, notes: [] };
  const boot = await openPopup(extId, 500); // an extension page to write storage from

  // (a) first auto-click on a real approval card, FRESH profile (no storage keys).
  {
    await clearStorage(boot.sessionId, {});
    const t0 = Date.now();
    const { targetId, sessionId } = await openTarget(FIXTURE_URL);
    const origin = await waitFor(async () => evalIn(sessionId, 'performance.timeOrigin'), 12000, 40);
    const hit = await waitFor(async () => {
      const v = await evalIn(sessionId, 'JSON.stringify((window.__clicks||[]).filter(c=>c.allow))');
      const arr = JSON.parse(v || '[]');
      return arr.length ? arr[0] : null;
    }, 20000, 40);
    rec.ms.first_auto_click = (origin && hit) ? round(hit.t - origin, 1) : null;
    rec.ms.harness_wall = round(Date.now() - t0, 1);
    rec.user_actions.first_auto_click = 0; // no user action taken in this block
    rec.first_auto_click_detail = hit ? { card: String(hit.n), t: hit.t, origin } : null;
    const st = await readStorage(boot.sessionId);
    rec.fresh_profile_storage_keys = Object.keys(st).sort();
    rec.engine_enabled_with_zero_actions = st.enabled !== false; // background migrate seeds enabled:true; content DEFAULT.enabled=true
    rec.onboarded_absent_fresh = st.onboarded === undefined;
    await closeTarget(targetId);
  }

  // (b) first follow-up send: fresh profile, drive the REAL popup, count user actions.
  {
    await clearStorage(boot.sessionId, {});
    const popup = await openPopup(extId, 800);
    const onboardingVisible = !(await evalIn(popup.sessionId, `document.getElementById('onboard').hidden`));
    rec.notes.push({ step: 'followup', onboarding_covers_popup_fresh: onboardingVisible });
    let actions = 0;
    if (onboardingVisible) { await clickSel(popup.sessionId, '#obSkip'); actions++; }
    await clickSel(popup.sessionId, `input#followupEnabled + .track`); actions++;
    const st1 = await readStorage(popup.sessionId);
    rec.followup_enabled_after = st1.followupEnabled === true;
    await closeTarget(popup.targetId);
    await setStorage(boot.sessionId, { followupIdleMs: 0, followupCooldownMs: 3600000 });
    const { targetId, sessionId, cid } = await openFixtureWithContent(FOLLOWUP_URL);
    if (cid) {
      await waitFor(async () => (await evalIn(sessionId, 'typeof window.__setState')) === 'function', 8000, 80);
      const t0 = Date.now();
      await evalIn(sessionId, `window.__setState('idle')`);
      const sent = await waitFor(async () => Number(await evalIn(sessionId, 'JSON.stringify((window.__sent||[]).length)')) > 0, 15000, 100);
      rec.ms.first_followup_send = sent ? round(Date.now() - t0, 1) : null;
    } else { rec.ms.first_followup_send = null; rec.notes.push({ step: 'followup', note: 'content ctx not found' }); }
    rec.user_actions.first_followup_send = actions;
    await closeTarget(targetId);
  }

  // (c) first mission step: fresh profile, drive the REAL popup, count user actions.
  {
    await clearStorage(boot.sessionId, {});
    const popup = await openPopup(extId, 800);
    const onboardingVisible = !(await evalIn(popup.sessionId, `document.getElementById('onboard').hidden`));
    rec.notes.push({ step: 'mission', onboarding_covers_popup_fresh: onboardingVisible });
    let actions = 0;
    if (onboardingVisible) { await clickSel(popup.sessionId, '#obSkip'); actions++; }
    await clickSel(popup.sessionId, `input#followupEnabled + .track`); actions++;   // mission gate: follow-up must be on
    await clickSel(popup.sessionId, '#misbtn'); actions++;
    const firstMid = await evalIn(popup.sessionId, `(document.querySelector('#misList [data-mid]')||{}).dataset ? document.querySelector('#misList [data-mid]').dataset.mid : ''`);
    await clickSel(popup.sessionId, `#misList [data-mid="${firstMid}"]`); actions++;
    const st = await readStorage(popup.sessionId);
    rec.mission_enabled_after = st.missionEnabled === true;
    rec.mission_selected = st.mission ? st.mission.id : null;
    rec.mission_followup_on = st.followupEnabled === true;
    await closeTarget(popup.targetId);
    await setStorage(boot.sessionId, { followupIdleMs: 0, followupCooldownMs: 3600000 });
    const { targetId, sessionId, cid } = await openFixtureWithContent(FOLLOWUP_URL);
    if (cid) {
      await waitFor(async () => (await evalIn(sessionId, 'typeof window.__setState')) === 'function', 8000, 80);
      const t0 = Date.now();
      await evalIn(sessionId, `window.__setState('idle')`);
      const sent = await waitFor(async () => Number(await evalIn(sessionId, 'JSON.stringify((window.__sent||[]).length)')) > 0, 15000, 100);
      rec.ms.first_mission_step = sent ? round(Date.now() - t0, 1) : null;
      rec.mission_first_sent_text = await evalIn(sessionId, `JSON.stringify((window.__sent||[]).map(s=>s.text))`);
    } else { rec.ms.first_mission_step = null; rec.notes.push({ step: 'mission', note: 'content ctx not found' }); }
    rec.user_actions.first_mission_step = actions;
    await closeTarget(targetId);
  }
  await closeTarget(boot.targetId);
  return rec;
}

// ---- 2. reachability -------------------------------------------------------------------
// One "interaction" = one trusted pointer click, or one text-entry gesture into a field
// (the focus click is part of entering text). `reach` = interactions from the default popup
// state until the surface is visible/operable; `operate` = the full path from the default
// state that performs the surface's primary operation (it includes the reach steps).
const F = 'input#followupEnabled + .track';
const SURFACES = [
  { id: 'pause', label: 'Pause (15 min / 1 h / tomorrow)', reach: [], reachV: `!document.getElementById('pauseIdle').hidden`, op: ['#p15'], opV: `!document.getElementById('pauseActive').hidden` },
  { id: 'auto_click_toggle', label: 'Auto-click Allow toggle', reach: [], reachV: `!!document.getElementById('enabled')`, op: ['input#enabled + .track'], opV: `document.getElementById('enabled').checked === false` },
  { id: 'safety_sheet', label: 'Safety & Control sheet (entry)', reach: [], reachV: `!!document.getElementById('safetyBtn')`, op: ['#safetyBtn'], opV: `!document.getElementById('safetyPanel').hidden` },
  { id: 'dry_run', label: 'Dry-run (log only)', reach: ['#safetyBtn'], reachV: `!document.getElementById('safetyPanel').hidden && !!document.getElementById('dryRun')`, op: ['#safetyBtn', 'input#dryRun + .track'], opV: `document.getElementById('dryRun').checked === true` },
  { id: 'rules_topics', label: 'Rules — allowed topics', reach: ['#safetyBtn'], reachV: `!document.getElementById('safetyPanel').hidden && !!document.getElementById('topicsList')`, op: ['#safetyBtn', { t: '#topicInput', v: 'demo-repo' }, '#topicAdd'], opV: `document.getElementById('topicsList').querySelectorAll('.rchip').length >= 1` },
  { id: 'rules_keywords', label: 'Rules — block keywords', reach: ['#safetyBtn'], reachV: `!document.getElementById('safetyPanel').hidden && document.getElementById('kwList').querySelectorAll('.rchip').length > 0`, op: ['#safetyBtn', { t: '#kwInput', v: 'zzz' }, '#kwAdd'], opV: `document.getElementById('kwList').querySelectorAll('.rchip').length > 20` },
  { id: 'schedule', label: 'Schedule (follow-up only during hours)', reach: ['#safetyBtn'], reachV: `!document.getElementById('safetyPanel').hidden && document.getElementById('schStart').options.length === 24`, op: ['#safetyBtn', 'input#schEnabled + .track'], opV: `document.getElementById('schEnabled').checked === true` },
  { id: 'smart_recovery', label: 'Stuck & error recovery', reach: ['#safetyBtn'], reachV: `!document.getElementById('safetyPanel').hidden && !!document.getElementById('stuckMin')`, op: ['#safetyBtn', 'input#errRec + .track'], opV: `document.getElementById('errRec').checked === true` },
  { id: 'settings_sync', label: 'Sync settings across devices', reach: ['#safetyBtn'], reachV: `!document.getElementById('safetyPanel').hidden && !!document.getElementById('syncSet')`, op: ['#safetyBtn', 'input#syncSet + .track'], opV: `document.getElementById('syncSet').checked === true` },
  { id: 'digest', label: '"While you were away" digest', reach: [], reachV: `!document.getElementById('digest').hidden`, op: [], opV: `!document.getElementById('digest').hidden`, seed: { digestCounters: { clicks: 3, followups: 1, blocked: 2 }, lastDigestAt: Date.now() } },
  { id: 'phrase_library', label: 'Phrase library (combo builder)', reach: [F, '#fadvbtn'], reachV: `!document.getElementById('fadv').hidden && !!document.getElementById('flibbtn')`, op: [F, '#fadvbtn', '#flibbtn', '#fchips .chipbtn'], opV: `!!document.querySelector('#fchips .chipbtn.on')` },
  { id: 'rotation', label: 'Prompt rotation', reach: [F, '#fadvbtn'], reachV: `!document.getElementById('fadv').hidden && !!document.getElementById('frotrow')`, op: [F, '#fadvbtn', '#frotstarter'], opV: `!document.getElementById('frotnext').hidden` },
  { id: 'missions', label: 'Missions (select + enable)', reach: [], reachV: `!!document.getElementById('misbtn')`, op: [F, '#misbtn', `#misList [data-mid]`], opV: `document.getElementById('misList').children.length > 0 && document.getElementById('missionEnabled').checked === true` },
  { id: 'language_switcher', label: 'Language switcher', reach: [], reachV: `!!document.getElementById('langBtn')`, op: ['#langBtn', '#langMenu [data-lang="en"]'], opV: `true`, probeStorage: 'userLocale', settleMs: 1200 },
  { id: 'statistics', label: 'Statistics page (footer CTA)', reach: [], reachV: `!!document.getElementById('openstats')`, op: ['#openstats'], opV: `true`, probeTargets: true },
];

async function measureReachability(extId) {
  const rec = { cmd: 'node scripts/bench/experience.mjs --only=reach', surfaces: [], flags: [], first_run_notes: [] };
  const DEFAULT = { onboarded: true };
  const runSteps = async (sessionId, steps) => {
    let n = 0;
    for (const s of steps) {
      if (typeof s === 'string') { if (await clickSel(sessionId, s)) n++; }
      else if (s && s.t) { const r = await rectOf(sessionId, s.t); if (r) { await clickSel(sessionId, s.t); await typeText(sessionId, s.v); n++; } }
    }
    return n;
  };
  for (const surf of SURFACES) {
    const entry = { id: surf.id, label: surf.label };
    {
      const popup = await openPopup(extId, 300);
      await clearStorage(popup.sessionId, Object.assign({}, DEFAULT, surf.seed || {}));
      await reloadPopup(popup.sessionId);
      entry.reachable_in_default_state_without_opening = !!(await evalIn(popup.sessionId, `(${surf.reachV})`));
      entry.interactions_to_reach = await runSteps(popup.sessionId, surf.reach);
      await sleep(250);
      entry.reach_ok = !!(await evalIn(popup.sessionId, `(${surf.reachV})`));
      await closeTarget(popup.targetId);
    }
    {
      const popup = await openPopup(extId, 300);
      await clearStorage(popup.sessionId, Object.assign({}, DEFAULT, surf.seed || {}));
      await reloadPopup(popup.sessionId);
      entry.interactions_to_operate = await runSteps(popup.sessionId, surf.op);
      await sleep(surf.settleMs || 350);
      entry.operate_ok = !!(await evalIn(popup.sessionId, `(${surf.opV})`));
      if (surf.probeStorage) {
        const st = await readStorage(popup.sessionId);
        entry.operate_storage_probe = { [surf.probeStorage]: st[surf.probeStorage] };
        entry.operate_ok = !!st[surf.probeStorage] && st[surf.probeStorage] !== 'auto';
      }
      if (surf.probeTargets) {
        const t = await send('Target.getTargets');
        entry.operate_ok = (t.targetInfos || []).some((x) => String(x.url || '').includes('stats.html'));
      }
      await closeTarget(popup.targetId);
    }
    entry.total_interactions_from_default = entry.interactions_to_operate;
    entry.flag_gt3 = entry.interactions_to_operate > 3;
    if (entry.flag_gt3) rec.flags.push(surf.id + ': ' + entry.interactions_to_operate + ' interactions from the default popup state');
    rec.surfaces.push(entry);
  }
  {
    const popup = await openPopup(extId, 300);
    await clearStorage(popup.sessionId, {}); // truly fresh install
    await reloadPopup(popup.sessionId);
    const ov = await evalIn(popup.sessionId, `(() => { const o = document.getElementById('onboard'); if (o.hidden) return 'null'; const r = o.getBoundingClientRect(); const c = document.elementFromPoint(160, 40); return JSON.stringify({ covers_popup: true, w: r.width, h: r.height, top_element_at_header: c ? (c.id || c.tagName) : null, inside_onboard: !!(c && o.contains(c)) }); })()`);
    rec.first_run_notes.push({ onboarding_on_fresh_install: ov && ov !== 'null' ? JSON.parse(ov) : { covers_popup: false } });
    await closeTarget(popup.targetId);
  }
  return rec;
}

// ---- 3. trust signals ------------------------------------------------------------------
async function measureTrust(extId) {
  const rec = { cmd: 'node scripts/bench/experience.mjs --only=trust', actions: [], kinds_in_code: [], kinds_rendered: [], console_lines: [] };
  const src = fs.readFileSync(path.join(EXT_DIR, 'content.js'), 'utf8');
  const kinds = new Set();
  for (const m of src.matchAll(/kind:\s*'([a-z-]+)'/g)) kinds.add(m[1]);
  // base kinds are passed as the `kind` argument of doClick(...) and become `kind`/`kind-dry`
  for (const m of src.matchAll(/doClick\([^,]+,[^,]+,\s*'([a-z-]+)'/g)) { kinds.add(m[1]); kinds.add(m[1] + '-dry'); }
  for (const m of src.matchAll(/kind \+ '-dry'/g)) { kinds.add('allow-dry'); kinds.add('expand-dry'); kinds.add('open-panel-dry'); kinds.add('review-bar-dry'); }
  rec.kinds_in_code = [...kinds].sort();

  const boot = await openPopup(extId, 500);
  const waitKind = async (kind, ms = 12000) => waitFor(async () => {
    const st = await readStorage(boot.sessionId);
    const e0 = (st.log || [])[0];
    return e0 && e0.kind === kind ? e0 : null;
  }, ms, 200);

  await setStorage(boot.sessionId, { enabled: true, minDelayMs: 0, pauseUntil: 0, dryRun: false, onboarded: true, rules: {}, log: [], clickCount: 0, digestCounters: { clicks: 0, followups: 0, blocked: 0 } });

  const t1 = await openFixtureWithContent(FOLLOWUP_URL);
  const cid1 = t1.cid;
  if (!cid1) { rec.error = 'content ctx not found'; return rec; }
  await waitFor(async () => (await evalIn(t1.sessionId, 'typeof window.__setV18')) === 'function', 8000, 80);

  await evalIn(t1.sessionId, `window.__setV18('clean')`);
  { const e = await waitKind('allow'); rec.actions.push({ action: 'allow click', kind: 'allow', logged: !!e, label: e ? e.label : null, visible_trace: !!e }); }
  { const st = await readStorage(boot.sessionId); const d = st.digestCounters || {}; rec.actions.push({ action: 'digest counters', counters: { clicks: Number(d.clicks) || 0, followups: Number(d.followups) || 0, blocked: Number(d.blocked) || 0 }, visible_trace: (Number(d.clicks) || 0) + (Number(d.followups) || 0) + (Number(d.blocked) || 0) > 0 }); }
  await evalIn(t1.sessionId, `window.__setV18('blocked')`);
  { const e = await waitKind('blocked'); rec.actions.push({ action: 'blocked (destructive keyword)', kind: 'blocked', logged: !!e, blockedReason: e ? e.blockedReason : null, visible_trace: !!e }); }
  await setStorage(boot.sessionId, { dryRun: true });
  await evalIn(t1.sessionId, `window.__setV18('dry')`);
  { const e = await waitKind('allow-dry'); rec.actions.push({ action: 'dry-run click', kind: 'allow-dry', logged: !!e, visible_trace: !!e }); }
  await setStorage(boot.sessionId, { dryRun: false, followupEnabled: true, followupPrompt: 'Keep going', followupIdleMs: 0, followupCooldownMs: 3600000 });
  await evalIn(t1.sessionId, `window.__setV18('off')`);
  await evalIn(t1.sessionId, `window.__setComposer('')`);
  await evalIn(t1.sessionId, `window.__setState('idle')`);
  { const e = await waitKind('followup'); rec.actions.push({ action: 'follow-up send', kind: 'followup', logged: !!e, visible_trace: !!e }); }

  await setStorage(boot.sessionId, { missionEnabled: true, mission: { id: 'fix-findings', step: 0, cycles: 0, startedAt: Date.now(), lastSentAt: 0 }, followupIdleMs: 0, followupCooldownMs: 3600000 });
  const t2 = await openTarget(FOLLOWUP_URL);
  const cid2 = await contentCtx(t2.sessionId);
  if (cid2) {
    await waitFor(async () => (await evalIn(t2.sessionId, 'typeof window.__setState')) === 'function', 8000, 80);
    await evalIn(t2.sessionId, `window.__setState('idle')`);
    const e = await waitKind('mission');
    rec.actions.push({ action: 'mission step', kind: 'mission', logged: !!e, visible_trace: !!e });
    rec.mission_sent = await evalIn(t2.sessionId, `JSON.stringify((window.__sent||[]).map(s=>s.text))`);
  } else { rec.actions.push({ action: 'mission step', kind: 'mission', logged: false, visible_trace: false, note: 'content ctx not found' }); }
  await closeTarget(t2.targetId);

  const cons = consoleBySession.get(t1.sessionId) || [];
  rec.console_lines = cons.filter((c) => c.text.includes('muse-auto-allow')).map((c) => c.text.slice(0, 150));

  {
    const p2 = await openPopup(extId, 1200);
    const html = await evalIn(p2.sessionId, `document.getElementById('logList').innerHTML`);
    const cls = [...String(html).matchAll(/class="k k-([a-z-]+)"/g)].map((m) => m[1]);
    rec.kinds_rendered = [...new Set(cls)].sort();
    rec.log_items_rendered = await evalIn(p2.sessionId, `document.querySelectorAll('#logList .item').length`);
    rec.blocked_chip = await evalIn(p2.sessionId, `(() => { const c = document.querySelector('#logList .k-blocked'); return c ? { title: c.getAttribute('title'), text: c.textContent } : null; })()`);
    await closeTarget(p2.targetId);
  }
  await closeTarget(t1.targetId);
  await closeTarget(boot.targetId);
  return rec;
}

// ---- 4. keyboard path ------------------------------------------------------------------
async function measureKeyboard(extId) {
  const rec = { cmd: 'node scripts/bench/experience.mjs --only=keyboard', controls: [], tab_order: [], tab_order_followup_on: [], samples: [], unreachable_default: [], unreachable_followup_on: [], focus_trap: {} };

  const tabSweep = async (seed, times) => {
    const p = await openPopup(extId, 400);
    await clearStorage(p.sessionId, Object.assign({ onboarded: true }, seed || {}));
    await reloadPopup(p.sessionId);
    const list = JSON.parse(await evalIn(p.sessionId, `(() => {
      const sel = 'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';
      const vis = [...document.querySelectorAll(sel)].filter((el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; });
      return JSON.stringify(vis.map((el) => ({ id: el.id || '', tag: el.tagName, type: el.type || '', role: el.getAttribute('role') || '', disabled: !!el.disabled, name: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 48) })));
    })()`));
    await evalIn(p.sessionId, `document.body.focus()`);
    const seen = [];
    for (let i = 0; i < times; i++) { await keyPress(p.sessionId, 'Tab'); seen.push(await activeId(p.sessionId)); }
    const reached = new Set(seen.map((s) => String(s).split('|')[0]));
    const unreachable = list.filter((c) => c.id && !reached.has(c.id)).map((c) => c.id + (c.disabled ? ' (disabled)' : ''));
    await closeTarget(p.targetId);
    return { list, seen, unreachable };
  };

  const base = await tabSweep({}, 24);
  rec.controls = base.list;
  rec.control_count = base.list.length;
  rec.tab_order = base.seen;
  rec.unreachable_default = base.unreachable;

  const fOn = await tabSweep({ followupEnabled: true }, 24);
  rec.tab_order_followup_on = fOn.seen;
  rec.unreachable_followup_on = fOn.unreachable;

  {
    const p = await openPopup(extId, 400);
    await clearStorage(p.sessionId, { onboarded: true, followupEnabled: true });
    await reloadPopup(p.sessionId);
    await clickSel(p.sessionId, '#safetyBtn');
    await sleep(300);
    const seen = [];
    for (let i = 0; i < 10; i++) { await keyPress(p.sessionId, 'Tab'); seen.push(await activeId(p.sessionId)); }
    const escaped = await evalIn(p.sessionId, `(() => { const a = document.activeElement; const panel = document.getElementById('safetyPanel'); return { active: a ? (a.id || a.tagName) : '', inside_panel: !!(a && panel.contains(a)) }; })()`);
    rec.focus_trap.safety_panel = { tab_sequence: seen, escaped_to_background: !escaped.inside_panel, final: escaped };
    await closeTarget(p.targetId);
  }

  const sample = async (name, prep, keyName, verify) => {
    const p = await openPopup(extId, 400);
    await clearStorage(p.sessionId, { onboarded: true, followupEnabled: true });
    await reloadPopup(p.sessionId);
    if (prep) await prep(p.sessionId);
    await keyPress(p.sessionId, keyName);
    await sleep(300);
    const ok = verify ? !!(await evalIn(p.sessionId, verify)) : null;
    rec.samples.push({ control: name, key: keyName, operated: ok });
    await closeTarget(p.targetId);
  };
  await sample('button #safetyBtn', async (s) => { await evalIn(s, `document.getElementById('safetyBtn').focus()`); }, 'Enter', `!document.getElementById('safetyPanel').hidden`);
  await sample('toggle #enabled', async (s) => { await evalIn(s, `document.getElementById('enabled').focus()`); }, 'Space', `document.getElementById('enabled').checked === false`);
  await sample('disclosure #fadvbtn', async (s) => { await evalIn(s, `document.getElementById('fadvbtn').focus()`); }, 'Enter', `!document.getElementById('fadv').hidden`);
  await sample('toggle #followupEnabled', async (s) => { await evalIn(s, `document.getElementById('followupEnabled').focus()`); }, 'Space', `document.getElementById('followupEnabled').checked === false`);
  {
    const p = await openPopup(extId, 400);
    await clearStorage(p.sessionId, { onboarded: true, followupEnabled: true });
    await reloadPopup(p.sessionId);
    await evalIn(p.sessionId, `document.getElementById('misbtn').focus()`);
    await keyPress(p.sessionId, 'Enter');
    const opened = !!(await evalIn(p.sessionId, `!document.getElementById('missionSheet').hidden`));
    await keyPress(p.sessionId, 'Escape');
    const closed = !!(await evalIn(p.sessionId, `document.getElementById('missionSheet').hidden`));
    const refocused = await activeId(p.sessionId);
    rec.samples.push({ control: 'sheet #misbtn', key: 'Enter+Escape', operated: opened && closed, opened, closed, refocused });
    await closeTarget(p.targetId);
  }
  {
    const p = await openPopup(extId, 400);
    await clearStorage(p.sessionId, { onboarded: true, followupEnabled: true });
    await reloadPopup(p.sessionId);
    await clickSel(p.sessionId, '#safetyBtn');
    await sleep(300);
    await evalIn(p.sessionId, `document.getElementById('schStart').focus()`);
    const before = await evalIn(p.sessionId, `document.getElementById('schStart').value`);
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 }, p.sessionId);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 }, p.sessionId);
    await sleep(250);
    const focused = await activeId(p.sessionId);
    rec.samples.push({ control: 'select #schStart', key: 'ArrowDown', operated: /schStart/.test(String(focused)), before, after: await evalIn(p.sessionId, `document.getElementById('schStart').value`), focused });
    await closeTarget(p.targetId);
  }
  {
    const p = await openPopup(extId, 400);
    await clearStorage(p.sessionId, { onboarded: true, followupEnabled: true });
    await reloadPopup(p.sessionId);
    await clickSel(p.sessionId, '#safetyBtn');
    await sleep(300);
    await evalIn(p.sessionId, `document.getElementById('topicInput').focus()`);
    await typeText(p.sessionId, 'demo-repo');
    const typed = await evalIn(p.sessionId, `document.getElementById('topicInput').value`);
    await keyPress(p.sessionId, 'Enter');
    await sleep(250);
    const chips = await evalIn(p.sessionId, `document.getElementById('topicsList').querySelectorAll('.rchip').length`);
    rec.samples.push({ control: 'text #topicInput', key: 'type+Enter', operated: typed === 'demo-repo' && chips >= 1, typed, chips });
    await closeTarget(p.targetId);
  }
  {
    const p = await openPopup(extId, 400);
    await clearStorage(p.sessionId, { onboarded: true, followupEnabled: true });
    await reloadPopup(p.sessionId);
    await evalIn(p.sessionId, `document.getElementById('langBtn').focus()`);
    await keyPress(p.sessionId, 'Enter');
    const opened = !!(await evalIn(p.sessionId, `!document.getElementById('langMenu').hidden`));
    await keyPress(p.sessionId, 'Escape');
    const closed = !!(await evalIn(p.sessionId, `document.getElementById('langMenu').hidden`));
    rec.samples.push({ control: 'menu #langBtn', key: 'Enter+Escape', operated: opened && closed, opened, closed });
    await closeTarget(p.targetId);
  }
  return rec;
}

// ---- 4b. error recovery ----------------------------------------------------------------
// Drives the REAL engine refusal paths by sending the same `followup-send-now` message the
// popup's "Send now" sends, and records the engine's {ok, reason}. The popup-side message
// mapping is read from source (the popup only messages muse.ai tabs, so the fixture cannot
// exercise the popup's own note text end-to-end — see the report's NOT MEASURABLE note).
const SEND_ALL_TABS = `new Promise((res) => {
  chrome.tabs.query({}, (tabs) => {
    const list = tabs || [];
    if (!list.length) return res(JSON.stringify({ error: 'no tabs' }));
    let pending = list.length, out = null;
    const done = () => { if (--pending === 0) res(JSON.stringify(out || { error: 'no responder' })); };
    list.forEach((t) => {
      try {
        chrome.tabs.sendMessage(t.id, { type: 'followup-send-now' }, (r) => {
          void chrome.runtime.lastError;
          if (!out && r && typeof r.ok === 'boolean') out = r;
          done();
        });
      } catch { done(); }
    });
  });
})`;
async function measureErrors(extId) {
  const rec = { cmd: 'node scripts/bench/experience.mjs --only=errors', attempts: [], popup_message_map: {} };
  const popupSrc = fs.readFileSync(path.join(EXT_DIR, 'popup.js'), 'utf8');
  const map = popupSrc.match(/const SEND_BLOCKED_KEY = \{([\s\S]*?)\};/);
  if (map) for (const m of map[1].matchAll(/'([a-z-]+)':/g)) rec.popup_message_map[m[1]] = true;

  const boot = await openPopup(extId, 500);
  const fixture = await openFixtureWithContent(FOLLOWUP_URL);
  const cid = fixture.cid;
  if (!cid) { rec.error = 'content ctx not found'; return rec; }
  await waitFor(async () => (await evalIn(fixture.sessionId, 'typeof window.__setState')) === 'function', 8000, 80);

  const base = { enabled: true, minDelayMs: 0, pauseUntil: 0, dryRun: false, onboarded: true, rules: {},
    followupSmart: {}, followupSchedule: { enabled: false, start: 0, end: 24, onlyActiveTab: false },
    followupEnabled: true, followupPrompt: 'Keep going', followupIdleMs: 3600000, followupCooldownMs: 3600000 };
  const attempt = async (label, patch, prep) => {
    await clearStorage(boot.sessionId, Object.assign({}, base, patch));
    if (prep) await prep();
    await sleep(400);
    const r = JSON.parse(await evalIn(boot.sessionId, SEND_ALL_TABS, { awaitPromise: true }));
    rec.attempts.push({ path: label, engine: r, surfaced_in_popup_message_map: !!(r && r.reason && rec.popup_message_map[r.reason]) });
    return r;
  };

  await evalIn(fixture.sessionId, `window.__setV18('off'); window.__setApproval(false); window.__setComposer(''); document.getElementById('composer').style.display=''`);
  await attempt('success (control)', {}, null);
  await evalIn(fixture.sessionId, `window.__setComposer('')`);
  await attempt('disabled (follow-up off)', { followupEnabled: false }, null);
  await attempt('paused', { pauseUntil: Date.now() + 3600000 }, null);
  {
    const h = await evalIn(fixture.sessionId, 'new Date().getHours()');
    await attempt('schedule-closed', { followupSchedule: { enabled: true, start: (h + 1) % 24, end: h, onlyActiveTab: false } }, null);
  }
  await attempt('approval-present', {}, async () => { await evalIn(fixture.sessionId, `window.__setApproval(true)`); });
  await evalIn(fixture.sessionId, `window.__setApproval(false)`);
  await attempt('composer-not-empty', {}, async () => { await evalIn(fixture.sessionId, `window.__setComposer('draft text')`); });
  await evalIn(fixture.sessionId, `window.__setComposer('')`);
  await attempt('no-composer', {}, async () => { await evalIn(fixture.sessionId, `document.getElementById('composer').style.display='none'`); });
  await evalIn(fixture.sessionId, `document.getElementById('composer').style.display=''`);
  await attempt('no-prompt', { followupPrompt: '' }, null);
  await attempt('dry-run (allowed, logs only)', { dryRun: true }, null);

  // popup "Send now" note surface with no muse.ai tab present (the only note the fixture can reach)
  {
    const p = await openPopup(extId, 500);
    await clearStorage(p.sessionId, Object.assign({}, base, { dryRun: false }));
    await reloadPopup(p.sessionId);
    await clickSel(p.sessionId, `input#followupEnabled + .track`); // ensure enabled then re-enable
    await clickSel(p.sessionId, `input#followupEnabled + .track`);
    await sleep(200);
    await clickSel(p.sessionId, '#fsendnow');
    await sleep(900);
    rec.popup_send_note_no_muse_tab = await evalIn(p.sessionId, `document.getElementById('fsendnote').textContent`);
    rec.popup_send_note_role = await evalIn(p.sessionId, `document.getElementById('fsendnote').getAttribute('role')`);
    await closeTarget(p.targetId);
  }
  await closeTarget(fixture.targetId);
  await closeTarget(boot.targetId);
  return rec;
}

// ---- 5. screen-reader / AX tree --------------------------------------------------------
async function axSnapshot(sessionId) {
  await send('Accessibility.enable', {}, sessionId);
  const tree = await send('Accessibility.getFullAXTree', {}, sessionId);
  return (tree.nodes || []).map((n) => ({
    role: n.role ? n.role.value : null,
    name: n.name ? n.name.value : '',
    ignored: !!n.ignored,
    focusable: !!(n.properties || []).find((p) => p.name === 'focusable' && p.value && p.value.value === true),
    checked: (n.properties || []).find((p) => p.name === 'checked') ? (n.properties.find((p) => p.name === 'checked').value || {}).value : undefined,
    expanded: (n.properties || []).find((p) => p.name === 'expanded') ? (n.properties.find((p) => p.name === 'expanded').value || {}).value : undefined,
  }));
}
async function measureAX(extId) {
  const rec = { cmd: 'node scripts/bench/experience.mjs --only=ax', states: {} };
  const ROLES = ['button', 'checkbox', 'combobox', 'textbox', 'radio', 'menuitem', 'link', 'switch', 'listbox', 'option', 'tab', 'spinbutton', 'slider', 'searchbox'];
  const build = (nodes) => {
    const interactive = nodes.filter((n) => n.role && ROLES.includes(n.role));
    return {
      total_nodes: nodes.length,
      interactive_count: interactive.length,
      interactive: interactive.map((n) => ({ role: n.role, name: n.name, focusable: n.focusable, checked: n.checked, expanded: n.expanded })),
      interactive_unnamed: interactive.filter((n) => !n.name || !String(n.name).trim()).map((n) => ({ role: n.role })),
      focusable_unnamed: interactive.filter((n) => n.focusable && (!n.name || !String(n.name).trim())).map((n) => ({ role: n.role })),
      roles_used: [...new Set(nodes.map((n) => n.role).filter(Boolean))].sort(),
    };
  };
  const stateOf = async (label, seed, prep) => {
    const p = await openPopup(extId, 400);
    await clearStorage(p.sessionId, Object.assign({ onboarded: true, followupEnabled: true }, seed || {}));
    await reloadPopup(p.sessionId);
    if (prep) await prep(p.sessionId);
    await sleep(350);
    rec.states[label] = build(await axSnapshot(p.sessionId));
    await closeTarget(p.targetId);
  };
  await stateOf('default', {}, null);
  await stateOf('safety_open', {}, async (s) => { await clickSel(s, '#safetyBtn'); });
  await stateOf('mission_open', {}, async (s) => { await clickSel(s, '#misbtn'); });
  await stateOf('advanced_open', {}, async (s) => { await clickSel(s, '#fadvbtn'); });
  {
    const p = await openPopup(extId, 400);
    await clearStorage(p.sessionId, {}); // fresh install -> onboarding
    await reloadPopup(p.sessionId);
    await sleep(300);
    rec.states.onboarding = build(await axSnapshot(p.sessionId));
    await closeTarget(p.targetId);
  }
  return rec;
}

// =========================================================================================
// main
// =========================================================================================
try {
  const info = await cdpEndpoint();
  ws = await connect(info.webSocketDebuggerUrl);
  send = makeSend(ws);
  out.chrome = info.Browser;
  out.host.other_chrome_processes = countOtherChrome();

  const loaded = await send('Extensions.loadUnpacked', { path: TMP_EXT });
  const extId = loaded && loaded.id;
  if (!extId) throw new Error('Extensions.loadUnpacked returned no extension id');
  out.extensionId = extId;

  if (want('ttff')) { try { out.metrics.ttff = await measureTTFF(extId); } catch (e) { out.errors.push('ttff: ' + e.message); } }
  if (want('reach')) { try { out.metrics.reach = await measureReachability(extId); } catch (e) { out.errors.push('reach: ' + e.message); } }
  if (want('trust')) { try { out.metrics.trust = await measureTrust(extId); } catch (e) { out.errors.push('trust: ' + e.message); } }
  if (want('errors')) { try { out.metrics.errors = await measureErrors(extId); } catch (e) { out.errors.push('errors: ' + e.message); } }
  if (want('keyboard')) { try { out.metrics.keyboard = await measureKeyboard(extId); } catch (e) { out.errors.push('keyboard: ' + e.message); } }
  if (want('ax')) { try { out.metrics.ax = await measureAX(extId); } catch (e) { out.errors.push('ax: ' + e.message); } }

  out.measured_on = new Date().toISOString();
} catch (e) {
  out.errors.push(String((e && e.message) || e));
} finally {
  try { await send?.('Browser.close'); } catch { /* may be gone */ }
  await sleep(1200);
  let remaining = countMyChrome();
  for (let i = 0; i < 12 && remaining > 0; i++) { killMyChrome(); await sleep(500); remaining = countMyChrome(); }
  if (remaining > 0) console.error(`WARNING: ${remaining} chrome process(es) still reference ${profileDir}`);
  for (let i = 0; i < 6; i++) {
    try { fs.rmSync(profileDir, { recursive: true, force: true }); break; } catch { await sleep(500); }
  }
  try { fs.rmSync(TMP_EXT, { recursive: true, force: true }); } catch { /* ignore */ }
  try { ws?.close(); } catch { /* ignore */ }
  server.close();
}

// ---------- report ----------
const line = (k, v) => console.log('  ' + k.padEnd(34) + ' ' + (v == null ? 'n/a' : v));
console.log('\n=== EXPERIENCE AXIS (scripts/bench/experience.mjs) ===');
console.log('measured_on', out.measured_on, '| chrome', out.chrome || '?', '| extension', out.extensionId || '?');
console.log('host: other chrome processes =', out.host.other_chrome_processes, '(0 = idle)');
const m = out.metrics;
if (m.ttff) {
  console.log('\n[time-to-first-value] ' + m.ttff.cmd);
  line('first auto-click ms', m.ttff.ms.first_auto_click);
  line('first auto-click user actions', m.ttff.user_actions.first_auto_click);
  line('first follow-up send ms', m.ttff.ms.first_followup_send);
  line('first follow-up user actions', m.ttff.user_actions.first_followup_send);
  line('first mission step ms', m.ttff.ms.first_mission_step);
  line('first mission user actions', m.ttff.user_actions.first_mission_step);
}
if (m.reach) {
  console.log('\n[reachability] ' + m.reach.cmd);
  for (const s of m.reach.surfaces) line(s.id, 'reach=' + s.interactions_to_reach + ' operate=' + s.interactions_to_operate + (s.flag_gt3 ? '  >3 FLAG' : '') + (s.operate_ok ? '' : '  OPERATE_NOT_CONFIRMED'));
  if (m.reach.flags.length) console.log('  flags: ' + JSON.stringify(m.reach.flags));
}
if (m.trust) {
  console.log('\n[trust signals] ' + m.trust.cmd);
  for (const a of m.trust.actions) line(a.action, 'logged=' + a.visible_trace);
  line('kinds in code', JSON.stringify(m.trust.kinds_in_code));
  line('kinds rendered', JSON.stringify(m.trust.kinds_rendered));
}
if (m.errors) {
  console.log('\n[error recovery] ' + m.errors.cmd);
  for (const a of m.errors.attempts) line(a.path, JSON.stringify(a.engine) + (a.surfaced_in_popup_message_map ? '' : '  (no popup message for this reason)'));
  line('send-now note (no muse.ai tab)', JSON.stringify(m.errors.popup_send_note_no_muse_tab));
}
if (m.keyboard) {
  console.log('\n[keyboard] ' + m.keyboard.cmd);
  line('focusable controls', m.keyboard.control_count);
  line('unreachable (default)', JSON.stringify(m.keyboard.unreachable_default));
  line('unreachable (followup on)', JSON.stringify(m.keyboard.unreachable_followup_on));
  for (const s of m.keyboard.samples) line(s.control, 'operated=' + s.operated);
}
if (m.ax) {
  console.log('\n[accessibility tree] ' + m.ax.cmd);
  for (const k of Object.keys(m.ax.states)) line(k, 'interactive=' + m.ax.states[k].interactive_count + ' unnamed=' + m.ax.states[k].interactive_unnamed.length + ' focusable-unnamed=' + m.ax.states[k].focusable_unnamed.length);
}
if (out.errors.length) console.log('\nerrors: ' + JSON.stringify(out.errors));
console.log('\n--- JSON ---');
console.log(JSON.stringify(out, null, 2));
process.exit(out.errors.length ? 2 : 0);
