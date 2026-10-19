// debug-stats.mjs — mở stats trong Chrome scratch, seed đúng như capture-shots, đọc KPI
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const EXT = path.join(ROOT, 'extension');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'maa-dbg-s-'));
fs.cpSync(EXT, TMP, { recursive: true });
const PORT = 9800 + Math.floor(Math.random() * 90);
const PROFILE = path.join(os.tmpdir(), `maa-dbg-s-${process.pid}`);
fs.mkdirSync(PROFILE, { recursive: true });
const psq = (s) => s.replace(/'/g, "''");
execFileSync('powershell.exe', ['-NoProfile', '-Command',
  `Start-Process -FilePath 'C:/Program Files/Google/Chrome/Application/chrome.exe' -ArgumentList ${[
    `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, '--enable-unsafe-extension-debugging',
    '--no-first-run', '--no-default-browser-check', '--window-position=-32000,-32000', '--window-size=1200,900', 'about:blank',
  ].map((a) => `'${psq(a)}'`).join(',')}`], { stdio: 'ignore', timeout: 30000 });

for (let i = 0; i < 120; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break; } catch {} await sleep(250); }
const info = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const ws = await new Promise((res, rej) => { const w = new WebSocket(info.webSocketDebuggerUrl); w.onopen = () => res(w); w.onerror = () => rej(new Error('ws')); });
let seq = 0; const pend = new Map(); const events = [];
ws.onmessage = (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m.method === 'Runtime.exceptionThrown') events.push('EXC ' + (m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text));
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params?.type)) events.push('CON ' + (m.params.args || []).map((a) => a.value || a.description || '').join(' ').slice(0, 160));
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
};
const send = (method, params = {}, sid) => new Promise((resolve, reject) => {
  const id = ++seq; pend.set(id, { resolve, reject });
  const msg = { id, method, params }; if (sid) msg.sessionId = sid;
  ws.send(JSON.stringify(msg));
  setTimeout(() => { if (pend.has(id)) { pend.delete(id); reject(new Error(method + ' timeout')); } }, 25000);
});
try {
  const loaded = await send('Extensions.loadUnpacked', { path: TMP });
  const extId = loaded.id;
  const t = await send('Target.createTarget', { url: `chrome-extension://${extId}/stats.html` });
  const { sessionId } = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId);
  await sleep(600);
  const ev = async (expr, awaitPromise) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, ...(awaitPromise ? { awaitPromise: true } : {}) }, sessionId);
    return r?.exceptionDetails ? { __err: r.exceptionDetails.text } : r?.result?.value;
  };
  const d1 = new Date(); const d2 = new Date(Date.now() - 26 * 3600e3);
  const key = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const mk = JSON.stringify(key(d1).slice(0, 7));
  const setRes = await ev(`new Promise((res) => chrome.storage.local.set({ stats: { byDay: { ${JSON.stringify(key(d1))}: 6, ${JSON.stringify(key(d2))}: 5 }, byMonth: { ${mk}: 11 }, byYear: { ${JSON.stringify(String(new Date().getFullYear()))}: 11 }, byTopic: { 'docs.muse.ai': 9, 'github.com': 2 } }, clickCount: 11, clickCount2: 11 }, () => res('ok')))`, true);
  console.log('set:', setRes);
  const stored = await ev(`new Promise((res) => chrome.storage.local.get(null, (s) => res(JSON.stringify({ keys: Object.keys(s), clickCount: s.clickCount, m: s.stats && s.stats.byMonth }))))`, true);
  console.log('stored:', stored);
  await send('Page.reload', {}, sessionId); await sleep(1400);
  const kpi = await ev(`JSON.stringify({ total: (document.getElementById('kTotal')||{}).textContent, today: (document.getElementById('kToday')||{}).textContent, week: (document.getElementById('kWeek')||{}).textContent, month: (document.getElementById('kMonth')||{}).textContent, chartEmptyHidden: (document.getElementById('chartEmpty')||{}).hidden, bars: document.querySelectorAll('#chart rect.bar').length, weekBody: (document.getElementById('auditWeekBody')||{}).textContent })`);
  console.log('kpi:', kpi);
  console.log('events:', JSON.stringify(events.slice(0, 10)));
} catch (e) { console.log('FATAL', e.message); }
finally {
  try { ws.close(); } catch {}
  try { execFileSync('powershell.exe', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${psq(PROFILE)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { timeout: 25000 }); } catch {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch {}
  process.exit(0);
}
