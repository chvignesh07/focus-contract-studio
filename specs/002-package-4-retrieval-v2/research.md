# Phase 0 Research: Package 4 Frozen Retrieval v2

This artifact records repository-backed implementation decisions. It does not amend product authority or authorize a holdout/external action.

## Decision 1: Hold the frozen outcome and prove existing retrieval

**Decision**: Reuse `lib/retrieval/active-focus.ts`, BM25, RRF, corpus materialization/seed, and `loadEligiblePrecedents`. Add proof around them; change production only for a reproduced mismatch.

**Rationale**: Package 2 already implements and exercises the frozen path. The highest-leverage Package 4 gap is complete seal/dev/D1/boundary/evidence proof, not another implementation.

**Rejected alternatives**: A clean-slate ranker rewrite and a generalized retrieval framework both increase risk without closing a named gate.

## Decision 2: Hash-only holdout custody

**Decision**: The seal validator reads `rrf-holdout-queries-v2.json` only as a byte buffer passed directly to SHA-256. No JSON parse, text conversion, logging, import, count, or evaluation is permitted.

**Rationale**: This proves the sealed file identity while preserving the procedural holdout boundary requested for Package 4.

**Rejected alternatives**: Running the reference evaluator necessarily crosses the boundary. Parsing the holdout to validate schema/count also crosses it. Both are deferred.

## Decision 3: Schema-specific dependency-free validation

**Decision**: Use Node standard library plus small strict shape validators for the exact frozen corpus, override, development-suite, schema-document, manifest, and calibration contracts.

**Rationale**: No JSON Schema runtime is installed and no dependency is justified for two frozen schemas. Exact shape checks, duplicate-key detection, closed keys, enums/bounds, references, neutrality, and negative tests cover the required trust boundary.

**Rejected alternatives**: Add AJV/Zod to the script path (new or production dependency leakage), or merely parse JSON and count records (insufficient boundary proof).

## Decision 4: Development-only adapter over production retrieval

**Decision**: Keep expected judgments and metric calculations in `scripts/package4-development-benchmark.mjs`; import production `retrievePrecedent` and permitted materialized corpus only. Emit a deterministic bounded report.

**Rationale**: It executes the exact production algorithm while making the forbidden dependency direction mechanically obvious and scannable.

**Rejected alternatives**: Import/copy the evaluator, implement a second ranker, or embed development judgments in `lib/`.

## Decision 5: Actual D1 query, single SQL source

**Decision**: D1 tests invoke `loadEligiblePrecedents` against Workerd D1. If query-plan inspection needs access to the SQL, export the exact constant already used by that function; do not create a surrogate query.

**Rationale**: The test must prove the production path and plan. One SQL source prevents test drift.

**Rejected alternatives**: Simplified `precedent_records` query, mocked database, or a speculative new index.

## Decision 6: Transitive production reachability scan

**Decision**: Start from build-reachable `app/` production modules and server/retrieval entry points, resolve local imports recursively, and scan the reached files and import specifiers for forbidden benchmark/holdout material. Permit only the existing base-corpus/override data seed imports.

**Rationale**: Scanning `lib/retrieval` alone misses a transitive server/route dependency. Scanning every repository text file confuses tests/docs with production.

**Rejected alternatives**: One regex over one directory or a new bundler/plugin.

## Decision 7: Reuse Package evidence conventions

**Decision**: Reuse exact source inventory, strict evidence JSON, status vocabulary, Markdown summary, and negative tamper tests from Packages 1–3, but keep committed clone status `NOT_RUN`; only the terminal post-commit session can truthfully record exact-commit clone PASS.

**Rationale**: The request requires source/evidence binding but forbids a new trust framework.

**Rejected alternatives**: A second evidence registry, a new attestation format, or marking future hosted/release evidence PASS.

## Decision 8: No migration by default

**Decision**: First run the exact query-plan test against migrations 0001–0003. Add a numbered additive index migration only if that test fails and a candidate index demonstrably changes the plan.

**Rationale**: Existing indexes appear aligned with workspace/product/family eligibility. Evidence decides; planning does not.

**Rejected alternatives**: Premature `0004` migration or accepting an unindexed scan without bounded proof.
