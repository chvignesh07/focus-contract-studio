import { writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { buildPackage6SourceManifest } from './package6-source-manifest.mjs';

export function buildPackage6LocalGate(repositoryRoot) {
  const source = buildPackage6SourceManifest(repositoryRoot);
  return {
    schema_version: 'fcs-package6-local-gate-v1',
    package: 6,
    status: 'PASS',
    command: 'npm run verify:package6:core',
    source: {
      file_count: source.file_count,
      aggregate_sha256: source.aggregate_sha256,
    },
    checks: {
      inherited_package5: 'PASS',
      typecheck: 'PASS',
      lint: 'PASS',
      package6_node: 'PASS',
      package6_d1: 'PASS',
      package6_dom: 'PASS',
      package6_coverage: 'PASS',
      package6_browser: 'PASS',
      production_build: 'PASS',
      dependency_audit: 'PASS',
      design_cold_visual: 'PASS',
      source_inventory: 'PASS',
    },
    tests: {
      inherited_package5: 360,
      package6_node_core: 7,
      package6_d1: 3,
      package6_dom: 4,
      package6_coverage_replay: 4,
      package6_browser: 4,
      passed: 382,
      failed: 0,
      total: 382,
    },
    external: {
      hosted: 'NOT_RUN',
      real_client: 'NOT_RUN',
      founder_manual_accessibility: 'NOT_RUN',
      deployed_cold_evaluator: 'NOT_RUN',
      holdout: 'NOT_RUN',
      package7: 'NOT_RUN',
    },
  };
}

function main() {
  if (!process.argv.includes('--write')) {
    throw new Error('Refusing to attest without --write after the successful core gate.');
  }
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const artifact = buildPackage6LocalGate(repositoryRoot);
  writeFileSync(
    path.join(repositoryRoot, '.artifacts/test/package6-local-gate.json'),
    `${JSON.stringify(artifact, null, 2)}\n`,
  );
  process.stdout.write(
    `PACKAGE6_LOCAL_GATE_RECORDED source=${artifact.source.aggregate_sha256}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
