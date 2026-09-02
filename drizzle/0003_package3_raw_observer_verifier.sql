-- Focus Contract Studio Package 3 raw rehearsal and independent verification.
-- The Package 1/2 migrations remain byte-for-byte unchanged.

DROP INDEX idx_initial_focus_one_report_per_revision;
--> statement-breakpoint
DROP TRIGGER trg_initial_focus_commit_complete;
--> statement-breakpoint

-- Keep Package 1/2 rows while allowing Package 3 to record bounded observed
-- focus escapes and alternate return targets as truthful verifier evidence.
CREATE TABLE observation_events_package3 (
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
    (event_type = 'focus_return' AND key_name IS NULL AND shift_key IS NULL AND close_reason IS NULL)
  )
) STRICT;
--> statement-breakpoint

INSERT INTO observation_events_package3 (
  id, workspace_id, session_id, sequence, event_type, target_id, key_name,
  shift_key, close_reason, client_offset_ms, created_at
)
SELECT id, workspace_id, session_id, sequence, event_type, target_id, key_name,
       shift_key, close_reason, client_offset_ms, created_at
  FROM observation_events;
--> statement-breakpoint

DROP TABLE observation_events;
--> statement-breakpoint
ALTER TABLE observation_events_package3 RENAME TO observation_events;
--> statement-breakpoint

CREATE INDEX idx_observation_events_session_sequence
  ON observation_events(workspace_id, session_id, sequence);
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

-- Preserve the Package 2 opening-report finalizer after rebuilding its event
-- table with the broader Package 3 observation vocabulary.
CREATE TRIGGER trg_initial_focus_commit_complete
BEFORE INSERT ON initial_focus_observation_commits
BEGIN
  SELECT CASE WHEN NOT EXISTS (
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
  ) THEN RAISE(ABORT, 'INITIAL_FOCUS_OBSERVATION_INCOMPLETE') END;
END;
--> statement-breakpoint

-- Permit only a semantic no-op assertion after a complete Package 3 marker.
-- Every real state transition and immutable-payload rule remains unchanged.
DROP TRIGGER trg_observation_sessions_transition;
--> statement-breakpoint
CREATE TRIGGER trg_observation_sessions_transition
BEFORE UPDATE ON observation_sessions
BEGIN
  SELECT CASE WHEN NEW.id IS NOT OLD.id
    OR NEW.workspace_id IS NOT OLD.workspace_id
    OR NEW.variant_id IS NOT OLD.variant_id
    OR NEW.implemented_revision IS NOT OLD.implemented_revision
    OR NEW.environment IS NOT OLD.environment
    OR NEW.nonce_digest IS NOT OLD.nonce_digest
    OR NEW.created_at IS NOT OLD.created_at
    OR NEW.expires_at IS NOT OLD.expires_at
    THEN RAISE(ABORT, 'OBSERVATION_PAYLOAD_IMMUTABLE') END;
  SELECT CASE WHEN NOT (
    (OLD.state = 'recording' AND NEW.state IN ('finalized', 'expired')) OR
    (OLD.state = 'finalized' AND NEW.state IN ('verified_pass', 'verified_fail')) OR
    (OLD.state = NEW.state AND EXISTS (
      SELECT 1 FROM focus_rehearsal_commits f
       WHERE f.workspace_id = OLD.workspace_id AND f.session_id = OLD.id
    ))
  ) THEN RAISE(ABORT, 'OBSERVATION_TRANSITION_INVALID') END;
  SELECT CASE WHEN NEW.state = 'finalized' AND (
    NEW.finalized_at IS NULL OR NEW.event_digest IS NULL OR NEW.manifest_digest IS NULL
  ) THEN RAISE(ABORT, 'OBSERVATION_FINALIZATION_INCOMPLETE') END;
  SELECT CASE WHEN OLD.state IN ('finalized', 'verified_pass', 'verified_fail') AND (
    NEW.finalized_at IS NOT OLD.finalized_at
    OR NEW.event_digest IS NOT OLD.event_digest
    OR NEW.manifest_digest IS NOT OLD.manifest_digest
  ) THEN RAISE(ABORT, 'OBSERVATION_FINALIZATION_IMMUTABLE') END;
  SELECT CASE WHEN NEW.state = 'expired' AND (
    NEW.finalized_at IS NOT NULL OR NEW.event_digest IS NOT NULL OR NEW.manifest_digest IS NOT NULL
  ) THEN RAISE(ABORT, 'OBSERVATION_EXPIRY_INVALID') END;
END;
--> statement-breakpoint

CREATE TRIGGER trg_initial_focus_one_report_per_revision
BEFORE INSERT ON initial_focus_observation_commits
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1
      FROM observation_sessions candidate
      JOIN initial_focus_observation_commits prior_commit
        ON prior_commit.workspace_id = candidate.workspace_id
      JOIN observation_sessions prior
        ON prior.workspace_id = prior_commit.workspace_id
       AND prior.id = prior_commit.session_id
     WHERE candidate.workspace_id = NEW.workspace_id
       AND candidate.id = NEW.session_id
       AND prior.variant_id = candidate.variant_id
       AND prior.implemented_revision = candidate.implemented_revision
  ) THEN RAISE(ABORT, 'INITIAL_FOCUS_OBSERVATION_EXISTS') END;
END;
--> statement-breakpoint

-- Preserve the established lookup/index contract without reintroducing the
-- cross-purpose uniqueness rule. The trigger above owns Package 2 uniqueness;
-- the session id keeps repeated Package 3 rehearsals independently addressable.
CREATE UNIQUE INDEX idx_initial_focus_one_report_per_revision
  ON observation_sessions(workspace_id, variant_id, implemented_revision, id)
  WHERE state IN ('finalized', 'verified_pass', 'verified_fail');
--> statement-breakpoint

CREATE TABLE focus_rehearsal_commits (
  session_id TEXT PRIMARY KEY NOT NULL CHECK (length(session_id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  implemented_revision INTEGER NOT NULL CHECK (implemented_revision >= 1),
  manifest_digest TEXT NOT NULL CHECK (length(manifest_digest) = 64),
  event_digest TEXT NOT NULL CHECK (length(event_digest) = 64),
  event_count INTEGER NOT NULL CHECK (event_count BETWEEN 1 AND 64),
  finalized_at INTEGER NOT NULL CHECK (finalized_at >= 0),
  FOREIGN KEY (workspace_id, session_id)
    REFERENCES observation_sessions(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, variant_id, implemented_revision)
    REFERENCES implemented_focus_revisions(workspace_id, variant_id, revision) ON DELETE CASCADE,
  UNIQUE (workspace_id, session_id)
) STRICT;
--> statement-breakpoint

CREATE TRIGGER trg_focus_rehearsal_commit_complete
BEFORE INSERT ON focus_rehearsal_commits
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
      FROM observation_sessions s
      JOIN rendered_manifests m
        ON m.workspace_id = s.workspace_id AND m.session_id = s.id
     WHERE s.workspace_id = NEW.workspace_id
       AND s.id = NEW.session_id
       AND s.variant_id = NEW.variant_id
       AND s.implemented_revision = NEW.implemented_revision
       AND s.state = 'finalized'
       AND s.finalized_at = NEW.finalized_at
       AND s.finalized_at <= s.expires_at
       AND s.event_digest = NEW.event_digest
       AND s.manifest_digest = NEW.manifest_digest
       AND m.manifest_hash = NEW.manifest_digest
       AND m.manifest_version = 'focus-manifest-v1'
       AND m.open_state = 1
       AND m.role = 'dialog'
       AND m.aria_modal = 1
       AND json_valid(m.target_ids_json)
       AND json_valid(m.tabbable_order_json)
       AND (SELECT COUNT(*) FROM observation_events e
             WHERE e.workspace_id = s.workspace_id AND e.session_id = s.id) = NEW.event_count
       AND (SELECT MIN(e.sequence) FROM observation_events e
             WHERE e.workspace_id = s.workspace_id AND e.session_id = s.id) = 1
       AND (SELECT MAX(e.sequence) FROM observation_events e
             WHERE e.workspace_id = s.workspace_id AND e.session_id = s.id) = NEW.event_count
       AND (SELECT COUNT(DISTINCT e.sequence) FROM observation_events e
             WHERE e.workspace_id = s.workspace_id AND e.session_id = s.id) = NEW.event_count
       AND (SELECT MAX(e.client_offset_ms) FROM observation_events e
             WHERE e.workspace_id = s.workspace_id AND e.session_id = s.id) <= 30000
       AND EXISTS (
         SELECT 1 FROM observation_events e
          WHERE e.workspace_id = s.workspace_id AND e.session_id = s.id
            AND e.sequence = 1 AND e.event_type = 'dialog_open'
            AND e.target_id = 'delete-trigger'
       )
       AND EXISTS (
         SELECT 1 FROM observation_events e
          WHERE e.workspace_id = s.workspace_id AND e.session_id = s.id
            AND e.sequence = NEW.event_count AND e.event_type = 'focus_return'
       )
       AND (SELECT COUNT(*) FROM observation_events e
             WHERE e.workspace_id = s.workspace_id AND e.session_id = s.id
               AND e.event_type = 'dialog_open') = 1
       AND (SELECT COUNT(*) FROM observation_events e
             WHERE e.workspace_id = s.workspace_id AND e.session_id = s.id
               AND e.event_type = 'dialog_close') = 1
       AND (SELECT COUNT(*) FROM observation_events e
             WHERE e.workspace_id = s.workspace_id AND e.session_id = s.id
               AND e.event_type = 'focus_return') = 1
       AND (SELECT COUNT(*) FROM observation_events e
             WHERE e.workspace_id = s.workspace_id AND e.session_id = s.id
               AND e.event_type = 'keydown' AND e.key_name = 'Escape') = 1
       AND (SELECT COUNT(*) FROM observation_events e
             WHERE e.workspace_id = s.workspace_id AND e.session_id = s.id
               AND e.event_type = 'keydown' AND e.key_name = 'Tab'
               AND e.shift_key = 0) >= json_array_length(m.tabbable_order_json) + 1
       AND (SELECT COUNT(*) FROM observation_events e
             WHERE e.workspace_id = s.workspace_id AND e.session_id = s.id
               AND e.event_type = 'keydown' AND e.key_name = 'Tab'
               AND e.shift_key = 1) >= 1
       AND NOT EXISTS (
         SELECT 1 FROM observation_events key
          WHERE key.workspace_id = s.workspace_id AND key.session_id = s.id
            AND key.event_type = 'keydown' AND key.key_name = 'Tab'
            AND NOT EXISTS (
              SELECT 1 FROM observation_events focus
               WHERE focus.workspace_id = key.workspace_id
                 AND focus.session_id = key.session_id
                 AND focus.sequence = key.sequence + 1
                 AND focus.event_type = 'focusin'
            )
       )
       AND EXISTS (
         SELECT 1
           FROM observation_events esc
           JOIN observation_events close
             ON close.workspace_id = esc.workspace_id
            AND close.session_id = esc.session_id
            AND close.sequence > esc.sequence
           JOIN observation_events returned
             ON returned.workspace_id = close.workspace_id
            AND returned.session_id = close.session_id
            AND returned.sequence = close.sequence + 1
          WHERE esc.workspace_id = s.workspace_id
            AND esc.session_id = s.id
            AND esc.event_type = 'keydown' AND esc.key_name = 'Escape'
            AND close.event_type = 'dialog_close'
            AND returned.event_type = 'focus_return'
            AND returned.sequence = NEW.event_count
       )
  ) THEN RAISE(ABORT, 'FOCUS_REHEARSAL_INCOMPLETE') END;
END;
--> statement-breakpoint

CREATE TRIGGER trg_focus_rehearsal_commits_immutable_update
BEFORE UPDATE ON focus_rehearsal_commits
BEGIN SELECT RAISE(ABORT, 'FOCUS_REHEARSAL_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_focus_rehearsal_commits_immutable_delete
BEFORE DELETE ON focus_rehearsal_commits
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'FOCUS_REHEARSAL_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TABLE verification_guards (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  observation_session_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  implemented_revision INTEGER NOT NULL CHECK (implemented_revision >= 1),
  environment TEXT NOT NULL CHECK (environment IN ('browser', 'playwright')),
  verifier_version TEXT NOT NULL CHECK (verifier_version = 'focus-event-verifier-v1'),
  result TEXT NOT NULL CHECK (result IN ('pass', 'fail')),
  event_digest TEXT NOT NULL CHECK (length(event_digest) = 64),
  manifest_digest TEXT NOT NULL CHECK (length(manifest_digest) = 64),
  active_at_verification INTEGER NOT NULL CHECK (active_at_verification = 1),
  verifier_output_hash TEXT NOT NULL CHECK (length(verifier_output_hash) = 64),
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

CREATE TRIGGER trg_verification_guards_immutable_update
BEFORE UPDATE ON verification_guards
BEGIN SELECT RAISE(ABORT, 'VERIFICATION_GUARD_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_verification_guards_immutable_delete
BEFORE DELETE ON verification_guards
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'VERIFICATION_GUARD_IMMUTABLE'); END;
--> statement-breakpoint

ALTER TABLE verification_receipts
  ADD COLUMN environment TEXT NOT NULL DEFAULT 'browser'
  CHECK (environment IN ('browser', 'playwright'));
--> statement-breakpoint

ALTER TABLE verification_receipts
  ADD COLUMN verifier_output_hash TEXT NOT NULL
  DEFAULT '0000000000000000000000000000000000000000000000000000000000000000'
  CHECK (length(verifier_output_hash) = 64);
--> statement-breakpoint

CREATE TRIGGER trg_verification_receipt_complete
BEFORE INSERT ON verification_receipts
WHEN NEW.verifier_version = 'focus-event-verifier-v1'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM verification_guards g
     WHERE g.workspace_id = NEW.workspace_id
       AND g.observation_session_id = NEW.observation_session_id
       AND g.variant_id = NEW.variant_id
       AND g.implemented_revision = NEW.implemented_revision
       AND g.verifier_version = NEW.verifier_version
       AND g.result = NEW.result
       AND g.event_digest = NEW.event_digest
       AND g.manifest_digest = NEW.manifest_digest
       AND g.active_at_verification = NEW.active_at_verification
       AND g.environment = NEW.environment
       AND g.verifier_output_hash = NEW.verifier_output_hash
       AND g.created_at = NEW.created_at
  ) THEN RAISE(ABORT, 'VERIFICATION_RECEIPT_UNGUARDED') END;
END;
--> statement-breakpoint

-- Package 1 reserved this table with kebab-case behavior values. Package 3
-- preserves those rows and admits canonical public names for its own receipts.
CREATE TABLE verification_checks_package3 (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  verification_receipt_id TEXT NOT NULL,
  behavior TEXT NOT NULL CHECK (behavior IN (
    'initial-focus', 'focus-order', 'forward-wrap', 'backward-wrap', 'escape', 'return-focus',
    'initialFocus', 'focusOrder', 'trapTab', 'trapShiftTab', 'escapeAction', 'returnFocus'
  )),
  result TEXT NOT NULL CHECK (result IN ('pass', 'fail', 'not_observed')),
  evidence_sequences_json TEXT NOT NULL CHECK (json_valid(evidence_sequences_json) AND json_type(evidence_sequences_json) = 'array' AND length(evidence_sequences_json) <= 512),
  verifier_output_hash TEXT NOT NULL
    DEFAULT '0000000000000000000000000000000000000000000000000000000000000000'
    CHECK (length(verifier_output_hash) = 64),
  FOREIGN KEY (workspace_id, verification_receipt_id)
    REFERENCES verification_receipts(workspace_id, id) ON DELETE CASCADE,
  UNIQUE (workspace_id, verification_receipt_id, behavior)
) STRICT;
--> statement-breakpoint

INSERT INTO verification_checks_package3 (
  id, workspace_id, verification_receipt_id, behavior, result,
  evidence_sequences_json, verifier_output_hash
)
SELECT c.id, c.workspace_id, c.verification_receipt_id,
  c.behavior,
  c.result, c.evidence_sequences_json, r.verifier_output_hash
FROM verification_checks c
JOIN verification_receipts r
  ON r.workspace_id = c.workspace_id AND r.id = c.verification_receipt_id;
--> statement-breakpoint

DROP TABLE verification_checks;
--> statement-breakpoint
ALTER TABLE verification_checks_package3 RENAME TO verification_checks;
--> statement-breakpoint

CREATE TRIGGER trg_verification_checks_immutable_update
BEFORE UPDATE ON verification_checks
BEGIN SELECT RAISE(ABORT, 'VERIFICATION_CHECKS_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_verification_checks_package3_behavior
BEFORE INSERT ON verification_checks
WHEN EXISTS (
  SELECT 1 FROM verification_receipts r
   WHERE r.workspace_id = NEW.workspace_id
     AND r.id = NEW.verification_receipt_id
     AND r.verifier_version = 'focus-event-verifier-v1'
) AND NEW.behavior NOT IN (
  'initialFocus', 'focusOrder', 'trapTab', 'trapShiftTab', 'escapeAction', 'returnFocus'
)
BEGIN SELECT RAISE(ABORT, 'VERIFICATION_CHECK_BEHAVIOR_INVALID'); END;
--> statement-breakpoint

CREATE TRIGGER trg_verification_checks_immutable_delete
BEFORE DELETE ON verification_checks
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'VERIFICATION_CHECKS_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TABLE verification_commits (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 32 AND 64),
  workspace_id TEXT NOT NULL,
  guard_id TEXT NOT NULL,
  receipt_id TEXT NOT NULL,
  audit_event_id TEXT NOT NULL,
  created_at INTEGER NOT NULL CHECK (created_at >= 0),
  FOREIGN KEY (workspace_id, guard_id)
    REFERENCES verification_guards(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, receipt_id)
    REFERENCES verification_receipts(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, audit_event_id)
    REFERENCES audit_events(workspace_id, id) ON DELETE CASCADE,
  UNIQUE (workspace_id, guard_id),
  UNIQUE (workspace_id, receipt_id),
  UNIQUE (workspace_id, audit_event_id)
) STRICT;
--> statement-breakpoint

CREATE TRIGGER trg_verification_commit_complete
BEFORE INSERT ON verification_commits
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
      FROM verification_guards g
      JOIN verification_receipts r
        ON r.workspace_id = g.workspace_id
       AND r.observation_session_id = g.observation_session_id
       AND r.verifier_version = g.verifier_version
      JOIN focus_rehearsal_commits f
        ON f.workspace_id = g.workspace_id
       AND f.session_id = g.observation_session_id
      JOIN observation_sessions s
        ON s.workspace_id = g.workspace_id
       AND s.id = g.observation_session_id
      JOIN audit_events a
        ON a.workspace_id = g.workspace_id
       AND a.id = NEW.audit_event_id
     WHERE g.workspace_id = NEW.workspace_id
       AND g.id = NEW.guard_id
       AND r.id = NEW.receipt_id
       AND r.variant_id = g.variant_id
       AND r.implemented_revision = g.implemented_revision
       AND r.environment = g.environment
       AND r.result = g.result
       AND r.event_digest = g.event_digest
       AND r.manifest_digest = g.manifest_digest
       AND r.active_at_verification = g.active_at_verification
       AND r.verifier_output_hash = g.verifier_output_hash
       AND r.created_at = g.created_at
       AND f.variant_id = g.variant_id
       AND f.implemented_revision = g.implemented_revision
       AND f.event_digest = g.event_digest
       AND f.manifest_digest = g.manifest_digest
       AND s.state = 'finalized'
       AND s.environment = g.environment
       AND a.actor_kind = 'system'
       AND a.action = 'verification.completed'
       AND a.target_kind = 'verification'
       AND a.target_id = r.id
       AND a.result = 'success'
       AND a.correlation_id = g.id
       AND a.occurred_at = g.created_at
       AND json_extract(a.safe_detail_json, '$.environment') = g.environment
       AND json_extract(a.safe_detail_json, '$.verifierVersion') = g.verifier_version
       AND json_extract(a.safe_detail_json, '$.result') = g.result
       AND NEW.created_at = g.created_at
       AND (SELECT COUNT(*) FROM verification_checks c
             WHERE c.workspace_id = g.workspace_id
               AND c.verification_receipt_id = r.id) = 6
       AND (SELECT COUNT(DISTINCT c.behavior) FROM verification_checks c
             WHERE c.workspace_id = g.workspace_id
               AND c.verification_receipt_id = r.id) = 6
       AND NOT EXISTS (
         SELECT 1 FROM verification_checks c
          WHERE c.workspace_id = g.workspace_id
            AND c.verification_receipt_id = r.id
            AND c.verifier_output_hash <> g.verifier_output_hash
       )
       AND NOT EXISTS (
         SELECT 1
           FROM verification_checks c, json_each(c.evidence_sequences_json) sequence
           LEFT JOIN observation_events e
             ON e.workspace_id = g.workspace_id
            AND e.session_id = g.observation_session_id
            AND e.sequence = sequence.value
          WHERE c.workspace_id = g.workspace_id
            AND c.verification_receipt_id = r.id
            AND (sequence.type <> 'integer' OR e.id IS NULL)
       )
       AND (
         (r.result = 'pass' AND NOT EXISTS (
           SELECT 1 FROM verification_checks c
            WHERE c.workspace_id = r.workspace_id
              AND c.verification_receipt_id = r.id AND c.result <> 'pass'
         )) OR
         (r.result = 'fail' AND EXISTS (
           SELECT 1 FROM verification_checks c
            WHERE c.workspace_id = r.workspace_id
              AND c.verification_receipt_id = r.id AND c.result <> 'pass'
         ))
       )
  ) THEN RAISE(ABORT, 'VERIFICATION_COMMIT_INCOMPLETE') END;
END;
--> statement-breakpoint

CREATE TRIGGER trg_verification_commits_immutable_update
BEFORE UPDATE ON verification_commits
BEGIN SELECT RAISE(ABORT, 'VERIFICATION_COMMIT_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TRIGGER trg_verification_commits_immutable_delete
BEFORE DELETE ON verification_commits
WHEN EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.workspace_id)
BEGIN SELECT RAISE(ABORT, 'VERIFICATION_COMMIT_IMMUTABLE'); END;
