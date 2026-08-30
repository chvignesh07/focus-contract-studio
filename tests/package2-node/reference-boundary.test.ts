import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function sourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const full = path.join(root, entry);
    return statSync(full).isDirectory() ? sourceFiles(full) : [full];
  });
}

test('production retrieval cannot import evaluator, holdout, calibration, or expected judgments', () => {
  const files = sourceFiles(path.resolve('lib/retrieval')).filter((file) =>
    /\.(?:ts|tsx)$/u.test(file),
  );
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(
      source,
      /reference-evaluator|holdout|RRF_V2_CALIBRATION|\.expected\b|["']expected["']/u,
      path.relative(process.cwd(), file),
    );
  }
});

test('the browser observation derives its manifest from live DOM instead of importing the expected fixture', () => {
  for (const relative of [
    'app/delete-account-dialog.tsx',
    'app/focus-contract-studio.tsx',
  ]) {
    const source = readFileSync(path.resolve(relative), 'utf8');
    assert.doesNotMatch(source, /INITIAL_FOCUS_MANIFEST/u, relative);
  }
  assert.match(
    readFileSync(path.resolve('app/delete-account-dialog.tsx'), 'utf8'),
    /deriveInitialFocusManifest/u,
  );
});
