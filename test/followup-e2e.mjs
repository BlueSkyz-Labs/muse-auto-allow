#!/usr/bin/env node
/**
 * followup-e2e.mjs — runtime verification for the Auto follow-up engine
 * (v1.6.0 idle detection + guards, v1.7.0 phrase-library builder, composed
 * prompt and round-robin rotation) on a REAL Chromium. Same CDP lane as
 * test/e2e.mjs: installed Chrome (137+) via `Extensions.loadUnpacked`, scratch
 * profile only (NEVER the user's real profile), detached launch + profile-path
 * teardown. The extension is loaded from a TEMP COPY whose manifest additionally
 * matches http://127.0.0.1/* (and grants it as a host permission so the harness
 * can find the fixture tab) — the shipped manifest stays muse.ai-only.
 *
 * Fixture: test/followup-fixture.html — switcheable status ('is working'/'Connected'),
 * a composer (placeholder 'Message') + send recorder (window.__sent), and an
 * approval-card block for the guard case.
 *
 * Cases:
 *   0.  pre-flight: 6 locales key-identical; every popup.html i18n key exists (en);
 *       every literal t('key') in popup.js exists (en) except the declared
 *       fallback-only allowlist (ratchet: must not grow and must not go stale)
 *   0b. popup builder: section renders; quick combos; library sheet with 8 group
 *       tabs; legacy prompt rehydrates as custom text (no chips); two chips compose
 *       in LIBRARY order (click order must not matter); remove-chip; custom text
 *       appended as the last part; exact quick-combo strings; per-group save action
 *       appends the group's combo to the rotation (and rows show the source group);
 *       height <= 600px with an empty log, a full log and the sheet open; OVERFLOW
 *       probe with several phrases selected (sheet stays inside the popup, phrase
 *       area scrolls internally, every selected row keeps its ×, Preview visible)
 *   a.  nothing sent while 'is working'
 *   b0. idle observed but followupIdleMs not elapsed => nothing sent (live config)
 *   b.  after lowering the idle wait, the send fires with the EXACT COMPOSED prompt
 *       built in the popup, via the send button, React-safe input event fired,
 *       composer cleared, lastSentAt recorded (verified send)
 *   c.  no second send within followupCooldownMs; one fires only after the cooldown
 *   d.  followupEnabled=false => nothing sent
 *   e.  approval card present => idle send skipped (absolute priority); clearing it resumes
 *   f.  manual 'followup-send-now' skips the idle wait (fires while 'is working') and
 *       falls back to Enter when there is no send button
 *   g.  manual send respects the composer-not-empty guard; draft is preserved
 *   h.  'followup-status' ping answers {state, lastSentAt, rotateIdx, rotateCount}
 *   rot. round-robin rotation end-to-end, starting from the popup: 'Starter rotation'
 *        loads the 3 recommended combos, the saved list renders (with source-group tags)
 *        and a remove drops one; send #1 carries item 1, send #2 item 2, send #3 wraps
 *        back to item 1; the popup next-line follows the index; a BLOCKED send (approval
 *        card present) does not advance the index
 *   gs.  per-group save: each group's one-tap save appends exactly that group's composed
 *        phrases; the rotation sheet with 6 items scrolls internally and keeps every
 *        remove control reachable (owner overflow fix, measured)
 *   rot-falsify. mutation proof for the rotation checks: with the stored index forced to
 *        the previous send's value (what a non-advancing engine looks like) the next send
 *        REPEATS item 2 — i.e. the round-robin expectation goes RED; restoring the index
 *        resumes item 1 (GREEN)
 *   gh.  the owner-reported live GitHub card ("Allow Muse to perform this action on your
 *        GitHub account? Action Pull"): a standard Allow/Deny pair with the live option
 *        set (Allow once / Always allow / Deny) is approved — narrowest option only,
 *        never Deny, never a standing grant; the unmarked twin is approved by the pair
 *        heuristic; a LONE allow under the same title is never clicked; the prefixed
 *        pending variant expands and its pair is approved
 *   v18-A click gates (pre-reload):
 *        dry-run: detection runs, 'allow-dry' is logged, nothing is clicked — and turning
 *          dryRun off re-arms the SAME node (the real click fires);
 *        blocklist: a seed-keyword card ('delete') is NEVER clicked while the clean control
 *          on screen IS; a custom list replaces the seed ('banana' blocks on path B);
 *        topics: a case-insensitive exact match on extractTopic() clicks; a mismatch logs
 *          'blocked'/'topic' and never clicks; an empty list disables the gate;
 *        allow-once: mode OFF leaves 'Allow once only' alone; mode ON recognizes it and
 *          prefers one-shot options ('Allow once' over plain 'Allow'/'Allow always'); the
 *          legacy twin (mode OFF) clicks plain 'Allow' — the preference switch is proven;
 *        pause: no click while pauseUntil is in the future; clearing it resumes; the status
 *          ping carries paused/dryRun/allowOnceMode/scheduleAllowed
 *   v18-B follow-up gates (each group starts from a page reload: fresh 6/hour budget):
 *        pause: no send + manual send-now refused ('paused') + badge '||'; clearing resumes;
 *        schedule: outside [start,end) no send; inside (run-time computed, wrap-aware) the
 *          send fires; onlyActiveTab: no send while the fixture tab is a background tab
 *          (Target.activateTarget makes it genuinely hidden), fires again when visible;
 *        errorRecovery: off => nothing; on => the default prompt; the same text is never
 *          answered twice; a different text fires; after the error clears it fires again;
 *        stuck: stuckMin=0 => nothing; 0.05 min of silence => the default prompt; a custom
 *          stuckPrompt is honored; never while an approval card is present;
 *        dry-run (follow-up): 'followup-dry' logged, nothing typed/sent; real sends resume
 *          when dryRun turns off
 *   v18-C digest counters: clicks / blocked / followups recorded for the startup digest
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
// MAA_EXT_DIR lets a falsification run point the harness at a MUTATED copy of the extension
// (reverse-mutation proof: disable a guard -> the matching checks go RED; restore -> GREEN).
const EXT_DIR = process.env.MAA_EXT_DIR ? path.resolve(process.env.MAA_EXT_DIR) : path.join(ROOT, 'extension');
const IS_WIN = process.platform === 'win32';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Legacy custom prompt (no followupChips key): the popup must rehydrate it as custom
// text — schema-compatible, no migration needed.
const PROMPT_LEGACY = 'Continue implementation — follow best practices, Source of Truth, do your best';

// The phrase library (extension/popup.js) + composition rules under test. These are the
// EXACT strings the spec pins — the harness never derives them by calling popup code.
const CHIP_A = 'continue-full';
const CHIP_B = 'verify-evidence';
const P_A = 'Continue working until the task is fully complete';
const P_B = 'Verify before claiming done — run the tests and show the output';
const COMPOSED = P_A + '; ' + P_B + '.';                       // 2 chips: '; ' join + final period
const CUSTOM_TXT = 'Focus on the failing tests';
const COMPOSED_CUSTOM = P_A + '; ' + P_B + '; ' + CUSTOM_TXT + '.'; // custom appended as the last part
const LEGACY_PRESETS = [
  'Approve and continue working',
  'Continues implementation — working long-run',
  'follow best practice, Project Source of Truth, Do your best',
];
// STARTER_ROTATION (popup.js): [Continue+Verify], [Quality+Source-of-Truth], [Workflow+Commit]
const S1 = COMPOSED;
const S2 = 'Follow best practices (latest security standards); Project Source of Truth is authoritative — read AGENTS.md/docs first.';
const S3 = 'Commit and push with clear messages; Keep the PR/issue updated with status + evidence.';

// popup.js labels that predate the real-key policy and render from their fallback only.
// Ratchet: a new literal t('key') must have a REAL key, and a listed key that gains one
// must be removed from this list (both directions are asserted). EMPTY since v1.7.0 —
// every label (status pill, hints, gate note) now has a real key in all 6 locales.
const KNOWN_FALLBACK_ONLY = new Set([]);

// v1.8.0 probes (frozen contracts, docs/ENGINE_V18.md)
const V18_PROMPT = 'V18 follow-up probe — continue where you left off';
const STUCK_DEFAULT = 'Looks like you may be stuck — check the last error or continue where you left off.';
const ERROR_DEFAULT = 'An error occurred. Read the error, fix the root cause, then continue.';
const BLOCK_SEED = ['delete', 'remove', 'drop', 'wipe', 'format', 'billing', 'payment', 'invoice',
  'pay', 'transfer', 'refund', 'production', 'deploy', 'revoke', 'rm -rf', 'sudo',
  'credential', 'password', 'secret', 'token'];

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
  // every literal t('key') in popup.js must resolve in en (or be a declared legacy fallback)
  const js = fs.readFileSync(path.join(EXT_DIR, 'popup.js'), 'utf8');
  const usedJs = new Set();
  for (const m of js.matchAll(/t\(\s*'([A-Za-z0-9_]+)'/g)) usedJs.add(m[1]);
  const missingInJs = [...usedJs].filter((k) => !(k in en) && !KNOWN_FALLBACK_ONLY.has(k));
  const staleAllowlist = [...KNOWN_FALLBACK_ONLY].filter((k) => k in en);
  const followupKeys = enKeys.filter((k) => k.startsWith('followup'));
  return {
    localeCount: locales.length,
    mismatches,
    usedKeys: used.size,
    missingInHtml,
    usedJsKeys: usedJs.size,
    missingInJs,
    staleAllowlist,
    followupKeys,
    ok: locales.length === 6 && mismatches.length === 0 && missingInHtml.length === 0 &&
        missingInJs.length === 0 && staleAllowlist.length === 0 && followupKeys.length >= 30,
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
  '--lang=en-US', // pin the popup locale so the 'Next: i/n' assertions are stable
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
// v1.8.0: the engine's APPLIED config at each v18 gate (what the engine had actually taken in
// when the behaviour was measured) — recorded so a failure is diagnosable, never assumed.
const v18Applied = {};

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
// click elements through the popup's real event handlers
async function clickSel(sel) {
  return pEval(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true; })()`);
}
async function setTextarea(val) {
  return pEval(`(() => { const ta = document.getElementById('fprompt'); const d = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    d.set.call(ta, ${JSON.stringify(val)}); ta.dispatchEvent(new Event('input', { bubbles: true })); ta.dispatchEvent(new Event('change', { bubbles: true })); return ta.value; })()`);
}
// the popup must never exceed 600px: measure the lowest content edge relative to body top
async function popupHeight() {
  try {
    return JSON.parse(await pEval(`JSON.stringify((() => {
      const b = document.body;
      const foot = document.querySelector('.foot');
      const sect = document.getElementById('followupSect');
      return {
        total: Math.round(foot.getBoundingClientRect().bottom - b.getBoundingClientRect().top),
        sect: Math.round(sect.getBoundingClientRect().height),
        log: Math.round(document.getElementById('log').getBoundingClientRect().height)
      };
    })())`));
  } catch { return null; }
}
async function cardClicks() { const l = await fJSON('window.__cardClicks'); return Array.isArray(l) ? l : []; }
// the sheet's open view, read from the DOM ('' | 'library' | 'rotation') — toggling by
// guessing the current mode is how a harness ends up clicking into a hidden sheet.
async function sheetMode() {
  return pEval(`(document.getElementById('flibsheet')||{}).hidden ? '' : ((document.getElementById('fsheetRot')||{}).hidden ? 'library' : 'rotation')`);
}
async function ensureSheet(mode) {
  const cur = await sheetMode();
  if (cur === mode) return true;
  if (mode === 'library') await clickSel('#flibbtn');
  else if (mode === 'rotation') await clickSel('#frotnext');
  else await clickSel(cur === 'rotation' ? '#frotnext' : '#flibbtn');
  await sleep(200);
  return (await sheetMode()) === mode;
}
// Owner-reported overflow probe ("tràn mất lựa chọn"): with several phrases selected the
// sheet must stay inside the popup, the phrase area must own a bounded scroll (visible
// scrollbar) and every selected row must keep its × with the Preview always visible.
async function overflowProbe() {
  try {
    return JSON.parse(await pEval(`JSON.stringify((() => {
      const body = document.body;
      const sheet = document.getElementById('flibsheet');
      const chips = document.getElementById('fchips');
      const prev = document.querySelector('#flibsheet .fprev');
      const prevText = document.getElementById('fprevA');
      const foot = document.querySelector('.foot');
      const sel = Array.from(document.querySelectorAll('#fchips .chipbtn.on'));
      const bodyR = body.getBoundingClientRect();
      const shR = sheet.getBoundingClientRect();
      const chR = chips.getBoundingClientRect();
      const prR = prev ? prev.getBoundingClientRect() : null;
      const cs = getComputedStyle(chips);
      const last = sel.length ? sel[sel.length - 1] : null;
      const lx = last && last.querySelector('.x') ? last.querySelector('.x').getBoundingClientRect() : null;
      const lowest = Math.max(shR.bottom, foot ? foot.getBoundingClientRect().bottom : 0) - bodyR.top;
      return {
        lowestEdge: Math.round(lowest),
        visible: !sheet.hidden && shR.height > 10,
        sheetFitsPopup: shR.bottom <= bodyR.bottom + 0.5,
        sheetOverflow: getComputedStyle(sheet).overflow,
        chipsOverflowY: cs.overflowY,
        chipsMaxH: cs.maxHeight,
        chipsScrollable: chips.scrollHeight > chips.clientHeight + 1,
        chipsScrollTop: Math.round(chips.scrollTop),
        chipsScrollH: chips.scrollHeight,
        chipsClientH: chips.clientHeight,
        selCount: sel.length,
        selAllHaveX: sel.every((b) => !!b.querySelector('.x')),
        lastX: lx ? { insideX: lx.left >= chR.left - 0.5 && lx.right <= chR.right + 0.5,
                      insideY: lx.top >= chR.top - 0.5 && lx.bottom <= chR.bottom + 0.5,
                      w: Math.round(lx.width) } : null,
        prevVisible: !!prR && prR.bottom <= shR.bottom + 0.5 && prR.top >= shR.top - 0.5,
        prevTextLen: prevText ? String(prevText.textContent || '').length : 0
      };
    })())`));
  } catch { return null; }
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
// v1.8.0: a reload restarts the content script with a FRESH hourly-attempt budget (the hard
// 6/hour cap) and a fresh fixture — used to isolate each follow-up gate group below.
async function reloadFixture(tag) {
  try { await send('Page.reload', {}, fxSession); } catch { try { await fEval('location.reload()'); } catch { /* ignore */ } }
  await waitUntil(async () => (await fEval("document.documentElement.getAttribute('data-muse-auto-allow')")) === '1', 15000, 're-injection after reload (' + tag + ')');
  await sleep(500);
}
// v1.8.0: find a log entry by kind (optionally by blockedReason)
async function findLog(kind, reason) {
  const l = await popStore(['log']);
  return ((l && l.log) || []).find((x) => x && x.kind === kind && (reason === undefined || x.blockedReason === reason)) || null;
}
// v1.8.0: the popup page stays open for storage access and RE-COMPOSES followupPrompt from
// its chips whenever storage changes — so the v18 phases seed the chip state and read back
// the settled prompt, then assert the engine sends exactly that stored value.
async function settlePrompt(text) {
  await seed({ followupChips: [], followupPrompt: text });
  await sleep(700);
  const st = await popStore(['followupPrompt', 'followupChips']);
  return { prompt: st && st.followupPrompt, chips: st && st.followupChips };
}
// v1.8.0 RACE FIX (root cause of the flaky v18 phases): the content script takes settings in
// ASYNCHRONOUSLY (chrome.storage.onChanged) and samples DOM state on its own 1s heartbeat, so
// "seed then sleep N ms then assert" races the engine — a negative assertion (nothing clicked /
// nothing sent) can pass because the config was not applied YET, and a positive one can fail
// because the state was not sampled yet. Poll the ENGINE's own status (followup-status, which
// echoes the applied config) until it reports what was just seeded, then assert on behaviour.
async function enginePing() {
  const p = await fixtureMsg({ type: 'followup-status' });
  return (p && p.resp) || null;
}
async function waitEngine(pred, timeoutMs, label) {
  return waitUntil(async () => { const r = await enginePing(); return r && pred(r) ? r : null; }, timeoutMs, label);
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

  // ---- storage seeding + popup builder (an extension page can touch chrome.storage) ----
  const pop = await send('Target.createTarget', { url: `chrome-extension://${extId}/popup.html` });
  popSession = (await send('Target.attachToTarget', { targetId: pop.targetId, flatten: true })).sessionId;
  await sleep(1000);
  // legacy state first: a custom prompt with NO followupChips key.
  // v1.9.3: dryRun:false is stated EXPLICITLY — a fresh install now starts in dry-run
  // (logging-only) via the background migration, and every phase below asserts LIVE clicking
  // and LIVE follow-up sends, so the state the harness depends on must be written, not assumed.
  await seed({ enabled: true, followupEnabled: true, followupPrompt: PROMPT_LEGACY, followupIdleMs: 400, followupCooldownMs: 1500, dryRun: false });
  await sleep(700); // let the popup's storage.onChanged refresh land
  const popCheck = JSON.parse(await pEval(`JSON.stringify({
    sect: !!document.getElementById('followupSect'),
    toggle: !!document.getElementById('followupEnabled'),
    send: !!document.getElementById('fsendnow'),
    sendDisabled: !!(document.getElementById('fsendnow') || {}).disabled,
    quickBtns: ['fq0', 'fq1', 'fq2'].filter((id) => document.getElementById(id)).length,
    libBtn: !!document.getElementById('flibbtn'),
    sheetClosed: !!(document.getElementById('flibsheet') || {}).hidden,
    taVal: (document.getElementById('fprompt') || {}).value,
    prev: (document.getElementById('fprevB') || {}).textContent,
    idleVal: (document.getElementById('fidle') || {}).value,
    quickOn: document.querySelectorAll('.fquick .qbtn.on').length
  })`));
  results.popup = popCheck;
  check('0b. popup. follow-up section renders with toggle + send-now', !!(popCheck.sect && popCheck.toggle && popCheck.send), popCheck);
  check('0b. popup. send-now enabled while the feature is on', popCheck.sendDisabled === false, { sendDisabled: popCheck.sendDisabled });
  check('0b. popup. quick-combo row has 3 one-tap buttons + library trigger', popCheck.quickBtns === 3 && popCheck.libBtn === true && popCheck.sheetClosed === true, popCheck);
  check('0b. popup. legacy prompt rehydrates as custom text (no chips), preview shows it',
    popCheck.taVal === PROMPT_LEGACY && popCheck.prev === PROMPT_LEGACY && popCheck.quickOn === 0,
    { taVal: popCheck.taVal, prev: popCheck.prev, quickOn: popCheck.quickOn });
  check('0b. popup. idle ms mapped to seconds', popCheck.idleVal === '1', { idleVal: popCheck.idleVal });

  // The legacy prompt rehydrated into the CUSTOM field (asserted above). The chip-composition
  // phase starts from an EMPTY custom field — clearing it is the honest user gesture, and with
  // no chips selected the popup keeps the engine prompt at preset 1 (never promptless).
  await setTextarea('');
  await waitUntil(async () => ((await popStore(['followupPrompt'])) || {}).followupPrompt === LEGACY_PRESETS[0], 3000, 'legacy custom cleared');

  // the library sheet: open it through the real trigger, check the 8 groups + chips
  await clickSel('#flibbtn');
  await sleep(250);
  const lib = JSON.parse(await pEval(`JSON.stringify({
    open: !(document.getElementById('flibsheet') || {}).hidden,
    libMode: !(document.getElementById('fsheetLib') || {}).hidden,
    tabs: document.querySelectorAll('#ftabs .ftab').length,
    chipsStart: document.querySelectorAll('#fchips .chipbtn').length,
    hint: (document.querySelector('#flibsheet .fbighint') || {}).textContent || '',
    aria: document.getElementById('flibbtn').getAttribute('aria-expanded')
  })`));
  results.library = lib;
  check('0b. popup. library sheet opens with 8 group tabs (default group chips visible)',
    lib.open && lib.libMode && lib.tabs === 8 && lib.chipsStart >= 3 && lib.aria === 'true', lib);
  await clickSel('#ftabs .ftab[data-g="verify"]');
  await sleep(150);
  const verifyChips = JSON.parse(await pEval(`JSON.stringify({ n: document.querySelectorAll('#fchips .chipbtn').length,
    hasB: !!document.querySelector('#fchips .chipbtn[data-c="verify-evidence"]') })`));
  check('0b. popup. selecting a group tab swaps the chip list', verifyChips.n >= 3 && verifyChips.hasB === true, verifyChips);

  // compose two chips in REVERSE click order: the stored prompt must use LIBRARY order
  await clickSel('#fchips .chipbtn[data-c="verify-evidence"]');
  await sleep(150);
  await clickSel('#ftabs .ftab[data-g="continue"]');
  await sleep(150);
  await clickSel('#fchips .chipbtn[data-c="continue-full"]');
  await sleep(350);
  const chipState = JSON.parse(await pEval(`JSON.stringify({
    prev: (document.getElementById('fprevB') || {}).textContent,
    prevSheet: (document.getElementById('fprevA') || {}).textContent,
    sel: Array.from(document.querySelectorAll('#fchips .chipbtn.on')).map((b) => b.dataset.c),
    count: (document.getElementById('flibcount') || {}).hidden ? null : (document.getElementById('flibcount') || {}).textContent
  })`));
  const store1 = await popStore(['followupPrompt', 'followupChips']);
  results.composed = { preview: chipState.prev, stored: store1 };
  check('0b. popup. two chips compose in LIBRARY order into storage + preview',
    chipState.prev === COMPOSED && chipState.prevSheet === COMPOSED && chipState.count === '2' &&
    store1.followupPrompt === COMPOSED && JSON.stringify(store1.followupChips) === JSON.stringify([CHIP_A, CHIP_B]),
    { chipState, store1 });
  check('0b. popup. the open group tab marks its selected chip', chipState.sel.length === 1 && chipState.sel[0] === CHIP_A,
    { sel: chipState.sel }); // the CONTINUE tab is open: only its selected chip is rendered there

  // remove-chip affordance: clicking the selected chip again drops it from the composition
  await clickSel('#ftabs .ftab[data-g="verify"]');
  await sleep(150);
  await clickSel('#fchips .chipbtn[data-c="verify-evidence"]');
  await sleep(350);
  const store2 = await popStore(['followupPrompt', 'followupChips']);
  const prev2 = await pEval(`(document.getElementById('fprevB') || {}).textContent`);
  check('0b. popup. re-clicking a chip removes it from the composed prompt',
    store2.followupPrompt === P_A && JSON.stringify(store2.followupChips) === JSON.stringify([CHIP_A]) && prev2 === P_A,
    { store2, prev2 });
  await clickSel('#fchips .chipbtn[data-c="verify-evidence"]'); // re-add for the engine phase
  await sleep(350);
  const store3 = await popStore(['followupPrompt', 'followupChips']);
  check('0b. popup. re-adding the chip restores the full composition', store3.followupPrompt === COMPOSED, { store3 });

  // custom text appends as the last part of the composition
  await setTextarea(CUSTOM_TXT);
  await waitUntil(async () => ((await popStore(['followupPrompt'])) || {}).followupPrompt === COMPOSED_CUSTOM, 3000, 'custom composed write');
  const store4 = await popStore(['followupPrompt', 'followupChips']);
  const prev4 = await pEval(`(document.getElementById('fprevB') || {}).textContent`);
  check('0b. popup. custom text is appended to the composed prompt', store4.followupPrompt === COMPOSED_CUSTOM && prev4 === COMPOSED_CUSTOM, { store4, prev4 });
  await setTextarea('');
  await waitUntil(async () => ((await popStore(['followupPrompt'])) || {}).followupPrompt === COMPOSED, 3000, 'custom cleared write');
  check('0b. popup. clearing the custom text restores the chip-only composition',
    ((await popStore(['followupPrompt'])) || {}).followupPrompt === COMPOSED, {});

  // quick combos: one tap = the exact legacy preset string, chips cleared
  await clickSel('#fq1');
  await sleep(350);
  const quickState = JSON.parse(await pEval(`JSON.stringify({
    prev: (document.getElementById('fprevB') || {}).textContent,
    on: (document.getElementById('fq1') || {}).getAttribute('aria-pressed')
  })`));
  const store5 = await popStore(['followupPrompt', 'followupChips']);
  check('0b. popup. quick combo sets the exact legacy preset string (chips cleared)',
    store5.followupPrompt === LEGACY_PRESETS[1] && JSON.stringify(store5.followupChips) === '[]' &&
    quickState.prev === LEGACY_PRESETS[1] && quickState.on === 'true',
    { store5, quickState });

  // rebuild the two-chip state (the quick combo cleared it) for the engine phase
  await clickSel('#flibbtn');
  await sleep(200);
  await clickSel('#ftabs .ftab[data-g="verify"]');
  await sleep(150);
  await clickSel('#fchips .chipbtn[data-c="verify-evidence"]');
  await sleep(150);
  await clickSel('#ftabs .ftab[data-g="continue"]');
  await sleep(150);
  await clickSel('#fchips .chipbtn[data-c="continue-full"]');
  await sleep(350);
  const store6 = await popStore(['followupPrompt', 'followupChips']);
  check('0b. popup. engine-phase prompt is the composed chip prompt', store6.followupPrompt === COMPOSED, { store6 });
  // close the sheet so the next height checks measure the default state
  await clickSel('#flibbtn');
  await sleep(200);

  // ---- popup height discipline (W1: the whole popup stays <= 600px) ----
  const hEmpty = await popupHeight();
  check('0b. popup. height <= 600px with an empty log', !!hEmpty && hEmpty.total <= 600, hEmpty);
  await seed({ log: Array.from({ length: 12 }, (_, i) => ({ kind: 'allow', label: 'Allow ' + i, context: 'context line ' + i, at: new Date(Date.now() - i * 60000).toISOString() })) });
  await sleep(900);
  const hFull = await popupHeight();
  check('0b. popup. height <= 600px with a full click log', !!hFull && hFull.total <= 600, hFull);
  await clickSel('#flibbtn'); // sheet open overlays the panel: height must not grow
  await sleep(250);
  const hSheet = await popupHeight();
  check('0b. popup. height <= 600px with the library sheet open', !!hSheet && hSheet.total <= 600, hSheet);
  await clickSel('#flibbtn');
  await sleep(200);
  results.height = { empty: hEmpty, full: hFull, sheet: hSheet };

  // ---- owner overflow fix ("tràn mất lựa chọn"), measured in the live popup ----
  // Select the whole CONTINUE group (4 phrases) — the reported "several phrases selected"
  // state. The sheet must stay inside the popup, the phrase area must own a bounded internal
  // scroll, every selected row must keep its × (the last one reachable) and the Preview must
  // stay visible. The 2-chip engine prompt is restored right after the probe.
  await ensureSheet('library');
  await sleep(250);
  for (const id of ['continue-noask', 'continue-longrun', 'continue-next']) {
    await clickSel('#fchips .chipbtn[data-c="' + id + '"]');
    await sleep(120);
  }
  const ov1 = await overflowProbe();
  if (ov1 && ov1.chipsScrollable) {
    await pEval(`(() => { const c = document.getElementById('fchips'); c.scrollTop = c.scrollHeight; return true; })()`);
    await sleep(150);
  }
  const ov2 = await overflowProbe();
  results.overflow = { before: ov1, after: ov2 };
  check('0b. popup. overflow: sheet + lowest content stay inside the popup, phrase area owns a bounded internal scroll',
    !!ov2 && ov2.visible === true && ov2.lowestEdge <= 600 && ov2.sheetFitsPopup === true &&
    (!ov2.chipsScrollable || ov2.chipsOverflowY === 'auto') && /px$/.test(String(ov2.chipsMaxH)),
    ov2);
  check('0b. popup. overflow: every selected phrase keeps its × (last row reachable) + Preview visible',
    !!ov2 && ov2.visible === true && ov2.selCount >= 4 && ov2.selAllHaveX === true && !!ov2.lastX &&
    ov2.lastX.insideX === true && ov2.lastX.insideY === true && ov2.prevVisible === true && ov2.prevTextLen > 0,
    ov2);
  for (const id of ['continue-noask', 'continue-longrun', 'continue-next']) { // restore the 2-chip state
    await clickSel('#fchips .chipbtn[data-c="' + id + '"]');
    await sleep(120);
  }
  await ensureSheet(''); // close the sheet
  await sleep(200);
  const storeOv = await popStore(['followupPrompt', 'followupChips']);
  check('0b. popup. overflow: the 2-chip engine prompt survives the probe',
    storeOv.followupPrompt === COMPOSED && JSON.stringify(storeOv.followupChips) === JSON.stringify([CHIP_A, CHIP_B]), { storeOv });

  // ---- fixture ----
  const fx = await send('Target.createTarget', { url: fixtureUrl });
  const fxTargetId = fx.targetId; // v1.8.0: kept for tab-activation (onlyActiveTab case)
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
    check('b. the EXACT COMPOSED prompt (chips in library order) is typed + submitted',
      got1[0].text === COMPOSED, { text: got1[0].text, expected: COMPOSED });
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
  // The engine refuses a manual send-now while a send is in flight (reason 'sending').
  // Case (e) has just fired an automatic send, so wait for that lock to clear — polling the
  // engine's own in-memory state — instead of racing it with a fixed sleep.
  await waitUntil(async () => {
    const p = await fixtureMsg({ type: 'followup-status' });
    return (p && p.resp && p.resp.sending === false) ? true : null;
  }, 8000, 'send lock cleared');
  const rF = await fixtureMsg({ type: 'followup-send-now' });
  check('f. manual send-now accepted (attempt started)', !!(rF.resp && rF.resp.ok === true), rF);
  const gotF = await waitUntil(async () => { const l = await sentList(); return l.length > baseF ? l : null; }, 6000, 'manual send');
  check('f. manual send fires while Muse reports working (idle wait skipped)', !!gotF, {});
  if (gotF && gotF[baseF]) {
    check('f. manual send carries the exact composed prompt', gotF[baseF].text === COMPOSED, { text: gotF[baseF].text });
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

  // ---- h. status ping shape (now also carries the rotation position) ----
  const stH = await fixtureMsg({ type: 'followup-status' });
  check('h. followup-status answers {state, lastSentAt, rotateIdx, rotateCount}',
    !!(stH.resp && typeof stH.resp.state === 'string' && Number(stH.resp.lastSentAt) > 0 &&
       typeof stH.resp.rotateIdx === 'number' && typeof stH.resp.rotateCount === 'number' &&
       stH.resp.rotateCount === 0 && stH.resp.rotateIdx === 0), stH);
  const attrH = await fEval("document.documentElement.getAttribute('data-muse-followup')");
  check('h. engine still reports working after the manual send', attrH === 'working', { attrH });

  // ======================================================================
  // rot. round-robin rotation — the popup loads the starter set, the engine rotates
  // ======================================================================
  // popup side: one tap on 'Starter rotation' loads the 3 recommended combos
  await clickSel('#frotstarter');
  await sleep(400);
  const rotStore = await popStore(['followupPrompts', 'followupRotateIdx']);
  const rotNext1 = await pEval(`(document.getElementById('frotnext') || {}).textContent || ''`);
  check('rot. starter rotation loads the 3 recommended combos + Next 1/3',
    JSON.stringify(rotStore.followupPrompts) === JSON.stringify([S1, S2, S3]) && rotStore.followupRotateIdx === 0 && /1\/3/.test(rotNext1),
    { rotStore, rotNext1 });
  // the saved list renders rows; removing one leaves 2 items
  await clickSel('#frotnext');
  await sleep(250);
  const rotRows = await pEval(`document.querySelectorAll('#frotitems .froti').length`);
  const rotSrc = await pEval(`JSON.stringify(Array.from(document.querySelectorAll('#frotitems .froti .src')).map((s) => s.textContent))`);
  check('rot. rotation rows show their source group (starter: Continue+Verify / Quality / Workflow)',
    rotSrc === JSON.stringify(['Continue+Verify', 'Quality', 'Workflow']), { rotSrc });
  await clickSel('#frotitems .froti [data-rm="2"]');
  await sleep(350);
  const rotStore2 = await popStore(['followupPrompts', 'followupRotateIdx']);
  check('rot. saved list shows 3 rows; a remove leaves 2',
    rotRows === 3 && JSON.stringify(rotStore2.followupPrompts) === JSON.stringify([S1, S2]),
    { rotRows, rotStore2 });
  await clickSel('#frotnext'); // close the sheet again
  await sleep(200);
  const rotNext2 = await pEval(`(document.getElementById('frotnext') || {}).textContent || ''`);
  check('rot. next-line shows 1/2 for the remaining pair', /1\/2/.test(rotNext2), { rotNext2 });

  // engine side: 2 items + small cooldown => item1, item2, wrap back to item1
  await seed({ followupIdleMs: 400, followupCooldownMs: 1200, followupEnabled: true });
  const rotBase = (await sentList()).length;
  await fEval("window.__setState('idle')");
  const rot1 = await waitUntil(async () => { const l = await sentList(); return l.length > rotBase ? l : null; }, 9000, 'rotation send 1');
  check('rot. send #1 carries the exact item 1', !!(rot1 && rot1[rotBase] && rot1[rotBase].text === S1), { text: rot1 && rot1[rotBase] ? rot1[rotBase].text : null });
  if (rot1) await waitSendVerified(rot1[rotBase].t, 'rotation send 1 verified');
  const rotPing1 = await fixtureMsg({ type: 'followup-status' });
  check('rot. ping reports rotateIdx/rotateCount after a verified send',
    !!(rotPing1.resp && rotPing1.resp.rotateCount === 2 && rotPing1.resp.rotateIdx === 1), rotPing1);
  const nextLine = await waitUntil(async () => {
    const tx = await pEval(`(document.getElementById('frotnext') || {}).textContent || ''`);
    return /2\/2/.test(tx) ? tx : null;
  }, 6000, 'popup next-line after send 1');
  check('rot. popup next-line follows the engine index', !!nextLine, { nextLine });
  const rot2 = await waitUntil(async () => { const l = await sentList(); return l.length > rotBase + 1 ? l : null; }, 9000, 'rotation send 2');
  check('rot. send #2 carries the exact item 2', !!(rot2 && rot2[rotBase + 1] && rot2[rotBase + 1].text === S2), { text: rot2 && rot2[rotBase + 1] ? rot2[rotBase + 1].text : null });
  if (rot2) await waitSendVerified(rot2[rotBase + 1].t, 'rotation send 2 verified');
  const rot3 = await waitUntil(async () => { const l = await sentList(); return l.length > rotBase + 2 ? l : null; }, 9000, 'rotation send 3 (wrap)');
  check('rot. send #3 wraps back to item 1', !!(rot3 && rot3[rotBase + 2] && rot3[rotBase + 2].text === S1), { text: rot3 && rot3[rotBase + 2] ? rot3[rotBase + 2].text : null });
  if (rot3) await waitSendVerified(rot3[rotBase + 2].t, 'rotation send 3 verified');

  // a BLOCKED send must not advance the index: approval card present, wait past idle+cooldown
  const idxBefore = await fixtureMsg({ type: 'followup-status' });
  const sentBefore = (await sentList()).length;
  await fEval("window.__setApproval(true)");
  await sleep(3200);
  const sentAfter = (await sentList()).length;
  await fEval("window.__setApproval(false)");
  const idxAfter = await fixtureMsg({ type: 'followup-status' });
  check('rot. a blocked send (approval present) does not advance the index',
    sentAfter === sentBefore &&
    !!(idxBefore.resp && idxAfter.resp && idxAfter.resp.rotateIdx === idxBefore.resp.rotateIdx && idxAfter.resp.rotateCount === 2),
    { sentBefore, sentAfter, before: idxBefore.resp, after: idxAfter.resp });

  // ======================================================================
  // gs. per-group save — one tap per chip group appends THAT group's combo to the rotation
  // (follow-up stays ENABLED so the panel is not gated and the sheet stays open for the
  // visual measurements; the engine's sends here are irrelevant — the falsify phase reloads)
  // ======================================================================
  await seed({ followupEnabled: true, followupPrompts: [], followupRotateIdx: 0 });
  await sleep(400);
  const GS = [
    ['verify', 'Verify before claiming done — run the tests and show the output'],
    ['quality', 'Follow best practices (latest security standards)'],
    ['workflow', 'Commit and push with clear messages'],
    ['scope', 'Stay within task scope — do not touch unrelated files'],
    ['report', 'Reply concisely: what changed, evidence, next steps'],
    ['security', 'Security first — threat-model and think in attack chains'],
  ];
  const gsTrace = [];
  for (const [g] of GS) {
    await ensureSheet('library'); // deterministic: never toggle into a hidden sheet
    await clickSel('#ftabs .ftab[data-g="' + g + '"]');
    await sleep(150);
    const hasSel = await pEval(`document.querySelectorAll('#fchips .chipbtn.on').length > 0`);
    if (!hasSel) { await clickSel('#fchips .chipbtn'); await sleep(250); } // select the group's first phrase
    const before = await pEval(`JSON.stringify({ mode: (document.getElementById('flibsheet')||{}).hidden ? 'closed' : ((document.getElementById('fsheetRot')||{}).hidden ? 'library' : 'rotation'),
      tab: (document.querySelector('#ftabs .ftab.on')||{}).textContent || '', disabled: !!(document.getElementById('fgsave')||{}).disabled,
      sel: document.querySelectorAll('#fchips .chipbtn.on').length })`);
    await clickSel('#fgsave');
    await sleep(400);
    const after = await popStore(['followupPrompts']);
    gsTrace.push({ g, before: JSON.parse(before), listLen: (after.followupPrompts || []).length, last: (after.followupPrompts || []).slice(-1)[0] || null });
  }
  results.gsTrace = gsTrace;
  const gsStore = await popStore(['followupPrompts']);
  check('gs. per-group save appends exactly that group\'s composed combo (one tap each)',
    JSON.stringify(gsStore.followupPrompts) === JSON.stringify(GS.map((x) => x[1])), { got: gsStore.followupPrompts, trace: gsTrace });
  // the action is enabled only while the open group has a selection
  await ensureSheet('library');
  await clickSel('#ftabs .ftab[data-g="design"]');
  await sleep(150);
  const gsNoSel = await pEval(`!!(document.getElementById('fgsave')||{}).disabled`);
  await clickSel('#ftabs .ftab[data-g="verify"]');
  await sleep(150);
  const gsHasSel = await pEval(`!!(document.getElementById('fgsave')||{}).disabled`);
  check('gs. save is enabled only when the open group has a selection', gsNoSel === true && gsHasSel === false, { gsNoSel, gsHasSel });
  // the rotation sheet with 6 items: bounded internal scroll, every remove control reachable
  const rotProbeJs = `JSON.stringify((() => {
    const box = document.getElementById('frotitems');
    const sheet = document.getElementById('flibsheet');
    const body = document.body;
    const rows = Array.from(box.querySelectorAll('.froti'));
    const rm = rows.length ? rows[rows.length - 1].querySelector('.rm') : null;
    const r0 = rm ? rm.getBoundingClientRect() : null;
    const bR = box.getBoundingClientRect();
    return { rows: rows.length, src: rows.map((r) => (r.querySelector('.src') || {}).textContent || ''),
             visible: !sheet.hidden && sheet.getBoundingClientRect().height > 10,
             scrollable: box.scrollHeight > box.clientHeight + 1, overflowY: getComputedStyle(box).overflowY,
             lastRm: r0 ? { inside: r0.left >= bR.left - 0.5 && r0.right <= bR.right + 0.5 && r0.top >= bR.top - 0.5 && r0.bottom <= bR.bottom + 0.5 } : null,
             sheetFits: sheet.getBoundingClientRect().bottom <= body.getBoundingClientRect().bottom + 0.5,
             lowest: Math.round(sheet.getBoundingClientRect().bottom - body.getBoundingClientRect().top) };
  })())`;
  await ensureSheet('rotation'); // open the rotation view deterministically
  await sleep(250);
  const rotP1 = JSON.parse(await pEval(rotProbeJs));
  if (rotP1.scrollable) {
    await pEval(`(() => { const b = document.getElementById('frotitems'); b.scrollTop = b.scrollHeight; return true; })()`);
    await sleep(150);
  }
  const rotP2 = JSON.parse(await pEval(rotProbeJs));
  results.rotSheet = { before: rotP1, after: rotP2 };
  check('gs. rotation sheet: 6 tagged rows, bounded internal scroll, sheet inside the popup (measured open)',
    rotP2.visible === true && rotP2.rows === 6 &&
    JSON.stringify(rotP2.src) === JSON.stringify(['Verify', 'Quality', 'Workflow', 'Scope', 'Report', 'Security']) &&
    (!rotP2.scrollable || rotP2.overflowY === 'auto') && rotP2.sheetFits === true && rotP2.lowest > 0 && rotP2.lowest <= 600, rotP2);
  check('gs. rotation sheet: the last remove control stays reachable after the internal scroll',
    !!rotP2.lastRm && rotP2.lastRm.inside === true, { lastRm: rotP2.lastRm });
  await ensureSheet(''); // close the sheet
  await sleep(200);

  // ======================================================================
  // rot-falsify. mutation proof: force the stored index to the value that produced the
  // previous send (what an engine that does NOT advance looks like) => the next send
  // REPEATS the item and the round-robin expectation goes RED; restoring resumes (GREEN).
  // ======================================================================
  await seed({ followupEnabled: false }); // disarm before the reload so the boot cannot send
  try { await send('Page.reload', {}, fxSession); } catch { try { await fEval('location.reload()'); } catch { /* ignore */ } }
  await waitUntil(async () => (await fEval("document.documentElement.getAttribute('data-muse-auto-allow')")) === '1', 15000, 're-injection after reload (falsify)');
  await sleep(600);
  await fEval("window.__setState('idle')");
  await seed({ followupPrompts: [S1, S2], followupRotateIdx: 1, followupIdleMs: 400, followupCooldownMs: 1200 });
  const fBase = (await sentList()).length;
  await seed({ followupEnabled: true });
  const f1 = await waitUntil(async () => { const l = await sentList(); return l.length > fBase ? l : null; }, 9000, 'falsify send A');
  check('rot-falsify. baseline: idx 1 => the next send is item 2 (GREEN)',
    !!(f1 && f1[fBase] && f1[fBase].text === S2), { text: f1 && f1[fBase] ? f1[fBase].text : null });
  if (f1) await waitSendVerified(f1[fBase].t, 'falsify send A verified');
  // The engine's own advance write must SETTLE before the mutation forces the index: the
  // content script (fixture tab) and the popup page write from different renderer processes,
  // so an unsettled engine write could land after the forced seed (cross-context race —
  // observed once in this round; the settle wait removes it).
  await waitUntil(async () => ((await popStore(['followupRotateIdx'])) || {}).followupRotateIdx === 0, 4000, 'rotation advance settled');
  // MUTATION — the index is frozen at the previous send's value: a correct engine would now
  // send item 1, so seeing item 2 again is exactly the RED state of the rotation assertion.
  await seed({ followupRotateIdx: 1 });
  const f2 = await waitUntil(async () => { const l = await sentList(); return l.length > fBase + 1 ? l : null; }, 9000, 'falsify send B (mutated)');
  const f2text = f2 && f2[fBase + 1] ? f2[fBase + 1].text : null;
  check('rot-falsify. mutation (index forced) REPEATS item 2 — the round-robin check goes RED',
    f2text === S2, { text: f2text, note: 'expected-next was S1 — a non-advancing index makes the rotation assertion fail (RED)' });
  if (f2) await waitSendVerified(f2[fBase + 1].t, 'falsify send B verified');
  // RESTORE — the engine's own advance rule stands again => item 1 (GREEN)
  await seed({ followupRotateIdx: 0 });
  const f3 = await waitUntil(async () => { const l = await sentList(); return l.length > fBase + 2 ? l : null; }, 9000, 'falsify send C (restored)');
  check('rot-falsify. restore => rotation resumes with item 1 (GREEN)',
    !!(f3 && f3[fBase + 2] && f3[fBase + 2].text === S1), { text: f3 && f3[fBase + 2] ? f3[fBase + 2].text : null });
  if (f3) await waitSendVerified(f3[fBase + 2].t, 'falsify send C verified');
  const fPing = await fixtureMsg({ type: 'followup-status' });
  check('rot-falsify. the list itself stayed intact through the mutation (rotateCount 2)',
    !!(fPing.resp && fPing.resp.rotateCount === 2), fPing);

  // ======================================================================
  // gh. the owner-reported live GitHub card — a standard Allow/Deny pair with the live
  // option set; approved on the narrowest option only, never Deny, never a standing grant.
  // ======================================================================
  await seed({ followupEnabled: false }); // isolate the click engine
  await fEval("window.__setGh('card')");
  const gh1 = await waitUntil(async () => { const c = await cardClicks(); return c.some((x) => x.n === 'gh-allow-once') ? c : null; }, 8000, 'gh card allow click');
  check('gh. the reported card is approved — "Allow once" clicked', !!gh1, { clicks: (gh1 || []).map((x) => x.n) });
  await sleep(1500); // a lingering card must not escalate to a broader option
  const ghNames = (await cardClicks()).map((x) => x.n);
  check('gh. never clicks Deny and never escalates to "Always allow"',
    !ghNames.includes('gh-deny') && !ghNames.includes('gh-always'), { clicks: ghNames });
  await fEval("window.__setGh('pair')");
  const gh2 = await waitUntil(async () => { const c = await cardClicks(); return c.some((x) => x.n === 'gh-pair-allow-once') ? c : null; }, 8000, 'gh pair allow click');
  check('gh. the unmarked twin is approved by the pair heuristic too', !!gh2, { clicks: (gh2 || []).map((x) => x.n) });
  await fEval("window.__setGh('lone')");
  await sleep(2500);
  const ghLoneNames = (await cardClicks()).map((x) => x.n);
  check('gh. a lone allow under the same title is NEVER clicked (pair rail)',
    !ghLoneNames.includes('gh-lone'), { clicks: ghLoneNames });
  await fEval("window.__setGh('pending')");
  const gh3 = await waitUntil(async () => { const c = await cardClicks(); return c.some((x) => x.n === 'gh-pending-expand') ? c : null; }, 8000, 'gh pending expand');
  const gh4 = await waitUntil(async () => { const c = await cardClicks(); return c.some((x) => x.n === 'gh-pending-allow') ? c : null; }, 8000, 'gh pending pair approved');
  check('gh. the prefixed pending card expands and its pair is approved', !!gh3 && !!gh4,
    { clicks: (gh4 || []).map((x) => x.n) });
  await fEval("window.__setGh('off')");
  results.ghClicks = (await cardClicks()).map((x) => x.n);

  // ======================================================================
  // v18-A. CLICK gates — dry-run / blocklist / topics / allow-once / pause
  // (follow-up engine disabled so only the click paths are in play; config is always
  //  seeded BEFORE a probe card is shown, so the probe can never be clicked by a race)
  // ======================================================================
  await seed({ followupEnabled: false, pauseUntil: 0, dryRun: false, allowOnceMode: false,
    rules: { allowTopics: [], blockKeywords: BLOCK_SEED },
    followupSchedule: { enabled: false, start: 8, end: 18, onlyActiveTab: false },
    followupSmart: { stuckMin: 0, errorRecovery: false },
    onboarded: true }); // UI-only key: the whole v18-A phase runs with it set and must not care
  // RACE FIX: confirm the engine took the base config in before any probe card is shown
  await waitEngine((r) => r.paused === false && r.dryRun === false && r.allowOnceMode === false, 6000, 'v18-A base config applied');
  await sleep(400);

  // ---- dry-run: detection + 'allow-dry' log, NO click; toggling off re-arms the node ----
  await seed({ dryRun: true });
  await waitEngine((r) => r.dryRun === true, 6000, 'dryRun on applied'); // RACE FIX: applied before the probe shows
  await fEval("window.__setV18('dry')");
  const dryEntry = await waitUntil(async () => findLog('allow-dry'), 9000, 'allow-dry log entry');
  check('v18 dry-run. detection runs: log entry kind "allow-dry" with dryRun:true', !!dryEntry && dryEntry.dryRun === true, { entry: dryEntry });
  await sleep(1500);
  const dryNames = (await cardClicks()).map((x) => x.n);
  check('v18 dry-run. the card is NOT clicked while dryRun is on', !dryNames.includes('v18-dry-allow') && !dryNames.includes('v18-dry-deny'), { names: dryNames });
  await seed({ dryRun: false });
  const dryHit = await waitUntil(async () => { const c = await cardClicks(); return c.some((x) => x.n === 'v18-dry-allow') ? c : null; }, 12000, 'click after dryRun off');
  check('v18 dry-run. dryRun off re-arms the SAME node — the real click fires', !!dryHit, { clicks: (dryHit || []).map((x) => x.n) });
  await fEval("window.__setV18('off')");

  // ---- blocklist: seed keyword never clicked (dangerous + clean control on screen), custom list replaces the seed ----
  await fEval("window.__setV18('both')");
  const blEntry = await waitUntil(async () => findLog('blocked', 'keyword:delete'), 9000, 'blocked keyword:delete');
  check('v18 blocklist. seed keyword in the card text logs kind "blocked" + blockedReason "keyword:delete"', !!blEntry, { entry: blEntry });
  const cleanHit = await waitUntil(async () => { const c = await cardClicks(); return c.some((x) => x.n === 'v18-clean-allow') ? c : null; }, 9000, 'clean control clicked');
  check('v18 blocklist. the clean control card is still approved while the dangerous one is on screen', !!cleanHit, {});
  await sleep(1500);
  const blNames = (await cardClicks()).map((x) => x.n);
  check('v18 blocklist. the dangerous card is NEVER clicked (no allow, no deny)',
    !blNames.includes('v18-blocked-allow') && !blNames.includes('v18-blocked-deny'), { names: blNames.filter((n) => /blocked|clean/.test(n)) });
  await fEval("window.__setV18('off')");
  await seed({ rules: { allowTopics: [], blockKeywords: ['banana'] } });
  await waitEngine((r) => r.blockKeywords.includes('banana'), 6000, 'custom blocklist applied'); // RACE FIX
  await fEval("window.__setV18('banana')");
  const bananaEntry = await waitUntil(async () => findLog('blocked', 'keyword:banana'), 9000, 'blocked keyword:banana');
  check('v18 blocklist. a custom list replaces the seed — its own keyword blocks (path B too)', !!bananaEntry, { entry: bananaEntry });
  await sleep(1500);
  const bananaNames = (await cardClicks()).map((x) => x.n);
  check('v18 blocklist. the banana card is never clicked', !bananaNames.includes('v18-banana-allow') && !bananaNames.includes('v18-banana-deny'), { names: bananaNames });
  await fEval("window.__setV18('off')");

  // ---- topics: non-empty allowTopics => click ONLY on an exact (case-insensitive) match ----
  await seed({ rules: { allowTopics: ['TOPIC-OK'], blockKeywords: [] } });
  await waitEngine((r) => r.allowTopics.includes('TOPIC-OK') && r.blockKeywords.length === 0, 6000, 'topic whitelist applied'); // RACE FIX
  await fEval("window.__setV18('topicOk')");
  const topicOkHit = await waitUntil(async () => { const c = await cardClicks(); return c.some((x) => x.n === 'v18-topic-ok-allow') ? c : null; }, 9000, 'topic-ok clicked');
  check('v18 topics. matching extractTopic() (case-insensitive exact) is clicked', !!topicOkHit, {});
  await fEval("window.__setV18('off')");
  await fEval("window.__setV18('topicBad')");
  const topicBadEntry = await waitUntil(async () => findLog('blocked', 'topic'), 9000, 'blocked topic');
  check('v18 topics. a mismatched topic logs kind "blocked" + blockedReason "topic"', !!topicBadEntry, { entry: topicBadEntry });
  await sleep(1800);
  const topicBadNames = (await cardClicks()).map((x) => x.n);
  check('v18 topics. the mismatched card is never clicked', !topicBadNames.includes('v18-topic-bad-allow'), { names: topicBadNames.filter((n) => /topic/.test(n)) });
  await seed({ rules: { allowTopics: [], blockKeywords: [] } });
  await waitEngine((r) => r.allowTopics.length === 0, 6000, 'topic gate off applied'); // RACE FIX
  const topicBadHit = await waitUntil(async () => { const c = await cardClicks(); return c.some((x) => x.n === 'v18-topic-bad-allow') ? c : null; }, 10000, 'topic gate off => clicked');
  check('v18 topics. an empty allowTopics list disables the gate (same card is clicked)', !!topicBadHit, {});
  await fEval("window.__setV18('off')");

  // ---- allow-once: mode off leaves 'Allow once only' alone; mode on recognizes + prefers it ----
  await waitEngine((r) => r.allowOnceMode === false, 6000, 'allowOnceMode off applied'); // RACE FIX (negative probe)
  await fEval("window.__setV18('onceOnly')");
  await sleep(2600);
  const onceOffNames = (await cardClicks()).map((x) => x.n);
  check('v18 allow-once. mode OFF: "Allow once only" is not recognized — the card is left to the user',
    !onceOffNames.some((n) => n.startsWith('v18-once')), { names: onceOffNames.filter((n) => /once/.test(n)) });
  await seed({ allowOnceMode: true });
  await waitEngine((r) => r.allowOnceMode === true, 6000, 'allowOnceMode on applied'); // RACE FIX
  const onceHit = await waitUntil(async () => { const c = await cardClicks(); return c.some((x) => x.n === 'v18-once-only') ? c : null; }, 9000, 'once-only clicked');
  check('v18 allow-once. mode ON: "Allow once only" is recognized and clicked', !!onceHit, {});
  await sleep(1500);
  const onceNames = (await cardClicks()).map((x) => x.n);
  check('v18 allow-once. never clicks "Always allow" or Deny on the same card',
    !onceNames.includes('v18-once-always') && !onceNames.includes('v18-once-deny'), { names: onceNames.filter((n) => /once/.test(n)) });
  await fEval("window.__setV18('prefOnce')");
  const prefHit = await waitUntil(async () => { const c = await cardClicks(); return c.some((x) => x.n === 'v18-pref-once') ? c : null; }, 9000, 'pref once clicked');
  check('v18 allow-once. mode ON prefers "Allow once" over plain "Allow" and "Allow always"', !!prefHit, {});
  await sleep(1500);
  const prefNames = (await cardClicks()).map((x) => x.n);
  check('v18 allow-once. mode ON: neither the plain nor the always option was clicked',
    !prefNames.includes('v18-pref-plain') && !prefNames.includes('v18-pref-always'), { names: prefNames.filter((n) => /pref/.test(n)) });
  await fEval("window.__setV18('off')");
  await seed({ allowOnceMode: false });
  await sleep(200);
  await fEval("window.__setV18('prefLegacy')");
  const legacyHit = await waitUntil(async () => { const c = await cardClicks(); return c.some((x) => x.n === 'v18-legacy-plain') ? c : null; }, 9000, 'legacy plain clicked');
  check('v18 allow-once. mode OFF: legacy ranking clicks the plain "Allow" (preference switch proven)', !!legacyHit, {});
  await sleep(1500);
  const legacyNames = (await cardClicks()).map((x) => x.n);
  check('v18 allow-once. mode OFF: the one-shot twin was not preferred',
    !legacyNames.includes('v18-legacy-once') && !legacyNames.includes('v18-legacy-always'), { names: legacyNames.filter((n) => /legacy/.test(n)) });
  await fEval("window.__setV18('off')");

  // ---- pause: clicks halted while pauseUntil is in the future (seeded BEFORE the probe shows) ----
  await seed({ pauseUntil: Date.now() + 60000 });
  v18Applied.pauseClickGate = await waitEngine((r) => r.paused === true, 6000, 'pause applied'); // RACE FIX (negative probe)
  await fEval("window.__setV18('pause')");
  await sleep(2600);
  const pauseNames = (await cardClicks()).map((x) => x.n);
  check('v18 pause. no click while paused', !pauseNames.includes('v18-pause-allow'), { names: pauseNames.filter((n) => /pause/.test(n)) });
  const stPause = await fixtureMsg({ type: 'followup-status' });
  check('v18 status. the ping carries paused/dryRun/allowOnceMode/scheduleAllowed',
    !!(stPause.resp && stPause.resp.paused === true && typeof stPause.resp.dryRun === 'boolean' &&
       typeof stPause.resp.allowOnceMode === 'boolean' && typeof stPause.resp.scheduleAllowed === 'boolean'), stPause);
  await seed({ pauseUntil: 0 });
  const pauseHit = await waitUntil(async () => { const c = await cardClicks(); return c.some((x) => x.n === 'v18-pause-allow') ? c : null; }, 10000, 'click after pause cleared');
  check('v18 pause. clearing the pause resumes clicking', !!pauseHit, {});
  check('v18 onboarded. the engine ignores onboarded (UI-only key): the whole phase above ran with it set',
    !!dryHit && !!pauseHit, { note: 'onboarded:true was seeded at the start of the v18-A phase' });
  await fEval("window.__setV18('off')");

  // ---- pre-reload hygiene snapshot (the reloads below reset the fixture arrays) ----
  const preReloadCards = (await cardClicks()).map((x) => x.n);
  const preReloadApprovals = (await fJSON('window.__approvalClicks')) || [];
  check('v18 hygiene. pre-reload: no deny was ever clicked on any card variant',
    !preReloadCards.some((n) => /deny/.test(n)) && !preReloadApprovals.some((a) => a.n === 'deny'),
    { cards: preReloadCards, approvals: preReloadApprovals.map((a) => a.n) });

  // ======================================================================
  // v18-B. FOLLOW-UP gates — pause / schedule / onlyActiveTab / error / stuck / dry-run.
  // Each group starts from a RELOAD so the hard 6-attempts/hour cap is fresh per group.
  // ======================================================================
  await reloadFixture('v18 follow-up group');

  // ---- B1. pause blocks the follow-up engine; the badge marks it; clearing resumes ----
  await fEval("window.__setState('idle')");
  const settle = await settlePrompt(V18_PROMPT);
  const V18P = settle.prompt;
  check('v18 setup. the seeded follow-up prompt settles to the exact probe text (popup composition)', V18P === V18_PROMPT && JSON.stringify(settle.chips) === '[]', settle);
  await seed({ followupEnabled: true, followupPrompt: V18P, followupChips: [], followupPrompts: [], followupIdleMs: 400, followupCooldownMs: 1000,
    followupSchedule: { enabled: false, start: 8, end: 18, onlyActiveTab: false }, followupSmart: { stuckMin: 0, errorRecovery: false },
    dryRun: false, pauseUntil: Date.now() + 60000 });
  // RACE FIX: the manual 'send-now' below must meet an engine that has ALREADY taken the pause
  // in — otherwise it is refused for the wrong reason (or not refused at all).
  v18Applied.pause = await waitEngine((r) => r.paused === true && r.enabled === true, 6000, 'v18 pause+enabled applied');
  await sleep(2600);
  check('v18 pause. no follow-up send while paused (idle)', (await sentList()).length === 0, { sent: (await sentList()).length });
  const manualPaused = await fixtureMsg({ type: 'followup-send-now' });
  check('v18 pause. manual send-now is refused with reason "paused"',
    !!(manualPaused.resp && manualPaused.resp.ok === false && manualPaused.resp.reason === 'paused'), manualPaused);
  // the service worker may take a moment to repaint the badge — poll instead of one-shot
  const badgeRaw = await waitUntil(async () => {
    const raw = await pEval(`new Promise((res) => { try { chrome.action.getBadgeText({}, (t) => res(JSON.stringify({ t: t, err: chrome.runtime.lastError ? String(chrome.runtime.lastError.message) : null }))); } catch (e) { res(JSON.stringify({ err: String(e) })); } })`, true);
    try { const b = JSON.parse(raw || '{}'); return (b.err === null && b.t === '||') ? raw : null; } catch { return null; }
  }, 5000, 'badge shows pause marker');
  let badge = null;
  try { badge = JSON.parse(badgeRaw || '{}'); } catch { badge = { err: 'bad-json' }; }
  check('v18 pause. the toolbar badge shows the pause marker "||"', badge.err === null && badge.t === '||', badge);
  await seed({ pauseUntil: 0 });
  v18Applied.pauseCleared = await waitEngine((r) => r.paused === false, 6000, 'v18 pause cleared'); // RACE FIX
  const resumeSent = await waitUntil(async () => { const l = await sentList(); return l.length > 0 ? l : null; }, 9000, 'send after pause cleared');
  check('v18 pause. clearing the pause resumes the follow-up engine', !!resumeSent, {});
  await seed({ followupEnabled: false });

  // ---- B2. followupSchedule: [start,end) window, computed at run time (deterministic) ----
  const hourNow = new Date().getHours();
  const winOut = { start: (hourNow + 1) % 24, end: (hourNow + 2) % 24 };  // excludes now at every hour
  const winIn = { start: hourNow, end: (hourNow + 23) % 24 };            // includes now (wraps unless hour 0)
  await seed({ followupEnabled: true, followupPrompt: V18P, followupIdleMs: 400, followupCooldownMs: 1500,
    followupSchedule: { enabled: true, start: winOut.start, end: winOut.end, onlyActiveTab: false } });
  v18Applied.scheduleOut = await waitEngine((r) => r.scheduleAllowed === false, 6000, 'schedule window closed'); // RACE FIX (negative probe)
  await fEval("window.__setState('idle')");
  const schBase = (await sentList()).length; // 1 — the B1 resume send lives in this fixture session
  await sleep(3000);
  const schOutSent = (await sentList()).length;
  check('v18 schedule. outside the window => no send', schOutSent === schBase, { winOut, hourNow, sent: schOutSent, base: schBase });
  await seed({ followupSchedule: { enabled: true, start: winIn.start, end: winIn.end, onlyActiveTab: false } });
  v18Applied.scheduleIn = await waitEngine((r) => r.scheduleAllowed === true, 6000, 'schedule window open'); // RACE FIX
  const schIn = await waitUntil(async () => { const l = await sentList(); return l.length > schBase ? l : null; }, 9000, 'scheduled send');
  check('v18 schedule. inside the window => the send fires (wrap-around supported)',
    !!(schIn && schIn[schBase] && schIn[schBase].text === V18P),
    { winIn, hourNow, wrap: winIn.start > winIn.end, text: schIn && schIn[schBase] ? schIn[schBase].text : null });
  await seed({ followupEnabled: false });

  // ---- B3. onlyActiveTab: a background (hidden) fixture tab must not send ----
  await reloadFixture('v18 onlyActiveTab group');
  await fEval("window.__setState('idle')");
  // make the fixture a BACKGROUND tab FIRST — arming the schedule while it is still visible
  // would let a legitimate visible-tab send fire before the tab is hidden (seed race)
  let visTarget = null, visState = null;
  try {
    const t2 = await send('Target.createTarget', { url: 'about:blank' });
    visTarget = t2.targetId;
    await send('Target.activateTarget', { targetId: visTarget });
    await sleep(1200);
    visState = await fEval('document.visibilityState');
  } catch (e) { visState = 'error: ' + (e && e.message); }
  await seed({ followupEnabled: true, followupPrompt: V18P, followupIdleMs: 400, followupCooldownMs: 1500,
    followupSchedule: { enabled: true, start: winIn.start, end: winIn.end, onlyActiveTab: true } });
  // RACE FIX: the visibility gate is armed FIRST (tab hidden above) and only then confirmed
  // applied — arming while the tab was still visible let a legitimate send fire before hiding.
  v18Applied.visClosed = await waitEngine((r) => r.scheduleAllowed === false, 6000, 'onlyActiveTab gate closed');
  if (visState === 'hidden') {
    await sleep(3000);
    check('v18 schedule. onlyActiveTab: no send while the document is hidden', (await sentList()).length === 0, { visState });
    await seed({ followupSchedule: { enabled: true, start: winIn.start, end: winIn.end, onlyActiveTab: false } });
    v18Applied.visOpen = await waitEngine((r) => r.scheduleAllowed === true, 6000, 'onlyActiveTab gate open'); // RACE FIX
    const backSend = await waitUntil(async () => { const l = await sentList(); return l.length > 0 ? l : null; }, 9000, 'send after visibility gate off');
    check('v18 schedule. onlyActiveTab off: the send fires again', !!backSend, {});
  } else {
    check('v18 schedule. onlyActiveTab: hidden-state negative case exercised', false,
      { visState, note: 'could not make the fixture tab hidden in this Chrome — the onlyActiveTab gate could not be exercised' });
  }
  try { await send('Target.activateTarget', { targetId: fxTargetId }); } catch { /* ignore */ }
  try { if (visTarget) await send('Target.closeTarget', { targetId: visTarget }); } catch { /* ignore */ }
  await seed({ followupEnabled: false });

  // ---- B4. errorRecovery: default prompt, one send per distinct error text ----
  await reloadFixture('v18 error group');
  await fEval("window.__setState('working')");
  await seed({ followupEnabled: true, followupPrompt: V18P, followupIdleMs: 400, followupCooldownMs: 1000,
    followupSchedule: { enabled: false, start: 8, end: 18, onlyActiveTab: false },
    followupSmart: { stuckMin: 0, errorRecovery: false } });
  await fEval("window.__setError('Error: something went wrong while running the command')");
  await sleep(2600);
  check('v18 error. errorRecovery=false => nothing sent for the visible error', (await sentList()).length === 0, {});
  await seed({ followupSmart: { stuckMin: 0, errorRecovery: true } });
  v18Applied.errorOn = await waitEngine((r) => r.errorRecovery === true, 6000, 'errorRecovery on applied'); // RACE FIX
  const errSend = await waitUntil(async () => { const l = await sentList(); return l.length > 0 ? l : null; }, 9000, 'error recovery send');
  check('v18 error. errorRecovery=true => the default recovery prompt is sent',
    !!(errSend && errSend[0] && errSend[0].text === ERROR_DEFAULT), { text: errSend && errSend[0] ? errSend[0].text : null, expected: ERROR_DEFAULT });
  if (errSend) await waitSendVerified(errSend[0].t, 'error send verified');
  await sleep(2200); // > cooldown: a repeat would fire if the fingerprint guard were missing
  check('v18 error. the SAME error text is not answered twice (fingerprint guard)', (await sentList()).length === 1, { sent: (await sentList()).length });
  await fEval("window.__setError('Traceback: unhandled exception in step 2')");
  const errSend2 = await waitUntil(async () => { const l = await sentList(); return l.length > 1 ? l : null; }, 9000, 'error recovery send 2');
  check('v18 error. a DIFFERENT error text triggers a new recovery send', !!errSend2, {});
  if (errSend2) await waitSendVerified(errSend2[1].t, 'error send 2 verified');
  await fEval("window.__setError('')");
  // RACE FIX (the known flaky check): the error fingerprint is cleared by a tick that SAMPLES
  // the error as absent, and the engine's sampling heartbeat is 1s — a fixed 600ms clear-window
  // misses that sample ~40% of the time, so the re-appearing text looked 'already answered'.
  // Wait for the engine to report the cleared fingerprint (deterministic) before re-setting it.
  v18Applied.errCleared = await waitEngine((r) => r.lastErrorFp === '', 8000, 'error fingerprint cleared');
  await fEval("window.__setError('Traceback: unhandled exception in step 2')");
  const errSend3 = await waitUntil(async () => { const l = await sentList(); return l.length > 2 ? l : null; }, 9000, 'error recovery send 3');
  check('v18 error. after the error clears, the same text is answerable again', !!errSend3, { cleared: !!v18Applied.errCleared });
  await fEval("window.__setError('')");
  await seed({ followupEnabled: false });

  // ---- B5. stuck: silence threshold, default + custom prompt, approval blocks it ----
  await reloadFixture('v18 stuck group');
  await seed({ followupEnabled: true, followupPrompt: V18P, followupIdleMs: 400, followupCooldownMs: 1000,
    followupSchedule: { enabled: false, start: 8, end: 18, onlyActiveTab: false },
    followupSmart: { stuckMin: 0, errorRecovery: false } });
  await fEval("window.__setState('working')");
  await sleep(3000);
  check('v18 stuck. stuckMin=0 => no stuck send while working and silent', (await sentList()).length === 0, { sent: (await sentList()).length });
  await seed({ followupSmart: { stuckMin: 0.05, errorRecovery: false } }); // 3 s — fractional minutes allowed
  v18Applied.stuckMin = await waitEngine((r) => r.stuckMin === 0.05, 6000, 'stuckMin applied'); // RACE FIX
  const stuckSend = await waitUntil(async () => { const l = await sentList(); return l.length > 0 ? l : null; }, 9000, 'stuck recovery send');
  check('v18 stuck. after the silence threshold the default stuck-recovery prompt is sent',
    !!(stuckSend && stuckSend[0] && stuckSend[0].text === STUCK_DEFAULT), { entry: stuckSend && stuckSend[0] ? stuckSend[0] : null, expected: STUCK_DEFAULT });
  // seed the custom prompt IMMEDIATELY: the next silence window is already counting down from the
  // first attempt, so waiting for the verification first would let send #2 fire with the old prompt
  await seed({ followupSmart: { stuckMin: 0.05, stuckPrompt: 'CUSTOM STUCK PROMPT', errorRecovery: false } });
  // RACE FIX: seeding is not the same as APPLIED — confirm the engine holds the override before
  // the next silence window (3s) can elapse and fire send #2 with the stale default prompt.
  v18Applied.stuckPrompt = await waitEngine((r) => r.stuckPrompt === 'CUSTOM STUCK PROMPT', 6000, 'custom stuck prompt applied');
  if (stuckSend) await waitSendVerified(stuckSend[0].t, 'stuck send verified');
  const stuckSend2 = await waitUntil(async () => { const l = await sentList(); return l.length > 1 ? l : null; }, 15000, 'stuck recovery send 2 (custom)');
  check('v18 stuck. a custom stuckPrompt override is honored', !!(stuckSend2 && stuckSend2[1] && stuckSend2[1].text === 'CUSTOM STUCK PROMPT'),
    { entry: stuckSend2 && stuckSend2[1] ? stuckSend2[1] : null, all: (stuckSend2 || []).map((x) => x.text) });
  if (stuckSend2) await waitSendVerified(stuckSend2[1].t, 'stuck send 2 verified');
  await fEval("window.__setApproval(true)");
  const stuckBase3 = (await sentList()).length;
  await sleep(4200);
  check('v18 stuck. never sends while an approval card is present', (await sentList()).length === stuckBase3, { sent: (await sentList()).length });
  await fEval("window.__setApproval(false)");
  await seed({ followupEnabled: false });

  // ---- B6. dry-run (follow-up side): 'followup-dry' logged, nothing sent ----
  await reloadFixture('v18 dry follow-up group');
  await fEval("window.__setState('idle')");
  await seed({ followupEnabled: true, followupPrompt: V18P, followupIdleMs: 400, followupCooldownMs: 1000,
    followupSchedule: { enabled: false, start: 8, end: 18, onlyActiveTab: false },
    followupSmart: { stuckMin: 0, errorRecovery: false }, dryRun: true });
  v18Applied.followupDry = await waitEngine((r) => r.dryRun === true, 6000, 'follow-up dryRun applied'); // RACE FIX
  const fdEntry = await waitUntil(async () => findLog('followup-dry'), 9000, 'followup-dry log entry');
  check('v18 dry-run. the follow-up logs kind "followup-dry" (dryRun:true) and does NOT send',
    !!fdEntry && fdEntry.dryRun === true && (await sentList()).length === 0, { entry: fdEntry, sent: (await sentList()).length });
  await seed({ dryRun: false });
  const fdSend = await waitUntil(async () => { const l = await sentList(); return l.length > 0 ? l : null; }, 9000, 'real send after dryRun off');
  check('v18 dry-run. turning dryRun off resumes real follow-up sends',
    !!(fdSend && fdSend[0] && fdSend[0].text === V18P), { text: fdSend && fdSend[0] ? fdSend[0].text : null });
  await seed({ followupEnabled: false, dryRun: false, pauseUntil: 0 });

  // ---- digest counters (written by the content script, consumed by the background digest) ----
  const dgStore = await popStore(['digestCounters']);
  const dg = (dgStore && dgStore.digestCounters) || null;
  check('v18 digest. counters recorded real clicks + blocked + verified follow-ups',
    !!dg && dg.clicks >= 1 && dg.blocked >= 2 && dg.followups >= 1, { counters: dg });

  // ---- v1.20.0 (G07): briefing card — counters + top block reason + 7-day trend ----
  const g7key = (off) => { const d = new Date(Date.now() - off * 86400000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  await seed({ log: [
    { at: new Date(Date.now() - 3600e3).toISOString(), kind: 'blocked', blockedReason: 'keyword:banana' },
    { at: new Date(Date.now() - 3500e3).toISOString(), kind: 'blocked', blockedReason: 'keyword:banana' },
    { at: new Date(Date.now() - 3400e3).toISOString(), kind: 'blocked', blockedReason: 'keyword:delete' },
  ], digestCounters: { clicks: 3, followups: 1, blocked: 2 }, lastDigestAt: 0,
  stats: { byDay: { [g7key(0)]: 5, [g7key(1)]: 2, [g7key(7)]: 3 } } });
  try { await send('Page.reload', {}, popSession); } catch { /* ignore */ }
  await sleep(900);
  const g7 = await pEval(`({ hidden: document.getElementById('digest').hidden, top: (document.getElementById('dTopReason').textContent || ''), trend: (document.getElementById('dTrend').textContent || ''), delta: (document.getElementById('dTrendDelta').textContent || '') })`);
  check('G07 briefing. #digest shows counters + top reason + 7-day trend',
    !!g7 && g7.hidden === false && /keyword:banana \(2\)/.test(g7.top) && g7.trend === '7' && /4/.test(g7.delta), g7);

  // ---- v1.20.0 (G04): anomaly auto-pause — the burst trips the detector, the engine halts, and
  // ---- the follow-up path maps the pause to the NEW reason. The suite drives the RATE rule
  // ---- (threshold = rateMaxPerMin x rateWindowMs / 60000 = 5 clicks in 60 s); the TOPIC rule's
  // ---- semantics (40/50 share 0.8 fires, 0.5 silent, the fixed window-total floor of 30) are
  // ---- unit-tested against the shipped module in test/anomaly-unit.mjs.
  await fEval("window.__setV18('off')");
  await seed({ enabled: true, minDelayMs: 0, dryRun: false, pauseUntil: 0, anomalyLastPause: null,
    followupEnabled: true, followupPrompt: 'G04 probe — continue where you left off',
    anomaly: { enabled: true, minSample: 3, rateMaxPerMin: 5, rateWindowMs: 60000, pauseMs: 900000 } });
  await fEval('location.reload()');
  await sleep(1800); // fresh page = fresh engine windows (allowClicks/topicClicks)
  await fEval("window.__setAnomaly('spike')");
  let g4store = null;
  const g4deadline = Date.now() + 90000;
  while (Date.now() < g4deadline) {
    const st = await popStore(['pauseUntil', 'anomalyLastPause', 'log']);
    if (((Number(st && st.pauseUntil) || 0) > Date.now() + 60000)) { g4store = st; break; }
    await sleep(2000);
  }
  const g4until = (Number(g4store && g4store.pauseUntil) || 0);
  check('G04-1. the burst trips the detector and auto-pauses the engine (~15 min ahead)',
    g4until > Date.now() + 60000, { until: g4until, marker: g4store && g4store.anomalyLastPause });
  const g4log = (g4store && Array.isArray(g4store.log)) ? g4store.log : [];
  const g4entry = g4log.find((e) => e && e.kind === 'anomaly-pause');
  // The log is encrypted at rest (V4-5): the plaintext context lives inside entry.ctx (ct/iv)
  // or, in a legacy plaintext shape, in entry.context — accept either, but pin the kind+reason
  // and the UNENCRYPTED marker rule.
  const g4ctxOk = !!g4entry && (typeof g4entry.context === 'string'
    ? /(rate:|topic:)/.test(g4entry.context)
    : !!(g4entry.ctx && typeof g4entry.ctx.ct === 'string'));
  const g4marker = g4store && g4store.anomalyLastPause;
  check('G04-2. the auto-pause is logged (kind/reason anomaly-pause, context stored, marker rule)',
    !!g4entry && g4entry.kind === 'anomaly-pause' && g4entry.blockedReason === 'anomaly-pause' && g4ctxOk
    && !!g4marker && (g4marker.rule === 'rate' || g4marker.rule === 'topic'),
    { entry: g4entry || null, marker: g4marker || null });
  const clicks0 = await fJSON('window.__cardClicks.length');
  await sleep(3500);
  const clicks1 = await fJSON('window.__cardClicks.length');
  check('G04-3. while auto-paused the engine clicks nothing (burst frozen)',
    clicks0 === clicks1 && clicks0 >= 5, { before: clicks0, after: clicks1 });
  try { await send('Page.reload', {}, popSession); } catch { /* ignore */ }
  await sleep(900);
  const g4pop = await pEval(`({ noteHidden: document.getElementById('anomalyNote') ? document.getElementById('anomalyNote').hidden : null, groupHidden: document.getElementById('pauseActive').hidden, state: (document.getElementById('pstateText').textContent || '') })`);
  check('G04-4. popup shows the anomaly pause state + note',
    !!g4pop && g4pop.groupHidden === false && g4pop.noteHidden === false && /(unusual|anomaly|auto)/i.test(g4pop.state), g4pop);
  const g4send = await fixtureMsg({ type: 'followup-send-now' });
  check('G04-5. send-now during the auto-pause maps to reason anomaly-pause',
    !!(g4send.resp && g4send.resp.ok === false && g4send.resp.reason === 'anomaly-pause'), g4send.resp);
  await seed({ anomaly: { enabled: false }, pauseUntil: 0, anomalyLastPause: null });
  await sleep(4000);
  const clicks2 = await fJSON('window.__cardClicks.length');
  const st2 = await popStore(['pauseUntil', 'anomalyLastPause']);
  check('G04-6. disabled guard: the burst resumes and nothing re-pauses',
    clicks2 > clicks1 && (Number(st2 && st2.pauseUntil) || 0) === 0, { after: clicks2, pauseUntil: st2 && st2.pauseUntil });
  results.v18 = { dryEntry, blEntry, bananaEntry, topicBadEntry, badge, visState, counters: dg, applied: v18Applied };

  // ---- fixture-side evidence + hygiene ----
  const finalSent = await sentList();
  const inputsFinal = (await fJSON('window.__inputs')) || [];
  const approvals = (await fJSON('window.__approvalClicks')) || [];
  const cardsFinal = (await fJSON('window.__cardClicks')) || [];
  const fxErrors = (await fJSON('window.__errors')) || [];
  check('z. fixture page saw no JS errors', fxErrors.length === 0, { fxErrors });
  check('z. deny was never clicked on the approval card', !approvals.some((a) => a.n === 'deny'), { approvals: approvals.length });
  check('z. deny was never clicked on any GitHub-card variant', !cardsFinal.some((c) => /deny/.test(c.n)),
    { cardClicks: cardsFinal.map((c) => c.n) });

  results.sent = finalSent;
  results.inputEvents = inputsFinal.length;
  results.approvalClicks = approvals.length;
  results.cardClicks = cardsFinal.map((c) => c.n);
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
