# Phase 0 Research: Package 5 Review, Apply, Verify, Undo, and Reset

This artifact records repository-backed implementation decisions. It does not amend controlling authority or authorize an external action.

## Decision 1: Extend the existing vertical spine

**Decision**: Reuse `createProposal`, request security, workspace/session resolution, Package 1 tables/finalizers, Package 3 verification, current reset, and the existing React surface. Add only missing review/apply/history/undo/projection behavior.

**Rationale**: The repository already contains the data model and most protected primitives. Replacing them would add a second authority path and violate the smallest-complete-change rule.

**Alternatives considered**: A generic workflow engine, new persistence layer, transaction abstraction, or fresh UI state architecture. Rejected as unnecessary and riskier.

## Decision 2: Keep review authority visible and page-session-bound

**Decision**: Approve/reject/revoke/edit use a same-origin proposal-scoped UI route with Origin, CSRF, current session, exact proposal hash/base revision, and idempotency checks. No tool registration or public model capability is added.

**Rationale**: This is the controlling evidence-versus-authority boundary and preserves the current two-tool Package 4 surface.

**Alternatives considered**: WebMCP approval, an approval boolean in apply, natural-language approval, or a detached admin route. All are forbidden.

## Decision 3: Test existing schema enforcement before migration

**Decision**: Run focused real-D1 failure/zero-row tests against migrations `0001`–`0003`. Create additive migration `0004` only for a reproduced missing finalizer/uniqueness/transition invariant.

**Rationale**: Package 1 intentionally reserved review, application, undo, reset, and idempotency entities. A speculative migration would duplicate enforcement.

**Alternatives considered**: Always add `0004`, or enforce completeness only in application code. The first is unnecessary until proven; the second is insufficient if an earlier batch write can survive a zero-row omission.

## Decision 4: Use the existing application guard and finalizer

**Decision**: Build apply around `application_guards`, `application_receipts`, `application_commits`, the proposal transition trigger, revision pointer trigger, idempotency record, and `trg_application_commit_complete`; inspect every D1 result count.

**Rationale**: The exact Package 5 authority was designed into Package 1. One production path and one database finalizer are easier to prove than a new transaction framework.

**Alternatives considered**: Sequential independent statements, application-only validation, or a second receipt table. Rejected because they weaken rollback or duplicate source truth.

## Decision 5: Project precedent from committed verification truth

**Decision**: Extend the existing verification batch so only a passing receipt for a revision sourced from an applied exact UI-reviewed proposal inserts a runtime precedent and typed subject edges exactly once.

**Rationale**: Projection must share the verification commit boundary and cannot be a later best-effort write that leaves ambiguous provenance.

**Alternatives considered**: Project during apply, project on read, or asynchronously. All break the review+apply+pass requirement.

## Decision 6: Undo is a forward revision

**Decision**: Undo copies a prior canonical configuration into `active_revision + 1`, records parent/source lineage and a committed idempotent revision result, advances once, stales earlier open authority, and preserves history.

**Rationale**: The schema and authority both prohibit pointer rewind and history mutation.

**Alternatives considered**: Move the pointer backward, delete revision 2, or reuse the old approval. All are forbidden.

## Decision 7: Reuse reset persistence

**Decision**: Keep `resetWorkspace` and its database finalizer as the sole reset command. Package 5 adds deliberate confirmation, same-key uncertain-response recovery, and visible result/history coverage.

**Rationale**: Reset already rotates into a deterministic new workspace generation and proves seed completeness.

**Alternatives considered**: Reseed in place or delete rows client-side. Both violate append-only/lifecycle and isolation contracts.

## Decision 8: Derive one bounded safe history DTO

**Decision**: Query current-workspace committed facts, map them to a closed chronological union, cap results, and expose only stable safe fields/digest fragments/correlation IDs.

**Rationale**: History is a presentation/query concern, not a new event store. Existing append-only rows and audits are sufficient.

**Alternatives considered**: Add a duplicate history table or expose raw SQL rows. Rejected for duplication and leakage risk.

## Decision 9: Preserve Package 5 scope

**Decision**: Implement accessible functional UI only and exactly two tool registrations. Package 6 premium polish and Package 7 four-tool completion remain excluded.

**Rationale**: Pulling later-package work forward expands review and test surface without improving the Package 5 checkpoint.

**Alternatives considered**: Complete all four tools now or redesign the full visual system. Explicitly rejected by package authority.

## Decision 10: Compose inherited proof

**Decision**: `verify:package5` runs the inherited Package 4 gate plus Package 5 node/D1/route/DOM/browser/coverage/binding checks. Package 4 evidence is never rewritten to claim Package 5 events.

**Rationale**: Package 5 must prove no regression while preserving historical evidence attribution.

**Alternatives considered**: A narrow Package 5-only command or altered inherited thresholds. Both produce insufficient proof.
