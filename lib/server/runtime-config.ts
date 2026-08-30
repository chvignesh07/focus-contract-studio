import { env } from 'cloudflare:workers';

import { parseRuntimeHmacSecrets } from './security-secrets';

function required(name: keyof Cloudflare.Env): string {
  const value = env[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Required server configuration ${name} is unavailable.`);
  }
  return value;
}

export function runtimeSecurityConfig(): {
  sessionSecret: string;
  csrfSecret: string;
  rateLimitSecret: string;
  publicOrigin: string;
} {
  const secrets = parseRuntimeHmacSecrets({
    sessionSecret: required('FCS_SESSION_HMAC_SECRET'),
    csrfSecret: required('FCS_CSRF_HMAC_SECRET'),
    rateLimitSecret: required('FCS_RATE_LIMIT_HMAC_SECRET'),
  });
  return {
    ...secrets,
    publicOrigin: required('FCS_PUBLIC_ORIGIN'),
  };
}
