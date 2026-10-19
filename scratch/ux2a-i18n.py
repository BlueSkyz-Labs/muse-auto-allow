# Vòng UX 2A — i18n: thống nhất dry-run, rule kind, đơn vị, + key mới cho mode tag/confirm 2 bước/a11y
import io, json, os
base = r'C:\Users\thinh\dev\muse-auto-allow\extension\_locales'

CHG = {
 "drySwitchSub": {"en": "Dry-run — nothing is clicked", "vi": "Chạy thử — không bấm gì", "zh_CN": "试运行——不会点击", "ja": "ドライラン — クリックしません", "ko": "드라이런 — 클릭하지 않습니다", "es": "Prueba: no se pulsa nada"},
 "onbRailDryFirst": {"en": "Starts in dry-run (logs only) — nothing is clicked until you turn it on", "vi": "Bắt đầu ở chế độ chạy thử — chưa bấm thật cho đến khi bạn bật", "zh_CN": "以试运行开始——在你开启前不会点击", "ja": "まずドライランで開始——有効にするまでクリックしません", "ko": "드라이런으로 시작 — 켜기 전에는 클릭하지 않습니다", "es": "Empieza en modo de prueba: no se pulsa nada hasta que lo actives"},
 "onbRailLocalLog": {"en": "Every click is logged on this device (latest 50)", "vi": "Mỗi lần bấm đều được ghi log trên máy bạn (50 lượt gần nhất)", "zh_CN": "每次点击都记录在本机（最近 50 条）", "ja": "クリックはこの端末に記録されます（直近 50 件）", "ko": "모든 클릭은 이 기기에 기록됩니다(최근 50건)", "es": "Cada clic queda registrado en este equipo (últimos 50)"},
 "ruleKindAllow": {"en": "Allow", "vi": "Cho phép", "zh_CN": "允许", "ja": "許可", "ko": "허용", "es": "Permitir"},
 "ruleKindAsk": {"en": "Ask", "vi": "Hỏi", "zh_CN": "询问", "ja": "確認", "ko": "확인", "es": "Preguntar"},
 "ruleKindBlock": {"en": "Block", "vi": "Chặn", "zh_CN": "拦截", "ja": "ブロック", "ko": "차단", "es": "Bloquear"},
 "pause60": {"en": "60 min"},
 "ruleMatchHint": {
   "en": "One rule = the topics + keywords on one row; when both are set, the card must match both. Several topics/keywords = match ANY of them. E.g. topics: github.com + keywords: payment, billing → matches only on github.com AND content containing payment or billing.",
   "vi": "Một luật = các chủ đề + từ khoá trong cùng dòng; nhập cả hai thì thẻ phải khớp cả hai. Nhiều chủ đề/từ khoá = khớp BẤT KỲ mục nào. VD: chủ đề github.com + từ khoá payment, billing → chỉ khớp khi ở github.com VÀ nội dung có payment hoặc billing.",
   "zh_CN": "一条规则 = 同一行中的主题 + 关键词；两者都填时，卡片必须同时匹配。多个主题/关键词 = 匹配其中任意一个。例如：主题 github.com + 关键词 payment, billing → 仅在 github.com 且内容包含 payment 或 billing 时匹配。",
   "ja": "1 つのルール = 同じ行のトピック + キーワード。両方入れた場合はカードが両方に一致する必要があります。複数のトピック/キーワードは「いずれかに一致」。例: トピック github.com + キーワード payment, billing → github.com 上で、内容に payment または billing を含む場合のみ一致。",
   "ko": "규칙 하나 = 같은 줄의 주제 + 키워드. 둘 다 입력하면 카드가 둘 다 일치해야 합니다. 여러 주제/키워드는 그중 하나라도 일치하면 됩니다. 예: 주제 github.com + 키워드 payment, billing → github.com에서 내용에 payment 또는 billing이 있을 때만 일치.",
   "es": "Una regla = los temas + palabras clave de una fila; si defines ambos, la tarjeta debe coincidir con ambos. Varios temas/palabras = coincide con CUALQUIERA. Ej.: temas github.com + palabras payment, billing → solo coincide en github.com Y si el contenido tiene payment o billing.",
 },
 "anomalyEnableHint": {"vi": "Tự tạm dừng khi hành vi bấm có vẻ bất thường (tần suất hoặc đột biến chủ đề). Không bao giờ làm yếu bất kỳ rail an toàn nào."},
 "anomalyRateLabel": {"vi": "Tốc độ bấm duy trì (lượt bấm/phút)"},
 "anomalyRateHint": {"vi": "Tạm dừng khi số lượt bấm Allow duy trì trên mức này trong cửa sổ 5 phút."},
 "anomalyTopicHint": {"vi": "Cũng tạm dừng khi một chủ đề chiếm phần lớn cửa sổ (40+ lượt bấm và 70% tỷ lệ trong 10 phút)."},
 "anomalyAutoPausedNote": {"vi": "Bộ dò đã tự tạm dừng; sẽ tự chạy lại."},
}
NEW = {
 "modeSim": {"en": "SIMULATION — NOT CLICKING", "vi": "MÔ PHỎNG — CHƯA BẤM THẬT", "zh_CN": "模拟——未实际点击", "ja": "シミュレーション — 実際にはクリックしません", "ko": "시뮬레이션 — 실제 클릭 없음", "es": "SIMULACIÓN: SIN PULSAR"},
 "modeLive": {"en": "LIVE — CLICKING", "vi": "ĐANG BẤM THẬT", "zh_CN": "实时——正在点击", "ja": "ライブ — クリック中", "ko": "실시간 — 클릭 중", "es": "EN VIVO: PULSANDO"},
 "ruleConfirmDelete": {"en": "Tap again to delete", "vi": "Bấm lần nữa để xoá", "zh_CN": "再次点击以删除", "ja": "もう一度押すと削除", "ko": "다시 누르면 삭제", "es": "Toca otra vez para eliminar"},
 "ruleConfirmApply": {"en": "Replace $1 rules? Tap again", "vi": "Thay $1 luật? Bấm lần nữa", "zh_CN": "替换 $1 条规则？再次点击", "ja": "$1 件のルールを置き換えますか？もう一度押す", "ko": "규칙 $1개를 바꿀까요? 다시 누르세요", "es": "¿Reemplazar $1 reglas? Toca otra vez"},
 "tabWord": {"en": "tab", "vi": "tab", "zh_CN": "标签页", "ja": "タブ", "ko": "탭", "es": "pestaña"},
 "closeLabel": {"en": "Close", "vi": "Đóng", "zh_CN": "关闭", "ja": "閉じる", "ko": "닫기", "es": "Cerrar"},
 "unitMs": {"en": "ms", "vi": "ms", "zh_CN": "毫秒", "ja": "ミリ秒", "ko": "밀리초", "es": "ms"},
 "unitSec": {"en": "s", "vi": "giây", "zh_CN": "秒", "ja": "秒", "ko": "초", "es": "s"},
 "unitMin": {"en": "min", "vi": "phút", "zh_CN": "分钟", "ja": "分", "ko": "분", "es": "min"},
 "unitPerMin": {"en": "/min", "vi": "/phút", "zh_CN": "/分钟", "ja": "/分", "ko": "/분", "es": "/min"},
}

for loc in ['en', 'vi', 'zh_CN', 'ja', 'ko', 'es']:
    fp = os.path.join(base, loc, 'messages.json')
    d = json.loads(io.open(fp, encoding='utf-8').read())
    nc = nn = 0
    for k, v in CHG.items():
        if loc in v and k in d and d[k]['message'] != v[loc]:
            d[k]['message'] = v[loc]; nc += 1
    for k, v in NEW.items():
        if k not in d:
            d[k] = {"message": v[loc]}; nn += 1
    io.open(fp, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
    print(loc, 'changed:', nc, 'added:', nn, 'total:', len(d))
