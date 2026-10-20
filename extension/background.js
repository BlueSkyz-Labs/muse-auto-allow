// Muse Auto-Allow — service worker (v1.10.0: chatgpt.com nudges for the opt-in Codex
// engine; v1.8.0 pause badge + commands + startup digest + sync mirror).
// 1) Nudges muse.ai tabs once a minute so approvals are handled even when a tab is
//    throttled or otherwise quiet. v1.10.0: chatgpt.com tabs are nudged the same way —
//    the Codex engine they carry stays dormant unless the user enabled it (its own
//    `codexEnabled` switch), so the nudge itself never interacts with anything.
// 2) Proactively sweeps a muse.ai (or chatgpt.com) tab the moment it finishes loading.
// 3) Keeps the toolbar badge showing today's click count. While the engine is PAUSED
//    (chrome.storage.local.pauseUntil > now) the badge shows the pause marker '||'.
// 4) Commands (manifest "commands"): toggle-pause (Alt+Shift+P) toggles pauseUntil —
//    pause for 15 minutes, or clear an active pause; send-followup (Alt+Shift+F) triggers
//    the content script's existing followup-send-now path on the ACTIVE muse.ai tab.
// 5) Startup digest (chrome.runtime.onStartup): composes {since, clicks, followups, blocked}
//    from digestCounters (incremented by the content scripts) and shows ONE
//    chrome.notifications notification when clicks > 0; lastDigestAt is updated when shown.
//    The notification text is hardcoded English on purpose (docs/ENGINE_V18.md).
// 6) syncSettings (chrome.storage.local, default false): when true, every local change of a
//    subset key is mirrored write-through to chrome.storage.sync; on load, sync values apply
//    ONLY to keys absent from local storage (never overwriting a local choice). See
//    docs/ENGINE_V18.md for the 8KB per-item sync quota handling.
const MUSE_URL_RE = /^https:\/\/([a-z0-9-]+\.)*muse\.ai(?=[:/])/i;
const CHATGPT_URL_RE = /^https:\/\/([a-z0-9-]+\.)*chatgpt\.com(?=[:/])/i;
const MUSE_TAB_MATCHES = ['https://muse.ai/*', 'https://*.muse.ai/*'];
// v1.10.0 — the Codex (chatgpt.com) engine's tabs; nudged alongside the muse.ai set.
const CHATGPT_TAB_MATCHES = ['https://chatgpt.com/*', 'https://*.chatgpt.com/*'];
const SWEEP_TAB_MATCHES = MUSE_TAB_MATCHES.concat(CHATGPT_TAB_MATCHES);

const PAUSE_TOGGLE_MS = 15 * 60 * 1000; // Alt+Shift+P: 15 minutes, or clear
const PAUSE_BADGE_TEXT = '||';
const PAUSE_BADGE_COLOR = '#8a8f98';
const BADGE_COLOR = '#2f6df6';
const PAUSE_ALARM = 'maa-pause-expiry';
const DIGEST_NOTIFICATION_ID = 'maa-digest';
const DIGEST_ICON = 'icons/icon128.png';
// The mirrored settings subset (frozen contract): syncSettings itself is deliberately NOT
// mirrored — it is a per-device opt-in. followupRotateIdx is device-local too.
// v1.10.0: codexEnabled (the Codex/ChatGPT feature switch) joins the subset — it is an
// explicit user choice, like yoloMode, and only travels while syncSettings is opted in.
const SYNC_SUBSET = ['enabled', 'minDelayMs', 'dryRun', 'yoloMode', 'allowOnceMode', 'codexEnabled', 'rules',
  'followupEnabled', 'followupPrompt', 'followupPrompts', 'followupChips', 'followupSmart', 'followupSchedule',
  'anomaly']; // v1.20.0 (G04) - rides the opt-in sync subset
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
    const raw = await chrome.storage.local.get(['schemaVersion', 'enabled', 'minDelayMs', 'dryRun', 'yoloMode', 'codexEnabled']);
    const from = Number(raw.schemaVersion) || 0;
    if (from >= SCHEMA_VERSION) return;
    const seed = {};
    if (!('enabled' in raw)) seed.enabled = true;      // absent only — `false` is a valid choice
    if (!('minDelayMs' in raw)) seed.minDelayMs = 300;
    // v1.9.3 — FIRST-RUN SAFETY DEFAULT (owner-approved): a fresh install starts in DRY-RUN
    // (logging-only), so the user sees exactly what would be clicked before granting live
    // approval authority. This is the informed-consent mitigation for the Muse ToS §7.6
    // 'meaningful human oversight' tension (docs/MUSE_TOS_RESEARCH.md, the Chain F accepted-risk
    // row in docs/SECURITY_V19_AUDIT.md): the onboarding wizard states it plainly and offers the
    // one-tap 'Turn on live clicking'. ABSENT only — an explicit stored value is NEVER
    // overwritten (an upgrading user who chose dryRun:false keeps it). The `from >= SCHEMA_VERSION`
    // guard above means a v1.8+/v1.9 user (schemaVersion 2, stamped by the content script's flush)
    // is untouched — their current behaviour continues; a FRESH install and a PRE-v1.8 upgrade
    // (schemaVersion 0/1) both land here, both get dryRun:true, and both also see the onboarding
    // wizard once (pre-v1.8 never stored `onboarded`), so the first run is coherent in both cases.
    if (!('dryRun' in raw)) seed.dryRun = true;
    // v1.9.4 — YOLO mode: ABSENT only — the shipped default is false (safe), and an explicit
    // stored choice is never overwritten. A fresh install records the explicit false so the
    // popup toggle and the engine agree from the first run.
    if (!('yoloMode' in raw)) seed.yoloMode = false;
    // v1.10.0 — the Codex (chatgpt.com) feature switch: ABSENT only. The shipped default is
    // false (opt-in, off) — a fresh install records the explicit false so the popup switch,
    // the content script's reader and the sync subset all agree from the first run.
    if (!('codexEnabled' in raw)) seed.codexEnabled = false;
    // v0 -> v2: log/counter/aggregate shapes are read defensively everywhere; there is
    // nothing to transform. Future steps: add one `if (from < N)` block per version.
    // v1.8.0 keys (pauseUntil/rules/followupSmart/followupSchedule/syncSettings) are
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
// v1.20.0 (G04): one notification when the pause came from the anomaly detector. The marker is
// written in the SAME storage.set as pauseUntil, so a matching marker proves the origin; a
// manual pause (no marker) stays silent. Notifications must never break the pause path.
function notifyAnomalyPause(untilRaw) {
  const until = Number(untilRaw);
  if (!Number.isFinite(until) || until <= Date.now()) return;
  chrome.storage.local.get({ anomalyLastPause: null }, (s) => {
    const m = s && s.anomalyLastPause;
    if (!m || Number(m.until) !== until) return;
    try {
      chrome.notifications.create('maa-anomaly-pause', {
        type: 'basic', iconUrl: DIGEST_ICON, title: 'muse-auto-allow',
        message: 'Auto-paused until ' + new Date(until).toLocaleString() + ' - unusual click activity (' + String(m.rule || 'anomaly') + ').',
      }, () => { void chrome.runtime.lastError; });
    } catch { /* a notification failure must never break the pause path */ }
  });
}
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

// Alt+Shift+A (R5): the master switch. Off is always safe; turning it back on is exactly the
// same state the popup toggle writes, so both surfaces stay in sync through storage.onChanged.
function toggleEnabled() {
  try {
    chrome.storage.local.get({ enabled: true }, (s) => {
      try { chrome.storage.local.set({ enabled: s.enabled === false }); } catch { /* ignore */ }
      updateBadge();
    });
  } catch { /* ignore */ }
}

// Alt+Shift+D (v1.22.2 UX): flip dry-run from anywhere — the safest switch gets the shortest reach.
// Never silently turns live: enabling dry-run is always safe; turning live is the user's explicit
// second press after seeing the state line, exactly like the popup toggle.
function toggleDryRun() {
  try {
    chrome.storage.local.get({ dryRun: false }, (s) => {
      try { chrome.storage.local.set({ dryRun: s.dryRun !== true }); } catch { /* ignore */ }
      updateBadge();
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
function pullFromSync(done) {
  const fin = () => { if (typeof done === 'function') { try { done(); } catch { /* ignore */ } } };
  try {
    chrome.storage.sync.get(SYNC_SUBSET, (syncVals) => {
      try {
        chrome.storage.local.get(null, (localVals) => {
          // v1.13.0 red-team hardening: the callback body gets its OWN try — a throw in the async
          // callback is outside the outer try's dynamic extent and used to leave `fin` unfired
          // (migrate() would never run). The callback now always fires fin exactly once.
          try {
            const seed = {};
            for (const k of SYNC_SUBSET) {
              if (!(k in localVals) && syncVals && syncVals[k] !== undefined) seed[k] = syncVals[k];
            }
            if (Object.keys(seed).length) { try { chrome.storage.local.set(seed, fin); return; } catch { /* ignore */ } }
          } catch { /* ignore */ }
          fin();
        });
      } catch { fin(); }
    });
  } catch { fin(); }
}

// --- listeners --------------------------------------------------------------------------
try {
  chrome.commands.onCommand.addListener((cmd) => {
    if (cmd === 'toggle-pause') togglePause();
    else if (cmd === 'send-followup') sendFollowupNow();
    else if (cmd === 'toggle-dry-run') toggleDryRun(); // v1.22.2 UX (Vòng 3): one shortcut for the safest switch
    else if (cmd === 'toggle-enabled') toggleEnabled(); // R5: the most repeated action gets a key
  });
} catch { /* commands API unavailable in this context */ }

chrome.alarms.onAlarm.addListener((a) => {
  if (!a) return;
  if (a.name === PAUSE_ALARM) { updateBadge(); return; }
  if (a.name !== 'muse-sweep') return;
  updateBadge(); // pause expiry also lands within a minute if the one-shot alarm was lost
  // v1.10.0: the sweep reaches muse.ai AND chatgpt.com tabs (the latter only acts when
  // the user enabled the Codex engine — the content script self-gates).
  chrome.tabs.query({ url: SWEEP_TAB_MATCHES }, (tabs) => {
    for (const t of tabs) nudge(t.id);
  });
});

// Proactive detection: as soon as a muse.ai (or chatgpt.com) page finishes loading, sweep it.
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info && info.status === 'complete' && tab && tab.url && (MUSE_URL_RE.test(tab.url) || CHATGPT_URL_RE.test(tab.url))) nudge(tabId);
});

chrome.storage.onChanged.addListener((ch, area) => {
  if (area && area !== 'local') return; // sync echoes must never loop back into sync
  if (ch.stats || ch.clickCount || ch.pauseUntil) updateBadge();
  if (ch.pauseUntil) schedulePauseBadgeRefresh();
  if (ch.pauseUntil) notifyAnomalyPause(ch.pauseUntil.newValue); // v1.20.0 (G04)
  if (ch.syncSettings && ch.syncSettings.newValue === true) pushAllToSync();
  mirrorToSync(ch);
});

chrome.runtime.onInstalled.addListener(({ reason } = {}) => {
  ensureAlarm();
  // v1.13.0 (C4-A): pull FIRST, then migrate — synced values fill absent keys before the
  // fresh-install seeds run, so install defaults can never shadow a synced kill-switch
  // (enabled:false) or live choice (dryRun:false) — and the later syncSettings push cannot
  // carry those defaults over the shared bucket.
  pullFromSync(() => { migrate(); });
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
