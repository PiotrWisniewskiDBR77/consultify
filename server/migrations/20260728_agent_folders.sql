-- AGT-FOLDERS — foldery dla agentów (Run agent / "Moje procesy"), analogiczny
-- system jak `vault_folders` (server/migrations/20260728_vault_folders.sql —
-- WZÓR SKOPIOWANY 1:1). Decyzja właściciela 2026-07-28: agenci istnieją na
-- 3 poziomach — prywatny (mój), projektowy (zespół projektu), organizacyjny
-- (cała firma) — cytat: „agenci mogą być tworzeni dla całej organizacji […]
-- na koniec będą indywidualni agenci".
--
-- Folder NIE ma własnego pola "poziom": dziedziczy scope/project_id z chwili
-- utworzenia (dokładnie jak vault_folders) — TAKA SAMA reguła widoczności
-- jak dla dokumentów w KnowledgeService (`getFolders`/`getDocuments`), tu
-- odtworzona w `agentFolderService.ts` dla planów (`ai_agent_plans`).
--
-- ★ Świadomie NIE reużywamy `vault_folders` — foldery agentów i dokumentów
-- to dwie różne domeny (inny właściciel encji, inny cykl życia), tak jak
-- `my_idea_folders` (Idee) i `vault_folders` (Vault) też są osobnymi
-- tabelami mimo identycznego kształtu kolumn.
--
-- Fully additive + idempotent (safe to re-run / safe on a shared DB):
-- tylko CREATE TABLE/INDEX IF NOT EXISTS i ADD COLUMN IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS agent_folders (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  project_id TEXT,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  parent_folder_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_folders_org_id ON agent_folders(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_folders_scope ON agent_folders(scope);
CREATE INDEX IF NOT EXISTS idx_agent_folders_project_id ON agent_folders(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_folders_owner_id ON agent_folders(owner_id);
CREATE INDEX IF NOT EXISTS idx_agent_folders_parent ON agent_folders(parent_folder_id);

-- ai_agent_plans.folder_id — jaki folder (jeśli jakikolwiek) niesie dany
-- proces/plan agenta. Nullable = bez folderu (dzisiejsze zachowanie, zero
-- migracji danych). Brak twardego FK (spójne z knowledge_docs.folder_id) —
-- integralność w API: `agentFolderService.deleteFolder` odpina plany
-- (folder_id = NULL) zamiast polegać na kaskadzie bazy.
ALTER TABLE ai_agent_plans ADD COLUMN IF NOT EXISTS folder_id TEXT;
CREATE INDEX IF NOT EXISTS idx_ai_agent_plans_folder_id ON ai_agent_plans(folder_id);
