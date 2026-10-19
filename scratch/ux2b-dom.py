# Vòng UX 2B — DOM/CSS/JS: mode tag, chip tách nút, 2-step confirm, a11y 24px, stats status, empty charts
import io, json, os
base = r'C:\Users\thinh\dev\muse-auto-allow'
lbase = base + r'\extension\_locales'

# key chartEmpty ×6
CH = {"en": "No history yet — the chart appears after the first click", "vi": "Chưa có lịch sử — biểu đồ hiện sau lượt bấm đầu tiên", "zh_CN": "暂无记录——首次点击后显示图表", "ja": "履歴はまだありません — 最初のクリック後に表示されます", "ko": "기록이 없습니다 — 첫 클릭 후 차트가 표시됩니다", "es": "Aún no hay historial: el gráfico aparece tras el primer clic"}
for loc, msg in CH.items():
    fp = os.path.join(lbase, loc, 'messages.json')
    d = json.loads(io.open(fp, encoding='utf-8').read())
    if 'chartEmpty' not in d: d['chartEmpty'] = {"message": msg}
    io.open(fp, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
print('chartEmpty added, total:', len(d))

# ================= popup.html =================
p = base + r'\extension\popup.html'
s = io.open(p, encoding='utf-8').read()

# 1) safetyChip ra khỏi nút Safety (đọc như nhãn trạng thái, không phải "Chạy thử >")
a = """      <span data-i18n="safetyOpen">Safety</span><span class="schip" id="safetyChip" hidden></span><svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>"""
assert a in s
s = s.replace(a, """      <span data-i18n="safetyOpen">Safety</span><svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <span class="schip" id="safetyChip" hidden></span>""", 1)

# 2) mode tag dưới toggle auto-click
a = """  <label class="sw"><input type="checkbox" id="enabled"> <span class="track" aria-hidden="true"><span class="knob"></span></span> <span data-i18n="toggleLabel">Auto-click Allow</span></label>"""
assert a in s
s = s.replace(a, a + """
  <div class="modetag" id="modeTag" hidden>SIMULATION — NOT CLICKING</div>""", 1)

# 3) ruleOrderHint visible trước danh sách luật
a = """        <div id="layersList"></div>"""
assert a in s
s = s.replace(a, """        <div id="layersList"></div>
        <div class="rnote" data-i18n="ruleOrderHint">Order only matters within the same layer — block always wins</div>""", 0)  # no-op guard below
# chèn đúng (không thay thế hiện có)
assert a in s
s = s.replace(a, """        <div class="rnote" data-i18n="ruleOrderHint">Order only matters within the same layer — block always wins</div>
        <div id="layersList"></div>""", 1)

# 4) mini empty label
a = '<svg id="mini" width="292" height="46" aria-hidden="true"></svg>'
assert a in s
s = s.replace(a, a + '\n  <div class="miniEmpty" id="miniEmpty" hidden data-i18n="chartEmpty">No history yet — the chart appears after the first click</div>', 1)

# 5) đơn vị qua i18n
for old, key in [
  ('<span class="unit muted">ms</span>', 'unitMs'),
  ('<span class="unit muted">s</span>', 'unitSec'),
  ('<span class="unit muted">min</span>', 'unitMin'),
  ('<span class="unit muted">/min</span>', 'unitPerMin'),
]:
    s = s.replace(old, '<span class="unit muted" data-i18n="' + key + '">' + old.split('>')[1].split('<')[0] + '</span>')

# 6) CSS
a = "  .schip.warn { background: rgba(214,150,20,.16); color: #8a5a10; border-color: rgba(214,150,20,.48); } /* v1.22.1 UX: YOLO reads as a warning state */"
assert a in s
s = s.replace(a, a + """
  .modetag { display: inline-block; margin: 5px 0 2px 26px; font-size: 10px; font-weight: 600; letter-spacing: .05em;
             padding: 1px 8px; border-radius: 999px; }
  .modetag.sim { background: rgba(214,150,20,.16); color: #8a5a10; border: 1px solid rgba(214,150,20,.48); }
  .modetag.live { background: rgba(194,38,63,.10); color: #a51e35; border: 1px solid rgba(194,38,63,.32); }
  @media (prefers-color-scheme: dark) {
    .modetag.sim { background: rgba(242,180,53,.16); color: #f2b435; border-color: rgba(242,180,53,.45); }
    .modetag.live { background: rgba(255,130,150,.14); color: #ff9db0; border-color: rgba(255,130,150,.34); }
  }
  .miniEmpty { font-size: 11px; color: var(--muted); padding: 8px 0 4px; }""", 1)
a2 = "  .stateline .stsurf { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }"
assert a2 in s
s = s.replace(a2, "  .stateline .stsurf { min-width: 0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; white-space: normal; line-height: 1.4; } /* v1.22.2 UX: long state sentences wrap (2 lines) instead of clipping mid-word */", 1)
a3 = ".lrow [data-act] { font: inherit; font-size: 11px;"
assert a3 in s
s = s.replace(a3, ".lrow [data-act] { min-width: 24px; min-height: 24px; font: inherit; font-size: 11px;", 1)
a4 = "  .rchip .rx { flex: none; font: inherit; font-size: 10px;"
assert a4 in s
s = s.replace(a4, "  .rchip .rx { flex: none; min-width: 24px; min-height: 24px; font: inherit; font-size: 10px;", 1)
a5 = "  .obfoot {"
assert a5 in s
i = s.find(a5); j = s.find('}', i)
s = s[:i] + ".obfoot { margin-top: auto; padding-top: 8px; " + s[i+len('.obfoot {'):]
io.open(p, 'w', encoding='utf-8').write(s)
print('popup.html 2B done')

# ================= stats.html =================
p = base + r'\extension\stats.html'
s = io.open(p, encoding='utf-8').read()
a = """    <div class="seg" id="seg">"""
assert a in s
s = s.replace(a, """    <span class="sstatus" id="statsStatus"><span class="sdot" id="stDot" aria-hidden="true"></span><span id="stText">…</span></span>
    <div class="seg" id="seg">""", 1)
a2 = "  .wk b { color: var(--ink); }"
assert a2 in s
s = s.replace(a2, """  .sstatus { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border: 1px solid var(--line);
             border-radius: 999px; font-size: 12px; color: var(--ink-2); background: var(--surface); }
  .sstatus .sdot { width: 7px; height: 7px; border-radius: 50%; background: #2f9e6e; }
  .sstatus .sdot.warn { background: #d69614; }
  .chart #chartEmpty { font-size: 12px; color: var(--ink-2); padding: 26px 0 0; }
  .wk b { color: var(--ink); }""", 1)
# chart empty node
a3 = '<svg id="chart" viewBox="0 0 720 158" role="img" aria-labelledby="ccap"></svg>'
assert a3 in s
s = s.replace(a3, a3 + '\n    <div id="chartEmpty" hidden data-i18n="chartEmpty">No history yet — the chart appears after the first click</div>', 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('stats.html 2B done')
