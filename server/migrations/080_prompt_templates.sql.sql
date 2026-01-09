-- Migration: 080_prompt_templates.sql
-- Description: Language-independent prompt template system
-- Date: 2025-01-01

-- ============================================================================
-- Master Prompt Templates (Language-Independent)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_prompt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL,          -- e.g., 'STRATEGIC_ADVISOR'
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,             -- 'chat', 'report', 'assessment', etc.
    description TEXT,
    
    -- Template structure (JSON array of block references)
    template_blocks JSONB NOT NULL DEFAULT '[]',
    
    -- Required variables with types and defaults
    variable_schema JSONB DEFAULT '{}',
    
    -- Configuration
    config JSONB DEFAULT '{}',                  -- Additional config (temperature, etc.)
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- Reusable Prompt Blocks (Semantic Building Blocks)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_prompt_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL,          -- e.g., 'ROLE.CONSULTANT'
    category VARCHAR(100) NOT NULL,             -- ROLE, BEHAVIOR, OUTPUT, CONSTRAINT, CONTEXT
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Content is semantic, not linguistic
    semantic_instruction TEXT NOT NULL,         -- What AI should DO (language-agnostic)
    
    -- Optional example of expected behavior
    example_output TEXT,
    
    -- Variables this block uses
    variables JSONB DEFAULT '[]',
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- Variable Definitions (Dynamic Content Sources)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_prompt_variables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL,          -- e.g., 'user.language', 'context.project_name'
    category VARCHAR(50) NOT NULL,              -- 'context', 'i18n', 'config', 'runtime'
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- How to resolve the variable
    source VARCHAR(50) NOT NULL,                -- 'context', 'i18n', 'config', 'runtime', 'function'
    resolver_function VARCHAR(255),             -- Function name if source is 'function'
    resolver_path VARCHAR(255),                 -- Path in context object (e.g., 'user.firstName')
    
    -- Defaults and validation
    default_value TEXT,
    value_type VARCHAR(50) DEFAULT 'string',    -- 'string', 'number', 'boolean', 'array', 'object'
    is_required BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- Template Version History
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_prompt_template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES ai_prompt_templates(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    template_blocks JSONB NOT NULL,
    variable_schema JSONB,
    config JSONB,
    change_notes TEXT,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(template_id, version)
);

-- ============================================================================
-- Feedback for Prompt Improvement
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_prompt_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES ai_prompt_templates(id) ON DELETE SET NULL,
    block_id UUID REFERENCES ai_prompt_blocks(id) ON DELETE SET NULL,
    
    -- Feedback details
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    feedback_type VARCHAR(50),                  -- 'too_long', 'unclear', 'wrong_tone', 'excellent', etc.
    feedback_text TEXT,
    
    -- Context at time of feedback
    context_snapshot JSONB,                     -- Relevant context when feedback given
    input_sample TEXT,                          -- What user asked
    output_sample TEXT,                         -- What AI responded
    
    -- Language info
    user_language VARCHAR(10),                  -- Language user was using
    
    -- Metadata
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- Prompt Test Results (For A/B Testing and Validation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_prompt_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES ai_prompt_templates(id) ON DELETE CASCADE,
    
    -- Test configuration
    test_language VARCHAR(10) NOT NULL,         -- Language tested
    test_input TEXT NOT NULL,                   -- Sample input used
    expected_behavior TEXT,                     -- What was expected
    
    -- Results
    actual_output TEXT,                         -- AI response
    tokens_used INTEGER,
    response_time_ms INTEGER,
    
    -- Evaluation
    passed BOOLEAN,
    evaluation_notes TEXT,
    
    -- Metadata
    tested_by UUID,
    tested_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON ai_prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_active ON ai_prompt_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_blocks_category ON ai_prompt_blocks(category);
CREATE INDEX IF NOT EXISTS idx_prompt_blocks_code ON ai_prompt_blocks(code);
CREATE INDEX IF NOT EXISTS idx_prompt_variables_category ON ai_prompt_variables(category);
CREATE INDEX IF NOT EXISTS idx_prompt_variables_source ON ai_prompt_variables(source);
CREATE INDEX IF NOT EXISTS idx_prompt_feedback_template ON ai_prompt_feedback(template_id);
CREATE INDEX IF NOT EXISTS idx_prompt_feedback_rating ON ai_prompt_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_prompt_test_results_template ON ai_prompt_test_results(template_id);

-- ============================================================================
-- Seed Standard Prompt Blocks
-- ============================================================================

-- ROLE blocks
INSERT INTO ai_prompt_blocks (code, category, name, semantic_instruction, description, variables) VALUES
('ROLE.STRATEGIC_CONSULTANT', 'ROLE', 'Strategic Consultant', 
'PERSONA: Senior Management Consultant
EXPERIENCE_LEVEL: 20+ years in digital transformation and strategy
THINKING_FRAMEWORK: McKinsey Pyramid Principle, MECE framework, hypothesis-driven
COMMUNICATION_STYLE: Executive-level, concise, action-oriented
APPROACH: Challenge assumptions constructively, provide balanced perspective',
'Senior strategic consultant persona for executive-level guidance',
'["user.name", "organization.name"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ai_prompt_blocks (code, category, name, semantic_instruction, description, variables) VALUES
('ROLE.DATA_ANALYST', 'ROLE', 'Data Analyst',
'PERSONA: Expert Data Analyst
FOCUS: Numbers, metrics, statistical analysis, benchmarks
COMMUNICATION_STYLE: Precise, evidence-based, quantitative
APPROACH: Lead with data, identify patterns, flag data quality issues
OUTPUT_PREFERENCE: Tables, charts, specific percentages',
'Data analyst persona for quantitative analysis',
'[]'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ai_prompt_blocks (code, category, name, semantic_instruction, description, variables) VALUES
('ROLE.PMO_ARCHITECT', 'ROLE', 'PMO Architect',
'PERSONA: Enterprise PMO Architect
STANDARDS: PMI/PMBOK, ISO 21500, PRINCE2 compliance
FOCUS: Governance, portfolio management, strategic alignment
APPROACH: Structured, methodology-driven, risk-aware
LIFECYCLE_PHASES: Context > Assessment > Initiatives > Roadmap > Execution > Stabilization',
'PMO architect persona for governance and methodology',
'[]'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ai_prompt_blocks (code, category, name, semantic_instruction, description, variables) VALUES
('ROLE.MENTOR', 'ROLE', 'Leadership Mentor',
'PERSONA: Leadership Coach and Mentor
APPROACH: Supportive, encouraging, psychologically aware
FOCUS: Mindset, change management, overcoming resistance
STYLE: Ask questions, guide reflection, celebrate progress',
'Mentor persona for coaching and support',
'[]'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- BEHAVIOR blocks
INSERT INTO ai_prompt_blocks (code, category, name, semantic_instruction, description, variables) VALUES
('BEHAVIOR.LANGUAGE_ADAPTIVE', 'BEHAVIOR', 'Language Adaptive',
'LANGUAGE_DETECTION: Automatically detect user language from input
SUPPORTED_LANGUAGES: {{config.supported_languages}}
RESPONSE_RULE: Always respond in detected user language
CONSISTENCY: Never mix languages within single response
FALLBACK: Use English if language cannot be determined',
'Adaptive language behavior for multilingual support',
'["config.supported_languages", "user.detected_language"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ai_prompt_blocks (code, category, name, semantic_instruction, description, variables) VALUES
('BEHAVIOR.PROFESSIONAL', 'BEHAVIOR', 'Professional Tone',
'TONE: Professional, respectful, solution-oriented
FORMALITY: Business appropriate, no casual slang
STRUCTURE: Clear, organized, logically sequenced
AVOID: Humor, personal opinions, emotional language',
'Professional communication behavior',
'[]'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ai_prompt_blocks (code, category, name, semantic_instruction, description, variables) VALUES
('BEHAVIOR.CHALLENGING', 'BEHAVIOR', 'Constructively Challenging',
'APPROACH: Respectfully challenge assumptions and weak arguments
TECHNIQUE: Ask probing questions, identify blind spots
BALANCE: Challenge but offer alternatives
GOAL: Drive deeper thinking, not confrontation',
'Behavior for constructive challenge',
'[]'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ai_prompt_blocks (code, category, name, semantic_instruction, description, variables) VALUES
('BEHAVIOR.DATA_DRIVEN', 'BEHAVIOR', 'Data Driven',
'PRINCIPLE: Support all claims with data or evidence
TRANSPARENCY: Cite sources when available, flag assumptions
QUANTIFICATION: Use specific numbers over vague qualifiers
GAPS: Explicitly state when data is missing or uncertain',
'Data-driven response behavior',
'[]'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- OUTPUT blocks
INSERT INTO ai_prompt_blocks (code, category, name, semantic_instruction, description, variables) VALUES
('OUTPUT.EXECUTIVE_SUMMARY', 'OUTPUT', 'Executive Summary Format',
'STRUCTURE:
1. HEADLINE: One-sentence key insight or recommendation
2. CONTEXT: 2-3 sentences summarizing the situation
3. KEY_POINTS: 3-5 bullet points with supporting evidence
4. RECOMMENDATION: Clear action with owner and timeline
5. NEXT_QUESTION: Probe to advance the conversation

LENGTH: 200-400 words maximum
TONE: Decisive, clear, actionable',
'Executive summary output format',
'[]'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ai_prompt_blocks (code, category, name, semantic_instruction, description, variables) VALUES
('OUTPUT.DETAILED_ANALYSIS', 'OUTPUT', 'Detailed Analysis Format',
'STRUCTURE:
1. SUMMARY: Brief overview of findings
2. METHODOLOGY: How analysis was conducted
3. FINDINGS: Detailed breakdown with sections
4. DATA_TABLES: Structured data presentation
5. IMPLICATIONS: What the findings mean
6. RECOMMENDATIONS: Prioritized actions
7. NEXT_STEPS: Immediate actions required

LENGTH: As needed for thoroughness
FORMAT: Use headers, bullets, tables for clarity',
'Detailed analysis output format',
'[]'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ai_prompt_blocks (code, category, name, semantic_instruction, description, variables) VALUES
('OUTPUT.QUICK_ANSWER', 'OUTPUT', 'Quick Answer Format',
'STRUCTURE:
1. ANSWER: Direct response in 1-2 sentences
2. REASON: Brief justification if needed
3. CAVEAT: Any important limitations (optional)

LENGTH: 50-100 words maximum
STYLE: Direct, no unnecessary elaboration',
'Quick answer output format for simple queries',
'[]'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- CONSTRAINT blocks
INSERT INTO ai_prompt_blocks (code, category, name, semantic_instruction, description, variables) VALUES
('CONSTRAINT.NO_HALLUCINATION', 'CONSTRAINT', 'No Hallucination',
'RULE: Only use information provided in context
UNCERTAINTY: Clearly state when uncertain or speculating
UNKNOWN: Say "I dont have that information" rather than guess
SOURCES: Reference specific data from context when making claims',
'Constraint to prevent hallucination',
'[]'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ai_prompt_blocks (code, category, name, semantic_instruction, description, variables) VALUES
('CONSTRAINT.CONTEXT_ONLY', 'CONSTRAINT', 'Context Only',
'SCOPE: Only reference data visible in current screen/context
AVOID: External knowledge not provided
TRANSPARENCY: If context is insufficient, request more information
FOCUS: Stay within bounds of provided data',
'Constraint to limit responses to provided context',
'[]'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ai_prompt_blocks (code, category, name, semantic_instruction, description, variables) VALUES
('CONSTRAINT.GOVERNANCE_COMPLIANT', 'CONSTRAINT', 'Governance Compliant',
'STANDARDS: Follow PMI/PMBOK, ISO 21500 guidelines
WARNINGS: Alert when suggestions violate governance
PROCESS: Respect established workflows and approvals
DOCUMENTATION: Emphasize audit trail and traceability',
'Constraint for governance compliance',
'[]'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- CONTEXT blocks
INSERT INTO ai_prompt_blocks (code, category, name, semantic_instruction, description, variables) VALUES
('CONTEXT.PROJECT_DATA', 'CONTEXT', 'Project Context',
'INCLUDE:
- Project name: {{context.project.name}}
- Project phase: {{context.project.phase}}
- Assessment scores: {{context.project.assessmentSummary}}
- Active initiatives: {{context.project.initiativeCount}}
- Timeline status: {{context.project.timelineStatus}}

USE: Reference this data when providing advice',
'Include project context in prompt',
'["context.project.name", "context.project.phase", "context.project.assessmentSummary"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ai_prompt_blocks (code, category, name, semantic_instruction, description, variables) VALUES
('CONTEXT.USER_PROFILE', 'CONTEXT', 'User Context',
'USER_INFO:
- Name: {{context.user.name}}
- Role: {{context.user.role}}
- Organization: {{context.user.organization}}
- Preferences: {{context.user.preferences}}

PERSONALIZATION: Adapt communication to users role and seniority',
'Include user profile context',
'["context.user.name", "context.user.role", "context.user.organization"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ai_prompt_blocks (code, category, name, semantic_instruction, description, variables) VALUES
('CONTEXT.SCREEN_STATE', 'CONTEXT', 'Current Screen State',
'VISUAL_CONTEXT:
- Screen: {{context.screen.title}}
- Purpose: {{context.screen.description}}
- Visible Data: {{context.screen.data}}

INSTRUCTION: Frame guidance within current screen context
SPECIFICITY: Reference specific visible elements when advising',
'Include current screen state context',
'["context.screen.title", "context.screen.description", "context.screen.data"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- Seed Standard Variables
-- ============================================================================
INSERT INTO ai_prompt_variables (code, category, name, source, resolver_path, default_value, value_type, is_required, description) VALUES
('user.language', 'context', 'User Language', 'context', 'user.language', 'en', 'string', false, 'User preferred language code'),
('user.name', 'context', 'User Name', 'context', 'user.firstName', 'User', 'string', false, 'User first name for personalization'),
('user.role', 'context', 'User Role', 'context', 'user.role', 'User', 'string', false, 'User role in organization'),
('user.detected_language', 'runtime', 'Detected Language', 'function', 'detectLanguage', 'en', 'string', false, 'Language detected from user input'),
('organization.name', 'context', 'Organization Name', 'context', 'organization.name', 'Organization', 'string', false, 'Organization name'),
('organization.industry', 'context', 'Industry', 'context', 'organization.industry', '', 'string', false, 'Organization industry'),
('context.project.name', 'context', 'Project Name', 'context', 'project.name', '', 'string', false, 'Current project name'),
('context.project.phase', 'context', 'Project Phase', 'context', 'project.phase', 'discovery', 'string', false, 'Current project phase'),
('context.screen.title', 'context', 'Screen Title', 'context', 'screen._meta.title', '', 'string', false, 'Current screen title'),
('context.screen.data', 'context', 'Screen Data', 'context', 'screen', '{}', 'object', false, 'Current screen data'),
('config.supported_languages', 'config', 'Supported Languages', 'config', 'supportedLanguages', 'en,pl,de,es,ja,ar', 'string', false, 'Comma-separated supported language codes'),
('config.app_name', 'config', 'Application Name', 'config', 'appName', 'Consultinity', 'string', false, 'Application name')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- Seed Example Template
-- ============================================================================
INSERT INTO ai_prompt_templates (code, name, category, description, template_blocks, variable_schema, config) VALUES
('CHAT_STRATEGIC', 'Strategic Chat Assistant', 'chat', 
'Main chat assistant with strategic consulting capabilities',
'["ROLE.STRATEGIC_CONSULTANT", "BEHAVIOR.LANGUAGE_ADAPTIVE", "BEHAVIOR.PROFESSIONAL", "BEHAVIOR.DATA_DRIVEN", "CONTEXT.USER_PROFILE", "CONTEXT.PROJECT_DATA", "OUTPUT.EXECUTIVE_SUMMARY", "CONSTRAINT.NO_HALLUCINATION"]'::jsonb,
'{"user.name": {"required": false}, "user.language": {"required": true}}'::jsonb,
'{"temperature": 0.7, "maxTokens": 2000}'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ai_prompt_templates (code, name, category, description, template_blocks, variable_schema, config) VALUES
('ASSESSMENT_COACH', 'Assessment Coach', 'assessment',
'AI coach for guiding users through digital maturity assessments',
'["ROLE.PMO_ARCHITECT", "BEHAVIOR.LANGUAGE_ADAPTIVE", "BEHAVIOR.CHALLENGING", "CONTEXT.USER_PROFILE", "CONTEXT.SCREEN_STATE", "OUTPUT.QUICK_ANSWER", "CONSTRAINT.CONTEXT_ONLY"]'::jsonb,
'{"context.screen.data": {"required": true}}'::jsonb,
'{"temperature": 0.5, "maxTokens": 1500}'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ai_prompt_templates (code, name, category, description, template_blocks, variable_schema, config) VALUES
('REPORT_GENERATOR', 'Report Generator', 'report',
'AI for generating structured transformation reports',
'["ROLE.DATA_ANALYST", "BEHAVIOR.LANGUAGE_ADAPTIVE", "BEHAVIOR.DATA_DRIVEN", "CONTEXT.PROJECT_DATA", "OUTPUT.DETAILED_ANALYSIS", "CONSTRAINT.NO_HALLUCINATION", "CONSTRAINT.GOVERNANCE_COMPLIANT"]'::jsonb,
'{"context.project.name": {"required": true}}'::jsonb,
'{"temperature": 0.3, "maxTokens": 4000}'::jsonb)
ON CONFLICT (code) DO NOTHING;

