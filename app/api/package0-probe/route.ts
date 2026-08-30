import { env } from 'cloudflare:workers';

import downMigration from '@/probes/d1/migrations/0001_package0_probe.down.sql?raw';
import upMigration from '@/probes/d1/migrations/0001_package0_probe.up.sql?raw';
import { handlePackage0ProbeRequest } from '@/probes/hosted/request-handler';

export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return handlePackage0ProbeRequest(request, {
    database: env.DB,
    d1CleanupEnabled: env.PACKAGE0_HOSTED_D1_CLEANUP_ENABLED === 'true',
    d1CleanupWindowExpiresAt:
      env.PACKAGE0_HOSTED_D1_CLEANUP_WINDOW_EXPIRES_AT,
    d1CleanupWindowNotBefore:
      env.PACKAGE0_HOSTED_D1_CLEANUP_WINDOW_NOT_BEFORE,
    d1Enabled: env.PACKAGE0_HOSTED_D1_PROBE_ENABLED === 'true',
    d1WindowExpiresAt: env.PACKAGE0_HOSTED_D1_PROBE_WINDOW_EXPIRES_AT,
    d1WindowNotBefore: env.PACKAGE0_HOSTED_D1_PROBE_WINDOW_NOT_BEFORE,
    downMigration,
    identityKey: env.PACKAGE0_IDENTITY_PROBE_KEY,
    operatorTokenSha256: env.PACKAGE0_D1_OPERATOR_TOKEN_SHA256,
    ownerOnlyConfirmed: env.PACKAGE0_OWNER_ONLY_ACCESS_CONFIRMED === 'true',
    upMigration,
  });
}
