# Vòng UX 1a — i18n: sửa chuỗi theo findings A1/A2/A7/B3/B6/C5/C6/D1-D10 + key mới
import io, json, os
base = r'C:\Users\thinh\dev\muse-auto-allow\extension\_locales'
L = ['en', 'vi', 'zh_CN', 'ja', 'ko', 'es']

# Giá trị sửa (chỉ key đã có) — mỗi mục: key -> {locale: new}
CHG = {
 "pauseTomorrow": {"vi": "Mai"},
 "auditExportJson": {"vi": "Xuất báo cáo JSON"},
 "auditExportCsv": {"vi": "Xuất báo cáo CSV"},
 "auditWeekAsked": {"vi": "lượt hỏi", "es": "preguntas"},
 "digestAsked": {"vi": "lượt hỏi", "es": "preguntas"},
 "rulesDescription": {
   "vi": "Chặn luôn được ưu tiên. Hỏi là để bạn tự quyết. Cho phép chỉ thu hẹp — không bao giờ nới rộng.",
   "zh_CN": "拦截优先于一切。询问则由你自行处理。允许只会收窄范围——绝不会放宽。",
   "ko": "차단이 우선합니다. 확인은 사용자에게 맡깁니다. 허용은 범위를 좁힐 뿐 넓히지 않습니다.",
   "es": "Bloquear gana siempre. Preguntar deja la decisión en tus manos. Permitir solo restringe, nunca amplía.",
 },
 "rulesTitle": {"zh_CN": "分层规则（允许 / 询问 / 拦截）"},
 "ruleKindBlock": {"zh_CN": "拦截"},
 "auditWeekBlocked": {"zh_CN": "已拦截"},
 "logOpenRules": {"vi": "Mở luật từ khóa"},
 "rulesIgnoredYolo": {"vi": "YOLO đang bật — các luật chủ đề và từ khóa vẫn được lưu nhưng không có hiệu lực. Tắt YOLO để áp dụng lại."},
 "scheduleTitle": {"vi": "Chỉ gửi follow-up trong khung giờ"},
 "exportData": {"en": "Back up data", "vi": "Sao lưu dữ liệu", "zh_CN": "备份数据", "ja": "データをバックアップ", "ko": "데이터 백업", "es": "Copia de seguridad"},
 "importData": {"en": "Restore data", "vi": "Phục hồi dữ liệu", "zh_CN": "恢复数据", "ja": "データを復元", "ko": "데이터 복원", "es": "Restaurar datos"},
 "last7": {"en": "7-day trend", "vi": "Xu hướng 7 ngày", "zh_CN": "7 天趋势", "ja": "7 日間の傾向", "ko": "7일 추세", "es": "Tendencia de 7 días"},
 "museTabsNone": {"vi": "Chưa thấy tab Muse mở — mở muse.ai để tiện ích chạy",
                  "en": "No Muse tab open yet — open muse.ai so the extension can run",
                  "zh_CN": "尚未打开 Muse 标签页——请打开 muse.ai 以便扩展运行",
                  "ja": "Muse タブがまだ開いていません — 拡張機能を動かすには muse.ai を開いてください",
                  "ko": "아직 Muse 탭이 열려 있지 않습니다 — 확장 프로그램이 작동하려면 muse.ai를 여세요",
                  "es": "Aún no hay una pestaña de Muse abierta: abre muse.ai para que la extensión funcione"},
 "noClicks": {"vi": "Chưa có lượt bấm nào"},
 "onbEnable": {"en": "Turn on auto-click", "vi": "Bật tự động bấm", "zh_CN": "开启自动点击", "ja": "自動クリックをオン", "ko": "자동 클릭 켜기", "es": "Activar clic automático"},
 "onbStep1Body": {
   "en": "When Muse asks for approval, the extension clicks Allow for you — you can pause it any time.",
   "vi": "Khi Muse xin phê duyệt, tiện ích bấm Allow thay bạn — bạn có thể tạm dừng bất cứ lúc nào.",
   "zh_CN": "当 Muse 请求批准时，扩展会替你点击 Allow——你可以随时暂停。",
   "ja": "Muse が承認を求めたら、拡張機能が代わりに Allow をクリックします。いつでも一時停止できます。",
   "ko": "Muse가 승인을 요청하면 확장 프로그램이 대신 Allow를 클릭합니다. 언제든 일시정지할 수 있습니다.",
   "es": "Cuando Muse pida una aprobación, la extensión pulsará Allow por ti: puedes pausarla en cualquier momento.",
 },
}

# Key mới cho rails (onboarding step 1) + hint khối luật + tooltip thứ tự + hint tab-only
NEW = {
 "onbRailNoDeny": {"en": "Only clicks Allow — never Deny", "vi": "Chỉ bấm Allow — không bao giờ bấm Deny/Từ chối", "zh_CN": "只点击 Allow——绝不点击拒绝", "ja": "Allow のみクリック — 拒否は押しません", "ko": "Allow만 클릭 — 거부는 누르지 않습니다", "es": "Solo pulsa Allow, nunca Denegar"},
 "onbRailLocalLog": {"en": "Every click is logged on this device", "vi": "Mỗi lần bấm đều được ghi log trên máy bạn", "zh_CN": "每次点击都记录在本机日志中", "ja": "クリックはすべてこの端末に記録されます", "ko": "모든 클릭은 이 기기에 기록됩니다", "es": "Cada clic queda registrado en este equipo"},
 "onbRailDryFirst": {"en": "Starts in logging-only (dry-run) mode — nothing is clicked until you turn it on", "vi": "Bắt đầu ở chế độ Chạy thử (chỉ ghi log, chưa bấm thật)", "zh_CN": "以仅记录（试运行）模式开始——在你开启前不会点击", "ja": "まず記録のみ（ドライラン）で開始——有効にするまでクリックしません", "ko": "기록 전용(드라이런) 모드로 시작 — 켜기 전에는 아무것도 클릭하지 않습니다", "es": "Empieza en modo solo registro (prueba): no se pulsa nada hasta que lo actives"},
 "ruleMatchHint": {"en": "One rule = the topics + keywords on one row; when both are set, the card must match both.", "vi": "Một luật = các chủ đề + từ khoá trong cùng dòng; nhập cả hai thì thẻ phải khớp cả hai.", "zh_CN": "一条规则 = 同一行中的主题 + 关键词；两者都填时，卡片必须同时匹配。", "ja": "1 つのルール = 同じ行のトピック + キーワード。両方入れた場合はカードが両方に一致する必要があります。", "ko": "규칙 하나 = 같은 줄의 주제 + 키워드. 둘 다 입력하면 카드가 둘 다 일치해야 합니다.", "es": "Una regla = los temas + palabras clave de una fila; si defines ambos, la tarjeta debe coincidir con ambos."},
 "ruleOrderHint": {"en": "Order only matters within the same layer — block always wins", "vi": "Thứ tự chỉ có ý nghĩa trong cùng tầng — Chặn luôn thắng", "zh_CN": "顺序只在同一层内有意义——拦截总是优先", "ja": "順序は同じ層の中で意味を持ちます — ブロックが常に優先", "ko": "순서는 같은 단계 안에서만 의미가 있습니다 — 차단이 항상 우선", "es": "El orden solo importa dentro de la misma capa: bloquear siempre gana"},
 "scheduleOnlyActiveHint": {"en": "Only send while the Muse tab is open", "vi": "Chỉ gửi khi tab Muse đang mở", "zh_CN": "仅在 Muse 标签页打开时发送", "ja": "Muse タブが開いているときだけ送信", "ko": "Muse 탭이 열려 있을 때만 전송", "es": "Enviar solo mientras la pestaña de Muse esté abierta"},
}

for loc in L:
    fp = os.path.join(base, loc, 'messages.json')
    d = json.loads(io.open(fp, encoding='utf-8').read())
    n_chg = n_new = 0
    for k, v in CHG.items():
        if loc in v and k in d:
            if d[k]['message'] != v[loc]:
                d[k]['message'] = v[loc]; n_chg += 1
    for k, v in NEW.items():
        if k not in d:
            d[k] = {"message": v[loc]}; n_new += 1
    io.open(fp, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
    print(loc, 'changed:', n_chg, 'added:', n_new, 'total:', len(d))
