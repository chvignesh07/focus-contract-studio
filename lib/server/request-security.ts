import { constantTimeEqual, hexToBytes, sha256Bytes } from './crypto';
import { FcsError } from './errors';

type MutationOptions = {
  expectedOrigin: string;
  csrfDigest?: string;
  maxBytes: number;
};

async function readBoundedBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (length + value.byteLength > maxBytes) {
        await reader.cancel('request body exceeds the configured limit');
        throw new FcsError('BODY_TOO_LARGE', 'The request body is too large.', 413);
      }
      chunks.push(value);
      length += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readStrictJsonMutation(
  request: Request,
  options: MutationOptions,
): Promise<unknown> {
  if (request.method !== 'POST') {
    throw new FcsError('METHOD_NOT_ALLOWED', 'Use POST for this operation.', 405);
  }
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim();
  if (contentType !== 'application/json') {
    throw new FcsError(
      'UNSUPPORTED_MEDIA_TYPE',
      'Use application/json for this operation.',
      415,
    );
  }
  if (request.headers.get('origin') !== options.expectedOrigin) {
    throw new FcsError('ORIGIN_REJECTED', 'The request origin is not allowed.', 403);
  }
  if (options.csrfDigest !== undefined) {
    const csrf = request.headers.get('x-fcs-csrf');
    const expectedDigest = hexToBytes(options.csrfDigest);
    if (!csrf || !expectedDigest) {
      throw new FcsError('CSRF_REJECTED', 'The request token is invalid.', 403);
    }
    const suppliedDigest = await sha256Bytes(csrf);
    if (!constantTimeEqual(expectedDigest, suppliedDigest)) {
      throw new FcsError('CSRF_REJECTED', 'The request token is invalid.', 403);
    }
  }
  const contentLengthHeader = request.headers.get('content-length');
  const contentLength =
    contentLengthHeader === null ? null : Number(contentLengthHeader);
  if (
    contentLength !== null &&
    (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > options.maxBytes)
  ) {
    throw new FcsError('BODY_TOO_LARGE', 'The request body is too large.', 413);
  }
  const bytes = await readBoundedBody(request, options.maxBytes);
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new FcsError('INVALID_JSON', 'The request body is invalid.', 400);
  }
}
