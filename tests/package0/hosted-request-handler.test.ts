import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { Miniflare } from 'miniflare';

import { handlePackage0ProbeRequest } from '../../probes/hosted/request-handler.ts';
import { interpretPlatformObservation } from '../../probes/hosted/presentation.ts';

const endpoint = 'https://focus.example/api/package0-probe';
const identityKey = Buffer.alloc(32, 7).toString('base64url');

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

test('hosted D1 mutation stays disabled unless the owner-only probe flag is explicit', async () => {
  const response = await handlePackage0ProbeRequest(
    request('run_disposable_d1'),
    { d1Enabled: false },
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    ok: false,
    code: 'HOSTED_D1_PROBE_DISABLED',
  });
});

test('hosted D1 mutation also requires an explicit owner-only access confirmation', async () => {
  const response = await handlePackage0ProbeRequest(
    request('run_disposable_d1'),
    { d1Enabled: true, ownerOnlyConfirmed: false },
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    ok: false,
    code: 'HOSTED_D1_OWNER_ONLY_NOT_CONFIRMED',
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
      request('run_disposable_d1'),
      {
        database,
        d1Enabled: true,
        downMigration,
        ownerOnlyConfirmed: true,
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

    const cleanupCookie = /(__Host-fcs_p0_d1_cleanup=[^;,]+)/u.exec(
      response.headers.get('set-cookie') ?? '',
    )?.[1];
    assert.ok(cleanupCookie);

    const second = await handlePackage0ProbeRequest(
      request('run_disposable_d1'),
      {
        database,
        d1Enabled: true,
        downMigration,
        ownerOnlyConfirmed: true,
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

    const prematureFinalize = await handlePackage0ProbeRequest(
      request('finalize_disposable_d1', { cookie: cleanupCookie }),
      {
        database,
        d1Enabled: true,
        ownerOnlyConfirmed: true,
      },
    );
    assert.equal(prematureFinalize.status, 409);
    assert.deepEqual(await prematureFinalize.json(), {
      ok: false,
      code: 'HOSTED_D1_PROBE_STILL_ENABLED',
    });

    const forgedFinalize = await handlePackage0ProbeRequest(
      request('finalize_disposable_d1', {
        cookie: `__Host-fcs_p0_d1_cleanup=${'z'.repeat(43)}`,
      }),
      {
        database,
        d1Enabled: false,
        ownerOnlyConfirmed: true,
      },
    );
    assert.equal(forgedFinalize.status, 403);
    assert.deepEqual(await forgedFinalize.json(), {
      ok: false,
      code: 'HOSTED_D1_FINALIZE_FORBIDDEN',
    });

    const finalize = await handlePackage0ProbeRequest(
      request('finalize_disposable_d1', { cookie: cleanupCookie }),
      {
        database,
        d1Enabled: false,
        downMigration,
        ownerOnlyConfirmed: true,
      },
    );
    assert.equal(finalize.status, 200);
    assert.deepEqual(await finalize.json(), {
      ok: true,
      action: 'finalize_disposable_d1',
      result: {
        gateCleanup: 'PASS',
        residualProbeTableCount: 0,
        rollback: 'PASS',
      },
    });
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
      database,
      d1Enabled: true,
      downMigration,
      ownerOnlyConfirmed: true,
      upMigration,
    };
    const responses = await Promise.all([
      handlePackage0ProbeRequest(request('run_disposable_d1'), dependencies),
      handlePackage0ProbeRequest(request('run_disposable_d1'), dependencies),
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
