# v1.20.0 (G04): fixture spike family + followup-e2e anomaly phase
import io

# ---------- fixture ----------
p = 'test/followup-fixture.html'
s = io.open(p, encoding='utf-8').read()

a1 = '<script>'
assert s.count(a1) >= 1
# insert the host div right BEFORE the first <script> tag
host = '''<!-- v1.20.0 (G04): the anomaly burst family. Cards are CREATED on demand by
     window.__setAnomaly('spike') so no other phase or suite ever sees them. -->
<div id="spikeHost"></div>

<script>'''
s = s.replace(a1, host, 1)

a2 = """window.__setV18 = function (mode) {"""
assert a2 in s, 'a2'
i = s.index(a2)
# find the end of the __setV18 assignment: the first "\n};" after it
j = s.index('\n};', i) + 3
patch = s[:j] + '''
// v1.20.0 (G04): anomaly burst — 45 identical approval cards about "Repository spike-repo".
// Created on demand so every other phase/suite is unaffected; each Allow records into
// __cardClicks like the v18 family (Deny records too, so a stray deny click is auditable).
window.__setAnomaly = function (mode) {
  var hostEl = document.getElementById('spikeHost');
  if (!hostEl) return;
  hostEl.innerHTML = '';
  if (mode !== 'spike') return;
  for (var i = 0; i < 45; i++) {
    var card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('data-testid', 'hatch-inline-approval-card');
    var para = document.createElement('p');
    para.textContent = 'Allow Muse to perform this action on your GitHub account? Action Pull Repository spike-repo';
    var row = document.createElement('div');
    row.className = 'row';
    var allow = document.createElement('button');
    allow.type = 'button'; allow.className = 'allow'; allow.textContent = 'Allow';
    allow.addEventListener('click', function () { window.__cardClicks.push({ n: 'spike-allow', t: Date.now() }); });
    var deny = document.createElement('button');
    deny.type = 'button'; deny.className = 'deny'; deny.textContent = 'Deny';
    deny.addEventListener('click', function () { window.__cardClicks.push({ n: 'spike-deny', t: Date.now() }); });
    row.appendChild(allow); row.appendChild(deny);
    card.appendChild(para); card.appendChild(row);
    hostEl.appendChild(card);
  }
};
''' + s[j:]
s = patch
io.open(p, 'w', encoding='utf-8').write(s)
print('fixture patched: spikeHost + __setAnomaly')

# ---------- followup-e2e ----------
p2 = 'test/followup-e2e.mjs'
t = io.open(p2, encoding='utf-8').read()
anchor = """  check('G07 briefing. #digest shows counters + top reason + 7-day trend',
    !!g7 && g7.hidden === false && /keyword:banana \\(2\\)/.test(g7.top) && g7.trend === '7' && /4/.test(g7.delta), g7);"""
assert anchor in t, 'g07 anchor'
phase = anchor + '''

  // ---- v1.20.0 (G04): anomaly auto-pause — the topic spike fires, the engine halts, and the
  // ---- follow-up path maps the pause to the NEW reason. Thresholds are tuned for the burst so
  // ---- the rule trips inside the suite (the SHIPPED defaults are unit-tested in anomaly-unit).
  await fEval("window.__setV18('off')");
  await seed({ enabled: true, minDelayMs: 0, dryRun: false, pauseUntil: 0, anomalyLastPause: null,
    anomaly: { enabled: true, minSample: 12, topicCountMin: 12, topicShareMin: 0.6, rateMaxPerMin: 999, pauseMs: 900000 } });
  await fEval('location.reload()');
  await sleep(1800); // fresh page = fresh engine windows (allowClicks/topicClicks)
  await fEval("window.__setAnomaly('spike')");
  let g4store = null;
  const g4deadline = Date.now() + 90000;
  while (Date.now() < g4deadline) {
    const st = await popStore(['pauseUntil', 'anomalyLastPause', 'log']);
    if (((Number(st && st.pauseUntil) || 0) > Date.now() + 60000)) { g4store = st; break; }
    await sleep(2000);
  }
  const g4until = (Number(g4store && g4store.pauseUntil) || 0);
  check('G04-1. a topic-spike burst auto-pauses the engine (~15 min ahead)',
    g4until > Date.now() + 60000, { until: g4until, marker: g4store && g4store.anomalyLastPause });
  const g4log = (g4store && Array.isArray(g4store.log)) ? g4store.log : [];
  const g4entry = g4log.find((e) => e && e.kind === 'anomaly-pause');
  check('G04-2. the auto-pause is logged as kind anomaly-pause with a topic context',
    !!g4entry && /topic:spike-/.test(String(g4entry.context || '')), { entry: g4entry || null });
  const clicks0 = await fJSON('window.__cardClicks.length');
  await sleep(3500);
  const clicks1 = await fJSON('window.__cardClicks.length');
  check('G04-3. while auto-paused the engine clicks nothing (burst frozen)',
    clicks0 === clicks1 && clicks0 >= 10, { before: clicks0, after: clicks1 });
  try { await send('Page.reload', {}, popSession); } catch { /* ignore */ }
  await sleep(900);
  const g4pop = await pEval(`({ noteHidden: document.getElementById('anomalyNote') ? document.getElementById('anomalyNote').hidden : null, groupHidden: document.getElementById('pauseActive').hidden, state: (document.getElementById('pstateText').textContent || '') })`);
  check('G04-4. popup shows the anomaly pause state + note',
    !!g4pop && g4pop.groupHidden === false && g4pop.noteHidden === false && /(unusual|anomaly|auto)/i.test(g4pop.state), g4pop);
  const g4send = await fixtureMsg({ type: 'followup-send-now' });
  check('G04-5. send-now during the auto-pause maps to reason anomaly-pause',
    !!(g4send.resp && g4send.resp.ok === false && g4send.resp.reason === 'anomaly-pause'), g4send.resp);
  await seed({ anomaly: { enabled: false }, pauseUntil: 0, anomalyLastPause: null });
  await sleep(4000);
  const clicks2 = await fJSON('window.__cardClicks.length');
  const st2 = await popStore(['pauseUntil', 'anomalyLastPause']);
  check('G04-6. disabled guard: the burst resumes and nothing re-pauses',
    clicks2 > clicks1 && (Number(st2 && st2.pauseUntil) || 0) === 0, { after: clicks2, pauseUntil: st2 && st2.pauseUntil });'''
t = t.replace(anchor, phase, 1)
io.open(p2, 'w', encoding='utf-8').write(t)
print('followup-e2e G04 phase added')
