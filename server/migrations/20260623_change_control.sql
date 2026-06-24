-- ── M14/F5 (5.5): change-control RFC/CAB layer on rollout_changes ──────────
-- Lightweight RFC/CAB metadata + auto-emit support. Additive only.
ALTER TABLE rollout_changes ADD COLUMN IF NOT EXISTS change_class TEXT;   -- standard | normal | emergency
ALTER TABLE rollout_changes ADD COLUMN IF NOT EXISTS requested_by TEXT;
ALTER TABLE rollout_changes ADD COLUMN IF NOT EXISTS assessment TEXT;
ALTER TABLE rollout_changes ADD COLUMN IF NOT EXISTS decision_date TEXT;
