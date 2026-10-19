# v1.20.0 (G04): fix the e2e phase — fire via the RATE rule, enable follow-up for the reason check
import io

p = 'test/followup-e2e.mjs'
t = io.open(p, encoding='utf-8').read()

old = '''  // ---- v1.20.0 (G04): anomaly auto-pause — the topic spike fires, the engine halts, and the
  // ---- follow-up path maps the pause to the NEW reason. Thresholds are tuned for the burst so
  // ---- the rule trips inside the suite (the SHIPPED defaults are unit-tested in anomaly-unit).
  await fEval("window.__setV18('off')");
  await seed({ enabled: true, minDelayMs: 0, dryRun: false, pauseUntil: 0, anomalyLastPause: null,
    anomaly: { enabled: true, minSample: 12, topicCountMin: 12, topicShareMin: 0.6, rateMaxPerMin: 999, pauseMs: 900000 } });'''
new = '''  // ---- v1.20.0 (G04): anomaly auto-pause — the burst trips the detector, the engine halts, and
  // ---- the follow-up path maps the pause to the NEW reason. The suite drives the RATE rule
  // ---- (threshold = rateMaxPerMin x rateWindowMs / 60000 = 5 clicks in 60 s); the TOPIC rule's
  // ---- semantics (40/50 share 0.8 fires, 0.5 silent, the fixed window-total floor of 30) are
  // ---- unit-tested against the shipped module in test/anomaly-unit.mjs.
  await fEval("window.__setV18('off')");
  await seed({ enabled: true, minDelayMs: 0, dryRun: false, pauseUntil: 0, anomalyLastPause: null,
    followupEnabled: true, followupPrompt: 'G04 probe — continue where you left off',
    anomaly: { enabled: true, minSample: 3, rateMaxPerMin: 5, rateWindowMs: 60000, pauseMs: 900000 } });'''
assert old in t, 'seed anchor'
t = t.replace(old, new, 1)

old2 = '''  check('G04-2. the auto-pause is logged as kind anomaly-pause with a topic context',
    !!g4entry && /topic:spike-/.test(String(g4entry.context || '')), { entry: g4entry || null });'''
new2 = '''  check('G04-2. the auto-pause is logged as kind anomaly-pause with a rate/topic context',
    !!g4entry && /(rate:|topic:)/.test(String(g4entry.context || '')), { entry: g4entry || null });'''
assert old2 in t, 'assert2 anchor'
t = t.replace(old2, new2, 1)

old3 = "  check('G04-1. a topic-spike burst auto-pauses the engine (~15 min ahead)',"
new3 = "  check('G04-1. the burst trips the detector and auto-pauses the engine (~15 min ahead)',"
assert old3 in t, 'assert1 anchor'
t = t.replace(old3, new3, 1)

io.open(p, 'w', encoding='utf-8').write(t)
print('G04 phase retuned: RATE rule, followup enabled, assertions updated')
