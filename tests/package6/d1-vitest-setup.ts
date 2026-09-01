import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';

const package6Env = env as Cloudflare.Env & {
  PACKAGE6_TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
};

await applyD1Migrations(
  package6Env.DB,
  package6Env.PACKAGE6_TEST_MIGRATIONS,
  'package6_test_migrations',
);
