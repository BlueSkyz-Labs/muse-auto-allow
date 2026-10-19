# v1.20.0 (G04) wiring: content.js + background.js + manifest.json
import io

p = 'extension/content.js'
s = io.open(p, encoding='utf-8').read()

a1 = "  const allowClicks = []; // timestamps of allow clicks (global ceiling)"
assert a1 in s, 'a1'
s = s.replace(a1, a1 + """

  // ---- v1.20.0 (G04): anomaly auto-pause --------------------------------------------------
  // The detector can only ever ADD a pause (never touch a cap). All state is page-local except
  // the pause itself + its marker, which persist so the reason mapping survives a reload.
  let anomaly = null;            // sanitized MuseAnomaly settings (defaults once the boot read lands)
  let anomalyLatchUntil = 0;     // no re-evaluation before this ts (guards against a re-fire loop)
  let anomalyDead = false;       // a throwing detector stays disabled for this page (fail closed)
  let anomalyLastPause = null;   // last auto-pause marker (mirrors storage)
  const topicClicks = new Map(); // topic -> number[] timestamps (allow-clicks, G04 topic window)""", 1)

a2 = "    if ('allowOnceMode' in s) v18.allowOnceMode = s.allowOnceMode === true;"
assert a2 in s, 'a2'
s = s.replace(a2, a2 + """
    if ('anomaly' in s) anomaly = (typeof MuseAnomaly !== 'undefined' && MuseAnomaly) ? MuseAnomaly.sanitize(s.anomaly) : anomaly;
    if ('anomalyLastPause' in s) anomalyLastPause = (s.anomalyLastPause && typeof s.anomalyLastPause === 'object') ? s.anomalyLastPause : null;""", 1)

a3 = "missionEnabled: false, mission: null },"
assert a3 in s, 'a3'
s = s.replace(a3, "missionEnabled: false, mission: null, anomaly: null, anomalyLastPause: null },", 1)

a4 = "      if (ch.enabled) state.enabled = removed(ch.enabled) ? DEFAULT.enabled : !!ch.enabled.newValue;"
assert a4 in s, 'a4'
s = s.replace(a4, a4 + """
      if (ch.anomaly) anomaly = (typeof MuseAnomaly !== 'undefined' && MuseAnomaly) ? MuseAnomaly.sanitize(removed(ch.anomaly) ? null : ch.anomaly.newValue) : anomaly; // v1.20.0 (G04)
      if (ch.anomalyLastPause) { const m = removed(ch.anomalyLastPause) ? null : ch.anomalyLastPause.newValue; anomalyLastPause = (m && typeof m === 'object') ? m : null; }""", 1)

a5 = "  function sweep(reason) {"
assert a5 in s, 'a5'
s = s.replace(a5, """  // ---- v1.20.0 (G04): anomaly detector ------------------------------------------------------
  function noteAnomalyAllow(text) {
    try {
      const topic = extractTopic(String(text || '')) || '';
      if (!topic) return;
      let arr = topicClicks.get(topic);
      if (!arr) { arr = []; topicClicks.set(topic, arr); }
      arr.push(Date.now());
      if (topicClicks.size > 64) topicClicks.delete(topicClicks.keys().next().value);
    } catch { /* the detector must never break the click path */ }
  }
  function anomalyFire(now, verdict) {
    anomalyLatchUntil = now + anomaly.pauseMs;
    const until = anomalyLatchUntil;
    const ctx = verdict.rule === 'rate'
      ? 'rate:' + Math.round(verdict.detail.count) + '/' + Math.round(anomaly.rateWindowMs / 60000) + 'min'
      : 'topic:spike-' + verdict.topic + ' ' + verdict.detail.topicCount + '/' + Math.round(anomaly.topicWindowMs / 60000) + 'min';
    const entry = { at: new Date().toISOString(), kind: 'anomaly-pause', label: 'Auto-pause (anomaly)', blockedReason: 'anomaly-pause', context: ctx };
    try { state.lastResult = entry; recordClick(entry, ctx, false); } catch { /* logging must not break the pause */ }
    anomalyLastPause = { firedAt: now, until: until, rule: verdict.rule, detail: verdict.detail };
    v18.pauseUntil = until;
    try {
      chrome.storage.local.set({ pauseUntil: until, anomalyLastPause: anomalyLastPause });
    } catch { /* quota failure: the in-page latch still holds the pause-open window */ }
    console.warn('[muse-auto-allow] anomaly auto-pause (' + verdict.rule + ') until ' + new Date(until).toISOString());
  }
  function checkAnomaly(now) {
    if (anomalyDead || !anomaly || typeof MuseAnomaly === 'undefined' || !MuseAnomaly) return;
    if (v18.dryRun) return; // dry-run is a deliberate no-click mode - the detector stays out of it
    if (now < anomalyLatchUntil) return;
    if ((state.clickCount || 0) < anomaly.minSample) return;
    let verdict = null;
    try {
      verdict = MuseAnomaly.evaluate({ settings: anomaly, allowTs: allowClicks, topics: topicClicks, totalClicks: state.clickCount || 0 }, now);
    } catch { anomalyDead = true; console.warn('[muse-auto-allow] anomaly detector disabled (evaluate error)'); return; } // fail closed
    if (verdict) anomalyFire(now, verdict);
  }
  function pauseReason() {
    return (anomalyLastPause && Number(anomalyLastPause.until) === Number(v18.pauseUntil)) ? 'anomaly-pause' : 'paused';
  }

  function sweep(reason) {""", 1)

a6 = """    if (paused()) return; // v1.8.0 pause: every click path (A–E) is halted until pauseUntil passes
    const now = Date.now();"""
assert a6 in s, 'a6'
s = s.replace(a6, a6 + """
    checkAnomaly(now); // v1.20.0 (G04): the detector rides the same tick, only when unpaused""", 1)

a7 = """      markAllowFp(allowFp(btn, ctx !== undefined ? ctx : (card ? contextText(card) : '')));
      allowClicks.push(state.lastClickAt);"""
assert a7 in s, 'a7'
s = s.replace(a7, """      markAllowFp(allowFp(btn, ctx !== undefined ? ctx : (card ? contextText(card) : '')));
      allowClicks.push(state.lastClickAt);
      noteAnomalyAllow(ctx !== undefined ? ctx : (card ? contextText(card) : '')); // v1.20.0 (G04)""", 1)

a8 = "    if (paused()) return { ok: false, reason: 'paused' };"
assert a8 in s, 'a8'
s = s.replace(a8, "    if (paused()) return { ok: false, reason: pauseReason() }; // v1.20.0 (G04): 'anomaly-pause' when the auto-pause marker matches", 1)

io.open(p, 'w', encoding='utf-8').write(s)
print('content.js wired')

pb = 'extension/background.js'
b = io.open(pb, encoding='utf-8').read()
b1 = """  'followupEnabled', 'followupPrompt', 'followupPrompts', 'followupChips', 'followupSmart', 'followupSchedule'];"""
assert b1 in b, 'b1'
b = b.replace(b1, """  'followupEnabled', 'followupPrompt', 'followupPrompts', 'followupChips', 'followupSmart', 'followupSchedule',
  'anomaly']; // v1.20.0 (G04) - rides the opt-in sync subset""", 1)

b2 = "  if (ch.pauseUntil) schedulePauseBadgeRefresh();"
assert b2 in b, 'b2'
b = b.replace(b2, b2 + """
  if (ch.pauseUntil) notifyAnomalyPause(ch.pauseUntil.newValue); // v1.20.0 (G04)""", 1)

b3 = "function updateBadge() {"
assert b3 in b, 'b3'
b = b.replace(b3, """// v1.20.0 (G04): one notification when the pause came from the anomaly detector. The marker is
// written in the SAME storage.set as pauseUntil, so a matching marker proves the origin; a
// manual pause (no marker) stays silent. Notifications must never break the pause path.
function notifyAnomalyPause(untilRaw) {
  const until = Number(untilRaw);
  if (!Number.isFinite(until) || until <= Date.now()) return;
  chrome.storage.local.get({ anomalyLastPause: null }, (s) => {
    const m = s && s.anomalyLastPause;
    if (!m || Number(m.until) !== until) return;
    try {
      chrome.notifications.create('maa-anomaly-pause', {
        type: 'basic', iconUrl: DIGEST_ICON, title: 'muse-auto-allow',
        message: 'Auto-paused until ' + new Date(until).toLocaleString() + ' - unusual click activity (' + String(m.rule || 'anomaly') + ').',
      }, () => { void chrome.runtime.lastError; });
    } catch { /* a notification failure must never break the pause path */ }
  });
}
function updateBadge() {""", 1)
io.open(pb, 'w', encoding='utf-8').write(b)
print('background.js wired')

pm = 'extension/manifest.json'
m = io.open(pm, encoding='utf-8').read()
m1 = '''      "matches": ["https://muse.ai/*", "https://*.muse.ai/*"],
      "js": ["content.js"],'''
assert m1 in m, 'm1'
m = m.replace(m1, '''      "matches": ["https://muse.ai/*", "https://*.muse.ai/*"],
      "js": ["anomaly.js", "content.js"],''', 1)
io.open(pm, 'w', encoding='utf-8').write(m)
print('manifest wired')
