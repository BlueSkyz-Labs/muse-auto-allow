const $ = (id) => document.getElementById(id);

function t(key, fallback, subs) {
  try { return chrome.i18n.getMessage(key, subs) || fallback; } catch { return fallback; }
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const msg = t(el.dataset.i18n, el.textContent);
    if (msg) el.textContent = msg;
  });
  try { document.documentElement.lang = chrome.i18n.getUILanguage() || 'en'; } catch { /* keep */ }
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const KIND_KEY = { allow: 'kindAllow', expand: 'kindExpand', 'open-panel': 'kindOpenPanel' };
const kindLabel = (k) => t(KIND_KEY[k] || '', k);

function renderLog(log) {
  $('log').innerHTML = log.length
    ? log.slice(0, 50).map((e) => {
        const k = e.kind || 'allow';
        const ctx = String(e.context || '');
        const ctxS = ctx.length > 170 ? ctx.slice(0, 170) + '…' : ctx;
        const lbl = String(e.label || '');
        const lblS = lbl.length > 40 ? lbl.slice(0, 40) + '…' : lbl;
        return '<div class="item"><span class="t">' + esc((e.at || '').slice(11, 19)) + '</span>' +
          '<span class="k k-' + esc(k) + '">' + esc(kindLabel(k)) + '</span>' +
          '<b>' + esc(lblS) + '</b>' +
          '<div class="c">' + esc(ctxS) + '</div></div>';
      }).join('')
    : '<div class="empty">' + esc(t('noClicks', 'No clicks yet')) + '</div>';
}

let lastCount = null;

const pad2 = (n) => String(n).padStart(2, '0');
const dayKeyOf = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());

function renderMini(byDay, now) {
  const svg = $('mini');
  if (!svg) return;
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push({ key: dayKeyOf(d), v: byDay[dayKeyOf(d)] || 0 });
  }
  const W = 292, H = 46, gap = 4;
  const bw = Math.floor((W - gap * 6) / 7);
  const max = Math.max(1, ...days.map((x) => x.v));
  let out = '';
  days.forEach((x, i) => {
    const h = x.v ? Math.max(2, Math.round((H - 6) * (x.v / max))) : 1;
    out += '<rect x="' + (i * (bw + gap)) + '" y="' + (H - h) + '" width="' + bw + '" height="' + h +
      '" rx="2" fill="#2f6df6" opacity="' + (x.v ? 0.92 : 0.18) + '"><title>' + x.key + ': ' + x.v + '</title></rect>';
  });
  svg.innerHTML = out;
}

function refreshMuseStat() {
  try {
    chrome.tabs.query({ url: ['https://muse.ai/*', 'https://*.muse.ai/*'] }, (tabs) => {
      const el = $('musestat');
      if (!el) return;
      const n = tabs ? tabs.length : 0;
      el.textContent = n > 0
        ? t('museTabsFound', '$1 muse.ai tab(s) open', [String(n)])
        : t('museTabsNone', 'No muse.ai tab found');
      el.classList.toggle('on', n > 0);
      el.classList.toggle('off', n === 0);
    });
  } catch { /* ignore */ }
}

function refresh() {
  chrome.storage.local.get({ enabled: true, minDelayMs: 300, clickCount: 0, log: [], stats: null }, (s) => {
    $('enabled').checked = s.enabled !== false;
    $('delay').value = s.minDelayMs ?? 300;
    const c = $('count');
    const v = s.clickCount || 0;
    if (lastCount !== null && v !== lastCount) {
      c.classList.remove('pop');
      void c.offsetWidth; // restart the animation
      c.classList.add('pop');
      setTimeout(() => c.classList.remove('pop'), 220);
    }
    lastCount = v;
    c.textContent = v;
    const byDay = (s.stats && s.stats.byDay) || {};
    const now = new Date();
    const today = $('today');
    if (today) today.textContent = byDay[dayKeyOf(now)] || 0;
    renderMini(byDay, now);
    $('dot').classList.toggle('off', s.enabled === false);
    renderLog(Array.isArray(s.log) ? s.log : []);
  });
}

applyI18n();
refresh();
refreshMuseStat();

$('openstats').addEventListener('click', () => {
  try { chrome.tabs.create({ url: chrome.runtime.getURL('stats.html') }); } catch { /* ignore */ }
});
$('enabled').addEventListener('change', () => chrome.storage.local.set({ enabled: $('enabled').checked }));
$('delay').addEventListener('change', () => {
  const v = Math.max(0, Math.min(10000, Number($('delay').value) || 0));
  $('delay').value = v;
  chrome.storage.local.set({ minDelayMs: v });
});
chrome.storage.onChanged.addListener(refresh);
