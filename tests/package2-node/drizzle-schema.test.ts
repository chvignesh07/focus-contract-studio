import assert from 'node:assert/strict';
import test from 'node:test';

import { getTableName } from 'drizzle-orm';

import * as package2Schema from '../../db/package2-schema.ts';

test('Package 2 separately declares both additive typed tables', () => {
  assert.deepEqual(
    Object.values(package2Schema)
      .map((table) => getTableName(table))
      .sort(),
    ['initial_focus_observation_commits', 'precedent_retrieval_profiles'],
  );
  assert.equal(package2Schema.precedentRetrievalProfiles.workspaceId.notNull, true);
  assert.equal(package2Schema.initialFocusObservationCommits.firstTargetId.notNull, true);
});
