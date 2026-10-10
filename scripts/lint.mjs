// Zero-dependency lint gate for the extension package (current Chrome-extension
// best-practice checks; run before every build/submit):
//   1. syntax    — node --check every .js under extension/
//   2. JSON      — parse manifest + every locale + every .json under extension/
//   3. i18n      — all locales carry an IDENTICAL key set (en is the reference)
//   4. security  — no remote code / network primitives anywhere in extension/
//                  (eval, new Function, fetch, XMLHttpRequest, WebSocket, importScripts,
//                  remote <script src>); local-only dialogs (alert) restricted to the
//                  popup/stats pages, never content/background
//   5. manifest  — minimal permissions allowlist, __MSG_ indirection intact, host set
//                  pinned to muse.ai only
// Exit 1 on any finding; prints a compact summary. Usage: node scripts/lint.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT = path.join(ROOT, 'extension');
const findings = [];
let checked = 0;

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(EXT);
const jsFiles = files.filter((f) => f.endsWith('.js'));
const jsonFiles = files.filter((f) => f.endsWith('.json'));

// ---------------------------------------------------------------------------------------
// fetch-FAMILY zero-network check (F-V19-2) — shared by the main scan and `--self-test`.
// The extension may reach a same-package asset only through `chrome.runtime.getURL(...)`.
// A fetch-family reference is allowed ONLY as the approved alias binding
// `<g>.fetch.bind(<g>)` (g = globalThis|window|self|global), and EVERY call of that alias
// must pass a `chrome.runtime.getURL(...)` argument. Anything else — a bare `fetch(...)`,
// any other `.fetch` reference, or an alias call with a different argument — is flagged, so
// a future edit cannot re-point the alias at a remote URL while the gate stays green.
const FETCH_BIND = /(?:globalThis|window|self|global)\s*\.\s*fetch\s*\.\s*bind\s*\(\s*(?:globalThis|window|self|global)\s*\)/g;
const ALIAS_DEF = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:globalThis|window|self|global)\s*\.\s*fetch\s*\.\s*bind\s*\(\s*(?:globalThis|window|self|global)\s*\)/g;
const GETURL_RE = /chrome\.runtime\.getURL\s*\(/;
function callArgs(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return src.slice(openIdx + 1, i); }
  }
  return src.slice(openIdx + 1);
}
function fetchFamilyFindings(rel, src) {
  const out = [];
  const aliases = [];
  let m;
  ALIAS_DEF.lastIndex = 0;
  while ((m = ALIAS_DEF.exec(src))) aliases.push(m[1]);
  const masked = src.replace(FETCH_BIND, (s) => ' '.repeat(s.length));
  const dotFetch = /(?:^|[^\w$])\.\s*fetch\b/g;
  while ((m = dotFetch.exec(masked))) out.push(`SEC ${rel}: fetch-family reference ${JSON.stringify(m[0].trim())} outside the approved chrome.runtime.getURL binding`);
  const bareFetch = /(?:^|[^\w$.])fetch\s*\(/g;
  while ((m = bareFetch.exec(masked))) out.push(`SEC ${rel}: bare fetch( call — remote primitive outside the approved alias`);
  for (const name of aliases) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const callRe = new RegExp('(?:^|[^\\w$.])' + esc + '\\s*\\(', 'g');
    let c;
    while ((c = callRe.exec(src))) {
      const openIdx = src.indexOf('(', c.index);
      if (!GETURL_RE.test(callArgs(src, openIdx))) out.push(`SEC ${rel}: ${name}(...) is not passed a chrome.runtime.getURL(...) argument — aliased fetch without a same-package URL`);
    }
  }
  return out;
}
// `--self-test`: prove the fetch-family rule on the shipped popup.js plus two mutations
// (a raw remote fetch, and the alias called with a remote URL). Exits non-zero on any miss.
if (process.argv.includes('--self-test')) {
  const shipped = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  const cases = [
    { name: 'shipped popup.js (bound alias + chrome.runtime.getURL) => expect NO finding', src: shipped, want: 0 },
    { name: "raw fetch('https://evil.example') => expect a finding", src: shipped + "\nfetch('https://evil.example');\n", want: 1 },
    { name: "readAsset('https://evil.example') => expect a finding", src: shipped.replace(/readAsset\(chrome\.runtime\.getURL\([^)]*\)\)/, "readAsset('https://evil.example')"), want: 1 },
  ];
  let bad = 0;
  for (const c of cases) {
    const found = fetchFamilyFindings('extension/popup.js', c.src);
    const ok = c.want === 0 ? found.length === 0 : found.length >= 1;
    if (!ok) bad++;
    console.log((ok ? 'PASS  ' : 'FAIL  ') + c.name + (found.length ? '\n        ' + found.join('\n        ') : ''));
  }
  console.log('lint --self-test: ' + (bad ? bad + ' of ' + cases.length + ' case(s) FAILED' : 'all ' + cases.length + ' cases PASS'));
  process.exit(bad ? 1 : 0);
}

// 1. syntax
for (const f of jsFiles) {
  checked++;
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    findings.push(`SYNTAX ${path.relative(ROOT, f)}: ${String(e.stderr || e.message).split('\n')[0]}`);
  }
}

// 2. JSON
for (const f of jsonFiles) {
  checked++;
  try {
    JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    findings.push(`JSON ${path.relative(ROOT, f)}: ${e.message}`);
  }
}

// 3. i18n parity
try {
  const locDir = path.join(EXT, '_locales');
  const locales = fs.readdirSync(locDir).filter((d) => fs.statSync(path.join(locDir, d)).isDirectory());
  const keySets = {};
  for (const loc of locales) {
    const p = path.join(locDir, loc, 'messages.json');
    if (!fs.existsSync(p)) { findings.push(`I18N missing ${loc}/messages.json`); continue; }
    keySets[loc] = new Set(Object.keys(JSON.parse(fs.readFileSync(p, 'utf8'))));
    checked++;
  }
  const ref = keySets['en'];
  if (!ref) findings.push('I18N no en reference locale');
  else {
    for (const [loc, ks] of Object.entries(keySets)) {
      if (loc === 'en' || !ks) continue;
      for (const k of ref) if (!ks.has(k)) findings.push(`I18N ${loc}: missing key "${k}"`);
      for (const k of ks) if (!ref.has(k)) findings.push(`I18N ${loc}: extra key "${k}"`);
    }
  }
} catch (e) {
  findings.push(`I18N scan failed: ${e.message}`);
}

// 4. security — remote code / network primitives
const SRC_EXTS = ['.js', '.html'];
const REMOTE_CODE = [/\beval\s*\(/, /new\s+Function\s*\(/, /\bfetch\s*\(/, /XMLHttpRequest/, /new\s+WebSocket\s*\(/, /\bimportScripts\s*\(/];
for (const f of files.filter((f) => SRC_EXTS.some((x) => f.endsWith(x)))) {
  checked++;
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  const src = fs.readFileSync(f, 'utf8');
  for (const re of REMOTE_CODE) {
    if (re.test(src)) findings.push(`SEC ${rel}: forbidden primitive ${re}`);
  }
  for (const msg of fetchFamilyFindings(rel, src)) findings.push(msg);
  if (f.endsWith('.html') && /src\s*=\s*["']https?:/i.test(src)) {
    findings.push(`SEC ${rel}: remote <script src>`);
  }
  if (/\balert\s*\(/.test(src) && !/\/(popup|stats)\.js$/.test(rel)) {
    findings.push(`SEC ${rel}: alert() outside popup/stats`);
  }
}

// 5. manifest hygiene
try {
  const man = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  checked++;
  if (man.manifest_version !== 3) findings.push('MANIFEST not MV3');
  const ALLOWED = new Set(['storage', 'alarms', 'notifications']);
  for (const p of man.permissions || []) if (!ALLOWED.has(p)) findings.push(`MANIFEST unexpected permission "${p}"`);
  if (String(man.name || '') !== '__MSG_extName__') findings.push('MANIFEST name must use __MSG_extName__');
  if (!man.default_locale) findings.push('MANIFEST missing default_locale');
  const hosts = (man.host_permissions || []).join(', ');
  if (!/^https:\/\/muse\.ai\/\*, https:\/\/\*\.muse\.ai\/\*$/i.test(hosts)) {
    findings.push(`MANIFEST host_permissions unexpected: ${hosts}`);
  }
  if (!man.content_security_policy || !man.content_security_policy.extension_pages) {
    findings.push('MANIFEST missing explicit extension_pages CSP');
  }
} catch (e) {
  findings.push(`MANIFEST scan failed: ${e.message}`);
}

// summary
if (findings.length) {
  console.error(`lint: ${findings.length} finding(s)\n` + findings.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log(`lint OK — ${checked} checks across ${files.length} files (syntax, JSON, i18n parity, no remote code, minimal permissions)`);
