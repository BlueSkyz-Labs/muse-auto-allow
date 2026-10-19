// v1.19.0 (S02): add 8 log-filter i18n keys x6 locales (211 keys).
import fs from 'node:fs';
import path from 'node:path';
const EXT = path.join(process.cwd(), 'extension', '_locales');
const V = {
  logFilterAll: { en: 'All', vi: 'Tất cả', zh_CN: '全部', ja: 'すべて', ko: '전체', es: 'Todo' },
  logFilterAllow: { en: 'Allowed', vi: 'Đã duyệt', zh_CN: '已允许', ja: '許可済み', ko: '허용됨', es: 'Permitido' },
  logFilterBlocked: { en: 'Blocked', vi: 'Đã chặn', zh_CN: '已阻止', ja: 'ブロック', ko: '차단됨', es: 'Bloqueado' },
  logFilterDry: { en: 'Log-only', vi: 'Chỉ ghi log', zh_CN: '仅记录', ja: 'ログのみ', ko: '기록만', es: 'Solo registro' },
  logSearchPlaceholder: { en: 'Search…', vi: 'Tìm kiếm…', zh_CN: '搜索…', ja: '検索…', ko: '검색…', es: 'Buscar…' },
  logToday: { en: 'Today', vi: 'Hôm nay', zh_CN: '今天', ja: '今日', ko: '오늘', es: 'Hoy' },
  logYesterday: { en: 'Yesterday', vi: 'Hôm qua', zh_CN: '昨天', ja: '昨日', ko: '어제', es: 'Ayer' },
  logNoMatch: { en: 'No matching entries', vi: 'Không có mục phù hợp', zh_CN: '没有匹配的记录', ja: '一致する記録なし', ko: '일치하는 항목 없음', es: 'Sin coincidencias' },
};
let fail = 0;
for (const loc of ['en', 'vi', 'zh_CN', 'ja', 'ko', 'es']) {
  const p = path.join(EXT, loc, 'messages.json');
  let s = fs.readFileSync(p, 'utf8');
  let j = JSON.parse(s);
  let added = 0;
  for (const [key, byLoc] of Object.entries(V)) {
    if (j[key]) continue;
    j[key] = { message: byLoc[loc] };
    added++;
  }
  if (!added) { console.log(loc, 'ALREADY'); continue; }
  // rebuild text preserving order: append new keys before the final closing brace
  const tail = s.replace(/\s*$/, '');
  const close = tail.lastIndexOf('}');
  const cut = tail.slice(0, close).replace(/,\s*$/, '');
  const ins = Object.entries(V).filter(([k]) => !s.includes('"' + k + '"')).map(([k, v]) => ',\n  "' + k + '": {\n    "message": ' + JSON.stringify(v[loc]) + '\n  }').join('');
  const out = cut + ins + '\n}\n';
  const jj = JSON.parse(out);
  if (Object.keys(jj).length !== Object.keys(j).length) { console.log(loc, 'COUNT MISMATCH'); fail++; continue; }
  fs.writeFileSync(p, out);
  console.log(loc, 'added', added, 'keys=' + Object.keys(jj).length);
}
console.log(fail ? 'FAIL=' + fail : 'ALL_OK');
process.exit(fail ? 2 : 0);
