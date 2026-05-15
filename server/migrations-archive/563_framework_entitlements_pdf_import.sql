-- Migration 563: Framework entitlements + PDF import enhancements
-- Bundle 07: T030 (PDF Import) + T031 (Paid Assessments Integration)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS framework_entitlements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  framework_id TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'locked' CHECK (access_level IN ('locked', 'trial', 'full', 'educational')),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  granted_by TEXT REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, framework_id)
);

CREATE INDEX IF NOT EXISTS idx_framework_entitlements_org ON framework_entitlements(organization_id);
CREATE INDEX IF NOT EXISTS idx_framework_entitlements_framework ON framework_entitlements(framework_id);

INSERT OR IGNORE INTO framework_entitlements (organization_id, framework_id, access_level, notes)
SELECT o.id, 'SIRI', 'educational', 'Default educational access'
FROM organizations o WHERE o.is_active = 1;

INSERT OR IGNORE INTO framework_entitlements (organization_id, framework_id, access_level, notes)
SELECT o.id, 'ADMA', 'educational', 'Default educational access'
FROM organizations o WHERE o.is_active = 1;

INSERT OR IGNORE INTO framework_entitlements (organization_id, framework_id, access_level, notes)
SELECT o.id, 'CMMI', 'educational', 'Default educational access'
FROM organizations o WHERE o.is_active = 1;

INSERT OR IGNORE INTO framework_entitlements (organization_id, framework_id, access_level, notes)
SELECT o.id, 'DRD', 'full', 'Default proprietary access (bundled)'
FROM organizations o WHERE o.is_active = 1;

INSERT OR IGNORE INTO framework_entitlements (organization_id, framework_id, access_level, notes)
SELECT o.id, 'LEAN', 'full', 'Default proprietary access (bundled)'
FROM organizations o WHERE o.is_active = 1;

-- PDF import table enhancements
CREATE TABLE IF NOT EXISTS pdf_imports (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  target_type TEXT DEFAULT 'assessment',
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'uploaded',
  page_count INTEGER,
  error_message TEXT,
  file_path TEXT,
  detected_framework TEXT,
  confidence REAL DEFAULT 0,
  extracted_text TEXT,
  parsed_data TEXT,
  mapping_data TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE pdf_imports ADD COLUMN file_path TEXT;
ALTER TABLE pdf_imports ADD COLUMN detected_framework TEXT;
ALTER TABLE pdf_imports ADD COLUMN confidence REAL DEFAULT 0;
ALTER TABLE pdf_imports ADD COLUMN extracted_text TEXT;
ALTER TABLE pdf_imports ADD COLUMN parsed_data TEXT;
ALTER TABLE pdf_imports ADD COLUMN mapping_data TEXT;

CREATE INDEX IF NOT EXISTS idx_pdf_imports_org_status ON pdf_imports(organization_id, status);
