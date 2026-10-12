#!/usr/bin/env node
/**
 * smoke-zip.mjs — release-ARTIFACT smoke test: extract dist/<zip> and prove the
 * EXTRACTED copy itself passes the core runtime checks in a real Chrome.
 *
 *   zip bytes -> fresh temp dir (extract + per-entry CRC verify)
 *             -> temp run copy (ONE test-only manifest delta, see below)
 *             -> scratch Chrome via CDP Extensions.loadUnpacked
 *             -> test/fixture.html served locally (same fixture the e2e harness uses)
 *             -> popup + follow-up section boot checks
 *   Exit 0 only when the ARTIFACT passes. Prints { artifact, entries, checks, ok }.
 *
 * Mirrors test/e2e.mjs (installed Chrome 137+ CDP lane, scratch profile only, detached
 * launch + reap-by-profile-path, unique user-data-dir, random CDP port). test/** is
 * read-only to this script — the fixture is served from the repo, assertions are
 * mirrored, nothing is imported or edited.
 *
 * One declared test-only delta: the LOADED copy of the artifact gets
 * `http://127.0.0.1/*` pushed into content_scripts[0].matches (exactly the injection
 * test/e2e.mjs performs) so the content script runs on the local fixture origin.
 * Every other byte loaded is the artifact's, the shipped manifest stays muse.ai-only,
 * and the pristine extraction dir is never modified (the patch is applied to a copy).
 *
 * Checks: sidecar sha256, zip structure (all entries extract with matching CRC,
 * manifest at root, version consistent with the file name), and the e2e core —
 * fixture click behavior (expected set clicked, no extras/dupes/forbidden/deny,
 * path order, dedup windows, surface not re-clicked), popup boot hydration,
 * follow-up section render, i18n substitution, content-script storage read-back.
 *
 * Usage:  node scripts/smoke-zip.mjs [zipPath]     (default dist/muse-auto-allow-v<version>.zip)
 * Env:    MAA_CHROME (Chrome executable), MAA_SMOKE_PORT (fixed CDP port)
 * Exit:   0 = artifact passed, 2 = failed (JSON summary always printed)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXT_DIR = path.join(ROOT, 'extension');
const IS_WIN = process.platform === 'win32';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// version always from manifest.json — never hardcoded
const treeManifest = JSON.parse(fs.readFileSync(path.join(EXT_DIR, 'manifest.json'), 'utf8'));
const zipPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'dist', `muse-auto-allow-v${treeManifest.version}.zip`);
const zipRel = path.relative(ROOT, zipPath) || zipPath;

// Fixture expectations mirrored from test/e2e.mjs (kept in lockstep by hand — test/** is read-only here).
const EXPECTED = ['1', '2', '3', '4', '5', '6', '7', '11', '17', 'pending5', 'surface', 'reviewbar', '18'];
const FORBIDDEN = ['8', '9', '10', '12', '13', '14', '16', 'surface2', 'surface3', 'lone', 'notif', 'plain-review'];

const CHECK_NAMES = [
  'sidecar.sha256Matches',
  'zip.entriesExtractedCrcOk',
  'zip.manifestAtRoot',
  'zip.versionConsistent',
  'chrome.extensionLoaded',
  'fixture.webLocksAvailable',
  'fixture.allExpectedClicked',
  'fixture.noExtraClicks',
  'fixture.noDuplicateClicks',
  'fixture.noForbiddenClicks',
  'fixture.noDenyClicks',
  'fixture.pathOrderOk',
  'fixture.dedupWithinWindow',
  'fixture.dedupRetrySeparated',
  'fixture.surfaceNotReclicked',
  'popup.boots',
  'popup.followupSectionRenders',
  'popup.i18nSubstitution',
  'popup.sendNowEnabledWhenOn',
  'content.storageWrites',
];
const checks = Object.fromEntries(CHECK_NAMES.map((n) => [n, false]));
const results = { artifact: zipRel, entries: 0, checks, ok: false };

let errored = false;
let ws = null;
let send = null;
let server = null;
let profileDir = null;
let fixtureUrl = '';
let extId = null;
const tmpDirs = [];

// ---------- zip reading / extraction (stdlib only) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function readZipEntries(buf) {
  let p = buf.length - 22;
  const floor = Math.max(0, buf.length - 65557);
  while (p >= floor && buf.readUInt32LE(p) !== 0x06054b50) p--;
  if (p < floor) throw new Error('EOCD not found — not a zip file');
  const count = buf.readUInt16LE(p + 10);
  const cdOff = buf.readUInt32LE(p + 16);
  const entries = [];
  let o = cdOff;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(o) !== 0x02014b50) throw new Error('bad central-directory signature');
    entries.push({
      name: buf.toString('utf8', o + 46, o + 46 + buf.readUInt16LE(o + 28)),
      method: buf.readUInt16LE(o + 10),
      crc: buf.readUInt32LE(o + 16),
      csize: buf.readUInt32LE(o + 20),
      usize: buf.readUInt32LE(o + 24),
      lOff: buf.readUInt32LE(o + 42),
    });
    o += 46 + buf.readUInt16LE(o + 28) + buf.readUInt16LE(o + 30) + buf.readUInt16LE(o + 32);
  }
  return entries;
}
function extractZip(buf, dest) {
  const entries = readZipEntries(buf);
  let bytes = 0;
  for (const e of entries) {
    if (e.name.includes('..') || e.name.startsWith('/') || /^[A-Za-z]:/.test(e.name)) {
      throw new Error('unsafe zip entry name: ' + e.name);
    }
    if (buf.readUInt32LE(e.lOff) !== 0x04034b50) throw new Error('bad local header for ' + e.name);
    const start = e.lOff + 30 + buf.readUInt16LE(e.lOff + 26) + buf.readUInt16LE(e.lOff + 28);
    const body = buf.subarray(start, start + e.csize);
    const raw = e.method === 0 ? body : e.method === 8 ? inflateRawSync(body) : null;
    if (raw === null) throw new Error(e.name + ': unsupported compression method ' + e.method);
    if (raw.length !== e.usize) throw new Error(e.name + ': size mismatch after decompress');
    if (crc32(raw) !== e.crc) throw new Error(e.name + ': CRC mismatch');
    const f = path.join(dest, e.name);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, raw);
    bytes += raw.length;
  }
  return { entries, bytes };
}

// ---------- scratch Chrome: detached launch + reap by OUR profile path ----------
const psQuote = (s) => s.replace(/'/g, "''");
function countMyChrome() {
  try {
    if (!IS_WIN || !profileDir) return 0;
    const ps = `@(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine -like '*${psQuote(profileDir)}*' }).Count`;
    const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8', timeout: 25000 });
    return Number(out.trim()) || 0;
  } catch { return 0; }
}
function killMyChrome() {
  try {
    if (!IS_WIN || !profileDir) return;
    const ps = `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine -like '*${psQuote(profileDir)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
    execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { stdio: 'ignore', timeout: 30000 });
  } catch { /* nothing to kill */ }
}
function launchChromeDetached(chromePath, args) {
  const argList = args.map((a) => `'${psQuote(a)}'`).join(',');
  execFileSync('powershell.exe', ['-NoProfile', '-Command',
    `Start-Process -FilePath '${psQuote(chromePath)}' -ArgumentList ${argList}`],
    { stdio: 'ignore', timeout: 30000 });
}

// ---------- CDP plumbing (same shape as test/e2e.mjs) ----------
async function cdpEndpoint(port, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) { const j = await res.json(); if (j.webSocketDebuggerUrl) return j; }
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error(`Chrome did not expose CDP on port ${port}`);
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
async function ev(sessionId, expression, awaitPromise = false) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise }, sessionId);
  return r && r.result ? r.result.value : undefined;
}
async function waitFor(fn, pred, timeoutMs, label) {
  const t0 = Date.now();
  let value = null;
  for (;;) {
    try { value = await fn(); } catch { value = null; }
    if (value && pred(value)) return { ok: true, value };
    if (Date.now() - t0 > timeoutMs) { console.log('  (timeout waiting for: ' + label + ')'); return { ok: false, value }; }
    await sleep(200);
  }
}

// ---------- phase 1: fixture click behavior (mirrors test/e2e.mjs core assertions) ----------
async function fixturePhase() {
  // v1.9.3: a fresh install now starts in logging-only mode — this phase tests the LIVE click
  // path, so the state is stated explicitly (mirrors test/e2e.mjs, test/followup-e2e.mjs and
  // test/lang-switch-e2e.mjs). Without this seed the phase would be measuring the dry-run
  // default instead of the click path.
  const seedT = await send('Target.createTarget', { url: `chrome-extension://${extId}/popup.html` });
  const { sessionId: seedS } = await send('Target.attachToTarget', { targetId: seedT.targetId, flatten: true });
  await send('Runtime.evaluate', { expression: `new Promise((res) => chrome.storage.local.set({ dryRun: false }, () => res(true)))`, awaitPromise: true, returnByValue: true }, seedS);
  await send('Target.closeTarget', { targetId: seedT.targetId });
  const { targetId } = await send('Target.createTarget', { url: fixtureUrl });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const clickList = async () => {
    try {
      const rr = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__clicks || [])', returnByValue: true }, sessionId);
      return JSON.parse(rr?.result?.value || '[]');
    } catch { return []; }
  };

  const deadline = Date.now() + 18000;
  let clicks = [];
  while (Date.now() < deadline) {
    clicks = await clickList();
    const got = clicks.map((c) => String(c.n));
    if (EXPECTED.every((n) => got.includes(n))) break;
    await sleep(400);
  }

  const got = clicks.map((c) => String(c.n)); // phase-1 snapshot (dedup windows measured from it)
  const missing = EXPECTED.filter((n) => !got.includes(n));
  const extra = got.filter((n) => !EXPECTED.includes(n));
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

  // phase 2: wait out the open-panel throttle, then confirm the late negative controls still held
  const surfaceAt = (clicks.find((c) => c.n === 'surface') || {}).t || 0;
  const until = surfaceAt + 12000;
  while (Date.now() < until) await sleep(1000);
  let clicksFinal = clicks;
  try { clicksFinal = await clickList(); } catch { /* keep phase-1 snapshot */ }
  const gotFinal = clicksFinal.map((c) => String(c.n));
  const surface2Hit = gotFinal.includes('surface2');
  const denyCount = clicksFinal.filter((c) => c.deny).length;
  const forbiddenHit = FORBIDDEN.filter((n) => gotFinal.includes(n));

  // Web Locks capability probe (mirrors the e2e caveat closure, on the fixture document)
  let locksProbe = null;
  try {
    const rl = await send('Runtime.evaluate', { expression: "typeof navigator.locks !== 'undefined' && typeof navigator.locks.request === 'function'", returnByValue: true }, sessionId);
    locksProbe = rl?.result?.value === true;
  } catch { /* leave null */ }

  checks['fixture.webLocksAvailable'] = locksProbe === true;
  checks['fixture.allExpectedClicked'] = missing.length === 0;
  checks['fixture.noExtraClicks'] = extra.length === 0;
  checks['fixture.noDuplicateClicks'] = dupes.length === 0;
  checks['fixture.noForbiddenClicks'] = forbiddenHit.length === 0;
  checks['fixture.noDenyClicks'] = denyCount === 0;
  checks['fixture.pathOrderOk'] = orderOk;
  checks['fixture.dedupWithinWindow'] = n7count === 1 && n11count === 1;
  checks['fixture.dedupRetrySeparated'] = dedupSepOk;
  checks['fixture.surfaceNotReclicked'] = !surface2Hit;
  console.log('fixture clicks:', gotFinal.join(',') || '(none)');
  console.log('fixture: missing=[' + missing + '] extra=[' + extra + '] dupes=[' + dupes + '] forbidden=[' + forbiddenHit +
    '] deny=' + denyCount + ' n7=' + n7count + ' n11=' + n11count + ' orderOk=' + orderOk + ' dedupSep=' + dedupSepOk + ' surface2=' + surface2Hit);
}

// ---------- phase 2: popup boot + follow-up section + storage read-back ----------
async function popupPhase() {
  const target = await send('Target.createTarget', { url: `chrome-extension://${extId}/popup.html` });
  const { sessionId } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const pEval = (expression, awaitPromise = false) => ev(sessionId, expression, awaitPromise);
  const pJSON = async (expr) => {
    try { const v = await pEval('JSON.stringify(' + expr + ')'); return v === undefined ? null : JSON.parse(v); }
    catch { return null; }
  };

  // boot hydration must land: enabled default reflected, UI language applied, muse-tab chip rewritten.
  // The follow-up default (off) must leave the panel gated with the inline hint visible — that
  // three-way state only exists if popup.js ran its boot refresh (a storage-event-only popup
  // would render the raw markup: ungated, hint hidden, checkbox unchecked).
  const boot = await waitFor(
    () => pJSON(`({ lang: document.documentElement.lang, checked: document.getElementById('enabled').checked === true, muse: (document.getElementById('musestatText') || {}).textContent || '' })`),
    (j) => j.checked === true && !!j.muse && j.muse !== '\u2026',
    8000, 'popup boot hydration');
  const s = (await pJSON(`({
    lang: document.documentElement.lang,
    checked: document.getElementById('enabled').checked === true,
    muse: (document.getElementById('musestatText') || {}).textContent || '',
    runtimeId: (() => { try { return chrome.runtime.id; } catch (e) { return null; } })(),
    sect: !!document.getElementById('followupSect'),
    sectH: (() => { const el = document.getElementById('followupSect'); return el ? Math.round(el.getBoundingClientRect().height) : 0; })(),
    toggle: !!document.getElementById('followupEnabled'),
    send: !!document.getElementById('fsendnow'),
    sendDisabled: !!(document.getElementById('fsendnow') || {}).disabled,
    quickBtns: ['fq0', 'fq1', 'fq2'].filter((id) => document.getElementById(id)).length,
    libBtn: !!document.getElementById('flibbtn'),
    sheetClosed: !!(document.getElementById('flibsheet') || {}).hidden,
    gated: document.getElementById('fpanel').classList.contains('gated'),
    hintHidden: !!document.getElementById('fhint').hidden
  })`)) || {};
  checks['popup.boots'] = boot.ok && !!s.lang && s.checked === true && !!s.muse && s.muse !== '\u2026' &&
    s.runtimeId === extId && s.gated === true && s.hintHidden === false && s.sendDisabled === true;
  checks['popup.followupSectionRenders'] = !!s.sect && s.sectH > 0 && !!s.toggle && !!s.send &&
    s.quickBtns === 3 && !!s.libBtn && s.sheetClosed === true;
  console.log('popup boot:', JSON.stringify({ lang: s.lang, muse: s.muse, gated: s.gated, hintHidden: s.hintHidden, sendDisabled: s.sendDisabled, quickBtns: s.quickBtns, sectH: s.sectH }));

  // content script -> storage round-trip (same read-back the e2e asserts)
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  const sto = await waitFor(
    async () => {
      const out = await pEval(`new Promise((res) => chrome.storage.local.get(['stats', 'clickCount', 'log'], (s) => res(JSON.stringify({
        stats: s.stats || null, clickCount: s.clickCount || 0, logLen: (s.log || []).length,
        i18nFound: chrome.i18n.getMessage('museTabsFound', ['3']) }))))`, true);
      try { return out === undefined || out === null ? null : JSON.parse(out); } catch { return null; }
    },
    (j) => j.clickCount >= 10 && j.logLen >= 10 && j.stats &&
      ((j.stats.byDay || {})[today] || 0) >= 10 && ((j.stats.byTopic || {})['test-repo'] || 0) >= 1,
    8000, 'content-script storage read-back');
  const st = sto.value || {};
  const byDay = (st.stats && st.stats.byDay) || {};
  const byTopic = (st.stats && st.stats.byTopic) || {};
  checks['content.storageWrites'] = sto.ok;
  checks['popup.i18nSubstitution'] = !!st && String(st.i18nFound || '').includes('3');
  console.log('storage read-back:', JSON.stringify({ clickCount: st.clickCount, logLen: st.logLen, today: byDay[today] || 0, topicTestRepo: byTopic['test-repo'] || 0, i18n: st.i18nFound }));

  // enabling the feature flips the gated panel through the popup's real storage listener:
  // send-now enabled, settings expanded, hint gone, quick combos visible
  await pEval(`new Promise((res) => chrome.storage.local.set({ followupEnabled: true }, () => res(true)))`, true);
  const on = await waitFor(
    () => pJSON(`({
      sendDisabled: !!(document.getElementById('fsendnow') || {}).disabled,
      gated: document.getElementById('fpanel').classList.contains('gated'),
      hintHidden: !!document.getElementById('fhint').hidden,
      quickVisible: (() => { const b = document.getElementById('fq0'); return !!b && b.getBoundingClientRect().height > 0; })()
    })`),
    (j) => j.sendDisabled === false,
    5000, 'send-now enabled after toggle');
  checks['popup.sendNowEnabledWhenOn'] = on.ok && on.value.gated === false && on.value.hintHidden === true && on.value.quickVisible === true;
}

// ---------- main ----------
try {
  // stage 1 — artifact bytes + checksum sidecar
  if (!fs.existsSync(zipPath)) throw new Error(`missing artifact ${zipRel} — run: node scripts/build.mjs`);
  const zipBuf = fs.readFileSync(zipPath);
  const sha = createHash('sha256').update(zipBuf).digest('hex');
  const sidecarPath = zipPath + '.sha256';
  let sidecarSha = null;
  if (fs.existsSync(sidecarPath)) {
    const m = fs.readFileSync(sidecarPath, 'utf8').trim().match(/^([0-9a-f]{64})\b/);
    sidecarSha = m ? m[1] : null;
  }
  checks['sidecar.sha256Matches'] = sidecarSha === sha;
  console.log(`artifact: ${zipRel} | sha256 ${sha} | sidecar ${checks['sidecar.sha256Matches'] ? 'OK' : sidecarSha ? 'MISMATCH' : 'MISSING'}`);

  // stage 2 — extract into a fresh temp dir, verifying every entry (CRC) as it lands
  const artDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maa-artifact-'));
  tmpDirs.push(artDir);
  const { entries, bytes } = extractZip(zipBuf, artDir);
  results.entries = entries.length;
  checks['zip.entriesExtractedCrcOk'] = entries.length > 0;
  const rootManifest = path.join(artDir, 'manifest.json');
  checks['zip.manifestAtRoot'] = entries.some((e) => e.name === 'manifest.json') && fs.existsSync(rootManifest);
  if (!checks['zip.manifestAtRoot']) throw new Error('extracted artifact has no root manifest.json');
  const artManifest = JSON.parse(fs.readFileSync(rootManifest, 'utf8'));
  const nameVer = (path.basename(zipPath).match(/^muse-auto-allow-v(\d+\.\d+\.\d+)\.zip$/) || [])[1];
  checks['zip.versionConsistent'] = artManifest.version === (nameVer || treeManifest.version);
  console.log(`extracted: ${entries.length} entries, ${bytes} bytes (all CRCs verified)`);

  // stage 3 — run copy: the single test-only delta (localhost match for the local fixture)
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maa-smoke-ext-'));
  tmpDirs.push(runDir);
  fs.cpSync(artDir, runDir, { recursive: true });
  {
    const mp = path.join(runDir, 'manifest.json');
    const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
    m.content_scripts[0].matches.push('http://127.0.0.1/*');
    fs.writeFileSync(mp, JSON.stringify(m, null, 2));
  }

  // stage 4 — fixture server (test/fixture.html is test infra, not part of the artifact)
  server = http.createServer((req, res) => {
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
  fixtureUrl = `http://127.0.0.1:${server.address().port}/test/fixture.html`;
  console.log('fixture:', fixtureUrl);

  // stage 5 — scratch Chrome (unique profile, random port), load the EXTRACTED copy
  const chromePath = process.env.MAA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const PORT = Number(process.env.MAA_SMOKE_PORT || 10400 + Math.floor(Math.random() * 500));
  profileDir = path.join(os.tmpdir(), `maa-smoke-${process.pid}-${Date.now().toString(36)}`);
  fs.mkdirSync(profileDir, { recursive: true });
  launchChromeDetached(chromePath, [
    `--user-data-dir=${profileDir}`,
    `--remote-debugging-port=${PORT}`,
    '--enable-unsafe-extension-debugging',
    '--no-first-run',
    '--no-default-browser-check',
    // keep the offscreen window fully active (occlusion + timer throttling froze the e2e before)
    '--disable-features=Translate,MediaRouter,CalculateNativeWinOcclusion,OptimizationHints',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--window-position=-32000,-32000',
    '--window-size=1100,800',
    '--lang=en-US',
    'about:blank',
  ]);
  const info = await cdpEndpoint(PORT);
  ws = await connect(info.webSocketDebuggerUrl);
  send = makeSend(ws);

  const loaded = await send('Extensions.loadUnpacked', { path: runDir });
  extId = loaded?.id;
  checks['chrome.extensionLoaded'] = !!extId;
  if (!extId) throw new Error('Extensions.loadUnpacked returned no extension id');
  console.log('extensionId:', extId);

  // stage 6+7 — the e2e core, against the artifact
  await fixturePhase();
  await popupPhase();
} catch (e) {
  errored = true;
  console.error('smoke-zip ERROR:', (e && e.stack) || String(e));
} finally {
  try { await send?.('Browser.close'); } catch { /* may be gone */ }
  await sleep(1200); // let the browser exit cleanly before reaping
  let remaining = countMyChrome();
  for (let i = 0; i < 12 && remaining > 0; i++) { killMyChrome(); await sleep(500); remaining = countMyChrome(); }
  if (remaining > 0) console.error(`WARNING: ${remaining} chrome process(es) still reference ${profileDir}`);
  for (const d of [profileDir, ...tmpDirs].filter(Boolean)) {
    for (let i = 0; i < 6; i++) { try { fs.rmSync(d, { recursive: true, force: true }); break; } catch { await sleep(500); } }
  }
  try { ws?.close(); } catch { /* ignore */ }
  if (server) server.close();
}

results.ok = !errored && Object.values(checks).every(Boolean);
console.log(JSON.stringify(results, null, 2));
process.exit(results.ok ? 0 : 2);
