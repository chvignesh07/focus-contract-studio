import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { getTableName } from 'drizzle-orm';

import * as schema from '../../db/schema.ts';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

const expected = [
  'application_commits',
  'application_guards',
  'application_receipts',
  'audit_events',
  'component_variants',
  'idempotency_records',
  'implemented_focus_revisions',
  'observation_events',
  'observation_sessions',
  'precedent_lineage',
  'precedent_records',
  'precedent_subject_edges',
  'proposal_evidence',
  'proposals',
  'rate_limit_windows',
  'rendered_manifests',
  'retrieval_queries',
  'retrieval_results',
  'review_decisions',
  'verification_checks',
  'verification_receipts',
  'workspace_view_state',
  'workspaces',
];

test('Drizzle declares every Revision 2 domain entity', () => {
  const declared = Object.values(schema)
    .map((value) => getTableName(value))
    .sort();
  assert.deepEqual(declared, expected);
  assert.equal(
    schema.rateLimitWindows.workspaceId.notNull,
    false,
    'global admission windows deliberately have no workspace owner',
  );
});

test('reviewed numbered SQL is the sole migration authority', () => {
  const packageJson = JSON.parse(
    readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'),
  ) as {
    scripts?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  assert.equal(packageJson.scripts?.['db:generate'], undefined);
  assert.equal(packageJson.devDependencies?.['drizzle-kit'], undefined);

  const result = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      path.join(repositoryRoot, 'drizzle.config.ts'),
    ],
    { encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(
    `${result.stdout}${result.stderr}`,
    /DRIZZLE_GENERATION_DISABLED: use reviewed numbered SQL migrations/u,
  );
});
