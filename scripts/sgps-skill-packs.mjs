#!/usr/bin/env node
// sgps-skill-packs.mjs — install pinned external agent skills (ASK 1.0) into a skills folder.
// Standard: sgps-core standards/portfolio/AGENT_SKILL_PACKS_STANDARD.md (registry ASK-1).
//
// Each pack is fetched at one exact commit, the commit is verified, and only the allowlisted
// skill folders are copied, minus the excluded paths (paid image generation, hook installers,
// vendor API CLIs, outbound-contact skills). Upstream code is never executed: no npm install,
// no postinstall, no upstream installer. Nothing is written inside the repository unless --dir
// points there (default is the user-level skills folder of the session, outside every repo).
//
//   list                                       → packs, pins, skills
//   install <pack|all> [--dir D] [--force]     → copies skills to D/<skill>/ with SGPS_PIN.json
//   check [--dir D]                            → exit 0 when every installed skill matches its pin, 2 otherwise
//   --self-test                                → offline cases with a local fixture repo, exit 0 on pass
//
// Requires git on PATH. Network: one `git fetch --depth 1 <repo> <sha>` per pack, nothing else.

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, symlinkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKS = {
  humanizer: {
    branch: 'GTM (copy polish)',
    repo: 'https://github.com/blader/humanizer',
    sha: 'b48c832f0f809c1b5658edbb838c2521b72f2413',
    version: 'v4.0.0',
    licence: 'MIT',
    skills: [{ name: 'humanizer', from: '.', include: ['SKILL.md', 'LICENSE', 'README.md'] }],
  },
  marketingskills: {
    branch: 'GTM',
    repo: 'https://github.com/coreyhaines31/marketingskills',
    sha: '1f837447b20bb6f0e72d87b80ece1c221c362c7d',
    version: 'v2.14.12',
    licence: 'MIT',
    // Allowlist. Not installed: cold-email, prospecting, sms, influencer-marketing (outbound contact),
    // ads, ad-creative, image, video (ad spend or paid generation APIs), attribution, conversion-tracking
    // (tracking pixels, privacy gate), directory-submissions, reverse-engineer-marketing (external
    // accounts, scraping keys), marketing-council (simulated quotes of real people), revops,
    // sales-enablement (no CRM in the portfolio).
    skills: [
      'ab-testing', 'ai-seo', 'analytics', 'aso', 'churn-prevention', 'co-marketing', 'community-marketing',
      'competitor-profiling', 'competitors', 'content-strategy', 'copy-editing', 'copywriting', 'cro',
      'customer-research', 'emails', 'events', 'free-tools', 'launch', 'lead-magnets', 'link-building',
      'marketing-ideas', 'marketing-loops', 'marketing-plan', 'marketing-psychology', 'offers', 'onboarding',
      'paywalls', 'popups', 'pricing', 'product-marketing', 'programmatic-seo', 'public-relations',
      'referrals', 'schema', 'seo-audit', 'signup', 'site-architecture', 'social',
    ].map((n) => ({ name: n, from: `skills/${n}`, exclude: ['evals', 'scripts', 'assets'], licenceFile: 'LICENSE' })),
  },
  astryx: {
    branch: 'Design',
    repo: 'https://github.com/meta/astryx',
    sha: 'c6ca304086b60102563a83d1a27df49a260b3c69',
    version: 'v0.7.14',
    licence: 'MIT',
    skills: [{ name: 'astryx', from: 'plugins/astryx/skills/astryx', licenceFile: 'LICENSE' }],
  },
  hallmark: {
    branch: 'Design',
    repo: 'https://github.com/Nutlope/hallmark',
    sha: '04977e15f3dfd6ee4b74c887dac3eb52665d6c92',
    version: '2.0.0',
    licence: 'MIT',
    // imagegen.mjs calls a paid image API; install*.mjs and lint-hook.mjs write agent settings hooks.
    skills: [{
      name: 'hallmark',
      from: 'skills/hallmark',
      exclude: ['scripts/imagegen.mjs', 'scripts/install.mjs', 'scripts/install-hook.mjs', 'scripts/lint-hook.mjs', 'scripts/fixtures/imagegen'],
    }],
  },
  'security-audit': {
    branch: 'Security',
    repo: 'https://github.com/cloudflare/security-audit-skill',
    sha: 'c1c8a8c1471069fb0e188eeaff69b8e8db6564a8',
    version: 'main@2026-09-14 (no release tag)',
    licence: 'MIT',
    skills: [{ name: 'security-audit', from: 'skills/security-audit', licenceFile: 'LICENSE' }],
  },
};

const PIN_FILE = 'SGPS_PIN.json';
const SHA = /^[0-9a-f]{40}$/;

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_LFS_SKIP_SMUDGE: '1' } }).trim();
}

function inside(root, p) {
  const r = relative(root, p);
  return r === '' || (!r.startsWith('..') && !r.startsWith(sep) && !/^[a-zA-Z]:/.test(r));
}

export function fetchPinned(pack, work) {
  if (!SHA.test(pack.sha)) throw new Error(`pin is not a full commit sha: ${pack.sha}`);
  git(['init', '-q', work]);
  git(['fetch', '-q', '--depth', '1', pack.repo, pack.sha], work);
  git(['-c', 'advice.detachedHead=false', 'checkout', '-q', 'FETCH_HEAD'], work);
  const head = git(['rev-parse', 'HEAD'], work);
  if (head !== pack.sha) throw new Error(`fetched ${head}, expected ${pack.sha}`);
  return head;
}

function copySkill(src, dst, skill) {
  const ex = (skill.exclude || []).map((e) => resolve(src, e));
  const keep = (p) => {
    if (!inside(src, p)) return false;
    if (ex.some((e) => p === e || inside(e, p))) return false;
    if (p.split(sep).includes('.git')) return false;
    // An upstream symlink could point a skill file at a local secret: refuse the whole pack (audit run 2).
    if (lstatSync(p).isSymbolicLink()) throw new Error(`${skill.name}: upstream symlink refused: ${relative(src, p)}`);
    return true;
  };
  if (skill.include) {
    mkdirSync(dst, { recursive: true });
    for (const f of skill.include) {
      const s = resolve(src, f);
      if (!inside(src, s) || !existsSync(s)) throw new Error(`missing include ${f}`);
      cpSync(s, join(dst, f), { recursive: true, dereference: false, filter: keep });
    }
  } else {
    cpSync(src, dst, { recursive: true, dereference: false, filter: keep });
  }
  if (!existsSync(join(dst, 'SKILL.md'))) throw new Error(`${skill.name}: no SKILL.md at ${skill.from}`);
}

export function install(name, pack, dir, { force = false } = {}) {
  const work = mkdtempSync(join(tmpdir(), `sgps-skill-${name}-`));
  const out = [];
  try {
    const head = fetchPinned(pack, work);
    for (const skill of pack.skills) {
      const src = resolve(work, skill.from);
      if (!inside(work, src) || !existsSync(src)) throw new Error(`${name}: missing ${skill.from} at ${head}`);
      const dst = join(dir, skill.name);
      if (existsSync(dst)) {
        const pin = readPin(dst);
        if (pin && pin.sha === pack.sha && !force) { out.push(`KEEP ${skill.name} ${pack.sha.slice(0, 12)}`); continue; }
        if (!pin && !force) throw new Error(`${dst} exists and was not installed by this tool; pass --force to replace it`);
        rmSync(dst, { recursive: true, force: true });
      }
      try { copySkill(src, dst, skill); } catch (e) { rmSync(dst, { recursive: true, force: true }); throw e; }
      if (skill.licenceFile && existsSync(join(work, skill.licenceFile)) && !existsSync(join(dst, 'LICENSE'))) {
        cpSync(join(work, skill.licenceFile), join(dst, 'LICENSE'));
      }
      writeFileSync(join(dst, PIN_FILE), JSON.stringify({
        schema: 'sgps.skill-pin/1', pack: name, skill: skill.name, repo: pack.repo, sha: pack.sha,
        version: pack.version, licence: pack.licence, from: skill.from, excluded: skill.exclude || [],
        standard: 'sgps-core standards/portfolio/AGENT_SKILL_PACKS_STANDARD.md',
      }, null, 1) + '\n');
      out.push(`INSTALL ${skill.name} ${pack.sha.slice(0, 12)}`);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  return out;
}

function readPin(d) {
  try { return JSON.parse(readFileSync(join(d, PIN_FILE), 'utf8')); } catch { return null; }
}

export function check(dir, packs = PACKS) {
  const problems = [];
  let seen = 0;
  if (!existsSync(dir)) return { seen, problems };
  for (const e of readdirSync(dir)) {
    const d = join(dir, e);
    if (!statSync(d).isDirectory()) continue;
    const pin = readPin(d);
    if (!pin) continue;
    seen++;
    const pack = packs[pin.pack];
    if (!pack) { problems.push(`${e}: unknown pack ${pin.pack}`); continue; }
    if (pin.sha !== pack.sha) problems.push(`${e}: installed ${String(pin.sha).slice(0, 12)}, pinned ${pack.sha.slice(0, 12)}`);
    const skill = pack.skills.find((s) => s.name === e);
    if (!skill) { problems.push(`${e}: not in the ${pin.pack} allowlist`); continue; }
    for (const x of skill.exclude || []) if (existsSync(join(d, x))) problems.push(`${e}: excluded path present: ${x}`);
  }
  return { seen, problems };
}

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function defaultDir() {
  return process.env.SGPS_SKILLS_DIR || join(homedir(), '.claude', 'skills');
}

function selfTest() {
  let n = 0;
  const ok = (c, m) => { if (!c) { console.error(`FAIL ${m}`); process.exit(1); } n++; };
  const root = mkdtempSync(join(tmpdir(), 'sgps-skill-selftest-'));
  try {
    // fixture upstream with an allowed skill, an excluded script and a stray skill
    const up = join(root, 'up');
    mkdirSync(join(up, 'skills/good/scripts'), { recursive: true });
    mkdirSync(join(up, 'skills/good/evals'), { recursive: true });
    mkdirSync(join(up, 'skills/bad'), { recursive: true });
    writeFileSync(join(up, 'skills/good/SKILL.md'), '---\nname: good\n---\nok\n');
    writeFileSync(join(up, 'skills/good/scripts/paid.mjs'), 'fetch("https://paid")\n');
    writeFileSync(join(up, 'skills/good/evals/e.json'), '{}\n');
    writeFileSync(join(up, 'skills/bad/SKILL.md'), '---\nname: bad\n---\n');
    writeFileSync(join(up, 'LICENSE'), 'MIT\n');
    git(['init', '-q', up]);
    git(['-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A'], up);
    git(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'v1'], up);
    git(['config', 'uploadpack.allowReachableSHA1InWant', 'true'], up);
    git(['config', 'uploadpack.allowAnySHA1InWant', 'true'], up);
    const sha1 = git(['rev-parse', 'HEAD'], up);
    writeFileSync(join(up, 'skills/good/SKILL.md'), '---\nname: good\n---\nv2 changed upstream\n');
    git(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-am', 'v2'], up);
    const url = `file://${up}`;
    const pack = { repo: url, sha: sha1, version: 't', licence: 'MIT', skills: [{ name: 'good', from: 'skills/good', exclude: ['scripts', 'evals'], licenceFile: 'LICENSE' }] };
    const packs = { fx: pack };
    const dir = join(root, 'skills');

    const r1 = install('fx', pack, dir);
    ok(r1[0].startsWith('INSTALL good'), 'installs allowlisted skill');
    ok(readFileSync(join(dir, 'good/SKILL.md'), 'utf8').includes('ok') && !readFileSync(join(dir, 'good/SKILL.md'), 'utf8').includes('v2'), 'installs the pinned commit, not the newer head');
    ok(!existsSync(join(dir, 'good/scripts')), 'excluded scripts folder not copied');
    ok(!existsSync(join(dir, 'good/evals')), 'excluded evals folder not copied');
    ok(!existsSync(join(dir, 'bad')), 'skill outside the allowlist not copied');
    ok(existsSync(join(dir, 'good/LICENSE')), 'licence copied beside the skill');
    ok(readPin(join(dir, 'good')).sha === sha1, 'pin file records the sha');
    ok(check(dir, packs).problems.length === 0 && check(dir, packs).seen === 1, 'check passes on a clean install');
    ok(install('fx', pack, dir)[0].startsWith('KEEP'), 'second install keeps a matching pin');

    // mutation: tamper the pin or plant an excluded file → check fails
    writeFileSync(join(dir, 'good/scripts.tmp'), '');
    mkdirSync(join(dir, 'good/scripts'));
    ok(check(dir, packs).problems.some((p) => p.includes('excluded path present')), 'check flags an excluded path planted after install');
    rmSync(join(dir, 'good/scripts'), { recursive: true });
    const moved = { fx: { ...pack, sha: 'f'.repeat(40) } };
    ok(check(dir, moved).problems.some((p) => p.includes('pinned')), 'check flags a pin drift');
    ok(check(dir, {}).problems.some((p) => p.includes('unknown pack')), 'check flags an unknown pack');

    // refuse: wrong sha, short sha, foreign folder, path escape
    let threw = false;
    try { install('fx', { ...pack, sha: 'a'.repeat(40) }, join(root, 's2')); } catch { threw = true; }
    ok(threw, 'unknown commit fails closed');
    threw = false;
    try { install('fx', { ...pack, sha: sha1.slice(0, 12) }, join(root, 's3')); } catch { threw = true; }
    ok(threw, 'abbreviated sha refused');
    mkdirSync(join(root, 's4/good'), { recursive: true });
    threw = false;
    try { install('fx', pack, join(root, 's4')); } catch { threw = true; }
    ok(threw, 'refuses to overwrite a folder it did not install');
    threw = false;
    try { install('fx', { ...pack, skills: [{ name: 'esc', from: '../..' }] }, join(root, 's5')); } catch { threw = true; }
    ok(threw, 'source path escaping the checkout refused');

    // NEGATIVE: an upstream symlink in a pinned skill is refused and nothing lands
    const up2 = join(root, 'up2');
    mkdirSync(join(up2, 'skills/good'), { recursive: true });
    writeFileSync(join(up2, 'skills/good/SKILL.md'), '---\nname: good\n---\nok\n');
    symlinkSync(join(root, 'secret.txt'), join(up2, 'skills/good/ref.md'));
    writeFileSync(join(root, 'secret.txt'), 'secret\n');
    git(['init', '-q', up2]);
    git(['-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A'], up2);
    git(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'v1'], up2);
    const link = { ...pack, repo: `file://${up2}`, sha: git(['rev-parse', 'HEAD'], up2) };
    threw = false;
    try { install('fx', link, join(root, 's6')); } catch { threw = true; }
    ok(threw && !existsSync(join(root, 's6/good')), 'upstream symlink refused, nothing installed');

    // shipped pins are full shas and match the sgps-core registry when it is present
    for (const [k, p] of Object.entries(PACKS)) ok(SHA.test(p.sha) && p.skills.length > 0, `pack ${k} has a full sha and skills`);
    const reg = resolve(dirname(fileURLToPath(import.meta.url)), '../../../standards/portfolio/AGENT_SKILL_PACKS.json');
    if (existsSync(reg)) {
      const j = JSON.parse(readFileSync(reg, 'utf8'));
      for (const p of j.packs) {
        const s = PACKS[p.id];
        ok(s && s.sha === p.revision && s.licence === p.licence, `registry ${p.id} matches the script pin`);
        ok(JSON.stringify(s.skills.map((x) => x.name).sort()) === JSON.stringify([...p.skills_installed].sort()), `registry ${p.id} skill list matches`);
      }
      ok(j.packs.length === Object.keys(PACKS).length, 'registry and script list the same packs');
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  console.log(`sgps-skill-packs self-test: ${n} PASS`);
  process.exit(0);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes('--self-test')) selfTest();
  const [cmd, target] = process.argv.slice(2);
  const dir = resolve(arg('--dir', defaultDir()));
  if (cmd === 'list') {
    for (const [k, p] of Object.entries(PACKS)) console.log(`${k}\t${p.branch}\t${p.version}\t${p.sha.slice(0, 12)}\t${p.licence}\t${p.skills.length} skill(s)`);
  } else if (cmd === 'install' && target) {
    const names = target === 'all' ? Object.keys(PACKS) : target.split(',');
    for (const n of names) {
      if (!PACKS[n]) { console.error(`unknown pack ${n}; run list`); process.exit(1); }
      for (const line of install(n, PACKS[n], dir, { force: process.argv.includes('--force') })) console.log(line);
    }
    console.log(`skills folder: ${dir}`);
  } else if (cmd === 'check') {
    const { seen, problems } = check(dir);
    for (const p of problems) console.log(`DRIFT ${p}`);
    console.log(`${seen} pinned skill(s) in ${dir}, ${problems.length} problem(s)`);
    process.exit(problems.length ? 2 : 0);
  } else {
    console.error('usage: sgps-skill-packs.mjs list | install <pack|all> [--dir D] [--force] | check [--dir D] | --self-test');
    process.exit(1);
  }
}
