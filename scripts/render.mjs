#!/usr/bin/env node
// render.mjs — render icon sizes + store assets from the HTML sources via CDP.
// (chrome --headless --screenshot proved unreliable on this host; the CDP lane is proven.)
// Usage: node scripts/render.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IS_WIN = process.platform === 'win32';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chromePath = process.env.MAA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.env.MAA_RENDER_PORT || 9700 + Math.floor(Math.random() * 200));
const profileDir = path.join(os.tmpdir(), `maa-render-${process.pid}-${Date.now().toString(36)}`);
fs.mkdirSync(profileDir, { recursive: true });

// Detached via PowerShell Start-Process (the chrome.exe launcher exits immediately on
// this host; the browser keeps running as its own process tree, reaped by profile path).
const CHROME_ARGS = [
  `--user-data-dir=${profileDir}`,
  `--remote-debugging-port=${PORT}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  '--window-position=-32000,-32000',
  '--window-size=1300,900',
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

const JOBS = [
  { src: 'assets/icon-small.html', out: 'extension/icons/icon16.png', w: 16, h: 16, transparent: true },
  { src: 'assets/icon-small.html', out: 'extension/icons/icon32.png', w: 32, h: 32, transparent: true },
  { src: 'assets/icon.html', out: 'extension/icons/icon48.png', w: 48, h: 48, transparent: true },
  { src: 'assets/icon.html', out: 'extension/icons/icon128.png', w: 128, h: 128, transparent: true },
  { src: 'assets/icon.html', out: 'extension/icons/icon512.png', w: 512, h: 512, transparent: true },
  { src: 'assets/store-screenshot.html', out: 'store/screenshot1.png', w: 1280, h: 800, transparent: false },
  { src: 'assets/promo-tile.html', out: 'store/promo440x280.png', w: 440, h: 280, transparent: false },
];

let ws = null;
let send = null;
let failed = false;
try {
  const info = await cdpEndpoint();
  ws = await connect(info.webSocketDebuggerUrl);
  send = makeSend(ws);

  for (const job of JOBS) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { width: job.w, height: job.h, deviceScaleFactor: 1, mobile: false }, sessionId);
    await send('Emulation.setDefaultBackgroundColorOverride',
      { color: job.transparent ? { r: 0, g: 0, b: 0, a: 0 } : { r: 15, g: 16, b: 21, a: 1 } }, sessionId);
    const url = pathToFileURL(path.join(ROOT, job.src)).href;
    await send('Page.navigate', { url }, sessionId);
    await sleep(1000); // let the page render and settle
    const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true }, sessionId);
    const outPath = path.join(ROOT, job.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
    console.log('wrote', job.out, fs.statSync(outPath).size, 'bytes');
    try { await send('Target.closeTarget', { targetId }); } catch { /* ignore */ }
  }
} catch (e) {
  failed = true;
  console.error('render failed:', e.message);
  if (chromeStderr) console.error('chrome stderr:', chromeStderr.slice(0, 500));
} finally {
  try { await send?.('Browser.close'); } catch { /* may be gone */ }
  await sleep(1200); // let the browser exit cleanly before reaping
  let remaining = countMyChrome();
  for (let i = 0; i < 12 && remaining > 0; i++) { killMyChrome(); await sleep(500); remaining = countMyChrome(); }
  if (remaining > 0) console.error(`WARNING: ${remaining} chrome process(es) still reference ${profileDir}`);
  for (let i = 0; i < 6; i++) {
    try { fs.rmSync(profileDir, { recursive: true, force: true }); break; } catch { await sleep(500); }
  }
  try { ws?.close(); } catch { /* ignore */ }
}

process.exit(failed ? 2 : 0);
