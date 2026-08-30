#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const readJson = (name) => JSON.parse(readFileSync(join(here, name), "utf8"));
const sha256 = (name) => createHash("sha256").update(readFileSync(join(here, name))).digest("hex");

const base = readJson("rrf-corpus-v1.json");
const overlay = readJson("rrf-corpus-overrides-v2.json");
const dev = readJson("rrf-dev-queries-v2.json");
const holdout = readJson("rrf-holdout-queries-v2.json");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function materializeCorpus() {
  invariant(base.corpusId === overlay.baseCorpusId, "overlay baseCorpusId mismatch");
  invariant(overlay.materializer === "whole-field-replace-v1", "unknown materializer");
  const records = structuredClone(base.records);
  const byId = new Map(records.map((record) => [record.id, record]));
  const seen = new Set();

  for (const entry of overlay.overrides) {
    invariant(!seen.has(entry.id), `duplicate override ${entry.id}`);
    invariant(byId.has(entry.id), `unknown override ${entry.id}`);
    invariant(!Object.hasOwn(entry.replace, "id"), `override cannot replace id ${entry.id}`);
    seen.add(entry.id);
    Object.assign(byId.get(entry.id), structuredClone(entry.replace));
  }

  return {
    schemaVersion: 2,
    corpusId: overlay.effectiveCorpusId,
    asOf: base.asOf,
    records,
  };
}

const corpus = materializeCorpus();

const productionEnums = {
  product: new Set(["focus-contract-studio"]),
  componentFamily: new Set(["modal-dialog"]),
  useCase: new Set(["delete-account"]),
  variant: new Set(["delete-account-standard", "delete-account-danger-emphasis"]),
  behavior: new Set(["initial-focus", "focus-order", "forward-wrap", "backward-wrap", "escape", "return-focus"]),
  intent: new Set(["destructive-confirmation"]),
  risk: new Set(["irreversible"]),
};

function queryText(context) {
  return `product=${context.product} family=${context.componentFamily} use_case=${context.useCase} variant=${context.variant} behavior=${context.behavior} observed=${context.observedOutcomeKey} mismatch=${context.mismatchTag} shape=${context.shapeTag} intent=${context.intent} risk=${context.risk}`;
}

function validateFixtures() {
  invariant(corpus.schemaVersion === 2, "effective corpus schemaVersion");
  invariant(corpus.corpusId === "fcs-rrf-corpus-v2", "effective corpusId");
  invariant(corpus.records.length === 36, "effective corpus must contain 36 records");
  invariant(new Set(corpus.records.map((record) => record.id)).size === 36, "duplicate corpus id");
  invariant(dev.queries.length === 12, "dev must contain 12 queries");
  invariant(holdout.queries.length === 18, "holdout must contain 18 queries");

  const recordIds = new Set(corpus.records.map((record) => record.id));
  const queryIds = new Set();
  for (const suite of [dev, holdout]) {
    invariant(suite.schemaVersion === 2, `${suite.suiteId} schemaVersion`);
    for (const query of suite.queries) {
      invariant(!queryIds.has(query.id), `duplicate query id ${query.id}`);
      queryIds.add(query.id);
      invariant(query.context.queryText === queryText(query.context), `queryText mismatch ${query.id}`);
      invariant(Number.isFinite(Date.parse(query.context.asOf)), `invalid asOf ${query.id}`);
      const relevant = new Set();
      for (const judgment of query.expected.relevant) {
        invariant(recordIds.has(judgment.id), `unknown relevant ${query.id}/${judgment.id}`);
        invariant(!relevant.has(judgment.id), `duplicate relevant ${query.id}/${judgment.id}`);
        invariant([1, 2, 3].includes(judgment.grade), `invalid grade ${query.id}/${judgment.id}`);
        relevant.add(judgment.id);
      }
      for (const id of query.expected.forbidden) {
        invariant(recordIds.has(id), `unknown forbidden ${query.id}/${id}`);
        invariant(!relevant.has(id), `relevant also forbidden ${query.id}/${id}`);
      }
      if (query.expected.disposition === "results") invariant(relevant.size > 0, `results without relevance ${query.id}`);
      if (query.expected.disposition === "abstain") invariant(relevant.size === 0, `abstain with relevance ${query.id}`);
      if (query.expected.disposition === "conflict") invariant(relevant.size === 2, `conflict must have two judgments ${query.id}`);
    }
  }

  for (const record of corpus.records) {
    invariant(/^D\d{3}$/.test(record.id), `invalid record id ${record.id}`);
    invariant(record.rationale.length > 0 && record.rationale.length <= 320, `invalid rationale ${record.id}`);
    invariant(record.relationships.length > 0 && record.relationships.length <= 4, `invalid relationships ${record.id}`);
    invariant(Number.isFinite(Date.parse(record.validFrom)), `invalid validFrom ${record.id}`);
    if (record.validTo !== null) invariant(Number.isFinite(Date.parse(record.validTo)), `invalid validTo ${record.id}`);
    for (const edge of record.relationships) {
      invariant(edge.type === "applies-to", `invalid relationship type ${record.id}`);
      invariant(/^(context|variant|use-case|family):[a-z0-9|*-]+$/.test(edge.target), `invalid relationship target ${record.id}`);
    }
  }
}

function validateProductionContext(context) {
  return Object.entries(productionEnums).every(([key, allowed]) => allowed.has(context[key]));
}

function isEligible(record, context) {
  return (
    record.workspaceKey === context.workspaceKey &&
    record.product === context.product &&
    record.componentFamily === context.componentFamily &&
    (record.useCase === context.useCase || record.useCase === "*") &&
    (record.variants.includes(context.variant) || record.variants.includes("both")) &&
    record.behavior === context.behavior &&
    (record.intent === context.intent || record.intent === "*") &&
    (record.risk === context.risk || record.risk === "*") &&
    (record.mismatchTags.includes(context.mismatchTag) || record.mismatchTags.includes("*")) &&
    record.status === "active" &&
    record.hostile === false &&
    record.validFrom <= context.asOf &&
    (record.validTo === null || record.validTo > context.asOf)
  );
}

function tokenize(value) {
  return String(value).normalize("NFKC").toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

const lexicalFields = (record) => [
  [record.rationale, 2.0],
  [record.tags.join(" "), 1.5],
  [record.behavior, 1.0],
  [record.useCase, 1.0],
  [record.intent, 1.0],
  [record.risk, 1.0],
  [record.variants.join(" "), 1.0],
  [record.mismatchTags.join(" "), 1.0],
  [record.shapeTags.join(" "), 1.0],
];

function lexicalRank(records, context) {
  const queryTokens = [...new Set(tokenize(queryText(context)))];
  if (records.length === 0 || queryTokens.length === 0) return [];

  const documents = records.map((record) => {
    const tf = new Map();
    let length = 0;
    for (const [value, weight] of lexicalFields(record)) {
      for (const token of tokenize(value)) {
        tf.set(token, (tf.get(token) ?? 0) + weight);
        length += weight;
      }
    }
    return { record, tf, length };
  });

  const n = documents.length;
  const averageLength = documents.reduce((sum, doc) => sum + doc.length, 0) / n;
  const k1 = 1.2;
  const b = 0.75;

  return documents
    .map((doc) => {
      let score = 0;
      for (const token of queryTokens) {
        const df = documents.filter((candidate) => (candidate.tf.get(token) ?? 0) > 0).length;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        const tf = doc.tf.get(token) ?? 0;
        if (tf > 0) {
          score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * doc.length / averageLength)));
        }
      }
      return { id: doc.record.id, score };
    })
    .sort((a, bValue) => bValue.score - a.score || a.id.localeCompare(bValue.id))
    .slice(0, 12);
}

function structuredScore(record, context) {
  return (
    40 +
    (record.useCase === context.useCase ? 20 : 4) +
    (record.variants.includes(context.variant) ? 12 : 6) +
    (record.intent === context.intent ? 8 : 2) +
    (record.risk === context.risk ? 5 : 1) +
    (record.mismatchTags.includes(context.mismatchTag) ? 5 : 0) +
    (record.shapeTags.includes(context.shapeTag) ? 4 : 0)
  );
}

function structuredRank(records, context) {
  return records
    .map((record) => ({ id: record.id, score: structuredScore(record, context), validFrom: record.validFrom }))
    .sort((a, b) => b.score - a.score || b.validFrom.localeCompare(a.validFrom) || a.id.localeCompare(b.id))
    .slice(0, 12);
}

function relationshipTier(record, context) {
  const targets = [
    `context:${context.variant}|${context.behavior}|${context.mismatchTag}|${context.shapeTag}`,
    `variant:${context.variant}`,
    `use-case:${context.useCase}`,
    `family:${context.componentFamily}`,
  ];
  return targets.findIndex((target) => record.relationships.some((edge) => edge.type === "applies-to" && edge.target === target));
}

function relationshipRank(records, context) {
  return records
    .map((record) => ({ id: record.id, tier: relationshipTier(record, context), validFrom: record.validFrom }))
    .map((item) => ({ ...item, tier: item.tier === -1 ? 4 : item.tier }))
    .sort((a, b) => a.tier - b.tier || b.validFrom.localeCompare(a.validFrom) || a.id.localeCompare(b.id))
    .slice(0, 12);
}

function ranksById(list) {
  return new Map(list.map((item, index) => [item.id, index + 1]));
}

function hasLineage(left, right) {
  const leftRecord = corpus.records.find((record) => record.id === left);
  const rightRecord = corpus.records.find((record) => record.id === right);
  return leftRecord?.supersedes === right || rightRecord?.supersedes === left;
}

function evaluateQuery(query) {
  const context = query.context;
  if (!validateProductionContext(context)) {
    return { disposition: "abstain", reasonCode: "UNSUPPORTED_CONTEXT", eligibleIds: [], lists: {}, returned: [] };
  }

  const eligible = corpus.records.filter((record) => isEligible(record, context)).sort((a, b) => a.id.localeCompare(b.id));
  if (eligible.length === 0) {
    return { disposition: "abstain", reasonCode: "NO_ELIGIBLE_PRECEDENT", eligibleIds: [], lists: {}, returned: [] };
  }

  const lexical = lexicalRank(eligible, context);
  const structured = structuredRank(eligible, context);
  const relationship = relationshipRank(eligible, context);
  const maps = [lexical, structured, relationship].map(ranksById);
  const ids = [...new Set([...lexical, ...structured, ...relationship].map((item) => item.id))];
  const recordById = new Map(eligible.map((record) => [record.id, record]));
  const structuredById = new Map(structured.map((item) => [item.id, item.score]));
  const relationshipById = new Map(relationship.map((item) => [item.id, item.tier]));

  const fused = ids
    .map((id) => {
      const ranks = maps.map((map) => map.get(id) ?? null);
      const score = ranks.reduce((sum, rank) => sum + (rank === null ? 0 : 1 / (60 + rank)), 0);
      return {
        id,
        ranks,
        score,
        displayScore: score.toFixed(8),
        structuredScore: structuredById.get(id) ?? null,
        relationshipTier: relationshipById.get(id) ?? null,
      };
    })
    .filter((item) => item.ranks.filter((rank) => rank !== null).length >= 2)
    .filter((item) => (item.structuredScore ?? -Infinity) >= 60)
    .filter((item) => (item.relationshipTier ?? Infinity) <= 2)
    .sort((a, b) =>
      b.score - a.score ||
      (a.ranks[1] ?? Infinity) - (b.ranks[1] ?? Infinity) ||
      (a.ranks[0] ?? Infinity) - (b.ranks[0] ?? Infinity) ||
      (a.ranks[2] ?? Infinity) - (b.ranks[2] ?? Infinity) ||
      a.id.localeCompare(b.id),
    );

  if (fused.length === 0) {
    return {
      disposition: "abstain",
      reasonCode: "NO_SUPPORTED_PRECEDENT",
      eligibleIds: eligible.map((record) => record.id),
      lists: { lexical, structured, relationship },
      returned: [],
    };
  }

  const [first, second] = fused;
  if (first && second) {
    const firstRecord = recordById.get(first.id);
    const secondRecord = recordById.get(second.id);
    const conflict =
      first.relationshipTier <= 1 &&
      second.relationshipTier <= 1 &&
      first.ranks[1] <= 3 &&
      second.ranks[1] <= 3 &&
      firstRecord.mismatchTags.includes(context.mismatchTag) &&
      secondRecord.mismatchTags.includes(context.mismatchTag) &&
      firstRecord.shapeTags.includes(context.shapeTag) &&
      secondRecord.shapeTags.includes(context.shapeTag) &&
      firstRecord.outcomeKey !== secondRecord.outcomeKey &&
      !hasLineage(first.id, second.id);
    if (conflict) {
      return {
        disposition: "conflict",
        reasonCode: "EXACT_OUTCOME_CONFLICT",
        eligibleIds: eligible.map((record) => record.id),
        lists: { lexical, structured, relationship },
        returned: fused.slice(0, 2),
      };
    }
  }

  return {
    disposition: "results",
    reasonCode: "SUPPORTED_PRECEDENT",
    eligibleIds: eligible.map((record) => record.id),
    lists: { lexical, structured, relationship },
    returned: fused.slice(0, 3),
  };
}

function dcg(ids, grades) {
  return ids.slice(0, 3).reduce((sum, id, index) => sum + ((2 ** (grades.get(id) ?? 0) - 1) / Math.log2(index + 2)), 0);
}

function ndcg(ids, query) {
  const grades = new Map(query.expected.relevant.map((item) => [item.id, item.grade]));
  const ideal = [...query.expected.relevant].sort((a, b) => b.grade - a.grade || a.id.localeCompare(b.id)).map((item) => item.id);
  const denominator = dcg(ideal, grades);
  return denominator === 0 ? 1 : dcg(ids, grades) / denominator;
}

function reciprocalRank(ids, query) {
  const exact = new Set(query.expected.relevant.filter((item) => item.grade === 3).map((item) => item.id));
  const index = ids.slice(0, 3).findIndex((id) => exact.has(id));
  return index === -1 ? 0 : 1 / (index + 1);
}

function recall(ids, query) {
  const relevant = new Set(query.expected.relevant.filter((item) => item.grade >= 2).map((item) => item.id));
  if (relevant.size === 0) return 1;
  return ids.slice(0, 3).filter((id) => relevant.has(id)).length / relevant.size;
}

function summarizeSuite(suite) {
  const systems = ["lexical", "structured", "relationship", "rrf"];
  const metrics = Object.fromEntries(systems.map((system) => [system, { ndcg: 0, mrr: 0, recall: 0, positiveCases: 0, imperfectCases: 0 }]));
  let dispositionCorrect = 0;
  let forbiddenAppearances = 0;
  const cases = [];

  for (const query of suite.queries) {
    const evaluated = evaluateQuery(query);
    if (evaluated.disposition === query.expected.disposition) dispositionCorrect += 1;
    const returnedIds = evaluated.returned.map((item) => item.id);
    forbiddenAppearances += returnedIds.filter((id) => query.expected.forbidden.includes(id)).length;

    const rankIds = {
      lexical: (evaluated.lists.lexical ?? []).map((item) => item.id),
      structured: (evaluated.lists.structured ?? []).map((item) => item.id),
      relationship: (evaluated.lists.relationship ?? []).map((item) => item.id),
      rrf: returnedIds,
    };

    if (query.expected.disposition === "results") {
      for (const system of systems) {
        const value = ndcg(rankIds[system], query);
        metrics[system].ndcg += value;
        metrics[system].mrr += reciprocalRank(rankIds[system], query);
        metrics[system].recall += recall(rankIds[system], query);
        metrics[system].positiveCases += 1;
        if (value < 0.999999999) metrics[system].imperfectCases += 1;
      }
    }

    cases.push({
      id: query.id,
      expectedDisposition: query.expected.disposition,
      actualDisposition: evaluated.disposition,
      reasonCode: evaluated.reasonCode,
      eligibleIds: evaluated.eligibleIds,
      lexical: rankIds.lexical.slice(0, 3),
      structured: rankIds.structured.slice(0, 3),
      relationship: rankIds.relationship.slice(0, 3),
      rrf: rankIds.rrf.slice(0, 3),
    });
  }

  for (const system of systems) {
    const count = metrics[system].positiveCases || 1;
    metrics[system] = {
      meanNdcgAt3: Number((metrics[system].ndcg / count).toFixed(6)),
      mrrAt3: Number((metrics[system].mrr / count).toFixed(6)),
      recallAt3: Number((metrics[system].recall / count).toFixed(6)),
      imperfectCases: metrics[system].imperfectCases,
      positiveCases: metrics[system].positiveCases,
    };
  }

  const singleMeans = [metrics.lexical.meanNdcgAt3, metrics.structured.meanNdcgAt3, metrics.relationship.meanNdcgAt3];
  const strongestSingle = Math.max(...singleMeans);
  return {
    suiteId: suite.suiteId,
    queryCount: suite.queries.length,
    dispositionCorrect,
    forbiddenAppearances,
    metrics,
    strongestSingleMeanNdcgAt3: strongestSingle,
    rrfLiftOverStrongest: Number((metrics.rrf.meanNdcgAt3 - strongestSingle).toFixed(6)),
    cases,
  };
}

function determinism(suites) {
  const baseline = JSON.stringify(suites.flatMap((suite) => suite.queries.map((query) => evaluateQuery(query))));
  for (let run = 1; run < 100; run += 1) {
    const current = JSON.stringify(suites.flatMap((suite) => suite.queries.map((query) => evaluateQuery(query))));
    invariant(current === baseline, `determinism failure on repetition ${run + 1}`);
  }
  return { repetitions: 100, byteIdentical: true, digest: createHash("sha256").update(baseline).digest("hex") };
}

validateFixtures();
const devSummary = summarizeSuite(dev);
const holdoutSummary = summarizeSuite(holdout);
const deterministic = determinism([dev, holdout]);

const preSealGates = {
  counts: corpus.records.length === 36 && dev.queries.length === 12 && holdout.queries.length === 18,
  queryTextExact: true,
  noForbiddenAppearances: devSummary.forbiddenAppearances === 0 && holdoutSummary.forbiddenAppearances === 0,
  allDispositions: devSummary.dispositionCorrect === 12 && holdoutSummary.dispositionCorrect === 18,
  everySingleRankerImperfect: ["lexical", "structured", "relationship"].every((name) => holdoutSummary.metrics[name].imperfectCases >= 1),
  strongestSingleBelowCeiling: holdoutSummary.strongestSingleMeanNdcgAt3 < 0.95,
  predictedRrfLift: holdoutSummary.rrfLiftOverStrongest >= 0.05,
  predictedRrfQuality: holdoutSummary.metrics.rrf.meanNdcgAt3 >= 0.90 && holdoutSummary.metrics.rrf.mrrAt3 >= 0.85 && holdoutSummary.metrics.rrf.recallAt3 >= 0.90,
  deterministic: deterministic.byteIdentical,
};

const output = {
  benchmarkId: "fcs-rrf-benchmark-v2",
  algorithmId: "rrf-k60-v2",
  prefilterId: "focus-eligibility-v2",
  lexicalId: "eligible-ts-bm25-v1",
  phase: "pre-seal-calibration",
  generatedBy: "reference-evaluator-v2.mjs",
  fixtureHashes: {
    "rrf-corpus-v1.json": sha256("rrf-corpus-v1.json"),
    "rrf-corpus-overrides-v2.json": sha256("rrf-corpus-overrides-v2.json"),
    "rrf-dev-queries-v2.json": sha256("rrf-dev-queries-v2.json"),
    "rrf-holdout-queries-v2.json": sha256("rrf-holdout-queries-v2.json"),
    "rrf-corpus-schema-v2.json": sha256("rrf-corpus-schema-v2.json"),
    "rrf-query-suite-schema-v2.json": sha256("rrf-query-suite-schema-v2.json"),
  },
  effectiveCorpusDigest: createHash("sha256").update(JSON.stringify(corpus)).digest("hex"),
  dev: devSummary,
  holdout: holdoutSummary,
  determinism: deterministic,
  preSealGates,
  overall: Object.values(preSealGates).every(Boolean) ? "PASS" : "FAIL",
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.overall !== "PASS") process.exitCode = 1;
