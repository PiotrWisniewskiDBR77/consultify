-- Migration 568: T060 Structured Report Generator + T061 Business Report Templates
-- Adds: report_agent_messages, quality_gate_results, canonical business templates

-- ============================================================
-- T060: Report Agent Messages (Gamma-style chat)
-- ============================================================
CREATE TABLE IF NOT EXISTS report_agent_messages (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL,
    report_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    structured_action JSONB,
    diff_preview JSONB,
    applied BOOLEAN DEFAULT FALSE,
    applied_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_msgs_report ON report_agent_messages(report_id);
CREATE INDEX IF NOT EXISTS idx_agent_msgs_org ON report_agent_messages(organization_id);

-- ============================================================
-- T060: Quality Gate Results
-- ============================================================
CREATE TABLE IF NOT EXISTS report_quality_gates (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL,
    report_id TEXT NOT NULL,
    gate_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('error', 'warning', 'info')),
    message TEXT NOT NULL,
    section_key TEXT,
    is_resolved BOOLEAN DEFAULT FALSE,
    checked_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_quality_gates_report ON report_quality_gates(report_id);

-- ============================================================
-- T061: Canonical Business Report Templates
-- ============================================================

-- Template: Strategic Review / Executive Brief
INSERT INTO report_builder_templates (id, organization_id, name, description, source_type, report_type, is_public, is_system, is_active, sections_json)
VALUES (
    'tpl-strategic-review-exec',
    'SYSTEM',
    'Strategic Review & Executive Brief',
    'High-level strategic assessment for board members and executive sponsors. Covers situation analysis, strategic options, recommendations, and implementation roadmap.',
    'ASSESSMENT',
    'STRATEGIC_REVIEW',
    TRUE, TRUE, TRUE,
    '[
        {"key":"cover","type":"cover","title":"Cover Page","order":0,"enabled":true,"defaultLength":"short"},
        {"key":"executive_summary","type":"summary","title":"Executive Summary","order":1,"enabled":true,"defaultLength":"medium","required":true},
        {"key":"situation_analysis","type":"analysis","title":"Current Situation & Context","order":2,"enabled":true,"defaultLength":"medium"},
        {"key":"key_findings","type":"findings","title":"Key Findings","order":3,"enabled":true,"defaultLength":"medium","required":true},
        {"key":"strategic_options","type":"recommendations","title":"Strategic Options & Recommendations","order":4,"enabled":true,"defaultLength":"long","required":true},
        {"key":"risk_assessment","type":"consulting_risks_register","title":"Risk Assessment","order":5,"enabled":true,"defaultLength":"medium"},
        {"key":"implementation_roadmap","type":"roadmap","title":"Implementation Roadmap","order":6,"enabled":true,"defaultLength":"medium"},
        {"key":"next_steps","type":"consulting_decisions","title":"Next Steps & Decisions Required","order":7,"enabled":true,"defaultLength":"short","required":true}
    ]'::JSONB
) ON CONFLICT (id) DO NOTHING;

-- Template: Transformation Roadmap & Portfolio
INSERT INTO report_builder_templates (id, organization_id, name, description, source_type, report_type, is_public, is_system, is_active, sections_json)
VALUES (
    'tpl-transformation-roadmap',
    'SYSTEM',
    'Transformation Roadmap & Portfolio Review',
    'Comprehensive portfolio and roadmap document for transformation programs. Includes initiative portfolio, timeline, resource allocation, and benefits tracking.',
    'INITIATIVE',
    'PORTFOLIO_REVIEW',
    TRUE, TRUE, TRUE,
    '[
        {"key":"cover","type":"cover","title":"Cover Page","order":0,"enabled":true,"defaultLength":"short"},
        {"key":"executive_summary","type":"summary","title":"Executive Summary","order":1,"enabled":true,"defaultLength":"medium","required":true},
        {"key":"portfolio_overview","type":"initiatives","title":"Initiative Portfolio Overview","order":2,"enabled":true,"defaultLength":"long"},
        {"key":"timeline","type":"timeline","title":"Delivery Timeline & Milestones","order":3,"enabled":true,"defaultLength":"medium"},
        {"key":"resource_allocation","type":"analysis","title":"Resource Allocation & Capacity","order":4,"enabled":true,"defaultLength":"medium"},
        {"key":"kpi_dashboard","type":"kpis","title":"KPI Dashboard & Performance","order":5,"enabled":true,"defaultLength":"medium"},
        {"key":"risks_issues","type":"consulting_risks_register","title":"RAID Log (Risks, Assumptions, Issues, Dependencies)","order":6,"enabled":true,"defaultLength":"medium"},
        {"key":"benefits_tracking","type":"analysis","title":"Benefits Realization & ROI","order":7,"enabled":true,"defaultLength":"medium"},
        {"key":"recommendations","type":"recommendations","title":"Recommendations & Adjustments","order":8,"enabled":true,"defaultLength":"medium"},
        {"key":"next_steps","type":"consulting_decisions","title":"Next Steps & Decisions","order":9,"enabled":true,"defaultLength":"short","required":true}
    ]'::JSONB
) ON CONFLICT (id) DO NOTHING;

-- Template: Financial Analysis
INSERT INTO report_builder_templates (id, organization_id, name, description, source_type, report_type, is_public, is_system, is_active, sections_json)
VALUES (
    'tpl-financial-analysis',
    'SYSTEM',
    'Financial Analysis & Business Case',
    'Comprehensive financial analysis including statements, ratios, budget analysis, and business case justification. Suitable for CFO and finance committee presentations.',
    'INITIATIVE',
    'FINANCIAL_ANALYSIS',
    TRUE, TRUE, TRUE,
    '[
        {"key":"cover","type":"cover","title":"Cover Page","order":0,"enabled":true,"defaultLength":"short"},
        {"key":"executive_summary","type":"summary","title":"Executive Summary","order":1,"enabled":true,"defaultLength":"medium","required":true},
        {"key":"financial_overview","type":"analysis","title":"Financial Overview & Key Metrics","order":2,"enabled":true,"defaultLength":"medium"},
        {"key":"budget_analysis","type":"analysis","title":"Budget Analysis (Plan vs Actual)","order":3,"enabled":true,"defaultLength":"long"},
        {"key":"cost_breakdown","type":"consulting_benchmark_bar","title":"Cost Breakdown & Benchmarks","order":4,"enabled":true,"defaultLength":"medium"},
        {"key":"roi_analysis","type":"kpis","title":"ROI Analysis & Benefits Valuation","order":5,"enabled":true,"defaultLength":"medium"},
        {"key":"financial_risks","type":"consulting_risks_register","title":"Financial Risks & Mitigation","order":6,"enabled":true,"defaultLength":"medium"},
        {"key":"recommendations","type":"recommendations","title":"Financial Recommendations","order":7,"enabled":true,"defaultLength":"medium","required":true},
        {"key":"assumptions","type":"methodology","title":"Assumptions & Methodology","order":8,"enabled":true,"defaultLength":"short"},
        {"key":"disclaimer","type":"custom","title":"Disclaimer","order":9,"enabled":true,"defaultLength":"short","required":true}
    ]'::JSONB
) ON CONFLICT (id) DO NOTHING;

-- Template: Steering Committee Brief
INSERT INTO report_builder_templates (id, organization_id, name, description, source_type, report_type, is_public, is_system, is_active, sections_json)
VALUES (
    'tpl-steering-committee',
    'SYSTEM',
    'Steering Committee / Program Update',
    'Concise program status report for steering committee meetings. Traffic light status, key decisions, escalations, and forward plan.',
    'INITIATIVE',
    'STEERING_COMMITTEE',
    TRUE, TRUE, TRUE,
    '[
        {"key":"cover","type":"cover","title":"Cover Page","order":0,"enabled":true,"defaultLength":"short"},
        {"key":"overall_status","type":"summary","title":"Overall Program Status","order":1,"enabled":true,"defaultLength":"short","required":true},
        {"key":"key_achievements","type":"findings","title":"Key Achievements This Period","order":2,"enabled":true,"defaultLength":"short"},
        {"key":"initiative_status","type":"initiatives","title":"Initiative Status Summary","order":3,"enabled":true,"defaultLength":"medium"},
        {"key":"risks_escalations","type":"consulting_risks_register","title":"Risks & Escalations","order":4,"enabled":true,"defaultLength":"short"},
        {"key":"kpi_progress","type":"kpis","title":"KPI Progress","order":5,"enabled":true,"defaultLength":"short"},
        {"key":"budget_status","type":"analysis","title":"Budget Status","order":6,"enabled":true,"defaultLength":"short"},
        {"key":"decisions_required","type":"consulting_decisions","title":"Decisions Required","order":7,"enabled":true,"defaultLength":"short","required":true},
        {"key":"next_period_plan","type":"recommendations","title":"Next Period Plan","order":8,"enabled":true,"defaultLength":"short"}
    ]'::JSONB
) ON CONFLICT (id) DO NOTHING;

-- Template: Valuation Pack
INSERT INTO report_builder_templates (id, organization_id, name, description, source_type, report_type, is_public, is_system, is_active, sections_json)
VALUES (
    'tpl-valuation-pack',
    'SYSTEM',
    'Valuation Pack & Investment Summary',
    'Comprehensive valuation document for investment decisions. Includes DCF analysis, comparables, sensitivity analysis, and investment thesis.',
    'INITIATIVE',
    'VALUATION_PACK',
    TRUE, TRUE, TRUE,
    '[
        {"key":"cover","type":"cover","title":"Cover Page","order":0,"enabled":true,"defaultLength":"short"},
        {"key":"investment_thesis","type":"summary","title":"Investment Thesis","order":1,"enabled":true,"defaultLength":"medium","required":true},
        {"key":"company_overview","type":"analysis","title":"Company / Program Overview","order":2,"enabled":true,"defaultLength":"medium"},
        {"key":"market_context","type":"analysis","title":"Market Context & Competitive Position","order":3,"enabled":true,"defaultLength":"medium"},
        {"key":"financial_performance","type":"kpis","title":"Financial Performance & Projections","order":4,"enabled":true,"defaultLength":"long"},
        {"key":"valuation_analysis","type":"analysis","title":"Valuation Analysis","order":5,"enabled":true,"defaultLength":"long","required":true},
        {"key":"sensitivity","type":"consulting_2x2","title":"Sensitivity & Scenario Analysis","order":6,"enabled":true,"defaultLength":"medium"},
        {"key":"risks","type":"consulting_risks_register","title":"Key Risks & Mitigants","order":7,"enabled":true,"defaultLength":"medium"},
        {"key":"recommendation","type":"recommendations","title":"Recommendation & Next Steps","order":8,"enabled":true,"defaultLength":"medium","required":true},
        {"key":"disclaimer","type":"custom","title":"Important Disclaimers","order":9,"enabled":true,"defaultLength":"short","required":true}
    ]'::JSONB
) ON CONFLICT (id) DO NOTHING;

-- Template: Tool Workshop Summary
INSERT INTO report_builder_templates (id, organization_id, name, description, source_type, report_type, is_public, is_system, is_active, sections_json)
VALUES (
    'tpl-tool-workshop-summary',
    'SYSTEM',
    'Tool Workshop Summary',
    'Summary report from consulting tool workshops. Captures methodology, findings, generated initiatives, and recommended actions.',
    'TOOL',
    'TOOL_WORKSHOP',
    TRUE, TRUE, TRUE,
    '[
        {"key":"cover","type":"cover","title":"Cover Page","order":0,"enabled":true,"defaultLength":"short"},
        {"key":"executive_summary","type":"summary","title":"Executive Summary","order":1,"enabled":true,"defaultLength":"medium","required":true},
        {"key":"methodology","type":"methodology","title":"Methodology & Approach","order":2,"enabled":true,"defaultLength":"short"},
        {"key":"key_findings","type":"findings","title":"Key Findings & Insights","order":3,"enabled":true,"defaultLength":"long","required":true},
        {"key":"analysis","type":"analysis","title":"Detailed Analysis","order":4,"enabled":true,"defaultLength":"long"},
        {"key":"initiatives","type":"initiatives","title":"Generated Initiatives","order":5,"enabled":true,"defaultLength":"medium"},
        {"key":"prioritization","type":"consulting_2x2","title":"Prioritization Matrix","order":6,"enabled":true,"defaultLength":"medium"},
        {"key":"recommendations","type":"recommendations","title":"Recommendations","order":7,"enabled":true,"defaultLength":"medium","required":true},
        {"key":"next_steps","type":"consulting_decisions","title":"Next Steps & Action Items","order":8,"enabled":true,"defaultLength":"short","required":true}
    ]'::JSONB
) ON CONFLICT (id) DO NOTHING;

-- Template: Assessment Summary (universal)
INSERT INTO report_builder_templates (id, organization_id, name, description, source_type, report_type, is_public, is_system, is_active, sections_json)
VALUES (
    'tpl-assessment-summary-v2',
    'SYSTEM',
    'Assessment Summary Report',
    'Structured assessment summary report covering maturity scores, gaps, strengths, and actionable recommendations. Works with DRD, SIRI, and ADMA frameworks.',
    'ASSESSMENT',
    'ASSESSMENT_SUMMARY',
    TRUE, TRUE, TRUE,
    '[
        {"key":"cover","type":"cover","title":"Cover Page","order":0,"enabled":true,"defaultLength":"short"},
        {"key":"executive_summary","type":"summary","title":"Executive Summary","order":1,"enabled":true,"defaultLength":"medium","required":true},
        {"key":"methodology","type":"methodology","title":"Assessment Methodology","order":2,"enabled":true,"defaultLength":"short"},
        {"key":"maturity_matrix","type":"matrix","title":"Maturity Assessment Matrix","order":3,"enabled":true,"defaultLength":"medium"},
        {"key":"key_findings","type":"findings","title":"Key Findings","order":4,"enabled":true,"defaultLength":"medium","required":true},
        {"key":"strengths","type":"strengths","title":"Strengths & Best Practices","order":5,"enabled":true,"defaultLength":"medium"},
        {"key":"gaps","type":"gaps","title":"Gaps & Improvement Areas","order":6,"enabled":true,"defaultLength":"medium"},
        {"key":"benchmarks","type":"consulting_benchmark_bar","title":"Benchmark Comparison","order":7,"enabled":true,"defaultLength":"medium"},
        {"key":"recommendations","type":"recommendations","title":"Recommendations & Priority Actions","order":8,"enabled":true,"defaultLength":"long","required":true},
        {"key":"roadmap","type":"roadmap","title":"Implementation Roadmap","order":9,"enabled":true,"defaultLength":"medium"},
        {"key":"next_steps","type":"consulting_decisions","title":"Next Steps","order":10,"enabled":true,"defaultLength":"short","required":true}
    ]'::JSONB
) ON CONFLICT (id) DO NOTHING;

-- Add template metadata columns if missing
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_builder_templates' AND column_name = 'audience') THEN
        ALTER TABLE report_builder_templates ADD COLUMN audience TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_builder_templates' AND column_name = 'expected_length') THEN
        ALTER TABLE report_builder_templates ADD COLUMN expected_length TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_builder_templates' AND column_name = 'use_case') THEN
        ALTER TABLE report_builder_templates ADD COLUMN use_case TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_builder_templates' AND column_name = 'category') THEN
        ALTER TABLE report_builder_templates ADD COLUMN category TEXT DEFAULT 'general';
    END IF;
END $$;

-- Update canonical templates with metadata
UPDATE report_builder_templates SET audience = 'Board / C-Suite', expected_length = '8-12 pages', use_case = 'Strategic assessment delivery', category = 'strategic' WHERE id = 'tpl-strategic-review-exec';
UPDATE report_builder_templates SET audience = 'Steering Committee / PMO', expected_length = '12-20 pages', use_case = 'Transformation program review', category = 'portfolio' WHERE id = 'tpl-transformation-roadmap';
UPDATE report_builder_templates SET audience = 'CFO / Finance Committee', expected_length = '10-15 pages', use_case = 'Financial analysis and business case', category = 'finance' WHERE id = 'tpl-financial-analysis';
UPDATE report_builder_templates SET audience = 'Steering Committee', expected_length = '4-8 pages', use_case = 'Recurring program status update', category = 'steering' WHERE id = 'tpl-steering-committee';
UPDATE report_builder_templates SET audience = 'Board / Investors', expected_length = '15-25 pages', use_case = 'Investment / valuation analysis', category = 'finance' WHERE id = 'tpl-valuation-pack';
UPDATE report_builder_templates SET audience = 'Client / Team', expected_length = '8-12 pages', use_case = 'Workshop deliverable', category = 'workshop' WHERE id = 'tpl-tool-workshop-summary';
UPDATE report_builder_templates SET audience = 'Client / Sponsor', expected_length = '10-15 pages', use_case = 'Assessment results delivery', category = 'assessment' WHERE id = 'tpl-assessment-summary-v2';
