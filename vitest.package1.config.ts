import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  cloudflareTest,
  readD1Migrations,
} from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      remoteBindings: false,
      wrangler: {
        configPath: path.join(repositoryRoot, 'wrangler.package1.jsonc'),
      },
      miniflare: {
        bindings: {
          FCS_SESSION_HMAC_SECRET: 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE',
          FCS_CSRF_HMAC_SECRET: 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI',
          FCS_PUBLIC_ORIGIN: 'https://focus-contract-studio.example',
          FCS_RATE_LIMIT_HMAC_SECRET: 'AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM',
          PACKAGE1_TEST_MIGRATIONS: await readD1Migrations(
            path.join(repositoryRoot, 'drizzle'),
          ),
          PACKAGE0_UPGRADE_MIGRATIONS: (
            await readD1Migrations(
              path.join(repositoryRoot, 'probes/d1/migrations'),
            )
          ).filter(({ name }) => name.endsWith('.up.sql')),
        },
      },
    })),
  ],
  test: {
    include: ['tests/package1/**/*.test.ts'],
    setupFiles: ['tests/package1/d1-vitest-setup.ts'],
  },
});
