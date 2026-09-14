-- Interview per-answer approval commands and immutable decision receipts.
-- Additive only. The application writes a parent command and all answer
-- decisions in one transaction, then replays the parent's response_json.

CREATE TABLE IF NOT EXISTS interview_answer_decision_commands (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  assignment_id TEXT NOT NULL REFERENCES interview_assignments(id) ON DELETE CASCADE,
  assignment_sequence INTEGER NOT NULL CHECK (assignment_sequence > 0),
  session_id TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  submission_id TEXT NOT NULL,
  command_type TEXT NOT NULL CHECK (command_type IN ('submit', 'decide')),
  client_request_id TEXT NOT NULL CHECK (btrim(client_request_id) <> ''),
  request_fingerprint TEXT NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  expected_answer_count INTEGER NOT NULL CHECK (expected_answer_count > 0),
  answer_manifest_digest TEXT NOT NULL CHECK (answer_manifest_digest ~ '^[0-9a-f]{64}$'),
  status TEXT NOT NULL CHECK (status = 'applied'),
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_interview_answer_decision_commands_request
  ON interview_answer_decision_commands (organization_id, client_request_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_interview_answer_decision_commands_submission
  ON interview_answer_decision_commands (organization_id, submission_id)
  WHERE command_type = 'submit';

CREATE UNIQUE INDEX IF NOT EXISTS uq_interview_answer_decision_commands_assignment_sequence
  ON interview_answer_decision_commands (organization_id, assignment_id, assignment_sequence);

CREATE INDEX IF NOT EXISTS idx_interview_answer_decision_commands_assignment
  ON interview_answer_decision_commands (organization_id, assignment_id, submission_id, assignment_sequence, id);

CREATE TABLE IF NOT EXISTS interview_answer_decisions (
  organization_id TEXT NOT NULL,
  id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  assignment_id TEXT NOT NULL REFERENCES interview_assignments(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
  submission_id TEXT NOT NULL,
  answer_updated_at TIMESTAMPTZ NOT NULL,
  answer_digest TEXT NOT NULL CHECK (answer_digest ~ '^[0-9a-f]{64}$'),
  answer_snapshot_json JSONB NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal > 0),
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'submitted',
      'ai_approved',
      'ai_sent_back',
      'manager_approved',
      'manager_sent_back',
      'superseded'
    )
  ),
  stage TEXT CHECK (stage IN ('ai', 'manager')),
  decision TEXT CHECK (decision IN ('approved', 'sent_back')),
  reason TEXT,
  policy_mode TEXT NOT NULL CHECK (policy_mode IN ('ai', 'manager', 'two_stage')),
  policy_version INTEGER NOT NULL CHECK (policy_version > 0),
  policy_snapshot_json JSONB NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('ai', 'human', 'system')),
  actor_id TEXT NOT NULL CHECK (btrim(actor_id) <> ''),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, id),
  FOREIGN KEY (organization_id, command_id)
    REFERENCES interview_answer_decision_commands (organization_id, id)
    ON DELETE CASCADE,
  CHECK (
    (event_type IN ('submitted', 'superseded') AND stage IS NULL AND decision IS NULL)
    OR
    (event_type NOT IN ('submitted', 'superseded') AND stage IS NOT NULL AND decision IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_interview_answer_decisions_submission_ordinal
  ON interview_answer_decisions (organization_id, submission_id, ordinal);

CREATE UNIQUE INDEX IF NOT EXISTS uq_interview_answer_decisions_submission_question_event
  ON interview_answer_decisions (organization_id, submission_id, question_id, event_type);

CREATE INDEX IF NOT EXISTS idx_interview_answer_decisions_assignment_submission
  ON interview_answer_decisions (organization_id, assignment_id, submission_id, ordinal, id);

CREATE INDEX IF NOT EXISTS idx_interview_answer_decisions_question_projection
  ON interview_answer_decisions (organization_id, question_id, submission_id, ordinal, id);
