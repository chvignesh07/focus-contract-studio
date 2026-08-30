import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

function runVerifier(root: string) {
  return spawnSync(
    process.execPath,
    [
      path.join(repositoryRoot, 'scripts/package1-evidence-binding.mjs'),
      '--root',
      root,
    ],
    { encoding: 'utf8' },
  );
}

function evidenceFixture(t: { after: (callback: () => void) => void }) {
  const root = mkdtempSync(path.join(tmpdir(), 'fcs-package1-evidence-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const relative of [
    '.artifacts/test/package1-source-manifest.json',
    '.artifacts/test/package1-local-gate.json',
    '.artifacts/security/package1-security.json',
    'docs/evidence/PACKAGE1_VERIFICATION.md',
  ]) {
    const target = path.join(root, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(repositoryRoot, relative), target);
  }
  return root;
}

test('Package 1 evidence claims match the live source manifest', () => {
  const result = runVerifier(repositoryRoot);

  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /^CONSISTENCY_PASS /u);
});

test('Package 1 evidence consistency rejects semantic result tampering', (t) => {
  const mutations = [
    (root: string) => {
      const file = path.join(root, '.artifacts/test/package1-local-gate.json');
      const value = JSON.parse(readFileSync(file, 'utf8'));
      value.hosted_status = 'PASS';
      writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    },
    (root: string) => {
      const file = path.join(root, '.artifacts/test/package1-local-gate.json');
      const value = JSON.parse(readFileSync(file, 'utf8'));
      value.canonical_gate.exit_code = 1;
      writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    },
    (root: string) => {
      const file = path.join(root, '.artifacts/test/package1-local-gate.json');
      const value = JSON.parse(readFileSync(file, 'utf8'));
      value.canonical_gate.package1_workerd_d1_tests.passed -= 1;
      writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    },
    (root: string) => {
      const file = path.join(root, '.artifacts/test/package1-local-gate.json');
      const value = JSON.parse(readFileSync(file, 'utf8'));
      value.external_actions.push('synthetic external action');
      writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    },
    (root: string) => {
      const file = path.join(root, '.artifacts/security/package1-security.json');
      const value = JSON.parse(readFileSync(file, 'utf8'));
      value.hosted_security_claim = 'PASS';
      writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    },
    (root: string) => {
      const file = path.join(root, '.artifacts/security/package1-security.json');
      const value = JSON.parse(readFileSync(file, 'utf8'));
      value.secrets_recorded = true;
      writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    },
    (root: string) => {
      const file = path.join(root, 'docs/evidence/PACKAGE1_VERIFICATION.md');
      const value = readFileSync(file, 'utf8').replace(
        'Status: **LOCAL CANDIDATE PASS; HOSTED NOT RUN**',
        'Status: **PACKAGE 1 PASS**',
      );
      writeFileSync(file, value);
    },
  ];

  for (const mutate of mutations) {
    const root = evidenceFixture(t);
    mutate(root);
    const result = runVerifier(root);
    assert.notEqual(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.match(result.stderr, /^CONSISTENCY_FAIL /u);
  }
});

test('Package 1 evidence rejects forged smaller all-passing test totals', (t) => {
  const cases = [
    {
      field: 'package0_tests',
      markdownRow: '| Package 0 regressions | `80/80 PASS`',
    },
    {
      field: 'package1_node_tests',
      markdownRow: '| Package 1 Node tests | `10/10 PASS`',
    },
    {
      field: 'package1_workerd_d1_tests',
      markdownRow: '| Package 1 Workerd/D1 tests | `59/59 PASS`',
    },
  ] as const;

  for (const testCase of cases) {
    const root = evidenceFixture(t);
    const gatePath = path.join(root, '.artifacts/test/package1-local-gate.json');
    const gate = JSON.parse(readFileSync(gatePath, 'utf8'));
    gate.canonical_gate[testCase.field] = { passed: 1, total: 1 };
    writeFileSync(gatePath, `${JSON.stringify(gate, null, 2)}\n`);

    const markdownPath = path.join(root, 'docs/evidence/PACKAGE1_VERIFICATION.md');
    const markdown = readFileSync(markdownPath, 'utf8').replace(
      testCase.markdownRow,
      testCase.markdownRow.replace(/\d+\/\d+/u, '1/1'),
    );
    writeFileSync(markdownPath, markdown);

    const result = runVerifier(root);
    assert.notEqual(
      result.status,
      0,
      `${testCase.field} accepted forged 1/1 evidence\n${result.stdout}${result.stderr}`,
    );
    assert.match(result.stderr, /^CONSISTENCY_FAIL /u);
  }
});
