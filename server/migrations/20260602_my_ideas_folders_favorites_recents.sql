-- M2 (Ideas home shell) — Folders + server-backed Favorites / Recents
--
-- Makes idea organization persistent and cross-device:
--   * my_idea_folders: per-user folders/spaces (optional nesting)
--   * my_ideas.folder_id     — which folder an idea lives in (nullable = unfiled)
--   * my_ideas.is_favorite   — server-backed "starred" (0/1, replaces localStorage)
--   * my_ideas.last_opened_at — server-backed "recents" timestamp
--
-- Fully additive + idempotent (safe to re-run / safe on a shared DB):
--   only CREATE TABLE/INDEX IF NOT EXISTS and ADD COLUMN IF NOT EXISTS.
-- folder_id is NOT a hard FK (the migration runner executes the whole file in
-- one shot; we keep referential integrity in the API layer — deleting a folder
-- nulls its ideas' folder_id).

CREATE TABLE IF NOT EXISTS my_idea_folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  parent_folder_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_my_idea_folders_user_id ON my_idea_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_my_idea_folders_org_id ON my_idea_folders(organization_id);
CREATE INDEX IF NOT EXISTS idx_my_idea_folders_parent ON my_idea_folders(parent_folder_id);

ALTER TABLE my_ideas ADD COLUMN IF NOT EXISTS folder_id TEXT;
ALTER TABLE my_ideas ADD COLUMN IF NOT EXISTS is_favorite INTEGER DEFAULT 0;
ALTER TABLE my_ideas ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_my_ideas_folder_id ON my_ideas(folder_id);
CREATE INDEX IF NOT EXISTS idx_my_ideas_is_favorite ON my_ideas(is_favorite);
CREATE INDEX IF NOT EXISTS idx_my_ideas_last_opened_at ON my_ideas(last_opened_at);
