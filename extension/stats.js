// Muse Auto-Allow — statistics dashboard (no libraries; inline SVG; renders instantly).
const $ = (id) => document.getElementById(id);
const t = (key, fallback) => {
  try { return chrome.i18n.getMessage(key) || fallback; } catch { return fallback; }
};
const pad2 = (n) => String(n).padStart(2, '0');
const dayKeyOf = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const monthKeyOf = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1);
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const msg = t(el.dataset.i18n, el.textContent);
    if (msg) el.textContent = msg;
  });
  try { document.documentElement.lang = chrome.i18n.getUILanguage() || 'en'; } catch { /* keep */ }
}

let STATS = { byDay: {}, byMonth: {}, byYear: {}, byTopic: {} };
let TOTAL = 0;
let RANGE = 'day';
// presentation only: curated data-viz palette order (colors themselves live as CSS vars in stats.html,
// so light/dark switch automatically; the values are never part of the data logic).
const PALETTE = ['blue', 'rose', 'teal', 'amber', 'violet'];

function weekStart(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - dow);
  return x;
}

function series() {
  const now = new Date();
  const out = [];
  if (RANGE === 'day') {
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      out.push({ label: pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1), v: num(STATS.byDay[dayKeyOf(d)]) });
    }
  } else if (RANGE === 'week') {
    for (let i = 11; i >= 0; i--) {
      const start = weekStart(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7));
      let v = 0;
      for (let k = 0; k < 7; k++) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + k);
        v += num(STATS.byDay[dayKeyOf(d)]);
      }
      out.push({ label: pad2(start.getDate()) + '/' + pad2(start.getMonth() + 1), v });
    }
  } else if (RANGE === 'month') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({ label: pad2(d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2), v: num(STATS.byMonth[monthKeyOf(d)]) });
    }
  } else {
    const years = Object.keys(STATS.byYear).filter((y) => /^\d{4}$/.test(y)).sort();
    if (!years.length) years.push(String(now.getFullYear()));
    for (const y of years) out.push({ label: y, v: num(STATS.byYear[y]) });
  }
  return out;
}

const CAP = {
  day: ['last14d', 'Last 14 days'],
  week: ['last12w', 'Last 12 weeks'],
  month: ['last12m', 'Last 12 months'],
  year: ['allYears', 'All years'],
};

function renderChart() {
  const svg = $('chart');
  const data = series();
  $('ccap').textContent = t(CAP[RANGE][0], CAP[RANGE][1]);
  const W = 720, H = 158, padL = 8, padR = 8, padT = 26, padB = 22;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const n = data.length || 1;
  const gap = Math.max(3, Math.floor(innerW / n * 0.22));
  const bw = Math.max(4, Math.floor((innerW - gap * (n - 1)) / n));
  const max = Math.max(1, ...data.map((x) => x.v));
  let out = '<defs>';
  for (const c of PALETTE) out += '<linearGradient id="g-' + c + '" x1="0" y1="0" x2="0" y2="1"><stop class="sc-' + c + '" offset="0"/><stop class="sc-' + c + '-b" offset="1"/></linearGradient>';
  out += '</defs>';
  out += '<line class="base" x1="' + padL + '" y1="' + (padT + innerH) + '" x2="' + (W - padR) + '" y2="' + (padT + innerH) + '"/>';
  data.forEach((x, i) => {
    const c = PALETTE[i % PALETTE.length];
    const h = x.v ? Math.max(2, Math.round(innerH * (x.v / max))) : 1;
    const xx = padL + i * (bw + gap);
    const y = padT + innerH - h;
    out += '<rect class="bar" x="' + xx + '" y="' + y + '" width="' + bw + '" height="' + h + '" rx="4" fill="url(#g-' + c + ')" opacity="' + (x.v ? 1 : 0.15) + '"><title>' + x.label + ': ' + x.v + '</title></rect>';
    if (x.v) out += '<text class="val" x="' + (xx + bw / 2) + '" y="' + (y - 5) + '" text-anchor="middle">' + x.v + '</text>';
    out += '<text x="' + (xx + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + x.label + '</text>';
  });
  svg.innerHTML = out;
}

function renderTopics() {
  const wrap = $('topics');
  const entries = Object.entries(STATS.byTopic).map(([k, v]) => [String(k), num(v)]).sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (!entries.length) {
    wrap.innerHTML = '<div class="empty">' + t('noData', 'No data yet') + '</div>';
    return;
  }
  const max = entries[0][1] || 1;
  wrap.innerHTML = entries.map(([name, v], i) => {
    const c = PALETTE[i % PALETTE.length];
    return '<div class="topic"><span class="dot t-' + c + '"></span>' +
      '<span class="name" title="' + name.replace(/"/g, '&quot;') + '">' + name.replace(/[<>&]/g, '') + '</span>' +
      '<span class="bar"><i class="t-' + c + '" style="width:' + Math.max(4, Math.round(v / max * 100)) + '%"></i></span>' +
      '<span class="n">' + v + '</span></div>';
  }).join('');
}

function renderKpis() {
  const now = new Date();
  const today = num(STATS.byDay[dayKeyOf(now)]);
  const ws = weekStart(now);
  let week = 0;
  for (let k = 0; k < 7; k++) {
    const d = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + k);
    week += num(STATS.byDay[dayKeyOf(d)]);
  }
  $('kTotal').textContent = num(TOTAL);
  $('kToday').textContent = today;
  $('kWeek').textContent = week;
  $('kMonth').textContent = num(STATS.byMonth[monthKeyOf(now)]);
}

function renderAll() {
  renderKpis();
  renderChart();
  renderTopics();
}

applyI18n();
chrome.storage.local.get({ stats: null, clickCount: 0 }, (s) => {
  if (s.stats && typeof s.stats === 'object') {
    STATS = {
      byDay: s.stats.byDay || {},
      byMonth: s.stats.byMonth || {},
      byYear: s.stats.byYear || {},
      byTopic: s.stats.byTopic || {},
    };
  }
  TOTAL = Number(s.clickCount) || 0;
  renderAll();
});
chrome.storage.onChanged.addListener((ch) => {
  if (ch.stats) {
    const nv = (ch.stats.newValue && typeof ch.stats.newValue === 'object') ? ch.stats.newValue : {};
    STATS = {
      byDay: (nv.byDay && typeof nv.byDay === 'object') ? nv.byDay : {},
      byMonth: (nv.byMonth && typeof nv.byMonth === 'object') ? nv.byMonth : {},
      byYear: (nv.byYear && typeof nv.byYear === 'object') ? nv.byYear : {},
      byTopic: (nv.byTopic && typeof nv.byTopic === 'object') ? nv.byTopic : {},
    };
  }
  if (ch.clickCount) { TOTAL = num(ch.clickCount.newValue); }
  renderAll();
});
$('seg').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-range]');
  if (!b) return;
  RANGE = b.dataset.range;
  document.querySelectorAll('#seg button').forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
  renderChart();
});

// --- v1.5.0: backup / restore (upgrade-safe data inheritance) ---
// Export bundles the full chrome.storage.local state (settings, log — including the
// encryption key so the backup stays readable, stats aggregates, counters) into one
// JSON file. Import VALIDATES and SANITIZES the file first (redteam v4 / V4-1): only
// known keys with correct types survive, sizes are capped, and a supplied key must
// actually decrypt the first encrypted entry before anything is replaced.
const sanitizeBackup = (d) => {
  const out = {}; let seen = 0;
  if (typeof d.enabled === 'boolean') { out.enabled = d.enabled; seen++; }
  if (typeof d.minDelayMs === 'number' && isFinite(d.minDelayMs)) { out.minDelayMs = Math.min(10000, Math.max(0, Math.round(d.minDelayMs))); seen++; }
  if (typeof d.clickCount === 'number' && isFinite(d.clickCount)) { out.clickCount = Math.max(0, Math.floor(d.clickCount)); seen++; }
  if (Array.isArray(d.log)) {
    out.log = d.log.filter((e) => e && typeof e === 'object' && typeof e.at === 'string').slice(0, 50).map((e) => {
      const o = { at: e.at, kind: typeof e.kind === 'string' ? e.kind.slice(0, 24) : 'allow',
                  label: typeof e.label === 'string' ? e.label.slice(0, 60) : '' };
      if (e.ctx && typeof e.ctx === 'object' && typeof e.ctx.iv === 'string' && typeof e.ctx.ct === 'string'
          && /^[A-Za-z0-9+/=]{8,64}$/.test(e.ctx.iv) && /^[A-Za-z0-9+/=]{8,4096}$/.test(e.ctx.ct)) o.ctx = { iv: e.ctx.iv, ct: e.ctx.ct };
      else if (typeof e.context === 'string') o.context = e.context.slice(0, 500);
      return o;
    });
    seen++;
  }
  if (d.stats && typeof d.stats === 'object' && !Array.isArray(d.stats)) {
    const st = {};
    for (const k of ['byDay', 'byMonth', 'byYear', 'byTopic']) {
      const b = d.stats[k];
      if (!b || typeof b !== 'object' || Array.isArray(b)) continue;
      const o = {};
      for (const kk of Object.keys(b).slice(0, 500)) {
        const v = Number(b[kk]);
        if (isFinite(v) && v > 0) o[String(kk).slice(0, 64)] = Math.min(1e9, Math.floor(v));
      }
      st[k] = o;
    }
    out.stats = st; seen++;
  }
  if (typeof d.cryptKeyRaw === 'string' && /^[A-Za-z0-9+/]{43}=$/.test(d.cryptKeyRaw)) { out.cryptKeyRaw = d.cryptKeyRaw; seen++; }
  if (!seen) return null;
  out.schemaVersion = 2;
  return out;
};
const testBackupKey = async (raw, ctx) => {
  try {
    const b = (x) => Uint8Array.from(atob(x), (c) => c.charCodeAt(0));
    const k = await crypto.subtle.importKey('raw', b(raw), 'AES-GCM', false, ['decrypt']);
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b(ctx.iv) }, k, b(ctx.ct));
    return true;
  } catch { return false; }
};
$('exportData').addEventListener('click', async () => {
  try {
    const s = await chrome.storage.local.get(null);
    const payload = { app: 'muse-auto-allow', schemaVersion: 2, exportedAt: new Date().toISOString(), data: s };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'muse-auto-allow-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch { /* ignore */ }
});
$('importData').addEventListener('click', () => { try { $('importFile').click(); } catch { /* ignore */ } });
$('importFile').addEventListener('change', async (ev) => {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (!j || j.app !== 'muse-auto-allow' || !j.data || typeof j.data !== 'object') {
      alert(t('importBad', 'Not a Muse Auto-Allow backup file.'));
    } else {
      const clean = sanitizeBackup(j.data);
      if (!clean) {
        alert(t('importBad', 'Not a Muse Auto-Allow backup file.'));
      } else {
        const first = clean.log && clean.log[0];
        const decOk = !clean.cryptKeyRaw || !(first && first.ctx) ? true : await testBackupKey(clean.cryptKeyRaw, first.ctx);
        if (!decOk) {
          alert(t('importBad', 'Not a Muse Auto-Allow backup file.'));
        } else if (confirm(t('importConfirm', 'Restore this backup? Current settings, log and statistics will be replaced.'))) {
          await chrome.storage.local.set(clean);
          renderAll();
        }
      }
    }
  } catch {
    alert(t('importBad', 'Not a Muse Auto-Allow backup file.'));
  }
  ev.target.value = '';
});
