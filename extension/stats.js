// Muse Auto-Allow — statistics dashboard (no libraries; inline SVG; renders instantly).
const $ = (id) => document.getElementById(id);
let manualMsgs = null; // v5.0 (C5-2, TS-04): when the popup's manual language switcher is on, this page follows it too
let manualLocale = 'auto';
const msgOf = (key) => { try { const m = manualMsgs && manualMsgs[key]; return m && typeof m.message === 'string' ? m.message : null; } catch { return null; } };
const t = (key, fallback) => {
  const m = msgOf(key); if (m != null) return m;
  try { return chrome.i18n.getMessage(key) || fallback; } catch { return fallback; }
};
// same as t() but with $1/$2 substitutions (chrome.i18n positional placeholders)
const tp = (key, subs, fallback) => {
  const m = msgOf(key);
  if (m != null) return m.replace(/\$(\d)/g, (x, i) => (subs && subs[Number(i) - 1] != null) ? String(subs[Number(i) - 1]) : x);
  try { return chrome.i18n.getMessage(key, subs) || fallback; } catch { return fallback; }
};
const pad2 = (n) => String(n).padStart(2, '0');
// cycle 2026-10-18 (A2): chart tick labels follow the UI locale via Intl (the popup's mini
// chart has always done this) — a fixed DD/MM reads as month/day for en/zh/ja/ko readers.
// Falls back to the old numeric form only if Intl rejects the locale string (never throws).
// v1.15.0 (E1): the tick formatters follow the EFFECTIVE locale — the popup's manual switcher
// once applyUserLocale has landed, the browser locale otherwise (the TS-04 class is now closed
// for data formats too). Formatters rebuild per call, so a live switch re-renders correctly.
const UI_LOCALE = (() => { try { return chrome.i18n.getUILanguage() || 'en'; } catch { return 'en'; } })();
const i18nFmt = (opts) => { try { return new Intl.DateTimeFormat(manualMsgs ? manualLocale : UI_LOCALE, opts); } catch { return null; } };
const tickDay = (d) => { const f = i18nFmt({ day: '2-digit', month: '2-digit' }); return f ? f.format(d) : pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1); };
const tickMonth = (d) => { const f = i18nFmt({ month: '2-digit', year: '2-digit' }); return f ? f.format(d) : pad2(d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2); };
const dayKeyOf = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const monthKeyOf = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1);
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const msg = t(el.dataset.i18n, el.textContent);
    if (msg) el.textContent = msg;
  });
  try { document.documentElement.lang = manualMsgs ? manualLocale : (chrome.i18n.getUILanguage() || 'en'); } catch { /* keep */ }
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
      out.push({ label: tickDay(d), v: num(STATS.byDay[dayKeyOf(d)]) });
    }
  } else if (RANGE === 'week') {
    for (let i = 11; i >= 0; i--) {
      const start = weekStart(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7));
      let v = 0;
      for (let k = 0; k < 7; k++) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + k);
        v += num(STATS.byDay[dayKeyOf(d)]);
      }
      out.push({ label: tickDay(start), v });
    }
  } else if (RANGE === 'month') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({ label: tickMonth(d), v: num(STATS.byMonth[monthKeyOf(d)]) });
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
// The caption pairs the ACTIVE range's own word (read back from the localized control) with
// its window, so 'Day' + 'Last 14 days' can never be misread as contradicting each other.
const RANGE_KEY = { day: 'rangeDay', week: 'rangeWeek', month: 'rangeMonth', year: 'rangeYear' };

function renderChart() {
  const svg = $('chart');
  const data = series();
  const segBtn = document.querySelector('#seg button[data-range="' + RANGE + '"]');
  $('ccap').textContent = t(RANGE_KEY[RANGE], segBtn ? segBtn.textContent : RANGE) + ' \u00b7 ' + t(CAP[RANGE][0], CAP[RANGE][1]);
  const W = 720, H = 158, padL = 8, padR = 8, padT = 26, padB = 22;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const n = data.length || 1;
  const gap = Math.max(3, Math.floor(innerW / n * 0.22));
  const bw = Math.max(4, Math.floor((innerW - gap * (n - 1)) / n));
  const max = Math.max(1, ...data.map((x) => x.v));
  // Single-hue trend (comparable heights — colour encodes nothing): every bar shares the
  // brand-blue value gradient; the latest ('today') bar carries the brand-gradient accent.
  let out = '<defs>' +
    '<linearGradient id="g-trend" x1="0" y1="0" x2="0" y2="1"><stop class="sc-blue" offset="0"/><stop class="sc-blue-b" offset="1"/></linearGradient>' +
    '<linearGradient id="g-now" x1="0" y1="0" x2="0" y2="1"><stop class="sc-now" offset="0"/><stop class="sc-now-m" offset="0.62"/><stop class="sc-now-b" offset="1"/></linearGradient>' +
    '</defs>';
  // y-max gridline + tick anchor the vertical scale (skipped when there is nothing to scale)
  const yMax = Math.max(0, ...data.map((x) => x.v));
  if (yMax > 0) out += '<line class="grid" x1="' + padL + '" y1="' + padT + '" x2="' + (W - padR) + '" y2="' + padT + '"/>' +
    '<text class="tick" x="' + padL + '" y="' + (padT - 1) + '">' + yMax + '</text>';
  out += '<line class="base" x1="' + padL + '" y1="' + (padT + innerH) + '" x2="' + (W - padR) + '" y2="' + (padT + innerH) + '"/>';
  data.forEach((x, i) => {
    const last = i === data.length - 1;
    const now = last && !!x.v; // the accent marks the latest bucket only when it has data
    const h = x.v ? Math.max(2, Math.round(innerH * (x.v / max))) : 1;
    const xx = padL + i * (bw + gap);
    const y = padT + innerH - h;
    // subtle value gradient: taller bars sit a touch more solid; accent + empty stubs are fixed
    const op = x.v ? (now ? 1 : (0.84 + 0.16 * (x.v / max)).toFixed(2)) : 0.15;
    out += '<rect class="bar' + (now ? ' now' : '') + '" x="' + xx + '" y="' + y + '" width="' + bw + '" height="' + h + '" rx="4" fill="url(#' + (now ? 'g-now' : 'g-trend') + ')" opacity="' + op + '"><title>' + x.label + ': ' + x.v + '</title></rect>';
    if (x.v) out += '<text class="val' + (now ? ' now' : '') + '" x="' + (xx + bw / 2) + '" y="' + (y - 5) + '" text-anchor="middle">' + x.v + '</text>';
    out += '<text' + (last ? ' class="now"' : '') + ' x="' + (xx + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + x.label + '</text>';
  });
  svg.innerHTML = out;
}

function renderTopics() {
  const wrap = $('topics');
  const all = Object.entries(STATS.byTopic).map(([k, v]) => [String(k), num(v)]).sort((a, b) => b[1] - a[1]);
  const entries = all.slice(0, 12);
  if (!entries.length) { // v1.13.0: no topic entries = nothing to chart — say so (Total>0 with an
    // empty byTopic is reachable after a data-restart import or legacy pruning)
    wrap.innerHTML = '<div class="empty">' + t('noData', 'No data yet') + '</div>';
    const sc0 = $('topicsScope'); if (sc0) { sc0.textContent = ''; sc0.hidden = true; }
    return;
  }
  // share-of-total bars (every recorded topic counts): 231 of 489 reads as a true 47 % track,
  // never a misleading "100 %". cycle 2026-10-18 (A3, red-team refined): the denominator is the
  // all-time Total KPI (falling back to the topic sum) and the column states its own scope —
  // "share of the N-click total" plus the top-12 window when there are more topics — instead of
  // an "other" row (recordClick gives every counted click a topic; the only remainders are
  // pruned-at-100 / legacy data).
  const sum = all.reduce((s, e) => s + e[1], 0);
  // v1.13.0 (C4-H): the denominator follows the Total KPI whenever it exists (the caption and
  // the KPI card must never disagree); the topic sum is only a fallback for legacy stores with
  // no Total. Bars are clamped at 100% below, so a legacy sum > TOTAL cannot overflow the track.
  const total = num(TOTAL) > 0 ? num(TOTAL) : Math.max(sum, 1);
  const scopeNote = $('topicsScope');
  if (scopeNote) {
    if (!entries.length || !num(TOTAL)) {
      scopeNote.textContent = '';
      scopeNote.hidden = true;
    } else {
      const txt = all.length > 12
        ? tp('statsBarScopeTop', [String(all.length), String(total)], 'Top 12 of ' + all.length + ' topics · bars: share of the ' + total + '-click total')
        : tp('statsBarScope', [String(total)], 'Bars: share of the ' + total + '-click total');
      scopeNote.textContent = txt;
      scopeNote.hidden = false;
    }
  }
  wrap.innerHTML = entries.map(([name, v], i) => {
    const c = PALETTE[i % PALETTE.length];
    const pct = Math.min(100, Math.round(v / total * 100)); // v1.16.0 (R5): the share is printed, not only drawn
    return '<div class="topic"><span class="dot t-' + c + '"></span>' +
      '<span class="name" title="' + name.replace(/"/g, '&quot;') + '">' + name.replace(/[<>&]/g, '') + '</span>' +
      '<span class="bar"><i class="t-' + c + '" style="width:' + Math.min(100, Math.max(4, pct)) + '%"></i></span>' +
      '<span class="n">' + v + '<i class="pct">' + pct + '%</i></span></div>';
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
  // v1.16.0 (R4): a zero-value card calms its own icon tint — attention lands on the live metric.
  const setK = (id, v) => { const el = $(id); if (!el) return; el.textContent = v; const card = el.closest('.kpi'); if (card) card.classList.toggle('zero', num(v) === 0); };
  setK('kTotal', num(TOTAL));
  setK('kToday', today);
  setK('kWeek', week);
  setK('kMonth', num(STATS.byMonth[monthKeyOf(now)]));
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
// v5.0 (C5-2, TS-04): follow the popup's manual language switcher (userLocale) when not 'auto'.
const readAsset = globalThis.fetch.bind(globalThis); // the lint-approved alias (same-package URL only)
function applyUserLocale(loc) {
  manualLocale = (typeof loc === 'string' && /^[A-Za-z_]{2,5}$/.test(loc) && loc !== 'auto') ? loc : 'auto';
  if (manualLocale === 'auto') { manualMsgs = null; applyI18n(); renderAll(); return; }
  try {
    readAsset(chrome.runtime.getURL('_locales/' + manualLocale + '/messages.json'))
      .then((r) => r.json())
      .then((j) => { if (j && typeof j === 'object') { manualMsgs = j; applyI18n(); renderAll(); } })
      .catch(() => { manualMsgs = null; });
  } catch { manualMsgs = null; }
}
try { chrome.storage.local.get({ userLocale: 'auto' }, (u) => applyUserLocale(u && u.userLocale)); } catch { /* keep browser locale */ }
chrome.storage.onChanged.addListener((ch) => {
  if (ch.userLocale) { try { applyUserLocale(ch.userLocale.newValue); } catch { /* ignore */ } } // v5.0 (C5-2): live-follow the popup switcher
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
// actually decrypt a ctx-bearing entry — ANY of them, not just the first (SA-1) —
// before anything is replaced; with no ctx-bearing entry at all the key rotation is
// refused and the current key is kept (fail closed). v1.7.0: the auto follow-up
// config (followup* keys) round-trips through export/import (SA-2) and the imported
// dataset is bounded (clickCount cap, ISO `at` cap — SA-3).
// SA-3: log timestamps must be ISO-ish and <= 64 chars — anything else drops the entry,
// so a crafted file cannot inflate the log or the storage quota with junk `at` values.
const ISO_AT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})?$/;
const isoAt = (v) => { const s = typeof v === 'string' ? v.slice(0, 64) : ''; return ISO_AT_RE.test(s) ? s : null; };
// ---- F-V19-1: v1.8.0/v1.9.0 import-validation helpers ----------------------------------
// Every helper below MIRRORS the engine's own reader (content.js applyV18Settings /
// applyMissionSettings, popup.js applyV18UI, background.js syncSettings) so a value this
// sanitizer keeps can never diverge from what the engine computes for the same stored value.
const plainObj = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? v : null;
// content.js sanitizeList(v, cap, maxLen): trimmed non-empty strings, each sliced to maxLen,
// the list capped; null when v is not an array (the caller then keeps its own default).
const strList = (v, cap, maxLen) => {
  if (!Array.isArray(v)) return null;
  const out = [];
  for (const x of v) {
    if (typeof x !== 'string') continue;
    const s = x.trim();
    if (!s) continue;
    out.push(maxLen ? s.slice(0, maxLen) : s);
    if (out.length >= cap) break;
  }
  return out;
};
// content.js hourOf(v, dflt): an integer 0..23 (Number-coerced), else the default — here
// null so the caller can DROP an invalid hour instead of silently writing the default.
const intHour = (v) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= 23 ? n : null; };
// popup.js LOCALE_IDS — the shipped locale set the language switcher may point at (+ 'auto').
const LOCALE_IDS = ['en', 'vi', 'zh_CN', 'ja', 'ko', 'es'];
// The shipped Mission Orchestrator corpus shape: id -> step count. Mirrors content.js
// MISSION_CORPUS (every entry is under MISSION_MAX_STEPS_PER_MISSION = 12) and popup.js
// MISSION_META. A stored `mission` is adopted ONLY for an id in this table — an unknown or
// foreign id yields NO mission, exactly as the engine's own sanitizeMission fails closed.
const MISSION_STEPS = { 'golive-ready': 6, 'audit-only': 4, 'fix-findings': 4, 'release-prep': 4 };
const MISSION_MAX_STEPS_PER_MISSION = 12;
const MISSION_MAX_CYCLES = 3;
// content.js sanitizeMission(m): a shipped id, step/cycles clamped to the engine's caps and
// finite timestamps (absent/invalid startedAt => now, lastSentAt => 0). null => no mission.
const sanitizeMissionObj = (m) => {
  const o = plainObj(m);
  if (!o) return null;
  const id = typeof o.id === 'string' ? o.id : '';
  if (!Object.prototype.hasOwnProperty.call(MISSION_STEPS, id)) return null;
  const L = Math.min(MISSION_STEPS[id], MISSION_MAX_STEPS_PER_MISSION);
  const st0 = Number(o.step);
  const step = Number.isInteger(st0) && st0 > 0 ? Math.min(st0, Math.max(0, L - 1)) : 0;
  const cy0 = Number(o.cycles);
  const cycles = Number.isInteger(cy0) && cy0 > 0 ? Math.min(cy0, MISSION_MAX_CYCLES) : 0;
  const s0 = Number(o.startedAt);
  const startedAt = Number.isFinite(s0) && s0 > 0 ? s0 : Date.now();
  const l0 = Number(o.lastSentAt);
  const lastSentAt = Number.isFinite(l0) && l0 > 0 ? l0 : 0;
  return { id, step, cycles, startedAt, lastSentAt };
};
const sanitizeBackup = (d) => {
  const out = {}; let seen = 0;
  if (typeof d.enabled === 'boolean') { out.enabled = d.enabled; seen++; }
  if (typeof d.minDelayMs === 'number' && isFinite(d.minDelayMs)) { out.minDelayMs = Math.min(10000, Math.max(0, Math.round(d.minDelayMs))); seen++; }
  if (typeof d.clickCount === 'number' && isFinite(d.clickCount)) { out.clickCount = Math.min(1e7, Math.max(0, Math.floor(d.clickCount))); seen++; } // SA-3: hard ceiling
  if (Array.isArray(d.log)) {
    out.log = d.log.filter((e) => e && typeof e === 'object' && isoAt(e.at) !== null).slice(0, 50).map((e) => {
      const o = { at: isoAt(e.at), kind: typeof e.kind === 'string' ? e.kind.slice(0, 24) : 'allow',
                  label: typeof e.label === 'string' ? e.label.slice(0, 60) : '' };
      if (e.ctx && typeof e.ctx === 'object' && typeof e.ctx.iv === 'string' && typeof e.ctx.ct === 'string'
          && /^[A-Za-z0-9+/=]{8,64}$/.test(e.ctx.iv) && /^[A-Za-z0-9+/=]{8,4096}$/.test(e.ctx.ct)) o.ctx = { iv: e.ctx.iv, ct: e.ctx.ct };
      else if (typeof e.context === 'string') o.context = e.context.slice(0, 500);
      if (e.standing === true) o.standing = true; // v1.11.0 standing-grant flag: boolean-only, junk dropped
      if (typeof e.blockedReason === 'string' && e.blockedReason) o.blockedReason = e.blockedReason.slice(0, 96); // v1.12.0 (C3-1): blocked rows keep their reason across a restore (the chevron/chip need it)
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
  // v1.6.0/v1.7.0 auto follow-up config — carried EXACTLY as popup.js/content.js consume
  // it (SA-2): booleans, strings, phrase-id arrays and ms numbers, each bounded.
  if (typeof d.followupEnabled === 'boolean') { out.followupEnabled = d.followupEnabled; seen++; }
  if (typeof d.followupPrompt === 'string' && d.followupPrompt.trim()) { out.followupPrompt = d.followupPrompt.slice(0, 4000); seen++; }
  if (Array.isArray(d.followupPrompts)) { out.followupPrompts = d.followupPrompts.filter((p) => typeof p === 'string' && p.trim()).slice(0, 10).map((p) => p.slice(0, 600)); seen++; }
  if (Array.isArray(d.followupChips)) { out.followupChips = d.followupChips.filter((c) => typeof c === 'string' && c.length <= 64).slice(0, 32); seen++; }
  if (Number.isInteger(d.followupRotateIdx) && d.followupRotateIdx >= 0) { out.followupRotateIdx = Math.min(100000, d.followupRotateIdx); seen++; }
  // engine bounds (content.js applyFollowupSettings): any finite ms >= 0 is honoured; the
  // caps mirror the popup's reachable ranges (<= 3600 s / <= 1440 min) so crafted
  // magnitudes clamp while every UI-settable value round-trips exactly.
  if (typeof d.followupIdleMs === 'number' && isFinite(d.followupIdleMs)) { out.followupIdleMs = Math.min(3600000, Math.max(0, Math.round(d.followupIdleMs))); seen++; }
  if (typeof d.followupCooldownMs === 'number' && isFinite(d.followupCooldownMs)) { out.followupCooldownMs = Math.min(86400000, Math.max(0, Math.round(d.followupCooldownMs))); seen++; }
  // ---- F-V19-1: v1.8.0 authority + v1.9.0 mission keys ---------------------------------
  // The whitelist MUST track every key the engine reads (the export writes all of
  // chrome.storage.local). A restore on a fresh device must not silently drop dryRun / the
  // rules blocklist / pauseUntil / the mission state — a dropped dryRun:true fails OPEN into
  // real clicking. Types mirror the engine's readers; a present-but-invalid value is DROPPED
  // (never emitted as a reset-to-default) so a crafted file cannot use junk to CLEAR a user
  // restriction. Every accepted key counts toward `seen` (a file of ONLY these keys imports).
  if (typeof d.pauseUntil === 'number' && isFinite(d.pauseUntil)) { out.pauseUntil = Math.max(0, d.pauseUntil); seen++; }
  if (typeof d.dryRun === 'boolean') { out.dryRun = d.dryRun; seen++; }
  if (typeof d.allowOnceMode === 'boolean') { out.allowOnceMode = d.allowOnceMode; seen++; }
  // v1.12.0 (C3-1): the two AUTHORITY opt-ins round-trip too — a user's OWN backup must not
  // silently lose them. The sanitizer only carries booleans (junk dropped); turning one ON
  // from OFF is surfaced by the import confirm, so a crafted file can never enable
  // YOLO / the Codex engine silently (fail-closed import path stays intact).
  if (typeof d.yoloMode === 'boolean') { out.yoloMode = d.yoloMode; seen++; }
  if (typeof d.codexEnabled === 'boolean') { out.codexEnabled = d.codexEnabled; seen++; }
  if (typeof d.syncSettings === 'boolean') { out.syncSettings = d.syncSettings; seen++; }
  if (typeof d.missionEnabled === 'boolean') { out.missionEnabled = d.missionEnabled; seen++; }
  if (typeof d.onboarded === 'boolean') { out.onboarded = d.onboarded; seen++; }
  if (typeof d.userLocale === 'string' && (d.userLocale === 'auto' || LOCALE_IDS.indexOf(d.userLocale) >= 0)) { out.userLocale = d.userLocale; seen++; }
  // F-V19-5: the three v1.8 CONTAINERS are COMPOSITE. The engine reads each sub-key with its own
  // presence test over the WHOLE stored container (`if ('allowTopics' in rules)`, content.js:399),
  // so a container written with even one missing sub-key makes the engine RESET that sub-key to its
  // default on the next content-script boot (allowTopics -> [] = allow-all, blockKeywords -> the
  // seed list, schedule -> {enabled:false,8,18}, smart -> the shipped prompts, errorRecovery:false).
  // Therefore a container is emitted ONLY when it carries >= 1 ACCEPTED sub-key: an all-rejected (or
  // empty) container is DROPPED entirely, never written as {} — "absent" then leaves the stored
  // container untouched.
  // An EMPTY allowTopics/blockKeywords array is dropped as well: the engine reads an explicit [] as
  // "no topic restriction" / "nothing blocked" (content.js:399-403) — the LOOSEST value — and
  // strList() cannot tell a user's deliberate [] from an all-junk array ([null,5,{}] reduces to []),
  // so keeping [] would be a JUNK-reachable way to CLEAR a stored restriction. An empty list is
  // therefore never imported; that state stays reachable from the popup UI (a deliberate fail-closed
  // asymmetry: the import path can only tighten or preserve, never clear).
  const rules = plainObj(d.rules);
  if (rules) {
    const r = {};
    if ('allowTopics' in rules) { const a = strList(rules.allowTopics, 50, 64); if (a && a.length) r.allowTopics = a; }   // engine TOPIC_MAX 50 x TOPIC_LEN 64
    if ('blockKeywords' in rules) { const k = strList(rules.blockKeywords, 500, 0); if (k && k.length) r.blockKeywords = k; } // engine cap 500, no length slice
    if (Object.keys(r).length) { out.rules = r; seen++; }
  }
  const smart = plainObj(d.followupSmart);
  if (smart) {
    const s = {};
    if (typeof smart.stuckMin === 'number' && isFinite(smart.stuckMin) && smart.stuckMin >= 0) s.stuckMin = Math.min(smart.stuckMin, 1440);
    if (typeof smart.stuckPrompt === 'string' && smart.stuckPrompt.trim()) s.stuckPrompt = smart.stuckPrompt.trim().slice(0, 600);
    if (typeof smart.errorRecovery === 'boolean') s.errorRecovery = smart.errorRecovery;
    if (typeof smart.errorPrompt === 'string' && smart.errorPrompt.trim()) s.errorPrompt = smart.errorPrompt.trim().slice(0, 600);
    if (Object.keys(s).length) { out.followupSmart = s; seen++; }
  }
  const sch = plainObj(d.followupSchedule);
  if (sch) {
    const s = {};
    if (typeof sch.enabled === 'boolean') s.enabled = sch.enabled;
    if ('start' in sch) { const h = intHour(sch.start); if (h !== null) s.start = h; }
    if ('end' in sch) { const h = intHour(sch.end); if (h !== null) s.end = h; }
    if (typeof sch.onlyActiveTab === 'boolean') s.onlyActiveTab = sch.onlyActiveTab;
    if (Object.keys(s).length) { out.followupSchedule = s; seen++; }
  }
  const mis = sanitizeMissionObj(d.mission);
  if (mis) { out.mission = mis; seen++; }
  if (typeof d.cryptKeyRaw === 'string' && /^[A-Za-z0-9+/]{43}=$/.test(d.cryptKeyRaw)) { out.cryptKeyRaw = d.cryptKeyRaw; seen++; }
  if (!seen) return null;
  out.schemaVersion = 2;
  return out;
};
// F-V19-5 (part 2): sub-key granularity for the three composite containers. The engine reads each
// sub-key with its own presence test over the WHOLE stored container, so a restore that validly
// provides only SOME sub-keys would otherwise reset the rest to the engine default — a stored
// restriction cleared. The file's ACCEPTED sub-keys win; a sub-key the file did not validly provide
// keeps its STORED value. Mirrors the engine's sub-key set exactly (content.js applyV18Settings
// :397-419) and copies only those known names, so no crafted __proto__/extra key can ride along.
const CONTAINER_SUBKEYS = {
  rules: ['allowTopics', 'blockKeywords'],
  followupSmart: ['stuckMin', 'stuckPrompt', 'errorRecovery', 'errorPrompt'],
  followupSchedule: ['enabled', 'start', 'end', 'onlyActiveTab'],
};
function mergeStoredContainers(clean, cur) {
  for (const [key, subs] of Object.entries(CONTAINER_SUBKEYS)) {
    const from = plainObj(clean[key]);
    if (!from) continue;
    const stored = plainObj(cur[key]);
    const merged = {};
    for (const sk of subs) {
      if (Object.prototype.hasOwnProperty.call(from, sk)) merged[sk] = from[sk];
      else if (stored && Object.prototype.hasOwnProperty.call(stored, sk)) merged[sk] = stored[sk];
    }
    if (Object.keys(merged).length) clean[key] = merged; else delete clean[key];
  }
}
const testBackupKey = async (raw, ctx) => {
  try {
    const b = (x) => Uint8Array.from(atob(x), (c) => c.charCodeAt(0));
    const k = await crypto.subtle.importKey('raw', b(raw), 'AES-GCM', false, ['decrypt']);
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b(ctx.iv) }, k, b(ctx.ct));
    return true;
  } catch { return false; }
};
// SA-1: a file-supplied key may rotate the at-rest key ONLY with decrypt proof against a
// ctx-bearing entry — ANY entry with ctx, not just the first. With no ctx-bearing entry
// at all the rotation is REFUSED (adopt = null, kept = true) and the current key stays;
// proof failure on an existing ctx entry rejects the whole import (ok = false, fail
// closed). Same key as the current one => nothing rotates, no proof needed.
async function resolveImportedKey(clean, currentKeyRaw) {
  const supplied = typeof clean.cryptKeyRaw === 'string' ? clean.cryptKeyRaw : null;
  if (!supplied) return { adopt: null, kept: false, ok: true };
  const ctxEntries = (clean.log || []).filter((e) => e && e.ctx && e.ctx.iv && e.ctx.ct);
  if (!ctxEntries.length) {
    if (currentKeyRaw === supplied) return { adopt: supplied, kept: false, ok: true };
    return { adopt: null, kept: true, ok: true };
  }
  for (const e of ctxEntries) {
    if (await testBackupKey(supplied, e.ctx)) return { adopt: supplied, kept: false, ok: true };
  }
  return { adopt: null, kept: false, ok: false };
}
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
    } else if (j.schemaVersion != null && !Number.isFinite(Number(j.schemaVersion))) {
      // v1.14.0 (F5-codex): a PRESENT but non-numeric schemaVersion is garbage, not a legacy file — refuse it.
      alert(t('importBad', 'Not a Muse Auto-Allow backup file.'));
    } else if (Number(j.schemaVersion) > 2) {
      // v5.0 (C5-3): a newer-schema backup would silently lose its newer keys in the sanitizer — refuse it honestly.
      alert(t('importNewer', 'This backup was made by a newer version of Muse Auto-Allow — update the extension first.'));
    } else {
      const clean = sanitizeBackup(j.data);
      if (!clean) {
        alert(t('importBad', 'Not a Muse Auto-Allow backup file.'));
      } else {
        // v1.12.0 (C3-1): an import that would TURN ON an authority opt-in asks first — a
        // crafted file can never enable YOLO / Codex silently. Turning one OFF (or junk
        // values) is fail-closed and applies without a prompt.
        const nowA = await chrome.storage.local.get({ yoloMode: false, codexEnabled: false, dryRun: true, followupEnabled: false, missionEnabled: false, pauseUntil: 0 });
        const flips = [];
        if (clean.yoloMode === true && nowA.yoloMode !== true) flips.push('YOLO');
        if (clean.codexEnabled === true && nowA.codexEnabled !== true) flips.push('Codex');
        // v1.14.0 (F4): the remaining autonomy switches flip too — the audit showed a crafted
        // backup could turn on live clicking / follow-up / mission or clear an active pause
        // behind only the generic restore dialog.
        if (clean.dryRun === false && nowA.dryRun !== false) flips.push('live clicking');
        if (clean.followupEnabled === true && nowA.followupEnabled !== true) flips.push('auto follow-up');
        if (clean.missionEnabled === true && nowA.missionEnabled !== true) flips.push('auto mission');
        if (Number(clean.pauseUntil) === 0 && Number(nowA.pauseUntil) > Date.now()) flips.push('clearing the active pause');
        if (flips.length && !confirm(tp('importAuthorityWarn', [flips.join(', ')], 'This backup turns on: $1 — continue?'))) { ev.target.value = ''; return; }
        // SA-1: a supplied key is adopted only after decrypt proof against a ctx-bearing
        // entry; with none present the rotation is refused and the current key is kept.
        const cur = await chrome.storage.local.get({ cryptKeyRaw: null, rules: null, followupSmart: null, followupSchedule: null });
        const kr = await resolveImportedKey(clean, typeof cur.cryptKeyRaw === 'string' ? cur.cryptKeyRaw : null);
        if (!kr.ok) {
          alert(t('importBad', 'Not a Muse Auto-Allow backup file.'));
        } else if (confirm(t('importConfirm', "Restore this backup? History and statistics are replaced by the backup's; settings not in the file keep their current values."))) {
          if (kr.adopt === null) delete clean.cryptKeyRaw; else clean.cryptKeyRaw = kr.adopt;
          // F-V19-5: merge the three composite containers at SUB-KEY granularity with what is stored
          // BEFORE the replace-write, so a crafted/partial file cannot reset a sibling sub-key the
          // user had set (an absent sub-key is a reset-to-default for the engine).
          mergeStoredContainers(clean, cur);
          // v1.13.0 (C4-D): "restore" is honest for DATA — log/stats/clickCount absent from the
          // file are REMOVED (start clean), so a partial backup never leaves the old encrypted
          // log or counters behind. Settings/restriction keys keep merge semantics: an absent
          // restriction is never cleared by a file (fail-closed symmetry preserved).
          const staleData = ['log', 'stats', 'clickCount'].filter((k) => !(k in clean));
          try {
            await chrome.storage.local.set(clean);
            // v1.13.0 (C4-D), order matters: SET first, then REMOVE the stale data keys — a quota
            // rejection on the set must never leave the old log already wiped (data loss); with
            // this order the worst case is the old data surviving (merge semantics).
            if (staleData.length) { try { await chrome.storage.local.remove(staleData); } catch { /* local.remove unavailable — merge semantics remain */ } }
            renderAll();
            if (kr.kept) alert(t('importKeyKept', "Imported. The backup's encryption key could not be verified, so it was not restored (the existing key was kept)."));
            else if (!clean.cryptKeyRaw && (clean.log || []).some((e) => e && e.ctx && e.ctx.iv && e.ctx.ct)) {
              // v1.13.0 (C4-D): the file carries encrypted entries but no key was supplied —
              // every restored entry would render "(unable to decrypt)" forever with no notice.
              alert(t('importKeyKept', "Imported. The backup's encryption key could not be verified, so it was not restored (the existing key was kept)."));
            }
          } catch (err) {
            // SA-3: a quota rejection gets its own message (was: "not a backup file")
            if (/quota/i.test(String((err && err.message) || err))) alert(t('importQuota', 'Could not restore the backup: browser storage is full.'));
            else alert(t('importBad', 'Not a Muse Auto-Allow backup file.'));
          }
        }
      }
    }
  } catch {
    alert(t('importBad', 'Not a Muse Auto-Allow backup file.'));
  }
  ev.target.value = '';
});
