# Tasks: Package 4 Frozen Retrieval v2

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/package4-verification.md`, and `quickstart.md`

**Tests**: Mandatory. Every new behavior begins with a focused failing test and ends with the smallest complete implementation.

**Authority**: Product authority overrides this derived task list. One root writer owns the checkout; review agents are read-only only after a stable diff.

## Phase 1: Frozen baseline and fixture seal

**Goal**: Prove exact input custody without opening the procedural holdout.

- [x] T001 Record the pre-edit v1 and v2 fixture hashes, exact base commit/tree, current dependency boundary, and inherited Package 3 PASS in `docs/evidence/PACKAGE4_VERIFICATION.md` without changing frozen fixture bytes.
- [x] T002 [US3] Add failing strict manifest/hash/holdout-hash-only tests in `tests/package4-node/fixture-seal.test.ts`, including malformed/duplicate/unexpected manifest and planted hash tamper.
- [x] T003 [US3] Extend the failing fixture tests for closed schema documents, strict permitted JSON shapes, 36-record whole-field materialization/order/digest, 12 unique development cases, references, canonical instants, and neutral query bytes.
- [x] T004 [US3] Extend the failing fixture tests for calibration receipt IDs/hashes/development metrics/pre-seal gates, reference-evaluator hash-only handling, and v1 byte preservation/invalid labeling.
- [x] T005 [US3] Implement the dependency-free strict seal validator in `scripts/package4-fixture-seal.mjs`; guarantee the v2 holdout is read only as an opaque hash buffer and never converted to text or JSON.
- [x] T006 [US3] Run the fixture-seal red-to-green command and record the exact initial failure and final bounded PASS summary in `docs/evidence/PACKAGE4_VERIFICATION.md`.

**Checkpoint**: All permitted fixture/seal checks pass; frozen inputs are unchanged; no holdout content was accessed.

## Phase 2: Production development benchmark

**Goal**: Execute every permitted development case through production retrieval with complete deterministic evidence.

- [x] T007 [US1] Add failing adapter tests in `tests/package4-node/development-benchmark.test.ts` for 12/12 dispositions, results/conflict/abstain reasons, relevant golden inclusion/order, and zero forbidden appearances.
- [x] T008 [US1] Extend the failing tests for eligible/ranker/output bounds, complete rank vectors and contributions, eight-decimal explanations, full-precision tie ordering, duplicate/error handling, and conflict/abstention packets.
- [x] T009 [US1] Extend the failing tests for lexical/structured/relationship/RRF nDCG@3, MRR@3, Recall@3 exact calibration parity, individual baselines, three pairwise ablations, and 100-repeat canonical-byte identity per case.
- [x] T010 [US1] Implement `scripts/package4-development-benchmark.mjs` as a development-only adapter importing production retrieval plus permitted corpus/dev inputs only; do not import or execute the reference evaluator or holdout.
- [x] T011 [US1] Emit the deterministic source-bound `.artifacts/retrieval/rrf-dev-report.json` with all 12 bounded case results, metrics, ablations, fixture hashes, determinism digest, and explicit local/non-release claim boundary.
- [x] T012 [US1] Run the benchmark red-to-green command and bind exact test totals, metrics, hashes, and zero-forbidden result in `docs/evidence/PACKAGE4_VERIFICATION.md`.

**Checkpoint**: Production retrieval passes 12/12 development dispositions, golden/metric parity, zero forbidden records, and 100-repeat determinism.

## Phase 3: Actual D1 eligibility query

**Goal**: Prove the exact prepared production query enforces Stage 0 before ranking.

- [x] T013 [US2] Add Package 4 Workerd/D1 configuration and setup in `vitest.package4.config.ts`, `wrangler.package4.jsonc`, and `tests/package4/d1-vitest-setup.ts`, applying exactly migrations 0001–0003 unless T017 proves an additive index necessary.
- [x] T014 [US2] Add failing real-D1 tests in `tests/package4/eligibility-query.test.ts` that invoke `loadEligiblePrecedents` and exclude foreign-workspace, hostile, inactive/rejected/quarantined, wrong product/family/use-case/variant/behavior/intent/risk/mismatch, expired/future, invalid outcome, and active-valid superseded rows.
- [x] T015 [US2] Extend the failing D1 tests for malformed bounded JSON/identity/rationale fail-closed behavior, actual-query/in-memory parity, deterministic record-key order, and an absolute 36-row maximum.
- [x] T016 [US2] Add a failing `EXPLAIN QUERY PLAN` assertion over the identical production SQL/binding order and require the declared eligibility index; reject any simplified surrogate.
- [x] T017 [US2] Add the minimum single-source SQL test seam in `lib/server/precedent-repository.ts` only if T016 requires it; run the exact plan and add one additive migration/index only if the current plan remains red and the new index is proven used.
- [x] T018 [US2] Run the D1 red-to-green suite and emit `.artifacts/test/package4-d1.json` with exact exclusions, parity, row maximum, SQL hash, and bounded plan detail.

**Checkpoint**: The actual production query is isolated, bounded, parity-proven, malformed-data fail-closed, and index-proven with no speculative migration.

## Phase 4: Build-reachable dependency boundary

**Goal**: Prove benchmark judgments and the holdout cannot reach production.

- [x] T019 [US3] Add failing transitive scan tests in `tests/package4-node/dependency-boundary.test.ts` for all app/server/retrieval production entries, unresolved/dynamic local imports, and planted direct/transitive forbidden dependencies.
- [x] T020 [US3] Add failing allowance tests proving only `rrf-corpus-v1.json` and `rrf-corpus-overrides-v2.json` are reachable through the data-only seed/materialization path and no expected field is consumed there.
- [x] T021 [US3] Implement `scripts/package4-dependency-boundary.mjs` with standard-library static local-import resolution and forbidden path/content checks over the reached graph.
- [x] T022 [US3] Run the boundary red-to-green command and emit `.artifacts/security/package4-boundary.json` with entry/reached counts, zero violations, the explicit seed allowance, and holdout access policy.

**Checkpoint**: Every build-reachable production dependency is scanned and zero forbidden benchmark/holdout path exists.

## Phase 5: Canonical gate, evidence, and execution truth

**Goal**: Bind the complete Package 4 proof using existing conventions.

- [x] T023 [US3] Add failing source/evidence contract and tamper tests in `tests/package4-node/source-evidence.test.ts` for exact inventory, strict JSON, hashes, runtime/command/test totals, metrics, query plan, boundary, reviews, convergence, and truthful pre-commit clone status.
- [x] T024 [US3] Implement `scripts/package4-source-manifest.mjs` and `scripts/package4-evidence-binding.mjs` by reusing Package 3 conventions without creating a new evidence registry or trust framework.
- [x] T025 [US3] Add Package 4 scripts and `verify:package4` to `package.json`, composing typecheck, lint, all prior functional/browser regressions, Package 4 fixture/Node/D1/benchmark/boundary checks, production build, audits, and source/evidence binding.
- [x] T026 [US3] Update `docs/evidence/EXECUTION_STATE.md` and `.json` truthfully: Package 3 PASS, Package 4 in progress until the final gate, and Package 5/later unauthorized.
- [x] T027 [US3] Create/update `docs/evidence/PACKAGE4_VERIFICATION.md`, `.artifacts/test/package4-source-manifest.json`, and `.artifacts/test/package4-local-gate.json` with only completed local evidence; hosted, holdout, manual, real-client, and later-package statuses remain unchanged/NOT_RUN.
- [x] T028 [US3] Run focused Package 4 tests, typecheck, lint, and production build; repair only reproduced failures with new regression coverage.

**Checkpoint**: Source/evidence contracts pass and execution truth has no future or external claim.

## Phase 6: Adversarial review and refinement

**Goal**: Close every material issue on a stable concrete diff.

- [x] T029 Run at most two parallel read-only reviewers: retrieval/D1/security/dependency boundary and benchmark/tests/evidence/product truth. No reviewer edits the checkout.
- [x] T030 Reproduce every critical/high/material finding locally; record false positives with evidence and fix valid findings through a failing regression before the smallest permanent correction.
- [x] T031 Finalize `docs/evidence/PACKAGE4_ADVERSARIAL_REVIEW.md` with exact reviewed source identity, findings/dispositions, retests, and zero unresolved critical/high issue.

## Phase 7: Full gate, convergence, and checkpoint

**Goal**: Finish the verified Package 4 exit and stop.

- [x] T032 Run the complete authoritative `verify:package4` gate on the stable final diff and bind exact totals, metrics, query plan, fixture hashes, browser counts, audit results, and source identity.
- [x] T033 Invoke `$speckit-converge` exactly once, reconcile every discovered gap against product authority, append/implement only a valid in-scope gap, and record a clean convergence result.
- [ ] T034 Mark Package 4 execution state PASS, finalize source/evidence bindings, review the exact diff, remove temporary cache links, and create one clean local Package 4 checkpoint commit.
- [ ] T035 Clone the exact final commit once with `--no-local --single-branch`, reuse caches without duplicate installation, run `verify:package4`, record commit/tree/clean result, then remove only that disposable clone.
- [ ] T036 Verify the Package 4 worktree is clean at the exact checkpoint and confirm main, pilot, WebMCP surface, v2 holdout content, hosted D1, deployment, accounts, Devpost, plugins, pushes/merges, and Package 5 were untouched.

## Dependencies & Execution Order

- T001–T006 → T007–T012 → T013–T018 → T019–T022 → T023–T028 → T029–T031 → T032–T036.
- One writer executes every mutation sequentially. `[US1]`, `[US2]`, and `[US3]` labels provide traceability, not concurrent-writer permission.
- T017 is conditional: no production SQL edit or migration occurs if the exact plan is already green.
- T029 is the sole implementation-time parallel wave and is read-only.
- T033 occurs once after implementation and review evidence, never as a substitute for the full gate.

## Traceability Summary

| Story | Requirements | Primary tasks |
|---|---|---|
| US1 frozen development result | FR-001, FR-005, FR-006, FR-009 | T007–T012 |
| US2 actual D1 boundary | FR-001, FR-007–FR-009 | T013–T018 |
| US3 seal/boundary/evidence | FR-002–FR-004, FR-010–FR-014 | T001–T006, T019–T028 |
| Exit gate | SC-001–SC-008 | T029–T036 |

## Notes

- Tests must be observed failing for the missing behavior before implementation; record bounded red-to-green evidence.
- Do not weaken a frozen threshold, rewrite a fixture, or inspect holdout content to make a test pass.
- Stop after T036 at Package 4.
