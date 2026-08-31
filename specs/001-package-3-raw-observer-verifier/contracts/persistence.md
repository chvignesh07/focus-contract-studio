# D1 Persistence and Atomicity Contract

## Workspace binding

Every read/write begins from server-resolved workspace and includes all necessary workspace, variant, implemented revision, session, and digest predicates. Caller-supplied workspace never reaches SQL. Composite keys/foreign keys and prepared statements prevent cross-workspace joins.

## Rehearsal finalization batch

One D1 batch performs, in dependency order:

1. insert the actual rendered manifest under a still-recording, unexpired, matching workspace/session/variant/revision;
2. insert 1–64 validated events with server-assigned contiguous sequences;
3. update exactly one recording session to finalized with server canonical digests/time;
4. insert one `focus_rehearsal_commits` finalizer whose trigger proves exact manifest/event/session completeness.

Every required statement has an exact affected-row expectation. Zero rows or any statement/finalizer error aborts the batch. No success response is built until every D1 result is inspected.

## Immutability and lifecycle

Finalized session bindings/digests, manifest, events, full-rehearsal commit, verification guard/receipt/checks/audit/commit cannot be updated or individually deleted while their workspace exists. Explicit whole-workspace cascade remains allowed under the existing retention lifecycle. No immediate-backup-erasure or separate retention claim is introduced.

## Digest recheck

Before verification, the repository selects the complete frozen rows under one workspace binding, reconstructs canonical manifest/event bytes, and compares SHA-256 values with session/full-rehearsal values using the existing constant-time helper where applicable. The critical guard repeats equality predicates inside the batch. Changed rows/order/bindings or mismatched digests fail before receipt creation.

## Verification guard and finalizer batch

Preliminary reads and pure verification are diagnostic. The authoritative batch is:

1. conditional insert of one verification guard from finalized session/full-rehearsal/active revision rows, exact digests, fixed verifier version, canonical output hash, and absent natural key;
2. insert one receipt by selecting the guard;
3. insert exactly six check rows, each selecting the guard/receipt and one canonical behavior;
4. insert one safe `verification.completed` audit through the receipt/guard;
5. insert one `verification_commits` finalizer.

The finalizer trigger proves the guard/receipt bindings, six unique canonical checks, overall reduction, exact digest/version/time state, and one safe audit. It raises on any missing/mismatched row. Code asserts exact result count and `meta.changes` for every statement. A generated failure at any step rolls back all verification rows.

## Truthful fail versus invalid input

A strict, authorized, immutable, complete session whose raw facts contradict the named configuration creates an immutable overall `fail` receipt with six truthful checks. Nonexistent/foreign/stale/wrong-revision, malformed, incomplete, expired, overflowed, tampered, post-finalize changed, or otherwise unauthorized evidence creates no receipt/check/audit/commit.

## Natural-key replay

The natural key is `(workspace_id, observation_session_id, focus-event-verifier-v1)`.

- If an existing complete receipt has identical revision/digest/environment/output bindings, return that original receipt with `idempotentReplay=true`; do not insert or project anything.
- If the natural key exists with a different requested revision/binding/output hash or incomplete rows, return conflict/internal failure without replacing or duplicating the original.
- Concurrent contenders rely on the unique natural key plus guard/finalizer. A losing contender rereads under the same workspace and returns the original only when all canonical bindings match.

## Failure and rollback contract

No invalid path changes implemented configuration, active pointers, proposals, reviews, approvals, undo/reset state, or precedent. No failed write produces a success-like receipt/audit. A safe failed-attempt log/audit, if later added under existing policy, is separate best effort and never resembles completion.

## Failure injection matrix

Real D1 tests force each of these independently and assert zero partial verification rows:

- guard returns zero rows;
- receipt insert zero/error;
- each of six check inserts zero/error;
- audit insert zero/error;
- commit finalizer zero/error and explicit trigger rejection;
- changed active revision/digest between diagnostic read and batch;
- same natural-key concurrency and same/different replay;
- database statement errors at every position.

Positive pass and valid behavioral-fail cases each leave exactly one receipt, six immutable checks, one safe audit, and one commit. No test substitutes an in-memory database for this proof.
