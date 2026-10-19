// debug-w5-popup.mjs — mở popup trong Chrome scratch, bắt exception + chẩn đoán boot
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT_DIR = process.env.MAA_EXT_DIR ? path.resolve(process.env.MAA_EXT_DIR) : path.join(ROOT, 'extension');
const IS_WIN = process.platform === 'win32';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TMP_EXT = fs.mkdtempSync(path.join(os.tmpdir(), 'maa-dbg-'));
fs.cpSync(EXT_DIR, TMP_EXT, { recursive: true });
const chromePath = process.env.MAA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9700 + Math.floor(Math.random() * 200);
const profileDir = path.join(os.tmpdir(), `maa-dbg-${process.pid}-${Date.now().toString(36)}`);
fs.mkdirSync(profileDir, { recursive: true });

const psq = (s) => s.replace(/'/g, "''");
const args = [
  `--user-data-dir=${profileDir}`, `--remote-debugging-port=${PORT}`,
  '--enable-unsafe-extension-debugging', '--no-first-run', '--no-default-browser-check',
  '--disable-features=Translate,MediaRouter,CalculateNativeWinOcclusion,OptimizationHints',
  '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
  '--window-position=-32000,-32000', '--window-size=1100,800', 'about:blank',
];
execFileSync('powershell.exe', ['-NoProfile', '-Command',
  `Start-Process -FilePath '${psq(chromePath)}' -ArgumentList ${args.map((a) => `'${psq(a)}'`).join(',')}`],
  { stdio: 'ignore', timeout: 30000 });

function killMyChrome() {
  try {
    if (!IS_WIN) return;
    const ps = `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine -like '*${psq(profileDir)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
    execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { stdio: 'ignore', timeout: 30000 });
  } catch {}
}

async function cdpEndpoint(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const res = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (res.ok) { const j = await res.json(); if (j.webSocketDebuggerUrl) return j; } } catch {}
    await sleep(250);
  }
  throw new Error('no CDP');
}
const connect = (wsUrl) => new Promise((res, rej) => { const ws = new WebSocket(wsUrl); ws.onopen = () => res(ws); ws.onerror = () => rej(new Error('ws err')); });
function makeSend(ws, onEvent) {
  let seq = 0; const pending = new Map();
  ws.onmessage = (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    if (onEvent) onEvent(msg);
    if (msg.id && pending.has(msg.id)) { const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id); msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result); }
  };
  return (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject });
    const m = { id, method, params }; if (sessionId) m.sessionId = sessionId;
    ws.send(JSON.stringify(m));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(method + ' timed out')); } }, 20000);
  });
}

let ws = null;
try {
  const info = await cdpEndpoint();
  ws = await connect(info.webSocketDebuggerUrl);
  const events = [];
  const send = makeSend(ws, (msg) => {
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params && msg.params.exceptionDetails;
      events.push('EXC: ' + (d && (d.exception && (d.exception.description || d.exception.value) || d.text) || '?'));
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const p = msg.params || {};
      if (p.type === 'error' || p.type === 'warning') events.push(p.type.toUpperCase() + ': ' + (p.args || []).map((a) => a.value || a.description || '').join(' ').slice(0, 200));
    }
  });
  const loaded = await send('Extensions.loadUnpacked', { path: TMP_EXT });
  const extId = loaded?.id;
  console.log('extId:', extId);
  const t = await send('Target.createTarget', { url: `chrome-extension://${extId}/popup.html` });
  const att = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
  const sid = att.sessionId;
  await send('Runtime.enable', {}, sid);
  await send('Log.enable', {}, sid).catch(() => {});
  await sleep(3000);
  const ev = async (expr) => {
    try { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sid); return r.result && r.result.value; }
    catch (e) { return 'EVAL_ERR ' + e.message; }
  };
  const out = {
    readyState: await ev('document.readyState'),
    MuseRules: await ev('typeof MuseRules'),
    v18onboarded: await ev('(() => { try { return JSON.stringify({ onboarded: v18.onboarded, dryRun: v18.dryRun, pauseUntil: v18.pauseUntil }); } catch (e) { return "ERR"; } })()'),
    storage: await ev('new Promise((res) => chrome.storage.local.get(null, (s) => res(JSON.stringify(Object.keys(s || {})))))'),
    onboardEl: await ev('(() => { const o = document.getElementById("onboard"); return o ? JSON.stringify({ hidden: o.hidden, cls: o.className }) : "null"; })()'),
    obSkip: await ev('!!document.getElementById("obSkip")'),
    bannerEl: await ev('(() => { const b = document.getElementById("banner"); return b ? JSON.stringify({ hidden: b.hidden, text: (b.textContent || "").slice(0, 80) }) : "null"; })()'),
    stateLine: await ev('(() => { const s = document.getElementById("stateLine"); return s ? (s.textContent || "").slice(0, 80) : "null"; })()'),
    renderLayers: await ev('typeof renderLayers'),
    renderRulesCall: await ev('(() => { try { renderRules(); return "ok"; } catch (e) { return "ERR " + e.message; } })()'),
    renderLayersCall: await ev('(() => { try { renderLayers(); return "ok"; } catch (e) { return "ERR " + e.message; } })()'),
    layersListEl: await ev('!!document.getElementById("layersList")'),
    banner: await ev('(document.getElementById("banner")||{}).textContent || ""'),
    logItems: await ev('document.querySelectorAll("#logList .item").length'),
    onboardHidden: await ev('(document.getElementById("onboard")||{}).hidden'),
    rulesNote: await ev('(() => { try { return String(document.getElementById("layerNote") && document.getElementById("layerNote").textContent || ""); } catch (e) { return "E"; } })()'),
    scriptSrcs: await ev('Array.from(document.querySelectorAll("script[src]")).map((s) => s.getAttribute("src")).join(",")'),
  };
  console.log(JSON.stringify(out, null, 2));
  console.log('EVENTS:', JSON.stringify(events.slice(0, 20), null, 2));
} catch (e) {
  console.log('FATAL:', e.message);
} finally {
  try { ws && ws.close(); } catch {}
  killMyChrome();
  try { fs.rmSync(TMP_EXT, { recursive: true, force: true }); } catch {}
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
  process.exit(0);
}
