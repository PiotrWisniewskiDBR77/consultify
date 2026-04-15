-- V4-EXEC-05: Closed-loop workarounds (signal → RAID → mitigation → task → verify → close)
CREATE TABLE IF NOT EXISTS closed_loop_workarounds (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  organization_id TEXT NOT NULL,
  initiative_id TEXT NOT NULL,
  signal_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  raid_item_id TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  steps_json TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_closed_loop_org ON closed_loop_workarounds(organization_id);
CREATE INDEX IF NOT EXISTS idx_closed_loop_initiative ON closed_loop_workarounds(initiative_id);
CREATE INDEX IF NOT EXISTS idx_closed_loop_status ON closed_loop_workarounds(status);
