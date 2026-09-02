import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  scripts: Record<string, string>;
};
const playwrightConfig = readFileSync(
  new URL('../../playwright.config.ts', import.meta.url),
  'utf8',
);

test('one supported setup command installs the declared project-local Chromium', () => {
  assert.equal(
    packageJson.scripts['setup:browsers'],
    'PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers playwright install --with-deps chromium',
  );
  for (const name of [
    'test:package2:browser:built',
    'test:package3:browser:built',
    'test:package5:browser:built',
    'test:package6:browser:built',
    'test:package7:browser:built',
    'test:package8:browser:built',
  ]) {
    assert.match(packageJson.scripts[name] ?? '', /PLAYWRIGHT_BROWSERS_PATH=\.playwright-browsers/u, name);
  }
  assert.match(
    playwrightConfig,
    /packageNumber === '8'[\s\S]*drizzle\/0005_package8_admission_lineage\.sql[\s\S]*drizzle\/0006_package8_atomic_admission\.sql/u,
  );
});
