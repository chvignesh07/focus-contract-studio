import {
  base64UrlDecode,
  base64UrlEncode,
  hmacSha256,
  verifyHmacSha256,
} from './crypto.ts';
import { FcsError } from './errors.ts';

const TOKEN_VERSION = 'v1';
const TOKEN_DOMAIN = 'fcs-evidence-token-v1';
export const EVIDENCE_TOKEN_LIFETIME_SECONDS = 300;
export const EVIDENCE_TOKEN_FUTURE_SKEW_SECONDS = 30;

export type EvidenceBinding = {
  sessionToken: Uint8Array;
  workspaceId: string;
  variantId: string;
  implementedRevision: number;
  contextDigest: string;
  resultDigest: string;
};

function tokenFailure(): FcsError {
  return new FcsError(
    'EVIDENCE_NOT_ELIGIBLE',
    'The supplied evidence is not eligible.',
    409,
  );
}

function validBinding(input: EvidenceBinding): boolean {
  return (
    input.sessionToken.byteLength === 32 &&
    /^[A-Za-z0-9_-]{1,64}$/u.test(input.workspaceId) &&
    /^[A-Za-z0-9_-]{1,64}$/u.test(input.variantId) &&
    Number.isSafeInteger(input.implementedRevision) &&
    input.implementedRevision >= 1 &&
    /^[0-9a-f]{64}$/u.test(input.contextDigest) &&
    /^[0-9a-f]{64}$/u.test(input.resultDigest)
  );
}

function signingInput(binding: EvidenceBinding, issuedAt: number): string {
  return [
    TOKEN_DOMAIN,
    String(issuedAt),
    binding.workspaceId,
    binding.variantId,
    String(binding.implementedRevision),
    binding.contextDigest,
    binding.resultDigest,
  ].join('\n');
}

export async function issueEvidenceToken(
  input: EvidenceBinding & { issuedAt: number },
): Promise<string> {
  if (
    !validBinding(input) ||
    !Number.isSafeInteger(input.issuedAt) ||
    input.issuedAt < 0 ||
    input.issuedAt > 999_999_999_999
  ) {
    throw new Error('Evidence token binding is invalid.');
  }
  const mac = await hmacSha256(
    input.sessionToken,
    signingInput(input, input.issuedAt),
  );
  return `${TOKEN_VERSION}.${input.issuedAt}.${base64UrlEncode(mac)}`;
}

export function parseEvidenceTokenIssuedAt(token: string, now: number): number {
  if (!Number.isSafeInteger(now) || now < 0 || now > 999_999_999_999) {
    throw tokenFailure();
  }
  const match = /^v1\.([0-9]{1,12})\.([A-Za-z0-9_-]{43})$/u.exec(token);
  if (!match || token.length > 96) throw tokenFailure();
  const issuedAt = Number(match[1]);
  const mac = base64UrlDecode(match[2]!);
  if (
    !Number.isSafeInteger(issuedAt) ||
    issuedAt < 0 ||
    issuedAt > now + EVIDENCE_TOKEN_FUTURE_SKEW_SECONDS ||
    now - issuedAt > EVIDENCE_TOKEN_LIFETIME_SECONDS ||
    !mac ||
    mac.byteLength !== 32
  ) {
    throw tokenFailure();
  }
  return issuedAt;
}

export async function verifyEvidenceToken(
  token: string,
  input: EvidenceBinding & { now: number },
): Promise<{ issuedAt: number }> {
  if (!validBinding(input) || !Number.isSafeInteger(input.now) || input.now < 0) {
    throw tokenFailure();
  }
  const issuedAt = parseEvidenceTokenIssuedAt(token, input.now);
  const match = /^v1\.([0-9]{1,12})\.([A-Za-z0-9_-]{43})$/u.exec(token)!;
  const mac = base64UrlDecode(match[2]!);
  if (!mac || mac.byteLength !== 32) throw tokenFailure();
  const valid = await verifyHmacSha256(
    input.sessionToken,
    signingInput(input, issuedAt),
    mac,
  );
  if (!valid) throw tokenFailure();
  return { issuedAt };
}
