-- Migration: 051_memory_system.sql
-- Description: 5-Layer Memory System for AI
-- Layer 2: Project Memory
-- Layer 3: Organization Memory with pgvector

-- ================================================
-- LAYER 2: PROJECT MEMORY
-- Stores project-specific context, decisions, and learnings
-- ================================================

CREATE TABLE IF NOT EXISTS project_memory (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    memory_type TEXT NOT NULL CHECK (memory_type IN (
        'DECISION',
        'PHASE_TRANSITION', 
        'LEARNING',
        'RISK',
        'MILESTONE',
        'BLOCKER',
        'AI_RECOMMENDATION',
        'USER_FEEDBACK',
        'CONTEXT_UPDATE'
    )),
    content TEXT NOT NULL, -- JSON content
    title TEXT,
    importance INTEGER DEFAULT 1 CHECK (importance BETWEEN 1 AND 5),
    recorded_by TEXT,
    tags TEXT, -- JSON array of tags
    related_entity_type TEXT, -- 'task', 'initiative', 'assessment', etc.
    related_entity_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_project_memory_project ON project_memory(project_id);
CREATE INDEX IF NOT EXISTS idx_project_memory_type ON project_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_project_memory_importance ON project_memory(importance DESC);
CREATE INDEX IF NOT EXISTS idx_project_memory_created ON project_memory(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_memory_entity ON project_memory(related_entity_type, related_entity_id);

-- ================================================
-- LAYER 3: ORGANIZATION MEMORY
-- Stores organization-wide patterns, learnings, and best practices
-- Uses embeddings for semantic search
-- ================================================

CREATE TABLE IF NOT EXISTS organization_memory (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    memory_type TEXT NOT NULL CHECK (memory_type IN (
        'SUCCESS_PATTERN',
        'FAILURE_PATTERN',
        'BEST_PRACTICE',
        'LESSON_LEARNED',
        'BENCHMARK',
        'TEMPLATE',
        'STANDARD',
        'AI_INSIGHT'
    )),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    content TEXT NOT NULL, -- JSON detailed content
    embedding TEXT, -- JSON array for SQLite, vector for PostgreSQL
    source_project_id TEXT,
    source_assessment_id TEXT,
    applicability_score REAL DEFAULT 1.0, -- How generally applicable (0-1)
    usage_count INTEGER DEFAULT 0,
    last_used_at TEXT,
    tags TEXT, -- JSON array
    industry TEXT,
    company_size TEXT,
    is_active INTEGER DEFAULT 1,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (source_project_id) REFERENCES projects(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_org_memory_org ON organization_memory(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_memory_type ON organization_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_org_memory_active ON organization_memory(is_active);
CREATE INDEX IF NOT EXISTS idx_org_memory_industry ON organization_memory(industry);
CREATE INDEX IF NOT EXISTS idx_org_memory_usage ON organization_memory(usage_count DESC);

-- ================================================
-- AI DRAFTS TABLE
-- Staging area for AI-generated content awaiting approval
-- ================================================

CREATE TABLE IF NOT EXISTS ai_drafts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    user_id TEXT NOT NULL,
    draft_type TEXT NOT NULL CHECK (draft_type IN (
        'INITIATIVE',
        'REPORT_SECTION',
        'TASK_BREAKDOWN',
        'RECOMMENDATION',
        'RISK_ANALYSIS',
        'FIELD_SUGGESTION',
        'PATTERN',
        'SUMMARY'
    )),
    target_entity_type TEXT, -- What this draft is for
    target_entity_id TEXT,
    target_field TEXT, -- Specific field being suggested
    original_content TEXT, -- Original content (if editing)
    suggested_content TEXT NOT NULL, -- AI suggestion (JSON)
    diff_data TEXT, -- JSON diff for visualization
    confidence_score REAL DEFAULT 0.8,
    reasoning TEXT, -- Why AI suggested this
    status TEXT DEFAULT 'PENDING' CHECK (status IN (
        'PENDING',
        'APPROVED',
        'REJECTED',
        'MODIFIED',
        'EXPIRED'
    )),
    reviewed_by TEXT,
    reviewed_at TEXT,
    review_notes TEXT,
    model_used TEXT,
    prompt_id TEXT, -- Reference to ai_prompts
    tokens_used INTEGER,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_drafts_user ON ai_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_status ON ai_drafts(status);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_type ON ai_drafts(draft_type);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_target ON ai_drafts(target_entity_type, target_entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_created ON ai_drafts(created_at DESC);

-- ================================================
-- AI FEEDBACK TABLE
-- User feedback on AI suggestions
-- ================================================

CREATE TABLE IF NOT EXISTS ai_feedback (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    interaction_id TEXT, -- Reference to ai_audit_log
    draft_id TEXT, -- Reference to ai_drafts
    feedback_type TEXT NOT NULL CHECK (feedback_type IN (
        'HELPFUL',
        'NOT_HELPFUL',
        'ACCURATE',
        'INACCURATE',
        'RELEVANT',
        'IRRELEVANT',
        'RATING'
    )),
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    context_snapshot TEXT, -- JSON of screen context when feedback given
    capability TEXT, -- Which AI capability
    model_used TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (draft_id) REFERENCES ai_drafts(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_org ON ai_feedback(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_type ON ai_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_capability ON ai_feedback(capability);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_rating ON ai_feedback(rating);

-- ================================================
-- PROMPT EXPERIMENTS TABLE
-- A/B testing for prompts
-- ================================================

CREATE TABLE IF NOT EXISTS ai_prompt_experiments (
    id TEXT PRIMARY KEY,
    prompt_key TEXT NOT NULL,
    variant_a_id TEXT NOT NULL,
    variant_b_id TEXT NOT NULL,
    traffic_split REAL DEFAULT 0.50,
    metric TEXT NOT NULL CHECK (metric IN (
        'user_rating',
        'acceptance_rate',
        'time_to_accept',
        'regeneration_rate'
    )),
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN (
        'ACTIVE',
        'PAUSED',
        'COMPLETED',
        'CANCELLED'
    )),
    winner_id TEXT,
    variant_a_interactions INTEGER DEFAULT 0,
    variant_a_score REAL DEFAULT 0,
    variant_b_interactions INTEGER DEFAULT 0,
    variant_b_score REAL DEFAULT 0,
    min_interactions INTEGER DEFAULT 100,
    confidence_threshold REAL DEFAULT 0.95,
    started_at TEXT DEFAULT (datetime('now')),
    ended_at TEXT,
    created_by TEXT,
    FOREIGN KEY (variant_a_id) REFERENCES ai_prompts(id),
    FOREIGN KEY (variant_b_id) REFERENCES ai_prompts(id),
    FOREIGN KEY (winner_id) REFERENCES ai_prompts(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_prompt_exp_status ON ai_prompt_experiments(status);
CREATE INDEX IF NOT EXISTS idx_prompt_exp_key ON ai_prompt_experiments(prompt_key);














