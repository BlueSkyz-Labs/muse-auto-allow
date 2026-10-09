const $ = (id) => document.getElementById(id);

function t(key, fallback, subs) {
  try { return chrome.i18n.getMessage(key, subs) || fallback; } catch { return fallback; }
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    let msg = t(el.dataset.i18n, el.textContent);
    // data-nc: drop the locale's trailing colon so labels and stat captions share one punctuation style
    if (msg && el.hasAttribute('data-nc')) msg = String(msg).replace(/[:：]\s*$/, '');
    if (msg) el.textContent = msg;
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    const msg = t(el.dataset.i18nPh, el.getAttribute('placeholder') || '');
    if (msg) el.setAttribute('placeholder', msg);
  });
  try { document.documentElement.lang = chrome.i18n.getUILanguage() || 'en'; } catch { /* keep */ }
  const hint = $('fhint');
  if (hint) hint.textContent = t('followupGateNote', hint.textContent); // fallback = the caption in the markup
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const KIND_KEY = { allow: 'kindAllow', expand: 'kindExpand', 'open-panel': 'kindOpenPanel', 'review-bar': 'kindOpenPanel' };
const kindLabel = (k) => t(KIND_KEY[k] || '', k);

// ---- v1.6.0: Auto follow-up settings + live status -------------------------
// Presets are the owner-specified follow-up prompts (exact strings); the select
// offers them plus 'Custom…' with a free-text field. followupPrompt in storage is
// the single source of truth the content script reads.
const PRESETS = [
  'Approve and continue working',
  'Continues implementation — working long-run',
  'follow best practice, Project Source of Truth, Do your best',
];
const FUP_SENT_RECENT_MS = 15 * 60 * 1000; // show 'Follow-up sent HH:MM' for the last 15 min
let fCustomMode = false;
let fSelectBuilt = false;

function buildFollowupSelect() {
  const sel = $('fpreset');
  if (!sel || fSelectBuilt) return;
  fSelectBuilt = true;
  sel.innerHTML = PRESETS.map((p, i) => '<option value="p' + i + '">' + esc(p) + '</option>').join('') +
    '<option value="custom">' + esc(t('followupCustomOption', 'Custom…')) + '</option>';
}
function applyFollowupUI(s) {
  const on = s.followupEnabled === true;
  const cb = $('followupEnabled');
  if (cb) cb.checked = on;
  const prompt = String(s.followupPrompt || PRESETS[0]);
  const pIdx = PRESETS.indexOf(prompt);
  const isCustom = fCustomMode || pIdx < 0;
  const sel = $('fpreset');
  if (sel) sel.value = isCustom ? 'custom' : 'p' + pIdx;
  const row = $('fpromptRow');
  if (row) row.hidden = !isCustom;
  const ta = $('fprompt');
  if (ta && document.activeElement !== ta) ta.value = prompt;
  const idle = $('fidle');
  if (idle && document.activeElement !== idle) idle.value = Math.max(1, Math.round((Number(s.followupIdleMs) || 60000) / 1000));
  const cool = $('fcool');
  if (cool && document.activeElement !== cool) cool.value = Math.max(1, Math.round((Number(s.followupCooldownMs) || 600000) / 60000));
  const btn = $('fsendnow');
  if (btn) {
    btn.disabled = !on;
    if (on) { btn.removeAttribute('title'); } else { btn.title = t('followupSendNowHint', 'Enable Auto follow-up first'); }
  }
  const sendrow = $('fsendrow');
  if (sendrow) { if (on) sendrow.removeAttribute('title'); else sendrow.title = t('followupSendNowHint', 'Enable Auto follow-up first'); }
  // gate the whole controls block while the feature is off: collapse the settings and keep the
  // disabled Send-now visible (explicit treatment + tooltip); one inline hint explains.
  const panel = $('fpanel');
  if (panel) panel.classList.toggle('gated', !on);
  const hint = $('fhint');
  if (hint) hint.hidden = on;
  renderFollowupStatus(fAgg); // the toggle re-words the pill (Waiting vs Idle)
}
// Status pill: informative states only — Working / Sent HH:MM / Waiting (armed) / Idle.
// A tab that never reports (or reports 'none') hides the pill: the header chip already
// carries the muse.ai tab status, so the old dead-end 'Status unknown' pill is gone.
let fAgg = null; // last engine snapshot, kept so the pill re-renders when the toggle flips
function fstatSet(text, cls, title) {
  const el = $('fstat');
  const tx = $('fstatText');
  if (!el || !tx) return;
  tx.textContent = text;
  el.className = 'fstat' + (cls ? ' ' + cls : '');
  if (title) el.title = title; else el.removeAttribute('title');
  el.hidden = false;
}
function fstatHide() {
  const el = $('fstat');
  if (el) el.hidden = true;
}
function renderFollowupStatus(agg) {
  fAgg = agg || null;
  const cb = $('followupEnabled');
  const on = !!(cb && cb.checked);
  if (!agg) return fstatHide();
  if (agg.state === 'working') return fstatSet(t('followupWorking', 'Working'), 'on', t('followupHintWorking', 'Muse is working'));
  if (agg.lastSentAt && Date.now() - agg.lastSentAt < FUP_SENT_RECENT_MS) {
    const d = new Date(agg.lastSentAt);
    return fstatSet(t('followupSentAt', 'Follow-up sent $1', [pad2(d.getHours()) + ':' + pad2(d.getMinutes())]), 'sent', localFull(agg.lastSentAt));
  }
  if (agg.state === 'idle') {
    return on
      ? fstatSet(t('followupWaiting', 'Waiting'), 'on', t('followupHintWaiting', 'Muse is idle — a follow-up is sent once the wait time passes'))
      : fstatSet(t('followupIdle', 'Idle'), '', t('followupHintIdle', 'Muse is idle'));
  }
  return fstatHide(); // no muse.ai tab reporting / unsettled — nothing useful to say
}
// Ask every muse.ai tab for its engine state; aggregate (working wins, newest
// lastSentAt wins). A tab that never answers is settled by the 700ms timeout.
function refreshFollowupStatus() {
  let done = false;
  const finish = (agg) => { if (done) return; done = true; renderFollowupStatus(agg); };
  try {
    chrome.tabs.query({ url: ['https://muse.ai/*', 'https://*.muse.ai/*'] }, (tabs) => {
      if (!tabs || !tabs.length) return finish({ state: 'none', lastSentAt: null });
      const agg = { state: 'unknown', lastSentAt: null };
      let pending = tabs.length;
      tabs.forEach((tb) => {
        let settled = false;
        const settle = () => { if (settled) return; settled = true; if (--pending === 0) finish(agg); };
        try {
          chrome.tabs.sendMessage(tb.id, { type: 'followup-status' }, (r) => {
            void chrome.runtime.lastError; // tab has no content script — static tab, ignore
            if (r) {
              if (r.state === 'working') agg.state = 'working';
              else if (r.state === 'idle' && agg.state !== 'working') agg.state = 'idle';
              const ts = Number(r.lastSentAt) || 0;
              if (ts > (agg.lastSentAt || 0)) agg.lastSentAt = ts;
            }
            settle();
          });
        } catch { settle(); }
        setTimeout(settle, 700);
      });
    });
  } catch { finish({ state: 'unknown', lastSentAt: null }); }
}

// --- v1.5.0: decrypt at-rest context + show the user's LOCAL system time ---
let popCryptKey = null;
const unb64p = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function popKey() {
  if (popCryptKey) return popCryptKey;
  try {
    const s = await chrome.storage.local.get({ cryptKeyRaw: null });
    if (!s.cryptKeyRaw) return null;
    popCryptKey = await crypto.subtle.importKey('raw', unb64p(s.cryptKeyRaw), 'AES-GCM', false, ['decrypt']);
    return popCryptKey;
  } catch { return null; }
}
// a restored backup (or any other writer) can rotate the key — drop the cache (V4-4)
try { chrome.storage.onChanged.addListener((ch) => { if (ch.cryptKeyRaw) popCryptKey = null; }); } catch { /* ignore */ }
async function decCtx(e) {
  if (e && e.ctx && e.ctx.iv && e.ctx.ct) {
    try {
      const k = await popKey();
      if (!k) return '(encrypted)';
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64p(e.ctx.iv) }, k, unb64p(e.ctx.ct));
      return new TextDecoder().decode(pt);
    } catch { return '(unable to decrypt)'; }
  }
  return String((e && e.context) || ''); // legacy plaintext entries stay readable
}
// log times always show the viewer's system clock (stored values are UTC ISO)
function localTime(iso) {
  if (!iso) return ''; // V4-8: never render epoch for missing timestamps
  try { const d = new Date(iso); if (isNaN(d.getTime())) return ''; return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()); } catch { return ''; }
}
function localFull(iso) {
  if (!iso) return '';
  try { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleString(); } catch { return ''; }
}
let renderSeq = 0;
async function renderLog(log) {
  const seq = ++renderSeq;
  const sane = (Array.isArray(log) ? log : []).filter((e) => e && typeof e === 'object'); // V4-3: junk entries never crash the render
  const items = await Promise.all(sane.slice(0, 50).map(async (e) => ({ e, plain: await decCtx(e) })));
  if (seq !== renderSeq) return; // a newer render superseded this one
  $('log').innerHTML = items.length
    ? items.map(({ e, plain }) => {
        const k = e.kind || 'allow';
        const kCls = k === 'review-bar' ? 'open-panel' : k; // review-bar entries share the open-panel chip
        const kLbl = kindLabel(k);
        const lbl = String(e.label || '');
        // the kind chip already says it — don't repeat the same word as a bold title
        const title = lbl && lbl.toLowerCase() !== kLbl.toLowerCase() ? '<b title="' + esc(lbl) + '">' + esc(lbl) + '</b>' : '';
        // clip the context at a WORD boundary at roughly two lines (the CSS clamp stays as a
        // safety net) so the ellipsis never lands mid-word
        let ctxS = String(plain);
        if (ctxS.length > 78) { const cut = ctxS.slice(0, 78); const sp = cut.lastIndexOf(' '); ctxS = (sp > 48 ? cut.slice(0, sp) : cut) + '…'; }
        // timestamp column on the left; the kind chip opens the message column and the
        // clamped context hangs under it (no full-margin continuation lines)
        return '<div class="item"><span class="t" title="' + esc(localFull(e.at)) + '">' + esc(localTime(e.at)) + '</span>' +
          '<div class="top"><span class="k k-' + esc(kCls) + '">' + esc(kLbl) + '</span>' + title + '</div>' +
          '<div class="c" title="' + esc(plain) + '">' + esc(ctxS) + '</div></div>';
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
    days.push({ d, key: dayKeyOf(d), v: Number(byDay[dayKeyOf(d)]) || 0 });
  }
  // labelled sparkline: day labels under the bars (locale-aware, no new i18n keys).
  // Uses the locale's short weekday ("Sat Sun Mon …" — unambiguous at this size);
  // narrow when the short form is multi-word (vi "Thứ 6" -> "T6").
  let lang = 'en';
  try { lang = chrome.i18n.getUILanguage() || 'en'; } catch { /* keep */ }
  const fmt = (d, o) => { try { return d.toLocaleDateString(lang, o); } catch { return ''; } };
  const dayLabel = (d) => { const sh = fmt(d, { weekday: 'short' }); return sh.includes(' ') ? fmt(d, { weekday: 'narrow' }) : sh; };
  const W = 292, H = 46, gap = 4, base = 32, top = 2;
  const bw = Math.floor((W - gap * 6) / 7);
  const max = Math.max(1, ...days.map((x) => x.v));
  let out = '<defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0082FB"/><stop offset="1" stop-color="#0064E0"/></linearGradient>' +
    '<linearGradient id="mgd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0064E0"/><stop offset="1" stop-color="#0040DC"/></linearGradient></defs>' +
    '<line class="baseline" x1="0" y1="' + (base + 0.5) + '" x2="' + W + '" y2="' + (base + 0.5) + '"/>';
  days.forEach((x, i) => {
    const cx = i * (bw + gap) + bw / 2;
    const h = x.v ? Math.max(3, Math.round((base - top) * (x.v / max))) : 4;
    out += '<rect x="' + (i * (bw + gap)) + '" y="' + (base - h) + '" width="' + bw + '" height="' + h +
      '" rx="4" fill="url(#' + (i === 6 ? 'mgd' : 'mg') + ')" opacity="' + (x.v ? (i === 6 ? 1 : 0.5) : 0.45) + '"><title>' +
      esc(fmt(x.d, { weekday: 'long', day: 'numeric', month: 'short' }) + ' — ' + x.v) + '</title></rect>' +
      '<text x="' + cx + '" y="43" text-anchor="middle"' + (i === 6 ? ' class="today"' : '') + '>' + esc(dayLabel(x.d)) + '</text>';
  });
  svg.innerHTML = out;
}

function refreshMuseStat() {
  try {
    chrome.tabs.query({ url: ['https://muse.ai/*', 'https://*.muse.ai/*'] }, (tabs) => {
      const el = $('musestat');
      const tx = $('musestatText');
      if (!el || !tx) return;
      const n = tabs ? tabs.length : 0;
      tx.textContent = n > 0
        ? (n === 1 ? t('museTabsFoundOne', '1 muse.ai tab open') : t('museTabsFound', '$1 muse.ai tabs open', [String(n)]))
        : t('museTabsNone', 'No muse.ai tab found');
      el.title = tx.textContent; // full text when the header clips it
      el.classList.toggle('on', n > 0);
    });
  } catch { /* ignore */ }
}

function refresh() {
  chrome.storage.local.get({ enabled: true, minDelayMs: 300, clickCount: 0, log: [], stats: null,
    followupEnabled: false, followupPrompt: PRESETS[0], followupIdleMs: 60000, followupCooldownMs: 600000 }, (s) => {
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
    const byDay = (s.stats && typeof s.stats.byDay === 'object' && s.stats.byDay) || {};
    const now = new Date();
    const today = $('today');
    if (today) today.textContent = Number(byDay[dayKeyOf(now)]) || 0;
    renderMini(byDay, now);
    applyFollowupUI(s);
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
// ---- v1.6.0: Auto follow-up wiring ----
buildFollowupSelect();
$('followupEnabled').addEventListener('change', () => {
  const on = $('followupEnabled').checked;
  const patch = { followupEnabled: on };
  if (on && !String($('fprompt').value || '').trim()) { patch.followupPrompt = PRESETS[0]; $('fprompt').value = PRESETS[0]; }
  chrome.storage.local.set(patch);
});
$('fpreset').addEventListener('change', () => {
  const v = $('fpreset').value;
  fCustomMode = v === 'custom';
  $('fpromptRow').hidden = !fCustomMode;
  if (fCustomMode) { try { $('fprompt').focus(); } catch { /* ignore */ } return; }
  const idx = Number(v.replace(/^p/, ''));
  if (Number.isInteger(idx) && PRESETS[idx]) {
    $('fprompt').value = PRESETS[idx];
    chrome.storage.local.set({ followupPrompt: PRESETS[idx] });
  }
});
let fPromptTimer = null;
$('fprompt').addEventListener('input', () => {
  if (fPromptTimer) clearTimeout(fPromptTimer);
  fPromptTimer = setTimeout(() => {
    fPromptTimer = null;
    try { chrome.storage.local.set({ followupPrompt: String($('fprompt').value || '').slice(0, 600) }); } catch { /* ignore */ }
  }, 400);
});
$('fprompt').addEventListener('change', () => {
  try { chrome.storage.local.set({ followupPrompt: String($('fprompt').value || '').slice(0, 600) }); } catch { /* ignore */ }
});
$('fidle').addEventListener('change', () => {
  const v = Math.max(1, Math.min(3600, Math.round(Number($('fidle').value) || 60)));
  $('fidle').value = v;
  chrome.storage.local.set({ followupIdleMs: v * 1000 });
});
$('fcool').addEventListener('change', () => {
  const v = Math.max(1, Math.min(1440, Math.round(Number($('fcool').value) || 10)));
  $('fcool').value = v;
  chrome.storage.local.set({ followupCooldownMs: v * 60000 });
});
$('fsendnow').addEventListener('click', () => {
  try {
    chrome.tabs.query({ url: ['https://muse.ai/*', 'https://*.muse.ai/*'] }, (tabs) => {
      (tabs || []).forEach((tb) => {
        try { chrome.tabs.sendMessage(tb.id, { type: 'followup-send-now' }, () => { void chrome.runtime.lastError; }); } catch { /* ignore */ }
      });
      setTimeout(refreshFollowupStatus, 1500);
    });
  } catch { /* ignore */ }
});
refresh(); // boot: apply the stored state immediately (was missing — popup rendered default DOM until the first storage event)
refreshFollowupStatus();
setInterval(refreshFollowupStatus, 2500);
chrome.storage.onChanged.addListener(refresh);
