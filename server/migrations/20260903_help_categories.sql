-- P0 schemat-od-zera (dyżur agent/schemat-datetime): help_categories musi być
-- odtwarzalny z łańcucha migracji, nie tylko z runtime DDL w
-- help.routes.ts (ensureHelpSchema). Jedyna z czterech tabel help_* bez
-- migracji (help_articles/help_playbooks/help_events już mają migracje —
-- 255_help_system.sql / 551_help_playbooks_onboarding.sql /
-- 000_initdb_core_tables.sql). Kolumny odzwierciedlają runtime; DATETIME ->
-- TIMESTAMPTZ (patrz commit 5b5c0e3849, email_verification_tokens).
CREATE TABLE IF NOT EXISTS help_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
