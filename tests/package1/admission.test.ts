import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import {
  GLOBAL_OPERATION_LIMITS,
  admitGlobalOperation,
} from '../../lib/server/admission';

const secret = 'package1-test-rate-limit-secret-material-32-bytes-minimum';

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM rate_limit_windows').run();
  await env.DB.prepare('DELETE FROM workspaces').run();
});

test('the server-global admission fuse allows exactly the configured bound', async () => {
  const now = 1_788_100_000;
  const limit = GLOBAL_OPERATION_LIMITS.workspace_bootstrap;
  for (let index = 0; index < limit; index += 1) {
    await expect(
      admitGlobalOperation({
        db: env.DB,
        operation: 'workspace_bootstrap',
        now,
        secret,
      }),
    ).resolves.toBe(index + 1);
  }
  await expect(
    admitGlobalOperation({
      db: env.DB,
      operation: 'workspace_bootstrap',
      now,
      secret,
    }),
  ).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 });
  expect(
    await env.DB.prepare(
      `SELECT workspace_id, operation, request_count
         FROM rate_limit_windows WHERE operation = 'workspace_bootstrap'`,
    ).first(),
  ).toEqual({
    workspace_id: null,
    operation: 'workspace_bootstrap',
    request_count: limit,
  });
});

test('concurrent admissions cannot exceed the configured bound', async () => {
  const now = 1_788_100_000;
  const attempts = await Promise.allSettled(
    Array.from({ length: GLOBAL_OPERATION_LIMITS.workspace_bootstrap + 8 }, () =>
      admitGlobalOperation({
        db: env.DB,
        operation: 'workspace_bootstrap',
        now,
        secret,
      }),
    ),
  );
  expect(attempts.filter(({ status }) => status === 'fulfilled')).toHaveLength(
    GLOBAL_OPERATION_LIMITS.workspace_bootstrap,
  );
  expect(
    await env.DB.prepare(
      `SELECT request_count FROM rate_limit_windows
        WHERE operation = 'workspace_bootstrap'`,
    ).first(),
  ).toEqual({ request_count: GLOBAL_OPERATION_LIMITS.workspace_bootstrap });
});

test('a new fixed window is independently bounded without caller identity input', async () => {
  const first = await admitGlobalOperation({
    db: env.DB,
    operation: 'workspace_reset',
    now: 1_788_100_000,
    secret,
  });
  const second = await admitGlobalOperation({
    db: env.DB,
    operation: 'workspace_reset',
    now: 1_788_100_060,
    secret,
  });
  expect([first, second]).toEqual([1, 1]);
  expect(
    await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM rate_limit_windows
        WHERE operation = 'workspace_reset'`,
    ).first(),
  ).toEqual({ count: 2 });
});
