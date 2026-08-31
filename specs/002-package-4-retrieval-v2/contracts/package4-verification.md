# Package 4 Verification Contract

## Fixture seal command

`npm run verify:package4:fixtures` exits zero and prints one bounded `PACKAGE4_FIXTURE_PASS` summary only when all eight hashes, schema documents, permitted JSON fixtures, materialization, references, neutral queries, calibration receipt, and v1 preservation checks pass. A failure names the boundary/file but never prints fixture content. The v2 holdout is opened only as bytes for SHA-256.

## Development benchmark command

`npm run verify:package4:benchmark` runs all 12 development cases through production `retrievePrecedent`. It exits nonzero on any disposition/golden/forbidden/rank/bound/explanation/determinism/metric mismatch. The report is deterministic apart from explicitly excluded runtime timestamps; tracked evidence uses canonical source-bound values.

For `results`, every grade-3 expected ID must appear in the returned top three and relevance/order must reproduce the calibrated development metrics. For `conflict`, both grade-3 expected IDs must appear with distinct outcomes. For `abstain`, no record is returned. No forbidden ID may appear in eligible or returned records as defined by its case.

## Actual D1 query contract

Tests call `loadEligiblePrecedents` with server-owned workspace/context/as-of bindings. Query-plan proof uses the identical SQL constant used by that function and identical binding order. It must show an eligibility index, return sorted record keys, and remain bounded by `LIMIT 36`.

Rows failing a SQL eligibility predicate never reach materialization. Rows whose bounded JSON/rationale/identity fields are malformed cause the repository call to reject and the active-review service to fail closed; they are never coerced into a result.

## Production dependency contract

The scanner resolves static local imports from all `app/**/*.ts(x)` production entries plus directly build-reachable server/retrieval modules. Reached production files may reference only data-only `rrf-corpus-v1.json` and `rrf-corpus-overrides-v2.json` through `corpus-v2.ts`. They may not reference development queries, expected judgments, reference evaluator, calibration, holdout, benchmark adapters/reports, or Package 4 evidence.

Dynamic local imports, unresolved local specifiers, or path traversal fail closed. Test scripts and documentation may consume permitted development judgments but are never production entry points.

## Evidence and completion contract

`verify:package4` must execute every prior-package local regression plus Package 4 fixture, Node, D1, benchmark, boundary, typecheck, lint, build, browser, audit, source, and evidence checks. An interruption is `INCONCLUSIVE`.

Package 4 verification Markdown and JSON may claim only local proof. Hosted Sites, real clients, one-time release holdout, founder-manual checks, deployment, and release claims remain `NOT_RUN` or unchanged. Committed evidence records the exact-commit clone as `NOT_RUN` because the checkpoint does not yet exist; the terminal session records PASS only after that exact commit passes from a disposable credential-disabled `--no-local --single-branch` clone.
