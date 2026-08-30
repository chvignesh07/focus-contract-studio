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
const verifierPath = path.join(
  repositoryRoot,
  'scripts/package1-frozen-source-verifier.mjs',
);
const manifestPath = path.join(
  repositoryRoot,
  '.artifacts/test/package1-source-manifest.json',
);

function runVerifier(manifest = manifestPath) {
  return spawnSync(
    process.execPath,
    [verifierPath, '--root', repositoryRoot, '--manifest', manifest],
    { encoding: 'utf8' },
  );
}

test('tracked Package 1 source manifest matches the exact published Package 1 commit', () => {
  const result = runVerifier();
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(
    result.stdout,
    /^FROZEN_SOURCE_PASS commit=e560e0998f24cda1c7c8c2740b67ece487b1ea52 /u,
  );
});

test('frozen source verifier rejects a forged file digest', () => {
  const temporaryDirectory = mkdtempSync(
    path.join(tmpdir(), 'fcs-package1-forged-frozen-manifest-'),
  );
  const forgedManifestPath = path.join(temporaryDirectory, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    files: Array<{ sha256: string }>;
  };
  manifest.files[0]!.sha256 = '0'.repeat(64);
  writeFileSync(forgedManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const result = runVerifier(forgedManifestPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /^FROZEN_SOURCE_FAIL /u);
});

test('later additive source cannot silently redefine the historical Package 1 boundary', () => {
  const result = runVerifier();
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    files: Array<{ path: string }>;
  };
  assert.equal(
    manifest.files.some(({ path: relativePath }) =>
      relativePath.startsWith('lib/retrieval/'),
    ),
    false,
  );
});
