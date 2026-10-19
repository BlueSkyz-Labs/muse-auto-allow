# GOLIVE PAID — readiness dossier (Muse Auto-Allow)

> **Status: DRAFT v2 (2026-10-18, overnight autonomous cycle).** Governed by **SGPS-DEC-2026-016
> (Paid Go-Live Assurance)** — adopted for this project (`docs/SGPS_ADOPTION.md` §3.3). **No paid
> capability may be enabled, and no payment account touched, without an explicit Owner decision**
> (`SELLER_AUTHORITY` / `PRODUCT_ELIGIBILITY` / Paid-GO are Owner gates). Nothing in this dossier
> changes extension behavior by itself.

## 1. Grounded facts (E0 — desk research, verifiable)

1. **Chrome Web Store payments are dead and cannot be used.** Google deprecated CWS payments in
   Sept 2020; since **2021-02-01** items could no longer charge money, and the Licensing API was
   scheduled for shutdown. New paid items have been impossible since Sept 2020.
   Sources: <https://developer.chrome.com/docs/webstore/cws-payments-deprecation.md.txt>,
   <https://9to5google.com/2020/09/22/google-chrome-paid-extensions-deprecation/> (checked
   2026-10-18).
2. **Therefore a paid Chrome extension is sold OUTSIDE the store.** The listing stays free; the
   money flow lives on our own site/payment links; the extension enforces an entitlement it can
   verify (license key / server check). Google's own guidance says: pick another payment
   processor + build your own license tracking.
3. Store-side options for recurring/one-time monetization of an extension are limited to:
   (a) external license-key sale (own site, Lemon Squeezy/Paddle/Gumroad/Stripe), (b) an external
   SaaS component the extension talks to, (c) sponsorship/donation (not "paid" per se).

## 2. Monetization options (analysis)

**Owner decision 2026-10-19: option C — freemium PRO with offline license keys** (core + safety
stay free forever; `docs/LICENSING_DESIGN.md` governs the scheme). Price point and sales channel
remain Owner-pending. The table below is the original option analysis (kept for context).

| Option | What user buys | Effort | Risk |
|---|---|---|---|
| **A. One-time lifetime license key** (recommended candidate) | a key enabling PRO features forever, offline-verifiable | M | key sharing/piracy; no recurring revenue |
| B. Subscription (Paddle/LS) with periodic server re-check | per-month/year entitlement | L (server + billing + support) | churn management, payment ops, refund policy load |
| C. Freemium: free core + one paid PRO tier via key (A with a feature split) | same as A but keeps free tier = funnel | M+ | feature-split discovery; more pricing questions for owner |

Common to all: **the product already has the right bones** — zero-dependency, no network code,
minimal permissions; a license check must be added as the ONLY network exception and must fail
safe (offline grace, never block core safety features silently).

## 3. DEC-016 readiness matrix (the conjunctive contract — every dimension explicit)

Governed by **SGPS-DEC-2026-016 (Paid Go-Live Assurance)**, adopted in `docs/SGPS_ADOPTION.md`
§3.3. States are `PASS | FAIL | NOT_VERIFIED` with justified non-applicability separate. No
weighted score, no partial credit: **any applicable FAIL ⇒ `PAID_GO_LIVE_BLOCKED`; else any
NOT_VERIFIED ⇒ `PAID_GO_LIVE_NOT_VERIFIED`; else all PASS/justified N/A ⇒ `PAID_GO_LIVE_READY`.**
**Current aggregate: `PAID_GO_LIVE_NOT_VERIFIED`** (expected — nothing enabled yet).

| # | Dimension | State | What would satisfy it | Gate |
|---|---|---|---|---|
| 1 | `SELLER_AUTHORITY` | NOT_VERIFIED | legal seller entity, tax identity, payout account verified | **Owner** |
| 2 | `PRODUCT_ELIGIBILITY` | NOT_VERIFIED | pricing + free/PRO feature split decided (§2 choice A/B/C) | **Owner** |
| 3 | `CHANNEL_POLICY` | NOT_VERIFIED | current CWS listing policy text verified for external-purchase links | agent research → Owner |
| 4 | `LEGAL_ECOMMERCE` | NOT_VERIFIED | ToS + Refund policy + Privacy policy (license-data addendum) published | Owner (legal) |
| 5 | `TAX_INVOICE` | NOT_VERIFIED (scope TBD) | VN e-invoice / e-commerce obligations for the chosen model | **Owner** |
| 6 | `PAYMENT_INTEGRITY` | NOT_VERIFIED | PSP selection + hosted checkout + webhook verification strand (hosted = no card data in our systems) | **Owner** |
| 7 | `BILLING_LIFECYCLE` | justified N/A for one-time model | mandatory only for recurring/metered — if option B chosen: dunning/cancel/pause design | Owner (via §2 choice) |
| 8 | `ENTITLEMENT` | NOT_VERIFIED | license scheme: offline-verifiable signed keys, enforcement points, fail-safe + offline grace, no paid safety rails | design here → **Owner approves** |
| 9 | `REFUND_DISPUTE` | NOT_VERIFIED | refund policy + dispute process (PSP-hosted where possible) | **Owner** |
| 10 | `SETTLEMENT_PAYOUT` | NOT_VERIFIED | payout destination + schedule verified | **Owner** |
| 11 | `RECONCILIATION` | NOT_VERIFIED | payment ↔ license-issuance readback/reconciliation procedure | design → Owner |
| 12 | `SECURITY_PCI` | NOT_VERIFIED (hosted-checkout scope claim) | provider's hosted-checkout PCI statement verified; extension never sees card data | Owner verify |
| 13 | `PRIVACY_DATA` | PARTIAL | extension posture clean (no telemetry); license data (email+key) handling documented in the privacy addendum | agent draft → Owner publish |
| 14 | `OPS_SUPPORT` | NOT_VERIFIED | support channel + key-recovery flow + response expectations | **Owner** |
| 15 | `RESILIENCE_EXIT` | NOT_VERIFIED | license sunset / offline-grace policy confirmed (export + kill-switch already exist) | design → Owner |

**Authority invariants (never conflated):**
`PAYMENT != SUBSCRIPTION != ENTITLEMENT != AUTHORIZATION` · `CHECKOUT_SUCCESS != SETTLEMENT` ·
`SETTLEMENT != PAYOUT` · `REFUND_REQUESTED != REFUND_SETTLED` · `PROVIDER_ACTIVE !=
ENTITLEMENT_AUTHORIZED` · `SANDBOX_PASS != PAID_PRODUCTION_PASS` · `PAID_GO_LIVE_READY !=
WORK_READY != RELEASED`.

## 4. Owner gates and prohibitions (must stay manual)

1. **Paid GO** switch — nothing is charged/enabled until the Owner approves pricing + channel.
2. Payment account creation / KYC / tax identity — Owner-only.
3. Signing keys for license generation — Owner-held secret; never in repo.
4. Publishing any "PRO" feature split that changes Product Truth (safety rails stay free forever).
5. The extension stays network-free until a license design is Owner-approved; a future license
   exchange is an external side effect under **SGPS-DEC-2026-040** (intent ID, definite
   non-execution evidence, idempotency scope, readback/reconciliation) — see
   `docs/SGPS_ADOPTION.md` §3.5. Agents never touch payment/provider accounts.

## 5. Open decisions for the owner (morning review)

1. Money model: one-time (A) vs subscription (B) vs freemium PRO (C)?
2. Price point(s) for VN/international, and launch channel (own site vs Gumroad/LS).
3. Which new capabilities become PRO vs free (candidate PRO ideas to be red-teamed after the
   SGPS experience pass; core auto-allow + safety rails stay free).
