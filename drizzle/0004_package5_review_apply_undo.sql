-- Focus Contract Studio Package 5 guarded review, undo, and projection finalizers.
-- Additive migration: Packages 1-3 remain immutable.

CREATE UNIQUE INDEX idx_review_decisions_workspace_id
  ON review_decisions(workspace_id, id);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_implemented_focus_revisions_workspace_id
  ON implemented_focus_revisions(workspace_id, id);
--> statement-breakpoint

-- Reviewer-authored novel proposals deliberately carry no supporting precedent.
-- They remain bound to a finalized page session and explicit UI responsibility.
DROP TRIGGER trg_proposal_success_audit_finalizer;
--> statement-breakpoint
CREATE TRIGGER trg_proposal_success_audit_finalizer
BEFORE INSERT ON audit_events
FOR EACH ROW
WHEN NEW.action = 'proposal.created' AND NEW.result = 'success'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
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
       AND (
         (p.author_kind = 'agent' AND EXISTS (
           SELECT 1 FROM proposal_evidence e
            WHERE e.workspace_id = p.workspace_id AND e.proposal_id = p.id
         )) OR
         (p.author_kind = 'reviewer'
          AND p.evidence_record_ids_json = '[]'
          AND p.support_map_json = '{}'
          AND json_extract(p.proposal_json, '$.authorKind') = 'reviewer'
          AND EXISTS (
            SELECT 1 FROM observation_sessions s
             WHERE s.workspace_id = p.workspace_id
               AND s.id = json_extract(p.proposal_json, '$.pageSessionId')
               AND s.variant_id = p.variant_id
               AND s.implemented_revision = p.base_implemented_revision
               AND s.state IN ('finalized', 'verified_pass', 'verified_fail')
          )
          AND NOT EXISTS (
            SELECT 1 FROM proposal_evidence e
             WHERE e.workspace_id = p.workspace_id AND e.proposal_id = p.id
          ))
       )
  ) THEN RAISE(ABORT, 'PROPOSAL_INCOMPLETE') END;
END;
--> statement-breakpoint

-- Package 5 strengthens the inherited apply finalizer so stale same-base
-- sibling projection is part of the atomic success relation.
DROP TRIGGER trg_application_commit_complete;
--> statement-breakpoint
CREATE TRIGGER trg_application_commit_complete
BEFORE INSERT ON application_commits
FOR EACH ROW
BEGIN
  SELECT CASE WHEN NOT EXISTS (
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
       AND NOT EXISTS (
         SELECT 1 FROM proposals sibling
          WHERE sibling.workspace_id = g.workspace_id
            AND sibling.variant_id = g.variant_id
            AND sibling.base_implemented_revision = g.from_revision
            AND sibling.id <> g.proposal_id
            AND sibling.status IN ('proposed', 'approved')
       )
       AND EXISTS (
         SELECT 1 FROM audit_events a
          WHERE a.workspace_id = g.workspace_id
            AND a.action = 'application.applied'
            AND a.target_id = r.id
            AND a.result = 'success'
       )
  ) THEN RAISE(ABORT, 'APPLICATION_INCOMPLETE') END;
END;
--> statement-breakpoint

CREATE TABLE review_commits (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  idempotency_id TEXT NOT NULL,
  decision_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'revoke', 'edit')),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  FOREIGN KEY (workspace_id, proposal_id)
    REFERENCES proposals(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, idempotency_id)
    REFERENCES idempotency_records(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, decision_id)
    REFERENCES review_decisions(workspace_id, id) ON DELETE CASCADE,
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, idempotency_id),
  UNIQUE (workspace_id, decision_id),
  CHECK ((action = 'edit' AND decision_id IS NULL) OR
         (action <> 'edit' AND decision_id IS NOT NULL))
) STRICT;
--> statement-breakpoint

CREATE TRIGGER trg_review_commit_complete
BEFORE INSERT ON review_commits
FOR EACH ROW
BEGIN
  SELECT CASE WHEN NEW.action <> 'edit' AND NOT EXISTS (
    SELECT 1
      FROM proposals p
      JOIN review_decisions d
        ON d.workspace_id = p.workspace_id
       AND d.proposal_id = p.id
       AND d.id = NEW.decision_id
       AND d.action = NEW.action
       AND d.proposal_hash = p.proposal_hash
       AND d.base_implemented_revision = p.base_implemented_revision
       AND d.reviewer_kind = 'ui-mediated'
       AND d.observation_session_id IS NOT NULL
      JOIN observation_sessions s
        ON s.workspace_id = d.workspace_id
       AND s.id = d.observation_session_id
       AND s.variant_id = p.variant_id
       AND s.implemented_revision = p.base_implemented_revision
       AND s.state IN ('finalized', 'verified_pass', 'verified_fail')
      JOIN idempotency_records i
        ON i.workspace_id = p.workspace_id
       AND i.id = NEW.idempotency_id
       AND i.operation = 'review_' || NEW.action
       AND i.state = 'committed'
       AND i.result_kind = 'review'
       AND i.result_id = d.id
     WHERE p.workspace_id = NEW.workspace_id
       AND p.id = NEW.proposal_id
       AND p.status = CASE NEW.action
         WHEN 'approve' THEN 'approved'
         WHEN 'reject' THEN 'rejected'
         WHEN 'revoke' THEN 'revoked'
       END
       AND NOT EXISTS (
         SELECT 1 FROM review_decisions later
          WHERE later.workspace_id = d.workspace_id
            AND later.proposal_id = d.proposal_id
            AND (later.created_at > d.created_at OR
                 (later.created_at = d.created_at AND later.id > d.id))
       )
       AND EXISTS (
         SELECT 1 FROM audit_events a
          WHERE a.workspace_id = p.workspace_id
            AND a.action = 'review.' || NEW.action
            AND a.target_kind = 'review'
            AND a.target_id = d.id
            AND a.result = 'success'
       )
  ) THEN RAISE(ABORT, 'REVIEW_INCOMPLETE') END;

  SELECT CASE WHEN NEW.action = 'edit' AND NOT EXISTS (
    SELECT 1
      FROM proposals child
      JOIN proposals parent
        ON parent.workspace_id = child.workspace_id
       AND parent.id = child.parent_proposal_id
       AND parent.variant_id = child.variant_id
       AND parent.base_implemented_revision = child.base_implemented_revision
       AND parent.status = 'superseded'
      JOIN idempotency_records i
        ON i.workspace_id = child.workspace_id
       AND i.id = NEW.idempotency_id
       AND i.operation = 'create_proposal'
       AND i.state = 'committed'
       AND i.result_kind = 'proposal'
       AND i.result_id = child.id
     WHERE child.workspace_id = NEW.workspace_id
       AND child.id = NEW.proposal_id
       AND child.author_kind = 'reviewer'
       AND child.status = 'proposed'
       AND child.evidence_query_id = parent.evidence_query_id
       AND child.configuration_json <> parent.configuration_json
       AND child.evidence_record_ids_json = '[]'
       AND child.support_map_json = '{}'
       AND NOT EXISTS (
         SELECT 1 FROM proposal_evidence ce
          WHERE ce.workspace_id = child.workspace_id AND ce.proposal_id = child.id
       )
       AND EXISTS (
         SELECT 1 FROM observation_sessions s
          WHERE s.workspace_id = child.workspace_id
            AND s.id = json_extract(child.proposal_json, '$.pageSessionId')
            AND s.variant_id = child.variant_id
            AND s.implemented_revision = child.base_implemented_revision
            AND s.state IN ('finalized', 'verified_pass', 'verified_fail')
       )
       AND EXISTS (
         SELECT 1 FROM audit_events a
          WHERE a.workspace_id = child.workspace_id
            AND a.action = 'proposal.edited'
            AND a.target_kind = 'proposal'
            AND a.target_id = child.id
            AND a.result = 'success'
       )
  ) THEN RAISE(ABORT, 'REVIEW_EDIT_INCOMPLETE') END;
END;
--> statement-breakpoint

CREATE TRIGGER trg_review_commits_immutable_update
BEFORE UPDATE ON review_commits
BEGIN SELECT RAISE(ABORT, 'REVIEW_COMMITS_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_review_commits_immutable_delete
BEFORE DELETE ON review_commits
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'REVIEW_COMMITS_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TABLE undo_commits (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  idempotency_id TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  from_revision INTEGER NOT NULL CHECK (from_revision >= 2),
  to_revision INTEGER NOT NULL CHECK (to_revision = from_revision + 1),
  restore_revision INTEGER NOT NULL CHECK (restore_revision >= 1 AND restore_revision < from_revision),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  FOREIGN KEY (workspace_id, variant_id)
    REFERENCES component_variants(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, idempotency_id)
    REFERENCES idempotency_records(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, revision_id)
    REFERENCES implemented_focus_revisions(workspace_id, id) ON DELETE CASCADE,
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, idempotency_id),
  UNIQUE (workspace_id, variant_id, from_revision)
) STRICT;
--> statement-breakpoint

CREATE TRIGGER trg_undo_commit_complete
BEFORE INSERT ON undo_commits
FOR EACH ROW
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
      FROM component_variants v
      JOIN implemented_focus_revisions created
        ON created.workspace_id = v.workspace_id
       AND created.variant_id = v.id
       AND created.id = NEW.revision_id
       AND created.revision = NEW.to_revision
       AND created.parent_revision = NEW.from_revision
       AND created.source_proposal_id IS NULL
       AND created.source_receipt_id IS NULL
      JOIN implemented_focus_revisions restored
        ON restored.workspace_id = v.workspace_id
       AND restored.variant_id = v.id
       AND restored.revision = NEW.restore_revision
       AND restored.configuration_json = created.configuration_json
       AND restored.configuration_hash = created.configuration_hash
      JOIN idempotency_records i
        ON i.workspace_id = v.workspace_id
       AND i.id = NEW.idempotency_id
       AND i.operation = 'undo'
       AND i.state = 'committed'
       AND i.result_kind = 'revision'
       AND i.result_id = created.id
     WHERE v.workspace_id = NEW.workspace_id
       AND v.id = NEW.variant_id
       AND v.active_implemented_revision = NEW.to_revision
       AND NOT EXISTS (
         SELECT 1 FROM proposals p
          WHERE p.workspace_id = v.workspace_id
            AND p.variant_id = v.id
            AND p.base_implemented_revision < NEW.to_revision
            AND p.status IN ('proposed', 'approved')
       )
       AND EXISTS (
         SELECT 1 FROM audit_events a
          WHERE a.workspace_id = v.workspace_id
            AND a.action = 'revision.undone'
            AND a.target_kind = 'revision'
            AND a.target_id = created.id
            AND a.result = 'success'
       )
  ) THEN RAISE(ABORT, 'UNDO_INCOMPLETE') END;
END;
--> statement-breakpoint

CREATE TRIGGER trg_undo_commits_immutable_update
BEFORE UPDATE ON undo_commits
BEGIN SELECT RAISE(ABORT, 'UNDO_COMMITS_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_undo_commits_immutable_delete
BEFORE DELETE ON undo_commits
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'UNDO_COMMITS_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TABLE runtime_precedent_provenance (
  record_id TEXT PRIMARY KEY NOT NULL CHECK (length(record_id) BETWEEN 1 AND 64),
  workspace_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  review_decision_id TEXT NOT NULL,
  application_receipt_id TEXT NOT NULL,
  verification_receipt_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  changed_field TEXT NOT NULL CHECK (changed_field IN ('initialFocus', 'focusOrder', 'trapTab', 'trapShiftTab', 'escapeAction', 'returnFocus')),
  behavior TEXT NOT NULL CHECK (behavior IN ('initial-focus', 'focus-order', 'forward-wrap', 'backward-wrap', 'escape', 'return-focus')),
  normalized_outcome_key TEXT NOT NULL CHECK (length(normalized_outcome_key) BETWEEN 1 AND 120),
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  FOREIGN KEY (workspace_id, record_id)
    REFERENCES precedent_records(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, proposal_id)
    REFERENCES proposals(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, review_decision_id)
    REFERENCES review_decisions(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, application_receipt_id)
    REFERENCES application_receipts(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, verification_receipt_id)
    REFERENCES verification_receipts(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, variant_id)
    REFERENCES component_variants(workspace_id, id) ON DELETE CASCADE,
  UNIQUE (workspace_id, record_id),
  UNIQUE (workspace_id, verification_receipt_id, changed_field)
) STRICT;
--> statement-breakpoint

CREATE TRIGGER trg_runtime_precedent_provenance_immutable_update
BEFORE UPDATE ON runtime_precedent_provenance
BEGIN SELECT RAISE(ABORT, 'RUNTIME_PRECEDENT_PROVENANCE_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_runtime_precedent_provenance_immutable_delete
BEFORE DELETE ON runtime_precedent_provenance
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'RUNTIME_PRECEDENT_PROVENANCE_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TABLE precedent_projection_commits (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  verification_receipt_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  FOREIGN KEY (workspace_id, verification_receipt_id)
    REFERENCES verification_receipts(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, record_id)
    REFERENCES precedent_records(workspace_id, id) ON DELETE CASCADE,
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, verification_receipt_id, record_id)
) STRICT;
--> statement-breakpoint

CREATE TRIGGER trg_precedent_projection_commit_complete
BEFORE INSERT ON precedent_projection_commits
FOR EACH ROW
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
      FROM runtime_precedent_provenance provenance
      JOIN verification_receipts verification
        ON verification.workspace_id = provenance.workspace_id
       AND verification.id = provenance.verification_receipt_id
       AND verification.id = NEW.verification_receipt_id
       AND verification.result = 'pass'
       AND verification.active_at_verification = 1
       AND verification.implemented_revision > 1
      JOIN implemented_focus_revisions revision
        ON revision.workspace_id = verification.workspace_id
       AND revision.variant_id = verification.variant_id
       AND revision.revision = verification.implemented_revision
       AND revision.source_proposal_id = provenance.proposal_id
       AND revision.source_receipt_id = provenance.application_receipt_id
      JOIN proposals proposal
        ON proposal.workspace_id = provenance.workspace_id
       AND proposal.id = provenance.proposal_id
       AND proposal.variant_id = provenance.variant_id
       AND proposal.status = 'applied'
      JOIN review_decisions decision
        ON decision.workspace_id = proposal.workspace_id
       AND decision.id = provenance.review_decision_id
       AND decision.proposal_id = proposal.id
       AND decision.action = 'approve'
       AND decision.proposal_hash = proposal.proposal_hash
       AND decision.base_implemented_revision = proposal.base_implemented_revision
       AND decision.reviewer_kind = 'ui-mediated'
      JOIN application_receipts application
        ON application.workspace_id = proposal.workspace_id
       AND application.id = provenance.application_receipt_id
       AND application.proposal_id = proposal.id
       AND application.proposal_hash = proposal.proposal_hash
       AND application.to_revision = verification.implemented_revision
       AND application.result = 'applied'
      JOIN precedent_records record
        ON record.workspace_id = provenance.workspace_id
       AND record.id = provenance.record_id
       AND record.id = NEW.record_id
       AND record.dataset_version = 'fcs-runtime-v1'
       AND record.behavior = provenance.behavior
       AND record.normalized_outcome_key = provenance.normalized_outcome_key
       AND record.status = 'active'
       AND record.provenance_kind = 'verified-runtime'
       AND record.provenance_ref = verification.id
      JOIN precedent_retrieval_profiles profile
        ON profile.workspace_id = record.workspace_id
       AND profile.record_id = record.id
       AND profile.product = 'focus-contract-studio'
       AND profile.component_family = 'modal-dialog'
       AND profile.use_case = 'delete-account'
       AND profile.source_status = 'active'
       AND profile.hostile = 0
     WHERE provenance.workspace_id = NEW.workspace_id
       AND provenance.record_id = NEW.record_id
       AND provenance.variant_id = verification.variant_id
       AND NOT EXISTS (
         SELECT 1 FROM review_decisions later
          WHERE later.workspace_id = decision.workspace_id
            AND later.proposal_id = decision.proposal_id
            AND (later.created_at > decision.created_at OR
                 (later.created_at = decision.created_at AND later.id > decision.id))
       )
       AND (SELECT COUNT(*) FROM precedent_subject_edges edge
             WHERE edge.workspace_id = record.workspace_id
               AND edge.record_id = record.id
               AND edge.edge_type = 'applies-to') = 4
       AND EXISTS (
         SELECT 1 FROM audit_events a
          WHERE a.workspace_id = record.workspace_id
            AND a.action = 'precedent.projected'
            AND a.target_kind = 'precedent'
            AND a.target_id = record.id
            AND a.result = 'success'
       )
  ) THEN RAISE(ABORT, 'PRECEDENT_PROJECTION_INCOMPLETE') END;
END;
--> statement-breakpoint

CREATE TRIGGER trg_precedent_projection_commits_immutable_update
BEFORE UPDATE ON precedent_projection_commits
BEGIN SELECT RAISE(ABORT, 'PRECEDENT_PROJECTION_COMMITS_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_precedent_projection_commits_immutable_delete
BEFORE DELETE ON precedent_projection_commits
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'PRECEDENT_PROJECTION_COMMITS_IMMUTABLE'); END;
