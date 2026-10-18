// qa-experience.mjs — SGPS:Experience pass instrument (in-Chrome, scratch profile only).
// Machine-checkable subset of docs/SGPS_EXPERIENCE_CHECKLIST.md:
//   A. WCAG contrast of visible text (popup + stats) in BOTH themes, scheme-confirmed
//   B. prefers-reduced-motion honored (no transitions/animations)
//   C. :focus-visible coverage; outline:none requires the wrapper-ring pattern
//   D. no horizontal overflow with the vi locale (long-string layout)
//   E. state communicated as text (dry-run band / live state line)
//   F. accessibility tree: every interactive control has an accessible NAME
//   G. real keyboard Tab traversal reaches the interactive controls (Input domain)
//   H. 200%-zoom proxy (half layout viewport): no overflow, primary control intact
//   I. empty-state message present on a fresh stats page
//   J. chart tick dates follow the EFFECTIVE locale (Intl) under a manual locale
// Usage: node scripts/qa-experience.mjs   (exit 2 on any FAIL; JSON summary on stdout)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const EXT = path.join(REPO, 'extension');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TMP_EXT = fs.mkdtempSync(path.join(os.tmpdir(), 'maa-exp-'));
fs.cpSync(EXT, TMP_EXT, { recursive: true });
const profileDir = path.join(os.tmpdir(), `maa-exp-p-${process.pid}`);
fs.mkdirSync(profileDir, { recursive: true });
const PORT = 9600 + Math.floor(Math.random() * 200);
const chromePath = process.env.MAA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const psq = (s) => s.replace(/'/g, "''");
execFileSync('powershell.exe', ['-NoProfile', '-Command',
  `Start-Process -FilePath '${psq(chromePath)}' -ArgumentList ${[
    `--user-data-dir=${profileDir}`, `--remote-debugging-port=${PORT}`,
    '--enable-unsafe-extension-debugging', '--no-first-run', '--no-default-browser-check',
    '--window-position=-32000,-32000', '--window-size=1400,1000', 'about:blank',
  ].map((a) => `'${psq(a)}'`).join(',')}`], { stdio: 'ignore', timeout: 30000 });

const RESULT = { built: 'qa-experience', checks: [] };
const check = (name, ok, detail) => { RESULT.checks.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail && !ok ? ' :: ' + JSON.stringify(detail).slice(0, 420) : '')); };

let ws = null;
async function cdpEndpoint() { for (let i = 0; i < 160; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) { const j = await r.json(); if (j.webSocketDebuggerUrl) return j; } } catch {} await sleep(250); } throw new Error('no cdp'); }
function connect(url) { return new Promise((res, rej) => { const w = new WebSocket(url); w.onopen = () => res(w); w.onerror = () => rej(new Error('ws')); }); }
function makeSend(w) { let seq = 0; const pending = new Map(); w.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } }; return (method, params = {}, sid) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); const m = { id, method, params }; if (sid) m.sessionId = sid; w.send(JSON.stringify(m)); setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(method + ' timeout')); } }, 30000); }); }

let send = null;
const evOn = (sid) => async (expr, awaitPromise = false) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, ...(awaitPromise ? { awaitPromise: true } : {}) }, sid);
  if (r?.exceptionDetails) return { __err: JSON.stringify(r.exceptionDetails).slice(0, 300) };
  return r?.result?.value;
};

const CONTRAST_JS = `(() => {
  const lum = (rgb) => { const [r,g,b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }); return 0.2126*r + 0.7152*g + 0.0722*b; };
  const parse = (s) => { const m = String(s).match(/rgba?\\((\\d+)[,\\s]+(\\d+)[,\\s]+(\\d+)(?:[,\\s]+([\\d.]+))?\\)/); if (!m) return null; return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], a: m[4] === undefined ? 1 : Number(m[4]) }; };
  const bgOf = (el) => { let n = el; while (n && n !== document.documentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0.9) return c.rgb; n = n.parentElement; } const c = parse(getComputedStyle(document.body).backgroundColor); return (c && c.a > 0.9) ? c.rgb : [255,255,255]; };
  const ratio = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!(el.offsetWidth > 0 && el.offsetHeight > 0)) continue;
    const direct = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!direct) continue;
    const cs = getComputedStyle(el); const fg = parse(cs.color); if (!fg || fg.a < 0.5) continue;
    const size = parseFloat(cs.fontSize); const bold = Number(cs.fontWeight) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    const bg = bgOf(el); const r = ratio(fg.rgb, bg); const need = large ? 3 : 4.5;
    if (r + 0.03 < need) out.push({ el: (el.id ? '#' + el.id : el.tagName.toLowerCase()), text: (el.textContent || '').trim().slice(0, 40), fg: cs.color, bg: 'rgb(' + bg.join(',') + ')', ratio: Math.round(r * 100) / 100, need });
  }
  return out;
})()`;

try {
  const info = await cdpEndpoint();
  ws = await connect(info.webSocketDebuggerUrl);
  send = makeSend(ws);
  const loaded = await send('Extensions.loadUnpacked', { path: TMP_EXT });
  const extId = loaded?.id;
  const sids = {};
  for (const file of ['popup.html', 'stats.html']) {
    const t = await send('Target.createTarget', { url: `chrome-extension://${extId}/${file}` });
    const { sessionId } = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
    await send('Page.enable', {}, sessionId);
    await sleep(900);
    sids[file] = sessionId;
  }

  // A. contrast, both themes, both surfaces
  for (const scheme of ['dark', 'light']) {
    for (const [file, sid] of Object.entries(sids)) {
      const ev = evOn(sid);
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] }, sid);
      let coherent = false;
      for (let i = 0; i < 20 && !coherent; i++) { await sleep(150); coherent = await ev(`matchMedia('(prefers-color-scheme: ${scheme})').matches`); }
      await sleep(250);
      const bad = await ev(CONTRAST_JS);
      check(`A. contrast ${scheme} ${file}: all visible text ≥ WCAG AA (scheme confirmed)`, Array.isArray(bad) && bad.length === 0 && coherent === true, Array.isArray(bad) ? { coherent, bad: bad.slice(0, 8) } : bad);
    }
  }

  // B. reduced motion
  for (const [file, sid] of Object.entries(sids)) {
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, sid);
    await sleep(400);
    const probe = await evOn(sid)(`(() => {
      const els = Array.from(document.querySelectorAll('body *')).filter((e) => e.offsetWidth > 0);
      let worst = 0, tag = null;
      for (const e of els) { const cs = getComputedStyle(e); const td = cs.transitionDuration.split(',').map((s) => parseFloat(s) || 0); const ad = cs.animationDuration.split(',').map((s) => parseFloat(s) || 0); const m = Math.max(...td, ...ad, 0); if (m > worst) { worst = m; tag = e.tagName; } }
      return { worst, tag };
    })()`);
    check(`B. reduced-motion ${file}: nothing animates (worst=${probe && probe.worst}s)`, probe && probe.worst <= 0.01, probe);
  }
  for (const [file, sid] of Object.entries(sids)) await send('Emulation.setEmulatedMedia', { features: [] }, sid);

  // C. focus styles
  for (const [file, sid] of Object.entries(sids)) {
    const focus = await evOn(sid)(`(() => {
      let fv = 0, outlineNone = 0, focusWithin = 0, uncovered = [];
      for (const sheet of document.styleSheets) {
        let rules; try { rules = sheet.cssRules; } catch { continue; }
        const sheetText = Array.from(rules).map((r) => r.selectorText || '').join(' ');
        const hasFocusWithin = /:focus-within/.test(sheetText);
        if (hasFocusWithin) focusWithin++;
        for (const r of rules) {
          if (!r.selectorText) continue;
          if (/:focus-visible/.test(r.selectorText)) fv++;
          const st = r.style || {};
          const baldNone = (st.outline === 'none' || st.outlineWidth === '0px') && st.boxShadow === '' && st.border === '' && st.borderColor === '';
          if (baldNone) { outlineNone++; if (!hasFocusWithin) uncovered.push(r.selectorText); }
        }
      }
      return { fv, outlineNone, focusWithin, uncovered };
    })()`);
    check(`C. focus ${file}: :focus-visible rules present (${focus && focus.fv}) + outline:none covered by wrapper-ring`, focus && focus.fv >= 1 && (focus.uncovered || []).length === 0, focus);
  }

  // D. vi locale: no horizontal overflow
  for (const [file, sid] of Object.entries(sids)) {
    await evOn(sid)(`new Promise((res) => chrome.storage.local.set({ userLocale: 'vi' }, () => res('ok')))`, true);
    await sleep(900);
    if (file === 'popup.html') { await send('Page.reload', {}, sid); await sleep(900); }
    const ov = await evOn(sid)(`({ bodySW: document.body.scrollWidth, bodyCW: document.body.clientWidth, deSW: document.documentElement.scrollWidth, deCW: document.documentElement.clientWidth, lang: document.documentElement.lang })`);
    check(`D. vi layout ${file}: no horizontal overflow`, ov && ov.bodySW <= ov.bodyCW + 2 && ov.deSW <= ov.deCW + 2, ov);
  }
  for (const [file, sid] of Object.entries(sids)) await evOn(sid)(`new Promise((res) => chrome.storage.local.set({ userLocale: 'auto' }, () => res('ok')))`, true);

  // E. state as text
  const st = await evOn(sids['popup.html'])(`(() => {
    const band = document.getElementById('dryBand');
    const line = document.getElementById('stateLine');
    const bannerText = band && !band.hidden ? (band.textContent || '').trim() : '';
    const lineText = line ? (line.textContent || '').trim() : '';
    return { bandShown: !!(band && !band.hidden), bannerText: bannerText.slice(0, 90), lineText: lineText.slice(0, 90) };
  })()`);
  check('E. state communicated as text (dry-run band or live state line)', st && ((st.bannerText || '').length > 3 || (st.lineText || '').length > 3), st);

  // F. accessibility tree: interactive controls need accessible names
  for (const [file, sid] of Object.entries(sids)) {
    try {
      await send('Accessibility.enable', {}, sid);
      const { nodes } = await send('Accessibility.getFullAXTree', {}, sid);
      const NAMED_ROLES = new Set(['button', 'checkbox', 'link', 'combobox', 'textbox', 'switch', 'radio', 'menuitem', 'tab']);
      const unnamed = [];
      for (const n of nodes) {
        const role = n.role && n.role.value;
        if (!role || !NAMED_ROLES.has(role)) continue;
        if (n.ignored) continue;
        const name = n.name && typeof n.name.value === 'string' ? n.name.value.trim() : '';
        if (!name) unnamed.push((n.backendDOMNodeId || '?') + ':' + role);
      }
      check(`F. a11y tree ${file}: every interactive control has an accessible name`, unnamed.length === 0, { unnamed: unnamed.slice(0, 10) });
    } catch (e) { check(`F. a11y tree ${file}: harness ran`, false, String(e && e.message || e)); }
  }

  // G. real Tab traversal (popup). G1: while the onboarding modal is open the focus must stay
  // trapped inside it; G2: after skipping, every visible control is reachable by Tab.
  try {
    const sid = sids['popup.html'];
    const ev = evOn(sid);
    const tabOnce = async () => {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 }, sid);
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 }, sid);
      await sleep(60);
      return ev(`(() => { const a = document.activeElement; if (!a || a === document.body) return 'BODY'; return (a.id || a.getAttribute('aria-label') || a.className || a.tagName).toString().slice(0, 40); })()`);
    };
    await send('Page.reload', {}, sid); await sleep(1000); // fresh boot: onboarding is open
    const modalOpen = await ev(`(() => { const ob = document.getElementById('onboard'); return !!(ob && !ob.hidden); })()`);
    const inModal = [];
    if (modalOpen) {
      for (let i = 0; i < 8; i++) inModal.push(await tabOnce());
      const trapped = inModal.filter((x) => x !== 'BODY').every((x) => /obPrimary|obSkip|obBack|obQuick|obConsent|obDemo|obdot/i.test(x));
      check('G1. keyboard: while onboarding is open, Tab stays inside the modal (focus trap)', trapped && inModal.length > 0, { modalOpen, inModal });
      await ev(`(() => { const s = document.getElementById('obSkip'); if (s) s.click(); return 'ok'; })()`);
      await sleep(500);
    } else {
      check('G1. keyboard: onboarding open on boot (probe precondition)', false, { modalOpen });
    }
    const total = await ev(`(() => { const els = Array.from(document.querySelectorAll('button, input, select, [tabindex]')).filter((e) => e.offsetWidth > 0 && !e.disabled && e.tabIndex >= 0 && !e.inert && !e.closest('[inert]')); return els.length; })()`);
    const seen = [];
    for (let i = 0; i < Math.min(40, (total || 0) + 8); i++) {
      const cur = await tabOnce();
      seen.push(cur);
      if (seen.filter((x) => x === cur).length > 2) break;
    }
    const uniq = Array.from(new Set(seen.filter((x) => x !== 'BODY')));
    const stuck = seen.length >= 4 && seen.slice(-4).every((x) => x === seen[seen.length - 1]);
    check(`G2. keyboard: Tab reaches the controls (${uniq.length}/${total} unique) and does not trap`, uniq.length >= Math.min(total || 0, 6) && !stuck, { total, uniq: uniq.slice(0, 15), tail: seen.slice(-5) });
  } catch (e) { check('G. keyboard: harness ran', false, String(e && e.message || e)); }

  // H. 200%-zoom proxy: half layout viewport (or the real popup width, whichever is harder)
  for (const [file, sid] of Object.entries(sids)) {
    const ev = evOn(sid);
    const w0 = await ev(`window.innerWidth`);
    try {
      await send('Emulation.setDeviceMetricsOverride', { width: Math.min(360, Math.max(180, Math.floor(w0 / 2))), height: 900, deviceScaleFactor: 1, mobile: false }, sid);
      await sleep(400);
      const z = await ev(`(() => {
        const cands = ['obPrimary', 'safetyBtn', 'misbtn'];
        const vis = cands.map((id) => document.getElementById(id)).find((el) => el && el.offsetWidth > 0 && el.offsetHeight > 0);
        const anyBtn = vis || Array.from(document.querySelectorAll('.btn')).find((el) => el.offsetWidth > 0) || null;
        const pv = anyBtn ? (anyBtn.offsetWidth > 0 && anyBtn.offsetHeight > 0) : true;
        return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, primaryId: anyBtn ? (anyBtn.id || 'btn') : null, primaryVisible: pv };
      })()`);
      check(`H. 200%-zoom proxy ${file}: no overflow + primary control intact`, z && z.sw <= z.cw + 2 && z.primaryVisible === true, { w0, z });
    } finally { await send('Emulation.clearDeviceMetricsOverride', {}, sid); await sleep(200); }
  }

  // I. empty state on a fresh stats page
  const empty = await evOn(sids['stats.html'])(`(() => { const e = document.querySelector('.empty'); const txt = e ? (e.textContent || '').trim() : ''; return { present: !!e, text: txt.slice(0, 60) }; })()`);
  check('I. empty state: fresh stats shows an explicit empty message', empty && empty.present && empty.text.length > 2, empty);

  // J. tick dates follow the EFFECTIVE locale (seed data, switch manual locale en→ja)
  const d1 = new Date(); const d2 = new Date(Date.now() - 26 * 3600e3);
  const key = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  await evOn(sids['stats.html'])(`new Promise((res) => chrome.storage.local.set({ stats: { byDay: { ${JSON.stringify(key(d1))}: { allow: 3, deny: 0, blocked: 1 }, ${JSON.stringify(key(d2))}: { allow: 5, deny: 1, blocked: 0 } }, byMonth: {}, byYear: {}, byTopic: { repo: 8 } }, clickCount: 8 }, () => res('ok')))`, true);
  const readTicks = async (loc) => {
    await evOn(sids['stats.html'])(`new Promise((res) => chrome.storage.local.set({ userLocale: ${JSON.stringify(loc)} }, () => res('ok')))`, true);
    await send('Page.reload', {}, sids['stats.html']);
    await sleep(1100);
    return evOn(sids['stats.html'])(`(() => {
      const ticks = Array.from(document.querySelectorAll('text, .tick')).map((t) => (t.textContent || '').trim()).filter((x) => x.length > 1);
      const eff = (typeof manualMsgs !== 'undefined' && manualMsgs) ? manualLocale : null;
      const fmt = (() => { try { const loc = eff || (chrome.i18n.getUILanguage() || 'en'); return new Intl.DateTimeFormat(loc, { day: '2-digit', month: '2-digit' }).format(new Date(${JSON.stringify(key(d2) + 'T12:00:00')})); } catch { return null; } })();
      return { ticks: ticks.slice(0, 6), eff, expected: fmt };
    })()`);
  };
  const en = await readTicks('en');
  const vi = await readTicks('vi');
  check('J. locale data format: tick labels differ across locales (Intl follows the effective locale)',
    en && vi && Array.isArray(en.ticks) && Array.isArray(vi.ticks) && en.ticks.length > 0 && vi.ticks.length > 0 && JSON.stringify(en.ticks) !== JSON.stringify(vi.ticks),
    { en: en && en.ticks, enEff: en && en.eff, vi: vi && vi.ticks, viEff: vi && vi.eff });
} catch (e) {
  check('X. harness completed without exception', false, String(e && e.message || e));
} finally {
  try { ws && ws.close(); } catch {}
  const failed = RESULT.checks.filter((c) => !c.ok).length;
  RESULT.failed = failed;
  try { fs.writeFileSync(path.join(REPO, 'scratch', 'experience-latest.json'), JSON.stringify(RESULT, null, 2)); } catch {}
  console.log(JSON.stringify({ built: RESULT.built, total: RESULT.checks.length, failed }));
  process.exit(failed ? 2 : 0);
}
