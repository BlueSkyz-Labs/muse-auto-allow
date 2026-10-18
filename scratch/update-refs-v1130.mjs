// v1.13.0 post-rebuild: update artifact refs 082883fd…/209,701 -> a86345e0…/209,789 across docs.
import fs from 'node:fs';
const OLD_FULL = '082883fdd1fa8dc133aaabce9b91009e8736026c58f720f579cb038364301f93';
const NEW_FULL = 'a86345e0cc588864065ba85f47b47bd0a04ed1380af01c5f30ad761121bc3e05';
const OLD_SHORT = '082883fd…1f93';
const NEW_SHORT = 'a86345e0…3e05';
const OLD_BYTES = '209,701';
const NEW_BYTES = '209,789';
const files = [
  'docs/RELEASE_INTEGRITY.md', 'store/COMPLIANCE_CHECKLIST.md', 'store/PACKET_VERIFICATION.md',
  'store/SHOWCASE.md', 'store/PUBLISH_RUNBOOK.md', 'CHANGELOG.md',
  'store/CWS_SUBMISSION_PACK.md', 'store/LISTING.md', 'docs/GITHUB_PUBLISH_RUNBOOK.md',
  'docs/EXPERIENCE_CYCLE_2026-10-18.md',
];
let total = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const before = s;
  const n = (s.match(new RegExp(OLD_FULL, 'g')) || []).length + (s.match(new RegExp(OLD_SHORT, 'g')) || []).length + (s.match(new RegExp(OLD_BYTES, 'g')) || []).length;
  if (!n) { console.log(f + ': 0 refs'); continue; }
  s = s.split(OLD_FULL).join(NEW_FULL).split(OLD_SHORT).join(NEW_SHORT).split(OLD_BYTES).join(NEW_BYTES);
  fs.writeFileSync(f, s);
  console.log(f + ': ' + n + ' refs updated' + (before === s ? ' (NO CHANGE?!)' : ''));
  total += n;
}
console.log('TOTAL=' + total);
// final sweep: any stale refs left anywhere in store/docs/CHANGELOG?
import { execSync } from 'node:child_process';
try {
  const left = execSync('grep -rln "082883\\|209,701" store docs CHANGELOG.md 2>/dev/null || true', { encoding: 'utf8' }).trim();
  console.log(left ? 'STALE REMAINS:\n' + left : 'NO STALE REFS');
} catch { console.log('grep check skipped'); }
