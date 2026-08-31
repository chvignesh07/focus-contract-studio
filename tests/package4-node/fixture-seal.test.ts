import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  EXPECTED_V1_HASHES,
  V2_HOLDOUT_FILE,
  parseSealManifest,
  readPermittedJson,
  validatePackage4FixtureSeal,
  validateQuerySuite,
  validateV1ManifestBytes,
} from '../../scripts/package4-fixture-seal.mjs';

const fixtureDirectory = path.resolve('docs/retrieval/fixtures/rrf');

test('the frozen v2 seal, permitted schemas, corpus, development suite, calibration, and v1 baseline pass', () => {
  const result = validatePackage4FixtureSeal(fixtureDirectory);

  assert.equal(result.schemaVersion, 'fcs-package4-fixture-seal-v1');
  assert.equal(result.fileCount, 8);
  assert.equal(result.holdoutAccess, 'hash-only');
  assert.equal(result.holdoutSha256, 'ff3d45dbf976582a23a7354ae84ffb67b83ea4029b2fa20cb2dc506c762629f0');
  assert.equal(result.effectiveCorpus.records, 36);
  assert.equal(result.effectiveCorpus.sha256, '5e944319b6898b9a843a4c4885a89cc81a418c7444d21624df94694d5c872724');
  assert.equal(result.development.queries, 12);
  assert.equal(result.development.positiveCases, 8);
  assert.equal(result.calibration.overall, 'PASS');
  assert.equal(result.v1.manifestSha256, '087f73da7e6e43439e1e44291f354db6b5bab8df51c802543a1cd7e69270c474');
  assert.deepEqual(result.v1.hashes, EXPECTED_V1_HASHES);
  assert.equal(result.v1.status, 'INVALID');
});

test('the v1 manifest itself is byte-frozen, including its final newline', () => {
  const bytes = readFileSync(path.join(fixtureDirectory, 'SHA256SUMS'));
  assert.doesNotThrow(() => validateV1ManifestBytes(bytes));
  assert.throws(() => validateV1ManifestBytes(bytes.subarray(0, bytes.length - 1)), /manifest hash/u);
});

test('the manifest is exact, ordered, unique, and rejects malformed or unexpected entries', () => {
  const source = readFileSync(path.join(fixtureDirectory, 'SHA256SUMS-v2'), 'utf8');
  assert.equal(parseSealManifest(source).length, 8);
  assert.throws(() => parseSealManifest(`${source}${source.split('\n')[0]}\n`), /duplicate/u);
  assert.throws(
    () => parseSealManifest(source.replace('rrf-corpus-v1.json', '../rrf-corpus-v1.json')),
    /manifest/u,
  );
  assert.throws(
    () => parseSealManifest(source.replace('rrf-corpus-v1.json', 'unexpected.json')),
    /manifest/u,
  );
});

test('holdout content cannot cross the permitted JSON reader boundary', () => {
  assert.throws(
    () => readPermittedJson(fixtureDirectory, V2_HOLDOUT_FILE),
    /hash-only/u,
  );
});

test('strict fixture parsing rejects duplicate decoded keys', () => {
  assert.throws(
    () =>
      validateQuerySuite(
        '{"schemaVersion":2,"suiteId":"fcs-rrf-dev-v2","queries":[],"\\u0071ueries":[]}',
        new Set(),
      ),
    /duplicate JSON key/u,
  );
});

test('development validation rejects non-neutral queries, dangling references, and wrong counts', () => {
  const suite = readPermittedJson(fixtureDirectory, 'rrf-dev-queries-v2.json') as {
    queries: Array<{ context: { queryText: string }; expected: { forbidden: string[] } }>;
  };
  const recordIds = new Set(
    (readPermittedJson(fixtureDirectory, 'rrf-corpus-v1.json') as {
      records: Array<{ id: string }>;
    }).records.map(({ id }) => id),
  );

  const nonNeutral = structuredClone(suite);
  nonNeutral.queries[0]!.context.queryText += ' expected=cancel-button';
  assert.throws(() => validateQuerySuite(JSON.stringify(nonNeutral), recordIds), /neutral query/u);

  const dangling = structuredClone(suite);
  dangling.queries[0]!.expected.forbidden.push('D999');
  assert.throws(() => validateQuerySuite(JSON.stringify(dangling), recordIds), /reference/u);

  const short = structuredClone(suite);
  short.queries.pop();
  assert.throws(() => validateQuerySuite(JSON.stringify(short), recordIds), /12 development/u);
});
