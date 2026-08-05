-- Fresh-schema prerequisite for 20260719_baseline_gap.sql.
--
-- `knowledge_docs` is created by the baseline with its minimal storage
-- columns. The 20260719 parity migration creates
-- `idx_knowledge_docs_project(project_id, organization_id)`, but project_id
-- previously came only from runtime/bootstrap history and had no versioned
-- producer. A fresh migration-only database therefore stopped at that index.
--
-- This dated, additive migration runs immediately before the parity consumer.
-- It is a no-op on environments that already received the column and is safe
-- for the normal atomic runtime runner; no manual history or data mutation is
-- required.
ALTER TABLE IF EXISTS public.knowledge_docs
  ADD COLUMN IF NOT EXISTS project_id TEXT;
