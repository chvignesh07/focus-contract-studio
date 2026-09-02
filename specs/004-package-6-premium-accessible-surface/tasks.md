# Tasks: Package 6 Premium Accessible Product Surface

**Input**: Design documents from `/specs/004-package-6-premium-accessible-surface/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, approved requirements checklists

**Tests**: Package 6 requires retained red-to-green proof plus node, real-D1, DOM, built-browser, accessibility, visual, binding, and exact-clone gates.

## Phase 1: Planning and TDD Foundation

- [x] T001 Record the one-time CEO HOLD and actual Package 5 80-item design review in `specs/004-package-6-premium-accessible-surface/ceo-plan.md` and `design-review.json`
- [x] T002 Complete and quality-review the Spec Kit specification, plan, research, data model, contracts, quickstart, and checklists under `specs/004-package-6-premium-accessible-surface/`
- [x] T003 [P] Add failing pure behavior/privacy/state tests in `tests/package6-node/package6-domain.test.ts`
- [x] T004 [P] Add failing protected route/CAS tests in `tests/package6/active-variant.test.ts` and Package 6 Vitest configuration
- [x] T005 [P] Add failing acknowledgement/cancellation/receipt/timeline/state DOM tests in `tests/package6-dom/focus-contract-studio.test.tsx` and Package 6 DOM configuration
- [x] T006 Run the focused Package 6 tests before production edits and retain deterministic red evidence in `docs/evidence/PACKAGE_6_RED_TO_GREEN.md`

## Phase 2: User Story 1 — First-Viewport Product Truth

**Goal**: A cold judge can understand current truth, precedent, application state, authority, and verification limits from the working first viewport.

**Independent Test**: Pure stage tests plus DOM heading/source-order tests and one context-free 15-second evaluation.

- [x] T007 [US1] Implement six-stage and operation-state derivation in `lib/domain/package6.ts`
- [x] T008 [US1] Extend the safe human precedent DTO in `lib/server/precedent-repository.ts` and `lib/server/active-focus-review.ts` while preserving the exact bounded WebMCP mapping in `lib/webmcp/register.ts`
- [x] T009 [US1] Recompose `app/focus-contract-studio.tsx` around the live dialog/Decision Mismatch anchor, first-viewport truth, real-stage rail, conflict/abstention, complete evidence, and exact proposal diff
- [x] T010 [US1] Replace the baseline visual hierarchy with a tokenized warm-neutral responsive system in `app/globals.css` and preserve native dialog behavior in `app/delete-account-dialog.tsx`

## Phase 3: User Story 2 — Exact Review, Variant, and Apply

**Goal**: The reviewer can safely switch variants, acknowledge/review the exact proposal, apply once, copy the permanent receipt, and start revision-2 rehearsal.

**Independent Test**: Real-D1 route/security/CAS tests and DOM/browser review/apply/copy/rehearsal tests with WebMCP unavailable.

- [x] T011 [US2] Add the allowlisted server-side variant lookup/CAS seam in `lib/server/workspaces.ts`
- [x] T012 [US2] Add the strict same-origin `POST /api/active-variant` route in `app/api/active-variant/route.ts`
- [x] T013 [US2] Implement AbortController generation cancellation, review/history refetch, and tool abort/re-registration in `app/focus-contract-studio.tsx`
- [x] T014 [US2] Implement exact proposal acknowledgement reset/gating and retain visible confirmation/digest/base binding in `app/focus-contract-studio.tsx`
- [x] T015 [US2] Render the existing committed application receipt permanently, add native copy behavior, retain same-key recovery language, and make the primary action start the existing revision-2 rehearsal across `app/focus-contract-studio.tsx` and `app/delete-account-dialog.tsx`

## Phase 4: User Story 3 — Verification, History, Recovery, and Accessibility

**Goal**: Verification truth, complete chronological history, every recovery state, undo/reset, and responsive keyboard behavior are explicit and observable.

**Independent Test**: DOM state-contract tests and built Playwright full-flow journeys at desktop, 320 px, 375 px, and 640 CSS px at DPR 2 responsive emulation; true browser UI 200% zoom remains founder-manual `NOT_RUN`.

- [x] T016 [US3] Render all six verification checks, raw-sequence references, revision/projection provenance, and exact proof exclusions in `app/focus-contract-studio.tsx`
- [x] T017 [US3] Expand the safe chronological timeline detail and preserve deliberate undo/reset confirmation/recovery in `app/focus-contract-studio.tsx`
- [x] T018 [US3] Render every named public state through the one-next-action contract with restrained live announcements in `app/focus-contract-studio.tsx`
- [x] T019 [US3] Add full built-browser journeys for semantic heading/source order, computed contrast, 44px targets, native-dialog/inertness, keyboard/focus visibility, restrained live regions, reduced motion, axe, viewport/responsive-emulation overflow, no-WebMCP, copy, timeline, undo/reset, and deterministic screenshot hashing in `tests/package6-browser/premium-surface.spec.ts` and `playwright.config.ts`
- [x] T020 Run focused node, D1, DOM, and built-browser tests green and record exact red-to-green totals in `docs/evidence/PACKAGE_6_RED_TO_GREEN.md`

## Phase 5: Evidence, Review, and Local Checkpoint

- [x] T021 [P] Add Package 6 source manifest, evidence binding, tamper tests, exact frozen Package 5 verifier, visual/design/cold validator, and composed scripts in `scripts/package6-*.mjs`, `tests/package6-node/`, and `package.json`
- [x] T022 [P] Record deterministic visual hashes, Package 6 verification matrix, execution state, truthful `NOT_RUN` rows, and design-resolution evidence under `docs/evidence/`
- [x] T023 Run one context-free read-only cold evaluator on only the final built page/screenshot and record its five answers and elapsed time
- [x] T024 Dispatch at most two read-only reviewers for product/design/accessibility and regression/security/privacy/evidence; reproduce and fix every valid material finding
- [x] T025 Run Spec Kit convergence exactly once; append only genuinely missing remediation tasks and complete them without rerunning convergence
- [x] T026 Run `npm run verify:package6`, inspect the complete diff, remove cache links/generated residue, and prove the worktree clean except intended tracked changes
- [x] T027 Create the single authorized local checkpoint commit, run `verify:package6` from one disposable `--no-local --single-branch` clone of that exact commit, remove its cache links, prove clone cleanliness, and remove only the clone
- [x] T028 Reverify Package 6 and earlier checkout identities/cleanliness, then report exact commit/tree/parent, paths, design/cold/reviewer/test/binding/clone evidence and every unperformed external/later action

## Dependencies & Execution Order

- T001–T002 precede T003–T006.
- T003–T006 are the required red gate before T007–T019 production edits.
- T007–T010 establish presentation truth before T011–T015 guarded interaction and T016–T019 complete recovery/accessibility.
- T020 must pass before evidence/reviewer work.
- T021–T023 can proceed after a stable green implementation.
- T024 precedes the one and only convergence run T025.
- T026 precedes the single commit; T027 precedes final re-verification T028.

## Implementation Strategy

One writing owner executes sequentially in this checkout. Read-only reviewers receive only stable diffs/evidence and never edit. Native platform behavior and existing Package 5 seams are used before any new abstraction.

## Phase 6: Convergence

- [x] T029 Record the two final read-only reviewer dispositions, reproduced findings, permanent fixes, and zero unresolved material findings in `docs/evidence/PACKAGE6_ADVERSARIAL_REVIEW.md` per SC-006 and Constitution V (partial)
