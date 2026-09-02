-- Admission is consumed by the durable commit marker in the same D1 batch as
-- the product mutation. A replay inserts no marker; a failed batch rolls the
-- counter back with the rest of the graph.
CREATE TRIGGER trg_package8_admit_audit_mutation
BEFORE INSERT ON audit_events
WHEN NEW.result = 'success' AND NEW.action IN (
  'proposal.created',
  'proposal.edited',
  'review.approve',
  'review.reject',
  'review.revoke',
  'application.applied',
  'revision.undone',
  'workspace.reset',
  'verification.completed'
)
BEGIN
  SELECT CASE WHEN COALESCE((
    SELECT window.request_count
      FROM rate_limit_windows window
      JOIN workspaces workspace ON workspace.id = NEW.workspace_id
     WHERE window.workspace_id IS NOT NULL
       AND window.key_digest = COALESCE(
         workspace.admission_subject_key,
         workspace.subject_key
       )
       AND window.operation = CASE
         WHEN NEW.action = 'proposal.created' THEN 'proposal'
         WHEN NEW.action IN (
           'proposal.edited',
           'review.approve',
           'review.reject',
           'review.revoke'
         ) THEN 'review'
         WHEN NEW.action = 'application.applied' THEN 'apply'
         WHEN NEW.action = 'revision.undone' THEN 'undo'
         WHEN NEW.action = 'workspace.reset' THEN 'reset'
         ELSE 'verification'
       END
       AND window.window_start = (NEW.occurred_at / 3600) * 3600
  ), 0) >= CASE
    WHEN NEW.action IN (
      'proposal.created',
      'proposal.edited',
      'review.approve',
      'review.reject',
      'review.revoke'
    ) THEN 10
    WHEN NEW.action IN ('application.applied', 'revision.undone') THEN 6
    WHEN NEW.action = 'workspace.reset' THEN 5
    ELSE 12
  END THEN RAISE(ABORT, 'FCS_RATE_LIMITED') END;

  INSERT INTO rate_limit_windows (
    id, workspace_id, key_digest, operation, window_start,
    window_seconds, request_count, expires_at
  )
  SELECT lower(hex(randomblob(16))), NEW.workspace_id,
         COALESCE(workspace.admission_subject_key, workspace.subject_key),
         CASE
           WHEN NEW.action = 'proposal.created' THEN 'proposal'
           WHEN NEW.action IN (
             'proposal.edited',
             'review.approve',
             'review.reject',
             'review.revoke'
           ) THEN 'review'
           WHEN NEW.action = 'application.applied' THEN 'apply'
           WHEN NEW.action = 'revision.undone' THEN 'undo'
           WHEN NEW.action = 'workspace.reset' THEN 'reset'
           ELSE 'verification'
         END,
         (NEW.occurred_at / 3600) * 3600,
         3600,
         1,
         ((NEW.occurred_at / 3600) * 3600) + 7200
    FROM workspaces workspace
   WHERE workspace.id = NEW.workspace_id
  ON CONFLICT(key_digest, operation, window_start)
    WHERE workspace_id IS NOT NULL
  DO UPDATE SET request_count = rate_limit_windows.request_count + 1;
END;

CREATE TRIGGER trg_package8_admit_rehearsal_start
BEFORE INSERT ON observation_sessions
BEGIN
  SELECT CASE WHEN COALESCE((
    SELECT window.request_count
      FROM rate_limit_windows window
      JOIN workspaces workspace ON workspace.id = NEW.workspace_id
     WHERE window.workspace_id IS NOT NULL
       AND window.key_digest = COALESCE(
         workspace.admission_subject_key,
         workspace.subject_key
       )
       AND window.operation = 'rehearsal'
       AND window.window_start = (NEW.created_at / 3600) * 3600
  ), 0) >= 12 THEN RAISE(ABORT, 'FCS_RATE_LIMITED') END;

  INSERT INTO rate_limit_windows (
    id, workspace_id, key_digest, operation, window_start,
    window_seconds, request_count, expires_at
  )
  SELECT lower(hex(randomblob(16))), NEW.workspace_id,
         COALESCE(workspace.admission_subject_key, workspace.subject_key),
         'rehearsal',
         (NEW.created_at / 3600) * 3600,
         3600,
         1,
         ((NEW.created_at / 3600) * 3600) + 7200
    FROM workspaces workspace
   WHERE workspace.id = NEW.workspace_id
  ON CONFLICT(key_digest, operation, window_start)
    WHERE workspace_id IS NOT NULL
  DO UPDATE SET request_count = rate_limit_windows.request_count + 1;
END;

CREATE TRIGGER trg_package8_admit_rehearsal_finalize
BEFORE INSERT ON focus_rehearsal_commits
BEGIN
  SELECT CASE WHEN COALESCE((
    SELECT window.request_count
      FROM rate_limit_windows window
      JOIN workspaces workspace ON workspace.id = NEW.workspace_id
     WHERE window.workspace_id IS NOT NULL
       AND window.key_digest = COALESCE(
         workspace.admission_subject_key,
         workspace.subject_key
       )
       AND window.operation = 'rehearsal'
       AND window.window_start = (NEW.finalized_at / 3600) * 3600
  ), 0) >= 12 THEN RAISE(ABORT, 'FCS_RATE_LIMITED') END;

  INSERT INTO rate_limit_windows (
    id, workspace_id, key_digest, operation, window_start,
    window_seconds, request_count, expires_at
  )
  SELECT lower(hex(randomblob(16))), NEW.workspace_id,
         COALESCE(workspace.admission_subject_key, workspace.subject_key),
         'rehearsal',
         (NEW.finalized_at / 3600) * 3600,
         3600,
         1,
         ((NEW.finalized_at / 3600) * 3600) + 7200
    FROM workspaces workspace
   WHERE workspace.id = NEW.workspace_id
  ON CONFLICT(key_digest, operation, window_start)
    WHERE workspace_id IS NOT NULL
  DO UPDATE SET request_count = rate_limit_windows.request_count + 1;
END;
