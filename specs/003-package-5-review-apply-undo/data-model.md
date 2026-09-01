# Data Model: Package 5 Review, Apply, Verify, Undo, and Reset

Package 5 uses existing entities first. Any additive `0004` object must be justified by a failing real-D1 enforcement test and documented here before implementation.

## Migration 0004 decision

`0004_package5_review_apply_undo.sql` is required. The focused real-D1 red run on 2026-08-31 proved that migrations `0001`–`0003` already enforce application completeness, reset completeness, idempotency uniqueness, and precedent-key uniqueness, but provide no finalizer row/trigger for review, undo, or runtime projection. The additive migration introduces only `review_commits`, `undo_commits`, `runtime_precedent_provenance`, `precedent_projection_commits`, and their immutable completeness triggers. Because Package 1 freezes the exact exports of `db/schema.ts`, `db/package5-schema.ts` holds the additive declarations. Migrations `0001`–`0003` remain unchanged.

## Proposal and review

| Entity | Package 5 use | Invariant |
|---|---|---|
| `proposals` | Parent/child immutable configuration, digest, base revision, author, status projection | Payload never updates; edit inserts a child and supersedes the parent. |
| `proposal_evidence` / `retrieval_queries` / `retrieval_results` | Preserve the accepted evidence snapshot and field support for agent-authored history; reviewer-authored novel and edited-child proposals carry no supporting evidence | Retrieval remains evidence only and never appears in review/apply authority predicates except historical resolvability. |
| `review_decisions` | Append approve/reject/revoke bound to proposal/hash/base/page session/reviewer | Latest effective exact decision controls status; records never update/delete. |
| `idempotency_records` | Recover review actions | Same workspace+operation+key+request returns the original decision/child; different request conflicts. |
| `review_commits` | Final review completeness proof | A decision or reviewer child cannot commit as success unless its exact status, session, idempotency result, audit, and immutable authority all exist. |

### Proposal state

`proposed → approved | rejected | superseded | stale`

`approved → revoked | applied | stale`

Editing inserts a new `proposed` child and transitions only the parent to `superseded`.

## Application

| Entity | Package 5 use | Invariant |
|---|---|---|
| `application_guards` | One conditional authority row for proposal/variant/from/to/hash/key | Exactly one proposal and one same-base contender. |
| `implemented_focus_revisions` | Revision 2 and later undo revisions | Append-only; parent is previous revision; renderer reads the active pointer. |
| `component_variants` | Active implemented revision pointer | Advances by exactly one to an existing revision. |
| `application_receipts` | Durable apply result and recovery | One per proposal/key with exact from/to/hash. |
| `application_commits` | Transaction finalizer | Insert succeeds only when the full application relation exists. |
| `audit_events` | Safe success/failure history | Success audit is inside the guarded batch; no private payload. |

## Verification and runtime precedent

| Entity | Package 5 use | Invariant |
|---|---|---|
| `verification_receipts` / `verification_checks` / `verification_commits` | Existing raw-event verification truth | One session+verifier receipt; six exact checks; committed finalizer. |
| `precedent_records` | One runtime record per projected changed field/provenance key | Only pass + applied + exact UI review; seed rows unchanged. |
| `precedent_subject_edges` | Exact context/variant/use-case/family applicability | Typed, bounded, current workspace only. |
| `runtime_precedent_provenance` / `precedent_projection_commits` | Exact proposal/review/application/verification/field lineage and final completeness proof | Projection is same-batch, pass-only, exact-once, and immutable. |

Projection identity is derived from the verification receipt plus changed field. Replaying verification returns the receipt and creates no duplicate record or edge.

## Undo

Undo uses the active variant, chosen prior revision configuration, a new implemented revision, active-pointer advance, idempotency record with `result_kind='revision'`, and audit. The source proposal/receipt fields remain null unless an existing valid application receipt is the direct source; parent revision preserves forward lineage.

`undo_commits` is the final statement. Its trigger proves the new revision matches the selected earlier configuration, the pointer advanced, idempotency committed, success audit exists, and every older open proposal was made stale; any missing required row aborts the batch.

## Reset

Reset reuses the existing prior-workspace idempotency record and reset finalizer. The committed result identifies the replacement workspace generation. The prior workspace is lifecycle-purged/inaccessible to the rotated session; it is not rewritten into seed state.

## Safe history union

```ts
type Package5HistoryRecord =
  | { kind: 'proposal'; id: string; proposalDigest8: string; baseRevision: number; status: string; occurredAt: string }
  | { kind: 'decision'; id: string; proposalId: string; action: 'approve' | 'reject' | 'revoke'; occurredAt: string }
  | { kind: 'application'; id: string; proposalId: string; fromRevision: number; toRevision: number; occurredAt: string }
  | { kind: 'verification'; id: string; revision: number; result: 'pass' | 'fail'; projected: boolean; occurredAt: string }
  | { kind: 'revision'; id: string; revision: number; source: 'seed' | 'apply' | 'undo'; occurredAt: string }
  | { kind: 'projection'; id: string; behavior: string; outcomeKey: string; occurredAt: string }
  | { kind: 'reset' | 'failure'; id: string; code: string; correlationId: string; occurredAt: string };
```

Records are current-workspace-only, newest bounded then returned chronological, and contain no raw session, CSRF, identity, rationale, event array, SQL, path, or secret.
