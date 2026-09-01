import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import { applyProposal } from '../../lib/server/package5-apply-history-undo.ts';
import { reviewProposal } from '../../lib/server/package5-review.ts';
import {
  approvePackage5Fixture,
  createPackage5Fixture,
  package5Now,
  package5Secrets,
} from './helpers.ts';

function request(proposalId: string, key = '00000000-0000-4000-8000-000000005201') {
  return { proposalId, expectedImplementedRevision: 1, idempotencyKey: key };
}

beforeEach(async () => {
  await env.DB.prepare('DROP TRIGGER IF EXISTS package5_test_apply_failure').run();
  await env.DB.prepare('DELETE FROM workspaces').run();
});

test('one exact approval creates one revision-2 receipt, pointer, recovery, audit, and applied transition', async () => {
  const fixture = await approvePackage5Fixture();
  const input = request(fixture.created.proposal.proposalId);
  const first = await applyProposal({
    db: env.DB, cookieHeader: fixture.session.setCookie,
    now: package5Now + 5, sessionSecret: package5Secrets.sessionSecret, input,
  });
  const replay = await applyProposal({
    db: env.DB, cookieHeader: fixture.session.setCookie,
    now: package5Now + 6, sessionSecret: package5Secrets.sessionSecret, input,
  });
  expect(first.receipt).toMatchObject({ fromRevision: 1, toRevision: 2, result: 'applied', replayed: false });
  expect(replay.receipt).toMatchObject({ receiptId: first.receipt.receiptId, replayed: true });
  const graph = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM application_guards WHERE workspace_id = ?) AS guards,
       (SELECT COUNT(*) FROM application_receipts WHERE workspace_id = ?) AS receipts,
       (SELECT COUNT(*) FROM application_commits WHERE workspace_id = ?) AS commits,
       (SELECT COUNT(*) FROM implemented_focus_revisions WHERE workspace_id = ? AND revision = 2) AS revisions,
       (SELECT COUNT(*) FROM idempotency_records WHERE workspace_id = ? AND operation = 'apply' AND state = 'committed') AS recoveries,
       (SELECT COUNT(*) FROM audit_events WHERE workspace_id = ? AND action = 'application.applied' AND result = 'success') AS audits,
       (SELECT status FROM proposals WHERE workspace_id = ? AND id = ?) AS status,
       (SELECT active_implemented_revision FROM component_variants WHERE workspace_id = ? AND id = (SELECT active_variant_id FROM workspace_view_state WHERE workspace_id = ?)) AS active`,
  ).bind(
    fixture.session.workspace.id, fixture.session.workspace.id,
    fixture.session.workspace.id, fixture.session.workspace.id,
    fixture.session.workspace.id, fixture.session.workspace.id,
    fixture.session.workspace.id, fixture.created.proposal.proposalId,
    fixture.session.workspace.id, fixture.session.workspace.id,
  ).first();
  expect(graph).toEqual({
    guards: 1, receipts: 1, commits: 1, revisions: 1,
    recoveries: 1, audits: 1, status: 'applied', active: 2,
  });
  const revision = await env.DB.prepare(
    `SELECT json_extract(configuration_json, '$.initialFocus') AS initial_focus,
            source_proposal_id, source_receipt_id
       FROM implemented_focus_revisions
      WHERE workspace_id = ? AND revision = 2`,
  ).bind(fixture.session.workspace.id).first();
  expect(revision).toEqual({
    initial_focus: 'cancel-button',
    source_proposal_id: fixture.created.proposal.proposalId,
    source_receipt_id: first.receipt.receiptId,
  });
});

test('unapproved, rejected, revoked, malformed authority, and old revision create no application residue', async () => {
  const fixture = await createPackage5Fixture(162);
  const unapproved = request(fixture.created.proposal.proposalId, '00000000-0000-4000-8000-000000005202');
  await expect(applyProposal({
    db: env.DB, cookieHeader: fixture.session.setCookie,
    now: package5Now + 4, sessionSecret: package5Secrets.sessionSecret, input: unapproved,
  })).rejects.toMatchObject({ code: 'PROPOSAL_NOT_APPROVED' });

  await reviewProposal({
    db: env.DB, cookieHeader: fixture.session.setCookie,
    proposalId: fixture.created.proposal.proposalId, now: package5Now + 5,
    sessionSecret: package5Secrets.sessionSecret,
    input: {
      action: 'reject',
      idempotencyKey: '00000000-0000-4000-8000-000000005203',
    },
  });
  await expect(applyProposal({
    db: env.DB, cookieHeader: fixture.session.setCookie,
    now: package5Now + 6, sessionSecret: package5Secrets.sessionSecret,
    input: request(fixture.created.proposal.proposalId, '00000000-0000-4000-8000-000000005204'),
  })).rejects.toMatchObject({ code: 'PROPOSAL_NOT_APPROVED' });

  await env.DB.prepare('DELETE FROM workspaces').run();
  const revoked = await approvePackage5Fixture(172);
  await reviewProposal({
    db: env.DB, cookieHeader: revoked.session.setCookie,
    proposalId: revoked.created.proposal.proposalId, now: package5Now + 5,
    sessionSecret: package5Secrets.sessionSecret,
    input: { action: 'revoke', idempotencyKey: '00000000-0000-4000-8000-000000005207' },
  });
  await expect(applyProposal({
    db: env.DB, cookieHeader: revoked.session.setCookie,
    now: package5Now + 6, sessionSecret: package5Secrets.sessionSecret,
    input: request(revoked.created.proposal.proposalId, '00000000-0000-4000-8000-000000005208'),
  })).rejects.toMatchObject({ code: 'PROPOSAL_NOT_APPROVED' });
  await expect(applyProposal({
    db: env.DB, cookieHeader: revoked.session.setCookie,
    now: package5Now + 6, sessionSecret: package5Secrets.sessionSecret,
    input: { ...request(revoked.created.proposal.proposalId, '00000000-0000-4000-8000-000000005209'), approved: true },
  })).rejects.toMatchObject({ code: 'INVALID_INPUT' });

  await env.DB.prepare('DELETE FROM workspaces').run();
  const old = await approvePackage5Fixture(173);
  await expect(applyProposal({
    db: env.DB, cookieHeader: old.session.setCookie,
    now: package5Now + 5, sessionSecret: package5Secrets.sessionSecret,
    input: { ...request(old.created.proposal.proposalId, '00000000-0000-4000-8000-000000005210'), expectedImplementedRevision: 2 },
  })).rejects.toMatchObject({ code: 'STALE_REVISION' });
  expect(await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM application_guards) AS guards,
       (SELECT COUNT(*) FROM application_receipts) AS receipts,
       (SELECT COUNT(*) FROM implemented_focus_revisions WHERE revision > 1) AS revisions`,
  ).first()).toEqual({ guards: 0, receipts: 0, revisions: 0 });
});

test('same key with different request conflicts and an injected downstream failure rolls back every write', async () => {
  const fixture = await approvePackage5Fixture(163);
  const input = request(fixture.created.proposal.proposalId, '00000000-0000-4000-8000-000000005205');
  await applyProposal({
    db: env.DB, cookieHeader: fixture.session.setCookie,
    now: package5Now + 5, sessionSecret: package5Secrets.sessionSecret, input,
  });
  await expect(applyProposal({
    db: env.DB, cookieHeader: fixture.session.setCookie,
    now: package5Now + 6, sessionSecret: package5Secrets.sessionSecret,
    input: { ...input, expectedImplementedRevision: 2 },
  })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

  await env.DB.prepare('DELETE FROM workspaces').run();
  const failing = await approvePackage5Fixture(164);
  await env.DB.prepare(
    `CREATE TRIGGER package5_test_apply_failure
     BEFORE INSERT ON audit_events
     WHEN NEW.action = 'application.applied'
     BEGIN SELECT RAISE(ABORT, 'TEST_APPLY_FAILURE'); END`,
  ).run();
  await expect(applyProposal({
    db: env.DB, cookieHeader: failing.session.setCookie,
    now: package5Now + 5, sessionSecret: package5Secrets.sessionSecret,
    input: request(failing.created.proposal.proposalId, '00000000-0000-4000-8000-000000005206'),
  })).rejects.toMatchObject({ code: 'APPLICATION_WRITE_FAILED' });
  expect(await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM application_guards) AS guards,
       (SELECT COUNT(*) FROM application_receipts) AS receipts,
       (SELECT COUNT(*) FROM application_commits) AS commits,
       (SELECT COUNT(*) FROM implemented_focus_revisions WHERE revision > 1) AS revisions,
       (SELECT active_implemented_revision FROM component_variants WHERE workspace_id = ? AND id = (SELECT active_variant_id FROM workspace_view_state WHERE workspace_id = ?)) AS active,
       (SELECT status FROM proposals WHERE id = ?) AS status`,
  ).bind(failing.session.workspace.id, failing.session.workspace.id,
    failing.created.proposal.proposalId).first()).toEqual({
    guards: 0, receipts: 0, commits: 0, revisions: 0,
    active: 1, status: 'approved',
  });
});
