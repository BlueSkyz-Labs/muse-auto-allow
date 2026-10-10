// Muse Auto-Allow — content script (v1.8.0: pause / dry-run / rules gates + smart follow-up + v1.7.0 rotation).
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
//    reminders/tips without explicit approval wording) are skipped — and notification/
//    permission-style cards (notifications/camera/microphone/location/clipboard) are
//    NEVER clicked even when they carry 'allow muse' wording (OB-1, fail closed).
//  - v1.8.0 (owner-reported): CONNECTOR cards — title/subtitle 'Connector', a standalone
//    'Connect'/'Set up'/'Add account' button, or token/credential-entry wording ('API
//    token', 'paste token', 'access token') — are USER-INPUT surfaces (the user connects
//    the service and pastes the token themselves). The WHOLE container is hard-blocked on
//    every click path, even when an Allow/Deny-like pair renders inside it; the refusal is
//    logged as 'blocked' with blockedReason 'connector'. Consent boundary — never automated.
//  - Standing-grant labels ("Always allow", "Allow for this site/task") are not recognized
//    as the positive option — the engine clicks only plain/one-shot forms, so it can never
//    silently escalate the granted scope (a card offering only a standing grant is left to
//    the user). Trailing decoration on the label (an options-menu chevron) is tolerated.
//    v1.8.0 tightens this further: at most ONE allow click per card/pair scope — a persistent
//    card that keeps several recognized allow options on screen is not walked down the
//    ranking on later sweeps (that would escalate the scope after the first approval).
//  - Allow clicks carry a 5s fingerprint dedup whose context is computed from the same
//    button-anchored scope in every detection path (no path-dependent bypass).
//  - Allow clicks are globally rate-capped at 30/min; auxiliary clicks (expand /
//    open-panel) at 30/min with 30s per-text cooldowns — no unbounded click loops.
//  - Liveness guard: if the extension context is invalidated (reload/disable), the
//    script stops itself instead of continuing to click.
//  - Every click is logged to chrome.storage.local (see popup).
//
// v1.8.0 gates (frozen storage contracts — see docs/ENGINE_V18.md):
//  - pauseUntil (epoch ms): while Date.now() < pauseUntil ALL automation is halted — every
//    click path (A–E) and the follow-up engine, manual 'Send now' included.
//  - dryRun: detection + logging run exactly as usual but nothing is clicked and no follow-up
//    is typed/sent; entries carry entry.dryRun=true and the kind gets a '-dry' suffix
//    ('allow-dry', 'expand-dry', …; the follow-up logs 'followup-dry').
//  - rules.blockKeywords (seed list): any keyword (case-insensitive) in the card text or the
//    extracted context => the candidate is NEVER clicked; one 'blocked' log entry per window
//    with blockedReason 'keyword:<kw>'.
//  - rules.allowTopics (non-empty): auto-click ONLY when extractTopic() matches
//    (case-insensitive exact); a mismatch logs 'blocked' with blockedReason 'topic'.
//  - allowOnceMode: recognizes 'Allow once only' and prefers one-shot options ('Allow once' /
//    'Allow once only' / 'Allow this time') over plain and standing-grant ('Allow always')
//    options in the same pair; a pair with a single recognized option clicks as before.
//  - followupSmart.stuckMin: status 'working' with NO DOM mutation for stuckMin minutes =>
//    the stuck-recovery prompt is sent (0 = off; default 10).
//  - followupSmart.errorRecovery: a visible error surface => the recovery prompt is sent
//    (same cooldowns/caps; never while an approval is present; once per distinct error text).
//  - followupSchedule: sends only when the local hour is in [start,end) (wrap-around
//    supported) and, with onlyActiveTab, only while this document is visible.
(() => {
  if (window.__museAutoAllowLoaded) return;
  window.__museAutoAllowLoaded = true;
  try { document.documentElement.setAttribute('data-muse-auto-allow', '1'); } catch {}
  // Interact ONLY on muse.ai (defense-in-depth: the manifest matches already scope us;
  // the localhost allowance exists solely for the test-harness copy).
  const ON_MUSE = /(^|\.)muse\.ai$/.test(location.hostname) || location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  if (!ON_MUSE) return;

  const ALLOW_RE = /^\s*(allow|approve)(\s+(once|always|this time))?\s*$/i;
  // The positive option can carry a trailing chevron/decoration (an options-menu control,
  // observed live as an "allow options" affordance). Trailing DECORATION is tolerated;
  // the WORDING is deliberately not widened: standing-grant labels ("Always allow",
  // "Allow for this site/task") are NOT recognized — auto-clicking those would silently
  // escalate the granted scope, so such cards are left to the user (fail closed).
  const DECOR_TAIL_RE = /[\s\u25be\u25b4\u2304\u2303\u02c5\u02c4\u2228\u2227\u203a\u00bb\u2192\u2325\u25bf\u25b5]+$/;
  const stripDecor = (t) => String(t || '').replace(DECOR_TAIL_RE, '');
  // v1.8.0 allow-once variant: exact 'Allow once' / 'Allow once only' (decoration tolerated).
  // 'Allow once' already matches ALLOW_RE; 'Allow once only' is recognized only while
  // allowOnceMode is on — the mode is what asks for the narrowest one-shot option.
  const isAllowText = (t) => ALLOW_RE.test(stripDecor(t)) || (v18.allowOnceMode && /^\s*allow once only\s*$/i.test(stripDecor(t)));
  const DENY_RE = /^\s*(deny|reject|decline)(\s+(once|this time))?\s*$/i;
  const CARD_SEL = '[data-testid="hatch-inline-approval-card"]';
  const SURFACE_SEL = '[data-testid="hatch-inline-approval-card"][data-hatch-background-approval-surface="true"]';
  // Collapsed pending cards open with the approval title. A live card can carry a short
  // leading badge INSIDE the same clickable element (e.g. "Needs review · <title>"), so the
  // title may start within the first 24 characters — the phrase itself stays mandatory
  // (that phrase IS the context rail) and the element must still be a real button.
  const PENDING_CARD_RE = /^\s*[\s\S]{0,24}?allow muse to perform this action\b/i;
  const DONE_STATUS_RE = /(allowed|denied|rejected|expired)\s*·/i;
  const NEED_APPROVAL_RE = /need(s)? your approval/i;
  const SURFACE_BTN_RE = /\b(review|open|show|view|details|see)\b/i;
  const DESTRUCTIVE_RE = /\b(delete|remove|deny|reject|decline|clear|reset|dismiss|block)\b/i;
  const CONSENT_ONLY_RE = /\b(notifications?|newsletter|subscribe|cookies?|marketing|alerts?|reminders?|tips?)\b/i;
  const APPROVAL_CONTEXT_RE = /\b(approv|perform this action|allow muse\b)/i;
  // OB-1: notification/permission-style cards are NEVER clicked — the 'allow muse …'
  // approval wording can no longer override the consent filter (fail closed).
  const PERMISSION_CARD_RE = /\b(send notifications|notifications?|camera|microphone|location|clipboard)\b/i;
  // v1.8.0 (owner-reported): CONNECTOR cards are USER-INPUT surfaces — the user connects a
  // service and pastes a token themselves (live shape: title "Cloudflare", subtitle
  // "Connector", a full-width "Connect" button). The extension must NEVER interact with
  // them: the whole container is hard-blocked — even when an Allow/Deny-like pair renders
  // inside it — and the refusal is logged (blockedReason 'connector'). Consent boundary.
  const CONNECTOR_WORD_RE = /\bconnectors?\b/i;
  const CONNECT_BTN_RE = /^(connect\b|set\s+up\b|add\s+account\b)/i;
  const TOKEN_WORDING_RE = /\b(api\s+token|access\s+token|personal\s+access\s+token|paste\s+(the\s+|your\s+)?token|api\s+key)\b/i;
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
  // ---- v1.8.0 frozen settings (contracts: docs/ENGINE_V18.md) ----
  const BLOCK_SEED = ['delete', 'remove', 'drop', 'wipe', 'format', 'billing', 'payment', 'invoice',
    'pay', 'transfer', 'refund', 'production', 'deploy', 'revoke', 'rm -rf', 'sudo',
    'credential', 'password', 'secret', 'token'];
  const TOPIC_MAX = 50;   // allowTopics: at most 50 entries…
  const TOPIC_LEN = 64;   // …each capped at 64 chars (entries are sliced, never dropped silently)
  const STUCK_PROMPT_DEFAULT = 'Looks like you may be stuck — check the last error or continue where you left off.';
  const ERROR_PROMPT_DEFAULT = 'An error occurred. Read the error, fix the root cause, then continue.';
  const BLOCKED_DEDUP_MS = 30000; // one 'blocked' log entry per fingerprint per window
  const v18 = {
    pauseUntil: 0,          // epoch ms; now < pauseUntil => everything halted
    dryRun: false,          // detect + log, never click/send
    allowOnceMode: false,   // prefer one-shot allow options over standing grants
    allowTopics: [],        // non-empty => click only when extractTopic() matches
    blockKeywords: BLOCK_SEED.map((k) => k.toLowerCase()),
    smart: { stuckMin: 10, stuckPrompt: STUCK_PROMPT_DEFAULT, errorRecovery: false, errorPrompt: ERROR_PROMPT_DEFAULT },
    schedule: { enabled: false, start: 8, end: 18, onlyActiveTab: false },
  };
  const dryNodes = new WeakSet();  // nodes already detected+logged under dry-run (no click made)
  // v1.8.0: one allow click per card/pair scope. A persistent card that keeps several
  // recognized allow options on screen after the first click must not be walked down the
  // ranking (click "Allow once", then "Allow", then "Allow always" on later sweeps) — that
  // would silently escalate the granted scope. The scope is marked with the allow click.
  const allowDoneCards = new WeakSet();
  const blockedFps = new Map();    // blocked fingerprint -> ts (log-spam guard)
  let lastDomActivityAt = Date.now(); // stuck detection: timestamp of the last DOM mutation
  let lastFlagPause = null, lastFlagDry = null; // publishFlags dedup (never re-set unchanged)
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
  // A node is "handled" when a real click happened on it, or (dry-run only) when it was
  // already detected+logged in dry-run mode. Turning dry-run OFF re-arms those nodes — the
  // simulation never consumes a card.
  const handledNode = (el) => clickedNodes.has(el) || (v18.dryRun && dryNodes.has(el));
  // Never click something that navigates or submits: anchors, or buttons tied to a <form>.
  const unsafeTarget = (el) => !!el.closest('a') || !!el.form;
  const buttonsIn = (scope) => [...scope.querySelectorAll('button, [role="button"]')];
  const allowBtnsIn = (scope) => buttonsIn(scope).filter((b) => isAllowText(txt(b)));
  const denyBtnsIn = (scope) => buttonsIn(scope).filter((b) => DENY_RE.test(txt(b)));

  // Prefer plain "Allow"; then "Allow once"; then "Allow always".
  // v1.8.0 allowOnceMode: one-shot variants rank first, plain forms next, standing grants
  // last. Rank never FILTERS — a pair with a single recognized option clicks it as before.
  function rankAllow(b) {
    const raw = txt(b).toLowerCase();
    const oneShot = /once|this time/.test(raw);
    if (v18.allowOnceMode) {
      const t = stripDecor(raw).trim();
      if (oneShot) return 0;
      return t === 'allow' || t === 'approve' ? 1 : 2;
    }
    return raw === 'allow' || raw === 'approve' ? 0 : oneShot ? 1 : 2;
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
  function consentOnly(cardText) { return PERMISSION_CARD_RE.test(cardText) || (CONSENT_ONLY_RE.test(cardText) && !APPROVAL_CONTEXT_RE.test(cardText)); }
  // Connector hard-block: true when the scope carries connector wording, credential-entry
  // wording, or a standalone Connect-family button (≤40 chars, starts with connect/set up/
  // add account). Fail closed — over-blocking a container is the intended trade-off.
  function connectorIn(scope) {
    try {
      if (!scope) return false;
      const t = txt(scope);
      if (t && (CONNECTOR_WORD_RE.test(t) || TOKEN_WORDING_RE.test(t))) return true;
      for (const b of buttonsIn(scope)) {
        const bt = txt(b).trim();
        if (bt && bt.length <= 40 && CONNECT_BTN_RE.test(bt)) return true;
      }
    } catch { /* ignore */ }
    return false;
  }
  // The reported card can render its title/subtitle/Connect button in a wrapper AROUND the
  // pair container, so a bounded climb (scope + 2 ancestors, never past <body>) is checked.
  function connectorNear(scope, levels) {
    let n = scope;
    const max = levels || 2;
    for (let i = 0; i < max && n && n !== document.body && n !== document.documentElement; i++) {
      if (connectorIn(n)) return true;
      n = n.parentElement;
    }
    return false;
  }

  // ===========================================================================
  // v1.8.0 gate helpers (pause / dry-run / blocklist / topic / schedule / digest)
  // ===========================================================================
  const paused = () => Date.now() < Number(v18.pauseUntil || 0);
  // followupSchedule: send only when the local hour is in [start,end) — wrap-around
  // supported (start > end spans midnight; start === end is a 24h window) — and, with
  // onlyActiveTab, only while this document is visible.
  function scheduleAllows() {
    const s = v18.schedule;
    if (!s.enabled) return true;
    const h = new Date().getHours();
    const inWindow = s.start < s.end ? (h >= s.start && h < s.end) : (h >= s.start || h < s.end);
    if (!inWindow) return false;
    if (s.onlyActiveTab) { try { if (document.visibilityState !== 'visible') return false; } catch { return false; } }
    return true;
  }
  function keywordIn(text) {
    const t = String(text || '').toLowerCase();
    if (!t) return null;
    for (const kw of v18.blockKeywords) if (kw && t.includes(kw)) return kw;
    return null;
  }
  // 'keyword:<kw>' when a seed/custom keyword appears (case-insensitive substring) in the
  // card text OR the extracted context; 'topic' when a non-empty allowTopics list does not
  // exactly (case-insensitively) match extractTopic(). null => no rule blocks the click.
  function blockReasonFor(cardText, ctx) {
    const kw = keywordIn(String(cardText || '') + ' ' + String(ctx || ''));
    if (kw) return 'keyword:' + kw;
    if (v18.allowTopics.length) {
      const topic = String(extractTopic(ctx || cardText || '')).toLowerCase();
      if (!v18.allowTopics.some((x) => x.toLowerCase() === topic)) return 'topic';
    }
    return null;
  }
  // One 'blocked' log entry per fingerprint per window — a persistent dangerous card must not
  // flood the log. Never clicks; never counts as a click (digest.blocked only).
  function noteBlocked(label, reason, text, fpKey) {
    const key = (fpKey || String(text || '').slice(0, 160)) + '|' + reason;
    const t = blockedFps.get(key);
    if (t && Date.now() - t < BLOCKED_DEDUP_MS) return;
    blockedFps.set(key, Date.now());
    if (blockedFps.size > 200) blockedFps.delete(blockedFps.keys().next().value);
    const entry = { at: new Date().toISOString(), kind: 'blocked', label: String(label || '').slice(0, 60), blockedReason: reason, context: String(text || '').slice(0, 240) };
    if (v18.dryRun) entry.dryRun = true;
    state.lastResult = entry;
    recordClick(entry, entry.context, false);
    bumpDigest({ blocked: 1 });
    console.log('[muse-auto-allow] blocked (' + reason + ') "' + entry.label + '"');
  }
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
  const hourOf = (v, dflt) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= 23 ? n : dflt; };
  // Presence-aware: the boot read passes every key, storage.onChanged passes only what changed.
  function applyV18Settings(s) {
    if (!s || typeof s !== 'object') return;
    if ('pauseUntil' in s) { const n = Number(s.pauseUntil); v18.pauseUntil = Number.isFinite(n) && n > 0 ? n : 0; }
    if ('dryRun' in s) v18.dryRun = s.dryRun === true;
    if ('allowOnceMode' in s) v18.allowOnceMode = s.allowOnceMode === true;
    if ('rules' in s) {
      const rules = asObj(s.rules);
      if ('allowTopics' in rules) v18.allowTopics = sanitizeList(rules.allowTopics, TOPIC_MAX, TOPIC_LEN) || [];
      if ('blockKeywords' in rules) {
        // Fail closed: the list is never truncated (a dropped keyword would silently unblock).
        const kws = sanitizeList(rules.blockKeywords, 500, 0);
        v18.blockKeywords = (kws || []).map((k) => k.toLowerCase());
      }
    }
    if ('followupSmart' in s) {
      const sm = asObj(s.followupSmart);
      if ('stuckMin' in sm) { const n = Number(sm.stuckMin); v18.smart.stuckMin = Number.isFinite(n) && n >= 0 ? Math.min(n, 1440) : 10; }
      if ('stuckPrompt' in sm) v18.smart.stuckPrompt = (typeof sm.stuckPrompt === 'string' && sm.stuckPrompt.trim()) ? sm.stuckPrompt.trim().slice(0, 600) : STUCK_PROMPT_DEFAULT;
      if ('errorRecovery' in sm) v18.smart.errorRecovery = sm.errorRecovery === true;
      if ('errorPrompt' in sm) v18.smart.errorPrompt = (typeof sm.errorPrompt === 'string' && sm.errorPrompt.trim()) ? sm.errorPrompt.trim().slice(0, 600) : ERROR_PROMPT_DEFAULT;
    }
    if ('followupSchedule' in s) {
      const sch = asObj(s.followupSchedule);
      if ('enabled' in sch) v18.schedule.enabled = sch.enabled === true;
      if ('start' in sch) v18.schedule.start = hourOf(sch.start, 8);
      if ('end' in sch) v18.schedule.end = hourOf(sch.end, 18);
      if ('onlyActiveTab' in sch) v18.schedule.onlyActiveTab = sch.onlyActiveTab === true;
    }
  }
  // Observability only (no behavior): mirrors the pause/dry flags onto <html>. Written ONLY on
  // change — an unconditional setAttribute would register as DOM activity and starve the stuck
  // detector (every tick would look like a mutation).
  function publishFlags() {
    try {
      const p = paused() ? '1' : '0';
      const d = v18.dryRun ? '1' : '0';
      const el = document.documentElement;
      if (p !== lastFlagPause) { lastFlagPause = p; el.setAttribute('data-muse-pause', p); }
      if (d !== lastFlagDry) { lastFlagDry = d; el.setAttribute('data-muse-dryrun', d); }
    } catch { /* ignore */ }
  }
  // Digest counters (chrome.storage.local.digestCounters) — the background service worker
  // composes the startup digest from them. Serialized like the click queue (same cross-tab
  // lock pattern) so parallel tabs cannot lose an increment.
  const digestQueue = [];
  let digestFlushing = false;
  function bumpDigest(delta) {
    digestQueue.push(delta);
    flushDigest();
  }
  function flushDigest() {
    if (digestFlushing || !digestQueue.length) return;
    digestFlushing = true;
    const run = () => new Promise((resolve) => {
      try {
        chrome.storage.local.get({ digestCounters: null }, (s) => {
          const d = asObj(s.digestCounters);
          while (digestQueue.length) {
            const x = digestQueue.shift();
            d.clicks = (Number(d.clicks) || 0) + (Number(x.clicks) || 0);
            d.followups = (Number(d.followups) || 0) + (Number(x.followups) || 0);
            d.blocked = (Number(d.blocked) || 0) + (Number(x.blocked) || 0);
          }
          try { chrome.storage.local.set({ digestCounters: d }); } catch { /* invalidated */ }
          resolve();
        });
      } catch { resolve(); }
    }).finally(() => { digestFlushing = false; });
    let started = false;
    const once = () => { if (started) return; started = true; return run(); };
    try {
      const p = navigator.locks.request('maa-digest-v1', () => once());
      if (p && typeof p.catch === 'function') p.catch(() => once());
    } catch { once(); }
  }

  // Path A — Muse-marked approval cards.
  function findMarkedAllow() {
    for (const card of document.querySelectorAll(CARD_SEL)) {
      if (card.matches(SURFACE_SEL) || !isVisible(card)) continue;
      // connector hard-block: never interact with the container, even with a pair inside
      if (connectorNear(card, 1)) { noteBlocked('Connect', 'connector', txt(card), 'connector:' + txt(card).slice(0, 160)); continue; }
      if (allowDoneCards.has(card)) continue; // already approved once — never walk to a broader option
      if (!denyBtnsIn(card).some(clickable)) continue;
      const cardText = txt(card);
      const allow = pickAllow(allowBtnsIn(card).filter((b) => {
        if (handledNode(b) || unsafeTarget(b)) return false;
        const c = contextText(contextScope(b));
        if (consentOnly(c)) return false;
        const reason = blockReasonFor(cardText, c);
        if (reason) { noteBlocked(txt(b), reason, cardText, 'card:' + cardText.slice(0, 160)); return false; }
        return !allowOnCooldown(allowFp(b, c));
      }));
      if (allow) return { btn: allow, card, ctx: contextText(contextScope(allow)) };
    }
    return null;
  }

  // Path B — text pair heuristic (cards without the marker).
  function findPairAllow() {
    for (const b of buttonsIn(document)) {
      if (handledNode(b) || !clickable(b) || !isAllowText(txt(b)) || unsafeTarget(b)) continue;
      let node = b;
      for (let depth = 0; depth < 4 && node; depth++) {
        node = node.parentElement;
        if (!node) break;
        const btns = buttonsIn(node);
        if (!btns.length) continue; // climb to the first button container
        // The pair must sit in the SAME button container and the deny must be clickable —
        // a lone Allow next to a distant/hidden Deny is not an approval card (F2).
        if (!btns.some((x) => DENY_RE.test(txt(x)) && clickable(x))) break;
        // Cards can offer several positive options (e.g. "Allow once" next to a broader
        // grant): click only the BEST-RANKED recognized allow in this container — and only
        // if that is the candidate itself, so nothing below it is ever preferred.
        const allows = btns.filter((x) => isAllowText(txt(x)) && clickable(x))
          .sort((a, x) => rankAllow(a) - rankAllow(x));
        if (allows.length && allows[0] === b) {
          if (connectorNear(node, 2)) { // connector hard-block (container-level)
            noteBlocked('Connect', 'connector', txt(node) + ' ' + contextText(contextScope(b)), 'connector:' + txt(node).slice(0, 160));
            break;
          }
          if (allowDoneCards.has(node)) break; // one allow click per pair scope (no scope walk)
          const ctx = contextText(contextScope(b));
          if (consentOnly(ctx)) break; // skip this candidate
          const cardText = txt(node);
          const reason = blockReasonFor(cardText, ctx);
          if (reason) { noteBlocked(txt(b), reason, cardText, 'pair:' + cardText.slice(0, 160)); break; }
          if (allowOnCooldown(allowFp(b, ctx))) break;
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
      if (handledNode(b) || !clickable(b) || unsafeTarget(b)) continue;
      const t = txt(b);
      if (!PENDING_CARD_RE.test(t)) continue;
      if (/hide details/i.test(t) || DONE_STATUS_RE.test(t)) continue;
      if (connectorNear(b, 2)) { noteBlocked('Connect', 'connector', t, 'connector:' + t.slice(0, 160)); continue; }
      const reason = blockReasonFor(t, contextText(b));
      if (reason) { noteBlocked('expand', reason, t, 'expand:' + t.slice(0, 160)); continue; }
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
      if (connectorNear(surface, 2)) { noteBlocked('Connect', 'connector', t, 'connector:' + t.slice(0, 160)); continue; }
      const reason = blockReasonFor(t, t);
      if (reason) { noteBlocked('open-panel', reason, t, 'surface:' + t.slice(0, 160)); continue; }
      const key = 'surface:' + t.slice(0, 160);
      if (onCooldown(key)) continue;
      const btn = buttonsIn(surface).find((b) =>
        clickable(b) && !unsafeTarget(b) && SURFACE_BTN_RE.test(txt(b)) && !DESTRUCTIVE_RE.test(txt(b)));
      if (!btn || handledNode(btn)) continue;
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
      if (handledNode(b) || !clickable(b) || unsafeTarget(b)) continue;
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
      const scopeTxt = txt(scope);
      if (connectorNear(scope, 2)) { noteBlocked('Connect', 'connector', scopeTxt, 'connector:' + scopeTxt.slice(0, 160)); continue; }
      const reason = blockReasonFor(scopeTxt, scopeTxt);
      if (reason) { noteBlocked('review-bar', reason, scopeTxt, 'reviewbar:' + scopeTxt.slice(0, 160)); continue; }
      const key = 'reviewbar:' + scopeTxt.slice(0, 160);
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
            if (item.counts !== false) { // blocked / dry-run / follow-up entries never count as clicks
              count += 1;
              st.byDay[item.day] = (Number(st.byDay[item.day]) || 0) + 1;
              st.byMonth[item.month] = (Number(st.byMonth[item.month]) || 0) + 1;
              st.byYear[item.year] = (Number(st.byYear[item.year]) || 0) + 1;
              st.byTopic[item.topic] = (Number(st.byTopic[item.topic]) || 0) + 1;
            }
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
  function recordClick(entry, context, counts) {
    const d = new Date();
    // counts=false: the entry is recorded in the log but never counts as a click (blocked
    // events, dry-run actions, follow-up sends) — clickCount/stats stay honest.
    clickQueue.push({ entry, day: dayKey(d), month: monthKey(d), year: String(d.getFullYear()), topic: extractTopic(context), counts: counts !== false });
    if (clickQueue.length > 60) clickQueue.splice(0, clickQueue.length - 60);
    flushClicks();
  }

  function doClick(btn, card, kind, cooldownKey, ctx) {
    // v1.8.0 dry-run: every state transition happens exactly as for a real click (dedup,
    // cooldowns, rate caps, pacing) but the DOM click is skipped and the entry is flagged.
    const isDry = v18.dryRun === true;
    if (isDry) dryNodes.add(btn); else clickedNodes.add(btn);
    const label = txt(btn);
    const context = (card ? contextText(card) : label).slice(0, 240);
    state.lastClickAt = Date.now();
    if (kind === 'expand') { state.lastExpandAt = state.lastClickAt; markAux(); }
    if (kind === 'open-panel') { state.lastSurfaceAt = state.lastClickAt; markAux(); }
    if (kind === 'review-bar') { state.lastReviewBarAt = state.lastClickAt; markAux(); }
    if (kind === 'allow') {
      markAllowFp(allowFp(btn, ctx !== undefined ? ctx : (card ? contextText(card) : '')));
      allowClicks.push(state.lastClickAt);
      // one allow click per card/pair scope (v1.8.0) — but a DRY run must not consume the
      // card, so the mark is only placed when a real click happened
      if (card && !isDry) allowDoneCards.add(card);
    }
    if (cooldownKey) markCooldown(cooldownKey);
    state.clickCount += 1;
    const entryKind = isDry ? kind + '-dry' : kind;
    state.lastResult = { at: new Date().toISOString(), kind: entryKind, label, context };
    if (isDry) state.lastResult.dryRun = true;
    recordClick(state.lastResult, context, !isDry);
    console.log('[muse-auto-allow] ' + entryKind + ' "' + label.slice(0, 60) + '" | ' + context.slice(0, 90));
    if (isDry) return; // detection + log only — nothing is clicked
    bumpDigest({ clicks: 1 });
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
  //
  // v1.7.0 — round-robin prompt rotation: when a non-empty followupPrompts array is
  // stored, each send uses followupPrompts[followupRotateIdx % len] and the index is
  // advanced + persisted ONLY after a VERIFIED send (a blocked or failed attempt must
  // never skip a prompt). An absent/empty array keeps the legacy single followupPrompt.
  // ===========================================================================
  const FOLLOWUP_DEFAULTS = {
    followupEnabled: false, // OFF by default — opt-in only
    followupPrompt: 'Approve and continue working', // first preset; popup offers presets + Custom…
    followupIdleMs: 60000,
    followupCooldownMs: 600000,
    followupPrompts: [],    // rotation list (composed strings, user-ordered)
    followupRotateIdx: 0,   // index of the NEXT prompt to send
  };
  const FOLLOWUP_HOUR_MAX = 6;            // hard cap: automatic sends per rolling hour (per tab)
  const FOLLOWUP_HOUR_WINDOW_MS = 3600000;
  const FOLLOWUP_VERIFY_MS = 600;         // window to observe the composer emptying/changing
  const FOLLOWUP_ROTATION_MAX = 20;       // sanity bound for the persisted rotation list
  const BUSY_RE = /\b(is working|working|doing|thinking|running|analyzing|searching|reading|writing|implementing|generating)\b/i;
  const IDLE_RE = /\bconnected\b/i;
  const IDLE_STRICT_RE = /^[^\p{L}\p{N}_]*connected[^\p{L}\p{N}_]*$/iu; // the whole short text is 'connected'
  const SPINNER_SEL = '[class*="spin" i], [class*="loading" i], [role="progressbar"]';
  const SEND_RE = /^(send|send message|send prompt|submit|submit message|send a message)$/i;

  const followup = {
    enabled: false,
    prompt: FOLLOWUP_DEFAULTS.followupPrompt,
    prompts: [],        // rotation list (v1.7.0); non-empty = round-robin mode
    rotateIdx: 0,       // index of the NEXT prompt to send
    idleMs: FOLLOWUP_DEFAULTS.followupIdleMs,
    cooldownMs: FOLLOWUP_DEFAULTS.followupCooldownMs,
    state: 'unknown',   // last detected: working | idle | unknown
    idleSince: 0,       // timestamp idle was continuously observed from (0 = not idle)
    workingSince: 0,    // v1.8.0: timestamp 'working' was continuously observed from (stuck watch)
    lastErrorFp: '',    // v1.8.0: error text already answered — one recovery send per distinct error
    lastAttemptAt: 0,
    lastSentAt: 0,      // last VERIFIED send (composer emptied/changed) — answers followup-status
    attempts: [],       // attempt timestamps (rolling-hour cap)
    sending: false,     // typing/submit/verify in flight — no re-entry
    pendingVerify: null,
    lastAttr: '',
    lastResult: null,
  };

  // ---- v1.7.0 rotation helpers ----
  // The text a send would type right now: the rotation item when a list is stored,
  // otherwise the legacy single prompt.
  function followupActiveText() {
    const list = followup.prompts;
    if (list.length) return String(list[followup.rotateIdx % list.length] || '').trim();
    return String(followup.prompt || '').trim();
  }
  function sanitizeFollowupPrompts(v) {
    if (!Array.isArray(v)) return [];
    return v.filter((p) => typeof p === 'string' && p.trim()).slice(0, FOLLOWUP_ROTATION_MAX);
  }
  // Advance ONLY on a verified send — an attempted-but-unverified or blocked send must
  // not skip a prompt (the next attempt repeats the same one).
  function advanceFollowupRotation() {
    const n = followup.prompts.length;
    if (!n) return;
    followup.rotateIdx = (followup.rotateIdx + 1) % n;
    try { chrome.storage.local.set({ followupRotateIdx: followup.rotateIdx }); } catch { /* ignore */ }
  }

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

  // v1.8.0 error detection (followupSmart.errorRecovery). The regex list below is deliberately
  // specific to failure text (documented in docs/ENGINE_V18.md); a false positive only costs one
  // recovery prompt — paced by the same cooldowns/caps and sent once per distinct error text.
  const ERROR_RES = [
    /\bsomething went wrong\b/i,
    /\b(?:an?\s+)?(?:error|exception)\s+(?:occurred|happened|encountered|was encountered)\b/i,
    /\b(?:i|we)\s+(?:hit|ran into|encountered)\s+(?:an?\s+)?(?:error|exception)\b/i,
    /\b(?:unhandled\s+exception|traceback|stack trace)\b/i,
    /\b[A-Z][A-Za-z]*Error\b/,
    /\b(?:request|command|network|server)\s+(?:failed|error)\b/i,
    /\bexit code\s+[1-9]\d*\b/i,
  ];
  const ERROR_SEL = '[role="alert"], [class*="error" i], [data-testid*="error" i]';
  // Scans explicit error surfaces + [aria-live] regions; bounded text (<=300 chars) and visible
  // only. Returns the matched text (<=160 chars) or ''.
  function errorPresent() {
    try {
      for (const el of document.querySelectorAll(ERROR_SEL + ', [aria-live]')) {
        if (!isVisible(el)) continue;
        let t;
        try { t = txt(el); } catch { continue; }
        if (!t || t.length > 300) continue;
        for (const re of ERROR_RES) if (re.test(t)) return t.slice(0, 160);
      }
    } catch { /* ignore */ }
    return '';
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
        if (isAllowText(t)) return true;                                      // any clickable allow button
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
  // v1.8.0: the rolling-hour cap + cooldown, checked without the idle requirement (stuck/error).
  function followupPaced(now) {
    if (now - followup.lastAttemptAt < followup.cooldownMs) return false;
    while (followup.attempts.length && now - followup.attempts[0] > FOLLOWUP_HOUR_WINDOW_MS) followup.attempts.shift();
    return followup.attempts.length < FOLLOWUP_HOUR_MAX;
  }
  function followupTick() {
    if (!alive()) return; // the main heartbeat / stopForever handles teardown
    let st = 'unknown';
    try { st = detectMuseState(); } catch { st = 'unknown'; }
    if (st !== followup.state) { followup.state = st; publishFollowupState(); }
    const now = Date.now();
    if (st === 'idle') { if (!followup.idleSince) followup.idleSince = now; }
    else followup.idleSince = 0;
    if (st === 'working') { if (!followup.workingSince) followup.workingSince = now; }
    else followup.workingSince = 0;
    if (paused()) return; // v1.8.0 pause: no automatic follow-up while the engine is halted
    if (followup.enabled) {
      // 1) error recovery — the most specific trigger; one send per distinct error text, and
      // the same cooldown + rolling-hour cap as every other send (followupPaced).
      if (v18.smart.errorRecovery) {
        let errTxt = '';
        try { errTxt = errorPresent(); } catch { errTxt = ''; }
        if (errTxt && errTxt !== followup.lastErrorFp && followupPaced(now)) {
          const r = followupAttempt(false, { text: v18.smart.errorPrompt, source: 'error' });
          if (r.ok) { followup.lastErrorFp = errTxt; return; }
        } else if (!errTxt) {
          followup.lastErrorFp = ''; // the error cleared — a reappearing error may be answered again
        }
      }
      // 2) stuck recovery — 'working' with no DOM mutation for stuckMin minutes.
      const stuckMs = v18.smart.stuckMin * 60000;
      if (stuckMs > 0 && st === 'working' && followup.workingSince && followupPaced(now) &&
          now - followup.workingSince >= stuckMs && now - lastDomActivityAt >= stuckMs) {
        followupAttempt(false, { text: v18.smart.stuckPrompt, source: 'stuck' });
        // restart the watch whether or not the attempt fired — no tight retry loop, and the
        // next stuck prompt waits for another full stuckMin of silence
        lastDomActivityAt = now;
        followup.workingSince = now;
        return;
      }
    }
    if (!followupEligible(now)) return;
    followupAttempt(false);
  }
  // One attempt. Manual (popup 'Send now') skips the idle wait, the cooldown and the
  // hourly cap, but still respects: disabled, pause, schedule, approval-present,
  // composer-empty, no-composer and empty-prompt. `opts.text` overrides the rotation text
  // (stuck/error recovery) and such a send never advances the rotation.
  // v1.8.0 dry-run: the attempt is logged as 'followup-dry' (pacing advances) but nothing is
  // typed and nothing is submitted. Returns { ok, reason }.
  function followupAttempt(manual, opts) {
    if (!alive()) { stopForever(); return { ok: false, reason: 'dead' }; }
    if (!followup.enabled) return { ok: false, reason: 'disabled' };
    if (paused()) return { ok: false, reason: 'paused' };
    if (!scheduleAllows()) return { ok: false, reason: 'schedule' };
    if (followup.sending) return { ok: false, reason: 'sending' };
    if (approvalPresent()) return { ok: false, reason: 'approval-present' };
    const composer = findComposer();
    if (!composer) return { ok: false, reason: 'no-composer' };
    if (composerValue(composer).trim()) return { ok: false, reason: 'composer-not-empty' };
    const override = opts && typeof opts.text === 'string' && opts.text.trim() ? opts.text.trim() : '';
    const text = override || followupActiveText(); // rotation item when a list is stored, else the single prompt
    if (!text) return { ok: false, reason: 'no-prompt' };
    const now = Date.now();
    const source = (opts && opts.source) || (manual ? 'manual' : 'auto');
    if (v18.dryRun) {
      followup.lastAttemptAt = now;
      if (!manual) followup.attempts.push(now);
      const entry = { at: new Date().toISOString(), kind: 'followup-dry', label: 'follow-up', context: text.slice(0, 240), dryRun: true, source };
      recordClick(entry, text, false);
      followup.lastResult = { at: entry.at, kind: 'followup-dry', text: text.slice(0, 120), verified: null, dryRun: true, source };
      console.log('[muse-auto-allow] followup-dry "' + text.slice(0, 60) + '"');
      return { ok: true, reason: 'dry-run', via: null };
    }
    if (!typeIntoComposer(composer, text)) return { ok: false, reason: 'type-failed' };
    followup.lastAttemptAt = now;
    if (!manual) followup.attempts.push(now); // manual sends are user-explicit; only auto sends count toward the cap
    followup.sending = true;
    const first = findSendButton(composer) ? 'button' : 'enter';
    submitComposer(composer, first);
    verifyFollowupSend(text, [first], { advanceRotation: !override, source });
    followup.lastResult = { at: new Date().toISOString(), kind: 'followup', via: first, text: text.slice(0, 120), verified: null, source };
    return { ok: true, reason: 'attempted', via: first };
  }
  // Success is only counted when the composer verifiably emptied or changed (the app
  // accepted the send). Otherwise the other submit strategy is tried once, then the
  // attempt stays unverified and any leftover text blocks further sends (fail closed)
  // until it is cleared.
  function verifyFollowupSend(text, tried, opts) {
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
        if (!opts || opts.advanceRotation !== false) {
          advanceFollowupRotation(); // verified send only — blocked/failed attempts must not skip a prompt
        }
        bumpDigest({ followups: 1 });
        const entry = { at: new Date().toISOString(), kind: 'followup', label: 'follow-up', context: text.slice(0, 240), source: (opts && opts.source) || 'auto' };
        recordClick(entry, text, false);
        console.log('[muse-auto-allow] follow-up sent via ' + tried[tried.length - 1]);
        return;
      }
      if (tried.length < 2 && c) {
        const next = tried.indexOf('enter') !== -1 ? 'button' : 'enter';
        if (submitComposer(c, next)) { tried.push(next); verifyFollowupSend(text, tried, opts); return; }
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
    followup.prompts = sanitizeFollowupPrompts(s.followupPrompts);
    const fri = Number(s.followupRotateIdx);
    if (Number.isInteger(fri) && fri >= 0) followup.rotateIdx = fri;
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
        try {
          const rn = followup.prompts.length; // v1.7.0: rotation position for the popup's 'Next: i/n'
          // v1.8.0: the status ping is also the test harness's window into the engine's
          // IN-MEMORY state. Settings are applied asynchronously (storage.onChanged) and DOM
          // state is sampled on the 1s heartbeat, so a harness that asserts on a fixed sleep
          // races the engine; polling these fields lets it wait for the applied state instead.
          sendResponse({ state: followup.state, lastSentAt: followup.lastSentAt || null, enabled: followup.enabled,
                         rotateIdx: rn ? followup.rotateIdx % rn : 0, rotateCount: rn,
                         // v1.8.0 engine state (observability for the popup/tests)
                         paused: paused(), dryRun: v18.dryRun, allowOnceMode: v18.allowOnceMode,
                         scheduleAllowed: scheduleAllows(), stuckMin: v18.smart.stuckMin,
                         errorRecovery: v18.smart.errorRecovery, domIdleMs: Date.now() - lastDomActivityAt,
                         // applied-config echoes (what the engine has actually taken in)
                         pauseUntil: Number(v18.pauseUntil) || 0, schedule: { ...v18.schedule },
                         stuckPrompt: v18.smart.stuckPrompt, errorPrompt: v18.smart.errorPrompt,
                         allowTopics: [...v18.allowTopics], blockKeywords: [...v18.blockKeywords],
                         // '' = no error fingerprint held (a re-appearing error is answerable again)
                         lastErrorFp: followup.lastErrorFp,
                         // in-flight send lock: a manual send-now is refused with reason
                         // 'sending' while this is true — the harness waits on it instead of
                         // racing the lock with a fixed sleep
                         sending: followup.sending });
        } catch { /* ignore */ }
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
    if (paused()) return; // v1.8.0 pause: every click path (A–E) is halted until pauseUntil passes
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
    // v1.8.0 frozen settings (pause / dry-run / rules / smart follow-up / schedule)
    chrome.storage.local.get({ pauseUntil: 0, dryRun: false, allowOnceMode: false, rules: {}, followupSmart: {}, followupSchedule: {} },
      (s) => { applyV18Settings(s); publishFlags(); });
    chrome.storage.onChanged.addListener((ch) => {
      if (ch.enabled) state.enabled = !!ch.enabled.newValue;
      if (ch.minDelayMs) {
        const n = Number(ch.minDelayMs.newValue);
        if (Number.isFinite(n) && n >= 0) state.minDelayMs = n;
      }
      let fch = false;
      if (ch.followupEnabled) { followup.enabled = !!ch.followupEnabled.newValue; fch = true; }
      if (ch.followupPrompt && typeof ch.followupPrompt.newValue === 'string') { followup.prompt = ch.followupPrompt.newValue; fch = true; }
      if (ch.followupPrompts) { followup.prompts = sanitizeFollowupPrompts(ch.followupPrompts.newValue); fch = true; }
      if (ch.followupRotateIdx) { const fr = Number(ch.followupRotateIdx.newValue); if (Number.isInteger(fr) && fr >= 0) followup.rotateIdx = fr; }
      if (ch.followupIdleMs) { const fn = Number(ch.followupIdleMs.newValue); if (Number.isFinite(fn) && fn >= 0) followup.idleMs = fn; fch = true; }
      if (ch.followupCooldownMs) { const fc = Number(ch.followupCooldownMs.newValue); if (Number.isFinite(fc) && fc >= 0) followup.cooldownMs = fc; fch = true; }
      const vpatch = {};
      let vch = false;
      for (const k of ['pauseUntil', 'dryRun', 'allowOnceMode', 'rules', 'followupSmart', 'followupSchedule']) {
        if (ch[k] && ch[k].newValue !== undefined) { vpatch[k] = ch[k].newValue; vch = true; }
      }
      if (vch) { applyV18Settings(vpatch); publishFlags(); }
      if (fch || vch) { try { followupTick(); } catch { /* ignore */ } }
    });
    chrome.runtime.onMessage.addListener((m) => { if (m && m.type === 'sweep') sweep('message'); });
  } catch {
    sweep('init');
  }

  // Instant reaction: re-sweep on any DOM change (trailing debounce). characterData/attributes
  // are observed too: the stuck detector needs "NO DOM mutation" to mean exactly that.
  try {
    obs = new MutationObserver(() => { lastDomActivityAt = Date.now(); scheduleSweep('observer', 120); });
    obs.observe(document.documentElement || document, { childList: true, subtree: true, characterData: true, attributes: true });
  } catch {}

  // Fallback heartbeat (safe under background-tab throttling).
  heartbeat = setInterval(() => { sweep('interval'); try { followupTick(); } catch { /* ignore */ } publishFlags(); }, 1000);

  window.__museAutoAllow = {
    get state() { return { ...state }; },
    get v18() {
      return { paused: paused(), dryRun: v18.dryRun, allowOnceMode: v18.allowOnceMode, allowTopics: [...v18.allowTopics],
               blockKeywords: [...v18.blockKeywords], scheduleAllowed: scheduleAllows(), schedule: { ...v18.schedule },
               smart: { ...v18.smart }, domIdleMs: Date.now() - lastDomActivityAt };
    },
    sweep: () => sweep('manual'),
    get followup() {
      return { state: followup.state, enabled: followup.enabled, idleSince: followup.idleSince, lastSentAt: followup.lastSentAt,
               lastAttemptAt: followup.lastAttemptAt, attempts: followup.attempts.length, sending: followup.sending, lastResult: followup.lastResult,
               rotateIdx: followup.rotateIdx, rotateCount: followup.prompts.length, lastErrorFp: followup.lastErrorFp,
               workingSince: followup.workingSince, domIdleMs: Date.now() - lastDomActivityAt };
    },
  };
})();
