import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../..',
);
const candidateRoots = [
  'lib/domain/focus-rehearsal.ts',
  'lib/domain/focus-event-verifier.ts',
  'app/delete-account-dialog.tsx',
] as const;
const forbidden =
  /retrieval|precedent|proposal|review-decision|reference-evaluator|holdout|benchmark|model-|expected[-_ ]events?|test\/|tests\/|fixture/iu;

function localImports(relativePath: string): string[] {
  const source = readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
  assert.doesNotMatch(source, forbidden, relativePath);
  const directory = path.posix.dirname(relativePath);
  return [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)]
    .map((match) => match[1])
    .filter((specifier) => specifier.startsWith('.'))
    .map((specifier) => path.posix.normalize(path.posix.join(directory, specifier)))
    .map((candidate) =>
      existsSync(path.join(repositoryRoot, candidate))
        ? candidate
        : `${candidate}.ts`,
    )
    .filter((candidate) => existsSync(path.join(repositoryRoot, candidate)));
}

test('observer and verifier have no direct or transitive forbidden authority dependency', () => {
  const roots = candidateRoots.filter((relativePath) =>
    existsSync(path.join(repositoryRoot, relativePath)),
  );
  const pending: string[] = [...roots];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const relativePath = pending.pop()!;
    assert.ok(existsSync(path.join(repositoryRoot, relativePath)), relativePath);
    if (visited.has(relativePath)) continue;
    visited.add(relativePath);
    pending.push(...localImports(relativePath));
  }
  assert.ok(visited.has('lib/domain/focus-rehearsal.ts'));
  assert.ok(visited.has('lib/domain/focus-configuration.ts'));
  if (existsSync(path.join(repositoryRoot, 'lib/domain/focus-event-verifier.ts'))) {
    assert.ok(visited.has('lib/domain/focus-event-verifier.ts'));
  }
});

test('production observer and verifier never manufacture browser events or verdicts', () => {
  const observer = readFileSync(
    path.join(repositoryRoot, 'app/delete-account-dialog.tsx'),
    'utf8',
  );
  const rehearsal = readFileSync(
    path.join(repositoryRoot, 'lib/domain/focus-rehearsal.ts'),
    'utf8',
  );
  assert.doesNotMatch(observer, /dispatchEvent|new KeyboardEvent|expected|verdict/iu);
  assert.doesNotMatch(rehearsal, /dispatchEvent|new KeyboardEvent|expected|verdict/iu);
});
