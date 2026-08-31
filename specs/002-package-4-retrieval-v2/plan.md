# Implementation Plan: Package 4 Frozen Retrieval v2

**Branch**: `002-package-4-retrieval-v2` | **Date**: 2026-08-31 | **Spec**: `specs/002-package-4-retrieval-v2/spec.md`

**Input**: Frozen Package 4 authority plus the exact Package 3 checkpoint `98c8f0755cbde0fa1ea545962a2c825f67689168`.

**Planning status**: Ready for checklist, tasks, analysis, and test-first implementation.

## Summary

Package 4 will prove the existing Package 2 retrieval rather than replace it. The implementation adds a dependency-free v2 seal validator, a development-only 12-case adapter/report, real D1 tests around the exact production eligibility query, a build-reachable dependency scan, and Package 4 source/evidence bindings. A production retrieval change or additive migration is allowed only after a focused red test establishes an authority deviation.

The v2 holdout remains opaque. Its file is read only as bytes by SHA-256 verification; it is never parsed, imported, printed, scored, or inspected. The reference evaluator is hash-checked but never executed. V1 artifacts remain byte-identical and visibly invalid.

## Technical Context

**Language/Version**: Existing strict TypeScript 5.9.3 and Node.js ESM scripts using only standard-library modules

**Primary Dependencies**: Existing React/Vinext, Zod, Drizzle, Cloudflare Workers/D1, Node test runner, Vitest/Workerd, Playwright, and axe; no new dependency

**Storage**: Existing D1 migrations `0001` through `0003`; no migration planned unless an exact production-query plan test first fails

**Testing**: Existing Node test runner, Vitest Workers pool, prior-package suites, built Playwright journeys, npm audit, deterministic source/evidence binders, and disposable no-local clone

**Target Platform**: Existing full-stack ChatGPT Site and local Worker-like D1; no hosted execution

**Project Type**: Full-stack web application with route → server repository → pure retrieval layering

**Performance Goals**: Eligibility returns at most 36 rows; each ranker at most 12; UI result at most 3; compact tool result remains at most 2. Local retrieval bytes are stable over 100 repeats. Hosted latency remains later evidence.

**Constraints**: One writer; frozen algorithm and fixtures; no holdout content access; no reference-evaluator execution; no new tool/UI/route; no external actions; dependency-free fixture validation; evidence is not authorization

**Scale/Scope**: 36 synthetic records, 12 permitted development cases, one production eligibility query, three rankers, one RRF fusion, one Package 4 feature

**Unresolved technical context**: None. Whether the current index is sufficient is an empirical test outcome, not a planning assumption.

## Constitution Check

### Pre-design gate

| Principle | Result | Design consequence |
|---|---|---|
| Authority before derived artifacts | PASS | Package 4 authority and the exact Package 3 checkpoint control generated artifacts. |
| Evidence is not authorization | PASS | Retrieval proof changes no review, approval, application, configuration, or WebMCP authority. |
| Test-first execution | PASS | Fixture, development, D1, dependency, and binding behavior start with red tests. |
| Real evidence before claims | PASS | Only completed local commands can mark Package 4 local evidence PASS; hosted/holdout claims remain NOT_RUN. |
| Simple existing architecture | PASS | Reuse production retrieval and D1 repository; add no dependency, service, database, route, UI, or trust framework. |
| One-writer custody | PASS | Root owns all writes; later reviewers are read-only and bounded to two. |

### Post-design gate

PASS. The design isolates benchmark-only code under scripts/tests, leaves production entry points unchanged except the minimum exact-query test seam if required, reuses existing Workerd D1 and evidence conventions, and creates no later-package or external surface.

## Architecture and Flow

1. The seal validator strictly parses `SHA256SUMS-v2`, hashes all eight named files, and treats the v2 holdout as bytes only. It manually validates the permitted corpus, overrides, schemas, development suite, references, neutral query text, materialization digest, and calibration self-consistency.
2. The development adapter imports only the existing production retrieval implementation plus permitted corpus/dev data. For each of 12 cases it records disposition, eligible IDs, three rank lists, returned rank vectors/scores, goldens, forbidden appearances, canonical bytes, 100-repeat determinism, individual-ranker metrics, RRF metrics, and ablations.
3. Real Workerd D1 tests call `loadEligiblePrecedents`, the actual prepared production repository function, against seeded and adversarial rows. The same SQL text is used for `EXPLAIN QUERY PLAN`; no simplified surrogate is accepted.
4. The dependency scanner starts from every production app route/page and server/retrieval entry, resolves transitive local imports, and rejects benchmark judgments, evaluator, calibration, or holdout reachability. The existing corpus base/override data-only seed path is the sole fixture allowance.
5. Package 4 source/evidence scripts bind the exact changed inventory, fixture hashes, test totals, benchmark metrics, query-plan detail, dependency result, review disposition, convergence, and truthful pre-commit clean-clone status. The terminal session records clone PASS only after the checkpoint exists.
6. `verify:package4` composes typecheck, lint, prior-package regressions, Package 4 Node/D1 tests, fixture and benchmark commands, production build, built browser regressions, audits, and source/evidence validation.

## Project Structure

### Feature documentation

```text
specs/002-package-4-retrieval-v2/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/package4-verification.md
├── checklists/
│   ├── requirements.md
│   └── package4.md
└── tasks.md
```

### Planned implementation targets

```text
lib/server/precedent-repository.ts          # exact SQL test seam only if red test requires
scripts/
├── package4-fixture-seal.mjs
├── package4-development-benchmark.mjs
├── package4-dependency-boundary.mjs
├── package4-source-manifest.mjs
└── package4-evidence-binding.mjs
tests/
├── package4-node/
│   ├── fixture-seal.test.ts
│   ├── development-benchmark.test.ts
│   ├── dependency-boundary.test.ts
│   └── source-evidence.test.ts
└── package4/
    ├── d1-vitest-setup.ts
    └── eligibility-query.test.ts
vitest.package4.config.ts
wrangler.package4.jsonc
package.json
docs/evidence/
├── PACKAGE4_VERIFICATION.md
├── PACKAGE4_ADVERSARIAL_REVIEW.md
├── EXECUTION_STATE.md
└── EXECUTION_STATE.json
.artifacts/
├── retrieval/rrf-dev-report.json
├── test/package4-d1.json
├── test/package4-local-gate.json
├── test/package4-source-manifest.json
└── security/package4-boundary.json
```

**Structure decision**: Keep runtime behavior in the existing retrieval/server modules. All judgment-bearing inputs and metric/report code remain in scripts/tests. One exact SQL constant may be exported from the current repository module only if the failing D1 query-plan test proves a shared test seam is needed; the function and SQL stay single-source.

## Requirement Design Map

| Requirements | Primary design boundary | Proof |
|---|---|---|
| FR-001, FR-009 | Existing `lib/retrieval/*` and `lib/server/precedent-repository.ts` | Red tests before any production edit; full regressions |
| FR-002–FR-004 | `package4-fixture-seal.mjs` | Strict seal tests, fixed hashes, negative mutations |
| FR-005–FR-006 | `package4-development-benchmark.mjs` | 12-case exact report and metric parity |
| FR-007–FR-008 | Actual `loadEligiblePrecedents` path | Real D1 exclusion/parity/bound/plan tests |
| FR-010 | `package4-dependency-boundary.mjs` | Transitive build-reachable scan and planted negatives |
| FR-011 | `package.json` `verify:package4` | Complete canonical gate |
| FR-012–FR-013 | Source/evidence binders and execution state | Exact inventory, hashes, truthful status |
| FR-014 | All Package 4 scripts/tests/review | Prohibited-action and holdout boundary audit |

## Test-First Implementation Sequence

1. Add failing fixture-seal tests, then the dependency-free strict validator.
2. Add failing 12-case benchmark/report tests, then the development-only adapter and exact metric/ablation output.
3. Add failing real-D1 actual-query tests for exclusions, parity, 36-row bound, malformed data, and query-plan index use. Change only the test seam or index demonstrated necessary by red evidence.
4. Add failing transitive dependency and planted-negative tests, then the build-reachable scanner.
5. Add failing source/evidence binding tests, then the minimal Package 4 binders, artifacts, verification record, execution-state update, and canonical command.
6. Run two read-only reviews on the stable diff, reproduce each material finding, fix with a red regression, run the complete gate, and invoke convergence once.

## Engineering Lens Disposition

Applied once after design on 2026-08-31:

- **Dependency boundary**: production app/server/retrieval modules may reach only the data-only base corpus and overrides; benchmark judgments, adapters, evaluator, calibration, reports, and holdout are downstream test/evidence dependencies only.
- **D1 query path**: test the exact prepared SQL and binding order through `loadEligiblePrecedents`; share its literal for `EXPLAIN` rather than maintaining a surrogate. Existing indexes get the first proof opportunity.
- **Happy path**: supported contexts return the bounded calibrated packet with full rank/explanation data.
- **Nil path**: unsupported context, no eligible row, and no support survivor abstain with stable reasons and no recommendation.
- **Conflict path**: two exact unsuperseded outcomes remain a two-record conflict; ranking never resolves authority.
- **Error path**: malformed stored JSON/identity, required-ranker failure, SQL failure, fixture tamper, dependency violation, or interrupted evidence fails closed without a PASS artifact or product mutation.
- **Tests and recovery**: focused red cases precede each implementation; exact failure detail stays local and bounded; only Package 4-generated evidence is regenerated; frozen fixtures and prior-package history are never rewritten to manufacture green.

Disposition: **PASS**. The minimum design closes every Package 4 gap with no additional architecture.

## Failure Recovery

- Seal mismatch: fail with the filename only; never print fixture content. Restore only an accidentally changed Package 4-created file—never rewrite frozen inputs.
- Development mismatch: retain per-case bounded ranks/metrics, reproduce with the single case, and fix only a proven production deviation or adapter error.
- D1 plan/exclusion mismatch: capture the actual plan/detail and result IDs; prefer the existing index; add one additive index only when the exact test fails and the new plan proves use.
- Ranker/repository malformed data: fail closed to stable abstention/error evidence; never coerce or leak the row.
- Evidence mismatch: leave status non-PASS, rerun the exact command on the final source bytes, and regenerate only Package 4 evidence.
- Interrupted command: record `INCONCLUSIVE`; do not infer pass.

## Complexity Tracking

No constitution violation is planned. Separate validator, benchmark adapter, dependency scanner, and binder scripts correspond to four independently required trust boundaries and remain outside production request paths. No generic framework, new dependency, migration, route, or UI abstraction is introduced.
