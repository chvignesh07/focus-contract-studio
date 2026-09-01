import assert from 'node:assert/strict';
import test from 'node:test';

import { boundedHistoryLimit } from '../../../lib/server/package5-operation-policy.ts';

test('deliberately incomplete coverage fixture', () => {
  assert.equal(boundedHistoryLimit(1), 1);
});
