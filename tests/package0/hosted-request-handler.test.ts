import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { Miniflare } from 'miniflare';

import { handlePackage0ProbeRequest } from '../../probes/hosted/request-handler.ts';
import { interpretPlatformObservation } from '../../probes/hosted/presentation.ts';

const endpoint = 'https://focus.example/api/package0-probe';
const identityKey = Buffer.alloc(32, 7).toString('base64url');
const operatorToken = Buffer.alloc(32, 13).toString('base64url');
const operatorTokenSha256 = createHash('sha256')
  .update(operatorToken)
  .digest('hex');
const nowUnixSeconds = Math.floor(Date.now() / 1000);
const cleanupNowUnixSeconds = nowUnixSeconds + 306;

const activeRunWindow = {
  d1Enabled: true,
  d1WindowExpiresAt: String(nowUnixSeconds + 300),
  d1WindowNotBefore: String(nowUnixSeconds - 30),
  nowUnixSeconds,
  operatorTokenSha256,
  ownerOnlyConfirmed: true,
};

const activeCleanupWindow = {
  d1CleanupEnabled: true,
  d1CleanupWindowExpiresAt: String(cleanupNowUnixSeconds + 300),
  d1CleanupWindowNotBefore: String(cleanupNowUnixSeconds - 1),
  d1Enabled: false,
  nowUnixSeconds: cleanupNowUnixSeconds,
  operatorTokenSha256,
  ownerOnlyConfirmed: true,
};

function request(
  action: string,
  headers: Record<string, string> = {},
): Request {
  return new Request(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://focus.example',
      ...headers,
    },
    body: JSON.stringify({ action }),
  });
}

function operatorRequest(
  action: string,
  token = operatorToken,
): Request {
  return request(action, { 'x-fcs-package0-operator-token': token });
}

test('hosted probe rejects cross-origin requests before doing work', async () => {
  const response = await handlePackage0ProbeRequest(
    request('observe_platform', { origin: 'https://attacker.example' }),
    {},
  );

  assert.equal(response.status, 403);
  assert.equal(response.headers.get('set-cookie'), null);
});

test('hosted probe rejects extra input properties at the HTTP boundary', async () => {
  const invalidRequest = new Request(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://focus.example',
    },
    body: JSON.stringify({ action: 'observe_platform', extra: true }),
  });
  const response = await handlePackage0ProbeRequest(invalidRequest, {});

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    ok: false,
    code: 'INVALID_INPUT',
  });
});

test('platform observation detects a caller-supplied spoof and emits hardened probe cookie attributes', async () => {
  const response = await handlePackage0ProbeRequest(
    request('observe_platform', {
      'oai-authenticated-user-email': 'package0-spoof@invalid.example',
    }),
    { identityKey },
  );
  const body = await response.json();
  const setCookie = response.headers.get('set-cookie') ?? '';

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    ok: true,
    action: 'observe_platform',
    callerSpoofObserved: true,
    identityHeaderPresent: true,
    identityMacIssued: false,
    identityProbeConfigured: true,
    repeatIdentityBytesMatch: null,
  });
  assert.match(setCookie, /__Host-fcs_p0_observation=/u);
  assert.match(setCookie, /Path=\//u);
  assert.match(setCookie, /HttpOnly/u);
  assert.match(setCookie, /Secure/u);
  assert.match(setCookie, /SameSite=Lax/u);
  assert.doesNotMatch(JSON.stringify(body), /package0-spoof/u);
});

test('exact trusted identity bytes match across requests without returning identity material', async () => {
  const first = await handlePackage0ProbeRequest(
    request('observe_platform', {
      'oai-authenticated-user-email': 'Exact.Bytes+Case@example.test',
    }),
    { identityKey },
  );
  const firstBody = (await first.json()) as {
    identityMacIssued: boolean;
    identityProbeConfigured: boolean;
    repeatIdentityBytesMatch: boolean | null;
  };
  const setCookie = first.headers.get('set-cookie') ?? '';
  const identityCookie = /(__Host-fcs_p0_identity=[^;,]+)/u.exec(setCookie)?.[1];
  assert.ok(identityCookie);

  const second = await handlePackage0ProbeRequest(
    request('observe_platform', {
      cookie: identityCookie,
      'oai-authenticated-user-email': 'Exact.Bytes+Case@example.test',
    }),
    { identityKey },
  );
  const secondBody = (await second.json()) as {
    identityHeaderPresent: boolean;
    repeatIdentityBytesMatch: boolean | null;
  };

  assert.equal(firstBody.repeatIdentityBytesMatch, null);
  assert.equal(firstBody.identityProbeConfigured, true);
  assert.equal(firstBody.identityMacIssued, true);
  assert.equal(secondBody.repeatIdentityBytesMatch, true);
  assert.equal(secondBody.identityHeaderPresent, true);
  assert.doesNotMatch(JSON.stringify(secondBody), /Exact\.Bytes|example\.test/u);
});

test('missing or invalid identity keys are explicit and cannot produce a passing presentation', async () => {
  for (const configuredKey of [undefined, 'not-a-32-byte-base64url-key']) {
    const response = await handlePackage0ProbeRequest(
      request('observe_platform', {
        'oai-authenticated-user-email': 'Exact.Bytes+Case@example.test',
      }),
      { identityKey: configuredKey },
    );
    const body = (await response.json()) as Record<string, unknown>;
    const setCookie = response.headers.get('set-cookie') ?? '';

    assert.equal(body.identityProbeConfigured, false);
    assert.equal(body.identityMacIssued, false);
    assert.equal(body.repeatIdentityBytesMatch, null);
    assert.doesNotMatch(setCookie, /__Host-fcs_p0_identity=/u);
    assert.deepEqual(interpretPlatformObservation(body), {
      message:
        'INCONCLUSIVE — the identity comparison key is missing or invalid, so authenticated-email bytes were not signed.',
      tone: 'neutral',
    });
  }
});

test('identity presentation passes only a configured, issued, exact repeat comparison', () => {
  assert.equal(
    interpretPlatformObservation({
      callerSpoofObserved: false,
      identityHeaderPresent: true,
      identityMacIssued: true,
      identityProbeConfigured: true,
      repeatIdentityBytesMatch: true,
    }).tone,
    'pass',
  );
  assert.equal(
    interpretPlatformObservation({
      callerSpoofObserved: false,
      identityHeaderPresent: true,
      identityMacIssued: false,
      identityProbeConfigured: true,
      repeatIdentityBytesMatch: true,
    }).tone,
    'fail',
  );
});

test('same-origin and environment latches never authorize D1 without an operator token', async () => {
  const response = await handlePackage0ProbeRequest(
    request('run_disposable_d1'),
    activeRunWindow,
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    ok: false,
    code: 'HOSTED_D1_OPERATOR_UNAUTHORIZED',
  });
});

test('a forged operator token fails closed without exposing configuration state', async () => {
  const response = await handlePackage0ProbeRequest(
    operatorRequest('run_disposable_d1', Buffer.alloc(32, 14).toString('base64url')),
    activeRunWindow,
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    ok: false,
    code: 'HOSTED_D1_OPERATOR_UNAUTHORIZED',
  });
});

test('hosted D1 mutation stays disabled unless the run flag is explicit', async () => {
  const response = await handlePackage0ProbeRequest(
    operatorRequest('run_disposable_d1'),
    { ...activeRunWindow, d1Enabled: false },
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    ok: false,
    code: 'HOSTED_D1_PROBE_DISABLED',
  });
});

test('hosted D1 mutation also requires an explicit owner-only access confirmation', async () => {
  const response = await handlePackage0ProbeRequest(
    operatorRequest('run_disposable_d1'),
    { ...activeRunWindow, ownerOnlyConfirmed: false },
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    ok: false,
    code: 'HOSTED_D1_OWNER_ONLY_NOT_CONFIRMED',
  });
});

test('run and cleanup enablement cannot be active in the same configuration', async () => {
  const response = await handlePackage0ProbeRequest(
    operatorRequest('run_disposable_d1'),
    { ...activeRunWindow, d1CleanupEnabled: true },
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    ok: false,
    code: 'HOSTED_D1_CONFIGURATION_CONFLICT',
  });
});

test('hosted D1 run windows reject missing, malformed, inactive, expired, and overlong bounds', async () => {
  const invalidWindows = [
    {
      d1WindowNotBefore: undefined,
      d1WindowExpiresAt: String(nowUnixSeconds + 300),
    },
    { d1WindowNotBefore: 'not-a-time', d1WindowExpiresAt: 'also-not-a-time' },
    {
      d1WindowNotBefore: String(nowUnixSeconds - 600),
      d1WindowExpiresAt: String(nowUnixSeconds),
    },
    {
      d1WindowNotBefore: String(nowUnixSeconds + 1),
      d1WindowExpiresAt: String(nowUnixSeconds + 300),
    },
    {
      d1WindowNotBefore: String(nowUnixSeconds - 1),
      d1WindowExpiresAt: String(nowUnixSeconds + 900),
    },
  ];

  for (const window of invalidWindows) {
    const response = await handlePackage0ProbeRequest(
      operatorRequest('run_disposable_d1'),
      { ...activeRunWindow, ...window },
    );
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      ok: false,
      code: 'HOSTED_D1_RUN_WINDOW_CLOSED',
    });
  }
});

test('a valid bounded run window reaches database availability at its inclusive start', async () => {
  const response = await handlePackage0ProbeRequest(
    operatorRequest('run_disposable_d1'),
    {
      ...activeRunWindow,
      d1WindowNotBefore: String(nowUnixSeconds),
    },
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    ok: false,
    code: 'HOSTED_D1_PROBE_UNAVAILABLE',
  });
});

test('the exact 900-second maximum run window is accepted but 901 seconds is not', async () => {
  const accepted = await handlePackage0ProbeRequest(
    operatorRequest('run_disposable_d1'),
    {
      ...activeRunWindow,
      d1WindowExpiresAt: String(nowUnixSeconds + 900),
      d1WindowNotBefore: String(nowUnixSeconds),
    },
  );
  assert.equal(accepted.status, 503);

  const rejected = await handlePackage0ProbeRequest(
    operatorRequest('run_disposable_d1'),
    {
      ...activeRunWindow,
      d1WindowExpiresAt: String(nowUnixSeconds + 901),
      d1WindowNotBefore: String(nowUnixSeconds),
    },
  );
  assert.equal(rejected.status, 403);
  assert.deepEqual(await rejected.json(), {
    ok: false,
    code: 'HOSTED_D1_RUN_WINDOW_CLOSED',
  });
});

test('cleanup requires run disablement plus owner confirmation, operator auth, and its own bounded window', async () => {
  for (const [dependencies, code] of [
    [
      { ...activeCleanupWindow, d1CleanupEnabled: false },
      'HOSTED_D1_CLEANUP_DISABLED',
    ],
    [
      {
        ...activeCleanupWindow,
        d1CleanupWindowExpiresAt: String(nowUnixSeconds),
      },
      'HOSTED_D1_CLEANUP_WINDOW_CLOSED',
    ],
    [
      { ...activeCleanupWindow, ownerOnlyConfirmed: false },
      'HOSTED_D1_OWNER_ONLY_NOT_CONFIRMED',
    ],
  ] as const) {
    const response = await handlePackage0ProbeRequest(
      operatorRequest('finalize_disposable_d1'),
      dependencies,
    );
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { ok: false, code });
  }

  const missingToken = await handlePackage0ProbeRequest(
    request('finalize_disposable_d1'),
    activeCleanupWindow,
  );
  assert.equal(missingToken.status, 403);
  assert.deepEqual(await missingToken.json(), {
    ok: false,
    code: 'HOSTED_D1_OPERATOR_UNAUTHORIZED',
  });
});

test('enabled HTTP action seals one run, rejects repeats, then finalizes to zero schema', async () => {
  const miniflare = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    d1Databases: { DB: 'focus-contract-studio-package0-http-probe' },
    d1Persist: false,
  });

  try {
    const database = await miniflare.getD1Database('DB');
    const [upMigration, downMigration] = await Promise.all([
      readFile(
        new URL(
          '../../probes/d1/migrations/0001_package0_probe.up.sql',
          import.meta.url,
        ),
        'utf8',
      ),
      readFile(
        new URL(
          '../../probes/d1/migrations/0001_package0_probe.down.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    ]);
    const response = await handlePackage0ProbeRequest(
      operatorRequest('run_disposable_d1'),
      {
        ...activeRunWindow,
        database,
        downMigration,
        upMigration,
      },
    );
    const body = (await response.json()) as {
      ok: boolean;
      result: {
        residualWorkTableCount: number;
        singleUseGate: string;
        zeroRowGuard: string;
      };
    };

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.result.zeroRowGuard, 'PASS');
    assert.equal(body.result.residualWorkTableCount, 0);
    assert.equal(body.result.singleUseGate, 'SEALED');

    assert.equal(response.headers.get('set-cookie'), null);
    assert.doesNotMatch(JSON.stringify(body), new RegExp(operatorToken, 'u'));
    assert.doesNotMatch(
      JSON.stringify(body),
      new RegExp(operatorTokenSha256, 'u'),
    );

    const second = await handlePackage0ProbeRequest(
      operatorRequest('run_disposable_d1'),
      {
        ...activeRunWindow,
        database,
        downMigration,
        upMigration,
      },
    );
    assert.equal(second.status, 409);
    assert.deepEqual(await second.json(), {
      ok: false,
      code: 'HOSTED_D1_PROBE_ALREADY_USED',
    });
    assert.doesNotMatch(
      second.headers.get('set-cookie') ?? '',
      /__Host-fcs_p0_d1_cleanup=/u,
    );

    const beforeDrain = await handlePackage0ProbeRequest(
      operatorRequest('finalize_disposable_d1'),
      {
        ...activeCleanupWindow,
        database,
        d1CleanupWindowExpiresAt: String(nowUnixSeconds + 604),
        d1CleanupWindowNotBefore: String(nowUnixSeconds + 303),
        nowUnixSeconds: nowUnixSeconds + 304,
      },
    );
    assert.equal(beforeDrain.status, 409);
    assert.deepEqual(await beforeDrain.json(), {
      ok: false,
      code: 'HOSTED_D1_FINALIZE_BUSY',
    });

    const prematureFinalize = await handlePackage0ProbeRequest(
      operatorRequest('finalize_disposable_d1'),
      {
        ...activeCleanupWindow,
        database,
        d1Enabled: true,
      },
    );
    assert.equal(prematureFinalize.status, 409);
    assert.deepEqual(await prematureFinalize.json(), {
      ok: false,
      code: 'HOSTED_D1_PROBE_STILL_ENABLED',
    });

    const forgedFinalize = await handlePackage0ProbeRequest(
      operatorRequest(
        'finalize_disposable_d1',
        Buffer.alloc(32, 14).toString('base64url'),
      ),
      {
        ...activeCleanupWindow,
        database,
      },
    );
    assert.equal(forgedFinalize.status, 403);
    assert.deepEqual(await forgedFinalize.json(), {
      ok: false,
      code: 'HOSTED_D1_OPERATOR_UNAUTHORIZED',
    });

    const finalize = await handlePackage0ProbeRequest(
      operatorRequest('finalize_disposable_d1'),
      {
        ...activeCleanupWindow,
        database,
        downMigration,
      },
    );
    assert.equal(finalize.status, 200);
    const finalizeBody = await finalize.json();
    assert.deepEqual(finalizeBody, {
      ok: true,
      action: 'finalize_disposable_d1',
      result: {
        gateCleanup: 'PASS',
        residualProbeTableCount: 0,
        rollback: 'PASS',
      },
    });
    assert.equal(finalize.headers.get('set-cookie'), null);
    assert.doesNotMatch(
      JSON.stringify(finalizeBody),
      new RegExp(operatorToken, 'u'),
    );
  } finally {
    await miniflare.dispose();
  }
});

test('two concurrent hosted D1 requests admit exactly one run', async () => {
  const miniflare = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    d1Databases: { DB: 'focus-contract-studio-package0-http-concurrency' },
    d1Persist: false,
  });

  try {
    const database = await miniflare.getD1Database('DB');
    const [upMigration, downMigration] = await Promise.all([
      readFile(
        new URL(
          '../../probes/d1/migrations/0001_package0_probe.up.sql',
          import.meta.url,
        ),
        'utf8',
      ),
      readFile(
        new URL(
          '../../probes/d1/migrations/0001_package0_probe.down.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    ]);
    const dependencies = {
      ...activeRunWindow,
      database,
      downMigration,
      upMigration,
    };
    const responses = await Promise.all([
      handlePackage0ProbeRequest(operatorRequest('run_disposable_d1'), dependencies),
      handlePackage0ProbeRequest(operatorRequest('run_disposable_d1'), dependencies),
    ]);

    assert.deepEqual(
      responses.map((response) => response.status).sort(),
      [200, 409],
    );
  } finally {
    await miniflare.dispose();
  }
});

test('clear action expires both Package 0 probe cookies', async () => {
  const response = await handlePackage0ProbeRequest(
    request('clear_probe_cookies'),
    {},
  );
  const setCookie = response.headers.get('set-cookie') ?? '';

  assert.equal(response.status, 200);
  assert.match(setCookie, /__Host-fcs_p0_observation=;/u);
  assert.match(setCookie, /__Host-fcs_p0_identity=;/u);
  assert.match(setCookie, /Max-Age=0/u);
});
