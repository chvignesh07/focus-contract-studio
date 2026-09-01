import { env } from 'cloudflare:workers';
import { expect, test } from 'vitest';

async function schemaObject(type: 'table' | 'trigger' | 'index', name: string) {
  return env.DB.prepare(
    'SELECT name, sql FROM sqlite_master WHERE type = ? AND name = ?',
  ).bind(type, name).first<{ name: string; sql: string }>();
}

test('existing application and reset finalizers remain present', async () => {
  const application = await schemaObject('trigger', 'trg_application_commit_complete');
  expect(application).not.toBeNull();
  expect(application?.sql).toContain("sibling.status IN ('proposed', 'approved')");
  expect(await schemaObject('trigger', 'trg_reset_commit_complete')).not.toBeNull();
  expect(await schemaObject('index', 'idx_idempotency_workspace_operation_key')).not.toBeNull();
  const precedent = await schemaObject('table', 'precedent_records');
  expect(precedent?.sql).toContain('UNIQUE (workspace_id, record_key)');
});

test('review requires an immutable finalizer row and completeness trigger', async () => {
  expect(await schemaObject('table', 'review_commits')).not.toBeNull();
  expect(await schemaObject('trigger', 'trg_review_commit_complete')).not.toBeNull();
  expect(await schemaObject('trigger', 'trg_review_commits_immutable_update')).not.toBeNull();
  expect(await schemaObject('trigger', 'trg_review_commits_immutable_delete')).not.toBeNull();
});

test('undo requires an immutable finalizer row and completeness trigger', async () => {
  expect(await schemaObject('table', 'undo_commits')).not.toBeNull();
  expect(await schemaObject('trigger', 'trg_undo_commit_complete')).not.toBeNull();
  expect(await schemaObject('trigger', 'trg_undo_commits_immutable_update')).not.toBeNull();
  expect(await schemaObject('trigger', 'trg_undo_commits_immutable_delete')).not.toBeNull();
});

test('runtime precedent projection requires an immutable completeness finalizer', async () => {
  expect(await schemaObject('table', 'precedent_projection_commits')).not.toBeNull();
  expect(await schemaObject('trigger', 'trg_precedent_projection_commit_complete')).not.toBeNull();
  expect(await schemaObject('trigger', 'trg_precedent_projection_commits_immutable_update')).not.toBeNull();
  expect(await schemaObject('trigger', 'trg_precedent_projection_commits_immutable_delete')).not.toBeNull();
});
