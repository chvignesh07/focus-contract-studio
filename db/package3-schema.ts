import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const focusRehearsalCommits = sqliteTable('focus_rehearsal_commits', {
  sessionId: text('session_id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  variantId: text('variant_id').notNull(),
  implementedRevision: integer('implemented_revision').notNull(),
  manifestDigest: text('manifest_digest').notNull(),
  eventDigest: text('event_digest').notNull(),
  eventCount: integer('event_count').notNull(),
  finalizedAt: integer('finalized_at').notNull(),
});

export const verificationGuards = sqliteTable('verification_guards', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  observationSessionId: text('observation_session_id').notNull(),
  variantId: text('variant_id').notNull(),
  implementedRevision: integer('implemented_revision').notNull(),
  environment: text('environment').notNull(),
  verifierVersion: text('verifier_version').notNull(),
  result: text('result').notNull(),
  eventDigest: text('event_digest').notNull(),
  manifestDigest: text('manifest_digest').notNull(),
  activeAtVerification: integer('active_at_verification').notNull(),
  verifierOutputHash: text('verifier_output_hash').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const verificationCommits = sqliteTable('verification_commits', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  guardId: text('guard_id').notNull(),
  receiptId: text('receipt_id').notNull(),
  auditEventId: text('audit_event_id').notNull(),
  createdAt: integer('created_at').notNull(),
});
