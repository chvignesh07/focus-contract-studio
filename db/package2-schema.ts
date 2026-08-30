import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Package 2 is additive to the published Revision 2 domain declarations in
// schema.ts. Keeping these tables separate preserves Package 1's frozen source
// proof while giving Package 2 repositories exact typed columns.
export const precedentRetrievalProfiles = sqliteTable(
  'precedent_retrieval_profiles',
  {
    recordId: text('record_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    product: text('product').notNull(),
    componentFamily: text('component_family').notNull(),
    useCase: text('use_case').notNull(),
    variantsJson: text('variants_json').notNull(),
    intent: text('intent').notNull(),
    risk: text('risk').notNull(),
    sourceStatus: text('source_status').notNull(),
    hostile: integer('hostile').notNull(),
    mismatchTagsJson: text('mismatch_tags_json').notNull(),
    shapeTagsJson: text('shape_tags_json').notNull(),
    relationshipsJson: text('relationships_json').notNull(),
    supersedesRecordKey: text('supersedes_record_key'),
  },
);

export const initialFocusObservationCommits = sqliteTable(
  'initial_focus_observation_commits',
  {
    sessionId: text('session_id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    firstTargetId: text('first_target_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
);
