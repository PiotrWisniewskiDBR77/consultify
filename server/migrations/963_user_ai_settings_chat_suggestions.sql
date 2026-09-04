-- DEC-386 (2026-09-04): the "chipy sugestii" toggle in the AI Chat tools menu
-- (src/components/AIChat/ToolsMenu.tsx, aiConfig.chatSuggestionsEnabled) is
-- persisted only in the browser's localStorage (zustand persist, key
-- consultify-storage) — see src/store/useAppStore.ts partialize(). Owner
-- decision: keep the switch exactly where it is, move only the storage to a
-- per-user server preference so it survives a login from another browser or
-- machine. The existing user_ai_settings.auto_suggestions column (see
-- aiSettingsService.ts DEFAULT_USER) is NOT reused here — it already backs
-- an unrelated feature (AI "auto-complete" suggestions, src/services/api.ts
-- getAIAutoComplete/saveAIAutoComplete, wired from src/components/settings/
-- AISettings.tsx). Reusing it would silently couple two unrelated toggles.
--
-- Numbered (Phase 0) migration, placed immediately after
-- 962_knowledge_docs_metadata_indexed_at.sql, same idempotent
-- ALTER ... ADD COLUMN IF NOT EXISTS pattern.
ALTER TABLE user_ai_settings
  ADD COLUMN IF NOT EXISTS chat_suggestions_enabled BOOLEAN DEFAULT true;
