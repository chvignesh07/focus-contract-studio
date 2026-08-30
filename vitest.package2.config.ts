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
        configPath: path.join(repositoryRoot, 'wrangler.package2.jsonc'),
      },
      miniflare: {
        bindings: {
          FCS_SESSION_HMAC_SECRET: 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE',
          FCS_CSRF_HMAC_SECRET: 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI',
          FCS_PUBLIC_ORIGIN: 'https://focus-contract-studio.example',
          FCS_RATE_LIMIT_HMAC_SECRET: 'AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM',
          PACKAGE2_TEST_MIGRATIONS: await readD1Migrations(
            path.join(repositoryRoot, 'drizzle'),
          ),
        },
      },
    })),
  ],
  test: {
    include: ['tests/package2/**/*.test.ts'],
    setupFiles: ['tests/package2/d1-vitest-setup.ts'],
  },
});
