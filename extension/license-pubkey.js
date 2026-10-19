// v1.21.0 (W4) — committed license PUBLIC key holder. DORMANT BY DESIGN: null until the Owner's
// key ceremony (docs/W4_LICENSE_IMPL_PLAN.md §4/§6). The release build must NEVER contain a real
// product public key before that ceremony, and never any private key or test fixture key at all —
// scripts/lint.mjs enforces both (LICENSE-PUBKEY-DORMANT + LICENSE-TEST-KEY-NOT-IN-RELEASE).
// The Owner ceremony replaces `null` with the JWK exported from the custody key;
// test fixtures generate their own keypairs in-test (never committed).
var MAA_LICENSE_PUBKEY = null;
