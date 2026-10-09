// Muse Auto-Allow — content script (v1.6.0 dev: auto follow-up + v1.5.0 approval engine).
// Automatically clicks "Allow" on Muse (muse.ai) approval requests, and — when the
// user enables Auto follow-up — keeps Muse working long-run by sending a chosen
// prompt into the chat composer whenever Muse goes idle ('Connected' status).
// See docs/FOLLOWUP.md for the engine, its guards, its tests and its limitations.
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
//  E. Chat-level "A task needs review" bar -> click its Review button; the approval
//     panel (Allow/Deny) then renders and is approved by A/B on the next sweep.
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
  const REVIEW_BAR_THROTTLE_MS = 1000; // chat-level bar: snappy (the panel only renders after this click)
  const TEXT_COOLDOWN_MS = 30000;
  const ALLOW_DEDUP_MS = 5000;
  const ALLOW_RATE_MAX = 30;
  const AUX_RATE_MAX = 30;
  const AUX_RATE_WINDOW_MS = 60000;
  const DEFAULT = { enabled: true, minDelayMs: 300, clickCount: 0 };

  const state = { enabled: true, minDelayMs: 300, clickCount: 0, lastClickAt: 0, lastExpandAt: 0, lastSurfaceAt: 0, lastReviewBarAt: 0, lastResult: null };
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

  // Path E — chat-level notification bar: "A task needs review" (singular or plural),
  // "tasks need review", "N tasks need your approval" with a bare Review button. The
  // approval panel only renders after this click, so the next sweep handles the
  // Allow/Deny pair via paths A/B. Scoped strictly: the button text must be exactly
  // "Review" and its short enclosing container must carry the task-needs-review
  // wording (the chat message itself is far too long to match).
  const REVIEW_BAR_RE = /(a task|one task|\d+\s*tasks?|tasks?)\s+need(s|ed)?\s+(review|your approval)/i;
  function findReviewBarButton() {
    if (!auxRateOk()) return null;
    for (const b of buttonsIn(document)) {
      if (clickedNodes.has(b) || !clickable(b) || unsafeTarget(b)) continue;
      const bt = txt(b).trim();
      if (!/^review$/i.test(bt) || DESTRUCTIVE_RE.test(bt)) continue;
      let node = b, scope = null;
      for (let i = 0; i < 4 && node; i++) {
        node = node.parentElement;
        if (!node) break;
        const t = txt(node);
        if (t.length > 220) break; // bar text is short; a big container means we overshot
        if (REVIEW_BAR_RE.test(t)) { scope = node; break; }
      }
      if (!scope || !isVisible(scope)) continue;
      const key = 'reviewbar:' + txt(scope).slice(0, 160);
      if (onCooldown(key)) continue;
      return { btn: b, key };
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
      // first-install race (V4-5): another tab may have won the write — if the stored
      // key differs from ours, adopt the stored one so every entry stays readable
      const chk = await chrome.storage.local.get({ cryptKeyRaw: null });
      if (chk.cryptKeyRaw && chk.cryptKeyRaw !== b64(raw)) {
        cryptKey = await crypto.subtle.importKey('raw', unb64(chk.cryptKeyRaw), 'AES-GCM', false, ['encrypt', 'decrypt']);
        return cryptKey;
      }
      cryptKey = k;
      return k;
    } catch { return null; }
  }
  // a restored backup (or any other writer) can rotate the key — drop the cache (V4-4)
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
    if (kind === 'review-bar') { state.lastReviewBarAt = state.lastClickAt; markAux(); }
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

  // ===========================================================================
  // v1.6.0 — Auto follow-up engine ("keep Muse working long-run").
  // When Muse goes idle on muse.ai ('Muse' + 'Connected', no busy verb, no
  // spinner) and the user enabled followupEnabled, the engine types the chosen
  // prompt into the chat composer and submits it so the assistant continues.
  //
  // Idle detection — 3 fallback strategies (documented in docs/FOLLOWUP.md):
  //   1. assistant header: a short element reading exactly 'Muse' (or a short
  //      'Muse <status>' line) — classify the text in its small enclosing
  //      container.
  //   2. [aria-live] regions — short region text, strict idle match.
  //   3. class / data-testid containing 'status' — short text, strict idle match.
  // BUSY wins: /\b(is working|working|doing|thinking|running|analyzing|searching|
  // reading|writing|implementing|generating)\b/i or a visible spinner/progressbar.
  // IDLE only on /\bconnected\b/i with no busy match (strategies 2/3 require the
  // region to be JUST 'connected'). Absent/ambiguous => NOT idle (fail closed).
  //
  // Trigger guards (all mandatory): followupEnabled; idle observed CONTINUOUSLY
  // for followupIdleMs (default 60s); never while an approval surface is present
  // (click paths A–E keep absolute priority); per-tab cooldown followupCooldownMs
  // (default 10min); hard cap 6 automatic sends per rolling hour (per tab);
  // never while the composer already holds unsent text; a send only counts once
  // the composer verifiably empties/changes afterwards.
  // ===========================================================================
  const FOLLOWUP_DEFAULTS = {
    followupEnabled: false, // OFF by default — opt-in only
    followupPrompt: 'Approve and continue working', // first preset; popup offers presets + Custom…
    followupIdleMs: 60000,
    followupCooldownMs: 600000,
  };
  const FOLLOWUP_HOUR_MAX = 6;            // hard cap: automatic sends per rolling hour (per tab)
  const FOLLOWUP_HOUR_WINDOW_MS = 3600000;
  const FOLLOWUP_VERIFY_MS = 600;         // window to observe the composer emptying/changing
  const BUSY_RE = /\b(is working|working|doing|thinking|running|analyzing|searching|reading|writing|implementing|generating)\b/i;
  const IDLE_RE = /\bconnected\b/i;
  const IDLE_STRICT_RE = /^[^\p{L}\p{N}_]*connected[^\p{L}\p{N}_]*$/iu; // the whole short text is 'connected'
  const SPINNER_SEL = '[class*="spin" i], [class*="loading" i], [role="progressbar"]';
  const SEND_RE = /^(send|send message|send prompt|submit|submit message|send a message)$/i;

  const followup = {
    enabled: false,
    prompt: FOLLOWUP_DEFAULTS.followupPrompt,
    idleMs: FOLLOWUP_DEFAULTS.followupIdleMs,
    cooldownMs: FOLLOWUP_DEFAULTS.followupCooldownMs,
    state: 'unknown',   // last detected: working | idle | unknown
    idleSince: 0,       // timestamp idle was continuously observed from (0 = not idle)
    lastAttemptAt: 0,
    lastSentAt: 0,      // last VERIFIED send (composer emptied/changed) — answers followup-status
    attempts: [],       // attempt timestamps (rolling-hour cap)
    sending: false,     // typing/submit/verify in flight — no re-entry
    pendingVerify: null,
    lastAttr: '',
    lastResult: null,
  };

  function publishFollowupState() {
    if (followup.lastAttr === followup.state) return;
    followup.lastAttr = followup.state;
    try { document.documentElement.setAttribute('data-muse-followup', followup.state); } catch { /* ignore */ }
  }
  function classifyBusyIdle(text, strictIdle) {
    if (!text) return 'unknown';
    if (BUSY_RE.test(text)) return 'working';
    if (strictIdle ? IDLE_STRICT_RE.test(String(text).trim()) : IDLE_RE.test(text)) return 'idle';
    return 'unknown';
  }
  function spinnerIn(root) {
    try { for (const el of root.querySelectorAll(SPINNER_SEL)) if (isVisible(el)) return true; } catch { /* ignore */ }
    return false;
  }

  // Strategy 1 — assistant header: 'Muse' title/avatar + status line.
  function statusViaTitle() {
    let nodes;
    try { nodes = document.querySelectorAll('h1,h2,h3,h4,div,span,p'); } catch { return 'unknown'; }
    let checked = 0;
    for (const el of nodes) {
      if (++checked > 4000) break; // bound the scan on huge pages
      const raw = el.textContent || '';
      if (!raw || raw.length > 60) continue; // cheap pre-filter (no layout access)
      let t;
      try { t = txt(el); } catch { continue; }
      if (!t || t.length > 60 || !/^muse\b/i.test(t)) continue;
      const direct = classifyBusyIdle(t.replace(/^muse\b[\s:·—–-]*/i, ''), false);
      if (direct !== 'unknown') return direct;   // single 'Muse <status>' element
      if (!/^muse$/i.test(t)) continue;          // only a bare title climbs for the status
      let node = el;
      for (let up = 0; up < 4 && node && node !== document.body; up++) {
        node = node.parentElement;
        if (!node) break;
        let scopeTxt;
        try { scopeTxt = txt(node); } catch { break; }
        if (scopeTxt.length > 160) break; // overshot — status containers are small
        if (spinnerIn(node)) return 'working';
        const st = classifyBusyIdle(scopeTxt.replace(/^[^\p{L}\p{N}]*muse\b[\s:·—–-]*/iu, ''), false);
        if (st !== 'unknown') return st;
      }
    }
    return 'unknown';
  }

  // Strategy 2 — [aria-live] regions (status announcements render here).
  function statusViaLive() {
    try {
      for (const el of document.querySelectorAll('[aria-live]')) {
        let t;
        try { t = txt(el); } catch { continue; }
        if (!t || t.length > 120) continue;
        if (!isVisible(el)) continue;
        if (spinnerIn(el)) return 'working';
        const st = classifyBusyIdle(t, true);
        if (st !== 'unknown') return st;
      }
    } catch { /* ignore */ }
    return 'unknown';
  }

  // Strategy 3 — class/data-testid containing 'status'.
  function statusViaClass() {
    try {
      for (const el of document.querySelectorAll('[class*="status" i], [data-testid*="status" i]')) {
        let t;
        try { t = txt(el); } catch { continue; }
        if (!t || t.length > 60) continue;
        if (!isVisible(el)) continue;
        if (spinnerIn(el)) return 'working';
        const st = classifyBusyIdle(t, true);
        if (st !== 'unknown') return st;
      }
    } catch { /* ignore */ }
    return 'unknown';
  }

  // Combine: busy from ANY strategy wins (fail closed); idle needs a positive hit.
  function detectMuseState() {
    const verdicts = [];
    try { verdicts.push(statusViaTitle()); } catch { /* ignore */ }
    try { verdicts.push(statusViaLive()); } catch { /* ignore */ }
    try { verdicts.push(statusViaClass()); } catch { /* ignore */ }
    if (verdicts.indexOf('working') !== -1) return 'working';
    if (verdicts.indexOf('idle') !== -1) return 'idle';
    return 'unknown';
  }

  // Approval surfaces take absolute priority — while any is present, never send.
  // Reuses the click paths' selectors/rules (A–E) and fails closed on any error.
  function approvalPresent() {
    try {
      for (const card of document.querySelectorAll(CARD_SEL)) if (isVisible(card)) return true;
      for (const b of buttonsIn(document)) {
        if (!clickable(b)) continue;
        const t = txt(b);
        if (ALLOW_RE.test(t)) return true;                                    // any clickable allow button
        if (PENDING_CARD_RE.test(t) && !DONE_STATUS_RE.test(t)) return true;  // collapsed pending card
      }
      for (const s of document.querySelectorAll(SURFACE_SEL)) {
        if (isVisible(s) && NEED_APPROVAL_RE.test(txt(s))) return true;       // "N tasks need your approval"
      }
      for (const b of buttonsIn(document)) {
        if (!clickable(b) || !/^review$/i.test(txt(b).trim())) continue;      // chat-level review bar
        let node = b;
        for (let i = 0; i < 4 && node; i++) {
          node = node.parentElement;
          if (!node) break;
          const t = txt(node);
          if (t.length > 220) break;
          if (REVIEW_BAR_RE.test(t)) return true;
        }
      }
    } catch { return true; } // fail closed
    return false;
  }

  // ---- composer: exact 'Message' placeholder (live UI) -> placeholder/aria-label
  // mentioning message/prompt/chat (search fields excluded) -> contenteditable.
  // No blind last resort: an unknown composer means no send (fail closed). ----
  function isTextEntry(el) {
    try {
      return !!el && (el.tagName === 'TEXTAREA' ||
        (el.tagName === 'INPUT' && (!el.type || el.type === 'text' || el.type === 'search')));
    } catch { return false; }
  }
  function findComposer() {
    try {
      const entries = [...document.querySelectorAll('textarea, input')];
      for (const el of entries) {
        if (!isTextEntry(el) || !isVisible(el) || el.disabled || el.readOnly) continue;
        if (/^\s*message\s*$/i.test(el.getAttribute('placeholder') || '')) return el;
      }
      for (const el of entries) {
        if (!isTextEntry(el) || !isVisible(el) || el.disabled || el.readOnly) continue;
        const meta = ((el.getAttribute('placeholder') || '') + ' ' + (el.getAttribute('aria-label') || '')).trim();
        if (/\bsearch\b/i.test(meta)) continue;
        if (/\b(message|prompt|chat)\b/i.test(meta)) return el;
      }
      for (const el of document.querySelectorAll('[contenteditable="true"], [role="textbox"]')) {
        if (!isVisible(el)) continue;
        const meta = ((el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('data-placeholder') || '') + ' ' + (el.getAttribute('placeholder') || '')).trim();
        if (/\bsearch\b/i.test(meta)) continue;
        if (/\b(message|prompt|chat)\b/i.test(meta)) return el;
      }
    } catch { /* ignore */ }
    return null;
  }
  function composerValue(el) {
    if (!el) return '';
    try { if (typeof el.value === 'string') return el.value; } catch { /* ignore */ }
    try { return txt(el); } catch { return ''; }
  }
  // React-safe typing: native value setter + InputEvent('input'); contenteditable
  // falls back to execCommand('insertText') then textContent + input event.
  function typeIntoComposer(el, text) {
    try { el.focus(); } catch { /* ignore */ }
    if (isTextEntry(el)) {
      try {
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) desc.set.call(el, text); else el.value = text;
      } catch { try { el.value = text; } catch { return false; } }
      try { el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text })); }
      catch { try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch { /* ignore */ } }
      try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch { /* ignore */ }
      return composerValue(el) === text;
    }
    if (el.isContentEditable || el.getAttribute('role') === 'textbox') {
      let ok = false;
      try {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        if (sel) { sel.removeAllRanges(); sel.addRange(range); }
        ok = document.execCommand('insertText', false, text);
      } catch { ok = false; }
      const probe = text.slice(0, Math.min(12, text.length));
      if (!ok || !txt(el).includes(probe)) {
        try {
          el.textContent = text;
          el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
          ok = txt(el).includes(probe);
        } catch { ok = false; }
      }
      return ok;
    }
    return false;
  }
  // Submit strategies: a visible send/submit button (exact-ish aria-label/text) or
  // Enter keydown/keypress/keyup. The verifier retries the other one if needed.
  function findSendButton(composer) {
    try {
      const scope = (composer && composer.closest('form')) || document;
      for (const b of buttonsIn(scope)) {
        if (!clickable(b) || unsafeTarget(b)) continue;
        const metas = [b.getAttribute('aria-label') || '', b.getAttribute('title') || '', txt(b)];
        if (metas.some((m) => SEND_RE.test(m.trim()))) return b;
      }
    } catch { /* ignore */ }
    return null;
  }
  function pressEnter(el) {
    const opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    try { el.dispatchEvent(new KeyboardEvent('keydown', opts)); } catch { /* ignore */ }
    try { el.dispatchEvent(new KeyboardEvent('keypress', opts)); } catch { /* ignore */ }
    try { el.dispatchEvent(new KeyboardEvent('keyup', opts)); } catch { /* ignore */ }
  }
  function submitComposer(el, strategy) {
    if (strategy === 'button') {
      const b = findSendButton(el);
      if (!b) return false;
      try { b.click(); return true; } catch { return false; }
    }
    pressEnter(el);
    return true;
  }

  // ---- guards + trigger ----
  function followupEligible(now) {
    if (!followup.enabled || followup.sending) return false;
    if (followup.state !== 'idle' || !followup.idleSince) return false;
    if (now - followup.idleSince < followup.idleMs) return false;       // continuous-idle window
    if (now - followup.lastAttemptAt < followup.cooldownMs) return false;
    while (followup.attempts.length && now - followup.attempts[0] > FOLLOWUP_HOUR_WINDOW_MS) followup.attempts.shift();
    return followup.attempts.length < FOLLOWUP_HOUR_MAX;                // hard hourly cap
  }
  function followupTick() {
    if (!alive()) return; // the main heartbeat / stopForever handles teardown
    let st = 'unknown';
    try { st = detectMuseState(); } catch { st = 'unknown'; }
    if (st !== followup.state) { followup.state = st; publishFollowupState(); }
    const now = Date.now();
    if (st === 'idle') { if (!followup.idleSince) followup.idleSince = now; }
    else followup.idleSince = 0;
    if (!followupEligible(now)) return;
    followupAttempt(false);
  }
  // One attempt. Manual (popup 'Send now') skips the idle wait, the cooldown and the
  // hourly cap, but still respects: disabled, approval-present, composer-empty,
  // no-composer and empty-prompt. Returns { ok, reason }.
  function followupAttempt(manual) {
    if (!alive()) { stopForever(); return { ok: false, reason: 'dead' }; }
    if (!followup.enabled) return { ok: false, reason: 'disabled' };
    if (followup.sending) return { ok: false, reason: 'sending' };
    if (approvalPresent()) return { ok: false, reason: 'approval-present' };
    const composer = findComposer();
    if (!composer) return { ok: false, reason: 'no-composer' };
    if (composerValue(composer).trim()) return { ok: false, reason: 'composer-not-empty' };
    const text = String(followup.prompt || '').trim();
    if (!text) return { ok: false, reason: 'no-prompt' };
    if (!typeIntoComposer(composer, text)) return { ok: false, reason: 'type-failed' };
    const now = Date.now();
    followup.lastAttemptAt = now;
    if (!manual) followup.attempts.push(now); // manual sends are user-explicit; only auto sends count toward the cap
    followup.sending = true;
    const first = findSendButton(composer) ? 'button' : 'enter';
    submitComposer(composer, first);
    verifyFollowupSend(text, [first]);
    followup.lastResult = { at: new Date().toISOString(), kind: 'followup', via: first, text: text.slice(0, 120), verified: null };
    return { ok: true, reason: 'attempted', via: first };
  }
  // Success is only counted when the composer verifiably emptied or changed (the app
  // accepted the send). Otherwise the other submit strategy is tried once, then the
  // attempt stays unverified and any leftover text blocks further sends (fail closed)
  // until it is cleared.
  function verifyFollowupSend(text, tried) {
    if (followup.pendingVerify) clearTimeout(followup.pendingVerify);
    followup.pendingVerify = setTimeout(() => {
      followup.pendingVerify = null;
      if (!alive()) { followup.sending = false; return; }
      const c = findComposer();
      const v = c ? composerValue(c) : null;
      if (c && v !== text) { // emptied (v === '') or changed => delivered
        followup.sending = false;
        followup.lastSentAt = Date.now();
        if (followup.lastResult) followup.lastResult.verified = true;
        console.log('[muse-auto-allow] follow-up sent via ' + tried[tried.length - 1]);
        return;
      }
      if (tried.length < 2 && c) {
        const next = tried.indexOf('enter') !== -1 ? 'button' : 'enter';
        if (submitComposer(c, next)) { tried.push(next); verifyFollowupSend(text, tried); return; }
      }
      followup.sending = false;
      if (followup.lastResult) followup.lastResult.verified = false;
      console.warn('[muse-auto-allow] follow-up not verified — composer still holds text; will not retry until it is cleared');
    }, FOLLOWUP_VERIFY_MS);
  }
  function applyFollowupSettings(s) {
    if (!s || typeof s !== 'object') return;
    followup.enabled = s.followupEnabled === true;
    if (typeof s.followupPrompt === 'string') followup.prompt = s.followupPrompt;
    const ni = Number(s.followupIdleMs);
    if (Number.isFinite(ni) && ni >= 0) followup.idleMs = ni;
    const nc = Number(s.followupCooldownMs);
    if (Number.isFinite(nc) && nc >= 0) followup.cooldownMs = nc;
  }

  // Popup messages: manual send-now + status ping. Sync responses (no async return).
  try {
    chrome.runtime.onMessage.addListener((m, _sender, sendResponse) => {
      if (!m || typeof m.type !== 'string') return;
      if (m.type === 'followup-send-now') {
        const r = followupAttempt(true);
        try { sendResponse(Object.assign({ state: followup.state, lastSentAt: followup.lastSentAt || null }, r)); } catch { /* ignore */ }
        return;
      }
      if (m.type === 'followup-status') {
        try { sendResponse({ state: followup.state, lastSentAt: followup.lastSentAt || null, enabled: followup.enabled }); } catch { /* ignore */ }
      }
    });
  } catch { /* ignore */ }

  function alive() { try { return !!chrome.runtime?.id; } catch { return false; } }
  function stopForever() {
    try { if (obs) obs.disconnect(); } catch { /* ignore */ }
    try { if (heartbeat) clearInterval(heartbeat); } catch { /* ignore */ }
    try { if (pendingTimer) clearTimeout(pendingTimer); } catch { /* ignore */ }
    try { if (followup.pendingVerify) clearTimeout(followup.pendingVerify); } catch { /* ignore */ }
    followup.sending = false;
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

    if (now - state.lastReviewBarAt >= REVIEW_BAR_THROTTLE_MS) {
      const rb = findReviewBarButton();
      if (rb) { doClick(rb.btn, null, 'review-bar', rb.key); return; }
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
    // v1.6.0 auto follow-up settings (independent of the approve engine's toggle)
    chrome.storage.local.get(FOLLOWUP_DEFAULTS, (f) => { applyFollowupSettings(f); followupTick(); });
    chrome.storage.onChanged.addListener((ch) => {
      if (ch.enabled) state.enabled = !!ch.enabled.newValue;
      if (ch.minDelayMs) {
        const n = Number(ch.minDelayMs.newValue);
        if (Number.isFinite(n) && n >= 0) state.minDelayMs = n;
      }
      let fch = false;
      if (ch.followupEnabled) { followup.enabled = !!ch.followupEnabled.newValue; fch = true; }
      if (ch.followupPrompt && typeof ch.followupPrompt.newValue === 'string') { followup.prompt = ch.followupPrompt.newValue; fch = true; }
      if (ch.followupIdleMs) { const fn = Number(ch.followupIdleMs.newValue); if (Number.isFinite(fn) && fn >= 0) followup.idleMs = fn; fch = true; }
      if (ch.followupCooldownMs) { const fc = Number(ch.followupCooldownMs.newValue); if (Number.isFinite(fc) && fc >= 0) followup.cooldownMs = fc; fch = true; }
      if (fch) { try { followupTick(); } catch { /* ignore */ } }
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
  heartbeat = setInterval(() => { sweep('interval'); try { followupTick(); } catch { /* ignore */ } }, 1000);

  window.__museAutoAllow = {
    get state() { return { ...state }; },
    sweep: () => sweep('manual'),
    get followup() {
      return { state: followup.state, enabled: followup.enabled, idleSince: followup.idleSince, lastSentAt: followup.lastSentAt,
               lastAttemptAt: followup.lastAttemptAt, attempts: followup.attempts.length, sending: followup.sending, lastResult: followup.lastResult };
    },
  };
})();
