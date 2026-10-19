#!/usr/bin/env node
// build.mjs — deterministic store package for the Muse Auto-Allow extension (MV3).
//
// Outputs (dist/):
//   muse-auto-allow-v<version>.zip          manifest.json at the zip ROOT
//   muse-auto-allow-v<version>.zip.sha256   sibling checksum sidecar (sha256sum format)
//
// The version always comes from extension/manifest.json — never hardcoded.
//
// Determinism rules (rationale + verification commands in docs/RELEASE_INTEGRITY.md):
//   - entries are written byte-wise sorted by path;
//   - every entry carries ONE fixed DOS timestamp derived from SOURCE_DATE_EPOCH,
//     clamped to the ZIP minimum 1980-01-01T00:00:00Z (also the default when
//     SOURCE_DATE_EPOCH is unset). File mtimes are deliberately NOT used: a fresh
//     checkout has different mtimes, the fixed epoch does not — so two builds of the
//     same bytes produce the same archive, on any machine;
//   - compression: raw deflate (level 9), or STORE when deflate is not smaller
//     (fixed rule, deterministic for a given input);
//   - no extra fields, no comments, fixed version/attribute fields.
//
// Fail-closed guards (exit != 0):
//   - extension/ may only contain files covered by SHIPPED (exact names + regexes) —
//     a new unexpected file or directory breaks the build until it is deliberately
//     shipped (redteam V3-1/V3-8 regression guard);
//   - the written zip is READ BACK from disk and checked: manifest.json at the root,
//     zip entries == disk files in BOTH directions (exit 2/3/4).
import fs from 'node:fs';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT = path.join(ROOT, 'extension');

// Files allowed to ship. Strings match exactly; regexes match the relative path.
const SHIPPED = [
  'manifest.json',
  'content.js',
  'anomaly.js', // v1.20.0 (G04): the pure detector module (content_scripts: anomaly.js first)
  'codex.js',
  'background.js',
  'popup.html',
  'popup.js',
  'stats.html',
  'stats.js',
  /^icons\/[A-Za-z0-9._-]+\.png$/,
  /^_locales\/[A-Za-z0-9_-]+\/messages\.json$/,
];

// ---------- fixed timestamp ----------
const DEFAULT_SOURCE_DATE_EPOCH = 315532800; // 1980-01-01T00:00:00Z — ZIP's minimum date
const envRaw = process.env.SOURCE_DATE_EPOCH;
const envNum = envRaw ? Number(envRaw) : NaN;
const usingEnv = Number.isFinite(envNum) && envNum > 0;
const epoch = usingEnv ? Math.max(DEFAULT_SOURCE_DATE_EPOCH, Math.floor(envNum)) : DEFAULT_SOURCE_DATE_EPOCH;
function dosStamp(unixSec) {
  const d = new Date(unixSec * 1000);
  return {
    date: (((d.getUTCFullYear() - 1980) & 0x7f) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate(),
    time: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2),
  };
}

// ---------- zip writer (stored/deflated, no extra fields, fixed fields) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function buildZip(files, stamp) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8');
    const raw = f.data;
    const crc = crc32(raw);
    const def = deflateRawSync(raw, { level: 9 });
    const store = def.length >= raw.length; // fixed rule: only compress when it helps
    const method = store ? 0 : 8;
    const body = store ? raw : def;

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4); // version needed (2.0)
    lh.writeUInt16LE(0x0800, 6); // UTF-8 names
    lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(stamp.time, 10);
    lh.writeUInt16LE(stamp.date, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(body.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28); // extra length
    parts.push(lh, name, body);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4); // version made by (DOS)
    ch.writeUInt16LE(20, 6); // version needed
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(stamp.time, 12);
    ch.writeUInt16LE(stamp.date, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(body.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt16LE(0, 30); // extra
    ch.writeUInt16LE(0, 32); // comment
    ch.writeUInt16LE(0, 34); // disk start
    ch.writeUInt16LE(0, 36); // internal attrs
    ch.writeUInt32LE(0, 38); // external attrs
    ch.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([ch, name]));

    offset += lh.length + name.length + body.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, cd, eocd]);
}

// ---------- read-back (central directory only) ----------
function listZipEntries(buf) {
  let p = buf.length - 22;
  const floor = Math.max(0, buf.length - 65557);
  while (p >= floor && buf.readUInt32LE(p) !== 0x06054b50) p--;
  if (p < floor) throw new Error('EOCD not found — not a zip file');
  const count = buf.readUInt16LE(p + 10);
  const cdOff = buf.readUInt32LE(p + 16);
  const names = [];
  let o = cdOff;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(o) !== 0x02014b50) throw new Error('bad central-directory signature at ' + o);
    const nameLen = buf.readUInt16LE(o + 28);
    const extraLen = buf.readUInt16LE(o + 30);
    const commentLen = buf.readUInt16LE(o + 32);
    names.push(buf.toString('utf8', o + 46, o + 46 + nameLen));
    o += 46 + nameLen + extraLen + commentLen;
  }
  return { count, names };
}

// ---------- main ----------
const man = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
const dist = path.join(ROOT, 'dist');
fs.mkdirSync(dist, { recursive: true });
const zip = path.join(dist, `muse-auto-allow-v${man.version}.zip`);

const walk = (dir, base = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const rel = base ? base + '/' + e.name : e.name;
  return e.isDirectory() ? walk(path.join(dir, e.name), rel) : [rel];
});
const diskFiles = walk(EXT).sort();
const unexpected = diskFiles.filter((f) => !SHIPPED.some((r) => (typeof r === 'string' ? r === f : r.test(f))));
if (unexpected.length) {
  console.error('extension/ contains files not covered by the build allowlist (SHIPPED in scripts/build.mjs):');
  for (const f of unexpected) console.error('  ' + f);
  console.error('Ship it deliberately (add a matching SHIPPED entry) or remove it.');
  process.exit(4);
}

const files = diskFiles.map((name) => ({ name, data: fs.readFileSync(path.join(EXT, name)) }));
files.sort((a, b) => Buffer.compare(Buffer.from(a.name, 'utf8'), Buffer.from(b.name, 'utf8')));
const buf = buildZip(files, dosStamp(epoch));

// replace old artifacts only now that the fresh archive is fully in memory
fs.rmSync(zip, { force: true });
fs.rmSync(zip + '.sha256', { force: true });
fs.writeFileSync(zip, buf);

// read back from disk and verify
const back = fs.readFileSync(zip);
const listed = listZipEntries(back);
const zipSet = new Set(listed.names);
const missing = diskFiles.filter((f) => !zipSet.has(f));
const extra = listed.names.filter((f) => !diskFiles.includes(f));
const hasManifestAtRoot = listed.names.includes('manifest.json');
const totalRaw = files.reduce((n, f) => n + f.data.length, 0);
console.log('zip:', path.relative(ROOT, zip));
console.log('entries:', listed.count, '| manifest at root:', hasManifestAtRoot);
console.log('total size:', totalRaw, 'bytes uncompressed | zip file:', back.length, 'bytes');
console.log('timestamps:', usingEnv ? `entry stamp from SOURCE_DATE_EPOCH=${epoch}` : `fixed default epoch ${DEFAULT_SOURCE_DATE_EPOCH}`, '(same DOS stamp for every entry, UTC)');
for (const n of listed.names) console.log('  ' + n);
if (!hasManifestAtRoot) process.exit(2);
if (listed.count !== diskFiles.length) {
  console.error(`entry count mismatch: zip ${listed.count} vs disk ${diskFiles.length}`);
  process.exit(3);
}
if (missing.length) {
  console.error('zip is missing files: ' + missing.join(', '));
  process.exit(3);
}
if (extra.length) {
  console.error('zip has unexpected files: ' + extra.join(', '));
  process.exit(4);
}
const sha = createHash('sha256').update(back).digest('hex');
fs.writeFileSync(zip + '.sha256', `${sha}  ${path.basename(zip)}\n`);
console.log('sha256:', sha);
console.log('sha256 sidecar:', path.relative(ROOT, zip + '.sha256'));
