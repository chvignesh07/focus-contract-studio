import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const TASKS_PATH = 'specs/003-package-5-review-apply-undo/tasks.md';

export const PACKAGE5_SOURCE_PATHS = Object.freeze([
  'app/api/focus-history/route.ts',
  'app/api/focus-proposals/[proposalId]/apply/route.ts',
  'app/api/focus-proposals/[proposalId]/review/route.ts',
  'app/api/focus-proposals/reviewer/route.ts',
  'app/api/focus-revisions/[revision]/undo/route.ts',
  'app/delete-account-dialog.tsx',
  'app/focus-contract-studio.tsx',
  'app/globals.css',
  'db/package5-schema.ts',
  'docs/evidence/EXECUTION_STATE.json',
  'docs/evidence/EXECUTION_STATE.md',
  'drizzle/0004_package5_review_apply_undo.sql',
  'lib/domain/package5.ts',
  'lib/domain/proposal.ts',
  'lib/server/active-focus-review.ts',
  'lib/server/create-proposal.ts',
  'lib/server/package5-apply-history-undo.ts',
  'lib/server/package5-operation-policy.ts',
  'lib/server/package5-review.ts',
  'lib/server/verify-focus-contract.ts',
  'lib/server/workspaces.ts',
  'package.json',
  'playwright.config.ts',
  'scripts/package5-evidence-binding.mjs',
  'scripts/package5-local-gate.mjs',
  'scripts/package5-source-manifest.mjs',
  'scripts/package5-verify-package4-frozen.mjs',
  'specs/003-package-5-review-apply-undo/ceo-plan.md',
  'specs/003-package-5-review-apply-undo/checklists/package5.md',
  'specs/003-package-5-review-apply-undo/checklists/requirements.md',
  'specs/003-package-5-review-apply-undo/contracts/apply-api.md',
  'specs/003-package-5-review-apply-undo/contracts/history-undo-reset.md',
  'specs/003-package-5-review-apply-undo/contracts/review-api.md',
  'specs/003-package-5-review-apply-undo/data-model.md',
  'specs/003-package-5-review-apply-undo/eng-plan.md',
  'specs/003-package-5-review-apply-undo/plan.md',
  'specs/003-package-5-review-apply-undo/quickstart.md',
  'specs/003-package-5-review-apply-undo/research.md',
  'specs/003-package-5-review-apply-undo/spec.md',
  TASKS_PATH,
  'tests/package2-node/repository-consistency.test.ts',
  'tests/package5-browser/review-apply-undo.spec.ts',
  'tests/package5-dom/focus-contract-studio.test.tsx',
  'tests/package5-node/fixtures/package5-operation-policy-incomplete.test.ts',
  'tests/package5-node/package5-coverage-threshold.test.ts',
  'tests/package5-node/package5-domain.test.ts',
  'tests/package5-node/package5-operation-policy.test.ts',
  'tests/package5-node/package5-scripts.test.ts',
  'tests/package5-node/source-evidence.test.ts',
  'tests/package5/apply-concurrency.test.ts',
  'tests/package5/apply.test.ts',
  'tests/package5/d1-vitest-setup.ts',
  'tests/package5/helpers.ts',
  'tests/package5/history-undo-reset.test.ts',
  'tests/package5/review.test.ts',
  'tests/package5/routes.test.ts',
  'tests/package5/schema-enforcement.test.ts',
  'tests/package5/verification-projection.test.ts',
  'vitest.package5-dom.config.ts',
  'vitest.package5.config.ts',
  'wrangler.package5.jsonc',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function readSource(repositoryRoot, relativePath) {
  if (path.isAbsolute(relativePath) || relativePath.split('/').includes('..')) {
    throw new Error(`unsafe Package 5 source path: ${relativePath}`);
  }
  const absolutePath = path.join(repositoryRoot, relativePath);
  const stat = lstatSync(absolutePath);
  if (stat.isSymbolicLink()) throw new Error(`symbolic link is forbidden: ${relativePath}`);
  if (!stat.isFile()) throw new Error(`not a regular source file: ${relativePath}`);
  const bytes = readFileSync(absolutePath);
  new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return bytes;
}

export function buildPackage5SourceManifest(repositoryRoot) {
  const files = PACKAGE5_SOURCE_PATHS.map((relativePath) => {
    const bytes = readSource(repositoryRoot, relativePath);
    const bound = relativePath === TASKS_PATH
      ? Buffer.from(bytes.toString('utf8').replace(/^- \[[ xX]\] (T\d{3})\b/gmu, '- [ ] $1'))
      : bytes;
    return { path: relativePath, bytes: bytes.length, sha256: sha256(bound) };
  });
  return {
    schema_version: 'fcs-package5-source-manifest-v1',
    package: 5,
    algorithm: 'sha256',
    inventory: 'EXACT_PACKAGE5_IMPLEMENTATION_AND_GATE_SOURCE',
    normalization: 'TASK_CHECKBOX_MARKERS_UNCHECKED_ONLY',
    file_count: files.length,
    aggregate_sha256: sha256(files.map((file) => `${file.sha256}  ${file.bytes}  ${file.path}\n`).join('')),
    files,
  };
}

export function verifyPackage5SourceManifest(repositoryRoot, recorded) {
  const expected = buildPackage5SourceManifest(repositoryRoot);
  if (JSON.stringify(recorded) !== JSON.stringify(expected)) {
    throw new Error('Package 5 source manifest mismatch');
  }
  return expected;
}

function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const manifest = buildPackage5SourceManifest(repositoryRoot);
  const output = path.join(repositoryRoot, '.artifacts/test/package5-source-manifest.json');
  if (process.argv.includes('--write')) writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
  else verifyPackage5SourceManifest(repositoryRoot, JSON.parse(readFileSync(output, 'utf8')));
  process.stdout.write(`PACKAGE5_SOURCE_PASS files=${manifest.file_count} sha256=${manifest.aggregate_sha256}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
