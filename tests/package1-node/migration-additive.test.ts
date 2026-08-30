import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../..',
);

test('Package 1 migration contains no destructive or Package 0-owned statements', async () => {
  const sql = await readFile(
    path.join(repositoryRoot, 'drizzle/0001_package1_domain.sql'),
    'utf8',
  );
  assert.doesNotMatch(sql, /\b(?:DROP|ALTER|REPLACE|VACUUM|ATTACH|DETACH)\b/iu);
  assert.doesNotMatch(sql, /\b(?:CREATE|INSERT|UPDATE|DELETE)\b[^;]*\bpackage0_/iu);
  assert.doesNotMatch(sql, /__fcs_package0_probe_gate/iu);
});
