// v1.13.0 (C4-F): add followupSendBlockedSubmit x6 locales (203 keys).
import fs from 'node:fs';
import path from 'node:path';
const EXT = path.join(process.cwd(), 'extension', '_locales');
const V = {
  en: "Couldn't send — Muse didn't accept the message",
  vi: 'Không gửi được — Muse không nhận thao tác gửi',
  zh_CN: '无法发送——Muse 未接受该消息',
  ja: '送信できません — Muse がメッセージを受け付けませんでした',
  ko: '보낼 수 없음 — Muse가 메시지를 받지 않았습니다',
  es: 'No se pudo enviar — Muse no aceptó el mensaje',
};
let fail = 0;
for (const [loc, val] of Object.entries(V)) {
  const p = path.join(EXT, loc, 'messages.json');
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes('"followupSendBlockedSubmit"')) { console.log(loc, 'ALREADY'); continue; }
  const anchor = /("followupSendBlockedDead": \{\n    "message": "[^"]*"\n  \},)/;
  if (!anchor.test(s)) { console.log(loc, 'ANCHOR MISSING'); fail++; continue; }
  s = s.replace(anchor, '$1\n  "followupSendBlockedSubmit": {\n    "message": ' + JSON.stringify(val).replace(/\$/g, '$$$$') + '\n  },');
  const j = JSON.parse(s);
  if (j.followupSendBlockedSubmit?.message !== val) { console.log(loc, 'MISMATCH'); fail++; continue; }
  fs.writeFileSync(p, s);
  console.log(loc, 'added keys=' + Object.keys(j).length);
}
console.log(fail ? 'FAIL=' + fail : 'ALL_OK');
process.exit(fail ? 2 : 0);
