import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';

await applyD1Migrations(
  env.DB,
  env.PACKAGE1_TEST_MIGRATIONS,
  'package1_test_migrations',
);
await applyD1Migrations(
  env.UPGRADE_DB,
  env.PACKAGE0_UPGRADE_MIGRATIONS,
  'package0_upgrade_migrations',
);
await env.UPGRADE_DB.batch([
  env.UPGRADE_DB.prepare(
    `INSERT INTO package0_parent (id, slug) VALUES (41, 'preserve-parent')`,
  ),
  env.UPGRADE_DB.prepare(
    `INSERT INTO package0_child (id, parent_id, score) VALUES (42, 41, 7)`,
  ),
  env.UPGRADE_DB.prepare(`CREATE TABLE __fcs_package0_probe_gate_20260829_6f1f3d8c (
    marker TEXT PRIMARY KEY,
    operator_token_sha256 TEXT NOT NULL,
    state TEXT NOT NULL,
    run_window_not_before INTEGER NOT NULL,
    run_window_expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  ) STRICT`),
  env.UPGRADE_DB.prepare(`INSERT INTO __fcs_package0_probe_gate_20260829_6f1f3d8c VALUES (
    'focus-contract-studio-package0-revision2',
    'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    'FAILED', 100, 200, 150
  )`),
  env.UPGRADE_DB.prepare(`CREATE TABLE unrelated_preexisting_data (
    id INTEGER PRIMARY KEY,
    marker TEXT NOT NULL
  ) STRICT`),
  env.UPGRADE_DB.prepare(
    `INSERT INTO unrelated_preexisting_data VALUES (1, 'must-survive-package1')`,
  ),
]);
await applyD1Migrations(
  env.UPGRADE_DB,
  env.PACKAGE1_TEST_MIGRATIONS,
  'package1_test_migrations',
);
