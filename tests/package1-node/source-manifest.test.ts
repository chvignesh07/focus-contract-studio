import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
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
  'scripts/package1-source-manifest.mjs',
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

function copyManifestedRoot(prefix: string) {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), prefix));
  const generated = spawnSync(
    process.execPath,
    [verifierPath, '--root', repositoryRoot, '--print'],
    { encoding: 'utf8' },
  );
  assert.equal(generated.status, 0, `${generated.stdout}${generated.stderr}`);
  const manifest = JSON.parse(generated.stdout) as {
    files: Array<{ path: string }>;
  };
  for (const file of manifest.files) {
    const destination = path.join(temporaryRoot, file.path);
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(path.join(repositoryRoot, file.path), destination);
  }
  const copiedManifestPath = path.join(temporaryRoot, 'manifest.json');
  writeFileSync(
    copiedManifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return { temporaryRoot, copiedManifestPath };
}

test('tracked Package 1 source manifest matches every live scoped file', () => {
  const result = runVerifier();

  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /^CONSISTENCY_PASS /u);
});

test('source manifest verifier rejects a forged file digest', () => {
  const temporaryDirectory = mkdtempSync(
    path.join(tmpdir(), 'fcs-package1-forged-manifest-'),
  );
  const forgedManifestPath = path.join(temporaryDirectory, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    files: Array<{ path: string; sha256: string }>;
  };
  manifest.files[0]!.sha256 = '0'.repeat(64);
  writeFileSync(forgedManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const result = runVerifier(forgedManifestPath);

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /^CONSISTENCY_FAIL /u);
});

test('source manifest verifier rejects an unmanifested file in a scoped tree', () => {
  const { temporaryRoot, copiedManifestPath } = copyManifestedRoot(
    'fcs-package1-extra-source-',
  );
  writeFileSync(
    path.join(temporaryRoot, 'lib/package1-unmanifested.tmp'),
    'must be detected\n',
  );

  const result = spawnSync(
    process.execPath,
    [
      verifierPath,
      '--root',
      temporaryRoot,
      '--manifest',
      copiedManifestPath,
    ],
    { encoding: 'utf8' },
  );

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /^CONSISTENCY_FAIL /u);
});

test('source manifest binds the fail-closed migration configuration', () => {
  const { temporaryRoot, copiedManifestPath } = copyManifestedRoot(
    'fcs-package1-migration-config-',
  );
  writeFileSync(
    path.join(temporaryRoot, 'drizzle.config.ts'),
    `throw new Error('generation enabled by mutation');\n`,
  );

  const result = spawnSync(
    process.execPath,
    [
      verifierPath,
      '--root',
      temporaryRoot,
      '--manifest',
      copiedManifestPath,
    ],
    { encoding: 'utf8' },
  );

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /^CONSISTENCY_FAIL /u);
});
