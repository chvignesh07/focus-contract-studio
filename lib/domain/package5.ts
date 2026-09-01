import { z } from 'zod';

import { implementedFocusConfigurationSchema } from './focus-configuration.ts';

const idempotencyKey = z.uuid();
const revision = z.number().int().positive();
export const reviewerProposalRequestSchema = z.object({
  configuration: implementedFocusConfigurationSchema,
  summary: z.string().trim().min(1).max(280),
  responsibilityAccepted: z.literal(true),
  idempotencyKey,
}).strict();
export const reviewRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.enum(['approve', 'reject', 'revoke']),
    idempotencyKey,
  }).strict(),
  z.object({
    action: z.literal('edit'),
    idempotencyKey,
    configuration: implementedFocusConfigurationSchema,
    summary: z.string().trim().min(1).max(280),
  }).strict(),
]);

export const applyRequestSchema = z.object({
  proposalId: z.uuid(),
  expectedImplementedRevision: revision,
  idempotencyKey,
}).strict();

export const undoRequestSchema = z.object({
  restoreRevision: revision,
  expectedImplementedRevision: revision,
  idempotencyKey,
}).strict().refine(
  ({ restoreRevision, expectedImplementedRevision }) =>
    restoreRevision < expectedImplementedRevision,
  { message: 'The restored revision must precede the active revision.' },
);

export type ReviewRequest = z.infer<typeof reviewRequestSchema>;
export type ReviewerProposalRequest = z.infer<typeof reviewerProposalRequestSchema>;
export type ApplyRequest = z.infer<typeof applyRequestSchema>;
export type UndoRequest = z.infer<typeof undoRequestSchema>;

export function canonicalPackage5Request(
  operation: 'review' | 'reviewer_proposal' | 'apply' | 'undo',
  value: ReviewRequest | ReviewerProposalRequest | ApplyRequest | UndoRequest,
): string {
  return JSON.stringify({ operation, ...value });
}

type ProposalStatus =
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'revoked'
  | 'superseded'
  | 'applied'
  | 'stale';

export function transitionProposal(
  status: ProposalStatus,
  action: 'approve' | 'reject' | 'revoke',
): ProposalStatus {
  if (status === 'proposed' && action === 'approve') return 'approved';
  if (status === 'proposed' && action === 'reject') return 'rejected';
  if (status === 'approved' && action === 'revoke') return 'revoked';
  throw new Error('INVALID_PROPOSAL_TRANSITION');
}

export function assertExactBatch(
  results: D1Result[],
  expectedChanges: number[],
  operation: string,
): void {
  if (
    results.length !== expectedChanges.length ||
    results.some(
      (result, index) =>
        !result.success || result.meta.changes !== expectedChanges[index],
    )
  ) {
    throw new Error(`${operation} batch returned unexpected row counts.`);
  }
}

type RawHistoryRecord = Record<string, unknown> & {
  kind: string;
  id: string;
  occurredAt: number;
};

const allowedHistoryFields: Record<string, readonly string[]> = {
  proposal: ['kind', 'id', 'proposalDigest8', 'baseRevision', 'status', 'occurredAt'],
  decision: ['kind', 'id', 'proposalId', 'action', 'occurredAt'],
  application: ['kind', 'id', 'proposalId', 'fromRevision', 'toRevision', 'occurredAt'],
  verification: ['kind', 'id', 'revision', 'result', 'projected', 'occurredAt'],
  revision: ['kind', 'id', 'revision', 'source', 'occurredAt'],
  projection: ['kind', 'id', 'behavior', 'outcomeKey', 'occurredAt'],
  rehearsal: ['kind', 'id', 'revision', 'state', 'environment', 'occurredAt'],
  reset: ['kind', 'id', 'code', 'correlationId', 'occurredAt'],
  failure: ['kind', 'id', 'code', 'correlationId', 'occurredAt'],
};

export function historyRecords(
  records: RawHistoryRecord[],
  limit = 100,
): Record<string, unknown>[] {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
    throw new Error('INVALID_HISTORY_LIMIT');
  }
  return records
    .filter((record) => allowedHistoryFields[record.kind])
    .toSorted((left, right) =>
      left.occurredAt - right.occurredAt || left.id.localeCompare(right.id),
    )
    .slice(-limit)
    .map((record) => Object.fromEntries(
      allowedHistoryFields[record.kind]!.flatMap((field) =>
        field in record ? [[field, record[field]]] : [],
      ),
    ));
}
