-- =====================================================
-- MIGRATION: Area-level Assessments for DRD Reports
-- Version: 050
-- Date: 2024-12-26
-- Description: Adds detailed 9-area assessments per axis
-- =====================================================

-- 1. Area Assessments Table
-- Stores individual assessments for each area within each axis
CREATE TABLE IF NOT EXISTS area_assessments (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,          -- FK to maturity_assessments
    project_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    
    -- Axis & Area identification
    axis_id TEXT NOT NULL,                -- processes, digitalProducts, etc.
    area_id TEXT NOT NULL,                -- sales, marketing, technology, etc.
    
    -- Maturity scores (1-7 scale)
    current_level INTEGER DEFAULT 1 CHECK(current_level BETWEEN 1 AND 7),
    target_level INTEGER DEFAULT 5 CHECK(target_level BETWEEN 1 AND 7),
    gap INTEGER GENERATED ALWAYS AS (target_level - current_level) STORED,
    
    -- Interview data
    interview_date DATE,
    interviewee_name TEXT,                -- "Jan Kowalski"
    interviewee_role TEXT,                -- "Dyrektor Sprzedaży"
    interview_notes TEXT,                 -- Detailed notes from interview
    key_quotes TEXT DEFAULT '[]',         -- JSON array of important quotes
    
    -- Observations & Evidence
    observed_tools TEXT DEFAULT '[]',     -- JSON array: ["SAP", "Salesforce CRM"]
    observed_processes TEXT DEFAULT '[]', -- JSON array: process descriptions
    strengths TEXT DEFAULT '[]',          -- JSON array: identified strengths
    weaknesses TEXT DEFAULT '[]',         -- JSON array: identified weaknesses
    evidence_files TEXT DEFAULT '[]',     -- JSON array: uploaded file refs
    
    -- AI-generated content
    ai_current_state_description TEXT,    -- Detailed description of current state
    ai_target_state_description TEXT,     -- What target state looks like
    ai_recommendations TEXT DEFAULT '[]', -- JSON array of recommendations
    ai_risks TEXT DEFAULT '[]',           -- JSON array of risks
    ai_kpis TEXT DEFAULT '[]',            -- JSON array of KPIs to track
    
    -- Priority & categorization
    priority TEXT DEFAULT 'MEDIUM' CHECK(priority IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    effort_estimate TEXT,                 -- "3-6 months"
    budget_estimate_pln REAL,             -- Estimated budget
    
    -- Metadata
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(assessment_id, axis_id, area_id)
);

-- 2. Area Definitions Table (Reference data)
-- Stores the 9 standard areas and their levels
CREATE TABLE IF NOT EXISTS area_definitions (
    id TEXT PRIMARY KEY,
    area_id TEXT NOT NULL UNIQUE,         -- sales, marketing, etc.
    name_en TEXT NOT NULL,
    name_pl TEXT NOT NULL,
    description_en TEXT,
    description_pl TEXT,
    icon TEXT,
    display_order INTEGER DEFAULT 0,
    
    -- Level definitions (JSON with 7 levels)
    levels_definition TEXT NOT NULL,      -- JSON: {"1": {"name": "Basic", "description": "..."}, ...}
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Area Level Standards Table
-- Detailed descriptions for each area at each level (63 combinations × 7 levels = 441 records)
CREATE TABLE IF NOT EXISTS area_level_standards (
    id TEXT PRIMARY KEY,
    axis_id TEXT NOT NULL,
    area_id TEXT NOT NULL,
    level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 7),
    
    -- Level details
    level_name_en TEXT NOT NULL,
    level_name_pl TEXT NOT NULL,
    description_en TEXT NOT NULL,
    description_pl TEXT NOT NULL,
    
    -- Characteristics at this level (JSON arrays)
    characteristics TEXT DEFAULT '[]',     -- What organization typically has
    tools_examples TEXT DEFAULT '[]',      -- Example tools at this level
    practices_examples TEXT DEFAULT '[]',  -- Example practices
    kpi_benchmarks TEXT DEFAULT '{}',      -- Industry KPI benchmarks
    
    -- Transition info
    transition_to_next TEXT,               -- What's needed to reach next level
    typical_timeline TEXT,                 -- "6-12 months"
    typical_investment TEXT,               -- "50,000 - 100,000 PLN"
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(axis_id, area_id, level)
);

-- 4. Interview Templates Table
-- Structured questions for each area
CREATE TABLE IF NOT EXISTS interview_templates (
    id TEXT PRIMARY KEY,
    axis_id TEXT NOT NULL,
    area_id TEXT NOT NULL,
    
    -- Questions
    questions TEXT NOT NULL,               -- JSON array of structured questions
    probing_questions TEXT DEFAULT '[]',   -- Follow-up questions
    evidence_checklist TEXT DEFAULT '[]',  -- What to look for/request
    
    -- Scoring guide
    scoring_rubric TEXT,                   -- JSON: how to score based on answers
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(axis_id, area_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_area_assessments_assessment ON area_assessments(assessment_id);
CREATE INDEX IF NOT EXISTS idx_area_assessments_project ON area_assessments(project_id);
CREATE INDEX IF NOT EXISTS idx_area_assessments_org ON area_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_area_assessments_axis_area ON area_assessments(axis_id, area_id);
CREATE INDEX IF NOT EXISTS idx_area_level_standards_lookup ON area_level_standards(axis_id, area_id, level);

-- =====================================================
-- SEED DATA: Area Definitions
-- =====================================================

INSERT OR IGNORE INTO area_definitions (id, area_id, name_en, name_pl, description_en, description_pl, icon, display_order, levels_definition)
VALUES 
    ('area-sales', 'sales', 'Sales', 'Sprzedaż', 
     'Sales operations, CRM, customer acquisition', 
     'Operacje sprzedażowe, CRM, pozyskiwanie klientów',
     '💰', 1,
     '{"1":{"name":"Basic Data Registration","namePl":"Rejestracja podstawowa"},"2":{"name":"CRM Implementation","namePl":"Wdrożenie CRM"},"3":{"name":"Integration with ERP/Marketing","namePl":"Integracja z ERP/Marketing"},"4":{"name":"Sales Automation","namePl":"Automatyzacja sprzedaży"},"5":{"name":"Omnichannel Integration","namePl":"Integracja omnichannel"},"6":{"name":"AI-Driven Sales Forecasting","namePl":"Prognozowanie AI"},"7":{"name":"Autonomous Sales Agents","namePl":"Autonomiczni agenci AI"}}'),
    
    ('area-marketing', 'marketing', 'Marketing', 'Marketing',
     'Marketing operations, campaigns, digital presence',
     'Operacje marketingowe, kampanie, obecność cyfrowa',
     '📣', 2,
     '{"1":{"name":"Basic Promotion","namePl":"Promocja podstawowa"},"2":{"name":"Digital Presence","namePl":"Obecność cyfrowa"},"3":{"name":"Marketing Automation Tools","namePl":"Narzędzia automatyzacji"},"4":{"name":"Personalization & Segmentation","namePl":"Personalizacja i segmentacja"},"5":{"name":"Data-Driven Campaigns","namePl":"Kampanie data-driven"},"6":{"name":"Predictive Marketing (AI)","namePl":"Marketing predykcyjny AI"},"7":{"name":"Real-time Hyper-personalization","namePl":"Hiperpersonalizacja real-time"}}'),
    
    ('area-technology', 'technology', 'Technology (R&D)', 'Technologia (R&D)',
     'R&D, product development, innovation',
     'R&D, rozwój produktów, innowacje',
     '🔬', 3,
     '{"1":{"name":"Manual Design","namePl":"Projektowanie ręczne"},"2":{"name":"CAD/CAM Tools","namePl":"Narzędzia CAD/CAM"},"3":{"name":"Simulation Tools","namePl":"Narzędzia symulacyjne"},"4":{"name":"Rapid Prototyping (3D Print)","namePl":"Szybkie prototypowanie 3D"},"5":{"name":"Digital Twin","namePl":"Cyfrowy bliźniak"},"6":{"name":"AI-Driven Design","namePl":"Projektowanie AI"},"7":{"name":"Autonomous R&D","namePl":"Autonomiczne R&D"}}'),
    
    ('area-purchasing', 'purchasing', 'Purchasing', 'Zakupy',
     'Procurement, supplier management, sourcing',
     'Zakupy, zarządzanie dostawcami, sourcing',
     '🛒', 4,
     '{"1":{"name":"Ad-hoc Purchasing","namePl":"Zakupy ad-hoc"},"2":{"name":"Digital Orders","namePl":"Zamówienia cyfrowe"},"3":{"name":"Procurement System","namePl":"System zakupowy"},"4":{"name":"Automated Replenishment","namePl":"Automatyczne uzupełnianie"},"5":{"name":"Supplier Integration","namePl":"Integracja z dostawcami"},"6":{"name":"AI-Driven Procurement","namePl":"Zakupy AI"},"7":{"name":"Autonomous Sourcing","namePl":"Autonomiczny sourcing"}}'),
    
    ('area-logistics', 'logistics', 'Logistics', 'Logistyka',
     'Warehousing, distribution, supply chain',
     'Magazynowanie, dystrybucja, łańcuch dostaw',
     '🚚', 5,
     '{"1":{"name":"Manual Tracking","namePl":"Śledzenie ręczne"},"2":{"name":"WMS Implementation","namePl":"Wdrożenie WMS"},"3":{"name":"Integrated Logistics","namePl":"Zintegrowana logistyka"},"4":{"name":"Real-time Tracking","namePl":"Śledzenie real-time"},"5":{"name":"Automated Warehousing","namePl":"Automatyczny magazyn"},"6":{"name":"Predictive Supply Chain","namePl":"Predykcyjny łańcuch dostaw"},"7":{"name":"Autonomous Logistics Network","namePl":"Autonomiczna sieć logistyczna"}}'),
    
    ('area-production', 'production', 'Production', 'Produkcja',
     'Manufacturing operations, process control',
     'Operacje produkcyjne, kontrola procesów',
     '🏭', 6,
     '{"1":{"name":"Manual Operations","namePl":"Operacje ręczne"},"2":{"name":"Machine Monitoring","namePl":"Monitoring maszyn"},"3":{"name":"Process Control Systems","namePl":"Systemy sterowania"},"4":{"name":"Automated Production Lines","namePl":"Zautomatyzowane linie"},"5":{"name":"MES Implementation","namePl":"Wdrożenie MES"},"6":{"name":"Digital Twin of Production","namePl":"Cyfrowy bliźniak produkcji"},"7":{"name":"Autonomous Factory","namePl":"Autonomiczna fabryka"}}'),
    
    ('area-quality', 'quality', 'Quality Control', 'Kontrola Jakości',
     'Quality assurance, testing, compliance',
     'Zapewnienie jakości, testowanie, zgodność',
     '✅', 7,
     '{"1":{"name":"Manual Inspection","namePl":"Kontrola ręczna"},"2":{"name":"Digital Records","namePl":"Dokumentacja cyfrowa"},"3":{"name":"Statistical Process Control","namePl":"SPC"},"4":{"name":"Automated Inspection","namePl":"Kontrola automatyczna"},"5":{"name":"Integrated Quality Management","namePl":"Zintegrowane zarządzanie jakością"},"6":{"name":"Predictive Quality (AI)","namePl":"Jakość predykcyjna AI"},"7":{"name":"Zero-Defect Autonomous Systems","namePl":"Systemy zero-defektów"}}'),
    
    ('area-finance', 'finance', 'Finance', 'Finanse',
     'Financial operations, controlling, reporting',
     'Operacje finansowe, controlling, raportowanie',
     '💵', 8,
     '{"1":{"name":"Spreadsheets","namePl":"Arkusze kalkulacyjne"},"2":{"name":"Accounting Software","namePl":"Oprogramowanie księgowe"},"3":{"name":"ERP Financial Modules","namePl":"Moduły finansowe ERP"},"4":{"name":"Automated Invoicing","namePl":"Automatyczna fakturacja"},"5":{"name":"Real-time Financial Controlling","namePl":"Controlling real-time"},"6":{"name":"Predictive Financial Modeling","namePl":"Modelowanie predykcyjne"},"7":{"name":"Autonomous Finance Operations","namePl":"Autonomiczne finanse"}}'),
    
    ('area-hr', 'hr', 'HR & Admin', 'HR i Administracja',
     'Human resources, administration, people management',
     'Zasoby ludzkie, administracja, zarządzanie ludźmi',
     '👥', 9,
     '{"1":{"name":"Paper Records","namePl":"Dokumentacja papierowa"},"2":{"name":"Basic HR Software","namePl":"Podstawowe oprogramowanie HR"},"3":{"name":"HRM System","namePl":"System HRM"},"4":{"name":"Talent Management System","namePl":"System zarządzania talentami"},"5":{"name":"People Analytics","namePl":"Analityka HR"},"6":{"name":"AI Recruitment & Retention","namePl":"Rekrutacja i retencja AI"},"7":{"name":"Autonomous Workforce Management","namePl":"Autonomiczne zarządzanie personelem"}}');

