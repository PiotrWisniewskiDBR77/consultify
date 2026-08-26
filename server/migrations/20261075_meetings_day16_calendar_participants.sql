-- Meetings day 16 (DEC-58 / DEC-82).
-- Additive only: shared demo database remains backward compatible.

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recurrence_rule TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recurrence_parent_id TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recurrence_exception_at TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recurrence_exdate_json TEXT DEFAULT '[]';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recurrence_status TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS split_from_meeting_id TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS invitation_sequence INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS meeting_participants (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  meeting_id TEXT NOT NULL,
  participant_kind TEXT NOT NULL CHECK (participant_kind IN ('user', 'guest')),
  user_id TEXT,
  email TEXT,
  display_name TEXT DEFAULT '',
  role TEXT DEFAULT 'attendee' CHECK (role IN ('organizer', 'attendee', 'optional')),
  invitation_status TEXT DEFAULT 'invited' CHECK (invitation_status IN ('invited', 'accepted', 'declined', 'tentative', 'no_response')),
  delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed', 'blocked_demo', 'captured')),
  delivery_at TEXT,
  delivery_error TEXT,
  responded_at TEXT,
  invited_by TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_meeting_participants_org_meeting
  ON meeting_participants(organization_id, meeting_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_meeting_participant_user
  ON meeting_participants(meeting_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_meeting_participant_guest
  ON meeting_participants(meeting_id, lower(email)) WHERE email IS NOT NULL;

INSERT INTO meeting_participants (
  id, organization_id, meeting_id, participant_kind, user_id, display_name,
  role, invitation_status, delivery_status, invited_by, created_at, updated_at
)
SELECT
  'meeting-participant-organizer-' || m.id,
  m.organization_id,
  m.id,
  'user',
  m.created_by,
  '',
  'organizer',
  'accepted',
  'pending',
  m.created_by,
  COALESCE(m.created_at, now()::text),
  COALESCE(m.updated_at, now()::text)
FROM meetings m
ON CONFLICT DO NOTHING;

INSERT INTO meeting_participants (
  id, organization_id, meeting_id, participant_kind, display_name,
  role, invitation_status, delivery_status, invited_by, created_at, updated_at
)
SELECT
  'meeting-participant-legacy-' || md5(m.id || ':' || legacy.name),
  m.organization_id,
  m.id,
  'guest',
  legacy.name,
  'attendee',
  'no_response',
  'pending',
  m.created_by,
  COALESCE(m.created_at, now()::text),
  COALESCE(m.updated_at, now()::text)
FROM meetings m
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE
    WHEN m.attendees_json IS NULL OR btrim(m.attendees_json) = '' THEN '[]'::jsonb
    WHEN left(btrim(m.attendees_json), 1) = '[' THEN m.attendees_json::jsonb
    ELSE '[]'::jsonb
  END
) AS legacy(name)
WHERE btrim(legacy.name) <> ''
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS meeting_attachments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  meeting_id TEXT NOT NULL,
  artifact_kind TEXT NOT NULL CHECK (artifact_kind IN ('idea', 'note', 'material')),
  artifact_id TEXT NOT NULL,
  title_snapshot TEXT DEFAULT '',
  attached_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (meeting_id, artifact_kind, artifact_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_attachments_org_meeting
  ON meeting_attachments(organization_id, meeting_id);

CREATE TABLE IF NOT EXISTS meeting_invitation_deliveries (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  meeting_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  method TEXT NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 0,
  delivery_status TEXT NOT NULL,
  attempted_by TEXT NOT NULL,
  attempted_at TEXT NOT NULL,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_meeting_invitation_deliveries_lookup
  ON meeting_invitation_deliveries(organization_id, meeting_id, participant_id, attempted_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_meeting_occurrence_exception
  ON meetings(recurrence_parent_id, recurrence_exception_at)
  WHERE recurrence_parent_id IS NOT NULL AND recurrence_exception_at IS NOT NULL;
