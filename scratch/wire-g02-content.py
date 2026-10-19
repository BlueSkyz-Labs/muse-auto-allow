# v1.21.0 (G02): content.js playbook wiring (vars + guards + fail-closed render)
import io

p = 'extension/content.js'
s = io.open(p, encoding='utf-8').read()

# 1) add the 5th shipped playbook (tokens {{project}}/{{branch}} declared in vars metadata)
a1 = """    {
      id: 'release-prep',"""
assert a1 in s, 'a1'
entry = """    {
      id: 'scoped-run',
      title: 'SCOPED RUN — {{project}} @ {{branch}}',
      vars: { project: { def: 'this project' }, branch: { def: 'main' } },
      guards: { extraBlockedKeywords: [], pauseWhenUnavailable: true },
      steps: [
        'SCOPED RUN S1 — Work only inside {{project}} on branch {{branch}}. Read its source of truth first and treat its decisions as binding; write no code yet — close this step with the execution contract.',
        'SCOPED RUN S2 — Take the next approved item in {{project}} (branch {{branch}}) and finish it end-to-end: implement, test, and show the real command output as evidence.',
        'SCOPED RUN S3 — Verify {{project}} on {{branch}} still passes every gate, then land the change under the repository rules and report the evidence only.',
      ],
    },
    {
      id: 'release-prep',"""
s = s.replace(a1, entry, 1)

# 2) mission object gains a values slot
a2 = "    completedId: '',  // last completed mission id (observability for the popup/tests)"
assert a2 in s, 'a2'
s = s.replace(a2, a2 + "\n    values: null,     // v1.21.0 (G02): validated per-run variable snapshot (null = none declared)", 1)

# 3) meta + render + screen + updated step text / override — insert before missionActive()
a3 = "  const missionActive = () => mission.enabled && !!mission.id && !!missionById(mission.id);"
assert a3 in s, 'a3'
wiring = """  // ---- v1.21.0 (G02): playbook variables + per-playbook guards (metadata-driven, fail-closed) ----
  const missionPlaybooksMeta = Object.create(null); // id -> { varNames, defaults, guards }
  (function buildMissionMeta() {
    if (typeof MusePlaybook === 'undefined' || !MusePlaybook) return; // pure module must load first
    for (const m of MISSION_CORPUS) {
      const vars = m && m.vars && typeof m.vars === 'object' ? m.vars : null;
      if (!vars) continue;
      const dec = MusePlaybook.declare(Object.keys(vars));
      if (!dec.ok) continue; // invalid shipped metadata: the playbook simply carries no variables
      const defaults = {};
      let bad = false;
      for (const n of dec.names) {
        const dv = MusePlaybook.validateValue(vars[n] && typeof vars[n] === 'object' ? vars[n].def : undefined);
        if (!dv.ok) { bad = true; break; }
        defaults[n] = dv.value;
      }
      if (bad) continue;
      const g = m.guards && typeof m.guards === 'object' ? m.guards : {};
      const gkw = Array.isArray(g.extraBlockedKeywords)
        ? g.extraBlockedKeywords.filter((k) => typeof k === 'string' && k.length >= 1 && k.length <= 40).slice(0, 20)
        : [];
      missionPlaybooksMeta[m.id] = { varNames: dec.names, defaults, guards: { extraBlockedKeywords: gkw, pauseWhenUnavailable: g.pauseWhenUnavailable === true } };
    }
  })();
  const missionMetaFor = (id) => missionPlaybooksMeta[id] || null;
  // Danger screen for variable VALUES (spec: values reuse the keyword + connector/credential screens).
  function missionValuesScreen(values) {
    if (!values) return true; // no declared variables = nothing to screen
    const kw = Array.isArray(v18.blockKeywords) ? v18.blockKeywords : [];
    for (const name of Object.keys(values)) {
      const v = String(values[name] || '');
      if (!v) return false;
      const low = v.toLowerCase();
      for (const k of kw) { if (k && low.includes(String(k).toLowerCase())) return false; }
      if (CONNECTOR_WORD_RE.test(v) || TOKEN_WORDING_RE.test(v)) return false;
    }
    return true;
  }
  // Render the CURRENT step with the validated run values; unknown tokens / bad values fail closed.
  function missionRenderStep() {
    const steps = missionStepsOf(mission.id);
    if (!steps.length) return { ok: false, code: 'no-steps' };
    const raw = String(steps[Math.min(mission.step, steps.length - 1)] || '');
    const meta = missionMetaFor(mission.id);
    if (!meta || !meta.varNames.length) {
      return /\\{\\{|\\}\\}/.test(raw) ? { ok: false, code: 'token-unknown' } : { ok: true, text: raw };
    }
    if (typeof MusePlaybook === 'undefined' || !MusePlaybook) return { ok: false, code: 'no-renderer' };
    return MusePlaybook.render(raw, mission.values || meta.defaults);
  }
  const missionActive = () => mission.enabled && !!mission.id && !!missionById(mission.id);"""
s = s.replace(a3, wiring, 1)

# 4) missionStepText renders through the playbook renderer
a4 = """  const missionStepText = () => {
    const steps = missionStepsOf(mission.id);
    if (!steps.length) return '';
    return String(steps[Math.min(mission.step, steps.length - 1)] || '');
  };"""
assert a4 in s, 'a4'
s = s.replace(a4, """  const missionStepText = () => {
    const r = missionRenderStep(); // v1.21.0 (G02): '' on any render/validation failure (fail closed)
    return r.ok ? r.text : '';
  };""", 1)

# 5) override gains the unavailable branch
a5 = """  function missionSendOverride() {
    if (!missionActive()) return null;
    const text = missionStepText();
    if (!text) return null;
    return { text, source: 'mission', mission: { id: mission.id, step: mission.step, cycle: missionCycleNo() } };
  }"""
assert a5 in s, 'a5'
s = s.replace(a5, """  function missionSendOverride() {
    if (!missionActive()) return null;
    const r = missionRenderStep();
    if (!r.ok || !missionValuesScreen(mission.values)) {
      // v1.21.0 (G02): the step cannot be rendered with valid values — never substitute the
      // rotation phrase; the mission stays exactly where it is (pauseWhenUnavailable semantics).
      return { unavailable: true, mission: { id: mission.id, step: mission.step, cycle: missionCycleNo() } };
    }
    return { text: r.text, source: 'mission', mission: { id: mission.id, step: mission.step, cycle: missionCycleNo() } };
  }""", 1)

# 6) persistMission carries the values snapshot
a6 = "      else chrome.storage.local.set({ mission: { id: mission.id, step: mission.step, cycles: mission.cycles, startedAt: mission.startedAt, lastSentAt: mission.lastSentAt } });"
assert a6 in s, 'a6'
s = s.replace(a6, "      else chrome.storage.local.set({ mission: Object.assign({ id: mission.id, step: mission.step, cycles: mission.cycles, startedAt: mission.startedAt, lastSentAt: mission.lastSentAt }, mission.values ? { values: mission.values, playbookVersion: 1 } : {}) });", 1)

# 7) missionComplete clears values
a7 = "    mission.id = ''; mission.step = 0; mission.cycles = 0; mission.startedAt = 0; mission.lastSentAt = 0;"
assert a7 in s, 'a7'
s = s.replace(a7, "    mission.id = ''; mission.step = 0; mission.cycles = 0; mission.startedAt = 0; mission.lastSentAt = 0; mission.values = null;", 1)

# 8) sanitizeMission validates values (fail closed -> no mission)
a8 = """    const l0 = Number(o.lastSentAt); const lastSentAt = Number.isFinite(l0) && l0 > 0 ? l0 : 0;
    return { id, step, cycles, startedAt, lastSentAt };"""
assert a8 in s, 'a8'
s = s.replace(a8, """    const l0 = Number(o.lastSentAt); const lastSentAt = Number.isFinite(l0) && l0 > 0 ? l0 : 0;
    // v1.21.0 (G02): validate the run values against the declared names + defaults; ANY invalid
    // value clears the mission entirely (fail closed — never send with unresolved tokens).
    const meta = missionMetaFor(id);
    let values = null;
    if (meta && meta.varNames.length) {
      if (typeof MusePlaybook === 'undefined' || !MusePlaybook) return null;
      const mv = MusePlaybook.mergeValues(meta.varNames, meta.defaults, asObj(o.values));
      if (!mv.ok) return null;
      if (!missionValuesScreen(mv.values)) return null;
      values = mv.values;
    }
    return { id, step, cycles, startedAt, lastSentAt, values };""", 1)

# 9) applyMissionSettings assigns values
a9 = """      if (m) { mission.id = m.id; mission.step = m.step; mission.cycles = m.cycles; mission.startedAt = m.startedAt; mission.lastSentAt = m.lastSentAt; }
      else { mission.id = ''; mission.step = 0; mission.cycles = 0; mission.startedAt = 0; mission.lastSentAt = 0; }"""
assert a9 in s, 'a9'
s = s.replace(a9, """      if (m) { mission.id = m.id; mission.step = m.step; mission.cycles = m.cycles; mission.startedAt = m.startedAt; mission.lastSentAt = m.lastSentAt; mission.values = m.values || null; }
      else { mission.id = ''; mission.step = 0; mission.cycles = 0; mission.startedAt = 0; mission.lastSentAt = 0; mission.values = null; }""", 1)

# 10) tick site: unavailable mission never falls through to the rotation
a10 = """    const mis = missionSendOverride();
    if (mis) { followupAttempt(false, mis); return; }
    followupAttempt(false);"""
assert a10 in s, 'a10'
s = s.replace(a10, """    const mis = missionSendOverride();
    if (mis && mis.unavailable) return; // v1.21.0 (G02): mission active but not renderable — never substitute the rotation
    if (mis) { followupAttempt(false, mis); return; }
    followupAttempt(false);""", 1)

# 11) manual send-now surfaces the reason
a11 = "        const r = mov ? followupAttempt(true, mov) : followupAttempt(true);"
assert a11 in s, 'a11'
s = s.replace(a11, "        const r = mov ? (mov.unavailable ? { ok: false, reason: 'mission-unavailable' } : followupAttempt(true, mov)) : followupAttempt(true);", 1)

# 12) guard + render safety inside followupAttempt (before typing)
a12 = "    if (!text) return { ok: false, reason: 'no-prompt' };"
assert a12 in s, 'a12'
s = s.replace(a12, """    if (!text) return { ok: false, reason: 'no-prompt' };
    // v1.21.0 (G02): per-playbook guard — refuse BEFORE typing when the final text carries an
    // extra blocked keyword; the mission step never advances on a refusal.
    if (opts && opts.mission) {
      const gm = missionMetaFor(opts.mission.id);
      const gkw = gm && gm.guards ? gm.guards.extraBlockedKeywords : [];
      if (gkw.length) {
        const lowT = text.toLowerCase();
        for (const k of gkw) { if (lowT.indexOf(String(k).toLowerCase()) !== -1) return { ok: false, reason: 'mission-guard' }; }
      }
    }""", 1)

io.open(p, 'w', encoding='utf-8').write(s)
print('content.js G02 wired')
