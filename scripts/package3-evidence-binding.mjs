import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  PACKAGE3_EVIDENCE_PATHS,
  assertPackage3Authority,
  assertPackage3ExternalAuthority,
  buildPackage3SourceManifest,
} from './package3-source-manifest.mjs';

export const EVIDENCE_CONTRACTS = Object.freeze({
  '.artifacts/test/unit.json': Object.freeze({
    evidence_id: 'E-006',
    scope: 'unit-contracts-verifier-rules',
    command: 'node --experimental-strip-types --test tests/package3-node/contracts.test.ts tests/package3-node/focus-event-verifier.test.ts',
    runner: 'node-test',
    environment: 'node-local',
    test_total: 17,
    assertions: Object.freeze({
      closed_contracts: 'PASS',
      six_behaviors: 'PASS',
      six_missing_boundaries: 'PASS',
      seven_mutations: 'PASS',
    }),
  }),
  '.artifacts/test/d1.json': Object.freeze({
    evidence_id: 'E-007',
    scope: 'workerd-d1-routes-atomicity',
    command: 'npm run test:package3:d1',
    runner: 'vitest',
    environment: 'workerd-d1-local-remote-bindings-disabled',
    test_total: 22,
    assertions: Object.freeze({
      additive_migrations_0001_through_0003: 'PASS',
      package2_opening_report_compatible: 'PASS',
      workspace_isolation: 'PASS',
      immutable_finalizers: 'PASS',
      zero_row_is_failure: 'PASS',
      twenty_failure_positions_roll_back: 'PASS',
      replay_and_concurrency: 'PASS',
      replay_after_later_revision: 'PASS',
      route_attack_matrix: 'PASS',
    }),
  }),
  '.artifacts/test/component.json': Object.freeze({
    evidence_id: 'E-008',
    scope: 'component-dialog-result-accessibility',
    command: 'npm run test:package3:dom',
    runner: 'vitest',
    environment: 'jsdom-local',
    test_total: 5,
    assertions: Object.freeze({
      browser_event_capture: 'PASS',
      bounded_manifest_and_six_rows: 'PASS',
      single_restrained_status: 'PASS',
      associated_error_and_focus: 'PASS',
      focusable_aria_disabled_reentry_suppressed: 'PASS',
    }),
  }),
  '.artifacts/browser/playwright.json': Object.freeze({
    evidence_id: 'E-009',
    scope: 'built-worker-real-browser-rehearsal',
    command: 'npm run test:package3:browser:built',
    runner: 'playwright',
    environment: 'chromium-built-worker-local-d1',
    test_total: 7,
    assertions: Object.freeze({
      real_keyboard_events: 'PASS',
      dialog_semantics: 'PASS',
      background_pointer_and_focus_blocked: 'PASS',
      result_comprehension: 'PASS',
      desktop_320_375_and_200_percent: 'PASS',
      no_two_dimensional_scroll_or_occlusion: 'PASS',
      reduced_motion: 'PASS',
    }),
  }),
  '.artifacts/accessibility/axe.json': Object.freeze({
    evidence_id: 'E-010',
    scope: 'automated-accessibility',
    command: 'npm run test:package3:browser:built',
    runner: 'axe-playwright',
    environment: 'chromium-built-worker-local-d1',
    test_total: 7,
    assertions: Object.freeze({
      serious_violations: 0,
      critical_violations: 0,
      visible_focus_contrast_at_least_3_to_1: 'PASS',
      focused_controls_unobscured: 'PASS',
      manual_accessibility_substitute: false,
    }),
  }),
  '.artifacts/test/verifier-independence.json': Object.freeze({
    evidence_id: 'E-011',
    scope: 'observer-verifier-independence-privacy',
    command: 'node --experimental-strip-types --test tests/package3-node/focus-event-verifier.test.ts tests/package3-node/reference-boundary.test.ts tests/package3-node/privacy-scan.test.ts',
    runner: 'node-test',
    environment: 'node-local',
    test_total: 17,
    assertions: Object.freeze({
      direct_and_transitive_forbidden_imports: 0,
      manufactured_browser_events: 0,
      six_behaviors: 'PASS',
      seven_isolated_mutations: 'PASS',
      sensitive_marker_absent: 'PASS',
      prohibited_payload_surfaces_absent: 'PASS',
    }),
  }),
  '.artifacts/test/coverage-summary.json': Object.freeze({
    evidence_id: 'E-014',
    scope: 'package3-coverage',
    command: 'npm run test:package3:coverage',
    runner: 'node-coverage',
    environment: 'node-local',
    test_total: 12,
    assertions: Object.freeze({
      verifier_branch_percent: 100,
      verifier_line_percent: 100,
      applicable_repository_thresholds: 'PASS',
      excluded_verifier_branches: 0,
    }),
  }),
});

const JSON_EVIDENCE_PATHS = Object.freeze(Object.keys(EVIDENCE_CONTRACTS));
const TOP_LEVEL_KEYS = Object.freeze([
  'schema_version',
  'evidence_id',
  'package',
  'scope',
  'status',
  'source',
  'command',
  'started_at_utc',
  'completed_at_utc',
  'exit_code',
  'runtime',
  'tests',
  'assertions',
  'remote_bindings',
  'hosted_status',
  'manual_status',
]);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function exact(value, expected) {
  return JSON.stringify(value) === JSON.stringify(expected);
}

function exactKeys(label, value, keys) {
  requireCondition(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  requireCondition(
    exact(Object.keys(value).sort(), [...keys].sort()),
    `${label} keys drift`,
  );
}

export function parseStrictJson(source, label) {
  let cursor = 0;
  const invalid = () => {
    throw new Error(`invalid JSON in ${label}`);
  };
  const whitespace = () => {
    while (/\s/u.test(source[cursor] ?? '')) cursor += 1;
  };
  const stringValue = () => {
    if (source[cursor] !== '"') invalid();
    const start = cursor;
    cursor += 1;
    while (cursor < source.length) {
      const character = source[cursor++];
      if (character === '"') {
        try {
          const value = JSON.parse(source.slice(start, cursor));
          if (typeof value !== 'string') invalid();
          return value;
        } catch {
          invalid();
        }
      }
      if (character === '\\') {
        if (cursor >= source.length) invalid();
        cursor += 1;
      } else if (character.charCodeAt(0) <= 0x1f) {
        invalid();
      }
    }
    invalid();
  };
  const primitive = () => {
    const match = source.slice(cursor).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/u);
    if (!match) invalid();
    cursor += match[0].length;
  };
  const value = () => {
    whitespace();
    if (source[cursor] === '{') {
      cursor += 1;
      whitespace();
      const keys = new Set();
      if (source[cursor] === '}') {
        cursor += 1;
        return;
      }
      while (cursor < source.length) {
        const key = stringValue();
        if (keys.has(key)) throw new Error(`duplicate JSON key in ${label}`);
        keys.add(key);
        whitespace();
        if (source[cursor++] !== ':') invalid();
        value();
        whitespace();
        if (source[cursor] === '}') {
          cursor += 1;
          return;
        }
        if (source[cursor++] !== ',') invalid();
        whitespace();
      }
      invalid();
    }
    if (source[cursor] === '[') {
      cursor += 1;
      whitespace();
      if (source[cursor] === ']') {
        cursor += 1;
        return;
      }
      while (cursor < source.length) {
        value();
        whitespace();
        if (source[cursor] === ']') {
          cursor += 1;
          return;
        }
        if (source[cursor++] !== ',') invalid();
      }
      invalid();
    }
    if (source[cursor] === '"') {
      stringValue();
      return;
    }
    primitive();
  };
  value();
  whitespace();
  if (cursor !== source.length) invalid();
  return JSON.parse(source);
}

export function assertSafeEvidenceText(relativePath, source) {
  const prohibited = [
    /\/Users\//u,
    /\/private\/tmp/u,
    /\/var\/folders\//u,
    /(?:^|\s)\/tmp\//u,
    /file:\/\//iu,
    /-----BEGIN .*PRIVATE KEY-----/u,
    /\bsk-[A-Za-z0-9_-]{20,}\b/u,
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/u,
    /\bAKIA[0-9A-Z]{16}\b/u,
    /__Host-fcs_session|x-fcs-csrf/iu,
    /P3_PRIVATE_MARKER_DO_NOT_PERSIST_9f31/u,
    /raw[_ -]?(?:event|identity|cookie|csrf)|DOM snapshot|textarea[_ -]?value/iu,
    /\bTODO\b|\bTBD\b|NEEDS CLARIFICATION|\?\?\?/u,
  ];
  for (const pattern of prohibited) {
    requireCondition(!pattern.test(source), `prohibited evidence content in ${relativePath}`);
  }
}

function packageVersion(repositoryRoot, packageName) {
  const filePath = path.join(repositoryRoot, 'node_modules', packageName, 'package.json');
  return JSON.parse(readFileSync(filePath, 'utf8')).version;
}

function npmVersion() {
  const result = spawnSync('npm', ['--version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error('cannot resolve npm runtime');
  return result.stdout.trim();
}

export function currentRuntimeIdentity(repositoryRoot, relativePath) {
  const contract = EVIDENCE_CONTRACTS[relativePath];
  if (!contract) throw new Error(`unregistered Package 3 evidence path: ${relativePath}`);
  let runnerVersion;
  if (contract.runner === 'vitest') runnerVersion = packageVersion(repositoryRoot, 'vitest');
  else if (contract.runner === 'playwright') runnerVersion = packageVersion(repositoryRoot, '@playwright/test');
  else if (contract.runner === 'axe-playwright') runnerVersion = packageVersion(repositoryRoot, '@axe-core/playwright');
  else runnerVersion = process.version;
  return {
    node: process.version,
    npm: npmVersion(),
    runner: contract.runner,
    runner_version: runnerVersion,
    environment: contract.environment,
  };
}

function canonicalTimestamp(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\dZ$/u.test(value) &&
    new Date(Date.parse(value)).toISOString().replace('.000Z', 'Z') === value
  );
}

export function validateEvidenceArtifact(repositoryRoot, relativePath, artifact) {
  const contract = EVIDENCE_CONTRACTS[relativePath];
  requireCondition(contract, `unregistered Package 3 evidence path: ${relativePath}`);
  exactKeys(relativePath, artifact, TOP_LEVEL_KEYS);
  requireCondition(artifact.schema_version === 'fcs-package3-evidence-v1', `${relativePath} schema drift`);
  requireCondition(artifact.evidence_id === contract.evidence_id, `${relativePath} evidence ID drift`);
  requireCondition(artifact.package === 3, `${relativePath} package drift`);
  requireCondition(artifact.scope === contract.scope, `${relativePath} scope drift`);
  requireCondition(artifact.status === 'PASS', `${relativePath} is not PASS`);
  const source = buildPackage3SourceManifest(repositoryRoot);
  requireCondition(
    exact(artifact.source, {
      algorithm: 'sha256',
      file_count: source.file_count,
      aggregate_sha256: source.aggregate_sha256,
    }),
    `${relativePath} source binding drift`,
  );
  requireCondition(artifact.command === contract.command, `${relativePath} command drift`);
  requireCondition(canonicalTimestamp(artifact.started_at_utc), `${relativePath} start timestamp drift`);
  requireCondition(canonicalTimestamp(artifact.completed_at_utc), `${relativePath} completion timestamp drift`);
  requireCondition(Date.parse(artifact.started_at_utc) <= Date.parse(artifact.completed_at_utc), `${relativePath} timestamp order drift`);
  requireCondition(artifact.exit_code === 0, `${relativePath} false passing exit code`);
  requireCondition(
    exact(artifact.runtime, currentRuntimeIdentity(repositoryRoot, relativePath)),
    `${relativePath} runtime identity drift`,
  );
  requireCondition(
    exact(artifact.tests, { passed: contract.test_total, failed: 0, total: contract.test_total }),
    `${relativePath} exact passing test count drift`,
  );
  requireCondition(exact(artifact.assertions, contract.assertions), `${relativePath} assertions drift`);
  requireCondition(artifact.remote_bindings === false, `${relativePath} remote binding claim drift`);
  requireCondition(artifact.hosted_status === 'NOT_RUN', `${relativePath} hosted status drift`);
  requireCondition(artifact.manual_status === 'NOT_RUN', `${relativePath} manual status drift`);
  assertSafeEvidenceText(relativePath, JSON.stringify(artifact));
  return artifact;
}

function readEvidenceFile(repositoryRoot, relativePath) {
  const absolutePath = path.join(repositoryRoot, relativePath);
  let stat;
  try {
    stat = lstatSync(absolutePath);
  } catch {
    throw new Error(`missing evidence: ${relativePath}`);
  }
  requireCondition(stat.isFile() && !stat.isSymbolicLink(), `invalid or symbolic evidence: ${relativePath}`);
  const source = readFileSync(absolutePath, 'utf8');
  assertSafeEvidenceText(relativePath, source);
  return source;
}

function requireSourceMarker(text, source) {
  requireCondition(
    text.includes(`<!-- package3-source-binding file_count=${source.file_count} sha256=${source.aggregate_sha256} -->`),
    'missing Package 3 Markdown source binding',
  );
}

export function validateReviewMarkdown(text, source) {
  requireSourceMarker(text, source);
  for (const role of ['contract/state-machine', 'security/privacy', 'testing/accessibility']) {
    requireCondition(text.includes(`${role} — disposition: PASS`), `missing PASS review: ${role}`);
  }
  requireCondition(text.includes('controlling requirements: 62/62'), 'missing controlling requirement coverage');
  requireCondition(text.includes('unresolved critical/high: 0'), 'unresolved critical/high review finding');
  requireCondition(text.includes('missing controlling requirements: 0'), 'missing controlling requirement review finding');
}

function validateVerificationMarkdown(repositoryRoot, text, source) {
  requireSourceMarker(text, source);
  requireCondition(
    text.includes('Status: **LOCAL PACKAGE 3 PASS; HOSTED AND FOUNDER-MANUAL NOT RUN**'),
    'Package 3 verification status drift',
  );
  for (const relativePath of JSON_EVIDENCE_PATHS) {
    const contract = EVIDENCE_CONTRACTS[relativePath];
    const digest = sha256(readFileSync(path.join(repositoryRoot, relativePath)));
    requireCondition(
      text.includes(`| ${contract.evidence_id} | \`${relativePath}\` | \`PASS\` | \`${digest}\` |`),
      `missing artifact matrix binding: ${relativePath}`,
    );
  }
  for (const row of [
    'Hosted Sites',
    'Founder keyboard smoke',
    'Safari',
    'Supported Chrome client',
    'VoiceOver',
    'Gate 6 convergence',
  ]) {
    requireCondition(text.includes(`| ${row} | \`NOT_RUN\` |`), `false or missing NOT_RUN row: ${row}`);
  }
  requireCondition(text.includes('| Candidate-overlay clean clone | `PASS` |'), 'clean-clone evidence missing');
}

export function verifyPackage3EvidenceBinding(repositoryRoot) {
  const authority = assertPackage3Authority(repositoryRoot);
  const source = buildPackage3SourceManifest(repositoryRoot);
  const artifactSha256 = {};
  for (const relativePath of JSON_EVIDENCE_PATHS) {
    const text = readEvidenceFile(repositoryRoot, relativePath);
    const artifact = parseStrictJson(text, relativePath);
    validateEvidenceArtifact(repositoryRoot, relativePath, artifact);
    artifactSha256[relativePath] = sha256(Buffer.from(text));
  }
  const reviewPath = 'docs/evidence/PACKAGE3_ADVERSARIAL_REVIEW.md';
  const review = readEvidenceFile(repositoryRoot, reviewPath);
  validateReviewMarkdown(review, source);
  artifactSha256[reviewPath] = sha256(Buffer.from(review));
  const verificationPath = 'docs/evidence/PACKAGE3_VERIFICATION.md';
  const verification = readEvidenceFile(repositoryRoot, verificationPath);
  validateVerificationMarkdown(repositoryRoot, verification, source);
  artifactSha256[verificationPath] = sha256(Buffer.from(verification));
  requireCondition(
    exact(Object.keys(artifactSha256).sort(), [...PACKAGE3_EVIDENCE_PATHS].sort()),
    'Package 3 evidence path union drift',
  );
  return { authority, source, artifact_sha256: artifactSha256 };
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

function main() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = path.resolve(
    argumentValue('--repository-root') ?? path.join(scriptDirectory, '..'),
  );
  const planningWorkspace = argumentValue('--planning-workspace');
  assertPackage3ExternalAuthority(repositoryRoot, planningWorkspace);
  const result = verifyPackage3EvidenceBinding(repositoryRoot);
  process.stdout.write(
    `PACKAGE3_EVIDENCE_PASS files=${Object.keys(result.artifact_sha256).length} source=${result.source.aggregate_sha256}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `PACKAGE3_EVIDENCE_FAIL ${error instanceof Error ? error.message : 'unknown error'}\n`,
    );
    process.exitCode = 1;
  }
}
