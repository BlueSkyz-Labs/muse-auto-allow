// v1.13.0 (C4-D): update the importConfirm VALUE in all 6 locales (honest replace semantics).
import fs from 'node:fs';
import path from 'node:path';
const EXT = path.join(process.cwd(), 'extension', '_locales');
const V = {
  en: "Restore this backup? History and statistics are replaced by the backup's; settings not in the file keep their current values.",
  vi: 'Khôi phục bản sao lưu? Nhật ký và thống kê sẽ thay bằng dữ liệu trong tệp; các cài đặt không có trong tệp vẫn giữ nguyên giá trị hiện tại.',
  zh_CN: '恢复此备份？历史记录和统计数据将由备份内容替换；文件中没有的设置将保持当前值。',
  ja: 'このバックアップを復元しますか？履歴と統計はバックアップの内容に置き換わり、ファイルにない設定は現在の値を保ちます。',
  ko: '이 백업을 복원할까요? 기록과 통계는 백업의 내용으로 대체되고, 파일에 없는 설정은 현재 값이 유지됩니다.',
  es: '¿Restaurar esta copia? El historial y las estadísticas se reemplazan por los de la copia; los ajustes que no estén en el archivo conservan su valor actual.',
};
let fail = 0;
for (const [loc, val] of Object.entries(V)) {
  const p = path.join(EXT, loc, 'messages.json');
  let s = fs.readFileSync(p, 'utf8');
  const re = /("importConfirm": \{\n    "message": ")([^"]*)("\n  \},)/;
  if (!re.test(s)) { console.log(loc, 'ANCHOR MISSING'); fail++; continue; }
  s = s.replace(re, '$1' + val.replace(/\$/g, '$$$$') + '$3');
  const j = JSON.parse(s);
  if (j.importConfirm?.message !== val) { console.log(loc, 'VALUE MISMATCH'); fail++; continue; }
  fs.writeFileSync(p, s);
  console.log(loc, 'updated');
}
console.log(fail ? 'FAIL=' + fail : 'ALL_OK');
process.exit(fail ? 2 : 0);
