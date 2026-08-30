const encoder = new TextEncoder();

function bufferSource(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function secretBytes(secret: string | Uint8Array): Uint8Array {
  const bytes = typeof secret === 'string' ? encoder.encode(secret) : secret;
  if (bytes.byteLength < 32) {
    throw new Error('Server cryptographic secret must contain at least 32 bytes.');
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(value: string): Uint8Array | null {
  if (!/^[a-f0-9]+$/u.test(value) || value.length % 2 !== 0) return null;
  return Uint8Array.from(value.match(/.{2}/gu) ?? [], (pair) =>
    Number.parseInt(pair, 16),
  );
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

export function base64UrlDecode(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  const padding = (4 - (value.length % 4)) % 4;
  try {
    const binary = atob(
      `${value.replaceAll('-', '+').replaceAll('_', '/')}${'='.repeat(padding)}`,
    );
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return base64UrlEncode(bytes) === value ? bytes : null;
  } catch {
    return null;
  }
}

export async function sha256Bytes(value: string | Uint8Array): Promise<Uint8Array> {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  return new Uint8Array(
    await crypto.subtle.digest('SHA-256', bufferSource(bytes)),
  );
}

export async function sha256Hex(value: string | Uint8Array): Promise<string> {
  return bytesToHex(await sha256Bytes(value));
}

async function importHmacKey(secret: string | Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    bufferSource(secretBytes(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function hmacSha256(
  secret: string | Uint8Array,
  value: string | Uint8Array,
): Promise<Uint8Array> {
  const data = typeof value === 'string' ? encoder.encode(value) : value;
  const key = await importHmacKey(secret);
  return new Uint8Array(
    await crypto.subtle.sign('HMAC', key, bufferSource(data)),
  );
}

export async function hmacSha256Hex(
  secret: string | Uint8Array,
  value: string | Uint8Array,
): Promise<string> {
  return bytesToHex(await hmacSha256(secret, value));
}

export async function verifyHmacSha256(
  secret: string | Uint8Array,
  value: string | Uint8Array,
  signature: Uint8Array,
): Promise<boolean> {
  const data = typeof value === 'string' ? encoder.encode(value) : value;
  const key = await importHmacKey(secret);
  return crypto.subtle.verify(
    'HMAC',
    key,
    bufferSource(signature),
    bufferSource(data),
  );
}

export function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  const length = Math.max(left.byteLength, right.byteLength);
  let difference = left.byteLength ^ right.byteLength;
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

export function randomTokenBytes(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

export async function deterministicUuid(seed: string): Promise<string> {
  const bytes = (await sha256Bytes(seed)).slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
