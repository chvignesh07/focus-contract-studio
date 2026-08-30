import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

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

function requireExactPassingTests(label, value, expectedTotal) {
  if (
    !value ||
    !Number.isSafeInteger(value.passed) ||
    !Number.isSafeInteger(value.total) ||
    value.passed !== expectedTotal ||
    value.total !== expectedTotal
  ) {
    throw new Error(
      `${label} must record exactly ${expectedTotal}/${expectedTotal} passing tests`,
    );
  }
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

export function verifyPackage1EvidenceBinding(repositoryRoot) {
  const manifest = readJson(
    path.join(repositoryRoot, '.artifacts/test/package1-source-manifest.json'),
  );
  if (
    !Number.isSafeInteger(manifest.file_count) ||
    manifest.file_count <= 0 ||
    !/^[0-9a-f]{64}$/u.test(manifest.aggregate_sha256)
  ) {
    throw new Error('source manifest identity is invalid');
  }

  const localGate = readJson(
    path.join(repositoryRoot, '.artifacts/test/package1-local-gate.json'),
  );
  requireEqual(
    'local gate manifest file count',
    localGate.source_binding?.implementation_manifest_file_count,
    manifest.file_count,
  );
  requireEqual(
    'local gate manifest digest',
    localGate.source_binding?.implementation_manifest_sha256,
    manifest.aggregate_sha256,
  );
  requireEqual('local gate status', localGate.status, 'PASS');
  requireEqual('local gate hosted status', localGate.hosted_status, 'NOT_RUN');
  requireEqual(
    'local gate result binding',
    localGate.canonical_gate?.result_binding,
    'SOURCE_MANIFEST_PASS',
  );
  requireEqual(
    'local gate canonical command',
    localGate.canonical_gate?.command,
    'npm run verify:package1',
  );
  requireEqual('local gate exit code', localGate.canonical_gate?.exit_code, 0);
  requireExactPassingTests(
    'Package 0 regressions',
    localGate.canonical_gate?.package0_tests,
    80,
  );
  requireExactPassingTests(
    'Package 1 Node tests',
    localGate.canonical_gate?.package1_node_tests,
    10,
  );
  requireExactPassingTests(
    'Package 1 Workerd/D1 tests',
    localGate.canonical_gate?.package1_workerd_d1_tests,
    59,
  );
  requireEqual('local gate build', localGate.canonical_gate?.build, 'PASS');
  requireEqual(
    'runtime audit vulnerabilities',
    localGate.canonical_gate?.runtime_audit_vulnerabilities,
    0,
  );
  requireEqual(
    'complete graph vulnerabilities',
    localGate.canonical_gate?.complete_graph_vulnerabilities,
    0,
  );
  requireEqual('remote bindings', localGate.remote_bindings, false);
  if (!Array.isArray(localGate.external_actions) || localGate.external_actions.length !== 0) {
    throw new Error('local gate external actions must remain an empty array');
  }

  const security = readJson(
    path.join(repositoryRoot, '.artifacts/security/package1-security.json'),
  );
  requireEqual(
    'security manifest file count',
    security.source_manifest_file_count,
    manifest.file_count,
  );
  requireEqual(
    'security manifest digest',
    security.source_manifest_sha256,
    manifest.aggregate_sha256,
  );
  requireEqual('security status', security.status, 'PASS');
  requireEqual('hosted security claim', security.hosted_security_claim, 'NOT_RUN');
  requireEqual(
    'hosted rate capacity claim',
    security.hosted_rate_capacity_claim,
    'NOT_RUN',
  );
  requireEqual('security secrets recorded', security.secrets_recorded, false);
  requireEqual(
    'security locked dependency vulnerabilities',
    security.controls?.locked_dependency_vulnerabilities,
    0,
  );
  requireEqual('history secret scan', security.secret_scan?.history_result, 'PASS');
  requireEqual(
    'working tree secret scan',
    security.secret_scan?.working_tree_result,
    'PASS',
  );

  const markdown = readFileSync(
    path.join(repositoryRoot, 'docs/evidence/PACKAGE1_VERIFICATION.md'),
    'utf8',
  );
  const marker = markdown.match(
    /<!-- package1-source-binding file_count=(\d+) sha256=([0-9a-f]{64}) -->/u,
  );
  if (!marker) throw new Error('Markdown source-binding marker is absent');
  requireEqual(
    'Markdown manifest file count',
    Number.parseInt(marker[1], 10),
    manifest.file_count,
  );
  requireEqual(
    'Markdown manifest digest',
    marker[2],
    manifest.aggregate_sha256,
  );
  if (!markdown.includes('Status: **LOCAL CANDIDATE PASS; HOSTED NOT RUN**')) {
    throw new Error('Markdown status must remain local candidate pass and hosted not run');
  }
  const expectedTestRows = [
    ['Package 0 regressions', localGate.canonical_gate.package0_tests],
    ['Package 1 Node tests', localGate.canonical_gate.package1_node_tests],
    ['Package 1 Workerd/D1 tests', localGate.canonical_gate.package1_workerd_d1_tests],
  ];
  for (const [label, counts] of expectedTestRows) {
    const expected = `| ${label} | \`${counts.passed}/${counts.total} PASS\``;
    if (!markdown.includes(expected)) {
      throw new Error(`Markdown does not match ${label} evidence counts`);
    }
  }
  if (!markdown.includes('| Hosted D1/session/client behavior | `NOT_RUN` |')) {
    throw new Error('Markdown hosted result must remain NOT_RUN');
  }

  return {
    fileCount: manifest.file_count,
    sha256: manifest.aggregate_sha256,
  };
}

function main() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = path.resolve(
    argumentValue('--root') ?? path.join(scriptDirectory, '..'),
  );
  const result = verifyPackage1EvidenceBinding(repositoryRoot);
  process.stdout.write(
    `CONSISTENCY_PASS files=${result.fileCount} sha256=${result.sha256}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `CONSISTENCY_FAIL ${error instanceof Error ? error.message : 'unknown error'}\n`,
    );
    process.exitCode = 1;
  }
}
