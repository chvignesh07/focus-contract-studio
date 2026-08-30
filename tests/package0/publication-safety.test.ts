import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const repositoryRoot = new URL('../../', import.meta.url);

function git(args: string[]): string {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}

const forbiddenPrefixes = [
  ['', 'Users', 'vigneshch'].join('/'),
  ['', 'private', 'tmp'].join('/'),
];

test('publishable tracked content and every reachable commit use stable path placeholders', () => {
  const revisions = git(['rev-list', '--all'])
    .split('\n')
    .filter(Boolean);
  const violations: string[] = [];

  for (const revision of revisions) {
    for (const prefix of forbiddenPrefixes) {
      try {
        const matches = git([
          'grep',
          '-I',
          '-n',
          '--fixed-strings',
          prefix,
          revision,
        ]).trim();
        if (matches) violations.push(matches);
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status !== 1) throw error;
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `machine-specific paths remain in reachable Git history:\n${violations.join('\n')}`,
  );
});

