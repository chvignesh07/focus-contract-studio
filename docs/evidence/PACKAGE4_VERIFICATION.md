# Package 4 Verification

<!-- package4-source-binding file_count=28 sha256=e8295f7e276cf7bdd29cb757c60f6d65524312973b2d29cf1582526d33fab0ec -->

Status: **LOCAL PACKAGE 4 PASS; EXTERNAL AND HOLDOUT NOT RUN**

Package: Frozen Retrieval v2 and Development Benchmark

## Custody and inherited baseline

- Source base commit: `98c8f0755cbde0fa1ea545962a2c825f67689168`
- Source base tree: `d3e0702ec0bedca080412f4f2f23d5c3027f9400`
- Work branch: `feat/package-4-retrieval-v2`
- Spec Kit feature: `specs/002-package-4-retrieval-v2`
- Inherited gate: `FCS_PACKAGE3_PLANNING_WORKSPACE=<PLANNING_WORKSPACE> npm run verify:package3` completed with exit 0 before Package 4 edits.
- Inherited browser evidence: Package 2 built browser 5/5 and Package 3 built browser 7/7.
- Inherited audit evidence: production and full dependency audits reported 0 vulnerabilities.
- Package 3 source/evidence bindings: `PACKAGE3_SOURCE_PASS` (39 files, SHA-256 `cdc3511c349f445f8f700e469b7c7caf3237eb2756b8a98a698625d015be7b8c`) and `PACKAGE3_EVIDENCE_PASS` (9 files).

The first sandboxed baseline attempt was `INCONCLUSIVE` because local loopback listen returned `EPERM`. The identical complete gate was rerun with local-loopback permission and passed; no source change occurred between attempts.

## Frozen fixture baseline

| Artifact | SHA-256 | Boundary |
|---|---|---|
| `SHA256SUMS` | `087f73da7e6e43439e1e44291f354db6b5bab8df51c802543a1cd7e69270c474` | v1 manifest, preserved invalid |
| `rrf-corpus-v1.json` | `5f0ca4d31b80b5cb270a1ddd14e2a6f98596a516acf84634e27ba522a179eaa3` | v1 base, preserved |
| `rrf-dev-queries-v1.json` | `8c7b9fbccffbf93a89fc917a49fa4b76b869a21d85e2d503b7c311df711999c5` | v1 development, preserved invalid |
| `rrf-holdout-queries-v1.json` | `dc89a94f891126fc8802e83182094b80fb0a8058e58be7400b49e90056319240` | v1 holdout, preserved invalid |
| `SHA256SUMS-v2` | `d671c490ec1c20d88c9c1a35b3ae262a3395ce3624e9bfe0b9394ebddfcef8f7` | v2 manifest |
| `rrf-corpus-overrides-v2.json` | `783fdd1507de009707e6a7f6fb5cd01412896bb21f55682f7dfcb8ef160ce9cb` | permitted materialization input |
| `rrf-dev-queries-v2.json` | `1bb9c02a4b5c9c20fa34e53ff85de86ea41c0425e35335cb295bdf182575298d` | permitted development judgments |
| `rrf-holdout-queries-v2.json` | `ff3d45dbf976582a23a7354ae84ffb67b83ea4029b2fa20cb2dc506c762629f0` | hash-only; content not accessed |
| `rrf-corpus-schema-v2.json` | `546d4ea2524cd04c4ff3520eb01d7091d25ecaa2bd60401f5c7232ac8ec56802` | permitted schema |
| `rrf-query-suite-schema-v2.json` | `d2db025ee29fd28282ae06d7e15b1db291a2831e2905a940f43cb121a3c6ee3e` | permitted schema |
| `reference-evaluator-v2.mjs` | `b9d027f8c3a1aeff248c72e811062cec1ff8340419d9c625af3fe4857a97fa7a` | hash-only; not executed |
| `RRF_V2_CALIBRATION.json` | `bc815df5557b483bc4a27f02735afbbd54c4cb350278cf83f29ffe79be9883b6` | permitted sealed receipt |

## Red-to-green evidence

### Fixture seal

- **RED 1**: `node --experimental-strip-types --test tests/package4-node/fixture-seal.test.ts` failed because `scripts/package4-fixture-seal.mjs` did not exist.
- **RED 2**: After the first implementation, 3/5 passed and 2/5 exposed validator defects: conflict was incorrectly counted as a positive metric case, and manifest cardinality masked duplicate-entry diagnostics.
- **GREEN**: The corrected shared rules pass 6/6 tests, including v1 manifest final-byte tamper rejection. `node scripts/package4-fixture-seal.mjs` reports `PACKAGE4_FIXTURE_PASS files=8 corpus=36 dev=12 holdout=hash-only v1=INVALID`.

The validator uses only Node standard-library hashing/filesystem primitives plus the existing strict duplicate-key JSON parser. It never imports or executes the reference evaluator. The v2 holdout path is rejected by the JSON reader and used only by opaque byte hashing.

### Development benchmark

- **RED 1**: `node --experimental-strip-types --test tests/package4-node/development-benchmark.test.ts` failed because the development-only adapter did not exist.
- **RED 2**: The exact Package 3 baseline `reciprocalRankFusion([[A,A],[],[]])` returned one result (`BASELINE_DUPLICATE_ACCEPTED`), contradicting the malformed-rank-list fail-closed contract.
- **GREEN**: The adapter and minimal shared duplicate/12-row RRF validation pass 7/7 benchmark tests. Twelve static packet SHA-256 seals bind exact dispositions, reasons, eligible IDs, all three ordered rank lists, returned rank vectors, contributions, explanations, and output order; a planted rank reversal fails.
- **Observed**: `PACKAGE4_DEV_PASS dispositions=12/12 goldens=12/12 forbidden=0 repeats=100 ndcg=0.963726`.

Development metrics match the sealed receipt exactly:

| System | mean nDCG@3 | MRR@3 | Recall@3 |
|---|---:|---:|---:|
| Lexical | 0.824102 | 0.750000 | 1.000000 |
| Structured | 0.885657 | 0.812500 | 1.000000 |
| Relationship | 0.963726 | 0.937500 | 1.000000 |
| RRF | 0.963726 | 0.937500 | 1.000000 |

Pairwise development ablations (reporting only; not a release gate): without lexical `0.891179/0.812500/1.000000`, without structured `0.963726/0.937500/1.000000`, and without relationship `0.891179/0.812500/1.000000` for mean nDCG@3/MRR@3/Recall@3. The 12-case determinism digest is `4b88b3347e6a25d573145968fdee047ff22e525d198f877bfb674f42d217766e`.

### Actual D1 query

- **RED**: The first real Workerd suite passed 4/5; query-plan proof failed because the production SQL was not addressable without duplicating it.
- **GREEN**: The SQL and binding order were exposed as single-source constants without changing query behavior. The suite passes 5/5 with 18 explicit exclusion categories, nine permitted development parity cases, malformed materialization fail-closed, deterministic order, and an absolute 36-row limit.
- SQL SHA-256: `fa5a14b0d8baffe61aedede09b35559d84e33df697be9b606f2f8424d44dfc01`.
- Plan: `SEARCH pr USING INDEX idx_precedent_profiles_eligibility`; primary-record lookup uses its workspace/id index; supersession uses `idx_precedent_eligibility`; production table scans: `0`. The bounded `json_each` virtual-table scans are the intended array membership predicates.
- Migration disposition: `NOT_REQUIRED`; exactly migrations 0001–0003 were applied.

### Production dependency boundary

- **RED**: The transitive boundary test initially failed because the Package 4 scanner did not exist.
- **GREEN**: 4/4 tests pass across 41 production entries, 59 reached files, and 132 local edges. Violations: `0`; permitted data-only corpus imports: exactly `2` from `lib/retrieval/corpus-v2.ts`.
- Direct, transitive, unresolved, non-literal, evaluator, calibration, development-judgment, and holdout dependency attacks fail closed.

### Evidence, review, and convergence

- Source manifest: 28 files, SHA-256 `e8295f7e276cf7bdd29cb757c60f6d65524312973b2d29cf1582526d33fab0ec`.
- Exactly two read-only reviewers completed; critical/high unresolved: `0`.
- Five findings were reproduced and repaired: exact packet seals, v1 manifest bytes, terminal clone ordering, benchmark command, and non-active D1 statuses.
- `$speckit-converge` was invoked exactly once and returned `converged`; findings: `0`; tasks appended: `0`.
- Package 3 historical evidence was not rewritten. All Package 3 source/evidence paths remain byte-frozen except additive Package 4 scripts in `package.json`; every inherited command remains exact, and all Package 3 behavioral/D1/DOM/coverage/browser regressions pass.

## Final gate

Command: `npm run verify:package4`

| Gate | Result |
|---|---|
| Typecheck and lint | `PASS` |
| Package 0 tests | `80/80` |
| Package 1 tests | `69/69` |
| Package 2 functional regressions | `52/52` |
| Package 3 functional regressions plus coverage | `61/61` |
| Package 4 Node plus real D1 | `29/29` |
| Built browser regressions | `12/12` |
| Total executed tests | `303/303` |
| Production build | `PASS` |
| Dependency audits | `PASS` — 0 vulnerabilities |
| Source and evidence bindings | `PASS` |
| Spec Kit convergence | `PASS` |
| Exact final commit clean clone | `NOT_RUN` | terminal post-commit proof cannot truthfully exist in committed pre-commit evidence |

Package 5: `NOT_AUTHORIZED`

Holdout: `NOT_RUN`

Hosted D1, deployment, real-client, founder-manual, merge, push, publication, account, Devpost, and plugin actions: `NOT_RUN`.
