// Muse Auto-Allow — statistics dashboard (no libraries; inline SVG; renders instantly).
const $ = (id) => document.getElementById(id);
const t = (key, fallback) => {
  try { return chrome.i18n.getMessage(key) || fallback; } catch { return fallback; }
};
const pad2 = (n) => String(n).padStart(2, '0');
const dayKeyOf = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const monthKeyOf = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1);

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
      out.push({ label: pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1), v: STATS.byDay[dayKeyOf(d)] || 0 });
    }
  } else if (RANGE === 'week') {
    for (let i = 11; i >= 0; i--) {
      const start = weekStart(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7));
      let v = 0;
      for (let k = 0; k < 7; k++) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + k);
        v += STATS.byDay[dayKeyOf(d)] || 0;
      }
      out.push({ label: pad2(start.getDate()) + '/' + pad2(start.getMonth() + 1), v });
    }
  } else if (RANGE === 'month') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({ label: pad2(d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2), v: STATS.byMonth[monthKeyOf(d)] || 0 });
    }
  } else {
    const years = Object.keys(STATS.byYear).sort();
    if (!years.length) years.push(String(now.getFullYear()));
    for (const y of years) out.push({ label: y, v: STATS.byYear[y] || 0 });
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
  const W = 720, H = 175, padL = 8, padR = 8, padT = 26, padB = 22;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const n = data.length || 1;
  const gap = Math.max(3, Math.floor(innerW / n * 0.22));
  const bw = Math.max(4, Math.floor((innerW - gap * (n - 1)) / n));
  const max = Math.max(1, ...data.map((x) => x.v));
  let out = '';
  data.forEach((x, i) => {
    const h = x.v ? Math.max(2, Math.round(innerH * (x.v / max))) : 1;
    const xx = padL + i * (bw + gap);
    const y = padT + innerH - h;
    out += '<rect class="bar" x="' + xx + '" y="' + y + '" width="' + bw + '" height="' + h + '" rx="3" opacity="' + (x.v ? 0.9 : 0.18) + '"><title>' + x.label + ': ' + x.v + '</title></rect>';
    if (x.v) out += '<text class="val" x="' + (xx + bw / 2) + '" y="' + (y - 5) + '" text-anchor="middle">' + x.v + '</text>';
    out += '<text x="' + (xx + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + x.label + '</text>';
  });
  svg.innerHTML = out;
}

function renderTopics() {
  const wrap = $('topics');
  const entries = Object.entries(STATS.byTopic).sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (!entries.length) {
    wrap.innerHTML = '<div class="empty">' + t('noData', 'No data yet') + '</div>';
    return;
  }
  const max = entries[0][1] || 1;
  wrap.innerHTML = entries.map(([name, v]) =>
    '<div class="topic"><span class="name" title="' + name.replace(/"/g, '&quot;') + '">' + name.replace(/[<>&]/g, '') + '</span>' +
    '<span class="bar"><i style="width:' + Math.max(4, Math.round(v / max * 100)) + '%"></i></span>' +
    '<span class="n">' + v + '</span></div>').join('');
}

function renderKpis() {
  const now = new Date();
  const today = STATS.byDay[dayKeyOf(now)] || 0;
  const ws = weekStart(now);
  let week = 0;
  for (let k = 0; k < 7; k++) {
    const d = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + k);
    week += STATS.byDay[dayKeyOf(d)] || 0;
  }
  $('kTotal').textContent = TOTAL;
  $('kToday').textContent = today;
  $('kWeek').textContent = week;
  $('kMonth').textContent = STATS.byMonth[monthKeyOf(now)] || 0;
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
  if (ch.stats) { STATS = ch.stats.newValue || STATS; }
  if (ch.clickCount) { TOTAL = Number(ch.clickCount.newValue) || 0; }
  renderAll();
});
$('seg').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-range]');
  if (!b) return;
  RANGE = b.dataset.range;
  document.querySelectorAll('#seg button').forEach((x) => x.classList.toggle('active', x === b));
  renderChart();
});
