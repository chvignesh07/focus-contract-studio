const CSP_NONCE = /^[A-Za-z0-9+/_-]{16,128}={0,2}$/u;

export const SECURITY_HEADER_NAMES = [
  'content-security-policy',
  'origin-agent-cluster',
  'permissions-policy',
  'referrer-policy',
  'x-content-type-options',
] as const;

export function buildSecurityHeaders(nonce: string): Headers {
  if (!CSP_NONCE.test(nonce)) throw new Error('Invalid CSP nonce.');
  const headers = new Headers();
  headers.set(
    'content-security-policy',
    [
      "default-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "connect-src 'self'",
      "img-src 'self' data:",
      "font-src 'self'",
      `style-src 'self' 'nonce-${nonce}'`,
      `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    ].join('; '),
  );
  headers.set('origin-agent-cluster', '?1');
  headers.set(
    'permissions-policy',
    'camera=(), geolocation=(), microphone=(), payment=(), tools=(self)',
  );
  headers.set('referrer-policy', 'no-referrer');
  headers.set('x-content-type-options', 'nosniff');
  return headers;
}
