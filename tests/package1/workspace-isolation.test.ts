import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import {
  bootstrapWorkspace,
  getVariantForWorkspace,
} from '../../lib/server/workspaces';
import type { FcsError } from '../../lib/server/errors';
import { setActiveVariantFixture } from '../helpers/set-active-variant';

const secrets = {
  sessionSecret: 'package1-test-session-secret-material-32-bytes-minimum',
  csrfSecret: 'package1-test-csrf-secret-material-32-bytes-minimum',
};

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM workspaces').run();
});

test('two sessions cannot observe or mutate each other and unavailable IDs are identical', async () => {
  const sessionA = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: 1_788_100_000,
    tokenBytes: new Uint8Array(32).fill(3),
    ...secrets,
  });
  const sessionB = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: 1_788_100_001,
    tokenBytes: new Uint8Array(32).fill(4),
    ...secrets,
  });
  expect(sessionA.workspace.id).not.toBe(sessionB.workspace.id);

  const variantA = await env.DB.prepare(
    `SELECT id FROM component_variants
       WHERE workspace_id = ? AND slug = 'delete-account-standard'`,
  )
    .bind(sessionA.workspace.id)
    .first<{ id: string }>();
  expect(variantA).not.toBeNull();

  const foreign = await getVariantForWorkspace(
    env.DB,
    sessionB.workspace.id,
    variantA!.id,
  ).catch((error: unknown) => error as FcsError);
  const nonexistent = await getVariantForWorkspace(
    env.DB,
    sessionB.workspace.id,
    '00000000-0000-4000-8000-000000009999',
  ).catch((error: unknown) => error as FcsError);
  expect(foreign).toMatchObject({ code: 'VARIANT_NOT_FOUND', status: 404 });
  expect(nonexistent).toMatchObject({ code: 'VARIANT_NOT_FOUND', status: 404 });
  const foreignEnvelope = (foreign as FcsError).toEnvelope();
  const missingEnvelope = (nonexistent as FcsError).toEnvelope();
  expect(foreignEnvelope.error.correlationId).toHaveLength(36);
  expect(missingEnvelope.error.correlationId).toHaveLength(36);
  expect({ ...foreignEnvelope.error, correlationId: '<safe-id>' }).toEqual({
    ...missingEnvelope.error,
    correlationId: '<safe-id>',
  });
  expect(JSON.stringify(foreignEnvelope)).toHaveLength(
    JSON.stringify(missingEnvelope).length,
  );

  await expect(
    setActiveVariantFixture(env.DB, sessionB.workspace.id, variantA!.id, 1),
  ).rejects.toMatchObject({ code: 'VARIANT_NOT_FOUND' });
  const stateA = await env.DB.prepare(
    `SELECT active_variant_id, view_revision FROM workspace_view_state WHERE workspace_id = ?`,
  )
    .bind(sessionA.workspace.id)
    .first<{ active_variant_id: string; view_revision: number }>();
  expect(stateA).toEqual({ active_variant_id: variantA!.id, view_revision: 1 });
});

test('active-variant compare-and-swap fails stably if the workspace disappears after lookup', async () => {
  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: 1_788_100_100,
    tokenBytes: new Uint8Array(32).fill(5),
    ...secrets,
  });
  const target = await env.DB.prepare(
    `SELECT id FROM component_variants
      WHERE workspace_id = ? AND slug = 'delete-account-danger-emphasis'`,
  )
    .bind(session.workspace.id)
    .first<{ id: string }>();
  expect(target).not.toBeNull();

  let injected = false;
  const raceDb = {
    prepare(query: string) {
      const statement = env.DB.prepare(query);
      if (!query.includes('UPDATE workspace_view_state')) return statement;
      return {
        bind(...values: unknown[]) {
          const bound = statement.bind(...values);
          return {
            async run() {
              if (!injected) {
                injected = true;
                await env.DB.prepare(`DELETE FROM workspaces WHERE id = ?`)
                  .bind(session.workspace.id)
                  .run();
              }
              return bound.run();
            },
          };
        },
      };
    },
  } as unknown as D1Database;

  await expect(
    setActiveVariantFixture(raceDb, session.workspace.id, target!.id, 1),
  ).rejects.toMatchObject({ code: 'VIEW_STATE_STALE', status: 409 });
  expect(injected).toBe(true);
  expect(
    await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM workspace_view_state WHERE workspace_id = ?`,
    )
      .bind(session.workspace.id)
      .first(),
  ).toEqual({ count: 0 });
});
