// Muse Auto-Allow — Codex (ChatGPT) content script (v1.10.0).
// Automatically clicks the AFFIRMATIVE option on Codex approval requests on
// chatgpt.com, so a long-running Codex task keeps working while you are away.
// This is a SEPARATE, opt-in feature (storage `codexEnabled`, default false) —
// with it off this script reads settings and does nothing else.
//
// Labels mirror the shipped Codex vocabulary (learned from the Codex approval
// prompt family): "Yes, proceed" (one-shot), "Yes, and don't ask again …"
// (standing grant — never clicked unless YOLO is on), "No, and tell Codex what
// to do differently" (never clicked). Matching is English-label based; a
// non-English ChatGPT UI matches nothing and the engine fails closed.
//
// Click paths, in priority order:
//  P. Pair heuristic — an affirmative button whose nearest button container
//     holds exactly one clickable affirmative (itself, best-ranked) AND a
//     clickable negative counterpart -> click the affirmative.
//  E. Collapsed pending card ("Allow Codex to …") -> click to expand; the
//     revealed pair is approved on the next sweep (path P).
//  R. Review bar ("A task needs your approval" + Review/Open) -> click so the
//     approvals panel renders; the pair is approved on the next sweep.
//
// Safety rails (same discipline as the Muse engine — the rails ARE the product):
//  - Never clicks Deny/Reject/Decline/No/Cancel/Stop/… anywhere (an explicit
//    negative-text skip runs before every other check on every path).
//  - Never clicks a lone affirmative — the negative must sit in the SAME
//    button container and be clickable (adjacent-pair rule).
//  - Auth/connector surfaces (Connect, Authorize, Sign in, link account,
//    API key/token wording) are USER-INPUT surfaces: the whole container is
//    hard-blocked on every path, even when an Allow/Deny-like pair renders
//    inside it (the consent boundary — never automated).
//  - Consent/notification/permission wording (notifications, camera,
//    microphone, location, clipboard, newsletter/subscribe/cookies/marketing)
//    is skipped; permission wording can never be overridden by approval copy.
//  - Standing grants ("Always allow", "Yes, and don't ask again …", "Allow for
//    this session") are NOT recognized by default — no silent scope escalation.
//    YOLO mode (the shared explicit opt-in) makes them clickable options; the
//    ranking still prefers the narrowest recognized grant.
//  - Block keywords (the shared `rules.blockKeywords` list — seed list when
//    absent; keep in lockstep with content.js BLOCK_SEED, enforced by
//    scripts/lint.mjs) and a non-empty allowTopics list (the Codex topic is
//    always 'chatgpt.com') can block a card; the refusal is logged once.
//  - Never clicks inside <a> or a <form>-tied button; real visibility checks.
//  - One click per element (WeakSet), one affirmative click per pair scope,
//    a 5s fingerprint dedup (button-anchored context — same scope rule as the
//    Muse engine), per-text cooldowns on expand/bar clicks, expand/bar clicks
//    rate-capped at 30/min and affirmative clicks at 30/min.
//  - Fail closed: unknown state does nothing. pauseUntil halts everything;
//    dryRun logs ('codex-*-dry') and clicks nothing.
//  - Liveness guard: if the extension context is invalidated, the script
//    stops itself.
//  - chatgpt.com only — a hard hostname guard backs the manifest's match; the
//    localhost allowance exists solely for the test-harness copy.
//
// Storage contracts (shared with the Muse engine — same keys, same shapes):
//  - codexEnabled (bool, default false): the feature's own switch (popup > Safety &
//    Control panel — the same home as YOLO; see popup.js setSafety()).
//  - pauseUntil / dryRun / yoloMode / allowOnceMode / minDelayMs / rules:
//    shared with content.js, applied with the same absent=default semantics.
//  - log entries: kind 'codex-allow' | 'codex-expand' | 'codex-open-panel'
//    (+ '-dry'), or 'blocked' with blockedReason; context encrypted at rest
//    with the same per-install AES-GCM key; clickCount + stats.byDay/
//    byMonth/byYear/byTopic (topic 'chatgpt.com') + digestCounters ride the
//    SAME serialized flush, under the SAME Web Lock ('maa-record-v1') as
//    content.js — parallel muse.ai/chatgpt tabs cannot lose a write.
(() => {
  if (window.__codexAutoAllowLoaded) return;
  window.__codexAutoAllowLoaded = true;
  try { document.documentElement.setAttribute('data-codex-auto-allow', '1'); } catch {}
  // Interact ONLY on chatgpt.com (defense-in-depth: the manifest match scopes us;
  // the localhost allowance exists solely for the test-harness copy).
  const ON_CHATGPT = /(^|\.)chatgpt\.com$/.test(location.hostname) || location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  if (!ON_CHATGPT) return;

  // ---- affirmative labels (one-shot preferred) ----------------------------------
  // Base positive: allow / approve / proceed (+ yes-prefix), optional one-shot tail.
  const POS_RE = /^\s*(yes[,\s]+)?(allow|approve|proceed)(\s+(once(\s+only)?|this\s+time|only))?\s*$/i;
  // Standing grants — recognized ONLY while yoloMode is on (explicit opt-in).
  const STANDING_RE = /^\s*(always\s+(allow|approve)|(allow|approve)\s+for\s+(this|the)\s+(site|task|session|command|chat|conversation)|yes[,\s]+and\s+don'?t\s+ask\s+again(\s+for\b[\s\S]*)?|don'?t\s+ask\s+again)\s*$/i;
  // Negative wording — never clicked, and the required counterpart for the pair rule.
  // "no\b" deliberately does NOT match "notifications" ("no"+"t" has no word boundary).
  const NEG_RE = /^\s*(no\b|not\s+now\b|deny\b|reject\b|decline\b|cancel\b|stop\b|abort\b|dismiss\b|keep\s+waiting\b|don'?t\s+(allow|approve|proceed)\b)/i;
  // Trailing decoration (chevrons/menus) tolerated on a label, as in the Muse engine.
  const DECOR_TAIL_RE = /[\s\u25be\u25b4\u2304\u2303\u02c5\u02c4\u2228\u2227\u203a\u00bb\u2192\u2325\u25bf\u25b5]+$/;
  const stripDecor = (t) => String(t || '').replace(DECOR_TAIL_RE, '');
  // Collapsed pending card ("Allow Codex to …" / "Let Codex …") -> expand.
  const PENDING_RE = /^\s*[\s\S]{0,16}?(allow|let)\s+(codex|chatgpt)\b/i;
  const DONE_STATUS_RE = /(allowed|denied|rejected|expired)\s*·/i;
  // Review bar: a short container that says approval/review is needed + a bare
  // review/open control.
  const BAR_RE = /((needs?|requires?|awaiting|waiting\s+for|pending)\s+(your\s+)?(approval|review|input|confirmation))|(approval\s+(needed|required))/i;
  const BAR_BTN_RE = /^(review|view|open|show|details|see|check)$/i;
  const DESTRUCTIVE_RE = /\b(delete|remove|deny|reject|decline|clear|reset|dismiss|block)\b/i;
  // Consent filters (fail closed — approval wording can never override them).
  const PERMISSION_CARD_RE = /\b(send notifications|notifications?|camera|microphone|location|clipboard)\b/i;
  const CONSENT_ONLY_RE = /\b(notifications?|newsletter|subscribe|cookies?|marketing|alerts?|reminders?|tips?)\b/i;
  const APPROVAL_CONTEXT_RE = /\b(approv|perform this action|allow (codex|chatgpt)\b|proceed)\b/i;
  // Auth/connector hard-block: the account-linking boundary is the user's own.
  const AUTH_WORD_RE = /\b(authorize|authorization|sign\s+in|log\s+in|connect|oauth|link\s+(your\s+)?account|grant\s+access|api\s+key|access\s+token|personal\s+access\s+token|api\s+token|paste\s+(the\s+|your\s+)?token)\b/i;
  const CONNECT_BTN_RE = /^(connect\b|authorize\b|sign\s+in\b|log\s+in\b|link\b|set\s+up\b|add\s+account\b)/i;

  const EXPAND_THROTTLE_MS = 800;
  const BAR_THROTTLE_MS = 1000;
  const TEXT_COOLDOWN_MS = 30000;
  const ALLOW_DEDUP_MS = 5000;
  const OBSERVER_FAST_MS = 0;
  const OBSERVER_GENERIC_MS = 120;
  const YOLO_MIN_DELAY_MS = 100;
  const ALLOW_RATE_MAX = 30;
  const AUX_RATE_MAX = 30;
  const AUX_RATE_WINDOW_MS = 60000;
  const BLOCKED_DEDUP_MS = 30000;
  const CODEX_TOPIC = 'chatgpt.com';
  // Keep in lockstep with content.js BLOCK_SEED (frozen seed; lint enforces equality).
  const BLOCK_SEED = ['delete', 'remove', 'drop', 'wipe', 'format', 'billing', 'payment', 'invoice',
    'pay', 'transfer', 'refund', 'production', 'deploy', 'revoke', 'rm -rf', 'sudo',
    'credential', 'password', 'secret', 'token'];

  const DEFAULT = { codexEnabled: false, minDelayMs: 300 };
  const state = { enabled: false, minDelayMs: 300, clickCount: 0, lastClickAt: 0, lastExpandAt: 0, lastBarAt: 0, lastResult: null };
  const clickedNodes = new WeakSet();
  const dryNodes = new WeakSet();
  const codexDoneScopes = new WeakSet();
  const recentTexts = new Map();
  const recentAllowKeys = new Map();
  const auxClicks = [];
  const allowClicks = [];
  const blockedFps = new Map();

  const v18 = {
    pauseUntil: 0,
    dryRun: false,
    yoloMode: false,
    allowOnceMode: false,
    allowTopics: [],
    blockKeywords: BLOCK_SEED.map((k) => k.toLowerCase()),
  };
  const v18Defaults = {
    pauseUntil: v18.pauseUntil, dryRun: v18.dryRun, yoloMode: v18.yoloMode,
    allowOnceMode: v18.allowOnceMode, allowTopics: v18.allowTopics.slice(), blockKeywords: v18.blockKeywords.slice(),
  };
  let v18Ready = false; // boot gate: never sweep before the settings read is applied (fail closed)
  let lastFlagPause = null, lastFlagDry = null, lastFlagYolo = null;

  const paused = () => Date.now() < Number(v18.pauseUntil || 0);
  const asObj = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};

  // ---- read helpers (same shapes as content.js) ---------------------------------
  let sweepTxtCache = null;
  let sweepVisCache = null;
  const rawTxt = (el) => ((el.innerText || el.textContent || '').replace(/\s+/g, ' ')).trim();
  const txt = (el) => {
    if (sweepTxtCache && el && el.nodeType === 1) {
      const hit = sweepTxtCache.get(el);
      if (hit !== undefined) return hit;
      const v = rawTxt(el);
      sweepTxtCache.set(el, v);
      return v;
    }
    return rawTxt(el);
  };
  const isBtn = (el) => !!el && (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button');
  const isEnabled = (el) => !el.disabled && el.getAttribute('aria-disabled') !== 'true';
  const rawVisible = (el) => {
    const r = el.getBoundingClientRect();
    if (!(r.width > 2 && r.height > 2)) return false;
    try {
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.pointerEvents !== 'none' && Number(cs.opacity) > 0;
    } catch { return true; }
  };
  const isVisible = (el) => {
    if (sweepVisCache && el && el.nodeType === 1) {
      const hit = sweepVisCache.get(el);
      if (hit !== undefined) return hit;
      const v = rawVisible(el);
      sweepVisCache.set(el, v);
      return v;
    }
    return rawVisible(el);
  };
  const clickable = (el) => isBtn(el) && isEnabled(el) && isVisible(el);
  const handledNode = (el) => clickedNodes.has(el) || (v18.dryRun && dryNodes.has(el));
  const unsafeTarget = (el) => !!el.closest('a') || !!el.form;
  const buttonsIn = (scope) => [...scope.querySelectorAll('button, [role="button"]')];

  function isPosText(t) {
    const s = stripDecor(t);
    if (NEG_RE.test(s)) return false; // an explicit negative is never a candidate
    if (POS_RE.test(s)) return true;
    if (v18.yoloMode && STANDING_RE.test(s)) return true;
    return false;
  }
  function isOneShotText(t) { return /once|this\s+time|only|proceed/i.test(String(t || '')); }
  function rankPos(b) {
    const raw = stripDecor(txt(b)).toLowerCase().trim();
    const oneShot = isOneShotText(raw);
    if (v18.allowOnceMode) {
      if (oneShot) return 0;
      return raw === 'allow' || raw === 'approve' ? 1 : 2;
    }
    return raw === 'allow' || raw === 'approve' ? 0 : oneShot ? 1 : 2;
  }
  function pickPos(list) {
    return list.filter(clickable).sort((a, b) => rankPos(a) - rankPos(b))[0] || null;
  }
  function onCooldown(key) { const t = recentTexts.get(key); return !!t && Date.now() - t < TEXT_COOLDOWN_MS; }
  function markCooldown(key) {
    recentTexts.set(key, Date.now());
    if (recentTexts.size > 300) recentTexts.delete(recentTexts.keys().next().value);
  }
  function allowFp(btn, ctx) { return ctx ? (txt(btn) + '|' + ctx).slice(0, 220) : null; }
  function allowOnCooldown(fp) { if (!fp) return false; const t = recentAllowKeys.get(fp); return !!t && Date.now() - t < ALLOW_DEDUP_MS; }
  function markAllowFp(fp) {
    if (!fp) return;
    recentAllowKeys.set(fp, Date.now());
    if (recentAllowKeys.size > 200) recentAllowKeys.delete(recentAllowKeys.keys().next().value);
  }
  function auxRateOk() {
    const now = Date.now();
    while (auxClicks.length && now - auxClicks[0] > AUX_RATE_WINDOW_MS) auxClicks.shift();
    return auxClicks.length < AUX_RATE_MAX;
  }
  function markAux() { auxClicks.push(Date.now()); }
  function allowRateOk() {
    const now = Date.now();
    while (allowClicks.length && now - allowClicks[0] > AUX_RATE_WINDOW_MS) allowClicks.shift();
    return allowClicks.length < ALLOW_RATE_MAX;
  }
  function nodeTextNoButtons(root) {
    let out = '';
    const walk = (n) => {
      if (n.nodeType === 3) { out += n.nodeValue + ' '; return; }
      if (n.nodeType !== 1) return;
      if (n.tagName === 'BUTTON' || (n.getAttribute && n.getAttribute('role') === 'button')) return;
      for (const c of n.childNodes) walk(c);
    };
    walk(root);
    return out.replace(/\s+/g, ' ').trim();
  }
  function contextText(node) {
    let n = node;
    for (let i = 0; i < 3 && n && n !== document.body && n !== document.documentElement; i++) {
      const t = nodeTextNoButtons(n);
      if (t) return t;
      n = n.parentElement;
    }
    return '';
  }
  // Fingerprint scope: climb from the affirmative button while the ancestor holds
  // exactly one affirmative + one negative (the same rule the Muse engine uses, so
  // the dedup fingerprint is path-independent).
  function contextScope(btn) {
    let scope = btn;
    for (let up = 0; up < 4; up++) {
      const p = scope.parentElement;
      if (!p || p === document.body || p === document.documentElement) break;
      const pos = buttonsIn(p).filter((x) => isPosText(txt(x)) && !NEG_RE.test(stripDecor(txt(x))));
      const neg = buttonsIn(p).filter((x) => NEG_RE.test(stripDecor(txt(x))));
      if (pos.length !== 1 || neg.length !== 1) break;
      scope = p;
    }
    return scope;
  }
  function consentOnly(cardText) { return PERMISSION_CARD_RE.test(cardText) || (CONSENT_ONLY_RE.test(cardText) && !APPROVAL_CONTEXT_RE.test(cardText)); }
  // Auth/connector hard-block: true when the scope carries auth/connector wording or a
  // standalone Connect-family button (<=40 chars). Over-blocking is the intended trade-off.
  function authIn(scope) {
    try {
      if (!scope) return false;
      const t = txt(scope);
      if (t && AUTH_WORD_RE.test(t)) return true;
      for (const b of buttonsIn(scope)) {
        const bt = txt(b).trim();
        if (bt && bt.length <= 40 && CONNECT_BTN_RE.test(bt)) return true;
      }
    } catch { /* ignore */ }
    return false;
  }
  function authNear(scope, levels) {
    let n = scope;
    const max = levels || 2;
    for (let i = 0; i < max && n && n !== document.body && n !== document.documentElement; i++) {
      if (authIn(n)) return true;
      n = n.parentElement;
    }
    return false;
  }
  function keywordIn(text) {
    const t = String(text || '').toLowerCase();
    if (!t) return null;
    for (const kw of v18.blockKeywords) if (kw && t.includes(kw)) return kw;
    return null;
  }
  // 'keyword:<kw>' when a keyword appears in the card text or the extracted context;
  // 'topic' when a non-empty allowTopics list does not contain the Codex topic
  // ('chatgpt.com' — the Codex approvals are not repo-scoped, so the topic is fixed).
  function blockReasonFor(cardText, ctx) {
    if (v18.yoloMode) return null; // explicit opt-in: block rules are bypassed (same as the Muse engine)
    const kw = keywordIn(String(cardText || '') + ' ' + String(ctx || ''));
    if (kw) return 'keyword:' + kw;
    if (v18.allowTopics.length && !v18.allowTopics.some((x) => String(x).toLowerCase() === CODEX_TOPIC)) return 'topic';
    return null;
  }

  // ---- click recording (one serialized storage write, shared contract) -----------
  const clickQueue = [];
  let clickFlushing = false;
  const pad2 = (n) => String(n).padStart(2, '0');
  function dayKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function monthKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }
  function pruneKeys(map, keep) {
    const keys = Object.keys(map).sort();
    while (keys.length > keep) delete map[keys.shift()];
  }
  function pruneTopics(map, keep) {
    const keys = Object.keys(map);
    if (keys.length <= keep) return;
    keys.sort((a, b) => map[a] - map[b]);
    for (const k of keys.slice(0, keys.length - keep)) delete map[k];
  }
  let cryptKey = null;
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function getKey() {
    if (cryptKey) return cryptKey;
    try {
      const s = await chrome.storage.local.get({ cryptKeyRaw: null });
      if (s.cryptKeyRaw) {
        cryptKey = await crypto.subtle.importKey('raw', unb64(s.cryptKeyRaw), 'AES-GCM', false, ['encrypt', 'decrypt']);
        return cryptKey;
      }
      const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
      const raw = await crypto.subtle.exportKey('raw', k);
      await chrome.storage.local.set({ cryptKeyRaw: b64(raw) });
      // first-install race: another tab may have won the write — adopt the stored key
      const chk = await chrome.storage.local.get({ cryptKeyRaw: null });
      if (chk.cryptKeyRaw && chk.cryptKeyRaw !== b64(raw)) {
        cryptKey = await crypto.subtle.importKey('raw', unb64(chk.cryptKeyRaw), 'AES-GCM', false, ['encrypt', 'decrypt']);
        return cryptKey;
      }
      cryptKey = k;
      return k;
    } catch { return null; }
  }
  try { chrome.storage.onChanged.addListener((ch) => { if (ch.cryptKeyRaw) cryptKey = null; }); } catch { /* ignore */ }
  async function encryptCtx(text) {
    try {
      const k = await getKey();
      if (!k) return null;
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(String(text || '')));
      return { iv: b64(iv), ct: b64(ct) };
    } catch { return null; }
  }
  // One get->set per flush, updating log + counter + aggregates + digestCounters
  // together — under the SAME Web Lock name content.js uses ('maa-record-v1'), so a
  // muse.ai tab and a chatgpt.com tab flushing in parallel cannot lose a write.
  function flushClicks() {
    if (clickFlushing || (!clickQueue.length && !digestDirty)) return;
    clickFlushing = true;
    const run = () => new Promise((resolve) => {
      try {
        chrome.storage.local.get({ log: [], stats: null, clickCount: 0, digestCounters: null }, async (s) => {
          const log = Array.isArray(s.log) ? s.log : [];
          let count = Number(s.clickCount) || 0;
          const st = asObj(s.stats);
          st.byDay = asObj(st.byDay); st.byMonth = asObj(st.byMonth); st.byYear = asObj(st.byYear); st.byTopic = asObj(st.byTopic);
          while (clickQueue.length) {
            const item = clickQueue.shift();
            const entry = item.entry;
            try {
              const enc = await encryptCtx(entry.context);
              if (enc) { entry.ctx = enc; delete entry.context; }
            } catch { /* keep plaintext */ }
            log.unshift(entry);
            if (item.counts !== false) {
              count += 1;
              st.byDay[item.day] = (Number(st.byDay[item.day]) || 0) + 1;
              st.byMonth[item.month] = (Number(st.byMonth[item.month]) || 0) + 1;
              st.byYear[item.year] = (Number(st.byYear[item.year]) || 0) + 1;
              st.byTopic[item.topic] = (Number(st.byTopic[item.topic]) || 0) + 1;
            }
          }
          pruneKeys(st.byDay, 400); pruneKeys(st.byMonth, 24); pruneTopics(st.byTopic, 100);
          const patch = { log: log.slice(0, 50), stats: st, clickCount: count, schemaVersion: 2 };
          if (digestDirty) {
            const d = asObj(s.digestCounters);
            d.clicks = (Number(d.clicks) || 0) + digestDelta.clicks;
            d.followups = (Number(d.followups) || 0) + digestDelta.followups;
            d.blocked = (Number(d.blocked) || 0) + digestDelta.blocked;
            digestDelta.clicks = 0; digestDelta.followups = 0; digestDelta.blocked = 0;
            digestDirty = false;
            patch.digestCounters = d;
          }
          try { chrome.storage.local.set(patch); }
          catch (e) { console.warn('[codex-auto-allow] log flush failed — record dropped:', (e && e.message) || e); }
          resolve();
        });
      } catch { resolve(); }
    }).finally(() => { clickFlushing = false; });
    let started = false;
    const once = () => { if (started) return; started = true; return run(); };
    try {
      const p = navigator.locks.request('maa-record-v1', () => once());
      if (p && typeof p.catch === 'function') p.catch(() => once());
    } catch { once(); }
  }
  function recordClick(entry, context, counts) {
    const d = new Date();
    clickQueue.push({ entry, day: dayKey(d), month: monthKey(d), year: String(d.getFullYear()), topic: CODEX_TOPIC, counts: counts !== false });
    if (clickQueue.length > 60) clickQueue.splice(0, clickQueue.length - 60);
    flushClicks();
  }
  const digestDelta = { clicks: 0, followups: 0, blocked: 0 };
  let digestDirty = false;
  function bumpDigest(delta) {
    if (delta) {
      digestDelta.clicks += Number(delta.clicks) || 0;
      digestDelta.followups += Number(delta.followups) || 0;
      digestDelta.blocked += Number(delta.blocked) || 0;
    }
    digestDirty = true;
    flushClicks();
  }
  function noteBlocked(label, reason, text, fpKey) {
    const key = (fpKey || String(text || '').slice(0, 160)) + '|' + reason;
    const t = blockedFps.get(key);
    if (t && Date.now() - t < BLOCKED_DEDUP_MS) return;
    blockedFps.set(key, Date.now());
    if (blockedFps.size > 200) blockedFps.delete(blockedFps.keys().next().value);
    const entry = { at: new Date().toISOString(), kind: 'blocked', label: String(label || 'Codex').slice(0, 60), blockedReason: reason, context: String(text || '').slice(0, 240) };
    if (v18.dryRun) entry.dryRun = true;
    state.lastResult = entry;
    recordClick(entry, entry.context, false);
    bumpDigest({ blocked: 1 });
    console.log('[codex-auto-allow] blocked (' + reason + ') "' + entry.label + '"');
  }
  function doClick(btn, scope, kind, cooldownKey, ctx) {
    const isDry = v18.dryRun === true;
    if (isDry) dryNodes.add(btn); else clickedNodes.add(btn);
    const label = txt(btn);
    const context = (scope ? contextText(scope) : label).slice(0, 240);
    state.lastClickAt = Date.now();
    if (kind === 'codex-expand') state.lastExpandAt = state.lastClickAt;
    if (kind === 'codex-open-panel') state.lastBarAt = state.lastClickAt;
    if (kind === 'codex-expand' || kind === 'codex-open-panel') markAux();
    if (kind === 'codex-allow') {
      markAllowFp(allowFp(btn, ctx !== undefined ? ctx : (scope ? contextText(scope) : '')));
      allowClicks.push(state.lastClickAt);
      // one affirmative click per pair scope — a persistent card must not be walked
      // down to a broader grant on later sweeps (dry runs never consume the scope)
      if (scope && !isDry) codexDoneScopes.add(scope);
    }
    if (cooldownKey) markCooldown(cooldownKey);
    state.clickCount += 1;
    const entryKind = isDry ? kind + '-dry' : kind;
    state.lastResult = { at: new Date().toISOString(), kind: entryKind, label, context };
    if (isDry) state.lastResult.dryRun = true;
    recordClick(state.lastResult, context, !isDry);
    console.log('[codex-auto-allow] ' + entryKind + ' "' + label.slice(0, 60) + '" | ' + context.slice(0, 90));
    if (isDry) return;
    bumpDigest({ clicks: 1 });
    try { btn.click(); } catch (e) { console.warn('[codex-auto-allow] click failed', e); }
  }

  // ---- detection paths -----------------------------------------------------------
  // Gate predicate — a strict SUPERSET of every way a click path can start.
  function codexShapedButton(b) {
    const t = txt(b);
    return isPosText(t) || PENDING_RE.test(t) || BAR_BTN_RE.test(stripDecor(t).trim());
  }
  // Path P — pair heuristic: affirmative + clickable negative in the SAME container.
  function findPairAllow(btns) {
    for (const b of (btns || buttonsIn(document))) {
      const bt = stripDecor(txt(b));
      if (NEG_RE.test(bt)) continue; // explicit negative skip — before everything else
      if (handledNode(b) || !clickable(b) || !isPosText(txt(b)) || unsafeTarget(b)) continue;
      let node = b;
      for (let depth = 0; depth < 4 && node; depth++) {
        node = node.parentElement;
        if (!node) break;
        const inner = buttonsIn(node);
        if (!inner.length) continue; // climb to the first button container
        // The pair must sit in the SAME button container and the negative must be
        // clickable — a lone affirmative next to a distant/hidden negative is not
        // an approval request.
        if (!inner.some((x) => NEG_RE.test(stripDecor(txt(x))) && clickable(x))) break;
        // Cards can offer several positive options ("Yes, proceed" next to a
        // standing grant): click only the BEST-RANKED affirmative — and only if
        // that is the candidate itself, so nothing broader is ever preferred.
        const pos = inner.filter((x) => isPosText(txt(x)) && !NEG_RE.test(stripDecor(txt(x))) && clickable(x))
          .sort((a, x) => rankPos(a) - rankPos(x));
        if (pos.length && pos[0] === b) {
          if (authNear(node, 2)) {
            noteBlocked('Connect', 'connector', txt(node) + ' ' + contextText(contextScope(b)), 'connector:' + txt(node).slice(0, 160));
            break;
          }
          if (codexDoneScopes.has(node)) break;
          const ctx = contextText(contextScope(b));
          if (consentOnly(ctx)) break;
          const cardText = txt(node);
          const reason = blockReasonFor(cardText, ctx);
          if (reason) { noteBlocked(txt(b), reason, cardText, 'pair:' + cardText.slice(0, 160)); break; }
          if (allowOnCooldown(allowFp(b, ctx))) break;
          return { btn: b, scope: node, ctx };
        }
        break;
      }
    }
    return null;
  }
  // Path E — collapsed pending card: click to expand (aux rail), approve next sweep.
  function findCollapsedPending(btns) {
    if (!auxRateOk()) return null;
    for (const b of (btns || buttonsIn(document))) {
      if (handledNode(b) || !clickable(b) || unsafeTarget(b)) continue;
      const t = txt(b);
      if (!PENDING_RE.test(t)) continue;
      if (/hide details/i.test(t) || DONE_STATUS_RE.test(t)) continue;
      if (authNear(b, 2)) { noteBlocked('Connect', 'connector', t, 'connector:' + t.slice(0, 160)); continue; }
      const reason = blockReasonFor(t, contextText(b));
      if (reason) { noteBlocked('expand', reason, t, 'expand:' + t.slice(0, 160)); continue; }
      const key = t.slice(0, 160);
      if (onCooldown(key)) continue;
      return { btn: b, key };
    }
    return null;
  }
  // Path R — review bar: "A task needs your approval" + a bare Review/Open control.
  function findBarButton(btns) {
    if (!auxRateOk()) return null;
    for (const b of (btns || buttonsIn(document))) {
      if (handledNode(b) || !clickable(b) || unsafeTarget(b)) continue;
      const bt = stripDecor(txt(b)).trim();
      if (!BAR_BTN_RE.test(bt) || DESTRUCTIVE_RE.test(bt)) continue;
      let node = b, scope = null;
      for (let i = 0; i < 4 && node; i++) {
        node = node.parentElement;
        if (!node) break;
        const t = txt(node);
        if (t.length > 220) break; // bar text is short; a big container means we overshot
        if (BAR_RE.test(t)) { scope = node; break; }
      }
      if (!scope || !isVisible(scope)) continue;
      const scopeTxt = txt(scope);
      if (authNear(scope, 2)) { noteBlocked('Connect', 'connector', scopeTxt, 'connector:' + scopeTxt.slice(0, 160)); continue; }
      const reason = blockReasonFor(scopeTxt, scopeTxt);
      if (reason) { noteBlocked('review-bar', reason, scopeTxt, 'bar:' + scopeTxt.slice(0, 160)); continue; }
      const key = 'bar:' + scopeTxt.slice(0, 160);
      if (onCooldown(key)) continue;
      return { btn: b, key };
    }
    return null;
  }

  function sweep(reason) {
    if (!alive()) { stopForever(); return; }
    if (!v18Ready) return; // boot gate: never sweep before the settings are applied
    if (!state.enabled) return;
    if (paused()) return;
    const now = Date.now();
    const minDelay = v18.yoloMode ? Math.min(state.minDelayMs, YOLO_MIN_DELAY_MS) : state.minDelayMs;
    if (now - state.lastClickAt < minDelay) {
      scheduleSweep('delay', minDelay - (now - state.lastClickAt) + 25, false);
      return;
    }
    const prevTxtCache = sweepTxtCache, prevVisCache = sweepVisCache;
    sweepTxtCache = new Map();
    sweepVisCache = new Map();
    try {
      const btns = buttonsIn(document);
      if (!btns.length) return;
      if (!btns.some(codexShapedButton)) return;

      const hit = findPairAllow(btns);
      if (hit) {
        if (!allowRateOk()) return; // global ceiling — no unbounded real approvals
        doClick(hit.btn, hit.scope, 'codex-allow', null, hit.ctx);
        return;
      }
      if (now - state.lastExpandAt >= EXPAND_THROTTLE_MS) {
        const c = findCollapsedPending(btns);
        if (c) { doClick(c.btn, null, 'codex-expand', c.key); return; }
      }
      if (now - state.lastBarAt >= BAR_THROTTLE_MS) {
        const rb = findBarButton(btns);
        if (rb) { doClick(rb.btn, null, 'codex-open-panel', rb.key); return; }
      }
    } finally {
      sweepTxtCache = prevTxtCache;
      sweepVisCache = prevVisCache;
    }
  }

  // ---- scheduling / observer / lifecycle ----------------------------------------
  let pendingTimer = null;
  let pendingFast = false;
  function scheduleSweep(reason, ms, fast) {
    if (pendingTimer) {
      if (pendingFast && !fast) return;
      clearTimeout(pendingTimer);
    }
    pendingFast = !!fast;
    pendingTimer = setTimeout(() => { pendingTimer = null; pendingFast = false; sweep(reason); }, ms);
  }
  // A mutation that brings in (or lands inside) a candidate-bearing node sweeps on the
  // next task; generic mutations keep the 120 ms coalescing debounce.
  function codexBearingMutation(rec) {
    if (!rec || rec.type !== 'childList') return false;
    const added = rec.addedNodes;
    if (!added) return false;
    let scanned = 0;
    for (let i = 0; i < added.length && scanned < 64; i++) {
      const n = added[i];
      if (!n || n.nodeType !== 1) continue;
      scanned++;
      const tests = [];
      if (n.matches && n.matches('button, [role="button"]')) tests.push(n);
      if (n.querySelectorAll) {
        try { for (const b of n.querySelectorAll('button, [role="button"]')) { tests.push(b); if (tests.length > 16) break; } } catch { /* ignore */ }
      }
      for (const b of tests) if (codexShapedButton(b)) return true;
    }
    return false;
  }
  let obs = null;
  let heartbeat = null;
  function alive() { try { return !!chrome.runtime?.id; } catch { return false; } }
  function stopForever() {
    try { if (obs) obs.disconnect(); } catch { /* ignore */ }
    try { if (heartbeat) clearInterval(heartbeat); } catch { /* ignore */ }
    try { if (pendingTimer) clearTimeout(pendingTimer); } catch { /* ignore */ }
  }
  // Observability only (no behaviour): mirror the flags onto <html> — written only on
  // change so the attributes never look like page activity.
  function publishFlags() {
    try {
      const p = paused() ? '1' : '0';
      const d = v18.dryRun ? '1' : '0';
      const y = v18.yoloMode ? '1' : '0';
      const el = document.documentElement;
      if (p !== lastFlagPause) { lastFlagPause = p; el.setAttribute('data-codex-pause', p); }
      if (d !== lastFlagDry) { lastFlagDry = d; el.setAttribute('data-codex-dryrun', d); }
      if (y !== lastFlagYolo) { lastFlagYolo = y; el.setAttribute('data-codex-yolo', y); }
    } catch { /* ignore */ }
  }

  // ---- settings -------------------------------------------------------------------
  function sanitizeList(v, cap, maxLen) {
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
  }
  function applyV18Settings(s) {
    if (!s || typeof s !== 'object') return;
    if ('pauseUntil' in s) { const n = Number(s.pauseUntil); v18.pauseUntil = Number.isFinite(n) && n > 0 ? n : 0; }
    if ('dryRun' in s) v18.dryRun = s.dryRun === true;
    if ('yoloMode' in s) v18.yoloMode = s.yoloMode === true;
    if ('allowOnceMode' in s) v18.allowOnceMode = s.allowOnceMode === true;
    if ('rules' in s) {
      const rules = asObj(s.rules);
      if ('allowTopics' in rules) v18.allowTopics = sanitizeList(rules.allowTopics, 50, 64) || [];
      if ('blockKeywords' in rules) {
        const kws = sanitizeList(rules.blockKeywords, 500, 0);
        v18.blockKeywords = (kws || []).map((k) => k.toLowerCase());
      }
    }
  }
  function resetV18Key(k) {
    if (k === 'pauseUntil') v18.pauseUntil = v18Defaults.pauseUntil;
    else if (k === 'dryRun') v18.dryRun = v18Defaults.dryRun;
    else if (k === 'yoloMode') v18.yoloMode = v18Defaults.yoloMode;
    else if (k === 'allowOnceMode') v18.allowOnceMode = v18Defaults.allowOnceMode;
    else if (k === 'rules') { v18.allowTopics = v18Defaults.allowTopics.slice(); v18.blockKeywords = v18Defaults.blockKeywords.slice(); }
  }

  function applyBasic(s) {
    if (!s || typeof s !== 'object') return;
    if ('codexEnabled' in s) state.enabled = s.codexEnabled === true;
    if ('minDelayMs' in s) { const n = Number(s.minDelayMs); if (Number.isFinite(n) && n >= 0) state.minDelayMs = n; }
    if ('clickCount' in s) state.clickCount = Number(s.clickCount) || 0;
  }

  // ---- message listener (background nudge / harness) ------------------------------
  try {
    chrome.runtime.onMessage.addListener((m) => { if (m && m.type === 'sweep') sweep('message'); });
  } catch { /* ignore */ }

  // ---- boot -----------------------------------------------------------------------
  try {
    chrome.storage.local.get(DEFAULT, (s) => {
      applyBasic(s);
      if (v18Ready) sweep('init'); // the v18 read below owns the first sweep (boot gate)
    });
    chrome.storage.local.get({ pauseUntil: 0, dryRun: false, yoloMode: false, allowOnceMode: false, rules: {} },
      (s) => { applyV18Settings(s); publishFlags(); v18Ready = true; sweep('init'); });
    chrome.storage.onChanged.addListener((ch) => {
      // A key REMOVED from storage (newValue === undefined) resets to that key's shipped
      // DEFAULT — never a stale in-memory value (fail closed).
      const removed = (c) => !c || c.newValue === undefined;
      if (ch.codexEnabled) state.enabled = removed(ch.codexEnabled) ? DEFAULT.codexEnabled : ch.codexEnabled.newValue === true;
      if (ch.minDelayMs) {
        if (removed(ch.minDelayMs)) state.minDelayMs = DEFAULT.minDelayMs;
        else { const n = Number(ch.minDelayMs.newValue); if (Number.isFinite(n) && n >= 0) state.minDelayMs = n; }
      }
      const vpatch = {};
      let vch = false;
      for (const k of ['pauseUntil', 'dryRun', 'yoloMode', 'allowOnceMode', 'rules']) {
        if (!ch[k]) continue;
        vch = true;
        if (removed(ch[k])) resetV18Key(k);
        else vpatch[k] = ch[k].newValue;
      }
      if (vch) { applyV18Settings(vpatch); publishFlags(); }
    });
  } catch {
    v18Ready = true; // storage unreachable — the sweep still fails closed on `enabled` (false)
  }

  try {
    obs = new MutationObserver((records) => {
      let fast = false;
      for (const rec of records) { if (codexBearingMutation(rec)) { fast = true; break; } }
      scheduleSweep('observer', fast ? OBSERVER_FAST_MS : OBSERVER_GENERIC_MS, fast);
    });
    obs.observe(document.documentElement || document, { childList: true, subtree: true });
  } catch {}
  heartbeat = setInterval(() => { sweep('interval'); publishFlags(); }, 1000);

  window.__maaCodex = {
    get state() { return { ...state }; },
    get v18() {
      return { paused: paused(), dryRun: v18.dryRun, yoloMode: v18.yoloMode, allowOnceMode: v18.allowOnceMode,
               allowTopics: [...v18.allowTopics], blockKeywords: [...v18.blockKeywords] };
    },
    sweep: () => sweep('manual'),
  };
})();
