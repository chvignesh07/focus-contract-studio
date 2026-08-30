import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import {
  bootstrapWorkspace,
  cleanupExpiredWorkspaces,
  resetWorkspace,
} from '../../lib/server/workspaces';

const secrets = {
  sessionSecret: 'package1-test-session-secret-material-32-bytes-minimum',
  csrfSecret: 'package1-test-csrf-secret-material-32-bytes-minimum',
};
const now = 1_788_100_000;

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM workspaces').run();
});

test('deterministic seed creates exactly two variants, revision 1 Delete, and D001 Cancel', async () => {
  const bootstrap = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now,
    tokenBytes: new Uint8Array(32).fill(1),
    ...secrets,
  });
  const variants = await env.DB.prepare(
    `SELECT product, family, use_case, slug, active_implemented_revision
       FROM component_variants WHERE workspace_id = ? ORDER BY slug`,
  )
    .bind(bootstrap.workspace.id)
    .all<{
      product: string;
      family: string;
      use_case: string;
      slug: string;
      active_implemented_revision: number;
    }>();
  expect(variants.results).toEqual([
    {
      product: 'focus-contract-studio',
      family: 'modal-dialog',
      use_case: 'delete-account',
      slug: 'delete-account-danger-emphasis',
      active_implemented_revision: 1,
    },
    {
      product: 'focus-contract-studio',
      family: 'modal-dialog',
      use_case: 'delete-account',
      slug: 'delete-account-standard',
      active_implemented_revision: 1,
    },
  ]);

  const revisions = await env.DB.prepare(
    `SELECT configuration_json FROM implemented_focus_revisions
       WHERE workspace_id = ? ORDER BY variant_id`,
  )
    .bind(bootstrap.workspace.id)
    .all<{ configuration_json: string }>();
  expect(revisions.results).toHaveLength(2);
  for (const revision of revisions.results) {
    expect(JSON.parse(revision.configuration_json)).toMatchObject({
      initialFocus: 'delete-button',
    });
  }

  const precedent = await env.DB.prepare(
    `SELECT record_key, behavior, normalized_outcome_key, provenance_kind
       FROM precedent_records WHERE workspace_id = ?`,
  )
    .bind(bootstrap.workspace.id)
    .first<Record<string, string>>();
  expect(precedent).toEqual({
    record_key: 'D001',
    behavior: 'initial-focus',
    normalized_outcome_key: 'cancel-button',
    provenance_kind: 'synthetic-seed',
  });
});

test('reset rotates the session, creates one isolated generation, and is recoverably idempotent', async () => {
  const first = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now,
    tokenBytes: new Uint8Array(32).fill(2),
    ...secrets,
  });
  const idempotencyKey = '00000000-0000-4000-8000-000000000901';
  const reset = await resetWorkspace({
    db: env.DB,
    cookieHeader: first.setCookie!,
    csrfToken: first.csrfToken,
    idempotencyKey,
    now: now + 20,
    ...secrets,
  });
  expect(reset.workspace.generation).toBe(2);
  expect(reset.workspace.id).not.toBe(first.workspace.id);
  expect(reset.setCookie).not.toBe(first.setCookie);

  await expect(
    bootstrapWorkspace({
      db: env.DB,
      cookieHeader: first.setCookie,
      now: now + 21,
      ...secrets,
    }),
  ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });

  const replay = await resetWorkspace({
    db: env.DB,
    cookieHeader: first.setCookie!,
    csrfToken: first.csrfToken,
    idempotencyKey,
    now: now + 22,
    ...secrets,
  });
  expect(replay.workspace).toEqual(reset.workspace);
  expect(replay.setCookie).toBe(reset.setCookie);

  const counts = await env.DB.prepare(
    `SELECT generation, COUNT(*) AS count FROM workspaces GROUP BY generation ORDER BY generation`,
  ).all<{ generation: number; count: number }>();
  expect(counts.results).toEqual([
    { generation: 1, count: 1 },
    { generation: 2, count: 1 },
  ]);
});

test('paired same-key resets converge on one successor and one recoverable cookie', async () => {
  for (let iteration = 0; iteration < 20; iteration += 1) {
    await env.DB.prepare('DELETE FROM workspaces').run();
    const first = await bootstrapWorkspace({
      db: env.DB,
      cookieHeader: null,
      now: now + iteration,
      tokenBytes: new Uint8Array(32).fill(iteration + 20),
      ...secrets,
    });
    const input = {
      db: env.DB,
      cookieHeader: first.setCookie!,
      csrfToken: first.csrfToken,
      idempotencyKey: `00000000-0000-4000-8000-${String(iteration + 910).padStart(12, '0')}`,
      now: now + iteration + 1,
      ...secrets,
    };
    const results = await Promise.all([resetWorkspace(input), resetWorkspace(input)]);
    expect(new Set(results.map(({ setCookie }) => setCookie)).size).toBe(1);
    expect(new Set(results.map(({ workspace }) => workspace.id)).size).toBe(1);
    expect(results.filter(({ replayed }) => replayed)).toHaveLength(1);
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM workspaces WHERE generation = 2`,
      ).first(),
    ).toEqual({ count: 1 });
  }
});

test('paired different-key resets admit one successor and leave no losing mutation', async () => {
  const first = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now,
    tokenBytes: new Uint8Array(32).fill(66),
    ...secrets,
  });
  const base = {
    db: env.DB,
    cookieHeader: first.setCookie!,
    csrfToken: first.csrfToken,
    now: now + 1,
    ...secrets,
  };
  const results = await Promise.allSettled([
    resetWorkspace({
      ...base,
      idempotencyKey: '00000000-0000-4000-8000-000000000931',
    }),
    resetWorkspace({
      ...base,
      idempotencyKey: '00000000-0000-4000-8000-000000000932',
    }),
  ]);
  expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
  expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
  expect(
    await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM workspaces WHERE generation = 2`,
    ).first(),
  ).toEqual({ count: 1 });
  expect(
    await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM idempotency_records WHERE operation = 'reset'`,
    ).first(),
  ).toEqual({ count: 1 });
});

test('reset replay survives normal cleanup for the full cookie recovery window', async () => {
  const first = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now,
    tokenBytes: new Uint8Array(32).fill(67),
    ...secrets,
  });
  const input = {
    db: env.DB,
    cookieHeader: first.setCookie!,
    csrfToken: first.csrfToken,
    idempotencyKey: '00000000-0000-4000-8000-000000000933',
    now: now + 1,
    ...secrets,
  };
  const reset = await resetWorkspace(input);
  expect(await cleanupExpiredWorkspaces(env.DB, now + 28_799)).toBe(0);
  const replay = await resetWorkspace({ ...input, now: now + 28_799 });
  expect(replay.setCookie).toBe(reset.setCookie);
  expect(replay.workspace).toEqual(reset.workspace);
});

test('reset rejects malformed UUID-shaped idempotency keys before mutation', async () => {
  const first = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now,
    tokenBytes: new Uint8Array(32).fill(68),
    ...secrets,
  });
  await expect(
    resetWorkspace({
      db: env.DB,
      cookieHeader: first.setCookie!,
      csrfToken: first.csrfToken,
      idempotencyKey: '------------------------------------',
      now: now + 1,
      ...secrets,
    }),
  ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  expect(
    await env.DB.prepare('SELECT COUNT(*) AS count FROM workspaces').first(),
  ).toEqual({ count: 1 });
});

test('mid-batch reset failure rolls back the entire graph and stays retryable', async () => {
  const first = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now,
    tokenBytes: new Uint8Array(32).fill(69),
    ...secrets,
  });
  await env.DB.prepare(
    `CREATE TRIGGER package1_test_reset_failure
       BEFORE INSERT ON precedent_subject_edges
       WHEN (SELECT generation FROM workspaces WHERE id = NEW.workspace_id) = 2
       BEGIN SELECT RAISE(ABORT, 'INJECTED_RESET_FAILURE'); END`,
  ).run();

  let failure: unknown;
  try {
    await resetWorkspace({
      db: env.DB,
      cookieHeader: first.setCookie!,
      csrfToken: first.csrfToken,
      idempotencyKey: '00000000-0000-4000-8000-000000000934',
      now: now + 1,
      ...secrets,
    });
  } catch (error) {
    failure = error;
  } finally {
    await env.DB.prepare(
      `DROP TRIGGER IF EXISTS package1_test_reset_failure`,
    ).run();
  }

  expect(failure).toMatchObject({
    code: 'RESET_FAILED',
    status: 503,
    retryable: true,
  });
  expect(
    await env.DB.prepare(
      `SELECT generation, purged_at FROM workspaces WHERE id = ?`,
    )
      .bind(first.workspace.id)
      .first(),
  ).toEqual({ generation: 1, purged_at: null });
  expect(
    await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM workspaces WHERE generation = 2`,
    ).first(),
  ).toEqual({ count: 0 });
  expect(
    await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM idempotency_records WHERE operation = 'reset'`,
    ).first(),
  ).toEqual({ count: 0 });
  expect(
    await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM component_variants WHERE workspace_id = ?`,
    )
      .bind(first.workspace.id)
      .first(),
  ).toEqual({ count: 2 });
});
