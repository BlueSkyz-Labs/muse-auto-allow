// Muse Auto-Allow — content script (v1.9.0: Mission Orchestrator engine + v1.8.0 pause/dry-run/rules + smart follow-up + v1.7.0 rotation).
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
// v1.8.0 performance (measured — see docs/ENGINE_V18.md §12 and
// docs/ELITE_BENCHMARK_REPORT.md §1.2):
//  - a card/surface-bearing MutationObserver mutation sweeps on the next task; generic
//    mutations keep the 120 ms trailing debounce (detect -> click 121 ms -> ~2 ms);
//  - ONE querySelectorAll per scope plus per-sweep text/visibility caches shared by every
//    detection path, behind a gate that skips a page holding nothing any path could act on;
//  - the digestCounters increment rides in the click flush: one action = ONE storage write.
// None of these change a guard — every rail below still decides the click.
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
//  - yoloMode (v1.9.4, explicit opt-in): blockKeywords/allowTopics are bypassed, standing-grant
//    labels ("Always allow" / "Allow for this site/task") become clickable, and pacing is capped
//    at 100 ms. Never-Deny, the connector hard-block and the consent filters stay in force.
//    Default false; the popup writes it behind a two-step confirm.
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

  const ALLOW_RE = /^\s*(allow|approve)(\s+(once|this\s+time))?\s*$/i; // v1.14.0 (F1): 'always' postfix removed — 'Allow always' used to slip through here and got clicked as a one-shot while silently granting standing scope
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
  // v1.9.4 YOLO: standing-grant labels become clickable positive options — an explicit opt-in.
  // v1.14.0 (F1): the POSTFIX forms ('Allow always' / 'Approve always') are standing grants too:
  // they previously fell through ALLOW_RE's one-shot alternation and were clicked with no
  // standing flag (found live by the independent audit). Default behaviour is unchanged:
  // without yoloMode NO standing wording is recognized, so the granted scope can never
  // silently escalate.
  const STANDING_RE = /^\s*(always\s+(allow|approve)|(allow|approve)\s+(always|for\s+this\s+(site|task)))\s*$/i;
  const isAllowText = (t) => ALLOW_RE.test(stripDecor(t)) || (v18.allowOnceMode && /^\s*allow once only\s*$/i.test(stripDecor(t))) || (v18.yoloMode && STANDING_RE.test(stripDecor(t)));
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
  // v1.14.0 (F3): keyword sets widened to the codex.js parity lists — the audit clicked live
  // through reworded consent surfaces ('Authorize app', 'Bearer key') while the old allowlist
  // only knew 'Connector'/'Connect'/'api key'. Fail closed: auth/consent surfaces are never
  // interacted with.
  const CONNECTOR_WORD_RE = /\b(connectors?|authorize|authorization|sign\s+in|log\s+in|oauth|link\s+(your\s+)?account|grant\s+access|api\s+key|access\s+token|personal\s+access\s+token|bearer\s+(key|token))\b/i;
  const CONNECT_BTN_RE = /^(connect\b|authorize\b|sign\s+in\b|log\s+in\b|link\b|set\s+up\b|add\s+account\b)/i;
  const TOKEN_WORDING_RE = /\b(api\s+token|access\s+token|personal\s+access\s+token|bearer\s+(key|token)|paste\s+(the\s+|your\s+)?token|api\s+key)\b/i;
  const EXPAND_THROTTLE_MS = 800;
  const SURFACE_THROTTLE_MS = 10000;
  const REVIEW_BAR_THROTTLE_MS = 1000; // chat-level bar: snappy (the panel only renders after this click)
  const TEXT_COOLDOWN_MS = 30000;
  const ALLOW_DEDUP_MS = 5000;
  // MutationObserver reaction delays. A mutation that brings in (or lands inside) an approval
  // card/surface is the product's core loop: sweep on the next task. Generic mutations
  // (re-render storms, streaming text, attribute churn) keep the 120 ms trailing debounce that
  // coalesces them into one sweep.
  const OBSERVER_CARD_MS = 0;
  const OBSERVER_GENERIC_MS = 120;
  const YOLO_MIN_DELAY_MS = 100; // v1.9.4 YOLO: pacing capped at 100 ms (never slower than the user's setting)
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

  // ---- v1.20.0 (G04): anomaly auto-pause --------------------------------------------------
  // The detector can only ever ADD a pause (never touch a cap). All state is page-local except
  // the pause itself + its marker, which persist so the reason mapping survives a reload.
  let anomaly = null;            // sanitized MuseAnomaly settings (defaults once the boot read lands)
  let anomalyLatchUntil = 0;     // no re-evaluation before this ts (guards against a re-fire loop)
  let anomalyDead = false;       // a throwing detector stays disabled for this page (fail closed)
  let anomalyLastPause = null;   // last auto-pause marker (mirrors storage)
  const topicClicks = new Map(); // topic -> number[] timestamps (allow-clicks, G04 topic window)
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
    yoloMode: false,        // v1.9.4: auto-approve everything — bypass block rules, click standing grants, fastest pace
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
  let lastFlagPause = null, lastFlagDry = null, lastFlagYolo = null; // publishFlags dedup (never re-set unchanged)
  let pendingTimer = null;
  let pendingFast = false; // the pending sweep is the card-bearing (immediate) kind
  let obs = null;
  let heartbeat = null;
  let ftick = 0; // v5.0 (C5-5): follow-up state detection runs at ~3s cadence while follow-up is disabled
  let v18Ready = false; // v1.9.3 boot gate: the v18 settings read (dryRun/pause/rules) must complete before ANY sweep — a fresh install must never click before the log-only default is applied
  let enabledReady = false; // v1.13.0 (C4-B): the kill-switch (enabled) read must ALSO land before the first sweep

  // Per-sweep read caches. A sweep is a single synchronous pass over a DOM that does not change
  // until its one click at the very end, so text and visibility reads are stable for the whole
  // sweep. Caching them turns the four full passes over every button into ONE text pass plus
  // cache hits — the layout reads behind innerText/getBoundingClientRect dominate a sweep.
  // Both caches are dropped the instant the sweep returns (and restored, so a page handler that
  // re-enters sweep() cannot corrupt the outer pass).
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
    // v1.14.0 (F2): a PARKED button (fixed off the canvas at negative/large coordinates) or an
    // effectively invisible one was clicked live by the independent audit. Below-the-fold
    // content stays clickable (a real chat card often sits below the fold): the bounds test is
    // against the DOCUMENT's scrollable area, not the viewport. Plus ancestor visibility and
    // real opacity.
    try {
      const de = document.documentElement;
      const w = Math.max(window.innerWidth || 0, de ? de.scrollWidth : 0);
      const h = Math.max(window.innerHeight || 0, de ? de.scrollHeight : 0);
      if (w > 0 && (r.right <= 0 || r.left >= w)) return false;
      if (h > 0 && (r.bottom <= 0 || r.top >= h)) return false;
      if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.pointerEvents !== 'none' && Number(cs.opacity) > 0.1;
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
    if (v18.yoloMode) return null; // v1.9.4 YOLO: block rules are bypassed by explicit opt-in
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
    if ('yoloMode' in s) v18.yoloMode = s.yoloMode === true;
    if ('allowOnceMode' in s) v18.allowOnceMode = s.allowOnceMode === true;
    if ('anomaly' in s) anomaly = (typeof MuseAnomaly !== 'undefined' && MuseAnomaly) ? MuseAnomaly.sanitize(s.anomaly) : anomaly;
    if ('anomalyLastPause' in s) anomalyLastPause = (s.anomalyLastPause && typeof s.anomalyLastPause === 'object') ? s.anomalyLastPause : null;
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
  // Shipped v18 defaults, captured ONCE (before any storage read applies a value). A key
  // REMOVED from storage (storage.onChanged newValue === undefined) resets to THIS snapshot —
  // fail-closed to the default, never to a stale in-memory value. Observed live: after a
  // storage.local.clear() the engine kept a closed schedule and refused every send.
  const v18Defaults = {
    pauseUntil: v18.pauseUntil, dryRun: v18.dryRun, yoloMode: v18.yoloMode, allowOnceMode: v18.allowOnceMode,
    allowTopics: v18.allowTopics.slice(), blockKeywords: v18.blockKeywords.slice(),
    smart: Object.assign({}, v18.smart), schedule: Object.assign({}, v18.schedule),
  };
  function resetV18Key(k) {
    if (k === 'pauseUntil') v18.pauseUntil = v18Defaults.pauseUntil;
    else if (k === 'dryRun') v18.dryRun = v18Defaults.dryRun;
    else if (k === 'allowOnceMode') v18.allowOnceMode = v18Defaults.allowOnceMode;
    else if (k === 'yoloMode') v18.yoloMode = v18Defaults.yoloMode;
    else if (k === 'rules') { v18.allowTopics = v18Defaults.allowTopics.slice(); v18.blockKeywords = v18Defaults.blockKeywords.slice(); }
    else if (k === 'followupSmart') v18.smart = Object.assign({}, v18Defaults.smart);
    else if (k === 'followupSchedule') v18.schedule = Object.assign({}, v18Defaults.schedule);
  }
  // Observability only (no behavior): mirrors the pause/dry flags onto <html>. Written ONLY on
  // change — an unconditional setAttribute would register as DOM activity and starve the stuck
  // detector (every tick would look like a mutation).
  function publishFlags() {
    try {
      const p = paused() ? '1' : '0';
      const d = v18.dryRun ? '1' : '0';
      const y = v18.yoloMode ? '1' : '0';
      const el = document.documentElement;
      if (p !== lastFlagPause) { lastFlagPause = p; el.setAttribute('data-muse-pause', p); }
      if (d !== lastFlagDry) { lastFlagDry = d; el.setAttribute('data-muse-dryrun', d); }
      if (y !== lastFlagYolo) { lastFlagYolo = y; el.setAttribute('data-muse-yolo', y); }
    } catch { /* ignore */ }
  }
  // Digest counters (chrome.storage.local.digestCounters) — the background service worker
  // composes the startup digest from them. The increment is NOT a write of its own: it is
  // accumulated here and folded into the click flush (flushClicks), so one action costs ONE
  // chrome.storage.local.set instead of two, and the counters travel under the same cross-tab
  // lock as the log entry they accompany (parallel tabs cannot lose an increment).
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

  // Sweep gate predicate — a strict SUPERSET of every way a click path can start: a marked card
  // (path A), an allow-ish button (B), a collapsed pending card (C), a surface open button (D) or
  // the chat review bar (E). The gate may therefore never refuse a path that could have clicked;
  // anything it lets through is still fully refused downstream by the unchanged guards.
  function approvalShapedButton(b) {
    const t = txt(b);
    return isAllowText(t) || PENDING_CARD_RE.test(t) || /^review$/i.test(t.trim()) || SURFACE_BTN_RE.test(t);
  }

  // Path A — Muse-marked approval cards.
  function findMarkedAllow(cards) {
    for (const card of (cards || document.querySelectorAll(CARD_SEL))) {
      if (card.matches(SURFACE_SEL) || !isVisible(card)) continue;
      // connector hard-block: never interact with the container, even with a pair inside
      // v1.13.0 (C4-C): depth 2, like path B — the card can carry its Connect/token wording
      // one level up (wrapper), which the old depth-1 check here missed.
      if (connectorNear(card, 2)) { noteBlocked('Connect', 'connector', txt(card), 'connector:' + txt(card).slice(0, 160)); continue; }
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
  function findPairAllow(btns) {
    for (const b of (btns || buttonsIn(document))) {
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
  function findCollapsedPending(btns) {
    if (!auxRateOk()) return null;
    for (const b of (btns || buttonsIn(document))) {
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
  function findSurfaceButton(cards) {
    if (!auxRateOk()) return null;
    for (const surface of (cards || document.querySelectorAll(CARD_SEL))) {
      if (!surface.matches(SURFACE_SEL)) continue; // SURFACE_SEL is a subset of CARD_SEL
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
  function findReviewBarButton(btns) {
    if (!auxRateOk()) return null;
    for (const b of (btns || buttonsIn(document))) {
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
  // One get->set per flush, updating log + counter + aggregates together — and, since v1.8.0's
  // write merge, the digestCounters increment rides in the SAME set (one action = one
  // chrome.storage.local.set). Flushes are serialized per tab (clickFlushing) and, when the Web
  // Locks API is available, across tabs of the same origin too (redteam V3-2: the 1-minute alarm
  // can nudge several muse.ai tabs at once). Counts are coerced with Number() so a corrupt stored
  // shape can never turn a write into a silent no-op or a string concatenation (V3-3).
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
            // encrypt the approval text at rest; on failure keep plaintext (never lose the record)
            try {
              const enc = await encryptCtx(entry.context);
              if (enc) entry.ctx = enc;
            } catch { /* ignore */ }
            // v1.18.0 (CX-03): never persist DOM context as plaintext — a failed encryption
            // drops the sentence; the 0-plaintext log contract holds in both engines.
            delete entry.context;
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
          const patch = { log: log.slice(0, 50), stats: st, clickCount: count, schemaVersion: 2 };
          // the digest increment accumulated for this action, read here (not at flush start) so a
          // bump that arrived while this flush was already in flight is carried by this write
          if (digestDirty) {
            const d = asObj(s.digestCounters);
            d.clicks = (Number(d.clicks) || 0) + digestDelta.clicks;
            d.followups = (Number(d.followups) || 0) + digestDelta.followups;
            d.blocked = (Number(d.blocked) || 0) + digestDelta.blocked;
            digestDelta.clicks = 0; digestDelta.followups = 0; digestDelta.blocked = 0;
            digestDirty = false;
            patch.digestCounters = d;
          }
          // A failed flush must not vanish: a dropped click record is surfaced locally (same
          // local-only console.warn discipline as the sync mirror) so a quota/context error
          // leaves a trace instead of silently losing the entry.
          try { chrome.storage.local.set(patch); }
          catch (e) { console.warn('[muse-auto-allow] log flush failed — record dropped:', (e && e.message) || e); }
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
    // v1.11.0 (G11): the standing-grant class is recorded structurally (boolean only) — a
    // click that grants lasting authority (reachable only under the explicit YOLO opt-in)
    // becomes distinguishable from a one-shot approval for later surfaces. No new kind.
    const standing = kind === 'allow' && v18.yoloMode === true && STANDING_RE.test(stripDecor(label));
    const context = (card ? contextText(card) : label).slice(0, 240);
    state.lastClickAt = Date.now();
    if (kind === 'expand') { state.lastExpandAt = state.lastClickAt; markAux(); }
    if (kind === 'open-panel') { state.lastSurfaceAt = state.lastClickAt; markAux(); }
    if (kind === 'review-bar') { state.lastReviewBarAt = state.lastClickAt; markAux(); }
    if (kind === 'allow') {
      markAllowFp(allowFp(btn, ctx !== undefined ? ctx : (card ? contextText(card) : '')));
      allowClicks.push(state.lastClickAt);
      noteAnomalyAllow(ctx !== undefined ? ctx : (card ? contextText(card) : '')); // v1.20.0 (G04)
      // one allow click per card/pair scope (v1.8.0) — but a DRY run must not consume the
      // card, so the mark is only placed when a real click happened
      if (card && !isDry) allowDoneCards.add(card);
    }
    if (cooldownKey) markCooldown(cooldownKey);
    state.clickCount += 1;
    const entryKind = isDry ? kind + '-dry' : kind;
    state.lastResult = { at: new Date().toISOString(), kind: entryKind, label, context };
    if (isDry) state.lastResult.dryRun = true;
    if (standing) state.lastResult.standing = true;
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

  // ===========================================================================
  // v1.9.0 — Mission Orchestrator ENGINE (docs/MISSION_V19.md is the contract).
  // A MISSION is an ordered, stateful sequence of SHIPPED, REVIEWED directives that the
  // follow-up engine sends on idle WHILE the user has an active mission — and advances the
  // step ONLY on a VERIFIED send (the same rule as the phrase rotation: a blocked / failed /
  // paused / dry-run attempt never skips a step). An active mission takes PRECEDENCE over the
  // rotating phrase prompts. The directive TEXT is shipped content (never page-derived), it is
  // English by decision, and the extension never reads the project repository: the Muse agent
  // does the reading; we only decide WHICH prompt is sent and WHEN.
  //
  // Storage contracts (frozen):
  //   missionEnabled: boolean (default false) — nothing auto-starts on install.
  //   mission: { id, step, cycles, startedAt, lastSentAt } — ABSENT = no active mission.
  //   Caps: MAX_STEPS_PER_MISSION (12) lifetime sends + MAX_MISSION_CYCLES (3) full cycles;
  //   whichever is reached first ends the mission (silent stop + ONE 'mission' log line).
  //   pauseUntil halts mission sends; dryRun logs 'mission-dry' and sends nothing.
  // ===========================================================================
  // MISSION_CORPUS_BEGIN
  const MISSION_CORPUS = [
    {
      id: 'golive-ready',
      title: 'GOLIVE READY — Project Orchestrator',
      steps: [
        'S1 CONTRACT — Read the project source of truth first (AGENTS.md, docs, ADRs, the active plan or wave state, recent commits, open PRs and issues) and treat already-made decisions as binding. Declare the execution contract: working mode, authority order, and what you will not change. Write no code yet — close this step with the contract and the binding-decision list.',
        'S2 AUDIT — Audit the current state against that source of truth. List every gap with the evidence that proves it, draw the dependency graph of the open work, and rank the items: security and correctness first, then blocking defects, then approved work, then quality, then optimization.',
        'S3 EXECUTE — Take the highest-priority READY item and finish it end-to-end now: implement, test, and prove it with real command output, then commit and open the PR following the repository rules. Do not stop to ask; continue while a READY item remains.',
        'S4 CONTINUE — Refresh the live truth, reconcile the open work, pick the next READY item, and execute it. Report only what changed and the evidence for each change; do not restate the plan.',
        'S5 RELEASE GATE — Prepare the release gate: exact-artifact readiness, run the repository gates, and produce landing proof. Do not promote on RED — list the blockers with owners instead.',
        'S6 CONVERGE — Give the verdict: GOLIVE READY with the full evidence chain, or an explicit blocker list with owners and the exact next action for each.',
      ],
    },
    {
      id: 'audit-only',
      title: 'AUDIT ONLY',
      steps: [
        'AUDIT ONLY S1 — Read the project source of truth and treat its decisions as binding. This mission is READ-ONLY: change nothing, approve nothing, and write nothing.',
        'AUDIT ONLY S2 — Audit the current state against the source of truth and list every gap with the evidence that proves it. Build the dependency graph for the open work.',
        'AUDIT ONLY S3 — Rank the findings: security and correctness first, then blocking defects, then approved work, then quality, then optimization. State the risk and the blast radius of each item.',
        'AUDIT ONLY S4 — Deliver the verdict: a prioritised, evidence-backed findings report with owners and the recommended next action for each item. Make no change to the repository.',
      ],
    },
    {
      id: 'fix-findings',
      title: 'FIX FINDINGS',
      steps: [
        'FIX FINDINGS S1 — Read the project source of truth and the open findings, treat approved decisions as binding, and confirm with current evidence which findings are still open.',
        'FIX FINDINGS S2 — Take the highest-severity open finding and fix its root cause end-to-end. Add or extend the test that proves the fix, and show the real command output as evidence.',
        'FIX FINDINGS S3 — Prove the fix does not regress: run the repository gates and confirm every touched area still passes. Report the evidence, not a summary.',
        'FIX FINDINGS S4 — Land the fix under the repository rules, then reconcile the findings list: mark what is now closed with its evidence and name the next open finding to fix.',
      ],
    },
    {
      id: 'scoped-run',
      title: 'SCOPED RUN — {{project}} @ {{branch}}',
      vars: { project: { def: 'this project' }, branch: { def: 'main' } },
      guards: { extraBlockedKeywords: [], pauseWhenUnavailable: true },
      steps: [
        'SCOPED RUN S1 — Work only inside {{project}} on branch {{branch}}. Read its source of truth first and treat its decisions as binding; write no code yet — close this step with the execution contract.',
        'SCOPED RUN S2 — Take the next approved item in {{project}} (branch {{branch}}) and finish it end-to-end: implement, test, and show the real command output as evidence.',
        'SCOPED RUN S3 — Verify {{project}} on {{branch}} still passes every gate, then land the change under the repository rules and report the evidence only.',
      ],
    },
    {
      id: 'release-prep',
      title: 'RELEASE PREP',
      steps: [
        'RELEASE PREP S1 — Freeze the scope for this release: read the source of truth, list what is in and what is explicitly out, and declare the exact artifact set under review.',
        'RELEASE PREP S2 — Verify the frozen artifact: run the repository gates on the exact revision and capture the real, unpiped output as the evidence record.',
        'RELEASE PREP S3 — Assemble the release packet: revision identity, the gate results, the remaining limitations, and a rollback path. Flag explicitly anything that is not verified.',
        'RELEASE PREP S4 — Deliver the promotion decision: GO or NO-GO with the evidence chain. Do not promote on RED or on an unverified item; list the blockers with owners.',
      ],
    },
  ];
  // MISSION_CORPUS_END
  const MISSION_MAX_STEPS_PER_MISSION = 12; // hard LIFETIME cap on steps a mission may send
  const MISSION_MAX_CYCLES = 3;             // hard cap on full cycles — a mission never loops unbounded
  const MISSION_IDS = MISSION_CORPUS.map((m) => m.id);
  const missionById = (id) => { for (const m of MISSION_CORPUS) if (m.id === id) return m; return null; };
  // A mission's step list, bounded by the cap (a custom/huge mission definition can never exceed it).
  const missionStepsOf = (id) => { const m = missionById(id); return m ? m.steps.slice(0, MISSION_MAX_STEPS_PER_MISSION) : []; };

  // Runtime mission state. `id: ''` = no active mission.
  const mission = {
    enabled: false,   // missionEnabled
    id: '',           // active mission id ('' = none)
    step: 0,          // index of the NEXT step to send (0-based, within the current cycle)
    cycles: 0,        // completed cycles
    startedAt: 0,
    lastSentAt: 0,    // last VERIFIED mission send (observability)
    completedId: '',  // last completed mission id (observability for the popup/tests)
    values: null,     // v1.21.0 (G02): validated per-run variable snapshot (null = none declared)
    lastResult: null,
  };
  // ---- v1.21.0 (G02): playbook variables + per-playbook guards (metadata-driven, fail-closed) ----
  const missionPlaybooksMeta = Object.create(null); // id -> { varNames, defaults, guards }
  (function buildMissionMeta() {
    if (typeof MusePlaybook === 'undefined' || !MusePlaybook) return; // pure module must load first
    for (const m of MISSION_CORPUS) {
      const vars = m && m.vars && typeof m.vars === 'object' ? m.vars : null;
      if (!vars) continue;
      const dec = MusePlaybook.declare(Object.keys(vars));
      if (!dec.ok) continue; // invalid shipped metadata: the playbook simply carries no variables
      const defaults = {};
      let bad = false;
      for (const n of dec.names) {
        const dv = MusePlaybook.validateValue(vars[n] && typeof vars[n] === 'object' ? vars[n].def : undefined);
        if (!dv.ok) { bad = true; break; }
        defaults[n] = dv.value;
      }
      if (bad) continue;
      const g = m.guards && typeof m.guards === 'object' ? m.guards : {};
      const gkw = Array.isArray(g.extraBlockedKeywords)
        ? g.extraBlockedKeywords.filter((k) => typeof k === 'string' && k.length >= 1 && k.length <= 40).slice(0, 20)
        : [];
      missionPlaybooksMeta[m.id] = { varNames: dec.names, defaults, guards: { extraBlockedKeywords: gkw, pauseWhenUnavailable: g.pauseWhenUnavailable === true } };
    }
  })();
  // Optional per-playbook overrides (edited defaults + guards), keyed by SHIPPED id only.
  // Strict sanitize; guards can only NARROW (add keywords / enable the pause), never widen.
  let playbookOverrides = Object.create(null);
  function applyPlaybookOverrides(raw) {
    playbookOverrides = Object.create(null);
    const o = asObj(raw);
    for (const id of Object.keys(o)) {
      const base = missionPlaybooksMeta[id];
      if (!base) continue; // unknown id: ignored
      const rec = asObj(o[id]);
      const out = {};
      if (base.varNames.length && rec.vars && typeof rec.vars === 'object') {
        const vv = {};
        for (const n of base.varNames) { if (typeof rec.vars[n] === 'string') vv[n] = rec.vars[n]; }
        if (Object.keys(vv).length) out.vars = vv;
      }
      if (rec.guards && typeof rec.guards === 'object') {
        const gk = Array.isArray(rec.guards.extraBlockedKeywords)
          ? rec.guards.extraBlockedKeywords.filter((k) => typeof k === 'string' && k.length >= 1 && k.length <= 40).slice(0, 20) : [];
        const g = {};
        if (gk.length) g.extraBlockedKeywords = gk;
        if (rec.guards.pauseWhenUnavailable === true) g.pauseWhenUnavailable = true;
        if (Object.keys(g).length) out.guards = g;
      }
      if (Object.keys(out).length) playbookOverrides[id] = out;
    }
  }
  // Effective meta = shipped merged with the override; bad override values fall back to shipped.
  function missionMetaFor(id) {
    const base = missionPlaybooksMeta[id];
    if (!base) return null;
    const ov = playbookOverrides[id];
    if (!ov) return base;
    const defaults = Object.assign({}, base.defaults);
    if (ov.vars && typeof MusePlaybook !== 'undefined' && MusePlaybook) {
      const mv = MusePlaybook.mergeValues(base.varNames, base.defaults, ov.vars);
      if (mv.ok) Object.assign(defaults, mv.values); // invalid edits keep the shipped defaults
    }
    const guards = { extraBlockedKeywords: base.guards.extraBlockedKeywords.slice(), pauseWhenUnavailable: base.guards.pauseWhenUnavailable };
    if (ov.guards) {
      guards.extraBlockedKeywords = guards.extraBlockedKeywords.concat(ov.guards.extraBlockedKeywords || []).slice(0, 20);
      if (ov.guards.pauseWhenUnavailable === true) guards.pauseWhenUnavailable = true;
    }
    return { varNames: base.varNames, defaults, guards };
  }
  // Danger screen for variable VALUES (spec: values reuse the keyword + connector/credential screens).
  function missionValuesScreen(values) {
    if (!values) return true; // no declared variables = nothing to screen
    const kw = Array.isArray(v18.blockKeywords) ? v18.blockKeywords : [];
    for (const name of Object.keys(values)) {
      const v = String(values[name] || '');
      if (!v) return false;
      const low = v.toLowerCase();
      for (const k of kw) { if (k && low.includes(String(k).toLowerCase())) return false; }
      if (CONNECTOR_WORD_RE.test(v) || TOKEN_WORDING_RE.test(v)) return false;
    }
    return true;
  }
  // Render the CURRENT step with the validated run values; unknown tokens / bad values fail closed.
  function missionRenderStep() {
    const steps = missionStepsOf(mission.id);
    if (!steps.length) return { ok: false, code: 'no-steps' };
    const raw = String(steps[Math.min(mission.step, steps.length - 1)] || '');
    const meta = missionMetaFor(mission.id);
    if (!meta || !meta.varNames.length) {
      return /\{\{|\}\}/.test(raw) ? { ok: false, code: 'token-unknown' } : { ok: true, text: raw };
    }
    if (typeof MusePlaybook === 'undefined' || !MusePlaybook) return { ok: false, code: 'no-renderer' };
    return MusePlaybook.render(raw, mission.values || meta.defaults);
  }
  const missionActive = () => mission.enabled && !!mission.id && !!missionById(mission.id);
  const missionCycleNo = () => mission.cycles + 1; // 1-based number of the current cycle
  const missionStepText = () => {
    const r = missionRenderStep(); // v1.21.0 (G02): '' on any render/validation failure (fail closed)
    return r.ok ? r.text : '';
  };
  // The override a mission send passes to followupAttempt: the CURRENT step, tagged so the
  // verifier advances the MISSION (never the phrase rotation) and logs kind 'mission'.
  function missionSendOverride() {
    if (!missionActive()) return null;
    const r = missionRenderStep();
    if (!r.ok || !missionValuesScreen(mission.values)) {
      // v1.21.0 (G02): the step cannot be rendered with valid values — never substitute the
      // rotation phrase; the mission stays exactly where it is (pauseWhenUnavailable semantics).
      return { unavailable: true, mission: { id: mission.id, step: mission.step, cycle: missionCycleNo() } };
    }
    return { text: r.text, source: 'mission', mission: { id: mission.id, step: mission.step, cycle: missionCycleNo() } };
  }
  function persistMission() {
    try {
      if (!mission.id) chrome.storage.local.remove('mission');
      else chrome.storage.local.set({ mission: Object.assign({ id: mission.id, step: mission.step, cycles: mission.cycles, startedAt: mission.startedAt, lastSentAt: mission.lastSentAt }, mission.values ? { values: mission.values, playbookVersion: 1 } : {}) });
    } catch { /* ignore */ }
  }
  // Advance ONLY on a verified send — the exact mirror of advanceFollowupRotation(). Logs the
  // delivered step/cycle as a 'mission' entry, then either starts cycle+1 or completes.
  function missionOnVerifiedSend(m) {
    if (!missionActive() || !m || m.id !== mission.id) return; // stale/foreign mission — ignore
    const L = missionStepsOf(mission.id).length;
    if (!L) return;
    const sentStep = mission.step;
    const sentCycle = missionCycleNo();
    const entry = { at: new Date().toISOString(), kind: 'mission', label: 'mission',
                    context: ('mission ' + mission.id + ' step ' + sentStep + ' cycle ' + sentCycle).slice(0, 240),
                    source: 'mission', mission: { id: mission.id, step: sentStep, cycle: sentCycle } };
    recordClick(entry, entry.context, false);
    mission.lastResult = { at: entry.at, kind: 'mission', id: mission.id, step: sentStep, cycle: sentCycle, verified: true };
    console.log('[muse-auto-allow] mission ' + mission.id + ' step ' + sentStep + ' cycle ' + sentCycle + ' sent');
    mission.lastSentAt = Date.now();
    mission.step += 1;
    if (mission.step >= L) { mission.step = 0; mission.cycles += 1; } // cycle complete
    const sent = mission.cycles * L + mission.step;
    if (sent >= MISSION_MAX_STEPS_PER_MISSION || mission.cycles >= MISSION_MAX_CYCLES) { missionComplete(); return; }
    persistMission();
  }
  // Completed mission: stop SILENTLY (no notification, no further send) with exactly ONE
  // 'mission' log line, and drop the stored mission so nothing runs until the user starts one.
  function missionComplete() {
    const id = mission.id;
    const cycles = mission.cycles;
    mission.completedId = id;
    mission.id = ''; mission.step = 0; mission.cycles = 0; mission.startedAt = 0; mission.lastSentAt = 0; mission.values = null;
    try { chrome.storage.local.remove('mission'); } catch { /* ignore */ }
    const entry = { at: new Date().toISOString(), kind: 'mission', label: 'mission',
                    context: ('mission complete: ' + id + ' (' + cycles + ' cycles)').slice(0, 240),
                    source: 'mission', mission: { id, complete: true, cycles } };
    recordClick(entry, entry.context, false);
    mission.lastResult = { at: entry.at, kind: 'mission', id, complete: true, cycles };
    console.log('[muse-auto-allow] mission ' + id + ' complete');
  }
  // Presence-aware sanitizer for the stored mission object (unknown id / bad shape => no mission).
  function sanitizeMission(m) {
    const o = asObj(m);
    const id = typeof o.id === 'string' ? o.id : '';
    if (!missionById(id)) return null;
    const L = missionStepsOf(id).length;
    const st0 = Number(o.step); const step = Number.isInteger(st0) && st0 > 0 ? Math.min(st0, Math.max(0, L - 1)) : 0;
    const cy0 = Number(o.cycles); const cycles = Number.isInteger(cy0) && cy0 > 0 ? Math.min(cy0, MISSION_MAX_CYCLES) : 0;
    const s0 = Number(o.startedAt); const startedAt = Number.isFinite(s0) && s0 > 0 ? s0 : Date.now();
    const l0 = Number(o.lastSentAt); const lastSentAt = Number.isFinite(l0) && l0 > 0 ? l0 : 0;
    // v1.21.0 (G02): validate the run values against the declared names + defaults; ANY invalid
    // value clears the mission entirely (fail closed — never send with unresolved tokens).
    const meta = missionMetaFor(id);
    let values = null;
    if (meta && meta.varNames.length) {
      if (typeof MusePlaybook === 'undefined' || !MusePlaybook) return null;
      const mv = MusePlaybook.mergeValues(meta.varNames, meta.defaults, asObj(o.values));
      if (!mv.ok) return null;
      if (!missionValuesScreen(mv.values)) return null;
      values = mv.values;
    }
    return { id, step, cycles, startedAt, lastSentAt, values };
  }
  function applyMissionSettings(s) {
    if (!s || typeof s !== 'object') return;
    if ('missionEnabled' in s) mission.enabled = s.missionEnabled === true;
    if ('missionPlaybooks' in s) applyPlaybookOverrides(s.missionPlaybooks); // v1.21.0 (G02)
    if ('mission' in s) {
      const m = sanitizeMission(s.mission);
      if (m) { mission.id = m.id; mission.step = m.step; mission.cycles = m.cycles; mission.startedAt = m.startedAt; mission.lastSentAt = m.lastSentAt; mission.values = m.values || null; }
      else { mission.id = ''; mission.step = 0; mission.cycles = 0; mission.startedAt = 0; mission.lastSentAt = 0; mission.values = null; }
    }
  }

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
      // v1.13.0 (C4-E, red-team claim-3 hardened): an approval is "present" when a card holds an
      // ACTIONABLE allow/deny pair the click paths would act on — the same ground truth as path A
      // (minus pacing/cooldowns, so we can only over-count, which blocks more = fail-safe).
      // Resolved cards stop counting structurally (done marks / handled nodes); no text heuristics.
      for (const card of document.querySelectorAll(CARD_SEL)) {
        if (card.matches(SURFACE_SEL) || !isVisible(card)) continue;
        if (allowDoneCards.has(card)) continue;
        if (!denyBtnsIn(card).some(clickable)) continue;
        if (allowBtnsIn(card).some((b) => clickable(b) && !handledNode(b) && !unsafeTarget(b))) return true; // v5.0 (C5-1): parity with path A — a button path A would never click (link/form target) must not block sends forever
      }
      for (const b of buttonsIn(document)) {
        if (!clickable(b)) continue;
        const t = txt(b);
        if (isAllowText(t)) return true;                                      // any clickable allow button
        // v1.13.0/5.0: the collapsed-pending branch counts on PENDING alone — a pending card whose
        // history line also says "denied ·" must not be skipped (the old DONE guard under-matched);
        // over-counting here only blocks sends, which is the fail-safe direction.
        if (PENDING_CARD_RE.test(t)) return true;                              // collapsed pending card
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
    // v1.9.0 mission precedence: an ACTIVE mission takes precedence over the rotating phrases.
    const mis = missionSendOverride();
    if (mis && mis.unavailable) return; // v1.21.0 (G02): mission active but not renderable — never substitute the rotation
    if (mis) { followupAttempt(false, mis); return; }
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
    if (paused()) return { ok: false, reason: pauseReason() }; // v1.20.0 (G04): 'anomaly-pause' when the auto-pause marker matches
    if (!scheduleAllows()) return { ok: false, reason: 'schedule' };
    if (followup.sending) return { ok: false, reason: 'sending' };
    if (approvalPresent()) return { ok: false, reason: 'approval-present' };
    const composer = findComposer();
    if (!composer) return { ok: false, reason: 'no-composer' };
    if (composerValue(composer).trim()) return { ok: false, reason: 'composer-not-empty' };
    const override = opts && typeof opts.text === 'string' && opts.text.trim() ? opts.text.trim() : '';
    const text = override || followupActiveText(); // rotation item when a list is stored, else the single prompt
    if (!text) return { ok: false, reason: 'no-prompt' };
    // v1.21.0 (G02): per-playbook guard — refuse BEFORE typing when the final text carries an
    // extra blocked keyword; the mission step never advances on a refusal.
    if (opts && opts.mission) {
      const gm = missionMetaFor(opts.mission.id);
      const gkw = gm && gm.guards ? gm.guards.extraBlockedKeywords : [];
      if (gkw.length) {
        const lowT = text.toLowerCase();
        for (const k of gkw) { if (lowT.indexOf(String(k).toLowerCase()) !== -1) return { ok: false, reason: 'mission-guard' }; }
      }
    }
    const now = Date.now();
    const source = (opts && opts.source) || (manual ? 'manual' : 'auto');
    if (v18.dryRun) {
      followup.lastAttemptAt = now;
      if (!manual) followup.attempts.push(now);
      const mis = (opts && opts.mission) || null;
      if (mis) {
        // v1.9.0: dry-run LOGS the mission step it would have sent ('mission-dry') and does
        // NOT advance it — nothing is typed and nothing is submitted.
        const entry = { at: new Date().toISOString(), kind: 'mission-dry', label: 'mission',
                        context: ('mission ' + mis.id + ' step ' + mis.step + ' cycle ' + mis.cycle).slice(0, 240),
                        dryRun: true, source, mission: { id: mis.id, step: mis.step, cycle: mis.cycle } };
        recordClick(entry, entry.context, false);
        followup.lastResult = { at: entry.at, kind: 'mission-dry', id: mis.id, step: mis.step, cycle: mis.cycle, verified: null, dryRun: true, source };
        console.log('[muse-auto-allow] mission-dry ' + mis.id + ' step ' + mis.step + ' cycle ' + mis.cycle);
        return { ok: true, reason: 'dry-run', via: null };
      }
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
    // v1.13.0 (C4-F caveat, red-team claim-4): arm the verify window ONLY when a submit actually
    // fired — a failed first strategy falls back to the other exactly once, and if BOTH fail the
    // attempt is recorded unverified immediately (so a composer-gone later can never count as a
    // delivered send that was never submitted).
    let via = first;
    let armed = submitComposer(composer, first) === true;
    if (!armed) {
      const second = first === 'button' ? 'enter' : 'button';
      if (submitComposer(composer, second)) { via = second; armed = true; }
    }
    if (!armed) {
      followup.sending = false;
      followup.lastResult = { at: new Date().toISOString(), kind: 'followup', via: null, text: text.slice(0, 120), verified: false, source };
      console.warn('[muse-auto-allow] follow-up not submitted — no submit path fired');
      return { ok: false, reason: 'submit-failed' };
    }
    verifyFollowupSend(text, [via], { advanceRotation: !override, source, mission: (opts && opts.mission) || null });
    followup.lastResult = { at: new Date().toISOString(), kind: 'followup', via, text: text.slice(0, 120), verified: null, source };
    return { ok: true, reason: 'attempted', via };
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
      // v1.13.0 (C4-F): delivered when the composer emptied/changed OR disappeared entirely — a
      // post-submit SPA swap unmounts the composer with our text inside it; treating that as
      // unverified stalled the mission/rotation forever. Documented trade: a mid-window
      // navigation counts as delivered (docs/RELEASE_INTEGRITY.md, v1.13.0 evidence).
      if (!c || v !== text) { // emptied (v === '') / changed / composer gone => delivered
        followup.sending = false;
        followup.lastSentAt = Date.now();
        if (followup.lastResult) followup.lastResult.verified = true;
        if (opts && opts.mission) {
          missionOnVerifiedSend(opts.mission); // v1.9.0: advances the MISSION step — only on a verified send
        } else {
          if (!opts || opts.advanceRotation !== false) {
            advanceFollowupRotation(); // verified send only — blocked/failed attempts must not skip a prompt
          }
          const entry = { at: new Date().toISOString(), kind: 'followup', label: 'follow-up', context: text.slice(0, 240), source: (opts && opts.source) || 'auto' };
          recordClick(entry, text, false);
          console.log('[muse-auto-allow] follow-up sent via ' + tried[tried.length - 1]);
        }
        bumpDigest({ followups: 1 });
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
        // v1.9.0: the manual 'send now' path respects the SAME rules — it sends the CURRENT
        // mission step (and advances only on a verified send) when a mission is active.
        const mov = missionSendOverride();
        const r = mov ? (mov.unavailable ? { ok: false, reason: 'mission-unavailable' } : followupAttempt(true, mov)) : followupAttempt(true);
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
                         paused: paused(), dryRun: v18.dryRun, yoloMode: v18.yoloMode, allowOnceMode: v18.allowOnceMode,
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
                         sending: followup.sending,
                         // v1.9.0 mission engine (observability for the popup/tests; the
                         // harness waits on these applied fields instead of sleeping)
                         missionEnabled: mission.enabled, missionId: mission.id || '',
                         missionStep: mission.step, missionCycles: mission.cycles,
                         missionSteps: missionStepsOf(mission.id).length,
                         missionActive: missionActive(),
                         missionCycleNo: missionActive() ? missionCycleNo() : 0,
                         missionStepText: missionStepText(),
                         missions: MISSION_IDS.slice(),
                         completedMissionId: mission.completedId });
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

  // ---- v1.20.0 (G04): anomaly detector ------------------------------------------------------
  function noteAnomalyAllow(text) {
    try {
      const topic = extractTopic(String(text || '')) || '';
      if (!topic) return;
      let arr = topicClicks.get(topic);
      if (!arr) { arr = []; topicClicks.set(topic, arr); }
      arr.push(Date.now());
      if (topicClicks.size > 64) topicClicks.delete(topicClicks.keys().next().value);
    } catch { /* the detector must never break the click path */ }
  }
  function anomalyFire(now, verdict) {
    anomalyLatchUntil = now + anomaly.pauseMs;
    const until = anomalyLatchUntil;
    const ctx = verdict.rule === 'rate'
      ? 'rate:' + Math.round(verdict.detail.count) + '/' + Math.round(anomaly.rateWindowMs / 60000) + 'min'
      : 'topic:spike-' + verdict.topic + ' ' + verdict.detail.topicCount + '/' + Math.round(anomaly.topicWindowMs / 60000) + 'min';
    const entry = { at: new Date().toISOString(), kind: 'anomaly-pause', label: 'Auto-pause (anomaly)', blockedReason: 'anomaly-pause', context: ctx };
    try { state.lastResult = entry; recordClick(entry, ctx, false); } catch { /* logging must not break the pause */ }
    anomalyLastPause = { firedAt: now, until: until, rule: verdict.rule, detail: verdict.detail };
    v18.pauseUntil = until;
    try {
      chrome.storage.local.set({ pauseUntil: until, anomalyLastPause: anomalyLastPause });
    } catch { /* quota failure: the in-page latch still holds the pause-open window */ }
    console.warn('[muse-auto-allow] anomaly auto-pause (' + verdict.rule + ') until ' + new Date(until).toISOString());
  }
  function checkAnomaly(now) {
    if (anomalyDead || !anomaly || typeof MuseAnomaly === 'undefined' || !MuseAnomaly) return;
    if (v18.dryRun) return; // dry-run is a deliberate no-click mode - the detector stays out of it
    if (now < anomalyLatchUntil) return;
    if ((state.clickCount || 0) < anomaly.minSample) return;
    let verdict = null;
    try {
      verdict = MuseAnomaly.evaluate({ settings: anomaly, allowTs: allowClicks, topics: topicClicks, totalClicks: state.clickCount || 0 }, now);
    } catch { anomalyDead = true; console.warn('[muse-auto-allow] anomaly detector disabled (evaluate error)'); return; } // fail closed
    if (verdict) anomalyFire(now, verdict);
  }
  function pauseReason() {
    return (anomalyLastPause && Number(anomalyLastPause.until) === Number(v18.pauseUntil)) ? 'anomaly-pause' : 'paused';
  }

  function sweep(reason) {
    if (!alive()) { stopForever(); return; }
    if (!v18Ready) return; // v1.9.3 boot gate: never sweep before the v18 settings are applied
    if (!enabledReady) return; // v1.13.0 (C4-B): nor before the kill-switch read lands — an observer-driven sweep must not outrun a stored OFF either
    if (!state.enabled) return;
    if (paused()) return; // v1.8.0 pause: every click path (A–E) is halted until pauseUntil passes
    const now = Date.now();
    checkAnomaly(now); // v1.20.0 (G04): the detector rides the same tick, only when unpaused
    const minDelay = v18.yoloMode ? Math.min(state.minDelayMs, YOLO_MIN_DELAY_MS) : state.minDelayMs;
    if (now - state.lastClickAt < minDelay) {
      // Keep the queue moving at the configured pace instead of waiting for the next
      // 1s heartbeat (observed: observer debounce fires once, is blocked by minDelay,
      // and the queue crawls at 1 click/s — diagnosed 2026-10-08).
      scheduleSweep('delay', minDelay - (now - state.lastClickAt) + 25);
      return;
    }

    // ONE query per scope for the whole sweep, shared by every detection path (SURFACE_SEL is a
    // subset of CARD_SEL, so a single card query feeds both path A and path D) instead of each of
    // the four passes re-querying all buttons. The gate then skips every path when the page holds
    // nothing any path (A–E) could act on: a page with no candidate card and no approval-shaped
    // button costs one text pass and nothing else. The per-sweep read caches are dropped on exit.
    const prevTxtCache = sweepTxtCache, prevVisCache = sweepVisCache;
    sweepTxtCache = new Map();
    sweepVisCache = new Map();
    try {
      const cards = document.querySelectorAll(CARD_SEL);
      const btns = buttonsIn(document);
      if (!cards.length && !btns.length) return;
      if (!cards.length && !btns.some(approvalShapedButton)) return;

      const hit = findMarkedAllow(cards) || findPairAllow(btns);
      if (hit) {
        if (!allowRateOk()) return; // global ceiling — a page cannot drive unbounded real approvals (F3)
        doClick(hit.btn, hit.card, 'allow', null, hit.ctx);
        return;
      }

      if (now - state.lastExpandAt >= EXPAND_THROTTLE_MS) {
        const c = findCollapsedPending(btns);
        if (c) { doClick(c.btn, null, 'expand', c.key); return; }
      }

      if (now - state.lastReviewBarAt >= REVIEW_BAR_THROTTLE_MS) {
        const rb = findReviewBarButton(btns);
        if (rb) { doClick(rb.btn, null, 'review-bar', rb.key); return; }
      }

      if (now - state.lastSurfaceAt >= SURFACE_THROTTLE_MS) {
        const s = findSurfaceButton(cards);
        if (s) { doClick(s.btn, null, 'open-panel', s.key); return; }
      }
    } finally {
      sweepTxtCache = prevTxtCache;
      sweepVisCache = prevVisCache;
    }
  }

  // A pending sweep remembers whether it is the FAST (card-bearing) kind: a later generic
  // mutation must never downgrade it back to the slow trailing debounce, or a card that just
  // rendered would have to wait out an unrelated re-render storm before it is approved.
  function scheduleSweep(reason, ms, fast) {
    if (pendingTimer) {
      if (pendingFast && !fast) return;
      clearTimeout(pendingTimer);
    }
    pendingFast = !!fast;
    pendingTimer = setTimeout(() => { pendingTimer = null; pendingFast = false; sweep(reason); }, ms);
  }

  // Boot: load persisted settings, then first sweep.
  try {
    chrome.storage.local.get(DEFAULT, (s) => {
      state.enabled = s.enabled !== false;
      const n = Number(s.minDelayMs);
      state.minDelayMs = Number.isFinite(n) && n >= 0 ? n : 300;
      state.clickCount = Number(s.clickCount) || 0;
      enabledReady = true; // v1.13.0 (C4-B): the kill-switch read landed
      if (v18Ready) sweep('init'); // v1.9.3 boot gate: the v18 read below owns the first sweep
    });
    // v1.6.0 auto follow-up settings (independent of the approve engine's toggle)
    chrome.storage.local.get(FOLLOWUP_DEFAULTS, (f) => { applyFollowupSettings(f); followupTick(); });
    // v1.8.0 frozen settings (pause / dry-run / rules / smart follow-up / schedule)
    // + v1.9.0 mission settings (missionEnabled / mission{id,step,cycles,startedAt,lastSentAt})
    chrome.storage.local.get({ pauseUntil: 0, dryRun: false, yoloMode: false, allowOnceMode: false, rules: {}, followupSmart: {}, followupSchedule: {}, missionEnabled: false, mission: null, anomaly: null, anomalyLastPause: null, missionPlaybooks: null },
      (s) => { applyV18Settings(s); applyMissionSettings(s); publishFlags(); v18Ready = true; if (enabledReady) sweep('init'); }); // v1.13.0 (C4-B): sweep only once BOTH reads landed — the hardcoded enabled:true default must never outrun a stored kill-switch
    chrome.storage.onChanged.addListener((ch) => {
      // A key REMOVED from storage (newValue === undefined) resets to that key's shipped DEFAULT —
      // never a stale in-memory value (fail-closed). Observed live: after storage.local.clear() a
      // closed schedule kept refusing every send with reason 'schedule'.
      const removed = (c) => !c || c.newValue === undefined;
      if (ch.enabled) state.enabled = removed(ch.enabled) ? DEFAULT.enabled : !!ch.enabled.newValue;
      if (ch.anomaly) anomaly = (typeof MuseAnomaly !== 'undefined' && MuseAnomaly) ? MuseAnomaly.sanitize(removed(ch.anomaly) ? null : ch.anomaly.newValue) : anomaly; // v1.20.0 (G04)
      if (ch.anomalyLastPause) { const m = removed(ch.anomalyLastPause) ? null : ch.anomalyLastPause.newValue; anomalyLastPause = (m && typeof m === 'object') ? m : null; }
      if (ch.missionPlaybooks) applyPlaybookOverrides(removed(ch.missionPlaybooks) ? null : ch.missionPlaybooks.newValue); // v1.21.0 (G02)
      if (ch.minDelayMs) {
        if (removed(ch.minDelayMs)) state.minDelayMs = DEFAULT.minDelayMs;
        else { const n = Number(ch.minDelayMs.newValue); if (Number.isFinite(n) && n >= 0) state.minDelayMs = n; }
      }
      let fch = false;
      if (ch.followupEnabled) { followup.enabled = removed(ch.followupEnabled) ? FOLLOWUP_DEFAULTS.followupEnabled : !!ch.followupEnabled.newValue; fch = true; }
      if (ch.followupPrompt) {
        if (removed(ch.followupPrompt)) followup.prompt = FOLLOWUP_DEFAULTS.followupPrompt;
        else if (typeof ch.followupPrompt.newValue === 'string') followup.prompt = ch.followupPrompt.newValue;
        fch = true;
      }
      if (ch.followupPrompts) { followup.prompts = removed(ch.followupPrompts) ? [] : sanitizeFollowupPrompts(ch.followupPrompts.newValue); fch = true; }
      if (ch.followupRotateIdx) {
        if (removed(ch.followupRotateIdx)) followup.rotateIdx = 0;
        else { const fr = Number(ch.followupRotateIdx.newValue); if (Number.isInteger(fr) && fr >= 0) followup.rotateIdx = fr; }
      }
      if (ch.followupIdleMs) {
        if (removed(ch.followupIdleMs)) { followup.idleMs = FOLLOWUP_DEFAULTS.followupIdleMs; fch = true; }
        else { const fn = Number(ch.followupIdleMs.newValue); if (Number.isFinite(fn) && fn >= 0) { followup.idleMs = fn; fch = true; } }
      }
      if (ch.followupCooldownMs) {
        if (removed(ch.followupCooldownMs)) { followup.cooldownMs = FOLLOWUP_DEFAULTS.followupCooldownMs; fch = true; }
        else { const fc = Number(ch.followupCooldownMs.newValue); if (Number.isFinite(fc) && fc >= 0) { followup.cooldownMs = fc; fch = true; } }
      }
      const vpatch = {};
      let vch = false;
      for (const k of ['pauseUntil', 'dryRun', 'yoloMode', 'allowOnceMode', 'rules', 'followupSmart', 'followupSchedule']) {
        if (!ch[k]) continue;
        vch = true;
        if (removed(ch[k])) resetV18Key(k); // a deleted key falls back to that key's default, never stale
        else vpatch[k] = ch[k].newValue;
      }
      // v1.9.0 mission keys — 'mission' may be REMOVED (newValue undefined) which must clear it
      if (ch.missionEnabled) { vpatch.missionEnabled = ch.missionEnabled.newValue === true; vch = true; }
      if (ch.mission) { vpatch.mission = removed(ch.mission) ? null : ch.mission.newValue; vch = true; }
      if (vch) { applyV18Settings(vpatch); applyMissionSettings(vpatch); publishFlags(); }
      if (fch || vch) { try { followupTick(); } catch { /* ignore */ } }
    });
    chrome.runtime.onMessage.addListener((m) => { if (m && m.type === 'sweep') sweep('message'); });
  } catch {
    sweep('init');
  }

  // True when a mutation record is about an approval card/surface (the engine's own CARD_SEL
  // scope — SURFACE_SEL is a subset of it): the card itself appeared, or the change landed inside
  // one. Only childList records qualify: a characterData/attribute change inside a card is a
  // re-render, not a new approval, so it keeps the coalescing trailing debounce.
  function cardBearingMutation(rec) {
    if (!rec || rec.type !== 'childList') return false;
    const t = rec.target;
    if (t && t.nodeType === 1) {
      if (t.matches && t.matches(CARD_SEL)) return true;
      if (t.closest && t.closest(CARD_SEL)) return true;
    }
    const added = rec.addedNodes;
    if (added) {
      for (let i = 0; i < added.length; i++) {
        const n = added[i];
        if (!n || n.nodeType !== 1) continue;
        if (n.matches && n.matches(CARD_SEL)) return true;
        if (n.querySelector && n.querySelector(CARD_SEL)) return true;
      }
    }
    return false;
  }

  // Instant reaction: re-sweep on DOM changes. A card/surface-bearing mutation sweeps on the NEXT
  // task — the card IS the product's core loop, and the fixed 120 ms trailing debounce was pure
  // added latency for it. Generic mutations (re-render storms, streaming text, attribute churn)
  // keep the 120 ms trailing debounce that coalesces them into one sweep. characterData/attributes
  // stay observed too: the stuck detector needs "NO DOM mutation" to mean exactly that.
  try {
    obs = new MutationObserver((records) => {
      lastDomActivityAt = Date.now();
      let fast = false;
      for (const rec of records) { if (cardBearingMutation(rec)) { fast = true; break; } }
      scheduleSweep('observer', fast ? OBSERVER_CARD_MS : OBSERVER_GENERIC_MS, fast);
    });
    obs.observe(document.documentElement || document, { childList: true, subtree: true, characterData: true, attributes: true });
  } catch {}

  // Fallback heartbeat (safe under background-tab throttling).
  heartbeat = setInterval(() => { sweep('interval'); try { if (followup.enabled || (++ftick % 3) === 0) followupTick(); } catch { /* ignore */ } publishFlags(); }, 1000); // v5.0 (C5-5): skip the state-detection scans on 2 of 3 ticks while follow-up is off (measurable CPU on long chats); cadence unchanged when enabled

  window.__museAutoAllow = {
    get state() { return { ...state }; },
    get v18() {
      return { paused: paused(), dryRun: v18.dryRun, yoloMode: v18.yoloMode, allowOnceMode: v18.allowOnceMode, allowTopics: [...v18.allowTopics],
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
