/// <reference types="@cloudflare/vitest-pool-workers/types" />

declare namespace Cloudflare {
  interface Env {
    FCS_CSRF_HMAC_SECRET: string;
    FCS_PUBLIC_ORIGIN: string;
    FCS_RATE_LIMIT_HMAC_SECRET: string;
    FCS_SESSION_HMAC_SECRET: string;
    UPGRADE_DB: D1Database;
    PACKAGE1_TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
    PACKAGE0_UPGRADE_MIGRATIONS: import('cloudflare:test').D1Migration[];
  }
}
