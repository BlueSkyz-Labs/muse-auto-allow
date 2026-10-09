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
// Presets are the owner-specified follow-up prompts (exact strings), kept verbatim
// and exposed as one-tap 'quick combos'. followupPrompt in storage is the single
// source of truth the content script reads; v1.7.0 composes it from the phrase
// library + custom text (see below).
const PRESETS = [
  'Approve and continue working',
  'Continues implementation — working long-run',
  'follow best practice, Project Source of Truth, Do your best',
];
const FUP_SENT_RECENT_MS = 15 * 60 * 1000; // show 'Follow-up sent HH:MM' for the last 15 min

// ---- v1.7.0: follow-up phrase library + combo builder + rotation -----------
// The library is grouped by the real failure modes of agentic coding (mid-task
// stops, unverified 'done' claims, source-of-truth loss after compaction, scope
// creep, weakened controls, silent failures) — every phrase and its group is
// documented in docs/PROMPT_LIBRARY.md. Selected phrases compose in LIBRARY order,
// joined with '; ' (+ a final '.' when the composition has more than one part);
// the custom text is appended as the last part. Storage: followupPrompt always
// holds the COMPOSED string (the content script consumes it unchanged) and
// followupChips re-hydrates the selection here; an absent followupChips key means
// legacy behaviour (the stored prompt shows as a quick combo or as custom text).
const PHRASE_GROUPS = [
  { id: 'continue', label: ['followupGroupContinue', 'Continue'], phrases: [
    ['continue-full', 'Continue working until the task is fully complete'],
    ['continue-noask', 'Do not stop to ask — decide, proceed, and report'],
    ['continue-longrun', 'Long-run: plan → do → check → iterate'],
    ['continue-next', 'When one step is done, continue with the next step on your own'],
  ] },
  { id: 'verify', label: ['followupGroupVerify', 'Verify'], phrases: [
    ['verify-evidence', 'Verify before claiming done — run the tests and show the output'],
    ['verify-nofabricate', 'No fabricated results — report failures plainly'],
    ['verify-redteam', 'Red-team your own work before reporting'],
    ['verify-edge', 'Verify edge cases and error paths — not just the happy path'],
  ] },
  { id: 'quality', label: ['followupGroupQuality', 'Quality'], phrases: [
    ['quality-best', 'Follow best practices (latest security standards)'],
    ['quality-sot', 'Project Source of Truth is authoritative — read AGENTS.md/docs first'],
    ['quality-bestdo', 'Do your best — quality over speed'],
    ['quality-minimal', 'Minimal focused changes — no over-engineering'],
  ] },
  { id: 'workflow', label: ['followupGroupWorkflow', 'Workflow'], phrases: [
    ['workflow-commit', 'Commit and push with clear messages'],
    ['workflow-resume', 'Resume from the last pushed artifact — check git status/branch first'],
    ['workflow-status', 'Keep the PR/issue updated with status + evidence'],
    ['workflow-branch', 'Work on a feature branch — never commit directly to main'],
  ] },
  { id: 'scope', label: ['followupGroupScope', 'Scope'], phrases: [
    ['scope-stay', 'Stay within task scope — do not touch unrelated files'],
    ['scope-blocked', 'Stop and ask ONLY if truly blocked (missing credentials/production access)'],
    ['scope-nodelete', 'Do not delete or overwrite existing work without checking with me first'],
  ] },
  { id: 'report', label: ['followupGroupReport', 'Report'], phrases: [
    ['report-concise', 'Reply concisely: what changed, evidence, next steps'],
    ['report-blockers', 'Report blockers immediately with what you tried and what you need'],
    ['report-milestones', 'Give a short progress update at each milestone'],
  ] },
  { id: 'security', label: ['followupGroupSecurity', 'Security'], phrases: [
    ['security-threatmodel', 'Security first — threat-model and think in attack chains'],
    ['security-failclosed', 'Fail closed on unknown state — never guess'],
    ['security-noweaken', 'Never weaken controls or tests to get green'],
    ['security-secrets', 'Secrets and tokens never in code, logs, or prompts'],
  ] },
  { id: 'design', label: ['followupGroupDesign', 'Design/UX'], phrases: [
    ['design-a11y', 'Follow the design system and accessibility — contrast AA, focus-visible, reduced-motion'],
    ['design-states', 'Design every state: empty, loading, error, disabled'],
    ['design-premium', 'Premium, cohesive UI — no placeholder polish, no dead affordances'],
  ] },
];
const PHRASE_INFO = new Map();
const PHRASE_ORDER = [];
for (const g of PHRASE_GROUPS) for (const [id, text] of g.phrases) { PHRASE_INFO.set(id, { text: text, group: g.id }); PHRASE_ORDER.push(id); }
const PHRASE_BY_TEXT = new Map(PHRASE_ORDER.map((id) => [PHRASE_INFO.get(id).text, id]));
const groupById = (id) => PHRASE_GROUPS.find((g) => g.id === id) || PHRASE_GROUPS[0];
const orderChips = (ids) => PHRASE_ORDER.filter((id) => ids.includes(id)); // stable LIBRARY order
function composePrompt(ids, custom) {
  const parts = orderChips(ids).map((id) => PHRASE_INFO.get(id).text);
  const c = String(custom || '').trim().slice(0, 600);
  if (c) parts.push(c);
  if (!parts.length) return '';
  return parts.join('; ') + (parts.length > 1 ? '.' : '');
}
// Starter rotation: three recommended combos, one per workflow area (docs/PROMPT_LIBRARY.md)
const STARTER_ROTATION = [
  ['continue-full', 'verify-evidence'],
  ['quality-best', 'quality-sot'],
  ['workflow-commit', 'workflow-status'],
].map((ids) => composePrompt(ids, ''));

let fChips = [];        // selected phrase ids (kept in library order)
let fQuickIdx = -1;     // active legacy quick combo (chips/custom empty)
let fTab = 'continue';  // open library group tab
let fSheetMode = '';    // '' closed | 'library' | 'rotation'
let fRotItems = [];     // followupPrompts from storage (rotation list)
let fRotIdx = 0;        // followupRotateIdx from storage
let fGroupSaveFlash = false; // transient 'added' confirmation on the per-group save button
let fGroupSaveTimer = null;
const fTextarea = () => $('fprompt');

function fPreviewText() {
  const composed = composePrompt(fChips, fTextarea() ? fTextarea().value : '');
  if (composed) return composed;
  return PRESETS[fQuickIdx >= 0 ? fQuickIdx : 0] || PRESETS[0];
}
function fToggleChip(id) {
  if (!PHRASE_INFO.has(id)) return;
  fChips = orderChips(fChips.includes(id) ? fChips.filter((x) => x !== id) : fChips.concat([id]));
  fQuickIdx = -1;
  fWritePrompt();
}
// The composed string IS what the engine sends: write the prompt and the chip ids
// together so the re-hydrated selection can never disagree with the stored prompt.
function fWritePrompt() {
  const ta = fTextarea();
  const custom = ta ? ta.value : '';
  const composed = composePrompt(fChips, custom);
  let patch = { followupChips: [] };
  if (composed) patch = { followupPrompt: composed, followupChips: fChips.slice() };
  else patch.followupPrompt = PRESETS[fQuickIdx >= 0 ? fQuickIdx : 0] || PRESETS[0]; // never leave the engine promptless
  try { chrome.storage.local.set(patch); } catch { /* ignore */ }
  fRender();
}
function fRenderPreview() {
  const txt = fPreviewText();
  document.querySelectorAll('.fprevtext').forEach((el) => { el.textContent = txt; el.title = txt; });
}
function fRenderQuick() {
  PRESETS.forEach((p, i) => {
    const b = $('fq' + i);
    if (!b) return;
    const on = fQuickIdx === i;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.title = p; // the exact legacy string this quick combo sets
  });
}
function fRenderCount() {
  const el = $('flibcount');
  const n = fChips.length;
  if (el) { el.hidden = !n; el.textContent = String(n); }
}
function fRenderTabs() {
  const box = $('ftabs');
  if (!box) return;
  box.innerHTML = PHRASE_GROUPS.map((g) => {
    const n = fChips.filter((id) => PHRASE_INFO.get(id).group === g.id).length;
    return '<button type="button" class="ftab' + (fTab === g.id ? ' on' : '') + '" data-g="' + g.id +
      '" aria-pressed="' + (fTab === g.id ? 'true' : 'false') + '">' + esc(t(g.label[0], g.label[1])) +
      (n ? ' <span class="n">' + n + '</span>' : '') + '</button>';
  }).join('');
}
function fRenderChips() {
  const box = $('fchips');
  if (!box) return;
  box.innerHTML = groupById(fTab).phrases.map(([id, text]) => {
    const on = fChips.includes(id);
    return '<button type="button" class="chipbtn' + (on ? ' on' : '') + '" data-c="' + id +
      '" aria-pressed="' + (on ? 'true' : 'false') + '" title="' + esc(text) + '">' + esc(text) +
      (on ? '<span class="x" aria-hidden="true">✕</span>' : '') + '</button>';
  }).join('');
}
// v1.7.0 — per-group save: one tap appends THIS group's selected phrases to the rotation
function fGroupIds() { return orderChips(fChips.filter((id) => PHRASE_INFO.get(id).group === fTab)); }
function fRenderGroupSave() {
  const b = $('fgsave');
  if (!b) return;
  b.title = t('followupGroupSaveHint', "Add this group's selected phrases to the rotation list");
  const g = groupById(fTab);
  // the transient 'added' confirmation is a LABEL change only — the button stays usable so a
  // rapid second save (idempotent per string) is never blocked by the flash
  b.disabled = fGroupIds().length === 0;
  b.textContent = fGroupSaveFlash
    ? t('followupGroupSaved', 'Added to rotation ✓')
    : t('followupGroupSave', 'Save $1 combo', [t(g.label[0], g.label[1])]);
}
// v1.7.0 — rotation rows show their source group, derived from the item's phrase parts
// (a group-saved combo is exactly a composition of that group's phrases; multi-group
// items read "A+B"; an item with a custom part shows no tag — metadata is never invented).
function rotItemSource(p) {
  const parts = String(p || '').replace(/\.\s*$/, '').split('; ').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return '';
  const groups = new Set();
  for (const part of parts) {
    const id = PHRASE_BY_TEXT.get(part);
    if (!id) return '';
    groups.add(PHRASE_INFO.get(id).group);
  }
  return [...groups].map((g) => { const gg = groupById(g); return t(gg.label[0], gg.label[1]); }).join('+');
}
function fRenderRotList() {
  const box = $('frotitems');
  if (!box) return;
  box.innerHTML = fRotItems.map((p, i) => {
    const src = rotItemSource(p);
    return '<div class="froti">' + (src ? '<span class="src">' + esc(src) + '</span>' : '') +
      '<span class="txt" title="' + esc(p) + '">' + esc(p) + '</span>' +
      '<button type="button" class="rm" data-rm="' + i + '" aria-label="' + esc(t('followupRotateRemove', 'Remove')) + '">✕</button></div>';
  }).join('');
}
function fRenderRot() {
  const next = $('frotnext');
  if (!next) return;
  const n = fRotItems.length;
  if (!n) { next.hidden = true; next.textContent = ''; return; }
  let idx = ((fRotIdx % n) + n) % n;
  // the live per-tab ping is the freshest truth once a tab with rotation answers
  if (fAgg && fAgg.rotateCount === n && Number.isFinite(fAgg.rotateIdx)) idx = ((fAgg.rotateIdx % n) + n) % n;
  next.hidden = false;
  next.textContent = t('followupRotateNext', 'Next: $1/$2', [String(idx + 1), String(n)]);
  next.title = t('followupRotateList', 'Saved list ($1)', [String(n)]);
}
function fRender() {
  fRenderQuick();
  fRenderCount();
  fRenderPreview();
  fRenderRot();
  const lib = $('fsheetLib'), rot = $('fsheetRot'), sh = $('flibsheet');
  if (lib) lib.hidden = fSheetMode !== 'library';
  if (rot) rot.hidden = fSheetMode !== 'rotation';
  if (sh) sh.hidden = !fSheetMode;
  if (fSheetMode === 'library') { fRenderTabs(); fRenderChips(); fRenderGroupSave(); }
  if (fSheetMode === 'rotation') fRenderRotList();
  const btn = $('flibbtn');
  if (btn) btn.setAttribute('aria-expanded', fSheetMode ? 'true' : 'false');
}
function fSheet(next) { fSheetMode = next; fRender(); }
function applyFollowupUI(s) {
  const on = s.followupEnabled === true;
  const cb = $('followupEnabled');
  if (cb) cb.checked = on;
  // ---- re-hydrate the builder from storage (absent followupChips = legacy) ----
  const stored = String(s.followupPrompt || PRESETS[0]);
  const idsRaw = Array.isArray(s.followupChips) ? s.followupChips : null;
  const chips = orderChips((idsRaw || []).filter((id) => PHRASE_INFO.has(id)));
  let custom = '';
  if (chips.length) {
    const chipPart = chips.map((id) => PHRASE_INFO.get(id).text).join('; ');
    if (stored.startsWith(chipPart)) {
      let rest = stored.slice(chipPart.length);
      if (rest.startsWith('; ')) rest = rest.slice(2);
      if (rest.endsWith('.')) rest = rest.slice(0, -1);
      custom = rest;
    } else {
      custom = stored; // externally edited prompt: keep the text, never lose it
    }
  } else {
    custom = PRESETS.includes(stored) ? '' : stored;
  }
  fChips = chips;
  fQuickIdx = (!chips.length && !custom) ? Math.max(0, PRESETS.indexOf(stored)) : -1;
  const ta = $('fprompt');
  if (ta && document.activeElement !== ta) ta.value = custom;
  // normalise: a stored prompt that disagrees with chips+custom is rewritten, so the
  // preview can never lie about what the engine will send
  const composed = composePrompt(chips, custom);
  if (composed && composed !== stored) { try { chrome.storage.local.set({ followupPrompt: composed }); } catch { /* ignore */ } }
  // ---- rotation list ----
  fRotItems = Array.isArray(s.followupPrompts) ? s.followupPrompts.filter((p) => typeof p === 'string' && p.trim()) : [];
  fRotIdx = Number.isInteger(s.followupRotateIdx) && s.followupRotateIdx >= 0 ? s.followupRotateIdx : 0;
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
  if (panel) {
    panel.classList.toggle('gated', !on);
    if (!on) fSheetMode = ''; // never leave the sheet open while gated
  }
  const hint = $('fhint');
  if (hint) hint.hidden = on;
  fRender();
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
  fRenderRot(); // the ping is the freshest source for the 'Next: i/n' line
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
              const rc = Number(r.rotateCount) || 0; // rotation: first tab that reports wins
              if (rc > 0 && !agg.rotateCount) { agg.rotateCount = rc; agg.rotateIdx = Math.max(0, Number(r.rotateIdx) || 0); }
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
  // NOTE: the object form of storage.get returns ONLY the listed keys — followupChips must
  // be listed (null default keeps 'absent' distinguishable from an explicit empty array).
  chrome.storage.local.get({ enabled: true, minDelayMs: 300, clickCount: 0, log: [], stats: null,
    followupEnabled: false, followupPrompt: PRESETS[0], followupIdleMs: 60000, followupCooldownMs: 600000,
    followupChips: null, followupPrompts: [], followupRotateIdx: 0 }, (s) => {
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
// ---- v1.7.0: follow-up builder wiring (quick combos, chips, rotation) ----
PRESETS.forEach((p, i) => {
  const b = $('fq' + i);
  if (!b) return;
  b.addEventListener('click', () => {
    // one-tap quick combo: exactly the legacy preset string, no chips, no custom text
    fChips = [];
    fQuickIdx = i;
    const ta = fTextarea();
    if (ta) ta.value = '';
    try { chrome.storage.local.set({ followupPrompt: p, followupChips: [] }); } catch { /* ignore */ }
    fRender();
  });
});
$('followupEnabled').addEventListener('change', () => {
  const on = $('followupEnabled').checked;
  const patch = { followupEnabled: on };
  const ta = fTextarea();
  if (on && !composePrompt(fChips, ta ? ta.value : '')) { patch.followupPrompt = PRESETS[0]; patch.followupChips = []; }
  chrome.storage.local.set(patch);
});
let fPromptTimer = null;
const fTa = $('fprompt');
if (fTa) {
  fTa.addEventListener('input', () => {
    fQuickIdx = -1;
    fRenderPreview(); // live preview while typing (before the debounced write)
    if (fPromptTimer) clearTimeout(fPromptTimer);
    fPromptTimer = setTimeout(() => { fPromptTimer = null; fWritePrompt(); }, 400);
  });
  fTa.addEventListener('change', () => {
    if (fPromptTimer) { clearTimeout(fPromptTimer); fPromptTimer = null; }
    fWritePrompt();
  });
}
$('flibbtn').addEventListener('click', () => fSheet(fSheetMode === 'library' ? '' : 'library'));
$('frotnext').addEventListener('click', () => fSheet(fSheetMode === 'rotation' ? '' : 'rotation'));
$('ftabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-g]');
  if (b) { fTab = b.dataset.g; fRender(); }
});
$('fchips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-c]');
  if (b) fToggleChip(b.dataset.c);
});
// per-group save: one tap appends THIS group's selected phrases to the rotation list
$('fgsave').addEventListener('click', () => {
  const ids = fGroupIds();
  const p = ids.length ? composePrompt(ids, '') : '';
  if (!p) return;
  if (!fRotItems.includes(p)) {
    const items = fRotItems.concat([p]);
    const patch = { followupPrompts: items };
    if (!fRotItems.length) patch.followupRotateIdx = 0;
    fRotItems = items;
    try { chrome.storage.local.set(patch); } catch { /* ignore */ }
  }
  fGroupSaveFlash = true;
  if (fGroupSaveTimer) clearTimeout(fGroupSaveTimer);
  fGroupSaveTimer = setTimeout(() => { fGroupSaveTimer = null; fGroupSaveFlash = false; fRender(); }, 1600);
  fRender();
});
$('frotadd').addEventListener('click', () => {
  const p = fPreviewText(); // the current composed combo (or the active quick preset)
  if (!p || fRotItems.includes(p)) return;
  const items = fRotItems.concat([p]);
  const patch = { followupPrompts: items };
  if (!fRotItems.length) patch.followupRotateIdx = 0;
  fRotItems = items;
  try { chrome.storage.local.set(patch); } catch { /* ignore */ }
  fRender();
});
$('frotstarter').addEventListener('click', () => {
  fRotItems = STARTER_ROTATION.slice();
  fRotIdx = 0;
  try { chrome.storage.local.set({ followupPrompts: fRotItems.slice(), followupRotateIdx: 0 }); } catch { /* ignore */ }
  fRender();
});
$('frotitems').addEventListener('click', (e) => {
  const b = e.target.closest('[data-rm]');
  if (!b) return;
  fRotItems = fRotItems.filter((_, j) => j !== Number(b.dataset.rm));
  try { chrome.storage.local.set({ followupPrompts: fRotItems.slice() }); } catch { /* ignore */ }
  fRender();
});
// the sheet overlays the panel: close it on an outside click or Escape.
// composedPath() is captured at dispatch time and keeps working after the click handlers
// re-render the chip/tab lists — innerHTML replacement detaches e.target, and a bare
// contains(e.target) check on the detached node would read 'outside' and close the sheet
// the user is browsing.
document.addEventListener('click', (e) => {
  if (!fSheetMode) return;
  const sh = $('flibsheet'), t1 = $('flibbtn'), t2 = $('frotnext');
  const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
  const inside = (!!sh && path.includes(sh)) || !!(sh && e.target && e.target.isConnected && sh.contains(e.target));
  const trigger = (!!t1 && path.includes(t1)) || (!!t2 && path.includes(t2)) ||
    !!(e.target && e.target.closest && (e.target.closest('#flibbtn') || e.target.closest('#frotnext')));
  if (!inside && !trigger) fSheet('');
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && fSheetMode) fSheet(''); });
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
