-- Migration: AI Personas System
-- Enables custom AI personalities and marketplace

-- Main personas table
CREATE TABLE IF NOT EXISTS ai_personas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    avatar_url TEXT,
    system_prompt TEXT NOT NULL,
    instructions TEXT,
    starter_prompts JSON DEFAULT '[]',
    knowledge_sources JSON DEFAULT '[]',
    capabilities JSON DEFAULT '[]',
    -- capabilities can include: web_search, code_execution, image_generation, file_upload
    model_preference TEXT, -- preferred model for this persona
    temperature REAL DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 4096,
    visibility TEXT DEFAULT 'private', -- private, organization, public
    category TEXT, -- business, creative, technical, education, etc.
    tags JSON DEFAULT '[]',
    created_by TEXT NOT NULL,
    organization_id TEXT,
    usage_count INTEGER DEFAULT 0,
    rating REAL DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    is_featured INTEGER DEFAULT 0,
    is_verified INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

-- Persona usage tracking
CREATE TABLE IF NOT EXISTS ai_persona_usage (
    id TEXT PRIMARY KEY,
    persona_id TEXT NOT NULL REFERENCES ai_personas(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    conversation_id TEXT,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Persona ratings/reviews
CREATE TABLE IF NOT EXISTS ai_persona_ratings (
    id TEXT PRIMARY KEY,
    persona_id TEXT NOT NULL REFERENCES ai_personas(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(persona_id, user_id)
);

-- Persona favorites (users can bookmark personas)
CREATE TABLE IF NOT EXISTS ai_persona_favorites (
    id TEXT PRIMARY KEY,
    persona_id TEXT NOT NULL REFERENCES ai_personas(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(persona_id, user_id)
);

-- Persona sharing (for organization-level sharing)
CREATE TABLE IF NOT EXISTS ai_persona_shares (
    id TEXT PRIMARY KEY,
    persona_id TEXT NOT NULL REFERENCES ai_personas(id) ON DELETE CASCADE,
    shared_with_org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    shared_by TEXT NOT NULL,
    can_edit INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(persona_id, shared_with_org_id)
);

-- Persona versions (for tracking changes)
CREATE TABLE IF NOT EXISTS ai_persona_versions (
    id TEXT PRIMARY KEY,
    persona_id TEXT NOT NULL REFERENCES ai_personas(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    system_prompt TEXT NOT NULL,
    instructions TEXT,
    capabilities JSON DEFAULT '[]',
    changed_by TEXT,
    change_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_personas_visibility ON ai_personas(visibility);
CREATE INDEX IF NOT EXISTS idx_personas_category ON ai_personas(category);
CREATE INDEX IF NOT EXISTS idx_personas_organization ON ai_personas(organization_id);
CREATE INDEX IF NOT EXISTS idx_personas_created_by ON ai_personas(created_by);
CREATE INDEX IF NOT EXISTS idx_personas_featured ON ai_personas(is_featured);
CREATE INDEX IF NOT EXISTS idx_personas_rating ON ai_personas(rating DESC);
CREATE INDEX IF NOT EXISTS idx_personas_usage ON ai_personas(usage_count DESC);

CREATE INDEX IF NOT EXISTS idx_persona_usage_persona ON ai_persona_usage(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_usage_user ON ai_persona_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_persona_ratings_persona ON ai_persona_ratings(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_favorites_user ON ai_persona_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_persona_shares_org ON ai_persona_shares(shared_with_org_id);
CREATE INDEX IF NOT EXISTS idx_persona_versions_persona ON ai_persona_versions(persona_id);

-- Seed some default personas
INSERT OR IGNORE INTO ai_personas (id, name, description, system_prompt, instructions, category, visibility, created_by, is_featured, is_verified)
VALUES 
    ('persona_business_analyst', 'Business Analyst', 
     'Expert in business analysis, requirements gathering, and strategic planning',
     'You are an expert Business Analyst with 15+ years of experience. You help users analyze business processes, gather requirements, create user stories, and develop strategic recommendations. You use frameworks like SWOT, Porter''s Five Forces, and Value Chain Analysis. Always be thorough and data-driven in your analysis.',
     'Focus on asking clarifying questions, providing structured analysis, and delivering actionable recommendations.',
     'business', 'public', 'system', 1, 1),
    
    ('persona_code_reviewer', 'Code Reviewer',
     'Expert code reviewer focusing on best practices, security, and performance',
     'You are a senior software engineer specializing in code review. You analyze code for bugs, security vulnerabilities, performance issues, and adherence to best practices. You provide constructive feedback with specific suggestions for improvement. You are familiar with multiple programming languages and frameworks.',
     'Always explain the "why" behind your suggestions. Prioritize issues by severity. Include code examples when suggesting improvements.',
     'technical', 'public', 'system', 1, 1),
    
    ('persona_creative_writer', 'Creative Writer',
     'Skilled writer for marketing copy, storytelling, and creative content',
     'You are a creative writer with expertise in various writing styles - from engaging marketing copy to compelling narratives. You understand brand voice, audience targeting, and storytelling techniques. You can adapt your writing style to match different tones and purposes.',
     'Ask about the target audience and desired tone. Provide multiple variations when appropriate. Focus on clarity and engagement.',
     'creative', 'public', 'system', 1, 1),
    
    ('persona_project_coach', 'Project Management Coach',
     'PMO expert helping with project planning, risk management, and team leadership',
     'You are an experienced Project Management Professional (PMP) and Agile coach. You help users with project planning, risk assessment, stakeholder management, and team leadership. You are familiar with methodologies like PMBOK, PRINCE2, Scrum, and Kanban.',
     'Provide practical, actionable advice. Use templates and frameworks when helpful. Consider both waterfall and agile approaches.',
     'business', 'public', 'system', 1, 1),

    ('persona_data_analyst', 'Data Analyst',
     'Expert in data analysis, visualization, and deriving insights from data',
     'You are a Data Analyst skilled in statistical analysis, data visualization, and deriving actionable insights from complex datasets. You can help with SQL queries, Python/R analysis, dashboard design, and interpreting results for business stakeholders.',
     'Always consider data quality and limitations. Visualize when possible. Translate technical findings into business language.',
     'technical', 'public', 'system', 1, 1);
