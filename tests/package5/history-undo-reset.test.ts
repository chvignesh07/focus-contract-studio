import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import {
  applyProposal,
  getPackage5History,
  undoRevision,
} from '../../lib/server/package5-apply-history-undo.ts';
import { resetWorkspace } from '../../lib/server/workspaces.ts';
import {
  approvePackage5Fixture,
  createPackage5Fixture,
  package5Now,
  package5Secrets,
} from './helpers.ts';

async function applied(tokenByte = 167) {
  const fixture = await approvePackage5Fixture(tokenByte);
  const result = await applyProposal({
    db: env.DB, cookieHeader: fixture.session.setCookie,
    now: package5Now + 5, sessionSecret: package5Secrets.sessionSecret,
    input: {
      proposalId: fixture.created.proposal.proposalId,
      expectedImplementedRevision: 1,
      idempotencyKey: `40000000-0000-4000-8000-${tokenByte.toString().padStart(12, '0')}`,
    },
  });
  return { fixture, result };
}

beforeEach(async () => {
  await env.DB.prepare('DROP TRIGGER IF EXISTS package5_test_undo_failure').run();
  await env.DB.prepare('DELETE FROM workspaces').run();
});

test('history is current-workspace-only, bounded, chronological, and contains no authority secrets', async () => {
  const { fixture } = await applied();
  await createPackage5Fixture(168);
  await expect(applyProposal({
    db: env.DB, cookieHeader: fixture.session.setCookie,
    now: package5Now + 6, sessionSecret: package5Secrets.sessionSecret,
    input: {
      proposalId: fixture.created.proposal.proposalId,
      expectedImplementedRevision: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000005399',
    },
  })).rejects.toMatchObject({ code: 'PROPOSAL_NOT_APPROVED' });
  const history = await getPackage5History({
    db: env.DB, cookieHeader: fixture.session.setCookie,
    now: package5Now + 6, sessionSecret: package5Secrets.sessionSecret,
  });
  expect(history.activeRevision).toBe(2);
  expect(history.records.slice(0, 4).map(({ kind }) => kind)).toEqual([
    'revision', 'rehearsal', 'proposal', 'decision',
  ]);
  expect(history.records.slice(4, 6).map(({ kind }) => kind).sort()).toEqual([
    'application', 'revision',
  ]);
  expect(history.records.at(-1)).toMatchObject({ kind: 'failure', code: 'PROPOSAL_NOT_APPROVED' });
  const serialized = JSON.stringify(history);
  expect(serialized).not.toMatch(/csrf|cookie|sessionToken|proposal_json|configuration_json|rationale/iu);
  const one = await getPackage5History({
    db: env.DB, cookieHeader: fixture.session.setCookie,
    now: package5Now + 6, sessionSecret: package5Secrets.sessionSecret, limit: 1,
  });
  expect(one.records).toHaveLength(1);
  expect(one.records[0]?.kind).toBe('failure');
});

test('undo creates revision 3 from revision 1, replays once, and old approval can never apply again', async () => {
  const { fixture } = await applied(169);
  const input = {
    restoreRevision: 1,
    expectedImplementedRevision: 2,
    idempotencyKey: '00000000-0000-4000-8000-000000005301',
  };
  const first = await undoRevision({
    db: env.DB, cookieHeader: fixture.session.setCookie,
    now: package5Now + 6, sessionSecret: package5Secrets.sessionSecret, input,
  });
  const replay = await undoRevision({
    db: env.DB, cookieHeader: fixture.session.setCookie,
    now: package5Now + 7, sessionSecret: package5Secrets.sessionSecret, input,
  });
  expect(first.receipt).toMatchObject({ restoredRevision: 1, fromRevision: 2, toRevision: 3, replayed: false });
  expect(replay.receipt).toMatchObject({ revisionId: first.receipt.revisionId, replayed: true });
  expect(await env.DB.prepare(
    `SELECT v.active_implemented_revision,
            json_extract(r.configuration_json, '$.initialFocus') AS initial_focus,
            r.parent_revision, r.source_proposal_id, r.source_receipt_id,
            (SELECT COUNT(*) FROM undo_commits WHERE workspace_id = v.workspace_id) AS commits
       FROM component_variants v JOIN implemented_focus_revisions r
         ON r.workspace_id = v.workspace_id AND r.variant_id = v.id
        AND r.revision = v.active_implemented_revision
      WHERE v.workspace_id = ? AND v.id = (SELECT active_variant_id FROM workspace_view_state WHERE workspace_id = ?)`,
  ).bind(fixture.session.workspace.id, fixture.session.workspace.id).first()).toEqual({
    active_implemented_revision: 3,
    initial_focus: 'delete-button', parent_revision: 2,
    source_proposal_id: null, source_receipt_id: null, commits: 1,
  });
  await expect(applyProposal({
    db: env.DB, cookieHeader: fixture.session.setCookie,
    now: package5Now + 8, sessionSecret: package5Secrets.sessionSecret,
    input: {
      proposalId: fixture.created.proposal.proposalId,
      expectedImplementedRevision: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000005302',
    },
  })).rejects.toMatchObject({ code: 'PROPOSAL_NOT_APPROVED' });
});

test('undo downstream failure rolls back revision, pointer, idempotency, audit, and finalizer', async () => {
  const { fixture } = await applied(170);
  await env.DB.prepare(
    `CREATE TRIGGER package5_test_undo_failure
     BEFORE INSERT ON audit_events
     WHEN NEW.action = 'revision.undone'
     BEGIN SELECT RAISE(ABORT, 'TEST_UNDO_FAILURE'); END`,
  ).run();
  await expect(undoRevision({
    db: env.DB, cookieHeader: fixture.session.setCookie,
    now: package5Now + 6, sessionSecret: package5Secrets.sessionSecret,
    input: {
      restoreRevision: 1, expectedImplementedRevision: 2,
      idempotencyKey: '00000000-0000-4000-8000-000000005303',
    },
  })).rejects.toMatchObject({ code: 'UNDO_WRITE_FAILED' });
  expect(await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM implemented_focus_revisions WHERE workspace_id = ? AND revision = 3) AS revisions,
       (SELECT COUNT(*) FROM undo_commits WHERE workspace_id = ?) AS commits,
       (SELECT COUNT(*) FROM idempotency_records WHERE workspace_id = ? AND operation = 'undo') AS recovery,
       (SELECT active_implemented_revision FROM component_variants WHERE workspace_id = ? AND id = (SELECT active_variant_id FROM workspace_view_state WHERE workspace_id = ?)) AS active`,
  ).bind(
    fixture.session.workspace.id, fixture.session.workspace.id,
    fixture.session.workspace.id, fixture.session.workspace.id,
    fixture.session.workspace.id,
  ).first()).toEqual({ revisions: 0, commits: 0, recovery: 0, active: 2 });
});

test('reset rotates only the current workspace and recovers the exact new seed', async () => {
  const owner = await applied(171);
  const other = await createPackage5Fixture(172);
  const otherBefore = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM proposals WHERE workspace_id = ?',
  ).bind(other.session.workspace.id).first();
  const key = '00000000-0000-4000-8000-000000005304';
  const reset = await resetWorkspace({
    db: env.DB,
    cookieHeader: owner.fixture.session.setCookie!,
    csrfToken: owner.fixture.session.csrfToken,
    idempotencyKey: key,
    now: package5Now + 6,
    ...package5Secrets,
  });
  const replay = await resetWorkspace({
    db: env.DB,
    cookieHeader: owner.fixture.session.setCookie!,
    csrfToken: owner.fixture.session.csrfToken,
    idempotencyKey: key,
    now: package5Now + 7,
    ...package5Secrets,
  });
  expect(reset).toMatchObject({ workspace: { generation: 2 }, replayed: false });
  expect(replay).toMatchObject({ workspace: { id: reset.workspace.id, generation: 2 }, replayed: true });
  const resetHistory = await getPackage5History({
    db: env.DB, cookieHeader: reset.setCookie,
    now: package5Now + 8, sessionSecret: package5Secrets.sessionSecret,
  });
  expect(resetHistory.records.some(({ kind, code }) =>
    kind === 'reset' && code === 'WORKSPACE_RESET')).toBe(true);
  expect(await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM proposals WHERE workspace_id = ?',
  ).bind(other.session.workspace.id).first()).toEqual(otherBefore);
  await expect(getPackage5History({
    db: env.DB, cookieHeader: owner.fixture.session.setCookie,
    now: package5Now + 8, sessionSecret: package5Secrets.sessionSecret,
  })).rejects.toMatchObject({ code: 'SESSION_INVALID' });
});
