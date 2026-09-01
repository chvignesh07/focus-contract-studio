import { z } from 'zod';

import {
  canonicalFocusConfiguration,
  implementedFocusConfigurationSchema,
  type ImplementedFocusConfiguration,
} from './focus-configuration.ts';
import { sha256Hex } from '../server/crypto.ts';

export const FOCUS_FIELDS = [
  'initialFocus',
  'focusOrder',
  'trapTab',
  'trapShiftTab',
  'escapeAction',
  'returnFocus',
] as const;

export type FocusField = (typeof FOCUS_FIELDS)[number];

export type FieldEvidenceSupport = {
  field: FocusField;
  recordId: string;
  behavior:
    | 'initial-focus'
    | 'focus-order'
    | 'forward-wrap'
    | 'backward-wrap'
    | 'escape'
    | 'return-focus';
  normalizedOutcomeKey: string;
};

const recordIdSchema = z.string().regex(/^[A-Z][0-9]{3}$/u);
const idempotencyKeySchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);

export const createProposalInputSchema = z
  .object({
    baseImplementedRevision: z.number().int().min(1).max(1_000_000),
    configuration: implementedFocusConfigurationSchema,
    evidenceQueryToken: z
      .string()
      .max(96)
      .regex(/^v1\.[0-9]{1,12}\.[A-Za-z0-9_-]{43}$/u),
    evidenceRecordIds: z
      .array(recordIdSchema)
      .min(1)
      .max(3)
      .refine((values) => new Set(values).size === values.length),
    summary: z.string().min(1).max(560),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export type CreateProposalInput = z.infer<typeof createProposalInputSchema>;

export function normalizeProposalSummary(value: string): string {
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
    throw new Error('Proposal summary contains a forbidden control character.');
  }
  const normalized = value.normalize('NFC').replace(/\s+/gu, ' ').trim();
  const length = Array.from(normalized).length;
  if (length < 1 || length > 280) {
    throw new Error('Proposal summary length is invalid.');
  }
  return normalized;
}

export function changedFocusFields(
  implemented: ImplementedFocusConfiguration,
  proposed: ImplementedFocusConfiguration,
): FocusField[] {
  const before = implementedFocusConfigurationSchema.parse(implemented);
  const after = implementedFocusConfigurationSchema.parse(proposed);
  return FOCUS_FIELDS.filter(
    (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
  );
}

export function supportRequirementForField(
  field: FocusField,
  configuration: ImplementedFocusConfiguration,
): Omit<FieldEvidenceSupport, 'field' | 'recordId'> {
  const value = implementedFocusConfigurationSchema.parse(configuration);
  switch (field) {
    case 'initialFocus':
      return {
        behavior: 'initial-focus',
        normalizedOutcomeKey: value.initialFocus,
      };
    case 'focusOrder':
      return {
        behavior: 'focus-order',
        normalizedOutcomeKey: value.focusOrder
          .map((target) => target.replace('-button', '').replace('-input', ''))
          .join('-'),
      };
    case 'trapTab':
      return { behavior: 'forward-wrap', normalizedOutcomeKey: 'wrap-first' };
    case 'trapShiftTab':
      return { behavior: 'backward-wrap', normalizedOutcomeKey: 'wrap-last' };
    case 'escapeAction':
      return { behavior: 'escape', normalizedOutcomeKey: value.escapeAction };
    case 'returnFocus':
      return {
        behavior: 'return-focus',
        normalizedOutcomeKey: value.returnFocus,
      };
  }
}

function canonicalConfiguration(
  configuration: ImplementedFocusConfiguration,
): ImplementedFocusConfiguration {
  return JSON.parse(
    canonicalFocusConfiguration(configuration),
  ) as ImplementedFocusConfiguration;
}

function canonicalCreatedAt(seconds: number): string {
  if (!Number.isSafeInteger(seconds) || seconds < 0) {
    throw new Error('Proposal time is invalid.');
  }
  return new Date(seconds * 1000).toISOString().replace('.000Z', 'Z');
}

export function canonicalProposalDocument(input: {
  variantId: string;
  baseImplementedRevision: number;
  configuration: ImplementedFocusConfiguration;
  evidenceQueryId: string;
  evidenceRecordIds: string[];
  fieldEvidence: FieldEvidenceSupport[];
  summary: string;
  createdAt: number;
  authorKind?: 'agent' | 'reviewer';
  pageSessionId?: string;
}): string {
  const authorKind = input.authorKind ?? 'agent';
  if (
    !/^[A-Za-z0-9_-]{1,64}$/u.test(input.variantId) ||
    !/^[A-Za-z0-9_-]{1,64}$/u.test(input.evidenceQueryId) ||
    !Number.isSafeInteger(input.baseImplementedRevision) ||
    input.baseImplementedRevision < 1 ||
    (authorKind === 'agent' && input.evidenceRecordIds.length < 1) ||
    input.evidenceRecordIds.length > 3 ||
    new Set(input.evidenceRecordIds).size !== input.evidenceRecordIds.length ||
    input.evidenceRecordIds.some((recordId) => !recordIdSchema.safeParse(recordId).success)
  ) {
    throw new Error('Canonical proposal input is invalid.');
  }
  const orderedEvidence = [...input.fieldEvidence].sort(
    (left, right) =>
      FOCUS_FIELDS.indexOf(left.field) - FOCUS_FIELDS.indexOf(right.field) ||
      left.recordId.localeCompare(right.recordId, 'en'),
  );
  if (
    (authorKind === 'agent' && orderedEvidence.length === 0) ||
    orderedEvidence.some(
      (entry) =>
        !FOCUS_FIELDS.includes(entry.field) ||
        !recordIdSchema.safeParse(entry.recordId).success ||
        entry.normalizedOutcomeKey.length < 1 ||
        entry.normalizedOutcomeKey.length > 120,
    )
  ) {
    throw new Error('Canonical proposal evidence is invalid.');
  }
  if (
    (authorKind === 'reviewer' &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
        input.pageSessionId ?? '',
      )) ||
    (authorKind === 'agent' && input.pageSessionId !== undefined)
  ) {
    throw new Error('Canonical proposal reviewer authority is invalid.');
  }
  const document = {
    schemaVersion: 1,
    variantId: input.variantId,
    baseImplementedRevision: input.baseImplementedRevision,
    configuration: canonicalConfiguration(input.configuration),
    evidenceQueryId: input.evidenceQueryId,
    evidenceRecordIds: input.evidenceRecordIds,
    fieldEvidence: orderedEvidence,
    summary: normalizeProposalSummary(input.summary),
    authorKind,
    ...(authorKind === 'reviewer' ? { pageSessionId: input.pageSessionId } : {}),
    status: 'proposed',
    createdAt: canonicalCreatedAt(input.createdAt),
  };
  return JSON.stringify(document);
}

export async function proposalDocumentHash(
  canonicalDocument: string,
): Promise<string> {
  return sha256Hex(canonicalDocument);
}

export function canonicalProposalRequest(input: CreateProposalInput): string {
  const value = createProposalInputSchema.parse(input);
  return JSON.stringify({
    baseImplementedRevision: value.baseImplementedRevision,
    configuration: canonicalConfiguration(value.configuration),
    evidenceQueryToken: value.evidenceQueryToken,
    evidenceRecordIds: [...value.evidenceRecordIds].sort((left, right) =>
      left.localeCompare(right, 'en'),
    ),
    summary: normalizeProposalSummary(value.summary),
  });
}
