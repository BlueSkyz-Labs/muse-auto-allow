// v1.21.0 chẩn đoán: mở popup.html trong Chrome scratch + bắt exception/console + đo một vài
// biểu thức THEN CHỐT (không thuộc bộ kiểm thử chính thức; chạy tay khi cần).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve('.');
const EXT = path.join(ROOT, 'extension');
const chromePath = process.env.MAA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 10170;
const profileDir = path.join(os.tmpdir(), `maa-diag-${process.pid}-${Date.now().toString(36)}`);
fs.mkdirSync(profileDir, { recursive: true });
const tmpExt = fs.mkdtempSync(path.join(os.tmpdir(), 'maa-diag-ext-'));
fs.cpSync(EXT, tmpExt, { recursive: true });

const args = [
  `--user-data-dir=${profileDir}`,
  `--remote-debugging-port=${PORT}`,
  '--enable-unsafe-extension-debugging',
  `--load-extension=${tmpExt}`,
  '--no-first-run', '--no-default-browser-check',
  '--disable-features=Translate,MediaRouter',
  '--window-position=-32000,-32000', '--window-size=1100,800', 'about:blank',
];
const psq = (s) => s.replace(/'/g, "''");
execFileSync('powershell.exe', ['-NoProfile', '-Command',
  `Start-Process -FilePath '${psq(chromePath)}' -ArgumentList ${args.map((a) => `'${psq(a)}'`).join(',')}`],
  { stdio: 'ignore', timeout: 30000 });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl = null;
const dl = Date.now() + 20000;
while (Date.now() < dl && !wsUrl) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) wsUrl = (await r.json()).webSocketDebuggerUrl; } catch { /* wait */ }
  if (!wsUrl) await sleep(250);
}
if (!wsUrl) { console.log('DIAG: no CDP'); process.exit(1); }
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const pending = new Map(); const events = [];
ws.onmessage = (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); return; }
  if (m.method === 'Runtime.exceptionThrown') events.push('EXC ' + JSON.stringify(m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text || '').slice(0, 400));
  if (m.method === 'Runtime.consoleAPICalled' && (m.params?.type === 'error' || m.params?.type === 'warning')) events.push('CONSOLE ' + m.params.type + ' ' + JSON.stringify((m.params.args || []).map((a) => a.value || a.description || '').join(' ')).slice(0, 300));
};
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++seq; pending.set(id, { resolve, reject });
  const msg = { id, method, params }; if (sessionId) msg.sessionId = sessionId;
  ws.send(JSON.stringify(msg));
  setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(method + ' timed out')); } }, 15000);
});

// tìm id extension + mở tab popup
await sleep(1500);
const targets = await send('Target.getTargets');
const extTarget = targets.targetTypes ? null : targets;
const sw = (targets.targetTargetInfos || []).find((t) => t.url && t.url.startsWith('chrome-extension://') && t.url.includes('background'));
const extId = sw ? new URL(sw.url).host : null;
console.log('DIAG extId:', extId);
if (!extId) { console.log('DIAG: no extension target — targets:', (targets.targetTargetInfos || []).map((t) => t.url).slice(0, 6)); process.exit(1); }
const t = await send('Target.createTarget', { url: `chrome-extension://${extId}/popup.html` });
const { sessionId } = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
await send('Runtime.enable', {}, sessionId);
await sleep(1500);
const read = async (expr) => { try { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId); return r?.result?.value; } catch (e) { return 'ERR ' + e.message; } };
console.log('DIAG title:', await read('document.title'));
console.log('DIAG readyState:', await read('document.readyState'));
console.log('DIAG scripts:', await read('Array.from(document.scripts).map((s) => s.src.split("/").pop()).join(",")'));
console.log('DIAG globals:', await read('[typeof MusePlaybook, typeof MuseLicense, typeof MAA_LICENSE_PUBKEY].join(",")'));
console.log('DIAG listener sanity:', await read('(() => { try { const b = document.getElementById("licActivate"); return b ? "licOK" : "no-lic"; } catch (e) { return "E:" + e.message; } })()'));
console.log('DIAG events:', JSON.stringify(events.slice(0, 8), null, 1));
try { await send('Target.closeTarget', { targetId: t.targetId }); } catch { /* ignore */ }
ws.close();
// dọn: chỉ tiến trình theo profile này
try {
  execFileSync('powershell.exe', ['-NoProfile', '-Command',
    `Get-CimInstance Win32_Process -Filter "name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${psq(profileDir)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`],
    { stdio: 'ignore', timeout: 20000 });
  fs.rmSync(profileDir, { recursive: true, force: true });
  fs.rmSync(tmpExt, { recursive: true, force: true });
} catch { /* ignore */ }
console.log('DIAG DONE');
