-- Multi-Framework Assessment Tables Migration
-- 
-- This migration adds support for multiple assessment frameworks:
-- - SIRI (Smart Industry Readiness Index)
-- - ADMA (Advanced Digital Maturity Assessment)  
-- - CMMI (Capability Maturity Model Integration)
-- - Lean 4.0 / DBR77 (Pomierz-Zoptymalizuj-Automatyzuj)
--
-- Created: 2025-01-01

-- =====================================================
-- Table: multi_framework_assessments
-- Main table for all framework assessments
-- =====================================================

CREATE TABLE IF NOT EXISTS multi_framework_assessments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    framework TEXT NOT NULL CHECK (framework IN ('DRD', 'SIRI', 'ADMA', 'CMMI', 'LEAN')),
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED')),
    
    -- Framework-specific JSON data
    framework_data JSON,
    
    -- Import metadata (for PDF imports)
    import_source JSON,
    
    -- Progress tracking
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    completed_dimensions TEXT[], -- Array of completed dimension IDs
    total_dimensions INTEGER DEFAULT 0,
    
    -- Workflow
    workflow_status TEXT DEFAULT 'DRAFT',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL REFERENCES users(id),
    last_modified_by TEXT REFERENCES users(id)
);

-- Indexes for multi_framework_assessments
CREATE INDEX IF NOT EXISTS idx_mfa_project ON multi_framework_assessments(project_id);
CREATE INDEX IF NOT EXISTS idx_mfa_organization ON multi_framework_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_mfa_framework ON multi_framework_assessments(framework);
CREATE INDEX IF NOT EXISTS idx_mfa_status ON multi_framework_assessments(status);
CREATE INDEX IF NOT EXISTS idx_mfa_created_at ON multi_framework_assessments(created_at DESC);

-- =====================================================
-- Table: dbr77_processes
-- DBR77 Lean 4.0 - Process assessments
-- =====================================================

CREATE TABLE IF NOT EXISTS dbr77_processes (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL REFERENCES multi_framework_assessments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    department TEXT,
    category TEXT CHECK (category IN ('VALUE_STREAM', 'FLOW', 'SUPPORT', 'MANAGEMENT')),
    description TEXT,
    
    -- Phase 1: POMIERZ (Measure)
    current_state JSON,
    -- Expected structure:
    -- {
    --   "cycleTime": number,
    --   "taktTime": number,
    --   "leadTime": number,
    --   "wip": number,
    --   "defectRate": number,
    --   "oee": number,
    --   "valueAddedRatio": number,
    --   "throughput": number,
    --   "changeover": number,
    --   "uptime": number
    -- }
    
    -- Phase 2: ZOPTYMALIZUJ (Optimize - Lean)
    lean_assessment JSON,
    -- Expected structure:
    -- {
    --   "wasteIdentified": ["TRANSPORTATION", "INVENTORY", ...],
    --   "wasteImpact": {"TRANSPORTATION": 3, ...},
    --   "fiveSLevel": 1-5,
    --   "kanbanImplemented": boolean,
    --   "standardWorkDefined": boolean,
    --   "visualManagement": 1-5,
    --   "continuousFlow": 1-5,
    --   "pullSystem": boolean,
    --   "pokayoke": boolean,
    --   "tpm": 1-5
    -- }
    
    -- Phase 3: AUTOMATYZUJ (Automate)
    automation_potential JSON,
    -- Expected structure:
    -- {
    --   "feasibility": 1-5,
    --   "roi": number,
    --   "complexity": "LOW" | "MEDIUM" | "HIGH",
    --   "technologyReadiness": 1-5,
    --   "recommendedTechnologies": ["RPA", "AI_ML", ...],
    --   "humanInLoop": boolean,
    --   "estimatedCost": number,
    --   "estimatedSavings": number,
    --   "implementationTime": number,
    --   "riskLevel": "LOW" | "MEDIUM" | "HIGH"
    -- }
    
    priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
    owner TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for dbr77_processes
CREATE INDEX IF NOT EXISTS idx_dbr77_proc_assessment ON dbr77_processes(assessment_id);
CREATE INDEX IF NOT EXISTS idx_dbr77_proc_category ON dbr77_processes(category);
CREATE INDEX IF NOT EXISTS idx_dbr77_proc_priority ON dbr77_processes(priority);

-- =====================================================
-- Table: dbr77_workstations
-- DBR77 Lean 4.0 - Workstation/Role assessments
-- =====================================================

CREATE TABLE IF NOT EXISTS dbr77_workstations (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL REFERENCES multi_framework_assessments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    department TEXT,
    headcount INTEGER DEFAULT 1,
    description TEXT,
    
    -- Phase 1: POMIERZ (Measure)
    current_state JSON,
    -- Expected structure:
    -- {
    --   "tasksPerDay": number,
    --   "avgTaskTime": number,
    --   "errorRate": number,
    --   "overtimeHours": number,
    --   "skillLevel": 1-5,
    --   "toolsUsed": ["Excel", "SAP", ...],
    --   "digitalMaturity": 1-5,
    --   "satisfaction": 1-5,
    --   "utilization": number
    -- }
    
    -- Phase 2: ZOPTYMALIZUJ (Optimize - Lean)
    lean_assessment JSON,
    -- Expected structure:
    -- {
    --   "workplaceOrganization": 1-5,
    --   "standardizedWork": boolean,
    --   "wasteInRole": ["MOTION", "WAITING", ...],
    --   "wasteImpact": {"MOTION": 3, ...},
    --   "skillMatrix": boolean,
    --   "crossTraining": 1-5,
    --   "kaizen": number,
    --   "visualWorkInstructions": boolean,
    --   "workloadBalance": 1-5
    -- }
    
    -- Phase 3: AUTOMATYZUJ (Automate)
    automation_potential JSON,
    -- Expected structure:
    -- {
    --   "taskAutomationPercent": 0-100,
    --   "augmentationPercent": 0-100,
    --   "roleEvolution": "ELIMINATE" | "TRANSFORM" | "AUGMENT" | "MAINTAIN",
    --   "retrainingNeeded": boolean,
    --   "newSkillsRequired": ["Python", "AI basics", ...],
    --   "timeToAutomate": number,
    --   "estimatedSavings": number,
    --   "recommendedTechnologies": ["RPA", "NLP", ...],
    --   "changeManagementRisk": "LOW" | "MEDIUM" | "HIGH"
    -- }
    
    priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
    manager TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for dbr77_workstations
CREATE INDEX IF NOT EXISTS idx_dbr77_ws_assessment ON dbr77_workstations(assessment_id);
CREATE INDEX IF NOT EXISTS idx_dbr77_ws_department ON dbr77_workstations(department);
CREATE INDEX IF NOT EXISTS idx_dbr77_ws_priority ON dbr77_workstations(priority);

-- =====================================================
-- Table: framework_score_history
-- Track score changes over time for any framework
-- =====================================================

CREATE TABLE IF NOT EXISTS framework_score_history (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL REFERENCES multi_framework_assessments(id) ON DELETE CASCADE,
    dimension_id TEXT NOT NULL,
    previous_score DECIMAL(3,1),
    new_score DECIMAL(3,1),
    changed_by TEXT REFERENCES users(id),
    change_reason TEXT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for score history
CREATE INDEX IF NOT EXISTS idx_fsh_assessment ON framework_score_history(assessment_id);
CREATE INDEX IF NOT EXISTS idx_fsh_dimension ON framework_score_history(dimension_id);
CREATE INDEX IF NOT EXISTS idx_fsh_changed_at ON framework_score_history(changed_at DESC);

-- =====================================================
-- Table: framework_import_logs
-- Track PDF imports and AI parsing results
-- =====================================================

CREATE TABLE IF NOT EXISTS framework_import_logs (
    id TEXT PRIMARY KEY,
    assessment_id TEXT REFERENCES multi_framework_assessments(id) ON DELETE SET NULL,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    file_name TEXT NOT NULL,
    file_size INTEGER,
    file_path TEXT,
    
    detected_framework TEXT,
    detection_confidence DECIMAL(3,2),
    
    extraction_status TEXT CHECK (extraction_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    extraction_result JSON,
    extraction_error TEXT,
    
    imported_by TEXT NOT NULL REFERENCES users(id),
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Index for import logs
CREATE INDEX IF NOT EXISTS idx_fil_organization ON framework_import_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_fil_framework ON framework_import_logs(detected_framework);
CREATE INDEX IF NOT EXISTS idx_fil_status ON framework_import_logs(extraction_status);
CREATE INDEX IF NOT EXISTS idx_fil_imported_at ON framework_import_logs(imported_at DESC);

-- =====================================================
-- Add framework type to existing assessments table (if not exists)
-- =====================================================

DO $$ 
BEGIN
    -- Add framework_type column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assessments' AND column_name = 'framework_type'
    ) THEN
        ALTER TABLE assessments ADD COLUMN framework_type TEXT DEFAULT 'DRD';
    END IF;
    
    -- Add framework_data column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assessments' AND column_name = 'framework_data'
    ) THEN
        ALTER TABLE assessments ADD COLUMN framework_data JSON;
    END IF;
END $$;

-- =====================================================
-- Update timestamp trigger
-- =====================================================

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to new tables
DROP TRIGGER IF EXISTS update_mfa_modtime ON multi_framework_assessments;
CREATE TRIGGER update_mfa_modtime
    BEFORE UPDATE ON multi_framework_assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_dbr77_proc_modtime ON dbr77_processes;
CREATE TRIGGER update_dbr77_proc_modtime
    BEFORE UPDATE ON dbr77_processes
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_dbr77_ws_modtime ON dbr77_workstations;
CREATE TRIGGER update_dbr77_ws_modtime
    BEFORE UPDATE ON dbr77_workstations
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE multi_framework_assessments IS 'Main table for storing assessments across multiple frameworks (DRD, SIRI, ADMA, CMMI, LEAN)';
COMMENT ON TABLE dbr77_processes IS 'DBR77 Lean 4.0 process assessments with 3 phases: Measure, Optimize, Automate';
COMMENT ON TABLE dbr77_workstations IS 'DBR77 Lean 4.0 workstation/role assessments with 3 phases';
COMMENT ON TABLE framework_score_history IS 'Audit trail for assessment score changes';
COMMENT ON TABLE framework_import_logs IS 'Log of PDF imports and AI extraction results';




















