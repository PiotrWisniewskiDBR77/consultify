-- T108: SuperAdmin guardrails
CREATE TABLE IF NOT EXISTS superadmin_confirmed_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id),
  action_type TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  reason TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'medium',
  confirmed_at TIMESTAMP DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_confirmed_actions_admin ON superadmin_confirmed_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_confirmed_actions_type ON superadmin_confirmed_actions(action_type);
CREATE TABLE IF NOT EXISTS superadmin_impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id),
  target_user_id UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  ip_address TEXT,
  is_active BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_impersonation_admin ON superadmin_impersonation_sessions(admin_id);
