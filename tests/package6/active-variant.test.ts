import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import {
  GET as activeVariantGet,
  POST as activeVariantPost,
} from '../../app/api/active-variant/route.ts';
import { getActiveFocusReview } from '../../lib/server/active-focus-review.ts';
import { bootstrapWorkspace } from '../../lib/server/workspaces.ts';

const origin = 'https://focus-contract-studio.example';
const secrets = {
  sessionSecret: env.FCS_SESSION_HMAC_SECRET!,
  csrfSecret: env.FCS_CSRF_HMAC_SECRET!,
};

function request(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request(`${origin}/api/active-variant`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

async function fixture(tokenByte = 221) {
  const now = Math.floor(Date.now() / 1_000);
  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now,
    tokenBytes: new Uint8Array(32).fill(tokenByte),
    ...secrets,
  });
  return {
    now,
    session,
    headers: {
      cookie: session.setCookie!,
      'x-fcs-csrf': session.csrfToken,
    },
  };
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM workspaces').run();
});

test('protected route switches only an allowlisted slug through view-state CAS', async () => {
  expect((await activeVariantGet()).status).toBe(405);
  const value = await fixture();
  const response = await activeVariantPost(request({
    variant: 'delete-account-danger-emphasis',
    expectedViewRevision: 1,
  }, value.headers));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body).toEqual({
    ok: true,
    data: {
      variant: 'delete-account-danger-emphasis',
      viewRevision: 2,
    },
  });
  expect(JSON.stringify(body)).not.toMatch(/workspace|variantId|active_variant_id/u);
  const review = await getActiveFocusReview({
    db: env.DB,
    cookieHeader: value.session.setCookie,
    now: value.now + 1,
    sessionSecret: secrets.sessionSecret,
  });
  expect(review.review.variant).toBe('delete-account-danger-emphasis');

  const stale = await activeVariantPost(request({
    variant: 'delete-account-standard',
    expectedViewRevision: 1,
  }, value.headers));
  expect(stale.status).toBe(409);
  expect(await stale.json()).toMatchObject({
    ok: false,
    error: { code: 'VIEW_STATE_STALE' },
  });
});

test('route rejects private IDs, unknown slugs, Origin, CSRF, and invalid sessions', async () => {
  const value = await fixture(222);
  for (const body of [
    { variant: 'delete-account-unknown', expectedViewRevision: 1 },
    { variant: 'delete-account-standard', expectedViewRevision: 0 },
    {
      variant: 'delete-account-standard',
      expectedViewRevision: 1,
      workspaceId: value.session.workspace.id,
    },
    {
      variantId: crypto.randomUUID(),
      expectedViewRevision: 1,
    },
  ]) {
    expect((await activeVariantPost(request(body, value.headers))).status).toBe(400);
  }
  const foreign = request({
    variant: 'delete-account-danger-emphasis',
    expectedViewRevision: 1,
  }, value.headers);
  foreign.headers.set('origin', 'https://attacker.example');
  expect((await activeVariantPost(foreign)).status).toBe(403);
  expect((await activeVariantPost(request({
    variant: 'delete-account-danger-emphasis',
    expectedViewRevision: 1,
  }, { cookie: value.session.setCookie! }))).status).toBe(403);
  expect((await activeVariantPost(request({
    variant: 'delete-account-danger-emphasis',
    expectedViewRevision: 1,
  }))).status).toBe(401);

  const active = await env.DB.prepare(
    `SELECT v.slug, s.view_revision
       FROM workspace_view_state s
       JOIN component_variants v ON v.id = s.active_variant_id
      WHERE s.workspace_id = ?`,
  ).bind(value.session.workspace.id).first();
  expect(active).toEqual({
    slug: 'delete-account-standard',
    view_revision: 1,
  });
});

test('human precedent DTO is exact, bounded, and strips private source data', async () => {
  const value = await fixture(223);
  const review = await getActiveFocusReview({
    db: env.DB,
    cookieHeader: value.session.setCookie,
    now: value.now + 1,
    sessionSecret: secrets.sessionSecret,
  });
  const record = review.retrieval.records[0]!;
  expect(Object.keys(record).sort()).toEqual([
    'applicability',
    'lexicalRank',
    'outcomeKey',
    'ranks',
    'rationaleExcerpt',
    'recordId',
    'relationshipRank',
    'rrf',
    'rrfContribution',
    'sourceKind',
    'structuredRank',
    'validFrom',
    'validUntil',
  ]);
  expect(record).toMatchObject({
    recordId: 'D001',
    sourceKind: 'synthetic-seed',
    validFrom: expect.stringMatching(/Z$/u),
  });
  expect(JSON.stringify(record)).not.toMatch(
    /workspace|databaseRecordId|provenanceRef|sourceContent|private/u,
  );
});
