// v1.22.4 (G3) — pure rule simulator. PURE module: no page globals, no extension APIs, no
// timers, no clock. It answers ONE question for the popup's rule form: "given a sample card,
// which rule wins and why?" It never decides to click anything at runtime — the real engine is
// `rules.js` (MuseRules.decide). This module calls that same function, so the preview can never
// disagree with the shipped behaviour, and replays the D1..D6 ladder to explain the outcome.
//
//   MuseRuleSim.simulate({ topic, text, layers, legacy }) ->
//     { action, reason, ruleId, ruleDesc, matched, steps: [{ code, matched, detail }] }
//
// action is exactly what MuseRules.decide() would return:
//   'block' | 'ask' | 'none'   (and reason: 'keyword:<kw>' | 'rule:<id>' | 'topic' |
//                               'allow-miss' | null)
// steps lists only the rows that were actually evaluated — it stops at the winning row.
// A classic script: defines global `MuseRuleSim` + a module.exports guard for node:vm tests.
(function () {
  'use strict';

  var rulesApi = null;
  function R() {
    if (rulesApi) return rulesApi;
    try {
      if (typeof module === 'object' && module && module.exports && typeof require === 'function') {
        rulesApi = require('./rules.js');
      }
    } catch { /* not a node context */ }
    if (!rulesApi && typeof globalThis !== 'undefined' && globalThis.MuseRules) rulesApi = globalThis.MuseRules;
    return rulesApi;
  }

  var TEXT_MAX = 4000;

  function isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function lc(v) { return typeof v === 'string' ? v.toLowerCase() : ''; }
  function sliceText(v) { var s = lc(v); return s.length > TEXT_MAX ? s.slice(0, TEXT_MAX) : s; }

  // Same matching rule as rules.js: topic exact match OR keyword substring in the card text.
  function matches(rule, topic, text) {
    var m = rule.match || {};
    var i;
    var topics = Array.isArray(m.topics) ? m.topics : [];
    var kws = Array.isArray(m.keywords) ? m.keywords : [];
    for (i = 0; i < topics.length; i++) if (topic !== '' && topics[i] === topic) return true;
    for (i = 0; i < kws.length; i++) if (kws[i] && text.indexOf(kws[i]) >= 0) return true;
    return false;
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

  function ruleDescFor(ruleId, layers) {
    if (!ruleId) return '';
    for (var i = 0; i < layers.length; i++) if (layers[i].id === ruleId) return describe(layers[i]);
    return ruleId;
  }

  function empty() { return { action: 'none', reason: null, ruleId: null, ruleDesc: '', matched: null, steps: [] }; }

  function simulate(input) {
    if (!isPlainObject(input)) return empty();
    var Rapi = R();
    if (!Rapi || typeof Rapi.decide !== 'function') return empty();

    var topic = lc(input.topic);
    var text = sliceText(input.text);
    var legacy = isPlainObject(input.legacy) ? input.legacy : {};
    var set = Rapi.sanitize(input.layers).layers;

    // The shipped decision (single source of truth) — the simulator never bypasses it.
    var verdict = Rapi.decide({ topic: topic, text: text, legacy: legacy, yolo: false }, set);
    var out = {
      action: verdict.action,
      reason: verdict.reason,
      ruleId: verdict.ruleId,
      ruleDesc: ruleDescFor(verdict.ruleId, set),
      matched: null,
      steps: [],
    };

    var blockKws = Array.isArray(legacy.blockKeywords) ? legacy.blockKeywords : [];
    var allowTopics = Array.isArray(legacy.allowTopics) ? legacy.allowTopics : [];
    var step = function (code, hit, detail) { out.steps.push({ code: code, matched: hit, detail: detail }); };
    var i;

    // D1 — legacy keyword block
    for (i = 0; i < blockKws.length; i++) {
      var kw = lc(blockKws[i]);
      if (kw && text.indexOf(kw) >= 0) {
        step('D1', true, 'keyword: ' + kw);
        out.matched = { type: 'keyword', value: kw };
        return out;
      }
    }
    step('D1', false, 'no block keyword in the text');

    // D2 — a block rule
    for (i = 0; i < set.length; i++) {
      if (set[i].kind === 'block' && set[i].enabled && matches(set[i], topic, text)) {
        step('D2', true, 'rule ' + set[i].id + ' — ' + describe(set[i]));
        out.matched = { type: 'rule', id: set[i].id, kind: 'block' };
        return out;
      }
    }
    step('D2', false, 'no block rule matched');

    // D3 — an ask rule
    for (i = 0; i < set.length; i++) {
      if (set[i].kind === 'ask' && set[i].enabled && matches(set[i], topic, text)) {
        step('D3', true, 'rule ' + set[i].id + ' — ' + describe(set[i]));
        out.matched = { type: 'rule', id: set[i].id, kind: 'ask' };
        return out;
      }
    }
    step('D3', false, 'no ask rule matched');

    // D4 — legacy allow-list miss
    if (allowTopics.length) {
      var listed = false;
      for (i = 0; i < allowTopics.length; i++) {
        if (lc(allowTopics[i]) === topic) { listed = true; break; }
      }
      if (!listed) {
        step('D4', true, 'topic "' + topic + '" is not on the allowed list');
        out.matched = { type: 'topic', value: topic };
        return out;
      }
      step('D4', false, 'topic is on the allowed list');
    }

    // D5 — allow rules present but none matched
    var haveAllow = false;
    for (i = 0; i < set.length; i++) {
      if (set[i].kind !== 'allow' || !set[i].enabled) continue;
      haveAllow = true;
      if (matches(set[i], topic, text)) {
        step('D5', false, 'rule ' + set[i].id + ' allows this card');
        out.matched = { type: 'rule', id: set[i].id, kind: 'allow' };
        return out;
      }
    }
    if (haveAllow) {
      step('D5', true, 'allow rules exist but none matched');
      return out;
    }

    // D6 — baseline
    step('D6', true, 'no rule intervenes — the card proceeds');
    return out;
  }

  var api = { simulate: simulate };
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  globalThis.MuseRuleSim = api;
})();
