-- VLT-FOLDERS — foldery WEWNĄTRZ sejfu Vault (dzielą temat, NIE granicę
-- bezpieczeństwa — sejf/scope zostaje jedyną granicą dostępu, decyzja
-- właściciela 2026-07-28). Folder NIE ma własnego pola "poziom": dziedziczy
-- scope/project_id po sejfie, w którym powstał — dokładnie jak knowledge_docs
-- (VLT-001). Widoczność folderu liczy TA SAMA reguła co widoczność dokumentów
-- (server/src/services/KnowledgeService.ts `getDocuments`/`getFolders`).
--
-- Wzór: server/migrations/20260602_my_ideas_folders_favorites_recents.sql
-- (my_idea_folders) — ta sama filozofia: brak twardego FK (runner migracji
-- wykonuje cały plik jednym strzałem; integralność w API — usunięcie folderu
-- odpina jego dokumenty, patrz KnowledgeService.deleteFolder).
--
-- Fully additive + idempotent (safe to re-run / safe on a shared DB):
-- tylko CREATE TABLE/INDEX IF NOT EXISTS i ADD COLUMN IF NOT EXISTS.
--
-- ★ Redundancja ZAMIERZONA: KnowledgeService.ensureKnowledgeSchema() tworzy
-- tę samą tabelę/kolumnę też w runtime (ten sam wzorzec co owner_id/scope na
-- knowledge_docs) — oba idempotentne, bezpieczne razem, niezależnie od
-- kolejności (migracja vs. pierwszy request po deployu).

CREATE TABLE IF NOT EXISTS vault_folders (
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

CREATE INDEX IF NOT EXISTS idx_vault_folders_org_id ON vault_folders(organization_id);
CREATE INDEX IF NOT EXISTS idx_vault_folders_scope ON vault_folders(scope);
CREATE INDEX IF NOT EXISTS idx_vault_folders_project_id ON vault_folders(project_id);
CREATE INDEX IF NOT EXISTS idx_vault_folders_owner_id ON vault_folders(owner_id);
CREATE INDEX IF NOT EXISTS idx_vault_folders_parent ON vault_folders(parent_folder_id);

-- knowledge_docs.folder_id — jaki folder (jeśli jakikolwiek) niesie dokument.
-- Nullable = bez folderu (dzisiejsze zachowanie, zero migracji danych).
ALTER TABLE knowledge_docs ADD COLUMN IF NOT EXISTS folder_id TEXT;
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_folder_id ON knowledge_docs(folder_id);
