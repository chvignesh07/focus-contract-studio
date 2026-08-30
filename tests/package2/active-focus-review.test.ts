import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import { getActiveFocusReview } from '../../lib/server/active-focus-review';
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

async function snapshot(workspaceId: string): Promise<Record<string, number>> {
  return (await env.DB.prepare(
    `SELECT
      (SELECT last_access_at FROM workspaces WHERE id = ?) AS lastAccess,
      (SELECT COUNT(*) FROM workspaces) AS workspaces,
      (SELECT COUNT(*) FROM observation_sessions) AS observations,
      (SELECT COUNT(*) FROM retrieval_queries) AS queries,
      (SELECT COUNT(*) FROM retrieval_results) AS results,
      (SELECT COUNT(*) FROM proposals) AS proposals,
      (SELECT COUNT(*) FROM proposal_evidence) AS evidence,
      (SELECT COUNT(*) FROM idempotency_records) AS idempotency,
      (SELECT COUNT(*) FROM audit_events) AS audits,
      (SELECT COUNT(*) FROM rate_limit_windows) AS rateWindows`,
  )
    .bind(workspaceId)
    .first<Record<string, number>>())!;
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM workspaces').run();
});

test('reads revision, raw observation, D001 mismatch, and bounded token with zero writes', async () => {
  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now,
    tokenBytes: new Uint8Array(32).fill(61),
    ...secrets,
  });
  await commitInitialFocusObservation({
    db: env.DB,
    workspaceId: session.workspace.id,
    now: now + 1,
    environment: 'playwright',
    firstTargetId: 'delete-button',
    clientOffsetMs: 10,
    manifest: INITIAL_FOCUS_MANIFEST,
  });
  const before = await snapshot(session.workspace.id);

  const review = await getActiveFocusReview({
    db: env.DB,
    cookieHeader: session.setCookie,
    now: now + 2,
    sessionSecret: secrets.sessionSecret,
  });
  const repeated = await getActiveFocusReview({
    db: env.DB,
    cookieHeader: session.setCookie,
    now: now + 2,
    sessionSecret: secrets.sessionSecret,
  });

  expect(review).toEqual(repeated);
  expect(review).toMatchObject({
    ok: true,
    contractVersion: 'fcs-webmcp-v2',
    review: {
      variant: 'delete-account-standard',
      implementedRevision: 1,
      implemented: { initialFocus: 'delete-button' },
      observation: {
        observedInitialFocus: 'delete-button',
        trust: 'untrusted-browser-telemetry',
      },
      precedentComparison: {
        label: 'DECISION_MISMATCH',
        behavior: 'initial-focus',
        implementedOutcome: 'delete-button',
        precedentOutcome: 'cancel-button',
      },
    },
    retrieval: {
      algorithm: 'rrf-k60-v2',
      disposition: 'results',
      reasonCode: 'SUPPORTED_PRECEDENT',
    },
    proposal: null,
  });
  expect(review.retrieval.records[0]).toMatchObject({
    recordId: 'D001',
    outcomeKey: 'cancel-button',
  });
  expect(review.retrieval.records.length).toBeLessThanOrEqual(3);
  expect(review.retrieval.queryToken).toMatch(
    /^v1\.1788100002\.[A-Za-z0-9_-]{43}$/u,
  );
  expect(review.retrieval.queryToken.length).toBeLessThanOrEqual(96);
  expect(review.retrieval.issuedAt).toBe('2026-08-30T14:26:42Z');
  expect(review.retrieval.expiresAt).toBe('2026-08-30T14:31:42Z');
  expect(await snapshot(session.workspace.id)).toEqual(before);

  const serialized = JSON.stringify(review);
  expect(serialized).not.toContain(session.workspace.id);
  expect(serialized).not.toContain(session.csrfToken);
  expect(serialized).not.toContain('__Host-fcs_session');
});

test('missing or invalid sessions fail closed and create no workspace', async () => {
  await expect(
    getActiveFocusReview({
      db: env.DB,
      cookieHeader: null,
      now,
      sessionSecret: secrets.sessionSecret,
    }),
  ).rejects.toMatchObject({ code: 'SESSION_INVALID' });
  await expect(
    getActiveFocusReview({
      db: env.DB,
      cookieHeader: '__Host-fcs_session=forged',
      now,
      sessionSecret: secrets.sessionSecret,
    }),
  ).rejects.toMatchObject({ code: 'SESSION_INVALID' });
  expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM workspaces').first()).toEqual({
    count: 0,
  });
});
