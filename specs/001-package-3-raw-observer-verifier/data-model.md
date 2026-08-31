# Phase 1 Data Model: Package 3 Raw Observer and Independent Verifier

This design extends the existing D1 entities. Names below are planned schema/domain names, not evidence that migrations or code exist.

## Closed value sets

- `FocusTargetId`: `dialog-title | reason-input | cancel-button | delete-button`
- `TriggerTargetId`: `delete-trigger`
- `EventType`: `dialog_open | focusin | keydown | dialog_close | focus_return`
- `KeyName`: `Tab | Escape`
- `CloseReason`: `escape | cancel | delete`
- `Environment`: `browser | playwright`
- `SessionState`: `recording | finalized | verified_pass | verified_fail`
- `Behavior`: `initialFocus | focusOrder | trapTab | trapShiftTab | escapeAction | returnFocus`
- `CheckResult`: `pass | fail | not_observed`
- `OverallResult`: `pass | fail`
- `VerifierVersion`: `focus-event-verifier-v1`

Unknown fields or values are invalid. Target IDs are data enums, never caller-supplied selectors.

## Observation session state

Existing `observation_sessions` remains the session authority:

| Field | Source | Rule |
|---|---|---|
| `id` | Server-generated opaque UUID | Never selected by client as authority; validated before lookup. |
| `workspace_id` | Server session | Present in every child key/query. |
| `variant_id` | Server active subject | Bound at start and immutable. |
| `implemented_revision` | Server active subject | Named revision frozen at start. |
| `environment` | Strict bounded request enum | Diagnostic metadata only. |
| `nonce_digest` | Server-generated nonce material hashed with domain separation | Raw nonce never persisted/logged. |
| `state` | Server transition | `recording -> finalized -> verified_pass|verified_fail`; no reverse transition. |
| timestamps | Server clock | Nonnegative; expiry is at most 30 seconds after start for acceptance. |
| `manifest_digest`, `event_digest` | Server canonical SHA-256 | Required at finalization and immutable. |

Unfinished/invalid/expired sessions remain ineligible and follow ordinary workspace cleanup. No new retention system or deletion promise is introduced.

## Rendered manifest

Exactly one existing `rendered_manifests` row is frozen per finalized full rehearsal. Canonical content, in fixed key order, is:

| Field | Validation |
|---|---|
| `manifestVersion` | Fixed `focus-manifest-v1`. |
| `targetIds` | Unique present IDs from the closed set, including `delete-trigger`; no selector or text payload. |
| `tabbableOrder` | Unique actual rendered tabbable dialog controls; same set as the configured focus order for a passing trace. |
| `dialogName` | Actual normalized accessible name derived from the live dialog's naming references. The closed server schema bounds and allowlists the controlled value only after capture; it never fills or overwrites the observation from expected copy. |
| `dialogDescription` | Actual normalized accessible description derived from the live dialog's description references, then bounded/allowlisted without expected-copy substitution. |
| `role` | `dialog`. |
| `ariaModal` | Boolean actual DOM fact. |
| `open` | Boolean actual DOM fact at capture. |
| `variantId` | Server-returned active variant ID, cross-checked against session. |
| `implementedRevision` | Server-returned revision, cross-checked against session. |

`manifest_hash` is lowercase SHA-256 of UTF-8 canonical JSON. The server reconstructs canonical bytes from parsed fields; caller serialization is never trusted.

## Observation event

Each existing `observation_events` row is immutable and belongs to the same workspace/session. The strict union is:

| Event | Required facts | Forbidden facts |
|---|---|---|
| `dialog_open` | target `delete-trigger` | key, Shift, close reason |
| `focusin` | closed focus target | key, Shift, close reason |
| `keydown` | closed focus target, key `Tab` or `Escape`, Boolean Shift | close reason, arbitrary key text |
| `dialog_close` | allowlisted reason | key, Shift, arbitrary target/text |
| `focus_return` | target `delete-trigger` | key, Shift, close reason |

The client sends an ordered array with no authoritative sequence field. The server assigns persisted `sequence = array index + 1` after validating 1–64 events and bounded monotonic client offsets. The finalizer rejects stored gaps, duplicates, invalid first/last shape, duration beyond 30 seconds, or any row outside the closed grammar. Canonical event bytes use the persisted server sequence and fixed field order; absent optional fields serialize as explicit `null` only in the server canonical form.

## Full rehearsal finalization

New `focus_rehearsal_commits` is a one-row finalizer/marker for a complete Package 3 session:

| Field | Rule |
|---|---|
| `session_id` | Primary key and workspace-scoped foreign key to `observation_sessions`. |
| `workspace_id`, `variant_id`, `implemented_revision` | Exact immutable binding copied through guarded `SELECT`. |
| `manifest_digest`, `event_digest` | Equal the finalized session and recomputed child bytes. |
| `event_count` | Integer 1–64 and equal actual row count. |
| `finalized_at` | Server time within the start/expiry window. |

Its `BEFORE INSERT` trigger proves session state/digests, exactly one manifest, contiguous sequences, valid bounds, and matching workspace/variant/revision. Update/delete triggers preserve immutability while the workspace exists. Whole-workspace cascade remains the only lifecycle deletion.

The Package 3 migration replaces the Package 2 broad partial uniqueness index with finalizer-specific Package 2 uniqueness enforcement, so the two-event opening report remains idempotent while full rehearsals can coexist for a revision.

## Verifier input and output

`VerifierInput` is an in-memory immutable value assembled by the server repository:

- session/workspace/variant/revision identity;
- bounded environment;
- parsed frozen manifest plus stored/recomputed digest;
- parsed ordered raw events plus stored/recomputed digest;
- strict canonical implemented configuration.

`VerifierOutput` contains exactly six checks in the canonical behavior order. Each check contains `behavior`, `result`, and an ascending unique list of existing raw event sequences. It contains no expected/generated events, storage handle, retrieval/model/proposal value, or side-effect capability.

## Verification guard

New `verification_guards` is an ephemeral authority row retained with the workspace to make the critical write predicates inspectable:

| Field | Rule |
|---|---|
| `id` | Pre-generated opaque guard ID. |
| natural key | Unique `workspace_id + observation_session_id + verifier_version`. |
| binding | Workspace, variant, implemented revision, manifest/event digests, environment, active-at-verification. |
| result binding | Canonical verifier output hash and overall result. |
| created time | Nonnegative server time. |

The insert is `INSERT ... SELECT` from finalized session/manifest/full-rehearsal/revision/active-state rows with every authoritative predicate. A zero-row guard produces zero product write.

## Verification receipt and check

Existing `verification_receipts` gains/uses the complete immutable binding:

| Field | Rule |
|---|---|
| receipt/session/workspace/variant/revision | Exact guard binding. |
| `environment` | Bounded copied session metadata. |
| `verifier_version` | Fixed v1; part of natural key. |
| `result` | `pass` only when all six checks pass, else `fail`. |
| `event_digest`, `manifest_digest` | Equal the guard and finalized session. |
| `active_at_verification` | Boolean captured inside guard; Package 3 rejects a stale requested revision, so successful writes record true. |
| `created_at` | Verification time. |

Exactly six existing `verification_checks` rows are written in canonical behavior order, each with one of the three results and canonical ascending sequence JSON. The pair `(receipt, behavior)` is unique.

New `verification_commits` finalizes the batch. Its trigger requires one matching guard, receipt, all six unique behaviors, valid overall reduction, one safe `verification.completed` audit, exact digest/binding equality, and no Package 3 precedent/review/configuration row. Receipt, checks, guard, audit, and commit are immutable within workspace retention.

## Privacy inventory

Allowed persisted observation data is limited to stable IDs, closed enums, Booleans, small integers, bounded environment, timestamps, digests, and safe opaque IDs. Safe logs/evidence may contain correlation ID, operation, result, duration bucket, source/runtime identity, and non-reversible bounded identifier digests.

The following never enter manifests, events, checks, receipts, audits, logs, URLs, public errors, or evidence artifacts: textarea/input values; arbitrary DOM text; rationale; clipboard; full DOM/HTML; caller selectors; keys other than Tab/Escape and Shift; raw session/cookie/CSRF/identity/workspace material; sensitive marker content; stack/SQL/binding detail.

## Relationships and invariants

```text
workspace
  -> active variant -> implemented revision
  -> observation session
       -> one rendered manifest
       -> 1..64 ordered observation events
       -> one full rehearsal commit
       -> one verification natural key per verifier version
            -> one verification guard
            -> one verification receipt
                 -> exactly six verification checks
            -> one safe audit
            -> one verification commit
```

- Every arrow is workspace-bound.
- The verifier can read only the immutable subtree plus the named configuration.
- A well-formed behavioral mismatch creates a fail receipt; malformed/unauthorized/tampered/incomplete evidence creates none.
- Same natural key/same canonical request recovers the original receipt. Same natural key/different binding conflicts without replacement.
- No Package 3 entity can approve, review, apply, undo, reset, project precedent, or change the active configuration.
