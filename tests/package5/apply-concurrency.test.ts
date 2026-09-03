import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import { applyProposal } from '../../lib/server/package5-apply-history-undo.ts';
import {
  approvePackage5Fixture,
  package5Now,
  package5Secrets,
} from './helpers.ts';

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM workspaces').run();
});

test('100 paired same-base attempts produce exactly 100 winners and no partial graph', async () => {
  let winners = 0;
  for (let pair = 0; pair < 100; pair += 1) {
    await env.DB.prepare('DELETE FROM workspaces').run();
    const fixture = await approvePackage5Fixture(180 + pair);
    const attempt = (suffix: number) => applyProposal({
      db: env.DB,
      cookieHeader: fixture.session.setCookie,
      now: package5Now + 5,
      sessionSecret: package5Secrets.sessionSecret,
      input: {
        proposalId: fixture.created.proposal.proposalId,
        expectedImplementedRevision: 1,
        idempotencyKey: `20000000-0000-4000-8000-${(pair * 2 + suffix).toString().padStart(12, '0')}`,
      },
    });
    const settled = await Promise.allSettled([attempt(0), attempt(1)]);
    const fulfilled = settled.filter(({ status }) => status === 'fulfilled');
    const rejected = settled.filter(({ status }) => status === 'rejected');
    expect(fulfilled, `pair ${pair}`).toHaveLength(1);
    expect(rejected, `pair ${pair}`).toHaveLength(1);
    winners += fulfilled.length;
    expect(await env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM application_receipts) AS receipts,
         (SELECT COUNT(*) FROM application_commits) AS commits,
         (SELECT COUNT(*) FROM implemented_focus_revisions WHERE revision = 2) AS revisions,
         (SELECT COUNT(*) FROM audit_events WHERE action = 'application.applied') AS audits`,
    ).first()).toEqual({ receipts: 1, commits: 1, revisions: 1, audits: 1 });
  }
  expect(winners).toBe(100);
}, 20_000);
