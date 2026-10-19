// v1.21.0 (G02) — Mission Playbooks: pure token grammar + prompt construction.
// PURE module: no DOM, no extension APIs, no timers, no clock — every function is
// deterministic and reads ONLY its arguments. A classic script (no ES modules, no
// bundler): it defines the global `MusePlaybook` for the content script and a
// `module.exports` guard so node:vm unit tests can load the shipped file verbatim.
//
// GRAMMAR ONLY: this module owns the {{name}} token grammar, the value sanitizers, the
// default/supplied merge, and the literal renderer. content.js layers its own
// keyword/connector screens on top of every chosen value before anything is sent.
//
//   MusePlaybook.declare(names)                            -> {ok, names}
//                                                         | {ok:false, code:'declare-invalid'}
//   MusePlaybook.parseTokens(stepText)                      -> {ok, tokens}
//                                                         | {ok:false, code:'token-malformed'|'token-count'}
//   MusePlaybook.validateValue(value)                       -> {ok, code, value}
//                                                         | {ok:false, code:'value-type'|'value-empty'|'value-long'|'value-control'|'value-bidi'|'value-surrogate'}
//   MusePlaybook.mergeValues(declared, defaults, supplied) -> {ok, values}
//                                                         | {ok:false, code, name}
//   MusePlaybook.render(stepText, values)                  -> {ok, text}
//                                                         | {ok:false, code:'token-unknown'|'render-braces'|'render-empty'|'render-long'}
(function () {
  'use strict';

  // Token grammar: {{name}} with name = [a-z][a-z0-9_]{0,31} — ASCII, case-sensitive,
  // no whitespace, no nesting, no escaping. Anchored: a candidate that merely CONTAINS
  // a valid name (e.g. 'a b') must not pass.
  var NAME_RE = /^[a-z][a-z0-9_]{0,31}$/;

  var DECLARE_MAX = 16;   // declared variable names
  var TOKEN_MAX = 32;     // distinct tokens in one step
  var VALUE_MAX = 120;    // code points per value, counted with [...str].length
  var RENDER_MAX = 2000;  // code points per rendered step

  // C0 controls U+0000-U+001F (tab, newline, ...) and C1 controls U+007F-U+009F.
  function isControl(cp) {
    return (cp >= 0x00 && cp <= 0x1f) || (cp >= 0x7f && cp <= 0x9f);
  }

  // Bidi controls: U+202A-U+202E (directional embedding/override + PDF) and
  // U+2066-U+2069 (directional isolates + PDI).
  function isBidi(cp) {
    return (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069);
  }

  // Unpaired surrogate: spreading a string yields code points, so astral characters
  // arrive as single code points; anything left in U+D800-U+DFFF is unpaired.
  function isSurrogate(cp) {
    return cp >= 0xd800 && cp <= 0xdfff;
  }

  // Null-prototype maps: '__proto__' and 'constructor' are regex-legal names, so a
  // plain {} would silently drop or corrupt them.
  function newSet() {
    return Object.create(null);
  }

  // Accept ordinary objects from this realm or another (the unit harness calls across
  // node:vm realms), plus null-prototype dictionaries; reject arrays, dates, and class
  // instances because defaults/supplied are plain data maps by contract.
  function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Object.prototype.toString.call(value) !== '[object Object]') return false;
    var proto = Object.getPrototypeOf(value);
    if (proto === null) return true;
    var parent = Object.getPrototypeOf(proto);
    return parent === null && Object.prototype.hasOwnProperty.call(proto, 'constructor') &&
      typeof proto.constructor === 'function' && proto.constructor.name === 'Object';
  }

  // --- shared scanner ---------------------------------------------------------------------------
  // Walks `text` left to right. Every '{{' opens a token-like span running to the next
  // '}}'; the text between must be a valid name. Fail closed on: a '{{' with no '}}',
  // a span whose name breaks the grammar, or a '}}' left over outside any span.
  // Returns {ok:true, names, spans, segments} or {ok:false}. `spans` cover the full
  // '{{name}}' ranges; `segments` are the non-token slices between them (the tail
  // included) — the caller checks THOSE for stray braces so that VALUES containing
  // braces can never be mistaken for markup.
  function scan(text) {
    var names = [];
    var spans = [];
    var segments = [];
    var seen = newSet();
    var cursor = 0;
    var i = text.indexOf('{{');
    while (i !== -1) {
      var j = text.indexOf('}}', i + 2);
      if (j === -1) return { ok: false };               // stray '{{'
      var name = text.slice(i + 2, j);
      if (!NAME_RE.test(name)) return { ok: false };     // brace-brace + invalid name
      segments.push(text.slice(cursor, i));
      spans.push({ name: name, start: i, end: j + 2 });
      if (!seen[name]) { seen[name] = true; names.push(name); }
      cursor = j + 2;
      i = text.indexOf('{{', cursor);
    }
    segments.push(text.slice(cursor));
    return { ok: true, names: names, spans: spans, segments: segments };
  }

  // Stray-brace check over the non-token segments of an already-scanned text. A
  // segment can never contain '{{' (the scan consumes every one as a span start), so
  // in practice this fires on leftover '}}' — checking both keeps the guard honest.
  function hasStrayBraces(segments) {
    for (var k = 0; k < segments.length; k++) {
      if (segments[k].indexOf('{{') !== -1 || segments[k].indexOf('}}') !== -1) return true;
    }
    return false;
  }

  // --- declare: freeze the allowed variable names for one playbook ---------------------------
  function declare(names) {
    if (!Array.isArray(names)) return { ok: false, code: 'declare-invalid' };
    var seen = newSet();
    var out = [];
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      if (typeof n !== 'string' || !NAME_RE.test(n)) return { ok: false, code: 'declare-invalid' };
      if (!seen[n]) { seen[n] = true; out.push(n); }
    }
    if (out.length > DECLARE_MAX) return { ok: false, code: 'declare-invalid' };
    return { ok: true, names: out };
  }

  // --- parseTokens: extract the distinct token names of one step, fail closed -------------------
  function parseTokens(stepText) {
    if (typeof stepText !== 'string') return { ok: false, code: 'token-malformed' };
    var s = scan(stepText);
    if (!s.ok || hasStrayBraces(s.segments)) return { ok: false, code: 'token-malformed' };
    if (s.names.length > TOKEN_MAX) return { ok: false, code: 'token-count' };
    return { ok: true, tokens: s.names, code: 'tokens-ok' };
  }

  // --- validateValue: one user value against the grammar-level sanitizers -------------------------
  function validateValue(value) {
    if (typeof value !== 'string') return { ok: false, code: 'value-type' };
    var v = value.trim();
    if (v.length === 0) return { ok: false, code: 'value-empty' };
    var cps = [...v]; // code points, NOT UTF-16 units
    if (cps.length > VALUE_MAX) return { ok: false, code: 'value-long' };
    for (var i = 0; i < cps.length; i++) {
      var cp = cps[i].codePointAt(0);
      if (isControl(cp)) return { ok: false, code: 'value-control' };
      if (isBidi(cp)) return { ok: false, code: 'value-bidi' };
      if (isSurrogate(cp)) return { ok: false, code: 'value-surrogate' };
    }
    return { ok: true, code: 'value-ok', value: v };
  }

  // --- mergeValues: defaults overlaid by validated supplied values; fail closed, no partials ----
  function mergeValues(declared, defaults, supplied) {
    if (!Array.isArray(declared)) return { ok: false, code: 'declared-invalid' };
    if (!isPlainObject(defaults)) return { ok: false, code: 'defaults-invalid' };
    if (!isPlainObject(supplied)) return { ok: false, code: 'supplied-invalid' };
    var defs = defaults;
    var sup = supplied;
    var known = newSet();
    var i, name, key;
    for (i = 0; i < declared.length; i++) known[declared[i]] = true;
    // every supplied key must be declared — fail closed on the first undeclared one
    for (key in sup) {
      if (!Object.prototype.hasOwnProperty.call(sup, key)) continue;
      if (!known[key]) return { ok: false, code: 'undeclared', name: key };
    }
    var values = newSet();
    for (i = 0; i < declared.length; i++) {
      name = declared[i];
      // own keys only: an inherited property is not something the user supplied
      var raw = Object.prototype.hasOwnProperty.call(sup, name) ? sup[name] : undefined;
      var chosen;
      if (typeof raw === 'string' && raw.trim().length > 0) {
        chosen = raw.trim();
      } else {
        chosen = defs[name];
      }
      var r = validateValue(chosen);
      if (!r.ok) return { ok: false, code: r.code, name: name }; // NO partial values
      values[name] = r.value;
    }
    return { ok: true, values: values, code: 'merge-ok' };
  }

  // --- render: literal substitution of every complete token, then fail closed on leftovers -------
  function render(stepText, values) {
    if (typeof stepText !== 'string') return { ok: false, code: 'render-braces' };
    var s = scan(stepText);
    if (!s.ok || hasStrayBraces(s.segments)) return { ok: false, code: 'render-braces' };
    var vals = values && typeof values === 'object' ? values : {};
    // Literal substitution: parts are concatenated verbatim (exactly what a replacement
    // CALLBACK does — never replacement-string semantics), so '$&', '\$' and
    // brace-looking text inside a value can never inject or expand.
    var parts = [];
    var cursor = 0;
    for (var t = 0; t < s.spans.length; t++) {
      var span = s.spans[t];
      parts.push(stepText.slice(cursor, span.start));
      var replacement = Object.prototype.hasOwnProperty.call(vals, span.name) ? vals[span.name] : undefined;
      if (typeof replacement !== 'string') return { ok: false, code: 'token-unknown', name: span.name };
      parts.push(replacement);
      cursor = span.end;
    }
    parts.push(stepText.slice(cursor));
    var text = parts.join('').trim();
    if (text.length === 0) return { ok: false, code: 'render-empty' };
    if ([...text].length > RENDER_MAX) return { ok: false, code: 'render-long' };
    return { ok: true, text: text, code: 'render-ok' };
  }

  var api = {
    declare: declare,
    parseTokens: parseTokens,
    validateValue: validateValue,
    mergeValues: mergeValues,
    render: render
  };
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  globalThis.MusePlaybook = api;
})();
