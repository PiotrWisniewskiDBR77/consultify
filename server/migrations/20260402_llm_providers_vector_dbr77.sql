-- Add Vector DBR77 platform model to llm_providers
-- This is the DBR77 platform-native AI model optimized for consulting workflows.
-- Managed by SuperAdmin; currently in beta.

-- Historical bootstrap paths could create llm_providers with the older,
-- narrower registry shape and still record the baseline migration.  Keep this
-- migration self-healing so a fresh runtime bootstrap and a drifted demo both
-- converge without any out-of-band DDL.
ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'standard';
ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'admin';
ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS context_window INTEGER DEFAULT 4096;
ALTER TABLE llm_providers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS llm_tier_assignments (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES llm_providers(id) ON DELETE CASCADE,
    tier TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider_id, tier)
);
CREATE INDEX IF NOT EXISTS idx_tier_assignments_provider ON llm_tier_assignments(provider_id);
CREATE INDEX IF NOT EXISTS idx_tier_assignments_tier ON llm_tier_assignments(tier);
CREATE INDEX IF NOT EXISTS idx_tier_assignments_priority ON llm_tier_assignments(tier, priority);

INSERT INTO llm_providers (
    id, name, provider, model_id, api_key, endpoint,
    tier, visibility, is_active, is_default, cost_per_1k, context_window
) VALUES (
    'vector-dbr77',
    'Vector DBR77',
    'dbr77',
    'vector-dbr77-beta',
    NULL,
    NULL,
    'PLATFORM',
    'public',
    TRUE,
    FALSE,
    0,
    128000
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    provider = EXCLUDED.provider,
    model_id = EXCLUDED.model_id,
    tier = EXCLUDED.tier,
    visibility = EXCLUDED.visibility,
    is_active = EXCLUDED.is_active,
    context_window = EXCLUDED.context_window,
    updated_at = CURRENT_TIMESTAMP;

-- Add Vector DBR77 to premium and reasoning tiers
ALTER TABLE llm_tier_assignments
  DROP CONSTRAINT IF EXISTS llm_tier_assignments_tier_check;

-- Normalize legacy tier values before tightening the constraint: the old 'FREE'
-- tier maps to the cheapest current tier 'BUDGET'. Without this, the CHECK below
-- fails on drifted DBs that still hold pre-taxonomy rows.
UPDATE llm_tier_assignments SET tier = 'BUDGET' WHERE tier = 'FREE';

ALTER TABLE llm_tier_assignments
  ADD CONSTRAINT llm_tier_assignments_tier_check
  CHECK(tier IN ('BUDGET', 'STANDARD', 'PREMIUM', 'REASONING', 'PLATFORM'));

-- Omit is_active and rely on its column default: the column is boolean on some
-- DBs and integer on others (cross-env type drift), so neither TRUE nor 1 is
-- portable. The default (active) is correct for these seed rows.
INSERT INTO llm_tier_assignments (id, provider_id, tier, priority) VALUES
    ('tier-platform-vector', 'vector-dbr77', 'PLATFORM', 0),
    ('tier-premium-vector', 'vector-dbr77', 'PREMIUM', 0),
    ('tier-reasoning-vector', 'vector-dbr77', 'REASONING', 0)
ON CONFLICT (id) DO NOTHING;
