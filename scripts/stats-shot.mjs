#!/usr/bin/env node
/**
 * stats-shot.mjs — real screenshots of the v1.3.0 Statistics page and popup.
 * Launches installed Chrome on a SCRATCH profile (never the user's), loads the real
 * extension unpacked, seeds realistic stats data, and captures:
 *   store/screenshot2-stats.png  (1280x800, store-size)
 *   store/screenshot3-popup.png  (1280x800 stage: the real popup centered on a light stage)
 *   + a dark-mode QA pair in the OS temp dir (maa-dark/)
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
const _topicNames = ['demo-project', 'sample-app', 'web-starter', 'notes-app', 'files.example.com'];
const _topicRest = _topicNames.slice(1).map((_, i) => Math.floor(total * [0.221, 0.172, 0.088, 0.049][i]));
const stats = {
  byDay, byMonth, byYear,
  // Neutral, clearly fictional demo data (never real projects — public store assets).
  // Topic values partition the all-time click count, so the screenshot reconciles with
  // the Total KPI ('demo-project' absorbs the rounding remainder).
  byTopic: Object.fromEntries(_topicNames.map((n, i) => [n, i ? _topicRest[i - 1] : total - _topicRest.reduce((s, v) => s + v, 0)])),
};

// realistic click log for the popup shot (fictional only; short-form contexts so each
// entry renders fully — the popup's 78-char clamp does not cut them mid-thought)
const isoMinus = (mins) => new Date(Date.now() - mins * 60000).toISOString();
const log = [
  { at: isoMinus(2), kind: 'allow', label: 'Allow', context: 'Allow Muse to perform this action on your GitHub account? Pull request read' },
  { at: isoMinus(6), kind: 'allow', label: 'Allow', context: 'Allow Muse to perform this action on your GitHub account? Create branch' },
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
  '--no-first-run', '--no-default-browser-check', '--force-color-profile=srgb',
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

  // followupEnabled:true — the popup shot must show the Auto follow-up section in its
  // ON state (ungated panel, live controls), not the collapsed off-state.
  const seedExpr = `new Promise((r) => chrome.storage.local.set(${JSON.stringify({ stats, clickCount: total, log, followupEnabled: true })}, r))`;

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
  await send('Emulation.setDeviceMetricsOverride', { width: 340, height: 1500, deviceScaleFactor: 2, mobile: false }, s2);
  await send('Runtime.evaluate', { expression: seedExpr, awaitPromise: true, returnByValue: true }, s2);
  await send('Page.reload', {}, s2);
  await sleep(1200);
  // Screenshot framing only: lift the popup's 600px scroll cap and expand the log viewport to
  // its content, so the store shot shows the complete popup (no half-sliced row, no scrollbar).
  // The shipped popup keeps both — this only changes what the capture shows.
  await send('Runtime.evaluate', { expression: '(() => { document.body.style.maxHeight = "none"; const lg = document.getElementById("log"); if (lg) lg.style.maxHeight = (lg.scrollHeight + 8) + "px"; return "ok"; })()', returnByValue: true }, s2);
  await sleep(250);
  // capture the popup at its full natural height (2x) — the popup page keeps growing with new
  // features, so the viewport is tall enough to render all of it and the stage below fits it.
  const bh = await send('Runtime.evaluate', { expression: 'document.body.scrollHeight', returnByValue: true }, s2);
  const bodyH = Math.min(1500, Number(bh?.result?.value) || 620);
  const shot2 = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 340, height: bodyH, scale: 2 } }, s2);
  // …then compose a 1280x800 store shot: the real popup centered on the light stage
  const stageDir = path.join(os.tmpdir(), 'maa-stage');
  fs.mkdirSync(stageDir, { recursive: true });
  const stagePath = path.join(stageDir, 'popup-stage.html');
  const stageHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; } html, body { margin: 0; width: 1280px; height: 800px; overflow: hidden; }
    body { background: #fcfcfc; color: #111112; font-family: "Optimistic","optimisticAI",-apple-system,"Segoe UI",system-ui,sans-serif; }
    .blob { position: absolute; border-radius: 50%; filter: blur(80px); }
    .b1 { width: 480px; height: 480px; background: #f3d9b4; left: -150px; top: -170px; opacity: .5; }
    .b2 { width: 460px; height: 460px; background: #cfe2ff; right: -130px; bottom: -150px; opacity: .8; }
    .wrap { position: relative; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; }
    .cap { font-size: 15px; color: #4a4e54; } .cap b { color: #005abf; font-weight: 500; }
    img { display: block; max-width: 430px; max-height: 740px; width: auto; height: auto; border-radius: 16px;
          box-shadow: 0 18px 60px rgba(17,17,18,.16), 0 0 0 1px rgba(17,17,18,.08); }
  </style></head><body>
    <div class="blob b1"></div><div class="blob b2"></div>
    <div class="wrap">
      <div class="cap"><b>Live popup</b> — real click log, counter, auto follow-up, on/off</div>
      <img src="data:image/png;base64,${shot2.data}">
    </div>
  </body></html>`;
  fs.writeFileSync(stagePath, stageHtml);
  const t3 = await send('Target.createTarget', { url: 'file:///' + stagePath.replace(/\\/g, '/') });
  const { sessionId: s3 } = await send('Target.attachToTarget', { targetId: t3.targetId, flatten: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, s3);
  await sleep(900);
  const stageShot = await send('Page.captureScreenshot', { format: 'png' }, s3);
  fs.writeFileSync(path.join(OUT, 'screenshot3-popup.png'), Buffer.from(stageShot.data, 'base64'));
  out.popup = path.join(OUT, 'screenshot3-popup.png');

  // ---- dark-mode QA captures (scratch only, never store assets) ----
  const QADIR = path.join(os.tmpdir(), 'maa-dark');
  fs.mkdirSync(QADIR, { recursive: true });
  const DARK = { features: [{ name: 'prefers-color-scheme', value: 'dark' }] };
  await send('Emulation.setEmulatedMedia', DARK, s1);
  await sleep(600);
  const s1d = await send('Page.captureScreenshot', { format: 'png' }, s1);
  fs.writeFileSync(path.join(QADIR, 'stats-dark.png'), Buffer.from(s1d.data, 'base64'));
  await send('Emulation.setEmulatedMedia', DARK, s2);
  await sleep(600);
  const s2d = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 340, height: bodyH, scale: 2 } }, s2);
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
