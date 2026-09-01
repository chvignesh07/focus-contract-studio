import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  parseStrictJson,
  validateLocalGate,
  validatePackage5Execution,
  validatePackage5Review,
  validatePackage5Verification,
  verifyPackage5EvidenceBinding,
} from '../../scripts/package5-evidence-binding.mjs';
import { buildPackage5LocalGate } from '../../scripts/package5-local-gate.mjs';
import {
  PACKAGE5_SOURCE_PATHS,
  buildPackage5SourceManifest,
  verifyPackage5SourceManifest,
} from '../../scripts/package5-source-manifest.mjs';

const repositoryRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

test('Package 5 source inventory is exact, unique, regular, and hash-bound', () => {
  assert.deepEqual(PACKAGE5_SOURCE_PATHS, [...PACKAGE5_SOURCE_PATHS].toSorted());
  assert.equal(new Set(PACKAGE5_SOURCE_PATHS).size, PACKAGE5_SOURCE_PATHS.length);
  const manifest = buildPackage5SourceManifest(repositoryRoot);
  assert.equal(manifest.file_count, PACKAGE5_SOURCE_PATHS.length);
  assert.match(manifest.aggregate_sha256, /^[0-9a-f]{64}$/u);
  assert.throws(
    () => verifyPackage5SourceManifest(repositoryRoot, { ...manifest, aggregate_sha256: '0'.repeat(64) }),
    /source manifest mismatch/u,
  );
});

test('source inventory rejects symbolic-link substitution', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fcs-package5-source-'));
  try {
    const first = PACKAGE5_SOURCE_PATHS[0]!;
    mkdirSync(path.dirname(path.join(root, first)), { recursive: true });
    writeFileSync(path.join(root, 'target.ts'), 'export {};\n');
    symlinkSync(path.join(root, 'target.ts'), path.join(root, first));
    assert.throws(() => buildPackage5SourceManifest(root), /symbolic link/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('strict evidence and document validators reject tamper', () => {
  assert.throws(() => parseStrictJson('{"status":"PASS","status":"FAIL"}', 'duplicate.json'), /duplicate/u);
  const source = buildPackage5SourceManifest(repositoryRoot);
  const marker = `<!-- package5-source-binding file_count=${source.file_count} sha256=${source.aggregate_sha256} -->`;
  const review = `${marker}\ncontract/state/D1/security — disposition: PASS\ntests/browser/accessibility/evidence — disposition: PASS\nunresolved critical/high: 0\n`;
  const execution = `${marker}\nFoundational red proof: \`PASS\`\nComplete local gate: \`PASS\`\n`;
  const verification = `${marker}\nStatus: **LOCAL PACKAGE 5 PASS; EXTERNAL NOT RUN**\n| Spec Kit convergence | \`PASS\` |\n| Exact final commit clean clone | \`NOT_RUN\` |\nPackage 6: \`NOT_AUTHORIZED\`\n`;
  validatePackage5Review(review, source);
  validatePackage5Execution(execution, source);
  validatePackage5Verification(verification, source);
  assert.throws(() => validatePackage5Review(review.replace('critical/high: 0', 'critical/high: 1'), source));
  assert.throws(() => validatePackage5Verification(verification.replace('convergence | `PASS`', 'convergence | `FAIL`'), source));
});

test('the post-core local gate artifact is deterministic, source-bound, and tamper-closed', () => {
  const source = buildPackage5SourceManifest(repositoryRoot);
  const gate = buildPackage5LocalGate(repositoryRoot);
  validateLocalGate(gate, source);
  assert.equal(gate.tests.passed, gate.tests.total);
  assert.throws(() => validateLocalGate({ ...gate, status: 'FAIL' }, source), /status drift/u);
  assert.throws(() => validateLocalGate({
    ...gate,
    source: { ...gate.source, aggregate_sha256: '0'.repeat(64) },
  }, source), /source drift/u);
});

test('the complete Package 5 evidence union binds current source and exact artifacts', () => {
  const result = verifyPackage5EvidenceBinding(repositoryRoot);
  assert.equal(result.source.file_count, PACKAGE5_SOURCE_PATHS.length);
  assert.equal(Object.keys(result.evidence_sha256).length, 5);
  assert.equal(readFileSync('.artifacts/test/package5-source-manifest.json', 'utf8').endsWith('\n'), true);
});
