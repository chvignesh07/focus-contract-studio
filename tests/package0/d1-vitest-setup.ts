import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';

await applyD1Migrations(
  env.DB,
  env.PACKAGE0_TEST_MIGRATIONS,
  'package0_test_migrations',
);
