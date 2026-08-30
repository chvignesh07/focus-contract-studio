# Focus Contract Studio — Sealed RRF Benchmark v2

Status: **V1 INVALIDATED; V2 CALIBRATED AND SEALED BEFORE PRODUCT RETRIEVAL CODE**  
V1 ID: `fcs-rrf-benchmark-v1-invalid`  
V2 ID: `fcs-rrf-benchmark-v2`  
Effective corpus: 36 synthetic records  
Development: 12 queries  
Procedural holdout: 18 queries

## Why v1 is preserved as failed

The first preregistration required RRF holdout mean nDCG@3 to exceed the strongest single ranker by 0.05. Mechanical pre-implementation review found the relationship baseline already had nDCG@3 = 1.0 on every positive holdout, so the required improvement was mathematically impossible. This was a benchmark-design failure, not an implementation failure.

V1 files and hashes remain unchanged. They cannot be called a passed benchmark. V2 changes the algorithm specification to eligible-only TypeScript BM25, uses answer-neutral deterministic queries, adds schemas and deliberately complementary synthetic rank signals, and mechanically checks baseline ceilings before sealing.

## V2 hypothesis

On the bounded synthetic precedent task, three independently imperfect but safe rankers fused with RRF will:

1. preserve zero ineligible/forbidden leakage and correct dispositions;
2. produce mean positive-case nDCG@3 at least 0.05 above **each** individual eligible ranker on the v2 holdout;
3. preserve high exact-hit/recall/determinism without using expected outcomes in rank code.

The benchmark proves only this bounded claim. It does not prove real-user value, general search quality, production scale, or that RRF is universally superior.

## Files

| Planning-pack path | Role |
|---|---|
| `fixtures/rrf/rrf-corpus-v1.json` | Immutable 36-record base retained from v1. |
| `fixtures/rrf/rrf-corpus-overrides-v2.json` | Whole-field replacements that deterministically materialize the effective v2 corpus. |
| `fixtures/rrf/rrf-dev-queries-v2.json` | 12 development cases. |
| `fixtures/rrf/rrf-holdout-queries-v2.json` | 18 one-time holdout cases. |
| `fixtures/rrf/rrf-corpus-schema-v2.json` | Effective corpus JSON Schema. |
| `fixtures/rrf/rrf-query-suite-schema-v2.json` | Query-suite JSON Schema. |
| `fixtures/rrf/reference-evaluator-v2.mjs` | Dependency-free exact materializer/evaluator/calibration validator. |
| `fixtures/rrf/SHA256SUMS-v2` | Hashes of every v2 input/schema/evaluator. |
| `fixtures/rrf/RRF_V2_CALIBRATION.json` | Pre-seal development and holdout ceiling/metric record produced before product code. |

The future product repository copies these files byte-for-byte. Production code reimplements the frozen spec and must match the reference evaluator's development golden ranks without importing it.

## Seal and holdout honesty

The public holdout is **procedurally held out**, not secret. The planning reference evaluator was run once solely to prove feasibility and seal baseline ceilings before product retrieval code. After sealing:

- implementation uses only development cases and published golden development ranks;
- product code cannot import reference evaluator, holdout, or expected judgments;
- an independent reviewer runs holdout once after source commit `C` and public deployment;
- any failure remains recorded; a redesign requires benchmark v3 and a new source commit/version, never a lowered v2 gate.

## Metrics

Positive `results` cases:

- graded nDCG@3 (`3` exact, `2` strong, `1` weak);
- MRR@3 using grade 3 as exact relevance;
- Recall@3 over grade 2–3;
- top-three forbidden/ineligible contamination.

All cases:

- disposition accuracy;
- forbidden/ineligible appearances by category;
- 100-repeat byte determinism;
- deployed p50/p95 route and fusion latency;
- ranker contribution/ablation report.

## Frozen release gates

1. Zero forbidden or ineligible record in any dev/holdout top three.
2. 12/12 development and 18/18 holdout dispositions correct.
3. Holdout positive Recall@3 ≥0.90 for grade 2–3 records.
4. Holdout RRF mean nDCG@3 ≥ every individual ranker mean +0.05.
5. Holdout MRR@3 ≥0.85 on grade-3 cases.
6. RRF mean nDCG@3 ≥0.90.
7. On the sealed holdout, every single ranker is imperfect on at least one positive case and the strongest individual mean nDCG@3 ceiling is <0.95. This is checked before seal so the lift gate is feasible; development lift is not a release gate.
8. 100 repetitions byte-identical per case.
9. Deployed p95 route ≤250 ms and in-memory rank/fusion p95 ≤25 ms under the specified method.
10. Static dependency test proves production rank code cannot import fixture expected judgments/reference evaluator/holdout.

Any failure blocks “RRF improved the sealed benchmark.” It does not block the entire product if the founder explicitly supersedes F-001; no such supersession exists.

## Execution sequence

### Before retrieval implementation

1. Validate both JSON Schemas, all 36/12/18 counts, IDs, references, exact deterministic `queryText`, v2 materialization rules, and `SHA256SUMS-v2`.
2. Run reference evaluator to reproduce `RRF_V2_CALIBRATION.json`; verify strongest baseline <0.95 and predicted RRF lift ≥0.05.
3. Seal files. Product implementation may now begin using dev cases only.

### One-time release holdout

1. Freeze source commit `C`; verify clean tree and fixture/evaluator hashes.
2. Save and deploy the Sites version built from `C`; finish public smoke/latency setup.
3. Independent reviewer runs one non-interactive holdout command without printing judgments before scoring.
4. Store raw ranks, metrics, environment, commit, deployment/version IDs, timings, gates, and reviewer in release artifacts.
5. Mark exact `PASS` or `FAIL`. A failure returns to a new benchmark/source/version cycle before submission.

## Memory counterfactual is separate

RRF ranking quality does not prove memory changes a product decision. A separate deterministic test uses identical state/proposal with D001 eligible versus no eligible precedent and proves proposal accepted versus `EVIDENCE_REQUIRED_FOR_AGENT_CHANGE`. A real-client paired protocol is required before claiming ChatGPT itself changed its recommendation.

## Allowed claim

Only after the exact release report passes: “RRF beat each single eligible ranker by at least 0.05 mean nDCG@3 on a preregistered 36-record synthetic benchmark, with zero scoped-evidence leakage.” Always disclose that the corpus is synthetic and the holdout is procedural/public.
