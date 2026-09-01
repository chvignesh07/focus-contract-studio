import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

function read(relativePath: string) {
  return readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}

type EvidenceDeclaration = { id: string; path: string };

function assertReservedE018State(
  declarations: EvidenceDeclaration[],
  reservedReview: string | null,
) {
  const claims = declarations.filter((declaration) => declaration.id === 'E-018');
  if (reservedReview === null) {
    assert.deepEqual(claims, []);
    return;
  }
  assert.deepEqual(claims, [
    { id: 'E-018', path: 'docs/evidence/ADVERSARIAL_REVIEW_1.md' },
  ]);
  assert.match(
    reservedReview,
    /^Review scope: \*\*FULL RELEASE CANDIDATE\*\*$/mu,
  );
  assert.doesNotMatch(reservedReview, /Package 0 local-candidate result/u);
}

test('repository package identity and current execution state are explicit', () => {
  const packageJson = JSON.parse(read('package.json')) as { name?: string };
  const packageLock = JSON.parse(read('package-lock.json')) as {
    name?: string;
    packages?: Record<string, { name?: string }>;
  };
  assert.equal(packageJson.name, 'focus-contract-studio');
  assert.equal(packageLock.name, 'focus-contract-studio');
  assert.equal(packageLock.packages?.['']?.name, 'focus-contract-studio');

  const statePath = path.join(
    repositoryRoot,
    'docs/evidence/EXECUTION_STATE.json',
  );
  assert.ok(existsSync(statePath), 'product-local execution state must exist');
  const state = JSON.parse(readFileSync(statePath, 'utf8')) as {
    scope?: string;
    imported_authority_modified?: boolean;
    historical_intake_state?: { path?: string; classification?: string };
    packages?: Record<string, Record<string, string>>;
  };
  assert.equal(state.scope, 'EXECUTION_STATUS_ONLY');
  assert.equal(state.imported_authority_modified, false);
  assert.deepEqual(state.historical_intake_state, {
    path: 'START_HERE.md',
    classification: 'HISTORICAL_INTAKE_STATE',
  });
  assert.deepEqual(Object.keys(state.packages ?? {}), [
    'package0', 'package1', 'package2', 'package3', 'package4', 'package5',
  ]);
  assert.deepEqual(state.packages?.package0, {
    overall_result: 'INCONCLUSIVE',
    local_result: 'PASS',
    hosted_supported_chatgpt_evidence: 'NOT_RUN',
  });
  assert.deepEqual(state.packages?.package1, { local_public_source_slice: 'PASS' });
  assert.deepEqual(state.packages?.package2, { local_public_source_slice: 'PASS' });
  assert.deepEqual(state.packages?.package3, {
    overall_result: 'PASS',
    local_public_source_slice: 'PASS',
    gate6_independent_review: 'PASS',
  });
  assert.equal(state.packages?.package4?.authorization, 'AUTHORIZED');
  assert.match(state.packages?.package4?.overall_result ?? '', /^(?:IN_PROGRESS|PASS)$/u);
  assert.deepEqual(state.packages?.package5, {
    authorization: 'AUTHORIZED',
    overall_result: 'PASS',
    local_result: 'PASS',
    hosted_status: 'NOT_RUN',
    exact_commit_clone: 'TERMINAL_POST_COMMIT',
  });
});

test('Package 0 summaries are INCONCLUSIVE while unexecuted hosted rows remain NOT_RUN', () => {
  const bootstrap = read('docs/evidence/BOOTSTRAP_PROBES.md');
  const clients = read('docs/evidence/CLIENT_MATRIX.md');
  const security = read('docs/evidence/PACKAGE0_SECURITY_HARDENING.md');
  const runbook = read('docs/evidence/PACKAGE0_EXTERNAL_RUNBOOK.md');

  assert.match(bootstrap, /Overall result: \*\*INCONCLUSIVE\b/u);
  assert.match(bootstrap, /^\| Supported ChatGPT call \|[^\n]*\| NOT_RUN \|/mu);
  assert.match(clients, /Package 0 status: \*\*INCONCLUSIVE\*\*/u);
  assert.match(
    clients,
    /^\| ChatGPT desktop built-in browser[^\n]*\| NOT_RUN \|/mu,
  );
  assert.match(security, /Package 0 overall result: \*\*INCONCLUSIVE\*\*/u);
  assert.match(security, /Hosted\/release result: \*\*NOT_RUN\*\*/u);
  assert.match(runbook, /Package 0 overall result: \*\*INCONCLUSIVE\*\*/u);
  assert.match(runbook, /External checkpoints: \*\*NOT_RUN\*\*/u);
});

test('E-018 and its reserved path belong only to the future full release review', () => {
  const registry = read('docs/delivery/EVIDENCE_REGISTRY.md');
  const rows = [...registry.matchAll(/^\| `(E-\d{3})` \|[^\n]*?\| `([^`]+)` \|/gmu)].map(
    (match) => ({ id: match[1], path: match[2] }),
  );
  assert.ok(rows.length > 0, 'evidence registry rows must be parseable');
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);
  assert.deepEqual(rows.find((row) => row.id === 'E-018'), {
    id: 'E-018',
    path: 'docs/evidence/ADVERSARIAL_REVIEW_1.md',
  });

  const declarations = readdirSync(path.join(repositoryRoot, 'docs/evidence'))
    .filter((name) => name.endsWith('.md'))
    .flatMap((name) =>
      [...read(`docs/evidence/${name}`).matchAll(/^Evidence ID: `?(E-\d{3})`?/gmu)].map(
        (match) => ({ id: match[1], path: `docs/evidence/${name}` }),
      ),
    );
  assert.equal(
    new Set(declarations.map((declaration) => declaration.id)).size,
    declarations.length,
    'product evidence IDs must be unique',
  );
  const reservedPath = path.join(
    repositoryRoot,
    'docs/evidence/ADVERSARIAL_REVIEW_1.md',
  );
  assertReservedE018State(
    declarations,
    existsSync(reservedPath) ? readFileSync(reservedPath, 'utf8') : null,
  );
  const withoutE018 = declarations.filter((declaration) => declaration.id !== 'E-018');
  assert.doesNotThrow(() =>
    assertReservedE018State(
      [
        ...withoutE018,
        { id: 'E-018', path: 'docs/evidence/ADVERSARIAL_REVIEW_1.md' },
      ],
      '# Adversarial Review 1\n\nReview scope: **FULL RELEASE CANDIDATE**\n',
    ),
  );
  assert.throws(() =>
    assertReservedE018State(
      [{ id: 'E-018', path: 'docs/evidence/PACKAGE0_ADVERSARIAL_REVIEW.md' }],
      '# Wrong review\n\nReview scope: **FULL RELEASE CANDIDATE**\n',
    ),
  );
  const package0ReviewPath = path.join(
    repositoryRoot,
    'docs/evidence/PACKAGE0_ADVERSARIAL_REVIEW.md',
  );
  assert.ok(existsSync(package0ReviewPath));
  const package0Review = readFileSync(package0ReviewPath, 'utf8');
  assert.doesNotMatch(package0Review, /E-018/u);
  assert.match(package0Review, /Package 0 overall result: \*\*INCONCLUSIVE\*\*/u);
  assert.match(package0Review, /Package 0 local-candidate result: \*\*PASS\*\*/u);
  assert.match(package0Review, /Hosted\/release result: \*\*NOT_RUN\*\*/u);
});
