import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import developmentSuite from '../docs/retrieval/fixtures/rrf/rrf-dev-queries-v2.json' with { type: 'json' };
import { retrievePrecedent } from '../lib/retrieval/active-focus.ts';
import { structuredScore } from '../lib/retrieval/bm25.ts';
import { materializeCorpusV2 } from '../lib/retrieval/corpus-v2.ts';
import {
  EXPECTED_V2_HASHES,
  validatePackage4FixtureSeal,
} from './package4-fixture-seal.mjs';

export const CALIBRATED_DEVELOPMENT_METRICS = Object.freeze({
  meanNdcgAt3: Object.freeze({ lexical: 0.824102, structured: 0.885657, relationship: 0.963726, rrf: 0.963726 }),
  mrrAt3: Object.freeze({ lexical: 0.75, structured: 0.8125, relationship: 0.9375, rrf: 0.9375 }),
  recallAt3: Object.freeze({ lexical: 1, structured: 1, relationship: 1, rrf: 1 }),
});

export const EXPECTED_DEVELOPMENT_PACKET_SHA256 = Object.freeze({
  'DEV2-01': '512a616a36a6fb50401f2e1a8129c093bd6f8134b7c91725df8d3c616ebe667a',
  'DEV2-02': '0a67244dfb6d076ddab6135da37b075348a8947461265e7a267e1df68ca29fe4',
  'DEV2-03': 'b48e6f4a1d43735ff028c6d26aa9dc6e9bb9be83897f7499fdf0ec8441f838ff',
  'DEV2-04': 'f4d5e2be81245f4a16c7f04b741eb368569596221cea889f5a1927687df086a0',
  'DEV2-05': 'ae4c2cc681ca9820721c60ea2d9aff367159a8c6c39ab877bc65bcf364893bd4',
  'DEV2-06': '9fba1e04fe23e6ff8b12e96b09965e0a95eed03f2145f7d064e6094d7192cf6c',
  'DEV2-07': '0da5bae203ab60345a6d56b9e269a0b531b1d13d18d6f95506fbd97209fddeef',
  'DEV2-08': 'bae747f3a54660d8c408d6da1798dbcfc14a977abff9e08df0081b8c4a221764',
  'DEV2-09': 'ebb56e8ec190f9fdaa4c2a0d6ff5fe2cf7a62bf8704eb77e22f6193f92440f72',
  'DEV2-10': 'ebb56e8ec190f9fdaa4c2a0d6ff5fe2cf7a62bf8704eb77e22f6193f92440f72',
  'DEV2-11': '1fb5d4d4fd9609f9203f4ed0c9d3dd522f8ad5a1061ebd67cc0b0040f9908bdf',
  'DEV2-12': 'ebb56e8ec190f9fdaa4c2a0d6ff5fe2cf7a62bf8704eb77e22f6193f92440f72',
});

const SYSTEMS = Object.freeze(['lexical', 'structured', 'relationship', 'rrf']);
const PRODUCTION_SOURCE_PATHS = Object.freeze([
  'lib/retrieval/active-focus.ts',
  'lib/retrieval/bm25.ts',
  'lib/retrieval/corpus-v2.ts',
  'lib/retrieval/rrf.ts',
  'lib/retrieval/tokenize.ts',
  'lib/retrieval/types.ts',
]);

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function productionSource() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const files = PRODUCTION_SOURCE_PATHS.map((relativePath) => {
    const bytes = readFileSync(path.join(repositoryRoot, relativePath));
    return { path: relativePath, bytes: bytes.length, sha256: sha256(bytes) };
  });
  return {
    algorithm: 'sha256',
    fileCount: files.length,
    aggregateSha256: sha256(files.map((file) => `${file.sha256}  ${file.bytes}  ${file.path}\n`).join('')),
    files,
  };
}

function round6(value) {
  return Number(value.toFixed(6));
}

function ranksFor(result, system) {
  if (system === 'rrf') return result.returned.map(({ id }) => id).slice(0, 3);
  return result.lists[system].map(({ id }) => id).slice(0, 3);
}

function metricFor(ranking, relevant) {
  const grades = new Map(relevant.map(({ id, grade }) => [id, grade]));
  const dcg = ranking.slice(0, 3).reduce(
    (sum, id, index) => sum + ((2 ** (grades.get(id) ?? 0)) - 1) / Math.log2(index + 2),
    0,
  );
  const ideal = [...relevant]
    .map(({ grade }) => grade)
    .sort((left, right) => right - left)
    .slice(0, 3)
    .reduce((sum, grade, index) => sum + ((2 ** grade) - 1) / Math.log2(index + 2), 0);
  const exactIndex = ranking.slice(0, 3).findIndex((id) => grades.get(id) === 3);
  const recallTargets = new Set(relevant.filter(({ grade }) => grade >= 2).map(({ id }) => id));
  const recalled = ranking.slice(0, 3).filter((id) => recallTargets.has(id)).length;
  return {
    ndcg: ideal === 0 ? 0 : dcg / ideal,
    mrr: exactIndex === -1 ? 0 : 1 / (exactIndex + 1),
    recall: recallTargets.size === 0 ? 1 : recalled / recallTargets.size,
  };
}

function summarizeRankings(positive, rankingForCase) {
  const totals = positive.reduce(
    (sum, item) => {
      const metric = metricFor(rankingForCase(item), item.query.expected.relevant);
      return {
        ndcg: sum.ndcg + metric.ndcg,
        mrr: sum.mrr + metric.mrr,
        recall: sum.recall + metric.recall,
      };
    },
    { ndcg: 0, mrr: 0, recall: 0 },
  );
  return {
    meanNdcgAt3: round6(totals.ndcg / positive.length),
    mrrAt3: round6(totals.mrr / positive.length),
    recallAt3: round6(totals.recall / positive.length),
  };
}

function relationshipTier(record, context) {
  const targets = [
    `context:${context.variant}|${context.behavior}|${context.mismatchTag}|${context.shapeTag}`,
    `variant:${context.variant}`,
    `use-case:${context.useCase}`,
    `family:${context.componentFamily}`,
  ];
  const index = targets.findIndex((target) =>
    record.relationships.some((relationship) => relationship.type === 'applies-to' && relationship.target === target),
  );
  return index === -1 ? 4 : index;
}

function ablatedRanking(result, context, selectedIndexes) {
  const lists = [result.lists.lexical, result.lists.structured, result.lists.relationship];
  const rankMaps = lists.map((list) => new Map(list.map(({ id }, index) => [id, index + 1])));
  const records = new Map(lists.flat().map((record) => [record.id, record]));
  return [...records.values()]
    .map((record) => {
      const ranks = rankMaps.map((rankMap) => rankMap.get(record.id) ?? null);
      return {
        id: record.id,
        ranks,
        structuredScore: structuredScore(record, context),
        relationshipTier: relationshipTier(record, context),
        score: selectedIndexes.reduce(
          (sum, index) => sum + (ranks[index] === null ? 0 : 1 / (60 + ranks[index])),
          0,
        ),
        appearances: selectedIndexes.filter((index) => ranks[index] !== null).length,
      };
    })
    .filter(({ appearances, structuredScore: score, relationshipTier: tier }) =>
      appearances === selectedIndexes.length && score >= 60 && tier <= 2,
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        (left.ranks[1] ?? Number.POSITIVE_INFINITY) - (right.ranks[1] ?? Number.POSITIVE_INFINITY) ||
        (left.ranks[0] ?? Number.POSITIVE_INFINITY) - (right.ranks[0] ?? Number.POSITIVE_INFINITY) ||
        (left.ranks[2] ?? Number.POSITIVE_INFINITY) - (right.ranks[2] ?? Number.POSITIVE_INFINITY) ||
        left.id.localeCompare(right.id, 'en'),
    )
    .slice(0, 3)
    .map(({ id }) => id);
}

function rationaleExcerpt(value) {
  const normalized = value.normalize('NFC').replace(/\s+/gu, ' ').trim();
  const suffix = ' Evidence only — not approval.';
  const maximum = 120 - Array.from(suffix).length;
  const characters = Array.from(normalized);
  return `${characters.length <= maximum ? normalized : `${characters.slice(0, maximum - 1).join('')}…`}${suffix}`;
}

function explain(record) {
  const ranks = [record.lexicalRank, record.structuredRank, record.relationshipRank];
  return {
    recordId: record.id,
    outcomeKey: record.outcomeKey,
    status: record.status,
    algorithm: 'rrf-k60-v2',
    eligibility: 'focus-eligibility-v2',
    ranks,
    contributions: ranks.map((rank) => (rank === null ? null : (1 / (60 + rank)).toFixed(8))),
    structuredScore: record.structuredScore,
    relationshipTier: record.relationshipTier,
    rrfScore: record.rrfScore,
    rrf: record.rrfDisplay,
    rationaleExcerpt: rationaleExcerpt(record.rationale),
  };
}

function productionBytes(result) {
  return JSON.stringify({
    disposition: result.disposition,
    reasonCode: result.reasonCode,
    eligibleIds: result.eligibleIds,
    rankLists: {
      lexical: result.lists.lexical.map(({ id }) => id),
      structured: result.lists.structured.map(({ id }) => id),
      relationship: result.lists.relationship.map(({ id }) => id),
    },
    returned: result.returned.map(explain),
  });
}

function reportCaseBytes(result) {
  return JSON.stringify({
    disposition: result.disposition,
    reasonCode: result.reasonCode,
    eligibleIds: result.eligibleIds,
    rankLists: result.rankLists,
    returned: result.returned,
  });
}

function validateRankList(ids, label) {
  requireCondition(ids.length <= 12, `${label} exceeds 12 records`);
  requireCondition(new Set(ids).size === ids.length, `${label} contains a duplicate record`);
}

function caseResult(query, corpus) {
  const result = retrievePrecedent(corpus, query.context);
  const rankLists = {
    lexical: result.lists.lexical.map(({ id }) => id),
    structured: result.lists.structured.map(({ id }) => id),
    relationship: result.lists.relationship.map(({ id }) => id),
  };
  for (const [name, ids] of Object.entries(rankLists)) validateRankList(ids, `${query.id} ${name} ranks`);
  requireCondition(result.eligibleIds.length <= 36 && result.returned.length <= 3, `${query.id} output bound failed`);
  const forbiddenSet = new Set(query.expected.forbidden);
  const forbidden = [...new Set([
    ...result.eligibleIds.filter((id) => forbiddenSet.has(id)),
    ...result.returned.map(({ id }) => id).filter((id) => forbiddenSet.has(id)),
  ])];
  const returnedIds = new Set(result.returned.map(({ id }) => id));
  const missingRelevant = query.expected.relevant
    .map(({ id }) => id)
    .filter((id) => !returnedIds.has(id));
  const expectedReason = {
    results: 'SUPPORTED_PRECEDENT',
    conflict: 'EXACT_OUTCOME_CONFLICT',
    abstain: 'UNSUPPORTED_CONTEXT',
  }[query.expected.disposition];
  const baseline = productionBytes(result);
  const packetSha256 = sha256(baseline);
  const expectedPacketSha256 = EXPECTED_DEVELOPMENT_PACKET_SHA256[query.id];
  requireCondition(expectedPacketSha256, `${query.id} development packet seal is missing`);
  let byteIdentical = true;
  for (let repetition = 1; repetition < 100; repetition += 1) {
    if (productionBytes(retrievePrecedent(corpus, query.context)) !== baseline) {
      byteIdentical = false;
      break;
    }
  }
  return {
    id: query.id,
    disposition: result.disposition,
    reasonCode: result.reasonCode,
    expectedDisposition: query.expected.disposition,
    goldenPass:
      result.disposition === query.expected.disposition &&
      result.reasonCode === expectedReason &&
      missingRelevant.length === 0 &&
      packetSha256 === expectedPacketSha256,
    eligibleIds: result.eligibleIds,
    rankLists,
    returned: result.returned.map(explain),
    expectedRelevant: query.expected.relevant,
    forbidden,
    goldenPacketSha256: packetSha256,
    determinism: {
      repetitions: 100,
      byteIdentical,
      sha256: packetSha256,
    },
  };
}

export function runDevelopmentBenchmark() {
  const fixtureDirectory = path.resolve('docs/retrieval/fixtures/rrf');
  const seal = validatePackage4FixtureSeal(fixtureDirectory);
  const corpus = materializeCorpusV2().records;
  const evaluated = developmentSuite.queries.map((query) => ({
    query,
    result: retrievePrecedent(corpus, query.context),
  }));
  const cases = developmentSuite.queries.map((query) => caseResult(query, corpus));
  const positive = evaluated.filter(({ query }) => query.expected.disposition === 'results');
  const perSystem = Object.fromEntries(
    SYSTEMS.map((system) => [system, summarizeRankings(positive, ({ result }) => ranksFor(result, system))]),
  );
  const metrics = {
    meanNdcgAt3: Object.fromEntries(SYSTEMS.map((system) => [system, perSystem[system].meanNdcgAt3])),
    mrrAt3: Object.fromEntries(SYSTEMS.map((system) => [system, perSystem[system].mrrAt3])),
    recallAt3: Object.fromEntries(SYSTEMS.map((system) => [system, perSystem[system].recallAt3])),
  };
  const ablationDefinitions = {
    withoutLexical: [1, 2],
    withoutStructured: [0, 2],
    withoutRelationship: [0, 1],
  };
  const ablations = Object.fromEntries(
    Object.entries(ablationDefinitions).map(([name, selected]) => [
      name,
      summarizeRankings(positive, ({ query, result }) => ablatedRanking(result, query.context, selected)),
    ]),
  );
  const determinismSha256 = sha256(cases.map(({ id, determinism }) => `${id}:${determinism.sha256}\n`).join(''));
  const report = {
    schemaVersion: 'fcs-package4-development-report-v1',
    benchmarkId: 'fcs-rrf-benchmark-v2',
    algorithm: 'rrf-k60-v2',
    eligibility: 'focus-eligibility-v2',
    lexical: 'eligible-ts-bm25-v1',
    environment: 'local-production-typescript-development-only',
    claimBoundary: 'Synthetic development evidence only; no holdout or release-superiority claim.',
    productionSource: productionSource(),
    fixtureSeal: {
      manifestSha256: seal.manifestSha256,
      hashes: EXPECTED_V2_HASHES,
      holdoutAccess: seal.holdoutAccess,
    },
    summary: {
      queryCount: cases.length,
      positiveCases: positive.length,
      dispositionCorrect: cases.filter(({ disposition, expectedDisposition }) => disposition === expectedDisposition).length,
      goldenCorrect: cases.filter(({ goldenPass }) => goldenPass).length,
      forbiddenAppearances: cases.reduce((sum, item) => sum + item.forbidden.length, 0),
      repetitions: 100,
      byteIdentical: cases.every(({ determinism }) => determinism.byteIdentical),
      determinismSha256,
    },
    metrics,
    ablations,
    cases,
  };
  assertDevelopmentReport(report);
  return report;
}

export function assertDevelopmentReport(report) {
  requireCondition(report.schemaVersion === 'fcs-package4-development-report-v1', 'development report schema is invalid');
  requireCondition(report.productionSource?.fileCount === 6 && /^[0-9a-f]{64}$/u.test(report.productionSource.aggregateSha256), 'development production source binding is invalid');
  requireCondition(report.summary.queryCount === 12 && report.summary.positiveCases === 8, 'development report counts are invalid');
  requireCondition(report.summary.dispositionCorrect === 12 && report.summary.goldenCorrect === 12, 'development goldens are invalid');
  requireCondition(report.summary.forbiddenAppearances === 0, 'development report contains a forbidden record');
  requireCondition(report.summary.repetitions === 100 && report.summary.byteIdentical === true, 'development determinism failed');
  requireCondition(JSON.stringify(report.metrics) === JSON.stringify(CALIBRATED_DEVELOPMENT_METRICS), 'development metrics do not match calibration');
  requireCondition(
    report.cases.every((item) =>
      item.goldenPass &&
      item.forbidden.length === 0 &&
      item.determinism.byteIdentical &&
      item.goldenPacketSha256 === EXPECTED_DEVELOPMENT_PACKET_SHA256[item.id] &&
      sha256(reportCaseBytes(item)) === EXPECTED_DEVELOPMENT_PACKET_SHA256[item.id]),
    'development case or exact packet golden failed',
  );
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = runDevelopmentBenchmark();
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex !== -1) {
    const outputPath = process.argv[outputIndex + 1];
    requireCondition(outputPath && !path.isAbsolute(outputPath) && !outputPath.split('/').includes('..'), 'output path is invalid');
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'w' });
  }
  process.stdout.write(
    `PACKAGE4_DEV_PASS dispositions=${report.summary.dispositionCorrect}/12 goldens=${report.summary.goldenCorrect}/12 forbidden=${report.summary.forbiddenAppearances} repeats=${report.summary.repetitions} ndcg=${report.metrics.meanNdcgAt3.rrf.toFixed(6)}\n`,
  );
}
