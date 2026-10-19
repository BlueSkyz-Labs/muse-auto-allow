# UX Vòng 3A — bug thật: dot ngược, chip arm, checkbox vô hình, target 24, addRule split, audit rules[], export/import đầy đủ
import io
base = r'C:\Users\thinh\dev\muse-auto-allow'

# ============ popup.js ============
p = base + r'\extension\popup.js'
s = io.open(p, encoding='utf-8').read()

# 1) renderSafetyStatus: dot + text đúng ngữ nghĩa (xanh=live, vàng=dry/paused/yolo)
a = """  const dry = v18.dryRun === true, yolo = v18.yoloMode === true, paused = pausedNow();
  const parts = [paused ? t('pauseLabel', 'Paused') : t('stateLive', 'Live')];
  if (dry) parts.push(t('dryRunChip', 'Dry-run'));
  if (yolo) parts.push(t('yoloChip', 'YOLO'));
  el.textContent = parts.join(' · ');
  const dot = $('ssDot'); if (dot) dot.classList.toggle('warn', yolo || (!dry && !paused));"""
assert a in s, 'status anchor'
s = s.replace(a, """  const dry = v18.dryRun === true, yolo = v18.yoloMode === true, paused = pausedNow();
  // v1.22.2 UX (Vòng 3): the dot was INVERTED (yellow while live) and dry-run read as
  // "running — Allow only · Dry-run". One truth: live=x=dry/paused/yolo get the warning tint.
  const parts = [];
  if (paused) parts.push(t('pauseLabel', 'Paused'));
  else if (dry) parts.push(t('dryRunBanner', 'Logging only — nothing will be clicked'));
  else parts.push(t('stateLive', 'Live'));
  if (dry && !paused) parts.push(t('dryRunChip', 'Dry-run'));
  if (yolo) parts.push(t('yoloChip', 'YOLO'));
  el.textContent = parts.join(' · ');
  const dot = $('ssDot'); if (dot) dot.classList.toggle('warn', yolo || dry || paused);""", 1)

# 2) stateLine: màu theo chế độ (thấy bằng màu, không cần đọc chữ)
a2 = "  renderYoloNote();\n  renderLogTop();\n  renderSafetyStatus(); // v1.22.1 UX (Vòng 1)"
assert a2 in s, 'dry anchor'
s = s.replace(a2, """  renderYoloNote();
  renderLogTop();
  renderSafetyStatus(); // v1.22.1 UX (Vòng 1)
  try {
    const sl = $('stateLine');
    if (sl) { sl.classList.toggle('mode-dry', v18.dryRun === true); sl.classList.toggle('mode-live', v18.dryRun !== true && !pausedNow()); }
  } catch { /* ignore */ }""", 1)

# 3) addRule: tách dấu phẩy (bug: 'billing, payment' thành 1 entry không bao giờ khớp)
a3 = """  const v = String(inp.value || '').trim();
  if (!v) { inp.focus(); return; }
  inp.value = '';
  if (kind === 'topic') writeRules(v18.rules.topics.concat([v]), v18.rules.keywords);
  else writeRules(v18.rules.topics, v18.rules.keywords.concat([v]));
  inp.focus();"""
assert a3 in s, 'addRule anchor'
s = s.replace(a3, """  const v = String(inp.value || '').trim();
  if (!v) { inp.focus(); return; }
  // v1.22.2 UX (Vòng 3): comma-separated quick-add used to store ONE bogus entry
  // ('billing, payment') that could never match — split it like the layered form does.
  const parts = v.split(',').map((x) => x.trim()).filter(Boolean);
  inp.value = '';
  const cur = kind === 'topic' ? v18.rules.topics : v18.rules.keywords;
  const room = Math.max(0, RULES_MAX_ITEMS - cur.length);
  const add = parts.slice(0, room);
  if (!add.length) { inp.focus(); return; }
  if (kind === 'topic') writeRules(v18.rules.topics.concat(add), v18.rules.keywords);
  else writeRules(v18.rules.topics, v18.rules.keywords.concat(add));
  inp.focus();""", 1)

# 4) chip ✕ topic/keyword: arm → confirm
a4 = """$('topicsList').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) removeRule(b.dataset.k, Number(b.dataset.i)); });
$('kwList').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) removeRule(b.dataset.k, Number(b.dataset.i)); });"""
assert a4 in s, 'chip listeners'
s = s.replace(a4, """// v1.22.2 UX (Vòng 3): a one-tap ✕ on a guard chip could silently remove a safety rule.
// Arm on the first tap (5 s), remove on the second — same pattern as the keyword reset.
function chipArm(b) {
  if (b.dataset.armed === '1') return true;
  b.dataset.armed = '1';
  b.classList.add('arm');
  b.textContent = '?';
  b.title = t('ruleConfirmDelete', 'Tap again to delete');
  setTimeout(() => { if (b.dataset.armed === '1') { b.dataset.armed = ''; b.classList.remove('arm'); b.innerHTML = '&#10005;'; b.removeAttribute('title'); } }, 5000);
  return false;
}
$('topicsList').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b && chipArm(b)) removeRule(b.dataset.k, Number(b.dataset.i)); });
$('kwList').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b && chipArm(b)) removeRule(b.dataset.k, Number(b.dataset.i)); });""", 1)

# 5) export rules: đầy đủ allowTopics + blockKeywords + layers (schemaVersion 2)
a5 = "    const blob = new Blob([JSON.stringify({ app: 'muse-auto-allow', kind: 'rules', schemaVersion: 1, layers: v18.rules.layers || [] }, null, 2)], { type: 'application/json' });"
assert a5 in s, 'export anchor'
s = s.replace(a5, "    // v1.22.2 UX (Vòng 3): the file now round-trips ALL rules (chips + layers), schemaVersion 2.\n    const blob = new Blob([JSON.stringify({ app: 'muse-auto-allow', kind: 'rules', schemaVersion: 2, allowTopics: v18.rules.topics || [], blockKeywords: v18.rules.keywords || [], layers: v18.rules.layers || [] }, null, 2)], { type: 'application/json' });", 1)

# 6) import: nhận cả allowTopics/blockKeywords + preview đếm + apply ghi cả 3
a6 = """  let parsed = null;
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
  }"""
assert a6 in s, 'import anchor'
s = s.replace(a6, """  let parsed = null, extra = null;
  try {
    const j = JSON.parse(raw);
    if (Array.isArray(j)) parsed = j;
    else if (j && typeof j === 'object') {
      parsed = Array.isArray(j.layers) ? j.layers : [];
      if (Array.isArray(j.allowTopics) || Array.isArray(j.blockKeywords)) {
        extra = { topics: cleanList(j.allowTopics), keywords: cleanList(j.blockKeywords) };
      }
    }
  } catch { parsed = null; }
  const san = (parsed && typeof MuseRules !== 'undefined' && MuseRules) ? MuseRules.sanitize(parsed) : { ok: false, layers: [] };
  const apply = $('layerImportApply');
  if (san.ok && (parsed || extra)) {
    pendingLayers = san.layers;
    pendingExtra = extra; // v1.22.2 UX (Vòng 3): optional chip lists from a schemaVersion-2 file
    if (apply) apply.disabled = false;
    const counts = [san.layers.length + ' rules'];
    if (extra) counts.push((extra.topics || []).length + ' topics', (extra.keywords || []).length + ' keywords');
    layersNote(t('ruleImportPreview', 'Valid') + ': ' + counts.join(' · ') + ' ✓');
  } else {
    pendingLayers = null; pendingExtra = null;
    if (apply) apply.disabled = true;
    layersNote(t('ruleInvalid', 'Invalid JSON — nothing was changed.'));
  }""", 1)

# 7) pendingExtra + apply ghi cả 3
a7 = "let pendingLayers = null; // chỉ áp sau khi người dùng bấm Apply (validate + preview trước)"
assert a7 in s
s = s.replace(a7, "let pendingLayers = null; // chỉ áp sau khi người dùng bấm Apply (validate + preview trước)\nlet pendingExtra = null; // {topics?, keywords?} từ file schemaVersion 2", 1)
a8 = """    writeLayers(pendingLayers);
    pendingLayers = null; app.disabled = true; app.dataset.armed = '';"""
assert a8 in s
s = s.replace(a8, """    if (pendingExtra) {
      const tp = pendingExtra.topics ? pendingExtra.topics : v18.rules.topics;
      const kw = pendingExtra.keywords ? pendingExtra.keywords : v18.rules.keywords;
      v18.rules.topics = cleanList(tp); v18.rules.keywords = cleanList(kw);
      v18.rules.keywordsSeeded = false;
      try { chrome.storage.local.set({ rules: { allowTopics: v18.rules.topics.slice(), blockKeywords: v18.rules.keywords.slice(), layers: pendingLayers.slice() } }); } catch { /* ignore */ }
      renderRules();
      pendingExtra = null;
    } else {
      writeLayers(pendingLayers);
    }
    pendingLayers = null; app.disabled = true; app.dataset.armed = '';""", 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('popup.js 3A done')

# ============ popup.html (CSS) ============
p = base + r'\extension\popup.html'
s = io.open(p, encoding='utf-8').read()
# checkbox layers hiện hình (pattern opacity:0 toàn cục đang nuốt nó)
a9 = "  .lrow [data-act] { min-width: 24px; min-height: 24px; font: inherit; font-size: 11px;"
assert a9 in s
s = s.replace(a9, """  /* v1.22.2 UX (Vòng 3): the global input[type=checkbox]{opacity:0} pattern hid the
     enabled-toggle of every rule row (and its focus ring). */
  .lrow input[type=checkbox][data-act="en"] { opacity: 1; position: static; width: auto; height: auto; margin: 0; }
  .lrow [data-act] { min-width: 24px; min-height: 24px; font: inherit; font-size: 11px;""", 1)
# 3 nút icon còn dưới 24px
a10 = "  .ovclose {"
assert a10 in s
i = s.find(a10); j = s.find('}', i)
s = s[:j] + '; min-width: 24px; min-height: 24px; ' + s[j:]
a11 = "  .froti .rm {"
assert a11 in s
i = s.find(a11); j = s.find('}', i)
s = s[:j] + '; min-width: 24px; min-height: 24px; ' + s[j:]
a12 = "  .item .kopen {"
assert a12 in s
i = s.find(a12); j = s.find('}', i)
s = s[:j] + '; min-width: 24px; min-height: 24px; ' + s[j:]
# chip arm state
a13 = "  .rchip .rx:hover { color: var(--ink); background: var(--fill); }"
assert a13 in s
s = s.replace(a13, a13 + """
  .rchip .rx.arm { color: #a51e35; border: 1px solid rgba(194,38,63,.45); border-radius: 6px; padding: 0 4px; background: rgba(194,38,63,.08); }""", 1)
# stateLine màu theo chế độ
a14 = "  .stateline { display: flex; align-items: center; gap: 4px; padding: 5px 8px 4px; font-size: 11px;"
assert a14 in s
s = s.replace(a14, """  .stateline.mode-live { background: rgba(194,38,63,.08); border-radius: 8px; }
  .stateline.mode-dry { background: rgba(214,150,20,.10); border-radius: 8px; }
  .stateline { display: flex; align-items: center; gap: 4px; padding: 5px 8px 4px; font-size: 11px;""", 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('popup.html 3A done')

# ============ stats.js: audit rules bug + status text ============
p = base + r'\extension\stats.js'
s = io.open(p, encoding='utf-8').read()
a15 = "      rules: s.rules || {},"
assert a15 in s, 'audit rules anchor'
s = s.replace(a15, "      // v1.22.2 UX (Vòng 3) — BUG FIX: projectRules() in audit.js accepts an ARRAY; passing the\n      // rules object made every exported audit carry rules:[] (rule:<id> reasons unreadable).\n      rules: (s.rules && Array.isArray(s.rules.layers)) ? s.rules.layers : [],", 1)
a16 = """    const parts = [paused ? t('pauseLabel', 'Paused') : t('stateLive', 'Live')];
    if (s.dryRun === true) parts.push(t('dryRunChip', 'Dry-run'));"""
assert a16 in s
s = s.replace(a16, """    const parts = [];
    if (paused) parts.push(t('pauseLabel', 'Paused'));
    else if (s.dryRun === true) parts.push(t('dryRunBanner', 'Logging only — nothing will be clicked'));
    else parts.push(t('stateLive', 'Live'));
    if (s.dryRun === true && !paused) parts.push(t('dryRunChip', 'Dry-run'));""", 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('stats.js 3A done')
