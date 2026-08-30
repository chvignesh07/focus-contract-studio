import {
  base64UrlDecode,
  base64UrlEncode,
  hmacSha256,
  hmacSha256Hex,
  sha256Hex,
  verifyHmacSha256,
} from './crypto';

export const SESSION_COOKIE_NAME = '__Host-fcs_session';
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const MAX_FUTURE_SKEW_SECONDS = 30;
const SESSION_VERSION = 'v1';

type SessionCookieOptions = {
  token: Uint8Array;
  now: number;
  sessionSecret: string;
};

function signingInput(issuedAt: number, tokenValue: string): string {
  return `fcs-session-cookie-v1:${issuedAt}:${tokenValue}`;
}

function cookieValueFromHeader(cookieHeader: string): string | null {
  for (const segment of cookieHeader.split(';')) {
    const [name, ...valueParts] = segment.trim().split('=');
    if (name === SESSION_COOKIE_NAME) return valueParts.join('=');
  }
  return null;
}

export async function issueSessionCookie({
  token,
  now,
  sessionSecret,
}: SessionCookieOptions): Promise<{
  name: typeof SESSION_COOKIE_NAME;
  value: string;
  header: string;
}> {
  if (token.byteLength !== 32) throw new Error('Session token must be 256 bits.');
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid session time.');
  const tokenValue = base64UrlEncode(token);
  const signature = base64UrlEncode(
    await hmacSha256(sessionSecret, signingInput(now, tokenValue)),
  );
  const value = `${SESSION_VERSION}.${now}.${tokenValue}.${signature}`;
  return {
    name: SESSION_COOKIE_NAME,
    value,
    header: `${SESSION_COOKIE_NAME}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  };
}

export async function parseSessionCookie(
  cookieHeader: string | null,
  options: { now: number; sessionSecret: string },
): Promise<{ token: Uint8Array; issuedAt: number; value: string } | null> {
  if (!cookieHeader) return null;
  const value = cookieValueFromHeader(cookieHeader);
  if (!value) return null;
  const match = /^v1\.([0-9]{1,12})\.([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/u.exec(
    value,
  );
  if (!match) return null;
  const issuedAt = Number(match[1]);
  if (!Number.isSafeInteger(issuedAt) || issuedAt < 0) return null;
  if (issuedAt > options.now + MAX_FUTURE_SKEW_SECONDS) return null;
  if (options.now - issuedAt > SESSION_MAX_AGE_SECONDS) return null;
  const token = base64UrlDecode(match[2]!);
  const signature = base64UrlDecode(match[3]!);
  if (!token || token.byteLength !== 32 || !signature || signature.byteLength !== 32) {
    return null;
  }
  const valid = await verifyHmacSha256(
    options.sessionSecret,
    signingInput(issuedAt, match[2]!),
    signature,
  );
  return valid ? { token, issuedAt, value } : null;
}

export async function anonymousSubjectKey(
  token: Uint8Array,
  sessionSecret: string,
): Promise<string> {
  return hmacSha256Hex(
    sessionSecret,
    `fcs-anonymous-subject-v1:${base64UrlEncode(token)}`,
  );
}

export async function csrfTokenForSession(
  token: Uint8Array,
  csrfSecret: string,
): Promise<string> {
  return base64UrlEncode(
    await hmacSha256(
      csrfSecret,
      `fcs-csrf-token-v1:${base64UrlEncode(token)}`,
    ),
  );
}

export async function csrfDigestForSession(
  token: Uint8Array,
  csrfSecret: string,
): Promise<string> {
  return sha256Hex(await csrfTokenForSession(token, csrfSecret));
}

export async function resetTokenForSession(
  token: Uint8Array,
  idempotencyKey: string,
  sessionSecret: string,
): Promise<Uint8Array> {
  return hmacSha256(
    sessionSecret,
    `fcs-reset-session-v1:${base64UrlEncode(token)}:${idempotencyKey}`,
  );
}
