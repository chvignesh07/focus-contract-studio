import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { expect, test } from 'vitest';

const domainTables = [
  'application_commits',
  'application_guards',
  'application_receipts',
  'audit_events',
  'component_variants',
  'idempotency_records',
  'implemented_focus_revisions',
  'observation_events',
  'observation_sessions',
  'precedent_lineage',
  'precedent_records',
  'precedent_subject_edges',
  'proposal_evidence',
  'proposals',
  'rate_limit_windows',
  'rendered_manifests',
  'retrieval_queries',
  'retrieval_results',
  'review_decisions',
  'verification_checks',
  'verification_receipts',
  'workspace_view_state',
  'workspaces',
] as const;

const evolvedDomainTables = [
  ...domainTables,
  'initial_focus_observation_commits',
  'precedent_retrieval_profiles',
].sort();

async function schema(database: D1Database) {
  return database
    .prepare(
      `SELECT name, sql
       FROM sqlite_schema
       WHERE type = 'table'
         AND name NOT LIKE 'sqlite_%'
         AND name NOT LIKE '%_migrations'
         AND name NOT LIKE 'package0_%'
         AND name NOT LIKE '__fcs_package0_%'
         AND name <> '_cf_METADATA'
         AND name <> 'unrelated_preexisting_data'
       ORDER BY name`,
    )
    .all<{ name: string; sql: string }>();
}

test('the evolved migration set preserves every Package 1 table and adds Package 2 tables as STRICT', async () => {
  const result = await schema(env.DB);
  expect(result.results.map(({ name }) => name)).toEqual(evolvedDomainTables);
  expect(result.results.map(({ name }) => name)).toEqual(
    expect.arrayContaining([...domainTables]),
  );
  for (const row of result.results) {
    expect(row.sql, row.name).toMatch(/\) STRICT$/);
  }
});

test('reapplying the ordered numbered migrations is a no-op', async () => {
  expect(env.PACKAGE1_TEST_MIGRATIONS.map(({ name }) => name)).toEqual([
    '0001_package1_domain.sql',
    '0002_package2_vertical_slice.sql',
  ]);
  const before = await schema(env.DB);
  await applyD1Migrations(
    env.DB,
    env.PACKAGE1_TEST_MIGRATIONS,
    'package1_test_migrations',
  );
  const after = await schema(env.DB);
  expect(after.results).toEqual(before.results);

  const journal = await env.DB
    .prepare('SELECT COUNT(*) AS count FROM package1_test_migrations')
    .first<{ count: number }>();
  expect(journal?.count).toBe(2);
});

test('the additive migration upgrades a database that contains the Package 0 probe', async () => {
  const package0Tables = await env.UPGRADE_DB.prepare(
    `SELECT name FROM sqlite_schema
     WHERE type = 'table' AND name IN ('package0_parent', 'package0_child')
     ORDER BY name`,
  ).all<{ name: string }>();
  expect(package0Tables.results.map(({ name }) => name)).toEqual([
    'package0_child',
    'package0_parent',
  ]);
  expect((await schema(env.UPGRADE_DB)).results.map(({ name }) => name)).toEqual(
    evolvedDomainTables,
  );
  expect(
    await env.UPGRADE_DB.prepare(
      `SELECT p.id, p.slug, c.id AS child_id, c.score
         FROM package0_parent p JOIN package0_child c ON c.parent_id = p.id`,
    ).first(),
  ).toEqual({ id: 41, slug: 'preserve-parent', child_id: 42, score: 7 });
  expect(
    await env.UPGRADE_DB.prepare(
      `SELECT marker, state FROM __fcs_package0_probe_gate_20260829_6f1f3d8c`,
    ).first(),
  ).toEqual({
    marker: 'focus-contract-studio-package0-revision2',
    state: 'FAILED',
  });
  expect(
    await env.UPGRADE_DB.prepare(
      `SELECT marker FROM unrelated_preexisting_data`,
    ).first(),
  ).toEqual({ marker: 'must-survive-package1' });
});

test('D1 enforces foreign keys for the migrated connection', async () => {
  const enabled = await env.DB.prepare('PRAGMA foreign_keys').first<{
    foreign_keys: number;
  }>();
  expect(enabled?.foreign_keys).toBe(1);
});
