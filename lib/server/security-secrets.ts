import { base64UrlDecode, base64UrlEncode } from './crypto.ts';

type RuntimeHmacSecrets = {
  sessionSecret: string;
  csrfSecret: string;
  rateLimitSecret: string;
};

function canonicalSecret(name: string, value: string): string {
  const decoded = base64UrlDecode(value);
  if (
    !/^[A-Za-z0-9_-]{43}$/u.test(value) ||
    !decoded ||
    decoded.byteLength !== 32 ||
    base64UrlEncode(decoded) !== value
  ) {
    throw new Error(
      `Required server configuration ${name} must be canonical unpadded base64url for exactly 32 bytes.`,
    );
  }
  return value;
}

export function parseRuntimeHmacSecrets(
  input: RuntimeHmacSecrets,
): RuntimeHmacSecrets {
  const parsed = {
    sessionSecret: canonicalSecret(
      'FCS_SESSION_HMAC_SECRET',
      input.sessionSecret,
    ),
    csrfSecret: canonicalSecret('FCS_CSRF_HMAC_SECRET', input.csrfSecret),
    rateLimitSecret: canonicalSecret(
      'FCS_RATE_LIMIT_HMAC_SECRET',
      input.rateLimitSecret,
    ),
  };
  if (new Set(Object.values(parsed)).size !== 3) {
    throw new Error('The three server HMAC secrets must be distinct.');
  }
  return parsed;
}
