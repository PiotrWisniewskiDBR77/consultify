-- T116: Prompt SSOT compatibility layer
-- Adds `template` as alias view for `content` (routes use both interchangeably)
-- Adds `code` column to prompt_blocks for assembler lookup
-- Adds `change_reason` column to ai_prompt_versions if missing

-- ai_system_prompts: ensure `template` column exists (routes reference it)
-- Some routes write to 'template', some to 'content'. We add 'template' as nullable
-- and ensure both columns stay in sync via application logic.
ALTER TABLE ai_system_prompts ADD COLUMN IF NOT EXISTS template TEXT;

-- Backfill: copy content → template where template is NULL
UPDATE ai_system_prompts SET template = content WHERE template IS NULL AND content IS NOT NULL;

-- ai_prompt_blocks: add `code` column for assembler key-based lookup
ALTER TABLE ai_prompt_blocks ADD COLUMN IF NOT EXISTS code TEXT;

-- Backfill: use name as code where code is NULL
UPDATE ai_prompt_blocks SET code = REPLACE(LOWER(name), ' ', '_') WHERE code IS NULL AND name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prompt_blocks_code ON ai_prompt_blocks(code);

-- ai_prompt_versions: ensure `template` column exists (052 schema uses it, 210 uses content)
-- Some migrations create it as 'template', others as 'content'. Add both.
ALTER TABLE ai_prompt_versions ADD COLUMN IF NOT EXISTS template TEXT;

-- Backfill: copy content → template where applicable
UPDATE ai_prompt_versions SET template = content WHERE template IS NULL AND content IS NOT NULL;

-- ai_prompt_versions: ensure change_reason exists (210 has it, 052 doesn't)
ALTER TABLE ai_prompt_versions ADD COLUMN IF NOT EXISTS change_reason TEXT;
ALTER TABLE ai_prompt_versions ADD COLUMN IF NOT EXISTS changed_by TEXT;
