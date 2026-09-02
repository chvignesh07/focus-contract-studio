import { FcsError } from '../../lib/server/errors';
import { getVariantForWorkspace } from '../../lib/server/workspaces';

export async function setActiveVariantFixture(
  db: D1Database,
  workspaceId: string,
  variantId: string,
  expectedViewRevision: number,
): Promise<void> {
  await getVariantForWorkspace(db, workspaceId, variantId);
  const result = await db.prepare(
    `UPDATE workspace_view_state
        SET active_variant_id = ?, view_revision = view_revision + 1,
            updated_at = updated_at + 1
      WHERE workspace_id = ? AND view_revision = ?`,
  ).bind(variantId, workspaceId, expectedViewRevision).run();
  if (!result.success || result.meta.changes !== 1) {
    throw new FcsError('VIEW_STATE_STALE', 'The current view changed. Reload and retry.', 409);
  }
}
