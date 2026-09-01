import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url));
const requestedPackage = process.env.FCS_PLAYWRIGHT_PACKAGE;
const packageNumber = requestedPackage === '5' || requestedPackage === '3'
  ? requestedPackage
  : '2';
const port = 43_127;
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(
  repositoryRoot,
  '.playwright-browsers',
);

function d1ServerCommand(): string {
  const persistencePrefix = `fcs-package${packageNumber}-browser-d1-`;
  const persistence = mkdtempSync(path.join(tmpdir(), persistencePrefix));
  const wrangler = path.join(repositoryRoot, 'node_modules/.bin/wrangler');
  const config = path.join(repositoryRoot, 'dist/server/wrangler.json');
  process.once('exit', () => {
    if (path.basename(persistence).startsWith(persistencePrefix)) {
      rmSync(persistence, { recursive: true, force: true });
    }
  });
  const migrations = [
    'drizzle/0001_package1_domain.sql',
    'drizzle/0002_package2_vertical_slice.sql',
    'drizzle/0003_package3_raw_observer_verifier.sql',
  ];
  if (packageNumber === '5') {
    migrations.push('drizzle/0004_package5_review_apply_undo.sql');
  }
  for (const migration of migrations) {
    const result = spawnSync(
      wrangler,
      [
        'd1',
        'execute',
        'site-creator-d1',
        '--config',
        config,
        '--local',
        '--persist-to',
        persistence,
        '--file',
        path.join(repositoryRoot, migration),
        '--yes',
      ],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          WRANGLER_SEND_METRICS: 'false',
          WRANGLER_WRITE_LOGS: 'false',
        },
      },
    );
    if (result.status !== 0) {
      rmSync(persistence, { recursive: true, force: true });
      throw new Error(`Package ${packageNumber} local migration failed: ${result.stderr || result.stdout}`);
    }
  }
  return [
    wrangler,
    'dev',
    '--config',
    config,
    '--local',
    '--ip',
    '127.0.0.1',
    '--port',
    String(port),
    '--persist-to',
    persistence,
    '--log-level',
    'warn',
    '--show-interactive-dev-session=false',
    '--var',
    'FCS_SESSION_HMAC_SECRET:AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE',
    '--var',
    'FCS_CSRF_HMAC_SECRET:AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI',
    '--var',
    'FCS_RATE_LIMIT_HMAC_SECRET:AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM',
    '--var',
    `FCS_PUBLIC_ORIGIN:http://127.0.0.1:${port}`,
  ].join(' ');
}

const webServerCommand =
  packageNumber === '3' || packageNumber === '5'
    ? d1ServerCommand()
    : `node scripts/package2-local-server.mjs --port ${port}`;

export default defineConfig({
  testDir: `./tests/package${packageNumber}-browser`,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [['line']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: webServerCommand,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
