# Package 0 Adversarial Review

Evidence ID: `E-018`  
Review date: **2026-08-29/30 EDT**  
Package 0 local-candidate result: **PASS**  
Hosted/release result: **NOT_RUN**

Two independent read-only reviewers challenged correctness, evidence integrity, security boundaries, and hosted-probe reachability. Every reported high/medium local code finding was reproduced or directly traced, fixed at the root, regression-tested, and re-reviewed. The bounded machine summary is `.artifacts/reviews/package0-independent-review.json`.

## Closed findings

| Finding | Disposition | Regression / proof |
|---|---|---|
| Identity UI could appear green without a trusted header plus exact repeat comparison | Fixed | Missing/invalid key is `INCONCLUSIVE`; MAC issuance is explicit; only configured + issued + repeat `true` can pass; hosted-handler tests |
| Minimal request evidence predated the corrected Workerd start path | Fixed | Rebuilt Worker request requires status, expected content, byte count, and hashes; `.artifacts/test/package0-local-request.json` |
| Hosted D1 cleanup could delete pre-existing fixed-name tables | Fixed | Preflight refuses either reserved work table and preserves a seeded sentinel |
| Browser checkbox was mistaken for a server authorization boundary | Fixed | Copy calls it a human confirmation; server separately requires owner-only confirmation, an enable flag, and an atomic durable one-shot gate |
| Concurrent/repeated hosted D1 calls could interleave | Fixed | Atomic create+insert gate admits exactly one of two concurrent calls; repeats return `409` |
| Cleanup failure could leave owned schema without a supported recovery | Fixed | Token-bound finalizer removes owned work plus gate and proves zero residual tables; forced cleanup-failure regression |
| Gate state-transition failure could strand `RUNNING` | Fixed | With the mutation flag off, a matching token may recover `RUNNING` only after a 120-second lease; pre-lease rejection and post-lease zero-schema regression |
| Identity key validity/MAC issuance were implicit | Fixed | Response and presentation distinguish configured, issued, absent, first-sign-in, mismatch, and exact-repeat states without returning identity material |

## Boundary

This review clears the local Package 0 candidate only. It does not prove OpenAI Sites access modes, edge cookie/header behavior, managed D1 behavior, or ChatGPT Site-tools compatibility. Those rows remain `NOT_RUN` until the single external-action checkpoint is approved and executed.
