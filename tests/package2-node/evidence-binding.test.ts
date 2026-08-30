import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
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
const verifier = path.join(repositoryRoot, 'scripts/package2-evidence-binding.mjs');

function run(root = repositoryRoot) {
  return spawnSync(process.execPath, [verifier, '--root', root], {
    encoding: 'utf8',
  });
}

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'fcs-package2-evidence-'));
  const inventory = spawnSync('git', ['-C', repositoryRoot, 'ls-files', '-z'], {
    encoding: 'utf8',
  });
  assert.equal(inventory.status, 0, inventory.stderr);
  for (const relative of inventory.stdout.split('\0').filter(Boolean)) {
    const target = path.join(root, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(repositoryRoot, relative), target);
  }
  for (const args of [
    ['init', '--quiet'],
    ['add', '--force', '--all'],
  ]) {
    const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  const manifest = JSON.parse(
    readFileSync(
      path.join(root, '.artifacts/test/package2-source-manifest.json'),
      'utf8',
    ),
  ) as { file_count: number; aggregate_sha256: string };
  const gatePath = path.join(root, '.artifacts/test/package2-local-gate.json');
  const gate = JSON.parse(readFileSync(gatePath, 'utf8'));
  gate.source_binding.implementation_manifest_file_count = manifest.file_count;
  gate.source_binding.implementation_manifest_sha256 = manifest.aggregate_sha256;
  writeFileSync(gatePath, `${JSON.stringify(gate, null, 2)}\n`);
  for (const relative of [
    '.artifacts/browser/package2-local-journey.json',
    '.artifacts/security/package2-security.json',
  ]) {
    const target = path.join(root, relative);
    const value = JSON.parse(readFileSync(target, 'utf8'));
    value.source_manifest_sha256 = manifest.aggregate_sha256;
    if ('source_manifest_file_count' in value) {
      value.source_manifest_file_count = manifest.file_count;
    }
    writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  }
  const markdownPath = path.join(root, 'docs/evidence/PACKAGE2_VERIFICATION.md');
  const markdown = readFileSync(markdownPath, 'utf8').replace(
    /<!-- package2-source-binding file_count=\d+ sha256=[0-9a-f]{64} -->/u,
    `<!-- package2-source-binding file_count=${manifest.file_count} sha256=${manifest.aggregate_sha256} -->`,
  );
  writeFileSync(markdownPath, markdown);
  return root;
}

test('Package 2 evidence is bound to the live source manifest', () => {
  const result = run();
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /^EVIDENCE_BINDING_PASS /u);
});

test('Package 2 evidence rejects a forged hosted PASS claim', () => {
  const root = fixture();
  const file = path.join(root, '.artifacts/test/package2-local-gate.json');
  const value = JSON.parse(readFileSync(file, 'utf8'));
  value.hosted_chatgpt_status = 'PASS';
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /hosted ChatGPT status is PASS/u);
});

test('Package 2 evidence rejects an omitted canonical suite', () => {
  const root = fixture();
  const file = path.join(root, '.artifacts/test/package2-local-gate.json');
  const value = JSON.parse(readFileSync(file, 'utf8'));
  delete value.canonical_gate.tests.package2_dom;
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /canonical test inventory/u);
});

test('Package 2 evidence rejects forged all-passing totals', () => {
  const root = fixture();
  const file = path.join(root, '.artifacts/test/package2-local-gate.json');
  const value = JSON.parse(readFileSync(file, 'utf8'));
  value.canonical_gate.tests.package0 = { passed: 1, total: 1 };
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /package0 exact test count/u);
});

test('Package 2 evidence rejects cross-artifact count and source-binding drift', () => {
  const cases = [
    {
      mutate(root: string) {
        const file = path.join(root, '.artifacts/browser/package2-local-journey.json');
        const value = JSON.parse(readFileSync(file, 'utf8'));
        value.tests = { passed: 1, total: 1 };
        writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
      },
      expected: /browser tests exact test count/u,
    },
    {
      mutate(root: string) {
        const file = path.join(root, '.artifacts/security/package2-security.json');
        const value = JSON.parse(readFileSync(file, 'utf8'));
        value.source_manifest_file_count = 1;
        writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
      },
      expected: /security source count/u,
    },
    {
      mutate(root: string) {
        const file = path.join(root, '.artifacts/test/package2-local-gate.json');
        const value = JSON.parse(readFileSync(file, 'utf8'));
        value.canonical_gate.result_binding = 'CONSISTENCY_PASS';
        writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
      },
      expected: /canonical result binding/u,
    },
    {
      mutate(root: string) {
        const file = path.join(root, '.artifacts/test/package2-local-gate.json');
        const value = JSON.parse(readFileSync(file, 'utf8'));
        value.source_binding.candidate_state = 'synthetic-committed-state';
        writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
      },
      expected: /candidate state/u,
    },
    {
      mutate(root: string) {
        const file = path.join(root, 'docs/evidence/PACKAGE2_VERIFICATION.md');
        const markdown = readFileSync(file, 'utf8').replace(
          '| Package 1 Node regressions | `10/10 PASS` |',
          '| Package 1 Node regressions | `1/1 PASS` |',
        );
        writeFileSync(file, markdown);
      },
      expected: /Markdown Package 1 Node regressions count/u,
    },
  ];

  for (const testCase of cases) {
    const root = fixture();
    testCase.mutate(root);
    const result = run(root);
    assert.notEqual(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.match(result.stderr, testCase.expected);
  }
});
