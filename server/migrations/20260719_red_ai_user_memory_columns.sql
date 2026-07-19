-- RED: schema-drift — `ai_user_memory` powstała wcześnie (id/user_id/preferences/expertise/...),
-- ale aiMemoryService.ts i userPrivacyService.ts używają kolumn, których tabela nie ma:
--   recent_topics, assigned_projects, interaction_count, last_interaction_at,
--   total_messages, updated_at.
-- Efekt: createUserMemory() INSERT i updateUserMemoryAfterInteraction() UPDATE cicho
-- padają (fail-open dbRun połyka błąd) → pamięć użytkownika AI / kontekst Teresy nie zapisuje się.
--
-- Fix: dołóż brakujące kolumny (ADD COLUMN IF NOT EXISTS — idempotentne). Typy zgodne z
-- konwencją tabeli (TEXT dla blobów JSON i znaczników czasu ISO, jak reszta modułu AI).
ALTER TABLE ai_user_memory ADD COLUMN IF NOT EXISTS recent_topics TEXT DEFAULT '[]';
ALTER TABLE ai_user_memory ADD COLUMN IF NOT EXISTS assigned_projects TEXT DEFAULT '[]';
ALTER TABLE ai_user_memory ADD COLUMN IF NOT EXISTS interaction_count INTEGER DEFAULT 0;
ALTER TABLE ai_user_memory ADD COLUMN IF NOT EXISTS total_messages INTEGER DEFAULT 0;
ALTER TABLE ai_user_memory ADD COLUMN IF NOT EXISTS last_interaction_at TEXT;
ALTER TABLE ai_user_memory ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
