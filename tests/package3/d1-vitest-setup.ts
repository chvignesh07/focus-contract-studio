import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';

const package3Env = env as Cloudflare.Env & {
  PACKAGE3_TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
};

await applyD1Migrations(
  package3Env.DB,
  package3Env.PACKAGE3_TEST_MIGRATIONS,
  'package3_test_migrations',
);
