-- Migration: 043_multi_framework_assessments_complete
-- Description: Complete multi-framework assessment support for SIRI, ADMA, CMMI, LEAN
-- Author: Consultify Enterprise
-- Date: 2024-12-28

-- ============================================
-- MAIN ASSESSMENT TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS multi_framework_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    framework VARCHAR(20) NOT NULL CHECK (framework IN ('SIRI', 'ADMA', 'CMMI', 'LEAN')),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(30) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'IN_REVIEW', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'ARCHIVED')),
    
    -- Framework-specific assessment data (JSONB for flexibility)
    data JSONB NOT NULL DEFAULT '{}',
    
    -- Calculated scores (cached for performance)
    overall_score DECIMAL(3,2),
    category_scores JSONB DEFAULT '{}',
    
    -- Import metadata (for PDF imports)
    import_source JSONB,
    
    -- Workflow tracking
    submitted_at TIMESTAMPTZ,
    submitted_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
    rejected_at TIMESTAMPTZ,
    rejected_by UUID REFERENCES users(id),
    rejection_reason TEXT,
    
    -- Versioning
    version INTEGER DEFAULT 1,
    previous_version_id UUID REFERENCES multi_framework_assessments(id),
    
    -- Audit fields
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    
    -- Uniqueness constraint
    UNIQUE(project_id, framework, name)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_mfa_project ON multi_framework_assessments(project_id);
CREATE INDEX IF NOT EXISTS idx_mfa_organization ON multi_framework_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_mfa_framework ON multi_framework_assessments(framework);
CREATE INDEX IF NOT EXISTS idx_mfa_status ON multi_framework_assessments(status);
CREATE INDEX IF NOT EXISTS idx_mfa_created_by ON multi_framework_assessments(created_by);
CREATE INDEX IF NOT EXISTS idx_mfa_created_at ON multi_framework_assessments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mfa_overall_score ON multi_framework_assessments(overall_score);

-- GIN index for JSONB data queries
CREATE INDEX IF NOT EXISTS idx_mfa_data_gin ON multi_framework_assessments USING GIN (data);
CREATE INDEX IF NOT EXISTS idx_mfa_category_scores_gin ON multi_framework_assessments USING GIN (category_scores);

-- ============================================
-- VERSION HISTORY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS multi_framework_assessment_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES multi_framework_assessments(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    data JSONB NOT NULL,
    overall_score DECIMAL(3,2),
    category_scores JSONB,
    change_summary TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(assessment_id, version)
);

CREATE INDEX IF NOT EXISTS idx_mfav_assessment ON multi_framework_assessment_versions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_mfav_version ON multi_framework_assessment_versions(assessment_id, version DESC);

-- ============================================
-- REVIEWER ASSIGNMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS multi_framework_assessment_reviewers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES multi_framework_assessments(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(50) DEFAULT 'REVIEWER',
    status VARCHAR(30) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'DECLINED')),
    feedback TEXT,
    score INTEGER CHECK (score >= 1 AND score <= 5),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    UNIQUE(assessment_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_mfar_assessment ON multi_framework_assessment_reviewers(assessment_id);
CREATE INDEX IF NOT EXISTS idx_mfar_reviewer ON multi_framework_assessment_reviewers(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_mfar_status ON multi_framework_assessment_reviewers(status);

-- ============================================
-- COMMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS multi_framework_assessment_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES multi_framework_assessments(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES multi_framework_assessment_comments(id),
    author_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    
    -- Optional: target specific dimension/area
    target_dimension VARCHAR(100),
    target_area VARCHAR(100),
    
    -- Status for resolution tracking
    status VARCHAR(30) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'WONT_FIX')),
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfac_assessment ON multi_framework_assessment_comments(assessment_id);
CREATE INDEX IF NOT EXISTS idx_mfac_author ON multi_framework_assessment_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_mfac_parent ON multi_framework_assessment_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_mfac_status ON multi_framework_assessment_comments(status);

-- ============================================
-- REPORTS TABLE (Framework-specific reports)
-- ============================================

CREATE TABLE IF NOT EXISTS multi_framework_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES multi_framework_assessments(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    framework VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(30) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FINAL', 'ARCHIVED')),
    
    -- Report content (rendered HTML/JSON)
    content JSONB NOT NULL DEFAULT '{}',
    sections JSONB DEFAULT '[]',
    
    -- Executive summary (AI-generated or manual)
    executive_summary TEXT,
    key_findings JSONB DEFAULT '[]',
    recommendations JSONB DEFAULT '[]',
    
    -- PDF export cache
    pdf_url TEXT,
    pdf_generated_at TIMESTAMPTZ,
    
    -- Audit fields
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    finalized_at TIMESTAMPTZ,
    finalized_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_mfr_assessment ON multi_framework_reports(assessment_id);
CREATE INDEX IF NOT EXISTS idx_mfr_project ON multi_framework_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_mfr_framework ON multi_framework_reports(framework);
CREATE INDEX IF NOT EXISTS idx_mfr_status ON multi_framework_reports(status);

-- ============================================
-- INITIATIVES FROM MULTI-FRAMEWORK
-- ============================================

CREATE TABLE IF NOT EXISTS multi_framework_initiatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID REFERENCES multi_framework_assessments(id) ON DELETE SET NULL,
    report_id UUID REFERENCES multi_framework_reports(id) ON DELETE SET NULL,
    project_id UUID NOT NULL REFERENCES projects(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    framework VARCHAR(20) NOT NULL,
    
    -- Initiative details
    title VARCHAR(500) NOT NULL,
    description TEXT,
    rationale TEXT,
    
    -- Source dimension/gap info
    source_dimension VARCHAR(100),
    source_area VARCHAR(100),
    gap_score DECIMAL(3,2),
    
    -- Prioritization
    priority VARCHAR(20) DEFAULT 'MEDIUM' CHECK (priority IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    effort_estimate VARCHAR(20) CHECK (effort_estimate IN ('XS', 'S', 'M', 'L', 'XL')),
    impact_score INTEGER CHECK (impact_score >= 1 AND impact_score <= 10),
    
    -- Status
    status VARCHAR(30) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PROPOSED', 'APPROVED', 'IN_ROADMAP', 'IN_PROGRESS', 'DONE', 'CANCELLED')),
    
    -- Technologies/methods recommended
    recommended_technologies JSONB DEFAULT '[]',
    expected_outcomes JSONB DEFAULT '[]',
    
    -- Audit fields
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfi_assessment ON multi_framework_initiatives(assessment_id);
CREATE INDEX IF NOT EXISTS idx_mfi_report ON multi_framework_initiatives(report_id);
CREATE INDEX IF NOT EXISTS idx_mfi_project ON multi_framework_initiatives(project_id);
CREATE INDEX IF NOT EXISTS idx_mfi_framework ON multi_framework_initiatives(framework);
CREATE INDEX IF NOT EXISTS idx_mfi_status ON multi_framework_initiatives(status);
CREATE INDEX IF NOT EXISTS idx_mfi_priority ON multi_framework_initiatives(priority);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mfa_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for multi_framework_assessments
DROP TRIGGER IF EXISTS trigger_mfa_updated_at ON multi_framework_assessments;
CREATE TRIGGER trigger_mfa_updated_at
    BEFORE UPDATE ON multi_framework_assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_mfa_updated_at();

-- Trigger for multi_framework_reports
DROP TRIGGER IF EXISTS trigger_mfr_updated_at ON multi_framework_reports;
CREATE TRIGGER trigger_mfr_updated_at
    BEFORE UPDATE ON multi_framework_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_mfa_updated_at();

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Assessment summary with latest status
CREATE OR REPLACE VIEW v_multi_framework_assessment_summary AS
SELECT 
    mfa.id,
    mfa.project_id,
    mfa.organization_id,
    mfa.framework,
    mfa.name,
    mfa.status,
    mfa.overall_score,
    mfa.version,
    mfa.created_at,
    mfa.updated_at,
    u.first_name || ' ' || u.last_name AS created_by_name,
    p.name AS project_name,
    o.name AS organization_name,
    (SELECT COUNT(*) FROM multi_framework_assessment_reviewers r WHERE r.assessment_id = mfa.id) AS reviewer_count,
    (SELECT COUNT(*) FROM multi_framework_assessment_reviewers r WHERE r.assessment_id = mfa.id AND r.status = 'COMPLETED') AS completed_reviews,
    (SELECT COUNT(*) FROM multi_framework_assessment_comments c WHERE c.assessment_id = mfa.id AND c.status = 'OPEN') AS open_comments
FROM multi_framework_assessments mfa
LEFT JOIN users u ON mfa.created_by = u.id
LEFT JOIN projects p ON mfa.project_id = p.id
LEFT JOIN organizations o ON mfa.organization_id = o.id;

-- ============================================
-- GRANT PERMISSIONS (adjust as needed)
-- ============================================

-- Grant permissions to application role (if exists)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO consultify_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO consultify_app;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

COMMENT ON TABLE multi_framework_assessments IS 'Multi-framework assessment storage for SIRI, ADMA, CMMI, and LEAN 4.0 assessments';
COMMENT ON TABLE multi_framework_assessment_versions IS 'Version history for multi-framework assessments';
COMMENT ON TABLE multi_framework_assessment_reviewers IS 'Reviewer assignments for assessment workflow';
COMMENT ON TABLE multi_framework_assessment_comments IS 'Comments and feedback on assessments';
COMMENT ON TABLE multi_framework_reports IS 'Generated reports from framework assessments';
COMMENT ON TABLE multi_framework_initiatives IS 'Initiatives generated from assessment gaps';














