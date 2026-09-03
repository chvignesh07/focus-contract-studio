import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import { POST as readPost } from '../../app/api/focus-review/route.ts';
import { POST as createPost } from '../../app/api/focus-proposals/route.ts';
import { POST as applyPost } from '../../app/api/focus-proposals/[proposalId]/apply/route.ts';
import { POST as reviewPost } from '../../app/api/focus-proposals/[proposalId]/review/route.ts';
import { POST as verifyPost } from '../../app/api/verifications/route.ts';
import { CANCEL_CONFIGURATION } from '../../lib/domain/focus-configuration.ts';
import {
  finalizeFocusRehearsal,
  startFocusRehearsal,
} from '../../lib/server/focus-rehearsal.ts';
import {
  commitInitialFocusObservation,
  INITIAL_FOCUS_MANIFEST,
} from '../../lib/server/initial-focus-observation.ts';
import { bootstrapWorkspace } from '../../lib/server/workspaces.ts';
import { createFcsWebMcpV2Tools } from '../../lib/webmcp/contracts.ts';

const origin = 'https://focus-contract-studio.example';
const sessionSecret = env.FCS_SESSION_HMAC_SECRET!;
const csrfSecret = env.FCS_CSRF_HMAC_SECRET!;

async function workspace(tokenByte: number) {
  const now = Math.floor(Date.now() / 1_000) - 10;
  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now,
    tokenBytes: new Uint8Array(32).fill(tokenByte),
    sessionSecret,
    csrfSecret,
  });
  await commitInitialFocusObservation({
    db: env.DB,
    workspaceId: session.workspace.id,
    now: now + 1,
    environment: 'playwright',
    firstTargetId: 'delete-button',
    clientOffsetMs: 8,
    manifest: INITIAL_FOCUS_MANIFEST,
  });
  return session;
}

function routeTools(
  session: Awaited<ReturnType<typeof workspace>>,
  options: { loseFirstApplyResponse?: boolean } = {},
) {
  let lost = false;
  const paths: string[] = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    paths.push(path);
    const headers = new Headers(init?.headers);
    headers.set('origin', origin);
    headers.set('cookie', session.setCookie!);
    const request = new Request(`${origin}${path}`, { ...init, headers });
    if (path === '/api/focus-review') return readPost(request);
    if (path === '/api/focus-proposals') return createPost(request);
    if (path === '/api/verifications') return verifyPost(request);
    const match = path.match(/^\/api\/focus-proposals\/([^/]+)\/apply$/u);
    if (match) {
      const response = await applyPost(request, {
        params: Promise.resolve({ proposalId: decodeURIComponent(match[1]!) }),
      });
      if (options.loseFirstApplyResponse && response.ok && !lost) {
        lost = true;
        throw new TypeError('committed response was lost');
      }
      return response;
    }
    throw new Error(`unexpected route ${path}`);
  };
  return {
    paths,
    tools: createFcsWebMcpV2Tools({
      csrfToken: session.csrfToken,
      fetcher,
    }),
  };
}

function routeRequest(
  session: Awaited<ReturnType<typeof workspace>>,
  path: string,
  body: unknown,
): Request {
  return new Request(`${origin}${path}`, {
    method: 'POST',
    headers: {
      origin,
      cookie: session.setCookie!,
      'content-type': 'application/json',
      'x-fcs-csrf': session.csrfToken,
    },
    body: JSON.stringify(body),
  });
}

function fullRehearsal(variantId: string, revision: number) {
  return {
    manifest: {
      manifestVersion: 'focus-manifest-v1' as const,
      targetIds: ['delete-trigger' as const, 'dialog-title' as const, 'reason-input' as const, 'cancel-button' as const, 'delete-button' as const],
      tabbableOrder: ['reason-input' as const, 'cancel-button' as const, 'delete-button' as const],
      dialogName: 'Delete account' as const,
      dialogDescription: 'Deleting your account is permanent. You can optionally tell us why.' as const,
      role: 'dialog' as const,
      ariaModal: true as const,
      open: true as const,
      variantId,
      implementedRevision: revision,
    },
    events: [
      { eventType: 'dialog_open' as const, targetId: 'delete-trigger' as const, clientOffsetMs: 0 },
      { eventType: 'focusin' as const, targetId: 'cancel-button' as const, clientOffsetMs: 1 },
      { eventType: 'keydown' as const, targetId: 'delete-button' as const, keyName: 'Tab' as const, shiftKey: false, clientOffsetMs: 2 },
      { eventType: 'focusin' as const, targetId: 'reason-input' as const, clientOffsetMs: 3 },
      { eventType: 'keydown' as const, targetId: 'reason-input' as const, keyName: 'Tab' as const, shiftKey: false, clientOffsetMs: 4 },
      { eventType: 'focusin' as const, targetId: 'cancel-button' as const, clientOffsetMs: 5 },
      { eventType: 'keydown' as const, targetId: 'cancel-button' as const, keyName: 'Tab' as const, shiftKey: false, clientOffsetMs: 6 },
      { eventType: 'focusin' as const, targetId: 'delete-button' as const, clientOffsetMs: 7 },
      { eventType: 'keydown' as const, targetId: 'delete-button' as const, keyName: 'Tab' as const, shiftKey: false, clientOffsetMs: 8 },
      { eventType: 'focusin' as const, targetId: 'reason-input' as const, clientOffsetMs: 9 },
      { eventType: 'keydown' as const, targetId: 'reason-input' as const, keyName: 'Tab' as const, shiftKey: true, clientOffsetMs: 10 },
      { eventType: 'focusin' as const, targetId: 'delete-button' as const, clientOffsetMs: 11 },
      { eventType: 'keydown' as const, targetId: 'delete-button' as const, keyName: 'Escape' as const, shiftKey: false, clientOffsetMs: 12 },
      { eventType: 'dialog_close' as const, targetId: 'dialog-title' as const, closeReason: 'escape' as const, clientOffsetMs: 13 },
      { eventType: 'focus_return' as const, targetId: 'delete-trigger' as const, clientOffsetMs: 14 },
    ],
  };
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM workspaces').run();
});

test('tools and UI share guarded routes while create never applies and apply never approves', async () => {
  const session = await workspace(221);
  const value = routeTools(session, { loseFirstApplyResponse: true });
  const signal = new AbortController().signal;
  const read = await value.tools[0]!.execute({}, { signal }) as {
    review: { verificationTarget: null };
    retrieval: { queryToken: string; records: Array<{ recordId: string }> };
  };
  expect(read.review.verificationTarget).toBeNull();
  const created = await value.tools[1]!.execute({
    baseImplementedRevision: 1,
    configuration: CANCEL_CONFIGURATION,
    evidenceQueryToken: read.retrieval.queryToken,
    evidenceRecordIds: [read.retrieval.records[0]!.recordId],
    summary: 'Focus Cancel first.',
    idempotencyKey: '00000000-0000-4000-8000-000000000721',
  }, { signal }) as { proposal: { proposalId: string; applied: boolean } };

  expect(created.proposal.applied).toBe(false);
  expect(await env.DB.prepare(
    `SELECT
       (SELECT active_implemented_revision FROM component_variants
         WHERE workspace_id = ? AND id = (SELECT active_variant_id FROM workspace_view_state WHERE workspace_id = ?)) AS active,
       (SELECT COUNT(*) FROM application_receipts WHERE workspace_id = ?) AS applications,
       (SELECT COUNT(*) FROM review_decisions WHERE workspace_id = ?) AS decisions`,
  ).bind(session.workspace.id, session.workspace.id, session.workspace.id, session.workspace.id).first())
    .toEqual({ active: 1, applications: 0, decisions: 0 });

  await expect(value.tools[2]!.execute({
    proposalId: created.proposal.proposalId,
    expectedImplementedRevision: 1,
    idempotencyKey: '00000000-0000-4000-8000-000000000722',
  }, { signal })).rejects.toThrow('PROPOSAL_NOT_APPROVED');
  expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM review_decisions').first())
    .toEqual({ count: 0 });

  const review = await reviewPost(routeRequest(
    session,
    `/api/focus-proposals/${created.proposal.proposalId}/review`,
    { action: 'approve', idempotencyKey: '00000000-0000-4000-8000-000000000723' },
  ), { params: Promise.resolve({ proposalId: created.proposal.proposalId }) });
  expect(review.status).toBe(201);

  await expect(value.tools[2]!.execute({
    proposalId: created.proposal.proposalId,
    expectedImplementedRevision: 2,
    idempotencyKey: '00000000-0000-4000-8000-000000000731',
  }, { signal })).rejects.toThrow('STALE_REVISION');

  const applied = await value.tools[2]!.execute({
    proposalId: created.proposal.proposalId,
    expectedImplementedRevision: 1,
    idempotencyKey: '00000000-0000-4000-8000-000000000724',
  }, { signal }) as { application: { receiptId: string; idempotentReplay: boolean } };
  expect(applied.application.idempotentReplay).toBe(true);
  expect(value.paths.filter((path) => path.endsWith('/apply'))).toHaveLength(4);
  expect(await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM application_receipts WHERE workspace_id = ?) AS receipts,
       (SELECT COUNT(*) FROM implemented_focus_revisions WHERE workspace_id = ? AND revision = 2) AS revisions,
       (SELECT COUNT(*) FROM review_decisions WHERE workspace_id = ?) AS decisions`,
  ).bind(session.workspace.id, session.workspace.id, session.workspace.id).first())
    .toEqual({ receipts: 1, revisions: 1, decisions: 1 });

  const uiReplay = await applyPost(routeRequest(
    session,
    `/api/focus-proposals/${created.proposal.proposalId}/apply`,
    {
      expectedImplementedRevision: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000724',
    },
  ), { params: Promise.resolve({ proposalId: created.proposal.proposalId }) });
  expect(await uiReplay.json()).toMatchObject({
    receipt: { receiptId: applied.application.receiptId, replayed: true },
  });
});

test('verification is idempotent, reports its durable time, and never changes configuration', async () => {
  const session = await workspace(222);
  const value = routeTools(session);
  const signal = new AbortController().signal;
  const read = await value.tools[0]!.execute({}, { signal }) as {
    review: { verificationTarget: null };
    retrieval: { queryToken: string; records: Array<{ recordId: string }> };
  };
  expect(read.review.verificationTarget).toBeNull();
  const staleNow = Math.floor(Date.now() / 1_000);
  const expiredNow = staleNow - 60;
  const expired = await startFocusRehearsal({
    db: env.DB,
    workspaceId: session.workspace.id,
    now: expiredNow,
    environment: 'browser',
  });
  await finalizeFocusRehearsal({
    db: env.DB,
    workspaceId: session.workspace.id,
    rehearsalSessionId: expired.rehearsalSessionId,
    now: expiredNow + 1,
    input: fullRehearsal(expired.variantId, 1),
  });
  expect((await value.tools[0]!.execute({}, { signal }) as typeof read)
    .review.verificationTarget).toBeNull();

  const foreignSession = await workspace(225);
  const foreign = await startFocusRehearsal({
    db: env.DB,
    workspaceId: foreignSession.workspace.id,
    now: staleNow,
    environment: 'browser',
  });
  await finalizeFocusRehearsal({
    db: env.DB,
    workspaceId: foreignSession.workspace.id,
    rehearsalSessionId: foreign.rehearsalSessionId,
    now: staleNow + 1,
    input: fullRehearsal(foreign.variantId, 1),
  });
  expect((await value.tools[0]!.execute({}, { signal }) as typeof read)
    .review.verificationTarget).toBeNull();

  const stale = await startFocusRehearsal({
    db: env.DB,
    workspaceId: session.workspace.id,
    now: staleNow,
    environment: 'browser',
  });
  expect((await value.tools[0]!.execute({}, { signal }) as typeof read)
    .review.verificationTarget).toBeNull();
  await finalizeFocusRehearsal({
    db: env.DB,
    workspaceId: session.workspace.id,
    rehearsalSessionId: stale.rehearsalSessionId,
    now: staleNow + 1,
    input: fullRehearsal(stale.variantId, 1),
  });
  expect((await value.tools[0]!.execute({}, { signal }) as {
    review: { verificationTarget: { rehearsalSessionId: string } };
  }).review.verificationTarget.rehearsalSessionId).toBe(stale.rehearsalSessionId);
  const created = await value.tools[1]!.execute({
    baseImplementedRevision: 1,
    configuration: CANCEL_CONFIGURATION,
    evidenceQueryToken: read.retrieval.queryToken,
    evidenceRecordIds: [read.retrieval.records[0]!.recordId],
    summary: 'Focus Cancel first.',
    idempotencyKey: '00000000-0000-4000-8000-000000000725',
  }, { signal }) as { proposal: { proposalId: string } };
  await reviewPost(routeRequest(
    session,
    `/api/focus-proposals/${created.proposal.proposalId}/review`,
    { action: 'approve', idempotencyKey: '00000000-0000-4000-8000-000000000726' },
  ), { params: Promise.resolve({ proposalId: created.proposal.proposalId }) });
  await value.tools[2]!.execute({
    proposalId: created.proposal.proposalId,
    expectedImplementedRevision: 1,
    idempotencyKey: '00000000-0000-4000-8000-000000000727',
  }, { signal });
  expect((await value.tools[0]!.execute({}, { signal }) as typeof read)
    .review.verificationTarget).toBeNull();

  const rehearsalNow = staleNow + 4;
  const started = await startFocusRehearsal({
    db: env.DB,
    workspaceId: session.workspace.id,
    now: rehearsalNow,
    environment: 'browser',
  });
  await finalizeFocusRehearsal({
    db: env.DB,
    workspaceId: session.workspace.id,
    rehearsalSessionId: started.rehearsalSessionId,
    now: rehearsalNow + 1,
    input: fullRehearsal(started.variantId, 2),
  });
  const nonBrowser = await startFocusRehearsal({
    db: env.DB,
    workspaceId: session.workspace.id,
    now: rehearsalNow + 2,
    environment: 'playwright',
  });
  await finalizeFocusRehearsal({
    db: env.DB,
    workspaceId: session.workspace.id,
    rehearsalSessionId: nonBrowser.rehearsalSessionId,
    now: rehearsalNow + 3,
    input: fullRehearsal(nonBrowser.variantId, 2),
  });
  const verificationRead = await value.tools[0]!.execute({}, { signal }) as {
    review: {
      verificationTarget: null | {
        rehearsalSessionId: string;
        expectedImplementedRevision: number;
        state: 'finalized' | 'verified_pass' | 'verified_fail';
      };
    };
  };
  expect(verificationRead.review.verificationTarget).toEqual({
    rehearsalSessionId: started.rehearsalSessionId,
    expectedImplementedRevision: 2,
    state: 'finalized',
  });
  const before = await env.DB.prepare(
    `SELECT configuration_json FROM implemented_focus_revisions
      WHERE workspace_id = ? AND variant_id = ? AND revision = 2`,
  ).bind(session.workspace.id, started.variantId).first();
  const target = verificationRead.review.verificationTarget!;
  const input = {
    rehearsalSessionId: target.rehearsalSessionId,
    expectedImplementedRevision: target.expectedImplementedRevision,
  };
  const first = await value.tools[3]!.execute(input, { signal }) as {
    verification: { receiptId: string; verifiedAt: string; precedentProjected: boolean };
  };
  const replay = await value.tools[3]!.execute(input, { signal }) as typeof first;
  expect(first.verification.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
  expect(replay.verification.receiptId).toBe(first.verification.receiptId);
  expect(first.verification.precedentProjected).toBe(true);
  const verifiedRead = await value.tools[0]!.execute({}, { signal }) as typeof verificationRead;
  expect(verifiedRead.review.verificationTarget).toEqual({
    ...target,
    state: 'verified_pass',
  });
  expect(await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM verification_receipts WHERE workspace_id = ?) AS receipts,
       (SELECT COUNT(*) FROM implemented_focus_revisions WHERE workspace_id = ?) AS revisions,
       (SELECT configuration_json FROM implemented_focus_revisions
         WHERE workspace_id = ? AND variant_id = ? AND revision = 2) AS configuration_json`,
  ).bind(session.workspace.id, session.workspace.id, session.workspace.id, started.variantId).first())
    .toEqual({ receipts: 1, revisions: 3, ...before });
});

test('foreign and nonexistent proposal IDs are indistinguishable through the tool', async () => {
  const owner = await workspace(223);
  const ownerTools = routeTools(owner).tools;
  const signal = new AbortController().signal;
  const read = await ownerTools[0]!.execute({}, { signal }) as {
    retrieval: { queryToken: string; records: Array<{ recordId: string }> };
  };
  const created = await ownerTools[1]!.execute({
    baseImplementedRevision: 1,
    configuration: CANCEL_CONFIGURATION,
    evidenceQueryToken: read.retrieval.queryToken,
    evidenceRecordIds: [read.retrieval.records[0]!.recordId],
    summary: 'Focus Cancel first.',
    idempotencyKey: '00000000-0000-4000-8000-000000000728',
  }, { signal }) as { proposal: { proposalId: string } };

  const outsider = await workspace(224);
  const apply = routeTools(outsider).tools[2]!;
  const probe = async (proposalId: string, key: string) => {
    try {
      await apply.execute({ proposalId, expectedImplementedRevision: 1, idempotencyKey: key }, { signal });
      return 'unexpected-success';
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };
  expect(await probe(
    created.proposal.proposalId,
    '00000000-0000-4000-8000-000000000729',
  )).toBe(await probe(
    '00000000-0000-4000-8000-000000000799',
    '00000000-0000-4000-8000-000000000730',
  ));
});
