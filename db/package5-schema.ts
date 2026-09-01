import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Package 1 freezes db/schema.ts as its historical exact-export contract.
// Package 5 additive declarations live here; numbered SQL remains authoritative.
export const reviewCommits = sqliteTable('review_commits', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  proposalId: text('proposal_id').notNull(), idempotencyId: text('idempotency_id').notNull(),
  decisionId: text('decision_id'), action: text('action').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const undoCommits = sqliteTable('undo_commits', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  variantId: text('variant_id').notNull(), idempotencyId: text('idempotency_id').notNull(),
  revisionId: text('revision_id').notNull(), fromRevision: integer('from_revision').notNull(),
  toRevision: integer('to_revision').notNull(), restoreRevision: integer('restore_revision').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const runtimePrecedentProvenance = sqliteTable('runtime_precedent_provenance', {
  recordId: text('record_id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  proposalId: text('proposal_id').notNull(), reviewDecisionId: text('review_decision_id').notNull(),
  applicationReceiptId: text('application_receipt_id').notNull(),
  verificationReceiptId: text('verification_receipt_id').notNull(),
  variantId: text('variant_id').notNull(), changedField: text('changed_field').notNull(),
  behavior: text('behavior').notNull(), normalizedOutcomeKey: text('normalized_outcome_key').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const precedentProjectionCommits = sqliteTable('precedent_projection_commits', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  verificationReceiptId: text('verification_receipt_id').notNull(),
  recordId: text('record_id').notNull(), createdAt: integer('created_at').notNull(),
});
