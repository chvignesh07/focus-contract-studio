import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PACKAGE7_SOURCE_PATHS,
  buildPackage7SourceManifest,
  verifyPackage7SourceManifest,
} from '../../scripts/package7-source-manifest.mjs';
import { buildPackage7LocalGate } from '../../scripts/package7-local-gate.mjs';
import {
  validatePackage7Checkpoint,
  validatePackage7LocalGate,
} from '../../scripts/package7-evidence-binding.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('Package 7 source inventory is exact, unique, regular, and self-verifying', () => {
  assert.equal(new Set(PACKAGE7_SOURCE_PATHS).size, PACKAGE7_SOURCE_PATHS.length);
  for (const required of [
    'app/focus-contract-studio.tsx',
    'lib/webmcp/contracts.ts',
    'lib/webmcp/register.ts',
    'lib/server/package5-apply-history-undo.ts',
    'lib/server/verify-focus-contract.ts',
    'tests/package7-node/webmcp-v2-contract.test.ts',
    'tests/package7/webmcp-parity.test.ts',
    'tests/package7-dom/webmcp-v2-integration.test.tsx',
    'tests/package7-browser/webmcp-v2.spec.ts',
  ]) {
    assert.equal(PACKAGE7_SOURCE_PATHS.includes(required), true, required);
  }
  const manifest = buildPackage7SourceManifest(repositoryRoot);
  assert.equal(manifest.file_count, PACKAGE7_SOURCE_PATHS.length);
  assert.equal(manifest.files.every(({ bytes, sha256 }) => bytes > 0 && sha256.length === 64), true);
  assert.deepEqual(verifyPackage7SourceManifest(repositoryRoot, manifest), manifest);
  assert.throws(
    () => verifyPackage7SourceManifest(repositoryRoot, { ...manifest, file_count: 0 }),
    /Package 7 source manifest mismatch/u,
  );
});

test('Package 7 local gate binds a zero-failure total and keeps every external action NOT_RUN', () => {
  const source = buildPackage7SourceManifest(repositoryRoot);
  const gate = buildPackage7LocalGate(repositoryRoot);
  validatePackage7LocalGate(gate, source);
  assert.equal(gate.tests.total, gate.tests.passed);
  assert.equal(gate.tests.failed, 0);
  assert.equal(Object.values(gate.external).every((value) => value === 'NOT_RUN'), true);
});

test('Package 7 checkpoint validator requires exact four-tool, review, clone, and external truth', () => {
  const source = buildPackage7SourceManifest(repositoryRoot);
  const marker = `<!-- package7-source-binding file_count=${source.file_count} sha256=${source.aggregate_sha256} -->`;
  const checkpoint = `${marker}\nStatus: **LOCAL PACKAGE 7 PASS; EXTERNAL NOT RUN**\n` +
    'Exact tools: `read_active_focus_review`, `create_focus_contract_proposal`, ' +
    '`apply_approved_focus_contract`, `verify_focus_contract`; fifth tool: `ABSENT`.\n' +
    'WebMCP contract/state/security review — disposition: PASS\n' +
    'tests/accessibility/human-fallback/submission-truth review — disposition: PASS\n' +
    'unresolved critical/high/material: 0\n' +
    'Exact final commit clean clone: `TERMINAL_POST_COMMIT`\n' +
    'External exit evidence: `NOT_RUN`\n';
  validatePackage7Checkpoint(checkpoint, source);
  assert.throws(
    () => validatePackage7Checkpoint(checkpoint.replace('fifth tool: `ABSENT`', 'fifth tool: `PRESENT`'), source),
    /fifth tool/u,
  );
});
