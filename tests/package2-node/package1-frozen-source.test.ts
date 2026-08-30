import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const verifier = path.join(
  repositoryRoot,
  'scripts/package1-frozen-source-verifier.mjs',
);
const manifestPath = path.join(
  repositoryRoot,
  '.artifacts/test/package1-source-manifest.json',
);

function run(manifest = manifestPath) {
  return spawnSync(
    process.execPath,
    [verifier, '--root', repositoryRoot, '--manifest', manifest],
    { encoding: 'utf8' },
  );
}

test('Package 1 evidence is verified against its exact published commit, not the evolved Package 2 tree', () => {
  const result = run();
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(
    result.stdout,
    /^FROZEN_SOURCE_PASS commit=e560e0998f24cda1c7c8c2740b67ece487b1ea52 files=42 /u,
  );
});

test('frozen verifier rejects a forged historical manifest digest', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'fcs-package1-frozen-forge-'));
  const forgedPath = path.join(directory, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    files: Array<{ sha256: string }>;
  };
  manifest.files[0]!.sha256 = '0'.repeat(64);
  writeFileSync(forgedPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const result = run(forgedPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /^FROZEN_SOURCE_FAIL /u);
});
