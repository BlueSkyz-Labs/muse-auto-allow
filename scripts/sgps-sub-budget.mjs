#!/usr/bin/env node
// sgps-sub-budget.mjs — Claude subscription budget audit and quota guard (CSB 1.0).
// Standard: sgps-core standards/finops/CLAUDE_SUBSCRIPTION_BUDGET_STANDARD.md
//
// Reads exported JSON only. It never calls a model, a provider or the network,
// and never reads a secret. Session usage cost_usd is an API-equivalent estimate,
// not what the Owner pays (flat Claude Max plan).
//
//   guard  --rate-limit <file|json>        → prints NORMAL | ESSENTIAL | STOP; exit 0 | 3 | 4
//   audit  --triggers <file> [--sessions <file>] [--json]
//                                           → findings CSB-01..CSB-04; exit 0 clean, 2 findings
//   --self-test                             → built-in cases, exit 0 on pass
//
// triggers file: the `data` array (or the whole object) from list_triggers, all pages joined.
// sessions file: array of get_session results ({ccr:{id, external_metadata, configured_model}} or the
// inner object), keyed by session id; a trigger's last_run.session_id cse_X maps to session_X.

import { readFileSync } from 'node:fs';

export const LIMITS = {
  persistent_context_tokens: 150_000, // CSB-02: a persistent session above this re-reads too much each fire
  max_fires_per_day: 6, // CSB-03: more often than every 4 h needs a free pre-check or an event trigger
  run_cost_warn_usd: 1.0, // CSB-04: one routine fire above this API-equivalent estimate
};

const OPUS = /opus/i;

function load(arg) {
  if (arg == null) return null;
  const s = String(arg).trim();
  if (s.startsWith('{') || s.startsWith('[')) return JSON.parse(s);
  return JSON.parse(readFileSync(s, 'utf8'));
}

export function guard(info) {
  const rl = info?.rate_limit_info ?? info?.external_metadata?.rate_limit_info ?? info;
  const status = rl?.status ?? 'unknown';
  if (status === 'rejected' || rl?.isUsingOverage === true) {
    return { mode: 'STOP', exit: 4, status, reason: 'quota rejected or overage: run nothing but a one-line alert' };
  }
  if (status === 'allowed_warning') {
    return { mode: 'ESSENTIAL', exit: 3, status, reason: 'quota warning: essential steps only, no Opus, defer weekly/monthly work until reset' };
  }
  if (status === 'allowed') return { mode: 'NORMAL', exit: 0, status, reason: 'quota allowed' };
  return { mode: 'ESSENTIAL', exit: 3, status, reason: 'quota state unknown: treat as warning (fail closed), never guess' };
}

// Rough fires/day from a 5-field cron (with optional CRON_TZ= prefix). Only minute+hour matter.
export function firesPerDay(cron) {
  if (!cron) return 0;
  const f = cron.replace(/^CRON_TZ=\S+\s+/, '').trim().split(/\s+/);
  if (f.length < 5) return 0;
  const count = (field, lo, hi) => {
    let n = 0;
    for (const part of field.split(',')) {
      const [range, stepS] = part.split('/');
      const step = stepS ? Number(stepS) : 1;
      let a = lo, b = hi;
      if (range !== '*') {
        const [x, y] = range.split('-').map(Number);
        a = x; b = y ?? (stepS ? hi : x);
      }
      for (let v = a; v <= b; v += step) n++;
    }
    return n;
  };
  const perDay = count(f[0], 0, 59) * count(f[1], 0, 23);
  const dow = f[4] === '*' ? 7 : count(f[4].replace(/7/g, '0'), 0, 6);
  const dom = f[2] === '*' ? 30 : count(f[2], 1, 31);
  return perDay * Math.min(dow / 7, dom / 30);
}

function sessionIndex(sessions) {
  const idx = new Map();
  for (const raw of sessions ?? []) {
    const s = raw?.ccr ?? raw;
    if (s?.id) idx.set(s.id, s);
  }
  return idx;
}

export function audit(triggersIn, sessionsIn) {
  const triggers = Array.isArray(triggersIn) ? triggersIn : triggersIn?.data ?? [];
  const sessions = sessionIndex(sessionsIn);
  const findings = [];
  for (const t of triggers) {
    if (!t?.enabled) continue;
    const cron = t.cron_expression;
    if (!cron) continue; // one-shot reminders are out of scope
    const model = t.derived_state?.model ?? t.model ?? '';
    const persistent = Boolean(t.persist_session || t.persistent_session_id);
    const sid = (t.persistent_session_id || t.last_run?.session_id || '').replace(/^cse_/, 'session_');
    const s = sid ? sessions.get(sid) : undefined;
    const served = s?.external_metadata?.last_served_model ?? s?.configured_model ?? '';
    const ctx = s?.external_metadata?.context_usage?.used_tokens ?? null;
    const cost = s?.external_metadata?.usage?.cost_usd ?? null;
    const base = { trigger: t.id, name: t.name };
    if (!model) {
      findings.push({ ...base, rule: 'CSB-01', severity: OPUS.test(served) ? 'HIGH' : 'MEDIUM',
        fact: `model field empty; last run served ${served || 'NOT_VERIFIED'}`,
        fix: 'set an explicit model (Haiku for script runners, Sonnet for PR/gate work); prompt text does not set it' });
    } else if (OPUS.test(model) && !/retro|review|verdict|rà soát sâu|deep/i.test(t.name ?? '')) {
      findings.push({ ...base, rule: 'CSB-01', severity: 'MEDIUM', fact: `explicit Opus (${model}) on a routine task`,
        fix: 'Opus only for the weekly lead verdict; use Sonnet' });
    }
    if (persistent && ctx != null && ctx > LIMITS.persistent_context_tokens) {
      findings.push({ ...base, rule: 'CSB-02', severity: 'HIGH',
        fact: `persistent session context ${ctx} tokens re-read on every fire`,
        fix: 'recreate as a fresh-session task, or hand off the session to a new one' });
    }
    const fpd = firesPerDay(cron);
    if (fpd > LIMITS.max_fires_per_day) {
      findings.push({ ...base, rule: 'CSB-03', severity: 'MEDIUM', fact: `~${Math.round(fpd)} fires/day`,
        fix: 'free pre-check (script exit code) before any model step, or move to 4 h / event wake' });
    }
    if (!persistent && cost != null && cost > LIMITS.run_cost_warn_usd) {
      findings.push({ ...base, rule: 'CSB-04', severity: 'LOW', fact: `last fire ~$${cost.toFixed(2)} API-equivalent`,
        fix: 'grep decisive lines, delegate grunt to free/Go lanes, cap the session' });
    }
  }
  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || a.rule.localeCompare(b.rule));
  return { schema: 'sgps.sub-budget-audit/1', tasks: triggers.filter((t) => t?.enabled && t.cron_expression).length, findings };
}

function selfTest() {
  const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
  assert(guard({ status: 'allowed' }).mode === 'NORMAL', 'allowed → NORMAL');
  assert(guard({ status: 'allowed_warning' }).exit === 3 && guard({ status: 'allowed_warning' }).reason.startsWith('quota warning'), 'warning → exit 3 via the warning branch');
  assert(guard({ status: 'rejected' }).exit === 4, 'rejected → exit 4');
  assert(guard({ status: 'allowed', isUsingOverage: true }).mode === 'STOP', 'overage → STOP');
  assert(guard({}).mode === 'ESSENTIAL', 'unknown fails closed');
  assert(guard({ external_metadata: { rate_limit_info: { status: 'allowed' } } }).mode === 'NORMAL', 'nested get_session');
  assert(firesPerDay('CRON_TZ=Asia/Ho_Chi_Minh 7 7-23/2 * * *') === 9, '2-hourly = 9');
  assert(firesPerDay('CRON_TZ=Asia/Ho_Chi_Minh 31 7 * * *') === 1, 'daily = 1');
  assert(firesPerDay('CRON_TZ=Asia/Ho_Chi_Minh 13 7 * * 1') < 0.2, 'weekly < 1');
  const triggers = { data: [
    { id: 't1', name: 'daily', enabled: true, cron_expression: '31 7 * * *', derived_state: { model: '' }, last_run: { session_id: 'cse_A' } },
    { id: 't2', name: 'ops', enabled: true, cron_expression: '47 7 * * *', persist_session: true, persistent_session_id: 'session_B', derived_state: { model: '' } },
    { id: 't3', name: 'dispatch', enabled: true, cron_expression: '7 7-23/2 * * *', derived_state: { model: 'claude-haiku-5-5' } },
    { id: 't4', name: 'off', enabled: false, cron_expression: '7 * * * *', derived_state: { model: '' } },
    { id: 't5', name: 'clean', enabled: true, cron_expression: '0 9 * * 1', derived_state: { model: 'claude-sonnet-5-5' } },
  ] };
  const sessions = [
    { ccr: { id: 'session_A', external_metadata: { last_served_model: 'claude-opus-5-5', usage: { cost_usd: 2.7 } } } },
    { id: 'session_B', configured_model: 'claude-sonnet-5-5', external_metadata: { context_usage: { used_tokens: 307000 } } },
  ];
  const r = audit(triggers, sessions);
  const has = (id, rule, sev) => r.findings.some((f) => f.trigger === id && f.rule === rule && (!sev || f.severity === sev));
  assert(has('t1', 'CSB-01', 'HIGH'), 'empty model served Opus → HIGH');
  assert(has('t1', 'CSB-04'), 'costly fresh fire → CSB-04');
  assert(has('t2', 'CSB-02', 'HIGH'), 'persistent bloat → CSB-02');
  assert(has('t2', 'CSB-01', 'MEDIUM'), 'empty model on Sonnet project → MEDIUM');
  assert(has('t3', 'CSB-03'), '2-hourly → CSB-03');
  assert(!r.findings.some((f) => f.trigger === 't4'), 'disabled ignored');
  assert(!r.findings.some((f) => f.trigger === 't5'), 'clean task has no finding');
  assert(r.tasks === 4, 'counts enabled recurring tasks');
  console.log('sgps-sub-budget self-test: 18 PASS');
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const cmd = process.argv[2];
  if (process.argv.includes('--self-test')) selfTest();
  else if (cmd === 'guard') {
    const g = guard(load(arg('--rate-limit')));
    console.log(`${g.mode} (${g.status}): ${g.reason}`);
    process.exit(g.exit);
  } else if (cmd === 'audit') {
    const r = audit(load(arg('--triggers')), load(arg('--sessions')) ?? []);
    if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 1));
    else {
      console.log(`CSB audit: ${r.tasks} enabled recurring tasks, ${r.findings.length} findings`);
      for (const f of r.findings) console.log(`${f.severity}\t${f.rule}\t${f.trigger}\t${f.name}\t${f.fact}\t→ ${f.fix}`);
    }
    process.exit(r.findings.length ? 2 : 0);
  } else {
    console.error('usage: sgps-sub-budget.mjs guard --rate-limit <file|json> | audit --triggers <file> [--sessions <file>] [--json] | --self-test');
    process.exit(64);
  }
}
