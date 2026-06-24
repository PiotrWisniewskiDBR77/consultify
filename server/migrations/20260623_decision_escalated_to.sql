-- M14/F3 — real decision escalation.
-- Adds `escalated_to` so an escalated decision records WHO it was routed to
-- (the initiative sponsor), instead of a flat status flip with no target.
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS escalated_to TEXT;
CREATE INDEX IF NOT EXISTS idx_decisions_escalated_to
  ON decisions(organization_id, escalated_to)
  WHERE escalated_to IS NOT NULL;
