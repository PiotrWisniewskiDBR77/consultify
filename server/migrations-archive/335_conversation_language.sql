-- Migration: 335_conversation_language.sql
-- Description: Persist conversation language on conversations table
-- Created: 2026-02-04

-- Add language column (UI language can differ; this is per conversation)
ALTER TABLE conversations
  ADD COLUMN language VARCHAR(10) DEFAULT 'en';

-- Backfill existing rows
UPDATE conversations
SET language = 'en'
WHERE language IS NULL OR language = '';

-- Optional index (useful for analytics/filtering)
CREATE INDEX IF NOT EXISTS idx_conversations_language
  ON conversations(language);

