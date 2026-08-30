import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import {
  bootstrapWorkspace,
  cleanupExpiredWorkspaces,
} from '../../lib/server/workspaces';
import { POST as bootstrapPost } from '../../app/api/session/bootstrap/route';

const secrets = {
  sessionSecret: 'package1-test-session-secret-material-32-bytes-minimum',
  csrfSecret: 'package1-test-csrf-secret-material-32-bytes-minimum',
};

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM workspaces').run();
});

test('cleanup deletes at most ten exact expired anonymous workspace graphs', async () => {
  for (let index = 0; index < 12; index += 1) {
    const created = await bootstrapWorkspace({
      db: env.DB,
      cookieHeader: null,
      now: 100 + index,
      tokenBytes: new Uint8Array(32).fill(index + 10),
      ...secrets,
    });
    await env.DB.prepare(
      `UPDATE workspaces
          SET last_access_at = 120, access_expires_at = 130, grace_expires_at = 140
        WHERE id = ?`,
    )
      .bind(created.workspace.id)
      .run();
  }
  const current = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: 200,
    tokenBytes: new Uint8Array(32).fill(99),
    ...secrets,
  });

  expect(await cleanupExpiredWorkspaces(env.DB, 150)).toBe(10);
  const remaining = await env.DB.prepare(
    `SELECT id FROM workspaces ORDER BY id`,
  ).all<{ id: string }>();
  expect(remaining.results).toHaveLength(3);
  expect(remaining.results.some(({ id }) => id === current.workspace.id)).toBe(
    true,
  );
  const orphanCount = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM component_variants v
      WHERE NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id = v.workspace_id)`,
  ).first<{ count: number }>();
  expect(orphanCount?.count).toBe(0);
});

test('paired cleanup workers are idempotent under overlapping candidates', async () => {
  for (let index = 0; index < 12; index += 1) {
    const created = await bootstrapWorkspace({
      db: env.DB,
      cookieHeader: null,
      now: 100 + index,
      tokenBytes: new Uint8Array(32).fill(index + 30),
      ...secrets,
    });
    await env.DB.prepare(
      `UPDATE workspaces
          SET access_expires_at = 130, grace_expires_at = 140
        WHERE id = ?`,
    )
      .bind(created.workspace.id)
      .run();
  }
  const deleted = await Promise.all([
    cleanupExpiredWorkspaces(env.DB, 150),
    cleanupExpiredWorkspaces(env.DB, 150),
  ]);
  expect(deleted.reduce((sum, count) => sum + count, 0)).toBe(10);
  expect(await cleanupExpiredWorkspaces(env.DB, 150)).toBe(2);
  expect(
    await env.DB.prepare('SELECT COUNT(*) AS count FROM workspaces').first(),
  ).toEqual({ count: 0 });
});

test('cleanup removes only expired anonymous graphs and preserves current and global rows', async () => {
  const expired = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: 100,
    tokenBytes: new Uint8Array(32).fill(81),
    ...secrets,
  });
  const alreadyPurged = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: 101,
    tokenBytes: new Uint8Array(32).fill(82),
    ...secrets,
  });
  const current = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: 102,
    tokenBytes: new Uint8Array(32).fill(83),
    ...secrets,
  });
  await env.DB.prepare(
    `UPDATE workspaces
        SET last_access_at = 120, access_expires_at = 130, grace_expires_at = 140
      WHERE id = ?`,
  )
    .bind(expired.workspace.id)
    .run();
  await env.DB.prepare(
    `UPDATE workspaces
        SET last_access_at = 120, access_expires_at = 130,
            grace_expires_at = 140, purged_at = 130
      WHERE id = ?`,
  )
    .bind(alreadyPurged.workspace.id)
    .run();
  await env.DB.prepare(
    `INSERT INTO rate_limit_windows (
       id, workspace_id, key_digest, operation, window_start,
       window_seconds, request_count, expires_at
     ) VALUES (?, NULL, ?, 'workspace_bootstrap', 100, 60, 1, 300)`,
  )
    .bind(
      '00000000-0000-4000-8000-000000008901',
      'a'.repeat(64),
    )
    .run();

  expect(await cleanupExpiredWorkspaces(env.DB, 150)).toBe(2);
  expect(
    await env.DB.prepare(`SELECT id FROM workspaces ORDER BY id`).all(),
  ).toMatchObject({ results: [{ id: current.workspace.id }] });
  expect(
    await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM component_variants
        WHERE workspace_id IN (?, ?)`,
    )
      .bind(expired.workspace.id, alreadyPurged.workspace.id)
      .first(),
  ).toEqual({ count: 0 });
  expect(
    await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM rate_limit_windows WHERE workspace_id IS NULL`,
    ).first(),
  ).toEqual({ count: 1 });
});

test('raw identity, IP, bearer, CSRF, and typed markers sent to routes never enter D1', async () => {
  const origin = 'https://focus-contract-studio.example';
  const response = await bootstrapPost(
    new Request(`${origin}/api/session/bootstrap`, {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        'oai-authenticated-user-email': 'private.person@example.com',
        'oai-authenticated-user-full-name': 'Private Person',
        'x-forwarded-for': '203.0.113.77',
      },
      body: '{}',
    }),
  );
  expect(response.status).toBe(201);
  const created = await response.json<{ data: { csrfToken: string } }>();
  const setCookie = response.headers.get('set-cookie')!;
  const rejected = await bootstrapPost(
    new Request(`${origin}/api/session/bootstrap`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ typedValue: 'typed-secret-marker' }),
    }),
  );
  expect(rejected.status).toBe(400);
  expect(await rejected.text()).not.toContain('typed-secret-marker');
  const forbidden = [
    'private.person@example.com',
    'Private Person',
    '203.0.113.77',
    created.data.csrfToken,
    setCookie.split(';', 1)[0]!.split('=', 2)[1]!,
    'typed-secret-marker',
  ];
  const tables = await env.DB.prepare(
    `SELECT name FROM sqlite_schema
      WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_cf_METADATA'`,
  ).all<{ name: string }>();
  const dump: unknown[] = [];
  for (const { name } of tables.results) {
    if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error('unsafe test table name');
    dump.push(...(await env.DB.prepare(`SELECT * FROM ${name}`).all()).results);
  }
  const serialized = JSON.stringify(dump);
  for (const marker of forbidden) expect(serialized).not.toContain(marker);
});
