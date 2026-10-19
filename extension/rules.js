// v1.22.0 (W5/F1) — pure 3-layer rule engine (allow / ask / block). PURE module: no page
// globals, no extension APIs, no timers, no clock — sanitize() and decide() read ONLY their
// arguments and return plain values. A classic script (no ES modules, no bundler): it defines
// the global `MuseRules` for the content script / popup and carries a `module.exports` guard
// so node:vm unit tests can load the shipped file verbatim.
//
//   MuseRules.defaults()          -> { layers: [] }
//   MuseRules.sanitize(raw)       -> { ok, layers }     // fail-closed, never throws
//   MuseRules.decide(win, layers) -> { action, reason, ruleId }
//
// A rule is { id, kind, match, enabled?, note? }:
//   id      slug [a-z0-9-]{1,32}; on a duplicate id the LATER rule is dropped
//   kind    'allow' | 'ask' | 'block' (any other kind drops the rule)
//   match   { topics?: string[], keywords?: string[] } (lowercased; both empty => never matches)
//   enabled defaults true — only an explicit `false` disables the rule
//   note    optional bounded text
// Bounds (docs/W5_RULE_ENGINE_AUDIT_SPEC.md §F1): <= 50 rules, each list <= 50 entries, each
// topic/keyword <= 64 chars. Prototype keys (__proto__ / constructor) are rejected outright, and
// a raw value that is neither an array nor a { layers: [...] } container yields { ok:false }.
// sanitize() only ever NARROWS: a malformed rule is dropped, never repaired into a broader one.
//
//   win = { topic, text, legacy: { blockKeywords, allowTopics }, yolo }
// `topic` is the extracted topic and `text` is card text + ' ' + context (both expected
// lowercase; anything else is treated as ''). Decision table (§F1) — first hit wins, top down:
//
//   #  | condition                                        | action | reason
//   D1 | legacy blockKeywords substring                   | block  | keyword:<kw>
//   D2 | rule kind=block (enabled) matches                | block  | rule:<id>
//   D3 | rule kind=ask   (enabled) matches                | ask    | rule:<id>
//   D4 | legacy allowTopics non-empty AND topic not on it | block  | topic
//   D5 | >=1 enabled allow rule AND none of them matches  | ask    | allow-miss
//   D6 | nothing above intervened                         | none   | null
//
// A rule "matches" when win.topic exactly equals one of its topics OR one of its keywords is a
// substring of win.text. No rule can ever WIDEN a grant: `allow` only suppresses D5's ask, and
// win.yolo === true short-circuits the whole table to { action:'none' } (the bypass the legacy
// blockReasonFor has always had). A legacy allowTopics that is empty (or absent) stays allow-all.
(function () {
  'use strict';

  var RULE_MAX = 50;    // rules in one layer set
  var LIST_MAX = 50;    // topics / keywords per rule
  var STR_MAX = 64;     // chars per topic / keyword
  var NOTE_MAX = 200;   // chars per note
  var ID_RE = /^[a-z0-9-]{1,32}$/;
  var BAD_KEYS = ['__proto__', 'constructor']; // prototype keys are refused, never copied

  function defaults() {
    return { layers: [] };
  }

  function isPlainObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  // A rule carrying an own __proto__ / constructor key is refused before anything is read from
  // it — Object.prototype.hasOwnProperty sees JSON.parse's own `__proto__` data property too.
  function hasBadKey(o) {
    for (var i = 0; i < BAD_KEYS.length; i++) {
      if (Object.prototype.hasOwnProperty.call(o, BAD_KEYS[i])) return true;
    }
    return false;
  }

  // trim + lowercase + slice(64); non-strings and blanks are dropped, the list is capped at 50.
  function normList(v) {
    var out = [];
    if (!Array.isArray(v)) return out;
    for (var i = 0; i < v.length && out.length < LIST_MAX; i++) {
      if (typeof v[i] !== 'string') continue;
      var s = v[i].trim().toLowerCase();
      if (!s) continue;
      out.push(s.slice(0, STR_MAX));
    }
    return out;
  }

  // One rule -> a fresh, bounded object, or null (the rule is dropped). Never mutates `raw`.
  function sanitizeRule(raw) {
    if (!isPlainObject(raw)) return null;
    if (hasBadKey(raw)) return null;
    var id = typeof raw.id === 'string' ? raw.id : '';
    if (!ID_RE.test(id) || BAD_KEYS.indexOf(id) >= 0) return null;
    var kind = raw.kind;
    if (kind !== 'allow' && kind !== 'ask' && kind !== 'block') return null;
    if (!isPlainObject(raw.match)) return null;
    var out = {
      id: id,
      kind: kind,
      match: { topics: normList(raw.match.topics), keywords: normList(raw.match.keywords) },
      enabled: raw.enabled === false ? false : true,
    };
    if (typeof raw.note === 'string' && raw.note) out.note = raw.note.slice(0, NOTE_MAX);
    return out;
  }

  function sanitize(raw) {
    var arr;
    if (Array.isArray(raw)) arr = raw;                                        // the shipped shape
    else if (isPlainObject(raw) && Array.isArray(raw.layers)) arr = raw.layers; // a { layers } container
    else return { ok: false, layers: [] };                                    // top level is not an array
    var out = [];
    var seen = Object.create(null); // own-property id map (a plain {} would collide with 'toString'…)
    for (var i = 0; i < arr.length && out.length < RULE_MAX; i++) {
      var r = sanitizeRule(arr[i]);
      if (!r) continue;                 // wrong-typed / prototype-keyed rule: dropped
      if (seen[r.id]) continue;         // duplicate id: the LATER rule is dropped
      seen[r.id] = true;
      out.push(r);
    }
    return { ok: true, layers: out };
  }

  function normTopic(t) { return typeof t === 'string' ? t.toLowerCase() : ''; }
  function normText(t) { return typeof t === 'string' ? t.toLowerCase() : ''; }

  // topic exact match OR keyword substring. An empty match matches NOTHING, so a degenerate
  // allow rule can never widen a grant and a degenerate block rule can never over-block.
  function ruleMatches(rule, topic, text) {
    var m = rule.match;
    var i;
    for (i = 0; i < m.topics.length; i++) {
      if (topic !== '' && m.topics[i] === topic) return true;
    }
    for (i = 0; i < m.keywords.length; i++) {
      if (m.keywords[i] && text.indexOf(m.keywords[i]) >= 0) return true;
    }
    return false;
  }

  function decide(win, layers) {
    var w = isPlainObject(win) ? win : {};
    // YOLO (explicit opt-in): every layer is bypassed — never click, never ask, just proceed.
    if (w.yolo === true) return { action: 'none', reason: null, ruleId: null };

    var topic = normTopic(w.topic);
    var text = normText(w.text);
    var legacy = isPlainObject(w.legacy) ? w.legacy : {};
    var blockKws = Array.isArray(legacy.blockKeywords) ? legacy.blockKeywords : [];
    var allowTopics = Array.isArray(legacy.allowTopics) ? legacy.allowTopics : [];

    // --- D1: legacy blockKeywords (case-insensitive substring over card text + context) ------
    for (var i = 0; i < blockKws.length; i++) {
      var kw = typeof blockKws[i] === 'string' ? blockKws[i].toLowerCase() : '';
      if (kw && text.indexOf(kw) >= 0) return { action: 'block', reason: 'keyword:' + kw, ruleId: null };
    }

    // The layer set is re-validated here, so a hand-built one is exactly as safe as a stored one.
    var set = sanitize(layers).layers;
    var j;

    // --- D2: first enabled block rule that matches ------------------------------------------
    for (j = 0; j < set.length; j++) {
      if (set[j].kind === 'block' && set[j].enabled && ruleMatches(set[j], topic, text)) {
        return { action: 'block', reason: 'rule:' + set[j].id, ruleId: set[j].id };
      }
    }
    // --- D3: first enabled ask rule that matches --------------------------------------------
    for (j = 0; j < set.length; j++) {
      if (set[j].kind === 'ask' && set[j].enabled && ruleMatches(set[j], topic, text)) {
        return { action: 'ask', reason: 'rule:' + set[j].id, ruleId: set[j].id };
      }
    }
    // --- D4: legacy allowTopics non-empty and the topic is not on it ------------------------
    if (allowTopics.length) {
      var listed = false;
      for (j = 0; j < allowTopics.length; j++) {
        if (typeof allowTopics[j] === 'string' && allowTopics[j].toLowerCase() === topic) { listed = true; break; }
      }
      if (!listed) return { action: 'block', reason: 'topic', ruleId: null };
    }
    // --- D5: at least one enabled allow rule exists and none of them matched ----------------
    var haveAllow = false;
    for (j = 0; j < set.length; j++) {
      if (set[j].kind !== 'allow' || !set[j].enabled) continue;
      haveAllow = true;
      if (ruleMatches(set[j], topic, text)) return { action: 'none', reason: null, ruleId: null };
    }
    if (haveAllow) return { action: 'ask', reason: 'allow-miss', ruleId: null };
    // --- D6: nothing above intervened -------------------------------------------------------
    return { action: 'none', reason: null, ruleId: null };
  }

  var api = { defaults: defaults, sanitize: sanitize, decide: decide };
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  globalThis.MuseRules = api;
})();
