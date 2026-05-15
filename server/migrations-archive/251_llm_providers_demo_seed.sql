-- LLM Providers Demo Seed Data
-- This migration adds demo LLM providers for testing and demonstration purposes
-- Note: API keys are placeholders - replace with real keys in production

-- Ensure llm_providers table exists (should already exist from earlier migrations)
CREATE TABLE IF NOT EXISTS llm_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    model_id TEXT,
    api_key TEXT,
    endpoint TEXT,
    tier TEXT DEFAULT 'standard',
    visibility TEXT DEFAULT 'admin',
    is_active INTEGER DEFAULT 1,
    is_default INTEGER DEFAULT 0,
    cost_per_1k REAL DEFAULT 0,
    context_window INTEGER DEFAULT 4096,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert demo providers (using INSERT OR IGNORE to avoid duplicates)
INSERT INTO llm_providers (id, name, provider, model_id, api_key, endpoint, tier, visibility, is_active, is_default, cost_per_1k, context_window) VALUES
-- OpenAI Models
('demo-openai-gpt4o', 'GPT-4o (Demo)', 'openai', 'gpt-4o', 'sk-demo-openai-key-placeholder', NULL, 'PREMIUM', 'public', TRUE::boolean, TRUE::boolean, 0.005::real, 128000::integer),
('demo-openai-gpt4o-mini', 'GPT-4o Mini (Demo)', 'openai', 'gpt-4o-mini', 'sk-demo-openai-key-placeholder', NULL, 'STANDARD', 'public', TRUE::boolean, FALSE::boolean, 0.00015::real, 128000::integer),
('demo-openai-gpt35', 'GPT-3.5 Turbo (Demo)', 'openai', 'gpt-3.5-turbo', 'sk-demo-openai-key-placeholder', NULL, 'BUDGET', 'public', TRUE::boolean, FALSE::boolean, 0.0005::real, 16385::integer),

-- Anthropic Models  
('demo-anthropic-claude3', 'Claude 3.5 Sonnet (Demo)', 'anthropic', 'claude-3-5-sonnet-20241022', 'sk-demo-anthropic-key-placeholder', NULL, 'PREMIUM', 'public', TRUE::boolean, FALSE::boolean, 0.003::real, 200000::integer),
('demo-anthropic-claude-haiku', 'Claude 3 Haiku (Demo)', 'anthropic', 'claude-3-haiku-20240307', 'sk-demo-anthropic-key-placeholder', NULL, 'BUDGET', 'public', TRUE::boolean, FALSE::boolean, 0.00025::real, 200000::integer),

-- Google Gemini
('demo-google-gemini', 'Gemini Pro (Demo)', 'google', 'gemini-pro', 'demo-google-api-key-placeholder', NULL, 'STANDARD', 'public', TRUE::boolean, FALSE::boolean, 0.001::real, 32760::integer),

-- Local Ollama (no API key needed)
('demo-ollama-llama3', 'Llama 3 (Local)', 'ollama', 'llama3', NULL, 'http://localhost:11434', 'BUDGET', 'public', TRUE::boolean, FALSE::boolean, 0::real, 8192::integer),
('demo-ollama-mistral', 'Mistral (Local)', 'ollama', 'mistral', NULL, 'http://localhost:11434', 'STANDARD', 'public', TRUE::boolean, FALSE::boolean, 0::real, 32768::integer)
ON CONFLICT (id) DO NOTHING;

-- Add tier assignments for demo providers
INSERT INTO llm_tier_assignments (id, provider_id, tier, priority, is_active) VALUES
-- Budget tier
('tier-budget-gpt35', 'demo-openai-gpt35', 'BUDGET', 0::integer, TRUE::boolean),
('tier-budget-haiku', 'demo-anthropic-claude-haiku', 'BUDGET', 1::integer, TRUE::boolean),
('tier-budget-llama', 'demo-ollama-llama3', 'BUDGET', 2::integer, TRUE::boolean),

-- Standard tier  
('tier-standard-gpt4o-mini', 'demo-openai-gpt4o-mini', 'STANDARD', 0::integer, TRUE::boolean),
('tier-standard-gemini', 'demo-google-gemini', 'STANDARD', 1::integer, TRUE::boolean),
('tier-standard-mistral', 'demo-ollama-mistral', 'STANDARD', 2::integer, TRUE::boolean),

-- Premium tier
('tier-premium-gpt4o', 'demo-openai-gpt4o', 'PREMIUM', 0::integer, TRUE::boolean),
('tier-premium-claude3', 'demo-anthropic-claude3', 'PREMIUM', 1::integer, TRUE::boolean),

-- Reasoning tier
('tier-reasoning-gpt4o', 'demo-openai-gpt4o', 'REASONING', 0::integer, TRUE::boolean),
('tier-reasoning-claude3', 'demo-anthropic-claude3', 'REASONING', 1::integer, TRUE::boolean)
ON CONFLICT (id) DO NOTHING;

-- Insert default SuperAdmin AI settings if not exists
INSERT INTO superadmin_ai_settings (id, default_provider, fallback_chain, circuit_breaker_config, global_token_limit, global_rate_limit, max_context_window_size, max_tokens_per_request, pii_detection_sensitivity, require_encryption, data_residency)
VALUES (
    'global',
    'demo-openai-gpt4o',
    '["demo-openai-gpt4o", "demo-anthropic-claude3", "demo-openai-gpt4o-mini"]',
    '{"failureThreshold": 5, "cooldownSeconds": 60}',
    10000000,
    '{"requestsPerMinute": 60, "requestsPerHour": 1000}',
    128000,
    8192,
    'medium',
    1,
    NULL
)
ON CONFLICT (id) DO NOTHING;

-- Add some demo AI usage logs for analytics
INSERT INTO ai_usage_logs (id, user_id, organization_id, provider, model, action, prompt_tokens, completion_tokens, tokens_used, latency_ms, status, metadata, created_at) VALUES
('usage-demo-1', 'user-dbr77-admin', 'org-dbr77', 'openai', 'gpt-4o', 'chat', 150, 300, 450, 1250, 'success', '{"feature": "chat"}', CURRENT_TIMESTAMP - INTERVAL '1 hour'),
('usage-demo-2', 'user-dbr77-admin', 'org-dbr77', 'openai', 'gpt-4o-mini', 'chat', 100, 200, 300, 850, 'success', '{"feature": "chat"}', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
('usage-demo-3', 'user-dbr77-admin', 'org-dbr77', 'anthropic', 'claude-3-5-sonnet', 'analysis', 500, 1000, 1500, 2100, 'success', '{"feature": "analysis"}', CURRENT_TIMESTAMP - INTERVAL '3 hours'),
('usage-demo-4', 'user-dbr77-admin', 'org-dbr77', 'openai', 'gpt-4o', 'report', 800, 2000, 2800, 3500, 'success', '{"feature": "report"}', CURRENT_TIMESTAMP - INTERVAL '4 hours'),
('usage-demo-5', 'user-dbr77-admin', 'org-dbr77', 'google', 'gemini-pro', 'chat', 200, 400, 600, 950, 'success', '{"feature": "chat"}', CURRENT_TIMESTAMP - INTERVAL '5 hours'),
('usage-demo-6', 'user-dbr77-admin', 'org-dbr77', 'openai', 'gpt-4o-mini', 'summary', 300, 600, 900, 1100, 'success', '{"feature": "summary"}', CURRENT_TIMESTAMP - INTERVAL '6 hours'),
('usage-demo-7', 'user-dbr77-admin', 'org-dbr77', 'anthropic', 'claude-3-haiku', 'chat', 80, 160, 240, 650, 'success', '{"feature": "chat"}', CURRENT_TIMESTAMP - INTERVAL '12 hours'),
('usage-demo-8', 'user-dbr77-admin', 'org-dbr77', 'openai', 'gpt-4o', 'decision', 400, 800, 1200, 1800, 'success', '{"feature": "decision"}', CURRENT_TIMESTAMP - INTERVAL '1 day'),
('usage-demo-9', 'user-dbr77-admin', 'org-dbr77', 'openai', 'gpt-4o-mini', 'chat', 120, 240, 360, 780, 'success', '{"feature": "chat"}', CURRENT_TIMESTAMP - INTERVAL '2 days'),
('usage-demo-10', 'user-dbr77-admin', 'org-dbr77', 'anthropic', 'claude-3-5-sonnet', 'initiative', 600, 1500, 2100, 2800, 'success', '{"feature": "initiative"}', CURRENT_TIMESTAMP - INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;
