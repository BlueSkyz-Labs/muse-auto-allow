#!/usr/bin/env node
/**
 * rulesim-unit.mjs — deterministic unit verification for extension/rulesim.js (v1.22.4, G3).
 * The REAL shipped modules are loaded into a vm sandbox, so assertions drive shipped code.
 * House style (see rule-engine-unit.mjs): check(name, cond, detail) + JSON summary + exit 1.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const ext = join(here, '..', 'extension');
const ctx = vm.createContext({ console });
for (const f of ['rules.js', 'rulesim.js']) {
  vm.runInContext(readFileSync(join(ext, f), 'utf8'), ctx, { filename: f });
}
const Sim = vm.runInContext('MuseRuleSim', ctx);

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) pass++;
  else { fail++; failures.push({ name, detail: detail === undefined ? null : detail }); }
}

const layers = [
  { id: 'blk-invoices', kind: 'block', match: { topics: [], keywords: ['invoice'] }, enabled: true },
  { id: 'ask-contracts', kind: 'ask', match: { topics: ['contracts'], keywords: [] }, enabled: true },
  { id: 'allow-notes', kind: 'allow', match: { topics: ['notes'], keywords: [] }, enabled: true },
  { id: 'blk-off', kind: 'block', match: { keywords: ['everything'] }, enabled: false },
];

// D1 legacy keyword
{
  const r = Sim.simulate({ topic: 'notes', text: 'please sign the invoice', layers: [], legacy: { blockKeywords: ['invoice'] } });
  check('D1 keyword block', r.action === 'block' && r.reason === 'keyword:invoice', r.reason);
  check('D1 step recorded', r.steps.length === 1 && r.steps[0].code === 'D1' && r.steps[0].matched === true);
  check('D1 matched meta', r.matched && r.matched.type === 'keyword' && r.matched.value === 'invoice');
}
// D2 block rule by keyword / topic
{
  const r = Sim.simulate({ topic: 'notes', text: 'an invoice arrived', layers });
  check('D2 block rule (keyword)', r.action === 'block' && r.ruleId === 'blk-invoices', r.ruleId);
  check('D2 ruleDesc mentions keywords', /keywords: invoice/.test(r.ruleDesc), r.ruleDesc);
  const r2 = Sim.simulate({ topic: 'invoices', text: '', layers: [{ id: 'b1', kind: 'block', match: { topics: ['invoices'] }, enabled: true }] });
  check('D2 block rule (topic exact)', r2.action === 'block' && r2.ruleId === 'b1', r2.ruleId);
}
// D3 ask rule
{
  const r = Sim.simulate({ topic: 'contracts', text: 'renewal', layers });
  check('D3 ask rule', r.action === 'ask' && r.ruleId === 'ask-contracts', r.ruleId);
  check('D3 steps include D1 and D2 before the hit', r.steps.map((s) => s.code).join(',') === 'D1,D2,D3', r.steps.map((s) => s.code).join(','));
}
// D4 legacy allow-list
{
  const r = Sim.simulate({ topic: 'notes', text: '', layers: [], legacy: { allowTopics: ['notes', 'docs'] } });
  check('D4 topic allowed -> no block', r.action === 'none' && r.reason === null, r.reason);
  const r2 = Sim.simulate({ topic: 'other', text: '', layers: [], legacy: { allowTopics: ['notes'] } });
  check('D4 topic miss -> block', r2.action === 'block' && r2.reason === 'topic', r2.reason);
}
// D5 allow-miss vs allow matched
{
  const r = Sim.simulate({ topic: 'drafts', text: '', layers });
  check('D5 allow-miss -> ask', r.action === 'ask' && r.reason === 'allow-miss', r.reason);
  const r2 = Sim.simulate({ topic: 'notes', text: '', layers });
  check('D5 allow matched -> none', r2.action === 'none' && r2.reason === null, r2.reason);
}
// D6 baseline + disabled rules ignored
{
  const r = Sim.simulate({ topic: 'x', text: 'everything everywhere', layers: [] });
  check('D6 baseline none', r.action === 'none' && r.reason === null, r.reason);
  check('D6 step is D6', r.steps.length && r.steps[r.steps.length - 1].code === 'D6');
  const off = Sim.simulate({ topic: 'x', text: 'everything everywhere', layers: [{ id: 'z', kind: 'block', match: { keywords: ['everything'] }, enabled: false }] });
  check('disabled block rule ignored', off.action === 'none', off.action);
}
// fail-closed + bounds + purity
{
  let threw = false;
  let r;
  try { r = Sim.simulate(null); } catch { threw = true; }
  check('null input does not throw', !threw && r && r.action === 'none');
  const rDirty = Sim.simulate({ topic: 42, text: { a: 1 }, layers: 'nope', legacy: [] });
  check('dirty input -> empty verdict', rDirty.action === 'none' && rDirty.steps.length > 0, JSON.stringify(rDirty.action));
  const big = 'a'.repeat(9000) + ' invoice';
  const rBig = Sim.simulate({ topic: '', text: big, layers: [], legacy: { blockKeywords: ['invoice'] } });
  check('text capped at 4000 (late keyword not seen)', rBig.action === 'none', rBig.action);
  const src = readFileSync(join(ext, 'rulesim.js'), 'utf8');
  check('purity: no chrome./document/console', !/chrome\.|document\.|console\./.test(src));
}

console.log(JSON.stringify({ ok: fail === 0, pass, fail, failures }, null, 2));
process.exit(fail === 0 ? 0 : 1);
