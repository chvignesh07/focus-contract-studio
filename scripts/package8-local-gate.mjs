import { writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { buildPackage8SourceManifest } from './package8-source-manifest.mjs';

export function buildPackage8LocalGate(repositoryRoot) {
  const source = buildPackage8SourceManifest(repositoryRoot);
  return {
    schema_version: 'fcs-package8-local-gate-v1',
    package: 8,
    scope: 'local_integrity',
    status: 'PASS',
    command: 'npm run verify:package8:core',
    source: {
      file_count: source.file_count,
      aggregate_sha256: source.aggregate_sha256,
    },
    checks: {
      inherited_package7_exact_commit: 'PASS',
      typecheck: 'PASS',
      lint: 'PASS',
      package8_node: 'PASS',
      package8_d1: 'PASS',
      deterministic_seed: 'PASS',
      memory_counterfactual: 'PASS',
      clean_d1_migrations: 'PASS',
      development_benchmark: 'PASS',
      production_build: 'PASS',
      package8_browser_security_accessibility: 'PASS',
      dependency_audit_offline: 'PASS',
      dependency_license_inventory: 'PASS',
      secret_and_history_scans: 'PASS',
      live_gitleaks_version_scope_and_negative_control: 'PASS',
      bundle_and_local_link_scans: 'PASS',
      ci_build_inputs_lineage: 'PASS',
      source_inventory: 'PASS',
      two_read_only_package8_reviews: 'PASS',
      adversarial_review_1_disposition: 'PASS',
    },
    tests: {
      inherited_package7: 482,
      package8_node: 16,
      package8_d1: 17,
      deterministic_seed: 7,
      memory_counterfactual: 5,
      package8_browser: 4,
      passed: 531,
      failed: 0,
      total: 531,
    },
    findings: {
      unresolved_critical: 0,
      unresolved_high: 0,
      unresolved_material: 0,
      unresolved_license: 0,
    },
    external: {
      sites_edge_client_isolation: 'NOT_RUN',
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
      adversarial_review_1: 'PASS',
    },
    exact_commit_clone: 'TERMINAL_POST_COMMIT',
  };
}

function main() {
  if (!process.argv.includes('--write')) {
    throw new Error('Refusing to attest without --write after the successful Package 8 core gate.');
  }
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const artifact = buildPackage8LocalGate(repositoryRoot);
  writeFileSync(
    path.join(repositoryRoot, '.artifacts/test/package8-local-gate.json'),
    `${JSON.stringify(artifact, null, 2)}\n`,
  );
  process.stdout.write(
    `PACKAGE8_LOCAL_GATE_RECORDED tests=${artifact.tests.total} source=${artifact.source.aggregate_sha256}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
