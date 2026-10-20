// v1.22.4 (G2/S4/G10) — pure audit-timeline builder. PURE module: no page globals, no extension
// APIs, no timers, no clock — every timestamp and day label comes from the caller. It groups
// ALREADY-DECRYPTED log entries (see popup.js renderLog) into local days, counts them, finds the
// most recent block, and translates a blockedReason into a human sentence ("explainable block").
// It never receives or emits tokens, license keys, iv/ct or any storage key material.
//
//   MuseTimeline.build(entries, opts) ->
//     { days: [{ key, label, items }], counts: { total, byKind }, lastBlocked | null }
//   MuseTimeline.explain(entry, layers) -> { ruleId, ruleDesc, text } | null
//   MuseTimeline.filter(items, { kind, q }) -> items
(function () {
  'use strict';

  var ENTRIES_MAX = 1000;
  var CONTEXT_MAX = 300;
  var Q_MAX = 100;
  var KINDS_NOTE = ['clicked', 'blocked', 'asked', 'followup', 'error', 'skipped'];

  function isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function str(v, max) { return typeof v === 'string' ? (max ? v.slice(0, max) : v) : ''; }

  // '2026-10-19T13:04:05.000Z' -> local 'YYYY-MM-DD' (the extension runs on the user's clock).
  function localDay(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  function normalize(entry) {
    if (!isPlainObject(entry)) return null;
    var at = str(entry.at);
    if (!at || !localDay(at)) return null;
    return {
      at: at,
      kind: str(entry.kind) || 'entry',
      label: str(entry.label, 200),
      context: str(entry.context, CONTEXT_MAX),
      blockedReason: str(entry.blockedReason, 200) || null,
      standing: entry.standing === true,
      dryRun: entry.dryRun === true,
    };
  }

  function describe(rule) {
    var m = rule.match || {};
    var t = Array.isArray(m.topics) ? m.topics : [];
    var k = Array.isArray(m.keywords) ? m.keywords : [];
    var parts = [];
    if (t.length) parts.push('topics: ' + t.join(', '));
    if (k.length) parts.push('keywords: ' + k.join(', '));
    return rule.kind + ' · ' + (parts.join(' · ') || '—');
  }

  function findRule(id, layers) {
    if (!id || !Array.isArray(layers)) return null;
    for (var i = 0; i < layers.length; i++) {
      if (isPlainObject(layers[i]) && layers[i].id === id) return layers[i];
    }
    return null;
  }

  // blockedReason forms produced by content.js: 'rule:<id>' | 'keyword:<kw>' | 'topic' |
  // 'allow-miss' | null. Unknown shapes degrade to a neutral sentence, never to a crash.
  function explain(entry, layers) {
    if (!isPlainObject(entry)) return null;
    var reason = str(entry.blockedReason, 200);
    if (!reason) return null;
    if (reason.indexOf('rule:') === 0) {
      var id = reason.slice(5);
      var rule = findRule(id, layers);
      return {
        ruleId: id,
        ruleDesc: rule ? describe(rule) : '',
        text: rule ? 'Rule "' + (rule.note ? rule.note.slice(0, 80) : id) + '" — ' + describe(rule)
                   : 'Rule "' + id + '"',
      };
    }
    if (reason.indexOf('keyword:') === 0) {
      var kw = reason.slice(8);
      return { ruleId: null, ruleDesc: 'keyword: ' + kw, text: 'Blocked keyword: "' + kw + '"' };
    }
    if (reason === 'topic') {
      return { ruleId: null, ruleDesc: 'topic not on the allowed list', text: 'Topic not on the allowed list' };
    }
    if (reason === 'allow-miss') {
      return { ruleId: null, ruleDesc: 'no allow rule matched', text: 'Allow rules exist but none matched this card' };
    }
    return { ruleId: null, ruleDesc: reason, text: 'Blocked (' + reason + ')' };
  }

  function build(entries, opts) {
    var o = isPlainObject(opts) ? opts : {};
    var labelDay = typeof o.labelDay === 'function' ? o.labelDay : null;
    var list = Array.isArray(entries) ? entries : [];
    var clean = [];
    for (var i = 0; i < list.length && clean.length < ENTRIES_MAX; i++) {
      var n = normalize(list[i]);
      if (n) clean.push(n);
    }
    // newest first (stable: equal timestamps keep input order)
    clean.sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; });

    var days = [];
    var byDay = Object.create(null);
    var byKind = Object.create(null);
    for (var j = 0; j < clean.length; j++) {
      var e = clean[j];
      byKind[e.kind] = (byKind[e.kind] || 0) + 1;
      var key = localDay(e.at);
      var bucket = byDay[key];
      if (!bucket) {
        bucket = { key: key, label: labelDay ? labelDay(key) : key, items: [] };
        byDay[key] = bucket;
        days.push(bucket);
      }
      bucket.items.push(e);
    }

    var lastBlocked = null;
    for (var k = 0; k < clean.length; k++) {
      var b = clean[k];
      if (b.kind === 'blocked' || b.blockedReason === 'anomaly-pause') {
        var ex = explain(b, o.layers || []);
        lastBlocked = {
          at: b.at,
          label: b.label || b.kind,
          reason: b.blockedReason || null,
          ruleId: ex ? ex.ruleId : null,
          ruleDesc: ex ? ex.ruleDesc : '',
        };
        break;
      }
    }

    return { days: days, counts: { total: clean.length, byKind: byKind }, lastBlocked: lastBlocked };
  }

  function filter(items, q) {
    var arr = Array.isArray(items) ? items : [];
    var query = isPlainObject(q) ? q : {};
    var kind = str(query.kind);
    var needle = str(query.q, Q_MAX).toLowerCase();
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var e = arr[i];
      if (!isPlainObject(e)) continue;
      if (kind && e.kind !== kind) continue;
      if (needle) {
        var hay = (str(e.label) + ' ' + str(e.context)).toLowerCase();
        if (hay.indexOf(needle) < 0) continue;
      }
      out.push(e);
    }
    return out;
  }

  var api = { build: build, explain: explain, filter: filter, localDay: localDay, kinds: KINDS_NOTE.slice() };
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  globalThis.MuseTimeline = api;
})();
