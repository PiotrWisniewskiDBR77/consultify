-- V4-IDEA-01: Canonical IdeaWorkspaceGraph schema (node kinds, artifact refs, extensions)
-- Documents schema version; extensions_json already stores node kinds, artifact_refs per tool

ALTER TABLE my_idea_maps ADD COLUMN IF NOT EXISTS schema_version INTEGER DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_my_idea_maps_schema_version ON my_idea_maps(schema_version);
