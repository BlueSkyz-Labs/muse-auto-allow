# UX Vòng 3B — i18n cuối, unit CSS, aria labels, live regions, pill 24px, shortcut dry-run
import io, json, os
base = r'C:\Users\thinh\dev\muse-auto-allow'
lbase = base + r'\extension\_locales'

CHG = {
 "modeSim": {"en": "DRY RUN — NOTHING IS CLICKED", "vi": "CHẠY THỬ — KHÔNG BẤM GÌ", "zh_CN": "试运行——不会点击", "ja": "ドライラン — クリックしません", "ko": "드라이런 — 클릭하지 않습니다", "es": "SIMULACIÓN — NO SE HACE CLIC"},
 "ruleConfirmDelete": {"en": "Tap again", "vi": "Bấm lần nữa", "es": "Toca otra vez", "ja": "もう一度押す", "ko": "다시 누르기", "zh_CN": "再次点击"},
 "ruleConfirmApply": {"en": "Replace $1? Tap again", "vi": "Thay $1 luật? Bấm lại", "es": "¿Reemplazar $1? Toca otra vez", "ja": "$1 件を置き換え？もう一度押す", "ko": "규칙 $1개 교체? 다시 누르세요", "zh_CN": "替换 $1 条？再次点击"},
 "tabWord": {"en": "tabs", "es": "pestañas"},
 "anomalyRateLabel": {"en": "Sustained rate (clicks)", "vi": "Tốc độ bấm duy trì (lượt bấm)", "zh_CN": "持续点击频率（次）", "ja": "継続的な頻度（クリック）", "ko": "지속 속도(클릭)", "es": "Ritmo sostenido (clics)"},
 "anomalyDurationLabel": {"en": "Auto-pause duration", "vi": "Thời lượng tự tạm dừng", "zh_CN": "自动暂停时长", "ja": "自動一時停止の時間", "ko": "자동 일시중지 시간", "es": "Duración de la pausa automática"},
 "anomalyPauseState": {"vi": "Tự động tạm dừng đến $1 — phát hiện hoạt động bấm bất thường"},
 "yoloNote": {"vi": "Bỏ qua chặn từ khoá, bấm cả quyền vĩnh viễn, tốc độ nhanh nhất. Không bao giờ bấm Deny; connector vẫn thủ công."},
 "yoloConfirm": {"vi": "Bấm Allow sẽ được tự động, kể cả quyền vĩnh viễn. Bấm lần nữa để xác nhận."},
 "followupCombineHint": {"vi": "Bấm vào câu lệnh để ghép — nối theo thứ tự trong thư viện.", "zh_CN": "点击短语即可组合 — 按库中顺序拼接。"},
 "followupRotateStarterConfirm": {"vi": "Thay thế $1 combo đã lưu? Bấm lần nữa", "zh_CN": "替换已保存的 $1 个组合？再次点击", "ko": "저장된 조합 $1개를 바꿀까요? 다시 누르세요"},
 "logOpenRules": {"vi": "Mở luật từ khoá"},
 "rulesIgnoredYolo": {"vi": "YOLO đang bật — các luật chủ đề và từ khoá vẫn được lưu nhưng không có hiệu lực. Tắt YOLO để áp dụng lại."},
 "unitMs": {"ja": "ms", "ko": "ms", "zh_CN": "ms"},
 "unitPerMin": {"zh_CN": "/分"},
}
NEW = {
 "tabWordOne": {"en": "tab", "vi": "tab", "zh_CN": "标签页", "ja": "タブ", "ko": "탭", "es": "pestaña"},
 "ariaRuleKind": {"en": "Rule type", "vi": "Loại luật", "zh_CN": "规则类型", "ja": "ルールの種類", "ko": "규칙 유형", "es": "Tipo de regla"},
 "ariaTopics": {"en": "Topics", "vi": "Chủ đề", "zh_CN": "主题", "ja": "トピック", "ko": "주제", "es": "Temas"},
 "ariaKeywords": {"en": "Keywords", "vi": "Từ khoá", "zh_CN": "关键词", "ja": "キーワード", "ko": "키워드", "es": "Palabras clave"},
 "shortcutDryRun": {"en": "Toggle dry-run (log only)", "vi": "Bật/tắt chạy thử (chỉ ghi log)", "zh_CN": "切换试运行（仅记录）", "ja": "ドライランを切り替え", "ko": "드라이런 전환", "es": "Alternar prueba (solo registro)"},
}
for loc in ['en', 'vi', 'zh_CN', 'ja', 'ko', 'es']:
    fp = os.path.join(lbase, loc, 'messages.json')
    d = json.loads(io.open(fp, encoding='utf-8').read())
    for k, v in CHG.items():
        if loc in v and k in d and d[k]['message'] != v[loc]: d[k]['message'] = v[loc]
    for k, v in NEW.items():
        if k not in d: d[k] = {"message": v[loc]}
    io.open(fp, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
print('i18n 3B done, total:', len(d))

# ============ popup.html: unit CSS, pill 24, live regions, sdot ============
p = base + r'\extension\popup.html'
s = io.open(p, encoding='utf-8').read()
a = "  .numwrap .unit { flex: 0 0 18px;"
assert a in s
s = s.replace(a, "  .numwrap .unit { flex: 0 0 auto; min-width: 18px;", 1)
# pill 24px cho hàng thao tác chính
for cls in ['.pbtn', '.langbtn', '.safetybtn', '.qbtn', '.rbtn']:
    needle = '  ' + cls + ' {'
    assert needle in s, cls
    i = s.find(needle); j = s.find('}', i)
    if 'min-height' not in s[i:j]:
        s = s[:j] + '; min-height: 24px; ' + s[j:]
# live regions
a2 = '<span id="ssText">Live</span>'
assert a2 in s
s = s.replace(a2, '<span id="ssText" role="status" aria-live="polite">Live</span>', 1)
a3 = '<span class="pstate" id="pstateText"></span>'
assert a3 in s
s = s.replace(a3, '<span class="pstate" id="pstateText" role="status" aria-live="polite"></span>', 1)
# sdot.warn light contrast
a4 = "  .sdot.warn { background: #d69614; }"
assert a4 in s
s = s.replace(a4, "  .sdot.warn { background: #8a5a10; } /* v1.22.2: >=3:1 on the light fill */", 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('popup.html 3B done')

# stats sdot
p = base + r'\extension\stats.html'
s = io.open(p, encoding='utf-8').read()
a5 = "  .sstatus .sdot.warn { background: #d69614; }"
assert a5 in s
s = s.replace(a5, "  .sstatus .sdot.warn { background: #8a5a10; }", 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('stats.html 3B done')

# ============ popup.js: aria labels + tabWordOne + shortcut? (aria helper) ============
p = base + r'\extension\popup.js'
s = io.open(p, encoding='utf-8').read()
a6 = "  aria('safetyClose', 'closeLabel', 'Close');"
assert a6 in s
s = s.replace(a6, """  aria('safetyClose', 'closeLabel', 'Close');
  aria('layerKind', 'ariaRuleKind', 'Rule type'); // v1.22.2 UX (Vòng 3): the layer form had no accessible names
  aria('layerTopics', 'ariaTopics', 'Topics');
  aria('layerKeywords', 'ariaKeywords', 'Keywords');""", 1)
a7 = "      tx.textContent = n > 0 ? (n + ' ' + t('tabWord', 'tab')) : '0'; // v1.22.2 UX: label says what is counted; zero stays compact"
assert a7 in s
s = s.replace(a7, "      tx.textContent = n > 1 ? (n + ' ' + t('tabWord', 'tabs')) : n === 1 ? ('1 ' + t('tabWordOne', 'tab')) : '0'; // v1.22.2 UX: label + plural; zero stays compact", 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('popup.js 3B done')

# ============ manifest + background: shortcut toggle-dry-run ============
p = base + r'\extension\manifest.json'
m = json.load(io.open(p, encoding='utf-8'))
cmds = m.setdefault('commands', {})
if 'toggle-dry-run' not in cmds:
    cmds['toggle-dry-run'] = {"suggested_key": {"default": "Alt+Shift+D"}, "description": "__MSG_shortcutDryRun__"}
    m['commands'] = cmds
    io.open(p, 'w', encoding='utf-8').write(json.dumps(m, ensure_ascii=False, indent=2) + "\n")
    print('manifest: toggle-dry-run added')
else:
    print('manifest: already present')
