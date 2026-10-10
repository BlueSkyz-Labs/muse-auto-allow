// Muse Auto-Allow — service worker (v1.8.0: pause badge + commands + startup digest + sync mirror).
// 1) Nudges muse.ai tabs once a minute so approvals are handled even when a tab is
//    throttled or otherwise quiet.
// 2) Proactively sweeps a muse.ai tab the moment it finishes loading (tab detection).
// 3) Keeps the toolbar badge showing today's click count. While the engine is PAUSED
//    (chrome.storage.local.pauseUntil > now) the badge shows the pause marker '||'.
// 4) Commands (manifest "commands"): toggle-pause (Alt+Shift+P) toggles pauseUntil —
//    pause for 15 minutes, or clear an active pause; send-followup (Alt+Shift+F) triggers
//    the content script's existing followup-send-now path on the ACTIVE muse.ai tab.
// 5) Startup digest (chrome.runtime.onStartup): composes {since, clicks, followups, blocked}
//    from digestCounters (incremented by the content script) and shows ONE
//    chrome.notifications notification when clicks > 0; lastDigestAt is updated when shown.
//    The notification text is hardcoded English on purpose (docs/ENGINE_V18.md).
// 6) syncSettings (chrome.storage.local, default false): when true, every local change of a
//    subset key is mirrored write-through to chrome.storage.sync; on load, sync values apply
//    ONLY to keys absent from local storage (never overwriting a local choice). See
//    docs/ENGINE_V18.md for the 8KB per-item sync quota handling.
const MUSE_URL_RE = /^https:\/\/([a-z0-9-]+\.)*muse\.ai(?=[:/])/i;

const PAUSE_TOGGLE_MS = 15 * 60 * 1000; // Alt+Shift+P: 15 minutes, or clear
const PAUSE_BADGE_TEXT = '||';
const PAUSE_BADGE_COLOR = '#8a8f98';
const BADGE_COLOR = '#2f6df6';
const PAUSE_ALARM = 'maa-pause-expiry';
const DIGEST_NOTIFICATION_ID = 'maa-digest';
const DIGEST_ICON = 'icons/icon128.png';
// The mirrored settings subset (frozen contract): syncSettings itself is deliberately NOT
// mirrored — it is a per-device opt-in. followupRotateIdx is device-local too.
const SYNC_SUBSET = ['enabled', 'minDelayMs', 'dryRun', 'allowOnceMode', 'rules',
  'followupEnabled', 'followupPrompt', 'followupPrompts', 'followupChips', 'followupSmart', 'followupSchedule'];
const SYNC_ITEM_MAX_BYTES = 8192; // chrome.storage.sync QUOTA_BYTES_PER_ITEM — BYTES (UTF-8), not code units

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
    // v1.8.0 keys (pauseUntil/dryRun/rules/followupSmart/followupSchedule/syncSettings) are
    // all read with absent=default semantics — no migration step is needed for them.
    seed.schemaVersion = SCHEMA_VERSION;
    await chrome.storage.local.set(seed);
  } catch { /* migrations must never block the worker */ }
}

function nudge(tabId) {
  if (tabId == null) return;
  try { chrome.tabs.sendMessage(tabId, { type: 'sweep' }, () => void chrome.runtime.lastError); } catch { /* no receiver */ }
}

// Badge = today's click count (cleared when zero); a paused engine shows '||' instead.
function updateBadge() {
  try {
    chrome.storage.local.get({ stats: null, pauseUntil: 0 }, (s) => {
      const pu = Number(s.pauseUntil) || 0;
      if (Date.now() < pu) {
        chrome.action.setBadgeText({ text: PAUSE_BADGE_TEXT });
        chrome.action.setBadgeBackgroundColor({ color: PAUSE_BADGE_COLOR });
        return;
      }
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const day = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      const n = (s.stats && s.stats.byDay && s.stats.byDay[day]) || 0;
      chrome.action.setBadgeText({ text: n === 0 ? '' : (n > 999 ? '999+' : String(n)) });
      chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
    });
  } catch { /* ignore */ }
}

// One-shot alarm at the moment the pause expires, so the badge flips back without waiting
// for a user interaction (the 1-minute sweep alarm is a second safety net).
function schedulePauseBadgeRefresh() {
  try {
    chrome.alarms.clear(PAUSE_ALARM, () => {
      try {
        chrome.storage.local.get({ pauseUntil: 0 }, (s) => {
          const pu = Number(s.pauseUntil) || 0;
          if (pu > Date.now()) { try { chrome.alarms.create(PAUSE_ALARM, { when: pu + 500 }); } catch { /* ignore */ } }
        });
      } catch { /* ignore */ }
    });
  } catch { /* ignore */ }
}

// Alt+Shift+P: pause = now + 15 min when not paused, otherwise clear the pause.
function togglePause() {
  try {
    chrome.storage.local.get({ pauseUntil: 0 }, (s) => {
      const pausedNow = Date.now() < (Number(s.pauseUntil) || 0);
      const next = pausedNow ? 0 : Date.now() + PAUSE_TOGGLE_MS;
      try { chrome.storage.local.set({ pauseUntil: next }); } catch { /* ignore */ }
    });
  } catch { /* ignore */ }
}

// Alt+Shift+F: trigger the content script's followup-send-now path on the ACTIVE muse.ai tab.
function sendFollowupNow() {
  try {
    chrome.tabs.query({ active: true, currentWindow: true, url: ['https://muse.ai/*', 'https://*.muse.ai/*'] }, (tabs) => {
      const t = tabs && tabs[0];
      if (!t || t.id == null) return; // no active muse.ai tab — nothing to do
      try { chrome.tabs.sendMessage(t.id, { type: 'followup-send-now' }, () => void chrome.runtime.lastError); } catch { /* no receiver */ }
    });
  } catch { /* ignore */ }
}

// --- Startup digest (contract: chrome.runtime.onStartup only) ---------------------------
// Hardcoded English by design (a single transient notification; localizing it would need
// locale keys the UI lane owns).
function composeDigestText(d) {
  const clicks = d.clicks === 1 ? '1 click' : d.clicks + ' clicks';
  const followups = d.followups === 1 ? '1 follow-up' : d.followups + ' follow-ups';
  const blocked = d.blocked === 1 ? '1 blocked' : d.blocked + ' blocked';
  return 'Since your last session: ' + clicks + ' · ' + followups + ' · ' + blocked;
}
function digestOnStartup() {
  try {
    chrome.storage.local.get({ lastDigestAt: 0, digestCounters: null }, (s) => {
      const c = (s.digestCounters && typeof s.digestCounters === 'object') ? s.digestCounters : {};
      const d = {
        since: Number(s.lastDigestAt) || 0,
        clicks: Number(c.clicks) || 0,
        followups: Number(c.followups) || 0,
        blocked: Number(c.blocked) || 0,
      };
      // observability: the composed digest object is logged (local console only)
      try { console.log('[Muse Auto-Allow] digest ' + JSON.stringify(d)); } catch { /* ignore */ }
      if (d.clicks <= 0) return; // nothing to announce; the counters keep accumulating
      try {
        chrome.notifications.create(DIGEST_NOTIFICATION_ID, {
          type: 'basic',
          iconUrl: DIGEST_ICON,
          title: 'Muse Auto-Allow',
          message: composeDigestText(d),
        }, () => {
          try { if (chrome.runtime.lastError) return; } catch { /* ignore */ }
          // shown => remember when, and reset the counters for the next digest
          try { chrome.storage.local.set({ lastDigestAt: Date.now(), digestCounters: { clicks: 0, followups: 0, blocked: 0 } }); } catch { /* ignore */ }
        });
      } catch { /* notifications unavailable — lastDigestAt stays untouched */ }
    });
  } catch { /* ignore */ }
}

// --- syncSettings write-through mirror ------------------------------------------------
// Items above the 8KB per-item sync quota are skipped with a console warning (local storage
// remains the source of truth; the rest of the subset still syncs).
// QUOTA_BYTES_PER_ITEM counts BYTES of the serialized JSON, NOT UTF-16 code units: a
// `.length` check waves through multibyte content (Vietnamese/CJK text is exactly what users
// write into followupPrompts/followupChips) whose UTF-8 form exceeds 8192 bytes. The write
// then fails at the API — and if the callback ignored lastError, it silently never synced.
function syncValueBytes(value) {
  let json;
  try { json = JSON.stringify(value); } catch { return Infinity; }
  if (typeof json !== 'string') return Infinity; // undefined/function => nothing to sync
  try { return new TextEncoder().encode(json).length; } catch { return json.length; }
}
function maybeSetSyncItem(out, key, value) {
  try {
    const bytes = syncValueBytes(value);
    if (bytes > SYNC_ITEM_MAX_BYTES) {
      console.warn('[Muse Auto-Allow] sync: "' + key + '" is ' + (Number.isFinite(bytes) ? bytes + ' bytes' : 'unserializable') +
        ' — over the ' + SYNC_ITEM_MAX_BYTES + '-byte per-item quota; kept local only');
      return;
    }
    out[key] = value;
  } catch { /* unserializable value — skip */ }
}
// A quota/IO failure must never be silent: read lastError in the callback and report why.
// Local console only — nothing is transmitted, and local storage stays authoritative.
function setSyncItems(out) {
  if (!out || !Object.keys(out).length) return;
  try {
    chrome.storage.sync.set(out, () => {
      try {
        const e = chrome.runtime.lastError;
        if (e) console.warn('[Muse Auto-Allow] sync: chrome.storage.sync.set failed — ' + (e.message || e));
      } catch { /* ignore */ }
    });
  } catch { /* ignore */ }
}
function pushAllToSync() {
  try {
    chrome.storage.local.get(SYNC_SUBSET, (s) => {
      const out = {};
      for (const k of SYNC_SUBSET) if (k in s && s[k] !== undefined) maybeSetSyncItem(out, k, s[k]);
      setSyncItems(out);
    });
  } catch { /* ignore */ }
}
// Called from storage.onChanged for LOCAL changes only (a sync echo must never loop back).
function mirrorToSync(changes) {
  try {
    chrome.storage.local.get({ syncSettings: false }, (s) => {
      if (s.syncSettings !== true) return; // opt-in only
      const out = {};
      for (const k of SYNC_SUBSET) if (changes[k] && changes[k].newValue !== undefined) maybeSetSyncItem(out, k, changes[k].newValue);
      setSyncItems(out);
    });
  } catch { /* ignore */ }
}
// On load: sync values apply ONLY to keys ABSENT from local storage (a local choice always
// wins; sync never overwrites).
function pullFromSync() {
  try {
    chrome.storage.sync.get(SYNC_SUBSET, (syncVals) => {
      try {
        chrome.storage.local.get(null, (localVals) => {
          const seed = {};
          for (const k of SYNC_SUBSET) {
            if (!(k in localVals) && syncVals && syncVals[k] !== undefined) seed[k] = syncVals[k];
          }
          if (Object.keys(seed).length) { try { chrome.storage.local.set(seed); } catch { /* ignore */ } }
        });
      } catch { /* ignore */ }
    });
  } catch { /* ignore */ }
}

// --- listeners --------------------------------------------------------------------------
try {
  chrome.commands.onCommand.addListener((cmd) => {
    if (cmd === 'toggle-pause') togglePause();
    else if (cmd === 'send-followup') sendFollowupNow();
  });
} catch { /* commands API unavailable in this context */ }

chrome.alarms.onAlarm.addListener((a) => {
  if (!a) return;
  if (a.name === PAUSE_ALARM) { updateBadge(); return; }
  if (a.name !== 'muse-sweep') return;
  updateBadge(); // pause expiry also lands within a minute if the one-shot alarm was lost
  chrome.tabs.query({ url: ['https://muse.ai/*', 'https://*.muse.ai/*'] }, (tabs) => {
    for (const t of tabs) nudge(t.id);
  });
});

// Proactive detection: as soon as a muse.ai page finishes loading, sweep it.
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info && info.status === 'complete' && tab && tab.url && MUSE_URL_RE.test(tab.url)) nudge(tabId);
});

chrome.storage.onChanged.addListener((ch, area) => {
  if (area && area !== 'local') return; // sync echoes must never loop back into sync
  if (ch.stats || ch.clickCount || ch.pauseUntil) updateBadge();
  if (ch.pauseUntil) schedulePauseBadgeRefresh();
  if (ch.syncSettings && ch.syncSettings.newValue === true) pushAllToSync();
  mirrorToSync(ch);
});

chrome.runtime.onInstalled.addListener(({ reason } = {}) => {
  ensureAlarm();
  migrate();
  pullFromSync();
  schedulePauseBadgeRefresh();
  if (reason !== 'chrome_update') updateBadge();
});
chrome.runtime.onStartup.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(updateBadge);
chrome.runtime.onStartup.addListener(digestOnStartup);
chrome.runtime.onStartup.addListener(schedulePauseBadgeRefresh);
chrome.runtime.onStartup.addListener(pullFromSync);
ensureAlarm();
pullFromSync();
schedulePauseBadgeRefresh();
updateBadge();
