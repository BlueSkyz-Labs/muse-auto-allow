// capture-store-shots.mjs — regenerate the CWS 1280×800 stage screenshots from REAL captures.
// Serves the repo over a scratch HTTP server (so the stage page can load the shots), captures
// three stages, writes store/screenshot2-stats.png, screenshot3-popup.png, screenshot5-safety.png.
// Input shots come from scratch/shots (run `node scripts/capture-shots.mjs` first).
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SHOTS_IN = path.join(REPO, 'scratch', 'shots');
const SHOTS_OUT = path.join(REPO, 'store', 'shots');
fs.mkdirSync(SHOTS_OUT, { recursive: true });
const need = ['popup-live-dark.png', 'popup-onboarding-dark.png', 'stats-dark.png'];
for (const f of need) {
  const src = path.join(SHOTS_IN, f);
  if (!fs.existsSync(src)) { console.error('MISSING input shot:', src, '— run scripts/capture-shots.mjs first'); process.exit(2); }
  fs.cpSync(src, path.join(SHOTS_OUT, f));
}

const PORT = 8130 + Math.floor(Math.random() * 60);
const srv = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: REPO, stdio: 'ignore', windowsHide: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);

const profileDir = path.join(os.tmpdir(), `maa-store-p-${process.pid}`);
fs.mkdirSync(profileDir, { recursive: true });
const CDP = 9910 + Math.floor(Math.random() * 60);
const chromePath = process.env.MAA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const psq = (s) => s.replace(/'/g, "''");
execFileSync('powershell.exe', ['-NoProfile', '-Command',
  `Start-Process -FilePath '${psq(chromePath)}' -ArgumentList ${[
    `--user-data-dir=${profileDir}`, `--remote-debugging-port=${CDP}`, '--no-first-run',
    '--window-position=-32000,-32000', '--window-size=1400,900', 'about:blank',
  ].map((a) => `'${psq(a)}'`).join(',')}`], { stdio: 'ignore', timeout: 30000 });

async function cdpEndpoint() { for (let i = 0; i < 160; i++) { try { const r = await fetch(`http://127.0.0.1:${CDP}/json/version`); if (r.ok) { const j = await r.json(); if (j.webSocketDebuggerUrl) return j; } } catch {} await sleep(250); } throw new Error('no cdp'); }
let seq = 0; const pending = new Map();
const info = await cdpEndpoint();
const ws = await new Promise((res, rej) => { const s = new WebSocket(info.webSocketDebuggerUrl); s.onopen = () => res(s); s.onerror = () => rej(new Error('ws')); });
ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
const send = (method, params = {}, sid) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); const m = { id, method, params }; if (sid) m.sessionId = sid; ws.send(JSON.stringify(m)); setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(method + ' timeout')); } }, 30000); });

const stages = [
  { out: 'screenshot2-stats.png', q: 'shots/stats-dark.png', w: 1000, title: 'Your approvals, measured.', sub: 'Local-only statistics: a 14-day trend, topic mix, and honest import/export — dates in your own language.' },
  { out: 'screenshot3-popup.png', q: 'shots/popup-live-dark.png', w: 400, title: 'Auto-click Allow, with a seatbelt.', sub: 'Never clicks Deny. Explicit pause controls. Local-only, no telemetry, six languages.' },
  { out: 'screenshot5-safety.png', q: 'shots/popup-onboarding-dark.png', w: 400, title: 'Logging-only until you say go.', sub: 'Fresh installs detect and log only. A 3-step first run states the consent line and turns live clicking on in one tap.' },
];

try {
  for (const st of stages) {
    const url = `http://127.0.0.1:${PORT}/store/stage.html?src=${encodeURIComponent(st.q)}&w=${st.w}&title=${encodeURIComponent(st.title)}&sub=${encodeURIComponent(st.sub)}`;
    const t = await send('Target.createTarget', { url });
    const { sessionId } = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
    await send('Page.enable', {}, sessionId);
    await sleep(900);
    for (let i = 0; i < 20; i++) { const r = await send('Runtime.evaluate', { expression: 'window.__stageReady === true', returnByValue: true }, sessionId); if (r?.result?.value) break; await sleep(200); }
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId);
    await sleep(400);
    const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
    fs.writeFileSync(path.join(REPO, 'store', st.out), Buffer.from(data, 'base64'));
    console.log('saved store/' + st.out, '(' + Math.round(Buffer.from(data, 'base64').length / 1024) + ' KB)');
    await send('Target.closeTarget', { targetId: t.targetId }).catch(() => {});
  }
} finally {
  try { ws.close(); } catch {}
  try { srv.kill(); } catch {}
  try { execFileSync('powershell.exe', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*maa-store-p-*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { timeout: 20000 }); } catch {}
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
  console.log('STORE_SHOTS_DONE');
}
