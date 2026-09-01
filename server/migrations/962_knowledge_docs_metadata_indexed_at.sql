-- FIX-213-5: `knowledge_docs.metadata` and `knowledge_docs.indexed_at` are read/written by
-- knowledgeIndexer.ts (insertDocument) and insightSignalBridgeService.ts, but until now they
-- existed only as a runtime ALTER in PostgresDatabase.ts:1803-1804 (ensureKnowledgeDocColumn),
-- never in the migration chain. A database built exclusively from migrations (no initDb() pass)
-- is therefore missing both columns, and any insert/select touching them fails with
-- `column "metadata" of relation "knowledge_docs" does not exist`.
--
-- Numbered (Phase 0) migration, placed immediately after 961_knowledge_docs_scope.sql so it
-- runs after the knowledge_docs table exists on both a fresh DB and an upgrade path.
ALTER TABLE knowledge_docs
  ADD COLUMN IF NOT EXISTS metadata TEXT;

ALTER TABLE knowledge_docs
  ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
