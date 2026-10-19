## v1.22.3 — UX customer-centric 3 vòng (63 findings) · freeze 2026-10-19

**Phương pháp:** mỗi vòng 4–5 audit độc lập song song (persona người mới / quản trị thận trọng / quản lý số liệu / power-user + heuristic Nielsen-10 & WCAG 2.2 + a11y chuyên sâu), sau đó fix trong phiên chính và battery lại toàn bộ.

**Vòng 1–2 (43 findings):** onboarding 3 bullet trấn an; tag chế độ "CHẠY THỬ — KHÔNG BẤM GÌ" ngay dưới công tắc; YOLO banner cảnh báo + xác nhận "sẽ tắt Chạy thử"; status strip + Tạm dừng 15′ trong panel; anomaly guard dời lên; stats card "Tuần này" dưới KPI; chip trạng thái engine trên Stats; 2-step confirm cho xoá luật + Apply import; target 24×24; empty-state chart; đơn vị i18n; ngày chart theo locale.

**Vòng 3 — bug thật (20 findings):**
- **Dot trạng thái popup bị đảo ngược** (live → vàng) — sửa: xanh = live, vàng = dry/paused/YOLO; text dry hết tự mâu thuẫn.
- **Audit JSON luôn `rules: []`** (`projectRules` nhận Array, stats truyền object) — sửa; verify bằng node: file audit có rules đúng.
- **Chip ✕ topic/keyword xoá 1 phát** — arm 5 giây ("?" đỏ + tooltip) rồi mới xoá.
- **Quick-add "billing, payment"** lưu 1 entry không bao giờ khớp — tách dấu phẩy.
- **Export/Import rules thiếu allowTopics/blockKeywords** (mất dữ liệu khi migrate) — schemaVersion 2 đủ 3 khối, import preview đếm + Apply 2 bước.
- **Checkbox bật/tắt luật vô hình** (pattern opacity:0) + 3 nút icon <24px + pill controls <24px — sửa theo WCAG 2.5.8.
- `#layerKind` không tên + live region thiếu cho pause/dry/YOLO — thêm aria-label + role=status.
- `.unit` tràn ở ja/ko/zh/vi/es — auto width + nhãn ngắn.
- Phím tắt mới **Alt+Shift+D** (bật/tắt chạy thử) + `stateLine` tô màu theo chế độ.

**Artifact:** `dist/muse-auto-allow-v1.22.3.zip` — **267,354 bytes, 25 entries**, sha256
`74c54fa6a31fd8c4bd8cd84ef06220e53a27f9dc7e63c4046541f66ebeb8b3a0`; verify-zip **25/0/0/0**;
smoke-zip `ok: true`.

**Gates:** lint 0 (60) · yolo-ux 5 · rule-engine 20/20 · import-security 169/0 · e2e ok ·
followup 0 · mission 0 · lang-switch 0 (313×6) · codex 0 · **qa-experience 42/42**.

**Not done:** no Chrome Web Store upload (Owner gate).
