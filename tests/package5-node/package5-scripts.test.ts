import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const packageJson = JSON.parse(
  await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
) as { scripts: Record<string, string> };

test('Package 5 exposes focused test commands and a composed inherited gate', () => {
  assert.equal(
    packageJson.scripts['test:package5:node'],
    'npm run test:package5:node:core && node --experimental-strip-types --test tests/package5-node/source-evidence.test.ts',
  );
  assert.equal(
    packageJson.scripts['test:package5:d1'],
    'vitest run --config vitest.package5.config.ts',
  );
  assert.equal(
    packageJson.scripts['test:package5:dom'],
    'vitest run --config vitest.package5-dom.config.ts',
  );
  assert.match(
    packageJson.scripts['test:package5:coverage:safety-core'] ?? '',
    /--test-coverage-branches=100 --test-coverage-lines=95 --test-coverage-functions=95/u,
  );
  assert.doesNotMatch(
    packageJson.scripts['test:package5:coverage:safety-core'] ?? '',
    /coverage-exclude|disable-coverage/u,
  );
  const operationCoverage = packageJson.scripts['test:package5:coverage:server-operations'] ?? '';
  assert.match(operationCoverage, /--experimental-test-coverage/u);
  assert.match(operationCoverage, /--test-coverage-branches=85/u);
  assert.match(operationCoverage, /--test-coverage-lines=90/u);
  assert.match(operationCoverage, /--test-coverage-functions=90/u);
  assert.match(operationCoverage, /package5-operation-policy\.ts/u);
  assert.doesNotMatch(operationCoverage, /coverage-exclude|disable-coverage/u);
  const core = packageJson.scripts['verify:package5:core'] ?? '';
  assert.match(core, /^node scripts\/package5-verify-package4-frozen\.mjs && /u);
  for (const command of [
    'npm run test:package5:node:core',
    'npm run test:package5:d1',
    'npm run test:package5:dom',
    'npm run test:package5:coverage',
    'npm run build',
    'npm run test:package5:browser:built',
    'npm run audit:package0',
  ]) {
    assert.match(core, new RegExp(command.replaceAll(':', '\\:')));
  }
  assert.equal(
    packageJson.scripts['record:package5:local-gate'],
    'npm run verify:package5:core && node scripts/package5-source-manifest.mjs --write && node scripts/package5-local-gate.mjs --write',
  );
  const gate = packageJson.scripts['verify:package5'] ?? '';
  assert.match(gate, /^npm run verify:package5:core && /u);
  assert.match(gate, /verify:package5:source-binding/u);
  assert.match(gate, /verify:package5:evidence-binding/u);
});
