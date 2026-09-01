# Tasks: Package 5 Review, Apply, Verify, Undo, and Reset

**Input**: Design documents from `specs/003-package-5-review-apply-undo/`

**Prerequisites**: `plan.md`, `spec.md`, `eng-plan.md`, `research.md`, `data-model.md`, `contracts/`, and reviewer-owned `checklists/package5.md`

**Tests**: Mandatory TDD. Every behavior task starts with the named failing test and retains regression coverage.

**Organization**: Tasks are grouped by independently testable reviewer journeys while preserving one writing owner and sequential changes to shared files.

## Phase 1: Setup and Custody

**Purpose**: Reconfirm the isolated checkpoint and create only Package 5 test/evidence harnesses.

- [X] T001 Reverify branch, HEAD, tree, parent, clean state, existing two-tool inventory, lockfile-compatible caches, and absence of Package 5 path collisions in the current worktree
- [X] T002 Add Package 5 real-D1/DOM test harness configuration in `vitest.package5.config.ts`, `vitest.package5-dom.config.ts`, and `wrangler.package5.jsonc` without new dependencies
- [X] T003 [P] Add initial Package 5 command placeholders and inherited-gate composition tests in `tests/package5-node/package5-scripts.test.ts`

**Checkpoint**: Package 5 can run focused red tests without changing production behavior.

---

## Phase 2: Foundational State and Enforcement

**Purpose**: Lock canonical inputs/state reduction/result interpretation and empirically decide whether migration `0004` is required.

- [X] T004 Write failing canonicalization, review/apply/undo request, state-reducer, history DTO, and exact D1-result interpretation tests in `tests/package5-node/package5-domain.test.ts`
- [X] T005 Implement the minimum strict schemas, canonical requests, reducers, and exact result interpreter in `lib/domain/package5.ts` until T004 passes
- [X] T006 Write failing real-D1 enforcement tests against migrations `0001`–`0003` for review completeness, apply finalizer, projection uniqueness, undo completeness, reset completeness, and required zero-row rollback in `tests/package5/schema-enforcement.test.ts`
- [X] T007 Add and test `drizzle/0004_package5_review_apply_undo.sql` plus `db/schema.ts` declarations only for enforcement gaps proven by T006; otherwise record no-migration proof in `specs/003-package-5-review-apply-undo/data-model.md`
- [X] T008 Run the focused foundational tests and capture red-to-green evidence in `docs/evidence/PACKAGE5_EXECUTION.md`

**Checkpoint**: The state machine and database enforcement needed by all stories are proven before operation code.

---

## Phase 3: User Story 1 - Inspect and Decide an Immutable Proposal (Priority: P1)

**Goal**: Complete visible exact proposal review, append-only decisions, edit-as-child, and unchanged renderer behavior.

**Independent Test**: From revision 1, inspect the complete proposal, approve/reject/revoke/edit by keyboard, reload history, and prove no review path changes the active revision.

### Tests for User Story 1

- [X] T009 [US1] Write failing real-D1 review transition, child lineage, idempotency, failure injection, zero-row, latest-decision, and foreign/nonexistent parity tests in `tests/package5/review.test.ts`
- [X] T010 [P] [US1] Write failing strict request-boundary and UI-only route-inventory tests for the review endpoint in `tests/package5/routes.test.ts`
- [X] T011 [P] [US1] Write failing proposal diff/digest/base/status, confirmation, edit, revoke, live-announcement, and unchanged-renderer DOM tests in `tests/package5-dom/focus-contract-studio.test.tsx`

### Implementation for User Story 1

- [X] T012 [US1] Implement child proposal and append-only decision commands with exact session/hash/base/idempotency authority in `lib/server/package5-review.ts`
- [X] T013 [US1] Implement the thin protected review adapter in `app/api/focus-proposals/[proposalId]/review/route.ts` and stable errors in `lib/server/errors.ts`
- [X] T014 [US1] Wire complete visible proposal authority and approve/reject/edit-as-child/revoke states into `app/focus-contract-studio.tsx`
- [X] T015 [US1] Run US1 Node/D1/route/DOM tests and prior proposal/dialog regressions; record exact red-to-green totals in `docs/evidence/PACKAGE5_EXECUTION.md`

**Checkpoint**: Every visible review action is durable and exact, while revision 1 remains active.

---

## Phase 4: User Story 2 - Apply Once, Verify, and Project Precedent (Priority: P1)

**Goal**: Apply one exact approval, recover one receipt, render revision 2, verify a fresh rehearsal, and project precedent only after pass.

**Independent Test**: One approved proposal produces revision 2 and one receipt under replay/race/failure pressure; a new raw pass projects one lineage-complete precedent and every excluded verification projects none.

### Tests for User Story 2

- [X] T016 [US2] Write the full failing apply state/negative matrix, exact zero-row/downstream/finalizer failure injection, and no-mutation assertions in `tests/package5/apply.test.ts`
- [X] T017 [P] [US2] Write failing same-key recovery, conflicting payload, lost-response before/after commit, revoke/revision race, and 100-pair same-base concurrency tests in `tests/package5/apply-concurrency.test.ts`
- [X] T018 [P] [US2] Write failing pass-only, unreviewed, revision-1, missing-review, replay, exact-once, provenance, subject-edge, and seed-immutability projection tests in `tests/package5/verification-projection.test.ts`
- [X] T019 [P] [US2] Extend failing route and DOM tests for apply receipt, uncertain recovery, revision 2, Cancel focus, new rehearsal, verification, and projection in `tests/package5/routes.test.ts` and `tests/package5-dom/focus-contract-studio.test.tsx`

### Implementation for User Story 2

- [X] T020 [US2] Implement guarded exact-once apply and committed receipt recovery in `lib/server/package5-apply-history-undo.ts`
- [X] T021 [US2] Extend `lib/server/verify-focus-contract.ts` with same-batch pass-only exact-once runtime precedent projection
- [X] T022 [US2] Implement the thin protected apply adapter in `app/api/focus-proposals/[proposalId]/apply/route.ts`
- [X] T023 [US2] Wire apply consequence, recovering/receipt states, revision-2 rendering, fresh rehearsal verification, and projection result into `app/focus-contract-studio.tsx`
- [X] T024 [US2] Run US2 real-D1/concurrency/route/DOM and Package 3 verifier/browser regressions; record exact totals in `docs/evidence/PACKAGE5_EXECUTION.md`

**Checkpoint**: Invalid paths mutate nothing; success/replay/races create one revision/receipt; only the valid fresh pass projects once.

---

## Phase 5: User Story 3 - History, Undo, and Reset (Priority: P2)

**Goal**: Make every material state reloadable, undo through a later revision, invalidate old approval, and reset only the current workspace deliberately.

**Independent Test**: Reload every state, inspect chronological history, undo revision 2 into a later revision, fail old approval reuse, and reset into a new isolated seed with same-key recovery.

### Tests for User Story 3

- [X] T025 [US3] Write failing bounded history ordering/safety/reload, undo revision/idempotency/failure/old-approval, and reset recovery/isolation tests in `tests/package5/history-undo-reset.test.ts`
- [X] T026 [P] [US3] Extend failing route request-boundary and foreign/nonexistent parity tests for history/undo/reset in `tests/package5/routes.test.ts`
- [X] T027 [P] [US3] Extend failing DOM tests for chronological history, undo confirmation/result, old-approval failure, reset confirmation, uncertainty, and new seed in `tests/package5-dom/focus-contract-studio.test.tsx`

### Implementation for User Story 3

- [X] T028 [US3] Implement the bounded safe history query and forward-revision undo in `lib/server/package5-apply-history-undo.ts`
- [X] T029 [US3] Implement thin history and undo adapters in `app/api/focus-history/route.ts` and `app/api/focus-revisions/[revision]/undo/route.ts`
- [X] T030 [US3] Reuse `resetWorkspace` and wire history, undo, old-approval error, deliberate reset, same-key recovery, and reload states in `app/focus-contract-studio.tsx`
- [X] T031 [US3] Run US3 D1/route/DOM and Package 1 reset/isolation regressions; record exact totals in `docs/evidence/PACKAGE5_EXECUTION.md`

**Checkpoint**: History is durable, undo is append-only, old authority stays invalid, and reset affects only the current workspace.

---

## Phase 6: Browser, Coverage, Evidence, and Review

**Purpose**: Prove the complete judge-visible local loop, bind the exact source/evidence, and close material reviewer findings.

- [X] T032 Write the failing complete built Playwright journey plus keyboard, live status/error, uncertainty recovery, native-dialog, axe, desktop/320px/375px/200%-zoom, focused-control visibility, and reduced-motion assertions in `tests/package5-browser/review-apply-undo.spec.ts`
- [X] T033 Make the minimum functional responsive/accessibility state changes in `app/focus-contract-studio.tsx` and `app/globals.css` until T032 passes without Package 6 polish
- [X] T034 Add Package 5 safety-core and server-operation coverage commands/configuration in `package.json` and `tests/package5-node/package5-scripts.test.ts`; meet frozen thresholds without exclusions
- [X] T035 [P] Add strict Package 5 source manifest/binder and tamper tests in `scripts/package5-source-manifest.mjs`, `scripts/package5-evidence-binding.mjs`, and `tests/package5-node/source-evidence.test.ts`
- [X] T036 [P] Update truthful Package 5 verification/execution state in `docs/evidence/PACKAGE5_VERIFICATION.md`, `docs/evidence/EXECUTION_STATE.md`, and `docs/evidence/EXECUTION_STATE.json`; leave hosted/manual/external rows `NOT_RUN`
- [X] T037 Compose `verify:package5` from the full inherited Package 4 gate plus every Package 5 functional/D1/concurrency/route/DOM/browser/coverage/build/audit/source/evidence check in `package.json`
- [X] T038 Run `verify:package5`, review the exact diff, and stabilize all failures before reviewer dispatch
- [X] T039 Dispatch at most two read-only reviewers for contract/state-machine/D1/idempotency/security and tests/browser/accessibility/evidence; record evidence and dispositions in `docs/evidence/PACKAGE5_ADVERSARIAL_REVIEW.md`
- [X] T040 Reproduce and permanently fix every valid critical/high/material reviewer finding with a regression test, then rerun affected tests and `verify:package5`

**Checkpoint**: Implementation tasks are complete and stable; Spec Kit convergence may run exactly once.

---

## Dependencies and Execution Order

- Phase 1 precedes Phase 2.
- Phase 2 blocks all user stories.
- US1 precedes US2 because apply requires exact current review.
- US2 precedes US3 because the visible undo journey requires an applied revision.
- Browser/evidence/review follows all stories.
- Tests in each story are written and observed red before their implementation tasks.
- Tasks marked `[P]` touch different files or are read-only test authoring; one writing owner still integrates them sequentially in this checkout.

## Independent Acceptance

- **US1**: Complete exact review actions with no renderer mutation.
- **US2**: One guarded revision-2 receipt and pass-only exact-once projection under failure/race/replay pressure.
- **US3**: Durable history, forward undo, old-approval invalidation, and isolated recoverable reset.

## Implementation Strategy

Execute the three stories in dependency order because they form one judge-visible state machine. Stop only on a real authority contradiction, failed inherited gate, or required external authorization. Do not deploy or begin Package 6/7.
