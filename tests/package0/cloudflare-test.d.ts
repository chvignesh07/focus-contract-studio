/// <reference types="@cloudflare/vitest-pool-workers/types" />

declare namespace Cloudflare {
  interface Env {
    PACKAGE0_TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
  }
}
