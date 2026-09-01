import { env } from 'cloudflare:workers';

import { CANCEL_CONFIGURATION } from '../../lib/domain/focus-configuration.ts';
import { getActiveFocusReview } from '../../lib/server/active-focus-review.ts';
import { createProposal } from '../../lib/server/create-proposal.ts';
import {
  commitInitialFocusObservation,
  INITIAL_FOCUS_MANIFEST,
} from '../../lib/server/initial-focus-observation.ts';
import { bootstrapWorkspace } from '../../lib/server/workspaces.ts';
import { reviewProposal } from '../../lib/server/package5-review.ts';

export const package5Now = 1_788_500_000;
export const package5Secrets = {
  sessionSecret: 'package5-test-session-secret-material-32-bytes-minimum',
  csrfSecret: 'package5-test-csrf-secret-material-32-bytes-minimum',
};

export async function createPackage5Fixture(tokenByte = 151) {
  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: package5Now,
    tokenBytes: new Uint8Array(32).fill(tokenByte),
    ...package5Secrets,
  });
  await commitInitialFocusObservation({
    db: env.DB,
    workspaceId: session.workspace.id,
    now: package5Now + 1,
    environment: 'playwright',
    firstTargetId: 'delete-button',
    clientOffsetMs: 8,
    manifest: INITIAL_FOCUS_MANIFEST,
  });
  const review = await getActiveFocusReview({
    db: env.DB,
    cookieHeader: session.setCookie,
    now: package5Now + 2,
    sessionSecret: package5Secrets.sessionSecret,
  });
  const created = await createProposal({
    db: env.DB,
    cookieHeader: session.setCookie,
    now: package5Now + 3,
    sessionSecret: package5Secrets.sessionSecret,
    input: {
      baseImplementedRevision: 1,
      configuration: CANCEL_CONFIGURATION,
      evidenceQueryToken: review.retrieval.queryToken,
      evidenceRecordIds: ['D001'],
      summary: 'Focus Cancel first.',
      idempotencyKey: `00000000-0000-4000-8000-${tokenByte.toString().padStart(12, '0')}`,
    },
  });
  return {
    session,
    review,
    created,
    pageSessionId: review.review.observation!.rehearsalSessionId,
  };
}

export function reviewInput(
  fixture: Awaited<ReturnType<typeof createPackage5Fixture>>,
  action: 'approve' | 'reject' | 'revoke',
  idempotencyKey: string,
) {
  void fixture;
  return {
    action,
    idempotencyKey,
  };
}

export async function approvePackage5Fixture(tokenByte = 161) {
  const fixture = await createPackage5Fixture(tokenByte);
  await reviewProposal({
    db: env.DB,
    cookieHeader: fixture.session.setCookie,
    proposalId: fixture.created.proposal.proposalId,
    now: package5Now + 4,
    sessionSecret: package5Secrets.sessionSecret,
    input: {
      action: 'approve',
      idempotencyKey: `10000000-0000-4000-8000-${tokenByte.toString().padStart(12, '0')}`,
    },
  });
  return fixture;
}
