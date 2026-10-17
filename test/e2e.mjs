#!/usr/bin/env node
/**
 * e2e.mjs — runtime verification for Muse Auto-Allow on a REAL Chromium.
 *
 * Lane: INSTALLED Chrome (137+) via CDP `Extensions.loadUnpacked`
 * (installed Chrome ignores --load-extension; --enable-unsafe-extension-debugging required).
 * Scratch profile only — never touches the user's real profile.
 * The extension is loaded from a TEMP COPY whose manifest additionally matches
 * http://127.0.0.1/* (the shipped manifest stays muse.ai-only).
 *
 * PRE-PHASE (v1.9.3) — a FRESH INSTALL starts in dry-run (logging-only):
 *  0. storage reports dryRun === true (the installer migration) and the popup renders the
 *     logging-only state (sticky banner + Safety toggle checked); the onboarding consent step
 *     states the default, shows that state, carries the consent line and its one-tap
 *     'Turn on live clicking' writes the explicit dryRun:false; a real approval card driven
 *     while logging-only is NOT clicked and a '-dry' log entry appears instead.
 *
 * Asserts (fixture):
 *  1. path B: classic Allow+Deny pairs clicked (cards 1, 2)
 *  2. path A: [data-testid=hatch-inline-approval-card] card clicked (card 4)
 *  3. path C: collapsed pending card expanded, then its Allow clicked (pending5 -> 5)
 *  4. path D: background surface button clicked, then revealed Allow clicked (surface -> 6)
 *  5. late card (MutationObserver) clicked (card 3)
 *  6. never: lone Allow, "Allow notifications"/"Block", the notification-style card
 *     carrying approval wording (19), Deny buttons, the OWNER-REPORTED connector card (20 —
 *     a user-input surface: nothing inside it is ever clicked, even the pair that renders
 *     within it) and the lone Connect twin
 *  7. muse.ai (logged out): content script injects (documentElement attribute) — WARN-only
 *  8. v1.8.0 connector guard: the refusal is logged ('blocked' with blockedReason 'connector')
 *  9. v1.9.4 YOLO mode (opt-in): default => a keyword-blocked card is NOT clicked (logged
 *     'keyword:delete') and a standing-grant-only pair stays untouched; with yoloMode true
 *     both cards ARE clicked (never Deny). Falsification: a MAA_EXT_DIR mutant without the
 *     bypass -> RED; restore -> GREEN.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
// MAA_EXT_DIR lets a falsification run point the harness at a MUTATED copy of the extension
// (reverse-mutation proof: disable a guard -> the matching checks go RED; restore -> GREEN).
const EXT_DIR = process.env.MAA_EXT_DIR ? path.resolve(process.env.MAA_EXT_DIR) : path.join(ROOT, 'extension');
const IS_WIN = process.platform === 'win32';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(path.join(EXT_DIR, 'manifest.json'))) {
  console.error('e2e: no manifest.json in ' + EXT_DIR);
  process.exit(1);
}

// Temp copy of the extension with the localhost test match injected.
const TMP_EXT = fs.mkdtempSync(path.join(os.tmpdir(), 'maa-ext-'));
fs.cpSync(EXT_DIR, TMP_EXT, { recursive: true });
{
  const manPath = path.join(TMP_EXT, 'manifest.json');
  const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
  man.content_scripts[0].matches.push('http://127.0.0.1/*');
  fs.writeFileSync(manPath, JSON.stringify(man, null, 2));
}

const chromePath = process.env.MAA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.env.MAA_PORT || 9400 + Math.floor(Math.random() * 500));
const profileDir = path.join(os.tmpdir(), `maa-e2e-${process.pid}-${Date.now().toString(36)}`);
fs.mkdirSync(profileDir, { recursive: true });

// ---------- fixture server (project root) ----------
const server = http.createServer((req, res) => {
  let urlPath = '/';
  try { urlPath = decodeURIComponent((req.url || '/').split('?')[0]); } catch { res.writeHead(400); res.end(); return; }
  const rel = urlPath === '/' ? 'test/fixture.html' : urlPath.replace(/^\/+/, '');
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (e, buf) => {
    if (e) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(buf);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const fixtureUrl = `http://127.0.0.1:${server.address().port}/test/fixture.html`;
console.log('fixture:', fixtureUrl);

// ---------- launch installed Chrome (scratch profile) ----------
// Detached via PowerShell Start-Process: on this host the chrome.exe launcher exits
// immediately (code 0) and a Node spawn handle is useless — the browser keeps running
// as its own process tree, so we reap it by scratch-profile path at teardown.
const CHROME_ARGS = [
  `--user-data-dir=${profileDir}`,
  `--remote-debugging-port=${PORT}`,
  '--enable-unsafe-extension-debugging',
  '--no-first-run',
  '--no-default-browser-check',
  // Keep the offscreen window fully active: on Windows, occlusion detection plus
  // background timer throttling froze layout ~5s in, every getBoundingClientRect
  // check returned 0 and all clicking silently stopped mid-test (diagnosed 2026-10-08).
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
let chromeStderr = '';

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

const EXPECTED = ['1', '2', '3', '4', '5', '6', '7', '11', '17', 'pending5', 'surface', 'reviewbar', '18'];
const FORBIDDEN = ['8', '9', '10', '12', '13', '14', '16', '19', 'surface2', 'surface3', 'lone', 'notif', 'plain-review',
  '20', 'lone-connect']; // v1.8.0: the connector card (any button inside) + the lone Connect twin

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

  // ---- PRE-PHASE (v1.9.3): a FRESH INSTALL starts in dry-run (logging-only) --------------
  // The owner-approved first-run safety default: background.js migrate() seeds dryRun:true when
  // the key is absent, so a new user sees exactly what WOULD be clicked before granting live
  // approval authority (the informed-consent mitigation for the Muse ToS §7.6 oversight tension).
  // Nothing has been seeded on this scratch profile yet, so this phase proves it end-to-end:
  //   1. the installer migration reports dryRun === true (storage) and the popup renders the
  //      logging-only state (the sticky banner + the Safety toggle checked);
  //   2. the onboarding consent step states the default plainly, shows the live logging-only
  //      state, carries the consent line, and its one-tap 'Turn on live clicking' writes the
  //      EXPLICIT dryRun:false;
  //   3. a real approval card is driven WHILE logging-only: it is NOT clicked and a '-dry' log
  //      entry appears instead. A live click in this window is a FAILURE (and the log then holds
  //      a real 'allow' entry instead of '-dry' — the fail-open signature, recorded as `leak`).
  // Falsification: revert the migrate() seed in a mutated copy (MAA_EXT_DIR) -> these
  // assertions go RED (no dryRun:true in storage and the card is clicked live); restore -> GREEN.
  const dryPhase = { ok: false };
  let dryStage = 'start';
  try {
    const tp = await send('Target.createTarget', { url: `chrome-extension://${extId}/popup.html` });
    const { sessionId: sp } = await send('Target.attachToTarget', { targetId: tp.targetId, flatten: true });
    const peval = async (expression, awaitPromise) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, ...(awaitPromise ? { awaitPromise: true } : {}) }, sp);
      // Diagnostic-only: do not silently coerce a CDP exception into a success-shaped value.
      if (r?.exceptionDetails) throw new Error('CDP exception: ' + String(r.exceptionDetails.text || 'unknown'));
      return r?.result?.value;
    };
    const readLog = async () => JSON.parse(await peval(`new Promise((res) => chrome.storage.local.get(['log'], (s) => res(JSON.stringify(s.log || []))))`, true) || '[]');

    // Extensions.loadUnpacked can resolve before Chrome has completed initialization of
    // the new extension document. Do not interpret an uninitialized page context as an
    // engine/permission failure. Wait for the actual extension API WITHOUT disabling the
    // first-install dry-run assertion or writing any storage keys here.
    dryStage = 'popup extension API ready';
    const apiDeadline = Date.now() + 15000;
    let apiReady = false;
    while (Date.now() < apiDeadline) {
      try {
        const probe = await send('Runtime.evaluate', {
          expression: "Boolean(globalThis.chrome?.storage?.local && typeof chrome.storage.local.get === 'function')",
          returnByValue: true,
        }, sp);
        if (probe?.result?.value === true) { apiReady = true; break; }
      } catch { /* target may be navigating, retry within bounded deadline */ }
      await sleep(200);
    }
    dryPhase.extensionApiReady = apiReady;
    if (!apiReady) throw new Error('Extension popup API was not ready within 15s');

    // (1) the installer migration + the rendered logging-only state
    let seeded = {};
    const seedDeadline = Date.now() + 10000;
    while (Date.now() < seedDeadline) {
      dryStage = 'seed storage read';
      const raw = await peval(`new Promise((res) => chrome.storage.local.get(['dryRun', 'schemaVersion'], (s) => res(JSON.stringify(s))))`, true);
      dryPhase.seedValueType = typeof raw;
      dryPhase.seedPreview = typeof raw === 'string' ? raw.slice(0,160) : raw === null ? 'null' : Array.isArray(raw) ? 'array' : typeof raw === 'object' ? Object.keys(raw).slice(0,8) : String(raw).slice(0,160);
      seeded = JSON.parse(raw || '{}');
      if (seeded.dryRun === true) break;
      await sleep(250);
    }
    dryPhase.installerSeed = seeded; // fresh install => { dryRun: true, schemaVersion: 2 }
    dryStage = 'popup safety snapshot';
    dryPhase.popup = JSON.parse(await peval(`(() => {
      const band = document.getElementById('dryBand');
      document.getElementById('safetyBtn').click();
      const checked = document.getElementById('dryRun').checked;
      return JSON.stringify({ bannerVisible: !band.hidden, bannerText: band.textContent.trim(), safetyChecked: checked });
    })()`) || '{}');

    // (2) the onboarding consent step (step 2 of 3)
    await peval(`document.getElementById('obPrimary').click()`); // step 1 -> step 2 (dry-run/consent)
    await sleep(250);
    dryStage = 'onboarding consent snapshot';
    dryPhase.onboarding = JSON.parse(await peval(`(() => JSON.stringify({
      onboardShown: !document.getElementById('onboard').hidden,
      title: document.getElementById('obTitle').textContent,
      body: document.getElementById('obBody').textContent,
      stateVisible: !document.getElementById('obDryState').hidden,
      stateText: document.getElementById('obDryState').textContent.trim(),
      consentVisible: !document.getElementById('obConsent').hidden,
      consentText: document.getElementById('obConsent').textContent.trim(),
      primary: document.getElementById('obPrimary').textContent,
    }))()`) || '{}');

    dryStage = 'dry-run real fixture';
    // (3) drive a real approval card WHILE still logging-only
    let dryTid = null;
    let drySid = null;
    let injected = false;
    let dryEntry = null;
    let dryClicks = [];
    let leak = null;
    // target bookkeeping must never abort the phase: a transient CDP timeout here would
    // otherwise lose the evidence collected so far (the falsification run depends on it)
    const safeClose = async (id) => { if (id) { try { await send('Target.closeTarget', { targetId: id }); } catch { /* non-critical */ } } };
    for (let attempt = 0; attempt < 2 && !dryEntry && !dryClicks.length && !leak; attempt++) {
      await safeClose(dryTid);
      let t = null;
      try { t = await send('Target.createTarget', { url: fixtureUrl }); } catch (e) { dryPhase.fixtureError = e.message; break; }
      dryTid = t.targetId;
      try { drySid = (await send('Target.attachToTarget', { targetId: dryTid, flatten: true })).sessionId; } catch (e) { dryPhase.fixtureError = e.message; break; }
      const injDeadline = Date.now() + 12000;
      while (Date.now() < injDeadline) {
        try {
          const ra = await send('Runtime.evaluate', { expression: "document.documentElement.getAttribute('data-muse-auto-allow')", returnByValue: true }, drySid);
          if (ra?.result?.value === '1') { injected = true; break; }
        } catch { /* target may still be booting */ }
        await sleep(250);
      }
      if (!injected) continue; // known CDP injection flake — reload once and retry
      const dryDeadline = Date.now() + 14000;
      while (Date.now() < dryDeadline) {
        const log = await readLog();
        // the fail-open signature: a REAL (non-dry) allow entry while dryRun is stored true
        leak = log.find((e) => e && e.kind === 'allow' && e.dryRun !== true) || null;
        dryEntry = log.find((e) => e && e.dryRun === true && typeof e.kind === 'string' && e.kind.endsWith('-dry')) || null;
        try {
          const rc = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__clicks || [])', returnByValue: true }, drySid);
          dryClicks = JSON.parse(rc?.result?.value || '[]');
        } catch { /* target may still be booting */ }
        if (dryEntry || dryClicks.length || leak) break; // evidence either way — a click/leak is a FAILURE below
        await sleep(400);
      }
    }
    dryPhase.contentScriptInjected = injected;
    dryPhase.logEntry = dryEntry;                                // { kind: 'allow-dry', dryRun: true, … }
    dryPhase.clicksWhileDry = dryClicks.map((c) => String(c.n)); // must stay EMPTY
    dryPhase.leak = leak;                                        // must stay null
    await safeClose(dryTid);

    // (4) the one-tap 'Turn on live clicking' — an EXPLICIT stored choice
    await peval(`document.getElementById('obPrimary').click()`);
    await sleep(400);
    dryStage = 'post-consent storage read';
    const afterTap = JSON.parse(await peval(`new Promise((res) => chrome.storage.local.get(['dryRun'], (s) => res(JSON.stringify({ dryRun: s.dryRun, step: document.getElementById('obStep').textContent }))))`, true) || '{}');
    dryPhase.afterOneTap = afterTap;
    await peval(`document.getElementById('obSkip').click()`); // the wizard stays skippable
    await sleep(300);
    dryPhase.onboardedAfterSkip = JSON.parse(await peval(`new Promise((res) => chrome.storage.local.get(['onboarded'], (s) => res(JSON.stringify({ onboarded: s.onboarded }))))`, true) || '{}');
    try { await send('Target.closeTarget', { targetId: tp.targetId }); } catch { /* non-critical */ }

    dryPhase.ok = seeded.dryRun === true && dryPhase.popup.bannerVisible === true &&
      dryPhase.popup.safetyChecked === true && dryPhase.onboarding.stateVisible === true &&
      dryPhase.onboarding.consentVisible === true && dryPhase.onboarding.onboardShown === true &&
      injected === true && !!dryEntry && dryEntry.dryRun === true && dryClicks.length === 0 && leak === null &&
      afterTap.dryRun === false;
  } catch (e) { dryPhase.errorStage = dryStage; dryPhase.error = e.message; }
  console.log('dry-run pre-phase:', JSON.stringify(dryPhase));
  if (!dryPhase.ok && (dryPhase.leak || (dryPhase.clicksWhileDry || []).length)) {
    console.error('dry-run pre-phase FAILED: a LIVE click leaked while dryRun was stored true. ' +
      'Root cause: the content script applies the v18 settings (dryRun) in a storage callback that ' +
      'lands AFTER its first sweep, so a fresh install / page reload in logging-only mode can click ' +
      'one card before the flag applies. Fix: gate the first sweep on the v18 settings read ' +
      '(content.js boot block). The leak evidence is in dryPhase.leak / dryPhase.clicksWhileDry.');
  }

  // ---- fixture test ----
  const { targetId } = await send('Target.createTarget', { url: fixtureUrl });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

  const deadline = Date.now() + 18000;
  let clicks = [];
  const timeline = [];
  while (Date.now() < deadline) {
    try {
      const r = await send('Runtime.evaluate', { expression: 'JSON.stringify({c:(window.__clicks||[]).length, v:document.visibilityState, p:window.__probe||null})', returnByValue: true }, sessionId);
      const j = JSON.parse(r?.result?.value || '{}');
      timeline.push({ t: Date.now(), c: j.c, v: j.v, ticks: j.p && j.p.ticks });
      const rr = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__clicks || [])', returnByValue: true }, sessionId);
      clicks = JSON.parse(rr?.result?.value || '[]');
    } catch { /* target may still be booting */ }
    const got = clicks.map((c) => String(c.n));
    if (EXPECTED.every((n) => got.includes(n))) break;
    await sleep(400);
  }

  // Phase-1 snapshot is taken AT loop exit — the dedup counts (n7/n11) are asserted
  // inside their 5s windows, so the snapshot must be as early as possible. Phase 2
  // then samples until the open-panel throttle (10s) has certainly elapsed before
  // checking surface2/surface3 and the late forbidden set (F10/F11).
  const got = clicks.map((c) => String(c.n)); // phase-1 snapshot
  const missing = EXPECTED.filter((n) => !got.includes(n));
  const extra = got.filter((n) => !EXPECTED.includes(n));
  // Re-render / cross-path dedup invariant: never re-clicked WITHIN the 5s window
  // (ALLOW_DEDUP_MS). A retry after the window expires is BY DESIGN (phase 2 tracks it as
  // retryFired) — so count clicks inside the first window only, and require any later
  // retry to be genuinely separated by the full window.
  const DEDUP_MS = 5000;
  const timesOf = (n) => clicks.filter((c) => String(c.n) === n).map((c) => Number(c.t) || 0).sort((a, b) => a - b);
  const withinWindow = (n) => { const ts = timesOf(n); if (!ts.length) return 0; return ts.filter((t) => t - ts[0] < DEDUP_MS - 150).length; };
  const lateRetryOk = (n) => { const ts = timesOf(n); if (ts.length < 2) return true; return ts.slice(1).every((t, i) => t - ts[i] >= DEDUP_MS - 150); };
  const dedupSepOk = lateRetryOk('7') && lateRetryOk('11');
  const dupes = got.filter((n, i) => got.indexOf(n) !== i && !(n === '7' || n === '11'));
  const n7count = withinWindow('7'); // re-render dedup: exactly 1 inside the window
  const n11count = withinWindow('11'); // cross-path dedup (row-text card): exactly 1 inside the window
  const idx = (n) => got.indexOf(n);
  const orderOk = idx('pending5') >= 0 && idx('5') > idx('pending5') && idx('surface') >= 0 && idx('6') > idx('surface')
    && idx('reviewbar') >= 0 && idx('18') > idx('reviewbar');

  // Phase 2: wait out the surface throttle, then confirm surface2 was still skipped.
  // Sampled every 1s so the diagnostics show whether the page stayed alive through
  // the idle window (ticks) and when late clicks actually happen.
  const surfaceAt = (clicks.find((c) => c.n === 'surface') || {}).t || 0;
  const waitUntil = surfaceAt + 12000; // > worst-case first-eligible sweep (10s throttle + 1s heartbeat)
  const timeline2 = [];
  while (Date.now() < waitUntil) {
    try {
      const r2 = await send('Runtime.evaluate', { expression: 'JSON.stringify({c:(window.__clicks||[]).length, v:document.visibilityState, p:window.__probe||null})', returnByValue: true }, sessionId);
      const j2 = JSON.parse(r2?.result?.value || '{}');
      timeline2.push({ t: Date.now(), c: j2.c, v: j2.v, ticks: j2.p && j2.p.ticks, last: j2.p && j2.p.last });
    } catch { /* keep waiting */ }
    await sleep(1000);
  }
  let clicksFinal = clicks;
  try {
    const rr3 = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__clicks || [])', returnByValue: true }, sessionId);
    clicksFinal = JSON.parse(rr3?.result?.value || '[]');
  } catch { /* keep phase-1 snapshot */ }
  const gotFinal = clicksFinal.map((c) => String(c.n));
  const surface2Hit = gotFinal.includes('surface2');
  const lateClicks = gotFinal.slice(got.length); // appended clicks after the phase-1 snapshot
  const retryFired = gotFinal.filter((n) => n === '7').length >= 2; // dedup window expired -> legitimate retry
  const denyCount = clicksFinal.filter((c) => c.deny).length; // from the FINAL snapshot (late denies must fail too)
  const forbiddenHit = FORBIDDEN.filter((n) => gotFinal.includes(n)); // late clicks cannot slip past (F10)

  // ---- stats aggregates (v1.3): day / topic counters must be recorded in storage ----
  // Read back through the popup page — an extension context where chrome.storage works.
  const statsCheck = { ok: false };
  try {
    const t3 = await send('Target.createTarget', { url: `chrome-extension://${extId}/popup.html` });
    const { sessionId: s3 } = await send('Target.attachToTarget', { targetId: t3.targetId, flatten: true });
    await sleep(900); // let the click queue flush
    const r = await send('Runtime.evaluate', {
      expression: `new Promise((res) => chrome.storage.local.get(['stats','clickCount','log'], (s) => res(JSON.stringify({ stats: s.stats || null, clickCount: s.clickCount || 0, logLen: (s.log || []).length, i18nFound: chrome.i18n.getMessage('museTabsFound', ['3']) }))))`,
      returnByValue: true, awaitPromise: true,
    }, s3);
    const j = JSON.parse(r?.result?.value || '{}');
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    // known flake class: a run crossing local midnight can mismatch byDay[today]
    const today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
    const byDay = (j.stats && j.stats.byDay) || {};
    const byTopic = (j.stats && j.stats.byTopic) || {};
    Object.assign(statsCheck, {
      today,
      todayCount: byDay[today] || 0,
      topicTestRepo: byTopic['test-repo'] || 0,
      topicCount: Object.keys(byTopic).length,
      clickCount: j.clickCount,
      logLen: j.logLen,
      i18nFound: j.i18nFound,
      ok: (byDay[today] || 0) >= 10 && (byTopic['test-repo'] || 0) >= 1 && j.clickCount >= 10 && j.logLen >= 10 && String(j.i18nFound || '').includes('3'),
    });
  } catch (e) { statsCheck.error = e.message; }

  // ---- v1.5.0 encrypted-at-rest + inheritance stamp (redteam v4 / V4-6) ----
  // A fresh popup context proves the newest entry is stored encrypted (ctx.iv/ct, no
  // plaintext context), schemaVersion is stamped, the key is 32 bytes, and the stored
  // key really decrypts the entry (round-trip).
  const encCheck = { ok: false };
  try {
    const t5 = await send('Target.createTarget', { url: `chrome-extension://${extId}/popup.html` });
    const { sessionId: s5 } = await send('Target.attachToTarget', { targetId: t5.targetId, flatten: true });
    await sleep(900);
    const re = await send('Runtime.evaluate', {
      expression: `(async () => {
        const s = await chrome.storage.local.get(['log', 'schemaVersion', 'cryptKeyRaw']);
        const e0 = (s.log || [])[0];
        const out = { sv: s.schemaVersion, hasCtx: !!(e0 && e0.ctx && e0.ctx.iv && e0.ctx.ct), hasPlain: !!(e0 && typeof e0.context === 'string'), keyLen: (s.cryptKeyRaw || '').length };
        if (out.hasCtx) {
          const b = (x) => Uint8Array.from(atob(x), (c) => c.charCodeAt(0));
          const k = await crypto.subtle.importKey('raw', b(s.cryptKeyRaw), 'AES-GCM', false, ['decrypt']);
          const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b(e0.ctx.iv) }, k, b(e0.ctx.ct));
          out.plainLen = new TextDecoder().decode(pt).length;
        }
        return JSON.stringify(out);
      })()`,
      returnByValue: true, awaitPromise: true,
    }, s5);
    const je = JSON.parse(re?.result?.value || '{}');
    Object.assign(encCheck, je, {
      ok: je.sv === 2 && je.hasCtx === true && je.hasPlain === false && je.keyLen === 44 && (je.plainLen || 0) > 0,
    });
  } catch (e) { encCheck.error = e.message; }

  // ---- v1.8.0 connector guard (owner-reported): the refusal is logged ----
  // The connector card (20) is a user-input surface: nothing inside it may be clicked, and
  // the engine must record WHY ('blocked' / blockedReason 'connector').
  const connectorCheck = { ok: false };
  try {
    const t6 = await send('Target.createTarget', { url: `chrome-extension://${extId}/popup.html` });
    const { sessionId: s6 } = await send('Target.attachToTarget', { targetId: t6.targetId, flatten: true });
    await sleep(800);
    const r6 = await send('Runtime.evaluate', {
      expression: `new Promise((res) => chrome.storage.local.get(['log'], (s) => res(JSON.stringify({
        blockedConnector: ((s.log || []).filter((e) => e && e.kind === 'blocked' && e.blockedReason === 'connector')).length,
        blockedAny: ((s.log || []).filter((e) => e && e.kind === 'blocked')).length,
      }))))`,
      returnByValue: true, awaitPromise: true,
    }, s6);
    const j6 = JSON.parse(r6?.result?.value || '{}');
    Object.assign(connectorCheck, { blockedConnector: j6.blockedConnector, blockedAny: j6.blockedAny, ok: (j6.blockedConnector || 0) >= 1 });
  } catch (e) { connectorCheck.error = e.message; }

  // ---- v1.9.4 YOLO mode (explicit opt-in): keyword blocks bypassed + standing grants clicked ----
  // A dedicated fixture (test/fixture-yolo.html) carries the two shapes:
  //   y1 — a card whose text contains a SEED BLOCK KEYWORD ('delete'): default => blocked
  //        (logged 'keyword:delete'), never clicked; YOLO on => clicked.
  //   y2 — a standing-grant-only pair ("Allow for this site" + Deny): default => the label is
  //        not recognized (silent, left to the user); YOLO on => clicked.
  // Falsification: remove the yoloMode bypass in a mutated copy (MAA_EXT_DIR) -> this phase
  // goes RED; restore -> GREEN.
  const yoloCheck = { ok: false };
  try {
    const ty = await send('Target.createTarget', { url: `chrome-extension://${extId}/popup.html` });
    const { sessionId: sy } = await send('Target.attachToTarget', { targetId: ty.targetId, flatten: true });
    const yeval = async (expression, awaitPromise) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, ...(awaitPromise ? { awaitPromise: true } : {}) }, sy);
      return r?.result?.value;
    };
    const yoloUrl = fixtureUrl.replace(/fixture\.html$/, 'fixture-yolo.html');
    const ylog = async () => JSON.parse(await yeval(`new Promise((res) => chrome.storage.local.get(['log'], (s) => res(JSON.stringify(s.log || []))))`, true) || '[]');
    const countDeleteBlocks = (log) => log.filter((e) => e && e.kind === 'blocked' && e.blockedReason === 'keyword:delete').length;

    // (A) default: yoloMode OFF — the delete card is blocked (logged) and nothing is clicked
    await yeval(`new Promise((res) => chrome.storage.local.set({ dryRun: false, yoloMode: false }, () => res('ok')))`, true);
    let yA = null, yAs = null, aClicks = [], blockedA = 0;
    const blockedBefore = countDeleteBlocks(await ylog());
    for (let attempt = 0; attempt < 2 && !aClicks.length && blockedA <= blockedBefore; attempt++) {
      if (yA) { try { await send('Target.closeTarget', { targetId: yA }); } catch { /* non-critical */ } }
      const t = await send('Target.createTarget', { url: yoloUrl });
      yA = t.targetId;
      yAs = (await send('Target.attachToTarget', { targetId: yA, flatten: true })).sessionId;
      const injDeadline = Date.now() + 12000;
      let injected = false;
      while (Date.now() < injDeadline) {
        try {
          const ra = await send('Runtime.evaluate', { expression: "document.documentElement.getAttribute('data-muse-auto-allow')", returnByValue: true }, yAs);
          if (ra?.result?.value === '1') { injected = true; break; }
        } catch { /* target may still be booting */ }
        await sleep(250);
      }
      if (!injected) continue; // known CDP injection flake — reload once and retry
      const dl = Date.now() + 10000;
      while (Date.now() < dl) {
        blockedA = countDeleteBlocks(await ylog());
        try {
          const rc = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__clicks || [])', returnByValue: true }, yAs);
          aClicks = JSON.parse(rc?.result?.value || '[]');
        } catch { /* target may still be booting */ }
        if (blockedA > blockedBefore || aClicks.length) break;
        await sleep(400);
      }
    }
    if (yA) { try { await send('Target.closeTarget', { targetId: yA }); } catch { /* non-critical */ } }

    // (B) YOLO ON: both cards are clicked (a fresh page reads the setting at boot)
    await yeval(`new Promise((res) => chrome.storage.local.set({ yoloMode: true }, () => res('ok')))`, true);
    const tB = await send('Target.createTarget', { url: yoloUrl });
    const yBs = (await send('Target.attachToTarget', { targetId: tB.targetId, flatten: true })).sessionId;
    let bClicks = [];
    const bDeadline = Date.now() + 14000;
    while (Date.now() < bDeadline) {
      try {
        const rc = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__clicks || [])', returnByValue: true }, yBs);
        bClicks = JSON.parse(rc?.result?.value || '[]');
      } catch { /* target may still be booting */ }
      if (bClicks.some((c) => String(c.n) === 'y1') && bClicks.some((c) => String(c.n) === 'y2')) break;
      await sleep(400);
    }
    const blockedB = countDeleteBlocks(await ylog());
    try { await send('Target.closeTarget', { targetId: tB.targetId }); } catch { /* non-critical */ }

    // restore the default so nothing downstream sees YOLO on
    await yeval(`new Promise((res) => chrome.storage.local.set({ yoloMode: false }, () => res('ok')))`, true);
    try { await send('Target.closeTarget', { targetId: ty.targetId }); } catch { /* non-critical */ }

    const aGot = aClicks.map((c) => String(c.n));
    const bGot = bClicks.map((c) => String(c.n));
    Object.assign(yoloCheck, {
      aClicks: aGot, bClicks: bGot, blockedBefore, blockedA, blockedB,
      aDeny: aClicks.filter((c) => c.deny).length, bDeny: bClicks.filter((c) => c.deny).length,
      ok: aGot.length === 0 && blockedA > blockedBefore &&
          bGot.includes('y1') && bGot.includes('y2') && blockedB === blockedA &&
          bClicks.filter((c) => c.deny).length === 0,
    });
  } catch (e) { yoloCheck.error = e.message; }
  console.log('yolo-mode phase:', JSON.stringify(yoloCheck));

  // ---- stats.html renders (v1.3): KPI + bars + topics with the recorded data ----
  const statsPage = { ok: false };
  try {
    const t4 = await send('Target.createTarget', { url: `chrome-extension://${extId}/stats.html` });
    const { sessionId: s4 } = await send('Target.attachToTarget', { targetId: t4.targetId, flatten: true });
    await sleep(900);
    const r4 = await send('Runtime.evaluate', {
      expression: `JSON.stringify({ total: (document.getElementById('kTotal')||{}).textContent, today: (document.getElementById('kToday')||{}).textContent, bars: document.querySelectorAll('#chart rect.bar').length, topics: document.querySelectorAll('#topics .topic').length, cap: (document.getElementById('ccap')||{}).textContent })`,
      returnByValue: true,
    }, s4);
    const j4 = JSON.parse(r4?.result?.value || '{}');
    Object.assign(statsPage, {
      ok: Number(j4.total) >= 10 && Number(j4.today) >= 1 && j4.bars >= 10 && j4.topics >= 1 && !!j4.cap,
      total: j4.total, today: j4.today, bars: j4.bars, topics: j4.topics, cap: j4.cap,
    });
  } catch (e) { statsPage.error = e.message; }

  // ---- Web Locks availability (V3-2 caveat closure) ----
  // The content script serializes its storage RMW with navigator.locks; probe the
  // fixture document (main-world proxy for the content script's isolated world — same
  // document, origin and WebIDL bindings).
  let locksProbe = null;
  try {
    const rl = await send('Runtime.evaluate', { expression: "typeof navigator.locks !== 'undefined' && typeof navigator.locks.request === 'function'", returnByValue: true }, sessionId);
    locksProbe = rl?.result?.value === true;
  } catch { /* leave null */ }

  // ---- muse.ai smoke (logged out; WARN-only if the network is blocked) ----
  let museAttr = null;
  try {
    const t2 = await send('Target.createTarget', { url: 'https://muse.ai/' });
    const { sessionId: s2 } = await send('Target.attachToTarget', { targetId: t2.targetId, flatten: true });
    const dl2 = Date.now() + 15000;
    while (Date.now() < dl2) {
      try {
        const r = await send('Runtime.evaluate', { expression: "document.documentElement.getAttribute('data-muse-auto-allow')", returnByValue: true }, s2);
        if (r?.result?.value === '1') { museAttr = true; break; }
      } catch { /* keep waiting */ }
      await sleep(500);
    }
    if (museAttr === null) museAttr = false;
  } catch (e) {
    museAttr = 'error: ' + e.message;
  }

  const pass = missing.length === 0 && extra.length === 0 && dupes.length === 0 && denyCount === 0 && orderOk && dedupSepOk
    && forbiddenHit.length === 0 && n7count === 1 && n11count === 1 && !surface2Hit && statsCheck.ok && statsPage.ok
    && encCheck.ok && connectorCheck.ok && yoloCheck.ok === true && locksProbe === true && dryPhase.ok === true;
  Object.assign(results, {
    ok: pass,
    extId,
    fixtureUrl,
    dryPhase,
    clicked: got,
    missing,
    extra,
    forbiddenHit,
    dupes,
    denyCount,
    n7count,
    n11count,
    orderOk,
    dedupSepOk,
    museAttr,
    surface2Hit,
    lateClicks,
    retryFired,
    statsCheck,
    encCheck,
    connectorCheck,
    yoloCheck,
    statsPage,
    locksProbe,
    timeline: timeline.slice(-45),
    timeline2: timeline2.slice(-30),
    raw: clicks,
  });
} catch (e) {
  results.error = e.message;
  results.chromeStderr = chromeStderr.slice(0, 800);
} finally {
  try { await send?.('Browser.close'); } catch { /* may be gone */ }
  await sleep(1200); // let the browser exit cleanly before reaping
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
