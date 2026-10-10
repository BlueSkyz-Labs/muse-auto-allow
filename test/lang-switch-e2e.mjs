#!/usr/bin/env node
/**
 * lang-switch-e2e.mjs — runtime verification for the v1.8.1 LANGUAGE SWITCHER.
 *
 * Lane: INSTALLED Chrome (137+) via CDP `Extensions.loadUnpacked`, scratch profile only.
 * The extension is loaded STRAIGHT from extension/ (no test-match injection needed — the
 * feature lives entirely in the popup page).
 *
 * What it proves (the owner ask: "Thêm nút này Language-switch UI"):
 *  0.  pre-flight (no browser): 6 locales key-identical; the 3 new switcher keys exist in
 *      ALL of them; every literal t('key') in popup.js resolves in en; the dead draft
 *      extension/lang-switch.mjs is GONE; the button/menu markup + override are wired.
 *  a.  DEFAULT: with `userLocale` absent the popup is byte-for-byte the pre-switcher
 *      behaviour — button reads 'Auto' (en) and 3 visible strings equal the BROWSER-locale
 *      (en-US, pinned with --lang) values.
 *  b.  MANUAL: choosing Tiếng Việt from the real dropdown makes those same 3 visible
 *      strings the EXACT vi values, persists `userLocale: 'vi'`, and leaves
 *      chrome.i18n.getMessage() still returning the en string — i.e. the popup is really
 *      served from the fetched _locales/vi/messages.json, not from the browser locale.
 *  c.  BACK TO AUTO: choosing 'Auto (browser)' restores the browser-locale strings and
 *      persists `userLocale: 'auto'`.
 *  d.  HEIGHT: the popup stays <= 600 px in every state INCLUDING the menu open (the menu
 *      is measured at its own lowest edge, not just the layout's).
 *  e.  A11Y: aria-haspopup/aria-expanded toggle, role=menu/menuitemradio + aria-checked,
 *      Escape closes and returns focus to the button, ArrowDown opens + moves focus.
 *  f.  ALL 6 LOCALES render the native button label, the right strings, no title wrap and
 *      a total height <= 600 px.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
// MAA_EXT_DIR lets a falsification run point the harness at a MUTATED copy of the extension.
const EXT_DIR = process.env.MAA_EXT_DIR ? path.resolve(process.env.MAA_EXT_DIR) : path.join(ROOT, 'extension');
const IS_WIN = process.platform === 'win32';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LOCALES = ['en', 'vi', 'zh_CN', 'ja', 'ko', 'es'];
const NATIVE = { en: 'English', vi: 'Tiếng Việt', zh_CN: '简体中文', ja: '日本語', ko: '한국어', es: 'Español' };
const NEW_KEYS = ['langAuto', 'langAutoBrowser', 'langMenuAria'];
// three strings that are visible in the default popup, are NOT `data-nc` (so the rendered
// text is the raw message) and differ in every locale.
const VISIBLE = ['toggleLabel', 'pauseLabel', 'last7'];

if (!fs.existsSync(path.join(EXT_DIR, 'manifest.json'))) {
  console.error('lang-switch-e2e: no manifest.json in ' + EXT_DIR);
  process.exit(1);
}

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: !!ok, detail });
  if (!ok) console.log('FAIL ' + name + ' :: ' + JSON.stringify(detail));
}

// ---------- pre-flight (no browser) ----------
function preflight() {
  const locDir = path.join(EXT_DIR, '_locales');
  const locales = fs.readdirSync(locDir).filter((d) => fs.existsSync(path.join(locDir, d, 'messages.json')));
  const msgs = {};
  for (const l of locales) msgs[l] = JSON.parse(fs.readFileSync(path.join(locDir, l, 'messages.json'), 'utf8'));
  const enKeys = Object.keys(msgs.en).sort();
  const mismatches = locales.filter((l) => JSON.stringify(Object.keys(msgs[l]).sort()) !== JSON.stringify(enKeys));
  const missingNew = [];
  for (const l of locales) for (const k of NEW_KEYS) if (!msgs[l][k] || typeof msgs[l][k].message !== 'string') missingNew.push(l + ':' + k);
  const html = fs.readFileSync(path.join(EXT_DIR, 'popup.html'), 'utf8');
  const js = fs.readFileSync(path.join(EXT_DIR, 'popup.js'), 'utf8');
  const usedJs = new Set();
  for (const m of js.matchAll(/t\(\s*'([A-Za-z0-9_]+)'/g)) usedJs.add(m[1]);
  const missingInJs = [...usedJs].filter((k) => !(k in msgs.en));
  const deadDraft = fs.existsSync(path.join(EXT_DIR, 'lang-switch.mjs'));
  return {
    localeCount: locales.length,
    mismatches,
    missingNew,
    missingInJs,
    deadDraft,
    markupOk: /id="langBtn"/.test(html) && /id="langMenu"/.test(html) && /aria-haspopup="menu"/.test(html) && /role="menu"/.test(html),
    overrideOk: /LOCALE_IDS/.test(js) && /readAsset/.test(js) && /loadLocale/.test(js) && /applyLocale/.test(js) && /userLocale/.test(js),
    expected: Object.fromEntries(LOCALES.map((l) => [l, VISIBLE.map((k) => msgs[l][k].message)])),
    enKeyCount: enKeys.length,
    enAutoBrowser: msgs.en.langAutoBrowser.message,
    enMenuAria: msgs.en.langMenuAria.message,
    ok: locales.length === 6 && mismatches.length === 0 && missingNew.length === 0 && missingInJs.length === 0 && !deadDraft,
  };
}
const pre = preflight();

// ---------- launch installed Chrome (scratch profile) ----------
const chromePath = process.env.MAA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.env.MAA_LANG_PORT || 9900 + Math.floor(Math.random() * 90));
const profileDir = path.join(os.tmpdir(), `maa-lang-e2e-${process.pid}-${Date.now().toString(36)}`);
fs.mkdirSync(profileDir, { recursive: true });

const CHROME_ARGS = [
  `--user-data-dir=${profileDir}`,
  `--remote-debugging-port=${PORT}`,
  '--enable-unsafe-extension-debugging',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-features=Translate,MediaRouter,CalculateNativeWinOcclusion,OptimizationHints',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--window-position=-32000,-32000',
  '--window-size=1100,800',
  '--lang=en-US', // pin the BROWSER locale: 'auto' must resolve to English
  'about:blank',
];
function launchChromeDetached(args) {
  const psq = (s) => s.replace(/'/g, "''");
  const argList = args.map((a) => `'${psq(a)}'`).join(',');
  execFileSync('powershell.exe', ['-NoProfile', '-Command',
    `Start-Process -FilePath '${psq(chromePath)}' -ArgumentList ${argList}`],
    { stdio: 'ignore', timeout: 30000 });
}
launchChromeDetached(CHROME_ARGS);

async function cdpEndpoint(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) { const j = await res.json(); if (j.webSocketDebuggerUrl) return j; }
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error(`Chrome did not expose CDP on port ${PORT}`);
}
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error('websocket error'));
  });
}
function makeSend(ws) {
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  };
  return (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    const m = { id, method, params };
    if (sessionId) m.sessionId = sessionId;
    ws.send(JSON.stringify(m));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(method + ' timed out')); } }, 20000);
  });
}

// ---------- teardown: reap only OUR chrome (matched by scratch profile path) ----------
const psQuote = (s) => s.replace(/'/g, "''");
function countMyChrome() {
  try {
    if (!IS_WIN) return 0;
    const ps = `@(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine -like '*${psQuote(profileDir)}*' }).Count`;
    const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8', timeout: 25000 });
    return Number(out.trim()) || 0;
  } catch { return 0; }
}
function killMyChrome() {
  try {
    if (!IS_WIN) return;
    const ps = `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine -like '*${psQuote(profileDir)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
    execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { stdio: 'ignore', timeout: 30000 });
  } catch { /* nothing to kill */ }
}

let ws = null;
let send = null;
let popSession = null;
const results = { ok: false, preflight: pre, checks: checks };
try {
  check('0. locales key-identical (6) + switcher keys in all 6 + no dead draft', pre.ok, pre);
  check('0. switcher markup + manual-override wiring present', pre.markupOk && pre.overrideOk, { markupOk: pre.markupOk, overrideOk: pre.overrideOk });

  const info = await cdpEndpoint();
  ws = await connect(info.webSocketDebuggerUrl);
  send = makeSend(ws);

  const loaded = await send('Extensions.loadUnpacked', { path: EXT_DIR });
  const extId = loaded?.id;
  if (!extId) throw new Error('Extensions.loadUnpacked returned no extension id');
  console.log('extensionId:', extId);
  results.extId = extId;

  const pop = await send('Target.createTarget', { url: `chrome-extension://${extId}/popup.html` });
  popSession = (await send('Target.attachToTarget', { targetId: pop.targetId, flatten: true })).sessionId;
  await sleep(1200);

  async function pEval(expr, awaitPromise) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, ...(awaitPromise ? { awaitPromise: true } : {}) }, popSession);
    if (r && r.exceptionDetails) throw new Error('page exception: ' + JSON.stringify(r.exceptionDetails.exception || r.exceptionDetails));
    return r?.result?.value;
  }
  // one snapshot of everything the assertions need
  async function probe() {
    return JSON.parse(await pEval(`JSON.stringify((() => {
      const btn = document.getElementById('langBtn');
      const menu = document.getElementById('langMenu');
      const body = document.body;
      const br = body.getBoundingClientRect();
      const foot = document.querySelector('.foot');
      const h1 = document.querySelector('.head h1');
      const chip = document.getElementById('musestat');
      const mr = menu ? menu.getBoundingClientRect() : null;
      const fr = foot ? foot.getBoundingClientRect() : null;
      const items = menu ? Array.from(menu.querySelectorAll('.langitem')) : [];
      const str = (k) => { const el = document.querySelector('[data-i18n="' + k + '"]'); return el ? el.textContent : null; };
      return {
        btnText: (document.getElementById('langBtnText') || {}).textContent,
        btnAria: btn ? btn.getAttribute('aria-label') : null,
        haspopup: btn ? btn.getAttribute('aria-haspopup') : null,
        expanded: btn ? btn.getAttribute('aria-expanded') : null,
        menuHidden: menu ? menu.hidden : null,
        menuRole: menu ? menu.getAttribute('role') : null,
        menuAria: menu ? menu.getAttribute('aria-label') : null,
        menuBottom: mr ? Math.round(mr.bottom - br.top) : null,
        footBottom: fr ? Math.round(fr.bottom - br.top) : null,
        lowest: Math.round(Math.max(fr ? fr.bottom : 0, mr ? mr.bottom : 0) - br.top),
        bodyH: Math.round(br.height),
        itemCount: items.length,
        itemLabels: items.map((b) => (b.querySelector('.ltxt') || {}).textContent),
        itemRoles: items.map((b) => b.getAttribute('role')),
        checked: items.filter((b) => b.getAttribute('aria-checked') === 'true').map((b) => b.dataset.lang),
        focusId: document.activeElement ? (document.activeElement.id || document.activeElement.className || document.activeElement.tagName) : null,
        docLang: document.documentElement.lang,
        h1H: h1 ? Math.round(h1.getBoundingClientRect().height) : null,
        btnW: btn ? Math.round(btn.getBoundingClientRect().width) : null,
        chipW: chip ? Math.round(chip.getBoundingClientRect().width) : null,
        headH: Math.round(document.querySelector('.head').getBoundingClientRect().height),
        strings: ${JSON.stringify(VISIBLE)}.map(str),
        i18nToggle: (() => { try { return chrome.i18n.getMessage('toggleLabel'); } catch (e) { return 'ERR'; } })(),
        uiLang: (() => { try { return chrome.i18n.getUILanguage(); } catch (e) { return 'ERR'; } })(),
        manual: (typeof manualMsgs !== 'undefined' && manualMsgs) ? { locale: manualLocale, keys: Object.keys(manualMsgs).length } : null,
        userLocaleVar: typeof userLocale !== 'undefined' ? userLocale : 'MISSING',
      };
    })())`));
  }
  async function waitFor(pred, timeout = 6000, step = 150) {
    const dl = Date.now() + timeout;
    let s = await probe();
    while (Date.now() < dl && !pred(s)) { await sleep(step); s = await probe(); }
    return s;
  }
  async function click(sel) {
    return pEval(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true; })()`);
  }
  async function key(k) {
    return pEval(`(() => { const el = document.activeElement || document.body; el.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true, cancelable: true })); return true; })()`);
  }
  async function seed(obj) {
    return pEval(`new Promise((res) => chrome.storage.local.set(${JSON.stringify(obj)}, () => res(true)))`, true);
  }
  async function popStore(keys) {
    const out = await pEval(`new Promise((res) => chrome.storage.local.get(${JSON.stringify(keys)}, (s) => res(JSON.stringify(s))))`, true);
    try { return JSON.parse(out); } catch { return null; }
  }

  const EN = pre.expected.en;

  // ---- (a) DEFAULT = browser-locale behaviour, unchanged ----
  const s0 = await probe();
  const st0 = await popStore(['userLocale']);
  check('a. default: userLocale absent in storage', st0 && st0.userLocale === undefined, st0);
  check('a. default: button label is the en "Auto" label', s0.btnText === 'Auto' && s0.userLocaleVar === 'auto', { btnText: s0.btnText, userLocaleVar: s0.userLocaleVar });
  check('a. default: 3 visible strings are the browser-locale (en-US) values', JSON.stringify(s0.strings) === JSON.stringify(EN), { got: s0.strings, want: EN });
  check('a. default: no manual locale was loaded (pure chrome.i18n path)', s0.manual === null, s0.manual);
  check('a. default: menu closed, aria-expanded=false', s0.menuHidden === true && s0.expanded === 'false', { menuHidden: s0.menuHidden, expanded: s0.expanded });
  results.default = { btnText: s0.btnText, strings: s0.strings, uiLang: s0.uiLang };

  // ---- (e) menu open/a11y, before any switch ----
  await click('#langBtn');
  await sleep(200);
  const s1 = await probe();
  check('e. open: aria-haspopup=menu, aria-expanded=true, menu visible', s1.haspopup === 'menu' && s1.expanded === 'true' && s1.menuHidden === false, { haspopup: s1.haspopup, expanded: s1.expanded, menuHidden: s1.menuHidden });
  check('e. open: role=menu + aria-label localised + 7 menuitemradio rows', s1.menuRole === 'menu' && s1.menuAria === pre.enMenuAria && s1.itemCount === 7 && s1.itemRoles.every((r) => r === 'menuitemradio'), { menuRole: s1.menuRole, menuAria: s1.menuAria, itemCount: s1.itemCount });
  check('e. open: row 0 is "Auto (browser)", rows 1..6 are the hardcoded native names', s1.itemLabels[0] === pre.enAutoBrowser && LOCALES.every((l, i) => s1.itemLabels[i + 1] === NATIVE[l]), s1.itemLabels);
  check('e. open: exactly the active locale is checked (auto)', JSON.stringify(s1.checked) === JSON.stringify(['auto']), s1.checked);
  check('e. open: focus moved into the menu', s1.focusId === 'langitem on' || String(s1.focusId).indexOf('langitem') >= 0, s1.focusId);
  await key('Escape');
  await sleep(200);
  const s2 = await probe();
  check('e. Escape: closes the menu, aria-expanded=false, focus returns to the button', s2.menuHidden === true && s2.expanded === 'false' && s2.focusId === 'langBtn', { menuHidden: s2.menuHidden, expanded: s2.expanded, focusId: s2.focusId });
  await key('ArrowDown');
  await sleep(200);
  const s2b = await probe();
  check('e. ArrowDown on the button: opens the menu and moves focus to a row', s2b.menuHidden === false && s2b.expanded === 'true' && String(s2b.focusId).indexOf('langitem') >= 0, { menuHidden: s2b.menuHidden, focusId: s2b.focusId });
  await key('Escape');
  await sleep(150);

  // ---- (b) MANUAL: pick Tiếng Việt from the real dropdown ----
  await click('#langBtn');
  await sleep(200);
  await click('#langMenu [data-lang="vi"]');
  const s3 = await waitFor((s) => s.btnText === NATIVE.vi && s.strings[0] === pre.expected.vi[0]);
  const st3 = await popStore(['userLocale']);
  check('b. vi: button label is the native name "Tiếng Việt"', s3.btnText === NATIVE.vi, s3.btnText);
  check('b. vi: the 3 visible strings are the EXACT vi values', JSON.stringify(s3.strings) === JSON.stringify(pre.expected.vi), { got: s3.strings, want: pre.expected.vi });
  check('b. vi: chrome.i18n.getMessage still returns the BROWSER (en) string — the override is real', s3.i18nToggle === EN[0] && s3.i18nToggle !== pre.expected.vi[0], { i18nToggle: s3.i18nToggle, en: EN[0] });
  check('b. vi: the manual messages.json was fetched + cached (all ' + pre.enKeyCount + ' keys)', !!s3.manual && s3.manual.locale === 'vi' && s3.manual.keys === pre.enKeyCount, s3.manual);
  check('b. vi: userLocale persisted as "vi"', st3 && st3.userLocale === 'vi', st3);
  check('b. vi: menu closed again + focus returned to the button', s3.menuHidden === true && s3.focusId === 'langBtn', { menuHidden: s3.menuHidden, focusId: s3.focusId });
  check('b. vi: <html lang> follows the manual locale (vi)', s3.docLang === 'vi', s3.docLang);
  results.vi = { btnText: s3.btnText, strings: s3.strings, i18nToggle: s3.i18nToggle, manual: s3.manual };

  // ---- (d) height with the menu OPEN (worst state of the new control) ----
  await click('#langBtn');
  await sleep(250);
  const s4 = await probe();
  check('d. menu open: popup lowest content edge <= 600px (menu measured too)', s4.lowest <= 600, { lowest: s4.lowest, menuBottom: s4.menuBottom, footBottom: s4.footBottom });
  check('d. menu open: layout (.foot) still <= 600px and unchanged by the overlay', s4.footBottom <= 600, { footBottom: s4.footBottom });
  check('d. menu open: menu rows are the native labels with vi checked', s4.itemLabels[LOCALES.indexOf('vi') + 1] === NATIVE.vi && JSON.stringify(s4.checked) === JSON.stringify(['vi']), { labels: s4.itemLabels, checked: s4.checked });
  results.heightMenuOpen = { lowest: s4.lowest, menuBottom: s4.menuBottom, footBottom: s4.footBottom, bodyH: s4.bodyH };
  await key('Escape');
  await sleep(150);

  // ---- (d2) worst layout state the shipped suites seed: full 12-entry log + menu OPEN ----
  await seed({ log: Array.from({ length: 12 }, (_, i) => ({ kind: 'allow', label: 'Allow ' + i, context: 'context line ' + i, at: new Date(Date.now() - i * 60000).toISOString() })) });
  await sleep(900);
  const sFull = await probe();
  await click('#langBtn');
  await sleep(250);
  const s4b = await probe();
  check('d. menu open with a FULL 12-entry log: popup stays <= 600px (menu measured too)', s4b.lowest <= 600 && s4b.footBottom <= 600,
    { lowest: s4b.lowest, menuBottom: s4b.menuBottom, footBottom: s4b.footBottom });
  check('d. full log + menu open: the overlay did not grow the layout', s4b.footBottom === sFull.footBottom, { withMenu: s4b.footBottom, withoutMenu: sFull.footBottom });
  results.heightMenuOpenFullLog = { lowest: s4b.lowest, menuBottom: s4b.menuBottom, footBottom: s4b.footBottom };
  await key('Escape');
  await sleep(150);
  await seed({ log: [] });
  await sleep(600);

  // ---- (c) BACK TO AUTO through the dropdown ----
  await click('#langBtn');
  await sleep(200);
  await click('#langMenu [data-lang="auto"]');
  const s5 = await waitFor((s) => s.btnText === 'Auto' && s.strings[0] === EN[0]);
  const st5 = await popStore(['userLocale']);
  check('c. auto: button label back to the en "Auto"', s5.btnText === 'Auto', s5.btnText);
  check('c. auto: the 3 visible strings are back to the browser-locale values', JSON.stringify(s5.strings) === JSON.stringify(EN), { got: s5.strings, want: EN });
  check('c. auto: userLocale persisted as "auto"', st5 && st5.userLocale === 'auto', st5);
  check('c. auto: <html lang> back to the browser locale', s5.docLang === s0.docLang, { docLang: s5.docLang, was: s0.docLang });
  results.backToAuto = { btnText: s5.btnText, strings: s5.strings };

  // ---- (f) every locale: native label, exact strings, no title wrap, <= 600px ----
  const sweep = [];
  for (const l of LOCALES) {
    await seed({ userLocale: l });
    const s = await waitFor((x) => x.btnText === NATIVE[l] && x.strings[0] === pre.expected[l][0]);
    const row = {
      locale: l, btnText: s.btnText, stringsOk: JSON.stringify(s.strings) === JSON.stringify(pre.expected[l]),
      manualLocale: s.manual ? s.manual.locale : null, lowest: s.lowest, footBottom: s.footBottom, h1H: s.h1H, headH: s.headH, btnW: s.btnW, chipW: s.chipW,
    };
    sweep.push(row);
    check('f. ' + l + ': native label + exact strings + override loaded + height<=600 + title on one line',
      row.btnText === NATIVE[l] && row.stringsOk && row.manualLocale === l && row.lowest <= 600 && row.footBottom <= 600 && row.h1H <= 22,
      row);
  }
  await seed({ userLocale: 'auto' });
  await waitFor((x) => x.btnText === 'Auto');
  results.localeSweep = sweep;

  results.ok = checks.every((c) => c.ok);
} catch (e) {
  results.error = e.message;
} finally {
  try { await send?.('Browser.close'); } catch { /* may be gone */ }
  await sleep(1200);
  let remaining = countMyChrome();
  for (let i = 0; i < 12 && remaining > 0; i++) { killMyChrome(); await sleep(500); remaining = countMyChrome(); }
  if (remaining > 0) console.error(`WARNING: ${remaining} chrome process(es) still reference ${profileDir}`);
  for (let i = 0; i < 6; i++) {
    try { fs.rmSync(profileDir, { recursive: true, force: true }); break; } catch { await sleep(500); }
  }
  try { ws?.close(); } catch { /* ignore */ }
}

const failed = checks.filter((c) => !c.ok);
console.log(JSON.stringify({
  ok: results.ok, extId: results.extId, passed: checks.length - failed.length, failed: failed.length,
  failedChecks: failed.map((c) => c.name),
  heightMenuOpen: results.heightMenuOpen, heightMenuOpenFullLog: results.heightMenuOpenFullLog, default: results.default, vi: results.vi, backToAuto: results.backToAuto,
  localeSweep: results.localeSweep, preflight: pre, error: results.error,
}, null, 2));
process.exit(results.ok ? 0 : 2);
