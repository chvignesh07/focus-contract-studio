import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EXPECTED_AUTHORITY_PACK_SHA256,
  validateAuthorityPack,
} from '../../scripts/verify-authority-import.mjs';

test('revision-2 authority import is complete and mechanically valid', async () => {
  const result = await validateAuthorityPack(
    new URL('../../', import.meta.url),
  );

  assert.equal(result.status, 'PASS');
  assert.equal(result.importedFileCount, 43);
  assert.equal(result.mandatoryPathCount, 26);
  assert.equal(result.parsedJsonCount, 10);
  assert.equal(result.fixtureHashCount, 8);
  assert.deepEqual(result.brokenLocalLinks, []);
  assert.deepEqual(result.errors, []);
  assert.equal(result.packSha256, EXPECTED_AUTHORITY_PACK_SHA256);
});
