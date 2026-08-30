import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
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
const verifier = path.join(repositoryRoot, 'scripts/package2-source-manifest.mjs');
const manifest = path.join(
  repositoryRoot,
  '.artifacts/test/package2-source-manifest.json',
);

function run(root = repositoryRoot, manifestPath = path.join(
  root,
  '.artifacts/test/package2-source-manifest.json',
)) {
  return spawnSync(
    process.execPath,
    [verifier, '--root', root, '--manifest', manifestPath],
    { encoding: 'utf8' },
  );
}

function runPrint(root: string) {
  return spawnSync(process.execPath, [verifier, '--root', root, '--print'], {
    encoding: 'utf8',
  });
}

function gitTrackedFiles(root = repositoryRoot) {
  const result = spawnSync('git', ['-C', root, 'ls-files', '-z'], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.split('\0').filter(Boolean).sort();
}

function trackedRepositoryFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'fcs-package2-source-'));
  for (const relativePath of gitTrackedFiles()) {
    const target = path.join(root, relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(repositoryRoot, relativePath), target);
  }
  for (const args of [
    ['init', '--quiet'],
    ['add', '--force', '--all'],
  ]) {
    const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  return root;
}

const documentedSourceManifestExclusions = [
  '.artifacts/browser/package2-local-journey.json',
  '.artifacts/security/package2-security.json',
  '.artifacts/test/package2-local-gate.json',
  '.artifacts/test/package2-source-manifest.json',
  'docs/evidence/PACKAGE2_VERIFICATION.md',
] as const;

function isDocumentedSourceManifestExclusion(relativePath: string) {
  return documentedSourceManifestExclusions.includes(
    relativePath as (typeof documentedSourceManifestExclusions)[number],
  );
}

test('Package 2 source manifest matches the complete evolved implementation scope', () => {
  const result = run();
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /^SOURCE_MANIFEST_PASS /u);
});

test('Package 2 binds its secret-scan policy and exact browser-test toolchain', () => {
  const value = JSON.parse(readFileSync(manifest, 'utf8')) as {
    exclusions: Array<{ match: string; value: string }>;
    files: Array<{ path: string }>;
  };
  assert.deepEqual(
    value.exclusions.map(({ match, value: exclusionPath }) => ({
      match,
      value: exclusionPath,
    })),
    documentedSourceManifestExclusions.map((exclusionPath) => ({
      match: 'EXACT_PATH',
      value: exclusionPath,
    })),
    'exclusions must be exact and limited to self-referential evidence',
  );
  const packageJson = JSON.parse(
    readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'),
  ) as { devDependencies?: Record<string, string> };

  assert.ok(value.files.some((file) => file.path === '.gitleaks.toml'));
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
    files: Array<{ path: string }>;
  };
  const requiredPaths = [
    'scripts/package1-evidence-binding.mjs',
    'tests/package1-node/evidence-binding.test.ts',
  ];

  for (const requiredPath of requiredPaths) {
    assert.ok(
      value.files.some((file) => file.path === requiredPath),
      `${requiredPath} must be hash-bound in the Package 2 manifest`,
    );
  }
});

test('Package 2 binds every required canonical gate and runtime input class', () => {
  const value = JSON.parse(readFileSync(manifest, 'utf8')) as {
    files: Array<{ path: string }>;
  };
  const boundPaths = new Set(value.files.map((file) => file.path));
  const requiredPaths = [
    '.npmrc',
    'probes/webmcp/package0-tool.ts',
    'public/favicon.svg',
    'types/raw-imports.d.ts',
    'tests/package0/webmcp-lifecycle.test.ts',
    'tests/package1/session.test.ts',
    'tests/package1-node/identity-disabled.test.ts',
    'vitest.package0.config.ts',
    'vitest.package1.config.ts',
    'wrangler.package0.jsonc',
    'wrangler.package1.jsonc',
    'scripts/package1-source-manifest.mjs',
    'scripts/verify-authority-import.mjs',
    'docs/retrieval/fixtures/rrf/rrf-corpus-v1.json',
    'docs/retrieval/fixtures/rrf/rrf-corpus-overrides-v2.json',
    'docs/retrieval/fixtures/rrf/SHA256SUMS-v2',
  ];

  for (const requiredPath of requiredPaths) {
    assert.ok(boundPaths.has(requiredPath), `${requiredPath} must be hash-bound`);
  }
});

test('Package 2 source binding rejects tampering across every required input class', () => {
  const tamperTargets = [
    'docs/retrieval/fixtures/rrf/rrf-corpus-v1.json',
    'probes/webmcp/package0-tool.ts',
    'tests/package0/webmcp-lifecycle.test.ts',
    'vitest.package0.config.ts',
    '.npmrc',
    'scripts/verify-authority-import.mjs',
  ];

  for (const relativePath of tamperTargets) {
    const root = trackedRepositoryFixture();
    appendFileSync(path.join(root, relativePath), '\npackage2-tamper-probe\n');
    const result = run(root);
    assert.notEqual(
      result.status,
      0,
      `${relativePath} tampering escaped the source binding`,
    );
    assert.match(result.stderr, /^SOURCE_MANIFEST_FAIL /u);
  }
});

test('Package 2 source binding is closed over the tracked repository inventory', () => {
  const value = JSON.parse(readFileSync(manifest, 'utf8')) as {
    files: Array<{ path: string }>;
  };
  const expected = gitTrackedFiles().filter(
    (relativePath) => !isDocumentedSourceManifestExclusion(relativePath),
  );
  assert.deepEqual(
    value.files.map((file) => file.path),
    expected,
    'only generated or self-referential evidence may be excluded',
  );

  const root = trackedRepositoryFixture();
  const futureInput = path.join(root, 'probes/future-canonical-input.ts');
  writeFileSync(futureInput, 'export const futureCanonicalInput = true;\n');
  const added = spawnSync(
    'git',
    ['-C', root, 'add', '--force', 'probes/future-canonical-input.ts'],
    { encoding: 'utf8' },
  );
  assert.equal(added.status, 0, added.stderr);
  const result = run(root);
  assert.notEqual(result.status, 0, 'a newly tracked input escaped the binding');
  assert.match(result.stderr, /^SOURCE_MANIFEST_FAIL /u);

  const hostilePathRoot = trackedRepositoryFixture();
  const hostileRelativePath = 'probes/hostile\ntracked-path.ts';
  writeFileSync(path.join(hostilePathRoot, hostileRelativePath), 'export {};\n');
  const hostileAdded = spawnSync(
    'git',
    ['-C', hostilePathRoot, 'add', '--force', hostileRelativePath],
    { encoding: 'utf8' },
  );
  assert.equal(hostileAdded.status, 0, hostileAdded.stderr);
  const hostileResult = runPrint(hostilePathRoot);
  assert.notEqual(hostileResult.status, 0);
  assert.match(hostileResult.stderr, /unsafe source path/u);

  const symlinkRoot = trackedRepositoryFixture();
  const symlinkRelativePath = 'probes/tracked-symlink.ts';
  symlinkSync('../package.json', path.join(symlinkRoot, symlinkRelativePath));
  const symlinkAdded = spawnSync(
    'git',
    ['-C', symlinkRoot, 'add', '--force', symlinkRelativePath],
    { encoding: 'utf8' },
  );
  assert.equal(symlinkAdded.status, 0, symlinkAdded.stderr);
  const symlinkResult = runPrint(symlinkRoot);
  assert.notEqual(symlinkResult.status, 0);
  assert.match(symlinkResult.stderr, /symbolic links are forbidden/u);
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
  const result = run(repositoryRoot, forged);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /^SOURCE_MANIFEST_FAIL /u);
});
