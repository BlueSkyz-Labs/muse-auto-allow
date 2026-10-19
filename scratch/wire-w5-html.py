# W5 ráp popup.html: digest asked + CSS + layers UI + scripts
import io
p = 'extension/popup.html'
s = io.open(p, encoding='utf-8').read()

# (a) dòng đếm digest: thêm asked
a1 = """          <span class="dstat"><b id="dBlocked">0</b><span data-i18n="digestBlocked">blocked</span></span>
        </div>"""
assert a1 in s, 'a1'
s = s.replace(a1, """          <span class="dstat"><b id="dBlocked">0</b><span data-i18n="digestBlocked">blocked</span></span>
          <span class="dstat"><b id="dAsked">0</b><span data-i18n="digestAsked">asks</span></span>
        </div>""", 1)

# (b) CSS: chip ask + rule rows + import textarea
a2 = '.k-blocked { background: rgba(194,38,63,.12); color: #a51e35; }'
assert a2 in s, 'a2'
s = s.replace(a2, a2 + """
  .k-ask { background: var(--fill); color: var(--ink); } /* v1.22.0 (W5): 'ask' — trung tính, không phải lỗi */""", 1)
a3 = '.licchip {'
assert a3 in s, 'a3'
s = s.replace(a3, """.lrow { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
  .lrow .lkind { flex: none; font-size: 10px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
                 border-radius: 999px; padding: 0 6px; border: 1px solid var(--stroke); color: var(--muted); }
  .lrow .lkind.allow { color: var(--accent-text); border-color: var(--accent-line); background: var(--accent-tint); }
  .lrow .lkind.block { color: #a51e35; background: rgba(194,38,63,.10); border-color: rgba(194,38,63,.35); }
  .lrow .ltxt { flex: 1; min-width: 0; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lrow .lx { flex: none; }
  .lrow [data-act] { font: inherit; font-size: 11px; background: transparent; border: 1px solid var(--stroke);
                     border-radius: 6px; color: var(--muted); cursor: pointer; padding: 0 5px; line-height: 1.5; }
  .lrow [data-act]:hover { color: var(--ink); border-color: var(--stroke-hover); }
  .limport { width: 100%; box-sizing: border-box; font: inherit; font-size: 11px; min-height: 56px;
             border-radius: 8px; border: 1px solid var(--stroke); background: var(--fill); color: var(--ink); resize: vertical; }
  .licchip {""", 1)

# (c) khối layers UI: chèn sau nhóm kwGroup (tìm mốc kết thúc kwGroup bằng dòng chứa kwInput + nút)
i = s.find('id="kwGroup"')
assert i >= 0, 'kwGroup'
# tìm div rgroup kết thúc của kwGroup: lấy từ i tới '</div>' thứ 3 sau đó
j = s.find('<div class="rgroup"', i + 10)
assert j > i, 'next rgroup'
block = """      <!-- v1.22.0 (W5/F1) — Luật ba tầng (allow/ask/block): CHỈ thu hẹp — block thắng, ask =
           để người dùng tự xử lý, allow hoạt động như danh sách cho phép bổ sung. Các screen
           connector/auth là bất biến và không luật nào gỡ được. -->
      <div class="rgroup" id="layersGroup">
        <div class="rlabel" data-i18n="rulesTitle">Layered rules (allow / ask / block)</div>
        <div class="rnote" data-i18n="rulesDescription">Block wins over everything. Ask leaves the card to you. Allow narrows what may be clicked — it never widens anything.</div>
        <div id="layersList"></div>
        <div class="row field fset">
          <select id="layerKind" class="licinput" style="flex:0 0 auto; width:86px">
            <option value="block" data-i18n="ruleKindBlock">block</option>
            <option value="ask" data-i18n="ruleKindAsk">ask</option>
            <option value="allow" data-i18n="ruleKindAllow">allow</option>
          </select>
          <input type="text" id="layerTopics" class="licinput" placeholder="topics: a, b" data-i18n-ph="ruleTopics">
        </div>
        <div class="row field fset">
          <input type="text" id="layerKeywords" class="licinput" placeholder="keywords: x, y" data-i18n-ph="ruleKeywords">
          <button type="button" class="btn" id="layerAdd" data-i18n="ruleAdd">Add rule</button>
        </div>
        <div class="row licro">
          <button type="button" class="btn" id="layerExport" data-i18n="ruleExportJson">Export JSON</button>
          <button type="button" class="rbtn" id="layerImportOpen" data-i18n="ruleImportJson">Import JSON</button>
        </div>
        <div id="layerImportBox" hidden>
          <textarea id="layerImport" class="limport" spellcheck="false" data-i18n-ph="ruleImportPreview" placeholder="Paste rules JSON…"></textarea>
          <div class="row licro">
            <button type="button" class="btn" id="layerImportCheck" data-i18n="ruleImportPreview">Validate</button>
            <button type="button" class="rbtn" id="layerImportApply" data-i18n="ruleApplyImport" disabled>Apply</button>
          </div>
        </div>
        <div class="misnote" id="layerNote" role="status"></div>
        <div class="rnote" data-i18n="ruleDryRunHint">Tip: keep Dry-run on while you tune the rules — everything is logged and nothing is clicked.</div>
      </div>
"""
s = s[:j] + block + s[j:]

# (d) scripts: rules.js + audit.js trước popup.js
a4 = '  <script src="license-pubkey.js"></script>'
assert a4 in s, 'a4'
s = s.replace(a4, '  <script src="rules.js"></script>\n  <script src="audit.js"></script>\n  ' + a4, 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('popup.html W5 done')
