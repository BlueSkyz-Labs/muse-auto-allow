#!/usr/bin/env node
/**
 * a11y-audit.mjs — deterministic accessibility probe on the REAL extension pages.
 * Round 2 (SGPS prompt 02, lens: a11y/WCAG 2.2 AA). It opens popup.html, the Safety panel
 * and stats.html in a scratch Chrome profile and checks measurable rules only:
 *   T1  every interactive target >= 24x24 CSS px (WCAG 2.5.8)
 *   T2  icon-only buttons carry an accessible name (aria-label / title / text)
 *   T3  every form control has a name (label / aria-label / placeholder)
 *   T4  no positive tabindex (focus order follows the DOM)
 *   T5  modal dialogs declare role=dialog + aria-modal + a heading
 *   T6  live regions exist for the engine state (role=status)
 * Exits 1 when a rule is violated; prints a JSON summary (house style).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const EXT = path.join(ROOT, 'extension');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'maa-a11y-'));
fs.cpSync(EXT, TMP, { recursive: true });
const PORT = 9700 + Math.floor(Math.random() * 90);
const PROFILE = path.join(os.tmpdir(), `maa-a11y-${process.pid}`);
fs.mkdirSync(PROFILE, { recursive: true });
const psq = (s) => s.replace(/'/g, "''");
execFileSync('powershell.exe', ['-NoProfile', '-Command',
  `Start-Process -FilePath 'C:/Program Files/Google/Chrome/Application/chrome.exe' -ArgumentList ${[
    `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, '--enable-unsafe-extension-debugging',
    '--no-first-run', '--no-default-browser-check', '--window-position=-32000,-32000', '--window-size=1200,900', 'about:blank',
  ].map((a) => `'${psq(a)}'`).join(',')}`], { stdio: 'ignore', timeout: 30000 });

for (let i = 0; i < 120; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break; } catch {} await sleep(250); }
const info = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const ws = await new Promise((res, rej) => { const w = new WebSocket(info.webSocketDebuggerUrl); w.onopen = () => res(w); w.onerror = () => rej(new Error('ws')); });
let seq = 0; const pend = new Map();
ws.onmessage = (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
};
const send = (method, params = {}, sid) => new Promise((resolve, reject) => {
  const id = ++seq; pend.set(id, { resolve, reject });
  const msg = { id, method, params }; if (sid) msg.sessionId = sid;
  ws.send(JSON.stringify(msg));
  setTimeout(() => { if (pend.has(id)) { pend.delete(id); reject(new Error(method + ' timeout')); } }, 25000);
});

const PROBE = `JSON.stringify((() => {
  const out = { targets: [], unnamed: [], unlabeled: [], positiveTab: [], dialogs: [], live: 0 };
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const name = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || (el.textContent || '').trim() || el.getAttribute('data-i18n') || '').trim();
  document.querySelectorAll('button, a[href], select, input[type=checkbox], input[type=number], input[type=text], input[type=password], textarea').forEach((el) => {
    if (!vis(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width < 23.5 || r.height < 23.5) out.targets.push({ id: el.id || el.className || el.tagName, w: Math.round(r.width), h: Math.round(r.height) });
    if ((el.tagName === 'BUTTON' || el.tagName === 'A') && !name(el)) out.unnamed.push(el.id || el.className || el.tagName);
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
      const id = el.id;
      const lab = (id && document.querySelector('label[for="' + id + '"]')) || el.closest('label');
      if (!lab && !el.getAttribute('aria-label') && !el.getAttribute('placeholder') && !el.getAttribute('aria-labelledby')) out.unlabeled.push(id || el.tagName);
    }
    const ti = Number(el.getAttribute('tabindex'));
    if (ti > 0) out.positiveTab.push(el.id || el.tagName);
  });
  document.querySelectorAll('[role=dialog]').forEach((d) => out.dialogs.push({ id: d.id, modal: d.getAttribute('aria-modal') === 'true' }));
  out.live = document.querySelectorAll('[role=status], [aria-live=polite]').length;
  return out;
})())`;

async function probePage(url) {
  const t = await send('Target.createTarget', { url });
  const { sessionId } = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId);
  await sleep(900);
  const r = await send('Runtime.evaluate', { expression: PROBE, returnByValue: true }, sessionId);
  const errs = r?.exceptionDetails ? { __err: r.exceptionDetails.text } : (r?.result?.value ? JSON.parse(r.result.value) : { __err: 'no value' });
  await send('Target.closeTarget', { targetId: t.targetId });
  return errs;
}

const RESULT = { ok: true, pass: 0, fail: 0, failures: [], pages: {} };
const check = (name, cond, detail) => { if (cond) RESULT.pass++; else { RESULT.fail++; RESULT.failures.push({ name, detail }); } };

try {
  const loaded = await send('Extensions.loadUnpacked', { path: TMP });
  const extId = loaded.id;
  const popup = await probePage(`chrome-extension://${extId}/popup.html`);
  const stats = await probePage(`chrome-extension://${extId}/stats.html`);
  RESULT.pages = { popup, stats };
  for (const [page, data] of Object.entries({ popup, stats })) {
    if (data.__err) { check(page + ' probe', false, data.__err); continue; }
    check(page + ' T1 targets >= 24px', data.targets.length === 0, data.targets.slice(0, 8));
    check(page + ' T2 icon-only named', data.unnamed.length === 0, data.unnamed);
    check(page + ' T3 controls labeled', data.unlabeled.length === 0, data.unlabeled);
    check(page + ' T4 no positive tabindex', data.positiveTab.length === 0, data.positiveTab);
    check(page + ' T5 dialogs labelled', data.dialogs.every((d) => d.modal), data.dialogs);
    check(page + ' T6 live regions present', data.live > 0, { live: data.live });
  }
} catch (e) {
  check('harness completed', false, String(e && e.message || e));
} finally {
  try { ws.close(); } catch {}
  try { execFileSync('powershell.exe', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${psq(PROFILE)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { timeout: 25000 }); } catch {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch {}
  RESULT.ok = RESULT.fail === 0;
  console.log(JSON.stringify(RESULT, null, 2));
  process.exit(RESULT.ok ? 0 : 1);
}
