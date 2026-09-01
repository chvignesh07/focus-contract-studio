import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { assertSafeEvidenceText, parseStrictJson } from './package3-evidence-binding.mjs';
import {
  buildPackage7SourceManifest,
  verifyPackage7SourceManifest,
} from './package7-source-manifest.mjs';

export { parseStrictJson };

export const PACKAGE7_EVIDENCE_PATHS = Object.freeze([
  '.artifacts/test/package7-local-gate.json',
  '.artifacts/test/package7-source-manifest.json',
  'docs/evidence/EXECUTION_STATE.json',
  'docs/evidence/EXECUTION_STATE.md',
  'docs/evidence/PACKAGE7_CHECKPOINT.md',
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
  return `<!-- package7-source-binding file_count=${source.file_count} sha256=${source.aggregate_sha256} -->`;
}

export function validatePackage7Checkpoint(text, source) {
  requireCondition(text.includes(sourceMarker(source)), 'missing Package 7 checkpoint source binding');
  requireCondition(
    text.includes('Status: **LOCAL PACKAGE 7 PASS; EXTERNAL NOT RUN**'),
    'Package 7 checkpoint status drift',
  );
  for (const name of [
    'read_active_focus_review',
    'create_focus_contract_proposal',
    'apply_approved_focus_contract',
    'verify_focus_contract',
  ]) {
    requireCondition(text.includes(`\`${name}\``), `missing exact tool ${name}`);
  }
  requireCondition(text.includes('fifth tool: `ABSENT`'), 'fifth tool must be absent');
  requireCondition(
    text.includes('WebMCP contract/state/security review — disposition: PASS'),
    'contract review missing',
  );
  requireCondition(
    text.includes('tests/accessibility/human-fallback/submission-truth review — disposition: PASS'),
    'test and accessibility review missing',
  );
  requireCondition(text.includes('unresolved critical/high/material: 0'), 'unresolved material finding');
  requireCondition(
    text.includes('Exact final commit clean clone: `TERMINAL_POST_COMMIT`'),
    'terminal clone boundary missing',
  );
  requireCondition(text.includes('External exit evidence: `NOT_RUN`'), 'external boundary missing');
}

export function validatePackage7LocalGate(artifact, source) {
  requireCondition(artifact.schema_version === 'fcs-package7-local-gate-v1', 'local gate schema drift');
  requireCondition(artifact.package === 7 && artifact.status === 'PASS', 'local gate status drift');
  requireCondition(artifact.command === 'npm run verify:package7:core', 'local gate command drift');
  requireCondition(
    artifact.source?.file_count === source.file_count &&
      artifact.source?.aggregate_sha256 === source.aggregate_sha256,
    'local gate source drift',
  );
  requireCondition(
    Object.keys(artifact.checks ?? {}).length === 17 &&
      Object.values(artifact.checks ?? {}).every((value) => value === 'PASS'),
    'local gate check failed',
  );
  const breakdown = [
    'inherited_package6',
    'package2_node_functional_regression',
    'package5_node_core',
    'package5_d1',
    'package6_node_core',
    'package6_d1',
    'package6_dom',
    'package6_browser',
    'package7_node',
    'package7_d1',
    'package7_dom',
    'package7_browser',
  ].reduce((total, key) => total + (artifact.tests?.[key] ?? Number.NaN), 0);
  requireCondition(
    breakdown === artifact.tests?.total &&
      artifact.tests?.passed === artifact.tests?.total &&
      artifact.tests?.failed === 0,
    'local gate totals drift',
  );
  requireCondition(
    Object.keys(artifact.external ?? {}).length === 10 &&
      Object.values(artifact.external ?? {}).every((value) => value === 'NOT_RUN'),
    'external boundary drift',
  );
  requireCondition(
    artifact.exact_commit_clone === 'TERMINAL_POST_COMMIT',
    'exact commit clone boundary drift',
  );
}

export function verifyPackage7EvidenceBinding(repositoryRoot) {
  const source = buildPackage7SourceManifest(repositoryRoot);
  verifyPackage7SourceManifest(
    repositoryRoot,
    parseStrictJson(
      readEvidence(repositoryRoot, '.artifacts/test/package7-source-manifest.json'),
      '.artifacts/test/package7-source-manifest.json',
    ),
  );
  validatePackage7LocalGate(
    parseStrictJson(
      readEvidence(repositoryRoot, '.artifacts/test/package7-local-gate.json'),
      '.artifacts/test/package7-local-gate.json',
    ),
    source,
  );
  validatePackage7Checkpoint(
    readEvidence(repositoryRoot, 'docs/evidence/PACKAGE7_CHECKPOINT.md'),
    source,
  );
  const execution = parseStrictJson(
    readEvidence(repositoryRoot, 'docs/evidence/EXECUTION_STATE.json'),
    'docs/evidence/EXECUTION_STATE.json',
  );
  requireCondition(execution.packages?.package7?.overall_result === 'PASS', 'Package 7 execution truth drift');
  requireCondition(execution.packages?.package8 === undefined, 'later-package execution state must remain absent');
  return {
    source,
    evidence_sha256: Object.fromEntries(PACKAGE7_EVIDENCE_PATHS.map((relativePath) => [
      relativePath,
      sha256(readFileSync(path.join(repositoryRoot, relativePath))),
    ])),
  };
}

function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const result = verifyPackage7EvidenceBinding(repositoryRoot);
    process.stdout.write(
      `PACKAGE7_EVIDENCE_PASS files=${Object.keys(result.evidence_sha256).length} source=${result.source.aggregate_sha256}\n`,
    );
  } catch (error) {
    process.stderr.write(
      `PACKAGE7_EVIDENCE_FAIL ${error instanceof Error ? error.message : 'unknown error'}\n`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
