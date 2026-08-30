import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import { CANCEL_CONFIGURATION } from '../../lib/domain/focus-configuration';
import { getActiveFocusReview } from '../../lib/server/active-focus-review';
import { createProposal } from '../../lib/server/create-proposal';
import { bootstrapWorkspace } from '../../lib/server/workspaces';

const secrets = {
  sessionSecret: 'package2-test-session-secret-material-32-bytes-minimum',
  csrfSecret: 'package2-test-csrf-secret-material-32-bytes-minimum',
};
const now = 1_788_100_000;

async function restoreProfileUpdateGuard(): Promise<void> {
  await env.DB.prepare(
    `CREATE TRIGGER IF NOT EXISTS trg_precedent_profiles_immutable_update
       BEFORE UPDATE ON precedent_retrieval_profiles
       BEGIN SELECT RAISE(ABORT, 'PRECEDENT_PROFILE_IMMUTABLE'); END`,
  ).run();
}

beforeEach(async () => {
  await restoreProfileUpdateGuard();
  await env.DB.prepare('DELETE FROM workspaces').run();
});

test('the identical Cancel agent proposal fails when eligible memory is off', async () => {
  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now,
    tokenBytes: new Uint8Array(32).fill(111),
    ...secrets,
  });
  await env.DB.prepare('DROP TRIGGER trg_precedent_profiles_immutable_update').run();
  try {
    await env.DB.prepare(
      `UPDATE precedent_retrieval_profiles
          SET source_status = 'rejected'
        WHERE workspace_id = ? AND record_id IN (
          SELECT id FROM precedent_records
           WHERE workspace_id = ? AND record_key IN ('D001', 'D003')
        )`,
    )
      .bind(session.workspace.id, session.workspace.id)
      .run();
    const review = await getActiveFocusReview({
      db: env.DB,
      cookieHeader: session.setCookie,
      now: now + 2,
      sessionSecret: secrets.sessionSecret,
    });
    expect(review.retrieval.disposition).toBe('abstain');

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
          idempotencyKey: '00000000-0000-4000-8000-000000002301',
        },
      }),
    ).rejects.toMatchObject({ code: 'EVIDENCE_REQUIRED_FOR_AGENT_CHANGE' });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM proposals').first()).toEqual({
      count: 0,
    });
    const active = await env.DB.prepare(
      `SELECT active_implemented_revision FROM component_variants
        WHERE workspace_id = ? AND slug = 'delete-account-standard'`,
    )
      .bind(session.workspace.id)
      .first();
    expect(active).toEqual({ active_implemented_revision: 1 });
  } finally {
    await restoreProfileUpdateGuard();
  }
});
