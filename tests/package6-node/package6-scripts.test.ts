import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const packageJson = JSON.parse(
  await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
) as { scripts: Record<string, string> };
const frozenVerifier = await readFile(
  new URL('../../scripts/package6-verify-package5-frozen.mjs', import.meta.url),
  'utf8',
);

test('Package 6 composes one evidence-bound gate over the exact frozen Package 5 checkpoint', () => {
  assert.match(
    frozenVerifier,
    /const PACKAGE5_COMMIT = 'f54f3c2e2db24d9ce177c47dd16837f0d0b00db0'/u,
  );
  assert.equal(
    packageJson.scripts['test:package6:node'],
    'npm run test:package6:node:core && node --experimental-strip-types --test tests/package6-node/source-evidence.test.ts',
  );
  const coverage = packageJson.scripts['test:package6:coverage'] ?? '';
  assert.match(coverage, /--test-coverage-branches=100/u);
  assert.match(coverage, /--test-coverage-lines=100/u);
  assert.match(coverage, /--test-coverage-functions=100/u);
  assert.match(coverage, /--test-coverage-include=lib\/domain\/package6\.ts/u);
  assert.doesNotMatch(coverage, /coverage-exclude|disable-coverage/u);

  const core = packageJson.scripts['verify:package6:core'] ?? '';
  assert.match(core, /^node scripts\/package6-verify-package5-frozen\.mjs && /u);
  for (const command of [
    'npm run typecheck',
    'npm run lint',
    'npm run test:package6:node:core',
    'npm run test:package6:d1',
    'npm run test:package6:dom',
    'npm run test:package6:coverage',
    'npm run build',
    'npm run test:package6:browser:built',
    'npm run audit:package0',
    'npm run verify:package6:design-cold',
  ]) assert.ok(core.includes(command), `missing ${command}`);

  assert.equal(
    packageJson.scripts['record:package6:local-gate'],
    'npm run verify:package6:core && node scripts/package6-source-manifest.mjs --write && node scripts/package6-local-gate.mjs --write',
  );
  assert.equal(
    packageJson.scripts['verify:package6'],
    'npm run verify:package6:core && node --experimental-strip-types --test tests/package6-node/source-evidence.test.ts && npm run verify:package6:source-binding && npm run verify:package6:evidence-binding',
  );
});
