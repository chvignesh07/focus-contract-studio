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

const secrets = {
  sessionSecret: 'package2-test-session-secret-material-32-bytes-minimum',
  csrfSecret: 'package2-test-csrf-secret-material-32-bytes-minimum',
};
const now = 1_788_100_000;

async function fixture(tokenByte: number) {
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
    clientOffsetMs: 4,
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

async function mutationCounts(): Promise<Record<string, number>> {
  return (await env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM retrieval_queries) AS queries,
      (SELECT COUNT(*) FROM retrieval_results) AS results,
      (SELECT COUNT(*) FROM proposals) AS proposals,
      (SELECT COUNT(*) FROM proposal_evidence) AS evidence,
      (SELECT COUNT(*) FROM idempotency_records
        WHERE operation = 'create_proposal') AS idempotency,
      (SELECT COUNT(*) FROM audit_events
        WHERE action = 'proposal.created') AS audits`,
  ).first<Record<string, number>>())!;
}

beforeEach(async () => {
  await env.DB.prepare('DROP TRIGGER IF EXISTS package2_test_proposal_failure').run();
  await env.DB.prepare('DELETE FROM workspaces').run();
});

test('every guarded-batch statement class rolls back the complete proposal graph', async () => {
  const injections = [
    `BEFORE INSERT ON idempotency_records WHEN NEW.operation = 'create_proposal'`,
    `BEFORE INSERT ON retrieval_queries`,
    `BEFORE INSERT ON retrieval_results`,
    `BEFORE INSERT ON proposals`,
    `BEFORE INSERT ON proposal_evidence`,
    `BEFORE UPDATE ON idempotency_records WHEN OLD.operation = 'create_proposal'`,
    `BEFORE INSERT ON audit_events WHEN NEW.action = 'proposal.created'`,
  ];

  for (let index = 0; index < injections.length; index += 1) {
    await env.DB.prepare('DROP TRIGGER IF EXISTS package2_test_proposal_failure').run();
    await env.DB.prepare('DELETE FROM workspaces').run();
    const { session, review } = await fixture(90 + index);
    await env.DB.prepare(
      `CREATE TRIGGER package2_test_proposal_failure ${injections[index]}
       BEGIN SELECT RAISE(ABORT, 'PACKAGE2_INJECTED_PROPOSAL_FAILURE'); END`,
    ).run();
    await expect(
      createProposal({
        db: env.DB,
        cookieHeader: session.setCookie,
        now: now + 3,
        sessionSecret: secrets.sessionSecret,
        input: {
          baseImplementedRevision: 1,
          configuration: CANCEL_CONFIGURATION,
          evidenceQueryToken: review.retrieval.queryToken,
          evidenceRecordIds: ['D001'],
          summary: 'Focus Cancel first.',
          idempotencyKey: `00000000-0000-4000-8000-${String(2100 + index).padStart(12, '0')}`,
        },
      }),
    ).rejects.toMatchObject({ code: 'PROPOSAL_WRITE_FAILED' });
    expect(await mutationCounts()).toEqual({
      queries: 0,
      results: 0,
      proposals: 0,
      evidence: 0,
      idempotency: 0,
      audits: 0,
    });
  }
});

test('a zero-row authorization guard aborts rather than leaving partial rows', async () => {
  const { session, review } = await fixture(99);
  await env.DB.prepare(
    `CREATE TRIGGER package2_test_proposal_failure
       BEFORE INSERT ON idempotency_records
       WHEN NEW.operation = 'create_proposal'
       BEGIN SELECT RAISE(IGNORE); END`,
  ).run();
  await expect(
    createProposal({
      db: env.DB,
      cookieHeader: session.setCookie,
      now: now + 3,
      sessionSecret: secrets.sessionSecret,
      input: {
        baseImplementedRevision: 1,
        configuration: CANCEL_CONFIGURATION,
        evidenceQueryToken: review.retrieval.queryToken,
        evidenceRecordIds: ['D001'],
        summary: 'Focus Cancel first.',
        idempotencyKey: '00000000-0000-4000-8000-000000002199',
      },
    }),
  ).rejects.toMatchObject({ code: 'PROPOSAL_WRITE_FAILED' });
  expect(await mutationCounts()).toEqual({
    queries: 0,
    results: 0,
    proposals: 0,
    evidence: 0,
    idempotency: 0,
    audits: 0,
  });
});
