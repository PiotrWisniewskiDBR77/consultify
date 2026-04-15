-- P15 Tabele: 7-role permission model for base members
-- Roles: base_owner, schema_editor, data_editor, view_editor, interface_builder, viewer, form_submitter

CREATE TABLE IF NOT EXISTS tp_base_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES tp_bases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN (
    'base_owner',
    'schema_editor',
    'data_editor',
    'view_editor',
    'interface_builder',
    'viewer',
    'form_submitter'
  )),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(base_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tp_base_members_base_id ON tp_base_members(base_id);
CREATE INDEX IF NOT EXISTS idx_tp_base_members_user_id ON tp_base_members(user_id);
