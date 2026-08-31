import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const TASKS_PATH = 'specs/002-package-4-retrieval-v2/tasks.md';

export const PACKAGE4_SOURCE_PATHS = Object.freeze([
  'docs/evidence/EXECUTION_STATE.json',
  'docs/evidence/EXECUTION_STATE.md',
  'lib/retrieval/rrf.ts',
  'lib/server/precedent-repository.ts',
  'package.json',
  'scripts/package4-dependency-boundary.mjs',
  'scripts/package4-development-benchmark.mjs',
  'scripts/package4-evidence-binding.mjs',
  'scripts/package4-fixture-seal.mjs',
  'scripts/package4-source-manifest.mjs',
  'specs/002-package-4-retrieval-v2/checklists/package4.md',
  'specs/002-package-4-retrieval-v2/checklists/requirements.md',
  'specs/002-package-4-retrieval-v2/contracts/package4-verification.md',
  'specs/002-package-4-retrieval-v2/data-model.md',
  'specs/002-package-4-retrieval-v2/plan.md',
  'specs/002-package-4-retrieval-v2/quickstart.md',
  'specs/002-package-4-retrieval-v2/research.md',
  'specs/002-package-4-retrieval-v2/spec.md',
  TASKS_PATH,
  'tests/package2-node/repository-consistency.test.ts',
  'tests/package4-node/dependency-boundary.test.ts',
  'tests/package4-node/development-benchmark.test.ts',
  'tests/package4-node/fixture-seal.test.ts',
  'tests/package4-node/source-evidence.test.ts',
  'tests/package4/d1-vitest-setup.ts',
  'tests/package4/eligibility-query.test.ts',
  'vitest.package4.config.ts',
  'wrangler.package4.jsonc',
]);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function readSource(repositoryRoot, relativePath) {
  if (path.isAbsolute(relativePath) || relativePath.split('/').includes('..')) {
    throw new Error(`unsafe Package 4 source path: ${relativePath}`);
  }
  const absolutePath = path.join(repositoryRoot, relativePath);
  const stat = lstatSync(absolutePath);
  if (stat.isSymbolicLink()) throw new Error(`symbolic link is forbidden: ${relativePath}`);
  if (!stat.isFile()) throw new Error(`not a regular source file: ${relativePath}`);
  const bytes = readFileSync(absolutePath);
  new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return bytes;
}

export function buildPackage4SourceManifest(repositoryRoot) {
  const files = PACKAGE4_SOURCE_PATHS.map((relativePath) => {
    const bytes = readSource(repositoryRoot, relativePath);
    const bound = relativePath === TASKS_PATH
      ? Buffer.from(bytes.toString('utf8').replace(/^- \[[ xX]\] (T\d{3})\b/gmu, '- [ ] $1'))
      : bytes;
    return { path: relativePath, bytes: bytes.length, sha256: sha256(bound) };
  });
  return {
    schema_version: 'fcs-package4-source-manifest-v1',
    package: 4,
    algorithm: 'sha256',
    inventory: 'EXACT_PACKAGE4_IMPLEMENTATION_AND_GATE_SOURCE',
    normalization: 'TASK_CHECKBOX_MARKERS_UNCHECKED_ONLY',
    file_count: files.length,
    aggregate_sha256: sha256(files.map((file) => `${file.sha256}  ${file.bytes}  ${file.path}\n`).join('')),
    files,
  };
}

export function verifyPackage4SourceManifest(repositoryRoot, recorded) {
  const expected = buildPackage4SourceManifest(repositoryRoot);
  if (JSON.stringify(recorded) !== JSON.stringify(expected)) {
    throw new Error('Package 4 source manifest mismatch');
  }
  return expected;
}

function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const manifest = buildPackage4SourceManifest(repositoryRoot);
  const output = path.join(repositoryRoot, '.artifacts/test/package4-source-manifest.json');
  if (process.argv.includes('--write')) writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
  else verifyPackage4SourceManifest(repositoryRoot, JSON.parse(readFileSync(output, 'utf8')));
  process.stdout.write(`PACKAGE4_SOURCE_PASS files=${manifest.file_count} sha256=${manifest.aggregate_sha256}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
