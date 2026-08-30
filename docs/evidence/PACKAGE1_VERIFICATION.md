# Package 1 Local Verification

<!-- package1-source-binding file_count=42 sha256=44b42d3031ce2e25b2ef0c6c93582aea0824889a8384681c857832d95a7724fe -->

Status: **LOCAL CANDIDATE PASS; HOSTED NOT RUN**

Package 1 implements the additive Revision 2 domain schema, anonymous signed session, deterministic workspace seed/reset, strict request boundary, composite workspace isolation, bounded lifecycle cleanup, caller-independent admission fuse, append-only/state-transition triggers, and declared read-query indexes. This result is local Worker/D1 evidence only. It does not change Package 0's `INCONCLUSIVE` supported ChatGPT/WebMCP row and does not claim a saved or deployed Sites version.

The tracked artifact cannot self-reference the commit that contains it. It is instead bound to the 42 implementation/configuration/test files by SHA-256 manifest digest `44b42d3031ce2e25b2ef0c6c93582aea0824889a8384681c857832d95a7724fe`, based on public base commit `3465d339d8c6dd61f0c67023d3be01e6386c00a5`. A checked consistency verifier requires this Markdown marker and both Package 1 JSON evidence artifacts to match that live manifest, and rejects semantic drift in local/hosted status, exit code, test totals, audits, external actions, secret handling, or the Markdown status/count claims. It does not independently rerun or prove those observations. The canonical command runs it last, after the tests, build, and audits. The final handoff separately reports the exact post-commit clean-clone verification.

## Canonical candidate run

| Fact | Observation |
|---|---|
| Command | `npm run verify:package1` |
| UTC interval | `2026-08-30T18:53:55Z` — `2026-08-30T18:54:25Z` |
| Exit | `0` |
| Runtime | Node `v22.22.3`; npm `10.9.8`; workerd `1.20260730.1`; Wrangler `4.116.0` |
| Package 0 regressions | `80/80 PASS` |
| Package 1 Node tests | `10/10 PASS` |
| Package 1 Workerd/D1 tests | `59/59 PASS` across 11 files; `remoteBindings: false` |
| Build | `PASS`; five Vinext environments; session bootstrap/reset routes emitted |
| Audits | runtime graph `0` vulnerabilities; complete locked graph `0` vulnerabilities at every severity; gitleaks `8.30.1` found no secret in reachable history or the working tree |

## Exit-gate result

| Assertion | Result | Reproducible proof |
|---|---|---|
| Two independent sessions cannot observe each other | `PASS` | `tests/package1/workspace-isolation.test.ts`; the Package 1 variant read begins with the server-resolved workspace predicate, and foreign/nonexistent IDs share one status, error shape, body-size class, and safe message. |
| Two independent sessions cannot mutate each other | `PASS` | The tested cross-workspace view-state mutation is rejected before the CAS update; the target workspace remains unchanged. Reset accepts no workspace ID and scopes every row to the resolved session. |
| Reload preserves current state | `PASS` | `tests/package1/session.test.ts` resolves the same workspace/generation/CSRF derivation without duplicate seed rows. |
| Deterministic isolated seed/reset | `PASS` | Exact product/family/use-case/slugs, two revision-1 configurations focusing Delete, active standard variant, and synthetic D001/Cancel; paired resets prove same-key convergence and different-key zero-losing-mutation behavior. |
| Fresh/repeated/additive upgrade migration | `PASS` | Real workerd D1 tests preserve Package 0 parent/child data, the exact Package 0 durable-gate sentinel, and unrelated pre-existing data. Static regression forbids destructive migration verbs or Package 0-owned statements. Reviewed SQL is the sole migration authority; the incomplete Drizzle generator path is executable and fail-closed. |
| Declared read-query indexes | `PASS` | The seven runtime read-returning queries share one inventory; `EXPLAIN QUERY PLAN` asserts their named indexes or explicit primary-key one-row bound. Separate affected-row/concurrency tests cover mutation guards. Precedent eligibility and result paths are independently bounded to 36. |
| Session/request fail-closed behavior | `PASS` | 256-bit signed cookie; Secure/HttpOnly/host-only/Strict attributes; malformed/tampered/future/expired rejection; POST/JSON/origin/CSRF checks; incremental stream cancellation before over-limit bodies are fully consumed; strict reset schema. |
| Anonymous mutation admission | `PASS` | Atomic D1 global windows admit exactly 32 new bootstraps or resets per 60 seconds under concurrency, reject the next with `429`, and create zero workspace/idempotency mutation. No caller-supplied identity or Origin value keys the fuse. |
| Privacy inventory | `PASS` | Actual bootstrap and rejected typed-input routes receive email/name/IP/typed markers; the D1 row scan and public response checks find none. Raw bearer/CSRF markers are also absent from D1. Static checks cover every `app/**` and `lib/**` production path except two exact Package 0 identity-only files. This is a D1/response test, not a claim about hosted platform logs. |
| Graph integrity and purge | `PASS` | `retrieval_results.workspace_id` is D1 `NOT NULL`; replay rows cannot be directly deleted; a representative 23-entity graph rejects every retained child delete and then reaches zero only through workspace cascade. D1 accepts exactly the 24 canonical focus configurations and their matching SHA-256 hashes, rejects malformed/unknown/invalid-order/hash-mismatched immutable revisions, enforces same-workspace/variant revision parents and same-workspace proposal parents, rejects self-parent and multi-row proposal cycles, and binds an applied revision to the exact committed receipt. Injected mid-batch reset failure leaves the prior graph intact, creates no successor/idempotency result, and returns retryable `RESET_FAILED`. |
| Hosted D1/session/client behavior | `NOT_RUN` | External deployment and hosted mutation were explicitly forbidden for this package. |

## Commands

```sh
npm run test:package1:node
npm run test:package1:d1
npm run verify:package1:source-binding
npm run verify:package1:evidence-binding
npm run verify:package1
gitleaks git --redact --no-banner --log-level error --log-opts=--all .
gitleaks dir --redact --no-banner --log-level error .
```

The canonical gate also runs Package 0 regressions, TypeScript, ESLint, the production build, the runtime-only audit, and the complete locked-graph audit. Removing the unused `drizzle-kit` generator eliminated the earlier development-only advisory chain; both current audit scopes report zero vulnerabilities.

## Security properties

- Browser payloads never select a workspace, subject, role, session, or owner identity.
- The cookie signature and subject digest are domain separated; only digests persist.
- A present invalid cookie never silently creates a replacement workspace.
- New anonymous graph mutations pass an atomic server-global fuse; Origin remains CSRF-only and never authorizes a caller.
- Reset replay derives the rotated token deterministically from the original bearer plus the idempotency key, so a lost response can recover the identical cookie without storing it.
- Every workspace-owned relationship uses an explicit workspace column and database constraints; sensitive repository reads start with the workspace predicate.
- A constant 24-row D1 value-object view plus insert triggers enforce byte-canonical focus JSON and exact SHA-256 hashes without a platform-specific SQL hashing function; proposals must use one of the same canonical configurations.
- Deferred composite self-foreign keys enforce revision and proposal lineage; a recursive same-workspace insert guard rejects self-parent and multi-row cycles; application finalization requires the new revision to cite the exact receipt being committed.
- `retrieval_results.workspace_id` is non-null in both D1 and typed declarations, so `NULL` cannot bypass composite workspace foreign keys.
- Cleanup selects at most ten expired anonymous workspace IDs, tolerates overlapping cleaners without a spurious failure, and deletes only selected cascaded graphs.
- Immutable evidence and idempotency rows reject direct update/delete while whole-workspace purge remains available; the complete 23-entity cascade and pointer/state transitions are database-enforced.
- Mid-batch reset failure is atomic and retryable; a genuine competing reset retains its distinct already-completed response.
- D1 proposal/retrieval circular integrity is tested in both insertion orders using the officially documented `PRAGMA defer_foreign_keys = on` transaction pattern.
- Package 0 identity-header evidence remains insufficient, so raw ChatGPT identity headers are ignored and its helper is not imported.
- The evidence verifier is explicitly a semantic consistency check, not hosted or runtime proof; mutation regressions reject altered hosted status, failing exit codes, partial test counts, external-action claims, secret-recording claims, and rewritten Markdown status.

## Remaining boundary

Package 1 is ready as a local dependency for Package 2 after its containing commit passes the required fresh no-hardlinks clone gate. No Sites version was saved or deployed, no hosted D1 row was written, and no real ChatGPT tool observation was performed. The 32-per-minute values are conservative local safety defaults, not validated hosted capacity promises; deployment/load qualification remains outside this package and was not authorized.
