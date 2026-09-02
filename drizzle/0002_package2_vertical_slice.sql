-- Focus Contract Studio Package 2 retrieval profiles and fail-closed finalizers.
-- Additive migration: the published Package 1 migration remains immutable.

CREATE TABLE precedent_retrieval_profiles (
  record_id TEXT PRIMARY KEY NOT NULL CHECK (length(record_id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  product TEXT NOT NULL CHECK (length(product) BETWEEN 1 AND 80),
  component_family TEXT NOT NULL CHECK (length(component_family) BETWEEN 1 AND 80),
  use_case TEXT NOT NULL CHECK (length(use_case) BETWEEN 1 AND 80),
  variants_json TEXT NOT NULL CHECK (json_valid(variants_json) AND length(variants_json) <= 256),
  intent TEXT NOT NULL CHECK (length(intent) BETWEEN 1 AND 80),
  risk TEXT NOT NULL CHECK (length(risk) BETWEEN 1 AND 80),
  source_status TEXT NOT NULL CHECK (source_status IN ('active', 'superseded', 'rejected', 'quarantined')),
  hostile INTEGER NOT NULL CHECK (hostile IN (0, 1)),
  mismatch_tags_json TEXT NOT NULL CHECK (json_valid(mismatch_tags_json) AND length(mismatch_tags_json) <= 256),
  shape_tags_json TEXT NOT NULL CHECK (json_valid(shape_tags_json) AND length(shape_tags_json) <= 320),
  relationships_json TEXT NOT NULL CHECK (json_valid(relationships_json) AND length(relationships_json) <= 768),
  supersedes_record_key TEXT CHECK (supersedes_record_key IS NULL OR length(supersedes_record_key) BETWEEN 1 AND 32),
  FOREIGN KEY (workspace_id, record_id)
    REFERENCES precedent_records(workspace_id, id) ON DELETE CASCADE,
  UNIQUE (workspace_id, record_id)
) STRICT;
--> statement-breakpoint

CREATE INDEX idx_precedent_profiles_eligibility
  ON precedent_retrieval_profiles(
    workspace_id, product, component_family, use_case, intent, risk,
    source_status, hostile, record_id
  );
--> statement-breakpoint

CREATE TRIGGER trg_precedent_profiles_immutable_update
BEFORE UPDATE ON precedent_retrieval_profiles
BEGIN SELECT RAISE(ABORT, 'PRECEDENT_PROFILE_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_precedent_profiles_immutable_delete
BEFORE DELETE ON precedent_retrieval_profiles
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'PRECEDENT_PROFILE_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TABLE initial_focus_observation_commits (
  session_id TEXT PRIMARY KEY NOT NULL CHECK (length(session_id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  first_target_id TEXT NOT NULL CHECK (first_target_id IN ('dialog-title', 'reason-input', 'cancel-button', 'delete-button')),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  FOREIGN KEY (workspace_id, session_id)
    REFERENCES observation_sessions(workspace_id, id) ON DELETE CASCADE,
  UNIQUE (workspace_id, session_id)
) STRICT;
--> statement-breakpoint

-- A bounded Package 2 opening report is immutable and idempotent per active
-- implemented revision. Concurrent reporters may both begin as `recording`,
-- but only one can finalize; the losing transaction rolls back in full.
CREATE UNIQUE INDEX idx_initial_focus_one_report_per_revision
  ON observation_sessions(workspace_id, variant_id, implemented_revision)
  WHERE state IN ('finalized', 'verified_pass', 'verified_fail');
--> statement-breakpoint

CREATE TRIGGER trg_initial_focus_commit_complete
BEFORE INSERT ON initial_focus_observation_commits
BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1
      FROM observation_sessions s
      JOIN rendered_manifests m
        ON m.workspace_id = s.workspace_id AND m.session_id = s.id
     WHERE s.workspace_id = NEW.workspace_id
       AND s.id = NEW.session_id
       AND s.state = 'finalized'
       AND s.finalized_at IS NOT NULL
       AND s.event_digest IS NOT NULL
       AND s.manifest_digest = m.manifest_hash
       AND (SELECT COUNT(*) FROM observation_events e
             WHERE e.workspace_id = s.workspace_id AND e.session_id = s.id) = 2
       AND EXISTS (
         SELECT 1 FROM observation_events e
          WHERE e.workspace_id = s.workspace_id AND e.session_id = s.id
            AND e.sequence = 1 AND e.event_type = 'dialog_open'
            AND e.target_id = 'delete-trigger'
       )
       AND EXISTS (
         SELECT 1 FROM observation_events e
          WHERE e.workspace_id = s.workspace_id AND e.session_id = s.id
            AND e.sequence = 2 AND e.event_type = 'focusin'
            AND e.target_id = NEW.first_target_id
       )
  ) THEN RAISE(ABORT, 'INITIAL_FOCUS_OBSERVATION_INCOMPLETE') END);
END;
--> statement-breakpoint

CREATE TRIGGER trg_initial_focus_commits_immutable_update
BEFORE UPDATE ON initial_focus_observation_commits
BEGIN SELECT RAISE(ABORT, 'INITIAL_FOCUS_OBSERVATION_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_initial_focus_commits_immutable_delete
BEFORE DELETE ON initial_focus_observation_commits
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'INITIAL_FOCUS_OBSERVATION_IMMUTABLE'); END;
--> statement-breakpoint

-- A semantic duplicate under a fresh idempotency key must not create a second
-- simultaneously reviewable proposal for the same implemented revision.
CREATE UNIQUE INDEX idx_proposals_one_open_configuration
  ON proposals(
    workspace_id, variant_id, base_implemented_revision, configuration_json
  )
  WHERE status IN ('proposed', 'approved');
--> statement-breakpoint

-- Package 2 intentionally replaces the reset finalizer because the successor
-- seed graph expands from the Package 1 D001 subset to the sealed 34-record
-- workspace corpus. The immutable Package 1 migration itself is untouched.
DROP TRIGGER trg_reset_commit_complete;
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
             WHERE p.workspace_id = replacement.id) = 34
       AND (SELECT COUNT(*) FROM precedent_retrieval_profiles p
             WHERE p.workspace_id = replacement.id) = 34
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
              AND e.target_key = 'delete-account-standard'
              AND e.edge_type = 'applies-to') = 1
  ) THEN RAISE(ABORT, 'RESET_INCOMPLETE') END);
END;
--> statement-breakpoint

-- Package 2 intentionally strengthens the proposal audit finalizer. Keeping
-- the weaker Package 1 trigger under the same name is not possible, and the
-- replacement remains fail-closed throughout this single D1 migration.
DROP TRIGGER trg_proposal_success_audit_finalizer;
--> statement-breakpoint
CREATE TRIGGER trg_proposal_success_audit_finalizer
BEFORE INSERT ON audit_events
FOR EACH ROW
WHEN NEW.action = 'proposal.created' AND NEW.result = 'success'
BEGIN
  SELECT (CASE WHEN EXISTS (
    SELECT 1
      FROM proposals p
      JOIN implemented_focus_revisions base
        ON base.workspace_id = p.workspace_id
       AND base.variant_id = p.variant_id
       AND base.revision = p.base_implemented_revision
      JOIN proposal_evidence e
        ON e.workspace_id = p.workspace_id AND e.proposal_id = p.id
     WHERE p.workspace_id = NEW.workspace_id
       AND p.id = NEW.target_id
       AND CASE e.changed_field
         WHEN 'initialFocus' THEN
           json_extract(p.configuration_json, '$.initialFocus') =
             json_extract(base.configuration_json, '$.initialFocus')
         WHEN 'focusOrder' THEN
           json_extract(p.configuration_json, '$.focusOrder') =
             json_extract(base.configuration_json, '$.focusOrder')
         WHEN 'trapTab' THEN
           json_extract(p.configuration_json, '$.trapTab') =
             json_extract(base.configuration_json, '$.trapTab')
         WHEN 'trapShiftTab' THEN
           json_extract(p.configuration_json, '$.trapShiftTab') =
             json_extract(base.configuration_json, '$.trapShiftTab')
         WHEN 'escapeAction' THEN
           json_extract(p.configuration_json, '$.escapeAction') =
             json_extract(base.configuration_json, '$.escapeAction')
         WHEN 'returnFocus' THEN
           json_extract(p.configuration_json, '$.returnFocus') =
             json_extract(base.configuration_json, '$.returnFocus')
         ELSE 1
       END
  ) THEN RAISE(ABORT, 'EVIDENCE_FOR_UNCHANGED_FIELD') END);

  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1
      FROM proposals p
      JOIN retrieval_queries q
        ON q.workspace_id = p.workspace_id
       AND q.id = p.evidence_query_id
       AND q.proposal_id = p.id
      JOIN component_variants v
        ON v.workspace_id = p.workspace_id
       AND v.id = p.variant_id
       AND v.active_implemented_revision = p.base_implemented_revision
      JOIN implemented_focus_revisions base
        ON base.workspace_id = p.workspace_id
       AND base.variant_id = p.variant_id
       AND base.revision = p.base_implemented_revision
      JOIN idempotency_records i
        ON i.workspace_id = p.workspace_id
       AND i.operation = 'create_proposal'
       AND i.state = 'committed'
       AND i.result_kind = 'proposal'
       AND i.result_id = p.id
     WHERE p.workspace_id = NEW.workspace_id
       AND p.id = NEW.target_id
       AND p.status = 'proposed'
       AND p.author_kind = 'agent'
       AND NEW.actor_kind = 'agent'
       AND NEW.target_kind = 'proposal'
       AND q.algorithm_version = 'fcs-rrf-v2'
       AND q.prefilter_version = 'fcs-eligibility-v2'
       AND q.dataset_version = 'fcs-precedent-v2'
       AND q.as_of = q.token_issued_at
       AND json_type(p.evidence_record_ids_json) = 'array'
       AND json_array_length(p.evidence_record_ids_json) BETWEEN 1 AND 3
       AND (SELECT COUNT(*) FROM json_each(p.evidence_record_ids_json)) =
           (SELECT COUNT(DISTINCT cited.value)
              FROM json_each(p.evidence_record_ids_json) cited)
       AND NOT EXISTS (
         SELECT 1 FROM json_each(p.evidence_record_ids_json) cited
          WHERE cited.type <> 'text'
             OR cited.value NOT GLOB '[A-Z][0-9][0-9][0-9]'
       )
       AND json_type(p.support_map_json) = 'object'
       AND (SELECT COUNT(*) FROM json_each(p.support_map_json)) =
           (SELECT COUNT(*) FROM proposal_evidence e
             WHERE e.workspace_id = p.workspace_id AND e.proposal_id = p.id)
       AND (SELECT COUNT(DISTINCT e.changed_field) FROM proposal_evidence e
             WHERE e.workspace_id = p.workspace_id AND e.proposal_id = p.id) =
           (SELECT COUNT(*) FROM proposal_evidence e
             WHERE e.workspace_id = p.workspace_id AND e.proposal_id = p.id)
       AND NOT EXISTS (
         SELECT 1
           FROM json_each(p.support_map_json) support
          WHERE support.type <> 'text'
             OR NOT EXISTS (
               SELECT 1
                 FROM proposal_evidence e
                 JOIN precedent_records cited_record
                   ON cited_record.workspace_id = e.workspace_id
                  AND cited_record.id = e.record_id
                WHERE e.workspace_id = p.workspace_id
                  AND e.proposal_id = p.id
                  AND e.changed_field = support.key
                  AND cited_record.record_key = support.value
             )
       )
       AND NOT EXISTS (
         SELECT 1
           FROM proposal_evidence e
           JOIN retrieval_results rr
             ON rr.workspace_id = e.workspace_id
            AND rr.query_id = e.query_id
            AND rr.record_id = e.record_id
           JOIN precedent_records evidence_record
             ON evidence_record.workspace_id = e.workspace_id
            AND evidence_record.id = e.record_id
          WHERE e.workspace_id = p.workspace_id
            AND e.proposal_id = p.id
            AND (
              e.query_id <> q.id
              OR rr.result_order > 3
              OR rr.disposition <> 'support'
              OR evidence_record.status <> 'active'
              OR e.behavior <> evidence_record.behavior
              OR e.normalized_outcome_key <> evidence_record.normalized_outcome_key
              OR json_extract(p.support_map_json, '$.' || e.changed_field)
                   IS NOT evidence_record.record_key
              OR NOT EXISTS (
                SELECT 1 FROM json_each(p.evidence_record_ids_json) cited
                 WHERE cited.value = evidence_record.record_key
              )
            )
       )
       AND NOT EXISTS (
         SELECT 1 FROM json_each(p.evidence_record_ids_json) cited
          WHERE NOT EXISTS (
            SELECT 1
              FROM retrieval_results rr
              JOIN precedent_records cited_record
                ON cited_record.workspace_id = rr.workspace_id
               AND cited_record.id = rr.record_id
             WHERE rr.workspace_id = p.workspace_id
               AND rr.query_id = q.id
               AND cited_record.record_key = cited.value
               AND rr.result_order <= 3
               AND rr.disposition = 'support'
           )
       )
       AND json_extract(p.proposal_json, '$.schemaVersion') = 1
       AND json_extract(p.proposal_json, '$.baseImplementedRevision') =
           p.base_implemented_revision
       AND json_extract(p.proposal_json, '$.configuration') = json(p.configuration_json)
       AND json_extract(p.proposal_json, '$.evidenceRecordIds') =
           json(p.evidence_record_ids_json)
       AND json_extract(p.proposal_json, '$.authorKind') = 'agent'
       AND json_extract(p.proposal_json, '$.status') = 'proposed'
       AND (
         json_extract(p.configuration_json, '$.initialFocus') = json_extract(base.configuration_json, '$.initialFocus')
         OR EXISTS (
           SELECT 1 FROM proposal_evidence e
           JOIN retrieval_results rr
             ON rr.workspace_id = e.workspace_id AND rr.query_id = e.query_id AND rr.record_id = e.record_id
          WHERE e.workspace_id = p.workspace_id AND e.proposal_id = p.id AND e.query_id = q.id
            AND e.changed_field = 'initialFocus' AND e.behavior = 'initial-focus'
            AND e.normalized_outcome_key = json_extract(p.configuration_json, '$.initialFocus')
            AND rr.result_order <= 3 AND rr.disposition = 'support'
         )
       )
       AND (
         json_extract(p.configuration_json, '$.focusOrder') = json_extract(base.configuration_json, '$.focusOrder')
         OR EXISTS (
           SELECT 1 FROM proposal_evidence e
           JOIN retrieval_results rr
             ON rr.workspace_id = e.workspace_id AND rr.query_id = e.query_id AND rr.record_id = e.record_id
           WHERE e.workspace_id = p.workspace_id AND e.proposal_id = p.id AND e.query_id = q.id
             AND e.changed_field = 'focusOrder' AND e.behavior = 'focus-order'
             AND e.normalized_outcome_key =
               replace(replace(json_extract(p.configuration_json, '$.focusOrder[0]'), '-button', ''), '-input', '')
               || '-' ||
               replace(replace(json_extract(p.configuration_json, '$.focusOrder[1]'), '-button', ''), '-input', '')
               || '-' ||
               replace(replace(json_extract(p.configuration_json, '$.focusOrder[2]'), '-button', ''), '-input', '')
             AND rr.result_order <= 3 AND rr.disposition = 'support'
         )
       )
       AND (
         json_extract(p.configuration_json, '$.trapTab') = json_extract(base.configuration_json, '$.trapTab')
         OR EXISTS (
           SELECT 1 FROM proposal_evidence e
           JOIN retrieval_results rr
             ON rr.workspace_id = e.workspace_id AND rr.query_id = e.query_id AND rr.record_id = e.record_id
          WHERE e.workspace_id = p.workspace_id AND e.proposal_id = p.id AND e.query_id = q.id
            AND e.changed_field = 'trapTab' AND e.behavior = 'forward-wrap'
            AND e.normalized_outcome_key = 'wrap-first'
            AND rr.result_order <= 3 AND rr.disposition = 'support'
         )
       )
       AND (
         json_extract(p.configuration_json, '$.trapShiftTab') = json_extract(base.configuration_json, '$.trapShiftTab')
         OR EXISTS (
           SELECT 1 FROM proposal_evidence e
           JOIN retrieval_results rr
             ON rr.workspace_id = e.workspace_id AND rr.query_id = e.query_id AND rr.record_id = e.record_id
          WHERE e.workspace_id = p.workspace_id AND e.proposal_id = p.id AND e.query_id = q.id
            AND e.changed_field = 'trapShiftTab' AND e.behavior = 'backward-wrap'
            AND e.normalized_outcome_key = 'wrap-last'
            AND rr.result_order <= 3 AND rr.disposition = 'support'
         )
       )
       AND (
         json_extract(p.configuration_json, '$.escapeAction') = json_extract(base.configuration_json, '$.escapeAction')
         OR EXISTS (
           SELECT 1 FROM proposal_evidence e
           JOIN retrieval_results rr
             ON rr.workspace_id = e.workspace_id AND rr.query_id = e.query_id AND rr.record_id = e.record_id
          WHERE e.workspace_id = p.workspace_id AND e.proposal_id = p.id AND e.query_id = q.id
            AND e.changed_field = 'escapeAction' AND e.behavior = 'escape'
            AND e.normalized_outcome_key = json_extract(p.configuration_json, '$.escapeAction')
            AND rr.result_order <= 3 AND rr.disposition = 'support'
         )
       )
       AND (
         json_extract(p.configuration_json, '$.returnFocus') = json_extract(base.configuration_json, '$.returnFocus')
         OR EXISTS (
           SELECT 1 FROM proposal_evidence e
           JOIN retrieval_results rr
             ON rr.workspace_id = e.workspace_id AND rr.query_id = e.query_id AND rr.record_id = e.record_id
          WHERE e.workspace_id = p.workspace_id AND e.proposal_id = p.id AND e.query_id = q.id
            AND e.changed_field = 'returnFocus' AND e.behavior = 'return-focus'
            AND e.normalized_outcome_key = json_extract(p.configuration_json, '$.returnFocus')
            AND rr.result_order <= 3 AND rr.disposition = 'support'
         )
       )
  ) THEN RAISE(ABORT, 'PROPOSAL_INCOMPLETE') END);
END;
