import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  GITLEAKS_COMMAND_IDENTITIES,
  assertSafeRelativePath,
  buildCurrentTreeIdentity,
  buildDependencyInventory,
  buildThirdPartyNotices,
  gitleaksEnvironment,
  scanBytes,
  scanTrackedSource,
  validateBuildInputs,
  validateCiWorkflow,
  runLiveGitleaks,
  runPackage8ReleaseChecks,
} from '../../scripts/package8-release-checks.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const buildInputsSource = readFileSync(
  path.join(repositoryRoot, 'release/BUILD_INPUTS.json'),
  'utf8',
);

function createGitleaksTestRepository() {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'fcs-package8-gitleaks-repository-'));
  execFileSync('git', ['init', '--quiet'], { cwd: temporaryRoot });
  for (const relativePath of ['.gitignore', '.gitleaks.toml', '.gitleaksignore.package8']) {
    writeFileSync(
      path.join(temporaryRoot, relativePath),
      readFileSync(path.join(repositoryRoot, relativePath)),
    );
  }
  writeFileSync(path.join(temporaryRoot, 'source.txt'), 'public synthetic data\n');
  execFileSync('git', ['add', '.'], { cwd: temporaryRoot });
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Package 8 Test',
      '-c',
      'user.email=package8-test@example.invalid',
      'commit',
      '--quiet',
      '-m',
      'test fixture',
    ],
    { cwd: temporaryRoot },
  );
  return temporaryRoot;
}

test('build inputs use strict duplicate-aware JSON and exact pre-live identities', () => {
  const valid = validateBuildInputs(repositoryRoot, buildInputsSource);
  const missing = JSON.parse(buildInputsSource);
  delete missing.buildCommand;
  assert.equal(valid.schemaVersion, 'fcs-build-inputs-v1');
  assert.equal(valid.gitTag, 'webmcp-challenge-2026-final');
  assert.equal('gitCommit' in valid, false);
  assert.equal('sitesVersionId' in valid, false);
  assert.throws(() => validateBuildInputs(repositoryRoot, '{'), /invalid JSON/u);
  assert.throws(
    () => validateBuildInputs(
      repositoryRoot,
      buildInputsSource.replace('"product":', '"\\u0070roduct":').replace(
        '"release":',
        '"product": "Focus Contract Studio",\n  "release":',
      ),
    ),
    /duplicate JSON key/u,
  );
  assert.throws(
    () => validateBuildInputs(repositoryRoot, `${JSON.stringify(missing)}\n`),
    /keys drift/u,
  );
  assert.throws(
    () => validateBuildInputs(repositoryRoot, buildInputsSource.replace(
      '"product": "Focus Contract Studio",',
      '"product": "Focus Contract Studio",\n  "gitCommit": "forbidden",',
    )),
    /keys drift/u,
  );
  assert.throws(
    () => validateBuildInputs(repositoryRoot, buildInputsSource.replace('v22.22.3', 'v22.22.2')),
    /runtime identity drift/u,
  );
  assert.throws(
    () => validateBuildInputs(repositoryRoot, buildInputsSource.replace('npm run verify', 'npm test')),
    /semantic or runtime identity drift/u,
  );
});

test('release paths reject encoded traversal, absolute paths, backslashes, and malformed escapes', () => {
  assert.equal(assertSafeRelativePath('docs/evidence/file.json'), 'docs/evidence/file.json');
  for (const hostile of ['../secret', '%2e%2e/secret', '/absolute', 'docs\\secret', '%E0%A4%A']) {
    assert.throws(() => assertSafeRelativePath(hostile), /unsafe|malformed/u, hostile);
  }
});

test('dependency inventory is deterministic and notices retain reviewed obligations', () => {
  const first = buildDependencyInventory(repositoryRoot);
  const second = buildDependencyInventory(repositoryRoot);
  assert.deepEqual(first, second);
  assert.equal(first.status, 'PASS');
  assert.equal(first.package_count, 724);
  assert.equal(first.unresolved_findings.length, 0);
  assert.ok(first.reviewed_obligation_package_count > 0);
  const notices = buildThirdPartyNotices(first);
  assert.match(notices, /Known LGPL, MPL, CC-BY, and Python-license entries/u);
  assert.match(notices, /`@axe-core\/playwright`/u);
});

test('secret scanner detects credential-shaped values and machine-local paths', () => {
  const fakeToken = `sk-${'x'.repeat(40)}`;
  assert.deepEqual(scanBytes('safe.txt', Buffer.from('public synthetic data')), []);
  assert.deepEqual(scanBytes('secret.txt', Buffer.from(fakeToken)), [
    { path: 'secret.txt', kind: 'openai-token' },
  ]);
  assert.deepEqual(scanBytes('path.txt', Buffer.from(['/Us', 'ers/name/private'].join(''))), [
    { path: 'path.txt', kind: 'machine-path' },
  ]);
});

test('tracked symlinks fail closed instead of being scanned through', () => {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'fcs-package8-symlink-test-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: temporaryRoot });
    writeFileSync(path.join(temporaryRoot, 'target.txt'), 'safe\n');
    symlinkSync(path.join(temporaryRoot, 'target.txt'), path.join(temporaryRoot, 'linked.txt'));
    execFileSync('git', ['add', 'linked.txt'], { cwd: temporaryRoot });
    assert.throws(() => scanTrackedSource(temporaryRoot), /tracked symlink/u);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('CI validator rejects mutable actions and missing pinned setup steps', () => {
  const workflow = readFileSync(path.join(repositoryRoot, '.github/workflows/verify.yml'), 'utf8');
  validateCiWorkflow(workflow);
  assert.throws(() => validateCiWorkflow(workflow.replace(/actions\/checkout@[0-9a-f]+/u, 'actions/checkout@v7')), /unpinned|missing/u);
  assert.throws(() => validateCiWorkflow(workflow.replace('run: npm run setup:browsers', 'run: true')), /setup:browsers/u);
  assert.throws(
    () => validateCiWorkflow(workflow.replace('GITLEAKS_VERSION: "8.30.1"', 'GITLEAKS_VERSION: "latest"')),
    /Gitleaks/u,
  );
  const sanitized = gitleaksEnvironment({
    NODE_ENV: 'test',
    PATH: '/bin',
    GITLEAKS_CONFIG: '/tmp/weakened.toml',
    GITLEAKS_CONFIG_TOML: '[allowlists]\npaths=[".*"]',
  });
  assert.equal(sanitized.GITLEAKS_CONFIG, undefined);
  assert.equal(sanitized.GITLEAKS_CONFIG_TOML, undefined);
  for (const command of Object.values(GITLEAKS_COMMAND_IDENTITIES)) {
    assert.ok(command.some((value) => value.endsWith('/.gitleaks.toml')));
    assert.ok(command.some((value) => value.endsWith('/.gitleaksignore.package8')));
    assert.ok(command.includes('--ignore-gitleaks-allow'));
  }
});

test('current-tree identity changes when already-dirty content changes', () => {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'fcs-package8-tree-identity-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: temporaryRoot });
    const sourcePath = path.join(temporaryRoot, 'source.txt');
    writeFileSync(sourcePath, 'indexed\n');
    execFileSync('git', ['add', 'source.txt'], { cwd: temporaryRoot });
    writeFileSync(sourcePath, 'dirty one\n');
    const firstStatus = execFileSync('git', ['status', '--porcelain=v1'], {
      cwd: temporaryRoot,
      encoding: 'utf8',
    });
    const first = buildCurrentTreeIdentity(temporaryRoot);
    writeFileSync(sourcePath, 'dirty two\n');
    const secondStatus = execFileSync('git', ['status', '--porcelain=v1'], {
      cwd: temporaryRoot,
      encoding: 'utf8',
    });
    const second = buildCurrentTreeIdentity(temporaryRoot);
    assert.equal(secondStatus, firstStatus);
    assert.notEqual(second.aggregate_sha256, first.aggregate_sha256);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('tracked Gitleaks evidence is stable across platform executable hashes', async () => {
  const releaseChecks = await import('../../scripts/package8-release-checks.mjs');
  const buildTrackedGitleaksEvidence = Reflect.get(
    releaseChecks,
    'buildTrackedGitleaksEvidence',
  ) as (receipt: Record<string, unknown>) => Record<string, unknown>;
  assert.equal(typeof buildTrackedGitleaksEvidence, 'function');

  const receipt = {
    version: '8.30.1',
    policy: {
      config_path: '.gitleaks.toml',
      config_sha256: '1'.repeat(64),
      ignore_path: '.gitleaksignore.package8',
      ignore_sha256: '2'.repeat(64),
      environment_config_scrubbed: true,
      inline_allow_comments_ignored: true,
    },
    scans: {
      current_tree: {
        scope: 'exact tracked and non-ignored untracked current-tree snapshot',
        command_sha256: '3'.repeat(64),
        exit_status: 0,
        findings: 0,
      },
      reachable_history: {
        scope: 'git log -p --all',
        command_sha256: '4'.repeat(64),
        exit_status: 0,
        findings: 0,
      },
      planted_negative: {
        command_sha256: '5'.repeat(64),
        exit_status: 1,
        findings: 1,
        rejected: true,
      },
    },
  };
  const macos = buildTrackedGitleaksEvidence({
    ...receipt,
    executable_sha256: 'a'.repeat(64),
  });
  const linux = buildTrackedGitleaksEvidence({
    ...receipt,
    executable_sha256: 'b'.repeat(64),
  });

  assert.deepEqual(macos, linux);
  assert.equal('executable_sha256' in macos, false);
  const trackedArtifact = JSON.parse(readFileSync(
    path.join(repositoryRoot, '.artifacts/security/release-security.json'),
    'utf8',
  ));
  assert.equal('executable_sha256' in trackedArtifact.live_gitleaks, false);
});

test('canonical release checks fail closed when the live Gitleaks executable is unavailable', () => {
  const emptyPath = mkdtempSync(path.join(tmpdir(), 'fcs-package8-empty-path-'));
  const originalPath = process.env.PATH;
  try {
    process.env.PATH = emptyPath;
    assert.throws(
      () => runPackage8ReleaseChecks(repositoryRoot),
      /Gitleaks executable/u,
    );
  } finally {
    process.env.PATH = originalPath;
    rmSync(emptyPath, { recursive: true, force: true });
  }
});

test('live Gitleaks rejects a stale executable version before scanning', () => {
  const fakePath = mkdtempSync(path.join(tmpdir(), 'fcs-package8-fake-gitleaks-'));
  const executable = path.join(fakePath, 'gitleaks');
  const originalPath = process.env.PATH;
  try {
    writeFileSync(executable, '#!/bin/sh\nprintf "8.30.0\\n"\n');
    chmodSync(executable, 0o755);
    process.env.PATH = fakePath;
    assert.throws(
      () => runLiveGitleaks(repositoryRoot),
      /Gitleaks version mismatch; required 8\.30\.1/u,
    );
  } finally {
    process.env.PATH = originalPath;
    rmSync(fakePath, { recursive: true, force: true });
  }
});

test('standalone evidence acquisition scans a missing receipt once and validates runtime before reuse', async () => {
  const evidenceBinding = await import('../../scripts/package8-evidence-binding.mjs');
  const ensureLiveGitleaksReceipt = Reflect.get(
    evidenceBinding,
    'ensureLiveGitleaksReceipt',
  ) as (root: string) => Record<string, unknown>;
  assert.equal(typeof ensureLiveGitleaksReceipt, 'function');

  const temporaryRoot = createGitleaksTestRepository();
  const receiptPath = path.join(
    temporaryRoot,
    '.artifacts/runtime/package8-gitleaks-live.json',
  );
  const emptyPath = mkdtempSync(path.join(tmpdir(), 'fcs-package8-no-gitleaks-'));
  const fakePath = mkdtempSync(path.join(tmpdir(), 'fcs-package8-wrong-gitleaks-'));
  const fakeExecutable = path.join(fakePath, 'gitleaks');
  const originalPath = process.env.PATH;
  try {
    const first = ensureLiveGitleaksReceipt(temporaryRoot);
    assert.equal(first.status, 'PASS');
    assert.equal(existsSync(receiptPath), true);
    const firstMtime = statSync(receiptPath, { bigint: true }).mtimeNs;
    chmodSync(receiptPath, 0o444);
    const second = ensureLiveGitleaksReceipt(temporaryRoot);
    assert.deepEqual(second, first);
    assert.equal(statSync(receiptPath, { bigint: true }).mtimeNs, firstMtime);

    process.env.PATH = emptyPath;
    assert.throws(
      () => ensureLiveGitleaksReceipt(temporaryRoot),
      /Gitleaks executable is unavailable/u,
    );
    writeFileSync(fakeExecutable, '#!/bin/sh\nprintf "8.30.0\\n"\n');
    chmodSync(fakeExecutable, 0o755);
    process.env.PATH = fakePath;
    assert.throws(
      () => ensureLiveGitleaksReceipt(temporaryRoot),
      /Gitleaks version mismatch; required 8\.30\.1/u,
    );
  } finally {
    process.env.PATH = originalPath;
    if (existsSync(receiptPath)) chmodSync(receiptPath, 0o644);
    rmSync(temporaryRoot, { recursive: true, force: true });
    rmSync(emptyPath, { recursive: true, force: true });
    rmSync(fakePath, { recursive: true, force: true });
  }
});

test('live Gitleaks refuses to attest a dirty tracked tree', () => {
  const temporaryRoot = createGitleaksTestRepository();
  try {
    writeFileSync(path.join(temporaryRoot, 'source.txt'), 'dirty tracked content\n');
    assert.throws(
      () => runLiveGitleaks(temporaryRoot),
      /clean worktree/u,
    );
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
