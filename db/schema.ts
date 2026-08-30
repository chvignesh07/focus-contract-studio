import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// The additive SQL migration is the enforcement authority. These declarations
// keep application reads typed and mirror every Revision 2 domain table.
export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(), subjectKind: text('subject_kind').notNull(),
  subjectKey: text('subject_key').notNull(), csrfDigest: text('csrf_digest').notNull(),
  generation: integer('generation').notNull(), createdAt: integer('created_at').notNull(),
  lastAccessAt: integer('last_access_at').notNull(), accessExpiresAt: integer('access_expires_at').notNull(),
  graceExpiresAt: integer('grace_expires_at').notNull(), purgedAt: integer('purged_at'),
});

export const componentVariants = sqliteTable('component_variants', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  product: text('product').notNull(), family: text('family').notNull(),
  useCase: text('use_case').notNull(), slug: text('slug').notNull(),
  activeImplementedRevision: integer('active_implemented_revision').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const workspaceViewState = sqliteTable('workspace_view_state', {
  workspaceId: text('workspace_id').primaryKey(), activeVariantId: text('active_variant_id').notNull(),
  viewRevision: integer('view_revision').notNull(), updatedAt: integer('updated_at').notNull(),
});

export const implementedFocusRevisions = sqliteTable('implemented_focus_revisions', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  variantId: text('variant_id').notNull(), revision: integer('revision').notNull(),
  configurationJson: text('configuration_json').notNull(), configurationHash: text('configuration_hash').notNull(),
  parentRevision: integer('parent_revision'), sourceProposalId: text('source_proposal_id'),
  sourceReceiptId: text('source_receipt_id'), createdAt: integer('created_at').notNull(),
});

export const observationSessions = sqliteTable('observation_sessions', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  variantId: text('variant_id').notNull(), implementedRevision: integer('implemented_revision').notNull(),
  environment: text('environment').notNull(), nonceDigest: text('nonce_digest').notNull(),
  state: text('state').notNull(), createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(), finalizedAt: integer('finalized_at'),
  eventDigest: text('event_digest'), manifestDigest: text('manifest_digest'),
});

export const renderedManifests = sqliteTable('rendered_manifests', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  sessionId: text('session_id').notNull(), manifestVersion: text('manifest_version').notNull(),
  targetIdsJson: text('target_ids_json').notNull(), tabbableOrderJson: text('tabbable_order_json').notNull(),
  dialogName: text('dialog_name').notNull(), dialogDescription: text('dialog_description').notNull(),
  openState: integer('open_state').notNull(),
  role: text('role').notNull(), ariaModal: integer('aria_modal').notNull(),
  manifestHash: text('manifest_hash').notNull(), createdAt: integer('created_at').notNull(),
});

export const observationEvents = sqliteTable('observation_events', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  sessionId: text('session_id').notNull(), sequence: integer('sequence').notNull(),
  eventType: text('event_type').notNull(), targetId: text('target_id').notNull(),
  keyName: text('key_name'), shiftKey: integer('shift_key'), closeReason: text('close_reason'),
  clientOffsetMs: integer('client_offset_ms').notNull(), createdAt: integer('created_at').notNull(),
});

export const precedentRecords = sqliteTable('precedent_records', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  recordKey: text('record_key').notNull(), datasetVersion: text('dataset_version').notNull(),
  scopeKind: text('scope_kind').notNull(), scopeKey: text('scope_key').notNull(),
  behavior: text('behavior').notNull(), normalizedOutcomeKey: text('normalized_outcome_key').notNull(),
  status: text('status').notNull(), validFrom: integer('valid_from').notNull(), validUntil: integer('valid_until'),
  rationale: text('rationale').notNull(), tagsJson: text('tags_json').notNull(),
  provenanceKind: text('provenance_kind').notNull(), provenanceRef: text('provenance_ref').notNull(),
  immutable: integer('immutable').notNull(), createdAt: integer('created_at').notNull(),
});

export const precedentSubjectEdges = sqliteTable('precedent_subject_edges', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  recordId: text('record_id').notNull(), targetKind: text('target_kind').notNull(),
  targetKey: text('target_key').notNull(), edgeType: text('edge_type').notNull(),
  weight: integer('weight').notNull(),
});

export const precedentLineage = sqliteTable('precedent_lineage', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  fromRecordId: text('from_record_id').notNull(), toRecordId: text('to_record_id').notNull(),
  relationship: text('relationship').notNull(), createdAt: integer('created_at').notNull(),
});

export const retrievalQueries = sqliteTable('retrieval_queries', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  proposalId: text('proposal_id').notNull(), variantId: text('variant_id').notNull(),
  implementedRevision: integer('implemented_revision').notNull(), rawContextJson: text('raw_context_json').notNull(),
  validatedContextJson: text('validated_context_json').notNull(), queryText: text('query_text').notNull(),
  algorithmVersion: text('algorithm_version').notNull(), prefilterVersion: text('prefilter_version').notNull(),
  datasetVersion: text('dataset_version').notNull(), tokenIssuedAt: integer('token_issued_at').notNull(),
  asOf: integer('as_of').notNull(), contextDigest: text('context_digest').notNull(),
  resultDigest: text('result_digest').notNull(), createdAt: integer('created_at').notNull(),
});

export const retrievalResults = sqliteTable('retrieval_results', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  queryId: text('query_id').notNull(), recordId: text('record_id').notNull(),
  eligibilityReason: text('eligibility_reason').notNull(), lexicalRank: integer('lexical_rank'),
  structuredRank: integer('structured_rank'), relationshipRank: integer('relationship_rank'),
  lexicalContribution: text('lexical_contribution').notNull(), structuredContribution: text('structured_contribution').notNull(),
  relationshipContribution: text('relationship_contribution').notNull(), structuredScore: integer('structured_score').notNull(),
  relationshipTier: integer('relationship_tier').notNull(), rrfScore: text('rrf_score').notNull(),
  resultOrder: integer('result_order').notNull(), disposition: text('disposition').notNull(),
});

export const proposals = sqliteTable('proposals', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  variantId: text('variant_id').notNull(), baseImplementedRevision: integer('base_implemented_revision').notNull(),
  configurationJson: text('configuration_json').notNull(), evidenceQueryId: text('evidence_query_id').notNull(),
  evidenceRecordIdsJson: text('evidence_record_ids_json').notNull(), supportMapJson: text('support_map_json').notNull(),
  summary: text('summary').notNull(), authorKind: text('author_kind').notNull(),
  proposalJson: text('proposal_json').notNull(), proposalHash: text('proposal_hash').notNull(),
  parentProposalId: text('parent_proposal_id'), status: text('status').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const proposalEvidence = sqliteTable('proposal_evidence', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  proposalId: text('proposal_id').notNull(), queryId: text('query_id').notNull(),
  recordId: text('record_id').notNull(), changedField: text('changed_field').notNull(),
  behavior: text('behavior').notNull(), normalizedOutcomeKey: text('normalized_outcome_key').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const reviewDecisions = sqliteTable('review_decisions', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  proposalId: text('proposal_id').notNull(), observationSessionId: text('observation_session_id'),
  action: text('action').notNull(), proposalHash: text('proposal_hash').notNull(),
  baseImplementedRevision: integer('base_implemented_revision').notNull(), reviewerKind: text('reviewer_kind').notNull(),
  reviewerSubjectDigest: text('reviewer_subject_digest').notNull(), createdAt: integer('created_at').notNull(),
});

export const applicationGuards = sqliteTable('application_guards', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  variantId: text('variant_id').notNull(), proposalId: text('proposal_id').notNull(),
  fromRevision: integer('from_revision').notNull(), toRevision: integer('to_revision').notNull(),
  proposalHash: text('proposal_hash').notNull(), idempotencyKey: text('idempotency_key').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const applicationReceipts = sqliteTable('application_receipts', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  guardId: text('guard_id').notNull(), proposalId: text('proposal_id').notNull(),
  proposalHash: text('proposal_hash').notNull(), fromRevision: integer('from_revision').notNull(),
  toRevision: integer('to_revision').notNull(), idempotencyKey: text('idempotency_key').notNull(),
  result: text('result').notNull(), createdAt: integer('created_at').notNull(),
});

export const applicationCommits = sqliteTable('application_commits', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  guardId: text('guard_id').notNull(), receiptId: text('receipt_id').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const verificationReceipts = sqliteTable('verification_receipts', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  observationSessionId: text('observation_session_id').notNull(), variantId: text('variant_id').notNull(),
  implementedRevision: integer('implemented_revision').notNull(), verifierVersion: text('verifier_version').notNull(),
  result: text('result').notNull(), eventDigest: text('event_digest').notNull(),
  manifestDigest: text('manifest_digest').notNull(), activeAtVerification: integer('active_at_verification').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const verificationChecks = sqliteTable('verification_checks', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  verificationReceiptId: text('verification_receipt_id').notNull(), behavior: text('behavior').notNull(),
  result: text('result').notNull(), evidenceSequencesJson: text('evidence_sequences_json').notNull(),
});

export const idempotencyRecords = sqliteTable('idempotency_records', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  operation: text('operation').notNull(), idempotencyKey: text('idempotency_key').notNull(),
  requestHash: text('request_hash').notNull(), state: text('state').notNull(),
  resultKind: text('result_kind'), resultId: text('result_id'),
  createdAt: integer('created_at').notNull(), expiresAt: integer('expires_at').notNull(),
});

export const auditEvents = sqliteTable('audit_events', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull(),
  actorKind: text('actor_kind').notNull(), action: text('action').notNull(),
  targetKind: text('target_kind').notNull(), targetId: text('target_id').notNull(),
  result: text('result').notNull(), correlationId: text('correlation_id').notNull(),
  safeDetailJson: text('safe_detail_json').notNull(), occurredAt: integer('occurred_at').notNull(),
});

export const rateLimitWindows = sqliteTable('rate_limit_windows', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id'),
  keyDigest: text('key_digest').notNull(), operation: text('operation').notNull(),
  windowStart: integer('window_start').notNull(), windowSeconds: integer('window_seconds').notNull(),
  requestCount: integer('request_count').notNull(), expiresAt: integer('expires_at').notNull(),
});
