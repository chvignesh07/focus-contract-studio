import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';

const package8Env = env as Cloudflare.Env & {
  PACKAGE8_TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
};

await applyD1Migrations(
  package8Env.DB,
  package8Env.PACKAGE8_TEST_MIGRATIONS,
  'package8_test_migrations',
);
