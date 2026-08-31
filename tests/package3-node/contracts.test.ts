import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  canonicalObservationEvents,
  canonicalRenderedManifest,
  finalizeRehearsalInputSchema,
  observationEventSchema,
  renderedManifestSchema,
  startRehearsalInputSchema,
} from '../../lib/domain/focus-rehearsal.ts';

const manifest = {
  manifestVersion: 'focus-manifest-v1',
  targetIds: [
    'delete-trigger',
    'dialog-title',
    'reason-input',
    'cancel-button',
    'delete-button',
  ],
  tabbableOrder: ['reason-input', 'cancel-button', 'delete-button'],
  dialogName: 'Delete account',
  dialogDescription:
    'Deleting your account is permanent. You can optionally tell us why.',
  role: 'dialog',
  ariaModal: true,
  open: true,
  variantId: '00000000-0000-4000-8000-000000000301',
  implementedRevision: 1,
} as const;

const events = [
  { eventType: 'dialog_open', targetId: 'delete-trigger', clientOffsetMs: 0 },
  { eventType: 'focusin', targetId: 'delete-button', clientOffsetMs: 2 },
  {
    eventType: 'keydown',
    targetId: 'delete-button',
    keyName: 'Tab',
    shiftKey: false,
    clientOffsetMs: 3,
  },
  { eventType: 'focusin', targetId: 'reason-input', clientOffsetMs: 4 },
  {
    eventType: 'keydown',
    targetId: 'reason-input',
    keyName: 'Escape',
    shiftKey: false,
    clientOffsetMs: 5,
  },
  {
    eventType: 'dialog_close',
    targetId: 'dialog-title',
    closeReason: 'escape',
    clientOffsetMs: 6,
  },
  { eventType: 'focus_return', targetId: 'delete-trigger', clientOffsetMs: 7 },
] as const;

const completeEvents = [
  { eventType: 'dialog_open', targetId: 'delete-trigger', clientOffsetMs: 0 },
  { eventType: 'focusin', targetId: 'delete-button', clientOffsetMs: 1 },
  { eventType: 'keydown', targetId: 'delete-button', keyName: 'Tab', shiftKey: false, clientOffsetMs: 2 },
  { eventType: 'focusin', targetId: 'reason-input', clientOffsetMs: 3 },
  { eventType: 'keydown', targetId: 'reason-input', keyName: 'Tab', shiftKey: false, clientOffsetMs: 4 },
  { eventType: 'focusin', targetId: 'cancel-button', clientOffsetMs: 5 },
  { eventType: 'keydown', targetId: 'cancel-button', keyName: 'Tab', shiftKey: false, clientOffsetMs: 6 },
  { eventType: 'focusin', targetId: 'delete-button', clientOffsetMs: 7 },
  { eventType: 'keydown', targetId: 'delete-button', keyName: 'Tab', shiftKey: false, clientOffsetMs: 8 },
  { eventType: 'focusin', targetId: 'reason-input', clientOffsetMs: 9 },
  { eventType: 'keydown', targetId: 'reason-input', keyName: 'Tab', shiftKey: true, clientOffsetMs: 10 },
  { eventType: 'focusin', targetId: 'delete-button', clientOffsetMs: 11 },
  { eventType: 'keydown', targetId: 'delete-button', keyName: 'Escape', shiftKey: false, clientOffsetMs: 12 },
  { eventType: 'dialog_close', targetId: 'dialog-title', closeReason: 'escape', clientOffsetMs: 13 },
  { eventType: 'focus_return', targetId: 'delete-trigger', clientOffsetMs: 14 },
] as const;

test('migration preserves immutable legacy check labels and scopes canonical labels to Package 3', () => {
  const migration = readFileSync(
    new URL('../../drizzle/0003_package3_raw_observer_verifier.sql', import.meta.url),
    'utf8',
  );
  assert.match(
    migration,
    /SELECT c\.id, c\.workspace_id, c\.verification_receipt_id,\s+c\.behavior,/u,
  );
  assert.doesNotMatch(migration, /CASE c\.behavior/u);
  assert.match(
    migration,
    /r\.verifier_version = 'focus-event-verifier-v1'[\s\S]*NEW\.behavior NOT IN \(\s+'initialFocus', 'focusOrder', 'trapTab', 'trapShiftTab', 'escapeAction', 'returnFocus'/u,
  );
});

test('closed rehearsal schemas accept only bounded authority-free inputs', () => {
  assert.deepEqual(startRehearsalInputSchema.parse({ environment: 'browser' }), {
    environment: 'browser',
  });
  assert.throws(() =>
    startRehearsalInputSchema.parse({ environment: 'chatgpt' }),
  );
  assert.throws(() =>
    startRehearsalInputSchema.parse({ environment: 'browser', workspaceId: 'caller' }),
  );
  assert.deepEqual(renderedManifestSchema.parse(manifest), manifest);

  for (const invalid of [
    { ...manifest, value: 'sensitive-marker' },
    { ...manifest, dialogName: 'caller supplied text' },
    { ...manifest, targetIds: [...manifest.targetIds, 'body'] },
    { ...manifest, targetIds: [...manifest.targetIds, 'delete-trigger'] },
    { ...manifest, tabbableOrder: ['reason-input', 'reason-input'] },
    { ...manifest, selector: '#delete-button' },
  ]) {
    assert.equal(renderedManifestSchema.safeParse(invalid).success, false);
  }
});

test('event grammar rejects values, arbitrary keys/targets, client sequence, and bad unions', () => {
  const input = { manifest, events: completeEvents };
  assert.equal(finalizeRehearsalInputSchema.safeParse(input).success, true);
  const invalidEvents: unknown[] = [
    { ...events[1], value: 'sensitive-marker' },
    { ...events[1], targetId: 'body' },
    { ...events[2], keyName: 'Enter' },
    { ...events[2], sequence: 3 },
    { ...events[2], closeReason: 'escape' },
    { eventType: 'dialog_close', targetId: 'body', closeReason: 'escape', clientOffsetMs: 4 },
    { eventType: 'focus_return', targetId: 'body', clientOffsetMs: 5 },
  ];
  for (const invalid of invalidEvents) {
    assert.equal(
      observationEventSchema.safeParse(invalid).success,
      false,
    );
  }
});

test('server canonical forms have fixed order and explicit nullable event fields', () => {
  assert.equal(
    canonicalRenderedManifest(manifest),
    '{"manifestVersion":"focus-manifest-v1","targetIds":["delete-trigger","dialog-title","reason-input","cancel-button","delete-button"],"tabbableOrder":["reason-input","cancel-button","delete-button"],"dialogName":"Delete account","dialogDescription":"Deleting your account is permanent. You can optionally tell us why.","role":"dialog","ariaModal":true,"open":true,"variantId":"00000000-0000-4000-8000-000000000301","implementedRevision":1}',
  );
  assert.equal(
    canonicalObservationEvents(events),
    '[{"sequence":1,"eventType":"dialog_open","targetId":"delete-trigger","keyName":null,"shiftKey":null,"closeReason":null,"clientOffsetMs":0},{"sequence":2,"eventType":"focusin","targetId":"delete-button","keyName":null,"shiftKey":null,"closeReason":null,"clientOffsetMs":2},{"sequence":3,"eventType":"keydown","targetId":"delete-button","keyName":"Tab","shiftKey":false,"closeReason":null,"clientOffsetMs":3},{"sequence":4,"eventType":"focusin","targetId":"reason-input","keyName":null,"shiftKey":null,"closeReason":null,"clientOffsetMs":4},{"sequence":5,"eventType":"keydown","targetId":"reason-input","keyName":"Escape","shiftKey":false,"closeReason":null,"clientOffsetMs":5},{"sequence":6,"eventType":"dialog_close","targetId":"dialog-title","keyName":null,"shiftKey":null,"closeReason":"escape","clientOffsetMs":6},{"sequence":7,"eventType":"focus_return","targetId":"delete-trigger","keyName":null,"shiftKey":null,"closeReason":null,"clientOffsetMs":7}]',
  );
});

test('finalization enforces server-orderable monotonic bounds and complete outer shape', () => {
  assert.equal(
    finalizeRehearsalInputSchema.safeParse({ manifest, events: completeEvents }).success,
    true,
  );
  assert.equal(
    finalizeRehearsalInputSchema.safeParse({
      manifest,
      events: completeEvents.map((event, index) =>
        index === completeEvents.length - 1
          ? { ...event, targetId: 'dialog-title' }
          : event,
      ),
    }).success,
    true,
  );
  assert.equal(
    finalizeRehearsalInputSchema.safeParse({ manifest, events }).success,
    false,
  );
  assert.equal(finalizeRehearsalInputSchema.safeParse({ manifest, events: [] }).success, false);
  assert.equal(
    finalizeRehearsalInputSchema.safeParse({
      manifest,
      events: Array.from({ length: 65 }, () => events[0]),
    }).success,
    false,
  );
  assert.equal(
    finalizeRehearsalInputSchema.safeParse({
      manifest,
      events: [events[0], { ...events[1], clientOffsetMs: 30_001 }],
    }).success,
    false,
  );
  assert.equal(
    finalizeRehearsalInputSchema.safeParse({
      manifest,
      events: [events[0], { ...events[1], clientOffsetMs: 1 }, { ...events[2], clientOffsetMs: 0 }],
    }).success,
    false,
  );
  assert.equal(
    finalizeRehearsalInputSchema.safeParse({ manifest, events, expectedResult: 'pass' }).success,
    false,
  );
});
