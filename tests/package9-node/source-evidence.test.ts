import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const package9Base = '825f7ee012d0ab7c59f95ca62581ad5b5e5c28b2';
const evidencePath = 'docs/evidence/ADVERSARIAL_REVIEW_1.md';
const sourcePaths = [
  'drizzle/0001_package1_domain.sql',
  'drizzle/0002_package2_vertical_slice.sql',
  'drizzle/0003_package3_raw_observer_verifier.sql',
  'drizzle/0004_package5_review_apply_undo.sql',
  'drizzle/0005_package8_admission_lineage.sql',
  'drizzle/0006_package8_atomic_admission.sql',
  'drizzle/meta/_journal.json',
  'package.json',
  'tests/package9-node/sites-migration-packaging.test.ts',
  'tests/package9-node/source-evidence.test.ts',
  'tests/package9/migration-packaging.test.ts',
  'vitest.package9.config.ts',
] as const;

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function git(args: string[]) {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
}

function gitLines(args: string[]) {
  return git(args).trim().split('\n').filter(Boolean);
}

function sourceIdentity() {
  const files = sourcePaths.map((relativePath) => {
    const absolutePath = path.join(repositoryRoot, relativePath);
    const stat = lstatSync(absolutePath);
    assert.equal(stat.isFile() && !stat.isSymbolicLink(), true, relativePath);
    const bytes = readFileSync(absolutePath);
    return {
      path: relativePath,
      bytes: bytes.length,
      sha256: sha256(bytes),
    };
  });

  return {
    fileCount: files.length,
    sha256: sha256(
      files
        .map((file) => `${file.sha256}  ${file.bytes}  ${file.path}\n`)
        .join(''),
    ),
  };
}

test('the Package 9 migration hotfix and local evidence are exactly source-bound', () => {
  const changedPaths = new Set([
    ...gitLines(['diff', '--name-only', package9Base, '--']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ]);
  assert.deepEqual(
    [...changedPaths].sort(),
    [...sourcePaths, evidencePath].sort(),
  );

  const priorEvidence = git(['show', `${package9Base}:${evidencePath}`]);
  const evidence = readFileSync(path.join(repositoryRoot, evidencePath), 'utf8');
  assert.ok(
    evidence.startsWith(priorEvidence),
    'the frozen pre-hotfix evidence must remain byte-identical',
  );

  const identity = sourceIdentity();
  assert.match(
    evidence,
    new RegExp(
      `<!-- package9-migration-source-binding files=${identity.fileCount} sha256=${identity.sha256} -->`,
      'u',
    ),
  );
  for (const claim of [
    'Focused RED: `1/4 PASS`, `3/4 FAIL`',
    'Focused GREEN: `5/5 PASS`',
    'Clean D1: `6/6 PASS`, repeated application `PASS`',
    'Archive identity: `PASS`',
    'Correctness reviewer `/root/migration_correctness_review`: `PASS`',
    'Security/data-integrity reviewer `/root/migration_security_review`: `PASS`',
    'Hosted D1: `NOT_RUN`',
    'Final clean-commit canonical: `TERMINAL_POST_COMMIT`',
  ]) {
    assert.ok(evidence.includes(claim), `missing Package 9 evidence: ${claim}`);
  }
});

test('the Package 9 canonical gate preserves frozen Package 8 configuration and adds its own binding', () => {
  const priorPackage = JSON.parse(
    git(['show', `${package9Base}:package.json`]),
  ) as { scripts: Record<string, string> };
  const currentPackage = JSON.parse(
    readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'),
  ) as { scripts: Record<string, string> };
  const normalizedPackage = structuredClone(currentPackage);

  for (const script of [
    'test:package9:node',
    'test:package9:d1',
    'test:package9:migration-packaging',
    'verify:package9:binding',
    'verify:package9',
  ]) {
    delete normalizedPackage.scripts[script];
  }
  normalizedPackage.scripts.verify = priorPackage.scripts.verify!;
  assert.deepEqual(normalizedPackage, priorPackage);
  assert.equal(
    currentPackage.scripts['verify:package9:binding'],
    'node --experimental-strip-types --test tests/package9-node/source-evidence.test.ts',
  );
  assert.equal(
    currentPackage.scripts['verify:package9'],
    'npm run verify:package8:core && npm run test:package9:d1 && npm run test:package9:node && npm run verify:review1:disposition && npm run verify:package9:binding',
  );
  assert.equal(currentPackage.scripts.verify, 'npm run verify:package9');
});
