import { env } from 'cloudflare:workers';
import { beforeEach, expect, test } from 'vitest';

import { POST as resetRoute } from '../../app/api/session/reset/route.ts';
import {
  WORKSPACE_OPERATION_LIMITS,
  admitWorkspaceOperation,
} from '../../lib/server/admission.ts';
import {
  commitInitialFocusObservation,
  INITIAL_FOCUS_MANIFEST,
} from '../../lib/server/initial-focus-observation.ts';
import { applyProposal } from '../../lib/server/package5-apply-history-undo.ts';
import { runtimeSecurityConfig } from '../../lib/server/runtime-config.ts';
import { bootstrapWorkspace, resetWorkspace } from '../../lib/server/workspaces.ts';
import {
  approvePackage5Fixture,
  package5Now,
  package5Secrets,
} from '../package5/helpers.ts';

const rateSecret = 'package8-rate-limit-secret-material-32-bytes-minimum';

beforeEach(async () => {
  await env.DB.prepare('DROP TRIGGER IF EXISTS package5_test_apply_failure').run();
  await env.DB.prepare('DELETE FROM workspaces').run();
  await env.DB.prepare('DELETE FROM rate_limit_windows').run();
});

test('workspace admission is atomic, bounded per operation, and stores only a digest', async () => {
  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: package5Now,
    tokenBytes: new Uint8Array(32).fill(230),
    ...package5Secrets,
  });
  const workspaceId = session.workspace.id;
  const attempts = await Promise.allSettled(
    Array.from({ length: WORKSPACE_OPERATION_LIMITS.proposal + 4 }, () =>
      admitWorkspaceOperation({
        db: env.DB,
        workspaceId,
        operation: 'proposal',
        now: package5Now,
        secret: rateSecret,
      }),
    ),
  );
  expect(attempts.filter(({ status }) => status === 'fulfilled')).toHaveLength(
    WORKSPACE_OPERATION_LIMITS.proposal,
  );
  expect(await env.DB.prepare(
    `SELECT workspace_id, operation, request_count, key_digest
       FROM rate_limit_windows WHERE workspace_id = ? AND operation = 'proposal'`,
  ).bind(workspaceId).first()).toMatchObject({
    workspace_id: workspaceId,
    operation: 'proposal',
    request_count: WORKSPACE_OPERATION_LIMITS.proposal,
    key_digest: expect.stringMatching(/^[0-9a-f]{64}$/u),
  });
});

test('every Package 8 operation uses its exact shared hourly bound', async () => {
  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: package5Now,
    tokenBytes: new Uint8Array(32).fill(229),
    ...package5Secrets,
  });
  for (const [operation, limit] of Object.entries(WORKSPACE_OPERATION_LIMITS)) {
    await env.DB.prepare('DELETE FROM rate_limit_windows').run();
    for (let attempt = 1; attempt <= limit; attempt += 1) {
      await expect(admitWorkspaceOperation({
        db: env.DB,
        workspaceId: session.workspace.id,
        operation: operation as keyof typeof WORKSPACE_OPERATION_LIMITS,
        now: package5Now,
        secret: rateSecret,
      })).resolves.toBe(attempt);
    }
    await expect(admitWorkspaceOperation({
      db: env.DB,
      workspaceId: session.workspace.id,
      operation: operation as keyof typeof WORKSPACE_OPERATION_LIMITS,
      now: package5Now,
      secret: rateSecret,
    })).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 });
  }
});

test('initial-focus observation replay recovers before rehearsal admission', async () => {
  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: package5Now,
    tokenBytes: new Uint8Array(32).fill(228),
    ...package5Secrets,
  });
  const request = {
    db: env.DB,
    workspaceId: session.workspace.id,
    now: package5Now + 1,
    environment: 'playwright' as const,
    firstTargetId: 'delete-button' as const,
    clientOffsetMs: 8,
    manifest: INITIAL_FOCUS_MANIFEST,
  };
  const first = await commitInitialFocusObservation({
    ...request,
    admitOperation: async () => undefined,
  });
  for (let attempt = 0; attempt < WORKSPACE_OPERATION_LIMITS.rehearsal; attempt += 1) {
    await admitWorkspaceOperation({
      db: env.DB,
      workspaceId: session.workspace.id,
      operation: 'rehearsal',
      now: package5Now + 1,
      secret: rateSecret,
    });
  }
  const replay = await commitInitialFocusObservation({
    ...request,
    admitOperation: async (workspaceId) => {
      await admitWorkspaceOperation({
        db: env.DB,
        workspaceId,
        operation: 'rehearsal',
        now: package5Now + 1,
        secret: rateSecret,
      });
    },
  });
  expect(replay).toEqual(first);
});

test('reset rotation preserves one admission lineage across successor workspaces', async () => {
  let session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: package5Now,
    tokenBytes: new Uint8Array(32).fill(227),
    ...package5Secrets,
  });
  for (let reset = 1; reset <= WORKSPACE_OPERATION_LIMITS.reset; reset += 1) {
    const result = await resetWorkspace({
      db: env.DB,
      cookieHeader: session.setCookie ?? '',
      csrfToken: session.csrfToken,
      idempotencyKey: `90000000-0000-4000-8000-${reset.toString().padStart(12, '0')}`,
      now: package5Now + reset,
      ...package5Secrets,
      admitReset: async (workspaceId) => {
        await admitWorkspaceOperation({
          db: env.DB,
          workspaceId,
          operation: 'reset',
          now: package5Now + reset,
          secret: rateSecret,
        });
      },
    });
    session = { ...result, created: true };
  }
  expect(session.workspace.generation).toBe(6);
  await expect(resetWorkspace({
    db: env.DB,
    cookieHeader: session.setCookie ?? '',
    csrfToken: session.csrfToken,
    idempotencyKey: '90000000-0000-4000-8000-000000000006',
    now: package5Now + 6,
    ...package5Secrets,
    admitReset: async (workspaceId) => {
      await admitWorkspaceOperation({
        db: env.DB,
        workspaceId,
        operation: 'reset',
        now: package5Now + 6,
        secret: rateSecret,
      });
    },
  })).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 });
  expect(await env.DB.prepare(
    `SELECT COUNT(DISTINCT admission_subject_key) AS subjects,
            MAX(generation) AS generation
       FROM workspaces`,
  ).first()).toEqual({ subjects: 1, generation: 6 });
  expect(await env.DB.prepare(
    `SELECT request_count FROM rate_limit_windows
      WHERE workspace_id IS NOT NULL AND operation = 'reset'`,
  ).first()).toEqual({ request_count: WORKSPACE_OPERATION_LIMITS.reset });
});

test('locally rejected reset does not consume the shared global reset window', async () => {
  const configuration = runtimeSecurityConfig();
  const now = Math.floor(Date.now() / 1000);
  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now,
    tokenBytes: new Uint8Array(32).fill(226),
    sessionSecret: configuration.sessionSecret,
    csrfSecret: configuration.csrfSecret,
  });
  for (let attempt = 0; attempt < WORKSPACE_OPERATION_LIMITS.reset; attempt += 1) {
    await admitWorkspaceOperation({
      db: env.DB,
      workspaceId: session.workspace.id,
      operation: 'reset',
      now,
      secret: configuration.rateLimitSecret,
    });
  }
  const response = await resetRoute(new Request(`${configuration.publicOrigin}/api/session/reset`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: session.setCookie ?? '',
      origin: configuration.publicOrigin,
      'x-fcs-csrf': session.csrfToken,
    },
    body: JSON.stringify({ idempotencyKey: '90000000-0000-4000-8000-000000000007' }),
  }));
  expect(response.status).toBe(429);
  expect(await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM rate_limit_windows
      WHERE workspace_id IS NULL AND operation = 'workspace_reset'`,
  ).first()).toEqual({ count: 0 });
});

test('over-limit apply changes no product state and a committed same-key replay bypasses a full window', async () => {
  const fixture = await approvePackage5Fixture(231);
  const workspaceId = fixture.session.workspace.id;
  const operationInput = {
    proposalId: fixture.created.proposal.proposalId,
    expectedImplementedRevision: 1,
    idempotencyKey: '80000000-0000-4000-8000-000000000231',
  };
  const admit = (now: number) => async (resolvedWorkspaceId: string) => {
    await admitWorkspaceOperation({
      db: env.DB,
      workspaceId: resolvedWorkspaceId,
      operation: 'apply',
      now,
      secret: rateSecret,
    });
  };

  for (let index = 0; index < WORKSPACE_OPERATION_LIMITS.apply; index += 1) {
    await admitWorkspaceOperation({
      db: env.DB,
      workspaceId,
      operation: 'apply',
      now: package5Now + 5,
      secret: rateSecret,
    });
  }
  await expect(applyProposal({
    db: env.DB,
    cookieHeader: fixture.session.setCookie,
    now: package5Now + 5,
    sessionSecret: package5Secrets.sessionSecret,
    admitOperation: admit(package5Now + 5),
    input: operationInput,
  })).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 });
  expect(await env.DB.prepare(
    `SELECT
       (SELECT active_implemented_revision FROM component_variants WHERE workspace_id = ?) AS active,
       (SELECT COUNT(*) FROM application_receipts WHERE workspace_id = ?) AS receipts,
       (SELECT status FROM proposals WHERE workspace_id = ? AND id = ?) AS status`,
  ).bind(workspaceId, workspaceId, workspaceId, fixture.created.proposal.proposalId).first()).toEqual({
    active: 1,
    receipts: 0,
    status: 'approved',
  });

  const nextWindow = package5Now + 3_605;
  const first = await applyProposal({
    db: env.DB,
    cookieHeader: fixture.session.setCookie,
    now: nextWindow,
    sessionSecret: package5Secrets.sessionSecret,
    admitOperation: admit(nextWindow),
    input: operationInput,
  });
  for (let index = 1; index < WORKSPACE_OPERATION_LIMITS.apply; index += 1) {
    await admitWorkspaceOperation({
      db: env.DB,
      workspaceId,
      operation: 'apply',
      now: nextWindow,
      secret: rateSecret,
    });
  }
  await expect(admitWorkspaceOperation({
    db: env.DB,
    workspaceId,
    operation: 'apply',
    now: nextWindow,
    secret: rateSecret,
  })).rejects.toMatchObject({ code: 'RATE_LIMITED' });

  const replay = await applyProposal({
    db: env.DB,
    cookieHeader: fixture.session.setCookie,
    now: nextWindow + 1,
    sessionSecret: package5Secrets.sessionSecret,
    admitOperation: async () => {
      throw new Error('same-key recovery must precede admission');
    },
    input: operationInput,
  });
  expect(replay.receipt).toMatchObject({
    receiptId: first.receipt.receiptId,
    replayed: true,
  });
});
