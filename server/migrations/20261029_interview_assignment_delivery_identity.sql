-- INT-DELIVERY-OPS-001: bind assignment delivery to one immutable template
-- version and make client retries durable without changing the canonical writer.

ALTER TABLE interview_assignments
  ADD COLUMN IF NOT EXISTS create_request_key TEXT,
  ADD COLUMN IF NOT EXISTS create_request_fingerprint TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_interview_assignment_create_request
  ON interview_assignments (organization_id, created_by, create_request_key)
  WHERE create_request_key IS NOT NULL;

-- Preserve pre-existing collisions as quarantine evidence. Do not delete,
-- null, or silently choose one historical session during an upgrade.
CREATE TABLE IF NOT EXISTS interview_assignment_session_duplicate_quarantine (
  assignment_id TEXT PRIMARY KEY,
  session_ids TEXT[] NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO interview_assignment_session_duplicate_quarantine (assignment_id, session_ids)
SELECT assignment_id, array_agg(id ORDER BY created_at, id)
  FROM interview_sessions
 WHERE assignment_id IS NOT NULL
 GROUP BY assignment_id
HAVING COUNT(*) > 1
ON CONFLICT (assignment_id) DO UPDATE
  SET session_ids = EXCLUDED.session_ids,
      detected_at = CURRENT_TIMESTAMP;

-- New writes are serialized per assignment with a transaction advisory lock.
-- Unlike adding a UNIQUE index, this installs safely even if legacy duplicates
-- were quarantined above; those identities remain fail-closed for new writes.
CREATE OR REPLACE FUNCTION enforce_one_interview_session_per_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assignment_id IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('interview-session:' || NEW.assignment_id));
  IF EXISTS (
    SELECT 1 FROM interview_sessions s
     WHERE s.assignment_id = NEW.assignment_id
       AND s.id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'assignment % already owns an interview session', NEW.assignment_id
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_one_interview_session_per_assignment ON interview_sessions;
CREATE TRIGGER trg_one_interview_session_per_assignment
  BEFORE INSERT OR UPDATE OF assignment_id ON interview_sessions
  FOR EACH ROW EXECUTE FUNCTION enforce_one_interview_session_per_assignment();
