// v1.12.0 (cycle 3): add 3 keys x 6 locales — logOpenTopics, logStanding, importAuthorityWarn.
// Inserts textually after anchor blocks (no full-file reformat), then validates JSON + key count.
import fs from 'node:fs';
import path from 'node:path';

const EXT = path.join(process.cwd(), 'extension', '_locales');
const VALS = {
  en: { logOpenTopics: 'Open the allowed topics', logStanding: 'Granted standing access', importAuthorityWarn: 'This backup turns on: $1 — continue?' },
  vi: { logOpenTopics: 'Mở danh sách chủ đề cho phép', logStanding: 'Đã cấp quyền thường trực', importAuthorityWarn: 'Bản sao lưu này sẽ bật: $1 — tiếp tục?' },
  zh_CN: { logOpenTopics: '打开允许的主题', logStanding: '已授予持续访问权限', importAuthorityWarn: '此备份将启用：$1——继续？' },
  ja: { logOpenTopics: '許可トピックを開く', logStanding: '継続アクセスを許可済み', importAuthorityWarn: 'このバックアップは $1 を有効にします — 続行しますか？' },
  ko: { logOpenTopics: '허용된 주제 열기', logStanding: '지속 권한 부여됨', importAuthorityWarn: '이 백업은 $1을(를) 켭니다 — 계속할까요?' },
  es: { logOpenTopics: 'Abrir los temas permitidos', logStanding: 'Acceso permanente concedido', importAuthorityWarn: 'Esta copia activa: $1 — ¿continuar?' },
};

let fail = 0;
for (const [loc, v] of Object.entries(VALS)) {
  const p = path.join(EXT, loc, 'messages.json');
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes('"logOpenTopics"')) { console.log(loc, 'ALREADY PATCHED — skip'); continue; }
  const anchor1 = /("logOpenRules": \{\n    "message": "[^"]*"\n  \},)/;
  const anchor2 = /("importBad": \{\n    "message": "[^"]*"\n  \},)/;
  if (!anchor1.test(s) || !anchor2.test(s)) { console.log(loc, 'ANCHOR MISSING — fail'); fail++; continue; }
  const esc = (t) => t.replace(/\$/g, '$$$$'); // String.replace: literal $ must be $$
  s = s.replace(anchor1, `$1
  "logOpenTopics": {
    "message": ${esc(JSON.stringify(v.logOpenTopics))}
  },
  "logStanding": {
    "message": ${esc(JSON.stringify(v.logStanding))}
  },`);
  s = s.replace(anchor2, `$1
  "importAuthorityWarn": {
    "message": ${esc(JSON.stringify(v.importAuthorityWarn))}
  },`);
  const j = JSON.parse(s); // throws on bad JSON
  const n = Object.keys(j).length;
  fs.writeFileSync(p, s);
  const has = ['logOpenTopics', 'logStanding', 'importAuthorityWarn'].every((k) => typeof j[k]?.message === 'string');
  console.log(loc, 'keys=' + n, has ? 'inserted-OK' : 'MISSING KEY');
  if (!has) fail++;
}
console.log(fail ? 'FAIL=' + fail : 'ALL_OK');
process.exit(fail ? 2 : 0);
