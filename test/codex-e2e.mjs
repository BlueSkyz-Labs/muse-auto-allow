#!/usr/bin/env node
/**
 * codex-e2e.mjs — runtime verification for the v1.10.0 Codex (ChatGPT) engine on a REAL Chromium.
 *
 * Lane: INSTALLED Chrome (137+) via CDP `Extensions.loadUnpacked`, scratch profile only.
 * The extension is loaded from a TEMP COPY whose manifest additionally matches
 * http://127.0.0.1/* — injected into the CODEX content_scripts entry ONLY (the muse
 * entry is NOT widened), so the fixture can only ever be driven by codex.js. The test
 * also asserts that isolation on the page (no data-muse-auto-allow attribute).
 *
 * Phases:
 *  OFF  (fresh install, codexEnabled absent/seeded false): the fixture is a page FULL of
 *       approval-shaped pairs — the engine stays completely dormant: zero clicks, zero
 *       log entries (the feature switch is the gate, not the injection).
 *  DRY  (codexEnabled turned on THROUGH THE POPUP SWITCH; dryRun still true from the
 *       v1.9.3 fresh-install default): no clicks; '-dry' codex entries appear; no live
 *       codex entry.
 *  LIVE (dryRun:false): the expected set is clicked — pair paths, expand path, review-bar
 *       path, dedup (one click per element / fingerprint / scope) — and the FORBIDDEN set
 *       (lone affirmative, disabled/split/anchor negative, consent wording, auth/connector
 *       container, standing-grant-only pair, keyword-blocked card, deny-only, generic
 *       Review) is never touched; never a deny.
 *  YOLO (explicit opt-in): the standing-grant pair and the keyword card ARE clicked; the
 *       consent/auth/lone forbiddens still hold; still never a deny.
 *  Then: log kinds + blocked reasons, stats byTopic ('chatgpt.com'), and the at-rest
 *  encryption of the newest codex entry are asserted through an extension page.
 *
 * Falsification (recorded in docs/CODEX.md): a mutated copy without the `codexEnabled`
 * gate (MAA_EXT_DIR) turns the OFF phase RED; pristine -> GREEN.
 *
 * Usage: node test/codex-e2e.mjs   (Windows: launches Chrome via PowerShell Start-Process)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
// MAA_EXT_DIR lets a falsification run point the harness at a MUTATED copy of the extension.
const EXT_DIR = process.env.MAA_EXT_DIR ? path.resolve(process.env.MAA_EXT_DIR) : path.join(ROOT, 'extension');
const IS_WIN = process.platform === 'win32';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(path.join(EXT_DIR, 'manifest.json'))) {
  console.error('codex-e2e: no manifest.json in ' + EXT_DIR);
  process.exit(1);
}

// Temp copy of the extension with the localhost test match injected into the CODEX entry only.
const TMP_EXT = fs.mkdtempSync(path.join(os.tmpdir(), 'maa-codex-ext-'));
fs.cpSync(EXT_DIR, TMP_EXT, { recursive: true });
{
  const manPath = path.join(TMP_EXT, 'manifest.json');
  const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
  const entry = (man.content_scripts || []).find((e) => (e.js || []).indexOf('codex.js') !== -1);
  if (!entry) { console.error('codex-e2e: the manifest has no codex.js content_scripts entry'); process.exit(1); }
  entry.matches.push('http://127.0.0.1/*');
  fs.writeFileSync(manPath, JSON.stringify(man, null, 2));
}

const chromePath = process.env.MAA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.env.MAA_PORT || 9900 + Math.floor(Math.random() * 400));
const profileDir = path.join(os.tmpdir(), `maa-codex-e2e-${process.pid}-${Date.now().toString(36)}`);
fs.mkdirSync(profileDir, { recursive: true });

// ---------- fixture server (project root) ----------
const server = http.createServer((req, res) => {
  let urlPath = '/';
  try { urlPath = decodeURIComponent((req.url || '/').split('?')[0]); } catch { res.writeHead(400); res.end(); return; }
  const rel = urlPath === '/' ? 'test/fixture-codex.html' : urlPath.replace(/^\/+/, '');
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (e, buf) => {
    if (e) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(buf);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const fixtureUrl = `http://127.0.0.1:${server.address().port}/test/fixture-codex.html`;
console.log('fixture:', fixtureUrl);

// ---------- launch installed Chrome (scratch profile) ----------
const CHROME_ARGS = [
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
  '--window-size=1100,800',
  'about:blank',
];
function launchChromeDetached(args) {
  const psq = (s) => s.replace(/'/g, "''");
  const argList = args.map((a) => `'${psq(a)}'`).join(',');
  execFileSync('powershell.exe', ['-NoProfile', '-Command',
    `Start-Process -FilePath '${psq(chromePath)}' -ArgumentList ${argList}`],
    { stdio: 'ignore', timeout: 30000 });
}
launchChromeDetached(CHROME_ARGS);

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

// ---------- teardown: reap only OUR chrome (matched by scratch profile path) ----------
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

const EXPECTED_LIVE = ['c1', 'c1t', 'c5', 'c6', 'cnow', 'c3pending', 'c3', 'cbar', 'cbar2', 'c7'];
const FORBIDDEN_ALL = ['lone', 'cdis', 'csplit', 'canchor', 'cnotif', 'cauth', 'standing', 'standing-deny',
  'kw', 'kw-deny', 'denyonly', 'plainreview', 'c1t-standing', 'c1t-deny',
  'cbearer', 'capikey', 'clogin']; // v1.18.0 (CX-02): reworded auth surfaces stay forbidden
const DEDUP_MS = 5000;

let ws = null;
let send = null;
const results = { ok: false };
try {
  const info = await cdpEndpoint();
  ws = await connect(info.webSocketDebuggerUrl);
  send = makeSend(ws);

  const loaded = await send('Extensions.loadUnpacked', { path: TMP_EXT });
  const extId = loaded?.id;
  if (!extId) throw new Error('Extensions.loadUnpacked returned no extension id');
  console.log('extensionId:', extId);

  // ---- extension-page session (storage reads/writes; the popup IS the control surface) ----
  const popupUrl = `chrome-extension://${extId}/popup.html`;
  const tp = await send('Target.createTarget', { url: popupUrl });
  const { sessionId: psid } = await send('Target.attachToTarget', { targetId: tp.targetId, flatten: true });
  const peval = async (expression, awaitPromise) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, ...(awaitPromise ? { awaitPromise: true } : {}) }, psid);
    if (r?.exceptionDetails) throw new Error('CDP exception: ' + String(r.exceptionDetails.text || 'unknown'));
    return r?.result?.value;
  };
  const apiDeadline = Date.now() + 15000;
  let apiReady = false;
  while (Date.now() < apiDeadline) {
    try {
      const probe = await send('Runtime.evaluate', {
        expression: "Boolean(globalThis.chrome?.storage?.local && typeof chrome.storage.local.get === 'function')",
        returnByValue: true,
      }, psid);
      if (probe?.result?.value === true) { apiReady = true; break; }
    } catch { /* navigating */ }
    await sleep(200);
  }
  if (!apiReady) throw new Error('extension page API was not ready within 15s');
  const readStorage = async (keys) => JSON.parse(await peval(`new Promise((res) => chrome.storage.local.get(${JSON.stringify(keys)}, (s) => res(JSON.stringify(s))))`, true) || '{}');
  const writeStorage = async (obj) => peval(`new Promise((res) => chrome.storage.local.set(${JSON.stringify(obj)}, () => res('ok')))`, true);
  const readLog = async () => (await readStorage(['log'])).log || [];

  // open a fixture page, wait for the codex attribute, return a small controller
  const openFixture = async () => {
    const t = await send('Target.createTarget', { url: fixtureUrl });
    const sid = (await send('Target.attachToTarget', { targetId: t.targetId, flatten: true })).sessionId;
    let injected = false;
    const dl = Date.now() + 12000;
    while (Date.now() < dl) {
      try {
        const r = await send('Runtime.evaluate', { expression: "document.documentElement.getAttribute('data-codex-auto-allow')", returnByValue: true }, sid);
        if (r?.result?.value === '1') { injected = true; break; }
      } catch { /* booting */ }
      await sleep(250);
    }
    const readClicks = async () => {
      try {
        const r = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__clicks || [])', returnByValue: true }, sid);
        return JSON.parse(r?.result?.value || '[]');
      } catch { return []; }
    };
    const readMuseAttr = async () => {
      try {
        const r = await send('Runtime.evaluate', { expression: "document.documentElement.getAttribute('data-muse-auto-allow')", returnByValue: true }, sid);
        return r?.result?.value || null;
      } catch { return null; }
    };
    const close = async () => { try { await send('Target.closeTarget', { targetId: t.targetId }); } catch { /* gone */ } };
    return { targetId: t.targetId, sid, injected, readClicks, readMuseAttr, close };
  };

  // ---- seed sanity: the fresh-install migration already ran ----
  const seed = await readStorage(['dryRun', 'schemaVersion', 'codexEnabled', 'log']);
  console.log('seed:', JSON.stringify(seed));

  // ==== PHASE 1 — OFF (feature switch off => completely dormant) ========================
  const offPhase = { ok: false };
  {
    const page = await openFixture();
    offPhase.injected = page.injected;
    offPhase.museAttr = await page.readMuseAttr(); // must NOT be '1' (codex entry only widened)
    await sleep(9000);
    const clicks = await page.readClicks();
    const log = await readLog();
    offPhase.clicks = clicks.map((c) => String(c.n));
    offPhase.logLen = log.length;
    offPhase.codexKinds = log.filter((e) => e && typeof e.kind === 'string' && e.kind.indexOf('codex') === 0).length;
    offPhase.ok = page.injected === true && offPhase.museAttr !== '1' && offPhase.clicks.length === 0 && offPhase.logLen === 0;
    await page.close();
  }
  console.log('OFF phase:', JSON.stringify(offPhase));

  // ==== PHASE 2 — DRY (turned on THROUGH THE POPUP SWITCH; still logging-only) ==========
  const dryPhase = { ok: false };
  {
    // turn the feature on through its own popup switch (the user's control path)
    const popupApplied = await peval(`(() => { const cb = document.getElementById('codexEnabled'); if (!cb) return 'no-switch'; cb.click(); return cb.checked ? 'checked' : 'unchecked'; })()`);
    await sleep(500);
    const store = await readStorage(['codexEnabled', 'dryRun']);
    dryPhase.popupSwitch = { popupApplied, stored: store.codexEnabled, dryRun: store.dryRun };
    const page = await openFixture();
    let dryEntry = null;
    const dl = Date.now() + 15000;
    while (Date.now() < dl) {
      const log = await readLog();
      dryEntry = log.find((e) => e && typeof e.kind === 'string' && e.kind.indexOf('codex') === 0 && e.dryRun === true) || null;
      if (dryEntry) break;
      await sleep(400);
    }
    await sleep(1500); // give the engine time to (wrongly) manifest a live click
    const clicks = await page.readClicks();
    const log = await readLog();
    dryPhase.clicksWhileDry = clicks.map((c) => String(c.n));
    dryPhase.dryEntryKind = dryEntry ? dryEntry.kind : null;
    dryPhase.liveEntriesLeaked = log.filter((e) => e && e.kind === 'codex-allow' && e.dryRun !== true).length;
    dryPhase.ok = dryPhase.popupSwitch.popupApplied === 'checked' && store.codexEnabled === true && store.dryRun === true &&
      !!dryEntry && dryEntry.dryRun === true && dryPhase.clicksWhileDry.length === 0 && dryPhase.liveEntriesLeaked === 0;
    await page.close();
  }
  console.log('DRY phase:', JSON.stringify(dryPhase));

  // ==== PHASE 3 — LIVE (dryRun off): expected clicked, forbidden untouched ==============
  await writeStorage({ dryRun: false, minDelayMs: 60, codexEnabled: true });
  const livePhase = { ok: false };
  {
    const page = await openFixture();
    let clicks = [];
    const dl = Date.now() + 22000;
    while (Date.now() < dl) {
      clicks = await page.readClicks();
      const got = clicks.map((c) => String(c.n));
      if (EXPECTED_LIVE.every((n) => got.includes(n))) break;
      await sleep(350);
    }
    // wait out the dedup window (+ margin) for late clicks before the final snapshot
    await sleep(DEDUP_MS + 2500);
    const final = await page.readClicks();
    const got = final.map((c) => String(c.n));
    const missing = EXPECTED_LIVE.filter((n) => !got.includes(n));
    const extra = got.filter((n) => !EXPECTED_LIVE.includes(n));
    // the FULL forbidden set is forbidden in the LIVE phase (standing/keyword cards are
    // expected ONLY in the YOLO phase)
    const forbiddenHit = FORBIDDEN_ALL.filter((n) => got.includes(n));
    const denyCount = final.filter((c) => c.deny).length;
    const timesOf = (n) => final.filter((c) => String(c.n) === n).map((c) => Number(c.t) || 0).sort((a, b) => a - b);
    const withinWindow = (n) => { const ts = timesOf(n); if (!ts.length) return 0; return ts.filter((t) => t - ts[0] < DEDUP_MS - 150).length; };
    const c7count = withinWindow('c7');
    const idx = (n) => got.indexOf(n);
    const orderOk = idx('c3pending') >= 0 && idx('c3') > idx('c3pending') && idx('cbar') >= 0 && idx('cbar2') > idx('cbar');
    Object.assign(livePhase, { missing, extra, forbiddenHit, denyCount, c7count, orderOk, clicked: got });
    livePhase.ok = missing.length === 0 && extra.length === 0 && forbiddenHit.length === 0 && denyCount === 0 && c7count === 1 && orderOk;
    await page.close();
  }
  console.log('LIVE phase:', JSON.stringify(livePhase));

  // ==== PHASE 4 — YOLO (explicit opt-in: standing + keyword cards clicked; rails hold) ==
  const yoloPhase = { ok: false };
  {
    await writeStorage({ yoloMode: true });
    const page = await openFixture();
    let clicks = [];
    const dl = Date.now() + 20000;
    while (Date.now() < dl) {
      clicks = await page.readClicks();
      const got = clicks.map((c) => String(c.n));
      if (got.includes('standing') && got.includes('kw')) break;
      await sleep(350);
    }
    await sleep(2500);
    const final = await page.readClicks();
    const got = final.map((c) => String(c.n));
    // under YOLO these must STILL never be clicked: the consent card, the auth container,
    // the lone affirmative, the trio's standing option (ranking prefers the one-shot),
    // and any deny
    const stillForbidden = ['cnotif', 'cauth', 'lone', 'c1t-standing', 'c1t-deny', 'standing-deny', 'kw-deny'].filter((n) => got.includes(n));
    const denyCount = final.filter((c) => c.deny).length;
    Object.assign(yoloPhase, { clicked: got, stillForbidden, denyCount, standing: got.includes('standing'), kw: got.includes('kw') });
    yoloPhase.ok = yoloPhase.standing && yoloPhase.kw && stillForbidden.length === 0 && denyCount === 0;
    await page.close();
    await writeStorage({ yoloMode: false }); // restore the default
  }
  console.log('YOLO phase:', JSON.stringify(yoloPhase));

  // ==== store contract: log kinds + blocked reasons + stats + encryption ================
  const storeCheck = { ok: false };
  try {
    await sleep(900); // let the click queue flush
    const s = await readStorage(['log', 'stats', 'clickCount', 'digestCounters', 'cryptKeyRaw']);
    const log = Array.isArray(s.log) ? s.log : [];
    const codexAllow = log.filter((e) => e && e.kind === 'codex-allow');
    const blockedConnector = log.filter((e) => e && e.kind === 'blocked' && e.blockedReason === 'connector').length;
    const blockedKeyword = log.filter((e) => e && e.kind === 'blocked' && String(e.blockedReason) === 'keyword:delete').length;
    const byTopic = (s.stats && s.stats.byTopic) || {};
    const e0 = codexAllow[0] || null;
    let roundTrip = null;
    if (e0 && e0.ctx && e0.ctx.iv && e0.ctx.ct && s.cryptKeyRaw) {
      try {
        const b = (x) => Uint8Array.from(atob(x), (c) => c.charCodeAt(0));
        const k = await crypto.subtle.importKey('raw', b(s.cryptKeyRaw), 'AES-GCM', false, ['decrypt']);
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b(e0.ctx.iv) }, k, b(e0.ctx.ct));
        roundTrip = new TextDecoder().decode(pt);
      } catch { roundTrip = null; }
    }
    Object.assign(storeCheck, {
      codexAllow: codexAllow.length,
      codexAllowPlaintext: codexAllow.filter((e) => typeof e.context === 'string').length,
      blockedConnector, blockedKeyword,
      topic: byTopic['chatgpt.com'] || 0,
      clickCount: Number(s.clickCount) || 0,
      digestClicks: Number((s.digestCounters || {}).clicks) || 0,
      encOk: !!(e0 && e0.ctx && e0.ctx.iv && e0.ctx.ct && e0.context === undefined),
      roundTripOk: typeof roundTrip === 'string' && roundTrip.length > 0,
    });
    storeCheck.ok = storeCheck.codexAllow >= 8 && storeCheck.codexAllowPlaintext === 0 &&
      blockedConnector >= 1 && blockedKeyword >= 1 && storeCheck.topic >= 8 &&
      storeCheck.clickCount >= 8 && storeCheck.digestClicks >= 8 && storeCheck.encOk && storeCheck.roundTripOk;
  } catch (e) { storeCheck.error = e.message; }
  console.log('store contract:', JSON.stringify(storeCheck));

  try { await send('Target.closeTarget', { targetId: tp.targetId }); } catch { /* non-critical */ }

  const pass = offPhase.ok === true && dryPhase.ok === true && livePhase.ok === true && yoloPhase.ok === true && storeCheck.ok === true;
  Object.assign(results, { ok: pass, extId, fixtureUrl, seed, offPhase, dryPhase, livePhase, yoloPhase, storeCheck });
} catch (e) {
  results.error = e.message;
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

console.log(JSON.stringify(results, null, 2));
process.exit(results.ok ? 0 : 2);
