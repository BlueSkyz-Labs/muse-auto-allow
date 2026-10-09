// Muse Auto-Allow — service worker.
// 1) Nudges muse.ai tabs once a minute so approvals are handled even when a tab is
//    throttled or otherwise quiet.
// 2) Proactively sweeps a muse.ai tab the moment it finishes loading (tab detection).
// 3) Keeps the toolbar badge showing today's click count.
const MUSE_URL_RE = /^https:\/\/([a-z0-9-]+\.)*muse\.ai(?=[:/])/i;

function ensureAlarm() {
  chrome.alarms.get('muse-sweep', (a) => {
    if (!a) chrome.alarms.create('muse-sweep', { periodInMinutes: 1 });
  });
}
chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);
ensureAlarm();

function nudge(tabId) {
  if (tabId == null) return;
  try { chrome.tabs.sendMessage(tabId, { type: 'sweep' }, () => void chrome.runtime.lastError); } catch { /* no receiver */ }
}

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name !== 'muse-sweep') return;
  chrome.tabs.query({ url: ['https://muse.ai/*', 'https://*.muse.ai/*'] }, (tabs) => {
    for (const t of tabs) nudge(t.id);
  });
});

// Proactive detection: as soon as a muse.ai page finishes loading, sweep it.
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info && info.status === 'complete' && tab && tab.url && MUSE_URL_RE.test(tab.url)) nudge(tabId);
});

// Badge = today's click count (cleared when zero).
function updateBadge() {
  try {
    chrome.storage.local.get({ stats: null }, (s) => {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const day = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      const n = (s.stats && s.stats.byDay && s.stats.byDay[day]) || 0;
      chrome.action.setBadgeText({ text: n === 0 ? '' : (n > 999 ? '999+' : String(n)) });
      chrome.action.setBadgeBackgroundColor({ color: '#2f6df6' });
    });
  } catch { /* ignore */ }
}
chrome.storage.onChanged.addListener((ch) => { if (ch.stats || ch.clickCount) updateBadge(); });
chrome.runtime.onInstalled.addListener(updateBadge);
chrome.runtime.onStartup.addListener(updateBadge);
updateBadge();
