import type { ImplementedFocusConfiguration } from './focus-configuration';
import type {
  RenderedManifest,
  SequencedObservationEvent,
} from './focus-rehearsal';

export const VERIFIER_VERSION = 'focus-event-verifier-v1' as const;
export const CHECK_BEHAVIORS = [
  'initialFocus',
  'focusOrder',
  'trapTab',
  'trapShiftTab',
  'escapeAction',
  'returnFocus',
] as const;

export type CheckBehavior = (typeof CHECK_BEHAVIORS)[number];
export type CheckResult = 'pass' | 'fail' | 'not_observed';
export type VerifierCheck = {
  behavior: CheckBehavior;
  result: CheckResult;
  evidenceSequences: number[];
};
export type VerifierOutput = {
  verifierVersion: typeof VERIFIER_VERSION;
  overallResult: 'pass' | 'fail';
  checks: VerifierCheck[];
};
export type VerifierInput = {
  rehearsalSessionId: string;
  workspaceId: string;
  variantId: string;
  implementedRevision: number;
  environment: 'browser' | 'playwright';
  manifestDigest: string;
  eventDigest: string;
  configuration: ImplementedFocusConfiguration;
  manifest: RenderedManifest;
  events: SequencedObservationEvent[];
};

type RawEvent = SequencedObservationEvent & { targetId: string };

function sequences(events: readonly RawEvent[]): number[] {
  return [...new Set(events.map(({ sequence }) => sequence))].sort((left, right) => left - right);
}

function check(
  behavior: CheckBehavior,
  result: CheckResult,
  evidence: readonly RawEvent[],
): VerifierCheck {
  return { behavior, result, evidenceSequences: sequences(evidence) };
}

function firstAfter(
  events: readonly RawEvent[],
  startIndex: number,
  predicate: (event: RawEvent) => boolean,
): { event: RawEvent; index: number } | null {
  for (let index = startIndex + 1; index < events.length; index += 1) {
    const event = events[index]!;
    if (predicate(event)) return { event, index };
  }
  return null;
}

function initialFocus(input: VerifierInput, events: readonly RawEvent[]): VerifierCheck {
  const open = events.findIndex(({ eventType }) => eventType === 'dialog_open');
  if (open === -1) return check('initialFocus', 'not_observed', []);
  const focus = firstAfter(events, open, ({ eventType }) => eventType === 'focusin');
  if (!focus) return check('initialFocus', 'not_observed', [events[open]!]);
  const passes =
    focus.event.targetId === input.configuration.initialFocus &&
    input.manifest.targetIds.includes(input.configuration.initialFocus);
  return check('initialFocus', passes ? 'pass' : 'fail', [events[open]!, focus.event]);
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value) => right.includes(value)) &&
    new Set(left).size === left.length
  );
}

function focusOrder(input: VerifierInput, events: readonly RawEvent[]): VerifierCheck {
  const focusEvidence = events.filter(({ eventType }) => eventType === 'focusin');
  if (!sameSet(input.manifest.tabbableOrder, input.configuration.focusOrder)) {
    return check('focusOrder', 'fail', focusEvidence);
  }
  const order = input.configuration.focusOrder;
  const startIndex = events.findIndex(
    (event) => event.eventType === 'focusin' && event.targetId === order[0],
  );
  if (startIndex === -1) return check('focusOrder', 'not_observed', []);
  const evidence: RawEvent[] = [events[startIndex]!];
  let currentIndex = startIndex;
  for (let orderIndex = 0; orderIndex < order.length - 1; orderIndex += 1) {
    const from = order[orderIndex]!;
    const to = order[orderIndex + 1]!;
    const interaction = firstAfter(
      events,
      currentIndex,
      (event) =>
        event.eventType === 'keydown' || event.eventType === 'focusin',
    );
    if (!interaction) return check('focusOrder', 'not_observed', evidence);
    evidence.push(interaction.event);
    if (
      interaction.event.eventType !== 'keydown' ||
      interaction.event.keyName !== 'Tab' ||
      interaction.event.shiftKey !== false ||
      interaction.event.targetId !== from
    ) {
      return check(
        'focusOrder',
        interaction.event.eventType === 'focusin' &&
          interaction.event.targetId === from
          ? 'fail'
          : 'not_observed',
        evidence,
      );
    }
    const focus = firstAfter(
      events,
      interaction.index,
      (event) => event.eventType === 'keydown' || event.eventType === 'focusin',
    );
    if (!focus) return check('focusOrder', 'not_observed', evidence);
    evidence.push(focus.event);
    if (focus.event.eventType !== 'focusin') {
      return check('focusOrder', 'not_observed', evidence);
    }
    if (focus.event.targetId !== to) {
      return check('focusOrder', 'fail', evidence);
    }
    currentIndex = focus.index;
  }
  return check('focusOrder', 'pass', evidence);
}

function tabBoundary(
  behavior: 'trapTab' | 'trapShiftTab',
  events: readonly RawEvent[],
  from: string,
  to: string,
  shiftKey: boolean,
): VerifierCheck {
  const keyIndex = events.findIndex(
    (event) =>
      event.eventType === 'keydown' &&
      event.keyName === 'Tab' &&
      event.shiftKey === shiftKey &&
      event.targetId === from,
  );
  if (keyIndex === -1) return check(behavior, 'not_observed', []);
  const focus = firstAfter(events, keyIndex, ({ eventType }) => eventType === 'focusin');
  if (!focus) return check(behavior, 'not_observed', [events[keyIndex]!]);
  return check(
    behavior,
    focus.event.targetId === to ? 'pass' : 'fail',
    [events[keyIndex]!, focus.event],
  );
}

function escapeAction(events: readonly RawEvent[]): VerifierCheck {
  const keyIndex = events.findIndex(
    (event) => event.eventType === 'keydown' && event.keyName === 'Escape',
  );
  if (keyIndex === -1) return check('escapeAction', 'not_observed', []);
  const destructive = events.find(
    (event) => event.eventType === 'dialog_close' && event.closeReason === 'delete',
  );
  if (destructive) {
    return check('escapeAction', 'fail', [events[keyIndex]!, destructive]);
  }
  const response = firstAfter(
    events,
    keyIndex,
    ({ eventType }) =>
      eventType === 'dialog_close' || eventType === 'focusin' || eventType === 'keydown',
  );
  if (!response) {
    return check('escapeAction', 'not_observed', [events[keyIndex]!]);
  }
  if (response.event.eventType !== 'dialog_close') {
    return check('escapeAction', 'fail', [events[keyIndex]!, response.event]);
  }
  const closeEvent = response.event as RawEvent & {
    eventType: 'dialog_close';
    closeReason: string;
  };
  return check(
    'escapeAction',
    closeEvent.closeReason === 'escape' ? 'pass' : 'fail',
    [events[keyIndex]!, closeEvent],
  );
}

function returnFocus(events: readonly RawEvent[]): VerifierCheck {
  const closeIndex = events.findIndex(({ eventType }) => eventType === 'dialog_close');
  if (closeIndex === -1) return check('returnFocus', 'not_observed', []);
  const returned = firstAfter(events, closeIndex, ({ eventType }) => eventType === 'focus_return');
  if (!returned) return check('returnFocus', 'not_observed', [events[closeIndex]!]);
  return check(
    'returnFocus',
    returned.event.targetId === 'delete-trigger' ? 'pass' : 'fail',
    [events[closeIndex]!, returned.event],
  );
}

export function verifyFocusEvents(input: VerifierInput): VerifierOutput {
  const events = input.events as RawEvent[];
  const first = input.configuration.focusOrder[0]!;
  const last = input.configuration.focusOrder.at(-1)!;
  const checks = [
    initialFocus(input, events),
    focusOrder(input, events),
    tabBoundary('trapTab', events, last, first, false),
    tabBoundary('trapShiftTab', events, first, last, true),
    escapeAction(events),
    returnFocus(events),
  ];
  return {
    verifierVersion: VERIFIER_VERSION,
    overallResult: checks.every(({ result }) => result === 'pass') ? 'pass' : 'fail',
    checks,
  };
}

export function canonicalVerifierOutput(output: VerifierOutput): string {
  return JSON.stringify({
    verifierVersion: output.verifierVersion,
    overallResult: output.overallResult,
    checks: output.checks.map((value) => ({
      behavior: value.behavior,
      result: value.result,
      evidenceSequences: value.evidenceSequences,
    })),
  });
}
