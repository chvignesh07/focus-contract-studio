import assert from 'node:assert/strict';
import test from 'node:test';

import { REVISION_1_CONFIGURATION } from '../../lib/domain/focus-configuration.ts';
import {
  CHECK_BEHAVIORS,
  VERIFIER_VERSION,
  canonicalVerifierOutput,
  verifyFocusEvents,
  type VerifierInput,
} from '../../lib/domain/focus-event-verifier.ts';

const positiveInput: VerifierInput = {
  rehearsalSessionId: '00000000-0000-4000-8000-000000000401',
  workspaceId: '00000000-0000-4000-8000-000000000402',
  variantId: '00000000-0000-4000-8000-000000000403',
  implementedRevision: 1,
  environment: 'playwright',
  manifestDigest: 'a'.repeat(64),
  eventDigest: 'b'.repeat(64),
  configuration: REVISION_1_CONFIGURATION,
  manifest: {
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
    variantId: '00000000-0000-4000-8000-000000000403',
    implementedRevision: 1,
  },
  events: [
    { sequence: 1, eventType: 'dialog_open', targetId: 'delete-trigger', clientOffsetMs: 0 },
    { sequence: 2, eventType: 'focusin', targetId: 'delete-button', clientOffsetMs: 1 },
    { sequence: 3, eventType: 'keydown', targetId: 'delete-button', keyName: 'Tab', shiftKey: false, clientOffsetMs: 2 },
    { sequence: 4, eventType: 'focusin', targetId: 'reason-input', clientOffsetMs: 3 },
    { sequence: 5, eventType: 'keydown', targetId: 'reason-input', keyName: 'Tab', shiftKey: false, clientOffsetMs: 4 },
    { sequence: 6, eventType: 'focusin', targetId: 'cancel-button', clientOffsetMs: 5 },
    { sequence: 7, eventType: 'keydown', targetId: 'cancel-button', keyName: 'Tab', shiftKey: false, clientOffsetMs: 6 },
    { sequence: 8, eventType: 'focusin', targetId: 'delete-button', clientOffsetMs: 7 },
    { sequence: 9, eventType: 'keydown', targetId: 'delete-button', keyName: 'Tab', shiftKey: false, clientOffsetMs: 8 },
    { sequence: 10, eventType: 'focusin', targetId: 'reason-input', clientOffsetMs: 9 },
    { sequence: 11, eventType: 'keydown', targetId: 'reason-input', keyName: 'Tab', shiftKey: true, clientOffsetMs: 10 },
    { sequence: 12, eventType: 'focusin', targetId: 'delete-button', clientOffsetMs: 11 },
    { sequence: 13, eventType: 'keydown', targetId: 'delete-button', keyName: 'Escape', shiftKey: false, clientOffsetMs: 12 },
    { sequence: 14, eventType: 'dialog_close', targetId: 'dialog-title', closeReason: 'escape', clientOffsetMs: 13 },
    { sequence: 15, eventType: 'focus_return', targetId: 'delete-trigger', clientOffsetMs: 14 },
  ],
};

function clone(): VerifierInput {
  return structuredClone(positiveInput);
}

function resultFor(input: VerifierInput, behavior: (typeof CHECK_BEHAVIORS)[number]) {
  return verifyFocusEvents(input).checks.find((check) => check.behavior === behavior)!;
}

test('literal positive trace passes exactly six canonical raw-backed checks', () => {
  const before = JSON.stringify(positiveInput);
  const output = verifyFocusEvents(positiveInput);
  assert.equal(JSON.stringify(positiveInput), before);
  assert.equal(output.verifierVersion, VERIFIER_VERSION);
  assert.equal(output.overallResult, 'pass');
  assert.deepEqual(output.checks.map(({ behavior }) => behavior), CHECK_BEHAVIORS);
  assert.deepEqual(output.checks.map(({ result }) => result), Array(6).fill('pass'));
  for (const check of output.checks) {
    assert.ok(check.evidenceSequences.length > 0, check.behavior);
    assert.deepEqual(check.evidenceSequences, [...new Set(check.evidenceSequences)].sort((a, b) => a - b));
    assert.ok(check.evidenceSequences.every((sequence) => positiveInput.events.some((event) => event.sequence === sequence)));
  }
  assert.match(canonicalVerifierOutput(output), /^\{"verifierVersion":"focus-event-verifier-v1"/u);
});

test('each missing evidence boundary is not_observed and reduces overall to fail', () => {
  const cases: Array<{
    behavior: (typeof CHECK_BEHAVIORS)[number];
    remove: number[];
  }> = [
    { behavior: 'initialFocus', remove: [1, 2] },
    { behavior: 'focusOrder', remove: [7, 8] },
    { behavior: 'trapTab', remove: [3, 9] },
    { behavior: 'trapShiftTab', remove: [11] },
    { behavior: 'escapeAction', remove: [14] },
    { behavior: 'returnFocus', remove: [15] },
  ];
  for (const vector of cases) {
    const input = clone();
    input.events = input.events.filter((event) => !vector.remove.includes(event.sequence));
    const output = verifyFocusEvents(input);
    assert.equal(
      output.checks.find(({ behavior }) => behavior === vector.behavior)?.result,
      'not_observed',
      vector.behavior,
    );
    assert.equal(output.overallResult, 'fail', vector.behavior);
  }
});

test('P3-MUT-001 Delete first when Cancel is configured fails initialFocus only from raw evidence', () => {
  const input = clone();
  input.configuration = { ...input.configuration, initialFocus: 'cancel-button' };
  assert.equal(resultFor(input, 'initialFocus').result, 'fail');
});

test('P3-MUT-002 swapped Cancel/Delete traversal fails focusOrder', () => {
  const input = clone();
  input.events = input.events.map((event) =>
    event.sequence === 6 && event.eventType === 'focusin'
      ? { ...event, targetId: 'delete-button' }
      : event.sequence === 8 && event.eventType === 'focusin'
        ? { ...event, targetId: 'cancel-button' }
        : event,
  );
  assert.equal(resultFor(input, 'focusOrder').result, 'fail');
});

test('P3-MUT-003 omitted configured manifest target fails focusOrder', () => {
  const input = clone();
  input.manifest.targetIds = input.manifest.targetIds.filter(
    (target) => target !== 'cancel-button',
  );
  input.manifest.tabbableOrder = input.manifest.tabbableOrder.filter(
    (target) => target !== 'cancel-button',
  );
  assert.equal(resultFor(input, 'focusOrder').result, 'fail');
});

test('P3-MUT-004 forward Tab escape fails trapTab', () => {
  const input = clone();
  input.events = input.events.map((event) =>
    event.sequence === 4 ? { ...event, targetId: 'delete-trigger' } : event,
  ) as VerifierInput['events'];
  assert.equal(resultFor(input, 'trapTab').result, 'fail');
});

test('P3-MUT-005 backward Shift+Tab escape fails trapShiftTab', () => {
  const input = clone();
  input.events = input.events.map((event) =>
    event.sequence === 12 ? { ...event, targetId: 'delete-trigger' } : event,
  ) as VerifierInput['events'];
  assert.equal(resultFor(input, 'trapShiftTab').result, 'fail');
});

test('P3-MUT-006 destructive Escape close fails escapeAction', () => {
  const input = clone();
  input.events = input.events.map((event) =>
    event.sequence === 14 && event.eventType === 'dialog_close'
      ? { ...event, closeReason: 'delete' }
      : event,
  );
  assert.equal(resultFor(input, 'escapeAction').result, 'fail');
});

test('P3-MUT-007 close returning elsewhere fails returnFocus', () => {
  const input = clone();
  input.events = input.events.map((event) =>
    event.sequence === 15 ? { ...event, targetId: 'dialog-title' } : event,
  ) as VerifierInput['events'];
  assert.equal(resultFor(input, 'returnFocus').result, 'fail');
});

test('duplicate focus visit makes the claimed forward traversal fail', () => {
  const input = clone();
  input.events = [
    ...input.events.slice(0, 4),
    {
      sequence: 5,
      eventType: 'focusin',
      targetId: 'reason-input',
      clientOffsetMs: 4,
    },
    ...input.events.slice(4).map((event) => ({
      ...event,
      sequence: event.sequence + 1,
    })),
  ] as VerifierInput['events'];
  const output = verifyFocusEvents(input);
  assert.equal(resultFor(input, 'focusOrder').result, 'fail');
  assert.equal(output.overallResult, 'fail');
});

test('any destructive close in the Escape lifecycle makes escapeAction fail', () => {
  const input = clone();
  input.events = [
    ...input.events.slice(0, -1),
    {
      sequence: 15,
      eventType: 'dialog_close',
      targetId: 'dialog-title',
      closeReason: 'delete',
      clientOffsetMs: 14,
    },
    { ...input.events.at(-1)!, sequence: 16, clientOffsetMs: 15 },
  ];
  const output = verifyFocusEvents(input);
  assert.equal(resultFor(input, 'escapeAction').result, 'fail');
  assert.equal(output.overallResult, 'fail');
});

test('literal partial and contradictory traces cover every verifier decision branch', () => {
  const cases: Array<{
    behavior: (typeof CHECK_BEHAVIORS)[number];
    result: 'fail' | 'not_observed';
    mutate: (input: VerifierInput) => void;
  }> = [
    {
      behavior: 'initialFocus',
      result: 'not_observed',
      mutate: (input) => { input.events = [input.events[0]!]; },
    },
    {
      behavior: 'initialFocus',
      result: 'fail',
      mutate: (input) => {
        input.manifest.targetIds = input.manifest.targetIds.filter(
          (target) => target !== 'delete-button',
        );
      },
    },
    {
      behavior: 'focusOrder',
      result: 'fail',
      mutate: (input) => {
        input.manifest.tabbableOrder = [
          'reason-input',
          'cancel-button',
          'dialog-title',
        ];
      },
    },
    {
      behavior: 'focusOrder',
      result: 'fail',
      mutate: (input) => {
        input.manifest.tabbableOrder = [
          'reason-input',
          'reason-input',
          'delete-button',
        ];
      },
    },
    {
      behavior: 'focusOrder',
      result: 'fail',
      mutate: (input) => {
        input.manifest.tabbableOrder = [
          'reason-input',
          'reason-input',
          'delete-button',
        ];
        input.configuration = {
          ...input.configuration,
          focusOrder: ['reason-input', 'reason-input', 'delete-button'],
        };
      },
    },
    {
      behavior: 'focusOrder',
      result: 'not_observed',
      mutate: (input) => {
        input.events = input.events.filter(
          (event) => event.eventType !== 'focusin' || event.targetId !== 'reason-input',
        );
      },
    },
    {
      behavior: 'focusOrder',
      result: 'not_observed',
      mutate: (input) => {
        input.events = input.events.filter((event) => event.sequence !== 5);
      },
    },
    {
      behavior: 'focusOrder',
      result: 'not_observed',
      mutate: (input) => {
        input.events = input.events.filter(
          (event) => event.eventType !== 'focusin' || event.sequence <= 4,
        );
      },
    },
    {
      behavior: 'focusOrder',
      result: 'not_observed',
      mutate: (input) => {
        input.events = input.events.filter((event) => event.sequence <= 4);
      },
    },
    {
      behavior: 'focusOrder',
      result: 'not_observed',
      mutate: (input) => {
        input.events = input.events.filter((event) => event.sequence <= 5);
      },
    },
    {
      behavior: 'trapTab',
      result: 'not_observed',
      mutate: (input) => {
        input.events = input.events.filter(
          (event) => event.eventType !== 'focusin' || event.sequence <= 2,
        );
      },
    },
    {
      behavior: 'trapShiftTab',
      result: 'not_observed',
      mutate: (input) => {
        input.events = input.events.filter((event) => event.sequence !== 12);
      },
    },
    {
      behavior: 'escapeAction',
      result: 'not_observed',
      mutate: (input) => {
        input.events = input.events.filter((event) => event.sequence !== 13);
      },
    },
    {
      behavior: 'escapeAction',
      result: 'fail',
      mutate: (input) => {
        input.events = input.events.map((event) =>
          event.sequence === 14
            ? { sequence: 14, eventType: 'focusin', targetId: 'reason-input', clientOffsetMs: 13 }
            : event,
        ) as VerifierInput['events'];
      },
    },
    {
      behavior: 'escapeAction',
      result: 'fail',
      mutate: (input) => {
        input.events = input.events.map((event) =>
          event.sequence === 14 && event.eventType === 'dialog_close'
            ? { ...event, closeReason: 'cancel' }
            : event,
        );
      },
    },
    {
      behavior: 'returnFocus',
      result: 'not_observed',
      mutate: (input) => {
        input.events = input.events.filter((event) => event.sequence !== 14);
      },
    },
  ];
  for (const vector of cases) {
    const input = clone();
    vector.mutate(input);
    assert.equal(resultFor(input, vector.behavior).result, vector.result, vector.behavior);
  }
});
