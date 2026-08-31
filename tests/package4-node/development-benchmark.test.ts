import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CALIBRATED_DEVELOPMENT_METRICS,
  EXPECTED_DEVELOPMENT_PACKET_SHA256,
  assertDevelopmentReport,
  runDevelopmentBenchmark,
} from '../../scripts/package4-development-benchmark.mjs';
import { reciprocalRankFusion } from '../../lib/retrieval/rrf.ts';

test('all 12 development cases match dispositions and goldens with zero forbidden records', () => {
  const report = runDevelopmentBenchmark();
  assert.equal(report.productionSource.fileCount, 6);
  assert.match(report.productionSource.aggregateSha256, /^[0-9a-f]{64}$/u);
  assert.equal(report.summary.queryCount, 12);
  assert.equal(report.summary.positiveCases, 8);
  assert.equal(report.summary.dispositionCorrect, 12);
  assert.equal(report.summary.forbiddenAppearances, 0);
  assert.equal(report.cases.length, 12);
  assert.deepEqual(
    Object.fromEntries(report.cases.map(({ id, goldenPacketSha256 }) => [id, goldenPacketSha256])),
    EXPECTED_DEVELOPMENT_PACKET_SHA256,
  );
  assert.deepEqual(
    report.cases.map(({ id, disposition }) => [id, disposition]),
    [
      ['DEV2-01', 'results'], ['DEV2-02', 'results'],
      ['DEV2-03', 'results'], ['DEV2-04', 'results'],
      ['DEV2-05', 'results'], ['DEV2-06', 'results'],
      ['DEV2-07', 'results'], ['DEV2-08', 'results'],
      ['DEV2-09', 'abstain'], ['DEV2-10', 'abstain'],
      ['DEV2-11', 'conflict'], ['DEV2-12', 'abstain'],
    ],
  );
  assert.doesNotThrow(() => assertDevelopmentReport(report));
});

test('the frozen permitted-development packet seal rejects rank or output drift', () => {
  const report = runDevelopmentBenchmark();
  report.cases[0]!.rankLists.lexical.reverse();
  assert.throws(() => assertDevelopmentReport(report), /exact packet golden/u);
});

test('rank vectors, contributions, explanations, conflict, abstention, and output bounds are exact', () => {
  const report = runDevelopmentBenchmark();
  for (const result of report.cases) {
    assert.ok(result.eligibleIds.length <= 36);
    assert.ok(result.rankLists.lexical.length <= 12);
    assert.ok(result.rankLists.structured.length <= 12);
    assert.ok(result.rankLists.relationship.length <= 12);
    assert.ok(result.returned.length <= 3);
    for (const record of result.returned) {
      assert.equal(record.ranks.length, 3);
      assert.equal(record.contributions.length, 3);
      assert.match(record.rrf, /^0\.\d{8}$/u);
      assert.equal(record.rationaleExcerpt.endsWith('Evidence only — not approval.'), true);
      assert.ok(Array.from(record.rationaleExcerpt).length <= 120);
      assert.equal(record.algorithm, 'rrf-k60-v2');
      assert.equal(record.eligibility, 'focus-eligibility-v2');
    }
    if (result.disposition === 'abstain') assert.equal(result.returned.length, 0);
  }
  const conflict = report.cases.find(({ id }) => id === 'DEV2-11')!;
  assert.equal(conflict.reasonCode, 'EXACT_OUTCOME_CONFLICT');
  assert.deepEqual(conflict.returned.map(({ recordId }) => recordId), ['D028', 'D027']);
  assert.notEqual(conflict.returned[0]!.outcomeKey, conflict.returned[1]!.outcomeKey);
});

test('individual baselines and production RRF reproduce the sealed development metrics', () => {
  const report = runDevelopmentBenchmark();
  assert.deepEqual(report.metrics, CALIBRATED_DEVELOPMENT_METRICS);
  assert.deepEqual(report.metrics, {
    meanNdcgAt3: { lexical: 0.824102, structured: 0.885657, relationship: 0.963726, rrf: 0.963726 },
    mrrAt3: { lexical: 0.75, structured: 0.8125, relationship: 0.9375, rrf: 0.9375 },
    recallAt3: { lexical: 1, structured: 1, relationship: 1, rrf: 1 },
  });
  assert.deepEqual(Object.keys(report.ablations), [
    'withoutLexical',
    'withoutStructured',
    'withoutRelationship',
  ]);
});

test('every case is byte-identical across 100 production retrieval repetitions', () => {
  const report = runDevelopmentBenchmark();
  assert.equal(report.summary.repetitions, 100);
  assert.equal(report.summary.byteIdentical, true);
  assert.match(report.summary.determinismSha256, /^[0-9a-f]{64}$/u);
  assert.equal(report.cases.every(({ determinism }) => determinism.byteIdentical), true);
  assert.equal(report.cases.every(({ determinism }) => determinism.repetitions === 100), true);
});

test('RRF retains full precision for symmetric rank ties', () => {
  const fused = reciprocalRankFusion([
    [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
    [{ id: 'B' }, { id: 'C' }, { id: 'A' }],
    [{ id: 'C' }, { id: 'A' }, { id: 'B' }],
  ]);
  assert.equal(fused[0]!.score, fused[1]!.score);
  assert.equal(fused[1]!.score, fused[2]!.score);
  assert.equal(fused[0]!.score.toFixed(8), fused[2]!.score.toFixed(8));
});

test('malformed duplicate rank lists fail closed instead of yielding an ambiguous vector', () => {
  assert.throws(
    () => reciprocalRankFusion([[{ id: 'A' }, { id: 'A' }], [], []]),
    /duplicate rank ID/u,
  );
});
