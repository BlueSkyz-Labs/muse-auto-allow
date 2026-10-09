#!/usr/bin/env node
/**
 * followup-e2e.mjs — runtime verification for the v1.6.0 'Auto follow-up' engine
 * on a REAL Chromium. Same CDP lane as test/e2e.mjs: installed Chrome (137+) via
 * `Extensions.loadUnpacked`, scratch profile only (NEVER the user's real profile),
 * detached launch + profile-path teardown. The extension is loaded from a TEMP COPY
 * whose manifest additionally matches http://127.0.0.1/* (and grants it as a host
 * permission so the harness can find the fixture tab) — the shipped manifest stays
 * muse.ai-only.
 *
 * Fixture: test/followup-fixture.html — switcheable status ('is working'/'Connected'),
 * a composer (placeholder 'Message') + send recorder (window.__sent), and an
 * approval-card block for the guard case.
 *
 * Cases:
 *   0.  pre-flight: 6 locales key-identical; every popup.html i18n key exists (en)
 *   0b. popup UI smoke: section renders, send-now enabled state, presets + custom
 *   a.  nothing sent while 'is working'
 *   b0. idle observed but followupIdleMs not elapsed => nothing sent (live config)
 *   b.  after lowering the idle wait, the send fires with the EXACT seeded prompt,
 *       via the send button, React-safe input event fired, composer cleared,
 *       lastSentAt recorded (verified send)
 *   c.  no second send within followupCooldownMs; one fires only after the cooldown
 *   d.  followupEnabled=false => nothing sent
 *   e.  approval card present => idle send skipped (absolute priority); clearing it resumes
 *   f.  manual 'followup-send-now' skips the idle wait (fires while 'is working') and
 *       falls back to Enter when there is no send button
 *   g.  manual send respects the composer-not-empty guard; draft is preserved
 *   h.  'followup-status' ping answers {state, lastSentAt}
 *
 * Exit 0 = all checks pass, 2 = failure. Prints a JSON summary.
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
const IS_WIN = process.platform === 'win32';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROMPT = 'Continue implementation — follow best practices, Source of Truth, do your best';

// ---------- pre-flight (no browser): locale key parity + popup i18n coverage ----------
function preflightChecks() {
  const locDir = path.join(EXT_DIR, '_locales');
  const locales = fs.readdirSync(locDir).filter((d) => fs.existsSync(path.join(locDir, d, 'messages.json')));
  const en = JSON.parse(fs.readFileSync(path.join(locDir, 'en', 'messages.json'), 'utf8'));
  const enKeys = Object.keys(en).sort();
  const mismatches = [];
  for (const l of locales) {
    const m = JSON.parse(fs.readFileSync(path.join(locDir, l, 'messages.json'), 'utf8'));
    const ks = Object.keys(m).sort();
    if (JSON.stringify(ks) !== JSON.stringify(enKeys)) {
      mismatches.push({ locale: l, onlyHere: ks.filter((k) => !enKeys.includes(k)), missing: enKeys.filter((k) => !ks.includes(k)) });
    }
  }
  const html = fs.readFileSync(path.join(EXT_DIR, 'popup.html'), 'utf8');
  const used = new Set();
  for (const m of html.matchAll(/data-i18n(?:-ph)?="([^"]+)"/g)) used.add(m[1]);
  const missingInHtml = [...used].filter((k) => !(k in en));
  const followupKeys = enKeys.filter((k) => k.startsWith('followup'));
  return {
    localeCount: locales.length,
    mismatches,
    usedKeys: used.size,
    missingInHtml,
    followupKeys,
    ok: locales.length === 6 && mismatches.length === 0 && missingInHtml.length === 0 && followupKeys.length >= 12,
  };
}

if (!fs.existsSync(path.join(EXT_DIR, 'manifest.json'))) {
  console.error('followup-e2e: no manifest.json in ' + EXT_DIR);
  process.exit(1);
}

// Temp copy of the extension with the localhost test match + host permission injected.
const TMP_EXT = fs.mkdtempSync(path.join(os.tmpdir(), 'maa-fup-ext-'));
fs.cpSync(EXT_DIR, TMP_EXT, { recursive: true });
{
  const manPath = path.join(TMP_EXT, 'manifest.json');
  const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
  man.content_scripts[0].matches.push('http://127.0.0.1/*');
  man.host_permissions.push('http://127.0.0.1/*'); // lets the harness find the fixture tab by URL
  fs.writeFileSync(manPath, JSON.stringify(man, null, 2));
}

const chromePath = process.env.MAA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.env.MAA_FUP_PORT || 9600 + Math.floor(Math.random() * 300));
const profileDir = path.join(os.tmpdir(), `maa-fup-e2e-${process.pid}-${Date.now().toString(36)}`);
fs.mkdirSync(profileDir, { recursive: true });

// ---------- fixture server (project root) ----------
const server = http.createServer((req, res) => {
  let urlPath = '/';
  try { urlPath = decodeURIComponent((req.url || '/').split('?')[0]); } catch { res.writeHead(400); res.end(); return; }
  const rel = urlPath === '/' ? 'test/followup-fixture.html' : urlPath.replace(/^\/+/, '');
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (e, buf) => {
    if (e) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(buf);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const fixtureUrl = `http://127.0.0.1:${server.address().port}/test/followup-fixture.html`;
console.log('fixture:', fixtureUrl);

// ---------- launch installed Chrome (scratch profile) ----------
// Detached via PowerShell Start-Process (the launcher exits immediately on this host
// while Chrome keeps running as its own tree — reap by scratch-profile path below).
const CHROME_ARGS = [
  `--user-data-dir=${profileDir}`,
  `--remote-debugging-port=${PORT}`,
  '--enable-unsafe-extension-debugging',
  '--no-first-run',
  '--no-default-browser-check',
  // Keep the offscreen window fully active (occlusion + timer throttling froze layout
  // in the main e2e suite; follow-up timing needs live timers in the fixture tab).
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

// ---------- run ----------
let ws = null;
let send = null;
let popSession = null;
let fxSession = null;
const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail: detail === undefined ? null : detail }); return !!ok; };
const results = { ok: false };
const timeouts = [];

async function ev(sessionId, expression, awaitPromise = false) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise }, sessionId);
  return r && r.result ? r.result.value : undefined;
}
async function fEval(expression, awaitPromise = false) { return ev(fxSession, expression, awaitPromise); }
async function pEval(expression, awaitPromise = false) { return ev(popSession, expression, awaitPromise); }
async function fJSON(expr) {
  try { const v = await fEval('JSON.stringify(' + expr + ')'); return v === undefined ? null : JSON.parse(v); } catch { return null; }
}
async function sentList() { const l = await fJSON('window.__sent'); return Array.isArray(l) ? l : []; }
async function waitUntil(fn, timeoutMs, label) {
  const t0 = Date.now();
  for (;;) {
    let v = null;
    try { v = await fn(); } catch { v = null; }
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) { timeouts.push({ label, ms: timeoutMs }); return null; }
    await sleep(200);
  }
}
async function seed(obj) {
  return pEval(`new Promise((res) => chrome.storage.local.set(${JSON.stringify(obj)}, () => res(true)))`, true);
}
// The engine refuses re-entry while a send is being verified (600ms window, by design).
// Wait until the send that fired at/after tMin is VERIFIED (lastSentAt advanced) so a
// later manual attempt exercises the guard under test, not the transient 'sending' guard.
async function waitSendVerified(tMin, label) {
  if (!tMin) return;
  await waitUntil(async () => {
    const p = await fixtureMsg({ type: 'followup-status' });
    return !!(p.resp && Number(p.resp.lastSentAt) >= tMin);
  }, 4000, label);
}
async function fixtureMsg(message) {
  const out = await pEval(`new Promise((res) => {
    chrome.tabs.query({ url: ['http://127.0.0.1/*'] }, (tabs) => {
      const t = (tabs || [])[0];
      if (!t) return res(JSON.stringify({ error: 'no-fixture-tab' }));
      chrome.tabs.sendMessage(t.id, ${JSON.stringify(message)}, (resp) => res(JSON.stringify({ resp: resp || null, err: chrome.runtime.lastError ? chrome.runtime.lastError.message : null })));
    });
  })`, true);
  try { return JSON.parse(out); } catch { return { error: 'bad-json:' + String(out) }; }
}

try {
  const pre = preflightChecks();
  check('0. locales key-identical (6) + popup i18n keys resolve', pre.ok, pre);

  const info = await cdpEndpoint();
  ws = await connect(info.webSocketDebuggerUrl);
  send = makeSend(ws);

  const loaded = await send('Extensions.loadUnpacked', { path: TMP_EXT });
  const extId = loaded?.id;
  if (!extId) throw new Error('Extensions.loadUnpacked returned no extension id');
  console.log('extensionId:', extId);
  results.extId = extId;

  // ---- storage seeding + popup smoke (an extension page can touch chrome.storage) ----
  const pop = await send('Target.createTarget', { url: `chrome-extension://${extId}/popup.html` });
  popSession = (await send('Target.attachToTarget', { targetId: pop.targetId, flatten: true })).sessionId;
  await sleep(1000);
  await seed({ enabled: true, followupEnabled: true, followupPrompt: PROMPT, followupIdleMs: 400, followupCooldownMs: 1500 });
  await sleep(700); // let the popup's storage.onChanged refresh land
  const popCheck = JSON.parse(await pEval(`JSON.stringify({
    sect: !!document.getElementById('followupSect'),
    toggle: !!document.getElementById('followupEnabled'),
    send: !!document.getElementById('fsendnow'),
    sendDisabled: !!(document.getElementById('fsendnow') || {}).disabled,
    opts: (((document.getElementById('fpreset') || {}).options) || []).length,
    selVal: (document.getElementById('fpreset') || {}).value,
    taVisible: !(document.getElementById('fpromptRow') || {}).hidden,
    taVal: (document.getElementById('fprompt') || {}).value,
    idleVal: (document.getElementById('fidle') || {}).value
  })`));
  results.popup = popCheck;
  check('popup. follow-up section renders with toggle + send-now', !!(popCheck.sect && popCheck.toggle && popCheck.send), popCheck);
  check('popup. send-now enabled while the feature is on', popCheck.sendDisabled === false, { sendDisabled: popCheck.sendDisabled });
  check('popup. preset select has 3 presets + Custom…', popCheck.opts === 4, { opts: popCheck.opts });
  check('popup. non-preset prompt shows as Custom… with the text', popCheck.selVal === 'custom' && popCheck.taVisible === true && popCheck.taVal === PROMPT,
    { selVal: popCheck.selVal, taVisible: popCheck.taVisible, taVal: popCheck.taVal });
  check('popup. idle ms mapped to seconds', popCheck.idleVal === '1', { idleVal: popCheck.idleVal });

  // ---- fixture ----
  const fx = await send('Target.createTarget', { url: fixtureUrl });
  fxSession = (await send('Target.attachToTarget', { targetId: fx.targetId, flatten: true })).sessionId;
  const injected = await waitUntil(async () => (await fEval("document.documentElement.getAttribute('data-muse-auto-allow')")) === '1', 15000, 'injection');
  check('0b. content script injected into the fixture', injected === true, {});

  // ---- a. nothing sent while 'is working' ----
  await fEval("window.__setState('working')");
  await sleep(2500);
  let s = await sentList();
  check('a. no send while Muse reports working', s.length === 0, { sent: s.length });
  const pingA = await fixtureMsg({ type: 'followup-status' });
  check('a. status ping reports working', !!(pingA.resp && pingA.resp.state === 'working'), pingA);
  const attrA = await fEval("document.documentElement.getAttribute('data-muse-followup')");
  check('a. engine attribute reflects working', attrA === 'working', { attrA });

  // ---- b0. idle-wait enforced; lowering it live (storage.onChanged) triggers the send ----
  await seed({ followupIdleMs: 2500 });
  await sleep(350);
  await fEval("window.__setState('idle')");
  await sleep(1800);
  s = await sentList();
  check('b0. idle observed but idle-wait not elapsed => no send', s.length === 0, { sent: s.length });
  const attrB0 = await fEval("document.documentElement.getAttribute('data-muse-followup')");
  check('b0. engine detects idle', attrB0 === 'idle', { attrB0 });
  await seed({ followupIdleMs: 400 });
  const got1 = await waitUntil(async () => { const l = await sentList(); return l.length >= 1 ? l : null; }, 8000, 'first send');
  check('b. follow-up send fires after the idle wait', !!got1, {});
  let t1 = 0;
  if (got1) {
    t1 = got1[0].t;
    check('b. exact seeded prompt typed + submitted', got1[0].text === PROMPT, { text: got1[0].text });
    check('b. submitted via the send button', got1[0].via === 'button', { via: got1[0].via });
    const composerNow = await fEval("(document.getElementById('composer') || {}).value");
    check('b. composer cleared by the app after the send', composerNow === '', { composerNow });
    const inputs = await fJSON('window.__inputs');
    check('b. React-safe input event dispatched before submit', Array.isArray(inputs) && inputs.length >= 1, { inputs: inputs ? inputs.length : 0 });
  }

  // ---- c. cooldown: sample while inside the window, then observe the gated retry ----
  // The invariant is "no second send WITHIN followupCooldownMs": if the sample lands
  // slightly late, judge by the recorded separation (>= ~1.4s) instead of a bare count,
  // so CDP latency can never turn a slow sample into a false red.
  if (t1) {
    await sleep(Math.max(0, t1 + 1150 - Date.now()));
    const s2 = await sentList();
    const tooSoon = s2.length >= 2 && (s2[1].t - s2[0].t) < 1400;
    check('c. no second send within followupCooldownMs', !tooSoon,
      { sent: s2.length, sinceFirstMs: Date.now() - t1, dt: s2.length >= 2 ? s2[1].t - s2[0].t : null });
  }
  if (got1) {
    const pingB = await fixtureMsg({ type: 'followup-status' });
    check('b. verified send recorded lastSentAt', !!(pingB.resp && Number(pingB.resp.lastSentAt) > 0), pingB);
  }
  const got2 = await waitUntil(async () => { const l = await sentList(); return l.length >= 2 ? l : null; }, 8000, 'second send after cooldown');
  check('c. second send fires once the cooldown elapsed', !!got2, {});
  if (got2 && got2.length >= 2) {
    check('c. cooldown separation >= 1400ms', (got2[1].t - got2[0].t) >= 1400, { dt: got2[1].t - got2[0].t });
  }

  // ---- d. followupEnabled=false blocks sends ----
  await seed({ followupEnabled: false });
  await sleep(500);
  const baseD = (await sentList()).length;
  await sleep(3000);
  const afterD = (await sentList()).length;
  check('d. followupEnabled=false => nothing sent', afterD === baseD, { baseD, afterD });

  // ---- reset the engine before the approval-guard phase ----
  // While enabled+idle the engine legitimately sends every ~cooldown(1.5s); under a
  // slow-CDP stall the observation steps above can stretch, the burst can reach the
  // hard 6/hour cap, and case (e)'s resume would then be blocked by the CAP rather
  // than measured. A reload restarts the content script with a fresh budget and a
  // fresh fixture, so (e) tests the approval guard in isolation.
  try { await send('Page.reload', {}, fxSession); } catch { try { await fEval('location.reload()'); } catch { /* ignore */ } }
  await waitUntil(async () => (await fEval("document.documentElement.getAttribute('data-muse-auto-allow')")) === '1', 15000, 're-injection after reload');
  await sleep(600);
  await fEval("window.__setState('idle')");

  // ---- e. approval card present blocks the idle send; clearing it resumes ----
  const baseE = (await sentList()).length; // fresh engine: normally 0
  await fEval("window.__setApproval(true)");
  await seed({ followupEnabled: true });
  await sleep(3500);
  const sentE1 = (await sentList()).length;
  check('e. no send while an approval card is present', sentE1 === baseE, { sentE1, baseE });
  await fEval("window.__setApproval(false)");
  const gotE2 = await waitUntil(async () => { const l = await sentList(); return l.length > sentE1 ? l : null; }, 8000, 'send after approval cleared');
  check('e. send resumes after the approval card is cleared', !!gotE2, {});
  if (gotE2) await waitSendVerified(gotE2[gotE2.length - 1].t, 'resume send verified');

  // ---- f. manual send-now: skips the idle wait; Enter fallback without a send button ----
  await fEval("window.__setState('working')");
  await fEval("window.__hideSend()");
  await sleep(300);
  const baseF = (await sentList()).length;
  const rF = await fixtureMsg({ type: 'followup-send-now' });
  check('f. manual send-now accepted (attempt started)', !!(rF.resp && rF.resp.ok === true), rF);
  const gotF = await waitUntil(async () => { const l = await sentList(); return l.length > baseF ? l : null; }, 6000, 'manual send');
  check('f. manual send fires while Muse reports working (idle wait skipped)', !!gotF, {});
  if (gotF && gotF[baseF]) {
    check('f. manual send carries the exact prompt', gotF[baseF].text === PROMPT, { text: gotF[baseF].text });
    check('f. manual falls back to Enter when no send button exists', gotF[baseF].via === 'enter', { via: gotF[baseF].via });
    await waitSendVerified(gotF[baseF].t, 'manual send verified');
  }

  // ---- g. composer-not-empty guard (manual path) ----
  await fEval("window.__setComposer('draft in progress')");
  const baseG = (await sentList()).length;
  const rG = await fixtureMsg({ type: 'followup-send-now' });
  await sleep(1500);
  const sentG = (await sentList()).length;
  check('g. no send while the composer holds unsent text (guard)',
    sentG === baseG && !!(rG.resp && rG.resp.ok === false && rG.resp.reason === 'composer-not-empty'),
    { sentG, baseG, resp: rG.resp });
  const draft = await fEval("(document.getElementById('composer') || {}).value");
  check('g. draft preserved (extension never re-typed over it)', draft === 'draft in progress', { draft });
  await fEval("window.__setComposer('')");

  // ---- h. status ping shape ----
  const stH = await fixtureMsg({ type: 'followup-status' });
  check('h. followup-status answers {state, lastSentAt}', !!(stH.resp && typeof stH.resp.state === 'string' && Number(stH.resp.lastSentAt) > 0), stH);
  const attrH = await fEval("document.documentElement.getAttribute('data-muse-followup')");
  check('h. engine still reports working after the manual send', attrH === 'working', { attrH });

  // ---- fixture-side evidence + hygiene ----
  const finalSent = await sentList();
  const inputsFinal = (await fJSON('window.__inputs')) || [];
  const approvals = (await fJSON('window.__approvalClicks')) || [];
  const fxErrors = (await fJSON('window.__errors')) || [];
  check('z. fixture page saw no JS errors', fxErrors.length === 0, { fxErrors });
  check('z. deny was never clicked on the approval card', !approvals.some((a) => a.n === 'deny'), { approvals: approvals.length });

  results.sent = finalSent;
  results.inputEvents = inputsFinal.length;
  results.approvalClicks = approvals.length;
  results.verifyTimeouts = timeouts;
  Object.assign(results, { checks });
  results.ok = checks.every((c) => c.ok);
} catch (e) {
  results.error = e.message + '\n' + (e.stack || '');
  results.checks = checks;
  results.ok = false;
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
