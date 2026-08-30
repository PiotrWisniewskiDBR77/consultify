CREATE TABLE IF NOT EXISTS object_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type TEXT NOT NULL CHECK (object_type IN ('task', 'decision')),
  object_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  storage_key TEXT NOT NULL UNIQUE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_object_attachments_object
  ON object_attachments (object_type, object_id);

CREATE INDEX IF NOT EXISTS idx_object_attachments_organization
  ON object_attachments (organization_id);
