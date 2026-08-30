import { env } from 'cloudflare:workers';

import downMigration from '@/probes/d1/migrations/0001_package0_probe.down.sql?raw';
import upMigration from '@/probes/d1/migrations/0001_package0_probe.up.sql?raw';
import { handlePackage0ProbeRequest } from '@/probes/hosted/request-handler';

export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return handlePackage0ProbeRequest(request, {
    database: env.DB,
    d1Enabled: env.PACKAGE0_HOSTED_D1_PROBE_ENABLED === 'true',
    downMigration,
    identityKey: env.PACKAGE0_IDENTITY_PROBE_KEY,
    ownerOnlyConfirmed: env.PACKAGE0_OWNER_ONLY_ACCESS_CONFIRMED === 'true',
    upMigration,
  });
}
