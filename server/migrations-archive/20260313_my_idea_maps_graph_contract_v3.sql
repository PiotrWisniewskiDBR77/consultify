-- Idea Workspace v3 SSOT: core data contract additions for map persistence.
-- SSOT: docs/product/IDEA_WORKSPACE_V3_SSOT.md
--
-- Ensure tool switching does not lose data:
-- - preferred_tool: remembers which canvas tool to open by default
-- - extensions_json: tool-specific payloads stored without data loss

ALTER TABLE my_idea_maps ADD COLUMN IF NOT EXISTS preferred_tool TEXT DEFAULT NULL;
ALTER TABLE my_idea_maps ADD COLUMN IF NOT EXISTS extensions_json TEXT DEFAULT '{}' ;

CREATE INDEX IF NOT EXISTS idx_my_idea_maps_preferred_tool ON my_idea_maps(preferred_tool);

