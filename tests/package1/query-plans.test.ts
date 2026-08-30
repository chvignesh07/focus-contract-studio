import { env } from 'cloudflare:workers';
import { expect, test } from 'vitest';

async function plan(sql: string, ...bindings: unknown[]): Promise<string> {
  const result = await env.DB.prepare(`EXPLAIN QUERY PLAN ${sql}`)
    .bind(...bindings)
    .all<{ detail: string }>();
  return result.results.map(({ detail }) => detail).join('\n');
}

test('session, active-view, revision, and lifecycle queries use declared indexes', async () => {
  expect(
    await plan(
      `SELECT id FROM workspaces INDEXED BY idx_workspaces_subject_current
       WHERE subject_kind = ? AND subject_key = ? AND purged_at IS NULL`,
      'anonymous',
      'a'.repeat(64),
    ),
  ).toContain('idx_workspaces_subject_current');
  expect(
    await plan(
      `SELECT id FROM workspaces
       WHERE subject_kind = 'anonymous' AND grace_expires_at < ?
       ORDER BY grace_expires_at, id LIMIT 10`,
      100,
    ),
  ).toContain('idx_workspaces_cleanup');
  expect(
    await plan(
      `SELECT id FROM component_variants
       WHERE workspace_id = ? AND slug = ?`,
      'workspace',
      'delete-account-standard',
    ),
  ).toContain('idx_component_variants_workspace_slug');
  expect(
    await plan(
      `SELECT id FROM implemented_focus_revisions
       WHERE workspace_id = ? AND variant_id = ? AND revision = ?`,
      'workspace',
      'variant',
      1,
    ),
  ).toContain('idx_focus_revisions_workspace_variant_revision');
});

test('Package 2 precedent, observation, proposal, and audit lookups are indexed now', async () => {
  expect(
    await plan(
      `SELECT id FROM precedent_records
       WHERE workspace_id = ? AND dataset_version = ? AND status = 'active'
         AND valid_from <= ? AND (valid_until IS NULL OR valid_until > ?)
         AND behavior = ?
       ORDER BY id LIMIT 36`,
      'workspace',
      'fcs-precedent-v2',
      100,
      100,
      'initial-focus',
    ),
  ).toContain('idx_precedent_eligibility');
  expect(
    await plan(
      `SELECT record_id FROM precedent_subject_edges
       WHERE workspace_id = ? AND target_kind = ? AND target_key = ?
       ORDER BY record_id`,
      'workspace',
      'variant',
      'delete-account-standard',
    ),
  ).toContain('idx_precedent_edges_subject');
  expect(
    await plan(
      `SELECT id FROM observation_sessions
       WHERE workspace_id = ? AND variant_id = ? AND state = 'finalized'
       ORDER BY created_at DESC LIMIT 1`,
      'workspace',
      'variant',
    ),
  ).toContain('idx_observation_sessions_latest');
  expect(
    await plan(
      `SELECT id FROM idempotency_records
       WHERE workspace_id = ? AND operation = ? AND idempotency_key = ?`,
      'workspace',
      'create_proposal',
      'key',
    ),
  ).toContain('idx_idempotency_workspace_operation_key');
  expect(
    await plan(
      `SELECT id FROM audit_events
       WHERE workspace_id = ? AND target_kind = ? AND target_id = ?
       ORDER BY occurred_at DESC`,
      'workspace',
      'proposal',
      'proposal',
    ),
  ).toContain('idx_audit_workspace_target_time');
});
