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
// Safety rails (redteam-hardened):
//  - Never clicks Deny/Reject/Decline; never clicks a lone "Allow" (no deny pair).
//  - Never clicks a candidate inside an <a> element (no navigation side effects).
//  - Consent-only pairs (notifications/newsletter/subscribe/cookies/marketing without
//    approval wording) are skipped — they are not approval cards.
//  - Allow clicks carry a 5s fingerprint dedup on (button label + card text, buttons
//    excluded) — a node recreated with identical text is not clicked twice; cards
//    with no context text get no dedup, so distinct requests are never blocked.
//  - Auxiliary clicks (expand / open-panel) are rate-capped at 30 per minute and
//    per-text cooldown-guarded (30s) — no unbounded click loops.
//  - Liveness guard: if the extension context is invalidated (reload/disable), the
//    script stops itself instead of continuing to click.
//  - Every click is logged to chrome.storage.local (see popup).
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
  const SURFACE_BTN_RE = /\b(review|open|show|view|details|see)\b/i;
  const CONSENT_ONLY_RE = /\b(notifications?|newsletter|subscribe|cookies?|marketing)\b/i;
  const APPROVAL_CONTEXT_RE = /\b(approv|perform this action|permission|allow muse\b)/i;
  const EXPAND_THROTTLE_MS = 800;
  const SURFACE_THROTTLE_MS = 10000;
  const TEXT_COOLDOWN_MS = 30000;
  const ALLOW_DEDUP_MS = 5000;
  const AUX_RATE_MAX = 30;
  const AUX_RATE_WINDOW_MS = 60000;
  const DEFAULT = { enabled: true, minDelayMs: 300, clickCount: 0 };

  const state = { enabled: true, minDelayMs: 300, clickCount: 0, lastClickAt: 0, lastExpandAt: 0, lastSurfaceAt: 0, lastResult: null };
  const clickedNodes = new WeakSet();
  const recentTexts = new Map(); // cooldown key -> ts (expand / open-panel)
  const recentAllowKeys = new Map(); // allow fingerprint -> ts (re-render dedup)
  const auxClicks = []; // timestamps of expand/open-panel clicks (rate cap)
  let pendingTimer = null;
  let obs = null;
  let heartbeat = null;

  const txt = (el) => ((el.innerText || el.textContent || '').replace(/\s+/g, ' ')).trim();
  const isBtn = (el) => !!el && (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button');
  const isEnabled = (el) => !el.disabled && el.getAttribute('aria-disabled') !== 'true';
  const isVisible = (el) => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const clickable = (el) => isBtn(el) && isEnabled(el) && isVisible(el);
  const inAnchor = (el) => !!el.closest('a');
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
  function consentOnly(cardText) { return CONSENT_ONLY_RE.test(cardText) && !APPROVAL_CONTEXT_RE.test(cardText); }

  // Path A — Muse-marked approval cards.
  function findMarkedAllow() {
    for (const card of document.querySelectorAll(CARD_SEL)) {
      if (card.matches(SURFACE_SEL) || !isVisible(card)) continue;
      if (!denyBtnsIn(card).some(clickable)) continue;
      const ctx = contextText(card);
      if (consentOnly(ctx)) continue;
      const allow = pickAllow(allowBtnsIn(card).filter((b) =>
        !clickedNodes.has(b) && !inAnchor(b) && !allowOnCooldown(allowFp(b, ctx))));
      if (allow) return { btn: allow, card, ctx };
    }
    return null;
  }

  // Path B — text pair heuristic (cards without the marker).
  function findPairAllow() {
    for (const b of buttonsIn(document)) {
      if (clickedNodes.has(b) || !clickable(b) || !ALLOW_RE.test(txt(b)) || inAnchor(b)) continue;
      let node = b;
      for (let depth = 0; depth < 8 && node; depth++) {
        node = node.parentElement;
        if (!node) break;
        const btns = buttonsIn(node);
        if (!btns.some((x) => DENY_RE.test(txt(x)))) continue;
        const allows = btns.filter((x) => ALLOW_RE.test(txt(x)));
        if (allows.length === 1 && allows[0] === b) {
          const ctx = contextText(node);
          if (consentOnly(ctx) || allowOnCooldown(allowFp(b, ctx))) break; // skip this candidate
          return { btn: b, card: node, ctx };
        }
        break; // first deny-holding ancestor is already too broad -> fail safe
      }
    }
    return null;
  }

  // Path C — collapsed pending cards: expand to reveal Allow/Deny.
  function findCollapsedPending() {
    if (!auxRateOk()) return null;
    for (const b of buttonsIn(document)) {
      if (clickedNodes.has(b) || !clickable(b) || inAnchor(b)) continue;
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
    const surface = document.querySelector(SURFACE_SEL);
    if (!surface || !isVisible(surface)) return null;
    const t = txt(surface);
    if (!NEED_APPROVAL_RE.test(t)) return null;
    const key = 'surface:' + t.slice(0, 160);
    if (onCooldown(key)) return null;
    const btn = buttonsIn(surface).find((b) => clickable(b) && !inAnchor(b) && SURFACE_BTN_RE.test(txt(b)));
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

  function doClick(btn, card, kind, cooldownKey, ctx) {
    clickedNodes.add(btn);
    const label = txt(btn);
    const context = (card ? txt(card) : label).slice(0, 240);
    state.lastClickAt = Date.now();
    if (kind === 'expand') { state.lastExpandAt = state.lastClickAt; markAux(); }
    if (kind === 'open-panel') { state.lastSurfaceAt = state.lastClickAt; markAux(); }
    if (kind === 'allow') markAllowFp(allowFp(btn, ctx !== undefined ? ctx : (card ? contextText(card) : '')));
    if (cooldownKey) markCooldown(cooldownKey);
    state.clickCount += 1;
    state.lastResult = { at: new Date().toISOString(), kind, label, context };
    try { chrome.storage.local.set({ clickCount: state.clickCount }); } catch {}
    log(state.lastResult);
    console.log('[muse-auto-allow] ' + kind + ' "' + label.slice(0, 60) + '" | ' + context.slice(0, 90));
    try { window.dispatchEvent(new CustomEvent('muse-auto-allow:click', { detail: state.lastResult })); } catch {}
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
    if (hit) { doClick(hit.btn, hit.card, 'allow', null, hit.ctx); return; }

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
