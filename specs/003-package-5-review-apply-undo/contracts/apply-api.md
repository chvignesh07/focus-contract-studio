# Contract: Guarded Apply

## Route

`POST /api/focus-proposals/:proposalId/apply`

Visible UI in Package 5; shared command is eligible for Package 7's future tool adapter.

## Input

```ts
{
  expectedImplementedRevision: number;
  idempotencyKey: string;
}
```

The path supplies proposal ID. No proposal body, hash, approval flag, workspace, variant, or evidence authority is caller input.

## Success

Receipt ID, proposal ID, from/to revisions, proposal digest8, replay flag, `REHEARSE_AND_VERIFY`, and applied time.

## Failure invariants

Every missing/unavailable/foreign/unsupported/unapproved/rejected/revoked/superseded/stale/applied/hash/revision/decision/idempotency/session/request-boundary/race/zero-row/injected failure creates zero product mutation. Same-key same-request recovers the committed receipt; same-key different-request returns `IDEMPOTENCY_CONFLICT`.
