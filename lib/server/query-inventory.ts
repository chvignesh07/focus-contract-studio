export type DeclaredQuery = {
  sql: string;
  maxRows: number;
  expectedIndex?: string;
  boundedRationale?: string;
};

export const workspaceQueryInventory = {
  resolveCurrentWorkspace: {
    sql: `SELECT id, generation, subject_key, csrf_digest, access_expires_at, purged_at
            FROM workspaces INDEXED BY idx_workspaces_subject_current
           WHERE subject_kind = ? AND subject_key = ? AND purged_at IS NULL
           LIMIT 1`,
    maxRows: 1,
    expectedIndex: 'idx_workspaces_subject_current',
  },
  resolveWorkspaceHistory: {
    sql: `SELECT id, generation, subject_key, csrf_digest, access_expires_at, purged_at
            FROM workspaces INDEXED BY idx_workspaces_subject_history
           WHERE subject_kind = ? AND subject_key = ?
           ORDER BY purged_at IS NULL DESC, purged_at DESC
           LIMIT 1`,
    maxRows: 1,
    expectedIndex: 'idx_workspaces_subject_history',
  },
  cleanupExpiredWorkspaces: {
    sql: `SELECT id FROM workspaces
           WHERE subject_kind = 'anonymous' AND grace_expires_at < ?
           ORDER BY grace_expires_at, id LIMIT 10`,
    maxRows: 10,
    expectedIndex: 'idx_workspaces_cleanup',
  },
  getVariantForWorkspace: {
    sql: `SELECT id, slug, active_implemented_revision
            FROM component_variants
           WHERE workspace_id = ? AND id = ?
           LIMIT 1`,
    maxRows: 1,
    boundedRationale: 'Composite primary identity lookup returns at most one row.',
  },
  getVariantForWorkspaceBySlug: {
    sql: `SELECT id, slug, active_implemented_revision
            FROM component_variants
           WHERE workspace_id = ? AND slug = ?
           LIMIT 1`,
    maxRows: 1,
    boundedRationale: 'Workspace-scoped unique variant slug returns at most one row.',
  },
  getActiveSeedState: {
    sql: `SELECT v.slug, v.active_implemented_revision, s.view_revision
            FROM workspace_view_state s
            JOIN component_variants v
              ON v.workspace_id = s.workspace_id AND v.id = s.active_variant_id
           WHERE s.workspace_id = ?
           LIMIT 1`,
    maxRows: 1,
    boundedRationale: 'Workspace view-state primary key returns at most one row.',
  },
  getResetIdempotency: {
    sql: `SELECT request_hash, result_id, created_at
            FROM idempotency_records
           WHERE workspace_id = ? AND operation = 'reset' AND idempotency_key = ?
           LIMIT 1`,
    maxRows: 1,
    expectedIndex: 'idx_idempotency_workspace_operation_key',
  },
  getWorkspaceById: {
    sql: `SELECT id, generation FROM workspaces WHERE id = ? LIMIT 1`,
    maxRows: 1,
    boundedRationale: 'Workspace primary key returns at most one row.',
  },
} as const satisfies Record<string, DeclaredQuery>;
