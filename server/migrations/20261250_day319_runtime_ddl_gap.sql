CREATE TABLE IF NOT EXISTS project_role_templates (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  role_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  is_factory INTEGER DEFAULT 0,
  is_required INTEGER DEFAULT 0,
  is_enabled INTEGER DEFAULT 1,
  capabilities_json TEXT DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, role_key)
);

CREATE TABLE IF NOT EXISTS project_role_overrides (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  role_key TEXT NOT NULL,
  capabilities_json TEXT DEFAULT '[]',
  is_enabled INTEGER DEFAULT 1,
  fallback_role_key TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (project_id, role_key)
);

CREATE TABLE IF NOT EXISTS user_consents (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id),
  organization_id VARCHAR(36) NOT NULL REFERENCES organizations(id),
  consent_type VARCHAR(100) NOT NULL,
  consent_version VARCHAR(50),
  consent_status VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  granted_at TIMESTAMP,
  withdrawn_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, organization_id, consent_type)
);
CREATE INDEX IF NOT EXISTS idx_user_consents_user ON user_consents(user_id);

CREATE TABLE IF NOT EXISTS ai_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'new',
  priority VARCHAR(50) DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  category VARCHAR(50),
  confidence_score REAL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mfa_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('TOTP', 'BACKUP_CODE', 'SMS', 'EMAIL')),
  success INTEGER NOT NULL DEFAULT 0,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mfa_attempts_user_time ON mfa_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mfa_attempts_ip ON mfa_attempts(ip_address, created_at DESC);

CREATE TABLE IF NOT EXISTS scheduled_emails (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  recipients TEXT NOT NULL,
  scheduled_time TIMESTAMP NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  sent_at TIMESTAMP,
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status_time ON scheduled_emails(status, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_report ON scheduled_emails(report_id);
