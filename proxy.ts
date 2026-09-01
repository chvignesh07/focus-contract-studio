import { type NextRequest, NextResponse } from 'next/server';

import { buildSecurityHeaders } from './lib/server/security-headers';

export function proxy(request: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const securityHeaders = buildSecurityHeaders(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('content-security-policy', securityHeaders.get('content-security-policy')!);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [name, value] of securityHeaders) response.headers.set(name, value);
  return response;
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
