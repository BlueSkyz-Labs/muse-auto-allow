# W5 ráp content.js: ruleLayers + decide + ask
import io
p = 'extension/content.js'
s = io.open(p, encoding='utf-8').read()

# 1) trạng thái layers gần allowClicks block (nơi có missionPlaybooksMeta cũ) — đặt cạnh anomaly state
a1 = "  let anomaly = null;            // sanitized MuseAnomaly settings (defaults once the boot read lands)"
assert a1 in s, 'a1'
s = s.replace(a1, "  // ---- v1.22.0 (W5/F1): ba tầng rule (allow/ask/block), CHỈ thu hẹp ------------------------\n  let ruleLayers = []; // rules.layers đã sanitize bằng MuseRules (mảng rỗng = không tầng nào)\n\n" + a1, 1)

# 2) applyV18Settings: đọc rules.layers trong nhánh rules
a2 = """    if ('rules' in s) {
      const rules = asObj(s.rules);"""
assert a2 in s, 'a2'
s = s.replace(a2, """    if ('rules' in s) {
      const rules = asObj(s.rules);
      if ('layers' in rules) {
        const rl = (typeof MuseRules !== 'undefined' && MuseRules) ? MuseRules.sanitize(rules.layers) : null;
        ruleLayers = rl && rl.ok ? rl.layers : []; // v1.22.0 (W5/F1)
      }""", 1)

# 3) blockReasonFor -> decide (fallback nguyên trạng khi thiếu module)
a3 = """  function blockReasonFor(cardText, ctx) {
    if (v18.yoloMode) return null; // v1.9.4 YOLO: block rules are bypassed by explicit opt-in
    const kw = keywordIn(String(cardText || '') + ' ' + String(ctx || ''));
    if (kw) return 'keyword:' + kw;
    if (v18.allowTopics.length) {
      const topic = String(extractTopic(ctx || cardText || '')).toLowerCase();
      if (!v18.allowTopics.some((x) => x.toLowerCase() === topic)) return 'topic';
    }
    return null;
  }"""
assert a3 in s, 'a3'
s = s.replace(a3, """  function blockReasonFor(cardText, ctx) {
    if (v18.yoloMode) return null; // v1.9.4 YOLO: block rules are bypassed by explicit opt-in
    const textAll = String(cardText || '') + ' ' + String(ctx || '');
    // v1.22.0 (W5/F1): ba tầng rule đi qua mô-đun thuần; 'ask:<reason>' là tín hiệu KHÔNG bấm
    // và để người dùng tự xử lý (khác 'blocked' = vi phạm quy tắc an toàn). Mọi screen khác
    // (connector/auth/token) vẫn nằm sau bước này và KHÔNG rule nào gỡ được.
    if (typeof MuseRules !== 'undefined' && MuseRules && !v18.yoloMode) {
      const topic = String(extractTopic(ctx || cardText || '')).toLowerCase();
      const d = MuseRules.decide({
        topic, text: textAll.toLowerCase(), yolo: false,
        legacy: { blockKeywords: v18.blockKeywords, allowTopics: v18.allowTopics },
      }, ruleLayers);
      if (d && d.action === 'block') return d.reason || 'rule';
      if (d && d.action === 'ask') return 'ask:' + (d.reason || 'rule');
      if (d && (d.action === 'allow' || d.action === 'none')) return null;
    }
    // fallback nguyên trạng (khi mô-đun thiếu): hành vi cũ từng byte
    const kw = keywordIn(textAll);
    if (kw) return 'keyword:' + kw;
    if (v18.allowTopics.length) {
      const topic = String(extractTopic(ctx || cardText || '')).toLowerCase();
      if (!v18.allowTopics.some((x) => x.toLowerCase() === topic)) return 'topic';
    }
    return null;
  }""", 1)

# 4) noteAsk + noteNotClick sau noteBlocked
a4 = """    console.log('[muse-auto-allow] blocked (' + reason + ') \"' + entry.label + '\"');"""
assert a4 in s, 'a4'
s = s.replace(a4, a4 + """
  }
  // v1.22.0 (W5/F1): 'ask' = chưa chắc — KHÔNG bấm, để người dùng tự xử lý. Dedup như blocked;
  // KHÔNG tăng bộ đếm click; CÓ tăng bộ đếm asked (digest) và log kind 'ask'.
  function noteAsk(label, text, fpKey) {
    const key = (fpKey || String(text || '').slice(0, 160)) + '|ask';
    const t0 = blockedFps.get(key);
    if (t0 && Date.now() - t0 < BLOCKED_DEDUP_MS) return;
    blockedFps.set(key, Date.now());
    if (blockedFps.size > 200) blockedFps.delete(blockedFps.keys().next().value);
    const entry = { at: new Date().toISOString(), kind: 'ask', label: String(label || '').slice(0, 60), blockedReason: 'ask', context: String(text || '').slice(0, 240) };
    if (v18.dryRun) entry.dryRun = true;
    state.lastResult = entry;
    recordClick(entry, entry.context, false);
    bumpDigest({ asked: 1 });
    console.log('[muse-auto-allow] ask "' + entry.label + '"');
  }
  // Một cửa cho các "không bấm vì lý do": ask:... -> noteAsk, còn lại -> noteBlocked.
  function noteNotClick(label, reason, text, fpKey) {
    if (String(reason || '').startsWith('ask:')) noteAsk(label, text, fpKey);
    else noteBlocked(label, reason, text, fpKey);""", 1)

# 5) thay 5 chỗ noteBlocked(reason từ blockReasonFor) -> noteNotClick
repls = [
 ("        if (reason) { noteBlocked(txt(b), reason, cardText, 'card:' + cardText.slice(0, 160)); return false; }",
  "        if (reason) { noteNotClick(txt(b), reason, cardText, 'card:' + cardText.slice(0, 160)); return false; }"),
 ("          if (reason) { noteBlocked(txt(b), reason, cardText, 'pair:' + cardText.slice(0, 160)); break; }",
  "          if (reason) { noteNotClick(txt(b), reason, cardText, 'pair:' + cardText.slice(0, 160)); break; }"),
 ("      if (reason) { noteBlocked('expand', reason, t, 'expand:' + t.slice(0, 160)); continue; }",
  "      if (reason) { noteNotClick('expand', reason, t, 'expand:' + t.slice(0, 160)); continue; }"),
 ("      if (reason) { noteBlocked('open-panel', reason, t, 'surface:' + t.slice(0, 160)); continue; }",
  "      if (reason) { noteNotClick('open-panel', reason, t, 'surface:' + t.slice(0, 160)); continue; }"),
]
for old, new in repls:
    assert old in s, 'repl: ' + old[:60]
    s = s.replace(old, new, 1)

# 6) digestDelta + bump + flush cho asked
a6 = "  const digestDelta = { clicks: 0, followups: 0, blocked: 0 };"
assert a6 in s, 'a6'
s = s.replace(a6, "  const digestDelta = { clicks: 0, followups: 0, blocked: 0, asked: 0 }; // v1.22.0 (W5): + asked", 1)
a7 = """      digestDelta.blocked += Number(delta.blocked) || 0;"""
assert a7 in s, 'a7'
s = s.replace(a7, a7 + "\n      digestDelta.asked += Number(delta.asked) || 0;", 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('content.js W5 patch 1 xong')

# kiểm tra chỗ flush (đọc lại để xem reset & gộp)
i = s.find('d.blocked = (Number(d.blocked) || 0) + digestDelta.blocked;')
print(s[i-220:i+320])
