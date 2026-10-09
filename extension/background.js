// Muse Auto-Allow — service worker.
// 1) Nudges muse.ai tabs once a minute so approvals are handled even when a tab is
//    throttled or otherwise quiet.
// 2) Proactively sweeps a muse.ai tab the moment it finishes loading (tab detection).
// 3) Keeps the toolbar badge showing today's click count.
const MUSE_URL_RE = /^https:\/\/([a-z0-9-]+\.)*muse\.ai(?=[:/])/i;

// Surface worker errors in the console instead of silent promise deaths (debuggability;
// local logging only — nothing is transmitted).
self.addEventListener('unhandledrejection', (e) => {
  try { console.warn('[Muse Auto-Allow] unhandled rejection:', e && e.reason && (e.reason.message || e.reason)); } catch { /* ignore */ }
});

function ensureAlarm() {
  chrome.alarms.get('muse-sweep', (a) => {
    if (!a) chrome.alarms.create('muse-sweep', { periodInMinutes: 1 });
  });
}
chrome.runtime.onStartup.addListener(ensureAlarm);
ensureAlarm();

// --- Upgrade-safe migrations (versioned, idempotent, never destructive) ---
// The stamp lives in chrome.storage.local.schemaVersion, kept in lockstep with the
// content script's flush write. Steps run only when the stored version is older and
// PRESERVE every existing value (data inheritance — nothing is dropped on upgrade).
const SCHEMA_VERSION = 2;
async function migrate() {
  try {
    const raw = await chrome.storage.local.get(['schemaVersion', 'enabled', 'minDelayMs']);
    const from = Number(raw.schemaVersion) || 0;
    if (from >= SCHEMA_VERSION) return;
    const seed = {};
    if (!('enabled' in raw)) seed.enabled = true;      // absent only — `false` is a valid choice
    if (!('minDelayMs' in raw)) seed.minDelayMs = 300;
    // v0 -> v2: log/counter/aggregate shapes are read defensively everywhere; there is
    // nothing to transform. Future steps: add one `if (from < N)` block per version.
    seed.schemaVersion = SCHEMA_VERSION;
    await chrome.storage.local.set(seed);
  } catch { /* migrations must never block the worker */ }
}

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
chrome.runtime.onInstalled.addListener(({ reason } = {}) => {
  ensureAlarm();
  migrate();
  if (reason !== 'chrome_update') updateBadge();
});
chrome.runtime.onStartup.addListener(updateBadge);
updateBadge();
