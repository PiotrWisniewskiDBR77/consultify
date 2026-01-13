-- LLM Tier Assignments Table
-- Many-to-many relationship between providers and tiers

-- Add tier column to llm_providers if not exists
ALTER TABLE llm_providers ADD COLUMN tier TEXT DEFAULT 'standard';
ALTER TABLE llm_providers ADD COLUMN context_window INTEGER DEFAULT 4096;

-- Create tier assignments table for many-to-many
CREATE TABLE IF NOT EXISTS llm_tier_assignments (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    tier TEXT NOT NULL CHECK(tier IN ('BUDGET', 'STANDARD', 'PREMIUM', 'REASONING')),
    priority INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (provider_id) REFERENCES llm_providers(id) ON DELETE CASCADE,
    UNIQUE(provider_id, tier)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tier_assignments_provider ON llm_tier_assignments(provider_id);
CREATE INDEX IF NOT EXISTS idx_tier_assignments_tier ON llm_tier_assignments(tier);
CREATE INDEX IF NOT EXISTS idx_tier_assignments_priority ON llm_tier_assignments(tier, priority);

-- Seed default assignments based on existing providers
INSERT OR IGNORE INTO llm_tier_assignments (id, provider_id, tier, priority)
SELECT 
    lower(hex(randomblob(16))),
    id,
    CASE 
        WHEN tier IS NOT NULL AND tier != '' THEN UPPER(tier)
        ELSE 'STANDARD'
    END,
    0
FROM llm_providers
WHERE is_active = 1;
