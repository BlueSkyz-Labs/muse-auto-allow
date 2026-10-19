# v1.21.0 (G02): popup mission-sheet config UI + reason map + meta entry
import io

# ---------- popup.html ----------
p = 'extension/popup.html'
s = io.open(p, encoding='utf-8').read()

a1 = """      <div class="rgroup">
        <div class="rlabel" data-i18n="missionChoose">Choose a mission</div>
        <div class="mislist" id="misList" role="radiogroup" aria-label="Missions"></div>
      </div>"""
assert a1 in s, 'a1'
config = a1 + """
      <!-- v1.21.0 (G02): playbook variables + next-step preview (only for playbooks that
           declare variables; Start is disabled until every value validates). -->
      <div class="rgroup" id="misConfig" hidden>
        <div class="rlabel" id="misConfigTitle"></div>
        <div class="rlabel" data-i18n="missionVariables">Playbook variables</div>
        <div id="misVariables"></div>
        <div class="rlabel" data-i18n="missionPreview">Next-step preview</div>
        <div class="mpreview" id="misPreview" aria-live="polite" aria-atomic="true"></div>
        <div class="misnote" id="misValidation" role="status"></div>
        <div class="misacts">
          <button type="button" class="btn" id="misStart" data-i18n="missionStart">Preview and start</button>
          <button type="button" class="rbtn" id="misCancel" data-i18n="missionCancel">Cancel</button>
        </div>
      </div>"""
s = s.replace(a1, config, 1)

a2 = '<script src="license-pubkey.js"></script>'
assert a2 in s, 'a2'
s = s.replace(a2, '<script src="playbook.js"></script>\n  ' + a2, 1)

a3 = '.licchip {'
i = s.find(a3)
assert i >= 0, 'a3'
css = """.mpreview { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 11px; line-height: 1.45;
             color: var(--muted); background: var(--panel); border: 1px solid var(--stroke);
             border-radius: 8px; padding: 4px 8px; max-height: 108px; overflow: auto; }
  #misVariables .row { align-items: center; }
  #misVariables input[type="text"] { flex: 1; min-width: 0; font: inherit; font-size: 12px; padding: 2px 8px;
             border-radius: 8px; border: 1px solid var(--stroke); background: var(--fill); color: var(--ink); }
  #misVariables input[type="text"]:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
"""
s = s[:i] + css + s[i:]
io.open(p, 'w', encoding='utf-8').write(s)
print('popup.html: config group + playbook.js + css')

# ---------- popup.js ----------
p2 = 'extension/popup.js'
t = io.open(p2, encoding='utf-8').read()

b1 = "const MISSION_META = [\n  { id: 'golive-ready', nameKey: 'missionGolive', descKey: 'missionGoliveDesc', steps: 6 },"
assert b1 in t, 'b1'
t = t.replace(b1, "const MISSION_META = [\n  { id: 'golive-ready', nameKey: 'missionGolive', descKey: 'missionGoliveDesc', steps: 6 },", 1)
b2 = "  { id: 'release-prep', nameKey: 'missionRelease', descKey: 'missionReleaseDesc', steps: 4 },"
assert b2 in t, 'b2'
t = t.replace(b2, b2 + "\n  { id: 'scoped-run', nameKey: 'missionScoped', descKey: 'missionScopedDesc', steps: 3, vars: { project: 'this project', branch: 'main' }, firstRaw: 'SCOPED RUN S1 — Work only inside {{project}} on branch {{branch}}. Read its source of truth first and treat its decisions as binding; write no code yet — close this step with the execution contract.' }, // v1.21.0 (G02) (firstRaw stays in lockstep with MISSION_CORPUS step 1 — locked by mission-e2e)", 1)

# reason map entries
b3 = "  'anomaly-pause': ['followupSendBlockedAnomaly', 'Send refused: the engine auto-paused (anomaly)'], // v1.20.0 (G04)"
assert b3 in t, 'b3'
t = t.replace(b3, b3 + """
  'mission-guard': ['missionGuardBlocked', 'This playbook guard blocked the step; progress was not changed.'], // v1.21.0 (G02)
  'mission-unavailable': ['missionUnavailable', 'The step is unavailable; the mission remains paused.'], // v1.21.0 (G02)""", 1)

# config UI logic before the misList click listener (anchor at the listener, insert functions above it)
b4 = "$('misList').addEventListener('click', (e) => {"
assert b4 in t, 'b4'
logic = """// ---- v1.21.0 (G02): playbook configuration — variables + preview + explicit Start ----------------
let misConfigId = ''; // playbook being configured ('' = the config panel is closed)
function misMetaOf(id) { return MISSION_META.find((m) => m.id === id) || null; }
function misRenderPreview() {
  const meta = misMetaOf(misConfigId);
  const prev = $('misPreview'), val = $('misValidation'), start = $('misStart');
  if (!meta || !prev) return { ok: false };
  const vals = {};
  let firstBad = null;
  if (meta.vars) {
    for (const name of Object.keys(meta.vars)) {
      const inp = document.querySelector('#misVariables input[data-var="' + name + '"]');
      const raw = inp ? String(inp.value || '') : '';
      const v = (typeof MusePlaybook !== 'undefined' && MusePlaybook) ? MusePlaybook.validateValue(raw) : { ok: false, code: 'no-module' };
      if (!v.ok) { firstBad = firstBad || inp; vals[name] = ''; continue; }
      // the popup screens with the SAME keyword list the user sees; the engine re-screens with
      // its full keyword + connector screens on load and before every send (fail closed).
      const low = v.value.toLowerCase();
      const kws = (v18.rules && Array.isArray(v18.rules.keywords)) ? v18.rules.keywords : [];
      if (kws.some((k) => k && low.includes(String(k).toLowerCase()))) { firstBad = firstBad || inp; vals[name] = ''; continue; }
      vals[name] = v.value;
    }
  }
  // preview = the playbook's FIRST step rendered with the current values
  const rawFirst = meta.firstRaw || '';
  let okAll = true, rendered = '';
  if (meta.vars) {
    if (typeof MusePlaybook === 'undefined' || !MusePlaybook) { okAll = false; }
    else {
      const r = MusePlaybook.render(rawFirst, vals);
      okAll = r.ok; rendered = r.ok ? r.text : '';
    }
  } else { rendered = rawFirst; }
  if (prev) prev.textContent = okAll ? rendered : (rendered || rawFirst);
  if (val) val.textContent = okAll ? '' : t('missionValueInvalid', 'Enter a valid value; unresolved or unsafe values cannot be sent.');
  if (start) start.disabled = !okAll;
  if (!okAll && firstBad) firstBad.setAttribute('aria-invalid', 'true');
  return { ok: okAll, vals, firstBad };
}
function misOpenConfig(id) {
  const meta = misMetaOf(id);
  if (!meta || !meta.vars) return false;
  misConfigId = id;
  const box = $('misVariables');
  if (box) {
    box.innerHTML = Object.keys(meta.vars).map((name) =>
      '<div class="row"><label class="muted" for="misVar_' + esc(name) + '">' + esc(name) + '</label>' +
      '<input type="text" id="misVar_' + esc(name) + '" data-var="' + esc(name) + '" autocomplete="off" spellcheck="false" value="' + esc(meta.vars[name]) + '"></div>').join('');
  }
  const cfg = $('misConfig');
  if (cfg) cfg.hidden = false;
  const title = $('misConfigTitle');
  if (title) title.textContent = t(meta.nameKey, meta.id);
  misRenderPreview();
  const first = box && box.querySelector('input');
  if (first) first.focus({ preventScroll: true });
  return true;
}
function misCloseConfig() {
  misConfigId = '';
  const cfg = $('misConfig');
  if (cfg) cfg.hidden = true;
}
function misStartRun() {
  const r = misRenderPreview();
  if (!r || !r.ok || !misConfigId) return;
  try {
    // ONE atomic write: enabling the mission + storing the validated run snapshot together.
    chrome.storage.local.set({ missionEnabled: true, mission: { id: misConfigId, step: 0, cycles: 0, startedAt: Date.now(), lastSentAt: 0, values: r.vals, playbookVersion: 1 } });
    misCloseConfig();
  } catch { /* ignore */ }
}
if (typeof document !== 'undefined') {
  const cfgBox = $('misVariables');
  if (cfgBox) cfgBox.addEventListener('input', () => { misRenderPreview(); });
  const bStart = $('misStart');
  if (bStart) bStart.addEventListener('click', misStartRun);
  const bCancel = $('misCancel');
  if (bCancel) bCancel.addEventListener('click', misCloseConfig);
}
"""
t = t.replace(b4, logic + b4, 1)

# the click handler: playbooks WITH vars open the config instead of starting immediately
b5 = """$('misList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-mid]');"""
assert b5 in t, 'b5'
t = t.replace(b5, """$('misList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-mid]');
  // v1.21.0 (G02): a playbook that declares variables opens the configuration + preview first
  if (b) { const mm = misMetaOf(b.dataset.mid); if (mm && mm.vars && misOpenConfig(mm.id)) return; }""", 1)
io.open(p2, 'w', encoding='utf-8').write(t)
print('popup.js: config UI + meta + reason map')
