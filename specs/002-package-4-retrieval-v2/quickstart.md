# Validation Quickstart: Package 4 Frozen Retrieval v2

This protocol is the Package 4 local exit gate. It never authorizes hosted or external work.

## Prerequisites

- Exact Package 3 base commit/tree and clean Package 4 worktree.
- Existing Node/npm dependencies and Playwright browser cache reused; no new install.
- Fresh local Workerd D1 using migrations 0001–0003 unless a red exact-query plan test proves an additive 0004 index necessary.
- `FCS_PACKAGE3_PLANNING_WORKSPACE` supplied only for inherited Package 3 binding checks.
- No credential, hosted binding, private browser profile, or holdout-processing command.

## Focused red-to-green sequence

1. `npm run test:package4:fixtures` — strict manifest/schema/materialization/reference/calibration/v1 tests.
2. `npm run test:package4:benchmark` — 12 development cases, exact metrics/ablations, zero forbidden, 100 repeats.
3. `npm run test:package4:d1` — actual production query exclusions, parity, 36 bound, malformed fail-closed, query-plan index.
4. `npm run test:package4:boundary` — build-reachable transitive import scan and planted negatives.
5. `npm run test:package4:node` — combined Package 4 unit/source/evidence contract tests.

Each behavior begins as a failing test. A test intentionally fails only before its minimal implementation exists; the red output is summarized in `docs/evidence/PACKAGE4_VERIFICATION.md` without claiming it as final evidence.

## Development acceptance

- Cases: 12/12 correct dispositions; 8 positive cases.
- Safety: zero forbidden/ineligible appearances.
- Output: rank lists ≤12, returned ≤3, complete rank vectors/scores, conflict and abstention exact.
- Golden parity: production metrics equal the sealed development calibration to six decimals.
- Determinism: every case is byte-identical for 100 repetitions.
- Baselines/ablations: all individual and pairwise systems are reported without a release-superiority claim.

## D1 acceptance

- Invoke the real `loadEligiblePrecedents` path.
- Test hostile, malformed, foreign-workspace, wrong-scope, inactive/rejected/quarantined/superseded/expired/outcome-invalid exclusions.
- Compare ordered loaded IDs and production retrieval output with the permitted in-memory corpus result.
- Prove ≤36 rows and deterministic order.
- Run `EXPLAIN QUERY PLAN` over the exact SQL and assert the named eligibility index.

## Full gate

```text
FCS_PACKAGE3_PLANNING_WORKSPACE=<PLANNING_WORKSPACE> npm run verify:package4
```

The command must include Package 0–3 regressions, typecheck, lint, production build, 12 existing built browser journeys, both dependency audits, fixture seal, Package 4 Node/D1/benchmark/boundary checks, and source/evidence bindings.

## Review and convergence

After a stable diff, run two read-only reviews in parallel:

1. retrieval/D1/security/dependency boundary;
2. benchmark/tests/evidence/product truth.

Reproduce every material finding before fixing it. Then run the full gate and invoke `$speckit-converge` once. A clean result leaves all tasks complete and appends no task.

## Final clone

Create one disposable clone from the exact checkpoint using `git clone --no-local --single-branch --branch feat/package-4-retrieval-v2`. Reuse the external dependency/browser caches without copying them into the clone, run the exact Package 4 gate, record commit/tree/result, and remove only that disposable clone.

## Evidence language

Use only the registered status vocabulary. Local Package 4 PASS does not imply the release holdout, hosted latency, public deployment, real ChatGPT/Chrome, founder manual accessibility, Package 5, or a public benchmark claim.
