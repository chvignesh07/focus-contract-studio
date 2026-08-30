import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const PACKAGE2_SOURCE_ROOTS = Object.freeze([
  '.gitleaks.toml',
  '.gitignore',
  '.openai/hosting.json',
  'app',
  'db',
  'drizzle',
  'eslint.config.mjs',
  'lib',
  'next.config.ts',
  'package-lock.json',
  'package.json',
  'playwright.config.ts',
  'scripts/package1-frozen-source-verifier.mjs',
  'scripts/package2-evidence-binding.mjs',
  'scripts/package2-local-server.mjs',
  'scripts/package2-source-manifest.mjs',
  'tests/package1-node/source-manifest.test.ts',
  'tests/package1/schema-constraints.test.ts',
  'tests/package1/seed-reset.test.ts',
  'tests/package1/migrations.test.ts',
  'tests/package2',
  'tests/package2-browser',
  'tests/package2-dom',
  'tests/package2-node',
  'tsconfig.json',
  'vite.config.ts',
  'vitest.dom.config.ts',
  'vitest.package1.config.ts',
  'vitest.package2.config.ts',
  'wrangler.package2.jsonc',
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
  if (!stat.isDirectory()) throw new Error(`unsupported source entry: ${relativePath}`);
  for (const entry of readdirSync(absolutePath, { withFileTypes: true })) {
    collectFiles(repositoryRoot, path.posix.join(relativePath, entry.name), files);
  }
}

export function buildPackage2SourceManifest(repositoryRoot) {
  const sourceFiles = [];
  for (const sourceRoot of PACKAGE2_SOURCE_ROOTS) {
    collectFiles(repositoryRoot, sourceRoot, sourceFiles);
  }
  sourceFiles.sort((left, right) => left.localeCompare(right, 'en'));
  if (new Set(sourceFiles).size !== sourceFiles.length) {
    throw new Error('duplicate source path in Package 2 manifest scope');
  }
  const files = sourceFiles.map((relativePath) => {
    const bytes = readFileSync(path.join(repositoryRoot, relativePath));
    assertReviewableSource(relativePath, bytes);
    return { path: relativePath, sha256: sha256(bytes) };
  });
  const aggregate = sha256(
    files.map((file) => `${file.sha256}  ${file.path}\n`).join(''),
  );
  return {
    schema_version: 1,
    package: 2,
    algorithm: 'sha256',
    source_roots: [...PACKAGE2_SOURCE_ROOTS],
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
