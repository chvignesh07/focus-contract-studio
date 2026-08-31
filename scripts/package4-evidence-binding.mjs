import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  assertSafeEvidenceText,
  parseStrictJson,
} from './package3-evidence-binding.mjs';
import { assertPackage4ProductionBoundary } from './package4-dependency-boundary.mjs';
import {
  assertDevelopmentReport,
  runDevelopmentBenchmark,
} from './package4-development-benchmark.mjs';
import {
  buildPackage4SourceManifest,
  verifyPackage4SourceManifest,
} from './package4-source-manifest.mjs';

export { parseStrictJson };

export const PACKAGE4_EVIDENCE_PATHS = Object.freeze([
  '.artifacts/retrieval/rrf-dev-report.json',
  '.artifacts/security/package4-boundary.json',
  '.artifacts/test/package4-d1.json',
  '.artifacts/test/package4-local-gate.json',
  '.artifacts/test/package4-source-manifest.json',
  'docs/evidence/PACKAGE4_ADVERSARIAL_REVIEW.md',
  'docs/evidence/PACKAGE4_VERIFICATION.md',
]);

const GATE_CHECKS = Object.freeze([
  'typecheck',
  'lint',
  'package0',
  'package1',
  'package2_functional',
  'package3',
  'package3_coverage',
  'fixture_seal',
  'development_benchmark',
  'd1',
  'dependency_boundary',
  'production_build',
  'package2_browser',
  'package3_browser',
  'production_audit',
  'package1_binding',
  'package3_checkpoint_frozen',
  'package4_source_binding',
  'package4_evidence_binding',
  'adversarial_review',
  'spec_kit_convergence',
]);

const TEST_BREAKDOWN = Object.freeze({
  package0: 80,
  package1: 69,
  package2_functional: 52,
  package3_functional: 49,
  package3_coverage: 12,
  package4_node: 24,
  package4_d1: 5,
  package2_browser: 5,
  package3_browser: 7,
});

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function exact(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function readEvidence(repositoryRoot, relativePath) {
  const absolutePath = path.join(repositoryRoot, relativePath);
  const stat = lstatSync(absolutePath);
  requireCondition(stat.isFile() && !stat.isSymbolicLink(), `invalid evidence file: ${relativePath}`);
  const source = readFileSync(absolutePath, 'utf8');
  assertSafeEvidenceText(relativePath, source);
  return source;
}

function sourceBinding(source) {
  return {
    algorithm: 'sha256',
    file_count: source.file_count,
    aggregate_sha256: source.aggregate_sha256,
  };
}

function sqlSha256(repositoryRoot) {
  const source = readFileSync(path.join(repositoryRoot, 'lib/server/precedent-repository.ts'), 'utf8');
  const declaration = 'export const ELIGIBLE_PRECEDENTS_SQL =';
  const start = source.indexOf(declaration);
  const tick = String.fromCharCode(96);
  const valueStart = source.indexOf(tick, start + declaration.length);
  const valueEnd = source.indexOf(`${tick};`, valueStart + 1);
  requireCondition(start !== -1 && valueStart !== -1 && valueEnd !== -1, 'production eligibility SQL declaration missing');
  const sql = source.slice(valueStart + 1, valueEnd);
  requireCondition(!sql.includes('${'), 'production eligibility SQL interpolation is forbidden');
  return sha256(sql);
}

export function validatePackage4D1Artifact(repositoryRoot, artifact) {
  requireCondition(artifact.schema_version === 'fcs-package4-d1-v1', 'D1 schema drift');
  requireCondition(artifact.package === 4 && artifact.status === 'PASS', 'D1 status drift');
  requireCondition(artifact.command === 'npm run test:package4:d1', 'D1 command drift');
  requireCondition(exact(artifact.tests, { passed: 5, failed: 0, total: 5 }), 'D1 test count drift');
  requireCondition(artifact.sql_sha256 === sqlSha256(repositoryRoot), 'D1 SQL hash drift');
  requireCondition(artifact.query_plan?.production_table_scans === 0, 'D1 production scan drift');
  requireCondition(
    exact(artifact.query_plan?.required_indexes, ['idx_precedent_profiles_eligibility', 'idx_precedent_eligibility']),
    'D1 index proof drift',
  );
  requireCondition(Array.isArray(artifact.query_plan?.detail) && artifact.query_plan.detail.length === 12, 'D1 plan detail drift');
  requireCondition(artifact.excluded_categories?.length === 18, 'D1 exclusion coverage drift');
  requireCondition(artifact.development_parity_cases === 9 && artifact.maximum_rows === 36, 'D1 parity or bound drift');
  requireCondition(artifact.malformed_materialization === 'FAIL_CLOSED', 'D1 malformed-data drift');
  requireCondition(artifact.additive_migration === 'NOT_REQUIRED', 'D1 migration claim drift');
  requireCondition(artifact.remote_bindings === false && artifact.hosted_status === 'NOT_RUN' && artifact.holdout_status === 'NOT_RUN', 'D1 external boundary drift');
  return artifact;
}

export function validatePackage4Review(text, source) {
  requireSourceMarker(text, source);
  requireCondition(text.includes('retrieval/D1/security/boundary — disposition: PASS'), 'retrieval review missing');
  requireCondition(text.includes('benchmark/tests/evidence/product — disposition: PASS'), 'benchmark review missing');
  requireCondition(text.includes('unresolved critical/high: 0'), 'unresolved critical/high review finding');
  requireCondition(/material findings reproduced: \d+/u.test(text), 'material finding disposition missing');
}

export function validatePackage4Verification(text, source) {
  requireSourceMarker(text, source);
  requireCondition(text.includes('Status: **LOCAL PACKAGE 4 PASS; EXTERNAL AND HOLDOUT NOT RUN**'), 'Package 4 verification status drift');
  requireCondition(text.includes('| Spec Kit convergence | `PASS` |'), 'Spec Kit convergence evidence missing');
  requireCondition(text.includes('| Exact final commit clean clone | `NOT_RUN` |'), 'truthful pre-commit clone status missing');
  requireCondition(text.includes('Package 5: `NOT_AUTHORIZED`'), 'Package 5 boundary missing');
  requireCondition(text.includes('Holdout: `NOT_RUN`'), 'holdout boundary missing');
}

function requireSourceMarker(text, source) {
  requireCondition(
    text.includes(`<!-- package4-source-binding file_count=${source.file_count} sha256=${source.aggregate_sha256} -->`),
    'missing Package 4 source binding',
  );
}

function validateLocalGate(artifact, source) {
  requireCondition(artifact.schema_version === 'fcs-package4-local-gate-v1', 'local gate schema drift');
  requireCondition(artifact.package === 4 && artifact.status === 'PASS', 'local gate status drift');
  requireCondition(artifact.command === 'npm run verify:package4', 'local gate command drift');
  requireCondition(exact(artifact.source, sourceBinding(source)), 'local gate source drift');
  requireCondition(exact(Object.keys(artifact.checks).sort(), [...GATE_CHECKS].sort()), 'local gate check inventory drift');
  requireCondition(Object.values(artifact.checks).every((value) => value === 'PASS'), 'local gate contains non-PASS check');
  requireCondition(
    Number.isSafeInteger(artifact.tests?.passed) && artifact.tests.passed > 0 &&
      artifact.tests.failed === 0 && artifact.tests.total === artifact.tests.passed,
    'local gate test totals drift',
  );
  requireCondition(exact(artifact.test_breakdown, TEST_BREAKDOWN), 'local gate test breakdown drift');
  requireCondition(
    Object.values(TEST_BREAKDOWN).reduce((sum, count) => sum + count, 0) === artifact.tests.total,
    'local gate test total does not match breakdown',
  );
  requireCondition(exact(artifact.browser, { package2: 5, package3: 7 }), 'local gate browser totals drift');
  requireCondition(exact(artifact.security, { audit_vulnerabilities: 0, boundary_violations: 0 }), 'local gate security drift');
  requireCondition(
    exact(artifact.external, {
      holdout: 'NOT_RUN',
      hosted_d1: 'NOT_RUN',
      deployment: 'NOT_RUN',
      real_client: 'NOT_RUN',
      founder_manual: 'NOT_RUN',
      package5: 'NOT_AUTHORIZED',
    }),
    'local gate external boundary drift',
  );
}

export function verifyPackage4EvidenceBinding(repositoryRoot) {
  const source = buildPackage4SourceManifest(repositoryRoot);
  const manifestText = readEvidence(repositoryRoot, '.artifacts/test/package4-source-manifest.json');
  verifyPackage4SourceManifest(
    repositoryRoot,
    parseStrictJson(manifestText, '.artifacts/test/package4-source-manifest.json'),
  );

  const developmentText = readEvidence(repositoryRoot, '.artifacts/retrieval/rrf-dev-report.json');
  const development = parseStrictJson(developmentText, '.artifacts/retrieval/rrf-dev-report.json');
  assertDevelopmentReport(development);
  requireCondition(exact(development, runDevelopmentBenchmark()), 'development report evidence drift');

  const boundaryText = readEvidence(repositoryRoot, '.artifacts/security/package4-boundary.json');
  const boundary = parseStrictJson(boundaryText, '.artifacts/security/package4-boundary.json');
  requireCondition(exact(boundary, assertPackage4ProductionBoundary(repositoryRoot)), 'dependency boundary evidence drift');

  const d1Text = readEvidence(repositoryRoot, '.artifacts/test/package4-d1.json');
  validatePackage4D1Artifact(repositoryRoot, parseStrictJson(d1Text, '.artifacts/test/package4-d1.json'));

  const gateText = readEvidence(repositoryRoot, '.artifacts/test/package4-local-gate.json');
  validateLocalGate(parseStrictJson(gateText, '.artifacts/test/package4-local-gate.json'), source);

  const reviewText = readEvidence(repositoryRoot, 'docs/evidence/PACKAGE4_ADVERSARIAL_REVIEW.md');
  validatePackage4Review(reviewText, source);
  const verificationText = readEvidence(repositoryRoot, 'docs/evidence/PACKAGE4_VERIFICATION.md');
  validatePackage4Verification(verificationText, source);

  const execution = parseStrictJson(readEvidence(repositoryRoot, 'docs/evidence/EXECUTION_STATE.json'), 'docs/evidence/EXECUTION_STATE.json');
  requireCondition(execution.packages?.package3?.overall_result === 'PASS', 'Package 3 execution truth drift');
  requireCondition(execution.packages?.package4?.overall_result === 'PASS', 'Package 4 execution truth drift');
  requireCondition(execution.packages?.package5?.authorization === 'NOT_AUTHORIZED', 'Package 5 execution boundary drift');

  const evidenceSha256 = Object.fromEntries(
    PACKAGE4_EVIDENCE_PATHS.map((relativePath) => [
      relativePath,
      sha256(readFileSync(path.join(repositoryRoot, relativePath))),
    ]),
  );
  return { source, evidence_sha256: evidenceSha256 };
}

function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const result = verifyPackage4EvidenceBinding(repositoryRoot);
    process.stdout.write(`PACKAGE4_EVIDENCE_PASS files=${Object.keys(result.evidence_sha256).length} source=${result.source.aggregate_sha256}\n`);
  } catch (error) {
    process.stderr.write(`PACKAGE4_EVIDENCE_FAIL ${error instanceof Error ? error.message : 'unknown error'}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
