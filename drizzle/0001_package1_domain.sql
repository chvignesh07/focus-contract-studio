-- Focus Contract Studio Package 1 domain spine.
-- Additive only: Package 0 probe tables may coexist in the same D1 database.

-- The Revision 2 focus configuration is a finite value object: four legal
-- initial targets times six permutations of the three tabbable targets. This
-- constant view lets D1 enforce both byte-canonical JSON and its SHA-256 hash
-- without relying on an unavailable or platform-specific SQL hash function.
CREATE VIEW fcs_focus_configuration_catalog_v2 AS
WITH configurations(initial_focus, focus_order_json, configuration_hash) AS (
  VALUES
    ('dialog-title', '[["reason-input","cancel-button","delete-button"]]', 'd02444d551725dbf11cd99856e07bf662a051c4d3f0005bae6b386d7033f5a45'),
    ('dialog-title', '[["reason-input","delete-button","cancel-button"]]', '9e63fb92384aeee6bdb600ceffd243766e23f42297e6addb1b8743ac4cf07e71'),
    ('dialog-title', '[["cancel-button","reason-input","delete-button"]]', '45d1397cb5af358706adfdf91cd6b8b9feecb41ea5e800a6cdbd3822a30e1bd1'),
    ('dialog-title', '[["cancel-button","delete-button","reason-input"]]', 'c80746ba0a084caac775adad4cd1adbb27928d072f940c45c5ea1124dce2d347'),
    ('dialog-title', '[["delete-button","reason-input","cancel-button"]]', '662b3150bda76c1f1cc1a8a340dcaa75260e3d05f502b0dfeefb6c8d47864cdf'),
    ('dialog-title', '[["delete-button","cancel-button","reason-input"]]', 'de73174a31933238c4595f2b4b26709106e22245e7d1330eb31b4b778ccb5270'),
    ('reason-input', '[["reason-input","cancel-button","delete-button"]]', 'b11e3bae328807f414d198cace87bf4eb90808a8ecada9f46bc448187611f709'),
    ('reason-input', '[["reason-input","delete-button","cancel-button"]]', 'e83ce05f3421c3fa7c78d0d588402277b20d454e4ed5ef6e9f37f790d96b721b'),
    ('reason-input', '[["cancel-button","reason-input","delete-button"]]', 'dc611c42ed781457dfa04d43bbf46f2de57b7a353902ff5abd6a981e1ac74ef0'),
    ('reason-input', '[["cancel-button","delete-button","reason-input"]]', 'd5878d92c2d5ac805262c0c2874ce5100ab46d4ebd1fcba573f5b9e0fd486ab3'),
    ('reason-input', '[["delete-button","reason-input","cancel-button"]]', '43fac46821ad6d8915ddf5f9f75ad18485af78897f737f328dbccd8cd4fa5903'),
    ('reason-input', '[["delete-button","cancel-button","reason-input"]]', '6e8aa596599da4f158e4b877beeb2fbbe6e2f10dc69980e4ca4456f9d12fb5e4'),
    ('cancel-button', '[["reason-input","cancel-button","delete-button"]]', 'b6bc505df6f2be8c8aaeb080a43c440d9ddbb58b6ca113a276316793ece7afcd'),
    ('cancel-button', '[["reason-input","delete-button","cancel-button"]]', '3ed47f8c8aa28a7cc540cbf1a200bb72084eefd3ca7bc094e7abd125b0aaffea'),
    ('cancel-button', '[["cancel-button","reason-input","delete-button"]]', '06cdc40682e564cde1367d2e3e278e224b5769ff1158eae872997d78b265e8d4'),
    ('cancel-button', '[["cancel-button","delete-button","reason-input"]]', '9cb8607917b8a0b14ce88ac6849105339444e953c5bb914e23478234b994cc27'),
    ('cancel-button', '[["delete-button","reason-input","cancel-button"]]', '5577e45eeccbdad62e696f6e3e39eb09ec544f10f3d9d09e2043ccea65c9f872'),
    ('cancel-button', '[["delete-button","cancel-button","reason-input"]]', '6c7170dd9d10502a050fdd30b3aea2031ef7924835f672b97f2e8c3c9c8799b0'),
    ('delete-button', '[["reason-input","cancel-button","delete-button"]]', '470a0491136de5ac58f3228bfc36115ef698568770e3d1e3195f0b6e78c196ff'),
    ('delete-button', '[["reason-input","delete-button","cancel-button"]]', '337826223ceab7547ba0d5603e9248eac7410612195f290eae85f6ddc4e585b1'),
    ('delete-button', '[["cancel-button","reason-input","delete-button"]]', '4a22373ccba612a030dd9dbde1ed257a14f41fa69b92e2a204592dc6afa7e743'),
    ('delete-button', '[["cancel-button","delete-button","reason-input"]]', '3c21105d5cef7fa8ca156538c8c46a138c9ab57f65001ac4e92aaa9543c7bf44'),
    ('delete-button', '[["delete-button","reason-input","cancel-button"]]', 'a3c13bb254ab26aa696dd056f716b445decad58014504a9cb5f1c8f2f3f1d645'),
    ('delete-button', '[["delete-button","cancel-button","reason-input"]]', 'a71b3bbe3a5058e98c6395c763b3dfc16221caed47604bcb10dd7bd7c37976f5')
)
SELECT
  '{"initialFocus":"' || initial_focus || '","focusOrder":' ||
    substr(focus_order_json, 2, length(focus_order_json) - 2) ||
    ',"trapTab":"wrap","trapShiftTab":"wrap","escapeAction":"close","returnFocus":"delete-trigger"}'
    AS configuration_json,
  configuration_hash
FROM configurations;
--> statement-breakpoint

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  subject_kind TEXT NOT NULL CHECK (subject_kind IN ('anonymous', 'signed')),
  subject_key TEXT NOT NULL CHECK (length(subject_key) = 64),
  csrf_digest TEXT NOT NULL CHECK (length(csrf_digest) = 64),
  generation INTEGER NOT NULL CHECK (generation >= 1),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  last_access_at INTEGER NOT NULL CHECK (last_access_at >= created_at),
  access_expires_at INTEGER NOT NULL CHECK (access_expires_at >= last_access_at),
  grace_expires_at INTEGER NOT NULL CHECK (grace_expires_at >= access_expires_at),
  purged_at INTEGER CHECK (purged_at IS NULL OR purged_at >= created_at),
  UNIQUE (id, generation)
) STRICT;
--> statement-breakpoint

CREATE UNIQUE INDEX idx_workspaces_subject_current
  ON workspaces(subject_kind, subject_key)
  WHERE purged_at IS NULL;
--> statement-breakpoint
CREATE INDEX idx_workspaces_subject_history
  ON workspaces(subject_kind, subject_key, purged_at);
--> statement-breakpoint
CREATE INDEX idx_workspaces_cleanup
  ON workspaces(subject_kind, grace_expires_at, id);
--> statement-breakpoint

CREATE TABLE component_variants (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  product TEXT NOT NULL CHECK (length(product) BETWEEN 1 AND 80),
  family TEXT NOT NULL CHECK (length(family) BETWEEN 1 AND 80),
  use_case TEXT NOT NULL CHECK (length(use_case) BETWEEN 1 AND 80),
  slug TEXT NOT NULL CHECK (length(slug) BETWEEN 1 AND 80),
  active_implemented_revision INTEGER NOT NULL CHECK (active_implemented_revision >= 1),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, id, active_implemented_revision)
    REFERENCES implemented_focus_revisions(workspace_id, variant_id, revision)
    DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (workspace_id, id),
  CHECK (slug = lower(slug))
) STRICT;
--> statement-breakpoint

CREATE UNIQUE INDEX idx_component_variants_workspace_slug
  ON component_variants(workspace_id, slug);
--> statement-breakpoint

CREATE TABLE workspace_view_state (
  workspace_id TEXT PRIMARY KEY NOT NULL,
  active_variant_id TEXT NOT NULL,
  view_revision INTEGER NOT NULL CHECK (view_revision >= 1),
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, active_variant_id)
    REFERENCES component_variants(workspace_id, id) ON DELETE CASCADE
) STRICT;
--> statement-breakpoint

CREATE TABLE implemented_focus_revisions (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  configuration_json TEXT NOT NULL CHECK (json_valid(configuration_json) AND length(configuration_json) <= 1024),
  configuration_hash TEXT NOT NULL CHECK (length(configuration_hash) = 64),
  parent_revision INTEGER CHECK (parent_revision IS NULL OR parent_revision >= 1),
  source_proposal_id TEXT CHECK (source_proposal_id IS NULL OR length(source_proposal_id) BETWEEN 32 AND 64),
  source_receipt_id TEXT CHECK (source_receipt_id IS NULL OR length(source_receipt_id) BETWEEN 32 AND 64),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  FOREIGN KEY (workspace_id, variant_id)
    REFERENCES component_variants(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, source_proposal_id)
    REFERENCES proposals(workspace_id, id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (workspace_id, source_receipt_id)
    REFERENCES application_receipts(workspace_id, id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (workspace_id, variant_id, parent_revision)
    REFERENCES implemented_focus_revisions(workspace_id, variant_id, revision)
    DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (workspace_id, id),
  CHECK ((revision = 1 AND parent_revision IS NULL) OR (revision > 1 AND parent_revision = revision - 1))
) STRICT;
--> statement-breakpoint

CREATE UNIQUE INDEX idx_focus_revisions_workspace_variant_revision
  ON implemented_focus_revisions(workspace_id, variant_id, revision);
--> statement-breakpoint

CREATE TRIGGER trg_focus_revision_configuration_insert
BEFORE INSERT ON implemented_focus_revisions
FOR EACH ROW
BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM fcs_focus_configuration_catalog_v2 c
     WHERE c.configuration_json = NEW.configuration_json
       AND c.configuration_hash = NEW.configuration_hash
  ) THEN RAISE(ABORT, 'FOCUS_CONFIGURATION_INVALID') END);
END;
--> statement-breakpoint

CREATE TRIGGER trg_variant_active_revision_update
BEFORE UPDATE OF active_implemented_revision ON component_variants
FOR EACH ROW
BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM implemented_focus_revisions r
    WHERE r.workspace_id = NEW.workspace_id
      AND r.variant_id = NEW.id
      AND r.revision = NEW.active_implemented_revision
  ) THEN RAISE(ABORT, 'ACTIVE_REVISION_NOT_FOUND') END);
  SELECT (CASE WHEN NEW.active_implemented_revision <> OLD.active_implemented_revision + 1
    THEN RAISE(ABORT, 'ACTIVE_REVISION_NOT_NEXT') END);
END;
--> statement-breakpoint

CREATE TABLE observation_sessions (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  implemented_revision INTEGER NOT NULL CHECK (implemented_revision >= 1),
  environment TEXT NOT NULL CHECK (environment IN ('browser', 'playwright', 'chatgpt')),
  nonce_digest TEXT NOT NULL CHECK (length(nonce_digest) = 64),
  state TEXT NOT NULL CHECK (state IN ('recording', 'finalized', 'verified_pass', 'verified_fail', 'expired')),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  expires_at INTEGER NOT NULL CHECK (expires_at >= created_at),
  finalized_at INTEGER CHECK (finalized_at IS NULL OR finalized_at >= created_at),
  event_digest TEXT CHECK (event_digest IS NULL OR length(event_digest) = 64),
  manifest_digest TEXT CHECK (manifest_digest IS NULL OR length(manifest_digest) = 64),
  FOREIGN KEY (workspace_id, variant_id, implemented_revision)
    REFERENCES implemented_focus_revisions(workspace_id, variant_id, revision) ON DELETE CASCADE,
  UNIQUE (workspace_id, id)
) STRICT;
--> statement-breakpoint

CREATE INDEX idx_observation_sessions_latest
  ON observation_sessions(workspace_id, variant_id, state, created_at DESC);
--> statement-breakpoint

CREATE TABLE rendered_manifests (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  manifest_version TEXT NOT NULL CHECK (manifest_version = 'focus-manifest-v1'),
  target_ids_json TEXT NOT NULL CHECK (json_valid(target_ids_json) AND length(target_ids_json) <= 512),
  tabbable_order_json TEXT NOT NULL CHECK (json_valid(tabbable_order_json) AND length(tabbable_order_json) <= 512),
  dialog_name TEXT NOT NULL CHECK (length(dialog_name) BETWEEN 1 AND 120),
  dialog_description TEXT NOT NULL CHECK (length(dialog_description) BETWEEN 1 AND 280),
  open_state INTEGER NOT NULL CHECK (open_state = 1),
  role TEXT NOT NULL CHECK (role = 'dialog'),
  aria_modal INTEGER NOT NULL CHECK (aria_modal IN (0, 1)),
  manifest_hash TEXT NOT NULL CHECK (length(manifest_hash) = 64),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  FOREIGN KEY (workspace_id, session_id)
    REFERENCES observation_sessions(workspace_id, id) ON DELETE CASCADE,
  UNIQUE (workspace_id, session_id),
  UNIQUE (session_id)
) STRICT;
--> statement-breakpoint

CREATE TABLE observation_events (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence BETWEEN 1 AND 64),
  event_type TEXT NOT NULL CHECK (event_type IN ('dialog_open', 'focusin', 'keydown', 'dialog_close', 'focus_return')),
  target_id TEXT NOT NULL CHECK (target_id IN ('dialog-title', 'reason-input', 'cancel-button', 'delete-button', 'delete-trigger')),
  key_name TEXT CHECK (key_name IS NULL OR key_name IN ('Tab', 'Escape')),
  shift_key INTEGER CHECK (shift_key IS NULL OR shift_key IN (0, 1)),
  close_reason TEXT CHECK (close_reason IS NULL OR close_reason IN ('escape', 'cancel', 'delete')),
  client_offset_ms INTEGER NOT NULL CHECK (client_offset_ms BETWEEN 0 AND 30000),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  FOREIGN KEY (workspace_id, session_id)
    REFERENCES observation_sessions(workspace_id, id) ON DELETE CASCADE,
  UNIQUE (workspace_id, session_id, sequence),
  UNIQUE (session_id, sequence),
  CHECK (
    (event_type = 'dialog_open' AND target_id = 'delete-trigger' AND key_name IS NULL AND shift_key IS NULL AND close_reason IS NULL) OR
    (event_type = 'focusin' AND key_name IS NULL AND shift_key IS NULL AND close_reason IS NULL) OR
    (event_type = 'keydown' AND key_name IN ('Tab', 'Escape') AND shift_key IS NOT NULL AND close_reason IS NULL) OR
    (event_type = 'dialog_close' AND key_name IS NULL AND shift_key IS NULL AND close_reason IS NOT NULL) OR
    (event_type = 'focus_return' AND target_id = 'delete-trigger' AND key_name IS NULL AND shift_key IS NULL AND close_reason IS NULL)
  )
) STRICT;
--> statement-breakpoint

CREATE INDEX idx_observation_events_session_sequence
  ON observation_events(workspace_id, session_id, sequence);
--> statement-breakpoint

CREATE TABLE precedent_records (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 1 AND 64),
  workspace_id TEXT NOT NULL,
  record_key TEXT NOT NULL CHECK (length(record_key) BETWEEN 1 AND 32),
  dataset_version TEXT NOT NULL CHECK (length(dataset_version) BETWEEN 1 AND 64),
  scope_kind TEXT NOT NULL CHECK (scope_kind IN ('context', 'variant', 'use_case', 'family')),
  scope_key TEXT NOT NULL CHECK (length(scope_key) BETWEEN 1 AND 120),
  behavior TEXT NOT NULL CHECK (behavior IN ('initial-focus', 'focus-order', 'forward-wrap', 'backward-wrap', 'escape', 'return-focus')),
  normalized_outcome_key TEXT NOT NULL CHECK (length(normalized_outcome_key) BETWEEN 1 AND 120),
  status TEXT NOT NULL CHECK (status IN ('active', 'superseded', 'quarantined', 'conflict')),
  valid_from INTEGER NOT NULL CHECK (valid_from >= 0),
  valid_until INTEGER CHECK (valid_until IS NULL OR valid_until > valid_from),
  rationale TEXT NOT NULL CHECK (length(rationale) BETWEEN 1 AND 320),
  tags_json TEXT NOT NULL CHECK (json_valid(tags_json) AND length(tags_json) <= 512),
  provenance_kind TEXT NOT NULL CHECK (provenance_kind IN ('synthetic-seed', 'verified-runtime')),
  provenance_ref TEXT NOT NULL CHECK (length(provenance_ref) BETWEEN 1 AND 120),
  immutable INTEGER NOT NULL DEFAULT 1 CHECK (immutable = 1),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, record_key)
) STRICT;
--> statement-breakpoint

CREATE INDEX idx_precedent_eligibility
  ON precedent_records(workspace_id, dataset_version, status, valid_from, behavior, valid_until, id);
--> statement-breakpoint
CREATE INDEX idx_precedent_exact_outcome
  ON precedent_records(workspace_id, behavior, normalized_outcome_key, status);
--> statement-breakpoint

CREATE TRIGGER trg_precedent_records_immutable_update
BEFORE UPDATE ON precedent_records
BEGIN
  SELECT RAISE(ABORT, 'PRECEDENT_IMMUTABLE');
END;
--> statement-breakpoint

CREATE TABLE precedent_subject_edges (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('context', 'variant', 'use_case', 'family')),
  target_key TEXT NOT NULL CHECK (length(target_key) BETWEEN 1 AND 120),
  edge_type TEXT NOT NULL CHECK (edge_type IN ('applies-to', 'derived-from')),
  weight INTEGER NOT NULL CHECK (weight BETWEEN 1 AND 1000),
  FOREIGN KEY (workspace_id, record_id)
    REFERENCES precedent_records(workspace_id, id) ON DELETE CASCADE,
  UNIQUE (workspace_id, record_id, target_kind, target_key, edge_type)
) STRICT;
--> statement-breakpoint

CREATE INDEX idx_precedent_edges_subject
  ON precedent_subject_edges(workspace_id, target_kind, target_key, record_id);
--> statement-breakpoint

CREATE TABLE precedent_lineage (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  from_record_id TEXT NOT NULL,
  to_record_id TEXT NOT NULL,
  relationship TEXT NOT NULL CHECK (relationship IN ('supersedes', 'confirms', 'conflicts')),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  FOREIGN KEY (workspace_id, from_record_id)
    REFERENCES precedent_records(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, to_record_id)
    REFERENCES precedent_records(workspace_id, id) ON DELETE CASCADE,
  UNIQUE (workspace_id, from_record_id, to_record_id, relationship),
  CHECK (from_record_id <> to_record_id)
) STRICT;
--> statement-breakpoint

CREATE INDEX idx_precedent_lineage_from
  ON precedent_lineage(workspace_id, from_record_id);
--> statement-breakpoint
CREATE INDEX idx_precedent_lineage_to
  ON precedent_lineage(workspace_id, to_record_id);
--> statement-breakpoint

CREATE TABLE retrieval_queries (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL CHECK (length(proposal_id) BETWEEN 32 AND 64),
  variant_id TEXT NOT NULL,
  implemented_revision INTEGER NOT NULL CHECK (implemented_revision >= 1),
  raw_context_json TEXT NOT NULL CHECK (json_valid(raw_context_json) AND length(raw_context_json) <= 2048),
  validated_context_json TEXT NOT NULL CHECK (json_valid(validated_context_json) AND length(validated_context_json) <= 2048),
  query_text TEXT NOT NULL CHECK (length(query_text) BETWEEN 1 AND 1024),
  algorithm_version TEXT NOT NULL CHECK (algorithm_version = 'fcs-rrf-v2'),
  prefilter_version TEXT NOT NULL CHECK (prefilter_version = 'fcs-eligibility-v2'),
  dataset_version TEXT NOT NULL CHECK (dataset_version = 'fcs-precedent-v2'),
  token_issued_at INTEGER NOT NULL CHECK (token_issued_at >= 0),
  as_of INTEGER NOT NULL CHECK (as_of = token_issued_at),
  context_digest TEXT NOT NULL CHECK (length(context_digest) = 64),
  result_digest TEXT NOT NULL CHECK (length(result_digest) = 64),
  created_at INTEGER NOT NULL CHECK (created_at >= token_issued_at),
  FOREIGN KEY (workspace_id, variant_id, implemented_revision)
    REFERENCES implemented_focus_revisions(workspace_id, variant_id, revision) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, proposal_id)
    REFERENCES proposals(workspace_id, id) DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, proposal_id),
  UNIQUE (workspace_id, context_digest, result_digest, proposal_id)
) STRICT;
--> statement-breakpoint

CREATE INDEX idx_retrieval_queries_workspace_proposal
  ON retrieval_queries(workspace_id, proposal_id);
--> statement-breakpoint

CREATE TABLE retrieval_results (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  query_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  eligibility_reason TEXT NOT NULL CHECK (length(eligibility_reason) BETWEEN 1 AND 160),
  lexical_rank INTEGER CHECK (lexical_rank IS NULL OR lexical_rank BETWEEN 1 AND 12),
  structured_rank INTEGER CHECK (structured_rank IS NULL OR structured_rank BETWEEN 1 AND 12),
  relationship_rank INTEGER CHECK (relationship_rank IS NULL OR relationship_rank BETWEEN 1 AND 12),
  lexical_contribution TEXT NOT NULL CHECK (length(lexical_contribution) BETWEEN 1 AND 64),
  structured_contribution TEXT NOT NULL CHECK (length(structured_contribution) BETWEEN 1 AND 64),
  relationship_contribution TEXT NOT NULL CHECK (length(relationship_contribution) BETWEEN 1 AND 64),
  structured_score INTEGER NOT NULL CHECK (structured_score BETWEEN 0 AND 1000),
  relationship_tier INTEGER NOT NULL CHECK (relationship_tier BETWEEN 0 AND 10),
  rrf_score TEXT NOT NULL CHECK (length(rrf_score) BETWEEN 1 AND 64),
  result_order INTEGER NOT NULL CHECK (result_order BETWEEN 1 AND 36),
  disposition TEXT NOT NULL CHECK (disposition IN ('support', 'conflict', 'excluded')),
  FOREIGN KEY (workspace_id, query_id)
    REFERENCES retrieval_queries(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, record_id)
    REFERENCES precedent_records(workspace_id, id) ON DELETE CASCADE,
  UNIQUE (workspace_id, query_id, record_id),
  UNIQUE (workspace_id, query_id, result_order)
) STRICT;
--> statement-breakpoint

CREATE INDEX idx_retrieval_results_query_order
  ON retrieval_results(workspace_id, query_id, result_order);
--> statement-breakpoint

CREATE TABLE proposals (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  base_implemented_revision INTEGER NOT NULL CHECK (base_implemented_revision >= 1),
  configuration_json TEXT NOT NULL CHECK (json_valid(configuration_json) AND length(configuration_json) <= 1024),
  evidence_query_id TEXT NOT NULL,
  evidence_record_ids_json TEXT NOT NULL CHECK (json_valid(evidence_record_ids_json) AND length(evidence_record_ids_json) <= 1024),
  support_map_json TEXT NOT NULL CHECK (json_valid(support_map_json) AND length(support_map_json) <= 2048),
  summary TEXT NOT NULL CHECK (length(summary) BETWEEN 1 AND 280),
  author_kind TEXT NOT NULL CHECK (author_kind IN ('agent', 'reviewer')),
  proposal_json TEXT NOT NULL CHECK (json_valid(proposal_json) AND length(proposal_json) <= 4096),
  proposal_hash TEXT NOT NULL CHECK (length(proposal_hash) = 64),
  parent_proposal_id TEXT CHECK (parent_proposal_id IS NULL OR length(parent_proposal_id) BETWEEN 32 AND 64),
  status TEXT NOT NULL CHECK (status IN ('proposed', 'superseded', 'approved', 'rejected', 'revoked', 'applied', 'stale')),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  FOREIGN KEY (workspace_id, variant_id, base_implemented_revision)
    REFERENCES implemented_focus_revisions(workspace_id, variant_id, revision) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, evidence_query_id)
    REFERENCES retrieval_queries(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, parent_proposal_id)
    REFERENCES proposals(workspace_id, id) DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, proposal_hash),
  CHECK (parent_proposal_id IS NULL OR parent_proposal_id <> id)
) STRICT;
--> statement-breakpoint

CREATE INDEX idx_proposals_workspace_variant_status
  ON proposals(workspace_id, variant_id, status, base_implemented_revision);
--> statement-breakpoint

CREATE TRIGGER trg_proposal_configuration_insert
BEFORE INSERT ON proposals
FOR EACH ROW
BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM fcs_focus_configuration_catalog_v2 c
     WHERE c.configuration_json = NEW.configuration_json
  ) THEN RAISE(ABORT, 'FOCUS_CONFIGURATION_INVALID') END);
END;
--> statement-breakpoint

CREATE TRIGGER trg_proposal_lineage_insert
BEFORE INSERT ON proposals
FOR EACH ROW
WHEN NEW.parent_proposal_id IS NOT NULL
BEGIN
  SELECT (CASE WHEN NEW.parent_proposal_id = NEW.id
    THEN RAISE(ABORT, 'PROPOSAL_LINEAGE_CYCLE') END);
  WITH RECURSIVE ancestors(id, parent_proposal_id) AS (
    SELECT id, parent_proposal_id
      FROM proposals
     WHERE workspace_id = NEW.workspace_id
       AND id = NEW.parent_proposal_id
    UNION
    SELECT p.id, p.parent_proposal_id
      FROM proposals p
      JOIN ancestors a
        ON p.workspace_id = NEW.workspace_id
       AND p.id = a.parent_proposal_id
  )
  SELECT (CASE WHEN EXISTS (
    SELECT 1 FROM ancestors
     WHERE id = NEW.id OR parent_proposal_id = NEW.id
  ) THEN RAISE(ABORT, 'PROPOSAL_LINEAGE_CYCLE') END);
END;
--> statement-breakpoint

CREATE TABLE proposal_evidence (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  query_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  changed_field TEXT NOT NULL CHECK (changed_field IN ('initialFocus', 'focusOrder', 'trapTab', 'trapShiftTab', 'escapeAction', 'returnFocus')),
  behavior TEXT NOT NULL CHECK (behavior IN ('initial-focus', 'focus-order', 'forward-wrap', 'backward-wrap', 'escape', 'return-focus')),
  normalized_outcome_key TEXT NOT NULL CHECK (length(normalized_outcome_key) BETWEEN 1 AND 120),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  FOREIGN KEY (workspace_id, proposal_id)
    REFERENCES proposals(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, query_id, record_id)
    REFERENCES retrieval_results(workspace_id, query_id, record_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, proposal_id, changed_field, record_id)
) STRICT;
--> statement-breakpoint

CREATE INDEX idx_proposal_evidence_workspace_proposal
  ON proposal_evidence(workspace_id, proposal_id);
--> statement-breakpoint

CREATE TABLE review_decisions (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  observation_session_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'revoke')),
  proposal_hash TEXT NOT NULL CHECK (length(proposal_hash) = 64),
  base_implemented_revision INTEGER NOT NULL CHECK (base_implemented_revision >= 1),
  reviewer_kind TEXT NOT NULL CHECK (reviewer_kind = 'ui-mediated'),
  reviewer_subject_digest TEXT NOT NULL CHECK (length(reviewer_subject_digest) = 64),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  FOREIGN KEY (workspace_id, proposal_id)
    REFERENCES proposals(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, observation_session_id)
    REFERENCES observation_sessions(workspace_id, id)
    DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (workspace_id, proposal_id, id)
) STRICT;
--> statement-breakpoint

CREATE INDEX idx_review_decisions_workspace_proposal_time
  ON review_decisions(workspace_id, proposal_id, created_at DESC);
--> statement-breakpoint

CREATE TABLE application_guards (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  from_revision INTEGER NOT NULL CHECK (from_revision >= 1),
  to_revision INTEGER NOT NULL CHECK (to_revision = from_revision + 1),
  proposal_hash TEXT NOT NULL CHECK (length(proposal_hash) = 64),
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 16 AND 128),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  FOREIGN KEY (workspace_id, proposal_id)
    REFERENCES proposals(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, variant_id)
    REFERENCES component_variants(workspace_id, id) ON DELETE CASCADE,
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, proposal_id),
  UNIQUE (workspace_id, variant_id, from_revision)
) STRICT;
--> statement-breakpoint

CREATE TABLE application_receipts (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  guard_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  proposal_hash TEXT NOT NULL CHECK (length(proposal_hash) = 64),
  from_revision INTEGER NOT NULL CHECK (from_revision >= 1),
  to_revision INTEGER NOT NULL CHECK (to_revision = from_revision + 1),
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 16 AND 128),
  result TEXT NOT NULL CHECK (result = 'applied'),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  FOREIGN KEY (workspace_id, guard_id)
    REFERENCES application_guards(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, proposal_id)
    REFERENCES proposals(workspace_id, id) ON DELETE CASCADE,
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, proposal_id),
  UNIQUE (workspace_id, idempotency_key)
) STRICT;
--> statement-breakpoint

CREATE TABLE application_commits (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  guard_id TEXT NOT NULL,
  receipt_id TEXT NOT NULL,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  FOREIGN KEY (workspace_id, guard_id)
    REFERENCES application_guards(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, receipt_id)
    REFERENCES application_receipts(workspace_id, id) ON DELETE CASCADE,
  UNIQUE (workspace_id, guard_id),
  UNIQUE (workspace_id, receipt_id)
) STRICT;
--> statement-breakpoint

CREATE TABLE verification_receipts (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  observation_session_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  implemented_revision INTEGER NOT NULL CHECK (implemented_revision >= 1),
  verifier_version TEXT NOT NULL CHECK (length(verifier_version) BETWEEN 1 AND 64),
  result TEXT NOT NULL CHECK (result IN ('pass', 'fail')),
  event_digest TEXT NOT NULL CHECK (length(event_digest) = 64),
  manifest_digest TEXT NOT NULL CHECK (length(manifest_digest) = 64),
  active_at_verification INTEGER NOT NULL CHECK (active_at_verification IN (0, 1)),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  FOREIGN KEY (workspace_id, observation_session_id)
    REFERENCES observation_sessions(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, variant_id, implemented_revision)
    REFERENCES implemented_focus_revisions(workspace_id, variant_id, revision) ON DELETE CASCADE,
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, observation_session_id, verifier_version),
  UNIQUE (observation_session_id, verifier_version)
) STRICT;
--> statement-breakpoint

CREATE TABLE verification_checks (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  verification_receipt_id TEXT NOT NULL,
  behavior TEXT NOT NULL CHECK (behavior IN ('initial-focus', 'focus-order', 'forward-wrap', 'backward-wrap', 'escape', 'return-focus')),
  result TEXT NOT NULL CHECK (result IN ('pass', 'fail', 'not_observed')),
  evidence_sequences_json TEXT NOT NULL CHECK (json_valid(evidence_sequences_json) AND length(evidence_sequences_json) <= 512),
  FOREIGN KEY (workspace_id, verification_receipt_id)
    REFERENCES verification_receipts(workspace_id, id) ON DELETE CASCADE,
  UNIQUE (workspace_id, verification_receipt_id, behavior)
) STRICT;
--> statement-breakpoint

CREATE TABLE idempotency_records (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('create_proposal', 'review_approve', 'review_reject', 'review_revoke', 'apply', 'undo', 'reset', 'verify')),
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 3 AND 128),
  request_hash TEXT NOT NULL CHECK (length(request_hash) = 64),
  state TEXT NOT NULL CHECK (state IN ('started', 'committed')),
  result_kind TEXT CHECK (result_kind IS NULL OR result_kind IN ('proposal', 'review', 'application', 'revision', 'workspace', 'verification')),
  result_id TEXT CHECK (result_id IS NULL OR length(result_id) BETWEEN 32 AND 64),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  expires_at INTEGER NOT NULL CHECK (expires_at >= created_at),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, id),
  CHECK ((state = 'started' AND result_kind IS NULL AND result_id IS NULL) OR
         (state = 'committed' AND result_kind IS NOT NULL AND result_id IS NOT NULL))
) STRICT;
--> statement-breakpoint

CREATE UNIQUE INDEX idx_idempotency_workspace_operation_key
  ON idempotency_records(workspace_id, operation, idempotency_key);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_idempotency_one_reset_per_workspace
  ON idempotency_records(workspace_id)
  WHERE operation = 'reset';
--> statement-breakpoint
CREATE INDEX idx_idempotency_expiry
  ON idempotency_records(workspace_id, operation, state, expires_at);
--> statement-breakpoint

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('system', 'browser', 'agent', 'reviewer')),
  action TEXT NOT NULL CHECK (length(action) BETWEEN 1 AND 80),
  target_kind TEXT NOT NULL CHECK (length(target_kind) BETWEEN 1 AND 40),
  target_id TEXT NOT NULL CHECK (length(target_id) BETWEEN 1 AND 64),
  result TEXT NOT NULL CHECK (result IN ('success', 'failure')),
  correlation_id TEXT NOT NULL CHECK (length(correlation_id) BETWEEN 16 AND 64),
  safe_detail_json TEXT NOT NULL CHECK (json_valid(safe_detail_json) AND length(safe_detail_json) <= 1024),
  occurred_at INTEGER NOT NULL CHECK (occurred_at >= 0),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, id)
) STRICT;
--> statement-breakpoint

CREATE INDEX idx_audit_workspace_target_time
  ON audit_events(workspace_id, target_kind, target_id, occurred_at DESC);
--> statement-breakpoint
CREATE INDEX idx_audit_workspace_time
  ON audit_events(workspace_id, occurred_at DESC);
--> statement-breakpoint

CREATE TABLE rate_limit_windows (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT,
  key_digest TEXT NOT NULL CHECK (length(key_digest) = 64),
  operation TEXT NOT NULL CHECK (length(operation) BETWEEN 1 AND 64),
  window_start INTEGER NOT NULL CHECK (window_start >= 0),
  window_seconds INTEGER NOT NULL CHECK (window_seconds BETWEEN 1 AND 86400),
  request_count INTEGER NOT NULL CHECK (request_count BETWEEN 0 AND 10000),
  expires_at INTEGER NOT NULL CHECK (expires_at >= window_start + window_seconds),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, key_digest, operation, window_start)
) STRICT;
--> statement-breakpoint

CREATE INDEX idx_rate_limit_expiry ON rate_limit_windows(expires_at);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_rate_limit_global_window
  ON rate_limit_windows(key_digest, operation, window_start)
  WHERE workspace_id IS NULL;
--> statement-breakpoint

CREATE TRIGGER trg_workspaces_identity_immutable
BEFORE UPDATE ON workspaces
WHEN NEW.id IS NOT OLD.id
  OR NEW.subject_kind IS NOT OLD.subject_kind
  OR NEW.subject_key IS NOT OLD.subject_key
  OR NEW.csrf_digest IS NOT OLD.csrf_digest
  OR NEW.generation IS NOT OLD.generation
  OR NEW.created_at IS NOT OLD.created_at
BEGIN SELECT RAISE(ABORT, 'WORKSPACE_IDENTITY_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_component_variants_identity_immutable
BEFORE UPDATE ON component_variants
WHEN NEW.id IS NOT OLD.id
  OR NEW.workspace_id IS NOT OLD.workspace_id
  OR NEW.product IS NOT OLD.product
  OR NEW.family IS NOT OLD.family
  OR NEW.use_case IS NOT OLD.use_case
  OR NEW.slug IS NOT OLD.slug
  OR NEW.created_at IS NOT OLD.created_at
BEGIN SELECT RAISE(ABORT, 'VARIANT_IDENTITY_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER trg_component_variants_immutable_delete
BEFORE DELETE ON component_variants
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'COMPONENT_VARIANTS_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_workspace_view_state_transition
BEFORE UPDATE ON workspace_view_state
WHEN NEW.workspace_id IS NOT OLD.workspace_id
  OR NEW.view_revision <> OLD.view_revision + 1
  OR NEW.updated_at < OLD.updated_at
BEGIN SELECT RAISE(ABORT, 'VIEW_REVISION_NOT_NEXT'); END;
--> statement-breakpoint
CREATE TRIGGER trg_workspace_view_state_immutable_delete
BEFORE DELETE ON workspace_view_state
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'WORKSPACE_VIEW_STATE_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_observation_sessions_transition
BEFORE UPDATE ON observation_sessions
BEGIN
  SELECT (CASE WHEN NEW.id IS NOT OLD.id
    OR NEW.workspace_id IS NOT OLD.workspace_id
    OR NEW.variant_id IS NOT OLD.variant_id
    OR NEW.implemented_revision IS NOT OLD.implemented_revision
    OR NEW.environment IS NOT OLD.environment
    OR NEW.nonce_digest IS NOT OLD.nonce_digest
    OR NEW.created_at IS NOT OLD.created_at
    OR NEW.expires_at IS NOT OLD.expires_at
    THEN RAISE(ABORT, 'OBSERVATION_PAYLOAD_IMMUTABLE') END);
  SELECT (CASE WHEN NOT (
    (OLD.state = 'recording' AND NEW.state IN ('finalized', 'expired')) OR
    (OLD.state = 'finalized' AND NEW.state IN ('verified_pass', 'verified_fail'))
  ) THEN RAISE(ABORT, 'OBSERVATION_TRANSITION_INVALID') END);
  SELECT (CASE WHEN NEW.state = 'finalized' AND (
    NEW.finalized_at IS NULL OR NEW.event_digest IS NULL OR NEW.manifest_digest IS NULL
  ) THEN RAISE(ABORT, 'OBSERVATION_FINALIZATION_INCOMPLETE') END);
  SELECT (CASE WHEN OLD.state = 'finalized' AND (
    NEW.finalized_at IS NOT OLD.finalized_at
    OR NEW.event_digest IS NOT OLD.event_digest
    OR NEW.manifest_digest IS NOT OLD.manifest_digest
  ) THEN RAISE(ABORT, 'OBSERVATION_FINALIZATION_IMMUTABLE') END);
  SELECT (CASE WHEN NEW.state = 'expired' AND (
    NEW.finalized_at IS NOT NULL OR NEW.event_digest IS NOT NULL OR NEW.manifest_digest IS NOT NULL
  ) THEN RAISE(ABORT, 'OBSERVATION_EXPIRY_INVALID') END);
END;
--> statement-breakpoint
CREATE TRIGGER trg_observation_sessions_immutable_delete
BEFORE DELETE ON observation_sessions
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'OBSERVATION_SESSIONS_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_proposals_transition
BEFORE UPDATE ON proposals
BEGIN
  SELECT (CASE WHEN NEW.id IS NOT OLD.id
    OR NEW.workspace_id IS NOT OLD.workspace_id
    OR NEW.variant_id IS NOT OLD.variant_id
    OR NEW.base_implemented_revision IS NOT OLD.base_implemented_revision
    OR NEW.configuration_json IS NOT OLD.configuration_json
    OR NEW.evidence_query_id IS NOT OLD.evidence_query_id
    OR NEW.evidence_record_ids_json IS NOT OLD.evidence_record_ids_json
    OR NEW.support_map_json IS NOT OLD.support_map_json
    OR NEW.summary IS NOT OLD.summary
    OR NEW.author_kind IS NOT OLD.author_kind
    OR NEW.proposal_json IS NOT OLD.proposal_json
    OR NEW.proposal_hash IS NOT OLD.proposal_hash
    OR NEW.parent_proposal_id IS NOT OLD.parent_proposal_id
    OR NEW.created_at IS NOT OLD.created_at
    THEN RAISE(ABORT, 'PROPOSAL_PAYLOAD_IMMUTABLE') END);
  SELECT (CASE WHEN NOT (
    (OLD.status = 'proposed' AND NEW.status IN ('superseded', 'approved', 'rejected', 'stale')) OR
    (OLD.status = 'approved' AND NEW.status IN ('revoked', 'applied', 'stale'))
  ) THEN RAISE(ABORT, 'PROPOSAL_TRANSITION_INVALID') END);
END;
--> statement-breakpoint
CREATE TRIGGER trg_proposals_immutable_delete
BEFORE DELETE ON proposals
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'PROPOSALS_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_idempotency_records_transition
BEFORE UPDATE ON idempotency_records
BEGIN
  SELECT (CASE WHEN NEW.id IS NOT OLD.id
    OR NEW.workspace_id IS NOT OLD.workspace_id
    OR NEW.operation IS NOT OLD.operation
    OR NEW.idempotency_key IS NOT OLD.idempotency_key
    OR NEW.request_hash IS NOT OLD.request_hash
    OR NEW.created_at IS NOT OLD.created_at
    OR NEW.expires_at IS NOT OLD.expires_at
    THEN RAISE(ABORT, 'IDEMPOTENCY_REQUEST_IMMUTABLE') END);
  SELECT (CASE WHEN NOT (OLD.state = 'started' AND NEW.state = 'committed')
    THEN RAISE(ABORT, 'IDEMPOTENCY_TRANSITION_INVALID') END);
END;
--> statement-breakpoint
CREATE TRIGGER trg_idempotency_records_immutable_delete
BEFORE DELETE ON idempotency_records
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'IDEMPOTENCY_RECORDS_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_rate_limit_windows_increment
BEFORE UPDATE ON rate_limit_windows
WHEN NEW.id IS NOT OLD.id
  OR NEW.workspace_id IS NOT OLD.workspace_id
  OR NEW.key_digest IS NOT OLD.key_digest
  OR NEW.operation IS NOT OLD.operation
  OR NEW.window_start IS NOT OLD.window_start
  OR NEW.window_seconds IS NOT OLD.window_seconds
  OR NEW.expires_at IS NOT OLD.expires_at
  OR NEW.request_count <> OLD.request_count + 1
BEGIN SELECT RAISE(ABORT, 'RATE_LIMIT_TRANSITION_INVALID'); END;
--> statement-breakpoint

CREATE TRIGGER trg_implemented_focus_revisions_immutable_update
BEFORE UPDATE ON implemented_focus_revisions
BEGIN SELECT RAISE(ABORT, 'IMPLEMENTED_FOCUS_REVISIONS_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER trg_implemented_focus_revisions_immutable_delete
BEFORE DELETE ON implemented_focus_revisions
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'IMPLEMENTED_FOCUS_REVISIONS_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_rendered_manifests_immutable_update
BEFORE UPDATE ON rendered_manifests
BEGIN SELECT RAISE(ABORT, 'RENDERED_MANIFESTS_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER trg_rendered_manifests_immutable_delete
BEFORE DELETE ON rendered_manifests
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'RENDERED_MANIFESTS_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_observation_events_immutable_update
BEFORE UPDATE ON observation_events
BEGIN SELECT RAISE(ABORT, 'OBSERVATION_EVENTS_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER trg_observation_events_immutable_delete
BEFORE DELETE ON observation_events
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'OBSERVATION_EVENTS_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_precedent_records_immutable_delete
BEFORE DELETE ON precedent_records
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'PRECEDENT_RECORDS_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_precedent_subject_edges_immutable_update
BEFORE UPDATE ON precedent_subject_edges
BEGIN SELECT RAISE(ABORT, 'PRECEDENT_SUBJECT_EDGES_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER trg_precedent_subject_edges_immutable_delete
BEFORE DELETE ON precedent_subject_edges
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'PRECEDENT_SUBJECT_EDGES_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_precedent_lineage_immutable_update
BEFORE UPDATE ON precedent_lineage
BEGIN SELECT RAISE(ABORT, 'PRECEDENT_LINEAGE_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER trg_precedent_lineage_immutable_delete
BEFORE DELETE ON precedent_lineage
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'PRECEDENT_LINEAGE_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_retrieval_queries_immutable_update
BEFORE UPDATE ON retrieval_queries
BEGIN SELECT RAISE(ABORT, 'RETRIEVAL_QUERIES_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER trg_retrieval_queries_immutable_delete
BEFORE DELETE ON retrieval_queries
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'RETRIEVAL_QUERIES_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_retrieval_results_immutable_update
BEFORE UPDATE ON retrieval_results
BEGIN SELECT RAISE(ABORT, 'RETRIEVAL_RESULTS_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER trg_retrieval_results_immutable_delete
BEFORE DELETE ON retrieval_results
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'RETRIEVAL_RESULTS_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_proposal_evidence_immutable_update
BEFORE UPDATE ON proposal_evidence
BEGIN SELECT RAISE(ABORT, 'PROPOSAL_EVIDENCE_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER trg_proposal_evidence_immutable_delete
BEFORE DELETE ON proposal_evidence
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'PROPOSAL_EVIDENCE_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_review_decisions_immutable_update
BEFORE UPDATE ON review_decisions
BEGIN SELECT RAISE(ABORT, 'REVIEW_DECISIONS_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER trg_review_decisions_immutable_delete
BEFORE DELETE ON review_decisions
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'REVIEW_DECISIONS_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_application_guards_immutable_update
BEFORE UPDATE ON application_guards
BEGIN SELECT RAISE(ABORT, 'APPLICATION_GUARDS_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER trg_application_guards_immutable_delete
BEFORE DELETE ON application_guards
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'APPLICATION_GUARDS_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_application_receipts_immutable_update
BEFORE UPDATE ON application_receipts
BEGIN SELECT RAISE(ABORT, 'APPLICATION_RECEIPTS_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER trg_application_receipts_immutable_delete
BEFORE DELETE ON application_receipts
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'APPLICATION_RECEIPTS_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_application_commits_immutable_update
BEFORE UPDATE ON application_commits
BEGIN SELECT RAISE(ABORT, 'APPLICATION_COMMITS_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER trg_application_commits_immutable_delete
BEFORE DELETE ON application_commits
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'APPLICATION_COMMITS_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_verification_receipts_immutable_update
BEFORE UPDATE ON verification_receipts
BEGIN SELECT RAISE(ABORT, 'VERIFICATION_RECEIPTS_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER trg_verification_receipts_immutable_delete
BEFORE DELETE ON verification_receipts
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'VERIFICATION_RECEIPTS_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_verification_checks_immutable_update
BEFORE UPDATE ON verification_checks
BEGIN SELECT RAISE(ABORT, 'VERIFICATION_CHECKS_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER trg_verification_checks_immutable_delete
BEFORE DELETE ON verification_checks
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'VERIFICATION_CHECKS_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_audit_events_immutable_update
BEFORE UPDATE ON audit_events
BEGIN SELECT RAISE(ABORT, 'AUDIT_EVENTS_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER trg_audit_events_immutable_delete
BEFORE DELETE ON audit_events
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'AUDIT_EVENTS_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_reset_commit_complete
BEFORE UPDATE OF state, result_kind, result_id ON idempotency_records
FOR EACH ROW
WHEN OLD.operation = 'reset' AND OLD.state = 'started' AND NEW.state = 'committed'
BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1
      FROM workspaces prior
      JOIN workspaces replacement
        ON replacement.id = NEW.result_id
       AND replacement.generation = prior.generation + 1
     WHERE prior.id = NEW.workspace_id
       AND prior.purged_at IS NOT NULL
       AND prior.access_expires_at = prior.purged_at
       AND prior.grace_expires_at > prior.purged_at
       AND NEW.result_kind = 'workspace'
       AND (SELECT COUNT(*) FROM component_variants v WHERE v.workspace_id = replacement.id) = 2
       AND (SELECT COUNT(*) FROM component_variants v
             WHERE v.workspace_id = replacement.id
               AND v.product = 'focus-contract-studio'
               AND v.family = 'modal-dialog'
               AND v.use_case = 'delete-account'
               AND v.slug IN ('delete-account-standard', 'delete-account-danger-emphasis')
               AND v.active_implemented_revision = 1) = 2
       AND (SELECT COUNT(*) FROM implemented_focus_revisions r
             WHERE r.workspace_id = replacement.id
               AND r.revision = 1
               AND json_extract(r.configuration_json, '$.initialFocus') = 'delete-button') = 2
       AND (SELECT COUNT(*) FROM workspace_view_state s
             JOIN component_variants v
               ON v.workspace_id = s.workspace_id AND v.id = s.active_variant_id
            WHERE s.workspace_id = replacement.id
              AND s.view_revision = 1
              AND v.slug = 'delete-account-standard') = 1
       AND (SELECT COUNT(*) FROM precedent_records p
             WHERE p.workspace_id = replacement.id
               AND p.record_key = 'D001'
               AND p.behavior = 'initial-focus'
               AND p.normalized_outcome_key = 'cancel-button'
               AND p.provenance_kind = 'synthetic-seed') = 1
       AND (SELECT COUNT(*) FROM precedent_subject_edges e
             JOIN precedent_records p
               ON p.workspace_id = e.workspace_id AND p.id = e.record_id
            WHERE e.workspace_id = replacement.id
              AND p.record_key = 'D001'
              AND e.target_kind = 'variant'
              AND e.target_key IN ('delete-account-standard', 'delete-account-danger-emphasis')
              AND e.edge_type = 'applies-to') = 2
  ) THEN RAISE(ABORT, 'RESET_INCOMPLETE') END);
END;
--> statement-breakpoint

CREATE TRIGGER trg_proposal_success_audit_finalizer
BEFORE INSERT ON audit_events
FOR EACH ROW
WHEN NEW.action = 'proposal.created' AND NEW.result = 'success'
BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1
    FROM proposals p
    JOIN retrieval_queries q
      ON q.workspace_id = p.workspace_id
     AND q.id = p.evidence_query_id
     AND q.proposal_id = p.id
    JOIN idempotency_records i
      ON i.workspace_id = p.workspace_id
     AND i.operation = 'create_proposal'
     AND i.state = 'committed'
     AND i.result_kind = 'proposal'
     AND i.result_id = p.id
    WHERE p.workspace_id = NEW.workspace_id
      AND p.id = NEW.target_id
      AND EXISTS (
        SELECT 1 FROM proposal_evidence e
        WHERE e.workspace_id = p.workspace_id
          AND e.proposal_id = p.id
          AND e.query_id = q.id
      )
  ) THEN RAISE(ABORT, 'PROPOSAL_INCOMPLETE') END);
END;
--> statement-breakpoint

CREATE TRIGGER trg_application_commit_complete
BEFORE INSERT ON application_commits
FOR EACH ROW
BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1
    FROM application_guards g
    JOIN application_receipts r
      ON r.workspace_id = g.workspace_id
     AND r.guard_id = g.id
     AND r.id = NEW.receipt_id
     AND r.proposal_id = g.proposal_id
     AND r.proposal_hash = g.proposal_hash
     AND r.from_revision = g.from_revision
     AND r.to_revision = g.to_revision
    JOIN proposals p
      ON p.workspace_id = g.workspace_id
     AND p.id = g.proposal_id
     AND p.status = 'applied'
    JOIN component_variants v
      ON v.workspace_id = g.workspace_id
     AND v.id = g.variant_id
     AND v.active_implemented_revision = g.to_revision
    JOIN implemented_focus_revisions f
      ON f.workspace_id = g.workspace_id
     AND f.variant_id = g.variant_id
     AND f.revision = g.to_revision
     AND f.source_proposal_id = g.proposal_id
     AND f.source_receipt_id = r.id
    JOIN idempotency_records i
      ON i.workspace_id = g.workspace_id
     AND i.operation = 'apply'
     AND i.state = 'committed'
     AND i.result_kind = 'application'
     AND i.result_id = r.id
    WHERE g.workspace_id = NEW.workspace_id
      AND g.id = NEW.guard_id
      AND EXISTS (
        SELECT 1 FROM audit_events a
        WHERE a.workspace_id = g.workspace_id
          AND a.action = 'application.applied'
          AND a.target_id = r.id
          AND a.result = 'success'
      )
  ) THEN RAISE(ABORT, 'APPLICATION_INCOMPLETE') END);
END;
