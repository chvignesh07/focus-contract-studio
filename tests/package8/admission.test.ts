import { env } from 'cloudflare:workers';
import { beforeEach, expect, test, vi } from 'vitest';

import { POST as bootstrapRoute } from '../../app/api/session/bootstrap/route.ts';
import { POST as resetRoute } from '../../app/api/session/reset/route.ts';
import {
  GLOBAL_OPERATION_LIMITS,
  WORKSPACE_OPERATION_LIMITS,
  admitGlobalOperation,
  admitWorkspaceOperation,
  trustedBootstrapClientDigest,
  workspaceAdmission,
} from '../../lib/server/admission.ts';
import {
  commitInitialFocusObservation,
  INITIAL_FOCUS_MANIFEST,
} from '../../lib/server/initial-focus-observation.ts';
import {
  finalizeFocusRehearsal,
  startFocusRehearsal,
} from '../../lib/server/focus-rehearsal.ts';
import {
  applyProposal,
  undoRevision,
} from '../../lib/server/package5-apply-history-undo.ts';
import { runtimeSecurityConfig } from '../../lib/server/runtime-config.ts';
import { verifyFocusContract } from '../../lib/server/verify-focus-contract.ts';
import {
  bootstrapWorkspace,
  resetWorkspace,
  setActiveVariantBySlug,
} from '../../lib/server/workspaces.ts';
import {
  approvePackage5Fixture,
  package5Now,
  package5Secrets,
} from '../package5/helpers.ts';

const rateSecret = 'package8-rate-limit-secret-material-32-bytes-minimum';

function fullRehearsal(variantId: string, revision: number) {
  return {
    manifest: {
      manifestVersion: 'focus-manifest-v1' as const,
      targetIds: ['delete-trigger' as const, 'dialog-title' as const, 'reason-input' as const, 'cancel-button' as const, 'delete-button' as const],
      tabbableOrder: ['reason-input' as const, 'cancel-button' as const, 'delete-button' as const],
      dialogName: 'Delete account' as const,
      dialogDescription: 'Deleting your account is permanent. You can optionally tell us why.' as const,
      role: 'dialog' as const,
      ariaModal: true as const,
      open: true as const,
      variantId,
      implementedRevision: revision,
    },
    events: [
      { eventType: 'dialog_open' as const, targetId: 'delete-trigger' as const, clientOffsetMs: 0 },
      { eventType: 'focusin' as const, targetId: 'cancel-button' as const, clientOffsetMs: 1 },
      { eventType: 'keydown' as const, targetId: 'delete-button' as const, keyName: 'Tab' as const, shiftKey: false, clientOffsetMs: 2 },
      { eventType: 'focusin' as const, targetId: 'reason-input' as const, clientOffsetMs: 3 },
      { eventType: 'keydown' as const, targetId: 'reason-input' as const, keyName: 'Tab' as const, shiftKey: false, clientOffsetMs: 4 },
      { eventType: 'focusin' as const, targetId: 'cancel-button' as const, clientOffsetMs: 5 },
      { eventType: 'keydown' as const, targetId: 'cancel-button' as const, keyName: 'Tab' as const, shiftKey: false, clientOffsetMs: 6 },
      { eventType: 'focusin' as const, targetId: 'delete-button' as const, clientOffsetMs: 7 },
      { eventType: 'keydown' as const, targetId: 'delete-button' as const, keyName: 'Tab' as const, shiftKey: false, clientOffsetMs: 8 },
      { eventType: 'focusin' as const, targetId: 'reason-input' as const, clientOffsetMs: 9 },
      { eventType: 'keydown' as const, targetId: 'reason-input' as const, keyName: 'Tab' as const, shiftKey: true, clientOffsetMs: 10 },
      { eventType: 'focusin' as const, targetId: 'delete-button' as const, clientOffsetMs: 11 },
      { eventType: 'keydown' as const, targetId: 'delete-button' as const, keyName: 'Escape' as const, shiftKey: false, clientOffsetMs: 12 },
      { eventType: 'dialog_close' as const, targetId: 'dialog-title' as const, closeReason: 'escape' as const, clientOffsetMs: 13 },
      { eventType: 'focus_return' as const, targetId: 'delete-trigger' as const, clientOffsetMs: 14 },
    ],
  };
}

beforeEach(async () => {
  await env.DB.prepare('DROP TRIGGER IF EXISTS package5_test_apply_failure').run();
  await env.DB.prepare('DROP TRIGGER IF EXISTS package8_test_apply_failure').run();
  await env.DB.prepare('DROP TRIGGER IF EXISTS package8_test_variant_failure').run();
  await env.DB.prepare('DELETE FROM workspaces').run();
  await env.DB.prepare('DELETE FROM rate_limit_windows').run();
});

function barrieredAdmission(base: (workspaceId: string) => Promise<void>) {
  let arrivals = 0;
  let release!: () => void;
  const bothArrived = new Promise<void>((resolve) => {
    release = resolve;
  });
  return async (workspaceId: string) => {
    await base(workspaceId);
    arrivals += 1;
    if (arrivals === 2) release();
    await bothArrived;
  };
}

async function variantSelectionGraph(workspaceId: string) {
  return env.DB.prepare(
    `SELECT
       (SELECT state.view_revision
          FROM workspace_view_state state
         WHERE state.workspace_id = ?) AS view_revision,
       (SELECT variant.slug
          FROM workspace_view_state state
          JOIN component_variants variant
            ON variant.workspace_id = state.workspace_id
           AND variant.id = state.active_variant_id
         WHERE state.workspace_id = ?) AS active_variant,
       (SELECT COUNT(*) FROM variant_selection_commits
         WHERE workspace_id = ?) AS commits,
       (SELECT COUNT(*) FROM audit_events
         WHERE workspace_id = ? AND action = 'variant.selected'
           AND result = 'success') AS audits,
       (SELECT request_count FROM rate_limit_windows
         WHERE workspace_id = ? AND operation = 'variant') AS admission_count,
       (SELECT COUNT(*) FROM idempotency_records
         WHERE workspace_id = ? AND operation = 'variant') AS idempotency_records,
       (SELECT COUNT(*)
          FROM variant_selection_commits selection
          JOIN audit_events audit
            ON audit.workspace_id = selection.workspace_id
           AND audit.action = 'variant.selected'
           AND audit.result = 'success'
           AND audit.target_id = selection.id
           AND audit.correlation_id = selection.id
          JOIN workspace_view_state state
            ON state.workspace_id = selection.workspace_id
           AND state.active_variant_id = selection.variant_id
           AND state.view_revision = selection.to_view_revision
         WHERE selection.workspace_id = ?) AS complete_graphs`,
  ).bind(
    workspaceId,
    workspaceId,
    workspaceId,
    workspaceId,
    workspaceId,
    workspaceId,
    workspaceId,
  ).first();
}

test('variant selection replays before admission and saturates without another write', async () => {
  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: package5Now,
    tokenBytes: new Uint8Array(32).fill(235),
    ...package5Secrets,
  });
  const select = (
    variant: 'delete-account-standard' | 'delete-account-danger-emphasis',
    expectedViewRevision: number,
    idempotencyKey: string,
  ) => setActiveVariantBySlug({
    db: env.DB,
    workspaceId: session.workspace.id,
    slug: variant,
    expectedViewRevision,
    idempotencyKey,
    now: package5Now + 1,
    admitOperation: workspaceAdmission({
      db: env.DB,
      operation: 'variant',
      now: package5Now + 1,
      secret: rateSecret,
    }),
  });
  const key = '80000000-0000-4000-8000-000000000239';
  const first = await select('delete-account-danger-emphasis', 1, key);
  await expect(select('delete-account-danger-emphasis', 1, key)).resolves.toEqual(first);
  await expect(select('delete-account-standard', 2, key)).rejects.toMatchObject({
    code: 'IDEMPOTENCY_CONFLICT',
    status: 409,
  });

  for (let attempt = 2; attempt <= WORKSPACE_OPERATION_LIMITS.variant; attempt += 1) {
    await select(
      attempt % 2 === 0
        ? 'delete-account-standard'
        : 'delete-account-danger-emphasis',
      attempt,
      `80000000-0000-4000-8000-${String(239 + attempt).padStart(12, '0')}`,
    );
  }
  await expect(select(
    'delete-account-danger-emphasis',
    WORKSPACE_OPERATION_LIMITS.variant + 1,
    '80000000-0000-4000-8000-000000000299',
  )).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 });
  expect(await env.DB.prepare(
    `SELECT
       (SELECT view_revision FROM workspace_view_state WHERE workspace_id = ?) AS view_revision,
       (SELECT COUNT(*) FROM variant_selection_commits WHERE workspace_id = ?) AS commits,
       (SELECT request_count FROM rate_limit_windows
         WHERE workspace_id = ? AND operation = 'variant') AS admission_count`,
  ).bind(
    session.workspace.id,
    session.workspace.id,
    session.workspace.id,
  ).first()).toEqual({
    view_revision: WORKSPACE_OPERATION_LIMITS.variant + 1,
    commits: WORKSPACE_OPERATION_LIMITS.variant,
    admission_count: WORKSPACE_OPERATION_LIMITS.variant,
  });
});

test('downstream variant failure rolls back view state, commit, audit, and admission', async () => {
  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: package5Now,
    tokenBytes: new Uint8Array(32).fill(236),
    ...package5Secrets,
  });
  await env.DB.prepare(
    `CREATE TRIGGER package8_test_variant_failure
     BEFORE INSERT ON audit_events
     WHEN NEW.action = 'variant.selected'
     BEGIN SELECT RAISE(ABORT, 'PACKAGE8_TEST_VARIANT_FAILURE'); END`,
  ).run();

  await expect(setActiveVariantBySlug({
    db: env.DB,
    workspaceId: session.workspace.id,
    slug: 'delete-account-danger-emphasis',
    expectedViewRevision: 1,
    idempotencyKey: '80000000-0000-4000-8000-000000000300',
    now: package5Now + 1,
    admitOperation: workspaceAdmission({
      db: env.DB,
      operation: 'variant',
      now: package5Now + 1,
      secret: rateSecret,
    }),
  })).rejects.toMatchObject({ code: 'VARIANT_SELECTION_WRITE_FAILED', status: 503 });
  expect(await env.DB.prepare(
    `SELECT
       (SELECT view_revision FROM workspace_view_state WHERE workspace_id = ?) AS view_revision,
       (SELECT COUNT(*) FROM variant_selection_commits WHERE workspace_id = ?) AS commits,
       (SELECT COUNT(*) FROM audit_events
         WHERE workspace_id = ? AND action = 'variant.selected') AS audits,
       (SELECT COUNT(*) FROM rate_limit_windows
         WHERE workspace_id = ? AND operation = 'variant') AS admission_rows`,
  ).bind(
    session.workspace.id,
    session.workspace.id,
    session.workspace.id,
    session.workspace.id,
  ).first()).toEqual({
    view_revision: 1,
    commits: 0,
    audits: 0,
    admission_rows: 0,
  });
});

test('simultaneous identical active-variant requests converge on one durable replay receipt', async () => {
  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: package5Now,
    tokenBytes: new Uint8Array(32).fill(237),
    ...package5Secrets,
  });
  const now = package5Now + 1;
  const input = {
    db: env.DB,
    workspaceId: session.workspace.id,
    slug: 'delete-account-danger-emphasis',
    expectedViewRevision: 1,
    idempotencyKey: '80000000-0000-4000-8000-000000000301',
    now,
  };
  const admitOperation = barrieredAdmission(workspaceAdmission({
    db: env.DB,
    operation: 'variant',
    now,
    secret: rateSecret,
  }));

  const results = await Promise.all([
    setActiveVariantBySlug({ ...input, admitOperation }),
    setActiveVariantBySlug({ ...input, admitOperation }),
  ]);
  expect(results).toEqual([
    { variant: 'delete-account-danger-emphasis', viewRevision: 2 },
    { variant: 'delete-account-danger-emphasis', viewRevision: 2 },
  ]);
  await expect(setActiveVariantBySlug({
    ...input,
    admitOperation: async () => {
      throw new Error('committed replay must not re-enter admission');
    },
  })).resolves.toEqual(results[0]);
  expect(await variantSelectionGraph(session.workspace.id)).toEqual({
    view_revision: 2,
    active_variant: 'delete-account-danger-emphasis',
    commits: 1,
    audits: 1,
    admission_count: 1,
    idempotency_records: 0,
    complete_graphs: 1,
  });
});

test('simultaneous conflicting payload reuse fails closed around one active-variant graph', async () => {
  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: package5Now,
    tokenBytes: new Uint8Array(32).fill(238),
    ...package5Secrets,
  });
  const now = package5Now + 1;
  const key = '80000000-0000-4000-8000-000000000302';
  const admitOperation = barrieredAdmission(workspaceAdmission({
    db: env.DB,
    operation: 'variant',
    now,
    secret: rateSecret,
  }));
  const request = (slug: 'delete-account-standard' | 'delete-account-danger-emphasis') =>
    setActiveVariantBySlug({
      db: env.DB,
      workspaceId: session.workspace.id,
      slug,
      expectedViewRevision: 1,
      idempotencyKey: key,
      now,
      admitOperation,
    });

  const results = await Promise.allSettled([
    request('delete-account-standard'),
    request('delete-account-danger-emphasis'),
  ]);
  const fulfilled = results.filter(
    (result): result is PromiseFulfilledResult<{ variant: string; viewRevision: number }> =>
      result.status === 'fulfilled',
  );
  const rejected = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  expect(fulfilled).toHaveLength(1);
  expect(rejected).toHaveLength(1);
  expect(rejected[0]!.reason).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });
  expect(await variantSelectionGraph(session.workspace.id)).toEqual({
    view_revision: 2,
    active_variant: fulfilled[0]!.value.variant,
    commits: 1,
    audits: 1,
    admission_count: 1,
    idempotency_records: 0,
    complete_graphs: 1,
  });
});

test('simultaneous different active-variant keys against one view revision yield one stale loser', async () => {
  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: package5Now,
    tokenBytes: new Uint8Array(32).fill(239),
    ...package5Secrets,
  });
  const now = package5Now + 1;
  const admitOperation = barrieredAdmission(workspaceAdmission({
    db: env.DB,
    operation: 'variant',
    now,
    secret: rateSecret,
  }));
  const request = (idempotencyKey: string) => setActiveVariantBySlug({
    db: env.DB,
    workspaceId: session.workspace.id,
    slug: 'delete-account-danger-emphasis',
    expectedViewRevision: 1,
    idempotencyKey,
    now,
    admitOperation,
  });

  const results = await Promise.allSettled([
    request('80000000-0000-4000-8000-000000000303'),
    request('80000000-0000-4000-8000-000000000304'),
  ]);
  expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
  const rejected = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  expect(rejected).toHaveLength(1);
  expect(rejected[0]!.reason).toMatchObject({ code: 'VIEW_STATE_STALE', status: 409 });
  expect(await variantSelectionGraph(session.workspace.id)).toEqual({
    view_revision: 2,
    active_variant: 'delete-account-danger-emphasis',
    commits: 1,
    audits: 1,
    admission_count: 1,
    idempotency_records: 0,
    complete_graphs: 1,
  });
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

test('saturating one bootstrap client does not block an independent client', async () => {
  const now = package5Now;
  const firstClientDigest = 'a'.repeat(64);
  const secondClientDigest = 'b'.repeat(64);
  for (let attempt = 0; attempt < GLOBAL_OPERATION_LIMITS.workspace_bootstrap; attempt += 1) {
    await admitGlobalOperation({
      db: env.DB,
      operation: 'workspace_bootstrap',
      now,
      clientDigest: firstClientDigest,
    });
  }

  await expect(admitGlobalOperation({
    db: env.DB,
    operation: 'workspace_bootstrap',
    now,
    clientDigest: secondClientDigest,
  })).resolves.toBe(1);
});

function edgeRequest(address: string, forwardedFor: string): Request {
  const request = new Request('https://focus-contract-studio.example/api/session/bootstrap', {
    method: 'POST',
    headers: {
      'cf-connecting-ip': address,
      'x-forwarded-for': forwardedFor,
    },
  });
  Object.defineProperty(request, 'cf', { value: { colo: 'TEST' } });
  return request;
}

const bootstrapDiagnosticEvent = 'fcs.bootstrap.unexpected_error';
const bootstrapDiagnosticStages = [
  'runtime_config',
  'request_validation',
  'client_fingerprint',
  'global_admission',
  'workspace_seed',
  'active_seed_read',
] as const;

function bootstrapRequest(options: {
  body?: BodyInit;
  cookie?: string;
  address?: string;
} = {}): Request {
  const request = new Request(
    'https://focus-contract-studio.example/api/session/bootstrap',
    {
      method: 'POST',
      headers: {
        origin: 'https://focus-contract-studio.example',
        'content-type': 'application/json',
        'cf-connecting-ip': options.address ?? '203.0.113.10',
        ...(options.cookie ? { cookie: options.cookie } : {}),
      },
      body: options.body ?? '{}',
    },
  );
  Object.defineProperty(request, 'cf', {
    configurable: true,
    value: { colo: 'TEST' },
  });
  return request;
}

async function captureBootstrapFailure(request: Request) {
  const privateLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const response = await bootstrapRoute(request);
    return {
      response,
      body: await response.text(),
      calls: [...privateLog.mock.calls],
    };
  } finally {
    privateLog.mockRestore();
  }
}

function expectUnexpectedBootstrapDiagnostic(
  captured: Awaited<ReturnType<typeof captureBootstrapFailure>>,
  stage: (typeof bootstrapDiagnosticStages)[number],
  forbidden: string[] = [],
) {
  expect(captured.response.status).toBe(500);
  const envelope = JSON.parse(captured.body) as {
    error: { correlationId: string };
  };
  expect(envelope.error.correlationId).toMatch(/^[0-9a-f-]{36}$/u);
  expect(captured.body).toBe(JSON.stringify({
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'The request could not be completed.',
      retryable: true,
      correlationId: envelope.error.correlationId,
    },
  }));
  expect(captured.calls).toHaveLength(1);
  expect(captured.calls[0]).toHaveLength(1);
  expect(captured.calls[0]![0]).toEqual({
    event: bootstrapDiagnosticEvent,
    stage,
    correlationId: envelope.error.correlationId,
  });
  expect(Object.keys(captured.calls[0]![0] as object)).toEqual([
    'event',
    'stage',
    'correlationId',
  ]);
  expect(bootstrapDiagnosticStages).toContain(stage);
  const observableOutput = `${captured.body}\n${JSON.stringify(captured.calls)}`;
  for (const marker of forbidden) expect(observableOutput).not.toContain(marker);
}

test('unexpected bootstrap failure emits one allowlisted private record without sensitive material', async () => {
  const forbidden = [
    'private-exception-message',
    'private-stack-marker',
    'SELECT private_sql_marker',
    'private-request-body',
    'private-header-marker',
    'private-cookie-marker',
    '198.51.100.77',
    'private-identity-marker',
    'FCS_SESSION_HMAC_SECRET',
    '/private/runtime/path',
    'private-credential-marker',
  ];
  const failure = new Error(forbidden.join(' '));
  failure.stack = 'private-stack-marker';
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.error(failure);
    },
  });
  const request = new Request(
    'https://focus-contract-studio.example/api/session/bootstrap',
    {
      method: 'POST',
      headers: {
        origin: 'https://focus-contract-studio.example',
        'content-type': 'application/json',
        'x-private-header': 'private-header-marker',
        cookie: '__Host-fcs_session=private-cookie-marker',
        'cf-connecting-ip': '198.51.100.77',
        'oai-authenticated-user-email': 'private-identity-marker',
      },
      body,
    },
  );
  Object.defineProperty(request, 'cf', {
    value: { colo: 'private-request-body' },
  });

  expectUnexpectedBootstrapDiagnostic(
    await captureBootstrapFailure(request),
    'request_validation',
    forbidden,
  );
});

test('structured bootstrap errors remain byte-compatible and emit no unexpected record', async () => {
  const privateLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const response = await bootstrapRoute(new Request(
      'https://focus-contract-studio.example/api/session/bootstrap',
      {
        method: 'POST',
        headers: {
          origin: 'https://attacker.example',
          'content-type': 'application/json',
        },
        body: '{}',
      },
    ));
    const body = await response.text();
    const envelope = JSON.parse(body) as { error: { correlationId: string } };
    expect(response.status).toBe(403);
    expect(body).toBe(JSON.stringify({
      ok: false,
      error: {
        code: 'ORIGIN_REJECTED',
        message: 'The request origin is not allowed.',
        retryable: false,
        correlationId: envelope.error.correlationId,
      },
    }));
    expect(privateLog).not.toHaveBeenCalled();
  } finally {
    privateLog.mockRestore();
  }
});

test('bootstrap unexpected diagnostics identify each actual execution boundary', async () => {
  const mutableEnv = env as Cloudflare.Env & {
    FCS_SESSION_HMAC_SECRET: string;
  };
  const sessionSecret = mutableEnv.FCS_SESSION_HMAC_SECRET;
  try {
    mutableEnv.FCS_SESSION_HMAC_SECRET = 'private-runtime-config-marker';
    expectUnexpectedBootstrapDiagnostic(
      await captureBootstrapFailure(bootstrapRequest()),
      'runtime_config',
      ['private-runtime-config-marker', 'FCS_SESSION_HMAC_SECRET'],
    );
  } finally {
    mutableEnv.FCS_SESSION_HMAC_SECRET = sessionSecret;
  }

  const fingerprintRequest = bootstrapRequest();
  Object.defineProperty(fingerprintRequest, 'cf', {
    get() {
      throw new Error('private-client-fingerprint-marker');
    },
  });
  expectUnexpectedBootstrapDiagnostic(
    await captureBootstrapFailure(fingerprintRequest),
    'client_fingerprint',
    ['private-client-fingerprint-marker'],
  );

  await env.DB.prepare(
    `CREATE TRIGGER package8_test_bootstrap_admission_diagnostic
       BEFORE INSERT ON rate_limit_windows
       WHEN NEW.operation = 'workspace_bootstrap'
       BEGIN SELECT RAISE(ABORT, 'private-global-admission-marker'); END`,
  ).run();
  try {
    expectUnexpectedBootstrapDiagnostic(
      await captureBootstrapFailure(bootstrapRequest({ address: '203.0.113.11' })),
      'global_admission',
      ['private-global-admission-marker'],
    );
  } finally {
    await env.DB.prepare(
      'DROP TRIGGER IF EXISTS package8_test_bootstrap_admission_diagnostic',
    ).run();
  }

  await env.DB.prepare(
    `CREATE TRIGGER package8_test_bootstrap_seed_diagnostic
       BEFORE INSERT ON workspaces
       BEGIN SELECT RAISE(ABORT, 'private-workspace-seed-marker'); END`,
  ).run();
  try {
    expectUnexpectedBootstrapDiagnostic(
      await captureBootstrapFailure(bootstrapRequest({ address: '203.0.113.12' })),
      'workspace_seed',
      ['private-workspace-seed-marker'],
    );
  } finally {
    await env.DB.prepare(
      'DROP TRIGGER IF EXISTS package8_test_bootstrap_seed_diagnostic',
    ).run();
  }

  const configuration = runtimeSecurityConfig();
  const session = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: Math.floor(Date.now() / 1000),
    tokenBytes: new Uint8Array(32).fill(240),
    sessionSecret: configuration.sessionSecret,
    csrfSecret: configuration.csrfSecret,
  });
  await env.DB.prepare(
    'ALTER TABLE workspace_view_state RENAME TO package8_test_missing_view_state',
  ).run();
  try {
    expectUnexpectedBootstrapDiagnostic(
      await captureBootstrapFailure(bootstrapRequest({ cookie: session.setCookie! })),
      'active_seed_read',
    );
  } finally {
    await env.DB.prepare(
      'ALTER TABLE package8_test_missing_view_state RENAME TO workspace_view_state',
    ).run();
  }
});

test('spoofable forwarding metadata cannot bypass trusted bootstrap isolation', async () => {
  const secret = 'package8-edge-test-secret-material-at-least-32-bytes';
  const now = package5Now;
  const untrusted = new Request('https://focus-contract-studio.example/api/session/bootstrap', {
    headers: {
      'cf-connecting-ip': '203.0.113.10',
      'x-forwarded-for': '198.51.100.200',
    },
  });
  await expect(trustedBootstrapClientDigest({ request: untrusted, now, secret }))
    .rejects.toMatchObject({ code: 'BOOTSTRAP_EDGE_UNAVAILABLE', status: 503 });

  const first = await trustedBootstrapClientDigest({
    request: edgeRequest('203.0.113.10', '198.51.100.1'),
    now,
    secret,
  });
  const spoofChanged = await trustedBootstrapClientDigest({
    request: edgeRequest('203.0.113.10', '192.0.2.250'),
    now,
    secret,
  });
  const independent = await trustedBootstrapClientDigest({
    request: edgeRequest('203.0.113.11', '198.51.100.1'),
    now,
    secret,
  });
  expect(first).toMatch(/^[0-9a-f]{64}$/u);
  expect(spoofChanged).toBe(first);
  expect(independent).not.toBe(first);
});

test('untrusted new bootstrap writes nothing while a valid reload needs no edge signal', async () => {
  const now = Math.floor(Date.now() / 1000);
  const expired = await bootstrapWorkspace({
    db: env.DB,
    cookieHeader: null,
    now: now - 1_000,
    tokenBytes: new Uint8Array(32).fill(227),
    ...package5Secrets,
  });
  await env.DB.prepare(
    `UPDATE workspaces
        SET access_expires_at = ?, grace_expires_at = ?
      WHERE id = ?`,
  ).bind(now - 2, now - 1, expired.workspace.id).run();
  const counts = () => env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM workspaces) AS workspaces,
       (SELECT COUNT(*) FROM component_variants) AS variants,
       (SELECT COUNT(*) FROM audit_events) AS audits,
       (SELECT COUNT(*) FROM rate_limit_windows) AS admission_rows`,
  ).first();
  const before = await counts();
  const configuration = runtimeSecurityConfig();
  const rejected = await bootstrapRoute(new Request(
    `${configuration.publicOrigin}/api/session/bootstrap`,
    {
      method: 'POST',
      headers: {
        origin: configuration.publicOrigin,
        'content-type': 'application/json',
        'cf-connecting-ip': '203.0.113.10',
        'x-forwarded-for': '198.51.100.200',
      },
      body: '{}',
    },
  ));
  expect(rejected.status).toBe(503);
  expect(await rejected.json()).toMatchObject({
    ok: false,
    error: { code: 'BOOTSTRAP_EDGE_UNAVAILABLE', retryable: true },
  });
  expect(await counts()).toEqual(before);
  expect(await env.DB.prepare(
    'SELECT id FROM workspaces WHERE id = ?',
  ).bind(expired.workspace.id).first()).not.toBeNull();

  const trustedCreateRequest = new Request(
    `${configuration.publicOrigin}/api/session/bootstrap`,
    {
      method: 'POST',
      headers: {
        origin: configuration.publicOrigin,
        'content-type': 'application/json',
        'cf-connecting-ip': '203.0.113.11',
      },
      body: '{}',
    },
  );
  Object.defineProperty(trustedCreateRequest, 'cf', { value: { colo: 'TEST' } });
  const active = await bootstrapRoute(trustedCreateRequest);
  expect(active.status).toBe(201);
  const beforeReload = await counts();
  const reload = await bootstrapRoute(new Request(
    `${configuration.publicOrigin}/api/session/bootstrap`,
    {
      method: 'POST',
      headers: {
        origin: configuration.publicOrigin,
        'content-type': 'application/json',
        cookie: active.headers.get('set-cookie')!.split(';', 1)[0]!,
      },
      body: '{}',
    },
  ));
  expect(reload.status).toBe(200);
  expect(await reload.json()).toMatchObject({
    ok: true,
    data: { generation: 1 },
  });
  expect(await counts()).toEqual(beforeReload);
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
  for (let attempt = 1; attempt < WORKSPACE_OPERATION_LIMITS.rehearsal; attempt += 1) {
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
      admitReset: workspaceAdmission({
        db: env.DB,
        operation: 'reset',
        now: package5Now + reset,
        secret: rateSecret,
      }),
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
    admitReset: workspaceAdmission({
      db: env.DB,
      operation: 'reset',
      now: package5Now + 6,
      secret: rateSecret,
    }),
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
  const admit = (now: number) => workspaceAdmission({
    db: env.DB,
    operation: 'apply',
    now,
    secret: rateSecret,
  });

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

test('concurrent identical apply requests consume one admission unit and leave one committed mutation', async () => {
  const fixture = await approvePackage5Fixture(232);
  const workspaceId = fixture.session.workspace.id;
  const now = package5Now + 9;
  let arrivals = 0;
  let release!: () => void;
  const bothArrived = new Promise<void>((resolve) => {
    release = resolve;
  });
  const preflight = workspaceAdmission({
    db: env.DB,
    operation: 'apply',
    now,
    secret: rateSecret,
  });
  const admitOperation = async (resolvedWorkspaceId: string) => {
    await preflight(resolvedWorkspaceId);
    arrivals += 1;
    if (arrivals === 2) release();
    await bothArrived;
  };
  const operation = {
    db: env.DB,
    cookieHeader: fixture.session.setCookie,
    now,
    sessionSecret: package5Secrets.sessionSecret,
    admitOperation,
    input: {
      proposalId: fixture.created.proposal.proposalId,
      expectedImplementedRevision: 1,
      idempotencyKey: '80000000-0000-4000-8000-000000000232',
    },
  };

  const results = await Promise.all([
    applyProposal(operation),
    applyProposal(operation),
  ]);

  expect(await env.DB.prepare(
    `SELECT
       (SELECT request_count FROM rate_limit_windows
         WHERE workspace_id = ? AND operation = 'apply') AS admission_count,
       (SELECT COUNT(*) FROM application_receipts WHERE workspace_id = ?) AS receipts,
       (SELECT COUNT(*) FROM application_commits WHERE workspace_id = ?) AS commits,
       (SELECT COUNT(*) FROM idempotency_records
         WHERE workspace_id = ? AND operation = 'apply' AND state = 'started') AS started`
  ).bind(workspaceId, workspaceId, workspaceId, workspaceId).first()).toEqual({
    admission_count: 1,
    receipts: 1,
    commits: 1,
    started: 0,
  });
  expect(results.filter(({ receipt }) => receipt.replayed)).toHaveLength(1);
  await expect(applyProposal({
    ...operation,
    input: {
      ...operation.input,
      expectedImplementedRevision: 2,
    },
  })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });
});

test('every mutation family consumes exactly one atomic admission per committed product change', async () => {
  const fixture = await approvePackage5Fixture(233);
  const workspaceId = fixture.session.workspace.id;
  await applyProposal({
    db: env.DB,
    cookieHeader: fixture.session.setCookie,
    now: package5Now + 5,
    sessionSecret: package5Secrets.sessionSecret,
    input: {
      proposalId: fixture.created.proposal.proposalId,
      expectedImplementedRevision: 1,
      idempotencyKey: '80000000-0000-4000-8000-000000000233',
    },
  });
  const rehearsal = await startFocusRehearsal({
    db: env.DB,
    workspaceId,
    now: package5Now + 6,
    environment: 'playwright',
  });
  await finalizeFocusRehearsal({
    db: env.DB,
    workspaceId,
    rehearsalSessionId: rehearsal.rehearsalSessionId,
    now: package5Now + 7,
    input: fullRehearsal(rehearsal.variantId, 2),
  });
  await verifyFocusContract({
    db: env.DB,
    workspaceId,
    rehearsalSessionId: rehearsal.rehearsalSessionId,
    implementedRevision: 2,
    now: package5Now + 8,
  });
  await undoRevision({
    db: env.DB,
    cookieHeader: fixture.session.setCookie,
    now: package5Now + 9,
    sessionSecret: package5Secrets.sessionSecret,
    input: {
      restoreRevision: 1,
      expectedImplementedRevision: 2,
      idempotencyKey: '80000000-0000-4000-8000-000000000234',
    },
  });
  await resetWorkspace({
    db: env.DB,
    cookieHeader: fixture.session.setCookie ?? '',
    csrfToken: fixture.session.csrfToken,
    idempotencyKey: '80000000-0000-4000-8000-000000000235',
    now: package5Now + 10,
    ...package5Secrets,
  });

  expect(await env.DB.prepare(
    `SELECT operation, request_count
       FROM rate_limit_windows
      WHERE workspace_id IS NOT NULL
      ORDER BY operation`,
  ).all()).toMatchObject({
    results: [
      { operation: 'apply', request_count: 1 },
      { operation: 'proposal', request_count: 1 },
      { operation: 'rehearsal', request_count: 3 },
      { operation: 'reset', request_count: 1 },
      { operation: 'review', request_count: 1 },
      { operation: 'undo', request_count: 1 },
      { operation: 'verification', request_count: 1 },
    ],
  });
  expect(await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM idempotency_records WHERE state = 'started'`,
  ).first()).toEqual({ count: 0 });
});

test('a downstream apply failure rolls back product state, idempotency, audit, and admission together', async () => {
  const fixture = await approvePackage5Fixture(234);
  const workspaceId = fixture.session.workspace.id;
  await env.DB.prepare(
    `CREATE TRIGGER package8_test_apply_failure
     BEFORE INSERT ON application_commits
     BEGIN SELECT RAISE(ABORT, 'PACKAGE8_TEST_APPLY_FAILURE'); END`,
  ).run();

  await expect(applyProposal({
    db: env.DB,
    cookieHeader: fixture.session.setCookie,
    now: package5Now + 5,
    sessionSecret: package5Secrets.sessionSecret,
    input: {
      proposalId: fixture.created.proposal.proposalId,
      expectedImplementedRevision: 1,
      idempotencyKey: '80000000-0000-4000-8000-000000000238',
    },
  })).rejects.toMatchObject({ code: 'APPLICATION_WRITE_FAILED', status: 503 });
  expect(await env.DB.prepare(
    `SELECT
       (SELECT active_implemented_revision FROM component_variants
         WHERE workspace_id = ? AND id = (
           SELECT active_variant_id FROM workspace_view_state WHERE workspace_id = ?
         )) AS active_revision,
       (SELECT COUNT(*) FROM application_receipts WHERE workspace_id = ?) AS receipts,
       (SELECT COUNT(*) FROM application_commits WHERE workspace_id = ?) AS commits,
       (SELECT COUNT(*) FROM idempotency_records
         WHERE workspace_id = ? AND operation = 'apply') AS idempotency,
       (SELECT COUNT(*) FROM audit_events
         WHERE workspace_id = ? AND action = 'application.applied') AS audits,
       (SELECT COUNT(*) FROM rate_limit_windows
         WHERE workspace_id = ? AND operation = 'apply') AS admission_rows`,
  ).bind(
    workspaceId,
    workspaceId,
    workspaceId,
    workspaceId,
    workspaceId,
    workspaceId,
    workspaceId,
  ).first()).toEqual({
    active_revision: 1,
    receipts: 0,
    commits: 0,
    idempotency: 0,
    audits: 0,
    admission_rows: 0,
  });
});
