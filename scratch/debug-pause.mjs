// debug-pause.mjs — popup với pause/anomaly state: đọc DOM + exception sau reload
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'maa-dbg-p-'));
fs.cpSync(path.join(ROOT, 'extension'), TMP, { recursive: true });
const PORT = 9950 + Math.floor(Math.random() * 40);
const PROFILE = path.join(os.tmpdir(), `maa-dbg-p-${process.pid}`);
fs.mkdirSync(PROFILE, { recursive: true });
const psq = (s) => s.replace(/'/g, "''");
execFileSync('powershell.exe', ['-NoProfile', '-Command',
  `Start-Process -FilePath 'C:/Program Files/Google/Chrome/Application/chrome.exe' -ArgumentList ${[
    `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, '--enable-unsafe-extension-debugging',
    '--no-first-run', '--no-default-browser-check', '--window-position=-32000,-32000', '--window-size=1100,800', 'about:blank',
  ].map((a) => `'${psq(a)}'`).join(',')}`], { stdio: 'ignore', timeout: 30000 });
for (let i = 0; i < 120; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break; } catch {} await sleep(250); }
const info = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const ws = await new Promise((res, rej) => { const w = new WebSocket(info.webSocketDebuggerUrl); w.onopen = () => res(w); w.onerror = () => rej(new Error('ws')); });
let seq = 0; const pend = new Map(); const events = [];
ws.onmessage = (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m.method === 'Runtime.exceptionThrown') events.push('EXC ' + (m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text || '').slice(0, 220));
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
};
const send = (method, params = {}, sid) => new Promise((resolve, reject) => {
  const id = ++seq; pend.set(id, { resolve, reject });
  const msg = { id, method, params }; if (sid) msg.sessionId = sid;
  ws.send(JSON.stringify(msg));
  setTimeout(() => { if (pend.has(id)) { pend.delete(id); reject(new Error(method + ' timeout')); } }, 20000);
});
try {
  const loaded = await send('Extensions.loadUnpacked', { path: TMP });
  const extId = loaded.id;
  const t = await send('Target.createTarget', { url: `chrome-extension://${extId}/popup.html` });
  const { sessionId } = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId);
  await sleep(800);
  const ev = async (expr, awaitPromise) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, ...(awaitPromise ? { awaitPromise: true } : {}) }, sessionId);
    return r?.exceptionDetails ? { __err: (r.exceptionDetails.exception || {}).description || r.exceptionDetails.text } : r?.result?.value;
  };
  const seedRes = await ev(`new Promise((res) => chrome.storage.local.set({ enabled: true, dryRun: false, onboarded: true, pauseUntil: Date.now() + 600000, anomalyLastPause: { rule: 'rate', until: Date.now() + 600000 } }, () => res('ok')))`, true);
  console.log('seed:', seedRes);
  await send('Page.reload', {}, sessionId); await sleep(1500);
  const out = await ev(`JSON.stringify({ pauseActiveHidden: (document.getElementById('pauseActive')||{}).hidden, pstate: (document.getElementById('pstateText')||{}).textContent, noteHidden: (document.getElementById('anomalyNote')||{}).hidden, stext: (document.getElementById('ssText')||{}).textContent, modeTagHidden: (document.getElementById('modeTag')||{}).hidden, bodyH: Math.round(document.body.getBoundingClientRect().height) })`);
  console.log('dom:', out);
  console.log('events:', JSON.stringify(events.slice(0, 6)));
} catch (e) { console.log('FATAL', e.message); }
finally {
  try { ws.close(); } catch {}
  try { execFileSync('powershell.exe', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${psq(PROFILE)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { timeout: 25000 }); } catch {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch {}
  process.exit(0);
}
