import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
}

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const port = Number.parseInt(argumentValue('--port', '43127'), 10);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65_535) {
  throw new Error('The local browser-test port is invalid.');
}
const wrangler = path.join(repositoryRoot, 'node_modules/.bin/wrangler');
const config = path.join(repositoryRoot, 'dist/server/wrangler.json');
const persistence = mkdtempSync(path.join(tmpdir(), 'fcs-package2-browser-d1-'));
let server;
let cleaned = false;

function cleanup() {
  if (cleaned) return;
  cleaned = true;
  if (!path.basename(persistence).startsWith('fcs-package2-browser-d1-')) {
    throw new Error('Refusing to remove an unexpected persistence directory.');
  }
  rmSync(persistence, { recursive: true, force: true });
}

function executeMigration(file) {
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
      path.join(repositoryRoot, file),
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
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `Local migration failed for ${file}: ${result.stderr || result.stdout}`,
    );
  }
}

try {
  executeMigration('drizzle/0001_package1_domain.sql');
  executeMigration('drizzle/0002_package2_vertical_slice.sql');
  server = spawn(
    wrangler,
    [
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
    ],
    {
      cwd: repositoryRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        WRANGLER_SEND_METRICS: 'false',
        WRANGLER_WRITE_LOGS: 'false',
      },
    },
  );
} catch (error) {
  cleanup();
  throw error;
}

function stop(signal) {
  if (server && !server.killed) server.kill(signal);
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
server.on('error', (error) => {
  cleanup();
  throw error;
});
server.on('exit', (code, signal) => {
  cleanup();
  if (signal && signal !== 'SIGINT' && signal !== 'SIGTERM') {
    process.stderr.write(`Local Package 2 server exited on ${signal}.\n`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 0;
});
