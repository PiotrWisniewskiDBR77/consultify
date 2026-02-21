-- Migration 563: Framework entitlements + PDF import enhancements
-- Bundle 07: T030 (PDF Import) + T031 (Paid Assessments Integration)

CREATE TABLE IF NOT EXISTS framework_entitlements (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
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
ALTER TABLE pdf_imports ADD COLUMN file_path TEXT;
ALTER TABLE pdf_imports ADD COLUMN detected_framework TEXT;
ALTER TABLE pdf_imports ADD COLUMN confidence REAL DEFAULT 0;
ALTER TABLE pdf_imports ADD COLUMN extracted_text TEXT;
ALTER TABLE pdf_imports ADD COLUMN parsed_data TEXT;
ALTER TABLE pdf_imports ADD COLUMN mapping_data TEXT;

CREATE INDEX IF NOT EXISTS idx_pdf_imports_org_status ON pdf_imports(organization_id, status);
