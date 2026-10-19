# v1.21.0 (G02): mission-e2e updates (5-id preflight + G02 phase)
import io

p = 'test/mission-e2e.mjs'
s = io.open(p, encoding='utf-8').read()

# 1) preflight expected ids -> 5
a1 = "  check('pre. shipped corpus found with 4 missions by id', pre.corpusFound && JSON.stringify(pre.ids) === JSON.stringify(['golive-ready', 'audit-only', 'fix-findings', 'release-prep']), { ids: pre.ids });"
assert a1 in s, 'a1'
s = s.replace(a1, "  check('pre. shipped corpus found with 5 missions by id', pre.corpusFound && JSON.stringify(pre.ids) === JSON.stringify(['golive-ready', 'audit-only', 'fix-findings', 'release-prep', 'scoped-run']), { ids: pre.ids });", 1)

a2 = "    ok: found && ids.length === 4 && flagged.length === 0 && ctlPos >= 1 && ctlNeg === 0,"
assert a2 in s, 'a2'
s = s.replace(a2, "    ok: found && ids.length === 5 && flagged.length === 0 && ctlPos >= 1 && ctlNeg === 0,", 1)

a3 = "  check('P. status ping lists the 4 shipped mission ids', !!(pingP && Array.isArray(pingP.missions) && pingP.missions.length === 4 && pingP.missions.includes('golive-ready')), pingP && pingP.missions);"
assert a3 in s, 'a3'
s = s.replace(a3, "  check('P. status ping lists the 5 shipped mission ids', !!(pingP && Array.isArray(pingP.missions) && pingP.missions.length === 5 && pingP.missions.includes('golive-ready') && pingP.missions.includes('scoped-run')), pingP && pingP.missions);", 1)

# 2) G02 phase before the hygiene section
a4 = "  check('z. fixture page saw no JS errors', fxErrors.length === 0, { fxErrors });"
assert a4 in s, 'a4'
phase = '''  // ---- v1.21.0 (G02). playbook variables + guards: defaults, run values, guard refusal, fail-closed
  await fEval("window.__setState('working')");
  await fEval("window.__setApproval(false)");
  await seed({ pauseUntil: 0, dryRun: false, followupEnabled: true, missionEnabled: true, missionPlaybooks: null,
    mission: { id: 'scoped-run', step: 0, cycles: 0, startedAt: Date.now(), lastSentAt: 0 } });
  await waitEngine((p) => p.missionId === 'scoped-run' && p.missionEnabled === true, 8000, 'scoped-run applied');
  const rG0 = await fixtureMsg({ type: 'followup-send-now' });
  const sentG0 = await sentList();
  const lastG0 = sentG0[sentG0.length - 1];
  check('G02-A. a scoped-run WITHOUT stored values sends the shipped DEFAULTS (never the token)',
    !!(rG0.resp && rG0.resp.ok === true) && !!lastG0 && /this project/.test(lastG0.text) && /main/.test(lastG0.text) && !/\\{\\{/.test(lastG0.text),
    { resp: rG0.resp, last: lastG0 && lastG0.text && lastG0.text.slice(0, 120) });

  await seed({ mission: { id: 'scoped-run', step: 1, cycles: 0, startedAt: Date.now(), lastSentAt: 0, values: { project: 'alpha-repo', branch: 'g2-branch' } } });
  await waitEngine((p) => p.missionStep === 1, 8000, 'values run applied');
  const rG1 = await fixtureMsg({ type: 'followup-send-now' });
  const sentG1 = await sentList();
  const lastG1 = sentG1[sentG1.length - 1];
  check('G02-B. the typed step carries the RUN VALUES (never the token)',
    !!(rG1.resp && rG1.resp.ok === true) && !!lastG1 && /alpha-repo/.test(lastG1.text) && /g2-branch/.test(lastG1.text) && !/\\{\\{/.test(lastG1.text),
    { resp: rG1.resp, last: lastG1 && lastG1.text && lastG1.text.slice(0, 120) });

  await seed({ missionPlaybooks: { 'scoped-run': { guards: { extraBlockedKeywords: ['zzz-guard'] } } },
    mission: { id: 'scoped-run', step: 0, cycles: 0, startedAt: Date.now(), lastSentAt: 0, values: { project: 'zzz-guard', branch: 'main' } } });
  await waitEngine((p) => p.missionStep === 0, 8000, 'guard run applied');
  const typedBefore = (await sentList()).length;
  const rG2 = await fixtureMsg({ type: 'followup-send-now' });
  const typedAfter = (await sentList()).length;
  const pingG2 = await enginePing();
  check('G02-C. the per-playbook guard refuses BEFORE typing and the step does not advance',
    !!(rG2.resp && rG2.resp.ok === false && rG2.resp.reason === 'mission-guard') && typedAfter === typedBefore && pingG2.missionStep === 0,
    { resp: rG2.resp, typedBefore, typedAfter, step: pingG2 && pingG2.missionStep });

  await seed({ missionPlaybooks: null, mission: { id: 'scoped-run', step: 0, cycles: 0, startedAt: Date.now(), lastSentAt: 0, values: { project: 'bad\\u0007value', branch: 'main' } } });
  await sleep(1200);
  const pingG3 = await enginePing();
  check('G02-D. invalid stored values clear the mission (fail closed, nothing runs)',
    !!(pingG3 && pingG3.missionId === ''), { ping: pingG3 && { id: pingG3.missionId } });

  try { await send('Page.reload', {}, popSession); } catch { /* ignore */ }
  await sleep(900);
  await pEval(`(() => { const b = document.getElementById('misbtn'); if (b) b.click(); return 'ok'; })()`);
  await sleep(300);
  await pEval(`(() => { const rows = document.querySelectorAll('#misList [data-mid]'); for (const r of rows) if (r.dataset.mid === 'scoped-run') r.click(); return 'ok'; })()`);
  await sleep(400);
  const cfgG = await pEval(`({ open: !document.getElementById('misConfig').hidden, inputs: document.querySelectorAll('#misVariables input[data-var]').length, prev: (document.getElementById('misPreview').textContent || '') })`);
  check('G02-E. the mission sheet config renders the variables + a rendered preview',
    !!cfgG && cfgG.open === true && cfgG.inputs === 2 && /this project/.test(cfgG.prev) && !/\\{\\{/.test(cfgG.prev),
    { open: cfgG && cfgG.open, inputs: cfgG && cfgG.inputs, prev: cfgG && cfgG.prev && cfgG.prev.slice(0, 100) });

''' + a4
s = s.replace(a4, phase, 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('mission-e2e updated')
