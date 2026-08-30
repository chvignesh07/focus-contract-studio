import {
  finalizeDisposableHostedD1Probe,
  HostedD1ProbeError,
  runDisposableHostedD1Probe,
} from '../d1/hosted-probe.ts';

const observationCookieName = '__Host-fcs_p0_observation';
const identityCookieName = '__Host-fcs_p0_identity';
const d1CleanupCookieName = '__Host-fcs_p0_d1_cleanup';
const spoofEmail = 'package0-spoof@invalid.example';
const maxRequestBytes = 256;

type ProbeAction =
  | 'observe_platform'
  | 'run_disposable_d1'
  | 'finalize_disposable_d1'
  | 'clear_probe_cookies';

type ProbeDependencies = {
  database?: D1Database;
  d1Enabled?: boolean;
  downMigration?: string;
  identityKey?: string;
  ownerOnlyConfirmed?: boolean;
  upMigration?: string;
};

export async function handlePackage0ProbeRequest(
  request: Request,
  dependencies: ProbeDependencies,
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse(
      { ok: false, code: 'METHOD_NOT_ALLOWED' },
      { status: 405, headers: { Allow: 'POST' } },
    );
  }

  if (!isSameOrigin(request)) {
    return jsonResponse({ ok: false, code: 'ORIGIN_REJECTED' }, { status: 403 });
  }

  const action = await readAction(request);
  if (!action) {
    return jsonResponse({ ok: false, code: 'INVALID_INPUT' }, { status: 400 });
  }

  if (action === 'clear_probe_cookies') {
    const response = jsonResponse({ ok: true, action });
    expireCookie(response.headers, observationCookieName);
    expireCookie(response.headers, identityCookieName);
    return response;
  }

  if (action === 'run_disposable_d1') {
    if (!dependencies.d1Enabled) {
      return jsonResponse(
        { ok: false, code: 'HOSTED_D1_PROBE_DISABLED' },
        { status: 403 },
      );
    }
    if (!dependencies.ownerOnlyConfirmed) {
      return jsonResponse(
        { ok: false, code: 'HOSTED_D1_OWNER_ONLY_NOT_CONFIRMED' },
        { status: 403 },
      );
    }
    if (
      !dependencies.database ||
      !dependencies.upMigration ||
      !dependencies.downMigration
    ) {
      return jsonResponse(
        { ok: false, code: 'HOSTED_D1_PROBE_UNAVAILABLE' },
        { status: 503 },
      );
    }

    const cleanupToken = randomBase64Url(32);
    const cleanupTokenSha256 = await sha256Hex(cleanupToken);
    try {
      const result = await runDisposableHostedD1Probe(
        dependencies.database,
        dependencies.upMigration,
        dependencies.downMigration,
        cleanupTokenSha256,
      );
      const response = jsonResponse({ ok: true, action, result });
      setProbeCookie(
        response.headers,
        d1CleanupCookieName,
        cleanupToken,
        900,
      );
      return response;
    } catch (error) {
      const code =
        error instanceof HostedD1ProbeError
          ? error.code
          : 'HOSTED_D1_PROBE_FAILED';
      const status =
        code === 'HOSTED_D1_PROBE_ALREADY_USED' ||
        code === 'HOSTED_D1_SCHEMA_COLLISION'
          ? 409
          : 500;
      const response = jsonResponse({ ok: false, code }, { status });
      if (error instanceof HostedD1ProbeError && error.cleanupAuthorized) {
        setProbeCookie(
          response.headers,
          d1CleanupCookieName,
          cleanupToken,
          900,
        );
      }
      return response;
    }
  }

  if (action === 'finalize_disposable_d1') {
    if (dependencies.d1Enabled) {
      return jsonResponse(
        { ok: false, code: 'HOSTED_D1_PROBE_STILL_ENABLED' },
        { status: 409 },
      );
    }
    if (!dependencies.ownerOnlyConfirmed) {
      return jsonResponse(
        { ok: false, code: 'HOSTED_D1_OWNER_ONLY_NOT_CONFIRMED' },
        { status: 403 },
      );
    }
    if (!dependencies.database) {
      return jsonResponse(
        { ok: false, code: 'HOSTED_D1_PROBE_UNAVAILABLE' },
        { status: 503 },
      );
    }
    const cleanupToken = readCookie(request, d1CleanupCookieName);
    if (!cleanupToken) {
      return jsonResponse(
        { ok: false, code: 'HOSTED_D1_FINALIZE_FORBIDDEN' },
        { status: 403 },
      );
    }

    try {
      const result = await finalizeDisposableHostedD1Probe(
        dependencies.database,
        cleanupToken,
      );
      const response = jsonResponse({ ok: true, action, result });
      expireCookie(response.headers, d1CleanupCookieName);
      return response;
    } catch (error) {
      const code =
        error instanceof HostedD1ProbeError
          ? error.code
          : 'HOSTED_D1_FINALIZE_FAILED';
      const status =
        code === 'HOSTED_D1_FINALIZE_FORBIDDEN'
          ? 403
          : code === 'HOSTED_D1_FINALIZE_BUSY' ||
              code === 'HOSTED_D1_FINALIZE_UNAVAILABLE'
            ? 409
            : 500;
      return jsonResponse({ ok: false, code }, { status });
    }
  }

  const emailHeader = request.headers.get('oai-authenticated-user-email');
  const callerSpoofObserved = emailHeader === spoofEmail;
  const previousIdentityMac = readCookie(request, identityCookieName);
  let repeatIdentityBytesMatch: boolean | null = null;
  let nextIdentityMac: string | null = null;
  const identityKey = dependencies.identityKey
    ? decodeBase64Url(dependencies.identityKey)
    : null;
  const identityProbeConfigured = identityKey?.byteLength === 32;

  if (emailHeader && !callerSpoofObserved && identityProbeConfigured) {
    if (previousIdentityMac) {
      repeatIdentityBytesMatch = await verifyIdentityMac(
        identityKey,
        emailHeader,
        previousIdentityMac,
      );
    }
    nextIdentityMac = await signIdentityBytes(identityKey, emailHeader);
  }

  const response = jsonResponse({
    ok: true,
    action,
    callerSpoofObserved,
    identityHeaderPresent: emailHeader !== null,
    identityMacIssued: nextIdentityMac !== null,
    identityProbeConfigured,
    repeatIdentityBytesMatch,
  });
  setProbeCookie(
    response.headers,
    observationCookieName,
    randomBase64Url(24),
    120,
  );
  if (nextIdentityMac) {
    setProbeCookie(
      response.headers,
      identityCookieName,
      nextIdentityMac,
      600,
    );
  }
  return response;
}

async function readAction(request: Request): Promise<ProbeAction | null> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) return null;

  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > maxRequestBytes) {
    return null;
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return null;
  }
  if (new TextEncoder().encode(text).byteLength > maxRequestBytes) return null;

  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return null;
  }

  if (
    input === null ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length !== 1 ||
    !Object.hasOwn(input, 'action')
  ) {
    return null;
  }

  const action = (input as { action?: unknown }).action;
  return action === 'observe_platform' ||
    action === 'run_disposable_d1' ||
    action === 'finalize_disposable_d1' ||
    action === 'clear_probe_cookies'
    ? action
    : null;
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: HeadersInit } = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers,
  });
}

function setProbeCookie(
  headers: Headers,
  name: string,
  value: string,
  maxAge: number,
): void {
  headers.append(
    'Set-Cookie',
    `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`,
  );
}

function expireCookie(headers: Headers, name: string): void {
  headers.append(
    'Set-Cookie',
    `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
  );
}

function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      const value = part.slice(separator + 1).trim();
      return /^[A-Za-z0-9_-]+$/u.test(value) ? value : null;
    }
  }
  return null;
}

async function signIdentityBytes(
  rawKey: Uint8Array<ArrayBuffer>,
  identity: string,
): Promise<string> {
  const key = await importHmacKey(rawKey, ['sign']);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(identity),
  );
  return encodeBase64Url(new Uint8Array(signature));
}

async function verifyIdentityMac(
  rawKey: Uint8Array<ArrayBuffer>,
  identity: string,
  encodedMac: string,
): Promise<boolean> {
  const mac = decodeBase64Url(encodedMac);
  if (!mac) return false;

  const key = await importHmacKey(rawKey, ['verify']);
  return crypto.subtle.verify(
    'HMAC',
    key,
    mac,
    new TextEncoder().encode(identity),
  );
}

function importHmacKey(
  rawKey: Uint8Array<ArrayBuffer>,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages,
  );
}

function randomBase64Url(byteLength: number): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(
    Math.ceil(value.length / 4) * 4,
    '=',
  );

  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}
