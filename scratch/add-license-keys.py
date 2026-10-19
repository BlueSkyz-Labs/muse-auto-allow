# v1.21.0 (W4): 14 license keys x6 locales (245 total)
import json, io, os
V = {
 'licenseTitle': {'en':'License','vi':'Bản quyền','zh_CN':'许可证','ja':'ライセンス','ko':'라이선스','es':'Licencia'},
 'licenseFree': {'en':'Free','vi':'Miễn phí','zh_CN':'免费','ja':'無料','ko':'무료','es':'Gratis'},
 'licensePro': {'en':'PRO','vi':'PRO','zh_CN':'PRO','ja':'PRO','ko':'PRO','es':'PRO'},
 'licenseTokenPlaceholder': {'en':'Paste license token','vi':'Dán mã bản quyền','zh_CN':'粘贴许可证令牌','ja':'ライセンストークンを貼り付け','ko':'라이선스 토큰 붙여넣기','es':'Pega el token de licencia'},
 'licenseActivate': {'en':'Activate','vi':'Kích hoạt','zh_CN':'激活','ja':'有効化','ko':'활성화','es':'Activar'},
 'licenseDeactivate': {'en':'Deactivate','vi':'Hủy kích hoạt','zh_CN':'停用','ja':'無効化','ko':'비활성화','es':'Desactivar'},
 'licenseActivated': {'en':'License activated.','vi':'Đã kích hoạt bản quyền.','zh_CN':'许可证已激活。','ja':'ライセンスを有効化しました。','ko':'라이선스가 활성화되었습니다.','es':'Licencia activada.'},
 'licenseDormant': {'en':'License activation is not configured yet.','vi':'Tính năng kích hoạt bản quyền chưa được cấu hình.','zh_CN':'尚未配置许可证激活。','ja':'ライセンス有効化はまだ設定されていません。','ko':'라이선스 활성화가 아직 구성되지 않았습니다.','es':'La activación de licencia aún no está configurada.'},
 'licenseMalformed': {'en':'This license token is malformed.','vi':'Mã bản quyền không đúng định dạng.','zh_CN':'许可证令牌格式不正确。','ja':'ライセンストークンの形式が正しくありません。','ko':'라이선스 토큰 형식이 올바르지 않습니다.','es':'El token de licencia tiene un formato incorrecto.'},
 'licenseBadSignature': {'en':'This license token could not be verified.','vi':'Không thể xác minh mã bản quyền.','zh_CN':'无法验证许可证令牌。','ja':'ライセンストークンを検証できませんでした。','ko':'라이선스 토큰을 검증할 수 없습니다.','es':'No se pudo verificar el token de licencia.'},
 'licenseWrongProduct': {'en':'This license is for a different product.','vi':'Bản quyền này thuộc sản phẩm khác.','zh_CN':'此许可证属于其他产品。','ja':'このライセンスは別の製品のものです。','ko':'이 라이선스는 다른 제품용입니다.','es':'Esta licencia es de otro producto.'},
 'licenseExpired': {'en':'This license has expired.','vi':'Bản quyền đã hết hạn.','zh_CN':'许可证已过期。','ja':'ライセンスの有効期限が切れています。','ko':'라이선스가 만료되었습니다.','es':'Esta licencia ha caducado.'},
 'licenseClockGrace': {'en':'Clock moved backward; temporary verification grace is active.','vi':'Đồng hồ bị lùi; đang áp dụng thời gian ân hạn tạm thời.','zh_CN':'时钟回拨；临时验证宽限期已生效。','ja':'時計が巻き戻りました。一時的な猶予期間が有効です。','ko':'시계가 뒤로 이동했습니다. 임시 유예가 적용됩니다.','es':'El reloj retrocedió; hay un periodo de gracia temporal.'},
 'licenseStorageError': {'en':'Could not save the license. Try again.','vi':'Không lưu được bản quyền. Thử lại.','zh_CN':'无法保存许可证，请重试。','ja':'ライセンスを保存できませんでした。再試行してください。','ko':'라이선스를 저장할 수 없습니다. 다시 시도하세요.','es':'No se pudo guardar la licencia. Inténtalo de nuevo.'},
}
fails = 0
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
print('OK' if not fails else 'FAIL')
