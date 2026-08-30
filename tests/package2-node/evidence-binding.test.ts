import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
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

import { PACKAGE2_SOURCE_ROOTS } from '../../scripts/package2-source-manifest.mjs';

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
  for (const relative of PACKAGE2_SOURCE_ROOTS) {
    const target = path.join(root, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(path.join(repositoryRoot, relative), target, {
      recursive: true,
      dereference: true,
    });
  }
  for (const relative of [
    '.artifacts/test/package2-source-manifest.json',
    '.artifacts/test/package2-local-gate.json',
    '.artifacts/browser/package2-local-journey.json',
    '.artifacts/security/package2-security.json',
    'docs/evidence/PACKAGE2_VERIFICATION.md',
  ]) {
    const target = path.join(root, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(repositoryRoot, relative), target);
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
