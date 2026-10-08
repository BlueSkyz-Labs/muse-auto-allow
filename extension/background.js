// Muse Auto-Allow — service worker.
// Nudges muse.ai tabs once a minute so approvals are handled even when a tab is
// throttled or otherwise quiet.
function ensureAlarm() {
  chrome.alarms.get('muse-sweep', (a) => {
    if (!a) chrome.alarms.create('muse-sweep', { periodInMinutes: 1 });
  });
}
chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);
ensureAlarm();

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name !== 'muse-sweep') return;
  chrome.tabs.query({ url: ['https://muse.ai/*', 'https://*.muse.ai/*'] }, (tabs) => {
    for (const t of tabs) {
      if (t.id != null) {
        try { chrome.tabs.sendMessage(t.id, { type: 'sweep' }, () => void chrome.runtime.lastError); } catch { /* no receiver */ }
      }
    }
  });
});
