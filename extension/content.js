// Muse Auto-Allow — content script (v1.1.0).
// Automatically clicks "Allow" on Muse (muse.ai) approval requests.
//
// Click paths, in priority order:
//  A. Marked cards: [data-testid="hatch-inline-approval-card"] containing an allow-ish
//     and a deny-ish button -> click the allow button (Muse's own DOM marker).
//  B. Pair heuristic: an "Allow" button whose nearest ancestor containing a deny-ish
//     button holds exactly one allow-ish button (itself) -> click it. Lone "Allow"
//     buttons (e.g. permission banners) are never clicked.
//  C. Collapsed pending cards ("Allow Muse to perform this action ...") -> click to
//     expand, revealing the Allow/Deny pair which is approved on the next sweep.
//  D. "N tasks need your approval" banner (background approval surface) -> click its
//     button to open the approvals panel so pending cards render.
//
// Safety: never clicks Deny; never clicks the same node twice; per-text cooldowns stop
// pathological loops; every click is logged to chrome.storage.local (see popup).
(() => {
  if (window.__museAutoAllowLoaded) return;
  window.__museAutoAllowLoaded = true;
  try { document.documentElement.setAttribute('data-muse-auto-allow', '1'); } catch {}

  const ALLOW_RE = /^\s*(allow|approve)(\s+(once|always|this time))?\s*$/i;
  const DENY_RE = /^\s*(deny|reject|decline)(\s+(once|this time))?\s*$/i;
  const CARD_SEL = '[data-testid="hatch-inline-approval-card"]';
  const SURFACE_SEL = '[data-testid="hatch-inline-approval-card"][data-hatch-background-approval-surface="true"]';
  const PENDING_CARD_RE = /^\s*allow muse to perform this action\b/i;
  const DONE_STATUS_RE = /(allowed|denied|rejected|expired)\s*·/i;
  const NEED_APPROVAL_RE = /need(s)? your approval/i;
  const EXPAND_THROTTLE_MS = 800;
  const SURFACE_THROTTLE_MS = 10000;
  const TEXT_COOLDOWN_MS = 30000;
  const DEFAULT = { enabled: true, minDelayMs: 300, clickCount: 0 };

  const state = { enabled: true, minDelayMs: 300, clickCount: 0, lastClickAt: 0, lastExpandAt: 0, lastSurfaceAt: 0, lastResult: null };
  const clickedNodes = new WeakSet();
  const recentTexts = new Map(); // cooldown key -> ts (expand / open-panel)
  let pendingTimer = null;

  const txt = (el) => ((el.innerText || el.textContent || '').replace(/\s+/g, ' ')).trim();
  const isBtn = (el) => !!el && (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button');
  const isEnabled = (el) => !el.disabled && el.getAttribute('aria-disabled') !== 'true';
  const isVisible = (el) => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const clickable = (el) => isBtn(el) && isEnabled(el) && isVisible(el);
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

  // Path A — Muse-marked approval cards.
  function findMarkedAllow() {
    for (const card of document.querySelectorAll(CARD_SEL)) {
      if (card.matches(SURFACE_SEL) || !isVisible(card)) continue;
      if (!denyBtnsIn(card).some(clickable)) continue;
      const allow = pickAllow(allowBtnsIn(card).filter((b) => !clickedNodes.has(b)));
      if (allow) return { btn: allow, card };
    }
    return null;
  }

  // Path B — text pair heuristic (cards without the marker).
  function findPairAllow() {
    for (const b of buttonsIn(document)) {
      if (clickedNodes.has(b) || !clickable(b) || !ALLOW_RE.test(txt(b))) continue;
      let node = b;
      for (let depth = 0; depth < 8 && node; depth++) {
        node = node.parentElement;
        if (!node) break;
        const btns = buttonsIn(node);
        if (!btns.some((x) => DENY_RE.test(txt(x)))) continue;
        const allows = btns.filter((x) => ALLOW_RE.test(txt(x)));
        if (allows.length === 1 && allows[0] === b) return { btn: b, card: node };
        break; // first deny-holding ancestor is already too broad -> fail safe
      }
    }
    return null;
  }

  // Path C — collapsed pending cards: expand to reveal Allow/Deny.
  function findCollapsedPending() {
    for (const b of buttonsIn(document)) {
      if (clickedNodes.has(b) || !clickable(b)) continue;
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
    const surface = document.querySelector(SURFACE_SEL);
    if (!surface || !isVisible(surface)) return null;
    const t = txt(surface);
    if (!NEED_APPROVAL_RE.test(t)) return null;
    const key = 'surface:' + t.slice(0, 160);
    if (onCooldown(key)) return null;
    const btn = buttonsIn(surface).find(clickable);
    if (!btn || clickedNodes.has(btn)) return null;
    return { btn, key };
  }

  function log(entry) {
    try {
      chrome.storage.local.get({ log: [] }, (s) => {
        const log = Array.isArray(s.log) ? s.log : [];
        log.unshift(entry);
        chrome.storage.local.set({ log: log.slice(0, 50) });
      });
    } catch { /* extension context invalidated */ }
  }

  function doClick(btn, card, kind, cooldownKey) {
    clickedNodes.add(btn);
    const label = txt(btn);
    const context = (card ? txt(card) : label).slice(0, 240);
    state.lastClickAt = Date.now();
    if (kind === 'expand') state.lastExpandAt = state.lastClickAt;
    if (kind === 'open-panel') state.lastSurfaceAt = state.lastClickAt;
    if (cooldownKey) markCooldown(cooldownKey);
    state.clickCount += 1;
    state.lastResult = { at: new Date().toISOString(), kind, label, context };
    try { chrome.storage.local.set({ clickCount: state.clickCount }); } catch {}
    log(state.lastResult);
    console.log('[muse-auto-allow] ' + kind + ' "' + label.slice(0, 60) + '" | ' + context.slice(0, 90));
    try { window.dispatchEvent(new CustomEvent('muse-auto-allow:click', { detail: state.lastResult })); } catch {}
    try { btn.click(); } catch (e) { console.warn('[muse-auto-allow] click failed', e); }
  }

  function sweep(reason) {
    if (!state.enabled) return;
    const now = Date.now();
    if (now - state.lastClickAt < state.minDelayMs) return;

    const hit = findMarkedAllow() || findPairAllow();
    if (hit) { doClick(hit.btn, hit.card, 'allow', null); return; }

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
      state.minDelayMs = Number(s.minDelayMs) || 300;
      state.clickCount = Number(s.clickCount) || 0;
      sweep('init');
    });
    chrome.storage.onChanged.addListener((ch) => {
      if (ch.enabled) state.enabled = !!ch.enabled.newValue;
      if (ch.minDelayMs) state.minDelayMs = Number(ch.minDelayMs.newValue) || 300;
    });
    chrome.runtime.onMessage.addListener((m) => { if (m && m.type === 'sweep') sweep('message'); });
  } catch {
    sweep('init');
  }

  // Instant reaction: re-sweep on any DOM change (trailing debounce).
  try {
    const obs = new MutationObserver(() => scheduleSweep('observer', 120));
    obs.observe(document.documentElement || document, { childList: true, subtree: true });
  } catch {}

  // Fallback heartbeat (safe under background-tab throttling).
  setInterval(() => sweep('interval'), 1000);

  window.__museAutoAllow = { get state() { return { ...state }; }, sweep: () => sweep('manual') };
})();
