import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';

const package7Env = env as Cloudflare.Env & {
  PACKAGE7_TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
};

await applyD1Migrations(
  package7Env.DB,
  package7Env.PACKAGE7_TEST_MIGRATIONS,
  'package7_test_migrations',
);
