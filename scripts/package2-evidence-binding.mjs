import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { verifyPackage2SourceManifest } from './package2-source-manifest.mjs';

function assertNoDuplicateJsonKeys(source, filePath) {
  const fileName = path.basename(filePath);
  let cursor = 0;

  function invalidJson() {
    throw new Error(`invalid JSON structure in ${fileName}`);
  }

  function skipWhitespace() {
    while (
      cursor < source.length &&
      (source[cursor] === ' ' ||
        source[cursor] === '\t' ||
        source[cursor] === '\n' ||
        source[cursor] === '\r')
    ) {
      cursor += 1;
    }
  }

  function parseString() {
    if (source[cursor] !== '"') invalidJson();
    const start = cursor;
    cursor += 1;
    while (cursor < source.length) {
      const character = source[cursor];
      cursor += 1;
      if (character === '"') {
        try {
          const value = JSON.parse(source.slice(start, cursor));
          if (typeof value !== 'string') invalidJson();
          return value;
        } catch {
          invalidJson();
        }
      }
      if (character === '\\') {
        if (cursor >= source.length) invalidJson();
        cursor += 1;
      } else if (character.charCodeAt(0) <= 0x1f) {
        invalidJson();
      }
    }
    invalidJson();
  }

  function parsePrimitive() {
    const match = source.slice(cursor).match(
      /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/u,
    );
    if (!match) invalidJson();
    cursor += match[0].length;
  }

  function parseArray() {
    cursor += 1;
    skipWhitespace();
    if (source[cursor] === ']') {
      cursor += 1;
      return;
    }
    while (cursor < source.length) {
      parseValue();
      skipWhitespace();
      if (source[cursor] === ']') {
        cursor += 1;
        return;
      }
      if (source[cursor] !== ',') invalidJson();
      cursor += 1;
      skipWhitespace();
    }
    invalidJson();
  }

  function parseObject() {
    cursor += 1;
    const keys = new Set();
    skipWhitespace();
    if (source[cursor] === '}') {
      cursor += 1;
      return;
    }
    while (cursor < source.length) {
      const key = parseString();
      if (keys.has(key)) {
        throw new Error(`duplicate object key in ${fileName}`);
      }
      keys.add(key);
      skipWhitespace();
      if (source[cursor] !== ':') invalidJson();
      cursor += 1;
      parseValue();
      skipWhitespace();
      if (source[cursor] === '}') {
        cursor += 1;
        return;
      }
      if (source[cursor] !== ',') invalidJson();
      cursor += 1;
      skipWhitespace();
    }
    invalidJson();
  }

  function parseValue() {
    skipWhitespace();
    if (source[cursor] === '{') {
      parseObject();
      return;
    }
    if (source[cursor] === '[') {
      parseArray();
      return;
    }
    if (source[cursor] === '"') {
      parseString();
      return;
    }
    parsePrimitive();
  }

  parseValue();
  skipWhitespace();
  if (cursor !== source.length) invalidJson();
}

function readJson(filePath) {
  try {
    const source = readFileSync(filePath, 'utf8');
    assertNoDuplicateJsonKeys(source, filePath);
    return JSON.parse(source);
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

function requireExactKeys(label, value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object with exactly the required keys`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} must contain exactly the required keys`);
  }
}

function requireExactLiteralObject(label, value, expected) {
  requireExactKeys(label, value, Object.keys(expected));
  for (const [key, expectedValue] of Object.entries(expected)) {
    requireEqual(`${label}.${key}`, value[key], expectedValue);
  }
}

function requireCanonicalUtcTimestamp(label, value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\dZ$/u.test(
      value,
    )
  ) {
    throw new Error(`${label} must be a canonical UTC timestamp`);
  }
  const milliseconds = Date.parse(value);
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString().replace('.000Z', 'Z') !== value
  ) {
    throw new Error(`${label} must be a canonical UTC timestamp`);
  }
  return milliseconds;
}

const SEMANTIC_VERSION =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

function requireSemanticVersion(label, value, prefix = '') {
  if (
    typeof value !== 'string' ||
    !value.startsWith(prefix) ||
    !SEMANTIC_VERSION.test(value.slice(prefix.length))
  ) {
    throw new Error(`${label} must be a semantic version`);
  }
}

function requirePassingTests(label, value) {
  requireExactKeys(label, value, ['passed', 'total']);
  if (
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
  package2_node: 42,
  package2_workerd_d1: 18,
  package2_dom: 5,
  package2_browser: 5,
});

const LOCAL_GATE_TOP_LEVEL_KEYS = Object.freeze([
  'schema_version',
  'package',
  'scope',
  'status',
  'hosted_chatgpt_status',
  'package0_status',
  'source_binding',
  'canonical_gate',
  'assertions',
  'remote_bindings',
  'clean_clone_binding',
  'external_account_mutations',
]);

const LOCAL_GATE_SOURCE_BINDING_KEYS = Object.freeze([
  'public_package1_head',
  'candidate_state',
  'implementation_manifest_sha256',
  'implementation_manifest_file_count',
]);

const LOCAL_GATE_CANONICAL_KEYS = Object.freeze([
  'result_binding',
  'command',
  'started_at_utc',
  'completed_at_utc',
  'exit_code',
  'node',
  'npm',
  'workerd',
  'wrangler',
  'tests',
  'build',
  'runtime_vulnerabilities',
  'complete_graph_vulnerabilities',
]);

const LOCAL_GATE_ASSERTIONS = Object.freeze({
  sealed_rrf_materialization: 'PASS',
  deterministic_rrf_repeats: 100,
  read_operation_zero_write: 'PASS',
  evidence_token_fixed_vector_and_negative_matrix: 'PASS',
  proposal_atomicity_and_fault_injection: 'PASS',
  proposal_replay_collision_and_concurrency: 'PASS',
  proposal_status: 'NOT_APPLIED',
  initial_focus_browser_telemetry: 'PASS_UNTRUSTED',
  initial_focus_live_dom_manifest: 'PASS',
  initial_focus_one_graph_per_revision: 'PASS',
  exact_webmcp_tool_count: 2,
  webmcp_lifecycle_and_cancellation: 'PASS',
  native_dialog_accessibility: 'PASS',
  responsive_reflow_320_375_200_percent: 'PASS',
  axe_serious_critical: 0,
  runtime_hmac_secret_validation: 'PASS',
  source_and_semantic_evidence_binding: 'PASS',
});

const BROWSER_TOP_LEVEL_KEYS = Object.freeze([
  'schema_version',
  'package',
  'scope',
  'status',
  'verified_at_utc',
  'source_manifest_sha256',
  'engine',
  'real_local_d1',
  'remote_bindings',
  'tests',
  'journeys',
  'axe',
  'hosted_client_claim',
]);

const BROWSER_JOURNEYS = Object.freeze({
  anonymous_bootstrap_and_revision1_review: 'PASS',
  native_dialog_actual_initial_focus_and_escape_restore: 'PASS',
  live_dom_manifest_matches_rendered_dialog: 'PASS',
  deliberate_autofocus_divergence_rejected_without_client_repair: 'PASS',
  background_inertness_while_modal: 'PASS',
  background_pointer_activation_blocked: 'PASS',
  configured_tab_and_shift_tab_wrap: 'PASS',
  cancel_proposal_durable_after_reload: 'PASS',
  proposal_visibly_not_applied: 'PASS',
  page_and_open_dialog_controls_unobscured_at_320_and_375: 'PASS',
  page_and_open_dialog_controls_two_hundred_percent_layout_zoom: 'PASS',
  reduced_motion: 'PASS',
});

const SECURITY_TOP_LEVEL_KEYS = Object.freeze([
  'schema_version',
  'package',
  'scope',
  'status',
  'verified_at_utc',
  'source_manifest_sha256',
  'source_manifest_file_count',
  'controls',
  'npm_audit',
  'secret_scan',
  'hosted_security_claim',
  'secrets_recorded',
]);

const SECURITY_CONTROLS = Object.freeze({
  server_resolved_session_and_workspace: true,
  caller_identity_or_authority_inputs: false,
  strict_post_json_origin_csrf_for_mutation: true,
  bounded_request_and_response: true,
  read_operation_product_writes: 0,
  browser_telemetry_trust: 'untrusted-and-nonauthorizing',
  browser_environment_claim_accepted_from_caller: false,
  live_dom_manifest_captured: true,
  observation_graphs_per_workspace_variant_revision: 1,
  observation_replay_and_concurrency_converge: true,
  evidence_token_key_is_private_session_bearer: true,
  evidence_token_lifetime_seconds: 300,
  evidence_token_future_skew_seconds: 30,
  evidence_token_canonical_encoding: true,
  retrieval_rerun_before_proposal: true,
  unsupported_hostile_and_superseded_evidence_excluded: true,
  retrieval_can_authorize_mutation: false,
  proposal_status: 'proposed',
  proposal_applies_revision: false,
  proposal_batch_atomic: true,
  proposal_guard_zero_writes: 0,
  proposal_finalizer_database_enforced: true,
  same_key_replay_and_changed_body_conflict: true,
  duplicate_open_configuration_rejected: true,
  webmcp_exact_tools: 2,
  webmcp_exposes_approval_or_apply: false,
  webmcp_exposes_csrf_or_session: false,
  raw_session_token_persisted: false,
  raw_csrf_token_persisted: false,
  raw_identity_persisted: false,
  secret_scan_policy_source_bound: true,
  source_manifest_reviewable_utf8_only: true,
  browser_test_toolchain_exactly_pinned: true,
  runtime_hmac_secrets_exact_canonical_bytes: 32,
  runtime_hmac_secrets_pairwise_distinct: true,
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
  requireExactKeys('local gate', gate, LOCAL_GATE_TOP_LEVEL_KEYS);
  requireEqual('local gate schema version', gate.schema_version, 1);
  requireEqual('local gate package', gate.package, 2);
  requireEqual('local gate scope', gate.scope, 'local-vertical-slice');
  requireEqual('local gate status', gate.status, 'LOCAL_PASS');
  requireEqual('hosted ChatGPT status', gate.hosted_chatgpt_status, 'NOT_RUN');
  requireEqual('Package 0 status', gate.package0_status, 'INCONCLUSIVE');
  requireExactKeys(
    'local gate source binding',
    gate.source_binding,
    LOCAL_GATE_SOURCE_BINDING_KEYS,
  );
  requireEqual(
    'public Package 1 head',
    gate.source_binding.public_package1_head,
    'e560e0998f24cda1c7c8c2740b67ece487b1ea52',
  );
  requireEqual(
    'local gate source count',
    gate.source_binding.implementation_manifest_file_count,
    manifest.file_count,
  );
  requireEqual(
    'local gate source digest',
    gate.source_binding.implementation_manifest_sha256,
    manifest.aggregate_sha256,
  );
  requireEqual(
    'candidate state',
    gate.source_binding.candidate_state,
    'pending-containing-commit',
  );
  requireExactKeys(
    'canonical gate',
    gate.canonical_gate,
    LOCAL_GATE_CANONICAL_KEYS,
  );
  requireEqual(
    'canonical result binding',
    gate.canonical_gate.result_binding,
    'SOURCE_MANIFEST_PASS',
  );
  requireEqual('canonical command', gate.canonical_gate.command, 'npm run verify:package2');
  const canonicalStartedAt = requireCanonicalUtcTimestamp(
    'canonical gate started_at_utc',
    gate.canonical_gate.started_at_utc,
  );
  const canonicalCompletedAt = requireCanonicalUtcTimestamp(
    'canonical gate completed_at_utc',
    gate.canonical_gate.completed_at_utc,
  );
  if (canonicalCompletedAt < canonicalStartedAt) {
    throw new Error(
      'canonical gate completed_at_utc must not precede started_at_utc',
    );
  }
  requireSemanticVersion('canonical gate node', gate.canonical_gate.node, 'v');
  requireSemanticVersion('canonical gate npm', gate.canonical_gate.npm);
  requireSemanticVersion('canonical gate workerd', gate.canonical_gate.workerd);
  requireSemanticVersion('canonical gate wrangler', gate.canonical_gate.wrangler);
  requireEqual('canonical exit code', gate.canonical_gate.exit_code, 0);
  requireExactTestInventory(gate.canonical_gate.tests);
  requireEqual('production build', gate.canonical_gate.build, 'PASS');
  requireEqual('runtime vulnerabilities', gate.canonical_gate.runtime_vulnerabilities, 0);
  requireEqual(
    'complete graph vulnerabilities',
    gate.canonical_gate.complete_graph_vulnerabilities,
    0,
  );
  requireExactLiteralObject(
    'local gate assertions',
    gate.assertions,
    LOCAL_GATE_ASSERTIONS,
  );
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
  requireExactKeys('browser receipt', browser, BROWSER_TOP_LEVEL_KEYS);
  requireEqual('browser schema version', browser.schema_version, 1);
  requireEqual('browser package', browser.package, 2);
  requireEqual(
    'browser scope',
    browser.scope,
    'built-local-worker-real-disposable-d1',
  );
  requireCanonicalUtcTimestamp('browser verified_at_utc', browser.verified_at_utc);
  requireEqual('browser source digest', browser.source_manifest_sha256, manifest.aggregate_sha256);
  requireEqual('browser status', browser.status, 'PASS');
  if (
    typeof browser.engine !== 'string' ||
    !/^playwright-chromium-(?:0|[1-9]\d*)$/u.test(browser.engine)
  ) {
    throw new Error('browser engine must identify a Playwright Chromium revision');
  }
  requireEqual('browser real D1', browser.real_local_d1, true);
  requireEqual('browser remote bindings', browser.remote_bindings, false);
  requireExactPassingTests(
    'browser tests',
    browser.tests,
    REQUIRED_TEST_COUNTS.package2_browser,
  );
  requireExactLiteralObject('browser journeys', browser.journeys, BROWSER_JOURNEYS);
  requireExactLiteralObject('browser axe', browser.axe, {
    serious: 0,
    critical: 0,
  });
  requireEqual('browser hosted claim', browser.hosted_client_claim, 'NOT_RUN');

  const security = readJson(
    path.join(repositoryRoot, '.artifacts/security/package2-security.json'),
  );
  requireExactKeys('security receipt', security, SECURITY_TOP_LEVEL_KEYS);
  requireEqual('security schema version', security.schema_version, 1);
  requireEqual('security package', security.package, 2);
  requireEqual('security scope', security.scope, 'local-implementation-and-tests');
  requireCanonicalUtcTimestamp(
    'security verified_at_utc',
    security.verified_at_utc,
  );
  requireEqual('security source count', security.source_manifest_file_count, manifest.file_count);
  requireEqual('security source digest', security.source_manifest_sha256, manifest.aggregate_sha256);
  requireEqual('security status', security.status, 'PASS');
  requireEqual('security hosted claim', security.hosted_security_claim, 'NOT_RUN');
  requireEqual('security secrets recorded', security.secrets_recorded, false);
  requireExactLiteralObject('security controls', security.controls, SECURITY_CONTROLS);
  requireExactLiteralObject('security npm audit', security.npm_audit, {
    runtime: 0,
    complete: 0,
  });
  requireExactKeys('security secret scan', security.secret_scan, [
    'tool',
    'version',
    'gitleaks',
    'raw_marker_scan',
    'reachable_history',
    'working_tree',
  ]);
  requireEqual('security secret scan tool', security.secret_scan.tool, 'gitleaks');
  requireSemanticVersion(
    'security secret scan version',
    security.secret_scan.version,
  );
  requireEqual('security gitleaks', security.secret_scan.gitleaks, 'PASS');
  requireEqual('security raw marker scan', security.secret_scan.raw_marker_scan, 'PASS');
  requireEqual(
    'security reachable-history scan',
    security.secret_scan.reachable_history,
    'PASS',
  );
  requireEqual(
    'security working-tree scan',
    security.secret_scan.working_tree,
    'PASS',
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
