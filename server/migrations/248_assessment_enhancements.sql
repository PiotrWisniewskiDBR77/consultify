-- FLOW-ASSESSMENT-001: Assessment Execution Enhancements
-- Migration: 248_assessment_enhancements.sql

-- ==========================================
-- ASSESSMENTS TABLE ENHANCEMENTS
-- ==========================================

-- Add framework and source tracking
ALTER TABLE assessments ADD COLUMN framework TEXT DEFAULT 'DRD';
ALTER TABLE assessments ADD COLUMN overall_score REAL;
ALTER TABLE assessments ADD COLUMN maturity_level INTEGER;
ALTER TABLE assessments ADD COLUMN source_type TEXT DEFAULT 'manual';
ALTER TABLE assessments ADD COLUMN source_reference TEXT;
ALTER TABLE assessments ADD COLUMN started_at TIMESTAMP;
ALTER TABLE assessments ADD COLUMN completed_at TIMESTAMP;
ALTER TABLE assessments ADD COLUMN project_id TEXT;
ALTER TABLE assessments ADD COLUMN report_generated_at TIMESTAMP;
ALTER TABLE assessments ADD COLUMN initiatives_generated INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_assessments_framework ON assessments(framework);
CREATE INDEX IF NOT EXISTS idx_assessments_project ON assessments(project_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);

-- ==========================================
-- ASSESSMENT FRAMEWORKS
-- ==========================================

CREATE TABLE IF NOT EXISTS assessment_frameworks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    version TEXT,
    is_licensed INTEGER DEFAULT 0,
    license_holder TEXT,
    dimensions TEXT NOT NULL, -- JSON array of dimension definitions
    scoring_scale INTEGER DEFAULT 5, -- 1-5 typical
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed assessment frameworks
INSERT OR IGNORE INTO assessment_frameworks (id, name, display_name, description, is_licensed, license_holder, dimensions) VALUES
    ('framework-drd', 'DRD', 'Digital Readiness Diagnosis', 'DBR77 proprietary digital transformation assessment', 0, 'DBR77', 
     '[{"id":"strategy","name":"Strategy & Leadership","weight":1.0},{"id":"organization","name":"Organization & Culture","weight":1.0},{"id":"processes","name":"Processes","weight":1.0},{"id":"technology","name":"Technology","weight":1.0},{"id":"people","name":"People & Skills","weight":1.0},{"id":"data","name":"Data & Analytics","weight":1.0}]'),
    
    ('framework-siri', 'SIRI', 'Smart Industry Readiness Index', 'Singapore-developed Industry 4.0 assessment framework', 1, 'Singapore EDB',
     '[{"id":"operations","name":"Operations","weight":1.0},{"id":"supply-chain","name":"Supply Chain","weight":1.0},{"id":"product-lifecycle","name":"Product Lifecycle","weight":1.0},{"id":"strategy-governance","name":"Strategy & Governance","weight":1.0}]'),
    
    ('framework-adma', 'ADMA', 'Advanced Manufacturing Assessment', 'European advanced manufacturing readiness assessment', 1, 'ADMA',
     '[{"id":"strategy","name":"Strategy & Organization","weight":1.0},{"id":"factory","name":"Smart Factory","weight":1.0},{"id":"products","name":"Smart Products","weight":1.0},{"id":"services","name":"Data-driven Services","weight":1.0}]'),
    
    ('framework-lean40', 'LEAN40', 'Lean Assessment 4.0', 'DBR77 adaptation of Lean principles for Industry 4.0', 0, 'DBR77',
     '[{"id":"value-stream","name":"Value Stream","weight":1.0},{"id":"flow","name":"Flow","weight":1.0},{"id":"pull","name":"Pull","weight":1.0},{"id":"perfection","name":"Perfection","weight":1.0},{"id":"digital","name":"Digital Enhancement","weight":1.0}]'),
    
    ('framework-cmmi', 'CMMI', 'Capability Maturity Model Integration', 'Process improvement framework', 0, 'ISACA',
     '[{"id":"process-mgmt","name":"Process Management","weight":1.0},{"id":"project-mgmt","name":"Project Management","weight":1.0},{"id":"engineering","name":"Engineering","weight":1.0},{"id":"support","name":"Support","weight":1.0}]');

-- ==========================================
-- ASSESSMENT RESPONSES (per question)
-- ==========================================

CREATE TABLE IF NOT EXISTS assessment_responses (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    dimension_id TEXT NOT NULL,
    subdimension_id TEXT,
    question_id TEXT NOT NULL,
    score INTEGER, -- 1-5
    evidence TEXT,
    evidence_attachments TEXT, -- JSON array of file IDs
    notes TEXT,
    ai_feedback TEXT,
    answered_by TEXT,
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    UNIQUE(assessment_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_responses_assessment ON assessment_responses(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_responses_dimension ON assessment_responses(dimension_id);

-- ==========================================
-- ASSESSMENT DIMENSION SCORES (calculated)
-- ==========================================

CREATE TABLE IF NOT EXISTS assessment_dimension_scores (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    dimension_id TEXT NOT NULL,
    dimension_name TEXT,
    score REAL,
    max_score REAL,
    weight REAL DEFAULT 1.0,
    question_count INTEGER DEFAULT 0,
    answered_count INTEGER DEFAULT 0,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    UNIQUE(assessment_id, dimension_id)
);

CREATE INDEX IF NOT EXISTS idx_dimension_scores_assessment ON assessment_dimension_scores(assessment_id);

-- ==========================================
-- ASSESSMENT REPORTS
-- ==========================================

CREATE TABLE IF NOT EXISTS assessment_reports (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL UNIQUE,
    organization_id TEXT NOT NULL,
    
    -- Report content
    executive_summary TEXT,
    detailed_analysis TEXT, -- JSON
    recommendations TEXT, -- JSON array
    benchmark_data TEXT, -- JSON
    
    -- Generated content
    generated_by TEXT DEFAULT 'ai', -- 'ai' or 'manual'
    generation_params TEXT, -- JSON with AI params
    
    -- Sharing
    public_link_id TEXT,
    public_link_expires_at TIMESTAMP,
    public_link_password TEXT,
    
    -- Export history
    last_export_format TEXT,
    last_export_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assessment_reports_assessment ON assessment_reports(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_reports_public ON assessment_reports(public_link_id);

-- ==========================================
-- PDF IMPORTS
-- ==========================================

CREATE TABLE IF NOT EXISTS assessment_pdf_imports (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    
    -- Parsing results
    parse_status TEXT DEFAULT 'pending', -- 'pending', 'parsed', 'failed'
    parsed_at TIMESTAMP,
    parsed_data TEXT, -- JSON with extracted data
    
    -- Mapping to assessment
    created_assessment_id TEXT,
    mapping_data TEXT, -- JSON with user-confirmed mappings
    
    uploaded_by TEXT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pdf_imports_org ON assessment_pdf_imports(organization_id);
CREATE INDEX IF NOT EXISTS idx_pdf_imports_status ON assessment_pdf_imports(parse_status);

-- ==========================================
-- ASSESSMENT QUESTIONS (framework-specific)
-- ==========================================

CREATE TABLE IF NOT EXISTS assessment_questions (
    id TEXT PRIMARY KEY,
    framework_id TEXT NOT NULL,
    dimension_id TEXT NOT NULL,
    subdimension_id TEXT,
    question_order INTEGER DEFAULT 0,
    question_text TEXT NOT NULL,
    question_text_translations TEXT, -- JSON for i18n
    help_text TEXT,
    help_text_translations TEXT, -- JSON for i18n
    scoring_criteria TEXT, -- JSON with level descriptions
    evidence_required INTEGER DEFAULT 0,
    weight REAL DEFAULT 1.0,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (framework_id) REFERENCES assessment_frameworks(id)
);

CREATE INDEX IF NOT EXISTS idx_questions_framework ON assessment_questions(framework_id);
CREATE INDEX IF NOT EXISTS idx_questions_dimension ON assessment_questions(dimension_id);

-- ==========================================
-- SEED SAMPLE DRD QUESTIONS
-- ==========================================

INSERT OR IGNORE INTO assessment_questions (id, framework_id, dimension_id, question_order, question_text, scoring_criteria) VALUES
    ('q-drd-strategy-1', 'framework-drd', 'strategy', 1, 
     'How clearly defined is your digital transformation strategy?',
     '{"1":"No strategy","2":"Informal discussions","3":"Draft strategy exists","4":"Approved strategy with KPIs","5":"Strategy embedded in operations"}'),
    
    ('q-drd-strategy-2', 'framework-drd', 'strategy', 2,
     'How committed is leadership to digital transformation?',
     '{"1":"No visible commitment","2":"Occasional mentions","3":"Formal support","4":"Active sponsorship","5":"Champions transformation"}'),
    
    ('q-drd-processes-1', 'framework-drd', 'processes', 1,
     'What percentage of core processes are digitized?',
     '{"1":"<10%","2":"10-30%","3":"30-50%","4":"50-80%","5":">80%"}'),
    
    ('q-drd-technology-1', 'framework-drd', 'technology', 1,
     'How modern is your IT infrastructure?',
     '{"1":"Legacy only","2":"Some modern","3":"Hybrid","4":"Mostly modern","5":"Cutting-edge"}'),
    
    ('q-drd-people-1', 'framework-drd', 'people', 1,
     'What level of digital skills does your workforce have?',
     '{"1":"Basic only","2":"Some trained","3":"Regular training","4":"Strong capabilities","5":"Digital native"}'),
    
    ('q-drd-data-1', 'framework-drd', 'data', 1,
     'How mature is your data management practice?',
     '{"1":"Ad-hoc","2":"Documented","3":"Managed","4":"Optimized","5":"Predictive"}');
