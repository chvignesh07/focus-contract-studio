import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  PACKAGE3_EVIDENCE_PATHS,
  PACKAGE3_SOURCE_PATHS,
} from '../../scripts/package3-source-manifest.mjs';

import {
  parseStrictJson,
  validatePackage4D1Artifact,
  validatePackage4Review,
  validatePackage4Verification,
  verifyPackage4EvidenceBinding,
} from '../../scripts/package4-evidence-binding.mjs';
import {
  PACKAGE4_SOURCE_PATHS,
  buildPackage4SourceManifest,
  verifyPackage4SourceManifest,
} from '../../scripts/package4-source-manifest.mjs';

const repositoryRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const package3Commit = '98c8f0755cbde0fa1ea545962a2c825f67689168';

function git(args: string[]) {
  const result = spawnSync('git', ['-C', repositoryRoot, ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout;
}

test('Package 3 implementation and evidence remain frozen while Package 4 scripts are additive', () => {
  const paths = [...PACKAGE3_SOURCE_PATHS, ...PACKAGE3_EVIDENCE_PATHS];
  const changed = git(['diff', '--name-only', package3Commit, '--', ...paths]).trim().split('\n').filter(Boolean);
  assert.deepEqual(changed, ['package.json']);

  const before = JSON.parse(git(['show', `${package3Commit}:package.json`])) as { scripts: Record<string, string> };
  const current = JSON.parse(readFile('package.json')) as { scripts: Record<string, string> };
  for (const [name, command] of Object.entries(before.scripts)) {
    assert.equal(current.scripts[name], command, `inherited script drift: ${name}`);
  }
});

test('Package 4 source inventory is exact, regular, and hash-bound', () => {
  assert.equal(PACKAGE4_SOURCE_PATHS.length, 28);
  const manifest = buildPackage4SourceManifest(repositoryRoot);
  assert.equal(manifest.file_count, 28);
  assert.match(manifest.aggregate_sha256, /^[0-9a-f]{64}$/u);
  assert.deepEqual(manifest.files.map(({ path: relativePath }) => relativePath), PACKAGE4_SOURCE_PATHS);
  assert.throws(
    () => verifyPackage4SourceManifest(repositoryRoot, { ...manifest, aggregate_sha256: '0'.repeat(64) }),
    /source manifest mismatch/u,
  );
});

test('source inventory rejects symbolic-link substitution', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fcs-package4-source-'));
  try {
    const first = PACKAGE4_SOURCE_PATHS[0]!;
    mkdirSync(path.dirname(path.join(root, first)), { recursive: true });
    writeFileSync(path.join(root, 'target.json'), '{}\n');
    symlinkSync(path.join(root, 'target.json'), path.join(root, first));
    assert.throws(() => buildPackage4SourceManifest(root), /symbolic link/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('strict evidence JSON rejects ordinary and decoded duplicate keys', () => {
  assert.throws(() => parseStrictJson('{"status":"PASS","status":"FAIL"}', 'ordinary.json'), /duplicate/u);
  assert.throws(() => parseStrictJson('{"status":"PASS","stat\\u0075s":"FAIL"}', 'unicode.json'), /duplicate/u);
});

test('D1 evidence rejects false PASS, SQL, plan, and test-count tamper', () => {
  const valid = parseStrictJson(
    readFile('.artifacts/test/package4-d1.json'),
    '.artifacts/test/package4-d1.json',
  );
  validatePackage4D1Artifact(repositoryRoot, valid);
  for (const altered of [
    { ...valid, status: 'FAIL' },
    { ...valid, sql_sha256: '0'.repeat(64) },
    { ...valid, tests: { passed: 4, failed: 1, total: 5 } },
    { ...valid, query_plan: { ...valid.query_plan, production_table_scans: 1 } },
  ]) {
    assert.throws(() => validatePackage4D1Artifact(repositoryRoot, altered));
  }
});

test('review and verification validators reject unresolved findings and false convergence', () => {
  const source = buildPackage4SourceManifest(repositoryRoot);
  const review = `<!-- package4-source-binding file_count=${source.file_count} sha256=${source.aggregate_sha256} -->\nretrieval/D1/security/boundary — disposition: PASS\nbenchmark/tests/evidence/product — disposition: PASS\nunresolved critical/high: 0\nmaterial findings reproduced: 0\n`;
  const verification = `<!-- package4-source-binding file_count=${source.file_count} sha256=${source.aggregate_sha256} -->\nStatus: **LOCAL PACKAGE 4 PASS; EXTERNAL AND HOLDOUT NOT RUN**\n| Spec Kit convergence | \`PASS\` |\n| Exact final commit clean clone | \`NOT_RUN\` |\nPackage 5: \`NOT_AUTHORIZED\`\nHoldout: \`NOT_RUN\`\n`;
  validatePackage4Review(review, source);
  validatePackage4Verification(verification, source);
  assert.throws(() => validatePackage4Review(review.replace('critical/high: 0', 'critical/high: 1'), source));
  assert.throws(() => validatePackage4Verification(verification.replace('convergence | `PASS`', 'convergence | `FAIL`'), source));
});

test('the complete Package 4 evidence union binds current source and exact artifacts', () => {
  const result = verifyPackage4EvidenceBinding(repositoryRoot);
  assert.equal(result.source.file_count, 28);
  assert.equal(Object.keys(result.evidence_sha256).length, 7);
});

function readFile(relativePath: string) {
  return readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}
