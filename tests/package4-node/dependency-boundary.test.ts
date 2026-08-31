import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertPackage4ProductionBoundary,
  scanPackage4ProductionBoundary,
} from '../../scripts/package4-dependency-boundary.mjs';

const repositoryRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

function fixture(files: Record<string, string>, run: (root: string) => void) {
  const root = mkdtempSync(path.join(tmpdir(), 'fcs-package4-boundary-'));
  try {
    for (const [relativePath, source] of Object.entries(files)) {
      const absolutePath = path.join(root, relativePath);
      mkdirSync(path.dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, source);
    }
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('the complete production route/server/retrieval graph has only the sealed data-only corpus imports', () => {
  const result = assertPackage4ProductionBoundary(repositoryRoot);
  assert.ok(result.entryPaths.length >= 30);
  assert.ok(result.reachedPaths.length >= result.entryPaths.length);
  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.allowedCorpusImports, [
    {
      from: 'lib/retrieval/corpus-v2.ts',
      to: 'docs/retrieval/fixtures/rrf/rrf-corpus-overrides-v2.json',
    },
    {
      from: 'lib/retrieval/corpus-v2.ts',
      to: 'docs/retrieval/fixtures/rrf/rrf-corpus-v1.json',
    },
  ]);
});

test('direct and transitive benchmark, calibration, evaluator, and holdout dependencies are rejected without reading JSON content', () => {
  const planted: Record<string, Record<string, string>> = {
    direct: {
      'app/route.ts': "import holdout from '../docs/retrieval/fixtures/rrf/rrf-holdout-queries-v2.json' with { type: 'json' };\n",
      'docs/retrieval/fixtures/rrf/rrf-holdout-queries-v2.json': '{ deliberately-not-json',
    },
    transitive: {
      'app/route.ts': "import '../lib/bridge.ts';\n",
      'lib/bridge.ts': "export { default } from '../docs/retrieval/fixtures/rrf/RRF_V2_CALIBRATION.json' with { type: 'json' };\n",
      'docs/retrieval/fixtures/rrf/RRF_V2_CALIBRATION.json': '{}',
    },
    evaluator: {
      'app/route.ts': "import '../docs/retrieval/fixtures/rrf/reference-evaluator-v2.mjs';\n",
      'docs/retrieval/fixtures/rrf/reference-evaluator-v2.mjs': 'export default 1;\n',
    },
    development: {
      'app/route.ts': "import data from '../docs/retrieval/fixtures/rrf/rrf-dev-queries-v2.json' with { type: 'json' };\n",
      'docs/retrieval/fixtures/rrf/rrf-dev-queries-v2.json': '{}',
    },
  };
  for (const [name, files] of Object.entries(planted)) {
    fixture(files, (root) => {
      const result = scanPackage4ProductionBoundary(root, ['app/route.ts']);
      assert.ok(result.violations.some((violation) => violation.code === 'FORBIDDEN_DEPENDENCY'), name);
    });
  }
});

test('unresolved and non-literal local imports fail closed', () => {
  fixture(
    {
      'app/route.ts': "import '../lib/missing.ts';\nconst name = '../lib/runtime.ts';\nvoid import(name);\n",
    },
    (root) => {
      const result = scanPackage4ProductionBoundary(root, ['app/route.ts']);
      assert.deepEqual(
        result.violations.map(({ code }) => code).sort(),
        ['NON_LITERAL_DYNAMIC_IMPORT', 'UNRESOLVED_LOCAL_IMPORT'],
      );
    },
  );
});

test('corpus fixture allowance is exact to corpus-v2 and expected judgments are not consumed', () => {
  fixture(
    {
      'app/route.ts': "import '../lib/retrieval/corpus-v2.ts';\n",
      'lib/retrieval/corpus-v2.ts': "import corpus from '../../docs/retrieval/fixtures/rrf/rrf-corpus-v1.json' with { type: 'json' };\nvoid corpus.expected;\n",
      'docs/retrieval/fixtures/rrf/rrf-corpus-v1.json': '{}',
    },
    (root) => {
      const result = scanPackage4ProductionBoundary(root, ['app/route.ts']);
      assert.ok(result.violations.some(({ code }) => code === 'EXPECTED_JUDGMENT_ACCESS'));
    },
  );

  fixture(
    {
      'app/route.ts': "import corpus from '../docs/retrieval/fixtures/rrf/rrf-corpus-v1.json' with { type: 'json' };\nvoid corpus;\n",
      'docs/retrieval/fixtures/rrf/rrf-corpus-v1.json': '{}',
    },
    (root) => {
      const result = scanPackage4ProductionBoundary(root, ['app/route.ts']);
      assert.ok(result.violations.some(({ code }) => code === 'CORPUS_IMPORT_OUTSIDE_SEED_PATH'));
    },
  );
});
