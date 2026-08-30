import { env } from 'cloudflare:workers';
import { expect, test } from 'vitest';

import {
  type DeclaredQuery,
  workspaceQueryInventory,
} from '../../lib/server/query-inventory';

const bindings: Record<string, unknown[]> = {
  resolveCurrentWorkspace: ['anonymous', 'a'.repeat(64)],
  resolveWorkspaceHistory: ['anonymous', 'a'.repeat(64)],
  cleanupExpiredWorkspaces: [100],
  getVariantForWorkspace: ['workspace', 'variant'],
  getActiveSeedState: ['workspace'],
  getResetIdempotency: ['workspace', 'key'],
  getWorkspaceById: ['workspace'],
};

test('the runtime query inventory has an enforced index or an explicit bounded primary-key lookup', async () => {
  expect(Object.keys(workspaceQueryInventory).sort()).toEqual(
    Object.keys(bindings).sort(),
  );
  for (const [name, rawQuery] of Object.entries(workspaceQueryInventory)) {
    const query: DeclaredQuery = rawQuery;
    const plan = await env.DB.prepare(`EXPLAIN QUERY PLAN ${query.sql}`)
      .bind(...bindings[name]!)
      .all<{ detail: string }>();
    const detail = plan.results.map(({ detail: row }) => row).join('\n');
    expect(query.maxRows, name).toBeLessThanOrEqual(10);
    if (query.expectedIndex) expect(detail, name).toContain(query.expectedIndex);
    else {
      expect(query.boundedRationale, name).toMatch(/primary key|one row/i);
      expect(detail, name).not.toMatch(/^SCAN /m);
    }
  }
});
