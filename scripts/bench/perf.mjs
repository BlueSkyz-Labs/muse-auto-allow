#!/usr/bin/env node
/**
 * scripts/bench/perf.mjs — SPEED-AXIS measurement harness.
 *
 * Lane: Global-Elite Benchmark Round, Axis 1 (docs/GLOBAL_ELITE_BENCHMARK_ROUND.md).
 * Rule of the round: every number is produced by a command in THIS repo and pasted with it;
 * a value that is not measured says PENDING, never an estimate.
 *
 * Runs on the INSTALLED Chrome (137+) via CDP `Extensions.loadUnpacked` with a scratch
 * profile — the same launcher/scratch-profile pattern as test/e2e.mjs (installed Chrome
 * ignores --load-extension; --enable-unsafe-extension-debugging is required). The extension
 * is loaded from a TEMP COPY whose manifest additionally matches http://127.0.0.1/* so the
 * local fixture pages get the content script (the shipped manifest stays muse.ai-only).
 *
 * Metrics (each with its own exact command):
 *   --only=sw       Service-worker cold start: load-time boot + stop/wake restart
 *   --only=popup    Popup open -> first contentful paint, COLD (first open, fresh profile)
 *                   and WARM (N consecutive opens)
 *   --only=scan     Content-script scan cost per sweep on a heavy synthetic DOM
 *                   (5,000 nodes / 200 approval-like cards)
 *   --only=latency  Detect -> click latency on a real approval card
 *   --only=writes   chrome.storage.local write amplification per click and per follow-up
 *   --only=memory   JS heap footprint (popup, content script; idle and during sweeps)
 *   --only=all      every metric (default), in the order above
 *
 * Usage:
 *   node scripts/bench/perf.mjs
 *   node scripts/bench/perf.mjs --only=popup
 *   node scripts/bench/perf.mjs --only=popup,scan --popup-n=20 --sweep-n=12
 *   node scripts/bench/perf.mjs --cards=200 --nodes=5000
 *
 * Env: MAA_CHROME (chrome.exe path), MAA_EXT_DIR (alternate extension tree), MAA_PORT.
 * Prints a human-readable summary plus a single JSON block with every raw sample.
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
const N_POPUP = Number(argOf('--popup-n', 20));
const N_SWEEP = Number(argOf('--sweep-n', 12));
const N_LAT = Number(argOf('--lat-n', 12));
const N_SW = Number(argOf('--sw-n', 5));
const HEAVY_CARDS = Number(argOf('--cards', 200));
const HEAVY_NODES = Number(argOf('--nodes', 5000));

if (!fs.existsSync(path.join(EXT_DIR, 'manifest.json'))) {
  console.error('perf: no manifest.json in ' + EXT_DIR);
  process.exit(1);
}

// ---------- stats ----------
const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (a, p) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[i];
};
const round = (n, d = 1) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

// ---------- temp extension copy with the localhost test match ----------
const TMP_EXT = fs.mkdtempSync(path.join(os.tmpdir(), 'maa-bench-ext-'));
fs.cpSync(EXT_DIR, TMP_EXT, { recursive: true });
{
  const manPath = path.join(TMP_EXT, 'manifest.json');
  const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
  man.content_scripts[0].matches.push('http://127.0.0.1/*');
  fs.writeFileSync(manPath, JSON.stringify(man, null, 2));
}

// ---------- launch installed Chrome (scratch profile) ----------
const chromePath = process.env.MAA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.env.MAA_PORT || 9800 + Math.floor(Math.random() * 300));
const profileDir = path.join(os.tmpdir(), `maa-bench-${process.pid}-${Date.now().toString(36)}`);
fs.mkdirSync(profileDir, { recursive: true });

const CHROME_ARGS = [
  `--user-data-dir=${profileDir}`,
  `--remote-debugging-port=${PORT}`,
  '--enable-unsafe-extension-debugging',
  '--no-first-run',
  '--no-default-browser-check',
  // keep the offscreen window fully active (see test/e2e.mjs: occlusion detection +
  // background-timer throttling froze layout and silently stopped the engine)
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
const contextsBySession = new Map(); // sessionId -> Map(contextId -> context)
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
const SCAN_URL = `${BASE}/scripts/bench/scan-fixture.html`;
const FOLLOWUP_URL = `${BASE}/test/followup-fixture.html`;

// =========================================================================================
// main
// =========================================================================================
let ws = null;
let send = null;
const out = {
  harness: 'scripts/bench/perf.mjs',
  measured_on: null,
  chrome: null,
  host: { platform: process.platform, node: process.version },
  params: { popup_n: N_POPUP, sweep_n: N_SWEEP, lat_n: N_LAT, sw_n: N_SW, heavy_cards: HEAVY_CARDS, heavy_nodes: HEAVY_NODES },
  metrics: {},
  errors: [],
};
const cmdFor = (k) => `node scripts/bench/perf.mjs --only=${k}`;
const note = (k, v) => { out.metrics[k] = v; };

// ---- session helpers ----
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
// The content script runs in an ISOLATED world; window.__museAutoAllow lives there.
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
async function swTarget(extId) {
  const r = await send('Target.getTargets');
  return (r.targetInfos || []).find((t) => t.type === 'service_worker' && String(t.url || '').includes(extId)) || null;
}

// heavy synthetic DOM builder (injected into the page's MAIN world; the DOM is shared with
// the content script's isolated world). Cards are marked approval cards whose Allow/Deny
// pair sits inside a <form> — `unsafeTarget()` refuses form buttons, so a sweep traverses
// the WHOLE tree and clicks nothing (the honest worst case: a muse.ai page with no eligible
// approval). Filler nodes + generic buttons bring the tree to the node budget.
const HEAVY_BUILDER = `
window.__benchBuildHeavy = function (cards, nodes, extraButtons) {
  document.body.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (let i = 0; i < cards; i++) {
    const c = document.createElement('div'); c.className = 'card'; c.setAttribute('data-testid', 'hatch-inline-approval-card');
    const p = document.createElement('p');
    p.textContent = 'Allow Muse to perform this action on your GitHub account? Repository bench-repo-' + i + ' Action Pull request read';
    const f = document.createElement('form'); f.addEventListener('submit', (e) => e.preventDefault());
    const a = document.createElement('button'); a.type = 'button'; a.className = 'allow'; a.textContent = 'Allow';
    const d = document.createElement('button'); d.type = 'button'; d.className = 'deny'; d.textContent = 'Deny';
    f.appendChild(a); f.appendChild(d); c.appendChild(p); c.appendChild(f); frag.appendChild(c);
  }
  for (let i = 0; i < extraButtons; i++) {
    const w = document.createElement('p');
    const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Continue ' + i;
    w.appendChild(b); frag.appendChild(w);
  }
  document.body.appendChild(frag);
  const frag2 = document.createDocumentFragment();
  let count = document.getElementsByTagName('*').length;
  let i2 = 0;
  while (count < nodes && i2 < 300000) {
    const d = document.createElement('div'); d.className = 'filler';
    const s = document.createElement('span'); s.textContent = 'filler ' + i2;
    d.appendChild(s); frag2.appendChild(d); count += 2; i2++;
  }
  document.body.appendChild(frag2);
  return document.getElementsByTagName('*').length;
};
`;

// one clickable approval card per call (used by the latency metric)
const LATENCY_INJECTOR = `
window.__benchClicks = [];
window.__benchInjectCard = function (id) {
  const c = document.createElement('div'); c.className = 'card'; c.setAttribute('data-testid', 'hatch-inline-approval-card');
  const p = document.createElement('p');
  p.textContent = 'Allow Muse to perform this action on your GitHub account? Bench approval ' + id + ' Repository bench-' + id + ' Action Pull request read';
  const row = document.createElement('div'); row.className = 'row';
  const a = document.createElement('button'); a.type = 'button'; a.className = 'allow'; a.textContent = 'Allow';
  const d = document.createElement('button'); d.type = 'button'; d.className = 'deny'; d.textContent = 'Deny';
  a.addEventListener('click', function () { window.__benchClicks.push({ id: id, t: Date.now(), perf: performance.now() }); c.remove(); });
  row.appendChild(a); row.appendChild(d); c.appendChild(p); c.appendChild(row);
  document.body.appendChild(c);
  return Date.now();
};
`;

// counts every chrome.storage.local.set/get the CONTENT SCRIPT performs, by wrapping the
// API object in the content script's own isolated world.
const WRITE_WRAPPER = `
(() => {
  const L = chrome.storage.local;
  if (!window.__benchWrites) {
    window.__benchWrites = [];
    window.__benchReads = 0;
    try {
      const origSet = L.set, origGet = L.get;
      L.set = function (items, cb) {
        try { window.__benchWrites.push({ t: Date.now(), keys: Object.keys(items || {}) }); } catch (e) { /* ignore */ }
        return origSet.call(L, items, cb);
      };
      L.get = function () { window.__benchReads += 1; return origGet.apply(L, arguments); };
    } catch (e) { return 'wrap-failed:' + (e && e.message); }
  }
  return 'wrapped';
})()
`;

let extSession = null;
let extTarget = null;
async function openExtSession(extId) {
  if (extSession) return extSession;
  const t = await openTarget(`chrome-extension://${extId}/popup.html`);
  extTarget = t.targetId;
  extSession = t.sessionId;
  await waitFor(async () => (await evalIn(extSession, 'document.readyState')) === 'complete', 8000, 100);
  return extSession;
}
async function extEval(expr, opts) { return evalIn(extSession, expr, opts); }
async function setStore(patch) {
  await extEval(`new Promise((res) => chrome.storage.local.set(${JSON.stringify(patch)}, () => res(1)))`, { awaitPromise: true });
}

try {
  const info = await cdpEndpoint();
  ws = await connect(info.webSocketDebuggerUrl);
  send = makeSend(ws);
  out.chrome = info.Browser;

  // ---------- SW: load-time cold start (measured before ANY popup page loads) ----------
  let extId = null;
  if (want('sw') || true) {
    const tLoad0 = Date.now();
    const loaded = await send('Extensions.loadUnpacked', { path: TMP_EXT });
    extId = loaded && loaded.id;
    if (!extId) throw new Error('Extensions.loadUnpacked returned no extension id');
    out.extensionId = extId;
    const tLoaded = Date.now();

    if (want('sw')) {
      const rec = { cmd: cmdFor('sw'), command: 'node scripts/bench/perf.mjs --only=sw', load_unpacked_ms: tLoaded - tLoad0 };
      const sw = await waitFor(() => swTarget(extId), 20000, 50);
      if (sw) {
        const { sessionId: swS } = await send('Target.attachToTarget', { targetId: sw.targetId, flatten: true });
        const to = await waitFor(() => evalIn(swS, 'performance.timeOrigin'), 8000, 50);
        const det = Date.now();
        rec.load_cold_start_ms = to ? round(to - tLoad0, 1) : null; // SW global created - loadUnpacked call
        rec.load_detected_ms = det - tLoad0;
        rec.load_timeOrigin = to || null;
        try { await send('Target.detachFromTarget', { sessionId: swS }); } catch { /* ignore */ }
      } else {
        rec.load_cold_start_ms = null;
        rec.load_note = 'service_worker target never appeared';
      }
      note('sw', rec);
    }
  }

  // ---------- M1: popup open -> painted (cold / warm) ----------
  if (want('popup')) {
    const rec = { cmd: cmdFor('popup'), command: 'node scripts/bench/perf.mjs --only=popup', samples: [] };
    try {
      for (let i = 0; i < N_POPUP + 1; i++) {
        const t0 = Date.now();
        const { targetId, sessionId } = await openTarget(`chrome-extension://${extId}/popup.html`);
        let sample = null;
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
          try {
            const v = await evalIn(sessionId, `JSON.stringify({rs:document.readyState, p:performance.getEntriesByType('paint').map(e=>[e.name,e.startTime]), dcl:(performance.getEntriesByType('navigation')[0]||{}).domContentLoadedEventEnd})`);
            const j = JSON.parse(v || '{}');
            if (j.rs === 'complete') {
              const fcp = (j.p || []).find((e) => e[0] === 'first-contentful-paint');
              sample = { fcp: fcp ? fcp[1] : null, dcl: j.dcl == null ? null : j.dcl, wall: Date.now() - t0 };
              if (sample.fcp != null) break;
            }
          } catch { /* still booting */ }
          await sleep(10);
        }
        if (sample) rec.samples.push(sample);
        await closeTarget(targetId);
        await sleep(60);
      }
    } catch (e) { rec.error = e.message; }
    const fcpOf = (arr) => arr.map((s) => s.fcp).filter((n) => typeof n === 'number');
    const cold = rec.samples[0] || null;
    const warm = rec.samples.slice(1);
    rec.cold = cold;
    rec.warm_n = warm.length;
    rec.warm_fcp_samples = fcpOf(warm);
    rec.warm_wall_samples = warm.map((s) => s.wall);
    rec.warm_fcp_median_ms = round(median(rec.warm_fcp_samples));
    rec.warm_fcp_p95_ms = round(pct(rec.warm_fcp_samples, 95));
    rec.warm_wall_median_ms = round(median(rec.warm_wall_samples));
    rec.warm_wall_p95_ms = round(pct(rec.warm_wall_samples, 95));
    rec.cold_fcp_ms = cold && cold.fcp != null ? round(cold.fcp) : null;
    rec.cold_dcl_ms = cold && cold.dcl != null ? round(cold.dcl) : null;
    rec.cold_wall_ms = cold ? round(cold.wall) : null;
    note('popup', rec);
  }

  // ---------- SW stop/wake restart (needs an extension page as the messenger) ----------
  if (want('sw')) {
    await openExtSession(extId);
    const rec = out.metrics.sw || { cmd: cmdFor('sw'), command: 'node scripts/bench/perf.mjs --only=sw' };
    rec.wake_samples_ms = [];
    rec.wake_detect_samples_ms = [];
    for (let i = 0; i < N_SW; i++) {
      const sw = await swTarget(extId);
      if (!sw) { rec.wake_note = 'service_worker target not present before stop'; break; }
      await closeTarget(sw.targetId);
      const gone = await waitFor(async () => !(await swTarget(extId)), 6000, 50);
      if (!gone) { rec.wake_note = 'service_worker did not stop (Target.closeTarget had no effect)'; break; }
      const t0 = Date.now();
      // wake trigger: a runtime message from an extension page starts the worker
      await extEval(`new Promise((res) => { chrome.runtime.sendMessage({ type: 'maa-bench-wake' }, () => { void chrome.runtime.lastError; res(1); }); })`, { awaitPromise: true });
      const sw2 = await waitFor(() => swTarget(extId), 8000, 20);
      if (!sw2) { rec.wake_note = 'service_worker did not restart on message'; break; }
      const { sessionId: swS } = await send('Target.attachToTarget', { targetId: sw2.targetId, flatten: true });
      const to = await waitFor(() => evalIn(swS, 'performance.timeOrigin'), 5000, 20);
      const det = Date.now();
      try { await send('Target.detachFromTarget', { sessionId: swS }); } catch { /* ignore */ }
      if (to && to >= t0) {
        rec.wake_samples_ms.push(round(to - t0, 1));       // worker global created - wake trigger
        rec.wake_detect_samples_ms.push(det - t0);          // observed by the harness (includes polling)
      }
      await sleep(250);
    }
    rec.wake_median_ms = round(median(rec.wake_samples_ms));
    rec.wake_p95_ms = round(pct(rec.wake_samples_ms, 95));
    rec.wake_detect_median_ms = round(median(rec.wake_detect_samples_ms));
    note('sw', rec);
  }

  // ---------- M3: detect -> click latency ----------
  if (want('latency')) {
    await openExtSession(extId);
    const rec = { cmd: cmdFor('latency'), command: 'node scripts/bench/perf.mjs --only=latency', runs: {} };
    const runLatency = async (label, minDelayMs, gapMs) => {
      await setStore({ enabled: true, minDelayMs, pauseUntil: 0, dryRun: false, allowOnceMode: false, rules: {} });
      await sleep(300);
      const { targetId, sessionId } = await openTarget(SCAN_URL);
      const r = { minDelayMs, gap_ms: gapMs, samples_ms: [] };
      try {
        const cid = await contentCtx(sessionId);
        if (cid == null) throw new Error('content-script context not found');
        await waitFor(async () => (await evalCtx(sessionId, cid, 'typeof window.__museAutoAllow')) === 'object', 8000, 100);
        await evalIn(sessionId, LATENCY_INJECTOR);
        for (let i = 0; i < N_LAT; i++) {
          const tInject = await evalIn(sessionId, `window.__benchInjectCard(${i})`);
          const hit = await waitFor(async () => (await evalIn(sessionId, `JSON.stringify(window.__benchClicks.filter(c=>c.id===${i}))`)) !== '[]', 4000, 15);
          if (hit) {
            const arr = JSON.parse(await evalIn(sessionId, `JSON.stringify(window.__benchClicks.filter(c=>c.id===${i}))`));
            if (arr.length) r.samples_ms.push(arr[0].t - tInject);
          }
          if (gapMs) await sleep(gapMs);
        }
      } catch (e) { r.error = e.message; }
      await closeTarget(targetId);
      r.n = r.samples_ms.length;
      r.median_ms = round(median(r.samples_ms));
      r.p95_ms = round(pct(r.samples_ms, 95));
      return r;
    };
    rec.runs.quiet_min0 = await runLatency('quiet (minDelayMs=0)', 0, 400);
    rec.runs.default_pacing = await runLatency('default pacing (minDelayMs=300, back-to-back)', 300, 0);
    note('latency', rec);
  }

  // ---------- M2: content-script scan cost per sweep on a heavy DOM ----------
  if (want('scan')) {
    await openExtSession(extId);
    const rec = { cmd: cmdFor('scan'), command: 'node scripts/bench/perf.mjs --only=scan', cards: HEAVY_CARDS, node_budget: HEAVY_NODES };
    const { targetId, sessionId } = await openTarget(SCAN_URL);
    try {
      const cid = await contentCtx(sessionId);
      if (cid == null) throw new Error('content-script context not found');
      await waitFor(async () => (await evalCtx(sessionId, cid, 'typeof window.__museAutoAllow')) === 'object', 8000, 100);
      await evalIn(sessionId, HEAVY_BUILDER);
      rec.actual_nodes = await evalIn(sessionId, `window.__benchBuildHeavy(${HEAVY_CARDS}, ${HEAVY_NODES}, 300)`);
      rec.actual_buttons = await evalIn(sessionId, `document.querySelectorAll('button,[role="button"]').length`);
      rec.actual_cards = await evalIn(sessionId, `document.querySelectorAll('[data-testid="hatch-inline-approval-card"]').length`);
      await sleep(400); // let the MutationObserver debounce settle
      const expr = `(() => {
        const out = [];
        for (let i = 0; i < 8; i++) window.__museAutoAllow.sweep();
        for (let i = 0; i < ${N_SWEEP}; i++) { const t0 = performance.now(); window.__museAutoAllow.sweep(); out.push(performance.now() - t0); }
        return JSON.stringify(out);
      })()`;
      rec.samples_ms = JSON.parse(await evalCtx(sessionId, cid, expr));
      rec.n = rec.samples_ms.length;
      rec.median_ms = round(median(rec.samples_ms), 2);
      rec.p95_ms = round(pct(rec.samples_ms, 95), 2);
      rec.min_ms = round(Math.min(...rec.samples_ms), 2);
      rec.max_ms = round(Math.max(...rec.samples_ms), 2);
    } catch (e) { rec.error = e.message; }
    await closeTarget(targetId);
    note('scan', rec);
  }

  // ---------- M5: storage write amplification ----------
  if (want('writes')) {
    await openExtSession(extId);
    const rec = { cmd: cmdFor('writes'), command: 'node scripts/bench/perf.mjs --only=writes' };
    // (a) per click — 3 sequential clicks so the one-time cryptKeyRaw write is separated
    //     from the steady-state per-click cost
    try {
      await setStore({ enabled: true, minDelayMs: 0, pauseUntil: 0, dryRun: false, allowOnceMode: false, rules: {} });
      await sleep(300);
      const { targetId, sessionId } = await openTarget(SCAN_URL);
      const cid = await contentCtx(sessionId);
      if (cid == null) throw new Error('content-script context not found');
      await evalCtx(sessionId, cid, WRITE_WRAPPER);
      await evalIn(sessionId, LATENCY_INJECTOR);
      await sleep(500);
      rec.clicks = [];
      for (let i = 0; i < 3; i++) {
        await evalCtx(sessionId, cid, 'window.__benchWrites.length = 0; window.__benchReads = 0');
        const tInject = await evalIn(sessionId, `window.__benchInjectCard(${900 + i})`);
        await waitFor(async () => (await evalIn(sessionId, `JSON.stringify(window.__benchClicks.filter(c=>c.id===${900 + i}))`)) !== '[]', 4000, 15);
        await sleep(1200); // catch the debounced digest write
        const w = JSON.parse(await evalCtx(sessionId, cid, 'JSON.stringify(window.__benchWrites)'));
        const cl = JSON.parse(await evalIn(sessionId, `JSON.stringify(window.__benchClicks.filter(c=>c.id===${900 + i}))`));
        rec.clicks.push({
          writes: w.length,
          keys: w.map((x) => x.keys),
          reads: await evalCtx(sessionId, cid, 'window.__benchReads'),
          latency_ms: cl.length ? cl[0].t - tInject : null,
        });
      }
      rec.writes_per_click = rec.clicks[rec.clicks.length - 1].writes; // steady state (key already exists)
      rec.writes_per_click_first = rec.clicks[0].writes;
      await closeTarget(targetId);
    } catch (e) { rec.click_error = e.message; }
    // (b) per follow-up send (auto, idle-triggered on the real follow-up fixture; the
    //     cooldown is pinned to 1h so exactly ONE send is counted)
    try {
      await setStore({ enabled: true, pauseUntil: 0, followupEnabled: true, followupPrompt: 'Bench follow-up prompt.', followupChips: [], followupIdleMs: 0, followupCooldownMs: 3600000 });
      await sleep(400);
      const { targetId, sessionId } = await openTarget(FOLLOWUP_URL);
      const cid = await contentCtx(sessionId);
      if (cid == null) throw new Error('content-script context not found');
      await evalCtx(sessionId, cid, WRITE_WRAPPER);
      await waitFor(async () => (await evalIn(sessionId, 'typeof window.__setState')) === 'function', 8000, 100);
      await sleep(600);
      await evalCtx(sessionId, cid, 'window.__benchWrites.length = 0; window.__benchReads = 0');
      await evalIn(sessionId, `window.__setState('idle')`);
      const sent = await waitFor(async () => (await evalIn(sessionId, 'JSON.stringify((window.__sent||[]).length)')) !== '0', 12000, 200);
      await sleep(2500);
      rec.followup_sent = Number(sent) || 0;
      rec.followup_writes = JSON.parse(await evalCtx(sessionId, cid, 'JSON.stringify(window.__benchWrites)'));
      rec.followup_reads = await evalCtx(sessionId, cid, 'window.__benchReads');
      rec.writes_per_followup = rec.followup_writes.length;
      rec.followup_sent_final = Number(await evalIn(sessionId, '(window.__sent||[]).length')) || 0;
      await closeTarget(targetId);
    } catch (e) { rec.followup_error = e.message; }
    note('writes', rec);
  }

  // ---------- M6: memory footprint ----------
  if (want('memory')) {
    await openExtSession(extId);
    const rec = { cmd: cmdFor('memory'), command: 'node scripts/bench/perf.mjs --only=memory' };
    const heapOf = async (sessionId) => {
      try {
        await send('Performance.enable', {}, sessionId);
        const m = await send('Performance.getMetrics', {}, sessionId);
        const map = {};
        for (const x of m.metrics || []) map[x.name] = x.value;
        return map;
      } catch { return null; }
    };
    // popup
    try {
      const { targetId, sessionId } = await openTarget(`chrome-extension://${extId}/popup.html`);
      await waitFor(async () => (await evalIn(sessionId, 'document.readyState')) === 'complete', 8000, 100);
      await sleep(700);
      const hm = await heapOf(sessionId);
      rec.popup_heap_bytes = hm ? hm.JSHeapUsedSize : null;
      rec.popup_heap_mb = hm ? round(hm.JSHeapUsedSize / 1048576, 2) : null;
      rec.popup_nodes = await evalIn(sessionId, 'document.getElementsByTagName("*").length');
      await closeTarget(targetId);
    } catch (e) { rec.popup_error = e.message; }
    const gc = async (sessionId) => { try { await send('HeapProfiler.collectGarbage', {}, sessionId); } catch { /* ignore */ } };
    // content script: idle -> heavy DOM -> during sweeps. A forced GC before each read makes
    // the numbers comparable (JSHeapUsedSize reflects the last GC).
    try {
      const { targetId, sessionId } = await openTarget(SCAN_URL);
      const cid = await contentCtx(sessionId);
      if (cid == null) throw new Error('content-script context not found');
      await sleep(600);
      await gc(sessionId);
      let hm = await heapOf(sessionId);
      rec.content_idle_heap_bytes = hm ? hm.JSHeapUsedSize : null;
      rec.content_idle_heap_mb = hm ? round(hm.JSHeapUsedSize / 1048576, 2) : null;
      rec.content_idle_perfmemory_mb = await evalCtx(sessionId, cid, 'window.performance && performance.memory ? Math.round(performance.memory.usedJSHeapSize/1048576*100)/100 : null');
      // heavy DOM
      await evalIn(sessionId, HEAVY_BUILDER);
      rec.content_nodes_heavy = await evalIn(sessionId, `window.__benchBuildHeavy(${HEAVY_CARDS}, ${HEAVY_NODES}, 300)`);
      await sleep(400);
      await gc(sessionId);
      hm = await heapOf(sessionId);
      rec.content_heavy_heap_bytes = hm ? hm.JSHeapUsedSize : null;
      rec.content_heavy_heap_mb = hm ? round(hm.JSHeapUsedSize / 1048576, 2) : null;
      rec.content_heavy_perfmemory_mb = await evalCtx(sessionId, cid, 'window.performance && performance.memory ? Math.round(performance.memory.usedJSHeapSize/1048576*100)/100 : null');
      // repeated sweeps
      await evalCtx(sessionId, cid, `(() => { for (let i=0;i<${Math.max(30, N_SWEEP)};i++) window.__museAutoAllow.sweep(); return 1; })()`);
      await gc(sessionId);
      hm = await heapOf(sessionId);
      rec.content_sweep_heap_bytes = hm ? hm.JSHeapUsedSize : null;
      rec.content_sweep_heap_mb = hm ? round(hm.JSHeapUsedSize / 1048576, 2) : null;
      rec.content_sweep_perfmemory_mb = await evalCtx(sessionId, cid, 'window.performance && performance.memory ? Math.round(performance.memory.usedJSHeapSize/1048576*100)/100 : null');
      rec.content_sweep_minus_heavy_mb = (rec.content_sweep_heap_mb != null && rec.content_heavy_heap_mb != null)
        ? round(rec.content_sweep_heap_mb - rec.content_heavy_heap_mb, 2) : null;
      await closeTarget(targetId);
    } catch (e) { rec.content_error = e.message; }
    note('memory', rec);
  }

  out.measured_on = new Date().toISOString();
} catch (e) {
  out.errors.push(String(e && e.message || e));
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
function line(k, v) { console.log('  ' + k.padEnd(30) + ' ' + (v == null ? 'n/a' : v)); }
console.log('\n=== SPEED AXIS (scripts/bench/perf.mjs) ===');
console.log('measured_on', out.measured_on, '| chrome', out.chrome || '?', '| extension', out.extensionId || '?');
const m = out.metrics;
if (m.popup) {
  console.log('\n[popup open -> painted] ' + m.popup.command);
  line('cold FCP ms', m.popup.cold_fcp_ms);
  line('cold DCL ms', m.popup.cold_dcl_ms);
  line('warm FCP median ms', m.popup.warm_fcp_median_ms);
  line('warm FCP p95 ms', m.popup.warm_fcp_p95_ms);
  line('warm wall median ms', m.popup.warm_wall_median_ms);
  line('warm wall p95 ms', m.popup.warm_wall_p95_ms);
  line('warm n', m.popup.warm_n);
}
if (m.scan) {
  console.log('\n[content-script scan cost per sweep] ' + m.scan.command);
  line('heavy nodes', m.scan.actual_nodes);
  line('cards / buttons', (m.scan.actual_cards + ' / ' + m.scan.actual_buttons));
  line('median ms', m.scan.median_ms);
  line('p95 ms', m.scan.p95_ms);
  line('min / max ms', (m.scan.min_ms + ' / ' + m.scan.max_ms));
}
if (m.latency) {
  console.log('\n[detect -> click latency] ' + m.latency.command);
  for (const k of Object.keys(m.latency.runs || {})) {
    const r = m.latency.runs[k];
    line(k + ' median ms', r.median_ms);
    line(k + ' p95 ms', r.p95_ms);
  }
}
if (m.sw) {
  console.log('\n[service-worker cold start] ' + m.sw.command);
  line('load-time cold start ms', m.sw.load_cold_start_ms);
  line('wake median ms', m.sw.wake_median_ms);
  line('wake p95 ms', m.sw.wake_p95_ms);
}
if (m.writes) {
  console.log('\n[storage write amplification] ' + m.writes.command);
  for (const [i, c] of (m.writes.clicks || []).entries()) {
    line('click #' + (i + 1) + ' writes / keys', c.writes + ' ' + JSON.stringify(c.keys));
  }
  line('writes per click (steady)', m.writes.writes_per_click);
  line('writes per click (first)', m.writes.writes_per_click_first);
  line('writes per follow-up', m.writes.writes_per_followup);
  line('follow-up writes', JSON.stringify((m.writes.followup_writes || []).map((w) => w.keys)));
  line('follow-up sends seen', m.writes.followup_sent_final);
}
if (m.memory) {
  console.log('\n[memory footprint] ' + m.memory.command);
  line('popup heap MB', m.memory.popup_heap_mb);
  line('content idle heap MB', m.memory.content_idle_heap_mb);
  line('content heavy-DOM heap MB', m.memory.content_heavy_heap_mb);
  line('content during-sweeps heap MB', m.memory.content_sweep_heap_mb);
  line('sweep - heavy MB', m.memory.content_sweep_minus_heavy_mb);
}
if (out.errors.length) console.log('\nerrors: ' + JSON.stringify(out.errors));
console.log('\n--- JSON ---');
console.log(JSON.stringify(out, null, 2));
process.exit(out.errors.length ? 2 : 0);
