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
const verifier = path.join(repositoryRoot, 'scripts/package2-source-manifest.mjs');
const manifest = path.join(
  repositoryRoot,
  '.artifacts/test/package2-source-manifest.json',
);

function run(manifestPath = manifest) {
  return spawnSync(
    process.execPath,
    [verifier, '--root', repositoryRoot, '--manifest', manifestPath],
    { encoding: 'utf8' },
  );
}

test('Package 2 source manifest matches the complete evolved implementation scope', () => {
  const result = run();
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /^SOURCE_MANIFEST_PASS /u);
});

test('Package 2 binds its secret-scan policy and exact browser-test toolchain', () => {
  const value = JSON.parse(readFileSync(manifest, 'utf8')) as {
    source_roots: string[];
  };
  const packageJson = JSON.parse(
    readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'),
  ) as { devDependencies?: Record<string, string> };

  assert.ok(value.source_roots.includes('.gitleaks.toml'));
  for (const dependency of [
    '@axe-core/playwright',
    '@playwright/test',
    '@testing-library/dom',
    '@testing-library/jest-dom',
    '@testing-library/react',
    '@testing-library/user-event',
    'jsdom',
  ]) {
    assert.match(
      packageJson.devDependencies?.[dependency] ?? '',
      /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u,
      `${dependency} must be pinned to one exact version`,
    );
  }
});

test('Package 2 binds the current Package 1 evidence verifier and its regression', () => {
  const value = JSON.parse(readFileSync(manifest, 'utf8')) as {
    source_roots: string[];
    files: Array<{ path: string }>;
  };
  const requiredPaths = [
    'scripts/package1-evidence-binding.mjs',
    'tests/package1-node/evidence-binding.test.ts',
  ];

  for (const requiredPath of requiredPaths) {
    assert.ok(
      value.source_roots.includes(requiredPath),
      `${requiredPath} must be a Package 2 source root`,
    );
    assert.ok(
      value.files.some((file) => file.path === requiredPath),
      `${requiredPath} must be hash-bound in the Package 2 manifest`,
    );
  }
});

test('Package 2 source files are reviewable UTF-8 without raw control bytes', () => {
  const value = JSON.parse(readFileSync(manifest, 'utf8')) as {
    files: Array<{ path: string }>;
  };
  for (const file of value.files) {
    const bytes = readFileSync(path.join(repositoryRoot, file.path));
    const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    assert.equal(
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(source),
      false,
      `${file.path} contains a raw control byte`,
    );
  }
});

test('Package 2 source manifest rejects a forged file digest', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'fcs-package2-source-forge-'));
  const forged = path.join(directory, 'manifest.json');
  const value = JSON.parse(readFileSync(manifest, 'utf8')) as {
    files: Array<{ sha256: string }>;
  };
  value.files.at(-1)!.sha256 = 'f'.repeat(64);
  writeFileSync(forged, `${JSON.stringify(value, null, 2)}\n`);
  const result = run(forged);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /^SOURCE_MANIFEST_FAIL /u);
});
