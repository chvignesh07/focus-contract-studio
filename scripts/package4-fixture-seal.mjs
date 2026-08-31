import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { parseStrictJson } from './package3-evidence-binding.mjs';

export const V2_HOLDOUT_FILE = 'rrf-holdout-queries-v2.json';
export const EXPECTED_V1_MANIFEST_SHA256 = '087f73da7e6e43439e1e44291f354db6b5bab8df51c802543a1cd7e69270c474';

export const EXPECTED_V2_HASHES = Object.freeze({
  'rrf-corpus-v1.json': '5f0ca4d31b80b5cb270a1ddd14e2a6f98596a516acf84634e27ba522a179eaa3',
  'rrf-corpus-overrides-v2.json': '783fdd1507de009707e6a7f6fb5cd01412896bb21f55682f7dfcb8ef160ce9cb',
  'rrf-dev-queries-v2.json': '1bb9c02a4b5c9c20fa34e53ff85de86ea41c0425e35335cb295bdf182575298d',
  [V2_HOLDOUT_FILE]: 'ff3d45dbf976582a23a7354ae84ffb67b83ea4029b2fa20cb2dc506c762629f0',
  'rrf-corpus-schema-v2.json': '546d4ea2524cd04c4ff3520eb01d7091d25ecaa2bd60401f5c7232ac8ec56802',
  'rrf-query-suite-schema-v2.json': 'd2db025ee29fd28282ae06d7e15b1db291a2831e2905a940f43cb121a3c6ee3e',
  'reference-evaluator-v2.mjs': 'b9d027f8c3a1aeff248c72e811062cec1ff8340419d9c625af3fe4857a97fa7a',
  'RRF_V2_CALIBRATION.json': 'bc815df5557b483bc4a27f02735afbbd54c4cb350278cf83f29ffe79be9883b6',
});

export const EXPECTED_V1_HASHES = Object.freeze({
  'rrf-corpus-v1.json': EXPECTED_V2_HASHES['rrf-corpus-v1.json'],
  'rrf-dev-queries-v1.json': '8c7b9fbccffbf93a89fc917a49fa4b76b869a21d85e2d503b7c311df711999c5',
  'rrf-holdout-queries-v1.json': 'dc89a94f891126fc8802e83182094b80fb0a8058e58be7400b49e90056319240',
});

const PERMITTED_JSON = new Set([
  'rrf-corpus-v1.json',
  'rrf-corpus-overrides-v2.json',
  'rrf-dev-queries-v2.json',
  'rrf-corpus-schema-v2.json',
  'rrf-query-suite-schema-v2.json',
  'RRF_V2_CALIBRATION.json',
]);
const RECORD_KEYS = Object.freeze([
  'id', 'workspaceKey', 'product', 'componentFamily', 'useCase', 'variants',
  'behavior', 'intent', 'risk', 'outcomeKey', 'status', 'validFrom', 'validTo',
  'supersedes', 'hostile', 'mismatchTags', 'shapeTags', 'relationships',
  'rationale', 'tags',
]);
const CONTEXT_KEYS = Object.freeze([
  'workspaceKey', 'product', 'componentFamily', 'useCase', 'variant', 'behavior',
  'intent', 'risk', 'observedOutcomeKey', 'mismatchTag', 'shapeTag', 'queryText',
  'asOf',
]);

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function exactKeys(label, value, expected) {
  requireCondition(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  requireCondition(
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort()),
    `${label} keys are invalid`,
  );
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function fixtureBytes(fixtureDirectory, filename) {
  requireCondition(!filename.includes('/') && !filename.includes('\\'), `fixture filename is invalid: ${filename}`);
  const filenamePath = path.join(fixtureDirectory, filename);
  const stat = lstatSync(filenamePath);
  requireCondition(stat.isFile() && !stat.isSymbolicLink(), `fixture must be a regular file: ${filename}`);
  return readFileSync(filenamePath);
}

function utf8(bytes, label) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`invalid UTF-8 in ${label}`);
  }
}

export function readPermittedJson(fixtureDirectory, filename) {
  requireCondition(filename !== V2_HOLDOUT_FILE, 'v2 holdout is hash-only');
  requireCondition(PERMITTED_JSON.has(filename), `JSON fixture is not permitted: ${filename}`);
  return parseStrictJson(utf8(fixtureBytes(fixtureDirectory, filename), filename), filename);
}

export function parseSealManifest(source, expected = EXPECTED_V2_HASHES) {
  const expectedNames = Object.keys(expected);
  const lines = source.endsWith('\n') ? source.slice(0, -1).split('\n') : source.split('\n');
  const seen = new Set();
  const entries = lines.map((line, index) => {
    const match = line.match(/^([0-9a-f]{64})  ([A-Za-z0-9._-]+)$/u);
    requireCondition(match, 'seal manifest line is invalid');
    const [, hash, filename] = match;
    requireCondition(!seen.has(filename), `duplicate seal manifest entry: ${filename}`);
    seen.add(filename);
    requireCondition(filename === expectedNames[index], 'seal manifest order or filename is invalid');
    requireCondition(hash === expected[filename], `seal manifest hash is invalid: ${filename}`);
    return { filename, sha256: hash };
  });
  requireCondition(entries.length === expectedNames.length, 'seal manifest entry count is invalid');
  return entries;
}

function canonicalInstant(value, label) {
  requireCondition(
    typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(Date.parse(value)).toISOString().replace('.000Z', 'Z') === value,
    `${label} must be a canonical UTC instant`,
  );
}

function boundedString(value, minimum, maximum, label, pattern) {
  requireCondition(typeof value === 'string', `${label} must be a string`);
  const length = Array.from(value).length;
  requireCondition(length >= minimum && length <= maximum, `${label} length is invalid`);
  if (pattern) requireCondition(pattern.test(value), `${label} format is invalid`);
}

function shortKey(value, label) {
  boundedString(value, 1, 80, label, /^[a-zA-Z0-9*][a-zA-Z0-9._*|:-]*$/u);
}

function boundedUniqueStrings(value, minimum, maximum, label, validate = shortKey) {
  requireCondition(Array.isArray(value) && value.length >= minimum && value.length <= maximum, `${label} count is invalid`);
  const seen = new Set();
  value.forEach((entry, index) => {
    validate(entry, `${label}[${index}]`);
    requireCondition(!seen.has(entry), `${label} contains a duplicate`);
    seen.add(entry);
  });
}

function validateRecord(record, label) {
  exactKeys(label, record, RECORD_KEYS);
  boundedString(record.id, 4, 4, `${label}.id`, /^D\d{3}$/u);
  for (const key of ['workspaceKey', 'product', 'componentFamily', 'useCase', 'behavior', 'intent', 'risk', 'outcomeKey']) {
    shortKey(record[key], `${label}.${key}`);
  }
  boundedUniqueStrings(record.variants, 1, 2, `${label}.variants`);
  requireCondition(['active', 'superseded', 'rejected', 'quarantined'].includes(record.status), `${label}.status is invalid`);
  canonicalInstant(record.validFrom, `${label}.validFrom`);
  if (record.validTo !== null) {
    canonicalInstant(record.validTo, `${label}.validTo`);
    requireCondition(record.validTo > record.validFrom, `${label}.validTo must be later than validFrom`);
  }
  requireCondition(record.supersedes === null || /^D\d{3}$/u.test(record.supersedes), `${label}.supersedes is invalid`);
  requireCondition(record.supersedes !== record.id, `${label} cannot supersede itself`);
  requireCondition(typeof record.hostile === 'boolean', `${label}.hostile must be boolean`);
  boundedUniqueStrings(record.mismatchTags, 1, 4, `${label}.mismatchTags`);
  boundedUniqueStrings(record.shapeTags, 1, 5, `${label}.shapeTags`);
  requireCondition(Array.isArray(record.relationships) && record.relationships.length >= 1 && record.relationships.length <= 4, `${label}.relationships count is invalid`);
  for (const [index, relationship] of record.relationships.entries()) {
    exactKeys(`${label}.relationships[${index}]`, relationship, ['type', 'target']);
    requireCondition(relationship.type === 'applies-to', `${label}.relationships[${index}].type is invalid`);
    boundedString(
      relationship.target,
      3,
      180,
      `${label}.relationships[${index}].target`,
      /^(?:context|variant|use-case|family):[a-z0-9|*-]+$/u,
    );
  }
  boundedString(record.rationale, 1, 320, `${label}.rationale`);
  requireCondition(Array.isArray(record.tags) && record.tags.length >= 1 && record.tags.length <= 12, `${label}.tags count is invalid`);
  record.tags.forEach((tag, index) => shortKey(tag, `${label}.tags[${index}]`));
}

function validateSchemaDocument(schema, kind) {
  requireCondition(schema.$schema === 'http://json-schema.org/draft-07/schema#', `${kind} schema draft is invalid`);
  requireCondition(schema.type === 'object' && schema.additionalProperties === false, `${kind} schema root is not closed`);
  requireCondition(schema.properties && schema.definitions, `${kind} schema structure is invalid`);
  if (kind === 'corpus') {
    requireCondition(schema.properties.records?.minItems === 36 && schema.properties.records?.maxItems === 36, 'corpus schema count is invalid');
    requireCondition(schema.definitions.record?.additionalProperties === false, 'corpus record schema is not closed');
  } else {
    requireCondition(schema.properties.queries?.minItems === 12 && schema.properties.queries?.maxItems === 18, 'query schema count is invalid');
    requireCondition(schema.definitions.context?.additionalProperties === false, 'query context schema is not closed');
    requireCondition(schema.definitions.expected?.additionalProperties === false, 'query expected schema is not closed');
  }
}

export function materializeEffectiveCorpus(base, overrides) {
  exactKeys('base corpus', base, ['schemaVersion', 'corpusId', 'asOf', 'records']);
  exactKeys('corpus overrides', overrides, ['schemaVersion', 'baseCorpusId', 'effectiveCorpusId', 'materializer', 'overrides']);
  requireCondition(base.schemaVersion === 1 && base.corpusId === 'fcs-rrf-corpus-v1', 'base corpus identity is invalid');
  requireCondition(
    overrides.schemaVersion === 2 &&
      overrides.baseCorpusId === base.corpusId &&
      overrides.effectiveCorpusId === 'fcs-rrf-corpus-v2' &&
      overrides.materializer === 'whole-field-replace-v1',
    'v2 materialization identity is invalid',
  );
  canonicalInstant(base.asOf, 'base corpus asOf');
  requireCondition(Array.isArray(base.records) && base.records.length === 36, 'base corpus must contain 36 records');
  const records = structuredClone(base.records);
  const byId = new Map(records.map((record) => [record.id, record]));
  requireCondition(byId.size === 36, 'base corpus record IDs must be unique');
  requireCondition(Array.isArray(overrides.overrides), 'corpus overrides must be an array');
  const replaced = new Set();
  for (const [index, entry] of overrides.overrides.entries()) {
    exactKeys(`override[${index}]`, entry, ['id', 'replace']);
    requireCondition(/^D\d{3}$/u.test(entry.id) && byId.has(entry.id), `override reference is invalid: ${entry.id}`);
    requireCondition(!replaced.has(entry.id), `duplicate corpus override: ${entry.id}`);
    replaced.add(entry.id);
    requireCondition(entry.replace && typeof entry.replace === 'object' && !Array.isArray(entry.replace), `override ${entry.id} replacement is invalid`);
    requireCondition(Object.keys(entry.replace).length > 0 && !Object.hasOwn(entry.replace, 'id'), `override ${entry.id} replacement is invalid`);
    requireCondition(Object.keys(entry.replace).every((key) => RECORD_KEYS.includes(key)), `override ${entry.id} field is invalid`);
    Object.assign(byId.get(entry.id), structuredClone(entry.replace));
  }
  records.forEach((record, index) => validateRecord(record, `effective records[${index}]`));
  const ids = new Set(records.map(({ id }) => id));
  for (const record of records) {
    requireCondition(record.supersedes === null || ids.has(record.supersedes), `corpus supersession reference is invalid: ${record.id}`);
  }
  return { schemaVersion: 2, corpusId: 'fcs-rrf-corpus-v2', asOf: base.asOf, records };
}

function neutralQuery(context) {
  return `product=${context.product} family=${context.componentFamily} use_case=${context.useCase} variant=${context.variant} behavior=${context.behavior} observed=${context.observedOutcomeKey} mismatch=${context.mismatchTag} shape=${context.shapeTag} intent=${context.intent} risk=${context.risk}`;
}

export function validateQuerySuite(source, recordIds) {
  const suite = parseStrictJson(source, 'development query suite');
  exactKeys('development query suite', suite, ['schemaVersion', 'suiteId', 'queries']);
  requireCondition(suite.schemaVersion === 2 && suite.suiteId === 'fcs-rrf-dev-v2', 'development suite identity is invalid');
  requireCondition(Array.isArray(suite.queries) && suite.queries.length === 12, 'suite must contain exactly 12 development queries');
  const ids = new Set();
  let positiveCases = 0;
  suite.queries.forEach((query, index) => {
    const label = `development query ${index + 1}`;
    exactKeys(label, query, ['id', 'context', 'expected']);
    requireCondition(query.id === `DEV2-${String(index + 1).padStart(2, '0')}`, `${label} ID or order is invalid`);
    requireCondition(!ids.has(query.id), `${label} ID is duplicated`);
    ids.add(query.id);
    exactKeys(`${label}.context`, query.context, CONTEXT_KEYS);
    for (const key of CONTEXT_KEYS.filter((key) => key !== 'queryText' && key !== 'asOf')) {
      boundedString(query.context[key], 1, 80, `${label}.context.${key}`);
    }
    boundedString(query.context.queryText, 1, 640, `${label}.context.queryText`);
    canonicalInstant(query.context.asOf, `${label}.context.asOf`);
    requireCondition(query.context.queryText === neutralQuery(query.context), `${label} neutral query is invalid`);
    exactKeys(`${label}.expected`, query.expected, ['disposition', 'relevant', 'forbidden', 'rationale']);
    requireCondition(['results', 'abstain', 'conflict'].includes(query.expected.disposition), `${label} disposition is invalid`);
    requireCondition(Array.isArray(query.expected.relevant) && query.expected.relevant.length <= 5, `${label} relevant judgments are invalid`);
    const relevantIds = new Set();
    for (const [relevantIndex, relevant] of query.expected.relevant.entries()) {
      exactKeys(`${label}.expected.relevant[${relevantIndex}]`, relevant, ['id', 'grade']);
      requireCondition(recordIds.has(relevant.id), `${label} relevant reference is invalid`);
      requireCondition(Number.isInteger(relevant.grade) && relevant.grade >= 1 && relevant.grade <= 3, `${label} relevance grade is invalid`);
      requireCondition(!relevantIds.has(relevant.id), `${label} relevant reference is duplicated`);
      relevantIds.add(relevant.id);
    }
    boundedUniqueStrings(
      query.expected.forbidden,
      0,
      36,
      `${label}.expected.forbidden`,
      (value, forbiddenLabel) => {
        boundedString(value, 4, 4, forbiddenLabel, /^D\d{3}$/u);
        requireCondition(recordIds.has(value), `${label} forbidden reference is invalid`);
      },
    );
    boundedString(query.expected.rationale, 1, 320, `${label}.expected.rationale`);
    requireCondition(
      query.expected.disposition === 'results' || query.expected.disposition === 'conflict'
        ? query.expected.relevant.length > 0
        : query.expected.relevant.length === 0,
      `${label} disposition judgments are inconsistent`,
    );
    if (query.expected.disposition === 'results') positiveCases += 1;
  });
  return { suite, queries: suite.queries.length, positiveCases };
}

function validateCalibration(calibration, manifest, corpusDigest, development) {
  exactKeys('calibration', calibration, [
    'benchmarkId', 'algorithmId', 'prefilterId', 'lexicalId', 'phase', 'generatedAt',
    'generatedBy', 'referenceEvaluatorSha256', 'effectiveCorpusDigest', 'fixtureHashes',
    'dev', 'holdoutFeasibility', 'determinism', 'preSealGates', 'overall',
  ]);
  requireCondition(
    calibration.benchmarkId === 'fcs-rrf-benchmark-v2' &&
      calibration.algorithmId === 'rrf-k60-v2' &&
      calibration.prefilterId === 'focus-eligibility-v2' &&
      calibration.lexicalId === 'eligible-ts-bm25-v1' &&
      calibration.phase === 'pre-seal-calibration' &&
      calibration.generatedBy === 'reference-evaluator-v2.mjs',
    'calibration identity is invalid',
  );
  canonicalInstant(calibration.generatedAt, 'calibration generatedAt');
  requireCondition(calibration.referenceEvaluatorSha256 === manifest['reference-evaluator-v2.mjs'], 'calibration evaluator hash is invalid');
  requireCondition(calibration.effectiveCorpusDigest === corpusDigest, 'calibration corpus digest is invalid');
  const expectedFixtureHashes = Object.fromEntries(
    Object.entries(manifest).filter(([filename]) =>
      ['rrf-corpus-v1.json', 'rrf-corpus-overrides-v2.json', 'rrf-dev-queries-v2.json', V2_HOLDOUT_FILE, 'rrf-corpus-schema-v2.json', 'rrf-query-suite-schema-v2.json'].includes(filename),
    ),
  );
  requireCondition(JSON.stringify(calibration.fixtureHashes) === JSON.stringify(expectedFixtureHashes), 'calibration fixture hashes are invalid');
  requireCondition(
    calibration.dev.queryCount === development.queries &&
      calibration.dev.positiveCases === development.positiveCases &&
      calibration.dev.dispositionCorrect === 12 &&
      calibration.dev.forbiddenAppearances === 0,
    'calibration development summary is invalid',
  );
  requireCondition(
    JSON.stringify(calibration.dev.meanNdcgAt3) === JSON.stringify({ lexical: 0.824102, structured: 0.885657, relationship: 0.963726, rrf: 0.963726 }) &&
      JSON.stringify(calibration.dev.mrrAt3) === JSON.stringify({ lexical: 0.75, structured: 0.8125, relationship: 0.9375, rrf: 0.9375 }) &&
      JSON.stringify(calibration.dev.recallAt3) === JSON.stringify({ lexical: 1, structured: 1, relationship: 1, rrf: 1 }),
    'calibration development metrics are invalid',
  );
  requireCondition(
    calibration.determinism?.repetitions === 100 &&
      calibration.determinism.byteIdentical === true &&
      /^[0-9a-f]{64}$/u.test(calibration.determinism.digest),
    'calibration determinism receipt is invalid',
  );
  requireCondition(
    calibration.preSealGates && Object.values(calibration.preSealGates).length === 9 && Object.values(calibration.preSealGates).every((value) => value === true),
    'calibration pre-seal gates are invalid',
  );
  requireCondition(
    calibration.holdoutFeasibility?.strongestSingleMeanNdcgAt3 < 0.95 &&
      calibration.holdoutFeasibility?.predictedRrfLiftOverStrongest >= 0.05,
    'calibration feasibility receipt is invalid',
  );
  requireCondition(calibration.overall === 'PASS', 'calibration overall status is invalid');
  return { overall: calibration.overall };
}

export function validateV1ManifestBytes(bytes) {
  requireCondition(sha256(bytes) === EXPECTED_V1_MANIFEST_SHA256, 'v1 manifest hash mismatch');
  const source = utf8(bytes, 'SHA256SUMS');
  return parseSealManifest(source, EXPECTED_V1_HASHES);
}

function validateV1(fixtureDirectory) {
  const entries = validateV1ManifestBytes(fixtureBytes(fixtureDirectory, 'SHA256SUMS'));
  for (const entry of entries) {
    requireCondition(sha256(fixtureBytes(fixtureDirectory, entry.filename)) === entry.sha256, `v1 fixture hash mismatch: ${entry.filename}`);
  }
  return {
    status: 'INVALID',
    manifestSha256: EXPECTED_V1_MANIFEST_SHA256,
    hashes: Object.fromEntries(entries.map(({ filename, sha256: hash }) => [filename, hash])),
  };
}

export function validatePackage4FixtureSeal(fixtureDirectory) {
  const manifestSource = utf8(fixtureBytes(fixtureDirectory, 'SHA256SUMS-v2'), 'SHA256SUMS-v2');
  const entries = parseSealManifest(manifestSource);
  for (const entry of entries) {
    requireCondition(sha256(fixtureBytes(fixtureDirectory, entry.filename)) === entry.sha256, `v2 fixture hash mismatch: ${entry.filename}`);
  }
  const manifest = Object.fromEntries(entries.map(({ filename, sha256: hash }) => [filename, hash]));
  const corpusSchema = readPermittedJson(fixtureDirectory, 'rrf-corpus-schema-v2.json');
  const querySchema = readPermittedJson(fixtureDirectory, 'rrf-query-suite-schema-v2.json');
  validateSchemaDocument(corpusSchema, 'corpus');
  validateSchemaDocument(querySchema, 'query');
  const effectiveCorpus = materializeEffectiveCorpus(
    readPermittedJson(fixtureDirectory, 'rrf-corpus-v1.json'),
    readPermittedJson(fixtureDirectory, 'rrf-corpus-overrides-v2.json'),
  );
  const corpusDigest = sha256(JSON.stringify(effectiveCorpus));
  requireCondition(corpusDigest === '5e944319b6898b9a843a4c4885a89cc81a418c7444d21624df94694d5c872724', 'effective corpus digest is invalid');
  const developmentSource = utf8(fixtureBytes(fixtureDirectory, 'rrf-dev-queries-v2.json'), 'rrf-dev-queries-v2.json');
  const development = validateQuerySuite(developmentSource, new Set(effectiveCorpus.records.map(({ id }) => id)));
  const calibration = validateCalibration(
    readPermittedJson(fixtureDirectory, 'RRF_V2_CALIBRATION.json'),
    manifest,
    corpusDigest,
    development,
  );
  return {
    schemaVersion: 'fcs-package4-fixture-seal-v1',
    fileCount: entries.length,
    manifestSha256: sha256(manifestSource),
    holdoutAccess: 'hash-only',
    holdoutSha256: manifest[V2_HOLDOUT_FILE],
    effectiveCorpus: { records: effectiveCorpus.records.length, sha256: corpusDigest },
    development: { queries: development.queries, positiveCases: development.positiveCases },
    calibration,
    v1: validateV1(fixtureDirectory),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fixtureDirectory = path.resolve('docs/retrieval/fixtures/rrf');
  const result = validatePackage4FixtureSeal(fixtureDirectory);
  process.stdout.write(
    `PACKAGE4_FIXTURE_PASS files=${result.fileCount} corpus=${result.effectiveCorpus.records} dev=${result.development.queries} holdout=${result.holdoutAccess} v1=${result.v1.status}\n`,
  );
}
