import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const routes = {
  'app/api/active-variant/route.ts': 'variant',
  'app/api/focus-proposals/route.ts': 'proposal',
  'app/api/focus-proposals/reviewer/route.ts': 'proposal',
  'app/api/focus-proposals/[proposalId]/review/route.ts': 'review',
  'app/api/focus-proposals/[proposalId]/apply/route.ts': 'apply',
  'app/api/rehearsals/start/route.ts': 'rehearsal',
  'app/api/rehearsals/[rehearsalSessionId]/finalize/route.ts': 'rehearsal',
  'app/api/observations/initial-focus/route.ts': 'rehearsal',
  'app/api/verifications/route.ts': 'verification',
  'app/api/focus-revisions/[revision]/undo/route.ts': 'undo',
  'app/api/session/reset/route.ts': 'reset',
} as const;

test('every Package 8 mutation route supplies the shared workspace admission operation', () => {
  for (const [relativePath, operation] of Object.entries(routes)) {
    const source = readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
    assert.match(source, new RegExp(`operation: '${operation}'`, 'u'), relativePath);
    assert.match(source, /rateLimitSecret/u, relativePath);
  }
});
