// capture-shots.mjs — Beauty-Blind review screenshots (scratch Chrome, own profile).
// Produces: scratch/shots/<name>.png  (popup dry/live, onboarding, stats; dark + light).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const EXT = path.join(REPO, 'extension');
const OUT = path.join(REPO, 'scratch', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TMP_EXT = fs.mkdtempSync(path.join(os.tmpdir(), 'maa-shots-'));
fs.cpSync(EXT, TMP_EXT, { recursive: true });
const profileDir = path.join(os.tmpdir(), `maa-shots-p-${process.pid}`);
fs.mkdirSync(profileDir, { recursive: true });
const PORT = 9700 + Math.floor(Math.random() * 100);
const chromePath = process.env.MAA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const psq = (s) => s.replace(/'/g, "''");
execFileSync('powershell.exe', ['-NoProfile', '-Command',
  `Start-Process -FilePath '${psq(chromePath)}' -ArgumentList ${[
    `--user-data-dir=${profileDir}`, `--remote-debugging-port=${PORT}`,
    '--enable-unsafe-extension-debugging', '--no-first-run', '--no-default-browser-check',
    '--window-position=-32000,-32000', '--window-size=1400,1000', 'about:blank',
  ].map((a) => `'${psq(a)}'`).join(',')}`], { stdio: 'ignore', timeout: 30000 });

async function cdpEndpoint() { for (let i = 0; i < 160; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) { const j = await r.json(); if (j.webSocketDebuggerUrl) return j; } } catch {} await sleep(250); } throw new Error('no cdp'); }
const w = await (await cdpEndpoint()).webSocketDebuggerUrl;
const ws = await new Promise((res, rej) => { const s = new WebSocket(w); s.onopen = () => res(s); s.onerror = () => rej(new Error('ws')); });
let seq = 0; const pending = new Map();
ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
const send = (method, params = {}, sid) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); const m = { id, method, params }; if (sid) m.sessionId = sid; ws.send(JSON.stringify(m)); setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(method + ' timeout')); } }, 30000); });

const loaded = await send('Extensions.loadUnpacked', { path: TMP_EXT });
const extId = loaded?.id;
const mk = async (file) => { const t = await send('Target.createTarget', { url: `chrome-extension://${extId}/${file}` }); const { sessionId } = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true }); await send('Page.enable', {}, sessionId); await sleep(1000); return sessionId; };
const ev = async (sid, expr, awaitPromise = false) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, ...(awaitPromise ? { awaitPromise: true } : {}) }, sid); return r?.exceptionDetails ? { __err: true } : r?.result?.value; };
const shot = async (sid, name, width, height) => {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false }, sid);
  await sleep(500);
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sid);
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(data, 'base64'));
  await send('Emulation.clearDeviceMetricsOverride', {}, sid);
  console.log('saved', name + '.png', '(' + Math.round(Buffer.from(data, 'base64').length / 1024) + ' KB)');
};
const scheme = async (sid, v) => { await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: v }] }, sid); await sleep(350); };

// --- popup: dry (fresh boot, onboarding open) ---
const popup = await mk('popup.html');
await ev(popup, `new Promise((res) => chrome.storage.local.set({ userLocale: 'vi', rules: { allowTopics: [], blockKeywords: ['delete', 'payment', 'transfer', 'billing'], layers: [ { id: 'block-money', kind: 'block', match: { keywords: ['payment', 'billing', 'transfer'] } }, { id: 'ask-purchase', kind: 'ask', match: { topics: ['purchase'] } }, { id: 'allow-repo', kind: 'allow', match: { topics: ['github.com'] } } ] } }, () => res('ok')))`, true);
await sleep(300);
await send('Page.reload', {}, popup); await sleep(1200);
await scheme(popup, 'dark');  await shot(popup, 'popup-onboarding-dark', 400, 640);
await scheme(popup, 'light'); await shot(popup, 'popup-onboarding-light', 400, 640);
await ev(popup, `(() => { const s = document.getElementById('obSkip'); if (s) s.click(); return 'ok'; })()`);
await sleep(500);
await scheme(popup, 'dark');  await shot(popup, 'popup-dry-dark', 400, 640);
await scheme(popup, 'light'); await shot(popup, 'popup-dry-light', 400, 640);

// --- popup: live mode ---
await ev(popup, `new Promise((res) => chrome.storage.local.set({ dryRun: false, enabled: true }, () => res('ok')))`, true);
await send('Page.reload', {}, popup); await sleep(1200);
await ev(popup, `(() => { const s = document.getElementById('obSkip'); if (s) s.click(); return 'ok'; })()`);
await sleep(500);
await scheme(popup, 'dark');  await shot(popup, 'popup-live-dark', 400, 640);
await scheme(popup, 'light'); await shot(popup, 'popup-live-light', 400, 640);

// --- v1.21.0: Safety panel (anomaly guard + license) + mission playbook config preview ---
await ev(popup, `(() => { const b = document.getElementById('safetyBtn'); if (b) b.click(); return 'ok'; })()`);
await sleep(500);
// v1.22.2: ảnh đầu panel (status strip + Dry-run/YOLO) — panel scroll mới tới layers ở dưới
await scheme(popup, 'dark'); await shot(popup, 'popup-safety-top-dark', 400, 640);
// v1.22.0: trưng khối LUẬT BA TẦNG (mới W5) — scroll tới #layersGroup (thấy bảng luật + phần dưới)
await ev(popup, `(() => { const o = document.querySelector('#safetyPanel .ovbody'); const g = document.getElementById('layersGroup'); if (o && g) o.scrollTop = Math.max(0, g.offsetTop - 80); return 'ok'; })()`);
await sleep(250);
await scheme(popup, 'dark');  await shot(popup, 'popup-safety-dark', 400, 640);
await ev(popup, `(() => { const o = document.querySelector('#safetyPanel .ovbody'); const g = document.getElementById('layersGroup'); if (o && g) o.scrollTop = Math.max(0, g.offsetTop - 80); return 'ok'; })()`);
await scheme(popup, 'light'); await shot(popup, 'popup-safety-light', 400, 640);
await ev(popup, `(() => { const c = document.getElementById('safetyClose'); if (c) c.click(); return 'ok'; })()`);
await sleep(300);
await ev(popup, `(() => { const b = document.getElementById('misbtn'); if (b) b.click(); return 'ok'; })()`);
await sleep(400);
await ev(popup, `(() => { const rows = document.querySelectorAll('#misList [data-mid]'); for (const r of rows) if (r.dataset.mid === 'scoped-run') r.click(); return 'ok'; })()`);
await sleep(400);
await scheme(popup, 'dark');  await shot(popup, 'popup-playbook-dark', 400, 640);

// --- stats with data ---
const stats = await mk('stats.html');
const d1 = new Date(); const d2 = new Date(Date.now() - 26 * 3600e3);
const key = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
await ev(stats, `new Promise((res) => chrome.storage.local.set({ stats: { byDay: { ${JSON.stringify(key(d1))}: 6, ${JSON.stringify(key(d2))}: 5, ${JSON.stringify(key(new Date(Date.now() - 50 * 3600e3)))}: 3, ${JSON.stringify(key(new Date(Date.now() - 74 * 3600e3)))}: 1 }, byMonth: { ${JSON.stringify(key(d1).slice(0, 7))}: 15 }, byYear: { ${JSON.stringify(String(new Date().getFullYear()))}: 15 }, byTopic: { 'docs.muse.ai': 12, 'github.com': 3 } }, clickCount: 15 }, () => res('ok')))`, true);
await send('Page.reload', {}, stats); await sleep(1200);
await scheme(stats, 'dark');  await shot(stats, 'stats-dark', 960, 820);
await scheme(stats, 'light'); await shot(stats, 'stats-light', 960, 820);

ws.close();
console.log('SHOTS_DONE');
