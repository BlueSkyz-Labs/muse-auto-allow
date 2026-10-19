// v1.20.0 (G04) — anomaly auto-pause detector. PURE module: no DOM, no chrome API, no timers,
// no Date.now() — evaluate() reads ONLY its (win, now) arguments and returns a value. A classic
// script (no ES modules, no bundler): it defines the global `MuseAnomaly` for the content script
// and a `module.exports` guard so node:vm unit tests can load the shipped file verbatim.
//
//   MuseAnomaly.defaults()        -> a fresh copy of the shipped settings
//   MuseAnomaly.sanitize(raw)     -> settings validated field by field; a bad field falls back
//                                    to its SHIPPED DEFAULT (fail closed, never throws)
//   MuseAnomaly.evaluate(win,now) -> null
//                                    | { rule: 'rate',  detail: { count, threshold } }
//                                    | { rule: 'topic', topic, detail: { topicCount, total, share } }
//
// `win = { settings, allowTs: number[], topics: Map<string, number[]>, totalClicks }`.
// Semantics (docs/G04_ANOMALY_PAUSE_SPEC.md §1):
//   - Below `minSample` total clicks no rule runs at all (a fresh install never self-pauses).
//   - RATE: allow-clicks in the trailing rateWindowMs (now - rateWindowMs, now] reach
//     rateMaxPerMin * rateWindowMs / 60000 (default 30 x 5 = 150) -> pause.
//   - TOPIC: only when RATE stayed silent, over the trailing topicWindowMs: window total >= 30,
//     the busiest topic >= topicCountMin and its share >= topicShareMin -> pause. Ties on count
//     break alphabetically by topic name, so the verdict is deterministic.
// G04 only ever ADDS a pause — it never raises or lowers an existing cap (30/min, dedup, cooldown).
(function () {
  'use strict';

  // Shipped defaults (spec §1 table). Frozen: no caller can mutate the source of truth.
  var DEFAULTS = Object.freeze({
    enabled: true,
    rateWindowMs: 300000,   // 5 min sliding window
    rateMaxPerMin: 30,      // 30/min x 5 min = 150 clicks before RATE fires
    topicWindowMs: 600000,  // 10 min sliding window
    topicCountMin: 40,      // allow-clicks of ONE topic inside the window
    topicShareMin: 0.7,     // that topic's share of the window total
    minSample: 100,         // total clicks required before any rule runs
    pauseMs: 900000,        // auto-pause duration (15 min)
  });

  // The TOPIC rule's own floor on the window total — fixed by the spec, not user-configurable:
  // a "spike" means nothing until the window holds a real sample.
  var TOPIC_MIN_SAMPLE = 30;

  function defaults() {
    return Object.assign({}, DEFAULTS);
  }

  // --- fail-closed numeric guards: a non-finite, wrong-typed or out-of-bounds value falls back
  // --- to the shipped default. `Number.isFinite` rejects null/'30'/true/NaN/Infinity alike.
  function atLeast(value, fallback, min) {            // value >= min
    return Number.isFinite(value) && value >= min ? value : fallback;
  }
  function above(value, fallback, min) {              // value > min
    return Number.isFinite(value) && value > min ? value : fallback;
  }
  function within(value, fallback, lo, hi) {          // lo <= value <= hi
    return Number.isFinite(value) && value >= lo && value <= hi ? value : fallback;
  }

  function sanitize(raw) {
    var src = raw && typeof raw === 'object' ? raw : {};
    return {
      enabled: typeof src.enabled === 'boolean' ? src.enabled : DEFAULTS.enabled,
      rateWindowMs: atLeast(src.rateWindowMs, DEFAULTS.rateWindowMs, 1000),
      rateMaxPerMin: above(src.rateMaxPerMin, DEFAULTS.rateMaxPerMin, 0),
      topicWindowMs: atLeast(src.topicWindowMs, DEFAULTS.topicWindowMs, 1000),
      topicCountMin: above(src.topicCountMin, DEFAULTS.topicCountMin, 0),
      topicShareMin: within(src.topicShareMin, DEFAULTS.topicShareMin, 0, 1),
      minSample: atLeast(src.minSample, DEFAULTS.minSample, 0),
      pauseMs: atLeast(src.pauseMs, DEFAULTS.pauseMs, 1000),
    };
  }

  // Count finite timestamps of `arr` inside (floor, ceil]. Anything malformed is skipped, so a
  // corrupt array can only ever under-count (never fabricate a pause).
  function countInWindow(arr, floor, ceil) {
    var n = 0;
    if (Array.isArray(arr)) {
      for (var i = 0; i < arr.length; i++) {
        var ts = arr[i];
        if (Number.isFinite(ts) && ts > floor && ts <= ceil) n++;
      }
    }
    return n;
  }

  function evaluate(win, now) {
    // No clock inside the logic: a non-finite `now` is a caller bug -> stay silent (fail closed).
    if (!Number.isFinite(now)) return null;
    var w = win && typeof win === 'object' ? win : {};
    var s = sanitize(w.settings); // the caller's settings, re-validated: defaults when absent
    var totalClicks = Number.isFinite(w.totalClicks) ? w.totalClicks : 0;

    if (!s.enabled) return null;
    if (totalClicks < s.minSample) return null;

    // --- RULE RATE ---------------------------------------------------------------------------
    var threshold = s.rateMaxPerMin * s.rateWindowMs / 60000;
    var count = countInWindow(w.allowTs, now - s.rateWindowMs, now);
    if (count >= threshold) return { rule: 'rate', detail: { count: count, threshold: threshold } };

    // --- RULE TOPIC (only when RATE stayed silent) -------------------------------------------
    // Duck-typed Map: `topics` may come from another realm (node:vm), so `instanceof Map` would
    // lie; requiring forEach AND get rejects null, plain objects and arrays alike.
    var topics = w.topics;
    if (!topics || typeof topics.forEach !== 'function' || typeof topics.get !== 'function') return null;

    var floor = now - s.topicWindowMs;
    var total = 0;
    var bestTopic = null;
    var bestCount = 0;
    topics.forEach(function (arr, topic) {
      var n = countInWindow(arr, floor, now);
      total += n;
      if (n <= 0) return;
      // deterministic pick: higher count wins; equal counts break alphabetically by topic name
      if (bestTopic === null || n > bestCount || (n === bestCount && String(topic) < bestTopic)) {
        bestTopic = String(topic);
        bestCount = n;
      }
    });
    if (bestTopic === null) return null;
    if (total < TOPIC_MIN_SAMPLE) return null;
    if (bestCount < s.topicCountMin) return null;
    var share = bestCount / total;
    if (share < s.topicShareMin) return null;
    return { rule: 'topic', topic: bestTopic, detail: { topicCount: bestCount, total: total, share: share } };
  }

  var api = { defaults: defaults, sanitize: sanitize, evaluate: evaluate };
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  globalThis.MuseAnomaly = api;
})();
