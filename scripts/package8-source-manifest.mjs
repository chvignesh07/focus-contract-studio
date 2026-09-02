import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { parseStrictJson } from './package3-evidence-binding.mjs';
import { assertSafeRelativePath } from './package8-release-checks.mjs';

export const PACKAGE8_SOURCE_PATHS = Object.freeze([
  '.gitleaks.toml',
  '.gitleaksignore.package8',
  '.gitignore',
  '.github/workflows/verify.yml',
  'README.md',
  'THIRD_PARTY_NOTICES.md',
  'app/api/focus-proposals/[proposalId]/apply/route.ts',
  'app/api/focus-proposals/[proposalId]/review/route.ts',
  'app/api/focus-proposals/reviewer/route.ts',
  'app/api/focus-proposals/route.ts',
  'app/api/focus-revisions/[revision]/undo/route.ts',
  'app/api/observations/initial-focus/route.ts',
  'app/api/rehearsals/[rehearsalSessionId]/finalize/route.ts',
  'app/api/rehearsals/start/route.ts',
  'app/api/session/reset/route.ts',
  'app/api/session/bootstrap/route.ts',
  'app/api/verifications/route.ts',
  'app/focus-contract-studio.tsx',
  'app/globals.css',
  'docs/delivery/DEPLOYMENT_AND_OPERATIONS.md',
  'docs/delivery/EVIDENCE_REGISTRY.md',
  'docs/evidence/EXECUTION_STATE.json',
  'docs/evidence/EXECUTION_STATE.md',
  'docs/evidence/PROVENANCE_LEDGER.md',
  'docs/quality/SECURITY_AND_PRIVACY.md',
  'db/schema.ts',
  'drizzle/0005_package8_admission_lineage.sql',
  'drizzle/0006_package8_atomic_admission.sql',
  'lib/client/zod-jitless.ts',
  'lib/server/admission.ts',
  'lib/server/create-proposal.ts',
  'lib/server/errors.ts',
  'lib/server/focus-rehearsal.ts',
  'lib/server/initial-focus-observation.ts',
  'lib/server/query-inventory.ts',
  'lib/server/package5-apply-history-undo.ts',
  'lib/server/package5-review.ts',
  'lib/server/security-headers.ts',
  'lib/server/verify-focus-contract.ts',
  'lib/server/workspaces.ts',
  'package.json',
  'playwright.config.ts',
  'proxy.ts',
  'release/BUILD_INPUTS.json',
  'scripts/package8-clean-d1.mjs',
  'scripts/package8-evidence-binding.mjs',
  'scripts/package8-local-gate.mjs',
  'scripts/package8-release-checks.mjs',
  'scripts/package8-source-manifest.mjs',
  'scripts/package8-verify-package7-frozen.mjs',
  'tests/package8-browser/security-runtime.spec.ts',
  'tests/package1/admission.test.ts',
  'tests/package1/routes.test.ts',
  'tests/package8-node/admission-wiring.test.ts',
  'tests/package8-node/browser-setup.test.ts',
  'tests/package8-node/package8-scripts.test.ts',
  'tests/package8-node/security-headers.test.ts',
  'tests/package8-node/source-evidence.test.ts',
  'tests/package8/admission.test.ts',
  'tests/package8/d1-vitest-setup.ts',
  'vite.config.ts',
  'vitest.package8.config.ts',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function readSource(repositoryRoot, relativePath) {
  const safePath = assertSafeRelativePath(relativePath, 'Package 8 source path');
  const absolutePath = path.join(repositoryRoot, safePath);
  const stat = lstatSync(absolutePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`invalid Package 8 source file: ${relativePath}`);
  }
  const bytes = readFileSync(absolutePath);
  new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return bytes;
}

export function parsePackage8SourceManifest(source) {
  return parseStrictJson(source, '.artifacts/test/package8-source-manifest.json');
}

export function buildPackage8SourceManifest(repositoryRoot) {
  const files = PACKAGE8_SOURCE_PATHS.map((relativePath) => {
    const bytes = readSource(repositoryRoot, relativePath);
    return { path: relativePath, bytes: bytes.length, sha256: sha256(bytes) };
  });
  return {
    schema_version: 'fcs-package8-source-manifest-v1',
    package: 8,
    algorithm: 'sha256',
    inventory: 'EXACT_PACKAGE8_IMPLEMENTATION_DOCUMENTATION_AND_GATE_SOURCE',
    file_count: files.length,
    aggregate_sha256: sha256(
      files.map((file) => `${file.sha256}  ${file.bytes}  ${file.path}\n`).join(''),
    ),
    files,
  };
}

export function verifyPackage8SourceManifest(repositoryRoot, recorded) {
  const expected = buildPackage8SourceManifest(repositoryRoot);
  if (JSON.stringify(recorded) !== JSON.stringify(expected)) {
    throw new Error('Package 8 source manifest mismatch');
  }
  return expected;
}

function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const manifest = buildPackage8SourceManifest(repositoryRoot);
  const output = path.join(repositoryRoot, '.artifacts/test/package8-source-manifest.json');
  if (process.argv.includes('--write')) {
    writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
  } else {
    verifyPackage8SourceManifest(
      repositoryRoot,
      parsePackage8SourceManifest(readFileSync(output, 'utf8')),
    );
  }
  process.stdout.write(
    `PACKAGE8_SOURCE_PASS files=${manifest.file_count} sha256=${manifest.aggregate_sha256}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
