# W5 i18n: thêm khóa mới vào 6 locale (parity bắt buộc)
import io, json, os
base = r'C:\Users\thinh\dev\muse-auto-allow\extension\_locales'

NEW = {
 "kindAsk": {"en": "Ask", "vi": "Hỏi", "zh_CN": "询问", "ja": "確認", "ko": "확인", "es": "Preguntar"},
 "digestAsked": {"en": "asks", "vi": "chờ bạn", "zh_CN": "待确认", "ja": "確認待ち", "ko": "확인 대기", "es": "por revisar"},
 "rulesTitle": {"en": "Layered rules (allow / ask / block)", "vi": "Luật ba tầng (cho phép / hỏi / chặn)", "zh_CN": "分层规则（允许 / 询问 / 阻止）", "ja": "階層ルール（許可 / 確認 / ブロック）", "ko": "단계별 규칙(허용 / 확인 / 차단)", "es": "Reglas por capas (permitir / preguntar / bloquear)"},
 "rulesDescription": {"en": "Block wins over everything. Ask leaves the card to you. Allow narrows what may be clicked — it never widens anything.", "vi": "Chặn thắng mọi tầng. Hỏi nghĩa là để bạn tự xử lý. Cho phép chỉ thu hẹp — không bao giờ nới rộng.", "zh_CN": "阻止优先于一切。询问表示由你处理。允许只会收窄范围——绝不会放宽。", "ja": "ブロックが最優先。確認はあなたに委ねます。許可は対象を狭めるだけで、緩めることはありません。", "ko": "차단이 우선합니다. 확인은 직접 처리하라는 뜻입니다. 허용은 범위를 좁힐 뿐 넓히지 않습니다.", "es": "Bloquear gana siempre. Preguntar deja la tarjeta en tus manos. Permitir solo restringe, nunca amplía."},
 "ruleAdd": {"en": "Add rule", "vi": "Thêm luật", "zh_CN": "添加规则", "ja": "ルールを追加", "ko": "규칙 추가", "es": "Añadir regla"},
 "ruleMoveUp": {"en": "Move up", "vi": "Lên", "zh_CN": "上移", "ja": "上へ", "ko": "위로", "es": "Subir"},
 "ruleMoveDown": {"en": "Move down", "vi": "Xuống", "zh_CN": "下移", "ja": "下へ", "ko": "아래로", "es": "Bajar"},
 "ruleEnabled": {"en": "Enabled", "vi": "Bật", "zh_CN": "启用", "ja": "有効", "ko": "사용", "es": "Activa"},
 "ruleDisabled": {"en": "Disabled", "vi": "Tắt", "zh_CN": "停用", "ja": "無効", "ko": "사용 안 함", "es": "Desactivada"},
 "ruleKindAllow": {"en": "allow", "vi": "cho phép", "zh_CN": "允许", "ja": "許可", "ko": "허용", "es": "permitir"},
 "ruleKindAsk": {"en": "ask", "vi": "hỏi", "zh_CN": "询问", "ja": "確認", "ko": "확인", "es": "preguntar"},
 "ruleKindBlock": {"en": "block", "vi": "chặn", "zh_CN": "阻止", "ja": "ブロック", "ko": "차단", "es": "bloquear"},
 "ruleId": {"en": "No layered rules yet", "vi": "Chưa có luật ba tầng", "zh_CN": "尚无分层规则", "ja": "階層ルールはまだありません", "ko": "아직 단계별 규칙이 없습니다", "es": "Aún no hay reglas por capas"},
 "ruleTopics": {"en": "topics", "vi": "chủ đề", "zh_CN": "主题", "ja": "トピック", "ko": "주제", "es": "temas"},
 "ruleKeywords": {"en": "keywords", "vi": "từ khoá", "zh_CN": "关键词", "ja": "キーワード", "ko": "키워드", "es": "palabras clave"},
 "ruleNote": {"en": "note", "vi": "ghi chú", "zh_CN": "备注", "ja": "メモ", "ko": "메모", "es": "nota"},
 "ruleCancel": {"en": "Cancel", "vi": "Huỷ", "zh_CN": "取消", "ja": "キャンセル", "ko": "취소", "es": "Cancelar"},
 "ruleSave": {"en": "Save", "vi": "Lưu", "zh_CN": "保存", "ja": "保存", "ko": "저장", "es": "Guardar"},
 "ruleInvalid": {"en": "Invalid rule rejected.", "vi": "Luật không hợp lệ đã bị từ chối.", "zh_CN": "无效规则已被拒绝。", "ja": "無効なルールは拒否されました。", "ko": "유효하지 않은 규칙이 거부되었습니다.", "es": "Regla no válida rechazada."},
 "ruleImportJson": {"en": "Import JSON", "vi": "Nhập JSON", "zh_CN": "导入 JSON", "ja": "JSON を読み込む", "ko": "JSON 가져오기", "es": "Importar JSON"},
 "ruleExportJson": {"en": "Export JSON", "vi": "Xuất JSON", "zh_CN": "导出 JSON", "ja": "JSON を書き出す", "ko": "JSON 내보내기", "es": "Exportar JSON"},
 "ruleImportPreview": {"en": "Valid", "vi": "Hợp lệ", "zh_CN": "有效", "ja": "有効", "ko": "유효함", "es": "Válido"},
 "ruleApplyImport": {"en": "Apply", "vi": "Áp dụng", "zh_CN": "应用", "ja": "適用", "ko": "적용", "es": "Aplicar"},
 "ruleDryRunLink": {"en": "Open dry-run", "vi": "Mở chạy thử", "zh_CN": "打开试运行", "ja": "ドライランを開く", "ko": "드라이런 열기", "es": "Abrir prueba"},
 "ruleDryRunHint": {"en": "Tip: keep Dry-run on while you tune the rules — everything is logged and nothing is clicked.", "vi": "Mẹo: bật chạy thử khi chỉnh luật — mọi thứ được ghi log, không bấm gì cả.", "zh_CN": "提示：调整规则时请开启试运行——一切都会记录，不会点击任何内容。", "ja": "ヒント: ルール調整中はドライランを有効に。すべて記録され、クリックは行いません。", "ko": "팁: 규칙을 조정하는 동안 드라이런을 켜 두세요. 모두 기록되고 아무것도 클릭되지 않습니다.", "es": "Consejo: mantén la prueba activa mientras ajustas las reglas: todo se registra y no se hace clic."},
 "rulesRemove": {"en": "Remove", "vi": "Xoá", "zh_CN": "删除", "ja": "削除", "ko": "삭제", "es": "Quitar"},
 "auditExportJson": {"en": "Export audit JSON", "vi": "Xuất audit JSON", "zh_CN": "导出审计 JSON", "ja": "監査 JSON を書き出す", "ko": "감사 JSON 내보내기", "es": "Exportar auditoría JSON"},
 "auditExportCsv": {"en": "Export audit CSV", "vi": "Xuất audit CSV", "zh_CN": "导出审计 CSV", "ja": "監査 CSV を書き出す", "ko": "감사 CSV 내보내기", "es": "Exportar auditoría CSV"},
 "auditWeeklyTitle": {"en": "This week", "vi": "Tuần này", "zh_CN": "本周", "ja": "今週", "ko": "이번 주", "es": "Esta semana"},
 "auditWeekClicks": {"en": "clicks", "vi": "lượt bấm", "zh_CN": "点击", "ja": "クリック", "ko": "클릭", "es": "clics"},
 "auditWeekBlocked": {"en": "blocked", "vi": "bị chặn", "zh_CN": "已阻止", "ja": "ブロック", "ko": "차단", "es": "bloqueados"},
 "auditWeekAsked": {"en": "asks", "vi": "chờ bạn", "zh_CN": "待确认", "ja": "確認待ち", "ko": "확인 대기", "es": "por revisar"},
 "auditWeekFollowups": {"en": "follow-ups", "vi": "nhắc tiếp", "zh_CN": "后续", "ja": "フォローアップ", "ko": "후속", "es": "seguimientos"},
 "auditNoData": {"en": "No data yet", "vi": "Chưa có dữ liệu", "zh_CN": "暂无数据", "ja": "データはまだありません", "ko": "아직 데이터가 없습니다", "es": "Aún no hay datos"},
}

locales = ['en', 'vi', 'zh_CN', 'ja', 'ko', 'es']
report = {}
for loc in locales:
    fp = os.path.join(base, loc, 'messages.json')
    data = json.loads(io.open(fp, encoding='utf-8').read())
    added = 0
    for k, tr in NEW.items():
        if k not in data:
            data[k] = {"message": tr[loc]}
            added += 1
    io.open(fp, 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    report[loc] = (len(data), added)
for loc, (total, added) in report.items():
    print(loc, 'total:', total, 'added:', added)
counts = {t for (t, a) in report.values()}
print('parity:', 'OK' if len(counts) == 1 else 'MISMATCH ' + str(counts))
