const $ = (id) => document.getElementById(id);

// ======================================================================
// v1.8.1 — manual UI-language override (Language switcher).
// chrome.i18n.getMessage() is hard-wired to the BROWSER UI language and cannot be
// re-pointed at runtime, so a manual choice is served from that locale's own
// messages.json, read ONCE per language and cached in memory. Storage contract:
// `userLocale` in chrome.storage.local, default 'auto' (= follow the browser, i.e.
// exactly the pre-switcher behaviour). Values: 'auto' | 'en' | 'vi' | 'zh_CN' | 'ja' | 'ko' | 'es'.
// ======================================================================
const LOCALE_IDS = ['en', 'vi', 'zh_CN', 'ja', 'ko', 'es'];
// Native names are deliberately NOT translated: a language picker must stay readable
// to someone who cannot read the language the UI is currently in.
const LANG_NATIVE = { en: 'English', vi: 'Tiếng Việt', zh_CN: '简体中文', ja: '日本語', ko: '한국어', es: 'Español' };
let userLocale = 'auto';   // 'auto' | one of LOCALE_IDS
let manualMsgs = null;     // cached messages.json for `manualLocale`
let manualLocale = null;   // which locale manualMsgs holds
// Same-package read (chrome-extension://…/_locales/…), never the network. The global is
// bound once here so scripts/lint.mjs's remote-primitive ban keeps its meaning: this is
// the only asset read the feature needs and it cannot leave the package.
const readAsset = globalThis.fetch.bind(globalThis);

async function loadLocale(lang) {
  if (manualLocale === lang && manualMsgs) return manualMsgs;
  const res = await readAsset(chrome.runtime.getURL(`_locales/${lang}/messages.json`));
  const data = await res.json();
  manualMsgs = (data && typeof data === 'object') ? data : {};
  manualLocale = lang;
  return manualMsgs;
}

// chrome.i18n's placeholder syntax, applied to a manually loaded message: `$$` is an
// escaped literal '$' (resolved BEFORE substitution so a value containing '$1' is never
// re-substituted), then $1..$9 map to the positional substitutions.
function subst(msg, subs) {
  let out = String(msg).replace(/\$\$/g, '\u0000');
  if (subs) {
    const list = Array.isArray(subs) ? subs : [subs];
    out = out.replace(/\$(\d)/g, (m, d) => {
      const i = Number(d) - 1;
      return i >= 0 && i < list.length ? String(list[i]) : m;
    });
  }
  return out.replace(/\u0000/g, '$');
}

function t(key, fallback, subs) {
  if (userLocale !== 'auto' && manualMsgs) {
    const entry = manualMsgs[key];
    if (entry && typeof entry.message === 'string') return subst(entry.message, subs);
  }
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
  try { document.documentElement.lang = userLocale === 'auto' ? (chrome.i18n.getUILanguage() || 'en') : userLocale.replace('_', '-'); } catch { /* keep */ }
  // v1.8.0 — aria labels / titles that are not plain textContent
  const aria = (id, key, fb) => { const el = $(id); if (el) el.setAttribute('aria-label', t(key, fb)); };
  aria('safetyClose', 'safetyClose', 'Close');
  aria('missionClose', 'safetyClose', 'Close'); // v1.9.0: the mission sheet's close button
  aria('schStart', 'scheduleStart', 'Start hour');
  aria('schEnd', 'scheduleEnd', 'End hour');
  const pt = $('ptom');
  if (pt) pt.title = t('pauseTomorrowTitle', 'Pause until tomorrow');
  const pg = $('pauseIdle');
  if (pg) pg.title = t('pauseHint', 'Auto-click and follow-up are paused');
  const hint = $('fhint');
  if (hint) hint.textContent = t('followupGateNote', hint.textContent); // fallback = the caption in the markup
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const KIND_KEY = { allow: 'kindAllow', expand: 'kindExpand', 'open-panel': 'kindOpenPanel', 'review-bar': 'kindOpenPanel',
  // v1.8.0 kinds: the safety block + the follow-up entry + the dry-run variants
  blocked: 'kindBlocked', followup: 'kindFollowup', 'allow-dry': 'kindAllowDry', 'expand-dry': 'kindExpandDry',
  'open-panel-dry': 'kindOpenPanelDry', 'review-bar-dry': 'kindOpenPanelDry', 'followup-dry': 'kindFollowupDry',
  // v1.9.0 mission kinds: a verified mission send ('mission') + its dry-run twin
  mission: 'kindMission', 'mission-dry': 'kindMissionDry' };
const kindLabel = (k) => t(KIND_KEY[k] || '', k);
// v1.8.0: chip class per kind — the dry variants share one quiet tint, 'blocked' keeps its
// own, a follow-up entry reads like an allow entry (the label already says 'follow-up')
function kindClass(k) {
  if (k === 'review-bar') return 'open-panel';
  if (k === 'review-bar-dry') return 'open-panel-dry';
  if (String(k).endsWith('-dry')) return 'dry';
  if (k === 'followup') return 'allow';
  return k;
}

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
let advancedOpen = false;    // progressive disclosure: persisted `followupAdvancedOpen` (default collapsed)
let fIdleMs = 60000;         // followupIdleMs, mirrored for the collapsed summary
let fCoolMs = 600000;        // followupCooldownMs, mirrored for the collapsed summary
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
  // N8: a list of N combos must not render N identical 'Remove' buttons — each label
  // names the row it deletes (bounded so a long custom combo cannot flood the name)
  const rmLabel = t('followupRotateRemove', 'Remove');
  box.innerHTML = fRotItems.map((p, i) => {
    const src = rotItemSource(p);
    const row = String(p || '');
    const named = rmLabel + ': ' + (row.length > 80 ? row.slice(0, 79) + '…' : row);
    return '<div class="froti">' + (src ? '<span class="src">' + esc(src) + '</span>' : '') +
      '<span class="txt" title="' + esc(p) + '">' + esc(p) + '</span>' +
      '<button type="button" class="rm" data-rm="' + i + '" aria-label="' + esc(named) + '">✕</button></div>';
  }).join('');
}
function fRenderRot() {
  const next = $('frotnext');
  if (!next) return;
  const n = fRotItems.length;
  if (!n) { next.hidden = true; next.textContent = ''; next.removeAttribute('aria-label'); return; }
  let idx = ((fRotIdx % n) + n) % n;
  // the live per-tab ping is the freshest truth once a tab with rotation answers
  if (fAgg && fAgg.rotateCount === n && Number.isFinite(fAgg.rotateIdx)) idx = ((fAgg.rotateIdx % n) + n) % n;
  next.hidden = false;
  next.textContent = t('followupRotateNext', 'Next: $1/$2', [String(idx + 1), String(n)]);
  next.title = t('followupRotateList', 'Saved list ($1)', [String(n)]);
  // N8: the accessible name must say what the control opens, not only the counter
  next.setAttribute('aria-label', next.title + ' — ' + next.textContent);
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
  renderAdvancedSummary();
}
// ---- progressive disclosure: the follow-up settings a user touches once ----------
// applyAdvancedUI reflects the persisted open state onto the group + its disclosure
// button; while collapsed the button also carries a one-line summary of what is hidden
// (rotation position + wait/cooldown), so nothing is invisible.
function renderAdvancedSummary() {
  const el = $('fadvsum');
  if (!el) return;
  const parts = [];
  const n = fRotItems.length;
  if (n) {
    let idx = ((fRotIdx % n) + n) % n;
    if (fAgg && fAgg.rotateCount === n && Number.isFinite(fAgg.rotateIdx)) idx = ((fAgg.rotateIdx % n) + n) % n;
    parts.push(t('followupRotateNext', 'Next: $1/$2', [String(idx + 1), String(n)]));
  }
  parts.push(Math.max(1, Math.round(fIdleMs / 1000)) + 's');
  parts.push(Math.max(1, Math.round(fCoolMs / 60000)) + 'min');
  el.textContent = parts.join(' · ');
}
function applyAdvancedUI() {
  const grp = $('fadv'), btn = $('fadvbtn'), sum = $('fadvsum');
  const gated = !!($('followupEnabled') && !$('followupEnabled').checked);
  const open = advancedOpen && !gated;
  if (grp) grp.hidden = !open;
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (sum) sum.hidden = open; // the summary describes the HIDDEN state
  renderAdvancedSummary();
}
function setAdvancedOpen(v) {
  const next = !!v;
  const changed = next !== advancedOpen;
  advancedOpen = next;
  applyAdvancedUI();
  if (changed) { try { chrome.storage.local.set({ followupAdvancedOpen: next }); } catch { /* ignore */ } }
}
function fSheet(next) { fSheetMode = next; if (next) setAdvancedOpen(true); fRender(); }
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
  fIdleMs = Number(s.followupIdleMs) || 60000;
  fCoolMs = Number(s.followupCooldownMs) || 600000;
  const idle = $('fidle');
  if (idle && document.activeElement !== idle) idle.value = Math.max(1, Math.round(fIdleMs / 1000));
  const cool = $('fcool');
  if (cool && document.activeElement !== cool) cool.value = Math.max(1, Math.round(fCoolMs / 60000));
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
  // progressive disclosure: the group's open state comes from storage (default collapsed)
  advancedOpen = s.followupAdvancedOpen === true;
  fRender();
  applyAdvancedUI();
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
  renderAdvancedSummary(); // ... and for the collapsed summary of the hidden state
  renderMission(); // v1.9.0: the applied mission state drives the Missions entry + sheet
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
              // v1.9.0: the APPLIED mission state (first tab reporting an active mission wins)
              const mp = agg.mission || (agg.mission = { enabled: false, active: false, id: '', step: 0, cycles: 0, steps: 0, stepText: '', completedId: '' });
              if (r.missionEnabled === true) mp.enabled = true;
              if (r.missionActive === true && !mp.active) {
                mp.active = true; mp.id = r.missionId || ''; mp.step = Number(r.missionStep) || 0;
                mp.cycles = Number(r.missionCycles) || 0; mp.steps = Number(r.missionSteps) || 0;
                mp.stepText = String(r.missionStepText || '');
              }
              if (r.completedMissionId) mp.completedId = String(r.completedMissionId);
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
  $('logList').innerHTML = items.length
    ? items.map(({ e, plain }) => {
        const k = e.kind || 'allow';
        const kCls = kindClass(k); // v1.8.0: review-bar shares open-panel; the dry variants share one tint
        const kLbl = kindLabel(k);
        // v1.8.0: a blocked entry carries the reason the engine logged ('topic' / 'keyword:<kw>')
        const kTitle = e.blockedReason ? String(e.blockedReason) : '';
        const lbl = String(e.label || '');
        // the kind chip already says it — don't repeat the same word as a bold title
        const title = lbl && lbl.toLowerCase() !== kLbl.toLowerCase() ? '<b title="' + esc(lbl) + '">' + esc(lbl) + '</b>' : '';
        // clip the context at a WORD boundary at roughly two lines (the CSS clamp stays as a
        // safety net) so the ellipsis never lands mid-word
        let ctxS = String(plain);
        let cTitle = String(plain);
        if (ctxS.length > 78) { const cut = ctxS.slice(0, 78); const sp = cut.lastIndexOf(' '); ctxS = (sp > 48 ? cut.slice(0, sp) : cut) + '…'; }
        // v1.9.0: a mission entry shows its mission NAME + a localized step/cycle line
        // (the engine's own context is a raw English id string; the label is localized while
        // the shipped step DIRECTIVES stay English). All interpolated via esc().
        let mTitle = title;
        if (k === 'mission' || k === 'mission-dry') {
          const m = (e && e.mission) || {};
          const name = m.id ? missionNameOf(m.id) : '';
          mTitle = name ? '<b title="' + esc(name) + '">' + esc(name) + '</b>' : '';
          const N = missionStepsOfId(m.id);
          ctxS = m.complete === true
            ? t('missionCompleteCtx', 'complete · $1 cycles', [String(m.cycles == null ? '' : m.cycles)])
            : t('missionStepCtx', 'step $1/$2 · cycle $3', [String((Number(m.step) || 0) + 1), String(N || '?'), String(m.cycle == null ? '' : m.cycle)]);
          cTitle = ctxS;
        }
        // timestamp column on the left; the kind chip opens the message column and the
        // clamped context hangs under it (no full-margin continuation lines)
        // v1.9.1: a blocked entry carries its reason in the chip's ACCESSIBLE NAME (aria-label),
        // not only as a hover title — a screen-reader user must hear WHY, not just "blocked".
        // The reason is also shown compactly: the chip stays on ONE line and the reason span is
        // bounded (max-width + ellipsis, see .kreason), so a long `keyword:<kw>` reason can never
        // widen the chip past the frozen layout.
        const kAria = kTitle ? ' aria-label="' + esc(kLbl + ' — ' + kTitle) + '"' : '';
        const kVis = kTitle ? '<span class="kreason" aria-hidden="true"> · ' + esc(kTitle) + '</span>' : '';
        return '<div class="item"><span class="t" title="' + esc(localFull(e.at)) + '">' + esc(localTime(e.at)) + '</span>' +
          '<div class="top"><span class="k k-' + esc(kCls) + '"' + (kTitle ? ' title="' + esc(kTitle) + '"' : '') + kAria + '>' + esc(kLbl) + kVis + '</span>' + mTitle + '</div>' +
          '<div class="c" title="' + esc(cTitle) + '">' + esc(ctxS) + '</div></div>';
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
  const W = 292, H = 46, gap = 4, base = 36, top = 12;
  const bw = Math.floor((W - gap * 6) / 7);
  const max = Math.max(1, ...days.map((x) => x.v));
  // theme-aware fills (Quiet Luxury spec §3 #11): day bars are the solid --bar-day token
  // at 75% (light 3.33:1 / dark 4.52:1 on --bg); the brand gradient is reserved for the
  // single "today" bar. Fills + opacities now come from CSS classes (.bar / .bar.today,
  // .sc-now*), so light/dark switch with the theme and the geometry stays unchanged.
  // v1.9.0: a dashed y-max gridline + its tick anchor the vertical scale, matching the
  // Statistics chart — the mini chart is no longer an unlabelled sparkline.
  let out = '<defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">' +
    '<stop class="sc-now" offset="0"/><stop class="sc-now-m" offset="0.62"/><stop class="sc-now-b" offset="1"/></linearGradient></defs>' +
    '<line class="baseline" x1="0" y1="' + (base + 0.5) + '" x2="' + W + '" y2="' + (base + 0.5) + '"/>';
  const yMax = Math.max(0, ...days.map((x) => x.v));
  if (yMax > 0) {
    out += '<line class="grid" x1="0" y1="' + (top - 0.5) + '" x2="' + W + '" y2="' + (top - 0.5) + '"/>' +
      '<text class="tick" x="0" y="' + (top - 3) + '">' + yMax + '</text>';
  }
  days.forEach((x, i) => {
    const cx = i * (bw + gap) + bw / 2;
    const h = x.v ? Math.max(3, Math.round((base - top) * (x.v / max))) : 4;
    out += '<rect class="bar' + (i === 6 ? ' today' : '') + '" x="' + (i * (bw + gap)) + '" y="' + (base - h) +
      '" width="' + bw + '" height="' + h + '" rx="4"><title>' +
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
      // v1.9.0: the header shows a COMPACT, locale-stable count badge — the localized
      // sentence lives in the tooltip + accessible name. A long sentence ellipsised to
      // "1 muse.ai …" in every locale was the reported defect (it cannot fit beside the
      // title AND the language button in 292px, e.g. vi "Tiếng Việt" leaves ~26px).
      const full = n > 0
        ? (n === 1 ? t('museTabsFoundOne', '1 muse.ai tab open') : t('museTabsFound', '$1 muse.ai tabs open', [String(n)]))
        : t('museTabsNone', 'No muse.ai tab found');
      tx.textContent = String(n);
      el.title = full; // full text on hover
      el.setAttribute('aria-label', full);
      el.classList.toggle('on', n > 0);
    });
  } catch { /* ignore */ }
}

function refresh() {
  // NOTE: the object form of storage.get returns ONLY the listed keys — followupChips must
  // be listed (null default keeps 'absent' distinguishable from an explicit empty array).
  // v1.8.0 keys use null defaults where 'absent' must stay distinguishable (rules,
  // followupSmart, followupSchedule, digestCounters) — absent = the engine's default.
  chrome.storage.local.get({ enabled: true, minDelayMs: 300, clickCount: 0, log: [], stats: null,
    followupEnabled: false, followupPrompt: PRESETS[0], followupIdleMs: 60000, followupCooldownMs: 600000,
    followupChips: null, followupPrompts: [], followupRotateIdx: 0, followupAdvancedOpen: false,
    pauseUntil: 0, dryRun: false, allowOnceMode: false, rules: null, followupSmart: null, followupSchedule: null,
    syncSettings: false, onboarded: false, digestCounters: null, lastDigestAt: 0,
    missionEnabled: false, mission: null }, (s) => {
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
    applyV18UI(s); // v1.8.0: pause / dry-run / rules / schedule / sync / digest / onboarding
    applyFollowupUI(s);
    applyMissionUI(s); // v1.9.0: missionEnabled + the stored mission object
    renderLog(Array.isArray(s.log) ? s.log : []);
  });
}

// ======================================================================
// v1.8.0 — pause / dry-run / Safety & Control / digest / onboarding.
// Frozen contract (contracts-v18.md): every key is read with absent = default
// semantics; the popup writes ONLY contract keys, and object-valued keys
// (followupSmart / followupSchedule / rules) are merged so engine-owned extras
// (stuckPrompt / errorPrompt) are never dropped by a UI write.
// ======================================================================
const SEED_BLOCK = ['delete', 'remove', 'drop', 'wipe', 'format', 'billing', 'payment', 'invoice', 'pay',
  'transfer', 'refund', 'production', 'deploy', 'revoke', 'rm -rf', 'sudo', 'credential', 'password', 'secret', 'token'];
const RULES_MAX_ITEMS = 50;   // contract: allowTopics cap 50 items x 64 chars
const RULES_MAX_LEN = 64;
const PAUSE_15M = 15 * 60 * 1000;
const PAUSE_1H = 60 * 60 * 1000;
const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => pad2(h));

const asObj = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
function cleanList(list) {
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const s = String(raw == null ? '' : raw).trim().slice(0, RULES_MAX_LEN);
    if (!s) continue;
    if (out.some((x) => x.toLowerCase() === s.toLowerCase())) continue;
    out.push(s);
    if (out.length >= RULES_MAX_ITEMS) break;
  }
  return out;
}
// '' / null / junk must fall back to the default — Number('') is 0, which would silently
// turn an unset hour into midnight instead of the documented default
const clampHour = (v, d) => {
  const s = String(v == null ? '' : v).trim();
  if (!s) return d;
  const n = Math.round(Number(s));
  return Number.isFinite(n) && n >= 0 && n <= 23 ? n : d;
};
const hhmm = (ms) => { const d = new Date(Number(ms) || 0); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };

const v18 = { pauseUntil: 0, dryRun: false, allowOnce: false, syncSettings: false, onboarded: false, lastDigestAt: 0,
              smart: { stuckMin: 10, errorRecovery: false },
              schedule: { enabled: false, start: 8, end: 18, onlyActiveTab: false },
              counters: {}, rules: { topics: [], keywords: [], keywordsSeeded: true } };
let safetyOpen = false;
const pausedNow = () => Date.now() < (Number(v18.pauseUntil) || 0);

// ---- v1.9.1 — modal background isolation ---------------------------------------------
// The three full-popup overlays (#missionSheet / #safetyPanel / #onboard) are role="dialog"
// aria-modal="true"; aria-modal alone does NOT remove the obscured popup from the
// accessibility tree (measured: 99 interactive nodes with the Safety sheet open). While any
// one of them is open, every OTHER top-level child of <body> is made `inert`, which removes
// it from the AX tree and from hit-testing, and restores it on close. Every open/close path
// (button, Escape, programmatic) funnels through setSafety / setMissionOpen / renderOnboard,
// so this single sync keeps the background hidden in all of them. `inert` is supported by the
// extension's minimum_chrome_version (116).
// One deliberate exception: an OPEN non-modal popover that lives in the background (the
// language menu) keeps its own trigger subtree operable — making the menu the user just
// opened inert underneath them would be a worse bug than the leak it closes. The subtree that
// currently HOLDS FOCUS is likewise never made inert: Chrome blurs a focused descendant on the
// next task once an ancestor becomes inert, so inerting it would silently steal focus.
const MODAL_IDS = ['missionSheet', 'safetyPanel', 'onboard'];
function syncModalInert() {
  const body = document.body;
  if (!body) return;
  let openEl = null;
  for (const id of MODAL_IDS) { const el = $(id); if (el && !el.hidden) { openEl = el; break; } }
  const langWrap = $('langWrap');
  const active = document.activeElement;
  const kids = body.children;
  for (let i = 0; i < kids.length; i++) {
    const el = kids[i];
    if (el.tagName === 'SCRIPT') continue;
    if (!openEl || el === openEl) { el.removeAttribute('inert'); continue; }
    const holdsFocus = !!(active && active !== body && el.contains(active));
    if (holdsFocus || (langOpen && langWrap && el.contains(langWrap))) el.removeAttribute('inert');
    else el.setAttribute('inert', '');
  }
}

// ---- pause: quick durations + a state banner in the SAME 26px row -------------------
let pauseTimer = null;
function renderPause() {
  const paused = pausedNow();
  const idle = $('pauseIdle'), act = $('pauseActive');
  if (idle) idle.hidden = paused;
  if (act) act.hidden = !paused;
  if (paused) {
    const tx = $('pstateText');
    if (tx) tx.textContent = t('pauseStateUntil', 'Paused until $1', [hhmm(v18.pauseUntil)]);
  }
  if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null; }
  if (paused) {
    // flip back the moment the pause expires while the popup stays open
    const ms = Math.max(0, (Number(v18.pauseUntil) || 0) - Date.now()) + 250;
    pauseTimer = setTimeout(() => { pauseTimer = null; renderPause(); }, Math.min(ms, 2147483000));
  }
}
function setPause(until) { try { chrome.storage.local.set({ pauseUntil: until }); } catch { /* ignore */ } }
function pauseUntilTomorrow() {
  const d = new Date(); d.setHours(24, 0, 0, 0);                 // next local midnight
  if (d.getTime() - Date.now() < PAUSE_1H) d.setDate(d.getDate() + 1); // never a < 1h 'tomorrow'
  return d.getTime();
}

// ---- rules editor (allowTopics + blockKeywords) -------------------------------------
function ruleChip(s, kind, i) {
  return '<span class="rchip"><span class="rtxt" title="' + esc(s) + '">' + esc(s) + '</span>' +
    '<button type="button" class="rx" data-k="' + kind + '" data-i="' + i + '" aria-label="' +
    esc(t('rulesRemove', 'Remove') + ': ' + s) + '">&#10005;</button></span>';
}
function renderRules() {
  const tl = $('topicsList');
  if (tl) {
    tl.innerHTML = v18.rules.topics.length
      ? v18.rules.topics.map((s, i) => ruleChip(s, 'topic', i)).join('')
      : '<div class="rempty">' + esc(t('topicsEmpty', 'No topics set — every topic is allowed')) + '</div>';
  }
  const kl = $('kwList');
  if (kl) {
    kl.innerHTML = v18.rules.keywords.length
      ? v18.rules.keywords.map((s, i) => ruleChip(s, 'kw', i)).join('')
      : '<div class="rempty">' + esc(t('keywordsEmpty', 'No keywords set — nothing is blocked')) + '</div>';
  }
}
function writeRules(topics, keywords) {
  v18.rules.topics = cleanList(topics);
  v18.rules.keywords = cleanList(keywords);
  v18.rules.keywordsSeeded = false;
  try { chrome.storage.local.set({ rules: { allowTopics: v18.rules.topics.slice(), blockKeywords: v18.rules.keywords.slice() } }); } catch { /* ignore */ }
  renderRules();
}
function addRule(kind) {
  const inp = kind === 'topic' ? $('topicInput') : $('kwInput');
  if (!inp) return;
  const v = String(inp.value || '').trim();
  if (!v) { inp.focus(); return; }
  inp.value = '';
  if (kind === 'topic') writeRules(v18.rules.topics.concat([v]), v18.rules.keywords);
  else writeRules(v18.rules.topics, v18.rules.keywords.concat([v]));
  inp.focus();
}
function removeRule(kind, i) {
  if (kind === 'topic') writeRules(v18.rules.topics.filter((_, j) => j !== i), v18.rules.keywords);
  else writeRules(v18.rules.topics, v18.rules.keywords.filter((_, j) => j !== i));
}
// replacing the keyword list is a two-step inline confirm (same pattern as 'Starter
// rotation'): the first tap arms the button, a second tap within 5s performs the reset
let kwResetArmed = false;
let kwResetTimer = null;
function kwResetDisarm() {
  if (kwResetTimer) { clearTimeout(kwResetTimer); kwResetTimer = null; }
  if (!kwResetArmed) return;
  kwResetArmed = false;
  const b = $('kwReset');
  if (b) { b.textContent = t('keywordsReset', 'Reset to defaults'); b.classList.remove('armed'); }
}
function kwResetArm() {
  kwResetArmed = true;
  const b = $('kwReset');
  if (b) { b.textContent = t('keywordsResetConfirm', 'Reset the list? Tap again'); b.classList.add('armed'); }
  if (kwResetTimer) clearTimeout(kwResetTimer);
  kwResetTimer = setTimeout(() => { kwResetTimer = null; kwResetDisarm(); }, 5000);
}

// ---- schedule / smart recovery / sync ------------------------------------------------
function renderSchedule() {
  const en = $('schEnabled');
  if (en) en.checked = v18.schedule.enabled === true;
  const st = $('schStart'), ed = $('schEnd');
  if (st && ed) {
    if (!st.options.length) for (const h of HOUR_LABELS) { st.appendChild(new Option(h, h)); ed.appendChild(new Option(h, h)); }
    if (document.activeElement !== st) st.value = pad2(v18.schedule.start);
    if (document.activeElement !== ed) ed.value = pad2(v18.schedule.end);
  }
  const ac = $('schActive');
  if (ac) ac.checked = v18.schedule.onlyActiveTab === true;
}
function writeSchedule() {
  try {
    chrome.storage.local.get({ followupSchedule: null }, (s) => {
      const cur = asObj(s.followupSchedule);
      const next = Object.assign({}, cur, {
        enabled: !!($('schEnabled') || {}).checked,
        start: clampHour(($('schStart') || {}).value, 8),
        end: clampHour(($('schEnd') || {}).value, 18),
        onlyActiveTab: !!($('schActive') || {}).checked,
      });
      chrome.storage.local.set({ followupSchedule: next });
    });
  } catch { /* ignore */ }
}
function renderSmart() {
  const st = $('stuckMin');
  if (st && document.activeElement !== st) st.value = String(v18.smart.stuckMin);
  const er = $('errRec');
  if (er) er.checked = v18.smart.errorRecovery === true;
}
function writeSmart(patch) {
  try {
    chrome.storage.local.get({ followupSmart: null }, (s) => {
      chrome.storage.local.set({ followupSmart: Object.assign({}, asObj(s.followupSmart), patch) });
    });
  } catch { /* ignore */ }
}
function renderSync() {
  const el = $('syncSet');
  if (el) el.checked = v18.syncSettings === true;
}

// ---- 'While you were away' digest (digestCounters + lastDigestAt) --------------------
function renderDigest() {
  const c = asObj(v18.counters);
  const clicks = Number(c.clicks) || 0, fups = Number(c.followups) || 0, blocked = Number(c.blocked) || 0;
  const n = clicks + fups + blocked;
  const band = $('digest');
  if (band) band.hidden = n <= 0;
  if (n > 0) {
    const putEl = (id, v) => { const el = $(id); if (el) el.textContent = String(v); };
    putEl('dClicks', clicks); putEl('dFollowups', fups); putEl('dBlocked', blocked);
    const since = $('dSince');
    if (since) {
      since.textContent = v18.lastDigestAt > 0
        ? t('digestSince', 'since $1', [localFull(new Date(v18.lastDigestAt).toISOString())])
        : t('digestSinceStart', 'since you started');
    }
  }
  renderLogTop();
}
function renderDry() {
  const db = $('dryBand');
  if (db) db.hidden = v18.dryRun !== true;
  const chip = $('safetyChip');
  if (chip) {
    chip.hidden = v18.dryRun !== true;
    if (v18.dryRun === true) chip.textContent = t('dryRunChip', 'Dry-run');
  }
  renderLogTop();
}
function renderLogTop() {
  const top = $('logTop');
  if (!top) return;
  const dg = $('digest');
  top.hidden = !(v18.dryRun === true || (dg && !dg.hidden));
}

// ---- Safety & Control panel (full-popup overlay) -------------------------------------
function setSafety(open) {
  safetyOpen = !!open;
  const p = $('safetyPanel');
  if (p) p.hidden = !safetyOpen;
  const b = $('safetyBtn');
  if (b) b.setAttribute('aria-expanded', safetyOpen ? 'true' : 'false');
  if (safetyOpen) {
    renderRules(); renderSchedule(); renderSmart(); renderSync();
    const dr = $('dryRun'); if (dr) dr.checked = v18.dryRun === true;
    const ao = $('allowOnce'); if (ao) ao.checked = v18.allowOnce === true;
    const c = $('safetyClose'); if (c) c.focus();
  } else {
    kwResetDisarm();
  }
  syncModalInert();
}

// ---- onboarding wizard (3 steps, shown while onboarded !== true) ---------------------
let obStep = 0;
const OB_STEPS = [
  { title: ['onbStep1Title', 'Turn on auto-click'], body: ['onbStep1Body', 'Muse asks for approval often. Let the extension click Allow for you — you can pause it any time.'],
    primary: ['onbEnable', 'Turn on'], act: 'enable' },
  // v1.9.3 — the dry-run step is now the CONSENT step: a fresh install ALREADY starts in
  // logging-only mode (background.js migrate() seeds dryRun:true when absent), so this step
  // states that plainly, shows the live logging-only state, and offers the one-tap opt-in to
  // live clicking. Skipping the wizard keeps logging-only mode (the safe default).
  { title: ['onbStep2Title', 'You start in logging-only mode'], body: ['onbStep2Body', 'Fresh installs start in logging-only mode: the extension detects and logs what it would click, but nothing is clicked until you turn live clicking on.'],
    primary: ['onbLive', 'Turn on live clicking'], act: 'live' },
  { title: ['onbStep3Title', 'Pick a follow-up'], body: ['onbStep3Body', 'One tap sets the prompt that keeps Muse working when it goes idle. You can change it later.'],
    primary: ['onbDone', 'Done'], act: 'done' },
];
function renderOnboard() {
  const ov = $('onboard');
  if (!ov) return;
  const show = v18.onboarded !== true;
  ov.hidden = !show;
  syncModalInert();
  if (!show) return;
  const step = OB_STEPS[obStep] || OB_STEPS[0];
  const ti = $('obTitle'), bo = $('obBody'), pr = $('obPrimary');
  if (ti) ti.textContent = t(step.title[0], step.title[1]);
  if (bo) bo.textContent = t(step.body[0], step.body[1]);
  if (pr) pr.textContent = t(step.primary[0], step.primary[1]);
  // the dry-run step carries the LIVE state + the consent line (never a colour-only signal:
  // the chip is text from the shipped dryRunBanner key, and it disappears the moment live
  // clicking is on — so it can never claim 'nothing will be clicked' while the engine clicks)
  const st = $('obDryState'); if (st) st.hidden = !(obStep === 1 && v18.dryRun === true);
  const cs = $('obConsent'); if (cs) cs.hidden = obStep !== 1;
  const q = $('obQuick'); if (q) q.hidden = obStep !== 2;
  const bk = $('obBack'); if (bk) bk.hidden = obStep === 0;
  const sc = $('obStep'); if (sc) sc.textContent = t('onbStepCount', 'Step $1 of $2', [String(obStep + 1), '3']);
  document.querySelectorAll('.obdot').forEach((d) => d.classList.toggle('on', Number(d.dataset.s) <= obStep));
}
function obPrimary() {
  const step = OB_STEPS[obStep] || OB_STEPS[0];
  if (step.act === 'enable') { try { chrome.storage.local.set({ enabled: true }); } catch { /* ignore */ } obStep = 1; renderOnboard(); return; }
  if (step.act === 'live') {
    // the one-tap opt-in: an EXPLICIT dryRun:false (never a delete — the engine's absent-key
    // default stays false, but the stored value is the user's recorded choice)
    v18.dryRun = false;
    try { chrome.storage.local.set({ dryRun: false }); } catch { /* ignore */ }
    obStep = 2; renderOnboard(); return;
  }
  finishOnboard();
}
function finishOnboard() {
  v18.onboarded = true;
  obStep = 0;
  try { chrome.storage.local.set({ onboarded: true }); } catch { /* ignore */ }
  renderOnboard();
}

// ---- apply the v1.8 storage snapshot to the UI ---------------------------------------
function applyV18UI(s) {
  v18.pauseUntil = Number(s.pauseUntil) || 0;
  v18.dryRun = s.dryRun === true;
  v18.allowOnce = s.allowOnceMode === true;
  v18.syncSettings = s.syncSettings === true;
  v18.onboarded = s.onboarded === true;
  v18.counters = asObj(s.digestCounters);
  v18.lastDigestAt = Number(s.lastDigestAt) || 0;
  const rules = s.rules === null || s.rules === undefined ? null : asObj(s.rules);
  const hasKw = !!(rules && Array.isArray(rules.blockKeywords));
  v18.rules.topics = cleanList(rules && rules.allowTopics);
  // absent blockKeywords = the engine's shipped seed list (shown pre-loaded, not written)
  v18.rules.keywords = hasKw ? cleanList(rules.blockKeywords) : SEED_BLOCK.slice();
  v18.rules.keywordsSeeded = !hasKw;
  const sm = asObj(s.followupSmart);
  const stuck = Number(sm.stuckMin);
  v18.smart = { stuckMin: Number.isFinite(stuck) ? Math.max(0, Math.round(stuck)) : 10, errorRecovery: sm.errorRecovery === true };
  const sc = asObj(s.followupSchedule);
  v18.schedule = { enabled: sc.enabled === true, start: clampHour(sc.start, 8), end: clampHour(sc.end, 18), onlyActiveTab: sc.onlyActiveTab === true };
  renderPause();
  renderDry();
  renderDigest();
  renderSchedule();
  renderSmart();
  renderSync();
  renderOnboard();
  if (safetyOpen) renderRules();
}

// ======================================================================
// v1.8.1 — Language switcher UI: compact header button + anchored dropdown.
// ======================================================================
let langOpen = false;

function renderLang() {
  const btn = $('langBtn');
  if (!btn) return;
  const label = userLocale === 'auto' ? t('langAuto', 'Auto') : (LANG_NATIVE[userLocale] || userLocale);
  const tx = $('langBtnText');
  if (tx) tx.textContent = label;
  const aria = t('langMenuAria', 'Language');
  btn.setAttribute('aria-label', aria + ': ' + label);
  btn.title = aria;
  const menu = $('langMenu');
  if (menu) menu.setAttribute('aria-label', aria);
}

function renderLangMenu() {
  const menu = $('langMenu');
  if (!menu) return;
  const rows = [['auto', t('langAutoBrowser', 'Auto (browser)')]].concat(LOCALE_IDS.map((id) => [id, LANG_NATIVE[id]]));
  menu.innerHTML = rows.map(([id, label]) =>
    '<button type="button" class="langitem' + (id === userLocale ? ' on' : '') + '" role="menuitemradio" data-lang="' + id +
    '" aria-checked="' + (id === userLocale) + '">' +
    '<span class="lcheck" aria-hidden="true">' + (id === userLocale ? '\u2713' : '') + '</span>' +
    '<span class="ltxt">' + esc(label) + '</span></button>').join('');
  menu.querySelectorAll('[data-lang]').forEach((el) => {
    el.addEventListener('click', () => { applyLocale(el.dataset.lang); });
  });
}

function openLangMenu(focusItem) {
  const menu = $('langMenu'), btn = $('langBtn');
  if (!menu || !btn) return;
  langOpen = true;
  menu.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  syncModalInert(); // an open popover keeps its own subtree operable (see syncModalInert)
  if (focusItem) {
    const target = menu.querySelector('.langitem.on') || menu.querySelector('.langitem');
    if (target) target.focus();
  }
}

function closeLangMenu(refocus) {
  const menu = $('langMenu'), btn = $('langBtn');
  if (!menu || !btn) return;
  const wasOpen = langOpen;
  langOpen = false;
  menu.hidden = true;
  btn.setAttribute('aria-expanded', 'false');
  if (refocus && wasOpen) btn.focus();
  syncModalInert(); // the popover is gone again — restore the modal background isolation
}

function moveLangFocus(delta) {
  const menu = $('langMenu');
  if (!menu) return;
  const items = Array.prototype.slice.call(menu.querySelectorAll('.langitem'));
  if (!items.length) return;
  const i = items.indexOf(document.activeElement);
  const from = i < 0 ? (delta > 0 ? -1 : 0) : i;
  items[(from + delta + items.length) % items.length].focus();
}

// Apply + persist a language, then re-render every visible string WITHOUT reopening the
// popup: applyI18n() re-walks the static markup and refresh() re-renders the storage-driven
// strings (log, follow-up status, pause, rules, digest) through the same path as boot.
async function applyLocale(lang) {
  userLocale = LOCALE_IDS.indexOf(lang) >= 0 ? lang : 'auto';
  try { chrome.storage.local.set({ userLocale }); } catch { /* ignore */ }
  if (userLocale !== 'auto') {
    try { await loadLocale(userLocale); } catch { manualMsgs = null; manualLocale = null; }
  }
  renderLang();
  renderLangMenu();
  applyI18n();
  refresh();
  refreshMuseStat();
  closeLangMenu(true); // focus returns to the button
}

$('langBtn').addEventListener('click', (e) => { e.stopPropagation(); if (langOpen) closeLangMenu(true); else openLangMenu(true); });
// one document-level handler serves the button AND the open menu (keydown bubbles)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && langOpen) { e.preventDefault(); closeLangMenu(true); return; }
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  if (!langOpen && document.activeElement !== $('langBtn')) return;
  e.preventDefault();
  if (!langOpen) openLangMenu(true); else moveLangFocus(e.key === 'ArrowDown' ? 1 : -1);
});
document.addEventListener('click', (e) => {
  if (!langOpen) return;
  const wrap = $('langWrap');
  if (wrap && !wrap.contains(e.target)) closeLangMenu(false);
});
// keep two popups (or a programmatic write) in sync; applyLocale() is a no-op when the
// value already matches, so this cannot loop
chrome.storage.onChanged.addListener((ch) => {
  if (!ch || !ch.userLocale) return;
  const next = LOCALE_IDS.indexOf(ch.userLocale.newValue) >= 0 ? ch.userLocale.newValue : 'auto';
  if (next !== userLocale) applyLocale(next);
});

// ======================================================================
// v1.9.0 — Mission Orchestrator UI.
// The ENGINE (mission corpus + state machine) ships in content.js and is FROZEN
// (docs/MISSION_V19.md); this surface only DRIVES it through the frozen keys —
// missionEnabled + mission{id,step,cycles,startedAt,lastSentAt} (absent = none) — and
// reads the APPLIED state back from the followup-status ping. Step DIRECTIVES stay
// English (the shipped, reviewed text); names/labels/descriptions are localized x6.
// The entry lives on the Auto-follow-up header row and opens a FULL-POPUP sheet (the
// Safety-panel pattern), so the rich surface never grows the popup (<=600px everywhere).
// ======================================================================
const MISSION_META = [
  { id: 'golive-ready', nameKey: 'missionGolive', descKey: 'missionGoliveDesc', steps: 6 },
  { id: 'audit-only', nameKey: 'missionAudit', descKey: 'missionAuditDesc', steps: 4 },
  { id: 'fix-findings', nameKey: 'missionFix', descKey: 'missionFixDesc', steps: 4 },
  { id: 'release-prep', nameKey: 'missionRelease', descKey: 'missionReleaseDesc', steps: 4 },
];
const MISSION_BY_ID = new Map(MISSION_META.map((m) => [m.id, m]));
const missionStepsOfId = (id) => { const m = MISSION_BY_ID.get(id); return m ? m.steps : 0; };
const missionNameOf = (id) => { const m = MISSION_BY_ID.get(id); return m ? t(m.nameKey, id) : String(id || ''); };

let misOpen = false;
let misEnabled = false;      // mirror of storage `missionEnabled`
let misStore = null;         // stored mission {id,step,cycles,...} or null (= none)
let misCompleted = null;     // {id,cycles} of the last completion found in the log
let misSendNoteTimer = null;

const misActiveNow = () => !!(misEnabled && misStore && MISSION_BY_ID.has(misStore.id));
// The progress numbers: prefer the APPLIED ping (fresher) when it reports the same
// mission, else the stored shape. n is 1-based (the step the NEXT send will carry).
function misProgress() {
  if (!misStore) return null;
  const p = fAgg && fAgg.mission;
  if (p && p.active && p.id === misStore.id) {
    return { N: Number(p.steps) || missionStepsOfId(misStore.id) || 1, step: Number(p.step) || 0, cyc: Number(p.cycles) || 0, text: String(p.stepText || '') };
  }
  return { N: missionStepsOfId(misStore.id) || 1, step: Number(misStore.step) || 0, cyc: Number(misStore.cycles) || 0, text: '' };
}
const misStepLine = (pg) => t('missionProgress', 'step $1/$2 · cycle $3', [String(pg.step + 1), String(pg.N), String(pg.cyc + 1)]);
// the last completed mission (the log is the durable record — it survives without a live tab)
function scanCompletion(log) {
  const arr = Array.isArray(log) ? log : [];
  for (const e of arr) {
    if (e && e.kind === 'mission' && e.mission && e.mission.complete === true) return { id: e.mission.id, cycles: e.mission.cycles };
  }
  return null;
}
function renderMissionList() {
  const box = $('misList');
  if (!box) return;
  box.setAttribute('aria-label', t('missionTitle', 'Missions'));
  box.innerHTML = MISSION_META.map((m) => {
    const on = !!(misEnabled && misStore && misStore.id === m.id);
    const desc = t(m.descKey, '');
    return '<button type="button" class="misrow' + (on ? ' on' : '') + '" role="radio" aria-checked="' + on +
      '" data-mid="' + esc(m.id) + '" title="' + esc(desc) + '">' +
      '<span class="misname">' + esc(t(m.nameKey, m.id)) + '</span>' +
      '<span class="miscount">' + esc(t('missionSteps', '$1 steps', [String(m.steps)])) + '</span>' +
      '<span class="misdesc">' + esc(desc) + '</span></button>';
  }).join('');
}
function renderMissionLast() {
  const el = $('misLast');
  if (!el) return;
  const done = (fAgg && fAgg.mission && fAgg.mission.completedId) || (misCompleted && misCompleted.id) || '';
  if (done) { el.hidden = false; el.textContent = t('missionLastDone', 'Last completed: $1', [missionNameOf(done)]); }
  else { el.hidden = true; el.textContent = ''; }
}
function renderMission() {
  const active = misActiveNow();
  const prog = misProgress();
  const btn = $('misbtn'), dot = $('misdot');
  if (btn) {
    btn.classList.toggle('on', active);
    // the accessible name carries the live state (the visual is a pill + dot)
    btn.setAttribute('aria-label', active && prog ? t('missionTitle', 'Missions') + ' — ' + misStepLine(prog) : t('missionTitle', 'Missions'));
  }
  if (dot) dot.hidden = !active;
  const en = $('missionEnabled');
  if (en) en.checked = misEnabled;
  const gate = $('missionGate');
  if (gate) gate.hidden = !!($('followupEnabled') && $('followupEnabled').checked);
  const block = $('misActive');
  if (block) block.hidden = !active;
  if (active && prog) {
    const pp = $('misProg');
    if (pp) pp.textContent = misStepLine(prog);
    const cy = $('misCyc');
    if (cy) cy.textContent = missionNameOf(misStore.id);
    const st = $('misStepText');
    if (st) { const tx = prog.text || ''; st.textContent = tx; st.title = tx; st.hidden = !tx; }
  }
  // 'Pause mission' reuses the ONE pause (pauseUntil): paused -> the same button resumes
  const pause = $('misPause');
  if (pause) pause.textContent = pausedNow() ? t('pauseResume', 'Resume') : t('missionPause', 'Pause mission');
  renderMissionList();
  renderMissionLast();
}
function misSendNote(text) {
  const el = $('misSendNote');
  if (!el) return;
  if (misSendNoteTimer) { clearTimeout(misSendNoteTimer); misSendNoteTimer = null; }
  el.textContent = text || '';
  if (!text) return;
  misSendNoteTimer = setTimeout(() => { misSendNoteTimer = null; el.textContent = ''; }, 8000);
}
function setMissionOpen(open) {
  const next = !!open;
  misOpen = next;
  const sh = $('missionSheet');
  if (sh) sh.hidden = !next;
  const b = $('misbtn');
  if (b) b.setAttribute('aria-expanded', next ? 'true' : 'false');
  if (next) {
    if (safetyOpen) setSafety(false);   // one overlay at a time
    if (fSheetMode) fSheet('');
    if (langOpen) closeLangMenu(false);
    renderMission();
    const c = $('missionClose');
    if (c) c.focus();
  }
  syncModalInert();
}
function applyMissionUI(s) {
  misEnabled = s.missionEnabled === true;
  const m = s.mission;
  misStore = (m && typeof m === 'object' && !Array.isArray(m) && MISSION_BY_ID.has(m.id)) ? m : null;
  misCompleted = scanCompletion(s.log);
  renderMission();
}

async function boot() {
  try {
    const s = await chrome.storage.local.get({ userLocale: 'auto' });
    userLocale = LOCALE_IDS.indexOf(s.userLocale) >= 0 ? s.userLocale : 'auto';
  } catch { userLocale = 'auto'; }
  if (userLocale !== 'auto') {
    try { await loadLocale(userLocale); } catch { manualMsgs = null; manualLocale = null; }
  }
  renderLang();
  renderLangMenu();
  applyI18n();
  refresh();
  refreshMuseStat();
}
boot();

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
// progressive disclosure: one control reveals the settings a user touches once
$('fadvbtn').addEventListener('click', () => {
  const next = !advancedOpen;
  if (!next) fSheet(''); // collapsing the group closes any sheet it owns
  setAdvancedOpen(next);
});
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
// ---- v1.7.0 fix (N5): replacing a saved rotation is a confirm step --------------
// Only when a NON-EMPTY list would be replaced. Two-step inline confirm: the first tap
// arms the button with the question, a second tap within 5 s performs the replace
// (native dialogs are unreliable inside a browser-action popup).
let fStarterArmed = false;
let fStarterTimer = null;
function fStarterDisarm() {
  if (fStarterTimer) { clearTimeout(fStarterTimer); fStarterTimer = null; }
  if (!fStarterArmed) return;
  fStarterArmed = false;
  const b = $('frotstarter');
  if (b) { b.textContent = t('followupRotateStarter', 'Starter rotation'); b.classList.remove('on'); }
}
$('frotstarter').addEventListener('click', () => {
  const b = $('frotstarter');
  if (fRotItems.length && !fStarterArmed) {
    fStarterArmed = true;
    if (b) {
      b.textContent = t('followupRotateStarterConfirm', 'Replace your $1 saved combos? Tap again', [String(fRotItems.length)]);
      b.classList.add('on');
    }
    if (fStarterTimer) clearTimeout(fStarterTimer);
    fStarterTimer = setTimeout(() => { fStarterTimer = null; fStarterDisarm(); }, 5000);
    return;
  }
  fStarterDisarm();
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
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  // v1.9.0: Escape closes the mission sheet and returns focus to its entry
  if (misOpen) { setMissionOpen(false); const mb = $('misbtn'); if (mb) mb.focus(); return; }
  if (safetyOpen) { setSafety(false); return; } // v1.8.0: Escape closes the Safety panel first
  if (fSheetMode) { fSheet(''); return; }       // then the phrase-library sheet
  // progressive disclosure: Escape closes the Advanced group and returns focus to its button
  if (advancedOpen) { setAdvancedOpen(false); const b = $('fadvbtn'); if (b) b.focus(); }
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
// ---- v1.7.0 fix (N3): 'Send now' must never fail silently ----------------------
// The engine answers { ok, reason } per tab (disabled | sending | approval-present |
// no-composer | composer-not-empty | no-prompt | type-failed | attempted | dead — see
// content.js followupAttempt). When NO tab accepted the send, the first reason is shown
// inline next to the button (#fsendnote, role=status so screen readers hear it too).
// A successful send keeps the existing 'Follow-up sent HH:MM' pill path (2.5 s poll).
// Coverage contract: EVERY reason the engine's followupAttempt can return as a FAILURE must
// have an entry here (success reasons 'attempted' / 'dry-run' are never looked up — the note
// is only shown when no tab accepted the send). scripts/bench/experience.mjs asserts this
// against the reason strings enumerated from content.js, so a future reason cannot silently
// fall back to the generic line.
const SEND_BLOCKED_KEY = {
  'approval-present': ['followupSendBlockedApproval', "Couldn't send — Muse is waiting for your approval"],
  'composer-not-empty': ['followupSendBlockedDraft', "Couldn't send — Muse's message box already has text"],
  'no-composer': ['followupSendBlockedComposer', "Couldn't send — no message box found on the Muse page"],
  'type-failed': ['followupSendBlockedComposer', "Couldn't send — no message box found on the Muse page"],
  'no-prompt': ['followupSendBlockedNoPrompt', "Couldn't send — no follow-up prompt is set"],
  'sending': ['followupSendBlockedSending', 'A follow-up is already being sent'],
  'disabled': ['followupSendNowHint', 'Enable Auto follow-up first'],
  'paused': ['followupSendBlockedPaused', "Couldn't send — automation is paused"],
  'schedule': ['followupSendBlockedSchedule', "Couldn't send — outside the follow-up hours"],
  'dead': ['followupSendBlockedDead', "Couldn't send — the Muse tab is not responding"],
};
let fSendNoteTimer = null;
function fSendNote(text) {
  const el = $('fsendnote');
  if (!el) return;
  if (fSendNoteTimer) { clearTimeout(fSendNoteTimer); fSendNoteTimer = null; }
  el.textContent = text || '';
  if (!text) return;
  fSendNoteTimer = setTimeout(() => { fSendNoteTimer = null; el.textContent = ''; }, 8000);
}
// v1.9.0: shared by the panel's 'Send now' and the mission sheet's 'Send step now'. When a
// mission is active the engine sends the CURRENT mission step through this same path (manual
// 'send now' respects the mission rules — pause/approval/composer — and advances only on a
// verified send); only the inline note target differs.
function doFollowupSend(note) {
  note(''); // a new attempt supersedes the previous reason
  try {
    chrome.tabs.query({ url: ['https://muse.ai/*', 'https://*.muse.ai/*'] }, (tabs) => {
      const list = tabs || [];
      if (!list.length) { note(t('museTabsNone', 'No muse.ai tab found')); return; }
      let pending = list.length, anyOk = false, firstFail = '';
      const settle = () => {
        if (--pending > 0) return;
        if (anyOk) return; // a tab took the send — the status pill reports the outcome
        const k = SEND_BLOCKED_KEY[firstFail] || ['followupSendBlocked', "Couldn't send the follow-up"];
        note(t(k[0], k[1]));
      };
      list.forEach((tb) => {
        let settled = false;
        const done = () => { if (settled) return; settled = true; settle(); };
        try {
          chrome.tabs.sendMessage(tb.id, { type: 'followup-send-now' }, (r) => {
            void chrome.runtime.lastError; // no content script in that tab — a failed target
            if (r && r.ok) anyOk = true;
            else if (!firstFail) firstFail = (r && typeof r.reason === 'string') ? r.reason : 'dead';
            done();
          });
        } catch { if (!firstFail) firstFail = 'dead'; done(); }
        setTimeout(() => { if (!firstFail && !anyOk) firstFail = 'dead'; done(); }, 800); // a tab that never answers
      });
      setTimeout(refreshFollowupStatus, 1500);
    });
  } catch { /* ignore */ }
}
$('fsendnow').addEventListener('click', () => doFollowupSend(fSendNote));
refresh(); // boot: apply the stored state immediately (was missing — popup rendered default DOM until the first storage event)
refreshFollowupStatus();
setInterval(refreshFollowupStatus, 2500);
chrome.storage.onChanged.addListener(refresh);

// ---- v1.8.0 wiring: pause / Safety panel / rules / schedule / smart / sync / onboarding ----
$('p15').addEventListener('click', () => setPause(Date.now() + PAUSE_15M));
$('p60').addEventListener('click', () => setPause(Date.now() + PAUSE_1H));
$('ptom').addEventListener('click', () => setPause(pauseUntilTomorrow()));
$('presume').addEventListener('click', () => setPause(0));
$('safetyBtn').addEventListener('click', () => setSafety(!safetyOpen));
$('safetyClose').addEventListener('click', () => setSafety(false));
$('topicAdd').addEventListener('click', () => addRule('topic'));
$('kwAdd').addEventListener('click', () => addRule('kw'));
$('kwReset').addEventListener('click', () => {
  if (!kwResetArmed) { kwResetArm(); return; }
  kwResetDisarm();
  writeRules(v18.rules.topics, SEED_BLOCK.slice()); // back to the shipped seed list
});
$('topicsList').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) removeRule(b.dataset.k, Number(b.dataset.i)); });
$('kwList').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) removeRule(b.dataset.k, Number(b.dataset.i)); });
$('topicInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addRule('topic'); } });
$('kwInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addRule('kw'); } });
$('dryRun').addEventListener('change', () => { try { chrome.storage.local.set({ dryRun: $('dryRun').checked }); } catch { /* ignore */ } });
$('allowOnce').addEventListener('change', () => { try { chrome.storage.local.set({ allowOnceMode: $('allowOnce').checked }); } catch { /* ignore */ } });
$('syncSet').addEventListener('change', () => { try { chrome.storage.local.set({ syncSettings: $('syncSet').checked }); } catch { /* ignore */ } });
$('schEnabled').addEventListener('change', writeSchedule);
$('schStart').addEventListener('change', writeSchedule);
$('schEnd').addEventListener('change', writeSchedule);
$('schActive').addEventListener('change', writeSchedule);
$('stuckMin').addEventListener('change', () => {
  const v = Math.max(0, Math.min(1440, Math.round(Number($('stuckMin').value) || 0)));
  $('stuckMin').value = v;
  writeSmart({ stuckMin: v });
});
$('errRec').addEventListener('change', () => writeSmart({ errorRecovery: $('errRec').checked }));
// onboarding wizard
$('obPrimary').addEventListener('click', obPrimary);
$('obBack').addEventListener('click', () => { obStep = Math.max(0, obStep - 1); renderOnboard(); });
$('obSkip').addEventListener('click', finishOnboard);
[0, 1, 2].forEach((i) => {
  const b = $('obq' + i);
  if (b) b.addEventListener('click', () => {
    try { chrome.storage.local.set({ followupEnabled: true, followupPrompt: PRESETS[i], followupChips: [] }); } catch { /* ignore */ }
    finishOnboard();
  });
});

// ---- v1.9.0 wiring: the Missions sheet (entry -> full-popup overlay) -----------------
$('misbtn').addEventListener('click', () => setMissionOpen(!misOpen));
$('missionClose').addEventListener('click', () => setMissionOpen(false));
// the enable switch writes the frozen key `missionEnabled` (default false; nothing auto-starts)
$('missionEnabled').addEventListener('change', () => {
  try { chrome.storage.local.set({ missionEnabled: $('missionEnabled').checked }); } catch { /* ignore */ }
});
// selecting a mission STARTS it: write the frozen `mission` object (step 0 / cycle 0) AND switch
// `missionEnabled` on, so the very next idle send carries that mission's first step.
$('misList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-mid]');
  if (!b || !MISSION_BY_ID.has(b.dataset.mid)) return;
  misSendNote('');
  try { chrome.storage.local.set({ missionEnabled: true, mission: { id: b.dataset.mid, step: 0, cycles: 0, startedAt: Date.now(), lastSentAt: 0 } }); } catch { /* ignore */ }
});
// 'Send step now' rides the SAME manual send path (the engine sends the CURRENT step)
$('misSendNow').addEventListener('click', () => doFollowupSend(misSendNote));
// 'Pause mission' reuses the ONE pause semantic (pauseUntil) — no second pause is invented
$('misPause').addEventListener('click', () => { if (pausedNow()) setPause(0); else setPause(Date.now() + PAUSE_1H); });
