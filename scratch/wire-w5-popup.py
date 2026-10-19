# W5 ráp popup.js: kind map + digest asked + layers UI
import io
p = 'extension/popup.js'
s = io.open(p, encoding='utf-8').read()

# 1) KIND_KEY + ask
a1 = "  mission: 'kindMission', 'mission-dry': 'kindMissionDry',"
assert a1 in s, 'a1'
s = s.replace(a1, "  mission: 'kindMission', 'mission-dry': 'kindMissionDry',\n  ask: 'kindAsk', // v1.22.0 (W5/F1): chip trung tính cho \"để người dùng tự xử lý\"", 1)

# 2) digest asked
a2 = "  const clicks = Number(c.clicks) || 0, fups = Number(c.followups) || 0, blocked = Number(c.blocked) || 0;"
assert a2 in s, 'a2'
s = s.replace(a2, "  const clicks = Number(c.clicks) || 0, fups = Number(c.followups) || 0, blocked = Number(c.blocked) || 0, asked = Number(c.asked) || 0; // v1.22.0 (W5): + asked", 1)
a2b = "  const n = clicks + fups + blocked;"
assert a2b in s, 'a2b'
s = s.replace(a2b, "  const n = clicks + fups + blocked + asked;", 1)
a3 = "    putEl('dClicks', clicks); putEl('dFollowups', fups); putEl('dBlocked', blocked);"
assert a3 in s, 'a3'
s = s.replace(a3, "    putEl('dClicks', clicks); putEl('dFollowups', fups); putEl('dBlocked', blocked); putEl('dAsked', asked);", 1)

# 3) applyV18UI: đọc rules.layers
a4 = "  v18.rules.keywords = hasKw ? cleanList(rules.blockKeywords) : SEED_BLOCK.slice();"
assert a4 in s, 'a4'
s = s.replace(a4, a4 + """
  const rawLayers = Array.isArray(rules.layers) ? rules.layers : [];
  const lay = (typeof MuseRules !== 'undefined' && MuseRules) ? MuseRules.sanitize(rawLayers) : null;
  v18.rules.layers = lay && lay.ok ? lay.layers : []; // v1.22.0 (W5/F1)""", 1)

# 4) writeRules: merge layers (không xoá)
a5 = "  try { chrome.storage.local.set({ rules: { allowTopics: v18.rules.topics.slice(), blockKeywords: v18.rules.keywords.slice() } }); } catch { /* ignore */ }"
assert a5 in s, 'a5'
s = s.replace(a5, "  try { chrome.storage.local.set({ rules: { allowTopics: v18.rules.topics.slice(), blockKeywords: v18.rules.keywords.slice(), ...(Array.isArray(v18.rules.layers) && v18.rules.layers.length ? { layers: v18.rules.layers } : {}) } }); } catch { /* ignore */ } // v1.22.0 (W5): layers survive the legacy editor", 1)

# 5) renderRules + writeRules + layers UI (chèn trước 'function addRule')
a6 = "function addRule(kind) {"
assert a6 in s, 'a6'
ui = """// ---- v1.22.0 (W5/F1): layered rules (allow/ask/block) — CHỈ thu hẹp ----------------------
function layerDesc(r) {
  const tps = (r.match && Array.isArray(r.match.topics)) ? r.match.topics : [];
  const kws = (r.match && Array.isArray(r.match.keywords)) ? r.match.keywords : [];
  const parts = [];
  if (tps.length) parts.push(t('ruleTopics', 'topics') + ': ' + tps.join(', '));
  if (kws.length) parts.push(t('ruleKeywords', 'keywords') + ': ' + kws.join(', '));
  return parts.join(' · ') || t('ruleInvalid', 'invalid');
}
function renderLayers() {
  const box = $('layersList');
  if (!box) return;
  const layers = Array.isArray(v18.rules.layers) ? v18.rules.layers : [];
  const ignored = v18.yoloMode === true;
  box.innerHTML = layers.length
    ? layers.map((r, i) =>
      '<div class="lrow" data-lid="' + esc(r.id) + '">' +
      '<span class="lkind ' + esc(r.kind) + '">' + esc(r.kind) + '</span>' +
      '<span class="ltxt" title="' + esc(layerDesc(r)) + '">' + esc(layerDesc(r)) + '</span>' +
      '<input type="checkbox" data-act="en"' + (r.enabled !== false ? ' checked' : '') + (ignored ? ' disabled' : '') + ' aria-label="' + esc(t('ruleEnabled', 'enabled')) + '">' +
      '<button type="button" data-act="up" aria-label="' + esc(t('ruleMoveUp', 'Move up')) + '">&#8593;</button>' +
      '<button type="button" data-act="dn" aria-label="' + esc(t('ruleMoveDown', 'Move down')) + '">&#8595;</button>' +
      '<button type="button" data-act="del" class="lx" aria-label="' + esc(t('rulesRemove', 'Remove')) + '">&#10005;</button>' +
      (ignored ? '<span class="ltxt" style="flex:none;color:var(--amber)">YOLO</span>' : '') +
      '</div>').join('')
    : '<div class="rempty">' + esc(t('ruleId', 'No layered rules yet')) + '</div>';
}
function writeLayers(layers) {
  const san = (typeof MuseRules !== 'undefined' && MuseRules) ? MuseRules.sanitize(layers) : { ok: false, layers: [] };
  v18.rules.layers = san.ok ? san.layers : [];
  try {
    chrome.storage.local.set({ rules: { allowTopics: v18.rules.topics.slice(), blockKeywords: v18.rules.keywords.slice(), layers: v18.rules.layers.slice() } });
  } catch { /* ignore */ }
  renderLayers();
}
function layersNote(text) { const el = $('layerNote'); if (el) el.textContent = text || ''; }
function layersFromInputs() {
  const split = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
  const kindEl = $('layerKind');
  const kind = kindEl ? String(kindEl.value || 'block') : 'block';
  const topics = split($('layerTopics') && $('layerTopics').value);
  const keywords = split($('layerKeywords') && $('layerKeywords').value);
  if (!topics.length && !keywords.length) return null;
  const base = kind + '-' + (topics.join('+') || 'kw').slice(0, 12) + '-' + Date.now().toString(36).slice(-4);
  const id = base.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 32);
  return { id, kind, match: Object.assign({}, topics.length ? { topics } : {}, keywords.length ? { keywords } : {}) };
}
function addLayerFromInputs() {
  const rule = layersFromInputs();
  if (!rule) { layersNote(t('ruleInvalid', 'Enter a valid value; unresolved or unsafe values cannot be checked.')); return; }
  const layers = (v18.rules.layers || []).slice(); layers.push(rule);
  const test = (typeof MuseRules !== 'undefined' && MuseRules) ? MuseRules.sanitize(layers) : { ok: false };
  if (!test.ok || test.layers.length !== layers.length) { layersNote(t('ruleInvalid', 'Invalid rule rejected.')); return; }
  writeLayers(layers); layersNote('');
  if ($('layerTopics')) $('layerTopics').value = '';
  if ($('layerKeywords')) $('layerKeywords').value = '';
}
function layerExportJson() {
  try {
    const blob = new Blob([JSON.stringify({ app: 'muse-auto-allow', kind: 'rules', schemaVersion: 1, layers: v18.rules.layers || [] }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'muse-auto-allow-rules-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch { /* ignore */ }
}
let pendingLayers = null; // chỉ áp sau khi người dùng bấm Apply (validate + preview trước)
function layerImportCheck() {
  const ta = $('layerImport');
  const raw = ta ? String(ta.value || '') : '';
  let parsed = null;
  try { const j = JSON.parse(raw); parsed = Array.isArray(j) ? j : (j && Array.isArray(j.layers) ? j.layers : null); } catch { parsed = null; }
  const san = (parsed && typeof MuseRules !== 'undefined' && MuseRules) ? MuseRules.sanitize(parsed) : { ok: false, layers: [] };
  const apply = $('layerImportApply');
  if (san.ok) {
    pendingLayers = san.layers;
    if (apply) apply.disabled = false;
    layersNote(t('ruleImportPreview', 'Valid') + ': ' + san.layers.length + ' ✓');
  } else {
    pendingLayers = null;
    if (apply) apply.disabled = true;
    layersNote(t('ruleInvalid', 'Invalid JSON — nothing was changed.'));
  }
}
function addRule(kind) {"""
s = s.replace(a6, ui, 1)

# 6) gọi renderLayers trong renderRules + listener delegation
a7 = "  const kl = $('kwList');"
assert a7 in s, 'a7'
s = s.replace(a7, "  renderLayers(); // v1.22.0 (W5)\n  const kl = $('kwList');", 1)

a8 = "$('langBtn').addEventListener('click', (e) => { e.stopPropagation(); if (langOpen) closeLangMenu(true); else openLangMenu(true); });"
assert a8 in s, 'a8'
listeners = """// ---- v1.22.0 (W5/F1): layers UI listeners -------------------------------------------------
(function () {
  const addBtn = $('layerAdd'); if (addBtn) addBtn.addEventListener('click', addLayerFromInputs);
  const exp = $('layerExport'); if (exp) exp.addEventListener('click', layerExportJson);
  const io = $('layerImportOpen');
  if (io) io.addEventListener('click', () => { const b = $('layerImportBox'); if (b) b.hidden = !b.hidden; });
  const chk = $('layerImportCheck'); if (chk) chk.addEventListener('click', layerImportCheck);
  const app = $('layerImportApply');
  if (app) app.addEventListener('click', () => {
    if (!pendingLayers) return;
    writeLayers(pendingLayers);
    pendingLayers = null; app.disabled = true;
    layersNote(t('ruleApplyImport', 'Applied') + ' ✓');
  });
  const box = $('layersList');
  if (box) box.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (!btn || btn.tagName === 'INPUT') return;
    const row = btn.closest('[data-lid]'); if (!row) return;
    const id = row.dataset.lid;
    const layers = (v18.rules.layers || []).slice();
    const idx = layers.findIndex((r) => r.id === id); if (idx < 0) return;
    const act = btn.dataset.act;
    if (act === 'del') layers.splice(idx, 1);
    else if (act === 'up' && idx > 0) { const x = layers[idx - 1]; layers[idx - 1] = layers[idx]; layers[idx] = x; }
    else if (act === 'dn' && idx < layers.length - 1) { const x = layers[idx + 1]; layers[idx + 1] = layers[idx]; layers[idx] = x; }
    if (act === 'del' || act === 'up' || act === 'dn') writeLayers(layers);
  });
  if (box) box.addEventListener('change', (e) => {
    const cb = e.target;
    if (!cb || cb.dataset.act !== 'en') return;
    const row = cb.closest('[data-lid]'); if (!row) return;
    const id = row.dataset.lid;
    const layers = (v18.rules.layers || []).map((r) => r.id === id ? Object.assign({}, r, { enabled: cb.checked }) : r);
    writeLayers(layers);
  });
})();
""" + a8
s = s.replace(a8, listeners, 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('popup.js W5 done')
