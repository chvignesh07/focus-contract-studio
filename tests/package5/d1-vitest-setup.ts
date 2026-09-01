import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';

const package5Env = env as Cloudflare.Env & {
  PACKAGE5_TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
};

await applyD1Migrations(
  package5Env.DB,
  package5Env.PACKAGE5_TEST_MIGRATIONS,
  'package5_test_migrations',
);
