import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const TASKS_PATH = 'specs/004-package-6-premium-accessible-surface/tasks.md';

export const PACKAGE6_SOURCE_PATHS = Object.freeze([
  'app/api/active-variant/route.ts',
  'app/delete-account-dialog.tsx',
  'app/focus-contract-studio.tsx',
  'app/globals.css',
  'docs/evidence/EXECUTION_STATE.json',
  'docs/evidence/EXECUTION_STATE.md',
  'lib/domain/package6.ts',
  'lib/server/active-focus-review.ts',
  'lib/server/precedent-repository.ts',
  'lib/server/query-inventory.ts',
  'lib/server/workspaces.ts',
  'lib/webmcp/contracts.ts',
  'package.json',
  'playwright.config.ts',
  'scripts/package6-design-cold.mjs',
  'scripts/package6-evidence-binding.mjs',
  'scripts/package6-local-gate.mjs',
  'scripts/package6-source-manifest.mjs',
  'scripts/package6-verify-package5-frozen.mjs',
  'specs/004-package-6-premium-accessible-surface/ceo-plan.md',
  'specs/004-package-6-premium-accessible-surface/checklists/package6.md',
  'specs/004-package-6-premium-accessible-surface/checklists/requirements.md',
  'specs/004-package-6-premium-accessible-surface/contracts/active-variant-api.md',
  'specs/004-package-6-premium-accessible-surface/contracts/presentation-contract.md',
  'specs/004-package-6-premium-accessible-surface/data-model.md',
  'specs/004-package-6-premium-accessible-surface/design-resolution.json',
  'specs/004-package-6-premium-accessible-surface/design-review.json',
  'specs/004-package-6-premium-accessible-surface/plan.md',
  'specs/004-package-6-premium-accessible-surface/quickstart.md',
  'specs/004-package-6-premium-accessible-surface/research.md',
  'specs/004-package-6-premium-accessible-surface/spec.md',
  TASKS_PATH,
  'tests/package6-browser/premium-surface.spec.ts',
  'tests/package6-dom/focus-contract-studio.test.tsx',
  'tests/package6-node/package6-domain.test.ts',
  'tests/package6-node/package6-scripts.test.ts',
  'tests/package6-node/package6-surface.test.ts',
  'tests/package6-node/source-evidence.test.ts',
  'tests/package6/active-variant.test.ts',
  'tests/package6/d1-vitest-setup.ts',
  'vitest.package6-dom.config.ts',
  'vitest.package6.config.ts',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function readSource(repositoryRoot, relativePath) {
  if (path.isAbsolute(relativePath) || relativePath.split('/').includes('..')) {
    throw new Error(`unsafe Package 6 source path: ${relativePath}`);
  }
  const absolutePath = path.join(repositoryRoot, relativePath);
  const stat = lstatSync(absolutePath);
  if (stat.isSymbolicLink()) throw new Error(`symbolic link is forbidden: ${relativePath}`);
  if (!stat.isFile()) throw new Error(`not a regular source file: ${relativePath}`);
  const bytes = readFileSync(absolutePath);
  new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return bytes;
}

export function buildPackage6SourceManifest(repositoryRoot) {
  const files = PACKAGE6_SOURCE_PATHS.map((relativePath) => {
    const bytes = readSource(repositoryRoot, relativePath);
    const bound = relativePath === TASKS_PATH
      ? Buffer.from(bytes.toString('utf8').replace(/^- \[[ xX]\] (T\d{3})\b/gmu, '- [ ] $1'))
      : bytes;
    return { path: relativePath, bytes: bytes.length, sha256: sha256(bound) };
  });
  return {
    schema_version: 'fcs-package6-source-manifest-v1',
    package: 6,
    algorithm: 'sha256',
    inventory: 'EXACT_PACKAGE6_IMPLEMENTATION_AND_GATE_SOURCE',
    normalization: 'TASK_CHECKBOX_MARKERS_UNCHECKED_ONLY',
    file_count: files.length,
    aggregate_sha256: sha256(
      files.map((file) => `${file.sha256}  ${file.bytes}  ${file.path}\n`).join(''),
    ),
    files,
  };
}

export function verifyPackage6SourceManifest(repositoryRoot, recorded) {
  const expected = buildPackage6SourceManifest(repositoryRoot);
  if (JSON.stringify(recorded) !== JSON.stringify(expected)) {
    throw new Error('Package 6 source manifest mismatch');
  }
  return expected;
}

function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const manifest = buildPackage6SourceManifest(repositoryRoot);
  const output = path.join(repositoryRoot, '.artifacts/test/package6-source-manifest.json');
  if (process.argv.includes('--write')) writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
  else verifyPackage6SourceManifest(repositoryRoot, JSON.parse(readFileSync(output, 'utf8')));
  process.stdout.write(
    `PACKAGE6_SOURCE_PASS files=${manifest.file_count} sha256=${manifest.aggregate_sha256}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
