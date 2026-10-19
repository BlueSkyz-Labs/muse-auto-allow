# W5 ráp stats: nút audit + khối tuần + decrypt
import io
p = 'extension/stats.html'
s = io.open(p, encoding='utf-8').read()
a1 = """      <button class="tool" id="importData" data-i18n="importData">Import data</button>
      <button class="tool primary" id="exportData" data-i18n="exportData">Export data</button>"""
assert a1 in s, 'a1'
s = s.replace(a1, a1 + """
      <button class="tool" id="auditJson" data-i18n="auditExportJson">Export audit JSON</button>
      <button class="tool" id="auditCsv" data-i18n="auditExportCsv">Export audit CSV</button>""", 1)
# khối tuần: chèn trước footrow
a2 = """  <div class="footrow">"""
assert a2 in s, 'a2'
s = s.replace(a2, """  <div class="card" id="auditWeek" hidden>
    <div class="rlabel" data-i18n="auditWeeklyTitle">This week</div>
    <div class="wk" id="auditWeekBody"></div>
  </div>
  <div class="footrow">""", 1)
a3 = '  <script src="stats.js"></script>'
assert a3 in s, 'a3'
s = s.replace(a3, '  <script src="audit.js"></script>\n  ' + a3, 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('stats.html done')

p = 'extension/stats.js'
s = io.open(p, encoding='utf-8').read()
a4 = """function renderAll() {
  renderKpis();
  renderChart();
  renderTopics();
}"""
assert a4 in s, 'a4'
s = s.replace(a4, """function renderAll() {
  renderKpis();
  renderChart();
  renderTopics();
  renderAuditWeek(); // v1.22.0 (W5/F2)
}

// ---- v1.22.0 (W5/F2): xuất audit + tóm tắt tuần — KHÔNG lộ trường cấm ----------------------
// Log trong storage chỉ chứa ctx (đã mã hoá, không plaintext — CX-03): giải mã bằng
// cryptKeyRaw trước khi xuất. Không chạm license/token; tệp chỉ có allowlist trường.
async function decAuditLog() {
  const s = await chrome.storage.local.get({ log: [], cryptKeyRaw: null });
  const raw = (typeof s.cryptKeyRaw === 'string') ? s.cryptKeyRaw : null;
  const b = (x) => Uint8Array.from(atob(x), (c) => c.charCodeAt(0));
  let key = null;
  if (raw) { try { key = await crypto.subtle.importKey('raw', b(raw), 'AES-GCM', false, ['decrypt']); } catch { key = null; } }
  const out = [];
  for (const e of (Array.isArray(s.log) ? s.log : [])) {
    if (!e || typeof e !== 'object') continue;
    const row = {};
    if (typeof e.at === 'string') row.at = e.at;
    if (typeof e.kind === 'string') row.kind = e.kind;
    if (typeof e.label === 'string') row.label = e.label;
    if (e.ctx && e.ctx.iv && e.ctx.ct && key) {
      try {
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b(e.ctx.iv) }, key, b(e.ctx.ct));
        row.context = new TextDecoder().decode(pt);
      } catch { /* không giải mã được -> bỏ context (an toàn) */ }
    }
    if (typeof e.blockedReason === 'string') row.blockedReason = e.blockedReason;
    if (e.standing === true) row.standing = true;
    if (e.dryRun === true) row.dryRun = true;
    out.push(row);
  }
  return out;
}
function auditDownload(text, name, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
async function auditExport(kind) {
  try {
    if (typeof MuseAudit === 'undefined' || !MuseAudit) return;
    const log = await decAuditLog();
    const today = new Date().toISOString().slice(0, 10);
    if (kind === 'csv') {
      auditDownload(MuseAudit.buildCsv(log), 'muse-auto-allow-audit-' + today + '.csv', 'text/csv');
      return;
    }
    const s = await chrome.storage.local.get({ stats: null, digestCounters: null, rules: null });
    const built = MuseAudit.buildJson({
      version: chrome.runtime.getManifest().version,
      generatedAt: new Date().toISOString(),
      rules: s.rules || {},
      counters: s.digestCounters || {},
      byDay: (s.stats && s.stats.byDay) || null,
      log,
    });
    if (built && built.ok && built.json) auditDownload(built.json, built.filename || ('muse-auto-allow-audit-' + today + '.json'), 'application/json');
  } catch { /* ignore */ }
}
async function renderAuditWeek() {
  const el = $('auditWeek');
  const body = $('auditWeekBody');
  if (!el || !body || typeof MuseAudit === 'undefined' || !MuseAudit) return;
  try {
    const s = await chrome.storage.local.get({ stats: null, digestCounters: null });
    const w = MuseAudit.weeklySummary(s.digestCounters || {}, (s.stats && s.stats.byDay) || null, new Date());
    el.hidden = false;
    const n = (Number(w.week) || 0) + (Number(w.blocked) || 0) + (Number(w.asked) || 0);
    if (!n) { body.innerHTML = '<div class="rempty">' + t('auditNoData', 'No data yet') + '</div>'; return; }
    body.innerHTML =
      '<span>' + t('auditWeekClicks', 'clicks') + ': <b>' + (Number(w.week) || 0) + '</b></span> ' +
      '<span>' + t('auditWeekBlocked', 'blocked') + ': <b>' + (Number(w.blocked) || 0) + '</b></span> ' +
      '<span>' + t('auditWeekAsked', 'asks') + ': <b>' + (Number(w.asked) || 0) + '</b></span> ' +
      '<span>' + t('auditWeekFollowups', 'follow-ups') + ': <b>' + (Number(w.followups) || 0) + '</b></span>';
  } catch { /* ignore */ }
}
$('auditJson').addEventListener('click', () => { auditExport('json'); });
$('auditCsv').addEventListener('click', () => { auditExport('csv'); });""", 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('stats.js done')
