import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const PACKAGE7_SOURCE_PATHS = Object.freeze([
  'app/focus-contract-studio.tsx',
  'app/webmcp-tools.tsx',
  'docs/evidence/EXECUTION_STATE.json',
  'docs/evidence/EXECUTION_STATE.md',
  'lib/domain/package6.ts',
  'lib/server/package5-apply-history-undo.ts',
  'lib/server/package5-operation-policy.ts',
  'lib/server/verify-focus-contract.ts',
  'lib/webmcp/contracts.ts',
  'lib/webmcp/register.ts',
  'package.json',
  'playwright.config.ts',
  'scripts/package7-evidence-binding.mjs',
  'scripts/package7-local-gate.mjs',
  'scripts/package7-source-manifest.mjs',
  'scripts/package7-verify-package6-frozen.mjs',
  'tests/package5-node/package5-operation-policy.test.ts',
  'tests/package5/apply.test.ts',
  'tests/package5/history-undo-reset.test.ts',
  'tests/package2-node/repository-consistency.test.ts',
  'tests/package6-node/package6-domain.test.ts',
  'tests/package7-browser/webmcp-v2.spec.ts',
  'tests/package7-dom/webmcp-v2-integration.test.tsx',
  'tests/package7-node/package7-scripts.test.ts',
  'tests/package7-node/source-evidence.test.ts',
  'tests/package7-node/webmcp-v2-contract.test.ts',
  'tests/package7-node/webmcp-v2-lifecycle.test.ts',
  'tests/package7/d1-vitest-setup.ts',
  'tests/package7/webmcp-parity.test.ts',
  'vitest.package7-dom.config.ts',
  'vitest.package7.config.ts',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function readSource(repositoryRoot, relativePath) {
  if (path.isAbsolute(relativePath) || relativePath.split('/').includes('..')) {
    throw new Error(`unsafe Package 7 source path: ${relativePath}`);
  }
  const absolutePath = path.join(repositoryRoot, relativePath);
  const stat = lstatSync(absolutePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`invalid Package 7 source file: ${relativePath}`);
  }
  const bytes = readFileSync(absolutePath);
  new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return bytes;
}

export function buildPackage7SourceManifest(repositoryRoot) {
  const files = PACKAGE7_SOURCE_PATHS.map((relativePath) => {
    const bytes = readSource(repositoryRoot, relativePath);
    return { path: relativePath, bytes: bytes.length, sha256: sha256(bytes) };
  });
  return {
    schema_version: 'fcs-package7-source-manifest-v1',
    package: 7,
    algorithm: 'sha256',
    inventory: 'EXACT_PACKAGE7_IMPLEMENTATION_AND_GATE_SOURCE',
    file_count: files.length,
    aggregate_sha256: sha256(
      files.map((file) => `${file.sha256}  ${file.bytes}  ${file.path}\n`).join(''),
    ),
    files,
  };
}

export function verifyPackage7SourceManifest(repositoryRoot, recorded) {
  const expected = buildPackage7SourceManifest(repositoryRoot);
  if (JSON.stringify(recorded) !== JSON.stringify(expected)) {
    throw new Error('Package 7 source manifest mismatch');
  }
  return expected;
}

function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const manifest = buildPackage7SourceManifest(repositoryRoot);
  const output = path.join(repositoryRoot, '.artifacts/test/package7-source-manifest.json');
  if (process.argv.includes('--write')) {
    writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
  } else {
    verifyPackage7SourceManifest(
      repositoryRoot,
      JSON.parse(readFileSync(output, 'utf8')),
    );
  }
  process.stdout.write(
    `PACKAGE7_SOURCE_PASS files=${manifest.file_count} sha256=${manifest.aggregate_sha256}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
