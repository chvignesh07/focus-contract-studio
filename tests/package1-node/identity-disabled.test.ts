import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../..',
);

test('Package 1/2 production paths cannot import or directly read inconclusive identity', async () => {
  const package0IdentityOnlyPaths = new Set([
    'app/chatgpt-auth.ts',
    'app/package0-hosted-probe-panel.tsx',
  ]);
  const seenAllowlistEntries = new Set<string>();
  const files: string[] = [];
  async function walk(relative: string): Promise<void> {
    const absolute = path.join(repositoryRoot, relative);
    for (const entry of await readdir(absolute, { withFileTypes: true })) {
      const next = path.join(relative, entry.name);
      if (entry.isDirectory()) await walk(next);
      else if (/\.[cm]?[tj]sx?$/.test(entry.name)) files.push(next);
    }
  }
  for (const root of ['app', 'lib']) await walk(root);
  for (const file of files) {
    if (package0IdentityOnlyPaths.has(file)) {
      seenAllowlistEntries.add(file);
      continue;
    }
    const source = await readFile(path.join(repositoryRoot, file), 'utf8');
    assert.doesNotMatch(source, /chatgpt-auth/, file);
    assert.doesNotMatch(
      source,
      /(?:oai-authenticated-user|cf-access-authenticated-user-email)/i,
      file,
    );
  }
  assert.deepEqual(
    [...seenAllowlistEntries].sort(),
    [...package0IdentityOnlyPaths].sort(),
    'every identity exception must remain an exact, existing Package 0 path',
  );
});
