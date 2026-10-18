// cleanup-chrome-scratch.mjs — remove scratch-Chrome leftovers from test/QA runs.
// Kills ONLY chrome processes whose --user-data-dir points at a maa-*/muse-* scratch profile
// (never the owner's real browser) and deletes those temp profile dirs. Run after any battery:
//   node scripts/cleanup-chrome-scratch.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = os.tmpdir();
let killed = 0, removed = 0;

// 1) find scratch chrome processes by command line marker
try {
  const out = execFileSync('powershell.exe', ['-NoProfile', '-Command',
    "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress -Depth 3"
  ], { encoding: 'utf8', timeout: 60000 });
  const rows = JSON.parse(out || '[]');
  const list = Array.isArray(rows) ? rows : [rows];
  for (const r of list) {
    const cl = String(r && r.CommandLine || '');
    if (/--user-data-dir=[^ ]*(maa-|muse-|q1[0-9]{3}-|battery)/i.test(cl) || /[\\/](maa-|muse-)[^\\/ ]*[\\/]/.test(cl)) {
      try { execFileSync('powershell.exe', ['-NoProfile', '-Command', `Stop-Process -Id ${Number(r.ProcessId)} -Force -ErrorAction SilentlyContinue`], { timeout: 20000 }); killed++; } catch {}
    }
  }
} catch (e) { console.log('process scan skipped:', String(e.message).slice(0, 120)); }

// 2) delete scratch profile dirs in the temp root
try {
  for (const name of fs.readdirSync(tmp)) {
    if (/^(maa-|muse-)/i.test(name)) {
      const p = path.join(tmp, name);
      try { fs.rmSync(p, { recursive: true, force: true }); removed++; } catch {}
    }
  }
} catch (e) { console.log('dir sweep skipped:', String(e.message).slice(0, 120)); }

console.log(JSON.stringify({ killed_chrome: killed, removed_dirs: removed }));
