// measure-popup.mjs — đo chiều cao từng khối của popup (chẩn đoán overflow 603px)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const EXT = path.join(ROOT, 'extension');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'maa-dbg-m-'));
fs.cpSync(EXT, TMP, { recursive: true });
const PORT = 9900 + Math.floor(Math.random() * 90);
const PROFILE = path.join(os.tmpdir(), `maa-dbg-m-${process.pid}`);
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
let seq = 0; const pend = new Map();
ws.onmessage = (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
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
  const t = await send('Target.createTarget', { url: `chrome-extension://${extId}/popup.html` });
  const { sessionId } = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId);
  await sleep(900);
  const ev = async (expr, awaitPromise) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, ...(awaitPromise ? { awaitPromise: true } : {}) }, sessionId);
    return r?.exceptionDetails ? { __err: r.exceptionDetails.text } : r?.result?.value;
  };
  // seed: follow-up ON (trạng thái của followup-e2e), onboarding tắt
  await ev(`new Promise((res) => chrome.storage.local.set({ enabled: true, followupEnabled: true, dryRun: false, onboarded: true, followupPrompt: 'Continue implementation — follow best practices, Source of Truth, do your best', followupIdleMs: 400, followupCooldownMs: 1500 }, () => res('ok')))`, true);
  await send('Page.reload', {}, sessionId); await sleep(1200);
  const out = await ev(`JSON.stringify((() => {
    const parts = {};
    for (const el of document.body.children) {
      const r = el.getBoundingClientRect();
      parts[(el.id || el.className || el.tagName).toString().slice(0, 24)] = Math.round(r.height);
    }
    const sect = document.getElementById('followupSect');
    const sectParts = {};
    if (sect) for (const el of sect.children) { const r = el.getBoundingClientRect(); sectParts[(el.id || el.className || el.tagName).toString().slice(0, 24)] = Math.round(r.height); }
    return { bodyH: document.body.scrollHeight, footBottom: Math.round(document.querySelector('.foot').getBoundingClientRect().bottom - document.body.getBoundingClientRect().top), parts, sectH: sect ? Math.round(sect.getBoundingClientRect().height) : null, sectParts };
  })())`);
  console.log(out);
} catch (e) { console.log('FATAL', e.message); }
finally {
  try { ws.close(); } catch {}
  try { execFileSync('powershell.exe', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${psq(PROFILE)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { timeout: 25000 }); } catch {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch {}
  process.exit(0);
}
