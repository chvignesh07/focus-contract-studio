import { createHash } from 'node:crypto';
import {
  lstatSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const PACKAGE1_SOURCE_ROOTS = Object.freeze([
  'app/api/session',
  'db/env.d.ts',
  'db/schema.ts',
  'drizzle',
  'drizzle.config.ts',
  'lib',
  'package-lock.json',
  'package.json',
  'scripts/package1-evidence-binding.mjs',
  'scripts/package1-source-manifest.mjs',
  'tests/package1',
  'tests/package1-node',
  'vitest.package1.config.ts',
  'wrangler.package1.jsonc',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function assertSafeRelativePath(relativePath) {
  if (
    path.isAbsolute(relativePath) ||
    relativePath === '' ||
    relativePath === '.' ||
    relativePath.split('/').includes('..')
  ) {
    throw new Error(`unsafe source path: ${relativePath}`);
  }
}

function collectFiles(repositoryRoot, relativePath, files) {
  assertSafeRelativePath(relativePath);
  const absolutePath = path.join(repositoryRoot, relativePath);
  const stat = lstatSync(absolutePath);
  if (stat.isSymbolicLink()) {
    throw new Error(`symbolic links are forbidden in the source manifest: ${relativePath}`);
  }
  if (stat.isFile()) {
    files.push(relativePath);
    return;
  }
  if (!stat.isDirectory()) {
    throw new Error(`unsupported source entry: ${relativePath}`);
  }
  for (const entry of readdirSync(absolutePath, { withFileTypes: true })) {
    collectFiles(repositoryRoot, path.posix.join(relativePath, entry.name), files);
  }
}

export function buildPackage1SourceManifest(repositoryRoot) {
  const sourceFiles = [];
  for (const sourceRoot of PACKAGE1_SOURCE_ROOTS) {
    collectFiles(repositoryRoot, sourceRoot, sourceFiles);
  }
  sourceFiles.sort((left, right) => left.localeCompare(right, 'en'));
  if (new Set(sourceFiles).size !== sourceFiles.length) {
    throw new Error('duplicate source path in Package 1 manifest scope');
  }
  const files = sourceFiles.map((relativePath) => ({
    path: relativePath,
    sha256: sha256(readFileSync(path.join(repositoryRoot, relativePath))),
  }));
  const aggregateBytes = files
    .map((file) => `${file.sha256}  ${file.path}\n`)
    .join('');
  return {
    schema_version: 1,
    algorithm: 'sha256',
    source_roots: [...PACKAGE1_SOURCE_ROOTS],
    file_count: files.length,
    aggregate_sha256: sha256(aggregateBytes),
    files,
  };
}

function exactJsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function verifyPackage1SourceManifest(repositoryRoot, manifestPath) {
  const expected = buildPackage1SourceManifest(repositoryRoot);
  let recorded;
  try {
    recorded = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `cannot read source manifest: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
  if (!exactJsonEqual(recorded, expected)) {
    throw new Error(
      `recorded manifest does not match live source; expected ${expected.file_count} files at ${expected.aggregate_sha256}`,
    );
  }
  return expected;
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function main() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = path.resolve(
    argumentValue('--root') ?? path.join(scriptDirectory, '..'),
  );
  if (process.argv.includes('--print')) {
    process.stdout.write(
      `${JSON.stringify(buildPackage1SourceManifest(repositoryRoot), null, 2)}\n`,
    );
    return;
  }
  const manifestPath = path.resolve(
    argumentValue('--manifest') ??
      path.join(repositoryRoot, '.artifacts/test/package1-source-manifest.json'),
  );
  const result = verifyPackage1SourceManifest(repositoryRoot, manifestPath);
  process.stdout.write(
    `CONSISTENCY_PASS files=${result.file_count} sha256=${result.aggregate_sha256}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `CONSISTENCY_FAIL ${error instanceof Error ? error.message : 'unknown error'}\n`,
    );
    process.exitCode = 1;
  }
}
