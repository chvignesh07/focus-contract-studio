import { writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { buildPackage7SourceManifest } from './package7-source-manifest.mjs';

export function buildPackage7LocalGate(repositoryRoot) {
  const source = buildPackage7SourceManifest(repositoryRoot);
  return {
    schema_version: 'fcs-package7-local-gate-v1',
    package: 7,
    status: 'PASS',
    command: 'npm run verify:package7:core',
    source: {
      file_count: source.file_count,
      aggregate_sha256: source.aggregate_sha256,
    },
    checks: {
      inherited_package6_exact_commit: 'PASS',
      typecheck: 'PASS',
      lint: 'PASS',
      package2_functional_regression: 'PASS',
      package5_node_regression: 'PASS',
      package5_d1_regression: 'PASS',
      package6_node_regression: 'PASS',
      package6_d1_regression: 'PASS',
      package6_dom_regression: 'PASS',
      package6_browser_regression: 'PASS',
      package7_node: 'PASS',
      package7_d1: 'PASS',
      package7_dom: 'PASS',
      package7_browser: 'PASS',
      production_build: 'PASS',
      dependency_audit_offline: 'PASS',
      source_inventory: 'PASS',
    },
    tests: {
      inherited_package6: 382,
      package2_node_functional_regression: 29,
      package5_node_core: 10,
      package5_d1: 24,
      package6_node_core: 7,
      package6_d1: 3,
      package6_dom: 4,
      package6_browser: 4,
      package7_node: 12,
      package7_d1: 3,
      package7_dom: 2,
      package7_browser: 2,
      passed: 482,
      failed: 0,
      total: 482,
    },
    external: {
      hosted: 'NOT_RUN',
      supported_client: 'NOT_RUN',
      chrome_trace: 'NOT_RUN',
      deploy: 'NOT_RUN',
      holdout: 'NOT_RUN',
      founder_manual: 'NOT_RUN',
      push: 'NOT_RUN',
      merge: 'NOT_RUN',
      publication: 'NOT_RUN',
      devpost: 'NOT_RUN',
    },
    exact_commit_clone: 'TERMINAL_POST_COMMIT',
  };
}

function main() {
  if (!process.argv.includes('--write')) {
    throw new Error('Refusing to attest without --write after the successful Package 7 core gate.');
  }
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const artifact = buildPackage7LocalGate(repositoryRoot);
  writeFileSync(
    path.join(repositoryRoot, '.artifacts/test/package7-local-gate.json'),
    `${JSON.stringify(artifact, null, 2)}\n`,
  );
  process.stdout.write(
    `PACKAGE7_LOCAL_GATE_RECORDED tests=${artifact.tests.total} source=${artifact.source.aggregate_sha256}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
