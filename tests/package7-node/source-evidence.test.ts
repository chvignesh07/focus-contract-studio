import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyPackage7EvidenceBinding } from '../../scripts/package7-evidence-binding.mjs';
import { PACKAGE7_SOURCE_PATHS } from '../../scripts/package7-source-manifest.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('Package 7 source, local gate, checkpoint, and execution truth are byte-bound', () => {
  const result = verifyPackage7EvidenceBinding(repositoryRoot);
  assert.equal(result.source.file_count, PACKAGE7_SOURCE_PATHS.length);
  assert.equal(result.source.aggregate_sha256.length, 64);
  assert.equal(Object.keys(result.evidence_sha256).length, 5);
});
