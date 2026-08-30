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
| Hosted D1 cleanup could delete pre-existing fixed-name tables | Fixed | Preflight refuses every exact reserved name; recovery revalidates the exact gate and work-table schemas and preserves either kind of replaced sentinel table |
| Caller Origin, browser checkbox, and environment booleans were insufficient operator authorization | Fixed | Origin remains CSRF-only and the checkbox remains a human guard; both D1 actions require a 32-byte base64url operator token matched in constant time to its hosted secret digest |
| Durable D1 enablement had no server expiry | Fixed | Run and cleanup use distinct integer start/end bounds, reject inactive/malformed/expired or over-900-second windows, and cannot be enabled together |
| Concurrent/repeated hosted D1 calls could interleave | Fixed | Atomic create+insert gate admits exactly one of two concurrent calls; repeats return `409` |
| Cleanup failure depended on one 15-minute browser cookie | Fixed | With run disabled and the owner/operator/cleanup state active, the retained operator token can be re-entered from any browser; no cleanup cookie is issued or read |
| Gate state-transition failure could strand `RUNNING`, and paused pre- or post-acquisition runners could recreate schema after zero cleanup | Fixed | Gate plus work tables are acquired atomically with a database-clock window check; matching-token recovery remains blocked for 120 seconds; finalization waits through stored run expiry plus a five-second drain; delayed requests cannot create tables after finalization |
| Site creation changes `.openai/hosting.json`, invalidating the pre-creation source SHA for save | Fixed locally | Machine-tested Stage 1 requires project-ID persistence, a new commit, complete revalidation, private push, package, and save against the post-creation HEAD; deployment is a later approval |
| Run and cleanup deployment states were sequenced as one bulk environment teardown | Fixed locally | Machine-tested Stage 4 retains owner/operator authorization while switching from run-enabled to run-disabled/cleanup-enabled, then removes all temporary values only after zero-schema proof |
| Identity key validity/MAC issuance were implicit | Fixed | Response and presentation distinguish configured, issued, absent, first-sign-in, mismatch, and exact-repeat states without returning identity material |

## Boundary

This review clears the local Package 0 candidate only. It does not prove OpenAI Sites access modes, edge cookie/header behavior, managed D1 behavior, or ChatGPT Site-tools compatibility. Those rows remain `NOT_RUN` until their separately checkpointed external stages are approved and executed.
