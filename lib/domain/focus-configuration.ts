import { z } from 'zod';

export const focusTargetSchema = z.enum([
  'dialog-title',
  'reason-input',
  'cancel-button',
  'delete-button',
  'delete-trigger',
]);

export const implementedFocusConfigurationSchema = z
  .object({
    initialFocus: z.enum([
      'dialog-title',
      'reason-input',
      'cancel-button',
      'delete-button',
    ]),
    focusOrder: z
      .array(z.enum(['reason-input', 'cancel-button', 'delete-button']))
      .length(3),
    trapTab: z.literal('wrap'),
    trapShiftTab: z.literal('wrap'),
    escapeAction: z.literal('close'),
    returnFocus: z.literal('delete-trigger'),
  })
  .strict()
  .superRefine((configuration, context) => {
    if (new Set(configuration.focusOrder).size !== 3) {
      context.addIssue({
        code: 'custom',
        message: 'Each tabbable focus target must appear exactly once.',
        path: ['focusOrder'],
      });
    }
  });

export type ImplementedFocusConfiguration = z.infer<
  typeof implementedFocusConfigurationSchema
>;

export const REVISION_1_CONFIGURATION: ImplementedFocusConfiguration = {
  initialFocus: 'delete-button',
  focusOrder: ['reason-input', 'cancel-button', 'delete-button'],
  trapTab: 'wrap',
  trapShiftTab: 'wrap',
  escapeAction: 'close',
  returnFocus: 'delete-trigger',
};

export const CANCEL_CONFIGURATION: ImplementedFocusConfiguration = {
  ...REVISION_1_CONFIGURATION,
  initialFocus: 'cancel-button',
};

export function canonicalFocusConfiguration(
  configuration: ImplementedFocusConfiguration,
): string {
  const value = implementedFocusConfigurationSchema.parse(configuration);
  return JSON.stringify({
    initialFocus: value.initialFocus,
    focusOrder: value.focusOrder,
    trapTab: value.trapTab,
    trapShiftTab: value.trapShiftTab,
    escapeAction: value.escapeAction,
    returnFocus: value.returnFocus,
  });
}
