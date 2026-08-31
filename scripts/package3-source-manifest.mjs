import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const PROMPT_C_COMMIT = '5fca67d329e921b00154f20cd499c793cdc4302f';
const PROMPT_B_COMMIT = 'f78c9d4cafa35e48172d269fe40922ffc634ddac';
const PACKAGE2_COMMIT = 'ab714fec10443c54ac08fbcdeaf94bd610085031';
const PROMPT_C_MANIFEST = 'docs/evidence/spec-kit/PACKAGE3_PROMPT_C_MANIFEST.json';
const AUTHORITY_BASELINE = 'docs/evidence/spec-kit/PACKAGE3_AUTHORITY_BASELINE.json';
const TASKS_PATH = 'specs/001-package-3-raw-observer-verifier/tasks.md';

export const PACKAGE3_EVIDENCE_PATHS = Object.freeze([
  '.artifacts/accessibility/axe.json',
  '.artifacts/browser/playwright.json',
  '.artifacts/test/component.json',
  '.artifacts/test/coverage-summary.json',
  '.artifacts/test/d1.json',
  '.artifacts/test/unit.json',
  '.artifacts/test/verifier-independence.json',
  'docs/evidence/PACKAGE3_ADVERSARIAL_REVIEW.md',
  'docs/evidence/PACKAGE3_VERIFICATION.md',
]);

export const PACKAGE3_SOURCE_PATHS = Object.freeze([
  'app/api/rehearsals/[rehearsalSessionId]/finalize/route.ts',
  'app/api/rehearsals/start/route.ts',
  'app/api/verifications/route.ts',
  'app/delete-account-dialog.tsx',
  'app/focus-contract-studio.tsx',
  'app/globals.css',
  'db/package3-schema.ts',
  'db/schema.ts',
  'drizzle/0003_package3_raw_observer_verifier.sql',
  'drizzle/meta/_journal.json',
  'lib/domain/focus-event-verifier.ts',
  'lib/domain/focus-rehearsal.ts',
  'lib/server/focus-rehearsal.ts',
  'lib/server/verify-focus-contract.ts',
  'package.json',
  'playwright.config.ts',
  'scripts/package3-evidence-binding.mjs',
  'scripts/package3-source-manifest.mjs',
  'specs/001-package-3-raw-observer-verifier/tasks.md',
  'tests/package0/publication-safety.test.ts',
  'tests/package1/migrations.test.ts',
  'tests/package2/migration-seed.test.ts',
  'tests/package3-browser/rehearsal.spec.ts',
  'tests/package3-dom/focus-contract-studio.test.tsx',
  'tests/package3-node/contracts.test.ts',
  'tests/package3-node/focus-event-verifier.test.ts',
  'tests/package3-node/privacy-scan.test.ts',
  'tests/package3-node/reference-boundary.test.ts',
  'tests/package3-node/source-evidence.test.ts',
  'tests/package3/d1-vitest-setup.ts',
  'tests/package3/focus-rehearsal.test.ts',
  'tests/package3/routes.test.ts',
  'tests/package3/verification-persistence.test.ts',
  'vitest.package1.config.ts',
  'vitest.package2.config.ts',
  'vitest.package3-dom.config.ts',
  'vitest.package3-node.config.ts',
  'vitest.package3.config.ts',
  'wrangler.package3.jsonc',
]);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function gitBlob(bytes) {
  return createHash('sha1')
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex');
}

function git(repositoryRoot, args, binary = false) {
  const result = spawnSync('git', ['-C', repositoryRoot, ...args], {
    encoding: binary ? null : 'utf8',
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `git ${args[0]} failed: ${result.error?.message ?? String(result.stderr).trim()}`,
    );
  }
  return result.stdout;
}

function safeRelativePath(relativePath) {
  if (
    typeof relativePath !== 'string' ||
    relativePath.length === 0 ||
    path.isAbsolute(relativePath) ||
    relativePath.split('/').includes('..') ||
    /[\u0000-\u001f\u007f]/u.test(relativePath)
  ) {
    throw new Error(`unsafe Package 3 path: ${String(relativePath)}`);
  }
}

function readReviewableFile(repositoryRoot, relativePath) {
  safeRelativePath(relativePath);
  const absolutePath = path.join(repositoryRoot, relativePath);
  const stat = lstatSync(absolutePath);
  if (stat.isSymbolicLink()) {
    throw new Error(`symbolic link is forbidden: ${relativePath}`);
  }
  if (!stat.isFile()) throw new Error(`not a regular file: ${relativePath}`);
  const bytes = readFileSync(absolutePath);
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`invalid UTF-8 source: ${relativePath}`);
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) {
    throw new Error(`control byte in source: ${relativePath}`);
  }
  return bytes;
}

export function buildPackage3SourceManifest(repositoryRoot) {
  const files = PACKAGE3_SOURCE_PATHS.map((relativePath) => {
    const bytes = readReviewableFile(repositoryRoot, relativePath);
    const boundBytes =
      relativePath === TASKS_PATH
        ? Buffer.from(
            bytes
              .toString('utf8')
              .replace(/^- \[[ xX]\] (T\d{3})\b/gmu, '- [ ] $1'),
          )
        : bytes;
    return { path: relativePath, bytes: bytes.length, sha256: sha256(boundBytes) };
  });
  return {
    schema_version: 'fcs-package3-source-manifest-v1',
    package: 3,
    algorithm: 'sha256',
    inventory: 'EXACT_T001_T046_SOURCE_UNION_PLUS_GATE5_REPAIRS',
    normalization: 'TASK_CHECKBOX_MARKERS_UNCHECKED_ONLY',
    file_count: files.length,
    aggregate_sha256: sha256(
      files.map((file) => `${file.sha256}  ${file.bytes}  ${file.path}\n`).join(''),
    ),
    files,
  };
}

export function verifyPackage3SourceManifest(repositoryRoot, recorded) {
  const expected = buildPackage3SourceManifest(repositoryRoot);
  if (JSON.stringify(recorded) !== JSON.stringify(expected)) {
    throw new Error('Package 3 source manifest mismatch');
  }
  return expected;
}

function identity(bytes) {
  return { sha256: sha256(bytes), bytes: bytes.length, git_blob_id: gitBlob(bytes) };
}

export function assertPackage2FrozenSource(repositoryRoot) {
  const manifestPath = '.artifacts/test/package2-source-manifest.json';
  const recorded = JSON.parse(
    git(repositoryRoot, ['show', `${PACKAGE2_COMMIT}:${manifestPath}`], true).toString('utf8'),
  );
  const tracked = git(
    repositoryRoot,
    ['ls-tree', '-r', '--name-only', '-z', PACKAGE2_COMMIT],
    true,
  )
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .sort();
  const excluded = new Set(recorded.exclusions.map(({ value }) => value));
  const files = tracked
    .filter((relativePath) => !excluded.has(relativePath))
    .map((relativePath) => ({
      path: relativePath,
      sha256: sha256(
        git(repositoryRoot, ['show', `${PACKAGE2_COMMIT}:${relativePath}`], true),
      ),
    }));
  const expected = {
    schema_version: 2,
    package: 2,
    algorithm: 'sha256',
    inventory: 'ALL_GIT_TRACKED_FILES',
    tracked_file_count: tracked.length,
    excluded_file_count: tracked.length - files.length,
    exclusions: recorded.exclusions,
    file_count: files.length,
    aggregate_sha256: sha256(
      files.map((file) => `${file.sha256}  ${file.path}\n`).join(''),
    ),
    files,
  };
  if (JSON.stringify(recorded) !== JSON.stringify(expected)) {
    throw new Error('Package 2 frozen source evidence drift');
  }
  return {
    package2_commit: PACKAGE2_COMMIT,
    package2_file_count: expected.file_count,
    package2_source_sha256: expected.aggregate_sha256,
  };
}

export function assertPackage3Authority(repositoryRoot) {
  const package2 = assertPackage2FrozenSource(repositoryRoot);
  const parent = String(
    git(repositoryRoot, ['show', '-s', '--format=%P', PROMPT_C_COMMIT]),
  ).trim();
  const message = String(
    git(repositoryRoot, ['show', '-s', '--format=%s', PROMPT_C_COMMIT]),
  ).trim();
  if (parent !== PROMPT_B_COMMIT || message !== 'docs: complete Package 3 Prompt C planning') {
    throw new Error('Prompt C immutable trust anchor drift');
  }
  const trustedManifest = git(
    repositoryRoot,
    ['show', `${PROMPT_C_COMMIT}:${PROMPT_C_MANIFEST}`],
    true,
  );
  const currentManifest = readReviewableFile(repositoryRoot, PROMPT_C_MANIFEST);
  if (!currentManifest.equals(trustedManifest)) {
    throw new Error('Prompt C manifest drift');
  }
  const manifest = JSON.parse(currentManifest.toString('utf8'));
  const artifacts = manifest.artifacts;
  if (!artifacts || typeof artifacts !== 'object' || Array.isArray(artifacts)) {
    throw new Error('Prompt C manifest structure drift');
  }
  let checked = 0;
  for (const [relativePath, expected] of Object.entries(artifacts)) {
    if (relativePath === TASKS_PATH) continue;
    const bytes = readReviewableFile(repositoryRoot, relativePath);
    if (JSON.stringify(identity(bytes)) !== JSON.stringify(expected)) {
      throw new Error(`Prompt C authority drift: ${relativePath}`);
    }
    const trusted = git(repositoryRoot, ['show', `${PROMPT_C_COMMIT}:${relativePath}`], true);
    if (!bytes.equals(trusted)) throw new Error(`Prompt C checkpoint drift: ${relativePath}`);
    checked += 1;
  }
  if (checked !== 14) throw new Error('Prompt C immutable artifact count drift');

  const tasks = readReviewableFile(repositoryRoot, TASKS_PATH).toString('utf8');
  const matches = [...tasks.matchAll(/^- \[([ xX])\] (T\d{3})\b/gmu)];
  const expectedIds = Array.from({ length: 46 }, (_, index) => `T${String(index + 1).padStart(3, '0')}`);
  if (
    matches.length !== 46 ||
    JSON.stringify(matches.map((match) => match[2])) !== JSON.stringify(expectedIds)
  ) {
    throw new Error('Package 3 task inventory drift');
  }
  const normalized = Buffer.from(tasks.replace(/^- \[[ xX]\] (T\d{3})\b/gmu, '- [ ] $1'));
  if (JSON.stringify(identity(normalized)) !== JSON.stringify(artifacts[TASKS_PATH])) {
    throw new Error('Package 3 task text drift outside checkboxes');
  }
  const completed = matches.filter((match) => match[1].toLowerCase() === 'x').length;
  if (completed !== 46) throw new Error(`Package 3 tasks incomplete: ${completed}/46`);
  return {
    ...package2,
    prompt_c_commit: PROMPT_C_COMMIT,
    prompt_c_artifacts_checked: checked,
    prompt_c_manifest_sha256: sha256(currentManifest),
    task_count: matches.length,
    completed_task_count: completed,
  };
}

export function assertPackage3ExternalAuthority(repositoryRoot, planningWorkspace) {
  if (!planningWorkspace) throw new Error('explicit --planning-workspace is required');
  const baselineBytes = readReviewableFile(repositoryRoot, AUTHORITY_BASELINE);
  const trustedBaseline = git(
    repositoryRoot,
    ['show', `${PROMPT_C_COMMIT}:${AUTHORITY_BASELINE}`],
    true,
  );
  if (!baselineBytes.equals(trustedBaseline)) throw new Error('Package 3 baseline drift');
  const baseline = JSON.parse(baselineBytes.toString('utf8'));
  const entries = [
    ...baseline.authority_files,
    ...baseline.sequencing_context_files,
    baseline.workflow_contract,
  ];
  if (entries.length !== 31) throw new Error('Package 3 authority source count drift');
  let anchors = 0;
  for (const entry of entries) {
    const persisted = entry.path;
    let absolutePath;
    if (persisted.startsWith('<PLANNING_WORKSPACE>/')) {
      absolutePath = path.join(planningWorkspace, persisted.slice('<PLANNING_WORKSPACE>/'.length));
    } else if (persisted.startsWith('<REPOSITORY_ROOT>/')) {
      absolutePath = path.join(repositoryRoot, persisted.slice('<REPOSITORY_ROOT>/'.length));
    } else {
      safeRelativePath(persisted);
      absolutePath = path.join(repositoryRoot, persisted);
    }
    const stat = lstatSync(absolutePath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`invalid authority file: ${persisted}`);
    }
    const bytes = readFileSync(absolutePath);
    const expected = {
      sha256: entry.sha256,
      bytes: entry.bytes,
      git_blob_id: entry.git_blob_id,
    };
    const actual = {
      sha256: sha256(bytes),
      bytes: bytes.length,
      git_blob_id: entry.git_blob_id === null ? null : gitBlob(bytes),
    };
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`Package 3 authority byte drift: ${persisted}`);
    }
    if (!Array.isArray(entry.anchors) || entry.anchors.length === 0) {
      throw new Error(`Package 3 authority anchors missing: ${persisted}`);
    }
    anchors += entry.anchors.length;
  }
  if (anchors !== 158) throw new Error('Package 3 authority anchor count drift');
  return { authority_files_checked: entries.length, authority_anchors_checked: anchors };
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

function main() {
  if (!process.argv.includes('--check')) throw new Error('--check is required');
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = path.resolve(
    argumentValue('--repository-root') ?? path.join(scriptDirectory, '..'),
  );
  const planningWorkspace = argumentValue('--planning-workspace');
  const authority = assertPackage3Authority(repositoryRoot);
  const external = assertPackage3ExternalAuthority(repositoryRoot, planningWorkspace);
  const source = buildPackage3SourceManifest(repositoryRoot);
  process.stdout.write(
    `PACKAGE3_SOURCE_PASS files=${source.file_count} sha256=${source.aggregate_sha256} authority=${external.authority_files_checked} anchors=${external.authority_anchors_checked} tasks=${authority.completed_task_count} package2=${authority.package2_source_sha256}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `PACKAGE3_SOURCE_FAIL ${error instanceof Error ? error.message : 'unknown error'}\n`,
    );
    process.exitCode = 1;
  }
}
