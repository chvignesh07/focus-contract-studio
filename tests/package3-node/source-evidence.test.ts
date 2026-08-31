import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  EVIDENCE_CONTRACTS,
  assertSafeEvidenceText,
  currentRuntimeIdentity,
  parseStrictJson,
  validateReviewMarkdown,
  validateEvidenceArtifact,
  verifyPackage3EvidenceBinding,
} from '../../scripts/package3-evidence-binding.mjs';
import {
  PACKAGE3_EVIDENCE_PATHS,
  PACKAGE3_SOURCE_PATHS,
  assertPackage3Authority,
  buildPackage3SourceManifest,
  verifyPackage3SourceManifest,
} from '../../scripts/package3-source-manifest.mjs';

const repositoryRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../..',
);

const expectedEvidencePaths = [
  '.artifacts/accessibility/axe.json',
  '.artifacts/browser/playwright.json',
  '.artifacts/test/component.json',
  '.artifacts/test/coverage-summary.json',
  '.artifacts/test/d1.json',
  '.artifacts/test/unit.json',
  '.artifacts/test/verifier-independence.json',
  'docs/evidence/PACKAGE3_ADVERSARIAL_REVIEW.md',
  'docs/evidence/PACKAGE3_VERIFICATION.md',
] as const;

const expectedSourcePaths = [
  'app/api/rehearsals/[rehearsalSessionId]/finalize/route.ts',
  'app/api/rehearsals/start/route.ts',
  'app/api/verifications/route.ts',
  'app/delete-account-dialog.tsx',
  'app/focus-contract-studio.tsx',
  'app/globals.css',
  'db/package3-schema.ts',
  'db/schema.ts',
  'drizzle/0003_package3_raw_observer_verifier.sql',
  'drizzle/meta/_journal.json',
  'lib/domain/focus-event-verifier.ts',
  'lib/domain/focus-rehearsal.ts',
  'lib/server/focus-rehearsal.ts',
  'lib/server/verify-focus-contract.ts',
  'package.json',
  'playwright.config.ts',
  'scripts/package3-evidence-binding.mjs',
  'scripts/package3-source-manifest.mjs',
  'specs/001-package-3-raw-observer-verifier/tasks.md',
  'tests/package0/publication-safety.test.ts',
  'tests/package1/migrations.test.ts',
  'tests/package2/migration-seed.test.ts',
  'tests/package3-browser/rehearsal.spec.ts',
  'tests/package3-dom/focus-contract-studio.test.tsx',
  'tests/package3-node/contracts.test.ts',
  'tests/package3-node/focus-event-verifier.test.ts',
  'tests/package3-node/privacy-scan.test.ts',
  'tests/package3-node/reference-boundary.test.ts',
  'tests/package3-node/source-evidence.test.ts',
  'tests/package3/d1-vitest-setup.ts',
  'tests/package3/focus-rehearsal.test.ts',
  'tests/package3/routes.test.ts',
  'tests/package3/verification-persistence.test.ts',
  'vitest.package1.config.ts',
  'vitest.package2.config.ts',
  'vitest.package3-dom.config.ts',
  'vitest.package3-node.config.ts',
  'vitest.package3.config.ts',
  'wrangler.package3.jsonc',
] as const;

test('Package 3 source inventory is the exact task union plus authorized Gate 5 repairs', () => {
  assert.deepEqual(PACKAGE3_SOURCE_PATHS, expectedSourcePaths);
  assert.deepEqual(PACKAGE3_EVIDENCE_PATHS, expectedEvidencePaths);
  const manifest = buildPackage3SourceManifest(repositoryRoot);
  assert.equal(manifest.file_count, expectedSourcePaths.length);
  assert.deepEqual(
    manifest.files.map(({ path: relativePath }) => relativePath),
    expectedSourcePaths,
  );
  assert.match(manifest.aggregate_sha256, /^[0-9a-f]{64}$/u);
});

test('Prompt C authority remains frozen except task checkbox completion', () => {
  const result = assertPackage3Authority(repositoryRoot);
  assert.equal(result.prompt_c_artifacts_checked, 14);
  assert.equal(result.task_count, 46);
  assert.equal(result.completed_task_count, 46);
  assert.match(result.prompt_c_manifest_sha256, /^[0-9a-f]{64}$/u);
});

test('Package 3 evidence uses only the strict registered status vocabulary', () => {
  for (const relativePath of expectedEvidencePaths) {
    const source = readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
    assert.doesNotMatch(source, /\b(?:SUCCESS|PASSED|COMPLETE)\b/u, relativePath);
    for (const match of source.matchAll(/\b(?:PASS|FAIL|INCONCLUSIVE|NOT_RUN|NOT_APPLICABLE)\b/gu)) {
      assert.ok(match[0]);
    }
  }
});

function validEvidence(relativePath: keyof typeof EVIDENCE_CONTRACTS) {
  const contract = EVIDENCE_CONTRACTS[relativePath];
  const source = buildPackage3SourceManifest(repositoryRoot);
  return {
    schema_version: 'fcs-package3-evidence-v1',
    evidence_id: contract.evidence_id,
    package: 3,
    scope: contract.scope,
    status: 'PASS',
    source: {
      algorithm: 'sha256',
      file_count: source.file_count,
      aggregate_sha256: source.aggregate_sha256,
    },
    command: contract.command,
    started_at_utc: '2026-08-31T16:00:00Z',
    completed_at_utc: '2026-08-31T16:01:00Z',
    exit_code: 0,
    runtime: currentRuntimeIdentity(repositoryRoot, relativePath),
    tests: {
      passed: contract.test_total,
      failed: 0,
      total: contract.test_total,
    },
    assertions: contract.assertions,
    remote_bindings: false,
    hosted_status: 'NOT_RUN',
    manual_status: 'NOT_RUN',
  };
}

test('source manifest rejects byte tamper and symbolic-link substitution', () => {
  const manifest = buildPackage3SourceManifest(repositoryRoot);
  assert.throws(
    () => verifyPackage3SourceManifest(repositoryRoot, {
      ...manifest,
      aggregate_sha256: '0'.repeat(64),
    }),
    /source manifest mismatch/u,
  );

  const fixture = mkdtempSync(path.join(tmpdir(), 'fcs-package3-source-negative-'));
  try {
    const first = expectedSourcePaths[0];
    mkdirSync(path.dirname(path.join(fixture, first)), { recursive: true });
    writeFileSync(path.join(fixture, 'target.ts'), 'export {};\n');
    symlinkSync(path.join(fixture, 'target.ts'), path.join(fixture, first));
    assert.throws(() => buildPackage3SourceManifest(fixture), /symbolic link/u);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('evidence validation rejects status, command, runtime, source, and false-pass drift', () => {
  const relativePath = '.artifacts/test/unit.json';
  const valid = validEvidence(relativePath);
  validateEvidenceArtifact(repositoryRoot, relativePath, valid);
  for (const [label, mutate] of [
    ['status', (value: typeof valid) => ({ ...value, status: 'SUCCESS' })],
    ['command', (value: typeof valid) => ({ ...value, command: 'node mock-runner.mjs' })],
    ['runtime', (value: typeof valid) => ({ ...value, runtime: { ...value.runtime, node: 'v0.0.0' } })],
    ['source', (value: typeof valid) => ({ ...value, source: { ...value.source, aggregate_sha256: '0'.repeat(64) } })],
    ['exit', (value: typeof valid) => ({ ...value, exit_code: 1 })],
    ['tests', (value: typeof valid) => ({ ...value, tests: { ...value.tests, passed: value.tests.total - 1, failed: 1 } })],
  ] as const) {
    assert.throws(
      () => validateEvidenceArtifact(repositoryRoot, relativePath, mutate(valid) as never),
      label,
    );
  }
});

test('strict evidence JSON rejects ordinary and decoded duplicate keys', () => {
  assert.throws(() => parseStrictJson('{"status":"PASS","status":"FAIL"}', 'ordinary.json'), /duplicate/u);
  assert.throws(() => parseStrictJson('{"status":"PASS","stat\\u0075s":"FAIL"}', 'unicode.json'), /duplicate/u);
});

test('evidence hygiene rejects machine paths, secrets, private payload labels, and placeholders', () => {
  for (const source of [
    ['', 'Users', 'example', 'repository'].join('/'),
    ['', 'private', 'tmp', 'report.json'].join('/'),
    ['file:', '', 'workspace', 'report.json'].join('/'),
    ['-----BEGIN', 'PRIVATE KEY-----'].join(' '),
    ['x-fcs', 'csrf: value'].join('-'),
    ['raw', 'event payload'].join(' '),
    ['TO', 'DO replace proof'].join(''),
  ]) {
    assert.throws(() => assertSafeEvidenceText('negative.json', source), source);
  }
});

test('complete evidence binding accepts only the exact truthful artifact union', () => {
  const result = verifyPackage3EvidenceBinding(repositoryRoot);
  assert.deepEqual(
    Object.keys(result.artifact_sha256).sort(),
    [...expectedEvidencePaths].sort(),
  );
});

test('Gate 6 evidence binds convergence, the exact final clone, and narrow publication scope', () => {
  const verification = readFileSync(
    path.join(repositoryRoot, 'docs/evidence/PACKAGE3_VERIFICATION.md'),
    'utf8',
  );
  assert.match(verification, /\| Gate 6 convergence \| `PASS` \|/u);
  assert.match(verification, /\| Exact final commit clean clone \| `PASS` \|/u);
  assert.ok(
    verification.includes(
      'Publication safety covers the sanitized candidate tracked tree and HEAD-reachable lineage only; unrelated local branches are outside this claim.',
    ),
  );
});

test('review gate rejects absent review, unresolved critical/high, and missing requirements', () => {
  const source = buildPackage3SourceManifest(repositoryRoot);
  const review = readFileSync(
    path.join(repositoryRoot, 'docs/evidence/PACKAGE3_ADVERSARIAL_REVIEW.md'),
    'utf8',
  );
  validateReviewMarkdown(review, source);

  for (const [label, altered] of [
    ['critical/high', review.replace('unresolved critical/high: 0', 'unresolved critical/high: 1')],
    ['requirements', review.replace('controlling requirements: 62/62', 'controlling requirements: 61/62')],
  ]) {
    assert.throws(() => validateReviewMarkdown(altered, source), label);
  }
});
