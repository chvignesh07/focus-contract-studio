import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';

const package4Env = env as Cloudflare.Env & {
  PACKAGE4_TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
};

await applyD1Migrations(
  package4Env.DB,
  package4Env.PACKAGE4_TEST_MIGRATIONS,
  'package4_test_migrations',
);
