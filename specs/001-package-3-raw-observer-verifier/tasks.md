# Tasks: Package 3 Raw Observer and Independent Verifier

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, and `quickstart.md`

**Execution rule**: All tasks remain unchecked until a separately authorized implementation phase. `[TEST]` tasks must be written and observed failing for the named missing behavior before their dependent `[IMPL]` task begins. Every task names stable requirements and exact repository/artifact paths.

## Phase 1: Package-scoped test foundation

**Purpose**: Establish failing contract gates while preserving prior-package evidence and installed tooling.

- [x] T001 [P] [TEST] Add frozen-source, planned-path, strict evidence-status, and no-authority-drift negative tests for P3-AUT-001, P3-AUT-002, P3-EVD-009, P3-EVD-011 in `tests/package3-node/source-evidence.test.ts`
- [x] T002 [SETUP] Add Package 3-only Node/D1/DOM/browser/coverage commands and configurations for P3-AUT-002, P3-EVD-008, P3-EVD-009 in `package.json`, `vitest.package3-node.config.ts`, `vitest.package3.config.ts`, `vitest.package3-dom.config.ts`, `wrangler.package3.jsonc`, `playwright.config.ts`, `tests/package3/d1-vitest-setup.ts`
- [x] T003 [P] [TEST] Add failing closed-schema, canonical-manifest/event, server-order, bounds, and privacy vectors for P3-OBS-002, P3-OBS-003, P3-OBS-004, P3-OBS-006, P3-OBS-007, P3-OBS-009, P3-SEC-006 in `tests/package3-node/contracts.test.ts`
- [x] T004 [P] [TEST] Add failing direct/transitive observer-verifier import boundary tests for P3-AUT-004, P3-OBS-008, P3-VER-003, P3-EVD-004 in `tests/package3-node/reference-boundary.test.ts`
- [x] T005 [IMPL tests=T003,T004] Implement strict rehearsal schemas, canonical bytes, closed enums, privacy-safe types, and no expected-event dependency for P3-AUT-004, P3-OBS-002, P3-OBS-003, P3-OBS-004, P3-OBS-006, P3-OBS-007, P3-OBS-008, P3-OBS-009, P3-VER-003 in `lib/domain/focus-rehearsal.ts`
- [x] T006 [TEST] Add failing real-D1 migration/finalizer/immutability and Package 2 opening-report regression tests for P3-OBS-001, P3-OBS-009, P3-OBS-010, P3-OBS-011, P3-SEC-002, P3-SEC-004, P3-SEC-010 in `tests/package3/focus-rehearsal.test.ts`
- [x] T007 [IMPL tests=T006] Add the Package 3 schema declarations, additive rehearsal/verification guards and finalizers, workspace keys, immutable triggers, exact constraints, Package 2-specific uniqueness replacement, and migration journal entry for P3-OBS-001, P3-OBS-009, P3-OBS-010, P3-OBS-011, P3-SEC-002, P3-SEC-004, P3-SEC-010 in `db/package3-schema.ts`, `db/schema.ts`, `drizzle/0003_package3_raw_observer_verifier.sql`, `drizzle/meta/_journal.json`

**Checkpoint**: Closed data contracts and real-D1 enforcement fail red before T005/T007, then pass without changing prior-package behavior.

---

## Phase 2: User Story 1 — Capture one real bounded rehearsal (Priority: P1)

**Goal**: A server-bound session freezes only actual allowlisted DOM/keyboard/focus facts from the complete rehearsal.

**Independent test**: Complete one browser-operated rehearsal, inspect one finalized session/manifest/ordered sequence and digests, and prove invalid/privacy cases create no finalization.

### Failing tests

- [x] T008 [P] [US1] [TEST] Add failing start-session D1 tests for server-resolved workspace/active variant/revision, generated nonce, bounded environment, expiry, and zero configuration mutation for P3-AUT-003, P3-OBS-001, P3-SEC-001, P3-SEC-002 in `tests/package3/focus-rehearsal.test.ts`
- [x] T009 [P] [US1] [TEST] Add failing finalize tests for server sequences, complete order, 64/30 bounds, canonical digests, retry/conflict, invalid/expired/interrupted sessions, and immutable rows for P3-OBS-004, P3-OBS-005, P3-OBS-006, P3-OBS-009, P3-OBS-010, P3-OBS-011 in `tests/package3/focus-rehearsal.test.ts`
- [x] T010 [P] [US1] [TEST] Add failing start/finalize route negatives for methods, GET, JSON type/size/schema, opaque IDs, session, Origin, CSRF, no-store, and zero product mutation for P3-AUT-005, P3-SEC-005, P3-SEC-009, P3-EVD-012 in `tests/package3/routes.test.ts`
- [x] T011 [P] [US1] [TEST] Add failing DOM tests for actual closed manifest/event capture, no typed/arbitrary content, no proposal/precedent reads, and no synthetic evidence dispatch for P3-OBS-002, P3-OBS-003, P3-OBS-007, P3-OBS-008 in `tests/package3-dom/focus-contract-studio.test.tsx`
- [x] T012 [US1] [TEST] Add a failing real-browser complete keyboard rehearsal asserting raw browser events and no destructive dispatch for P3-OBS-005, P3-OBS-008, P3-EVD-006 in `tests/package3-browser/rehearsal.spec.ts`

### Implementation

- [x] T013 [US1] [IMPL tests=T008,T009] Implement workspace-bound start/finalize operations, server ordering, bounds, canonical digesting, exact batch-result checks, retry/conflict, and immutable finalization for P3-AUT-003, P3-OBS-001, P3-OBS-004, P3-OBS-006, P3-OBS-009, P3-OBS-010, P3-OBS-011, P3-SEC-001, P3-SEC-002, P3-SEC-004 in `lib/server/focus-rehearsal.ts`
- [x] T014 [US1] [IMPL tests=T010] Implement strict same-origin start/finalize route adapters with existing session/request/error/no-store helpers for P3-AUT-005, P3-SEC-005, P3-SEC-009, P3-EVD-012 in `app/api/rehearsals/start/route.ts`, `app/api/rehearsals/[rehearsalSessionId]/finalize/route.ts`
- [x] T015 [US1] [IMPL tests=T011,T012] Extend the dialog observer to emit the actual allowlisted manifest and full raw event sequence without values, arbitrary text, expected traces, or pass/fail logic for P3-OBS-002, P3-OBS-003, P3-OBS-005, P3-OBS-007, P3-OBS-008 in `app/delete-account-dialog.tsx`
- [x] T016 [US1] [IMPL tests=T011,T012] Orchestrate start, actual browser capture, finalize, safe retry/error state, and bounded summary without claiming verification for P3-AUT-003, P3-OBS-001, P3-OBS-005, P3-OBS-010, P3-SEC-006 in `app/focus-contract-studio.tsx`

**Checkpoint**: A real finalized rehearsal is independently inspectable, privacy-bounded, immutable, and not yet a verification receipt.

---

## Phase 3: User Story 2 — Verify all six behaviors independently (Priority: P2)

**Goal**: The pure verifier produces six raw-sequence-backed results and one immutable receipt without retrieval/model/proposal authority.

**Independent test**: Literal positive and missing-event traces exercise all branches; each of seven isolated raw mutations fails its named check.

### Failing tests

- [x] T017 [P] [US2] [TEST] Add failing literal positive and missing-evidence vectors for exact input, all six pass rules, `not_observed`, overall reduction, raw sequence references, and 100% safety-core branches for P3-VER-001, P3-VER-004, P3-VER-005, P3-VER-006, P3-VER-007, P3-VER-008, P3-VER-009, P3-VER-010, P3-VER-011, P3-VER-012, P3-EVD-001, P3-EVD-002, P3-EVD-008 in `tests/package3-node/focus-event-verifier.test.ts`
- [x] T018 [P] [US2] [TEST] Add seven isolated literal mutation cases that fail their named checks without expected-event generation for P3-MUT-001, P3-MUT-002, P3-MUT-003, P3-MUT-004, P3-MUT-005, P3-MUT-006, P3-MUT-007 in `tests/package3-node/focus-event-verifier.test.ts`
- [x] T019 [P] [US2] [TEST] Add failing pre-evaluation rejection tests for nonexistent/foreign/unfinished/tampered/stale/wrong-variant/wrong-revision input for P3-VER-002, P3-SEC-004, P3-SEC-007 in `tests/package3/verification-persistence.test.ts`
- [x] T020 [P] [US2] [TEST] Add failing receipt-binding, exact-six-check, truthful-fail, no-side-effect, same/conflicting replay, and basic concurrency tests for P3-AUT-003, P3-VER-013, P3-VER-014, P3-VER-015, P3-VER-016, P3-SEC-007, P3-SEC-008, P3-SEC-010, P3-EVD-013 in `tests/package3/verification-persistence.test.ts`
- [x] T021 [P] [US2] [TEST] Add failing verify-route strict input/session/Origin/CSRF/no-store/safe-error cases for P3-AUT-005, P3-SEC-005, P3-SEC-009, P3-EVD-012 in `tests/package3/routes.test.ts`

### Implementation

- [x] T022 [US2] [IMPL tests=T017,T018] Implement pure deterministic `focus-event-verifier-v1`, canonical check ordering, missing-evidence semantics, overall reduction, and existing raw sequence references for P3-VER-001, P3-VER-003, P3-VER-004, P3-VER-005, P3-VER-006, P3-VER-007, P3-VER-008, P3-VER-009, P3-VER-010, P3-VER-011, P3-VER-012, P3-MUT-001, P3-MUT-002, P3-MUT-003, P3-MUT-004, P3-MUT-005, P3-MUT-006, P3-MUT-007 in `lib/domain/focus-event-verifier.ts`
- [x] T023 [US2] [IMPL tests=T019,T020] Implement immutable workspace-bound input loading, digest recheck, pre-evaluation rejection, natural-key recovery/conflict, guarded receipt/six-check/audit/finalizer persistence, and no projection/configuration/review mutation for P3-AUT-003, P3-VER-002, P3-VER-013, P3-VER-014, P3-VER-015, P3-VER-016, P3-SEC-002, P3-SEC-004, P3-SEC-007, P3-SEC-008, P3-SEC-010 in `lib/server/verify-focus-contract.ts`
- [x] T024 [US2] [IMPL tests=T021] Implement the strict UI verification adapter and safe receipt response with no-store for P3-AUT-005, P3-SEC-005, P3-SEC-009, P3-EVD-012 in `app/api/verifications/route.ts`

**Checkpoint**: Pure verification and immutable persistence work without any retrieval, proposal, review, configuration, projection, or tool-registration dependency.

---

## Phase 4: User Story 3 — Fail closed under tamper, replay, and isolation attacks (Priority: P2)

**Goal**: Every invalid/foreign/altered/concurrent path is non-oracular, atomic, and unable to create partial or success-like state.

**Independent test**: Real D1 failure injection and two-workspace route probes leave either one complete truthful receipt or zero verification rows.

### Failing tests

- [x] T025 [P] [US3] [TEST] Add failing tamper, reorder, binding-change, post-finalize mutation, stale, expired, overflow, and invalid-state cases for P3-OBS-010, P3-SEC-004, P3-EVD-003 in `tests/package3/verification-persistence.test.ts`
- [x] T026 [P] [US3] [TEST] Add failing two-workspace foreign/nonexistent rehearsal and receipt response-parity assertions for public code/status/size/timing and safe errors for P3-SEC-003, P3-SEC-005, P3-EVD-003 in `tests/package3/routes.test.ts`
- [x] T027 [US3] [TEST] Add failing real-D1 zero/error injection at guard, receipt, each of six checks, audit, and finalizer with total rollback assertions for P3-AUT-005, P3-SEC-010, P3-EVD-013 in `tests/package3/verification-persistence.test.ts`
- [x] T028 [US3] [TEST] Add failing same-key same/different replay and paired concurrent natural-key tests proving one complete immutable receipt for P3-VER-014, P3-VER-015, P3-SEC-008, P3-EVD-003, P3-EVD-013 in `tests/package3/verification-persistence.test.ts`
- [x] T029 [P] [US3] [TEST] Add a sensitive-marker and prohibited-content scan across D1, logs, errors, URLs, UI/adapter outputs, and evidence files for P3-OBS-007, P3-SEC-005, P3-SEC-006, P3-EVD-005 in `tests/package3-node/privacy-scan.test.ts`

### Implementation hardening

- [x] T030 [US3] [IMPL tests=T025,T027,T028] Complete digest/binding race guards, exact affected-row interpretation, finalizer failure mapping, deterministic replay recovery, and concurrency handling for P3-AUT-005, P3-OBS-010, P3-VER-014, P3-VER-015, P3-SEC-004, P3-SEC-008, P3-SEC-010 in `lib/server/verify-focus-contract.ts`, `drizzle/0003_package3_raw_observer_verifier.sql`
- [x] T031 [US3] [IMPL tests=T026,T029] Complete non-oracular response padding/timing budget, safe error/log fields, and prohibited-content exclusion without exposing IDs or raw payloads for P3-SEC-003, P3-SEC-005, P3-SEC-006 in `lib/server/focus-rehearsal.ts`, `lib/server/verify-focus-contract.ts`, `app/api/rehearsals/[rehearsalSessionId]/finalize/route.ts`, `app/api/verifications/route.ts`

**Checkpoint**: Every invalid path is fail-closed; valid mismatch remains a truthful fail receipt; replay/concurrency preserve one authoritative result.

---

## Phase 5: User Story 4 — Present and prove an accessible audit result (Priority: P3)

**Goal**: The human UI presents manifest semantics and all six textual results while real-browser/accessibility/privacy evidence remains claim-safe.

**Independent test**: Keyboard-only DOM/browser tests can read overall/six checks/`not_observed`/sequences, complete the dialog journey, and prove semantics/background/focus/layout/axe requirements.

### Failing tests

- [x] T032 [P] [US4] [TEST] Add failing component tests for manifest semantics, textual/non-color overall and six-check rows, `not_observed`, sequence references, restrained live status, associated errors, and focus behavior for P3-EVD-007 in `tests/package3-dom/focus-contract-studio.test.tsx`
- [x] T033 [US4] [TEST] Add failing real-browser dialog name/description/modal, background pointer/keyboard blocking, complete raw rehearsal, result comprehension, and keyboard-only assertions for P3-EVD-006, P3-EVD-007 in `tests/package3-browser/rehearsal.spec.ts`
- [x] T034 [US4] [TEST] Add failing desktop/320/375/200%-zoom bounds/occlusion/two-dimensional-scroll, reduced-motion, visible-focus/contrast, and zero critical/serious axe assertions for P3-EVD-006, P3-EVD-008 in `tests/package3-browser/rehearsal.spec.ts`

### Implementation

- [x] T035 [US4] [IMPL tests=T032,T033,T034] Present bounded manifest facts and accessible overall/six-check/`not_observed`/sequence text with restrained announcements, visible focus, responsive unobscured layout, and no privacy leak for P3-EVD-006, P3-EVD-007 in `app/focus-contract-studio.tsx`, `app/globals.css`

### Evidence and review

- [x] T036 [P] [US4] [TEST] Add failing source-manifest/evidence-binder tamper, status-vocabulary, exact-command/runtime identity, secret/path/symlink, and false-claim negatives for P3-AUT-001, P3-AUT-002, P3-EVD-009, P3-EVD-011 in `tests/package3-node/source-evidence.test.ts`
- [x] T037 [US4] [IMPL tests=T001,T036] Implement dependency-free source manifest and evidence binding using Node standard library only for P3-AUT-001, P3-AUT-002, P3-EVD-009, P3-EVD-011 in `scripts/package3-source-manifest.mjs`, `scripts/package3-evidence-binding.mjs`
- [x] T038 [US4] [EVIDENCE] Run exact unit/contracts and six-rule/missing/mutation checks and bind truthful status for P3-EVD-001, P3-EVD-002, P3-EVD-011 in `.artifacts/test/unit.json`
- [x] T039 [US4] [EVIDENCE] Run real-D1 migration/isolation/immutability/guard/finalizer/rollback/replay/concurrency checks and bind truthful status for P3-EVD-003, P3-EVD-013 in `.artifacts/test/d1.json`
- [x] T040 [US4] [EVIDENCE] Run component/result/dialog/error/live-region tests and bind truthful status for P3-EVD-007, P3-EVD-009 in `.artifacts/test/component.json`
- [x] T041 [US4] [EVIDENCE] Run real-browser complete rehearsal, semantics/background/focus/layout/reduced-motion checks and axe, keeping later founder manual proof separate, for P3-EVD-006, P3-EVD-009 in `.artifacts/browser/playwright.json`, `.artifacts/accessibility/axe.json`
- [x] T042 [US4] [EVIDENCE] Run observer/verifier import independence, privacy marker/storage-output scan, six rules, and all seven isolated mutations for P3-EVD-004, P3-EVD-005, P3-EVD-009 in `.artifacts/test/verifier-independence.json`
- [x] T043 [US4] [EVIDENCE] Run 100% verifier branch and repository Package 3 coverage thresholds without exclusions for P3-EVD-008, P3-EVD-009 in `.artifacts/test/coverage-summary.json`
- [x] T044 [US4] [EVIDENCE] Execute the full source-bound clean-clone quickstart and evidence binder, record exact PASS/FAIL/INCONCLUSIVE states, and leave unexecuted hosted/manual claims NOT_RUN for P3-EVD-009, P3-EVD-011 in `docs/evidence/PACKAGE3_VERIFICATION.md`
- [x] T045 [US4] [TEST] Add a failing evidence-gate test that rejects absent review, unresolved critical/high findings, or missing controlling requirements for P3-EVD-010 in `tests/package3-node/source-evidence.test.ts`
- [x] T046 [US4] [REVIEW] Obtain independent contract/security/privacy/accessibility/testing review, reconcile every finding, satisfy T045, and record zero unresolved critical/high or missing controlling requirement for P3-EVD-010 in `docs/evidence/PACKAGE3_ADVERSARIAL_REVIEW.md`

**Checkpoint**: Package 3 may later exit implementation only if all exact evidence and review gates pass; this task file itself proves none of them.

---

## Dependencies and execution order

### Phase dependencies

- Phase 1 blocks every story. T003/T004 must fail before T005; T006 must fail before T007.
- User Story 1 depends on T005 and T007. Its tests T008–T012 precede implementation T013–T016.
- User Story 2 depends on a finalized-session contract from User Story 1. Tests T017–T021 precede T022–T024.
- User Story 3 depends on the baseline verification operation. Tests T025–T029 precede hardening T030–T031.
- User Story 4 result implementation depends on verification output; T032–T034 precede T035. Evidence/review tasks T038–T046 depend on all implementation tasks and their green tests; T045 fails before T046 produces the review artifact.

### TDD predecessor matrix

| Implementation task | Required observed-failing predecessors |
|---|---|
| T005 | T003, T004 |
| T007 | T006 |
| T013 | T008, T009 |
| T014 | T010 |
| T015 | T011, T012 |
| T016 | T011, T012 |
| T022 | T017, T018 |
| T023 | T019, T020 |
| T024 | T021 |
| T030 | T025, T027, T028 |
| T031 | T026, T029 |
| T035 | T032, T033, T034 |
| T037 | T001, T036 |

### Parallel opportunities

Only tasks explicitly marked `[P]` target independent files or independent failing-test additions. A single writer must serialize edits to shared files. D1 failure injection, browser journeys, evidence binding, and final review are never treated as parallel substitutes for their dependencies.

## Implementation strategy

The smallest independently demonstrable increment is User Story 1 after the Phase 1 gates. The complete Package 3 gate still requires all four stories, all seven mutations, all registered evidence outputs, and independent review. Do not deploy, register a new tool, project precedent, or begin later packages as part of this graph.
