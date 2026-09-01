import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { assertSafeEvidenceText, parseStrictJson } from './package3-evidence-binding.mjs';
import { validateBuildInputs } from './package8-release-checks.mjs';
import {
  buildPackage8SourceManifest,
  verifyPackage8SourceManifest,
} from './package8-source-manifest.mjs';

export const PACKAGE8_EVIDENCE_PATHS = Object.freeze([
  '.artifacts/security/gitleaks-history.json',
  '.artifacts/security/gitleaks-worktree.json',
  '.artifacts/security/package8-dependency-license.json',
  '.artifacts/security/release-security.json',
  '.artifacts/test/clean-clone.json',
  '.artifacts/test/memory-counterfactual.json',
  '.artifacts/test/package8-clean-d1.json',
  '.artifacts/test/package8-local-gate.json',
  '.artifacts/test/package8-source-manifest.json',
  'THIRD_PARTY_NOTICES.md',
  'docs/delivery/EVIDENCE_REGISTRY.md',
  'docs/evidence/EXECUTION_STATE.json',
  'docs/evidence/EXECUTION_STATE.md',
  'docs/evidence/PACKAGE8_CHECKPOINT.md',
  'docs/evidence/PACKAGE8_REVIEWS.md',
  'docs/evidence/PROVENANCE_LEDGER.md',
  'release/BUILD_INPUTS.json',
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
  return `<!-- package8-source-binding file_count=${source.file_count} sha256=${source.aggregate_sha256} -->`;
}

export function validatePackage8LocalGate(artifact, source) {
  requireCondition(artifact.schema_version === 'fcs-package8-local-gate-v1', 'local gate schema drift');
  requireCondition(artifact.package === 8 && artifact.status === 'PASS', 'local gate status drift');
  requireCondition(artifact.command === 'npm run verify:package8:core', 'local gate command drift');
  requireCondition(
    artifact.source?.file_count === source.file_count &&
      artifact.source?.aggregate_sha256 === source.aggregate_sha256,
    'local gate source drift',
  );
  requireCondition(
    Object.keys(artifact.checks ?? {}).length === 18 &&
      Object.values(artifact.checks ?? {}).every((value) => value === 'PASS'),
    'local gate check failed',
  );
  requireCondition(
    JSON.stringify(artifact.tests) === JSON.stringify({
      inherited_package7: 482,
      package8_node: 10,
      package8_d1: 6,
      deterministic_seed: 7,
      memory_counterfactual: 5,
      package8_browser: 4,
      passed: 514,
      failed: 0,
      total: 514,
    }),
    'local gate totals drift',
  );
  requireCondition(
    Object.values(artifact.findings ?? {}).every((value) => value === 0),
    'local gate has unresolved finding',
  );
  requireCondition(
    Object.keys(artifact.external ?? {}).length === 11 &&
      Object.values(artifact.external ?? {}).every((value) => value === 'NOT_RUN'),
    'external boundary drift',
  );
  requireCondition(artifact.exact_commit_clone === 'TERMINAL_POST_COMMIT', 'clone boundary drift');
}

export function validatePackage8Checkpoint(text, source) {
  requireCondition(text.includes(sourceMarker(source)), 'missing Package 8 checkpoint source binding');
  requireCondition(
    text.includes('Status: **LOCAL PACKAGE 8 PASS; EXTERNAL NOT RUN**'),
    'Package 8 checkpoint status drift',
  );
  for (const phrase of [
    'Canonical command: `npm run verify`',
    'Exactly four WebMCP tools: `PASS`',
    'Security/admission/state review — disposition: PASS',
    'CI/evidence/privacy/accessibility/claim review — disposition: PASS',
    'unresolved critical/high/material/license: 0',
    'Exact final commit clean clone: `TERMINAL_POST_COMMIT`',
    'Adversarial review 1 (`E-018`): `NOT_RUN`',
    'Package 0 overall result: `INCONCLUSIVE`',
    'External exit evidence: `NOT_RUN`',
  ]) requireCondition(text.includes(phrase), `checkpoint missing: ${phrase}`);
}

export function validatePackage8Reviews(text, source) {
  requireCondition(text.includes(sourceMarker(source)), 'missing Package 8 review source binding');
  requireCondition((text.match(/— disposition: PASS/gu) ?? []).length === 2, 'Package 8 review count drift');
  requireCondition(text.includes('unresolved critical/high/material: 0'), 'unresolved review finding');
  requireCondition(text.includes('This is not adversarial Review 1 (`E-018`)'), 'Review 1 boundary missing');
}

function validateStatusArtifacts(repositoryRoot) {
  const clean = parseStrictJson(
    readEvidence(repositoryRoot, '.artifacts/test/package8-clean-d1.json'),
    '.artifacts/test/package8-clean-d1.json',
  );
  requireCondition(clean.status === 'PASS' && clean.remote_bindings === false, 'clean D1 artifact drift');
  const clone = parseStrictJson(
    readEvidence(repositoryRoot, '.artifacts/test/clean-clone.json'),
    '.artifacts/test/clean-clone.json',
  );
  requireCondition(
    clone.status === 'TERMINAL_POST_COMMIT' && clone.source_commit === null,
    'clean clone must remain a pre-commit terminal marker',
  );
  const memory = parseStrictJson(
    readEvidence(repositoryRoot, '.artifacts/test/memory-counterfactual.json'),
    '.artifacts/test/memory-counterfactual.json',
  );
  requireCondition(
    memory.status === 'PASS' &&
      memory.remote_bindings === false &&
      memory.tests?.passed === 5 &&
      memory.with_eligible_D001 === 'PROPOSAL_CREATED_NOT_APPLIED' &&
      memory.without_eligible_D001 === 'REJECTED_NO_MUTATION',
    'memory counterfactual artifact drift',
  );
  for (const relativePath of [
    '.artifacts/security/gitleaks-history.json',
    '.artifacts/security/gitleaks-worktree.json',
  ]) {
    const result = parseStrictJson(readEvidence(repositoryRoot, relativePath), relativePath);
    requireCondition(Array.isArray(result) && result.length === 0, `${relativePath} finding`);
  }
  const security = parseStrictJson(
    readEvidence(repositoryRoot, '.artifacts/security/release-security.json'),
    '.artifacts/security/release-security.json',
  );
  requireCondition(security.status === 'PASS', 'release security artifact drift');
  requireCondition(
    Object.values(security.checks ?? {}).every((value) => value === 'PASS') &&
      Object.values(security.findings ?? {}).every((value) => value === 0) &&
      Object.values(security.external ?? {}).every((value) => value === 'NOT_RUN'),
    'release security evidence boundary drift',
  );
  const inventory = parseStrictJson(
    readEvidence(repositoryRoot, '.artifacts/security/package8-dependency-license.json'),
    '.artifacts/security/package8-dependency-license.json',
  );
  requireCondition(
    inventory.status === 'PASS' && inventory.unresolved_findings?.length === 0,
    'dependency/license inventory drift',
  );
}

export function verifyPackage8EvidenceBinding(repositoryRoot) {
  const source = buildPackage8SourceManifest(repositoryRoot);
  verifyPackage8SourceManifest(
    repositoryRoot,
    parseStrictJson(
      readEvidence(repositoryRoot, '.artifacts/test/package8-source-manifest.json'),
      '.artifacts/test/package8-source-manifest.json',
    ),
  );
  validatePackage8LocalGate(
    parseStrictJson(
      readEvidence(repositoryRoot, '.artifacts/test/package8-local-gate.json'),
      '.artifacts/test/package8-local-gate.json',
    ),
    source,
  );
  validatePackage8Checkpoint(readEvidence(repositoryRoot, 'docs/evidence/PACKAGE8_CHECKPOINT.md'), source);
  validatePackage8Reviews(readEvidence(repositoryRoot, 'docs/evidence/PACKAGE8_REVIEWS.md'), source);
  validateStatusArtifacts(repositoryRoot);
  validateBuildInputs(repositoryRoot, readEvidence(repositoryRoot, 'release/BUILD_INPUTS.json'));
  const execution = parseStrictJson(
    readEvidence(repositoryRoot, 'docs/evidence/EXECUTION_STATE.json'),
    'docs/evidence/EXECUTION_STATE.json',
  );
  requireCondition(execution.packages?.package0?.overall_result === 'INCONCLUSIVE', 'Package 0 truth drift');
  requireCondition(execution.packages?.package8?.overall_result === 'PASS', 'Package 8 execution truth drift');
  requireCondition(execution.packages?.package8?.review1_status === 'NOT_RUN', 'Review 1 status drift');
  const registry = readEvidence(repositoryRoot, 'docs/delivery/EVIDENCE_REGISTRY.md');
  requireCondition(registry.includes('| `E-018` | Review 1 |'), 'E-018 registry row missing');
  requireCondition(registry.includes('| `E-018` | Review 1 | `docs/evidence/ADVERSARIAL_REVIEW_1.md` | Local authority/security/retrieval/UX audit; every finding disposition and retest. | Reviewed commit(s), final `C` candidate | `NOT_RUN` |'), 'E-018 must remain NOT_RUN');
  const provenance = readEvidence(repositoryRoot, 'docs/evidence/PROVENANCE_LEDGER.md');
  for (const phrase of ['Package 8 local pre-live status: **PASS**', 'THIRD_PARTY_NOTICES.md', 'No Clivus source']) {
    requireCondition(provenance.includes(phrase), `provenance missing: ${phrase}`);
  }
  const notices = readEvidence(repositoryRoot, 'THIRD_PARTY_NOTICES.md');
  requireCondition(notices.includes('Known LGPL, MPL, CC-BY, and Python-license entries'), 'notices obligation drift');
  const evidenceSha256 = Object.fromEntries(PACKAGE8_EVIDENCE_PATHS.map((relativePath) => [
    relativePath,
    sha256(readFileSync(path.join(repositoryRoot, relativePath))),
  ]));
  return { source, evidence_sha256: evidenceSha256 };
}

function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const result = verifyPackage8EvidenceBinding(repositoryRoot);
    process.stdout.write(
      `PACKAGE8_EVIDENCE_PASS files=${Object.keys(result.evidence_sha256).length} source=${result.source.aggregate_sha256}\n`,
    );
  } catch (error) {
    process.stderr.write(`PACKAGE8_EVIDENCE_FAIL ${error instanceof Error ? error.message : 'unknown error'}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
