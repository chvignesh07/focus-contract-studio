# Contract: Visible Proposal Review

## Route

`POST /api/focus-proposals/:proposalId/review`

Same-origin visible UI only. This route is not registered through WebMCP.

## Input

Strict union:

- `{ action: "approve" | "reject" | "revoke", idempotencyKey: UUID }`
- `{ action: "edit", configuration: ImplementedFocusConfiguration, summary: string, idempotencyKey: UUID }`

Workspace, proposal hash, base revision, reviewer identity, page session, and evidence snapshot are server-resolved.

## Success

- Decision: exact append-only decision ID, proposal ID, digest8, base revision, action, effective state, replay flag, created time.
- Edit: immutable reviewer child ID, parent ID, digest8, changed fields, `NOT APPLIED`, replay flag, created time.

## Failures

Strict input/request-boundary errors; `PROPOSAL_NOT_FOUND`; `STALE_REVISION`; invalid transition; `IDEMPOTENCY_CONFLICT`; safe internal error. Foreign and nonexistent proposals are identical publicly.
