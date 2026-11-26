#!/usr/bin/env node
// PDV 1.0 runner (standards/testing/POST_DEPLOY_VERIFICATION_STANDARD.md). Copy into a project's scripts/ unchanged;
// everything project-specific lives in docs/operations/POST_DEPLOY_VERIFICATION.json (schema sgps.post-deploy/1).
//
//   node scripts/sgps-pdv-run.mjs --commit <sha 7-40 hex> [--record docs/operations/POST_DEPLOY_VERIFICATION.json]
//        [--out artifacts/pdv] [--base https://override] [--after-rollback] [--journey-wait-seconds 720]
//   node scripts/sgps-pdv-run.mjs self-test
//
// Read-only GETs. Layers: identity (the endpoint serves --commit, one commit on every read), L1 public pages x viewports
// with screenshots, L2 closed doors (anonymous must be refused), L3 the signed-in journey read model when the record
// names one (in_worker_synthetic). Writes <out>/report.json (sgps.pdv-report/1) and PNGs.
// Exit 0 = PASS or NOT_VERIFIED (only edge challenges or a journey that cannot run); exit 1 = FAIL (the caller rolls
// back, then reruns with --after-rollback: identity must no longer be --commit; L1 + L2 only).
// Access service token (method access_service_token): the CI injects PDV_ACCESS_CLIENT_ID / PDV_ACCESS_CLIENT_SECRET
// from its secret store. This script sends them only to the base origin and never prints them; the agent never reads them.
// Playwright is loaded from the project (npm i -D playwright); PDV_CHROMIUM_PATH points at a preinstalled Chromium.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ATTEMPTS = 2
const SPLIT_ROUNDS = 3
export const MIN_VISIBLE_TEXT = 40
const IGNORED_CONSOLE = [/static\.cloudflareinsights\.com/, /challenges\.cloudflare\.com/, /turnstile/i, /Failed to load resource/]

/** Drops query strings and fragments so no token or id from a URL lands in the report. */
export const redact = (text) => String(text).replace(/(https?:\/\/[^\s?#"']+)[?#][^\s"']*/g, '$1?…').slice(0, 200)

/** Commit from an identity response: a JSON field (dotted path), or `field=` / `field:` in HTML or text. */
export function extractCommit(body, field) {
  let value
  try {
    value = field.split('.').reduce((o, k) => (o == null ? o : o[k]), JSON.parse(body))
  } catch {
    const esc = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    value = new RegExp(`${esc}["'\\s]*[:=]\\s*["']?(?:sha-)?([0-9a-f]{7,40})`, 'i').exec(body)?.[1]
  }
  const m = /([0-9a-f]{7,40})/i.exec(String(value ?? ''))
  return m ? m[1].toLowerCase() : ''
}

/** Same commit when one is a prefix of the other (a short sha against a full one). */
export const sameCommit = (a, b) => Boolean(a && b) && (a.startsWith(b) || b.startsWith(a))

export function judgePage({ status, consoleErrors, overflowPx, badResponses = [], textLength }, ignored = []) {
  const problems = []
  if (status >= 400 || !status) problems.push(`HTTP ${status}`)
  if (typeof textLength === 'number' && textLength < MIN_VISIBLE_TEXT) problems.push(`blank page: ${textLength} visible characters`)
  if (badResponses.length) problems.push(`bad response: ${badResponses[0]}`)
  if (overflowPx === null) problems.push('layout not measurable')
  if (overflowPx > 1) problems.push(`horizontal scroll +${overflowPx}px`)
  const real = consoleErrors.filter((m) => ![...IGNORED_CONSOLE, ...ignored].some((r) => r.test(m)))
  if (real.length) problems.push(`console error: ${redact(real[0]).slice(0, 120)}`)
  return problems
}

/** L3 from a journey read model: only a run on the deployed commit is judged; one failure waits for the next run. */
export function judgeJourney(j, want) {
  if (!j || typeof j.verdict !== 'string') return { state: 'NOT_VERIFIED', why: 'journey result unreadable' }
  if (!sameCommit(String(j.commit ?? ''), want)) return { state: 'WAIT', why: `journey last ran on ${String(j.commit).slice(0, 12)}` }
  if (j.verdict === 'NOT_CONFIGURED' || j.verdict === 'NOT_DEMO') return { state: 'NOT_VERIFIED', why: `journey ${j.verdict}` }
  if (j.verdict === 'PASS') return { state: 'PASS', why: 'journey PASS' }
  const failed = (j.steps ?? []).filter((s) => !s.ok).map((s) => s.name)
  if (!(Number(j.consecutive_failures) >= 2)) return { state: 'WAIT', why: `journey failed once (${failed.join(', ') || 'unknown step'}), waiting for the next run` }
  return { state: 'FAIL', why: `journey FAIL twice in a row: ${failed.join(', ') || 'unknown step'}` }
}

/** Record → runner config. Throws on what the runner cannot do safely. */
export function loadConfig(rec, baseOverride) {
  if (rec?.schema !== 'sgps.post-deploy/1') throw new Error('record schema must be sgps.post-deploy/1')
  const base = new URL(baseOverride ?? rec.base_url)
  if (base.protocol !== 'https:') throw new Error('base must be https')
  const id = rec.identity ?? {}
  if (!id.endpoint || !id.commit_field) throw new Error('identity.endpoint and identity.commit_field are required')
  const pub = rec.public ?? {}
  const doors = (rec.closed_doors ?? []).map((d) => ({ path: d.path, expect: [d.expect].flat() }))
  const token = rec.signed_in?.method === 'access_service_token'
  return {
    base: base.origin, identity: { endpoint: id.endpoint, field: id.commit_field, tries: id.tries ?? 8, interval: (id.interval_seconds ?? 5) * 1000, samples: id.split_samples ?? 10 },
    pages: pub.pages ?? ['/'], viewports: pub.viewports ?? [], allowed401: pub.allowed_anonymous_401 ?? [],
    storage: pub.init_storage ?? {}, ignored: (pub.ignored_console ?? []).map((s) => new RegExp(s)),
    doors, journey: rec.signed_in?.read_model ?? null, token,
  }
}

function accessHeaders(cfg) {
  if (!cfg.token) return {}
  const id = process.env.PDV_ACCESS_CLIENT_ID
  const secret = process.env.PDV_ACCESS_CLIENT_SECRET
  if (!id || !secret) throw new Error('method access_service_token needs PDV_ACCESS_CLIENT_ID and PDV_ACCESS_CLIENT_SECRET from the CI secret store')
  return { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret }
}

async function readIdentity(cfg, headers) {
  const res = await fetch(cfg.base + cfg.identity.endpoint, { headers, signal: AbortSignal.timeout(15000), redirect: 'manual' })
  return res.ok ? extractCommit(await res.text(), cfg.identity.field) : ''
}

/* global document, window */
async function visit(ctx, cfg, path, shot) {
  const page = await ctx.newPage()
  const consoleErrors = []
  const badResponses = []
  let challenge = false
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => consoleErrors.push(String(e.message)))
  page.on('response', (r) => {
    if (r.headers()['cf-mitigated']) { challenge = true; return }
    const u = new URL(r.url())
    if (u.origin !== cfg.base) return
    const allowed = r.status() === 401 && cfg.allowed401.some((p) => u.pathname.startsWith(p))
    if (r.status() >= 500 || (r.status() >= 400 && !allowed)) badResponses.push(`${r.status()} ${u.pathname}`)
  })
  let status = 0
  try {
    const res = await page.goto(cfg.base + path, { waitUntil: 'load', timeout: 30000 })
    status = res?.status() ?? 0
    // A white screen answers 200: wait up to 10 s for real text. Never 'networkidle' (bot challenges keep polling).
    await page.waitForFunction((min) => (document.body?.innerText ?? '').trim().length >= min, MIN_VISIBLE_TEXT, { timeout: 10000 }).catch(() => undefined)
    await page.waitForTimeout(1000)
  } catch (e) { consoleErrors.push(`navigation: ${e.message}`) }
  const textLength = await page.evaluate(() => (document.body?.innerText ?? '').trim().length).catch(() => null)
  const overflowPx = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth).catch(() => null)
  if (shot && !challenge) await page.screenshot({ path: shot, fullPage: false }).catch(() => undefined)
  await page.close()
  return { status, consoleErrors, overflowPx, badResponses, challenge, textLength }
}

async function waitJourney(cfg, headers, want, seconds) {
  const deadline = Date.now() + seconds * 1000
  let last
  do {
    try {
      const res = await fetch(cfg.base + cfg.journey, { headers, signal: AbortSignal.timeout(15000) })
      last = res.ok ? judgeJourney(await res.json(), want) : { state: 'WAIT', why: `journey endpoint HTTP ${res.status}` }
    } catch { last = { state: 'WAIT', why: 'journey endpoint unreachable' } }
    if (last.state !== 'WAIT') return last
    if (Date.now() + 30000 > deadline) break
    await new Promise((r) => setTimeout(r, 30000))
  } while (Date.now() < deadline)
  return { state: 'NOT_VERIFIED', why: `${last.why}; no run on this commit within ${seconds} s` }
}

function parseArgs(argv) {
  const get = (n) => { const i = argv.indexOf(`--${n}`); return i > -1 ? argv[i + 1] : undefined }
  const commit = (get('commit') ?? '').toLowerCase()
  if (!/^[0-9a-f]{7,40}$/.test(commit)) throw new Error('--commit <sha (7-40 hex)> is required')
  const wait = Number(get('journey-wait-seconds') ?? 720)
  if (!Number.isInteger(wait) || wait < 0 || wait > 1200) throw new Error('--journey-wait-seconds must be 0..1200')
  return { commit, record: get('record') ?? 'docs/operations/POST_DEPLOY_VERIFICATION.json', out: get('out') ?? 'artifacts/pdv', base: get('base'), afterRollback: argv.includes('--after-rollback'), wait }
}

async function run() {
  const opts = parseArgs(process.argv.slice(2))
  const cfg = loadConfig(JSON.parse(readFileSync(opts.record, 'utf8')), opts.base)
  const headers = accessHeaders(cfg)
  const want = opts.commit.slice(0, 12)
  mkdirSync(opts.out, { recursive: true })
  const rows = []
  const report = { schema: 'sgps.pdv-report/1', base: cfg.base, expected_commit: opts.afterRollback ? `not ${want}` : want, mode: opts.afterRollback ? 'after-rollback' : 'post-deploy', started_at: new Date().toISOString(), rows }
  const finish = (verdict, code) => {
    report.verdict = verdict
    report.finished_at = new Date().toISOString()
    writeFileSync(join(opts.out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
    console.log(`[PDV] ${verdict} ${cfg.base} report=${join(opts.out, 'report.json')}`)
    process.exit(code)
  }

  // DL-01: the edge can serve the previous version for a few seconds after a promote, so poll before judging.
  const isOk = (c) => (opts.afterRollback ? Boolean(c) && !sameCommit(c, want) : sameCommit(c, want))
  let served = ''
  for (let i = 1; i <= cfg.identity.tries; i++) {
    served = await readIdentity(cfg, headers).catch(() => '')
    if (isOk(served)) break
    if (i < cfg.identity.tries) await new Promise((r) => setTimeout(r, cfg.identity.interval))
  }
  report.served_commit = served || null
  rows.push({ layer: 'identity', check: cfg.identity.endpoint, ok: isOk(served), detail: `served ${served.slice(0, 12) || 'nothing'}` })
  if (!isOk(served)) { console.error(`[PDV] FAIL identity: served ${served || 'nothing'}`); finish('FAIL', 1) }
  // DEC-049 D5: one commit on every read once at 100%; a round with one commit passes, up to 3 rounds.
  let seen = new Set()
  for (let round = 0; round < SPLIT_ROUNDS; round++) {
    seen = new Set()
    for (let i = 0; i < cfg.identity.samples; i++) {
      seen.add(await readIdentity(cfg, headers).catch(() => ''))
      await new Promise((r) => setTimeout(r, 1000))
    }
    if (seen.size === 1) break
  }
  rows.push({ layer: 'identity', check: 'one version serves', ok: seen.size === 1, detail: `commits seen: ${[...seen].map((c) => c.slice(0, 12) || 'none').join(', ')}` })
  if (seen.size !== 1) finish('FAIL', 1)

  // Playwright comes from the project (npm i -D playwright) or a global install. Without it L1 is NOT VERIFIED, not skipped.
  let chromium = null
  try { ({ chromium } = createRequire(resolve(process.cwd(), 'package.json'))('playwright')) } catch { /* below */ }
  const browser = chromium ? await chromium.launch(process.env.PDV_CHROMIUM_PATH ? { executablePath: process.env.PDV_CHROMIUM_PATH } : {}) : null
  if (!browser) rows.push({ layer: 'L1', check: 'public pages', ok: null, detail: 'playwright not installed; L1 not judged' })
  let judged = 0
  for (const vp of browser ? cfg.viewports : []) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, colorScheme: vp.scheme })
    // The service token goes only to the base origin, never to a third party the page calls.
    if (cfg.token) await ctx.route(`${cfg.base}/**`, (route) => route.continue({ headers: { ...route.request().headers(), ...headers } }))
    // DL-06: language and theme before the first navigation, so the capture is the page under review.
    const storage = Object.fromEntries(Object.entries(cfg.storage).map(([k, v]) => [k, String(v).replace('{scheme}', vp.scheme)]))
    await ctx.addInitScript((s) => { try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v) } catch { /* private mode */ } }, storage)
    for (const path of cfg.pages) {
      const shot = join(opts.out, `${vp.name}${path === '/' ? '-home' : path.replace(/[^a-z0-9]+/gi, '-')}.png`)
      let result
      let firstTry = null
      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        result = await visit(ctx, cfg, path, shot)
        if (result.challenge || !judgePage(result, cfg.ignored).length) break
        firstTry ??= judgePage(result, cfg.ignored).join('; ')
      }
      const problems = result.challenge ? [] : judgePage(result, cfg.ignored)
      if (!result.challenge) judged++
      rows.push({ layer: 'L1', check: `${vp.name} ${path}`, ok: result.challenge ? null : !problems.length, detail: result.challenge ? 'edge challenge (cf-mitigated), not judged' : problems.join('; ') || (firstTry ? `FLAKY: ok on retry, first try ${firstTry}` : 'ok'), screenshot: result.challenge ? null : shot })
      console.log(`[PDV] ${result.challenge ? 'skip' : problems.length ? 'FAIL' : firstTry ? 'FLAKY' : 'ok  '} L1 ${vp.name} ${path} ${problems.join('; ')}`)
    }
    await ctx.close()
  }
  await browser?.close()

  // L2 is anonymous on purpose: no token, no cookie.
  for (const door of cfg.doors) {
    let status = 0
    try { status = (await fetch(cfg.base + door.path, { redirect: 'manual', signal: AbortSignal.timeout(15000) })).status } catch { /* 0 */ }
    rows.push({ layer: 'L2', check: door.path, ok: door.expect.includes(status), detail: `HTTP ${status}` })
    console.log(`[PDV] ${door.expect.includes(status) ? 'ok  ' : 'FAIL'} L2 ${door.path} HTTP ${status}`)
  }

  const journey = cfg.journey && !opts.afterRollback ? await waitJourney(cfg, headers, want, opts.wait) : null
  if (journey) rows.push({ layer: 'L3', check: 'signed-in journey', ok: journey.state === 'PASS' ? true : journey.state === 'FAIL' ? false : null, detail: journey.why })
  if (journey) console.log(`[PDV] ${journey.state === 'PASS' ? 'ok  ' : journey.state === 'FAIL' ? 'FAIL' : 'skip'} L3 ${journey.why}`)

  if (rows.some((r) => r.ok === false)) finish('FAIL', 1)
  if (!judged || rows.some((r) => r.ok === null)) {
    console.warn('::warning::PDV NOT VERIFIED: some layers were not judged. Deployed, not verified.')
    finish('NOT_VERIFIED', 0)
  }
  finish(opts.afterRollback ? 'ROLLBACK_VERIFIED' : 'PASS', 0)
}

function selfTest() {
  const cases = [
    [extractCommit('{"commit":"25e08fd63f71"}', 'commit'), '25e08fd63f71'],
    [extractCommit('{"version_tag":"sha-df7ccf2eba7b"}', 'version_tag'), 'df7ccf2eba7b'],
    [extractCommit('{"build":{"sha":"ABCDEF1234567"}}', 'build.sha'), 'abcdef1234567'],
    [extractCommit('<html data-build-sha="078474f29e0f5d2c821bd17f59e2d76ab57e6562">', 'data-build-sha'), '078474f29e0f5d2c821bd17f59e2d76ab57e6562'],
    [extractCommit('{"commit":"not-a-sha"}', 'commit'), ''],
    [sameCommit('25e08fd63f71', '25e08fd63f712ecf'), true],
    [sameCommit('', '25e08fd'), false],
    [judgePage({ status: 200, consoleErrors: [], overflowPx: 0, textLength: 600 }).length, 0],
    [judgePage({ status: 200, consoleErrors: [], overflowPx: 0, textLength: 19 })[0], 'blank page: 19 visible characters'],
    [judgePage({ status: 503, consoleErrors: [], overflowPx: 0 }).length, 1],
    [judgePage({ status: 200, consoleErrors: [], overflowPx: 14 }).length, 1],
    [judgePage({ status: 200, consoleErrors: ['TypeError: x'], overflowPx: 0 }).length, 1],
    [judgePage({ status: 200, consoleErrors: ['noise from widget'], overflowPx: 0 }, [/widget/]).length, 0],
    [redact('https://a.example/x?token=abc'), 'https://a.example/x?…'],
    [judgeJourney({ verdict: 'PASS', commit: '25e08fd63f71' }, '25e08fd63f71').state, 'PASS'],
    [judgeJourney({ verdict: 'PASS', commit: '000000000000' }, '25e08fd63f71').state, 'WAIT'],
    [judgeJourney({ verdict: 'NOT_CONFIGURED', commit: null }, '25e08fd63f71').state, 'WAIT'],
    [judgeJourney({ verdict: 'NOT_DEMO', commit: '25e08fd63f71' }, '25e08fd63f71').state, 'NOT_VERIFIED'],
    [judgeJourney({ verdict: 'FAIL', commit: '25e08fd63f71', consecutive_failures: 1, steps: [] }, '25e08fd63f71').state, 'WAIT'],
    [judgeJourney({ verdict: 'FAIL', commit: '25e08fd63f71', consecutive_failures: 2, steps: [{ name: 'a', ok: false }] }, '25e08fd63f71').state, 'FAIL'],
  ]
  let failed = cases.filter(([got, want]) => got !== want).length
  const rec = { schema: 'sgps.post-deploy/1', base_url: 'https://app.example.com', identity: { endpoint: '/api/health', commit_field: 'commit' }, closed_doors: [{ path: '/api/admin', expect: 401 }], signed_in: { method: 'access_service_token' } }
  const cfg = loadConfig(rec)
  if (cfg.doors[0].expect[0] !== 401 || !cfg.token) failed++
  for (const bad of [{ ...rec, schema: 'x' }, { ...rec, base_url: 'http://app.example.com' }, { ...rec, identity: {} }]) {
    try { loadConfig(bad); failed++ } catch { /* expected */ }
  }
  delete process.env.PDV_ACCESS_CLIENT_ID
  try { accessHeaders(cfg); failed++ } catch { /* a token method without the CI secret fails closed */ }
  const total = cases.length + 5
  console.log(failed ? `sgps-pdv-run self-test: ${failed} FAIL` : `sgps-pdv-run self-test: ${total}/${total} PASS`)
  return failed ? 1 : 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (process.argv[2] === 'self-test') process.exit(selfTest())
  await run()
}
