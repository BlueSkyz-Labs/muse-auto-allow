# 30 vòng tự động — điều phối bằng SGPS v1.5 + harness (owner 2026-10-19)

**Luật chơi (bất biến trong cả 30 vòng):**
1. Mỗi vòng = 1 lăng kính (1 prompt kit hoặc 1 chủ đề con) → audit độc lập bằng subagent FREE-TIER
   (vision chỉ khi phải NHÌN ảnh → pin mimo tạm rồi restore, theo dispatch router).
2. Findings phải có **evidence** (ảnh render thật / dòng code / output test). Không bịa, không lặp
   mục đã DONE trong `docs/UX_BACKLOG_2026-10-19.md` / `docs/SECURITY_FINDINGS.md`.
3. Fix do **phiên chính** thực hiện (không giao child sửa code chính). Tối đa 3-5 fix/vòng để giữ
   battery nhanh; fix lớn → tách wave có owner approval riêng.
4. Battery tối thiểu mỗi vòng: `lint` + unit liên quan + `e2e` (nếu đụng runtime). Battery đầy đủ
   (12 suite + qa) mỗi 3 vòng hoặc trước khi cắt release.
5. Commit mỗi vòng (message `round NN: …`), log vào `docs/ROUNDS_30_LOG.md` (vòng, prompt, findings,
   fix, evidence, trạng thái). Không commit khi battery đỏ.
6. Owner gates giữ nguyên: CWS upload, giá/kênh, key ceremony, SGPS pin, central registry, paid
   capability. Không mở gate trong 30 vòng.
7. Dừng sớm chỉ khi: (a) 3 vòng liên tiếp 0 finding thật; (b) battery không thể xanh vì blocker
   môi trường; (c) owner can thiệp. Ngoài ra chạy đủ 30.

## Phân bổ 30 vòng theo kit

| Vòng | Prompt | Lăng kính |
|---|---|---|
| 1-8 | 02 UX | first-run · safety panel · stats/trust · i18n 6 locale · a11y/WCAG · power-user · edge/empty/error · visual polish |
| 9-14 | 03 Security | storage & crypto · DOM sinks/XSS · message passing · permissions/CSP · supply chain/zero-dep · injection & prompt-abuse |
| 15-20 | 04/05 Paid | license gate offline · trial/upgrade UX · audit export value · team seed · docs/claims truth · paid readiness matrix |
| 21-26 | 06 Release | artifact integrity · zip/packaging · locale parity · smoke on clean profile · rollback · store packet truth |
| 27-30 | 07 Continue | regression sweep · flake hunt · perf/size · docs/ledger convergence |

## Trạng thái

- Round 0 (nền): v1.22.3 SHIPPED; Wave A (v1.22.4) implemented, battery đang xác minh.
- Round 1.. bắt đầu sau khi v1.22.4 xanh.
