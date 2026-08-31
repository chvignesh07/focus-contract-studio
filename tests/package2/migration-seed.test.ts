import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import { materializeCorpusV2 } from '../../lib/retrieval/corpus-v2';
import { bootstrapWorkspace } from '../../lib/server/workspaces';

const secrets = {
  sessionSecret: 'package2-test-session-secret-material-32-bytes-minimum',
  csrfSecret: 'package2-test-csrf-secret-material-32-bytes-minimum',
};

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM workspaces').run();
});

test('additive Package 2 migration installs indexed immutable retrieval profiles', async () => {
  expect(env.PACKAGE2_TEST_MIGRATIONS.map(({ name }) => name)).toEqual([
    '0001_package1_domain.sql',
    '0002_package2_vertical_slice.sql',
  ]);
  const table = await env.DB.prepare(
    `SELECT sql FROM sqlite_schema
      WHERE type = 'table' AND name = 'precedent_retrieval_profiles'`,
  ).first<{ sql: string }>();
  expect(table?.sql).toMatch(/STRICT$/u);
  expect(table?.sql).toMatch(/FOREIGN KEY \(workspace_id, record_id\)/u);

  const index = await env.DB.prepare(
    `SELECT sql FROM sqlite_schema
      WHERE type = 'index' AND name = 'idx_precedent_profiles_eligibility'`,
  ).first<{ sql: string }>();
  expect(index?.sql).toMatch(/workspace_id, product, component_family, use_case/u);

  const immutable = await env.DB.prepare(
    `SELECT sql FROM sqlite_schema
      WHERE type = 'trigger' AND name = 'trg_precedent_profiles_immutable_update'`,
  ).first<{ sql: string }>();
  expect(immutable?.sql).toContain('PRECEDENT_PROFILE_IMMUTABLE');
});

test('fresh anonymous workspace materializes the 34 current-workspace records and excludes the two foreign records', async () => {
  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: 1_788_100_000,
    tokenBytes: new Uint8Array(32).fill(41),
    ...secrets,
  });
  const counts = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM precedent_records WHERE workspace_id = ?) AS records,
       (SELECT COUNT(*) FROM precedent_retrieval_profiles WHERE workspace_id = ?) AS profiles`,
  )
    .bind(session.workspace.id, session.workspace.id)
    .first<{ records: number; profiles: number }>();
  expect(counts).toEqual({ records: 34, profiles: 34 });

  const expectedKeys = materializeCorpusV2()
    .records.filter((record) => record.workspaceKey === 'demo-seed')
    .map((record) => record.id)
    .sort();
  const stored = await env.DB.prepare(
    `SELECT record_key FROM precedent_records
      WHERE workspace_id = ? ORDER BY record_key`,
  )
    .bind(session.workspace.id)
    .all<{ record_key: string }>();
  expect(stored.results.map((record) => record.record_key)).toEqual(expectedKeys);
  expect(expectedKeys).not.toContain('D007');
  expect(expectedKeys).not.toContain('D031');

  const d001Edges = await env.DB.prepare(
    `SELECT e.target_kind, e.target_key
       FROM precedent_subject_edges e
       JOIN precedent_records p
         ON p.workspace_id = e.workspace_id AND p.id = e.record_id
      WHERE e.workspace_id = ? AND p.record_key = 'D001'
      ORDER BY e.target_kind, e.target_key`,
  )
    .bind(session.workspace.id)
    .all<{ target_kind: string; target_key: string }>();
  expect(d001Edges.results).toEqual([
    { target_kind: 'variant', target_key: 'delete-account-standard' },
  ]);
});

test('Package 2 proposal finalizer requires agent proposed state and support for every changed field', async () => {
  const observationIndex = await env.DB.prepare(
    `SELECT sql FROM sqlite_schema
      WHERE type = 'index' AND name = 'idx_initial_focus_one_report_per_revision'`,
  ).first<{ sql: string }>();
  expect(observationIndex?.sql).toMatch(
    /UNIQUE INDEX idx_initial_focus_one_report_per_revision[\s\S]*workspace_id, variant_id, implemented_revision[\s\S]*verified_fail/u,
  );

  const trigger = await env.DB.prepare(
    `SELECT sql FROM sqlite_schema
      WHERE type = 'trigger' AND name = 'trg_proposal_success_audit_finalizer'`,
  ).first<{ sql: string }>();
  expect(trigger?.sql).toMatch(/p\.status = 'proposed'/u);
  expect(trigger?.sql).toMatch(/p\.author_kind = 'agent'/u);
  expect(trigger?.sql).toContain('json_array_length(p.evidence_record_ids_json) BETWEEN 1 AND 3');
  expect(trigger?.sql).toContain('COUNT(DISTINCT cited.value)');
  expect(trigger?.sql).toContain('json_each(p.support_map_json)');
  expect(trigger?.sql).toContain('cited_record.record_key = support.value');
  expect(trigger?.sql).toContain('e.normalized_outcome_key <> evidence_record.normalized_outcome_key');
  expect(trigger?.sql).toContain('EVIDENCE_FOR_UNCHANGED_FIELD');
  for (const field of [
    'initialFocus',
    'focusOrder',
    'trapTab',
    'trapShiftTab',
    'escapeAction',
    'returnFocus',
  ]) {
    expect(trigger?.sql).toContain(field);
  }
  expect(trigger?.sql).toContain('PROPOSAL_INCOMPLETE');

  const openConfigurationIndex = await env.DB.prepare(
    `SELECT sql FROM sqlite_schema
      WHERE type = 'index' AND name = 'idx_proposals_one_open_configuration'`,
  ).first<{ sql: string }>();
  expect(openConfigurationIndex?.sql).toMatch(
    /UNIQUE INDEX idx_proposals_one_open_configuration[\s\S]*workspace_id, variant_id, base_implemented_revision, configuration_json[\s\S]*WHERE status IN \('proposed', 'approved'\)/u,
  );
});
