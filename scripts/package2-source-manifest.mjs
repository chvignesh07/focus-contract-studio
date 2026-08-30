import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const PACKAGE2_SOURCE_EXCLUSIONS = Object.freeze([
  Object.freeze({
    match: 'EXACT_PATH',
    value: '.artifacts/browser/package2-local-journey.json',
    classification: 'SELF_REFERENTIAL_EVIDENCE',
    reason:
      'The generated browser receipt embeds this source digest and is independently checked by the Package 2 evidence binder.',
  }),
  Object.freeze({
    match: 'EXACT_PATH',
    value: '.artifacts/security/package2-security.json',
    classification: 'SELF_REFERENTIAL_EVIDENCE',
    reason:
      'The generated security receipt embeds this source count and digest and is independently checked by the Package 2 evidence binder.',
  }),
  Object.freeze({
    match: 'EXACT_PATH',
    value: '.artifacts/test/package2-local-gate.json',
    classification: 'SELF_REFERENTIAL_EVIDENCE',
    reason:
      'The generated local-gate receipt embeds this source count and digest and is independently checked by the Package 2 evidence binder.',
  }),
  Object.freeze({
    match: 'EXACT_PATH',
    value: '.artifacts/test/package2-source-manifest.json',
    classification: 'SELF_REFERENTIAL_EVIDENCE',
    reason: 'The generated source manifest cannot include its own bytes.',
  }),
  Object.freeze({
    match: 'EXACT_PATH',
    value: 'docs/evidence/PACKAGE2_VERIFICATION.md',
    classification: 'SELF_REFERENTIAL_EVIDENCE',
    reason:
      'The Package 2 verification summary embeds this manifest file count and digest and is checked by the Package 2 evidence binder.',
  }),
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function assertReviewableSource(relativePath, bytes) {
  let source;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`source is not valid UTF-8: ${relativePath}`);
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(source)) {
    throw new Error(`source contains a raw control byte: ${relativePath}`);
  }
}

function assertSafeRelativePath(relativePath) {
  if (
    typeof relativePath !== 'string' ||
    path.isAbsolute(relativePath) ||
    relativePath === '' ||
    relativePath === '.' ||
    relativePath.split('/').includes('..') ||
    /[\u0000-\u001f\u007f]/u.test(relativePath)
  ) {
    throw new Error(`unsafe source path: ${relativePath}`);
  }
}

function assertTrackedFile(repositoryRoot, relativePath) {
  assertSafeRelativePath(relativePath);
  const absolutePath = path.join(repositoryRoot, relativePath);
  const stat = lstatSync(absolutePath);
  if (stat.isSymbolicLink()) {
    throw new Error(`symbolic links are forbidden in the source manifest: ${relativePath}`);
  }
  if (!stat.isFile()) {
    throw new Error(`tracked source entry is not a regular file: ${relativePath}`);
  }
}

function trackedFiles(repositoryRoot) {
  const result = spawnSync(
    'git',
    ['-C', repositoryRoot, 'ls-files', '--cached', '--full-name', '-z'],
    { encoding: 'utf8' },
  );
  if (result.error) {
    throw new Error(`cannot enumerate tracked source: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `cannot enumerate tracked source: ${result.stderr.trim() || 'git ls-files failed'}`,
    );
  }
  const files = result.stdout.split('\0').filter(Boolean);
  if (files.length === 0) throw new Error('tracked source inventory is empty');
  for (const relativePath of files) assertSafeRelativePath(relativePath);
  files.sort();
  if (new Set(files).size !== files.length) {
    throw new Error('duplicate path in tracked source inventory');
  }
  return files;
}

function excludedBy(relativePath, exclusion) {
  if (exclusion.match === 'EXACT_PATH') return relativePath === exclusion.value;
  throw new Error(`unsupported source exclusion matcher: ${exclusion.match}`);
}

function isExcluded(relativePath) {
  return PACKAGE2_SOURCE_EXCLUSIONS.some((exclusion) =>
    excludedBy(relativePath, exclusion),
  );
}

export function buildPackage2SourceManifest(repositoryRoot) {
  const tracked = trackedFiles(repositoryRoot);
  const sourceFiles = tracked.filter((relativePath) => !isExcluded(relativePath));
  const files = sourceFiles.map((relativePath) => {
    assertTrackedFile(repositoryRoot, relativePath);
    const bytes = readFileSync(path.join(repositoryRoot, relativePath));
    assertReviewableSource(relativePath, bytes);
    return { path: relativePath, sha256: sha256(bytes) };
  });
  const aggregate = sha256(
    files.map((file) => `${file.sha256}  ${file.path}\n`).join(''),
  );
  return {
    schema_version: 2,
    package: 2,
    algorithm: 'sha256',
    inventory: 'ALL_GIT_TRACKED_FILES',
    tracked_file_count: tracked.length,
    excluded_file_count: tracked.length - sourceFiles.length,
    exclusions: PACKAGE2_SOURCE_EXCLUSIONS.map((exclusion) => ({ ...exclusion })),
    file_count: files.length,
    aggregate_sha256: aggregate,
    files,
  };
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

function exactJsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function verifyPackage2SourceManifest(repositoryRoot, manifestPath) {
  const expected = buildPackage2SourceManifest(repositoryRoot);
  let recorded;
  try {
    recorded = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `cannot read Package 2 source manifest: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
  if (!exactJsonEqual(recorded, expected)) {
    throw new Error(
      `recorded manifest does not match Package 2 source; expected ${expected.file_count} files at ${expected.aggregate_sha256}`,
    );
  }
  return expected;
}

function main() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = path.resolve(
    argumentValue('--root') ?? path.join(scriptDirectory, '..'),
  );
  if (process.argv.includes('--print')) {
    process.stdout.write(
      `${JSON.stringify(buildPackage2SourceManifest(repositoryRoot), null, 2)}\n`,
    );
    return;
  }
  const manifestPath = path.resolve(
    argumentValue('--manifest') ??
      path.join(repositoryRoot, '.artifacts/test/package2-source-manifest.json'),
  );
  if (process.argv.includes('--write')) {
    const expectedPath = path.join(
      repositoryRoot,
      '.artifacts/test/package2-source-manifest.json',
    );
    if (manifestPath !== expectedPath) {
      throw new Error('--write is limited to the repository Package 2 artifact path');
    }
    const result = buildPackage2SourceManifest(repositoryRoot);
    writeFileSync(manifestPath, `${JSON.stringify(result, null, 2)}\n`, {
      mode: 0o644,
    });
    process.stdout.write(
      `SOURCE_MANIFEST_WRITTEN files=${result.file_count} sha256=${result.aggregate_sha256}\n`,
    );
    return;
  }
  const result = verifyPackage2SourceManifest(repositoryRoot, manifestPath);
  process.stdout.write(
    `SOURCE_MANIFEST_PASS files=${result.file_count} sha256=${result.aggregate_sha256}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `SOURCE_MANIFEST_FAIL ${error instanceof Error ? error.message : 'unknown error'}\n`,
    );
    process.exitCode = 1;
  }
}
