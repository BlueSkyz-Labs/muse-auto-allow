#!/usr/bin/env node
/**
 * e2e.mjs — runtime verification for Muse Auto-Allow on a REAL Chromium.
 *
 * Lane: INSTALLED Chrome (137+) via CDP `Extensions.loadUnpacked`
 * (installed Chrome ignores --load-extension; --enable-unsafe-extension-debugging required).
 * Scratch profile only — never touches the user's real profile.
 * The extension is loaded from a TEMP COPY whose manifest additionally matches
 * http://127.0.0.1/* (the shipped manifest stays muse.ai-only).
 *
 * Asserts (fixture):
 *  1. path B: classic Allow+Deny pairs clicked (cards 1, 2)
 *  2. path A: [data-testid=hatch-inline-approval-card] card clicked (card 4)
 *  3. path C: collapsed pending card expanded, then its Allow clicked (pending5 -> 5)
 *  4. path D: background surface button clicked, then revealed Allow clicked (surface -> 6)
 *  5. late card (MutationObserver) clicked (card 3)
 *  6. never: lone Allow, "Allow notifications"/"Block", Deny buttons
 *  7. muse.ai (logged out): content script injects (documentElement attribute) — WARN-only
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXT_DIR = path.join(ROOT, 'extension');
const IS_WIN = process.platform === 'win32';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(path.join(EXT_DIR, 'manifest.json'))) {
  console.error('e2e: no manifest.json in ' + EXT_DIR);
  process.exit(1);
}

// Temp copy of the extension with the localhost test match injected.
const TMP_EXT = fs.mkdtempSync(path.join(os.tmpdir(), 'maa-ext-'));
fs.cpSync(EXT_DIR, TMP_EXT, { recursive: true });
{
  const manPath = path.join(TMP_EXT, 'manifest.json');
  const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
  man.content_scripts[0].matches.push('http://127.0.0.1/*');
  fs.writeFileSync(manPath, JSON.stringify(man, null, 2));
}

const chromePath = process.env.MAA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.env.MAA_PORT || 9400 + Math.floor(Math.random() * 500));
const profileDir = path.join(os.tmpdir(), `maa-e2e-${process.pid}-${Date.now().toString(36)}`);
fs.mkdirSync(profileDir, { recursive: true });

// ---------- fixture server (project root) ----------
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = urlPath === '/' ? 'test/fixture.html' : urlPath.replace(/^\/+/, '');
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (e, buf) => {
    if (e) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(buf);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const fixtureUrl = `http://127.0.0.1:${server.address().port}/test/fixture.html`;
console.log('fixture:', fixtureUrl);

// ---------- launch installed Chrome (scratch profile) ----------
// Detached via PowerShell Start-Process: on this host the chrome.exe launcher exits
// immediately (code 0) and a Node spawn handle is useless — the browser keeps running
// as its own process tree, so we reap it by scratch-profile path at teardown.
const CHROME_ARGS = [
  `--user-data-dir=${profileDir}`,
  `--remote-debugging-port=${PORT}`,
  '--enable-unsafe-extension-debugging',
  '--no-first-run',
  '--no-default-browser-check',
  // Keep the offscreen window fully active: on Windows, occlusion detection plus
  // background timer throttling froze layout ~5s in, every getBoundingClientRect
  // check returned 0 and all clicking silently stopped mid-test (diagnosed 2026-10-08).
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
let chromeStderr = '';

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

function makeSend(ws) {
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  };
  return (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    const m = { id, method, params };
    if (sessionId) m.sessionId = sessionId;
    ws.send(JSON.stringify(m));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(method + ' timed out')); } }, 20000);
  });
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

const EXPECTED = ['1', '2', '3', '4', '5', '6', '7', 'pending5', 'surface'];
const FORBIDDEN = ['8', '9', 'surface2', 'lone', 'notif'];

let ws = null;
let send = null;
const results = { ok: false };
try {
  const info = await cdpEndpoint();
  ws = await connect(info.webSocketDebuggerUrl);
  send = makeSend(ws);

  const loaded = await send('Extensions.loadUnpacked', { path: TMP_EXT });
  const extId = loaded?.id;
  if (!extId) throw new Error('Extensions.loadUnpacked returned no extension id');
  console.log('extensionId:', extId);

  // ---- fixture test ----
  const { targetId } = await send('Target.createTarget', { url: fixtureUrl });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

  const deadline = Date.now() + 18000;
  let clicks = [];
  const timeline = [];
  while (Date.now() < deadline) {
    try {
      const r = await send('Runtime.evaluate', { expression: 'JSON.stringify({c:(window.__clicks||[]).length, v:document.visibilityState, p:window.__probe||null})', returnByValue: true }, sessionId);
      const j = JSON.parse(r?.result?.value || '{}');
      timeline.push({ t: Date.now(), c: j.c, v: j.v, ticks: j.p && j.p.ticks });
      const rr = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__clicks || [])', returnByValue: true }, sessionId);
      clicks = JSON.parse(rr?.result?.value || '[]');
    } catch { /* target may still be booting */ }
    const got = clicks.map((c) => String(c.n));
    if (EXPECTED.every((n) => got.includes(n))) break;
    await sleep(400);
  }

  // Settle: let the extension run a few extra sweep cycles so late-evaluated guards
  // are actually exercised before asserting. Phase 1 covers everything whose timing
  // window is short (dedup is asserted inside its 5s window). Phase 2 then waits out
  // the 10s open-panel throttle before checking surface2, whose negative test is only
  // reachable after surface -> card6 (without it the surface2 test is vacuous).
  await sleep(2000);
  try {
    const rr2 = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__clicks || [])', returnByValue: true }, sessionId);
    clicks = JSON.parse(rr2?.result?.value || '[]');
  } catch { /* keep last known clicks */ }

  const got = clicks.map((c) => String(c.n)); // phase-1 snapshot
  const missing = EXPECTED.filter((n) => !got.includes(n));
  const extra = got.filter((n) => !EXPECTED.includes(n));
  const dupes = got.filter((n, i) => got.indexOf(n) !== i);
  const denyCount = clicks.filter((c) => c.deny).length;
  const n7count = got.filter((n) => n === '7').length; // re-render dedup: must be exactly 1
  const idx = (n) => got.indexOf(n);
  const orderOk = idx('pending5') >= 0 && idx('5') > idx('pending5') && idx('surface') >= 0 && idx('6') > idx('surface');

  // Phase 2: wait out the surface throttle, then confirm surface2 was still skipped.
  // Sampled every 1s so the diagnostics show whether the page stayed alive through
  // the idle window (ticks) and when late clicks actually happen.
  const surfaceAt = (clicks.find((c) => c.n === 'surface') || {}).t || 0;
  const waitUntil = surfaceAt + 10500;
  const timeline2 = [];
  while (Date.now() < waitUntil) {
    try {
      const r2 = await send('Runtime.evaluate', { expression: 'JSON.stringify({c:(window.__clicks||[]).length, v:document.visibilityState, p:window.__probe||null})', returnByValue: true }, sessionId);
      const j2 = JSON.parse(r2?.result?.value || '{}');
      timeline2.push({ t: Date.now(), c: j2.c, v: j2.v, ticks: j2.p && j2.p.ticks, last: j2.p && j2.p.last });
    } catch { /* keep waiting */ }
    await sleep(1000);
  }
  let clicksFinal = clicks;
  try {
    const rr3 = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__clicks || [])', returnByValue: true }, sessionId);
    clicksFinal = JSON.parse(rr3?.result?.value || '[]');
  } catch { /* keep phase-1 snapshot */ }
  const gotFinal = clicksFinal.map((c) => String(c.n));
  const surface2Hit = gotFinal.includes('surface2');
  const lateClicks = gotFinal.slice(got.length); // appended clicks after the phase-1 snapshot
  const retryFired = gotFinal.filter((n) => n === '7').length >= 2; // dedup window expired -> legitimate retry
  const forbiddenHit = [...FORBIDDEN.filter((n) => got.includes(n)), ...(surface2Hit ? ['surface2'] : [])];

  // ---- muse.ai smoke (logged out; WARN-only if the network is blocked) ----
  let museAttr = null;
  try {
    const t2 = await send('Target.createTarget', { url: 'https://muse.ai/' });
    const { sessionId: s2 } = await send('Target.attachToTarget', { targetId: t2.targetId, flatten: true });
    const dl2 = Date.now() + 15000;
    while (Date.now() < dl2) {
      try {
        const r = await send('Runtime.evaluate', { expression: "document.documentElement.getAttribute('data-muse-auto-allow')", returnByValue: true }, s2);
        if (r?.result?.value === '1') { museAttr = true; break; }
      } catch { /* keep waiting */ }
      await sleep(500);
    }
    if (museAttr === null) museAttr = false;
  } catch (e) {
    museAttr = 'error: ' + e.message;
  }

  const pass = missing.length === 0 && extra.length === 0 && dupes.length === 0 && denyCount === 0 && orderOk
    && forbiddenHit.length === 0 && n7count === 1 && !surface2Hit;
  Object.assign(results, {
    ok: pass,
    extId,
    fixtureUrl,
    clicked: got,
    missing,
    extra,
    forbiddenHit,
    dupes,
    denyCount,
    n7count,
    orderOk,
    museAttr,
    surface2Hit,
    lateClicks,
    retryFired,
    timeline: timeline.slice(-45),
    timeline2: timeline2.slice(-30),
    raw: clicks,
  });
} catch (e) {
  results.error = e.message;
  results.chromeStderr = chromeStderr.slice(0, 800);
} finally {
  try { await send?.('Browser.close'); } catch { /* may be gone */ }
  await sleep(1200); // let the browser exit cleanly before reaping
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

console.log(JSON.stringify(results, null, 2));
process.exit(results.ok ? 0 : 2);
