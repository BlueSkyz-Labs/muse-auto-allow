// v5.0 (C5-3): add importNewer x6 locales (204 keys).
import fs from 'node:fs';
import path from 'node:path';
const EXT = path.join(process.cwd(), 'extension', '_locales');
const V = {
  en: 'This backup was made by a newer version of Muse Auto-Allow — update the extension first.',
  vi: 'Bản sao lưu này được tạo bởi phiên bản Muse Auto-Allow mới hơn — hãy cập nhật tiện ích trước.',
  zh_CN: '此备份由更新版本的 Muse Auto-Allow 创建——请先更新扩展。',
  ja: 'このバックアップは新しいバージョンの Muse Auto-Allow で作成されています — 先に拡張機能を更新してください。',
  ko: '이 백업은 더 새로운 버전의 Muse Auto-Allow에서 만들어졌습니다 — 먼저 확장 프로그램을 업데이트하세요.',
  es: 'Esta copia se creó con una versión más reciente de Muse Auto-Allow — actualiza la extensión primero.',
};
let fail = 0;
for (const [loc, val] of Object.entries(V)) {
  const p = path.join(EXT, loc, 'messages.json');
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes('"importNewer"')) { console.log(loc, 'ALREADY'); continue; }
  const anchor = /("importAuthorityWarn": \{\n    "message": "[^"]*"\n  \},)/;
  if (!anchor.test(s)) { console.log(loc, 'ANCHOR MISSING'); fail++; continue; }
  s = s.replace(anchor, '$1\n  "importNewer": {\n    "message": ' + JSON.stringify(val).replace(/\$/g, '$$$$') + '\n  },');
  const j = JSON.parse(s);
  if (j.importNewer?.message !== val) { console.log(loc, 'MISMATCH'); fail++; continue; }
  fs.writeFileSync(p, s);
  console.log(loc, 'added keys=' + Object.keys(j).length);
}
console.log(fail ? 'FAIL=' + fail : 'ALL_OK');
process.exit(fail ? 2 : 0);
