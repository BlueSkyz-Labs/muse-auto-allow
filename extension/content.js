// Muse Auto-Allow — content script (v1.2.0, security-hardened).
// Automatically clicks "Allow" on Muse (muse.ai) approval requests.
//
// Click paths, in priority order:
//  A. Marked cards: [data-testid="hatch-inline-approval-card"] containing an allow-ish
//     and a deny-ish button -> click the allow button (Muse's own DOM marker).
//  B. Pair heuristic: an "Allow" button whose nearest ancestor containing a deny-ish
//     button holds exactly one allow-ish button (itself) -> click it.
//  C. Collapsed pending cards ("Allow Muse to perform this action ...") -> click to
//     expand, revealing the Allow/Deny pair which is approved on the next sweep.
//  D. "N tasks need your approval" banner (background approval surface) -> click a
//     button whose text reads like "review/open/show/view" to open the approvals panel.
//
// Safety rails (redteam-hardened, v2):
//  - Never clicks Deny/Reject/Decline; never clicks a lone "Allow" — the deny must sit
//    in the same button container and be clickable (adjacent-pair rule).
//  - Never clicks a candidate inside an <a> or tied to a <form> (no navigation/submit).
//  - Consent-only pairs (notifications/newsletter/subscribe/cookies/marketing/alerts/
//    reminders/tips without explicit approval wording) are skipped.
//  - Allow clicks carry a 5s fingerprint dedup whose context is computed from the same
//    button-anchored scope in every detection path (no path-dependent bypass).
//  - Allow clicks are globally rate-capped at 30/min; auxiliary clicks (expand /
//    open-panel) at 30/min with 30s per-text cooldowns — no unbounded click loops.
//  - Liveness guard: if the extension context is invalidated (reload/disable), the
//    script stops itself instead of continuing to click.
//  - Every click is logged to chrome.storage.local (see popup).
(() => {
  if (window.__museAutoAllowLoaded) return;
  window.__museAutoAllowLoaded = true;
  try { document.documentElement.setAttribute('data-muse-auto-allow', '1'); } catch {}
  // Interact ONLY on muse.ai (defense-in-depth: the manifest matches already scope us;
  // the localhost allowance exists solely for the test-harness copy).
  const ON_MUSE = /(^|\.)muse\.ai$/.test(location.hostname) || location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  if (!ON_MUSE) return;

  const ALLOW_RE = /^\s*(allow|approve)(\s+(once|always|this time))?\s*$/i;
  const DENY_RE = /^\s*(deny|reject|decline)(\s+(once|this time))?\s*$/i;
  const CARD_SEL = '[data-testid="hatch-inline-approval-card"]';
  const SURFACE_SEL = '[data-testid="hatch-inline-approval-card"][data-hatch-background-approval-surface="true"]';
  const PENDING_CARD_RE = /^\s*allow muse to perform this action\b/i;
  const DONE_STATUS_RE = /(allowed|denied|rejected|expired)\s*·/i;
  const NEED_APPROVAL_RE = /need(s)? your approval/i;
  const SURFACE_BTN_RE = /\b(review|open|show|view|details|see)\b/i;
  const DESTRUCTIVE_RE = /\b(delete|remove|deny|reject|decline|clear|reset|dismiss|block)\b/i;
  const CONSENT_ONLY_RE = /\b(notifications?|newsletter|subscribe|cookies?|marketing|alerts?|reminders?|tips?)\b/i;
  const APPROVAL_CONTEXT_RE = /\b(approv|perform this action|allow muse\b)/i;
  const EXPAND_THROTTLE_MS = 800;
  const SURFACE_THROTTLE_MS = 10000;
  const TEXT_COOLDOWN_MS = 30000;
  const ALLOW_DEDUP_MS = 5000;
  const ALLOW_RATE_MAX = 30;
  const AUX_RATE_MAX = 30;
  const AUX_RATE_WINDOW_MS = 60000;
  const DEFAULT = { enabled: true, minDelayMs: 300, clickCount: 0 };

  const state = { enabled: true, minDelayMs: 300, clickCount: 0, lastClickAt: 0, lastExpandAt: 0, lastSurfaceAt: 0, lastResult: null };
  const clickedNodes = new WeakSet();
  const recentTexts = new Map(); // cooldown key -> ts (expand / open-panel)
  const recentAllowKeys = new Map(); // allow fingerprint -> ts (re-render dedup)
  const auxClicks = []; // timestamps of expand/open-panel clicks (rate cap)
  const allowClicks = []; // timestamps of allow clicks (global ceiling)
  let pendingTimer = null;
  let obs = null;
  let heartbeat = null;

  const txt = (el) => ((el.innerText || el.textContent || '').replace(/\s+/g, ' ')).trim();
  const isBtn = (el) => !!el && (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button');
  const isEnabled = (el) => !el.disabled && el.getAttribute('aria-disabled') !== 'true';
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    if (!(r.width > 2 && r.height > 2)) return false;
    try {
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.pointerEvents !== 'none' && Number(cs.opacity) > 0;
    } catch { return true; }
  };
  const clickable = (el) => isBtn(el) && isEnabled(el) && isVisible(el);
  // Never click something that navigates or submits: anchors, or buttons tied to a <form>.
  const unsafeTarget = (el) => !!el.closest('a') || !!el.form;
  const buttonsIn = (scope) => [...scope.querySelectorAll('button, [role="button"]')];
  const allowBtnsIn = (scope) => buttonsIn(scope).filter((b) => ALLOW_RE.test(txt(b)));
  const denyBtnsIn = (scope) => buttonsIn(scope).filter((b) => DENY_RE.test(txt(b)));

  // Prefer plain "Allow"; then "Allow once"; then "Allow always".
  function rankAllow(b) {
    const t = txt(b).toLowerCase();
    return t === 'allow' || t === 'approve' ? 0 : /once|this time/.test(t) ? 1 : 2;
  }
  function pickAllow(list) {
    return list.filter(clickable).sort((a, b) => rankAllow(a) - rankAllow(b))[0] || null;
  }
  function onCooldown(key) { const t = recentTexts.get(key); return !!t && Date.now() - t < TEXT_COOLDOWN_MS; }
  function markCooldown(key) {
    recentTexts.set(key, Date.now());
    if (recentTexts.size > 300) recentTexts.delete(recentTexts.keys().next().value);
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
  // Card context = first non-empty text (buttons excluded) walking up from the matched node (max 3 levels).
  function contextText(node) {
    let n = node;
    for (let i = 0; i < 3 && n && n !== document.body && n !== document.documentElement; i++) {
      const t = nodeTextNoButtons(n);
      if (t) return t;
      n = n.parentElement;
    }
    return '';
  }
  // Fingerprint scope: climb from the ALLOW BUTTON — the one reference every detection
  // path shares — while the ancestor holds exactly one allow + one deny. Path A and
  // Path B then always compute the same context for the same button, so the dedup
  // cannot be bypassed by a path-dependent fingerprint (redteam F1).
  function contextScope(btn) {
    let scope = btn;
    for (let up = 0; up < 4; up++) {
      const p = scope.parentElement;
      if (!p || p === document.body || p === document.documentElement) break;
      if (allowBtnsIn(p).length !== 1 || denyBtnsIn(p).length !== 1) break;
      scope = p;
    }
    return scope;
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
  function consentOnly(cardText) { return CONSENT_ONLY_RE.test(cardText) && !APPROVAL_CONTEXT_RE.test(cardText); }

  // Path A — Muse-marked approval cards.
  function findMarkedAllow() {
    for (const card of document.querySelectorAll(CARD_SEL)) {
      if (card.matches(SURFACE_SEL) || !isVisible(card)) continue;
      if (!denyBtnsIn(card).some(clickable)) continue;
      const allow = pickAllow(allowBtnsIn(card).filter((b) => {
        if (clickedNodes.has(b) || unsafeTarget(b)) return false;
        const c = contextText(contextScope(b));
        if (consentOnly(c)) return false;
        return !allowOnCooldown(allowFp(b, c));
      }));
      if (allow) return { btn: allow, card, ctx: contextText(contextScope(allow)) };
    }
    return null;
  }

  // Path B — text pair heuristic (cards without the marker).
  function findPairAllow() {
    for (const b of buttonsIn(document)) {
      if (clickedNodes.has(b) || !clickable(b) || !ALLOW_RE.test(txt(b)) || unsafeTarget(b)) continue;
      let node = b;
      for (let depth = 0; depth < 4 && node; depth++) {
        node = node.parentElement;
        if (!node) break;
        const btns = buttonsIn(node);
        if (!btns.length) continue; // climb to the first button container
        // The pair must sit in the SAME button container and the deny must be clickable —
        // a lone Allow next to a distant/hidden Deny is not an approval card (F2).
        if (!btns.some((x) => DENY_RE.test(txt(x)) && clickable(x))) break;
        const allows = btns.filter((x) => ALLOW_RE.test(txt(x)));
        if (allows.length === 1 && allows[0] === b) {
          const ctx = contextText(contextScope(b));
          if (consentOnly(ctx) || allowOnCooldown(allowFp(b, ctx))) break; // skip this candidate
          return { btn: b, card: node, ctx };
        }
        break;
      }
    }
    return null;
  }

  // Path C — collapsed pending cards: expand to reveal Allow/Deny.
  function findCollapsedPending() {
    if (!auxRateOk()) return null;
    for (const b of buttonsIn(document)) {
      if (clickedNodes.has(b) || !clickable(b) || unsafeTarget(b)) continue;
      const t = txt(b);
      if (!PENDING_CARD_RE.test(t)) continue;
      if (/hide details/i.test(t) || DONE_STATUS_RE.test(t)) continue;
      const key = t.slice(0, 160);
      if (onCooldown(key)) continue;
      return { btn: b, key };
    }
    return null;
  }

  // Path D — background approval surface: open the approvals panel.
  function findSurfaceButton() {
    if (!auxRateOk()) return null;
    for (const surface of document.querySelectorAll(SURFACE_SEL)) {
      if (!isVisible(surface)) continue;
      const t = txt(surface);
      if (!NEED_APPROVAL_RE.test(t)) continue;
      const key = 'surface:' + t.slice(0, 160);
      if (onCooldown(key)) continue;
      const btn = buttonsIn(surface).find((b) =>
        clickable(b) && !unsafeTarget(b) && SURFACE_BTN_RE.test(txt(b)) && !DESTRUCTIVE_RE.test(txt(b)));
      if (!btn || clickedNodes.has(btn)) continue;
      return { btn, key };
    }
    return null;
  }

  // Click recording is serialized: entries queue up and flush one get->set at a time
  // (no lost writes — redteam F9), updating the log, the click counter and the
  // day/month/year/topic aggregates in a single storage write.
  const clickQueue = [];
  let clickFlushing = false;
  const pad2 = (n) => String(n).padStart(2, '0');
  function dayKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function monthKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }
  function extractTopic(context) {
    const c = String(context || '').replace(/\s+/g, ' ').trim();
    const repos = [...c.matchAll(/Repository\s+(?!owner)([A-Za-z0-9._-]{2,40})/gi)].map((m) => m[1]);
    if (repos.length) return repos[repos.length - 1];
    const host = c.match(/https?:\/\/([A-Za-z0-9.-]{2,60})/i);
    if (host) return host[1].slice(0, 40);
    return c ? c.slice(0, 40) : 'unknown';
  }
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
  const asObj = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  // --- v1.5.0: at-rest encryption for the approval text (log context) + schema stamp ---
  // AES-GCM (key per install, kept in chrome.storage.local). Protects against casual
  // inspection of the browser profile on disk; it is NOT protection against an attacker
  // who already has full access to the profile (the key lives there too). Legacy
  // plaintext entries from older versions stay readable (upgrade inheritance).
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
      cryptKey = k;
      return k;
    } catch { return null; }
  }
  async function encryptCtx(text) {
    try {
      const k = await getKey();
      if (!k) return null;
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(String(text || '')));
      return { iv: b64(iv), ct: b64(ct) };
    } catch { return null; }
  }
  // One get->set per flush, updating log + counter + aggregates together. Flushes are
  // serialized per tab (clickFlushing) and, when the Web Locks API is available, across
  // tabs of the same origin too (redteam V3-2: the 1-minute alarm can nudge several
  // muse.ai tabs at once). Counts are coerced with Number() so a corrupt stored shape
  // can never turn a write into a silent no-op or a string concatenation (V3-3).
  function flushClicks() {
    if (clickFlushing || !clickQueue.length) return;
    clickFlushing = true;
    const run = () => new Promise((resolve) => {
      try {
        chrome.storage.local.get({ log: [], stats: null, clickCount: 0 }, async (s) => {
          const log = Array.isArray(s.log) ? s.log : [];
          let count = Number(s.clickCount) || 0;
          const st = asObj(s.stats);
          st.byDay = asObj(st.byDay); st.byMonth = asObj(st.byMonth); st.byYear = asObj(st.byYear); st.byTopic = asObj(st.byTopic);
          while (clickQueue.length) {
            const item = clickQueue.shift();
            const entry = item.entry;
            // encrypt the approval text at rest; on failure keep plaintext (never lose the record)
            try {
              const enc = await encryptCtx(entry.context);
              if (enc) { entry.ctx = enc; delete entry.context; }
            } catch { /* keep plaintext */ }
            log.unshift(entry);
            count += 1;
            st.byDay[item.day] = (Number(st.byDay[item.day]) || 0) + 1;
            st.byMonth[item.month] = (Number(st.byMonth[item.month]) || 0) + 1;
            st.byYear[item.year] = (Number(st.byYear[item.year]) || 0) + 1;
            st.byTopic[item.topic] = (Number(st.byTopic[item.topic]) || 0) + 1;
          }
          pruneKeys(st.byDay, 400); pruneKeys(st.byMonth, 24); pruneTopics(st.byTopic, 100);
          try { chrome.storage.local.set({ log: log.slice(0, 50), stats: st, clickCount: count, schemaVersion: 2 }); } catch { /* invalidated */ }
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
  function recordClick(entry, context) {
    const d = new Date();
    clickQueue.push({ entry, day: dayKey(d), month: monthKey(d), year: String(d.getFullYear()), topic: extractTopic(context) });
    if (clickQueue.length > 60) clickQueue.splice(0, clickQueue.length - 60);
    flushClicks();
  }

  function doClick(btn, card, kind, cooldownKey, ctx) {
    clickedNodes.add(btn);
    const label = txt(btn);
    const context = (card ? contextText(card) : label).slice(0, 240);
    state.lastClickAt = Date.now();
    if (kind === 'expand') { state.lastExpandAt = state.lastClickAt; markAux(); }
    if (kind === 'open-panel') { state.lastSurfaceAt = state.lastClickAt; markAux(); }
    if (kind === 'allow') {
      markAllowFp(allowFp(btn, ctx !== undefined ? ctx : (card ? contextText(card) : '')));
      allowClicks.push(state.lastClickAt);
    }
    if (cooldownKey) markCooldown(cooldownKey);
    state.clickCount += 1;
    state.lastResult = { at: new Date().toISOString(), kind, label, context };
    recordClick(state.lastResult, context);
    console.log('[muse-auto-allow] ' + kind + ' "' + label.slice(0, 60) + '" | ' + context.slice(0, 90));
    try { btn.click(); } catch (e) { console.warn('[muse-auto-allow] click failed', e); }
  }

  function alive() { try { return !!chrome.runtime?.id; } catch { return false; } }
  function stopForever() {
    try { if (obs) obs.disconnect(); } catch { /* ignore */ }
    try { if (heartbeat) clearInterval(heartbeat); } catch { /* ignore */ }
    try { if (pendingTimer) clearTimeout(pendingTimer); } catch { /* ignore */ }
  }

  function sweep(reason) {
    if (!alive()) { stopForever(); return; }
    if (!state.enabled) return;
    const now = Date.now();
    if (now - state.lastClickAt < state.minDelayMs) {
      // Keep the queue moving at the configured pace instead of waiting for the next
      // 1s heartbeat (observed: observer debounce fires once, is blocked by minDelay,
      // and the queue crawls at 1 click/s — diagnosed 2026-10-08).
      scheduleSweep('delay', state.minDelayMs - (now - state.lastClickAt) + 25);
      return;
    }

    const hit = findMarkedAllow() || findPairAllow();
    if (hit) {
      if (!allowRateOk()) return; // global ceiling — a page cannot drive unbounded real approvals (F3)
      doClick(hit.btn, hit.card, 'allow', null, hit.ctx);
      return;
    }

    if (now - state.lastExpandAt >= EXPAND_THROTTLE_MS) {
      const c = findCollapsedPending();
      if (c) { doClick(c.btn, null, 'expand', c.key); return; }
    }

    if (now - state.lastSurfaceAt >= SURFACE_THROTTLE_MS) {
      const s = findSurfaceButton();
      if (s) { doClick(s.btn, null, 'open-panel', s.key); return; }
    }
  }

  function scheduleSweep(reason, ms) {
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pendingTimer = null; sweep(reason); }, ms);
  }

  // Boot: load persisted settings, then first sweep.
  try {
    chrome.storage.local.get(DEFAULT, (s) => {
      state.enabled = s.enabled !== false;
      const n = Number(s.minDelayMs);
      state.minDelayMs = Number.isFinite(n) && n >= 0 ? n : 300;
      state.clickCount = Number(s.clickCount) || 0;
      sweep('init');
    });
    chrome.storage.onChanged.addListener((ch) => {
      if (ch.enabled) state.enabled = !!ch.enabled.newValue;
      if (ch.minDelayMs) {
        const n = Number(ch.minDelayMs.newValue);
        if (Number.isFinite(n) && n >= 0) state.minDelayMs = n;
      }
    });
    chrome.runtime.onMessage.addListener((m) => { if (m && m.type === 'sweep') sweep('message'); });
  } catch {
    sweep('init');
  }

  // Instant reaction: re-sweep on any DOM change (trailing debounce).
  try {
    obs = new MutationObserver(() => scheduleSweep('observer', 120));
    obs.observe(document.documentElement || document, { childList: true, subtree: true });
  } catch {}

  // Fallback heartbeat (safe under background-tab throttling).
  heartbeat = setInterval(() => sweep('interval'), 1000);

  window.__museAutoAllow = { get state() { return { ...state }; }, sweep: () => sweep('manual') };
})();
