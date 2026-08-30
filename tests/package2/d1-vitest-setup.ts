import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';

await applyD1Migrations(
  env.DB,
  env.PACKAGE2_TEST_MIGRATIONS,
  'package2_test_migrations',
);
