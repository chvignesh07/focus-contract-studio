# Contract: History, Undo, and Reset

## History

`GET /api/focus-history` returns the current workspace/variant/revision, safe bounded chronological `Package5HistoryRecord[]`, and current actionable proposal/application/verification state. It is no-store and does not refresh, clean up, or mutate product state.

## Undo

`POST /api/focus-revisions/:revision/undo`

Strict input: `{ expectedImplementedRevision: number, idempotencyKey: UUID }`.

The chosen source revision and current active revision are server-authorized. Success returns the new revision result, from/source/to revisions, replay flag, and created time. No pointer rewind or old-approval reuse is possible.

## Reset

Existing `POST /api/session/reset` remains the sole reset persistence route. Package 5 UI requires deliberate confirmation and recovers uncertain responses with the original key. Success returns the replacement workspace generation, new CSRF token/cookie, and replay flag; prior/current-other workspace data is never exposed.
