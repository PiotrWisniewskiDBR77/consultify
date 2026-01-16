-- AI System Prompts Table
-- Stores prompt templates for AI capabilities

CREATE TABLE IF NOT EXISTS ai_system_prompts (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    name TEXT,
    content TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'chat',
    system_prompt TEXT,
    user_prompt_template TEXT,
    variables TEXT, -- JSON array
    context_config TEXT, -- JSON object
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_prompts_key ON ai_system_prompts(key);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_category ON ai_system_prompts(category);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_active ON ai_system_prompts(is_active);

-- Prompt versions for history
CREATE TABLE IF NOT EXISTS ai_prompt_versions (
    id TEXT PRIMARY KEY,
    prompt_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    system_prompt TEXT,
    user_prompt_template TEXT,
    change_reason TEXT,
    changed_by TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prompt_id) REFERENCES ai_system_prompts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt ON ai_prompt_versions(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_version ON ai_prompt_versions(prompt_id, version);

-- Prompt blocks for composable prompts
CREATE TABLE IF NOT EXISTS ai_prompt_blocks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    content TEXT NOT NULL,
    variables TEXT, -- JSON array
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prompt_blocks_category ON ai_prompt_blocks(category);
CREATE INDEX IF NOT EXISTS idx_prompt_blocks_active ON ai_prompt_blocks(is_active);

-- Seed some default prompts
INSERT INTO ai_system_prompts (id, key, name, content, description, category, is_active, version)
VALUES 
    ('default-chat', 'chat_default', 'Default Chat', 'You are a helpful AI assistant.', 'Capability: chat, Language: en', 'chat', TRUE, 1),
    ('default-analysis', 'analysis_default', 'Analysis Prompt', 'You are an expert analyst. Analyze the following data and provide insights.', 'Capability: analysis, Language: en', 'analysis', TRUE, 1),
    ('default-generation', 'generation_default', 'Content Generation', 'You are a creative writer. Generate content based on the following requirements.', 'Capability: generation, Language: en', 'generation', TRUE, 1)
ON CONFLICT (key) DO NOTHING;
