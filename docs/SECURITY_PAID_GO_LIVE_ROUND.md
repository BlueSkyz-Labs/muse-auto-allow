# Security & Paid Go-Live Round — charter (queued after the UI upgrade round)

Prompt: `docs/SGPS_SECURITY_PAID_v1.6_ROUND_PROMPT.md` (owner-supplied, vendored verbatim).
This charter maps that operating prompt onto THIS product. Status: **AUDIT ROUND RUN** — the audit
lane produced `docs/SECURITY_V19_AUDIT.md` at the frozen revision `9e6b151` (v1.9.1); remediation
(S12), independent re-attack (S13) and the rebind remain separate lanes.

## Routing record

```
python scripts/sgps_prompt_router.py --mode AUDIT_PLAN \
  --signals "security go-live assurance, attack chains, ai agentic security, supply chain,
             paid readiness" --repo "C:/00. AI Project/muse-auto-allow"
→ pack=owner-dir-2026-10-04 pack_verified=YES · ROLES: security
→ LOAD: 00_SGPS_COMMON_EXECUTION_KERNEL_v1.0 + 01_SGPS_AI_FACTORY_MASTER_v2.0 +
        04_SGPS_SECURITY_PAID_v1.6
→ security signals matched: security, supply, chain, go-live, paid
```

Stage -1 gates run first; all findings bind to `DISCOVERED_ON_SHA / FIXED_ON_SHA /
VERIFIED_ON_SHA`. Prior security lineage (redteam v1–v4 + experience review) is **prior
evidence only** — it must rebind to the frozen revision (S8), never close a new HEAD
(S15-S04).

## Section → product application map

| SGPS section | Application to Muse Auto-Allow (Chrome MV3 extension, zero backend, zero deps) |
|---|---|
| S1 binding | SHAs for every finding; artifact hash of the zip; deployed revision = the user's loaded unpacked revision (`Secure Preferences` read) |
| S2 threat-model regen | New baseline = v1.7.0 freeze. Trigger: path E + follow-up (agentic send authority!) + import/backup + encryption — all NEW authority surfaces since the v1–v3 threat model |
| S3 attack chains | Pre-seeded targets: (A) page-content trickery → the auto-clicker clicking non-approval UI (pair+exact-text+bounds rails; re-attack each); (B) approval-text XSS via log → popup/stats (esc() rails; import path too); (C) crafted backup file (V4-1 lineage — re-attack the sanitizer); (D) storage tampering by another local extension/user; (E) compromised update channel (unpacked dir = user's machine trust); (F) **delegated-approval impersonation** — the core product risk: the extension grants approvals in the user's name; compromised account + auto-allow = queued approvals granted (accepted-risk R8–R11, re-verify mitigations: toggle, log, caps); (G) follow-up automation = send-authority: could page content steer the typed prompt or the timing? (idle mis-detection → unwanted sends; cap/cooldown rails); (H) rate-cap/resource abuse; (I) reliability adversary (fail-open vs fail-closed under odd DOM). |
| S4 appsec | Popup/stats XSS surfaces (esc + innerHTML audit), CSP (explicit now), no secrets (repo grep), sensitive logs (local only), unsafe file handling (import), TOCTOU on storage RMW (Web Locks), wrongful grant/denial equivalence (never click Deny / never lone Allow) |
| S5 AI/agentic | This product IS an agentic tool: `LOWER-TRUST INPUT (page DOM) → DECISION (detection heuristics) → TOOL CALL (click/type) → REAL EFFECT (approval granted)`. Hunt prompt-injection-style DOM trickery, delegated-approval impersonation, excessive permission (it has `all_frames` + click authority), unsafe retries (rate caps), data exfiltration (must stay zero-network — lint gate) |
| S6 supply chain | Zero dependencies (verify: no package.json/node_modules in the package), build from repo scripts only, no CI/CD in scope (local repo), artifact = zip byte-verified; refute/confirm "no transitive exposure" with evidence, not assertion |
| S7/S8 evidence classes | Map to the repo's own evidence classes; earlier redteam verdicts = STALE unless rebound |
| S9–S11 money/paid | **Current state: NOT_APPLICABLE — there is no payment, provider, webhook, entitlement or ledger anywhere in this product.** The round must state this explicitly and NOT manufacture a paid model. IF the owner decides a paid path (licensing/subscription for a future Pro tier), then S9–S11 become the entry gate for that design: canonical authority per state, replay/dedup/idempotency, sandbox/prod isolation, negative tests — no build may ship a payment path without this round's map being extended |
| S12 remediation | Fix loop with re-attack + alternate-bypass + regression guard, all against exact SHAs |
| S13 closure rebind | Any P0/P1 closes only on the frozen revision with runtime proof where required (e.g. loaded-extension behavior, not just source) |
| S14 verdict | Honest axis: `PAID_GO` is NOT claimable while the paid surface is N/A — the achievable verdicts are security assurance for a FREE go-live (`GO`-equivalent) + `CONDITIONAL` items (owner TODO list) + paid-path readiness = `NOT_VERIFIED` (nothing to verify yet). Never claim more (S15 rails) |
| S15 negative acceptance | The 15 fails apply as written (esp. S15-S04/S05/S07/S08/S13/S14/S15) |

## Deliverable

`docs/SECURITY_GO_LIVE_REPORT.md` — Vietnamese CXO-level, following the prompt's OUTPUT
sections verbatim (LIVE TRUTH SNAPSHOT → … → NEXT SECURITY ACTION), with the attack-chain
table (S3 fields), evidence-qualified severities, and the honest verdict section.

## Execution shape

1. AUDIT (read-only lanes): threat-model regen + attack chains + full-surface probe; findings table bound to SHAs.
2. REMEDIATE (fix loop, coordinator or lane): S12 per finding.
3. RE-ATTACK + REBIND (independent lane — maker ≠ judge; the security reviewer must not share the maker's oracle, S15-S14).
4. Verdict + CXO report + owner decision list.

## Non-goals

- No feature work (UI or behavior) in this round — audit/fix/attest only.
- No payments/WEBHOOK/LEDGER code may be introduced without explicit owner direction; the
  paid sections map to a DESIGN GATE for any future monetization, documented as such.
