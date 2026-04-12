-- Migration: 20260221_01_prompt_ssot_compat.sql
-- T116: Prompt SSOT compatibility layer
-- Adds `code` column to ai_prompt_blocks for assembler key-based lookup
-- Date: 2026-02-21

DO $$
BEGIN
    -- ai_prompt_blocks: add `code` column for assembler lookup by code
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_prompt_blocks') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ai_prompt_blocks' AND column_name = 'code') THEN
            ALTER TABLE ai_prompt_blocks ADD COLUMN code TEXT;
            UPDATE ai_prompt_blocks SET code = REPLACE(LOWER(name), ' ', '_') WHERE code IS NULL AND name IS NOT NULL;
        END IF;
    END IF;

    -- ai_system_prompts: ensure `template` column exists (some routes use template, others content)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_system_prompts') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ai_system_prompts' AND column_name = 'template') THEN
            ALTER TABLE ai_system_prompts ADD COLUMN template TEXT;
            UPDATE ai_system_prompts SET template = content WHERE template IS NULL AND content IS NOT NULL;
        END IF;
    END IF;

    -- ai_prompt_versions: ensure both `template` and `change_reason` exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_prompt_versions') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ai_prompt_versions' AND column_name = 'template') THEN
            ALTER TABLE ai_prompt_versions ADD COLUMN template TEXT;
            UPDATE ai_prompt_versions SET template = content WHERE template IS NULL AND content IS NOT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ai_prompt_versions' AND column_name = 'change_reason') THEN
            ALTER TABLE ai_prompt_versions ADD COLUMN change_reason TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ai_prompt_versions' AND column_name = 'changed_by') THEN
            ALTER TABLE ai_prompt_versions ADD COLUMN changed_by TEXT;
        END IF;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_prompt_blocks') THEN
        CREATE INDEX IF NOT EXISTS idx_prompt_blocks_code ON ai_prompt_blocks(code);
    END IF;
END $$;
