import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { defineConfig } from 'vitest/config';

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url));
const migrationDirectory = path.join(repositoryRoot, 'drizzle');
const journal = JSON.parse(
  readFileSync(path.join(migrationDirectory, 'meta/_journal.json'), 'utf8'),
) as { entries: Array<{ tag: string }> };
const sitesMigrations = readMigrationFiles({
  migrationsFolder: migrationDirectory,
}).map((migration, index) => ({
  name: `${journal.entries[index]?.tag}.sql`,
  queries: migration.sql,
}));

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      remoteBindings: false,
      wrangler: {
        configPath: path.join(repositoryRoot, 'wrangler.package5.jsonc'),
      },
      miniflare: {
        d1Databases: {
          PACKAGE9_DB: 'focus-contract-studio-package9-sites-migrations',
        },
        bindings: { PACKAGE9_SITES_MIGRATIONS: sitesMigrations },
      },
    })),
  ],
  test: { include: ['tests/package9/**/*.test.ts'] },
});
