import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  parseStrictJson,
  validateLocalGate,
  validatePackage6Execution,
  validatePackage6RedToGreen,
  validatePackage6Review,
  validatePackage6Verification,
  verifyPackage6EvidenceBinding,
} from '../../scripts/package6-evidence-binding.mjs';
import { buildPackage6LocalGate } from '../../scripts/package6-local-gate.mjs';
import {
  PACKAGE6_SOURCE_PATHS,
  buildPackage6SourceManifest,
  verifyPackage6SourceManifest,
} from '../../scripts/package6-source-manifest.mjs';

const repositoryRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

test('Package 6 source inventory is exact, unique, regular, and hash-bound', () => {
  assert.deepEqual(PACKAGE6_SOURCE_PATHS, [...PACKAGE6_SOURCE_PATHS].toSorted());
  assert.equal(new Set(PACKAGE6_SOURCE_PATHS).size, PACKAGE6_SOURCE_PATHS.length);
  const manifest = buildPackage6SourceManifest(repositoryRoot);
  assert.equal(manifest.file_count, PACKAGE6_SOURCE_PATHS.length);
  assert.match(manifest.aggregate_sha256, /^[0-9a-f]{64}$/u);
  assert.throws(
    () => verifyPackage6SourceManifest(repositoryRoot, { ...manifest, aggregate_sha256: '0'.repeat(64) }),
    /source manifest mismatch/u,
  );
});

test('Package 6 source inventory rejects symbolic-link substitution', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fcs-package6-source-'));
  try {
    const first = PACKAGE6_SOURCE_PATHS[0]!;
    mkdirSync(path.dirname(path.join(root, first)), { recursive: true });
    writeFileSync(path.join(root, 'target.ts'), 'export {};\n');
    symlinkSync(path.join(root, 'target.ts'), path.join(root, first));
    assert.throws(() => buildPackage6SourceManifest(root), /symbolic link/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('strict Package 6 evidence validators reject status, review, and source tamper', () => {
  assert.throws(() => parseStrictJson('{"status":"PASS","status":"FAIL"}', 'duplicate.json'), /duplicate/u);
  const source = buildPackage6SourceManifest(repositoryRoot);
  const marker = `<!-- package6-source-binding file_count=${source.file_count} sha256=${source.aggregate_sha256} -->`;
  const review = `${marker}\nproduct/design/cold-comprehension/accessibility — disposition: PASS\nregression/security/privacy/tests/evidence — disposition: PASS\nunresolved critical/high/material: 0\n`;
  const execution = `${marker}\nFoundational red proof: \`PASS\`\nComplete local gate: \`PASS\`\nPackage 6 core total: \`382/382\`\n`;
  const verification = `${marker}\nStatus: **LOCAL PACKAGE 6 PASS; EXTERNAL NOT RUN**\n| Spec Kit convergence | \`PASS\` |\n| Exact final commit clean clone | \`NOT_RUN\` |\n| Cold screenshot evaluator | \`PASS\` |\nPackage 7: \`NOT_AUTHORIZED\`\n\`read_active_focus_review\` and \`create_focus_contract_proposal\`\n`;
  const red = 'RED · 0 pass / 1 fail\nRED · 0 tests / 1 failed suite\nRED · 0 pass / 2 fail\nStatus: `PASS`\nPackage 6 built browser | `4/4`\n';
  validatePackage6Review(review, source);
  validatePackage6Execution(execution, source);
  validatePackage6Verification(verification, source);
  validatePackage6RedToGreen(red);
  assert.throws(() => validatePackage6Review(review.replace('material: 0', 'material: 1'), source));
  assert.throws(() => validatePackage6Execution(execution.replace('382/382', '381/382'), source));
  assert.throws(() => validatePackage6Verification(verification.replace('Package 7: `NOT_AUTHORIZED`', 'Package 7: `PASS`'), source));
});

test('the post-core Package 6 gate is deterministic, source-bound, and tamper-closed', () => {
  const source = buildPackage6SourceManifest(repositoryRoot);
  const gate = buildPackage6LocalGate(repositoryRoot);
  validateLocalGate(gate, source);
  assert.equal(gate.tests.passed, 382);
  assert.equal(gate.tests.passed, gate.tests.total);
  assert.throws(() => validateLocalGate({ ...gate, status: 'FAIL' }, source), /status drift/u);
  assert.throws(() => validateLocalGate({
    ...gate,
    source: { ...gate.source, aggregate_sha256: '0'.repeat(64) },
  }, source), /source drift/u);
});

test('the complete Package 6 evidence union binds current source and exact artifacts', () => {
  const result = verifyPackage6EvidenceBinding(repositoryRoot);
  assert.equal(result.source.file_count, PACKAGE6_SOURCE_PATHS.length);
  assert.equal(Object.keys(result.evidence_sha256).length, 11);
});
