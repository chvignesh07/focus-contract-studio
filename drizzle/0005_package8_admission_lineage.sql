ALTER TABLE workspaces
  ADD COLUMN admission_subject_key TEXT
  CHECK (admission_subject_key IS NULL OR length(admission_subject_key) = 64);

UPDATE workspaces
   SET admission_subject_key = subject_key
 WHERE admission_subject_key IS NULL;

CREATE TRIGGER trg_workspaces_admission_subject_immutable
BEFORE UPDATE OF admission_subject_key ON workspaces
WHEN NEW.admission_subject_key IS NOT OLD.admission_subject_key
BEGIN SELECT RAISE(ABORT, 'WORKSPACE_ADMISSION_SUBJECT_IMMUTABLE'); END;

CREATE UNIQUE INDEX idx_rate_limit_workspace_subject_window
  ON rate_limit_windows(key_digest, operation, window_start)
  WHERE workspace_id IS NOT NULL;
