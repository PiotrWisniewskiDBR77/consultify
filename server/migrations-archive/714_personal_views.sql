-- Personal views: allow users to create views visible only to themselves
ALTER TABLE tp_views ADD COLUMN IF NOT EXISTS is_personal BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tp_views ADD COLUMN IF NOT EXISTS owner_id TEXT;
