// v1.22.0 (W5/F2) — pure audit-export builder (JSON + CSV + weekly summary + forbidden scan).
// PURE module: no page globals, no extension APIs, no timers, no clock — every timestamp comes
// from the caller. A classic script (no ES modules, no bundler): it defines the global
// `MuseAudit` for the stats / popup pages and carries a `module.exports` guard so node:vm unit
// tests can load the shipped file verbatim.
//
//   MuseAudit.buildJson(input)                    -> { ok, json, filename }
//   MuseAudit.buildCsv(entries)                   -> string
//   MuseAudit.weeklySummary(counters, byDay, now) -> { clicks, blocked, asked, followups, week }
//   MuseAudit.containsForbidden(text)             -> { ok, hit }
//
// `input = { version, generatedAt, rules, counters, byDay, log }` (the log already decrypted).
// The builder is STRUCTURALLY unable to leak a credential: it has no license / cryptKeyRaw
// parameter, and every exported log entry is projected onto the fixed allowlist below — anything
// else (`ctx`, `iv`, `ct`, `token`, arbitrary keys) is dropped. `containsForbidden()` is the
// belt-and-suspenders scan the caller runs over the produced text before offering it.
//
//   ENTRY_KEYS = at, kind, label, context, blockedReason, standing, dryRun   (nothing else)
//   filename   = muse-auto-allow-audit-YYYY-MM-DD.json   (CSV: the same name, .csv)
//   CSV header = at,kind,label,context,blockedReason     (RFC-4180 escaping + a UTF-8 BOM)
//
// `containsForbidden(text)` returns `{ ok:true, hit:null }` when the text is CLEAN and
// `{ ok:false, hit:<token> }` for the first forbidden token it finds, so the caller guards with
// `if (!scan.ok) refuse(...)`. weeklySummary's `week` is the Monday..Sunday sum of `byDay`
// around `now` (Monday start, local calendar days), so it never reads a clock of its own.
(function () {
  'use strict';

  var ENTRY_KEYS = ['at', 'kind', 'label', 'context', 'blockedReason', 'standing', 'dryRun'];
  var FORBIDDEN = ['license', 'cryptKeyRaw', '"token"', '"iv"', '"ct"'];
  var LOG_MAX = 1000;    // entries exported
  var RULE_MAX = 50;     // rules exported
  var LIST_MAX = 50;     // topics / keywords per rule
  var STR_MAX = 64;      // chars per topic / keyword
  var DAY_MAX = 400;     // byDay buckets exported

  function str(v, max) {
    return typeof v === 'string' ? (max ? v.slice(0, max) : v) : '';
  }
  // finite, non-negative integer; anything else (NaN / 'x' / -1 / null) becomes 0.
  function int(v) {
    var n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  function isPlainObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  function isoAt(v) {
    if (typeof v === 'string') return v.slice(0, STR_MAX);
    if (v && typeof v.toISOString === 'function') {
      try { return String(v.toISOString()).slice(0, STR_MAX); } catch (e) { return ''; }
    }
    return '';
  }
  function dayOf(iso) {
    var m = /^(\d{4}-\d{2}-\d{2})/.exec(iso || '');
    return m ? m[1] : 'unknown';
  }

  // ---- projections: the ONLY way data reaches the export ------------------------------------
  function projectEntry(e) {
    var o = isPlainObject(e) ? e : {};
    var out = {
      at: isoAt(o.at),
      kind: str(o.kind, 24),
      label: str(o.label, 60),
      context: str(o.context, 500),
    };
    if (typeof o.blockedReason === 'string' && o.blockedReason) out.blockedReason = o.blockedReason.slice(0, 96);
    if (o.standing === true) out.standing = true;
    if (o.dryRun === true) out.dryRun = true;
    return out;   // exactly a subset of ENTRY_KEYS — no ctx, no token, no foreign key can ride along
  }
  function projectLog(log) {
    var out = [];
    if (!Array.isArray(log)) return out;
    for (var i = 0; i < log.length && out.length < LOG_MAX; i++) out.push(projectEntry(log[i]));
    return out;
  }
  function projectCounters(c) {
    var o = isPlainObject(c) ? c : {};
    return { clicks: int(o.clicks), blocked: int(o.blocked), asked: int(o.asked), followups: int(o.followups) };
  }
  function projectByDay(b) {
    var o = isPlainObject(b) ? b : {};
    var out = {};
    var keys = Object.keys(o).slice(0, DAY_MAX);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i].slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
      out[k] = int(o[keys[i]]);
    }
    return out;
  }
  function strList(v) {
    var out = [];
    if (!Array.isArray(v)) return out;
    for (var i = 0; i < v.length && out.length < LIST_MAX; i++) {
      if (typeof v[i] === 'string' && v[i]) out.push(v[i].slice(0, STR_MAX));
    }
    return out;
  }
  function projectRules(rules) {
    var out = [];
    if (!Array.isArray(rules)) return out;
    for (var i = 0; i < rules.length && out.length < RULE_MAX; i++) {
      var r = rules[i];
      if (!isPlainObject(r)) continue;
      var m = isPlainObject(r.match) ? r.match : {};
      var item = {
        id: str(r.id, 32),
        kind: str(r.kind, 8),
        match: { topics: strList(m.topics), keywords: strList(m.keywords) },
        enabled: r.enabled === false ? false : true,
      };
      if (typeof r.note === 'string' && r.note) item.note = r.note.slice(0, 200);
      out.push(item);
    }
    return out;
  }

  function buildJson(input) {
    if (!isPlainObject(input)) return { ok: false, json: '', filename: '' };
    var generatedAt = isoAt(input.generatedAt);
    var doc = {
      app: 'muse-auto-allow',
      format: 'audit',
      version: str(input.version, 32),
      generatedAt: generatedAt,
      rules: projectRules(input.rules),
      counters: projectCounters(input.counters),
      byDay: projectByDay(input.byDay),
      log: projectLog(input.log),
    };
    return {
      ok: true,
      json: JSON.stringify(doc, null, 2),
      filename: 'muse-auto-allow-audit-' + dayOf(generatedAt) + '.json',
    };
  }

  // RFC 4180: quote a field that holds a quote, a comma or a line break; a quote doubles.
  function csvField(v) {
    var s = v == null ? '' : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function buildCsv(entries) {
    var list = Array.isArray(entries) ? entries : [];
    var lines = ['at,kind,label,context,blockedReason'];
    for (var i = 0; i < list.length && i < LOG_MAX; i++) {
      var e = isPlainObject(list[i]) ? list[i] : {};
      lines.push([
        csvField(str(e.at, STR_MAX)),
        csvField(str(e.kind, 24)),
        csvField(str(e.label, 60)),
        csvField(str(e.context, 500)),
        csvField(typeof e.blockedReason === 'string' ? e.blockedReason.slice(0, 96) : ''),
      ].join(','));
    }
    return '\uFEFF' + lines.join('\r\n') + '\r\n';   // UTF-8 BOM so Excel reads the accents
  }

  // ---- weekly summary ------------------------------------------------------------------------
  function toDate(now) {
    if (now && typeof now.getTime === 'function') {
      try { var t = now.getTime(); if (Number.isFinite(t)) return new Date(t); } catch (e) { /* fall through */ }
    }
    if (typeof now === 'number' && Number.isFinite(now)) return new Date(now);
    if (typeof now === 'string') { var d = new Date(now); if (Number.isFinite(d.getTime())) return d; }
    return null;
  }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function dayKeyOf(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function weekSum(byDay, now) {
    var d = toDate(now);
    if (!d) return 0;
    var src = isPlainObject(byDay) ? byDay : {};
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var dow = (x.getDay() + 6) % 7;   // Monday = 0
    x.setDate(x.getDate() - dow);
    var sum = 0;
    for (var k = 0; k < 7; k++) {
      var dd = new Date(x.getFullYear(), x.getMonth(), x.getDate() + k);
      sum += int(src[dayKeyOf(dd)]);
    }
    return sum;
  }
  function weeklySummary(counters, byDay, now) {
    var c = isPlainObject(counters) ? counters : {};
    return {
      clicks: int(c.clicks),
      blocked: int(c.blocked),
      asked: int(c.asked),
      followups: int(c.followups),
      week: weekSum(byDay, now),
    };
  }

  // ok:true => the text is CLEAN; ok:false => `hit` names the first forbidden token found.
  function containsForbidden(text) {
    var s = typeof text === 'string' ? text : (text == null ? '' : String(text));
    for (var i = 0; i < FORBIDDEN.length; i++) {
      if (s.indexOf(FORBIDDEN[i]) >= 0) return { ok: false, hit: FORBIDDEN[i] };
    }
    return { ok: true, hit: null };
  }

  var api = {
    buildJson: buildJson,
    buildCsv: buildCsv,
    weeklySummary: weeklySummary,
    containsForbidden: containsForbidden,
  };
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  globalThis.MuseAudit = api;
})();
