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
    cloudflareTest(async () => {
      const allMigrations = await readD1Migrations(
        path.join(repositoryRoot, 'probes/d1/migrations'),
      );
      const upMigrations = allMigrations.filter(({ name }) =>
        name.endsWith('.up.sql'),
      );

      return {
        remoteBindings: false,
        wrangler: {
          configPath: path.join(repositoryRoot, 'wrangler.package0.jsonc'),
        },
        miniflare: {
          bindings: { PACKAGE0_TEST_MIGRATIONS: upMigrations },
        },
      };
    }),
  ],
  test: {
    include: ['tests/package0/d1-cloudflare-compat.test.ts'],
    setupFiles: ['tests/package0/d1-vitest-setup.ts'],
  },
});
