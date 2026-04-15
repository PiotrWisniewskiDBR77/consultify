-- Add deck_json column to presentation_decks for DeckBuilder autosave, HTML export, quality gates
ALTER TABLE presentation_decks ADD COLUMN IF NOT EXISTS deck_json TEXT;
ALTER TABLE presentation_decks ADD COLUMN IF NOT EXISTS presentation_mode TEXT DEFAULT 'briefing';
