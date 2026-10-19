#!/usr/bin/env node
/**
 * anomaly-unit.mjs — deterministic unit verification for the v1.20.0 (G04) pure detector
 * extension/anomaly.js, with no browser and no Chrome. The REAL shipped module is loaded into
 * a vm sandbox (same pattern as test/background-unit.mjs:33,186-188), so every assertion drives
 * the shipped code, not a re-implementation.
 *
 * Checks (docs/G04_ANOMALY_PAUSE_SPEC.md §4 points 1-7, plus 2 robustness checks):
 *   A0  interface. defaults() is byte-exact; sanitize/evaluate are functions; the global exists
 *   1   RATE boundary. 149 clicks in-window => null; 150 => {rule:'rate'}
 *   2   RATE prune. 150 timestamps whose oldest sits outside rateWindowMs => null
 *   3   TOPIC. 40 of 50 (share 0.8) => {rule:'topic'}; the same 40 of 80 (share 0.5) => null
 *   4   minSample. totalClicks < minSample => null even with 150 in-window clicks
 *   5   enabled:false => null even with the firing burst
 *   6   sanitize fail-closed. {rateMaxPerMin:'abc', topicShareMin:-5, minSample:NaN,
 *       rateWindowMs:0} => the shipped defaults; never throws on null/string/junk
 *   7   user-lowered rateMaxPerMin=10 => fires at 50 clicks / 5 min, silent at 49
 *   8   malformed win (topics not a Map, allowTs null/NaN) never throws
 *   9   missing settings object never throws (shipped defaults apply)
 *
 * Usage: node test/anomaly-unit.mjs [path/to/anomaly.js]
 * Exit 0 = all checks pass, 2 = at least one fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'extension', 'anomaly.js');

const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail }); return !!ok; };

// ---------- sandbox: the REAL extension/anomaly.js in a fresh vm realm ----------
// NOTE: the sandbox realm has its own Map/Array/Number constructors, so host-created Maps are
// NOT `instanceof` the sandbox Map — exactly the cross-realm case the shipped duck-typed check
// must survive.
const sandbox = { console: { log: () => {}, warn: () => {}, error: () => {} } };
const ctx = vm.createContext(sandbox);
const src = fs.readFileSync(SRC, 'utf8');
vm.runInContext(src, ctx, { filename: SRC });
const A = sandbox.MuseAnomaly;

// ---------- A0: frozen interface ----------
const EXPECTED_DEFAULTS = {
  enabled: true, rateWindowMs: 300000, rateMaxPerMin: 30, topicWindowMs: 600000,
  topicCountMin: 40, topicShareMin: 0.7, minSample: 100, pauseMs: 900000,
};
const d0 = A && typeof A.defaults === 'function' ? A.defaults() : null;
check('A0 interface. global MuseAnomaly exposes defaults/sanitize/evaluate; defaults() is exact',
  !!A && typeof A.sanitize === 'function' && typeof A.evaluate === 'function' &&
  JSON.stringify(d0) === JSON.stringify(EXPECTED_DEFAULTS) &&
  JSON.stringify(A.defaults()) === JSON.stringify(EXPECTED_DEFAULTS), // fresh copy, stable
  { keys: d0 ? Object.keys(d0) : null, defaults: d0 });

// fixed clock — the detector must never read the real one
const NOW = 1800000000000;
const WIN = EXPECTED_DEFAULTS.rateWindowMs;   // 300000
const TWIN = EXPECTED_DEFAULTS.topicWindowMs; // 600000
// `spread(n, stepMs)` = n timestamps ending at NOW, one every stepMs (default 1s => all in-window)
const spread = (n, stepMs = 1000) => Array.from({ length: n }, (_, i) => NOW - i * stepMs);
const settingsWith = (over) => Object.assign(A.defaults(), over || {});
const win = (over) => Object.assign(
  { settings: A.defaults(), allowTs: [], topics: new Map(), totalClicks: 0 }, over || {});

// ---------- 1. RATE boundary: 149 => null, 150 => fire ----------
const r149 = A.evaluate(win({ allowTs: spread(149), totalClicks: 149 }), NOW);
const r150 = A.evaluate(win({ allowTs: spread(150), totalClicks: 150 }), NOW);
check('1 RATE boundary. 149 in-window clicks => null; 150 => {rule:"rate", count:150, threshold:150}',
  r149 === null && !!r150 && r150.rule === 'rate' && r150.detail.count === 150 && r150.detail.threshold === 150,
  { r149, r150 });

// ---------- 2. RATE prune: the oldest of 150 falls outside the window ----------
// 149 in-window + 1 clearly older than rateWindowMs (6 min back, outside under [ ] and ( ] alike)
const prunedTs = spread(149).concat([NOW - WIN - 60000]);
const r2 = A.evaluate(win({ allowTs: prunedTs, totalClicks: prunedTs.length }), NOW);
check('2 RATE prune. 150 timestamps whose oldest is outside rateWindowMs => null (pruned, not counted)',
  prunedTs.length === 150 && r2 === null, { len: prunedTs.length, r2 });

// window edge: the interval is HALF-OPEN (now - rateWindowMs, now] — a timestamp landing exactly
// on the floor is already pruned, so 149 in-window + 1 on the floor + 1 past it => still null.
// (Falsification: a closed-left `ts >= floor` count makes this check RED.)
const edgeTs = spread(149).concat([NOW - WIN, NOW - WIN - 60000]);
const r2b = A.evaluate(win({ allowTs: edgeTs, totalClicks: edgeTs.length }), NOW);
check('2b RATE window edge. the interval is (now-rateWindowMs, now]: 149 in + 1 ON the floor + 1 past it => null',
  edgeTs.length === 151 && r2b === null, { len: edgeTs.length, r2b });

// ---------- 3. TOPIC: share 0.8 fires, share 0.5 stays silent ----------
const topicWin = (repoCount, otherCount) => {
  const m = new Map([['spike-repo', spread(repoCount)], ['other-repo', spread(otherCount)]]);
  return m;
};
const t3a = A.evaluate(win({ allowTs: spread(50), topics: topicWin(40, 10), totalClicks: 100 }), NOW);
const t3b = A.evaluate(win({ allowTs: spread(80), topics: topicWin(40, 40), totalClicks: 100 }), NOW);
check('3 TOPIC. 40 of 50 (share 0.8) => {rule:"topic", topic:"spike-repo", topicCount:40, total:50}; 40 of 80 (share 0.5) => null',
  !!t3a && t3a.rule === 'topic' && t3a.topic === 'spike-repo' && t3a.detail.topicCount === 40 &&
  t3a.detail.total === 50 && Math.abs(t3a.detail.share - 0.8) < 1e-12 && t3b === null,
  { t3a, t3b });

// ---------- 4. minSample gate: totalClicks < 100 => silent ----------
const r4 = A.evaluate(win({ allowTs: spread(150), topics: topicWin(40, 10), totalClicks: 99 }), NOW);
check('4 minSample. totalClicks=99 < minSample=100 => null even though RATE (150) and TOPIC (0.8) would both fire',
  r4 === null, { r4 });

// ---------- 5. enabled:false => silent ----------
const r5 = A.evaluate(win({ settings: settingsWith({ enabled: false }), allowTs: spread(150), totalClicks: 150 }), NOW);
check('5 enabled:false. the firing burst stays silent when G04 is switched off', r5 === null, { r5 });

// ---------- 6. sanitize fail-closed ----------
let s6 = null, s6err = null;
try {
  s6 = A.sanitize({ rateMaxPerMin: 'abc', topicShareMin: -5, minSample: NaN, rateWindowMs: 0 });
} catch (e) { s6err = String(e && e.message || e); }
let junk = [], junkErr = null;
try {
  junk = [A.sanitize(null), A.sanitize('nope'), A.sanitize(undefined), A.sanitize(42), A.sanitize({ enabled: 'yes' })];
} catch (e) { junkErr = String(e && e.message || e); }
check('6 sanitize fail-closed. {rateMaxPerMin:"abc", topicShareMin:-5, minSample:NaN, rateWindowMs:0} => shipped defaults; null/string/number input never throws',
  s6err === null && junkErr === null &&
  JSON.stringify(s6) === JSON.stringify(EXPECTED_DEFAULTS) &&
  junk.every((j) => JSON.stringify(j) === JSON.stringify(EXPECTED_DEFAULTS)),
  { sanitized: s6, err: s6err, junkErr, junk0: junk[0] });

// ---------- 7. user-lowered rateMaxPerMin=10 => threshold 50 ----------
const s7 = settingsWith({ rateMaxPerMin: 10 });
const r7a = A.evaluate(win({ settings: s7, allowTs: spread(50), totalClicks: 100 }), NOW);
const r7b = A.evaluate(win({ settings: s7, allowTs: spread(49), totalClicks: 100 }), NOW);
check('7 user-lowered rateMaxPerMin=10. threshold becomes 10*300000/60000 = 50: fires at 50 clicks, silent at 49',
  !!r7a && r7a.rule === 'rate' && r7a.detail.count === 50 && r7a.detail.threshold === 50 && r7b === null,
  { r7a, r7b });

// ---------- 8. malformed win never throws ----------
let m8 = [], err8 = null;
try {
  m8.push(A.evaluate(win({ topics: {}, allowTs: null, totalClicks: 200 }), NOW));            // topics not a Map
  m8.push(A.evaluate(win({ topics: [], allowTs: [NOW, null, 'x', NaN, undefined], totalClicks: 200 }), NOW));
  m8.push(A.evaluate(win({ topics: null, allowTs: spread(150), totalClicks: 200 }), NOW));   // fires, no topics
  m8.push(A.evaluate(win({ topics: new Map([['t', null]]), allowTs: null, totalClicks: 200 }), NOW));
  m8.push(A.evaluate(null, NOW));
  m8.push(A.evaluate(undefined, NOW));
  m8.push(A.evaluate(win({ allowTs: spread(150), totalClicks: 200 }), undefined));           // non-finite now
} catch (e) { err8 = String(e && e.message || e); }
check('8 malformed win. topics not a Map / allowTs null / junk timestamps / win null => never throws (silent, except the legit burst)',
  err8 === null && m8[0] === null && m8[1] === null && !!m8[2] && m8[2].rule === 'rate' &&
  m8[3] === null && m8[4] === null && m8[5] === null && m8[6] === null,
  { err: err8, results: m8 });

// ---------- 9. missing settings object never throws ----------
let m9 = null, err9 = null;
try {
  m9 = A.evaluate({ allowTs: spread(150), topics: new Map(), totalClicks: 200 }, NOW);
} catch (e) { err9 = String(e && e.message || e); }
check('9 missing settings. evaluate({allowTs,topics,totalClicks}) never throws; shipped defaults apply (enabled true, minSample 100) => rate fires',
  err9 === null && !!m9 && m9.rule === 'rate' && m9.detail.count === 150 && m9.detail.threshold === 150,
  { err: err9, result: m9 });

// ---------- report ----------
for (const c of checks) {
  console.log((c.ok ? 'PASS  ' : 'FAIL  ') + c.name + (c.ok || c.detail === undefined ? '' : '  ' + JSON.stringify(c.detail)));
}
const failed = checks.filter((c) => !c.ok);
console.log(JSON.stringify({ file: path.relative(ROOT, SRC).replace(/\\/g, '/'), total: checks.length, failed: failed.length, ok: failed.length === 0 }, null, 2));
process.exit(failed.length === 0 ? 0 : 2);
