#!/usr/bin/env node
/**
 * store-shot.mjs — capture a REAL Chrome Web Store screenshot (1280x800).
 *
 * Unlike the old designed mock (assets/store-screenshot.html with demo values), this
 * captures the real extension at runtime: real Chrome + real extension + the fixture
 * page (a faithful replica of Muse's approval card) + the real popup with a real,
 * freshly-generated click log. The two real captures are placed side by side on a
 * branded stage and rendered at exactly 1280x800.
 *
 * Output: store/screenshot1.png
 * Scratch profile only — never touches the user's real profile.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXT_DIR = path.join(ROOT, 'extension');
const OUT = path.join(ROOT, 'store', 'screenshot1.png');
const IS_WIN = process.platform === 'win32';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Temp copy of the extension with the localhost test match injected (shipped manifest stays muse.ai-only).
const TMP_EXT = fs.mkdtempSync(path.join(os.tmpdir(), 'maa-shot-'));
fs.cpSync(EXT_DIR, TMP_EXT, { recursive: true });
{
  const manPath = path.join(TMP_EXT, 'manifest.json');
  const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
  man.content_scripts[0].matches.push('http://127.0.0.1/*');
  fs.writeFileSync(manPath, JSON.stringify(man, null, 2));
}

const chromePath = process.env.MAA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.env.MAA_PORT || 9500 + Math.floor(Math.random() * 400));
const profileDir = path.join(os.tmpdir(), `maa-shot-${process.pid}-${Date.now().toString(36)}`);
fs.mkdirSync(profileDir, { recursive: true });

let assemblyHtml = '<!doctype html><title>pending</title>';
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/__shot') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(assemblyHtml);
    return;
  }
  const rel = urlPath === '/' ? 'test/fixture.html' : urlPath.replace(/^\/+/, '');
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (e, buf) => {
    if (e) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(buf);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const fixtureUrl = `${base}/test/fixture.html`;

function launchChromeDetached(args) {
  const psq = (s) => s.replace(/'/g, "''");
  const argList = args.map((a) => `'${psq(a)}'`).join(',');
  execFileSync('powershell.exe', ['-NoProfile', '-Command',
    `Start-Process -FilePath '${psq(chromePath)}' -ArgumentList ${argList}`],
    { stdio: 'ignore', timeout: 30000 });
}
launchChromeDetached([
  `--user-data-dir=${profileDir}`,
  `--remote-debugging-port=${PORT}`,
  '--enable-unsafe-extension-debugging',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-features=Translate,MediaRouter,CalculateNativeWinOcclusion,OptimizationHints',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--window-position=-32000,-32000',
  '--window-size=1300,900',
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

let ws = null;
let send = null;
try {
  const info = await cdpEndpoint();
  ws = await connect(info.webSocketDebuggerUrl);
  send = makeSend(ws);

  const loaded = await send('Extensions.loadUnpacked', { path: TMP_EXT });
  const extId = loaded?.id;
  if (!extId) throw new Error('Extensions.loadUnpacked returned no extension id');
  console.log('extensionId:', extId);

  // ---- fixture: let the REAL extension click the REAL fixture cards (generates a real log) ----
  const fx = await send('Target.createTarget', { url: fixtureUrl });
  const { sessionId: fxS } = await send('Target.attachToTarget', { targetId: fx.targetId, flatten: true });
  {
    const dl = Date.now() + 20000;
    while (Date.now() < dl) {
      const r = await send('Runtime.evaluate', { expression: 'JSON.stringify((window.__clicks||[]).map(c=>String(c.n)))', returnByValue: true }, fxS);
      const got = JSON.parse(r?.result?.value || '[]');
      if (got.includes('surface') && got.includes('6')) break; // main sequence done
      await sleep(300);
    }
  }

  // ---- popup tab: real popup page with the real log; then stop further clicking ----
  const pp = await send('Target.createTarget', { url: `chrome-extension://${extId}/popup.html` });
  const { sessionId: ppS } = await send('Target.attachToTarget', { targetId: pp.targetId, flatten: true });
  await sleep(800);
  await send('Runtime.evaluate', { expression: 'chrome.storage.local.set({ enabled: false }); "ok"', returnByValue: true }, ppS);
  await sleep(400);

  // ---- fixture: tidy the stage — keep only a clean showcase card (replica of Muse's approval card) ----
  const inject = `(() => {
    for (const id of ['card8', 'card9', 'surface2', 'lone', 'notif', 'block']) { const el = document.getElementById(id); if (el) el.remove(); }
    document.body.style.maxWidth = '820px';
    const wrap = document.createElement('div'); wrap.id = 'shotwrap';
    wrap.innerHTML =
      '<div class="card" data-testid="hatch-inline-approval-card" style="margin-top:4px"><p style="font-size:15px;margin:0 0 6px">Allow Muse to perform this action on your GitHub account?</p>' +
      '<p style="color:#9a9ba3;font-size:12px;margin:0 0 12px">Your assistant wants to list branches in the repository.</p>' +
      '<div class="row" style="margin:0"><button type="button" class="allow">Allow</button><button type="button" class="deny">Deny</button></div></div>' +
      '<div class="card" data-testid="hatch-inline-approval-card"><p style="font-size:15px;margin:0 0 6px">Allow Muse to perform this action on your GitHub account?</p>' +
      '<p style="color:#9a9ba3;font-size:12px;margin:0 0 12px">Your assistant wants to create or update files in the repository.</p>' +
      '<div class="row" style="margin:0"><button type="button" class="allow">Allow</button><button type="button" class="deny">Deny</button></div></div>' +
      '<div class="card" data-testid="hatch-inline-approval-card"><p style="font-size:15px;margin:0 0 6px">Allow Muse to perform this action on your GitHub account?</p>' +
      '<p style="color:#9a9ba3;font-size:12px;margin:0 0 12px">Your assistant wants to update the file README.md in the repository.</p>' +
      '<div class="row" style="margin:0"><button type="button" class="allow">Allow</button><button type="button" class="deny">Deny</button></div></div>';
    const h = document.querySelector('h2');
    if (h) h.after(wrap); else document.body.prepend(wrap);
    window.scrollTo(0, 0);
    return 'ok';
  })()`;
  await send('Runtime.evaluate', { expression: inject, returnByValue: true }, fxS);
  await sleep(400);
  // Fresh log for the shot: clear it, then re-enable so the popup shows its real ON state
  // and the extension clicks the three showcase cards (marked like real Muse cards ->
  // full, meaningful log context), then stops (per-node once).
  await send('Runtime.evaluate', { expression: 'chrome.storage.local.set({ log: [] }); "ok"', returnByValue: true }, ppS);
  await send('Runtime.evaluate', { expression: 'chrome.storage.local.set({ enabled: true }); "ok"', returnByValue: true }, ppS);
  // Nudge the content script with a DOM mutation so a sweep fires immediately
  // (otherwise we'd wait for the 1s heartbeat), then give it time to click the
  // showcase cards — their log entries carry real, meaningful context text.
  await send('Runtime.evaluate', { expression: 'document.body.appendChild(document.createElement("div")); "ok"', returnByValue: true }, fxS);
  await sleep(1600);

  // Crop the scrollable log viewport to its content (screenshot framing only — the real
  // popup keeps its 220px scroll area; this avoids a half-sliced row at the edge).
  await send('Runtime.evaluate', { expression: '(() => { const lg = document.getElementById("log"); if (lg) lg.style.maxHeight = lg.scrollHeight + "px"; return "ok"; })()', returnByValue: true }, ppS);
  await sleep(250);

  // ---- capture both, at 2x for crispness ----
  async function captureClip(session, expr) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }, session);
    const rect = JSON.parse(r?.result?.value || '{}');
    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 2 },
      captureBeyondViewport: true,
    }, session);
    return shot.data; // base64
  }
  const popupB64 = await captureClip(ppS,
    'JSON.stringify((() => { const r = document.body.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })())');
  const cardB64 = await captureClip(fxS,
    'JSON.stringify((() => { const r = document.getElementById("shotwrap").getBoundingClientRect(); return { x: Math.max(0, r.x - 18), y: Math.max(0, r.y - 18), width: r.width + 36, height: r.height + 36 }; })())');
  console.log('captured: popup', Math.round(popupB64.length / 1024) + 'KB', 'card', Math.round(cardB64.length / 1024) + 'KB');

  // ---- assembly stage (real captures, minimal branding) at exactly 1280x800 ----
  assemblyHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 1280px; height: 800px; overflow: hidden; }
    body { background: radial-gradient(1100px 620px at 78% -10%, #16213a 0%, #0b0d12 55%), #0b0d12;
           color: #e8e8ea; font-family: system-ui, "Segoe UI", sans-serif; }
    .stage { display: flex; gap: 42px; padding: 0 52px; height: 730px; align-items: center; }
    .col { display: flex; flex-direction: column; gap: 14px; }
    .col.card { margin-top: 56px; }
    .cap { font-size: 15px; color: #9aa3b2; letter-spacing: .02em; }
    .cap b { color: #ffd79a; font-weight: 600; }
    .pop img { display: block; width: 440px; border-radius: 14px; box-shadow: 0 18px 60px rgba(0,0,0,.55), 0 0 0 1px #232a38; }
    .card img { display: block; width: 694px; border-radius: 14px; box-shadow: 0 18px 60px rgba(0,0,0,.55), 0 0 0 1px #232a38; }
    .chips { display: flex; gap: 10px; margin-top: 4px; flex-wrap: wrap; }
    .chip { border: 1px solid #2a3242; background: #11151d; color: #aab3c2; font-size: 13px; padding: 7px 13px; border-radius: 999px; }
    .foot { position: absolute; left: 56px; bottom: 34px; right: 56px; display: flex; align-items: center; gap: 12px;
            color: #6f7787; font-size: 14px; }
    .foot .dot { width: 9px; height: 9px; border-radius: 50%; background: #6ee7a0; box-shadow: 0 0 12px #6ee7a0; }
    .foot b { color: #cfd6e4; font-weight: 600; }
  </style></head><body>
    <div class="stage">
      <div class="col pop">
        <div class="cap"><b>Live popup</b> — real click log, counter, on/off, delay</div>
        <img src="data:image/png;base64,${popupB64}">
      </div>
      <div class="col card">
        <div class="cap"><b>Approval requests</b> — clicked automatically (Allow only, never Deny)</div>
        <img src="data:image/png;base64,${cardB64}">
        <div class="chips"><span class="chip">Allow only — never Deny</span><span class="chip">Click log stays on your device</span><span class="chip">6 languages</span></div>
      </div>
    </div>
    <div class="foot"><span class="dot"></span><b>Muse Auto-Allow</b> · auto-clicks Allow on Muse (muse.ai) approvals · runs locally, sends nothing</div>
  </body></html>`;

  const sh = await send('Target.createTarget', { url: `${base}/__shot` });
  const { sessionId: shS } = await send('Target.attachToTarget', { targetId: sh.targetId, flatten: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, shS);
  await sleep(900); // let the images decode
  const full = await send('Page.captureScreenshot', { format: 'png' }, shS);
  fs.writeFileSync(OUT, Buffer.from(full.data, 'base64'));
  const st = fs.statSync(OUT);
  console.log('saved:', OUT, st.size, 'bytes');
} finally {
  try { await send?.('Browser.close'); } catch { /* may be gone */ }
  await sleep(1200);
  let remaining = countMyChrome();
  for (let i = 0; i < 12 && remaining > 0; i++) { killMyChrome(); await sleep(500); remaining = countMyChrome(); }
  if (remaining > 0) console.error(`WARNING: ${remaining} chrome process(es) still reference ${profileDir}`);
  for (let i = 0; i < 6; i++) {
    try { fs.rmSync(profileDir, { recursive: true, force: true }); break; } catch { await sleep(500); }
  }
  try { fs.rmSync(TMP_EXT, { recursive: true, force: true }); } catch { /* ignore */ }
  try { ws?.close(); } catch { /* ignore */ }
  server.close();
}
