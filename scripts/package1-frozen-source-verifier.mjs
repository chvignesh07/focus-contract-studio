import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const PACKAGE1_PUBLISHED_HEAD =
  'e560e0998f24cda1c7c8c2740b67ece487b1ea52';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

function git(repositoryRoot, args, encoding = 'utf8') {
  const result = spawnSync('git', ['-C', repositoryRoot, ...args], {
    encoding,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString('utf8')
      : result.stderr;
    throw new Error(`git ${args[0]} failed: ${String(stderr).trim()}`);
  }
  return result.stdout;
}

function assertSafePath(relativePath) {
  if (
    typeof relativePath !== 'string' ||
    relativePath.length === 0 ||
    path.isAbsolute(relativePath) ||
    relativePath.split('/').includes('..')
  ) {
    throw new Error('historical manifest contains an unsafe path');
  }
}

function readManifest(manifestPath) {
  let value;
  try {
    value = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `cannot read historical manifest: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
  if (
    value?.schema_version !== 1 ||
    value?.algorithm !== 'sha256' ||
    !Array.isArray(value.source_roots) ||
    !Array.isArray(value.files) ||
    value.file_count !== value.files.length ||
    !/^[0-9a-f]{64}$/u.test(value.aggregate_sha256)
  ) {
    throw new Error('historical manifest shape is invalid');
  }
  for (const root of value.source_roots) assertSafePath(root);
  for (const file of value.files) {
    assertSafePath(file?.path);
    if (!/^[0-9a-f]{64}$/u.test(file?.sha256)) {
      throw new Error('historical manifest file digest is invalid');
    }
  }
  return value;
}

function treeFiles(repositoryRoot, sourceRoots) {
  const raw = git(
    repositoryRoot,
    ['ls-tree', '-r', '-z', PACKAGE1_PUBLISHED_HEAD, '--', ...sourceRoots],
    'buffer',
  );
  const entries = raw
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const match = /^(\d+) (\w+) ([0-9a-f]+)\t(.+)$/u.exec(entry);
      if (!match || match[2] !== 'blob') {
        throw new Error('published Package 1 tree contains an unsupported entry');
      }
      if (match[1] === '120000') {
        throw new Error(`published Package 1 tree contains a symbolic link: ${match[4]}`);
      }
      return match[4];
    });
  return entries.sort((left, right) => left.localeCompare(right, 'en'));
}

export function verifyFrozenPackage1Source(repositoryRoot, manifestPath) {
  git(repositoryRoot, ['cat-file', '-e', `${PACKAGE1_PUBLISHED_HEAD}^{commit}`]);
  git(repositoryRoot, ['merge-base', '--is-ancestor', PACKAGE1_PUBLISHED_HEAD, 'HEAD']);
  const manifest = readManifest(manifestPath);
  const manifestPaths = manifest.files
    .map(({ path: relativePath }) => relativePath)
    .sort((left, right) => left.localeCompare(right, 'en'));
  if (new Set(manifestPaths).size !== manifestPaths.length) {
    throw new Error('historical manifest contains duplicate paths');
  }
  const publishedPaths = treeFiles(repositoryRoot, manifest.source_roots);
  if (JSON.stringify(publishedPaths) !== JSON.stringify(manifestPaths)) {
    throw new Error('historical manifest paths do not match the published Package 1 tree');
  }

  const verifiedFiles = manifestPaths.map((relativePath) => {
    const bytes = git(
      repositoryRoot,
      ['show', `${PACKAGE1_PUBLISHED_HEAD}:${relativePath}`],
      'buffer',
    );
    return { path: relativePath, sha256: sha256(bytes) };
  });
  const recordedByPath = new Map(
    manifest.files.map((file) => [file.path, file.sha256]),
  );
  for (const file of verifiedFiles) {
    if (recordedByPath.get(file.path) !== file.sha256) {
      throw new Error(`historical digest mismatch: ${file.path}`);
    }
  }
  const aggregate = sha256(
    verifiedFiles.map((file) => `${file.sha256}  ${file.path}\n`).join(''),
  );
  if (aggregate !== manifest.aggregate_sha256) {
    throw new Error('historical aggregate digest mismatch');
  }
  return { commit: PACKAGE1_PUBLISHED_HEAD, files: verifiedFiles.length, sha256: aggregate };
}

function main() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = path.resolve(
    argumentValue('--root') ?? path.join(scriptDirectory, '..'),
  );
  const manifestPath = path.resolve(
    argumentValue('--manifest') ??
      path.join(repositoryRoot, '.artifacts/test/package1-source-manifest.json'),
  );
  const result = verifyFrozenPackage1Source(repositoryRoot, manifestPath);
  process.stdout.write(
    `FROZEN_SOURCE_PASS commit=${result.commit} files=${result.files} sha256=${result.sha256}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `FROZEN_SOURCE_FAIL ${error instanceof Error ? error.message : 'unknown error'}\n`,
    );
    process.exitCode = 1;
  }
}
