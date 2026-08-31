# Feature Specification: Package 4 Frozen Retrieval v2

**Feature Branch**: `002-package-4-retrieval-v2`

**Created**: 2026-08-31

**Status**: Ready

**Input**: User description: "Verify frozen Retrieval v2 and pass the 12-case development benchmark against production retrieval without opening the procedural holdout."

**Controlling authority**: Root `AGENTS.md`; `START_HERE.md`; Package 4 in `docs/delivery/CODEX_IMPLEMENTATION_PLAN.md`; `docs/retrieval/RETRIEVAL_AND_RRF_SPEC.md`; `docs/retrieval/RRF_BENCHMARK.md`; `docs/quality/TEST_STRATEGY.md`; `docs/quality/TRACEABILITY_MATRIX.md`; and the adopted post-Package-3 execution upgrade. Authority overrides this derived feature record.

## User Scenarios & Testing

### User Story 1 - Trust the frozen development result (Priority: P1)

As an accessibility or design-system lead, I can rely on the product's existing retrieval to return only eligible precedent with the sealed v2 disposition, ordering, ranks, and explanation for every development case.

**Why this priority**: Retrieval is useful only when its evidence packet is scoped, deterministic, and unable to smuggle an ineligible record into proposal support.

**Independent Test**: Run all 12 sealed development cases through the production retrieval implementation and compare dispositions, relevant goldens, forbidden records, rank vectors, output bounds, conflict/abstention behavior, and 100-repeat canonical bytes.

**Acceptance Scenarios**:

1. **Given** the sealed 36-record effective corpus and a supported development context, **when** production retrieval runs, **then** its disposition and development golden packet match and no forbidden record appears.
2. **Given** the conflict development context, **when** production retrieval runs, **then** both exact divergent outcomes are returned as `conflict/EXACT_OUTCOME_CONFLICT` and score does not resolve them.
3. **Given** unsupported or incomplete development contexts, **when** retrieval runs, **then** it abstains before ranking and returns no recommendation.
4. **Given** any development case, **when** its result is serialized 100 times, **then** every byte is identical.

---

### User Story 2 - Trust the database eligibility boundary (Priority: P1)

As a product operator, I can prove that the actual prepared D1 query used by the product excludes foreign, hostile, malformed, wrong-scope, inactive, superseded, and expired records before any ranker sees them.

**Why this priority**: Eligibility is the security and isolation boundary; an in-memory surrogate cannot prove the live query path.

**Independent Test**: Execute the production repository query against real Worker-like D1 data, compare its records with the in-memory eligibility result, assert at most 36 rows, and inspect `EXPLAIN QUERY PLAN` for the declared eligibility index.

**Acceptance Scenarios**:

1. **Given** eligible and deliberately ineligible rows across workspaces and statuses, **when** the actual prepared query runs, **then** only the expected current-workspace records reach retrieval.
2. **Given** an active valid successor, **when** the query runs, **then** the superseded predecessor is excluded.
3. **Given** more than 36 potentially matching rows, **when** the query runs, **then** at most 36 ordered rows are returned.
4. **Given** the production SQL and migration indexes, **when** its query plan is inspected, **then** the declared eligibility index is used without requiring a speculative migration.

---

### User Story 3 - Trust the benchmark boundary and evidence (Priority: P1)

As a reviewer, I can verify the v2 seal and Package 4 result without exposing the procedural holdout or allowing benchmark judgments into production.

**Why this priority**: Benchmark integrity and truthful evidence are necessary for any later bounded retrieval claim.

**Independent Test**: Run a dependency-free seal validator, a build-reachable production dependency scan, source/evidence binding validators, and the canonical Package 4 verification command.

**Acceptance Scenarios**:

1. **Given** the frozen v2 manifest, **when** the seal validator runs, **then** all eight hashes match; the holdout file is only byte-hashed; the schemas, 36-record materialization, 12 development cases, references, neutral queries, and calibration receipt validate.
2. **Given** the preserved v1 files, **when** Package 4 validates them, **then** their pre-feature hashes are unchanged and their invalid status remains explicit.
3. **Given** every build-reachable production route, server, and retrieval module, **when** dependency scanning runs, **then** none imports development judgments, evaluator code, calibration data, or the holdout; only the data-only corpus seed path is allowed.
4. **Given** Package 4 source and evidence, **when** bindings are verified, **then** exact files, hashes, commands, test totals, benchmark metrics, query-plan proof, and review dispositions agree.

## Edge Cases

- A manifest line is missing, duplicated, reordered, malformed, or names an unexpected file.
- The holdout hash differs while all permitted development fixtures still match.
- A schema accepts unknown properties, duplicate identifiers, dangling references, a noncanonical timestamp, or a non-neutral query.
- Materialization adds, deletes, reorders, or partially merges records instead of replacing whole fields.
- A required ranker errors, returns duplicate IDs, returns more than 12 rows, or produces an incomplete rank vector.
- Full-precision RRF scores tie, displayed eight-decimal strings tie, or database row order changes.
- Only family/wildcard evidence survives, no candidate survives the support gate, or an exact conflict is superseded.
- Malformed stored JSON passes SQL predicates but fails the repository's bounded materialization.
- A dependency is hidden through a transitive import from a route or server module.
- Evidence is generated from a dirty source tree, a different commit, or a command that did not finish.

## Requirements

### Functional Requirements

- **FR-001**: Package 4 MUST preserve the existing production retrieval algorithm, D1 repository, seed path, routes, and UI unless a new failing Package 4 test proves a deviation from controlling authority.
- **FR-002**: A dependency-free validator MUST verify all eight `SHA256SUMS-v2` entries, and MUST treat `rrf-holdout-queries-v2.json` as an opaque byte stream used only for its already-sealed SHA-256 comparison.
- **FR-003**: The validator MUST validate the v2 corpus and query-suite schema contracts, exactly 36 materialized records, exactly 12 development cases, unique identifiers, valid references, whole-field replacement, stable record order, exact neutral query construction, and the calibration receipt's self-consistency.
- **FR-004**: Package 4 MUST preserve every v1 fixture byte-for-byte and MUST continue to label v1 invalid.
- **FR-005**: A development-only adapter MUST execute all 12 development cases against `retrievePrecedent` and MUST NOT execute or import the reference evaluator.
- **FR-006**: The development report MUST prove exact disposition accuracy, development golden relevance/order parity, zero forbidden appearances, complete rank vectors and contributions, stable ties, bounded top-12/top-3 outputs, explanations, conflict, abstention, individual-ranker baselines, RRF metrics, ablations, and 100-repeat byte determinism.
- **FR-007**: The actual `loadEligiblePrecedents` prepared D1 query MUST be tested for workspace, product, component, use-case, variant, behavior, intent, risk, mismatch, status, hostile, temporal, allowed-outcome, and supersession exclusions.
- **FR-008**: D1 tests MUST prove query/in-memory parity, an absolute 36-row maximum, deterministic record-key order, and `EXPLAIN QUERY PLAN` use of the declared eligibility index; an additive migration is permitted only after a red query-plan test proves the current index insufficient.
- **FR-009**: Production retrieval MUST fail closed for malformed stored candidate data and required-ranker failures; benchmark-only code MUST remain outside production request paths.
- **FR-010**: A transitive static dependency scan MUST cover every build-reachable production route, server module, and retrieval module and forbid imports or reads of development judgments, the reference evaluator, calibration data, or holdout content, except for the narrowly required data-only corpus seed inputs.
- **FR-011**: The repository MUST expose one `verify:package4` command that includes all prior-package regressions, typecheck, lint, production build, audits, fixture validation, the 12-case development benchmark, D1 query-plan/parity, dependency scanning, source/evidence bindings, and applicable browser gates.
- **FR-012**: Package 4 MUST bind truthful source and evidence artifacts using existing repository conventions, including exact hashes, commands, test counts, development metrics, query-plan detail, review dispositions, and a pre-commit `NOT_RUN` clean-clone status; the terminal session records PASS only after the checkpoint exists.
- **FR-013**: Product execution state MUST record Package 3 as completed and Package 4 as completed only after the Package 4 exit gate passes; later packages remain unauthorized.
- **FR-014**: No Package 4 operation may parse, import, print, score, or inspect `rrf-holdout-queries-v2.json`; start Package 5; change the WebMCP surface; merge, push, deploy, mutate hosted D1, change account access, update Devpost, install plugins, or modify main or the historical pilot.

### Key Entities

- **Frozen fixture seal**: The eight named v2 manifest inputs and their immutable SHA-256 values, plus pre-feature v1 hashes.
- **Effective v2 corpus**: The ordered 36-record materialization produced by whole-field replacements over the v1 base.
- **Development case**: One of 12 permitted contexts with expected disposition, relevance grades, forbidden IDs, and rationale.
- **Development result**: Production retrieval output plus disposition, ordered records, rank vectors, contributions, scores, baselines, ablations, metrics, and determinism digest.
- **Eligibility query proof**: The actual prepared D1 query inputs, bounded results, parity result, and query-plan index detail.
- **Package 4 evidence binding**: Exact source manifest and truthful gate artifact tied to the local checkpoint.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All 12 of 12 development dispositions pass, with exact required goldens and zero forbidden or ineligible records in any returned packet.
- **SC-002**: Every development case produces byte-identical canonical output over 100 repetitions.
- **SC-003**: The actual prepared D1 query returns no excluded record, matches in-memory eligibility for valid seeded contexts, returns no more than 36 rows, and its plan names the declared eligibility index.
- **SC-004**: All eight v2 hashes, both schema contracts, 36-record materialization, 12-case suite, neutral queries, references, and calibration receipt pass without reading holdout content beyond hashing.
- **SC-005**: Every preserved v1 artifact has the same SHA-256 value before and after Package 4 and remains labeled invalid.
- **SC-006**: Static dependency checks find zero forbidden production-to-benchmark/holdout paths across all build-reachable production modules.
- **SC-007**: `verify:package4`, one convergence pass, two bounded read-only reviews, and the exact final disposable no-local clone all pass with zero unresolved critical/high finding.
- **SC-008**: The Package 4 checkout ends clean on one local checkpoint commit, while main, pilot, hosted systems, external accounts, WebMCP surface, holdout procedure, and Package 5 remain untouched.

## Assumptions

- Package 3 commit `98c8f0755cbde0fa1ea545962a2c825f67689168` and tree `d3e0702ec0bedca080412f4f2f23d5c3027f9400` are the immutable starting point.
- The existing Package 2 retrieval implementation is the production implementation under test and is already functionally active.
- The local Spec Kit v1.0.1 installation and constitution remain valid; no reinitialization or adoption ceremony is needed.
- The procedural holdout remains public but unopened by this goal; its one-time release execution belongs to Package 9.
- Existing dependency and Playwright caches may be reused through temporary ignored links, which are removed before handoff.

## Clarifications

### Session 2026-08-31

- No founder questions were required. Controlling authority resolves scope, behavior, data, security, failure handling, performance bounds, fixture custody, test evidence, and prohibited actions.
- The existing Package 2 retrieval is held as the implementation baseline; Package 4 adds proof first and changes production behavior only for a reproduced authority deviation.
- The procedural holdout is opaque in this goal: only its manifest-listed file hash may be computed and compared.

## Out of Scope

- Package 5 or later behavior, new WebMCP tools, UI redesign, deployment, hosted D1 changes, real-client qualification, holdout scoring, public claims, merge/push/publication, and Devpost work.
- New retrieval algorithms, thresholds, corpora, fixtures, dependencies, migrations, or trust frameworks unless a frozen Package 4 test first proves a necessary in-scope correction.
