import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  validatePackage8Checkpoint,
  validateLiveGitleaksReceipt,
  validatePackage8LocalGate,
  validatePackage8Reviews,
  verifyPackage8EvidenceBinding,
} from '../../scripts/package8-evidence-binding.mjs';
import { buildPackage8LocalGate } from '../../scripts/package8-local-gate.mjs';
import {
  PACKAGE8_SOURCE_PATHS,
  buildPackage8SourceManifest,
  parsePackage8SourceManifest,
  verifyPackage8SourceManifest,
} from '../../scripts/package8-source-manifest.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const package7Commit = '0b616fc5f790da11eb44bb03930ee181d976a452';
const evidenceOutputs = new Set([
  '.artifacts/security/gitleaks-history.json',
  '.artifacts/security/gitleaks-worktree.json',
  '.artifacts/security/package8-dependency-license.json',
  '.artifacts/security/release-security.json',
  '.artifacts/test/clean-clone.json',
  '.artifacts/test/memory-counterfactual.json',
  '.artifacts/test/package8-clean-d1.json',
  '.artifacts/test/package8-local-gate.json',
  '.artifacts/test/package8-source-manifest.json',
  'docs/evidence/PACKAGE8_CHECKPOINT.md',
  'docs/evidence/PACKAGE8_REVIEWS.md',
]);

function gitLines(args: string[]): string[] {
  return execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);
}

test('Package 8 source inventory is exact, unique, regular, and covers the full Package 8 diff', () => {
  assert.equal(new Set(PACKAGE8_SOURCE_PATHS).size, PACKAGE8_SOURCE_PATHS.length);
  const changed = new Set([
    ...gitLines(['diff', '--name-only', package7Commit, '--']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ]);
  const expectedSource = [...changed].filter((value) => !evidenceOutputs.has(value)).sort();
  assert.deepEqual([...PACKAGE8_SOURCE_PATHS].sort(), expectedSource);
  const manifest = buildPackage8SourceManifest(repositoryRoot);
  assert.equal(manifest.file_count, PACKAGE8_SOURCE_PATHS.length);
  assert.equal(manifest.files.every(({ bytes, sha256 }) => bytes > 0 && sha256.length === 64), true);
  assert.deepEqual(verifyPackage8SourceManifest(repositoryRoot, manifest), manifest);
  assert.throws(
    () => parsePackage8SourceManifest(
      JSON.stringify({ package: 8 }).replace('{', '{"\\u0070ackage":8,'),
    ),
    /duplicate JSON key/u,
  );
  assert.throws(
    () => verifyPackage8SourceManifest(repositoryRoot, { ...manifest, file_count: 0 }),
    /Package 8 source manifest mismatch/u,
  );
});

test('Package 8 gate, two-review boundary, and evidence are source-bound without claiming Review 1', () => {
  const source = buildPackage8SourceManifest(repositoryRoot);
  const gate = buildPackage8LocalGate(repositoryRoot);
  validatePackage8LocalGate(gate, source);
  const marker = `<!-- package8-source-binding file_count=${source.file_count} sha256=${source.aggregate_sha256} -->`;
  validatePackage8Checkpoint(`${marker}\nStatus: **LOCAL INTEGRITY PASS; PACKAGE 8 BLOCKED**\n` +
    'Canonical command: `npm run verify`\nExactly four WebMCP tools: `PASS`\n' +
    'Security/admission/state review — disposition: PASS\n' +
    'CI/evidence/privacy/accessibility/claim review — disposition: PASS\n' +
    'unresolved critical/high/material/license: 0\n' +
    'Exact final commit clean clone: `TERMINAL_POST_COMMIT`\n' +
    'Adversarial review 1 (`E-018`): `NOT_RUN`\nPackage 0 overall result: `INCONCLUSIVE`\n' +
    'Actual Sites edge client isolation: `NOT_RUN` — release blocker\n' +
    'External exit evidence: `NOT_RUN`\n', source);
  validatePackage8Reviews(`${marker}\n` +
    'Security/admission/state review — disposition: PASS\n' +
    'CI/evidence/privacy/accessibility/claim review — disposition: PASS\n' +
    'unresolved critical/high/material: 0\nThis is not adversarial Review 1 (`E-018`)\n', source);
  const result = verifyPackage8EvidenceBinding(repositoryRoot);
  assert.equal(result.source.aggregate_sha256, source.aggregate_sha256);
  const liveReceipt = JSON.parse(readFileSync(
    path.join(repositoryRoot, '.artifacts/runtime/package8-gitleaks-live.json'),
    'utf8',
  ));
  assert.throws(
    () => validateLiveGitleaksReceipt(repositoryRoot, {
      ...liveReceipt,
      scans: {
        ...liveReceipt.scans,
        reachable_history: { ...liveReceipt.scans.reachable_history, scope: 'HEAD only' },
      },
    }),
    /reachable_history scope or result drift/u,
  );
  assert.throws(
    () => validateLiveGitleaksReceipt(repositoryRoot, {
      ...liveReceipt,
      scans: {
        ...liveReceipt.scans,
        current_tree: { ...liveReceipt.scans.current_tree, content_sha256: '0'.repeat(64) },
      },
    }),
    /current-tree content binding drift/u,
  );
  assert.throws(
    () => validateLiveGitleaksReceipt(repositoryRoot, {
      ...liveReceipt,
      policy: { ...liveReceipt.policy, environment_config_scrubbed: false },
    }),
    /policy binding drift/u,
  );
  assert.throws(
    () => validateLiveGitleaksReceipt(repositoryRoot, {
      ...liveReceipt,
      head_commit: '0'.repeat(40),
    }),
    /commit or worktree binding drift/u,
  );
});
