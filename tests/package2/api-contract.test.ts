import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import {
  GET as reviewGet,
  POST as reviewPost,
} from '../../app/api/focus-review/route';
import {
  GET as proposalGet,
  POST as proposalPost,
} from '../../app/api/focus-proposals/route';
import {
  GET as observationGet,
  POST as observationPost,
} from '../../app/api/observations/initial-focus/route';
import { CANCEL_CONFIGURATION } from '../../lib/domain/focus-configuration';
import { INITIAL_FOCUS_MANIFEST } from '../../lib/server/initial-focus-observation';
import { bootstrapWorkspace } from '../../lib/server/workspaces';

const origin = 'https://focus-contract-studio.example';
const secrets = {
  sessionSecret: env.FCS_SESSION_HMAC_SECRET!,
  csrfSecret: env.FCS_CSRF_HMAC_SECRET!,
};
function request(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request(`${origin}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM workspaces').run();
});

test('thin routes share the real observation, read, and proposal domain operations', async () => {
  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: Math.floor(Date.now() / 1000),
    tokenBytes: new Uint8Array(32).fill(121),
    ...secrets,
  });
  const headers = {
    cookie: session.setCookie!,
    'x-fcs-csrf': session.csrfToken,
  };
  const observation = await observationPost(
    request(
      '/api/observations/initial-focus',
      {
        firstTargetId: 'delete-button',
        clientOffsetMs: 12,
        manifest: INITIAL_FOCUS_MANIFEST,
      },
      headers,
    ),
  );
  expect(observation.status).toBe(201);
  expect(await observation.json()).toMatchObject({
    ok: true,
    observation: {
      implementedRevision: 1,
      observedInitialFocus: 'delete-button',
    },
  });

  const reviewResponse = await reviewPost(
    request('/api/focus-review', {}, { cookie: session.setCookie! }),
  );
  expect(reviewResponse.status).toBe(200);
  const review = (await reviewResponse.json()) as {
    retrieval: { queryToken: string };
  };
  expect(review).toMatchObject({
    ok: true,
    review: { precedentComparison: { label: 'DECISION_MISMATCH' } },
  });

  const proposalResponse = await proposalPost(
    request(
      '/api/focus-proposals',
      {
        baseImplementedRevision: 1,
        configuration: CANCEL_CONFIGURATION,
        evidenceQueryToken: review.retrieval.queryToken,
        evidenceRecordIds: ['D001'],
        summary: 'Focus Cancel first.',
        idempotencyKey: '00000000-0000-4000-8000-000000002401',
      },
      headers,
    ),
  );
  expect(proposalResponse.status).toBe(201);
  expect(await proposalResponse.json()).toMatchObject({
    ok: true,
    proposal: { status: 'proposed', applied: false, label: 'NOT APPLIED' },
  });
  for (const response of [observation, reviewResponse, proposalResponse]) {
    expect(response.headers.get('cache-control')).toBe('no-store');
  }
});

test('routes reject GET, missing origin/CSRF, unknown keys, and absent sessions', async () => {
  expect((await observationGet()).status).toBe(405);
  expect((await reviewGet()).status).toBe(405);
  expect((await proposalGet()).status).toBe(405);

  const missingSession = await reviewPost(request('/api/focus-review', {}));
  expect(missingSession.status).toBe(401);

  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: Math.floor(Date.now() / 1000),
    tokenBytes: new Uint8Array(32).fill(122),
    ...secrets,
  });
  const noCsrf = await observationPost(
    request(
      '/api/observations/initial-focus',
      {
        firstTargetId: 'delete-button',
        clientOffsetMs: 1,
        manifest: INITIAL_FOCUS_MANIFEST,
      },
      { cookie: session.setCookie! },
    ),
  );
  expect(noCsrf.status).toBe(403);

  const callerClaimedEnvironment = await observationPost(
    request(
      '/api/observations/initial-focus',
      {
        environment: 'playwright',
        firstTargetId: 'delete-button',
        clientOffsetMs: 1,
        manifest: INITIAL_FOCUS_MANIFEST,
      },
      {
        cookie: session.setCookie!,
        'x-fcs-csrf': session.csrfToken,
      },
    ),
  );
  expect(callerClaimedEnvironment.status).toBe(400);
  expect(
    await env.DB.prepare('SELECT COUNT(*) AS count FROM observation_sessions').first(),
  ).toEqual({ count: 0 });

  const noOriginRequest = request('/api/focus-proposals', {}, {
    cookie: session.setCookie!,
    'x-fcs-csrf': session.csrfToken,
  });
  noOriginRequest.headers.delete('origin');
  expect((await proposalPost(noOriginRequest)).status).toBe(403);

  const unknown = await proposalPost(
    request(
      '/api/focus-proposals',
      { unexpected: true },
      {
        cookie: session.setCookie!,
        'x-fcs-csrf': session.csrfToken,
      },
    ),
  );
  expect(unknown.status).toBe(400);
  expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM proposals').first()).toEqual({
    count: 0,
  });
});
