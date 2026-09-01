import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

test('server-operation coverage gate fails when branches are unexercised', () => {
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    '--experimental-test-coverage',
    '--test-coverage-branches=85',
    '--test-coverage-lines=90',
    '--test-coverage-functions=90',
    '--test-coverage-include=lib/server/package5-operation-policy.ts',
    '--test',
    'tests/package5-node/fixtures/package5-operation-policy-incomplete.test.ts',
  ], { cwd: repositoryRoot, encoding: 'utf8', env: environment });
  assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(`${result.stdout}\n${result.stderr}`, /coverage|threshold/iu);
});
