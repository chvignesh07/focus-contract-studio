# Rehearsal API Contract

All operations are same-origin UI routes. They reuse the existing server session, workspace resolver, strict JSON parser, Origin/CSRF checks, safe public error envelope, and `Cache-Control: no-store`. No request accepts `workspaceId`, authoritative `variantId`, or an implemented configuration.

## Request boundary

Every mutation accepts only `POST`, `Content-Type: application/json`, a bounded body, strict known fields, a valid server session, same Origin, and the UI synchronizer CSRF token. Opaque IDs are format-checked before repository access. `GET`, wrong methods/types, oversized/malformed JSON, unknown fields, invalid IDs, absent/invalid session, cross-origin, or absent/invalid CSRF fail before product writes. Page-bound agent execution, if a later package calls the shared operation, receives ordinary server authorization and gains no metadata authority.

Responses use `no-store`. No session/cookie/CSRF/identity/workspace/raw-event content appears in URLs or errors.

## Start rehearsal

`POST /api/rehearsals/start`

Strict request:

```json
{"environment":"browser"}
```

`environment` is `browser | playwright`; it is bounded diagnostic metadata, not authority.

Success creates one `recording` session and returns only:

```json
{
  "ok": true,
  "rehearsal": {
    "rehearsalSessionId": "opaque-id",
    "variantId": "opaque-id",
    "implementedRevision": 1,
    "expiresAt": "server-time"
  }
}
```

Workspace, active variant/revision, nonce, and time are server-derived. Start cannot alter configuration/review/proposal state and cannot create a receipt.

## Complete rehearsal

The browser starts from focused `delete-trigger`, opens the dialog, captures the actual manifest, records first focus, performs one full forward traversal, observes forward wrap, observes backward wrap, presses Escape before destructive dispatch, observes escape close, and observes focus return to `delete-trigger`.

Production code records user/browser-dispatched facts. It must not dispatch synthetic focus movements as evidence, read proposal/precedent outcomes, generate expected events, or decide verification results.

## Finalize rehearsal

`POST /api/rehearsals/{rehearsalSessionId}/finalize`

Strict request contains:

- `manifest`: the closed fields in `data-model.md#rendered-manifest`;
- `events`: 1–64 strict union members in browser observation order;
- each event has bounded `clientOffsetMs` only as diagnostic time;
- no client authoritative sequence, workspace, configuration, text/value, selector, or expected result.

The path ID is validated, then queried only under server workspace. The server cross-checks manifest variant/revision with the session, validates nondecreasing offsets within 30 seconds, assigns sequences from accepted array order, reconstructs canonical bytes, and writes the manifest/events/session digests/finalizer atomically.

Success returns the session ID, named revision, immutable digests, event count, and `finalized` state. It does not return raw event content or a verification result.

## Server ordering

Array order is untrusted input order; persisted order becomes authoritative only after strict validation and server assignment. The finalizer proves stored sequences are unique and contiguous from 1 through the exact event count. Any stored/input discontinuity, duplicate, overflow, timeout, unknown union member, or inconsistent manifest/binding aborts finalization.

## Bounds and invalid finalization

- Maximum 64 accepted events and maximum 30,000 milliseconds from start.
- Unknown targets/types/keys/reasons/fields, invalid key/Shift combinations, invalid offsets, zero events, duplicates/gaps after persistence, expired sessions, or non-recording sessions are invalid.
- A repeated finalize cannot mutate frozen rows. A byte-identical retry may return the already-finalized identity only after the server proves exact digests; a different payload conflicts.
- Invalid/interrupted/expired sessions never become verification evidence.

These are fail-safe ceilings. Hosted capacity/limit claims remain unconfirmed until later deployed load proof.

## Public errors and ID oracle

Foreign and nonexistent rehearsal IDs use the same `REHEARSAL_NOT_FOUND` envelope, HTTP status, padded response-size class, and timing budget. Incomplete/expired sessions use the applicable stable non-oracular error after workspace-scoped lookup. Public errors contain only code, safe message, retryable flag, and correlation ID. Private safe logging may distinguish internal causes without raw payload or identity.

## Route negative matrix

For start, finalize, and verify adapters, contract tests cover wrong method, state-changing GET, wrong/missing JSON content type, oversized/malformed body, unknown field, malformed opaque ID, absent/invalid session, cross-origin request, missing/invalid UI CSRF, and safe no-store responses. Finalize/verify additionally compare foreign and nonexistent ID code/status/size/timing classes. Every rejected case asserts zero Package 3 success rows and unchanged configuration/review state.
