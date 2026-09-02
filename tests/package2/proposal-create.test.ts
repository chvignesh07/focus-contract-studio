import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import { CANCEL_CONFIGURATION } from '../../lib/domain/focus-configuration';
import { getActiveFocusReview } from '../../lib/server/active-focus-review';
import { createProposal } from '../../lib/server/create-proposal';
import {
  commitInitialFocusObservation,
  INITIAL_FOCUS_MANIFEST,
} from '../../lib/server/initial-focus-observation';
import { bootstrapWorkspace } from '../../lib/server/workspaces';
import { setActiveVariantFixture } from '../helpers/set-active-variant';

const secrets = {
  sessionSecret: 'package2-test-session-secret-material-32-bytes-minimum',
  csrfSecret: 'package2-test-csrf-secret-material-32-bytes-minimum',
};
const now = 1_788_100_000;

async function setup(tokenByte = 71) {
  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now,
    tokenBytes: new Uint8Array(32).fill(tokenByte),
    ...secrets,
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
  const review = await getActiveFocusReview({
    db: env.DB,
    cookieHeader: session.setCookie,
    now: now + 2,
    sessionSecret: secrets.sessionSecret,
  });
  return { session, review };
}

function proposalInput(queryToken: string, overrides: Record<string, unknown> = {}) {
  return {
    baseImplementedRevision: 1,
    configuration: CANCEL_CONFIGURATION,
    evidenceQueryToken: queryToken,
    evidenceRecordIds: ['D001'],
    summary: 'Focus Cancel first.',
    idempotencyKey: '00000000-0000-4000-8000-000000002001',
    ...overrides,
  };
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM workspaces').run();
});

test('D001 supports one immutable NOT APPLIED Cancel proposal and revision 1 stays live', async () => {
  const { session, review } = await setup();
  const result = await createProposal({
    db: env.DB,
    cookieHeader: session.setCookie,
    now: now + 3,
    sessionSecret: secrets.sessionSecret,
    input: proposalInput(review.retrieval.queryToken),
  });

  expect(result).toMatchObject({
    ok: true,
    contractVersion: 'fcs-webmcp-v2',
    proposal: {
      baseImplementedRevision: 1,
      changedFields: ['initialFocus'],
      fieldEvidence: [
        { field: 'initialFocus', recordId: 'D001', outcomeKey: 'cancel-button' },
      ],
      status: 'proposed',
      applied: false,
      label: 'NOT APPLIED',
      createdAt: '2026-08-30T14:26:43Z',
    },
  });
  expect(result.proposal.proposalDigest8).toMatch(/^[0-9a-f]{8}$/u);

  const graph = await env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM retrieval_queries WHERE workspace_id = ?) AS queries,
      (SELECT COUNT(*) FROM retrieval_results WHERE workspace_id = ?) AS results,
      (SELECT COUNT(*) FROM proposals WHERE workspace_id = ?) AS proposals,
      (SELECT COUNT(*) FROM proposal_evidence WHERE workspace_id = ?) AS evidence,
      (SELECT COUNT(*) FROM idempotency_records
        WHERE workspace_id = ? AND operation = 'create_proposal' AND state = 'committed') AS committed,
      (SELECT COUNT(*) FROM audit_events
        WHERE workspace_id = ? AND action = 'proposal.created' AND result = 'success') AS audits`,
  )
    .bind(
      session.workspace.id,
      session.workspace.id,
      session.workspace.id,
      session.workspace.id,
      session.workspace.id,
      session.workspace.id,
    )
    .first<Record<string, number>>();
  expect(graph).toEqual({
    queries: 1,
    results: 2,
    proposals: 1,
    evidence: 1,
    committed: 1,
    audits: 1,
  });
  const active = await env.DB.prepare(
    `SELECT v.active_implemented_revision, r.configuration_json
       FROM workspace_view_state s
       JOIN component_variants v
         ON v.workspace_id = s.workspace_id AND v.id = s.active_variant_id
       JOIN implemented_focus_revisions r
         ON r.workspace_id = v.workspace_id AND r.variant_id = v.id
        AND r.revision = v.active_implemented_revision
      WHERE s.workspace_id = ?`,
  )
    .bind(session.workspace.id)
    .first<{ active_implemented_revision: number; configuration_json: string }>();
  expect(active?.active_implemented_revision).toBe(1);
  expect(JSON.parse(active!.configuration_json).initialFocus).toBe('delete-button');

  const after = await getActiveFocusReview({
    db: env.DB,
    cookieHeader: session.setCookie,
    now: now + 4,
    sessionSecret: secrets.sessionSecret,
  });
  expect(after.proposal).toMatchObject({
    proposalId: result.proposal.proposalId,
    baseImplementedRevision: 1,
    proposalDigest8: result.proposal.proposalDigest8,
    changedFields: ['initialFocus'],
    fieldEvidence: [
      { field: 'initialFocus', recordId: 'D001', outcomeKey: 'cancel-button' },
    ],
    status: 'proposed',
    applied: false,
    label: 'NOT APPLIED',
  });
  expect(after.review.implemented.initialFocus).toBe('delete-button');
});

test('tamper, wrong citation, cross-session, expiry, and active-variant drift commit nothing', async () => {
  const scenarios: Array<{
    name: string;
    mutate: (fixture: Awaited<ReturnType<typeof setup>>) => Promise<{
      cookie: string | null;
      at: number;
      input: Record<string, unknown>;
    }>;
  }> = [
    {
      name: 'tamper',
      mutate: async ({ session, review }) => {
        const last = review.retrieval.queryToken.at(-1);
        return {
          cookie: session.setCookie,
          at: now + 3,
          input: proposalInput(
            `${review.retrieval.queryToken.slice(0, -1)}${last === 'A' ? 'B' : 'A'}`,
          ),
        };
      },
    },
    {
      name: 'wrong citation',
      mutate: async ({ session, review }) => ({
        cookie: session.setCookie,
        at: now + 3,
        input: proposalInput(review.retrieval.queryToken, {
          evidenceRecordIds: ['D999'],
        }),
      }),
    },
    {
      name: 'expiry',
      mutate: async ({ session, review }) => ({
        cookie: session.setCookie,
        at: now + 303,
        input: proposalInput(review.retrieval.queryToken),
      }),
    },
    {
      name: 'active variant drift',
      mutate: async ({ session, review }) => {
        const danger = await env.DB.prepare(
          `SELECT id FROM component_variants
            WHERE workspace_id = ? AND slug = 'delete-account-danger-emphasis'`,
        )
          .bind(session.workspace.id)
          .first<{ id: string }>();
        await setActiveVariantFixture(env.DB, session.workspace.id, danger!.id, 1);
        return {
          cookie: session.setCookie,
          at: now + 3,
          input: proposalInput(review.retrieval.queryToken),
        };
      },
    },
  ];

  for (let index = 0; index < scenarios.length; index += 1) {
    await env.DB.prepare('DELETE FROM workspaces').run();
    const fixture = await setup(72 + index);
    const scenario = scenarios[index]!;
    const attempt = await scenario.mutate(fixture);
    await expect(
      createProposal({
        db: env.DB,
        cookieHeader: attempt.cookie,
        now: attempt.at,
        sessionSecret: secrets.sessionSecret,
        input: attempt.input,
      }),
      scenario.name,
    ).rejects.toMatchObject({ code: 'EVIDENCE_NOT_ELIGIBLE' });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM proposals').first(),
    ).toEqual({ count: 0 });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM retrieval_queries').first(),
    ).toEqual({ count: 0 });
  }

  await env.DB.prepare('DELETE FROM workspaces').run();
  const owner = await setup(79);
  const other = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now,
    tokenBytes: new Uint8Array(32).fill(80),
    ...secrets,
  });
  await expect(
    createProposal({
      db: env.DB,
      cookieHeader: other.setCookie,
      now: now + 3,
      sessionSecret: secrets.sessionSecret,
      input: proposalInput(owner.review.retrieval.queryToken),
    }),
  ).rejects.toMatchObject({ code: 'EVIDENCE_NOT_ELIGIBLE' });
  expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM proposals').first()).toEqual({
    count: 0,
  });
});

test('same-key replay recovers one proposal and different content conflicts', async () => {
  const { session, review } = await setup(81);
  const input = proposalInput(review.retrieval.queryToken);
  const first = await createProposal({
    db: env.DB,
    cookieHeader: session.setCookie,
    now: now + 3,
    sessionSecret: secrets.sessionSecret,
    input,
  });
  const replay = await createProposal({
    db: env.DB,
    cookieHeader: session.setCookie,
    now: now + 400,
    sessionSecret: secrets.sessionSecret,
    input,
  });
  expect(replay).toEqual(first);

  await expect(
    createProposal({
      db: env.DB,
      cookieHeader: session.setCookie,
      now: now + 4,
      sessionSecret: secrets.sessionSecret,
      input: proposalInput(review.retrieval.queryToken, {
        summary: 'Different request.',
      }),
    }),
  ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM proposals').first()).toEqual({
    count: 1,
  });
});

test('paired same-key creates converge on one durable proposal and receipt', async () => {
  const { session, review } = await setup(82);
  const operation = {
    db: env.DB,
    cookieHeader: session.setCookie,
    now: now + 3,
    sessionSecret: secrets.sessionSecret,
    input: proposalInput(review.retrieval.queryToken),
  };
  const [left, right] = await Promise.all([
    createProposal(operation),
    createProposal(operation),
  ]);
  expect(left).toEqual(right);
  expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM proposals').first()).toEqual({
    count: 1,
  });
  expect(
    await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM idempotency_records
        WHERE operation = 'create_proposal' AND state = 'committed'`,
    ).first(),
  ).toEqual({ count: 1 });
});
