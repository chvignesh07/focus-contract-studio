import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import {
  GET as bootstrapGet,
  POST as bootstrapPost,
} from '../../app/api/session/bootstrap/route';
import {
  GET as resetGet,
  POST as resetPost,
} from '../../app/api/session/reset/route';
import { bootstrapWorkspace } from '../../lib/server/workspaces';
import {
  GLOBAL_OPERATION_LIMITS,
  admitGlobalOperation,
} from '../../lib/server/admission';

const origin = 'https://focus-contract-studio.example';

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM rate_limit_windows').run();
  await env.DB.prepare('DELETE FROM workspaces').run();
});

function jsonRequest(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  const request = new Request(`${origin}${path}`, {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.10',
      ...headers,
    },
    body: JSON.stringify(body),
  });
  Object.defineProperty(request, 'cf', { value: { colo: 'TEST' } });
  return request;
}

test('session bootstrap is POST-only, no-store, host-only, and identity-blind', async () => {
  expect((await bootstrapGet()).status).toBe(405);
  const response = await bootstrapPost(
    jsonRequest(
      '/api/session/bootstrap',
      {},
      {
        'oai-authenticated-user-email': 'private.person@example.com',
        'oai-authenticated-user-full-name': 'Private Person',
      },
    ),
  );
  expect(response.status).toBe(201);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('set-cookie')).toMatch(
    /^__Host-fcs_session=.*; Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800$/,
  );
  const payload = await response.json<{
    ok: true;
    data: {
      generation: number;
      csrfToken: string;
      activeVariant: { slug: string; implementedRevision: number };
    };
  }>();
  expect(payload).toMatchObject({
    ok: true,
    data: {
      generation: 1,
      activeVariant: {
        slug: 'delete-account-standard',
        implementedRevision: 1,
      },
    },
  });
  expect(JSON.stringify(payload)).not.toContain('workspace');
  expect(JSON.stringify(payload)).not.toContain('private.person@example.com');
});

test('reset requires exact origin, CSRF, strict schema, and rotates recoverably', async () => {
  expect((await resetGet()).status).toBe(405);
  const bootstrap = await bootstrapPost(
    jsonRequest('/api/session/bootstrap', {}),
  );
  const cookie = bootstrap.headers.get('set-cookie')!;
  const sessionCookie = cookie.split(';', 1)[0]!;
  const initial = await bootstrap.json<{
    data: { csrfToken: string; generation: number };
  }>();
  const key = '00000000-0000-4000-8000-000000000905';

  const rejected = await resetPost(
    jsonRequest(
      '/api/session/reset',
      { idempotencyKey: key, unauthorized: true },
      { cookie: sessionCookie, 'x-fcs-csrf': initial.data.csrfToken },
    ),
  );
  expect(rejected.status).toBe(400);
  expect(await rejected.json()).toMatchObject({
    ok: false,
    error: { code: 'INVALID_REQUEST' },
  });

  const requestHeaders = {
    cookie: sessionCookie,
    'x-fcs-csrf': initial.data.csrfToken,
  };
  const response = await resetPost(
    jsonRequest('/api/session/reset', { idempotencyKey: key }, requestHeaders),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('set-cookie')).not.toBe(cookie);
  expect(await response.json()).toMatchObject({
    ok: true,
    data: { generation: 2, replayed: false },
  });

  const replay = await resetPost(
    jsonRequest('/api/session/reset', { idempotencyKey: key }, requestHeaders),
  );
  expect(replay.headers.get('set-cookie')).toBe(response.headers.get('set-cookie'));
  expect(await replay.json()).toMatchObject({
    ok: true,
    data: { generation: 2, replayed: true },
  });
});

test('route failures use the common safe public envelope', async () => {
  const response = await bootstrapPost(
    new Request(`${origin}/api/session/bootstrap`, {
      method: 'POST',
      headers: {
        origin: 'https://attacker.example',
        'content-type': 'application/json',
      },
      body: '{}',
    }),
  );
  expect(response.status).toBe(403);
  const text = await response.text();
  expect(JSON.parse(text)).toMatchObject({
    ok: false,
    error: {
      code: 'ORIGIN_REJECTED',
      message: 'The request origin is not allowed.',
      retryable: false,
      correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    },
  });
  expect(text).not.toMatch(/stack|sqlite|binding|cookie|csrf/i);
});

test('bootstrap drives bounded cleanup without touching the current request workspace', async () => {
  const secrets = {
    sessionSecret: env.FCS_SESSION_HMAC_SECRET!,
    csrfSecret: env.FCS_CSRF_HMAC_SECRET!,
  };
  for (let index = 0; index < 11; index += 1) {
    const expired = await bootstrapWorkspace({
      db: env.DB,
      cookieHeader: null,
      now: 100 + index,
      tokenBytes: new Uint8Array(32).fill(index + 20),
      ...secrets,
    });
    await env.DB.prepare(
      `UPDATE workspaces
          SET last_access_at = 120, access_expires_at = 130, grace_expires_at = 140
        WHERE id = ?`,
    )
      .bind(expired.workspace.id)
      .run();
  }
  expect((await bootstrapPost(jsonRequest('/api/session/bootstrap', {}))).status).toBe(
    201,
  );
  expect(
    await env.DB.prepare('SELECT COUNT(*) AS count FROM workspaces').first<{
      count: number;
    }>(),
  ).toEqual({ count: 2 });
});

test('reset drives bounded cleanup after full request validation', async () => {
  const secrets = {
    sessionSecret: env.FCS_SESSION_HMAC_SECRET!,
    csrfSecret: env.FCS_CSRF_HMAC_SECRET!,
  };
  for (let index = 0; index < 11; index += 1) {
    const expired = await bootstrapWorkspace({
      db: env.DB,
      cookieHeader: null,
      now: 100 + index,
      tokenBytes: new Uint8Array(32).fill(index + 70),
      ...secrets,
    });
    await env.DB.prepare(
      `UPDATE workspaces
          SET access_expires_at = 130, grace_expires_at = 140
        WHERE id = ?`,
    )
      .bind(expired.workspace.id)
      .run();
  }
  const bootstrap = await bootstrapPost(
    jsonRequest('/api/session/bootstrap', {}),
  );
  const cookie = bootstrap.headers.get('set-cookie')!;
  const initial = await bootstrap.json<{ data: { csrfToken: string } }>();
  const reset = await resetPost(
    jsonRequest(
      '/api/session/reset',
      { idempotencyKey: '00000000-0000-4000-8000-000000000906' },
      {
        cookie: cookie.split(';', 1)[0]!,
        'x-fcs-csrf': initial.data.csrfToken,
      },
    ),
  );
  expect(reset.status).toBe(200);
  expect(
    await env.DB.prepare('SELECT COUNT(*) AS count FROM workspaces').first(),
  ).toEqual({ count: 2 });
});

test('global bootstrap admission rejects new graphs with zero workspace writes but permits reload', async () => {
  const first = await bootstrapPost(jsonRequest('/api/session/bootstrap', {}));
  expect(first.status).toBe(201);
  const cookie = first.headers.get('set-cookie')!.split(';', 1)[0]!;
  const now = Math.floor(Date.now() / 1000);
  const client = await env.DB.prepare(
    `SELECT key_digest FROM rate_limit_windows
      WHERE workspace_id IS NULL AND operation = 'workspace_bootstrap'`,
  ).first<{ key_digest: string }>();
  expect(client).not.toBeNull();
  for (
    let index = 1;
    index < GLOBAL_OPERATION_LIMITS.workspace_bootstrap;
    index += 1
  ) {
    await admitGlobalOperation({
      db: env.DB,
      operation: 'workspace_bootstrap',
      now,
      clientDigest: client!.key_digest,
    });
  }

  const rejected = await bootstrapPost(jsonRequest('/api/session/bootstrap', {}));
  expect(rejected.status).toBe(429);
  expect(await rejected.json()).toMatchObject({
    ok: false,
    error: { code: 'RATE_LIMITED', retryable: true },
  });
  expect(
    await env.DB.prepare('SELECT COUNT(*) AS count FROM workspaces').first(),
  ).toEqual({ count: 1 });

  const reload = await bootstrapPost(
    jsonRequest('/api/session/bootstrap', {}, { cookie }),
  );
  expect(reload.status).toBe(200);
  expect(
    await env.DB.prepare('SELECT COUNT(*) AS count FROM workspaces').first(),
  ).toEqual({ count: 1 });
});
