-- T009 Enhancement — My Ideas AI Incubator
-- Adds AI-powered idea development stages, research data, and creative proposals.

ALTER TABLE my_ideas ADD COLUMN IF NOT EXISTS seed_text TEXT;
ALTER TABLE my_ideas ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'seed';
ALTER TABLE my_ideas ADD COLUMN IF NOT EXISTS ai_expansion TEXT;
ALTER TABLE my_ideas ADD COLUMN IF NOT EXISTS research_data TEXT DEFAULT '[]';
ALTER TABLE my_ideas ADD COLUMN IF NOT EXISTS creative_proposals TEXT DEFAULT '[]';
ALTER TABLE my_ideas ADD COLUMN IF NOT EXISTS summary_data TEXT;
ALTER TABLE my_ideas ADD COLUMN IF NOT EXISTS potential TEXT;
ALTER TABLE my_ideas ADD COLUMN IF NOT EXISTS complexity TEXT;
ALTER TABLE my_ideas ADD COLUMN IF NOT EXISTS promoted_to TEXT;
ALTER TABLE my_ideas ADD COLUMN IF NOT EXISTS promoted_entity_id TEXT;
ALTER TABLE my_ideas ADD COLUMN IF NOT EXISTS area TEXT;
ALTER TABLE my_ideas ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 50;
ALTER TABLE my_ideas ADD COLUMN IF NOT EXISTS branch TEXT;
