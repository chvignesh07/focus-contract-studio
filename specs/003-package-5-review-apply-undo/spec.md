# Feature Specification: Package 5 Review, Apply, Verify, Undo, and Reset

**Feature Branch**: `feat/package-5-review-apply-undo`

**Created**: 2026-08-31

**Status**: Approved for implementation

**Input**: Complete Package 5 as a local checkpoint: visible immutable review, guarded apply, receipts, history, verified-precedent projection, revisioned undo, and current-workspace reset.

## User Scenarios & Testing

### User Story 1 - Inspect and decide an immutable proposal (Priority: P1)

As a reviewer, I can inspect the complete field-level diff, evidence, digest, and base revision of a visibly `NOT APPLIED` proposal, then approve, reject, edit it as a child proposal, or revoke approval through the visible interface without changing the implemented renderer.

**Why this priority**: Exact visible review is the authority boundary that prevents retrieved evidence or agent language from becoming permission.

**Independent Test**: Starting from revision 1 with an existing agent proposal, complete every review action through the visible keyboard-accessible interface and prove the proposal payload remains immutable, edits create a child, decisions remain chronological, and revision 1 still renders.

**Acceptance Scenarios**:

1. **Given** an open revision-1 proposal, **when** the reviewer expands it, **then** the complete canonical diff, supporting evidence, digest, base revision, author, and `NOT APPLIED` status are visible.
2. **Given** the exact displayed proposal, **when** the reviewer confirms approval, rejection, or revocation in the visible interface, **then** one append-only decision is recorded against that proposal, digest, base revision, and current page session.
3. **Given** a proposal that needs correction, **when** the reviewer saves an edit, **then** a reviewer-authored child is created, the parent is superseded, and both remain visible in history.
4. **Given** retrieved text, a model result, or a direct request outside the protected visible interface, **when** it attempts to create review authority, **then** no decision is recorded.

---

### User Story 2 - Apply once, rehearse, verify, and project precedent (Priority: P1)

As a reviewer, I can apply one exact current approval, receive a durable revision-1-to-2 receipt, rehearse revision 2 from raw browser behavior, and project a provenance-complete precedent only after verification passes.

**Why this priority**: This is the product's judge-visible governed mutation and independent proof loop.

**Independent Test**: Approve one exact proposal, submit the application once, recover the same receipt after a lost response, complete a fresh revision-2 rehearsal, verify all six behaviors, and prove exactly one precedent is projected only for the passing reviewed application.

**Acceptance Scenarios**:

1. **Given** an exact current approval for revision 1, **when** apply succeeds, **then** exactly revision 2, one active-pointer advance, one receipt, one recovery result, one success audit, one applied transition, and stale same-base sibling transitions exist.
2. **Given** the same application key and request, **when** it is retried, **then** the original receipt is returned without another revision; the same key with a different request is rejected.
3. **Given** revision 2 is active, **when** the dialog opens, **then** focus lands on Cancel and the reviewer can complete a fresh raw rehearsal.
4. **Given** a finalized revision-2 rehearsal, **when** all six checks pass, **then** one verification receipt is recorded and one provenance-complete runtime precedent is projected for the reviewed changed field.
5. **Given** a failed, unreviewed, revision-1, or replayed verification, **when** verification completes, **then** no precedent is projected.

---

### User Story 3 - Recover, inspect history, undo, and reset (Priority: P2)

As a reviewer, I can reload every material state, inspect a safe chronological history, undo through a later revision, prove an old approval cannot apply again, and reset only my current workspace through deliberate confirmation.

**Why this priority**: Durable recovery and append-only reversal make the governed loop trustworthy after retries, reloads, and mistakes.

**Independent Test**: Reload after proposal, decision, application, verification, projection, and undo; then undo revision 2 into a later revision, attempt the old approval again, and reset the current workspace while proving another workspace is unchanged.

**Acceptance Scenarios**:

1. **Given** any material state, **when** the page reloads, **then** the active revision, proposal state, decisions, receipts, verification, projection, failures, and history remain consistent.
2. **Given** an applied revision 2, **when** undo is confirmed, **then** a later implemented revision restores the prior configuration without rewinding a pointer or editing earlier history.
3. **Given** the old approval after undo, **when** apply is attempted again, **then** it fails without mutation.
4. **Given** the reviewer deliberately confirms reset, **when** reset succeeds or its response is recovered, **then** a new seeded current workspace is active, the prior workspace is inaccessible to that session, and other workspaces are unchanged.

### Edge Cases

- A proposal is missing, unavailable, foreign, unsupported by evidence, unapproved, rejected, revoked, superseded, stale, or already applied.
- The canonical hash, base revision, caller-expected revision, active revision, or latest decision does not match.
- A session expires or a request has a malformed or oversized body, invalid content type, foreign origin, missing CSRF token, or unknown fields.
- A review is revoked or the active revision changes after a diagnostic read but before the guarded mutation.
- The authority guard or any required downstream mutation affects zero rows while the storage engine reports statement success.
- Any guarded statement or final completeness check fails after an earlier statement appeared to succeed.
- Two same-base applications race, including 100 paired attempts, and only one may win.
- A mutation response is lost before or after commit and is retried with the same key.
- Verification is failed, unreviewed, for revision 1, replayed, or already projected.
- A proposal, decision, application, verification, projection, undo, reset, or safe failure is reloaded immediately.
- The interface is used at desktop, 320 px, 375 px, or 200% zoom, with keyboard only, reduced motion, or an unavailable/uncertain network.

## Requirements

### Functional Requirements

- **FR-001**: The product MUST display every proposal as an immutable record with its complete field diff, accepted evidence, digest, base implemented revision, author, time, current state, and unmistakable `NOT APPLIED` status until application succeeds.
- **FR-002**: Editing MUST create a reviewer-authored child proposal and supersede, never mutate, the parent.
- **FR-003**: Approval, rejection, and revocation MUST originate only from the protected same-origin visible interface and MUST bind the exact proposal ID, canonical digest, base revision, reviewer, current page session, and time.
- **FR-004**: Review decisions MUST be append-only, chronological, idempotently recoverable, and unable to distinguish a foreign proposal from a nonexistent proposal publicly.
- **FR-005**: The existing two agent-visible registrations MUST remain exactly unchanged; review, undo, and reset MUST remain visible-interface-only capabilities.
- **FR-006**: Apply MUST accept only proposal ID, expected implemented revision, and idempotency key from the caller.
- **FR-007**: Apply MUST re-resolve the current workspace, active variant and revision, immutable proposal and digest, latest effective decision, supporting evidence, session authority, and idempotency state during execution.
- **FR-008**: Every successful apply MUST create exactly one later implemented revision, advance exactly one active pointer, record exactly one receipt, committed recovery result, success audit, applied transition, and stale transition for each open same-base sibling.
- **FR-009**: Every invalid apply path MUST create zero product mutation and MUST never be reported as success when any required state change is absent.
- **FR-010**: The same apply key and byte-identical request MUST return the original receipt; the same key with a different request MUST return `IDEMPOTENCY_CONFLICT`.
- **FR-011**: Concurrent same-base applications MUST produce exactly one winner and no partial or duplicate revision, pointer, receipt, recovery result, or success audit.
- **FR-012**: The application success dialog MUST focus Cancel and expose a durable receipt and next action.
- **FR-013**: The active review and history surface MUST present safe chronological proposal, decision, application, rehearsal, verification, projection, undo, reset, and failure records.
- **FR-014**: Verification MUST consume a fresh finalized raw rehearsal for the exact named implemented revision and MUST preserve the independent six-behavior verifier boundary.
- **FR-015**: Verification MUST project runtime precedent exactly once only when the verified revision came from an exact visible-interface-reviewed applied proposal and the overall result passes.
- **FR-016**: Projected precedent MUST preserve proposal, review, application, verification, workspace, variant, behavior, normalized outcome, and subject-edge provenance without modifying immutable seed benchmark data.
- **FR-017**: Failed, unreviewed, revision-1, missing-review, or replayed verification MUST project no precedent.
- **FR-018**: Undo MUST be visible-interface-only, deliberate, idempotently recoverable, and create a later implemented revision restoring the chosen prior configuration without rewinding pointers or rewriting history.
- **FR-019**: After undo or any later revision, an earlier approval MUST be permanently unable to apply again.
- **FR-020**: Reset MUST require deliberate visible confirmation, rotate the current session into a new seeded workspace generation, make the prior workspace inaccessible to that session, preserve other workspaces, and support same-key recovery.
- **FR-021**: Reload after every material state MUST reconstruct one consistent active review and history from committed records.
- **FR-022**: Mutation routes MUST reject malformed, oversized, wrong-content-type, wrong-origin, missing-CSRF, expired-session, and unknown-field requests before product mutation.
- **FR-023**: Foreign and nonexistent opaque identifiers MUST have the same public status, envelope, size class, and bounded timing behavior.
- **FR-024**: Uncertain mutation responses MUST be recovered with the original idempotency key; the interface MUST show an uncertain/recovering state and MUST not guess success or failure.
- **FR-025**: Every changed interface state MUST be keyboard accessible, use restrained live announcements, preserve native dialog semantics/background inertness, and keep focused controls visible at desktop, 320 px, 375 px, and 200% zoom with reduced motion honored.
- **FR-026**: The implementation MUST reuse existing domain entities and enforcement where they fully satisfy Package 5; a new schema revision is permitted only when a failing real-storage test proves an enforcement gap, and prior schema revisions MUST remain unchanged.
- **FR-027**: Package 5 MUST add one composed verification command that preserves every inherited Package 4 assertion and adds the Package 5 state, storage, concurrency, route, DOM, browser, coverage, build, audit, source-binding, and evidence-binding gates.
- **FR-028**: Deterministic Package 5 evidence MUST record execution, red-to-green behavior, verification totals, reviewer findings and dispositions, and source/evidence bindings while hosted/manual/external rows remain `NOT_RUN`.

### Key Entities

- **Proposal**: Immutable proposed configuration, digest, base revision, evidence, author, parent, and projected state.
- **Review Decision**: Append-only approval, rejection, or revocation bound to exact proposal authority and page session.
- **Application Attempt and Receipt**: Guarded mutation authority, exact transition, idempotent recovery, and durable proof.
- **Implemented Revision**: Append-only renderer configuration created by apply or undo.
- **Verification Receipt and Projection**: Independent raw-event result and optional provenance-complete runtime precedent.
- **History Record**: Safe chronological representation of committed material states and failures.
- **Undo Receipt**: New-revision restoration lineage and recovery identity.
- **Reset Receipt**: Current-session workspace-generation replacement and recovery identity.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A reviewer can inspect the complete proposal authority and perform approve, reject, edit-as-child, or revoke by keyboard without the implemented revision changing.
- **SC-002**: Every named invalid proposal, authority, request-boundary, race, zero-row, and injected-failure case produces zero product mutation.
- **SC-003**: One valid apply produces exactly one revision-2 transition and one receipt; same-key replay remains one, and 100 paired same-base races produce exactly 100 winners across 100 pairs.
- **SC-004**: A fresh revision-2 rehearsal passes all six verifier checks and projects exactly one runtime precedent with complete lineage; every excluded verification class projects zero.
- **SC-005**: Undo creates a later revision and all attempts to reuse the old approval fail without mutation.
- **SC-006**: Reset replaces only the current session's workspace generation and returns the same receipt on an identical recovery request.
- **SC-007**: Reload after every material state preserves a consistent active view and chronological history.
- **SC-008**: The complete browser journey passes at desktop, 320 px, 375 px, and 200% zoom, including keyboard flow, dialog semantics/background blocking, focused-control visibility, reduced motion, live announcements, and uncertain-network recovery.
- **SC-009**: Safety-core canonicalization, state reduction, guarded-result interpretation, and new server operations meet the repository's frozen coverage thresholds.
- **SC-010**: The composed Package 5 gate passes from the checkpoint worktree and a disposable no-local exact-commit clone, and both are clean afterward.
- **SC-011**: No unresolved critical/high/material reviewer finding remains, and all hosted/manual/external or later-package actions remain explicitly unperformed.

## Assumptions

- Package 4 commit `0f85ad66ef6aa190abdfa9f003b1bd96a8a84a7f` is the verified immutable base.
- Existing Package 1 tables and triggers are the default persistence authority; no new migration is presumed.
- Existing anonymous-session, request-security, proposal, rehearsal, verification, retrieval, and WebMCP patterns are reused rather than replaced.
- Package 6 owns premium visual refinement and exhaustive presentation polish; Package 7 owns expansion from two to four registered WebMCP tools.
- All Package 5 proof is local and synthetic. Hosted Sites, real ChatGPT, Chrome, manual assistive technology, deployment, holdout, push, merge, publication, and submission remain outside this checkpoint.
