const $ = (id) => document.getElementById(id);

function t(key, fallback) {
  try { return chrome.i18n.getMessage(key) || fallback; } catch { return fallback; }
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
    ? log.slice(0, 12).map((e) => {
        const k = e.kind || 'allow';
        return '<div class="item"><span class="t">' + esc((e.at || '').slice(11, 19)) + '</span>' +
          '<span class="k k-' + esc(k) + '">' + esc(kindLabel(k)) + '</span>' +
          '<b>' + esc((e.label || '').slice(0, 40)) + '</b>' +
          '<div class="c">' + esc((e.context || '').slice(0, 170)) + '</div></div>';
      }).join('')
    : '<div class="empty">' + esc(t('noClicks', 'No clicks yet')) + '</div>';
}

let lastCount = null;

function refresh() {
  chrome.storage.local.get({ enabled: true, minDelayMs: 300, clickCount: 0, log: [] }, (s) => {
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
    $('dot').classList.toggle('off', s.enabled === false);
    renderLog(Array.isArray(s.log) ? s.log : []);
  });
}

applyI18n();
refresh();

$('enabled').addEventListener('change', () => chrome.storage.local.set({ enabled: $('enabled').checked }));
$('delay').addEventListener('change', () => {
  const v = Math.max(0, Math.min(10000, Number($('delay').value) || 0));
  $('delay').value = v;
  chrome.storage.local.set({ minDelayMs: v });
});
chrome.storage.onChanged.addListener(refresh);
