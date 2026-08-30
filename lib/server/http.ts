import { FcsError, normalizePublicError } from './errors';

export function jsonNoStore(body: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('cache-control', 'no-store');
  responseHeaders.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

export function errorResponse(error: unknown): Response {
  const publicError = normalizePublicError(error);
  return jsonNoStore(publicError.toEnvelope(), publicError.status);
}

export function methodNotAllowed(): Response {
  return errorResponse(
    new FcsError('METHOD_NOT_ALLOWED', 'Use POST for this operation.', 405),
  );
}
