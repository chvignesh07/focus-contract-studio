# Data Model: Package 4 Verification Artifacts

Package 4 adds no product entity by default. This model describes benchmark/evidence values outside production request paths.

## Frozen seal result

| Field | Rule |
|---|---|
| `schemaVersion` | Fixed `fcs-package4-fixture-seal-v1`. |
| `manifestSha256` | SHA-256 of exact `SHA256SUMS-v2` bytes. |
| `files` | Exactly eight manifest-ordered filename/hash pairs. |
| `holdoutAccess` | Fixed `hash-only`; no derived holdout field exists. |
| `corpus` | Exactly 36 unique ordered records and the frozen materialized digest. |
| `development` | Exactly 12 unique cases with neutral query/reference/schema validation. |
| `calibration` | Fixed IDs/hashes, 12-case development summary, pre-seal gates, and overall PASS; holdout feasibility is checked only for receipt shape/self-consistency already present in the receipt. |
| `v1` | Exact pre-feature hashes and invalid label. |

## Development case result

| Field | Rule |
|---|---|
| `caseId` | `DEV2-01` through `DEV2-12`, in fixture order. |
| `disposition` / `reasonCode` | Exact production result. |
| `eligibleIds` | Ordered Stage-0 record keys, max 36. |
| `rankLists` | Lexical/structured/relationship record keys, each max 12. |
| `returned` | Max 3 records with outcome, integer/null ranks, structured score, relationship tier, full numeric RRF, eight-decimal display, and bounded evidence-only explanation metadata. |
| `golden` | Expected disposition, permitted relevant grades, and forbidden IDs from the development fixture only. |
| `determinism` | 100 repetitions and SHA-256 of canonical output bytes. |

## Development report

| Field | Rule |
|---|---|
| `schemaVersion` | Fixed `fcs-package4-development-report-v1`. |
| `benchmarkId` | `fcs-rrf-benchmark-v2`; environment identifies local production implementation. |
| `fixtureHashes` | Frozen permitted input hashes; holdout appears only as the seal hash, never content-derived data. |
| `summary` | 12 cases, 8 positive, 12 disposition-correct, zero forbidden, 100-repeat byte identity. |
| `metrics` | Six-decimal nDCG@3, MRR@3, Recall@3 for lexical, structured, relationship, and RRF. |
| `ablations` | Three pairwise ranker-fusion summaries plus the three individual baselines; no release claim. |
| `cases` | Twelve bounded case results. |

## D1 eligibility proof

| Field | Rule |
|---|---|
| `queryIdentity` | SHA-256 of the exact production SQL string. |
| `exclusions` | Workspace, status, hostile, product/family/use-case/variant/behavior/intent/risk/mismatch, temporal, outcome, supersession, and malformed materialization checks. |
| `parity` | Ordered database-loaded record keys equal the in-memory eligible set for supported seeded contexts. |
| `maximumRows` | At most 36 and deterministic record-key order. |
| `queryPlan` | Bounded `EXPLAIN QUERY PLAN` details naming the declared eligibility index. |

## Package 4 evidence binding

The source manifest binds the exact Package 4 changed-file inventory. Evidence artifacts bind the source aggregate, command, runtime, counts, assertions, hashes, review, convergence, and truthful pre-commit clean-clone disposition. The terminal session records the exact-commit clone result after commit creation. Status is one of `PASS`, `FAIL`, `INCONCLUSIVE`, `NOT_RUN`, or `NOT_APPLICABLE`.

## Invariants

- No Package 4 evidence object contains holdout queries, judgments, IDs, counts derived by parsing, or scores derived by execution.
- Benchmark judgments and metric code have no import path into a production module.
- No evidence result grants review, approval, application, or verification authority.
- A failed/interrupted/tampered proof cannot serialize as PASS.
- No new D1 table or row is required for Package 4 verification.
