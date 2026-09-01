import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import {
  CANCEL_CONFIGURATION,
} from '../../lib/domain/focus-configuration.ts';
import { commitInitialFocusObservation, INITIAL_FOCUS_MANIFEST } from '../../lib/server/initial-focus-observation.ts';
import { createReviewerProposal, reviewProposal } from '../../lib/server/package5-review.ts';
import { bootstrapWorkspace } from '../../lib/server/workspaces.ts';
import {
  createPackage5Fixture,
  package5Now,
  package5Secrets,
} from './helpers.ts';

function decisionInput(
  action: 'approve' | 'reject' | 'revoke',
  key: string,
) {
  return {
    action,
    idempotencyKey: key,
  };
}

beforeEach(async () => {
  await env.DB.prepare('DROP TRIGGER IF EXISTS package5_test_review_failure').run();
  await env.DB.prepare('DELETE FROM workspaces').run();
});

test('approve is append-only, exact, recoverable, and does not change revision 1', async () => {
  const fixture = await createPackage5Fixture();
  const request = decisionInput(
    'approve', '00000000-0000-4000-8000-000000005101',
  );
  const first = await reviewProposal({
    db: env.DB,
    cookieHeader: fixture.session.setCookie,
    proposalId: fixture.created.proposal.proposalId,
    now: package5Now + 4,
    sessionSecret: package5Secrets.sessionSecret,
    input: request,
  });
  const replay = await reviewProposal({
    db: env.DB,
    cookieHeader: fixture.session.setCookie,
    proposalId: fixture.created.proposal.proposalId,
    now: package5Now + 5,
    sessionSecret: package5Secrets.sessionSecret,
    input: request,
  });
  expect(first.review).toMatchObject({ action: 'approve', status: 'approved', replayed: false });
  expect(replay.review).toMatchObject({ resultId: first.review.resultId, replayed: true });
  expect(await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM review_decisions) AS decisions,
       (SELECT COUNT(*) FROM review_commits) AS commits,
       (SELECT COUNT(*) FROM idempotency_records WHERE operation = 'review_approve' AND state = 'committed') AS recoveries,
       (SELECT active_implemented_revision FROM component_variants WHERE workspace_id = ? AND id = (SELECT active_variant_id FROM workspace_view_state WHERE workspace_id = ?)) AS revision`,
  ).bind(fixture.session.workspace.id, fixture.session.workspace.id).first()).toEqual({
    decisions: 1, commits: 1, recoveries: 1, revision: 1,
  });
  await expect(reviewProposal({
    db: env.DB,
    cookieHeader: fixture.session.setCookie,
    proposalId: fixture.created.proposal.proposalId,
    now: package5Now + 6,
    sessionSecret: package5Secrets.sessionSecret,
    input: { ...request, unexpectedAuthority: 2 },
  })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
});

test('reject and approve-then-revoke preserve chronological immutable decisions', async () => {
  const rejected = await createPackage5Fixture(152);
  const reject = await reviewProposal({
    db: env.DB, cookieHeader: rejected.session.setCookie,
    proposalId: rejected.created.proposal.proposalId, now: package5Now + 4,
    sessionSecret: package5Secrets.sessionSecret,
    input: decisionInput('reject', '00000000-0000-4000-8000-000000005102'),
  });
  expect(reject.review.status).toBe('rejected');

  await env.DB.prepare('DELETE FROM workspaces').run();
  const revoked = await createPackage5Fixture(153);
  await reviewProposal({
    db: env.DB, cookieHeader: revoked.session.setCookie,
    proposalId: revoked.created.proposal.proposalId, now: package5Now + 4,
    sessionSecret: package5Secrets.sessionSecret,
    input: decisionInput('approve', '00000000-0000-4000-8000-000000005103'),
  });
  const revoke = await reviewProposal({
    db: env.DB, cookieHeader: revoked.session.setCookie,
    proposalId: revoked.created.proposal.proposalId, now: package5Now + 5,
    sessionSecret: package5Secrets.sessionSecret,
    input: decisionInput('revoke', '00000000-0000-4000-8000-000000005104'),
  });
  expect(revoke.review.status).toBe('revoked');
  const decisions = await env.DB.prepare(
    'SELECT action FROM review_decisions WHERE workspace_id = ? ORDER BY created_at, id',
  ).bind(revoked.session.workspace.id).all<{ action: string }>();
  expect(decisions.results.map(({ action }) => action)).toEqual(['approve', 'revoke']);
});

test('edit creates a reviewer child and supersedes without mutating the parent payload', async () => {
  const fixture = await createPackage5Fixture(154);
  const before = await env.DB.prepare(
    'SELECT proposal_json FROM proposals WHERE workspace_id = ? AND id = ?',
  ).bind(fixture.session.workspace.id, fixture.created.proposal.proposalId).first<{ proposal_json: string }>();
  const input = {
    action: 'edit' as const,
    idempotencyKey: '00000000-0000-4000-8000-000000005105',
    configuration: { ...CANCEL_CONFIGURATION, initialFocus: 'reason-input' as const },
    summary: 'Reviewer chooses the reason field.',
  };
  const edited = await reviewProposal({
    db: env.DB, cookieHeader: fixture.session.setCookie,
    proposalId: fixture.created.proposal.proposalId, now: package5Now + 4,
    sessionSecret: package5Secrets.sessionSecret,
    input,
  });
  const replay = await reviewProposal({
    db: env.DB, cookieHeader: fixture.session.setCookie,
    proposalId: fixture.created.proposal.proposalId, now: package5Now + 5,
    sessionSecret: package5Secrets.sessionSecret, input,
  });
  expect(edited.review).toMatchObject({ action: 'edit', status: 'proposed', replayed: false });
  expect(replay.review).toMatchObject({ proposalId: edited.review.proposalId, replayed: true });
  await expect(reviewProposal({
    db: env.DB, cookieHeader: fixture.session.setCookie,
    proposalId: fixture.created.proposal.proposalId, now: package5Now + 6,
    sessionSecret: package5Secrets.sessionSecret,
    input: { ...input, summary: 'Conflicting retry.' },
  })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  const rows = await env.DB.prepare(
    'SELECT id, parent_proposal_id, author_kind, status, proposal_json FROM proposals WHERE workspace_id = ? ORDER BY created_at, id',
  ).bind(fixture.session.workspace.id).all<Record<string, unknown>>();
  expect(rows.results).toHaveLength(2);
  expect(rows.results.find(({ id }) => id === fixture.created.proposal.proposalId)).toMatchObject({
    status: 'superseded', proposal_json: before!.proposal_json,
  });
  expect(rows.results.find(({ id }) => id === edited.review.proposalId)).toMatchObject({
    parent_proposal_id: fixture.created.proposal.proposalId,
    author_kind: 'reviewer', status: 'proposed',
  });
  const child = rows.results.find(({ id }) => id === edited.review.proposalId)!;
  expect(JSON.parse(String(child.proposal_json))).toMatchObject({
    authorKind: 'reviewer', evidenceRecordIds: [], fieldEvidence: [],
  });
  expect(await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM proposal_evidence WHERE workspace_id = ? AND proposal_id = ?',
  ).bind(fixture.session.workspace.id, edited.review.proposalId).first()).toEqual({ count: 0 });
});

test('visible reviewer responsibility creates and recovers a novel proposal without precedent support', async () => {
  const session = await bootstrapWorkspace({
    db: env.DB, cookieHeader: null, now: package5Now,
    tokenBytes: new Uint8Array(32).fill(157), ...package5Secrets,
  });
  await commitInitialFocusObservation({
    db: env.DB, workspaceId: session.workspace.id, now: package5Now + 1,
    environment: 'playwright', firstTargetId: 'delete-button', clientOffsetMs: 8,
    manifest: INITIAL_FOCUS_MANIFEST,
  });
  const input = {
    configuration: CANCEL_CONFIGURATION,
    summary: 'Reviewer accepts responsibility for a novel Cancel-first proposal.',
    responsibilityAccepted: true as const,
    idempotencyKey: '00000000-0000-4000-8000-000000005111',
  };
  const first = await createReviewerProposal({
    db: env.DB, cookieHeader: session.setCookie, now: package5Now + 2,
    sessionSecret: package5Secrets.sessionSecret, input,
  });
  const replay = await createReviewerProposal({
    db: env.DB, cookieHeader: session.setCookie, now: package5Now + 3,
    sessionSecret: package5Secrets.sessionSecret, input,
  });
  expect(first.review).toMatchObject({ action: 'create', status: 'proposed', replayed: false });
  expect(replay.review).toMatchObject({ proposalId: first.review.proposalId, replayed: true });
  const stored = await env.DB.prepare(
    `SELECT author_kind, evidence_record_ids_json, support_map_json,
            json_array_length(json_extract(proposal_json, '$.fieldEvidence')) AS evidence_count,
            json_extract(proposal_json, '$.pageSessionId') AS page_session_id
       FROM proposals WHERE workspace_id = ? AND id = ?`,
  ).bind(session.workspace.id, first.review.proposalId).first();
  expect(stored).toMatchObject({
    author_kind: 'reviewer', evidence_record_ids_json: '[]', support_map_json: '{}',
    evidence_count: 0,
  });
  expect(stored?.page_session_id).toBeTruthy();
  await expect(createReviewerProposal({
    db: env.DB, cookieHeader: session.setCookie, now: package5Now + 4,
    sessionSecret: package5Secrets.sessionSecret,
    input: { ...input, responsibilityAccepted: false },
  })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
});

test('foreign/nonexistent and injected downstream failure expose no oracle or partial review', async () => {
  const owner = await createPackage5Fixture(155);
  const outsider = await createPackage5Fixture(156);
  const request = decisionInput('approve', '00000000-0000-4000-8000-000000005106');
  for (const proposalId of [owner.created.proposal.proposalId, '00000000-0000-4000-8000-000000005199']) {
    await expect(reviewProposal({
      db: env.DB, cookieHeader: outsider.session.setCookie, proposalId,
      now: package5Now + 4, sessionSecret: package5Secrets.sessionSecret, input: request,
    })).rejects.toMatchObject({ code: 'PROPOSAL_NOT_FOUND', status: 404 });
  }
  await env.DB.prepare(
    `CREATE TRIGGER package5_test_review_failure
     BEFORE INSERT ON audit_events
     WHEN NEW.action = 'review.approve'
     BEGIN SELECT RAISE(ABORT, 'TEST_REVIEW_FAILURE'); END`,
  ).run();
  await expect(reviewProposal({
    db: env.DB, cookieHeader: owner.session.setCookie,
    proposalId: owner.created.proposal.proposalId, now: package5Now + 5,
    sessionSecret: package5Secrets.sessionSecret, input: request,
  })).rejects.toMatchObject({ code: 'REVIEW_WRITE_FAILED' });
  expect(await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM review_decisions WHERE workspace_id = ?) AS decisions,
       (SELECT COUNT(*) FROM review_commits WHERE workspace_id = ?) AS commits,
       (SELECT status FROM proposals WHERE workspace_id = ? AND id = ?) AS status`,
  ).bind(owner.session.workspace.id, owner.session.workspace.id,
    owner.session.workspace.id, owner.created.proposal.proposalId).first()).toEqual({
    decisions: 0, commits: 0, status: 'proposed',
  });
});
