-- Admin komplet 55, Fala 3 — tenant-scope for customer-admin break-glass sessions.
-- Additive and idempotent.
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS organization_id TEXT;
CREATE INDEX IF NOT EXISTS idx_admin_sessions_organization_id ON admin_sessions (organization_id);
