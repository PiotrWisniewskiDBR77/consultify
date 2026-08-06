-- Migration 730: Fix missing columns and tables for beta launch
-- Addresses: decisions, assessments, initiatives, notebook_pages, ideas, partner_users, organization_metadata, ai_contexts, assessment_initiative_batches

-- 1. decisions: add missing columns
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'MEDIUM';
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS impact TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS escalation_level TEXT DEFAULT 'NORMAL';
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS pmo_domain TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS required TEXT DEFAULT '[]';
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS decision_owner_id TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS context_type TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS context_id TEXT;

-- 2. assessments: add missing columns
-- Fresh PostgreSQL bootstrap owns only the compact core schema and may not
-- have replayed the legacy 000/293 files. Establish the canonical base before
-- applying this migration's additive assessment extensions.
CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT,
    name TEXT,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS framework_type TEXT DEFAULT 'DRD';
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS framework_data JSONB DEFAULT '{}';
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS framework TEXT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS overall_score REAL;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS maturity_level TEXT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS source_reference TEXT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS report_generated_at TIMESTAMPTZ;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS initiatives_generated INTEGER DEFAULT 0;

-- 3. initiatives: add missing columns
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS program_id TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS stage TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS description TEXT;
CREATE INDEX IF NOT EXISTS idx_initiatives_program ON initiatives(program_id);

-- 4. Create missing tables

CREATE TABLE IF NOT EXISTS ideas (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    stage TEXT DEFAULT 'draft',
    category TEXT,
    source TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ideas_org ON ideas(organization_id);
CREATE INDEX IF NOT EXISTS idx_ideas_created_by ON ideas(created_by);

CREATE TABLE IF NOT EXISTS partner_users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL,
    partner_org_id TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    role TEXT DEFAULT 'consultant',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_partner_users_user ON partner_users(user_id);

CREATE TABLE IF NOT EXISTS organization_metadata (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    value_type TEXT DEFAULT 'text',
    category TEXT,
    is_sensitive INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(organization_id, key)
);
CREATE INDEX IF NOT EXISTS idx_org_metadata_org ON organization_metadata(organization_id);

CREATE TABLE IF NOT EXISTS ai_contexts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'general',
    content TEXT,
    priority INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
ALTER TABLE ai_contexts ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE ai_contexts ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE ai_contexts ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'general';
ALTER TABLE ai_contexts ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE ai_contexts ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
ALTER TABLE ai_contexts ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1;
ALTER TABLE ai_contexts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_ai_contexts_org ON ai_contexts(organization_id);

CREATE TABLE IF NOT EXISTS assessment_initiative_batches (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    assessment_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    batch_name TEXT,
    status TEXT DEFAULT 'pending',
    initiatives_count INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
ALTER TABLE assessment_initiative_batches ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE assessment_initiative_batches ADD COLUMN IF NOT EXISTS batch_name TEXT;
ALTER TABLE assessment_initiative_batches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE assessment_initiative_batches ADD COLUMN IF NOT EXISTS initiatives_count INTEGER DEFAULT 0;
ALTER TABLE assessment_initiative_batches ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE assessment_initiative_batches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_aib_assessment ON assessment_initiative_batches(assessment_id);
CREATE INDEX IF NOT EXISTS idx_aib_org ON assessment_initiative_batches(organization_id);
