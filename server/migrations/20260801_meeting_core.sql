-- 20260801_meeting_core.sql
-- Meeting Core (Wave 2) — first real, non-realtime Meeting domain.
--
-- STRICTLY ADDITIVE. The migration is safe for an existing Meeting dataset:
-- legacy rows retain lifecycle_status=NULL until their creator explicitly
-- adopts governed minutes. It is verified both in scratch-PG domain tests and
-- by the canonical full PostgreSQL migration runner.
--
-- `meetings.status` (scheduled|completed) is READ elsewhere (My Work
-- calendar: server/src/routes/v8/my-work.routes.ts, server/src/routes/my-work/
-- calendar.routes.ts; aiOperatorService.ts) and is left completely untouched.
-- The new `lifecycle_status` column is a PARALLEL, independent field owned by
-- the new meetingCore state machine (DRAFT/PREPARING/READY/LIVE/CLOSING/
-- CLOSED/CANCELLED). It defaults to NULL for every existing row on purpose:
-- a NULL lifecycle_status means "this meeting was never created through
-- meetingCore" and the lifecycle transition functions refuse to operate on
-- it (see server/src/services/meetingCore/lifecycle.ts).

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS lifecycle_status text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS closed_by text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS purpose text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS expected_outcomes text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS preparation_notes text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_meetings_lifecycle_status') THEN
    ALTER TABLE meetings ADD CONSTRAINT chk_meetings_lifecycle_status CHECK (
      lifecycle_status IS NULL OR lifecycle_status IN
        ('DRAFT', 'PREPARING', 'READY', 'LIVE', 'CLOSING', 'CLOSED', 'CANCELLED')
    );
  END IF;
END $$;

-- Meeting-scoped roles: owner, facilitator, participant, observer, teresa
-- (system). Independent of org-level role (admin/owner/superadmin), which
-- continues to gate DELETE/PATCH status at the route layer.
CREATE TABLE IF NOT EXISTS meeting_participants (
  id text PRIMARY KEY,
  meeting_id text NOT NULL REFERENCES meetings(id),
  organization_id text NOT NULL,
  user_id text NOT NULL,
  meeting_role text NOT NULL,
  invited_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_meeting_participants_meeting_user UNIQUE (meeting_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting ON meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_org ON meeting_participants(organization_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_user ON meeting_participants(organization_id, user_id);
ALTER TABLE meeting_participants DROP CONSTRAINT IF EXISTS chk_meeting_participants_role;
ALTER TABLE meeting_participants ADD CONSTRAINT chk_meeting_participants_role CHECK (
  meeting_role IN ('owner', 'facilitator', 'participant', 'observer', 'teresa')
);

-- Structured notes — NOT a transcript. entry_type is one of: discussion,
-- insight, question, risk, proposed_decision, proposed_task, parking_lot.
-- author_kind distinguishes a real user (author_user_id = users.id) from a
-- system author (Teresa; author_user_id = the fixed sentinel
-- 'system:teresa' — see server/src/services/meetingCore/types.ts).
CREATE TABLE IF NOT EXISTS meeting_note_entries (
  id text PRIMARY KEY,
  meeting_id text NOT NULL REFERENCES meetings(id),
  organization_id text NOT NULL,
  entry_type text NOT NULL,
  content text NOT NULL,
  author_user_id text NOT NULL,
  author_kind text NOT NULL DEFAULT 'human',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meeting_note_entries_meeting ON meeting_note_entries(meeting_id, created_at);
CREATE INDEX IF NOT EXISTS idx_meeting_note_entries_org ON meeting_note_entries(organization_id);
ALTER TABLE meeting_note_entries DROP CONSTRAINT IF EXISTS chk_meeting_note_entries_type;
ALTER TABLE meeting_note_entries ADD CONSTRAINT chk_meeting_note_entries_type CHECK (
  entry_type IN ('discussion', 'insight', 'question', 'risk', 'proposed_decision', 'proposed_task', 'parking_lot')
);
ALTER TABLE meeting_note_entries DROP CONSTRAINT IF EXISTS chk_meeting_note_entries_status;
ALTER TABLE meeting_note_entries ADD CONSTRAINT chk_meeting_note_entries_status CHECK (status IN ('active', 'archived'));
ALTER TABLE meeting_note_entries DROP CONSTRAINT IF EXISTS chk_meeting_note_entries_author_kind;
ALTER TABLE meeting_note_entries ADD CONSTRAINT chk_meeting_note_entries_author_kind CHECK (author_kind IN ('human', 'system'));

-- Output proposals (saga): PROPOSED -> APPROVED|REJECTED -> MATERIALIZED|
-- MATERIALIZATION_FAILED. `idempotency_key` is deterministic from
-- (meeting_id, id) — see meetingCore/outputs.ts — and is ALSO written onto
-- the materialized target row's own source_id column (tasks.source_id /
-- decisions.source_id, source_type='MEETING_OUTPUT') so a retry after a
-- partial failure can recognize an already-created target even if this row's
-- own canonical_id/status update never landed.
CREATE TABLE IF NOT EXISTS meeting_outputs (
  id text PRIMARY KEY,
  meeting_id text NOT NULL REFERENCES meetings(id),
  organization_id text NOT NULL,
  source_note_entry_id text REFERENCES meeting_note_entries(id),
  output_kind text NOT NULL,
  proposed_payload_json text NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'PROPOSED',
  canonical_id text,
  idempotency_key text NOT NULL,
  failure_reason text,
  proposed_by text NOT NULL,
  proposed_by_kind text NOT NULL DEFAULT 'human',
  reviewed_by text,
  reviewed_at timestamptz,
  materialized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_meeting_outputs_idempotency_key UNIQUE (idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_meeting_outputs_meeting ON meeting_outputs(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_outputs_org_status ON meeting_outputs(organization_id, status);
ALTER TABLE meeting_outputs DROP CONSTRAINT IF EXISTS chk_meeting_outputs_kind;
ALTER TABLE meeting_outputs ADD CONSTRAINT chk_meeting_outputs_kind CHECK (output_kind IN ('task', 'decision'));
ALTER TABLE meeting_outputs DROP CONSTRAINT IF EXISTS chk_meeting_outputs_status;
ALTER TABLE meeting_outputs ADD CONSTRAINT chk_meeting_outputs_status CHECK (
  status IN ('PROPOSED', 'APPROVED', 'REJECTED', 'MATERIALIZING', 'MATERIALIZED', 'MATERIALIZATION_FAILED')
);
ALTER TABLE meeting_outputs DROP CONSTRAINT IF EXISTS chk_meeting_outputs_proposed_by_kind;
ALTER TABLE meeting_outputs ADD CONSTRAINT chk_meeting_outputs_proposed_by_kind CHECK (proposed_by_kind IN ('human', 'system'));
