# v1.21.0 (G02): 10 keys x6 (mission config/preview/guards) -> 255 total
import json, io, os
V = {
 'missionScoped': {'en':'Scoped run','vi':'Chạy theo phạm vi','zh_CN':'限定范围运行','ja':'スコープ実行','ko':'범위 실행','es':'Ejecución acotada'},
 'missionScopedDesc': {'en':'Run a parameterised playbook on a specific project and branch.','vi':'Chạy playbook có tham số trên một dự án và nhánh cụ thể.','zh_CN':'在指定项目和分支上运行带参数的剧本。','ja':'特定のプロジェクトとブランチでパラメータ付きプレイブックを実行します。','ko':'특정 프로젝트와 브랜치에서 매개변수화된 플레이북을 실행합니다.','es':'Ejecuta un playbook con parámetros en un proyecto y una rama concretos.'},
 'missionVariables': {'en':'Playbook variables','vi':'Biến của playbook','zh_CN':'剧本变量','ja':'プレイブック変数','ko':'플레이북 변수','es':'Variables del playbook'},
 'missionPreview': {'en':'Next-step preview','vi':'Xem trước bước kế tiếp','zh_CN':'下一步预览','ja':'次のステップのプレビュー','ko':'다음 단계 미리보기','es':'Vista previa del siguiente paso'},
 'missionStart': {'en':'Preview and start','vi':'Xem trước và bắt đầu','zh_CN':'预览并开始','ja':'プレビューして開始','ko':'미리보고 시작','es':'Previsualizar y comenzar'},
 'missionCancel': {'en':'Cancel','vi':'Huỷ','zh_CN':'取消','ja':'キャンセル','ko':'취소','es':'Cancelar'},
 'missionValueInvalid': {'en':'Enter a valid value; unresolved or unsafe values cannot be sent.','vi':'Nhập giá trị hợp lệ; giá trị chưa giải quyết hoặc không an toàn sẽ không được gửi.','zh_CN':'请输入有效值；未解析或不安全的值无法发送。','ja':'有効な値を入力してください。未解決または安全でない値は送信できません。','ko':'유효한 값을 입력하세요. 미해결되거나 안전하지 않은 값은 전송할 수 없습니다.','es':'Introduce un valor válido; los valores sin resolver o inseguros no se pueden enviar.'},
 'missionUnknownToken': {'en':'This playbook has an unsupported variable token.','vi':'Playbook này chứa token biến không được hỗ trợ.','zh_CN':'此剧本包含不受支持的变量令牌。','ja':'このプレイブックには未対応の変数トークンがあります。','ko':'이 플레이북에는 지원되지 않는 변수 토큰이 있습니다.','es':'Este playbook contiene un token de variable no compatible.'},
 'missionGuardBlocked': {'en':'This playbook guard blocked the step; progress was not changed.','vi':'Chốt an toàn của playbook đã chặn bước này; tiến độ giữ nguyên.','zh_CN':'此剧本的安全防护阻止了该步骤；进度未改变。','ja':'プレイブックのガードがこのステップをブロックしました。進行状況は変わりません。','ko':'플레이북 가드가 이 단계를 차단했습니다. 진행 상황은 변경되지 않았습니다.','es':'La protección de este playbook bloqueó el paso; el progreso no cambió.'},
 'missionUnavailable': {'en':'The step is unavailable; the mission remains paused.','vi':'Bước này không khả dụng; nhiệm vụ vẫn tạm dừng.','zh_CN':'该步骤不可用；任务保持暂停。','ja':'このステップは利用できません。ミッションは一時停止のままです。','ko':'이 단계를 사용할 수 없습니다. 미션은 일시 중지 상태로 유지됩니다.','es':'El paso no está disponible; la misión permanece en pausa.'},
}
for loc in ['en','vi','zh_CN','ja','ko','es']:
    p = os.path.join('extension/_locales', loc, 'messages.json')
    s = io.open(p, encoding='utf-8').read()
    ins = ''
    for k, byLoc in V.items():
        if '"%s"' % k in s:
            continue
        ins += ',\n  "%s": {\n    "message": %s\n  }' % (k, json.dumps(byLoc[loc], ensure_ascii=False))
    if not ins:
        print(loc, 'ALREADY'); continue
    tail = s.rstrip()
    close = tail.rfind('}')
    cut = tail[:close].rstrip().rstrip(',')
    out = cut + ins + '\n}\n'
    j = json.loads(out)
    io.open(p, 'w', encoding='utf-8').write(out)
    print(loc, 'keys=' + str(len(j)))
