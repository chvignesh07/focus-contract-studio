import { z } from 'zod';

export const FOCUS_REHEARSAL_VERSION = 'focus-manifest-v1' as const;
export const MAX_REHEARSAL_EVENTS = 64;
export const MAX_REHEARSAL_OFFSET_MS = 30_000;

export const focusTargetIdSchema = z.enum([
  'dialog-title',
  'reason-input',
  'cancel-button',
  'delete-button',
]);
export const rehearsalTargetIdSchema = z.enum([
  'delete-trigger',
  ...focusTargetIdSchema.options,
]);

export const startRehearsalInputSchema = z
  .object({ environment: z.enum(['browser', 'playwright']) })
  .strict();
export const rehearsalSessionIdSchema = z.string().uuid();

export const renderedManifestSchema = z
  .object({
    manifestVersion: z.literal(FOCUS_REHEARSAL_VERSION),
    targetIds: z.array(rehearsalTargetIdSchema).min(2).max(5),
    tabbableOrder: z.array(focusTargetIdSchema).min(1).max(4),
    dialogName: z.literal('Delete account'),
    dialogDescription: z.literal(
      'Deleting your account is permanent. You can optionally tell us why.',
    ),
    role: z.literal('dialog'),
    ariaModal: z.literal(true),
    open: z.literal(true),
    variantId: z.string().uuid(),
    implementedRevision: z.number().int().min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.targetIds).size !== value.targetIds.length) {
      context.addIssue({ code: 'custom', path: ['targetIds'], message: 'Duplicate target.' });
    }
    if (
      !value.targetIds.includes('delete-trigger') ||
      !value.targetIds.includes('dialog-title')
    ) {
      context.addIssue({ code: 'custom', path: ['targetIds'], message: 'Required target absent.' });
    }
    if (new Set(value.tabbableOrder).size !== value.tabbableOrder.length) {
      context.addIssue({ code: 'custom', path: ['tabbableOrder'], message: 'Duplicate target.' });
    }
    if (value.tabbableOrder.some((target) => !value.targetIds.includes(target))) {
      context.addIssue({ code: 'custom', path: ['tabbableOrder'], message: 'Unknown target.' });
    }
  });

const clientOffsetMsSchema = z
  .number()
  .int()
  .min(0)
  .max(MAX_REHEARSAL_OFFSET_MS);

export const observationEventSchema = z.discriminatedUnion('eventType', [
  z
    .object({
      eventType: z.literal('dialog_open'),
      targetId: z.literal('delete-trigger'),
      clientOffsetMs: clientOffsetMsSchema,
    })
    .strict(),
  z
    .object({
      eventType: z.literal('focusin'),
      targetId: rehearsalTargetIdSchema,
      clientOffsetMs: clientOffsetMsSchema,
    })
    .strict(),
  z
    .object({
      eventType: z.literal('keydown'),
      targetId: focusTargetIdSchema,
      keyName: z.enum(['Tab', 'Escape']),
      shiftKey: z.boolean(),
      clientOffsetMs: clientOffsetMsSchema,
    })
    .strict(),
  z
    .object({
      eventType: z.literal('dialog_close'),
      targetId: z.literal('dialog-title'),
      closeReason: z.enum(['escape', 'cancel', 'delete']),
      clientOffsetMs: clientOffsetMsSchema,
    })
    .strict(),
  z
    .object({
      eventType: z.literal('focus_return'),
      targetId: rehearsalTargetIdSchema,
      clientOffsetMs: clientOffsetMsSchema,
    })
    .strict(),
]);

export const finalizeRehearsalInputSchema = z
  .object({
    manifest: renderedManifestSchema,
    events: z.array(observationEventSchema).min(1).max(MAX_REHEARSAL_EVENTS),
  })
  .strict()
  .superRefine((value, context) => {
    for (let index = 1; index < value.events.length; index += 1) {
      if (value.events[index]!.clientOffsetMs < value.events[index - 1]!.clientOffsetMs) {
        context.addIssue({
          code: 'custom',
          path: ['events', index, 'clientOffsetMs'],
          message: 'Offsets must be nondecreasing.',
        });
      }
    }
    const eventCount = (eventType: ObservationEvent['eventType']) =>
      value.events.filter((event) => event.eventType === eventType).length;
    const escapeIndex = value.events.findIndex(
      (event) => event.eventType === 'keydown' && event.keyName === 'Escape',
    );
    const closeIndex = value.events.findIndex(
      (event) => event.eventType === 'dialog_close',
    );
    const forwardTabs = value.events.filter(
      (event) =>
        event.eventType === 'keydown' &&
        event.keyName === 'Tab' &&
        event.shiftKey === false,
    );
    const backwardTabs = value.events.filter(
      (event) =>
        event.eventType === 'keydown' &&
        event.keyName === 'Tab' &&
        event.shiftKey === true,
    );
    const tabWithoutFocus = value.events.some(
      (event, index) =>
        event.eventType === 'keydown' &&
        event.keyName === 'Tab' &&
        value.events[index + 1]?.eventType !== 'focusin',
    );
    if (
      value.events[0]?.eventType !== 'dialog_open' ||
      value.events[1]?.eventType !== 'focusin' ||
      value.events.at(-1)?.eventType !== 'focus_return' ||
      eventCount('dialog_open') !== 1 ||
      eventCount('dialog_close') !== 1 ||
      eventCount('focus_return') !== 1 ||
      value.events.filter(
        (event) => event.eventType === 'keydown' && event.keyName === 'Escape',
      ).length !== 1 ||
      forwardTabs.length < value.manifest.tabbableOrder.length + 1 ||
      backwardTabs.length < 1 ||
      tabWithoutFocus ||
      escapeIndex === -1 ||
      closeIndex <= escapeIndex ||
      closeIndex !== value.events.length - 2
    ) {
      context.addIssue({
        code: 'custom',
        path: ['events'],
        message: 'The complete rehearsal lifecycle is missing or duplicated.',
      });
    }
  });

export type FocusTargetId = z.infer<typeof focusTargetIdSchema>;
export type RehearsalTargetId = z.infer<typeof rehearsalTargetIdSchema>;
export type RenderedManifest = z.infer<typeof renderedManifestSchema>;
export type ObservationEvent = z.infer<typeof observationEventSchema>;
export type SequencedObservationEvent = ObservationEvent & { sequence: number };
export type StartRehearsalInput = z.infer<typeof startRehearsalInputSchema>;
export type FinalizeRehearsalInput = z.infer<typeof finalizeRehearsalInputSchema>;

export function canonicalRenderedManifest(value: unknown): string {
  const manifest = renderedManifestSchema.parse(value);
  return JSON.stringify({
    manifestVersion: manifest.manifestVersion,
    targetIds: manifest.targetIds,
    tabbableOrder: manifest.tabbableOrder,
    dialogName: manifest.dialogName,
    dialogDescription: manifest.dialogDescription,
    role: manifest.role,
    ariaModal: manifest.ariaModal,
    open: manifest.open,
    variantId: manifest.variantId,
    implementedRevision: manifest.implementedRevision,
  });
}

export function sequenceObservationEvents(
  values: readonly ObservationEvent[],
): SequencedObservationEvent[] {
  const events = z.array(observationEventSchema).min(1).max(MAX_REHEARSAL_EVENTS).parse(values);
  return events.map((event, index) => ({ ...event, sequence: index + 1 }));
}

export function canonicalObservationEvents(
  values: readonly ObservationEvent[],
): string {
  return JSON.stringify(
    sequenceObservationEvents(values).map((event) => ({
      sequence: event.sequence,
      eventType: event.eventType,
      targetId: event.targetId,
      keyName: event.eventType === 'keydown' ? event.keyName : null,
      shiftKey: event.eventType === 'keydown' ? event.shiftKey : null,
      closeReason: event.eventType === 'dialog_close' ? event.closeReason : null,
      clientOffsetMs: event.clientOffsetMs,
    })),
  );
}
