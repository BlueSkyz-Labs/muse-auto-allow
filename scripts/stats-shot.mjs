#!/usr/bin/env node
/**
 * stats-shot.mjs — real screenshots of the v1.3.0 Statistics page and popup.
 * Launches installed Chrome on a SCRATCH profile (never the user's), loads the real
 * extension unpacked, seeds realistic stats data, and captures:
 *   store/screenshot2-stats.png  (1280x800, store-size)
 *   store/screenshot3-popup.png  (340x640 @2x)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXT = path.join(ROOT, 'extension');
const OUT = path.join(ROOT, 'store');
const IS_WIN = process.platform === 'win32';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- seed: realistic 45-day history ----
const pad2 = (n) => String(n).padStart(2, '0');
const dayKey = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const monthKey = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1);
const now = new Date();
const byDay = {};
const byMonth = {};
const byYear = {};
let total = 0;
for (let i = 44; i >= 0; i--) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
  // deterministic pseudo-random pattern: busy weekdays, quiet weekends
  const dow = d.getDay();
  const base = (dow === 0 || dow === 6) ? 2 : 8;
  const v = base + ((i * 7 + 3) % 9) + (i < 7 ? 3 : 0);
  byDay[dayKey(d)] = v;
  byMonth[monthKey(d)] = (byMonth[monthKey(d)] || 0) + v;
  byYear[String(d.getFullYear())] = (byYear[String(d.getFullYear())] || 0) + v;
  total += v;
}
const stats = {
  byDay, byMonth, byYear,
  // Neutral, clearly fictional demo data (never real projects — public store assets).
  byTopic: {
    'demo-project': 66,
    'sample-app': 31,
    'web-starter': 24,
    'notes-app': 12,
    'files.example.com': 5,
  },
};

// realistic click log for the popup shot (fictional org/repos only)
const isoMinus = (mins) => new Date(Date.now() - mins * 60000).toISOString();
const log = [
  { at: isoMinus(2), kind: 'allow', label: 'Allow', context: 'Allow Muse to perform this action on your GitHub account? Action Pull request read on GitHub Repository owner Example Org Pull request 42 Repository demo-project Method get' },
  { at: isoMinus(6), kind: 'allow', label: 'Allow', context: 'Allow Muse to perform this action on your GitHub account? Action Create a GitHub branch on GitHub Repository owner Example Org Repository sample-app Branch feature/new-docs Method post' },
  { at: isoMinus(11), kind: 'allow', label: 'Allow', context: 'Allow Muse to perform this action on your GitHub account? Action Push files to GitHub on GitHub Repository owner Example Org Repository web-starter Method post' },
  { at: isoMinus(15), kind: 'allow', label: 'Allow', context: 'Allow Muse to perform this action on your GitHub account? Action Create a GitHub pull request on GitHub Repository owner Example Org Repository sample-app Title docs: refresh quick-start guide Method post' },
  { at: isoMinus(22), kind: 'allow', label: 'Allow', context: 'Allow Muse to perform this action on your GitHub account? Action Issue read on GitHub Issue 12 Repository web-starter Method get' },
  { at: isoMinus(31), kind: 'allow', label: 'Allow', context: 'Allow Muse to perform this action on your Azure account? Access files.example.com' },
  { at: isoMinus(40), kind: 'allow', label: 'Allow', context: 'Allow Muse to perform this action on your GitHub account? Action Pull request read on GitHub Repository owner Example Org Pull request 42 Repository demo-project Method get' },
];

const chromePath = process.env.MAA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9700 + Math.floor(Math.random() * 200);
const profileDir = path.join(os.tmpdir(), `maa-shot-${process.pid}-${Date.now().toString(36)}`);
fs.mkdirSync(profileDir, { recursive: true });

const psq = (s) => s.replace(/'/g, "''");
function launchChromeDetached(args) {
  const argList = args.map((a) => `'${psq(a)}'`).join(',');
  execFileSync('powershell.exe', ['-NoProfile', '-Command',
    `Start-Process -FilePath '${psq(chromePath)}' -ArgumentList ${argList}`],
    { stdio: 'ignore', timeout: 30000 });
}
launchChromeDetached([
  `--user-data-dir=${profileDir}`,
  `--remote-debugging-port=${PORT}`,
  '--enable-unsafe-extension-debugging',
  '--no-first-run', '--no-default-browser-check',
  '--disable-features=Translate,MediaRouter,CalculateNativeWinOcclusion,OptimizationHints',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--window-position=-32000,-32000',
  '--window-size=1400,900',
  'about:blank',
]);

async function cdpEndpoint(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) { const j = await res.json(); if (j.webSocketDebuggerUrl) return j; }
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chrome did not expose CDP');
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
function countMyChrome() {
  try {
    if (!IS_WIN) return 0;
    const ps = `@(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine -like '*${psq(profileDir)}*' }).Count`;
    return Number(execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8', timeout: 25000 }).trim()) || 0;
  } catch { return 0; }
}
function killMyChrome() {
  try {
    if (!IS_WIN) return;
    const ps = `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine -like '*${psq(profileDir)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
    execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { stdio: 'ignore', timeout: 30000 });
  } catch { /* nothing to kill */ }
}

let ws = null;
let send = null;
const out = { ok: false };
try {
  const info = await cdpEndpoint();
  ws = await connect(info.webSocketDebuggerUrl);
  send = makeSend(ws);

  const loaded = await send('Extensions.loadUnpacked', { path: EXT });
  const extId = loaded?.id;
  if (!extId) throw new Error('loadUnpacked returned no id');
  out.extId = extId;

  const seedExpr = `new Promise((r) => chrome.storage.local.set(${JSON.stringify({ stats, clickCount: total, log })}, r))`;

  // ---- stats page ----
  const t1 = await send('Target.createTarget', { url: `chrome-extension://${extId}/stats.html` });
  const { sessionId: s1 } = await send('Target.attachToTarget', { targetId: t1.targetId, flatten: true });
  await send('Runtime.evaluate', { expression: seedExpr, awaitPromise: true, returnByValue: true }, s1);
  // store captures are LIGHT (Muse language); dark is captured separately for QA
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] }, s1);
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, s1);
  await send('Page.reload', {}, s1);
  await sleep(1600);
  const shot1 = await send('Page.captureScreenshot', { format: 'png' }, s1);
  fs.writeFileSync(path.join(OUT, 'screenshot2-stats.png'), Buffer.from(shot1.data, 'base64'));
  out.stats = path.join(OUT, 'screenshot2-stats.png');
  try {
    const fitR = await send('Runtime.evaluate', { expression: 'JSON.stringify({ h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth })', returnByValue: true }, s1);
    out.fit = JSON.parse(fitR?.result?.value || '{}');
  } catch { /* informational only */ }

  // ---- popup ----
  // a real muse.ai tab so the popup status chip shows the live state (best effort)
  try { await send('Target.createTarget', { url: 'https://muse.ai/' }); await sleep(4000); } catch { /* offline is fine */ }
  const t2 = await send('Target.createTarget', { url: `chrome-extension://${extId}/popup.html` });
  const { sessionId: s2 } = await send('Target.attachToTarget', { targetId: t2.targetId, flatten: true });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] }, s2);
  await send('Emulation.setDeviceMetricsOverride', { width: 340, height: 660, deviceScaleFactor: 2, mobile: false }, s2);
  await send('Runtime.evaluate', { expression: seedExpr, awaitPromise: true, returnByValue: true }, s2);
  await send('Page.reload', {}, s2);
  await sleep(1200);
  // crop to content: expand the log viewport (with slack so no scrollbar remains),
  // then capture exactly the popup's height
  await send('Runtime.evaluate', { expression: '(() => { const lg = document.getElementById("log"); if (lg) lg.style.maxHeight = (lg.scrollHeight + 8) + "px"; return "ok"; })()', returnByValue: true }, s2);
  await sleep(250);
  const hR = await send('Runtime.evaluate', { expression: 'Math.max(document.body.scrollHeight, 520)', returnByValue: true }, s2);
  const contentH = Math.min(1200, Number(hR?.result?.value) || 660);
  await send('Emulation.setDeviceMetricsOverride', { width: 340, height: contentH, deviceScaleFactor: 2, mobile: false }, s2);
  await sleep(300);
  const shot2 = await send('Page.captureScreenshot', { format: 'png' }, s2);
  fs.writeFileSync(path.join(OUT, 'screenshot3-popup.png'), Buffer.from(shot2.data, 'base64'));
  out.popup = path.join(OUT, 'screenshot3-popup.png');

  // ---- dark-mode QA captures (scratch only, never store assets) ----
  const QADIR = 'C:/Users/<local-user>/AppData/Local/hermes/cache/scratch/maa-dark';
  fs.mkdirSync(QADIR, { recursive: true });
  const DARK = { features: [{ name: 'prefers-color-scheme', value: 'dark' }] };
  await send('Emulation.setEmulatedMedia', DARK, s1);
  await sleep(600);
  const s1d = await send('Page.captureScreenshot', { format: 'png' }, s1);
  fs.writeFileSync(path.join(QADIR, 'stats-dark.png'), Buffer.from(s1d.data, 'base64'));
  await send('Emulation.setEmulatedMedia', DARK, s2);
  await sleep(600);
  const s2d = await send('Page.captureScreenshot', { format: 'png' }, s2);
  fs.writeFileSync(path.join(QADIR, 'popup-dark.png'), Buffer.from(s2d.data, 'base64'));
  out.dark = [path.join(QADIR, 'stats-dark.png'), path.join(QADIR, 'popup-dark.png')];

  out.ok = true;
} catch (e) {
  out.error = e.message;
} finally {
  try { await send?.('Browser.close'); } catch { /* gone */ }
  await sleep(1200);
  let remaining = countMyChrome();
  for (let i = 0; i < 12 && remaining > 0; i++) { killMyChrome(); await sleep(500); remaining = countMyChrome(); }
  for (let i = 0; i < 6; i++) {
    try { fs.rmSync(profileDir, { recursive: true, force: true }); break; } catch { await sleep(500); }
  }
  try { ws?.close(); } catch { /* ignore */ }
}
console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 2);
