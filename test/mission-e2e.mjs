#!/usr/bin/env node
/**
 * mission-e2e.mjs — runtime verification for the v1.9.0 Mission Orchestrator ENGINE,
 * on a REAL Chromium. Same CDP lane as test/e2e.mjs and test/followup-e2e.mjs: installed
 * Chrome (137+) via `Extensions.loadUnpacked`, scratch profile only (NEVER the user's real
 * profile), detached launch + profile-path teardown. The extension is loaded from a TEMP COPY
 * whose manifest additionally matches http://127.0.0.1/* — the shipped manifest stays
 * muse.ai-only.
 *
 * Contract under test (frozen — docs/MISSION_V19.md):
 *   missionEnabled: boolean (default false); mission: {id,step,cycles,startedAt,lastSentAt}
 *   (absent = no active mission); caps MAX_STEPS_PER_MISSION=12 (lifetime sends) and
 *   MAX_MISSION_CYCLES=3 (full cycles); advance the step ONLY on a VERIFIED send (a blocked /
 *   refused / paused / dry-run attempt never advances); an active mission takes PRECEDENCE over
 *   the rotating phrase prompts; pauseUntil halts mission sends; dryRun logs 'mission-dry' and
 *   sends nothing; a completed mission stops silently with exactly ONE 'mission' log line; the
 *   new log kind is 'mission' (records id + step + cycle); the followup-status ping exposes the
 *   applied mission state.
 *
 * Cases:
 *   pre. corpus safety scan — the SHIPPED mission text contains no destructive instruction
 *        pattern and no secret/URL/email; the scanner has a POSITIVE and a NEGATIVE control
 *        (it must flag a crafted bad string and pass a clean one), so the scan is not vacuous.
 *   P.   status ping exposes missionEnabled/missionId/missionStep/missionCycles/missionSteps/
 *        missionActive/missionStepText/missions.
 *   A.   idle-triggered send = the CURRENT step (exact shipped text); the step advances ONLY
 *        after the send is verified; a 'mission' log entry records step 0 / cycle 1; the
 *        phrase rotation index is NOT advanced and no 'followup' entry is written.
 *   A2.  the NEXT idle send carries step 1 (order is the shipped corpus order) and advances.
 *   B1.  a refused send (composer holds a draft) does NOT advance the step and adds no entry.
 *   B2.  an approval card blocks the idle send (no send, no advance) and the manual send-now is
 *        refused ('approval-present'); clearing the card resumes.
 *   C.   pauseUntil halts mission sends (auto + manual 'paused'); clearing it resumes and the
 *        next verified send advances.
 *   D.   dry-run LOGS the step it would send ('mission-dry') and sends nothing; the step does
 *        NOT advance; real sends resume when dryRun turns off.
 *   F.   mission precedence: with a rotation list stored AND a mission active, the send is the
 *        MISSION step (never the rotation phrase) and the rotation index does not move.
 *   E.   caps: a 4-step mission driven to 12 lifetime sends / 3 cycles -> silent stop with
 *        exactly ONE 'mission' completion entry, the stored mission is dropped, and no further
 *        mission send fires.
 *   z.   the fixture page saw no JS errors.
 *
 * Usage: node test/mission-e2e.mjs
 *   MAA_EXT_DIR=<dir> points the harness at a MUTATED copy of the extension for a
 *   reverse-mutation (falsification) run: disable a guard -> the matching checks go RED;
 *   restore -> GREEN. See docs/MISSION_V19.md for the recorded mutations.
 * Exit 0 = all checks pass, 2 = at least one fails. A non-TTY/background shell aborts with
 * 'stdout is not a tty' rc=1 before a single check runs — that is a launcher limitation,
 * NOT a test failure (run it FOREGROUND in a real terminal).
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

const ROT_A = 'Rotation phrase A — keep going';
const ROT_B = 'Rotation phrase B — keep going';

// ---------- shipped-content safety scan (no destructive verb, no secret, no URL/email) ----------
// Destructive instruction patterns the shipped mission text must NEVER carry.
const DESTRUCTIVE = /\b(rm|delete|remove|drop|wipe|format|truncate|destroy|kill|overwrite|force[-\s]?push|sudo|chmod|chown|shutdown|reset\s+--hard|unlink|purge)\b/i;
// Secret markers / network or personal identifiers the shipped text must NEVER carry.
const SECRETISH = /(\b(password|passcode|secret|credential|credentials|api[_\s-]?key|access[_\s-]?token|bearer|private[_\s-]?key|token)\b)|-----BEGIN|https?:\/\/|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i;
function scanText(t) {
  const hits = [];
  if (DESTRUCTIVE.test(t)) hits.push('destructive');
  if (SECRETISH.test(t)) hits.push('secret-or-identifier');
  return hits;
}
// Extract the shipped corpus from the extension source (a SOURCE-SCAN helper — it pins the
// written shape, it is NOT the behavioural proof; the behavioural cases below are). Anchored to
// the MISSION_CORPUS_BEGIN/END markers so it cannot drift onto unrelated strings.
function loadCorpus(dir) {
  const src = fs.readFileSync(path.join(dir, 'content.js'), 'utf8');
  const a = src.indexOf('// MISSION_CORPUS_BEGIN');
  const b = src.indexOf('// MISSION_CORPUS_END');
  if (a < 0 || b < 0) return { found: false, missions: {} };
  const region = src.slice(a, b);
  const missions = {};
  const mre = /\{\s*id:\s*'([^']+)'[\s\S]*?steps:\s*\[([\s\S]*?)\]\s*,?\s*\}/g;
  let mm;
  let guard = 0;
  while ((mm = mre.exec(region)) && guard++ < 20) {
    const steps = [];
    for (const sm of mm[2].matchAll(/'((?:[^'\\]|\\.)*)'/g)) steps.push(sm[1]);
    missions[mm[1]] = steps;
  }
  return { found: true, missions };
}
function preflight(dir) {
  const { found, missions } = loadCorpus(dir);
  const ids = Object.keys(missions);
  // Positive + negative controls for the scanner (proves it discriminates, not just returns []).
  const ctlPos = scanText('please rm the build folder and paste the access token').length;
  const ctlNeg = scanText('Read the project source of truth and run the repository gates').length;
  const flagged = [];
  let stepCount = 0;
  for (const id of ids) {
    for (const s of missions[id]) {
      stepCount++;
      const hits = scanText(s);
      if (hits.length) flagged.push({ id, why: hits, sample: s.slice(0, 90) });
    }
  }
  return {
    corpusFound: found, ids, stepCount, flagged,
    controlPositive: ctlPos, controlNegative: ctlNeg,
    ok: found && ids.length === 5 && flagged.length === 0 && ctlPos >= 1 && ctlNeg === 0,
  };
}

if (!fs.existsSync(path.join(EXT_DIR, 'manifest.json'))) {
  console.error('mission-e2e: no manifest.json in ' + EXT_DIR);
  process.exit(1);
}

// Temp copy of the extension with the localhost test match + host permission injected.
const TMP_EXT = fs.mkdtempSync(path.join(os.tmpdir(), 'maa-mis-ext-'));
fs.cpSync(EXT_DIR, TMP_EXT, { recursive: true });
{
  const manPath = path.join(TMP_EXT, 'manifest.json');
  const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
  man.content_scripts[0].matches.push('http://127.0.0.1/*');
  man.host_permissions.push('http://127.0.0.1/*'); // lets the harness find the fixture tab
  fs.writeFileSync(manPath, JSON.stringify(man, null, 2));
}

const chromePath = process.env.MAA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.env.MAA_MIS_PORT || 9900 + Math.floor(Math.random() * 300));
const profileDir = path.join(os.tmpdir(), `maa-mis-e2e-${process.pid}-${Date.now().toString(36)}`);
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
  '--lang=en-US',
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
async function popStore(keys) {
  const out = await pEval(`new Promise((res) => chrome.storage.local.get(${JSON.stringify(keys)}, (s) => res(JSON.stringify(s))))`, true);
  try { return JSON.parse(out); } catch { return null; }
}
// LSN-008 (v1.21.0): the status ping exposes followup.sending — every baseline/send below first
// waits until no send is in flight, so a still-verifying send can never drift a step mid-check.
async function waitQuiet(ms = 8000) { return waitEngine((p) => p.sending !== true, ms, 'send quiet'); }

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
// The engine's own applied state (the established race fix): poll the ping instead of sleeping.
async function enginePing() {
  const p = await fixtureMsg({ type: 'followup-status' });
  return (p && p.resp) || null;
}
async function waitEngine(pred, timeoutMs, label) {
  return waitUntil(async () => { const r = await enginePing(); return r && pred(r) ? r : null; }, timeoutMs, label);
}
async function reloadFixture(tag) {
  try { await send('Page.reload', {}, fxSession); } catch { try { await fEval('location.reload()'); } catch { /* ignore */ } }
  await waitUntil(async () => (await fEval("document.documentElement.getAttribute('data-muse-auto-allow')")) === '1', 15000, 're-injection after reload (' + tag + ')');
  await sleep(500);
}
async function findLogs() { const l = await popStore(['log']); return ((l && l.log) || []).filter((x) => x && typeof x === 'object'); }
async function missionSendEntries() { return (await findLogs()).filter((x) => x.kind === 'mission' && x.mission && x.mission.complete !== true); }
async function missionCompleteEntries() { return (await findLogs()).filter((x) => x.kind === 'mission' && x.mission && x.mission.complete === true); }
// One manual send that must be ACCEPTED and then VERIFIED: waits for the in-flight lock to clear,
// fires send-now, waits for the fixture to record it, then waits for the engine to report the
// post-verify state. Returns { ok, before, after, ping }.
async function manualSendAndVerify(expectFn, label, tMs = 6000) {
  await waitEngine((p) => p.sending === false, tMs, label + ': lock clear');
  const before = (await sentList()).length;
  const r = await fixtureMsg({ type: 'followup-send-now' });
  const sent = await waitUntil(async () => { const l = await sentList(); return l.length > before ? l : null; }, tMs, label + ': record');
  const after = await waitUntil(async () => { const p = await enginePing(); return p && p.sending === false && expectFn(p) ? p : null; }, tMs, label + ': verified state');
  return { ok: !!(sent && after), resp: r.resp, before, sent, after };
}

const pre = preflight(EXT_DIR);
console.log('preflight:', JSON.stringify(pre));

try {
  check('pre. shipped corpus found with 5 missions by id', pre.corpusFound && JSON.stringify(pre.ids) === JSON.stringify(['golive-ready', 'audit-only', 'fix-findings', 'scoped-run', 'release-prep']), { ids: pre.ids });
  check('pre. corpus safety scan: no destructive pattern / secret / URL in any shipped step', pre.flagged.length === 0, { flagged: pre.flagged, steps: pre.stepCount });
  check('pre. safety scanner DISCRIMINATES (positive control flags, negative control passes)',
    pre.controlPositive >= 1 && pre.controlNegative === 0, { controlPositive: pre.controlPositive, controlNegative: pre.controlNegative });
  const GOLIVE = (loadCorpus(EXT_DIR).missions['golive-ready'] || []);
  const AUDIT = (loadCorpus(EXT_DIR).missions['audit-only'] || []);
  check('pre. golive-ready has 6 steps and audit-only has 4 (harness expectations)', GOLIVE.length === 6 && AUDIT.length === 4, { golive: GOLIVE.length, audit: AUDIT.length });

  const info = await cdpEndpoint();
  ws = await connect(info.webSocketDebuggerUrl);
  send = makeSend(ws);

  const loaded = await send('Extensions.loadUnpacked', { path: TMP_EXT });
  const extId = loaded?.id;
  if (!extId) throw new Error('Extensions.loadUnpacked returned no extension id');
  console.log('extensionId:', extId);
  results.extId = extId;

  // ---- storage seeding page (an extension page can touch chrome.storage) ----
  const pop = await send('Target.createTarget', { url: `chrome-extension://${extId}/popup.html` });
  popSession = (await send('Target.attachToTarget', { targetId: pop.targetId, flatten: true })).sessionId;
  await sleep(800);

  const fx = await send('Target.createTarget', { url: fixtureUrl });
  fxSession = (await send('Target.attachToTarget', { targetId: fx.targetId, flatten: true })).sessionId;
  const injected = await waitUntil(async () => (await fEval("document.documentElement.getAttribute('data-muse-auto-allow')")) === '1', 15000, 'injection');
  check('setup. content script injected into the fixture', injected === true, {});
  await fEval("window.__setState('working')");
  await fEval("window.__setApproval(false)");

  // ---- P. status ping shape + applied mission state ----
  await seed({ enabled: true, followupEnabled: true, followupPrompt: ROT_A, followupPrompts: [ROT_A, ROT_B],
               followupIdleMs: 400, followupCooldownMs: 1000, followupRotateIdx: 0,
               pauseUntil: 0, dryRun: false, missionEnabled: true,
               mission: { id: 'golive-ready', step: 0, cycles: 0, startedAt: Date.now(), lastSentAt: 0 } });
  const pingP = await waitEngine((p) => p.missionEnabled === true && p.missionId === 'golive-ready' && p.missionStep === 0, 8000, 'mission applied');
  check('P. status ping exposes the applied mission state (enabled/id/step/cycles/steps/active)',
    !!(pingP && pingP.missionEnabled === true && pingP.missionId === 'golive-ready' && pingP.missionStep === 0 &&
       pingP.missionCycles === 0 && pingP.missionSteps === 6 && pingP.missionActive === true),
    pingP && { enabled: pingP.missionEnabled, id: pingP.missionId, step: pingP.missionStep, cycles: pingP.missionCycles, steps: pingP.missionSteps, active: pingP.missionActive });
  check('P. status ping lists the 5 shipped mission ids', !!(pingP && Array.isArray(pingP.missions) && pingP.missions.length === 5 && pingP.missions.includes('golive-ready') && pingP.missions.includes('scoped-run')), pingP && pingP.missions);
  check('P. status ping exposes the CURRENT step text (step 0)', !!(pingP && pingP.missionStepText === GOLIVE[0]), { got: pingP && String(pingP.missionStepText).slice(0, 60), want: GOLIVE[0].slice(0, 60) });

  // ---- A. idle send = current step; advance only on a verified send ----
  await fEval("window.__setState('idle')");
  const sent1 = await waitUntil(async () => { const l = await sentList(); return l.length >= 1 ? l : null; }, 10000, 'mission send #1');
  check('A. idle detection fires a mission send', !!sent1, {});
  if (sent1) {
    check('A. the send carries the EXACT shipped step 0 (the CURRENT step)',
      sent1[0].text === GOLIVE[0], { got: String(sent1[0].text).slice(0, 70), want: GOLIVE[0].slice(0, 70) });
    check('A. submitted via the send button', sent1[0].via === 'button', { via: sent1[0].via });
  }
  const stepA = await waitEngine((p) => p.missionStep === 1, 6000, 'advance to step 1 (verified send)');
  check('A. the step advances after the send is VERIFIED (step 0 -> 1)', !!(stepA && stepA.missionStep === 1 && stepA.missionId === 'golive-ready'), stepA && { step: stepA.missionStep });
  const logsA = await findLogs();
  const mEntry = logsA.find((x) => x.kind === 'mission' && x.mission && x.mission.id === 'golive-ready' && x.mission.step === 0);
  check('A. a "mission" log entry records step 0 / cycle 1 with the mission id', !!mEntry && mEntry.mission.cycle === 1, mEntry ? mEntry.mission : null);
  check('A. the phrase rotation did NOT advance (index still 0) and no "followup" entry was written',
    !logsA.some((x) => x.kind === 'followup') && ((await popStore(['followupRotateIdx'])).followupRotateIdx === 0),
    { rotateIdx: (await popStore(['followupRotateIdx'])).followupRotateIdx, followupEntries: logsA.filter((x) => x.kind === 'followup').length });

  // ---- A2. the next idle send carries step 1 (shipped order) ----
  const sent2 = await waitUntil(async () => { const l = await sentList(); return l.length >= 2 ? l : null; }, 10000, 'mission send #2');
  check('A2. the next idle send fires', !!sent2, {});
  if (sent2 && sent2[1]) {
    check('A2. the second send carries step 1 (shipped corpus order)', sent2[1].text === GOLIVE[1], { got: String(sent2[1].text).slice(0, 70) });
  }
  const stepA2 = await waitEngine((p) => p.missionStep === 2, 12000, 'advance to step 2'); // R1: 6s flaked on a busy box; 12s keeps the assertion deterministic
  check('A2. step advances again on the verified send (1 -> 2)', !!(stepA2 && stepA2.missionStep === 2), stepA2 && { step: stepA2.missionStep });

  // stop the auto path; the remaining phases use the deterministic manual path
  await seed({ followupEnabled: false });
  await waitEngine((p) => p.enabled === false, 4000, 'followup disabled');
  await fEval("window.__setState('working')");
  await seed({ followupEnabled: true });
  await waitEngine((p) => p.enabled === true, 4000, 'followup re-enabled');

  // ---- B1. a refused send (composer holds a draft) does NOT advance ----
  const stepB0 = (await enginePing()).missionStep;
  const missBefore = (await missionSendEntries()).length;
  await fEval("window.__setComposer('draft in progress')");
  const rB1 = await fixtureMsg({ type: 'followup-send-now' });
  await sleep(400);
  const stepB1 = (await enginePing()).missionStep;
  check('B1. manual send-now refused while the composer holds text (composer-not-empty)',
    !!(rB1.resp && rB1.resp.ok === false && rB1.resp.reason === 'composer-not-empty'), rB1.resp);
  check('B1. a refused send does NOT advance the mission step', stepB1 === stepB0, { before: stepB0, after: stepB1 });
  check('B1. a refused send writes no "mission" entry', (await missionSendEntries()).length === missBefore, { before: missBefore });
  const draftKept = await fEval("(document.getElementById('composer') || {}).value");
  check('B1. the draft is preserved (never typed over)', draftKept === 'draft in progress', { draftKept });
  await fEval("window.__setComposer('')");

  // ---- B2. an approval card blocks the idle send AND the manual send-now ----
  await fEval("window.__setApproval(true)");
  await fEval("window.__setState('idle')");
  const baseB2 = (await sentList()).length;
  await sleep(2800);
  check('B2. no mission send while an approval card is present (idle path blocked)', (await sentList()).length === baseB2, { base: baseB2, now: (await sentList()).length });
  const stepB2 = (await enginePing()).missionStep;
  check('B2. the blocked idle send does NOT advance the step', stepB2 === stepB0, { before: stepB0, after: stepB2 });
  const rB2 = await fixtureMsg({ type: 'followup-send-now' });
  check('B2. manual send-now refused with "approval-present"', !!(rB2.resp && rB2.resp.ok === false && rB2.resp.reason === 'approval-present'), rB2.resp);
  await fEval("window.__setApproval(false)");
  await fEval("window.__setState('working')");

  // ---- C. pauseUntil halts mission sends; clearing resumes ----
  // LSN-008: the auto path only sends when the tab is IDLE, so the state must stay 'working'
  // through this block (an idle handshake ARMED the auto send for one tick and drifted the step
  // baseline — observed flake in the v1.21.0 battery); the baseline also waits until no send is
  // in flight (followup.sending === false).
  await seed({ pauseUntil: Date.now() + 60000 });
  await waitEngine((p) => p.paused === true, 4000, 'paused applied');
  await waitQuiet();
  const stepC0 = (await enginePing()).missionStep; // baseline AFTER the pause holds
  const baseC = (await sentList()).length;
  await sleep(2600);
  check('C. pause halts the automatic mission send', (await sentList()).length === baseC, { base: baseC, now: (await sentList()).length });
  const rC1 = await fixtureMsg({ type: 'followup-send-now' });
  check('C. manual send-now refused while paused (reason "paused")', !!(rC1.resp && rC1.resp.ok === false && rC1.resp.reason === 'paused'), rC1.resp);
  check('C. a paused/refused send does NOT advance the step', (await enginePing()).missionStep === stepC0, { stepC0 });
  // Keep the idle auto-path OUT of the resume measurement: if the fixture stays idle, unpausing
  // lets BOTH the automatic send and the manual send fire (two advances). 'working' isolates the
  // manual resume (manual send-now ignores the idle requirement).
  await fEval("window.__setState('working')"); // keep the auto path OFF (it sends only when idle)
  await seed({ pauseUntil: 0 });
  await waitEngine((p) => p.paused === false, 4000, 'unpaused');
  await waitQuiet();
  const resC = await manualSendAndVerify((p) => p.missionStep === stepC0 + 1, 'C resume');
  check('C. clearing the pause resumes the mission send (and the verified send advances)', resC.ok, { resp: resC.resp });

  // ---- D. dry-run LOGS the step and sends nothing (no advance) ----
  // Reload first: the dry-run case exercises the AUTOMATIC path, which is paced by the rolling
  // 6/hour budget — a reload restarts that budget (and the fixture recorder) so the case measures
  // the dry-run gate, not a stale cap.
  await reloadFixture('dry-run');
  await fEval("window.__setApproval(false)");
  await seed({ missionEnabled: true, followupEnabled: true, followupIdleMs: 400, followupCooldownMs: 900,
               pauseUntil: 0, dryRun: false,
               mission: { id: 'golive-ready', step: 0, cycles: 0, startedAt: Date.now(), lastSentAt: 0 } });
  await waitEngine((p) => p.missionActive === true && p.missionStep === 0, 8000, 'dry-run mission applied');
  const stepD0 = 0;
  await seed({ dryRun: true });
  await waitEngine((p) => p.dryRun === true, 4000, 'dryRun applied');
  await fEval("window.__setState('idle')");
  const baseD = (await sentList()).length;
  const dryEntry = await waitUntil(async () => {
    const l = (await findLogs()).find((x) => x.kind === 'mission-dry');
    return l || null;
  }, 8000, 'mission-dry entry');
  check('D. dry-run logs a "mission-dry" entry for the step it would have sent', !!dryEntry && !!dryEntry.mission && dryEntry.mission.step === stepD0, dryEntry && dryEntry.mission);
  check('D. dry-run sends NOTHING (fixture recorder unchanged)', (await sentList()).length === baseD, { base: baseD, now: (await sentList()).length });
  check('D. dry-run does NOT advance the mission step', (await enginePing()).missionStep === stepD0, {});
  await seed({ dryRun: false });
  await waitEngine((p) => p.dryRun === false, 4000, 'dryRun off');

  // ---- F. mission precedence over the rotation (fresh budget via reload) ----
  await reloadFixture('precedence');
  await fEval("window.__setApproval(false)");
  await seed({ log: [], missionEnabled: true, followupEnabled: true, followupRotateIdx: 0,
               followupPrompt: ROT_A, followupPrompts: [ROT_A, ROT_B], followupIdleMs: 400, followupCooldownMs: 900,
               pauseUntil: 0, dryRun: false,
               mission: { id: 'golive-ready', step: 0, cycles: 0, startedAt: Date.now(), lastSentAt: 0 } });
  await waitEngine((p) => p.missionActive === true && p.missionStep === 0, 8000, 'precedence mission applied');
  await fEval("window.__setState('idle')");
  const sentF = await waitUntil(async () => { const l = await sentList(); return l.length >= 1 ? l : null; }, 10000, 'precedence send');
  check('F. with a rotation list stored, the send is the MISSION step (not the rotation phrase)',
    !!(sentF && sentF[0] && sentF[0].text === GOLIVE[0] && sentF[0].text !== ROT_A && sentF[0].text !== ROT_B), sentF && { got: String(sentF[0].text).slice(0, 60) });
  await waitEngine((p) => p.missionStep === 1, 6000, 'precedence advance');
  const logsF = await findLogs();
  check('F. mission precedence did not touch the rotation (index 0, no "followup" entry)',
    !logsF.some((x) => x.kind === 'followup') && ((await popStore(['followupRotateIdx'])).followupRotateIdx === 0),
    { rotateIdx: (await popStore(['followupRotateIdx'])).followupRotateIdx });

  // ---- E. caps: 12 lifetime sends / 3 cycles -> silent stop with one completion entry ----
  await fEval("window.__setState('working')");
  await seed({ followupEnabled: true, dryRun: false, pauseUntil: 0, log: [], missionEnabled: true,
               mission: { id: 'audit-only', step: 0, cycles: 0, startedAt: Date.now(), lastSentAt: 0 } });
  await waitEngine((p) => p.missionId === 'audit-only' && p.missionStep === 0 && p.missionSteps === 4, 8000, 'audit mission applied');
  let capsSends = 0;
  let cycle4ok = false;
  let cycle8ok = false;
  for (let k = 1; k <= 12; k++) {
    const prevStep = (await enginePing()).missionStep;
    await waitEngine((p) => p.sending === false, 6000, 'caps lock clear #' + k);
    const before = (await sentList()).length;
    const r = await fixtureMsg({ type: 'followup-send-now' });
    const rec = await waitUntil(async () => { const l = await sentList(); return l.length > before ? l : null; }, 6000, 'caps send #' + k);
    if (!(r.resp && r.resp.ok === true) || !rec) break;
    capsSends++;
    // after the verified advance, either the step moved or the mission completed
    const after = await waitUntil(async () => { const p = await enginePing(); return p && p.sending === false && (p.missionStep !== prevStep || p.missionId === '') ? p : null; }, 6000, 'caps advance #' + k);
    if (k === 4 && after) cycle4ok = (after.missionCycles === 1 && after.missionStep === 0);
    if (k === 8 && after) cycle8ok = (after.missionCycles === 2 && after.missionStep === 0);
  }
  const pingE = await enginePing();
  const sendEntries = (await missionSendEntries()).filter((x) => x.mission && x.mission.id === 'audit-only');
  const completeEntries = (await missionCompleteEntries()).filter((x) => x.mission && x.mission.id === 'audit-only');
  const storedMission = (await popStore(['mission'])).mission;
  check('E. the mission ran exactly 12 sends across 3 cycles (4-step mission)', capsSends === 12 && sendEntries.length === 12, { capsSends, sendEntries: sendEntries.length });
  check('E. cycle increments at each wrap (cycle 1 after send 4, cycle 2 after send 8)', cycle4ok && cycle8ok, { cycle4ok, cycle8ok });
  check('E. the 12-step / 3-cycle cap stops the mission SILENTLY (one completion entry, mission dropped)',
    completeEntries.length === 1 && pingE.missionId === '' && pingE.missionActive === false && pingE.completedMissionId === 'audit-only' &&
    (storedMission === undefined || storedMission === null), { complete: completeEntries.length, pingId: pingE.missionId, active: pingE.missionActive, completed: pingE.completedMissionId, stored: storedMission });
  check('E. the completion entry carries the mission id and cycle count', !!(completeEntries[0] && completeEntries[0].mission.id === 'audit-only' && completeEntries[0].mission.cycles === 3), completeEntries[0] ? completeEntries[0].mission : null);
  // no further mission send after completion
  await seed({ followupEnabled: false });
  await waitEngine((p) => p.enabled === false, 4000, 'disabled after caps');
  const basePost = (await sentList()).length;
  const rPost = await fixtureMsg({ type: 'followup-send-now' });
  await sleep(600);
  check('E. no mission send after completion (a completed mission sends nothing more)',
    (await sentList()).length === basePost && !!(rPost.resp && rPost.resp.ok === false), { resp: rPost.resp, base: basePost });

  // ---- z. fixture sanity ----
  const fxErrors = (await fJSON('window.__errors')) || [];
  // ---- v1.21.0 (G02). playbook variables + guards: defaults, run values, guard refusal, fail-closed
  await fEval("window.__setState('working')");
  await fEval("window.__setApproval(false)");
  await seed({ pauseUntil: 0, dryRun: false, followupEnabled: true, missionEnabled: true, missionPlaybooks: null,
    mission: { id: 'scoped-run', step: 0, cycles: 0, startedAt: Date.now(), lastSentAt: 0 } });
  await waitEngine((p) => p.missionId === 'scoped-run' && p.missionEnabled === true, 8000, 'scoped-run applied');
  await waitQuiet();
  const rG0 = await fixtureMsg({ type: 'followup-send-now' });
  const sentG0 = await sentList();
  const lastG0 = sentG0[sentG0.length - 1];
  check('G02-A. a scoped-run WITHOUT stored values sends the shipped DEFAULTS (never the token)',
    !!(rG0.resp && rG0.resp.ok === true) && !!lastG0 && /this project/.test(lastG0.text) && /main/.test(lastG0.text) && !/\{\{/.test(lastG0.text),
    { resp: rG0.resp, last: lastG0 && lastG0.text && lastG0.text.slice(0, 120) });

  await seed({ mission: { id: 'scoped-run', step: 1, cycles: 0, startedAt: Date.now(), lastSentAt: 0, values: { project: 'alpha-repo', branch: 'g2-branch' } } });
  await waitEngine((p) => p.missionStep === 1, 8000, 'values run applied');
  await waitQuiet();
  const rG1 = await fixtureMsg({ type: 'followup-send-now' });
  const sentG1 = await sentList();
  const lastG1 = sentG1[sentG1.length - 1];
  check('G02-B. the typed step carries the RUN VALUES (never the token)',
    !!(rG1.resp && rG1.resp.ok === true) && !!lastG1 && /alpha-repo/.test(lastG1.text) && /g2-branch/.test(lastG1.text) && !/\{\{/.test(lastG1.text),
    { resp: rG1.resp, last: lastG1 && lastG1.text && lastG1.text.slice(0, 120) });

  await seed({ missionPlaybooks: { 'scoped-run': { guards: { extraBlockedKeywords: ['zzz-guard'] } } },
    mission: { id: 'scoped-run', step: 0, cycles: 0, startedAt: Date.now(), lastSentAt: 0, values: { project: 'zzz-guard', branch: 'main' } } });
  await waitEngine((p) => p.missionStep === 0, 8000, 'guard run applied');
  await waitQuiet();
  await sleep(1500); // a previous leg's verified advance can land late — settle before the baseline
  const stepBeforeG2 = (await enginePing()).missionStep;
  const typedBefore = (await sentList()).length;
  await waitQuiet();
  const rG2 = await fixtureMsg({ type: 'followup-send-now' });
  const typedAfter = (await sentList()).length;
  const pingG2 = await enginePing();
  check('G02-C. the per-playbook guard refuses BEFORE typing and the step does not advance',
    !!(rG2.resp && rG2.resp.ok === false && rG2.resp.reason === 'mission-guard') && typedAfter === typedBefore && pingG2.missionStep === stepBeforeG2,
    { resp: rG2.resp, typedBefore, typedAfter, stepBefore: stepBeforeG2, stepAfter: pingG2 && pingG2.missionStep });

  await seed({ missionPlaybooks: null, mission: { id: 'scoped-run', step: 0, cycles: 0, startedAt: Date.now(), lastSentAt: 0, values: { project: 'bad\u0007value', branch: 'main' } } });
  await sleep(1200);
  const pingG3 = await enginePing();
  check('G02-D. invalid stored values clear the mission (fail closed, nothing runs)',
    !!(pingG3 && pingG3.missionId === ''), { ping: pingG3 && { id: pingG3.missionId } });

  try { await send('Page.reload', {}, popSession); } catch { /* ignore */ }
  await sleep(900);
  await pEval(`(() => { const b = document.getElementById('misbtn'); if (b) b.click(); return 'ok'; })()`);
  await sleep(300);
  await pEval(`(() => { const rows = document.querySelectorAll('#misList [data-mid]'); for (const r of rows) if (r.dataset.mid === 'scoped-run') r.click(); return 'ok'; })()`);
  await sleep(400);
  const cfgG = await pEval(`({ open: !document.getElementById('misConfig').hidden, inputs: document.querySelectorAll('#misVariables input[data-var]').length, prev: (document.getElementById('misPreview').textContent || '') })`);
  check('G02-E. the mission sheet config renders the variables + a rendered preview',
    !!cfgG && cfgG.open === true && cfgG.inputs === 2 && /this project/.test(cfgG.prev) && !/\{\{/.test(cfgG.prev),
    { open: cfgG && cfgG.open, inputs: cfgG && cfgG.inputs, prev: cfgG && cfgG.prev && cfgG.prev.slice(0, 100) });

  check('z. fixture page saw no JS errors', fxErrors.length === 0, { fxErrors });

  results.checks = checks;
  results.verifyTimeouts = timeouts;
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
// Optional durable evidence: MAA_MIS_OUT=<path> writes the same JSON summary to a file (a
// TTY-scrollback-independent record for the run log / handover).
if (process.env.MAA_MIS_OUT) {
  try { fs.writeFileSync(path.resolve(process.env.MAA_MIS_OUT), JSON.stringify(results, null, 2)); } catch { /* ignore */ }
}
process.exit(results.ok ? 0 : 2);
