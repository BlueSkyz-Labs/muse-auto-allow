#!/usr/bin/env node
// Build dist/muse-auto-allow-v<version>.zip with manifest.json at the zip root.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT = path.join(ROOT, 'extension');
const man = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
const dist = path.join(ROOT, 'dist');
fs.mkdirSync(dist, { recursive: true });
const zip = path.join(dist, `muse-auto-allow-v${man.version}.zip`);
if (fs.existsSync(zip)) fs.rmSync(zip);

const items = ['manifest.json', 'content.js', 'background.js', 'popup.html', 'popup.js', 'stats.html', 'stats.js', 'icons', '_locales']
  .map((n) => path.join(EXT, n));
for (const it of items) {
  if (!fs.existsSync(it)) { console.error('missing: ' + it); process.exit(1); }
}

const q = (s) => "'" + s.replace(/'/g, "''") + "'";
const ps = `Compress-Archive -Path ${items.map(q).join(',')} -DestinationPath ${q(zip)} -Force`;
execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { stdio: 'inherit' });

// Verify: list entries and require manifest.json at the zip root.
const list = execFileSync('powershell.exe', ['-NoProfile', '-Command',
  `Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::OpenRead(${q(zip)}).Entries | ForEach-Object { $_.FullName }`],
  { encoding: 'utf8' });
const entries = list.trim().split(/\r?\n/).filter(Boolean);
const hasManifestAtRoot = entries.includes('manifest.json');
// Guard (learned 2026-10-09: stats.html/stats.js were silently missing from the zip;
// extended per redteam V3-8): the zip must mirror the ENTIRE extension/ tree — full set
// equality in both directions, so a future top-level file or directory cannot ship
// missing and nothing unexpected can slip in.
const walk = (dir, base = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const rel = base ? base + '/' + e.name : e.name;
  return e.isDirectory() ? walk(path.join(dir, e.name), rel) : [rel];
});
const diskFiles = walk(EXT).sort();
const zipNorm = new Set(entries.map((e) => e.replace(/\\/g, '/')));
const missingAll = diskFiles.filter((f) => !zipNorm.has(f));
const extraZip = [...zipNorm].filter((f) => !diskFiles.includes(f));
console.log('zip:', zip);
console.log('entries:', entries.length, '| manifest at root:', hasManifestAtRoot);
for (const e of entries) console.log('  ' + e);
if (!hasManifestAtRoot) process.exit(2);
if (missingAll.length) {
  console.error('zip is missing files: ' + missingAll.join(', '));
  process.exit(3);
}
if (extraZip.length) {
  console.error('zip has unexpected files: ' + extraZip.join(', '));
  process.exit(4);
}
