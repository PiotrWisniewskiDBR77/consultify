-- Add Vector DBR77 platform model to llm_providers
-- This is the DBR77 platform-native AI model optimized for consulting workflows.
-- Managed by SuperAdmin; currently in beta.

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
INSERT INTO llm_tier_assignments (id, provider_id, tier, priority, is_active) VALUES
    ('tier-platform-vector', 'vector-dbr77', 'PLATFORM', 0, TRUE),
    ('tier-premium-vector', 'vector-dbr77', 'PREMIUM', 0, TRUE),
    ('tier-reasoning-vector', 'vector-dbr77', 'REASONING', 0, TRUE)
ON CONFLICT (id) DO NOTHING;
