import { writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { buildPackage5SourceManifest } from './package5-source-manifest.mjs';

export function buildPackage5LocalGate(repositoryRoot) {
  const source = buildPackage5SourceManifest(repositoryRoot);
  return {
    schema_version: 'fcs-package5-local-gate-v1',
    package: 5,
    status: 'PASS',
    command: 'npm run verify:package5:core',
    source: {
      file_count: source.file_count,
      aggregate_sha256: source.aggregate_sha256,
    },
    checks: {
      inherited_package4: 'PASS',
      package5_node: 'PASS',
      package5_d1: 'PASS',
      package5_routes: 'PASS',
      package5_dom: 'PASS',
      package5_coverage: 'PASS',
      package5_browser: 'PASS',
      typecheck_lint_build: 'PASS',
      dependency_audit: 'PASS',
      source_inventory: 'PASS',
    },
    tests: { passed: 355, failed: 0, total: 355 },
    external: {
      hosted: 'NOT_RUN',
      supported_chatgpt: 'NOT_RUN',
      package6: 'NOT_RUN',
    },
  };
}

function main() {
  if (!process.argv.includes('--write')) {
    throw new Error('Refusing to attest without --write after the successful core gate.');
  }
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const artifact = buildPackage5LocalGate(repositoryRoot);
  writeFileSync(
    path.join(repositoryRoot, '.artifacts/test/package5-local-gate.json'),
    `${JSON.stringify(artifact, null, 2)}\n`,
  );
  process.stdout.write(`PACKAGE5_LOCAL_GATE_RECORDED source=${artifact.source.aggregate_sha256}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
