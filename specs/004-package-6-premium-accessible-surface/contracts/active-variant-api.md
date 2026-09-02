# Contract: Active Variant UI Route

## `POST /api/active-variant`

Visible same-origin UI capability only. This route is not registered as a WebMCP tool.

### Required request protections

- Exact same-origin `Origin`
- Valid current session cookie
- Valid current page CSRF header
- `application/json`
- Existing strict body-size limit
- Unknown keys rejected

### Request

```json
{
  "variant": "delete-account-standard",
  "expectedViewRevision": 1,
  "idempotencyKey": "80000000-0000-4000-8000-000000000301"
}
```

`variant` is exactly `delete-account-standard` or `delete-account-danger-emphasis`.
`expectedViewRevision` is a positive safe integer. `idempotencyKey` is a UUID.
Workspace and variant IDs are forbidden. A same-key, byte-identical retry returns
the original committed selection without another mutation or admission unit; reuse
of that key with a different canonical payload fails `IDEMPOTENCY_CONFLICT`.

### Success — 200

```json
{
  "ok": true,
  "data": {
    "variant": "delete-account-standard",
    "viewRevision": 2
  }
}
```

### Failure

Use the existing public error envelope. Stale CAS returns stable code
`VIEW_STATE_STALE`; conflicting key reuse returns `IDEMPOTENCY_CONFLICT`. Both use a
safe message, retryability, and correlation ID. Invalid/foreign/session failures
retain existing indistinguishable/public policy. No failure partially updates view
state, the durable selection receipt, its success audit, or admission count; no
variant selection changes implemented focus revision or history.

### Client ordering

Abort prior review/history reads → POST CAS → update active slug/view revision → clear variant-local acknowledgement/receipt/verification state → fetch review and history in parallel → re-register the two existing tools. Late responses from an older generation are ignored/aborted.
