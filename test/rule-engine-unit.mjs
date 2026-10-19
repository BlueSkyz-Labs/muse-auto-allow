#!/usr/bin/env node
/**
 * rule-engine-unit.mjs — deterministic unit verification for the v1.22.0 (W5) pure modules
 * extension/rules.js (F1) and extension/audit.js (F2), with no browser and no Chrome. Both REAL
 * shipped modules are loaded into vm sandboxes (same pattern as test/anomaly-unit.mjs), so every
 * assertion drives the shipped code, not a re-implementation.
 *
 * Checks (docs/W5_RULE_ENGINE_AUDIT_SPEC.md §F1/§F2):
 *   R0  interface. MuseRules = {defaults,sanitize,decide}; MuseAudit = {buildJson,buildCsv,
 *       weeklySummary,containsForbidden}; defaults() deep-equals {layers:[]} and is a fresh copy
 *   D1  legacy blockKeywords substring                 -> block  keyword:<kw>
 *   D2  enabled block rule matches (topic ∨ keyword)   -> block  rule:<id>
 *   D3  enabled ask rule matches                       -> ask    rule:<id> (block outranks ask)
 *   D4  legacy allowTopics non-empty ∧ topic miss      -> block  topic
 *   D5  >=1 enabled allow rule, none matches           -> ask    allow-miss
 *   D6  nothing intervenes                             -> none   null
 *   7   yolo bypass. win.yolo:true => none even with a firing block rule + block keyword
 *   8   legacy allowTopics empty/absent = allow-all (unchanged); D1 still blocks
 *   9   sanitize fail-closed: unknown kind / missing-or-non-object match / non-object / bad id
 *   10  sanitize limits: <=50 rules, <=50 per list, each string <=64
 *   11  sanitize rejects prototype keys (own __proto__, id 'constructor'); nothing polluted
 *   12  sanitize top-level not an array => {ok:false, layers:[]}; {layers:[...]} accepted
 *   13  sanitize duplicate id keeps the FIRST rule; topics/keywords lowercased
 *   14  audit JSON entry allowlist (at,kind,label,context,blockedReason,standing,dryRun) + dated filename
 *   15  CSV: UTF-8 BOM, header, comma/quote/newline escaping
 *   16  containsForbidden catches license / cryptKeyRaw / "token" / "iv" / "ct"
 *   17  weeklySummary: counters pass through; week = Mon..Sun sum of byDay around now
 *   18  purity (rules.js): no console/chrome/DOM/clock; runs in a bare vm realm
 *   19  purity (audit.js): no console/chrome/DOM/clock; runs in a bare vm realm
 *
 * Usage: node test/rule-engine-unit.mjs
 * Exit 0 = all checks pass, 2 = at least one fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RULES_SRC = path.join(ROOT, 'extension', 'rules.js');
const AUDIT_SRC = path.join(ROOT, 'extension', 'audit.js');

const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail }); return !!ok; };

// ---------- sandboxes: the REAL shipped modules in fresh vm realms ----------
// A console shim is provided so a mutated module that reaches for console still runs; the
// source-level scan inside the purity checks is what actually catches banned-global usage.
function load(file) {
  const sandbox = { console: { log: () => {}, warn: () => {}, error: () => {} } };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  return sandbox;
}
const R = load(RULES_SRC).MuseRules;
const X = load(AUDIT_SRC).MuseAudit;

// helpers — `rule()` builds a well-formed layer; `legacyEmpty` is the shipped "no restriction" pair
const rule = (id, kind, over) => Object.assign({ id, kind, match: {} }, over || {});
const legacyEmpty = { blockKeywords: [], allowTopics: [] };

// ---------- R0: interface ----------
const d0 = R && typeof R.defaults === 'function' ? R.defaults() : null;
const d0b = R.defaults();
d0b.layers.push('mutated');   // defaults() must hand back a FRESH copy every call
const rulesKeys = R ? Object.keys(R).sort().join(',') : '';
const auditKeys = X ? Object.keys(X).sort().join(',') : '';
check('R0 interface. MuseRules={defaults,sanitize,decide}; MuseAudit={buildJson,buildCsv,weeklySummary,containsForbidden}; defaults() deep-equals {layers:[]} (fresh copy)',
  rulesKeys === 'decide,defaults,sanitize' &&
  auditKeys === 'buildCsv,buildJson,containsForbidden,weeklySummary' &&
  JSON.stringify(d0) === JSON.stringify({ layers: [] }) &&
  JSON.stringify(R.defaults()) === JSON.stringify({ layers: [] }),
  { rulesKeys, auditKeys, d0, afterMutate: R.defaults() });

// ---------- D1: legacy blockKeywords (substring, case-insensitive) ----------
const rD1 = R.decide({ topic: 'anything', text: 'please deploy to production now', legacy: { blockKeywords: ['deploy', 'secret'], allowTopics: [] }, yolo: false }, []);
check('D1 legacy blockKeywords substring => {action:"block", reason:"keyword:deploy", ruleId:null}',
  rD1.action === 'block' && rD1.reason === 'keyword:deploy' && rD1.ruleId === null, { rD1 });

// ---------- D2: enabled block rule (topic exact OR keyword substring) ----------
const rD2a = R.decide({ topic: 'deploy', text: 'card text', legacy: legacyEmpty }, [
  rule('no-hit', 'block', { match: { keywords: ['nothing-here'] } }),
  rule('blk-a', 'block', { match: { topics: ['deploy'] } }),
]);
const rD2b = R.decide({ topic: '', text: 'contains risky-word here', legacy: legacyEmpty }, [
  rule('blk-k', 'block', { match: { keywords: ['risky-word'] } }),
]);
check('D2 enabled block rule matches (topic exact OR keyword substring) => {action:"block", reason:"rule:<id>", ruleId:"<id>"}',
  rD2a.action === 'block' && rD2a.reason === 'rule:blk-a' && rD2a.ruleId === 'blk-a' &&
  rD2b.action === 'block' && rD2b.reason === 'rule:blk-k' && rD2b.ruleId === 'blk-k',
  { rD2a, rD2b });

// ---------- D3: enabled ask rule (and block still outranks ask) ----------
const rD3a = R.decide({ topic: '', text: 'please confirm the action', legacy: legacyEmpty }, [
  rule('ask-a', 'ask', { match: { keywords: ['confirm'] } }),
]);
const rD3b = R.decide({ topic: '', text: 'confirm the deploy', legacy: legacyEmpty }, [
  rule('ask-a', 'ask', { match: { keywords: ['confirm'] } }),
  rule('blk-a', 'block', { match: { keywords: ['deploy'] } }),
]);
check('D3 enabled ask rule matches => {action:"ask", reason:"rule:<id>"}; a block rule still outranks an ask rule listed first',
  rD3a.action === 'ask' && rD3a.reason === 'rule:ask-a' && rD3a.ruleId === 'ask-a' &&
  rD3b.action === 'block' && rD3b.ruleId === 'blk-a',
  { rD3a, rD3b });

// ---------- D4: legacy allowTopics non-empty and the topic is not listed ----------
const rD4a = R.decide({ topic: 'other', text: 'x', legacy: { blockKeywords: [], allowTopics: ['deploy', 'build'] } }, []);
const rD4b = R.decide({ topic: 'deploy', text: 'x', legacy: { blockKeywords: [], allowTopics: ['Deploy', 'build'] } }, []);
check('D4 legacy allowTopics non-empty AND topic not listed => {action:"block", reason:"topic", ruleId:null}; a listed topic (case-insensitive) falls through to none',
  rD4a.action === 'block' && rD4a.reason === 'topic' && rD4a.ruleId === null &&
  rD4b.action === 'none' && rD4b.reason === null,
  { rD4a, rD4b });

// ---------- D5: >=1 enabled allow rule and none matched ----------
const rD5a = R.decide({ topic: 'nope', text: 'x', legacy: legacyEmpty }, [rule('allow-a', 'allow', { match: { topics: ['deploy'] } })]);
const rD5b = R.decide({ topic: 'deploy', text: 'x', legacy: legacyEmpty }, [rule('allow-a', 'allow', { match: { topics: ['deploy'] } })]);
const rD5c = R.decide({ topic: 'nope', text: 'x', legacy: legacyEmpty }, [rule('allow-a', 'allow', { match: { topics: ['deploy'] }, enabled: false })]);
check('D5 >=1 enabled allow rule AND none matches => {action:"ask", reason:"allow-miss"}; a matching allow => none; a DISABLED allow is not counted',
  rD5a.action === 'ask' && rD5a.reason === 'allow-miss' && rD5a.ruleId === null &&
  rD5b.action === 'none' &&
  rD5c.action === 'none',
  { rD5a, rD5b, rD5c });

// ---------- D6: nothing intervenes ----------
const rD6 = R.decide({ topic: 'deploy', text: 'x', legacy: legacyEmpty }, []);
check('D6 nothing intervenes => {action:"none", reason:null, ruleId:null}',
  rD6.action === 'none' && rD6.reason === null && rD6.ruleId === null, { rD6 });

// ---------- 7: yolo bypass ----------
const yoloWin = { topic: 'nope', text: 'deploy secret token', legacy: { blockKeywords: ['deploy'], allowTopics: ['deploy'] }, yolo: true };
const layers7 = [rule('blk-a', 'block', { match: { keywords: ['deploy'] } }), rule('ask-a', 'ask', { match: { keywords: ['token'] } })];
const r7a = R.decide(yoloWin, layers7);
const r7b = R.decide(Object.assign({}, yoloWin, { yolo: false }), layers7);
check('7 yolo bypass. win.yolo:true => {action:"none"} even with a matching block rule + block keyword + allowTopics miss; yolo:false still blocks',
  r7a.action === 'none' && r7a.reason === null && r7a.ruleId === null && r7b.action === 'block',
  { r7a, r7b });

// ---------- 8: legacy allowTopics empty/absent = allow-all (unchanged) ----------
const r8a = R.decide({ topic: 'random', text: 'a plain card', legacy: { blockKeywords: [], allowTopics: [] } }, []);
const r8b = R.decide({ topic: 'random', text: 'a plain card', legacy: {} }, []);
const r8c = R.decide({ topic: 'random', text: 'a plain card', legacy: undefined }, []);
const r8d = R.decide({ topic: 'random', text: 'please deploy', legacy: { blockKeywords: ['deploy'], allowTopics: [] } }, []);
check('8 legacy allowTopics empty/absent = allow-all (unchanged): never blocks on topic; a legacy block keyword still does (D1)',
  r8a.action === 'none' && r8b.action === 'none' && r8c.action === 'none' &&
  r8d.action === 'block' && r8d.reason === 'keyword:deploy',
  { r8a, r8b, r8c, r8d });

// ---------- 9: sanitize fail-closed (wrong-typed rules dropped) ----------
const s9 = R.sanitize([
  { id: 'ok-1', kind: 'allow', match: { topics: ['a'] } },
  { id: 'bad-kind', kind: 'deny', match: { topics: ['a'] } },   // unknown kind
  { id: 'no-match', kind: 'block' },                            // missing match
  { id: 'BAD ID', kind: 'block', match: { topics: ['a'] } },    // invalid slug
  { id: 'x', kind: 'block', match: 'nope' },                    // match is not an object
  'nope', 42, null,                                             // not objects at all
]);
check('9 sanitize fail-closed. unknown kind / missing-or-non-object match / non-object rule / invalid id are all dropped; the good rule survives',
  s9.ok === true && s9.layers.length === 1 && s9.layers[0].id === 'ok-1' && s9.layers[0].kind === 'allow',
  { s9 });

// ---------- 10: sanitize limits ----------
const many = [];
for (let i = 0; i < 60; i++) many.push({ id: 'r-' + i, kind: 'allow', match: { topics: ['t' + i] } });
const s10a = R.sanitize(many);
const s10b = R.sanitize([{ id: 'big', kind: 'block', match: { keywords: Array.from({ length: 80 }, (_, i) => 'k' + i) } }]);
const s10c = R.sanitize([{ id: 'long', kind: 'block', match: { keywords: ['x'.repeat(100)] } }]);
check('10 sanitize limits. <=50 rules (60 in => 50 kept); <=50 per list (80 in => 50 kept); each string <=64 (100 in => 64)',
  s10a.ok === true && s10a.layers.length === 50 && s10a.layers[49].id === 'r-49' &&
  s10b.layers[0].match.keywords.length === 50 &&
  s10c.layers[0].match.keywords[0].length === 64,
  { rules: s10a.layers.length, kws: s10b.layers[0].match.keywords.length, strLen: s10c.layers[0].match.keywords[0].length });

// ---------- 11: sanitize rejects prototype keys ----------
const protoRule = JSON.parse('{"id":"evil","kind":"block","match":{"topics":["x"]},"__proto__":{"polluted":true}}');
const ctorRule = { id: 'constructor', kind: 'block', match: { topics: ['x'] } };
const s11 = R.sanitize([protoRule, ctorRule, { id: 'good', kind: 'block', match: { topics: ['x'] } }]);
check('11 sanitize rejects prototype keys. an own __proto__ key and the id "constructor" are refused; Object.prototype is not polluted',
  s11.ok === true && s11.layers.length === 1 && s11.layers[0].id === 'good' &&
  ({}).polluted === undefined && Object.prototype.polluted === undefined,
  { kept: s11.layers.map((r) => r.id), polluted: ({}).polluted });

// ---------- 12: sanitize top-level ----------
let s12 = null, err12 = null;
try {
  s12 = [R.sanitize('nope'), R.sanitize(42), R.sanitize(null), R.sanitize(undefined), R.sanitize({ foo: 1 }), R.sanitize({ layers: 'nope' })];
} catch (e) { err12 = String((e && e.message) || e); }
const s12c = R.sanitize({ layers: [{ id: 'wrapped', kind: 'block', match: { topics: ['a'] } }] });
check('12 sanitize top-level. not-an-array (string/number/null/undefined/object without a layers array) => {ok:false, layers:[]}; a {layers:[...]} container is accepted; never throws',
  err12 === null && s12.every((r) => r.ok === false && Array.isArray(r.layers) && r.layers.length === 0) &&
  s12c.ok === true && s12c.layers.length === 1 && s12c.layers[0].id === 'wrapped',
  { err: err12, s12, wrapped: s12c.layers.map((r) => r.id) });

// ---------- 13: duplicate id + lowercasing ----------
const s13 = R.sanitize([
  { id: 'dup', kind: 'allow', match: { topics: ['First'], keywords: ['Deploy'] } },
  { id: 'dup', kind: 'block', match: { topics: ['second'] } },
]);
check('13 sanitize duplicate id keeps the FIRST rule; topics/keywords are lowercased',
  s13.layers.length === 1 && s13.layers[0].kind === 'allow' &&
  s13.layers[0].match.topics[0] === 'first' && s13.layers[0].match.keywords[0] === 'deploy',
  { s13 });

// ---------- 14: audit JSON entry allowlist + dated filename ----------
const ALLOW_KEYS = ['at', 'kind', 'label', 'context', 'blockedReason', 'standing', 'dryRun'];
const auditEntries = [
  { at: '2026-10-19T08:00:00.000Z', kind: 'allow', label: 'Allow once', context: 'plain context', standing: true, dryRun: true, blockedReason: 'keyword:deploy', ctx: { iv: 'AAAA', ct: 'BBBB' }, token: 'leak', extra: 1 },
  { at: '2026-10-19T09:00:00.000Z', kind: 'ask', label: 'Ask', context: 'c2', standing: false, dryRun: false },
];
const bj = X.buildJson({
  version: '1.22.0', generatedAt: '2026-10-19T12:34:56.000Z',
  rules: [{ id: 'blk-a', kind: 'block', match: { keywords: ['deploy'] }, note: 'no deploy' }],
  counters: { clicks: 120, blocked: 7, asked: 3, followups: 2 },
  byDay: { '2026-10-19': 4 },
  log: auditEntries,
});
let doc = null, err14 = null;
try { doc = JSON.parse(bj.json); } catch (e) { err14 = String((e && e.message) || e); }
const keysOk = !!doc && doc.log.every((e) => Object.keys(e).every((k) => ALLOW_KEYS.indexOf(k) >= 0));
const noForeign = !!doc && doc.log.every((e) => !('ctx' in e) && !('token' in e) && !('extra' in e) && !('iv' in e) && !('ct' in e));
check('14 audit JSON allowlist. every log entry carries ONLY at/kind/label/context/blockedReason/standing/dryRun (ctx/token/extra dropped); the built text scans clean; filename is dated; buildJson(null) => ok:false',
  err14 === null && bj.ok === true && keysOk && noForeign && doc.log.length === 2 &&
  doc.log[0].context === 'plain context' && doc.log[0].standing === true && doc.log[0].dryRun === true &&
  !('standing' in doc.log[1]) && !('dryRun' in doc.log[1]) &&
  bj.filename === 'muse-auto-allow-audit-2026-10-19.json' &&
  X.containsForbidden(bj.json).ok === true &&
  X.buildJson(null).ok === false,
  { filename: bj.filename, keysOk, noForeign, log0: doc && doc.log[0], err: err14 });

// ---------- 15: CSV escaping + BOM ----------
const csvEntries = [
  { at: '2026-10-19T08:00:00.000Z', kind: 'blocked', label: 'a,b', context: 'say "hi"', blockedReason: 'keyword:deploy' },
  { at: '2026-10-19T09:00:00.000Z', kind: 'allow', label: 'line1\nline2', context: 'plain', blockedReason: '' },
];
const csv = X.buildCsv(csvEntries);
check('15 CSV escaping. UTF-8 BOM + header "at,kind,label,context,blockedReason"; a comma field is quoted; an inner quote doubles; a newline field is quoted; a plain field stays bare',
  csv.charCodeAt(0) === 0xFEFF &&
  csv.slice(1).startsWith('at,kind,label,context,blockedReason') &&
  csv.indexOf('"a,b"') >= 0 &&
  csv.indexOf('"say ""hi"""') >= 0 &&
  csv.indexOf('"line1\nline2"') >= 0 &&
  csv.indexOf(',plain,') >= 0 &&
  X.buildCsv([]).slice(1).startsWith('at,kind,label,context,blockedReason'),
  { bom: csv.charCodeAt(0), head: csv.slice(0, 70) });

// ---------- 16: containsForbidden ----------
const fTokens = ['license', 'cryptKeyRaw', '"token"', '"iv"', '"ct"'];
const fResults = fTokens.map((tok) => X.containsForbidden('prefix ' + tok + ' suffix'));
const cleanScan = X.containsForbidden('at,kind,label,context — nothing secret here');
check('16 containsForbidden. each of license / cryptKeyRaw / "token" / "iv" / "ct" is caught (ok:false, hit:<token>); clean text => {ok:true, hit:null}',
  fResults.every((r, i) => r.ok === false && r.hit === fTokens[i]) &&
  cleanScan.ok === true && cleanScan.hit === null,
  { fResults, cleanScan });

// ---------- 17: weeklySummary (Mon..Sun) ----------
// 2026-10-19 is a Monday, so the ISO week around Wed 2026-10-21 is Mon 19 .. Sun 25.
const byDay = {
  '2026-10-18': 5,   // Sunday — previous week
  '2026-10-19': 1,   // Mon
  '2026-10-20': 2,
  '2026-10-21': 3,   // Wed (the "now" day)
  '2026-10-22': 4,
  '2026-10-23': 5,
  '2026-10-24': 6,
  '2026-10-25': 7,   // Sun — last day of the week
  '2026-10-26': 8,   // next Monday
};
const nowWed = new Date(2026, 9, 21, 12, 0, 0).getTime();   // month 9 = October
const ws = X.weeklySummary({ clicks: 120, blocked: 7, asked: 3, followups: 2 }, byDay, nowWed);
check('17 weeklySummary. counters pass through; week = Mon..Sun sum of byDay around now (1+2+3+4+5+6+7 = 28), excluding the prior Sunday and the next Monday',
  ws.clicks === 120 && ws.blocked === 7 && ws.asked === 3 && ws.followups === 2 && ws.week === 28,
  { ws });

// ---------- 18: purity — rules.js ----------
// The scan is textual, so a banned global in a comment counts too. The bare realm run proves the
// module needs neither a console, nor extension APIs, nor any page global.
const BANNED = ['console', 'chrome', 'document', 'window', 'Date.now', 'setTimeout', 'setInterval', 'Math.random'];
const rulesSrc = fs.readFileSync(RULES_SRC, 'utf8');
const rulesHits = BANNED.filter((b) => rulesSrc.includes(b));
let rulesRan = null, rulesErr = null;
try {
  const bare = vm.createContext({});
  vm.runInContext(rulesSrc, bare, { filename: RULES_SRC });
  rulesRan = bare.MuseRules.decide({ topic: 'x', text: 'y', legacy: {} }, []).action;
} catch (e) { rulesErr = String((e && e.message) || e); }
check('18 purity (rules.js). source has no console/chrome/DOM/clock; runs in a bare vm realm (no console, no extension APIs) and decide() returns "none"',
  rulesHits.length === 0 && rulesErr === null && rulesRan === 'none',
  { hits: rulesHits, err: rulesErr, ran: rulesRan, bytes: rulesSrc.length });

// ---------- 19: purity — audit.js ----------
const auditSrc = fs.readFileSync(AUDIT_SRC, 'utf8');
const auditHits = BANNED.filter((b) => auditSrc.includes(b));
let auditRan = null, auditErr = null;
try {
  const bare = vm.createContext({});
  vm.runInContext(auditSrc, bare, { filename: AUDIT_SRC });
  const A = bare.MuseAudit;
  const built = A.buildJson({ generatedAt: '2026-10-19T00:00:00.000Z', log: [{ at: 'x', kind: 'allow', label: 'l', context: 'c' }] });
  const bareCsv = A.buildCsv([{ at: 'x', kind: 'allow', label: 'l', context: 'c' }]);
  const bareWeek = A.weeklySummary({ clicks: 1 }, { '2026-10-19': 2 }, new Date(2026, 9, 21).getTime());
  const bareScan = A.containsForbidden('clean');
  auditRan = (built.ok === true && built.filename === 'muse-auto-allow-audit-2026-10-19.json' &&
              bareCsv.charCodeAt(0) === 0xFEFF && bareWeek.week === 2 && bareScan.ok === true) ? 'ok' : 'bad';
} catch (e) { auditErr = String((e && e.message) || e); }
check('19 purity (audit.js). source has no console/chrome/DOM/clock; runs in a bare vm realm and builds JSON/CSV/summary/scan',
  auditHits.length === 0 && auditErr === null && auditRan === 'ok',
  { hits: auditHits, err: auditErr, ran: auditRan, bytes: auditSrc.length });

// ---------- report ----------
for (const c of checks) {
  console.log((c.ok ? 'PASS  ' : 'FAIL  ') + c.name + (c.ok || c.detail === undefined ? '' : '  ' + JSON.stringify(c.detail)));
}
const failed = checks.filter((c) => !c.ok);
console.log(JSON.stringify({
  file: 'extension/rules.js + extension/audit.js',
  total: checks.length,
  failed: failed.length,
  ok: failed.length === 0,
}, null, 2));
process.exit(failed.length === 0 ? 0 : 2);
