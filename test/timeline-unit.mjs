#!/usr/bin/env node
/**
 * timeline-unit.mjs — deterministic unit verification for extension/timeline.js (v1.22.4,
 * G2/S4/G10). Loads the REAL shipped module into a vm sandbox. House style: check() + JSON + exit 1.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const ext = join(here, '..', 'extension');
const ctx = vm.createContext({ console });
vm.runInContext(readFileSync(join(ext, 'timeline.js'), 'utf8'), ctx, { filename: 'timeline.js' });
const T = vm.runInContext('MuseTimeline', ctx);

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) pass++;
  else { fail++; failures.push({ name, detail: detail === undefined ? null : detail }); }
}

const layers = [
  { id: 'blk-inv', kind: 'block', match: { keywords: ['invoice'] }, enabled: true },
  { id: 'ask-c', kind: 'ask', match: { topics: ['contracts'] }, enabled: true },
];
const entries = [
  { at: '2026-10-18T08:00:00.000Z', kind: 'clicked', label: 'Notes card', context: 'allow once', blockedReason: null },
  { at: '2026-10-19T09:30:00.000Z', kind: 'blocked', label: 'Invoice card', context: 'x'.repeat(400), blockedReason: 'rule:blk-inv' },
  { at: '2026-10-19T10:10:00.000Z', kind: 'clicked', label: 'Notes card 2', context: 'standing', standing: true },
  { at: '2026-10-19T10:20:00.000Z', kind: 'asked', label: 'Contracts card', context: 'ask rule', blockedReason: 'rule:ask-c' },
  { at: 'bad-date', kind: 'clicked', label: 'broken' },
  null,
];

const r = T.build(entries, { layers, labelDay: (k) => 'Day ' + k });
check('build keeps 4 valid entries', r.counts.total === 4, r.counts.total);
check('two local days', r.days.length === 2, r.days.map((d) => d.key).join(','));
check('newest day first', r.days[0].key === '2026-10-19', r.days[0].key);
check('sort newest first inside a day', r.days[0].items[0].at === '2026-10-19T10:20:00.000Z', r.days[0].items[0].at);
check('counts byKind', r.counts.byKind.clicked === 2 && r.counts.byKind.blocked === 1 && r.counts.byKind.asked === 1, JSON.stringify(r.counts.byKind));
check('labelDay applies', r.days[0].label === 'Day 2026-10-19', r.days[0].label);
check('context capped at 300', r.days[0].items.find((e) => e.kind === 'blocked').context.length === 300);
check('lastBlocked picks latest blocked', r.lastBlocked && r.lastBlocked.at === '2026-10-19T09:30:00.000Z', JSON.stringify(r.lastBlocked));
check('lastBlocked has ruleDesc via layers', r.lastBlocked && /keywords: invoice/.test(r.lastBlocked.ruleDesc), r.lastBlocked && r.lastBlocked.ruleDesc);

// explain()
{
  const e1 = T.explain({ blockedReason: 'rule:blk-inv' }, layers);
  check('explain rule:<id>', e1 && e1.ruleId === 'blk-inv' && /keywords: invoice/.test(e1.ruleDesc), JSON.stringify(e1));
  const e2 = T.explain({ blockedReason: 'keyword:refund' }, layers);
  check('explain keyword', e2 && /refund/.test(e2.text), e2 && e2.text);
  const e3 = T.explain({ blockedReason: 'topic' }, layers);
  check('explain topic', e3 && /allowed list/.test(e3.text), e3 && e3.text);
  const e4 = T.explain({ blockedReason: 'allow-miss' }, layers);
  check('explain allow-miss', e4 && /none matched/.test(e4.text), e4 && e4.text);
  check('explain null reason -> null', T.explain({ blockedReason: null }, layers) === null);
  check('explain unknown rule id degrades', T.explain({ blockedReason: 'rule:ghost' }, layers).ruleId === 'ghost');
}

// filter()
{
  const items = r.days[0].items;
  check('filter by kind', T.filter(items, { kind: 'clicked' }).length === 1, T.filter(items, { kind: 'clicked' }).length);
  check('filter by q (case-insensitive)', T.filter(items, { q: 'NOTES' }).length === 1);
  check('filter no criteria returns all', T.filter(items, {}).length === items.length);
  check('filter garbage -> empty', T.filter([null, 1, 'x'], { kind: 'clicked' }).length === 0);
}

// purity + bounds
{
  const src = readFileSync(join(ext, 'timeline.js'), 'utf8');
  check('purity: no chrome./document/console', !/chrome\.|document\.|console\./.test(src));
  check('build(undefined) is safe', T.build(undefined, undefined).counts.total === 0);
  const many = Array.from({ length: 1500 }, (_, i) => ({ at: '2026-10-19T10:00:00.000Z', kind: 'clicked', label: 'n' + i }));
  check('entries capped at 1000', T.build(many).counts.total === 1000, T.build(many).counts.total);
}

console.log(JSON.stringify({ ok: fail === 0, pass, fail, failures }, null, 2));
process.exit(fail === 0 ? 0 : 1);
