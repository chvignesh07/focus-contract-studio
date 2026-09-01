import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import { GET as historyGet, POST as historyPost } from '../../app/api/focus-history/route.ts';
import { GET as applyGet, POST as applyPost } from '../../app/api/focus-proposals/[proposalId]/apply/route.ts';
import { GET as reviewGet, POST as reviewPost } from '../../app/api/focus-proposals/[proposalId]/review/route.ts';
import { GET as reviewerGet, POST as reviewerPost } from '../../app/api/focus-proposals/reviewer/route.ts';
import { GET as undoGet, POST as undoPost } from '../../app/api/focus-revisions/[revision]/undo/route.ts';
import { CANCEL_CONFIGURATION } from '../../lib/domain/focus-configuration.ts';
import { getActiveFocusReview } from '../../lib/server/active-focus-review.ts';
import { createProposal } from '../../lib/server/create-proposal.ts';
import { commitInitialFocusObservation, INITIAL_FOCUS_MANIFEST } from '../../lib/server/initial-focus-observation.ts';
import { bootstrapWorkspace } from '../../lib/server/workspaces.ts';
import { PACKAGE2_TOOL_NAMES } from '../../lib/webmcp/contracts.ts';

const origin = 'https://focus-contract-studio.example';
const secrets = {
  sessionSecret: env.FCS_SESSION_HMAC_SECRET!,
  csrfSecret: env.FCS_CSRF_HMAC_SECRET!,
};

function request(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${origin}${path}`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

async function fixture(tokenByte = 201) {
  const now = Math.floor(Date.now() / 1_000);
  const session = await bootstrapWorkspace({
    db: env.DB, cookieHeader: null, now,
    tokenBytes: new Uint8Array(32).fill(tokenByte), ...secrets,
  });
  await commitInitialFocusObservation({
    db: env.DB, workspaceId: session.workspace.id, now: now + 1,
    environment: 'playwright', firstTargetId: 'delete-button',
    clientOffsetMs: 8, manifest: INITIAL_FOCUS_MANIFEST,
  });
  const review = await getActiveFocusReview({
    db: env.DB, cookieHeader: session.setCookie, now: now + 2,
    sessionSecret: secrets.sessionSecret,
  });
  const proposal = await createProposal({
    db: env.DB, cookieHeader: session.setCookie, now: now + 3,
    sessionSecret: secrets.sessionSecret,
    input: {
      baseImplementedRevision: 1,
      configuration: CANCEL_CONFIGURATION,
      evidenceQueryToken: review.retrieval.queryToken,
      evidenceRecordIds: ['D001'], summary: 'Focus Cancel first.',
      idempotencyKey: `50000000-0000-4000-8000-${tokenByte.toString().padStart(12, '0')}`,
    },
  });
  return {
    session, proposal,
    headers: { cookie: session.setCookie!, 'x-fcs-csrf': session.csrfToken },
  };
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM workspaces').run();
});

test('Package 5 visible routes do not expand the exact two WebMCP registrations', () => {
  expect(PACKAGE2_TOOL_NAMES).toEqual([
    'read_active_focus_review', 'create_focus_contract_proposal',
  ]);
});

test('review, apply, history, and undo complete through strict same-origin routes', async () => {
  expect((await reviewGet()).status).toBe(405);
  expect((await reviewerGet()).status).toBe(405);
  expect((await applyGet()).status).toBe(405);
  expect((await undoGet()).status).toBe(405);
  expect((await historyPost()).status).toBe(405);
  const value = await fixture();
  const proposalId = value.proposal.proposal.proposalId;
  const review = await reviewPost(
    request(`/api/focus-proposals/${proposalId}/review`, {
      action: 'approve', idempotencyKey: '00000000-0000-4000-8000-000000005401',
    }, value.headers),
    { params: Promise.resolve({ proposalId }) },
  );
  expect(review.status).toBe(201);
  expect(await review.json()).toMatchObject({ ok: true, review: { status: 'approved' } });
  const apply = await applyPost(
    request(`/api/focus-proposals/${proposalId}/apply`, {
      expectedImplementedRevision: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000005402',
    }, value.headers),
    { params: Promise.resolve({ proposalId }) },
  );
  expect(apply.status).toBe(201);
  expect(await apply.json()).toMatchObject({ ok: true, receipt: { toRevision: 2 } });
  const history = await historyGet(new Request(`${origin}/api/focus-history`, {
    headers: { cookie: value.session.setCookie! },
  }));
  expect(history.status).toBe(200);
  expect(await history.json()).toMatchObject({ ok: true, activeRevision: 2 });
  const undo = await undoPost(
    request('/api/focus-revisions/1/undo', {
      expectedImplementedRevision: 2,
      idempotencyKey: '00000000-0000-4000-8000-000000005403',
    }, value.headers),
    { params: Promise.resolve({ revision: '1' }) },
  );
  expect(undo.status).toBe(201);
  expect(await undo.json()).toMatchObject({ ok: true, receipt: { toRevision: 3 } });
});

test('mutation routes reject caller authority, Origin, CSRF, and malformed paths before product writes', async () => {
  const value = await fixture(202);
  const proposalId = value.proposal.proposal.proposalId;
  const cases = [
    reviewerPost(request('/api/focus-proposals/reviewer', {
      configuration: CANCEL_CONFIGURATION,
      summary: 'Novel proposal without accepted responsibility.',
      responsibilityAccepted: false,
      idempotencyKey: '00000000-0000-4000-8000-000000005414',
    }, value.headers)),
    reviewPost(request(`/api/focus-proposals/${proposalId}/review`, {
      action: 'approve', idempotencyKey: '00000000-0000-4000-8000-000000005404',
      proposalHash: 'a'.repeat(64),
    }, value.headers), { params: Promise.resolve({ proposalId }) }),
    applyPost(request(`/api/focus-proposals/${proposalId}/apply`, {
      expectedImplementedRevision: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000005405',
      approved: true,
    }, value.headers), { params: Promise.resolve({ proposalId }) }),
    undoPost(request('/api/focus-revisions/not-a-revision/undo', {
      expectedImplementedRevision: 2,
      idempotencyKey: '00000000-0000-4000-8000-000000005406',
    }, value.headers), { params: Promise.resolve({ revision: 'not-a-revision' }) }),
  ];
  expect((await cases[0]).status).toBe(400);
  expect((await cases[1]).status).toBe(400);
  expect((await cases[2]).status).toBe(400);
  expect((await cases[3]).status).toBe(400);
  const wrongOrigin = request(`/api/focus-proposals/${proposalId}/review`, {
    action: 'approve', idempotencyKey: '00000000-0000-4000-8000-000000005407',
  }, value.headers);
  wrongOrigin.headers.set('origin', 'https://attacker.example');
  expect((await reviewPost(wrongOrigin, { params: Promise.resolve({ proposalId }) })).status).toBe(403);
  expect((await reviewPost(request(`/api/focus-proposals/${proposalId}/review`, {
    action: 'approve', idempotencyKey: '00000000-0000-4000-8000-000000005408',
  }, { cookie: value.session.setCookie! }), { params: Promise.resolve({ proposalId }) })).status).toBe(403);
  const wrongType = request(`/api/focus-proposals/${proposalId}/review`, {
    action: 'approve', idempotencyKey: '00000000-0000-4000-8000-000000005410',
  }, value.headers);
  wrongType.headers.set('content-type', 'text/plain');
  expect((await reviewPost(wrongType, { params: Promise.resolve({ proposalId }) })).status).toBe(415);
  expect((await applyPost(request(`/api/focus-proposals/${proposalId}/apply`, {
    expectedImplementedRevision: 1,
    idempotencyKey: '00000000-0000-4000-8000-000000005411',
    padding: 'x'.repeat(300),
  }, value.headers), { params: Promise.resolve({ proposalId }) })).status).toBe(413);
  expect((await historyGet(new Request(`${origin}/api/focus-history`))).status).toBe(401);
  expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM review_decisions').first()).toEqual({ count: 0 });
  expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM application_receipts').first()).toEqual({ count: 0 });
});

test('foreign and nonexistent proposal IDs share the same public review/apply envelope class', async () => {
  const owner = await fixture(203);
  const outsider = await fixture(204);
  const missing = '00000000-0000-4000-8000-000000005499';
  const probe = async (proposalId: string) => {
    const response = await reviewPost(request(`/api/focus-proposals/${proposalId}/review`, {
      action: 'approve', idempotencyKey: '00000000-0000-4000-8000-000000005409',
    }, outsider.headers), { params: Promise.resolve({ proposalId }) });
    const body = await response.text();
    return { status: response.status, body };
  };
  const [foreign, nonexistent] = await Promise.all([
    probe(owner.proposal.proposal.proposalId), probe(missing),
  ]);
  expect(foreign.status).toBe(404);
  expect(nonexistent.status).toBe(404);
  const normalize = (body: string) => body.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gu,
    '<correlation>',
  );
  expect(normalize(foreign.body)).toBe(normalize(nonexistent.body));
  expect(foreign.body.length).toBe(nonexistent.body.length);
  const applyProbe = async (proposalId: string, suffix: string) => {
    const response = await applyPost(request(`/api/focus-proposals/${proposalId}/apply`, {
      expectedImplementedRevision: 1,
      idempotencyKey: `00000000-0000-4000-8000-${suffix}`,
    }, outsider.headers), { params: Promise.resolve({ proposalId }) });
    return { status: response.status, body: await response.text() };
  };
  const [foreignApply, missingApply] = await Promise.all([
    applyProbe(owner.proposal.proposal.proposalId, '000000005412'),
    applyProbe(missing, '000000005413'),
  ]);
  expect(foreignApply.status).toBe(404);
  expect(missingApply.status).toBe(404);
  expect(normalize(foreignApply.body)).toBe(normalize(missingApply.body));
});
