import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { verifyPackage2SourceManifest } from './package2-source-manifest.mjs';

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `cannot read ${path.basename(filePath)}: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
}

function requireEqual(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label} is ${String(actual)}; expected ${String(expected)}`);
  }
}

function requirePassingTests(label, value) {
  if (
    !value ||
    !Number.isSafeInteger(value.passed) ||
    !Number.isSafeInteger(value.total) ||
    value.total <= 0 ||
    value.passed !== value.total
  ) {
    throw new Error(`${label} must record a positive all-passing test count`);
  }
}

function requireExactPassingTests(label, value, expectedTotal) {
  requirePassingTests(label, value);
  if (value.passed !== expectedTotal || value.total !== expectedTotal) {
    throw new Error(
      `${label} exact test count must be ${expectedTotal}/${expectedTotal}`,
    );
  }
}

const REQUIRED_TEST_COUNTS = Object.freeze({
  package0: 80,
  package1_node: 10,
  package1_workerd_d1: 59,
  package2_node: 36,
  package2_workerd_d1: 18,
  package2_dom: 5,
  package2_browser: 5,
});

function requireExactTestInventory(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('canonical test inventory must be an object');
  }
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = Object.keys(REQUIRED_TEST_COUNTS).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error('canonical test inventory must contain exactly the required suites');
  }
  for (const [label, total] of Object.entries(REQUIRED_TEST_COUNTS)) {
    requireExactPassingTests(label, value[label], total);
  }
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

export function verifyPackage2EvidenceBinding(repositoryRoot) {
  const manifestPath = path.join(
    repositoryRoot,
    '.artifacts/test/package2-source-manifest.json',
  );
  const manifest = verifyPackage2SourceManifest(repositoryRoot, manifestPath);
  const gate = readJson(
    path.join(repositoryRoot, '.artifacts/test/package2-local-gate.json'),
  );
  requireEqual('local gate package', gate.package, 2);
  requireEqual('local gate status', gate.status, 'LOCAL_PASS');
  requireEqual('hosted ChatGPT status', gate.hosted_chatgpt_status, 'NOT_RUN');
  requireEqual('Package 0 status', gate.package0_status, 'INCONCLUSIVE');
  requireEqual(
    'local gate source count',
    gate.source_binding?.implementation_manifest_file_count,
    manifest.file_count,
  );
  requireEqual(
    'local gate source digest',
    gate.source_binding?.implementation_manifest_sha256,
    manifest.aggregate_sha256,
  );
  requireEqual(
    'candidate state',
    gate.source_binding?.candidate_state,
    'uncommitted-package2-diff',
  );
  requireEqual(
    'canonical result binding',
    gate.canonical_gate?.result_binding,
    'SOURCE_MANIFEST_PASS',
  );
  requireEqual('canonical command', gate.canonical_gate?.command, 'npm run verify:package2');
  requireEqual('canonical exit code', gate.canonical_gate?.exit_code, 0);
  requireExactTestInventory(gate.canonical_gate?.tests);
  requireEqual('production build', gate.canonical_gate?.build, 'PASS');
  requireEqual('runtime vulnerabilities', gate.canonical_gate?.runtime_vulnerabilities, 0);
  requireEqual('complete graph vulnerabilities', gate.canonical_gate?.complete_graph_vulnerabilities, 0);
  requireEqual('remote bindings', gate.remote_bindings, false);
  requireEqual(
    'tracked clean-clone binding',
    gate.clean_clone_binding,
    'PENDING_CONTAINING_COMMIT',
  );
  if (
    !Array.isArray(gate.external_account_mutations) ||
    gate.external_account_mutations.length !== 0
  ) {
    throw new Error('local gate external account mutations must remain empty');
  }

  const browser = readJson(
    path.join(repositoryRoot, '.artifacts/browser/package2-local-journey.json'),
  );
  requireEqual('browser source digest', browser.source_manifest_sha256, manifest.aggregate_sha256);
  requireEqual('browser status', browser.status, 'PASS');
  requireEqual('browser engine', browser.engine, 'playwright-chromium-1234');
  requireEqual('browser real D1', browser.real_local_d1, true);
  requireEqual('browser remote bindings', browser.remote_bindings, false);
  requireExactPassingTests(
    'browser tests',
    browser.tests,
    REQUIRED_TEST_COUNTS.package2_browser,
  );
  requireEqual('browser axe serious', browser.axe?.serious, 0);
  requireEqual('browser axe critical', browser.axe?.critical, 0);
  requireEqual('browser hosted claim', browser.hosted_client_claim, 'NOT_RUN');

  const security = readJson(
    path.join(repositoryRoot, '.artifacts/security/package2-security.json'),
  );
  requireEqual('security source count', security.source_manifest_file_count, manifest.file_count);
  requireEqual('security source digest', security.source_manifest_sha256, manifest.aggregate_sha256);
  requireEqual('security status', security.status, 'PASS');
  requireEqual('security hosted claim', security.hosted_security_claim, 'NOT_RUN');
  requireEqual('security secrets recorded', security.secrets_recorded, false);
  requireEqual('security npm runtime vulnerabilities', security.npm_audit?.runtime, 0);
  requireEqual('security npm complete vulnerabilities', security.npm_audit?.complete, 0);
  requireEqual('security gitleaks', security.secret_scan?.gitleaks, 'PASS');
  requireEqual('security raw marker scan', security.secret_scan?.raw_marker_scan, 'PASS');
  requireEqual(
    'reviewable source text',
    security.controls?.source_manifest_reviewable_utf8_only,
    true,
  );

  const markdown = readFileSync(
    path.join(repositoryRoot, 'docs/evidence/PACKAGE2_VERIFICATION.md'),
    'utf8',
  );
  const marker = markdown.match(
    /<!-- package2-source-binding file_count=(\d+) sha256=([0-9a-f]{64}) -->/u,
  );
  if (!marker) throw new Error('Package 2 Markdown source-binding marker is absent');
  requireEqual('Markdown source count', Number.parseInt(marker[1], 10), manifest.file_count);
  requireEqual('Markdown source digest', marker[2], manifest.aggregate_sha256);
  if (!markdown.includes('Status: **LOCAL PACKAGE 2 PASS; HOSTED CHATGPT NOT RUN**')) {
    throw new Error('Package 2 Markdown status is not truthful');
  }
  if (!markdown.includes('| Supported ChatGPT Site-tools client | `NOT_RUN` |')) {
    throw new Error('Package 2 Markdown must preserve the hosted client blocker');
  }
  if (!markdown.includes('| Package 0 hosted exit gate | `INCONCLUSIVE` |')) {
    throw new Error('Package 2 Markdown must preserve the Package 0 blocker');
  }
  const markdownTestRows = {
    package0: 'Package 0 regressions',
    package1_node: 'Package 1 Node regressions',
    package1_workerd_d1: 'Package 1 Workerd/D1 regressions',
    package2_node: 'Package 2 Node regressions',
    package2_workerd_d1: 'Package 2 Workerd/D1 regressions',
    package2_dom: 'Package 2 DOM regressions',
    package2_browser: 'Package 2 built-Worker Playwright journeys',
  };
  for (const [suite, label] of Object.entries(markdownTestRows)) {
    const total = REQUIRED_TEST_COUNTS[suite];
    if (!markdown.includes(`| ${label} | \`${total}/${total} PASS\` |`)) {
      throw new Error(`Markdown ${label} count must be ${total}/${total}`);
    }
  }

  return { fileCount: manifest.file_count, sha256: manifest.aggregate_sha256 };
}

function main() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = path.resolve(
    argumentValue('--root') ?? path.join(scriptDirectory, '..'),
  );
  const result = verifyPackage2EvidenceBinding(repositoryRoot);
  process.stdout.write(
    `EVIDENCE_BINDING_PASS files=${result.fileCount} sha256=${result.sha256}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `EVIDENCE_BINDING_FAIL ${error instanceof Error ? error.message : 'unknown error'}\n`,
    );
    process.exitCode = 1;
  }
}
