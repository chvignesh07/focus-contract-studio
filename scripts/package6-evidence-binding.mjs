import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { assertSafeEvidenceText, parseStrictJson } from './package3-evidence-binding.mjs';
import { validatePackage6DesignCold } from './package6-design-cold.mjs';
import {
  buildPackage6SourceManifest,
  verifyPackage6SourceManifest,
} from './package6-source-manifest.mjs';

export { parseStrictJson };

export const PACKAGE6_EVIDENCE_PATHS = Object.freeze([
  '.artifacts/test/package6-local-gate.json',
  '.artifacts/test/package6-source-manifest.json',
  'docs/evidence/EXECUTION_STATE.json',
  'docs/evidence/EXECUTION_STATE.md',
  'docs/evidence/PACKAGE6_ADVERSARIAL_REVIEW.md',
  'docs/evidence/PACKAGE6_COLD_EVALUATION.json',
  'docs/evidence/PACKAGE6_EXECUTION.md',
  'docs/evidence/PACKAGE6_VERIFICATION.md',
  'docs/evidence/PACKAGE6_VISUAL_MANIFEST.json',
  'docs/evidence/PACKAGE_6_RED_TO_GREEN.md',
  'specs/004-package-6-premium-accessible-surface/design-resolution.json',
]);

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function readEvidence(repositoryRoot, relativePath) {
  const absolutePath = path.join(repositoryRoot, relativePath);
  const stat = lstatSync(absolutePath);
  requireCondition(stat.isFile() && !stat.isSymbolicLink(), `invalid evidence file: ${relativePath}`);
  const source = readFileSync(absolutePath, 'utf8');
  assertSafeEvidenceText(relativePath, source);
  return source;
}

function sourceMarker(source) {
  return `<!-- package6-source-binding file_count=${source.file_count} sha256=${source.aggregate_sha256} -->`;
}

export function validatePackage6Review(text, source) {
  requireCondition(text.includes(sourceMarker(source)), 'missing Package 6 review source binding');
  requireCondition(
    text.includes('product/design/cold-comprehension/accessibility — disposition: PASS'),
    'product review missing',
  );
  requireCondition(
    text.includes('regression/security/privacy/tests/evidence — disposition: PASS'),
    'regression review missing',
  );
  requireCondition(text.includes('unresolved critical/high/material: 0'), 'unresolved material review finding');
}

export function validatePackage6Verification(text, source) {
  requireCondition(text.includes(sourceMarker(source)), 'missing Package 6 verification source binding');
  requireCondition(
    text.includes('Status: **LOCAL PACKAGE 6 PASS; EXTERNAL NOT RUN**'),
    'Package 6 status drift',
  );
  requireCondition(text.includes('| Spec Kit convergence | `PASS` |'), 'Spec Kit convergence evidence missing');
  requireCondition(
    text.includes('| Exact final commit clean clone | `NOT_RUN` |'),
    'truthful pre-commit clone status missing',
  );
  requireCondition(text.includes('| Cold screenshot evaluator | `PASS` |'), 'cold evidence missing');
  requireCondition(text.includes('Package 7: `NOT_AUTHORIZED`'), 'Package 7 boundary missing');
  requireCondition(
    text.includes('`read_active_focus_review` and `create_focus_contract_proposal`'),
    'two-tool invariant missing',
  );
}

export function validatePackage6Execution(text, source) {
  requireCondition(text.includes(sourceMarker(source)), 'missing Package 6 execution source binding');
  requireCondition(text.includes('Foundational red proof: `PASS`'), 'foundational red proof missing');
  requireCondition(text.includes('Complete local gate: `PASS`'), 'local gate evidence missing');
  requireCondition(text.includes('Package 6 core total: `382/382`'), 'core total drift');
}

export function validatePackage6RedToGreen(text) {
  requireCondition(text.includes('RED · 0 pass / 1 fail'), 'node red proof missing');
  requireCondition(text.includes('RED · 0 tests / 1 failed suite'), 'D1 red proof missing');
  requireCondition(text.includes('RED · 0 pass / 2 fail'), 'DOM red proof missing');
  requireCondition(text.includes('Status: `PASS`'), 'green proof missing');
  requireCondition(text.includes('Package 6 built browser | `4/4`'), 'browser green proof missing');
}

export function validateLocalGate(artifact, source) {
  requireCondition(artifact.schema_version === 'fcs-package6-local-gate-v1', 'local gate schema drift');
  requireCondition(artifact.package === 6 && artifact.status === 'PASS', 'local gate status drift');
  requireCondition(artifact.command === 'npm run verify:package6:core', 'local gate command drift');
  requireCondition(
    artifact.source?.file_count === source.file_count &&
      artifact.source?.aggregate_sha256 === source.aggregate_sha256,
    'local gate source drift',
  );
  requireCondition(
    Object.values(artifact.checks ?? {}).every((value) => value === 'PASS') &&
      Object.keys(artifact.checks ?? {}).length === 12,
    'local gate check failed',
  );
  const breakdown = [
    'inherited_package5',
    'package6_node_core',
    'package6_d1',
    'package6_dom',
    'package6_coverage_replay',
    'package6_browser',
  ].reduce((total, key) => total + (artifact.tests?.[key] ?? Number.NaN), 0);
  requireCondition(
    breakdown === artifact.tests?.total && artifact.tests.failed === 0 &&
      artifact.tests.passed === artifact.tests.total,
    'local gate totals drift',
  );
  requireCondition(
    Object.values(artifact.external ?? {}).every((value) => value === 'NOT_RUN'),
    'external boundary drift',
  );
}

export function verifyPackage6EvidenceBinding(repositoryRoot) {
  const source = buildPackage6SourceManifest(repositoryRoot);
  verifyPackage6SourceManifest(
    repositoryRoot,
    parseStrictJson(
      readEvidence(repositoryRoot, '.artifacts/test/package6-source-manifest.json'),
      '.artifacts/test/package6-source-manifest.json',
    ),
  );
  validateLocalGate(
    parseStrictJson(
      readEvidence(repositoryRoot, '.artifacts/test/package6-local-gate.json'),
      '.artifacts/test/package6-local-gate.json',
    ),
    source,
  );
  validatePackage6Review(
    readEvidence(repositoryRoot, 'docs/evidence/PACKAGE6_ADVERSARIAL_REVIEW.md'),
    source,
  );
  validatePackage6Execution(
    readEvidence(repositoryRoot, 'docs/evidence/PACKAGE6_EXECUTION.md'),
    source,
  );
  validatePackage6Verification(
    readEvidence(repositoryRoot, 'docs/evidence/PACKAGE6_VERIFICATION.md'),
    source,
  );
  validatePackage6RedToGreen(
    readEvidence(repositoryRoot, 'docs/evidence/PACKAGE_6_RED_TO_GREEN.md'),
  );
  validatePackage6DesignCold(repositoryRoot);
  const execution = parseStrictJson(
    readEvidence(repositoryRoot, 'docs/evidence/EXECUTION_STATE.json'),
    'docs/evidence/EXECUTION_STATE.json',
  );
  requireCondition(execution.packages?.package6?.overall_result === 'PASS', 'Package 6 execution truth drift');
  requireCondition(execution.packages?.package7 === undefined, 'later-package execution state must remain absent');
  return {
    source,
    evidence_sha256: Object.fromEntries(PACKAGE6_EVIDENCE_PATHS.map((relativePath) => [
      relativePath,
      sha256(readFileSync(path.join(repositoryRoot, relativePath))),
    ])),
  };
}

function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const result = verifyPackage6EvidenceBinding(repositoryRoot);
    process.stdout.write(
      `PACKAGE6_EVIDENCE_PASS files=${Object.keys(result.evidence_sha256).length} source=${result.source.aggregate_sha256}\n`,
    );
  } catch (error) {
    process.stderr.write(
      `PACKAGE6_EVIDENCE_FAIL ${error instanceof Error ? error.message : 'unknown error'}\n`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
