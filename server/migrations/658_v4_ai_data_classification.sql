-- V4-AI-05: Data classification & approval gate tables

CREATE TABLE IF NOT EXISTS ai_data_classifications (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  organization_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  data_class TEXT NOT NULL DEFAULT 'internal',
  classified_by TEXT DEFAULT 'system',
  classified_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, artifact_type, artifact_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_data_class_org ON ai_data_classifications(organization_id);

CREATE TABLE IF NOT EXISTS ai_approval_requests (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  data_class TEXT NOT NULL,
  context_json TEXT,
  status TEXT DEFAULT 'pending',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_approval_org ON ai_approval_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_approval_status ON ai_approval_requests(status);
