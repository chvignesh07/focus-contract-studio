import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { assertSafeEvidenceText, parseStrictJson } from './package3-evidence-binding.mjs';
import { buildPackage5SourceManifest, verifyPackage5SourceManifest } from './package5-source-manifest.mjs';

export { parseStrictJson };

export const PACKAGE5_EVIDENCE_PATHS = Object.freeze([
  '.artifacts/test/package5-local-gate.json',
  '.artifacts/test/package5-source-manifest.json',
  'docs/evidence/PACKAGE5_ADVERSARIAL_REVIEW.md',
  'docs/evidence/PACKAGE5_EXECUTION.md',
  'docs/evidence/PACKAGE5_VERIFICATION.md',
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
  return `<!-- package5-source-binding file_count=${source.file_count} sha256=${source.aggregate_sha256} -->`;
}

export function validatePackage5Review(text, source) {
  requireCondition(text.includes(sourceMarker(source)), 'missing Package 5 review source binding');
  requireCondition(text.includes('contract/state/D1/security — disposition: PASS'), 'contract review missing');
  requireCondition(text.includes('tests/browser/accessibility/evidence — disposition: PASS'), 'test review missing');
  requireCondition(text.includes('unresolved critical/high: 0'), 'unresolved critical/high review finding');
}

export function validatePackage5Verification(text, source) {
  requireCondition(text.includes(sourceMarker(source)), 'missing Package 5 verification source binding');
  requireCondition(text.includes('Status: **LOCAL PACKAGE 5 PASS; EXTERNAL NOT RUN**'), 'Package 5 status drift');
  requireCondition(text.includes('| Spec Kit convergence | `PASS` |'), 'Spec Kit convergence evidence missing');
  requireCondition(text.includes('| Exact final commit clean clone | `NOT_RUN` |'), 'truthful pre-commit clone status missing');
  requireCondition(text.includes('Package 6: `NOT_AUTHORIZED`'), 'Package 6 boundary missing');
}

export function validatePackage5Execution(text, source) {
  requireCondition(text.includes(sourceMarker(source)), 'missing Package 5 execution source binding');
  requireCondition(text.includes('Foundational red proof: `PASS`'), 'foundational red proof missing');
  requireCondition(text.includes('Complete local gate: `PASS`'), 'local gate evidence missing');
}

export function validateLocalGate(artifact, source) {
  requireCondition(artifact.schema_version === 'fcs-package5-local-gate-v1', 'local gate schema drift');
  requireCondition(artifact.package === 5 && artifact.status === 'PASS', 'local gate status drift');
  requireCondition(artifact.command === 'npm run verify:package5:core', 'local gate command drift');
  requireCondition(
    artifact.source?.file_count === source.file_count &&
      artifact.source?.aggregate_sha256 === source.aggregate_sha256,
    'local gate source drift',
  );
  requireCondition(Object.values(artifact.checks ?? {}).every((value) => value === 'PASS'), 'local gate check failed');
  requireCondition(Object.keys(artifact.checks ?? {}).length >= 10, 'local gate check inventory incomplete');
  requireCondition(artifact.tests?.failed === 0 && artifact.tests?.passed === artifact.tests?.total, 'local gate totals drift');
  requireCondition(Object.values(artifact.external ?? {}).every((value) => value === 'NOT_RUN'), 'external boundary drift');
}

export function verifyPackage5EvidenceBinding(repositoryRoot) {
  const source = buildPackage5SourceManifest(repositoryRoot);
  verifyPackage5SourceManifest(
    repositoryRoot,
    parseStrictJson(
      readEvidence(repositoryRoot, '.artifacts/test/package5-source-manifest.json'),
      '.artifacts/test/package5-source-manifest.json',
    ),
  );
  validateLocalGate(
    parseStrictJson(
      readEvidence(repositoryRoot, '.artifacts/test/package5-local-gate.json'),
      '.artifacts/test/package5-local-gate.json',
    ),
    source,
  );
  validatePackage5Review(readEvidence(repositoryRoot, 'docs/evidence/PACKAGE5_ADVERSARIAL_REVIEW.md'), source);
  validatePackage5Execution(readEvidence(repositoryRoot, 'docs/evidence/PACKAGE5_EXECUTION.md'), source);
  validatePackage5Verification(readEvidence(repositoryRoot, 'docs/evidence/PACKAGE5_VERIFICATION.md'), source);
  const execution = parseStrictJson(
    readEvidence(repositoryRoot, 'docs/evidence/EXECUTION_STATE.json'),
    'docs/evidence/EXECUTION_STATE.json',
  );
  requireCondition(execution.packages?.package5?.overall_result === 'PASS', 'Package 5 execution truth drift');
  requireCondition(execution.packages?.package6 === undefined, 'later-package execution state must remain absent');
  return {
    source,
    evidence_sha256: Object.fromEntries(PACKAGE5_EVIDENCE_PATHS.map((relativePath) => [
      relativePath,
      sha256(readFileSync(path.join(repositoryRoot, relativePath))),
    ])),
  };
}

function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const result = verifyPackage5EvidenceBinding(repositoryRoot);
    process.stdout.write(`PACKAGE5_EVIDENCE_PASS files=${Object.keys(result.evidence_sha256).length} source=${result.source.aggregate_sha256}\n`);
  } catch (error) {
    process.stderr.write(`PACKAGE5_EVIDENCE_FAIL ${error instanceof Error ? error.message : 'unknown error'}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
