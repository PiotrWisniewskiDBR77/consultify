-- Migration: 044_multi_framework_audit
-- Description: Audit trail for multi-framework assessments
-- Author: Consultify Enterprise
-- Date: 2024-12-28

-- ============================================
-- AUDIT LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS multi_framework_audit_log (
    id BIGSERIAL PRIMARY KEY,
    
    -- Reference to assessment (nullable for org-level actions)
    assessment_id UUID REFERENCES multi_framework_assessments(id) ON DELETE SET NULL,
    
    -- Framework context
    framework VARCHAR(20),
    
    -- Action details
    action VARCHAR(50) NOT NULL,
    action_category VARCHAR(30) DEFAULT 'ASSESSMENT',
    
    -- Actor information
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_name VARCHAR(255),
    actor_email VARCHAR(255),
    actor_role VARCHAR(50),
    
    -- Data changes
    old_data JSONB,
    new_data JSONB,
    diff JSONB,
    
    -- Metadata
    entity_type VARCHAR(50) DEFAULT 'ASSESSMENT',
    entity_id UUID,
    entity_name VARCHAR(255),
    
    -- Context
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    
    -- Request metadata
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(100),
    
    -- Additional context
    notes TEXT,
    tags JSONB DEFAULT '[]',
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_mfal_assessment ON multi_framework_audit_log(assessment_id);
CREATE INDEX IF NOT EXISTS idx_mfal_framework ON multi_framework_audit_log(framework);
CREATE INDEX IF NOT EXISTS idx_mfal_action ON multi_framework_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_mfal_actor ON multi_framework_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_mfal_project ON multi_framework_audit_log(project_id);
CREATE INDEX IF NOT EXISTS idx_mfal_organization ON multi_framework_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_mfal_created_at ON multi_framework_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mfal_entity ON multi_framework_audit_log(entity_type, entity_id);

-- GIN index for JSONB searches
CREATE INDEX IF NOT EXISTS idx_mfal_tags_gin ON multi_framework_audit_log USING GIN (tags);

-- ============================================
-- ACTION DEFINITIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS multi_framework_audit_actions (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(30) NOT NULL,
    severity VARCHAR(20) DEFAULT 'INFO',
    requires_approval BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed action definitions
INSERT INTO multi_framework_audit_actions (code, name, description, category, severity) VALUES
    ('CREATE', 'Assessment Created', 'New assessment was created', 'ASSESSMENT', 'INFO'),
    ('UPDATE', 'Assessment Updated', 'Assessment data was modified', 'ASSESSMENT', 'INFO'),
    ('DELETE', 'Assessment Deleted', 'Assessment was deleted or archived', 'ASSESSMENT', 'WARNING'),
    ('RESTORE', 'Version Restored', 'Previous version was restored', 'ASSESSMENT', 'INFO'),
    ('SUBMIT_REVIEW', 'Submitted for Review', 'Assessment submitted for review', 'WORKFLOW', 'INFO'),
    ('APPROVE', 'Assessment Approved', 'Assessment was approved', 'WORKFLOW', 'INFO'),
    ('REJECT', 'Assessment Rejected', 'Assessment was rejected', 'WORKFLOW', 'WARNING'),
    ('ASSIGN_REVIEWER', 'Reviewer Assigned', 'Reviewer was assigned to assessment', 'WORKFLOW', 'INFO'),
    ('COMPLETE_REVIEW', 'Review Completed', 'Reviewer completed their review', 'WORKFLOW', 'INFO'),
    ('ADD_COMMENT', 'Comment Added', 'Comment was added to assessment', 'COLLABORATION', 'INFO'),
    ('RESOLVE_COMMENT', 'Comment Resolved', 'Comment was marked as resolved', 'COLLABORATION', 'INFO'),
    ('EXPORT_PDF', 'PDF Exported', 'Assessment was exported to PDF', 'EXPORT', 'INFO'),
    ('EXPORT_EXCEL', 'Excel Exported', 'Assessment was exported to Excel', 'EXPORT', 'INFO'),
    ('IMPORT_PDF', 'PDF Imported', 'Assessment was imported from PDF', 'IMPORT', 'INFO'),
    ('GENERATE_REPORT', 'Report Generated', 'Report was generated from assessment', 'REPORT', 'INFO'),
    ('GENERATE_INITIATIVES', 'Initiatives Generated', 'Initiatives were generated from gaps', 'INITIATIVE', 'INFO'),
    ('PERMISSION_CHANGE', 'Permission Changed', 'Access permissions were modified', 'SECURITY', 'WARNING'),
    ('BULK_UPDATE', 'Bulk Update', 'Multiple assessments were updated', 'ASSESSMENT', 'WARNING'),
    ('DATA_MIGRATION', 'Data Migrated', 'Assessment data was migrated', 'SYSTEM', 'INFO'),
    ('SCORE_RECALCULATE', 'Scores Recalculated', 'Assessment scores were recalculated', 'ASSESSMENT', 'INFO')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- RETENTION POLICY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS multi_framework_audit_retention (
    id SERIAL PRIMARY KEY,
    category VARCHAR(30) NOT NULL,
    retention_days INTEGER NOT NULL DEFAULT 365,
    archive_enabled BOOLEAN DEFAULT TRUE,
    archive_to VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default retention policies
INSERT INTO multi_framework_audit_retention (category, retention_days) VALUES
    ('ASSESSMENT', 730),  -- 2 years
    ('WORKFLOW', 730),
    ('COLLABORATION', 365),
    ('EXPORT', 180),
    ('IMPORT', 365),
    ('REPORT', 365),
    ('INITIATIVE', 365),
    ('SECURITY', 1095),  -- 3 years
    ('SYSTEM', 365)
ON CONFLICT DO NOTHING;

-- ============================================
-- VIEWS
-- ============================================

-- View: Recent audit log with actor details
CREATE OR REPLACE VIEW v_multi_framework_audit_recent AS
SELECT 
    al.*,
    a.name AS assessment_name,
    u.first_name || ' ' || u.last_name AS actor_full_name,
    aa.name AS action_name,
    aa.severity AS action_severity
FROM multi_framework_audit_log al
LEFT JOIN multi_framework_assessments a ON al.assessment_id = a.id
LEFT JOIN users u ON al.actor_id = u.id
LEFT JOIN multi_framework_audit_actions aa ON al.action = aa.code
ORDER BY al.created_at DESC;

-- View: Audit summary by action
CREATE OR REPLACE VIEW v_multi_framework_audit_summary AS
SELECT 
    action,
    framework,
    COUNT(*) AS count,
    MIN(created_at) AS first_occurrence,
    MAX(created_at) AS last_occurrence
FROM multi_framework_audit_log
GROUP BY action, framework
ORDER BY count DESC;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to calculate JSON diff
CREATE OR REPLACE FUNCTION calculate_json_diff(old_data JSONB, new_data JSONB)
RETURNS JSONB AS $$
DECLARE
    result JSONB := '{}';
    key TEXT;
BEGIN
    -- Find changed and added keys
    FOR key IN SELECT jsonb_object_keys(new_data) LOOP
        IF old_data->key IS DISTINCT FROM new_data->key THEN
            result := result || jsonb_build_object(key, jsonb_build_object(
                'old', old_data->key,
                'new', new_data->key
            ));
        END IF;
    END LOOP;
    
    -- Find removed keys
    FOR key IN SELECT jsonb_object_keys(old_data) LOOP
        IF NOT new_data ? key THEN
            result := result || jsonb_build_object(key, jsonb_build_object(
                'old', old_data->key,
                'new', null
            ));
        END IF;
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to log audit entry with automatic diff calculation
CREATE OR REPLACE FUNCTION log_mf_audit(
    p_assessment_id UUID,
    p_framework VARCHAR,
    p_action VARCHAR,
    p_actor_id UUID,
    p_old_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
    v_diff JSONB;
    v_id BIGINT;
    v_actor_name VARCHAR;
    v_actor_email VARCHAR;
    v_project_id UUID;
    v_org_id UUID;
BEGIN
    -- Calculate diff
    IF p_old_data IS NOT NULL AND p_new_data IS NOT NULL THEN
        v_diff := calculate_json_diff(p_old_data, p_new_data);
    ELSE
        v_diff := NULL;
    END IF;
    
    -- Get actor details
    SELECT first_name || ' ' || last_name, email 
    INTO v_actor_name, v_actor_email
    FROM users WHERE id = p_actor_id;
    
    -- Get assessment context
    IF p_assessment_id IS NOT NULL THEN
        SELECT project_id, organization_id 
        INTO v_project_id, v_org_id
        FROM multi_framework_assessments WHERE id = p_assessment_id;
    END IF;
    
    -- Insert audit log
    INSERT INTO multi_framework_audit_log (
        assessment_id, framework, action, actor_id, actor_name, actor_email,
        old_data, new_data, diff, project_id, organization_id,
        ip_address, user_agent, notes
    ) VALUES (
        p_assessment_id, p_framework, p_action, p_actor_id, v_actor_name, v_actor_email,
        p_old_data, p_new_data, v_diff, v_project_id, v_org_id,
        p_ip_address, p_user_agent, p_notes
    ) RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CLEANUP JOB (optional, run via cron)
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    r RECORD;
BEGIN
    FOR r IN SELECT category, retention_days FROM multi_framework_audit_retention LOOP
        DELETE FROM multi_framework_audit_log
        WHERE action IN (
            SELECT code FROM multi_framework_audit_actions WHERE category = r.category
        )
        AND created_at < NOW() - (r.retention_days || ' days')::INTERVAL;
        
        GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
    END LOOP;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE multi_framework_audit_log IS 'Complete audit trail for all multi-framework assessment actions';
COMMENT ON TABLE multi_framework_audit_actions IS 'Definitions of auditable actions with severity levels';
COMMENT ON TABLE multi_framework_audit_retention IS 'Retention policies for different audit categories';
COMMENT ON FUNCTION log_mf_audit IS 'Helper function to log audit entries with automatic diff calculation';



