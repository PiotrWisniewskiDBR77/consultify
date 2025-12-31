-- Migration: Organization Profiles for Enterprise AI Consulting
-- Version: 050
-- Description: Extended organization profiles for BCG/McKinsey-level strategic context

-- ============================================
-- ORGANIZATION PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS organization_profiles (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    
    -- Industry Context
    industry TEXT,
    industry_code TEXT,                    -- NAICS/GICS code
    industry_subsector TEXT,
    
    -- Company Info
    company_size TEXT CHECK(company_size IN ('STARTUP', 'SMB', 'MID_MARKET', 'ENTERPRISE')),
    employee_count INTEGER,
    annual_revenue REAL,
    founding_year INTEGER,
    headquarters_country TEXT,
    
    -- Strategic Context
    strategic_priorities TEXT DEFAULT '[]',     -- JSON array of top priorities
    competitive_position TEXT CHECK(competitive_position IN ('LEADER', 'CHALLENGER', 'FOLLOWER', 'NICHE')),
    growth_stage TEXT CHECK(growth_stage IN ('STARTUP', 'SCALE_UP', 'MATURE', 'TURNAROUND')),
    mission_statement TEXT,
    vision_statement TEXT,
    
    -- Digital Context
    digital_maturity_overall REAL,
    technology_stack TEXT DEFAULT '[]',         -- JSON array of technologies
    digital_budget_percent REAL,
    cloud_adoption_level TEXT CHECK(cloud_adoption_level IN ('NONE', 'EXPLORING', 'PARTIAL', 'CLOUD_FIRST', 'CLOUD_NATIVE')),
    
    -- Market Context
    primary_markets TEXT DEFAULT '[]',          -- JSON array of geographic regions
    customer_segments TEXT DEFAULT '[]',        -- JSON array: B2B, B2C, B2B2C, etc.
    key_competitors TEXT DEFAULT '[]',          -- JSON array of competitor names
    market_share_estimate REAL,                 -- Percentage
    
    -- Constraints
    regulatory_environment TEXT DEFAULT '[]',   -- JSON array: GDPR, SOX, HIPAA, etc.
    risk_appetite TEXT DEFAULT 'MODERATE' CHECK(risk_appetite IN ('CONSERVATIVE', 'MODERATE', 'AGGRESSIVE')),
    budget_constraints TEXT,                    -- Description of budget limitations
    timeline_constraints TEXT,                  -- Description of timeline pressures
    
    -- AI Context (for personalized AI responses)
    preferred_language TEXT DEFAULT 'pl',
    communication_style TEXT DEFAULT 'PROFESSIONAL' CHECK(communication_style IN ('FORMAL', 'PROFESSIONAL', 'CASUAL')),
    industry_jargon_level TEXT DEFAULT 'MEDIUM' CHECK(industry_jargon_level IN ('LOW', 'MEDIUM', 'HIGH')),
    
    -- Metadata
    last_assessment_date DATETIME,
    profile_completeness REAL DEFAULT 0,        -- 0-100 percentage
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT,
    
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_org_profiles_org_id ON organization_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_profiles_industry ON organization_profiles(industry);

-- ============================================
-- INDUSTRY INTELLIGENCE CACHE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS industry_intelligence_cache (
    id TEXT PRIMARY KEY,
    industry TEXT NOT NULL,
    industry_subsector TEXT,
    
    -- Cached Data
    trends_data TEXT,                           -- JSON: industry trends
    benchmarks_data TEXT,                       -- JSON: maturity benchmarks
    news_data TEXT,                             -- JSON: recent news items
    competitor_data TEXT,                       -- JSON: competitor activity
    
    -- Source & Freshness
    data_source TEXT DEFAULT 'tavily',
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_valid INTEGER DEFAULT 1,
    
    -- Quality
    confidence_score REAL DEFAULT 0.5,
    sources_count INTEGER DEFAULT 0,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_industry_cache_industry ON industry_intelligence_cache(industry);
CREATE INDEX IF NOT EXISTS idx_industry_cache_expires ON industry_intelligence_cache(expires_at);

-- ============================================
-- FRAMEWORK ANALYSIS RESULTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS framework_analyses (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    assessment_id TEXT,
    
    -- Framework Info
    framework_type TEXT NOT NULL CHECK(framework_type IN (
        'BCG_GROWTH_SHARE', 'MCKINSEY_7S', 'PORTER_5_FORCES', 
        'PESTLE', 'VALUE_CHAIN', 'SWOT', 'CUSTOM'
    )),
    framework_version TEXT DEFAULT '1.0',
    
    -- Analysis Results
    analysis_data TEXT NOT NULL,                -- JSON: full analysis results
    summary TEXT,                               -- Executive summary of analysis
    key_findings TEXT DEFAULT '[]',             -- JSON array of key findings
    recommendations TEXT DEFAULT '[]',          -- JSON array of recommendations
    
    -- Scoring
    overall_score REAL,
    dimension_scores TEXT DEFAULT '{}',         -- JSON: scores per dimension
    
    -- Metadata
    generated_by TEXT DEFAULT 'AI',
    confidence_level TEXT DEFAULT 'MEDIUM' CHECK(confidence_level IN ('LOW', 'MEDIUM', 'HIGH')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(assessment_id) REFERENCES maturity_assessments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_framework_analyses_org ON framework_analyses(organization_id);
CREATE INDEX IF NOT EXISTS idx_framework_analyses_type ON framework_analyses(framework_type);

-- ============================================
-- ENTERPRISE REPORT GENERATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS enterprise_report_generations (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    
    -- Pipeline Status
    pipeline_status TEXT DEFAULT 'PENDING' CHECK(pipeline_status IN (
        'PENDING', 'GATHERING_CONTEXT', 'ANALYST_WORKING', 'STRATEGIST_WORKING',
        'VALIDATOR_WORKING', 'REPORTER_WORKING', 'ASSEMBLING', 'COMPLETED', 'FAILED'
    )),
    current_agent TEXT,
    progress_percent INTEGER DEFAULT 0,
    
    -- Agent Outputs
    analyst_output TEXT,                        -- JSON: analyst findings
    strategist_output TEXT,                     -- JSON: strategic recommendations
    validator_output TEXT,                      -- JSON: validation results
    reporter_output TEXT,                       -- JSON: final report sections
    
    -- Context Used
    industry_context_used TEXT,                 -- JSON: snapshot of industry data used
    frameworks_applied TEXT DEFAULT '[]',       -- JSON array of frameworks used
    
    -- Quality Metrics
    overall_confidence REAL,
    validation_score REAL,
    sources_count INTEGER DEFAULT 0,
    
    -- Timing
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    duration_ms INTEGER,
    
    -- Error Handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    created_by TEXT,
    
    FOREIGN KEY(report_id) REFERENCES assessment_reports(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_enterprise_reports_status ON enterprise_report_generations(pipeline_status);
CREATE INDEX IF NOT EXISTS idx_enterprise_reports_report ON enterprise_report_generations(report_id);

-- ============================================
-- ASSESSMENT LEVEL ATTACHMENTS TABLE
-- For attaching evidence files to specific maturity levels
-- ============================================
CREATE TABLE IF NOT EXISTS assessment_level_attachments (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    
    -- Level identification
    axis_id TEXT NOT NULL,                      -- e.g., 'processes', 'digitalProducts', 'culture'
    area_id TEXT,                               -- e.g., 'sales', 'marketing' (functional area)
    level_number INTEGER NOT NULL,              -- 1-7
    attachment_type TEXT DEFAULT 'EVIDENCE' CHECK(attachment_type IN ('EVIDENCE', 'SCREENSHOT', 'DOCUMENT', 'REPORT', 'OTHER')),
    
    -- File info
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    
    -- Metadata
    description TEXT,
    uploaded_by TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    
    -- AI Analysis (optional)
    ai_analysis TEXT,                           -- JSON: AI's analysis of the document
    ai_suggested_score INTEGER,                 -- AI's suggested score based on evidence
    ai_confidence REAL,                         -- 0-1 confidence score
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(assessment_id) REFERENCES maturity_assessments(id) ON DELETE CASCADE,
    FOREIGN KEY(uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_level_attachments_assessment ON assessment_level_attachments(assessment_id);
CREATE INDEX IF NOT EXISTS idx_level_attachments_axis ON assessment_level_attachments(axis_id);
CREATE INDEX IF NOT EXISTS idx_level_attachments_level ON assessment_level_attachments(level_number);
CREATE INDEX IF NOT EXISTS idx_level_attachments_org ON assessment_level_attachments(organization_id);

