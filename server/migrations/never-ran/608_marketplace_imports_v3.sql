-- Migration: 608_marketplace_imports_v3.sql
-- Purpose: Store MCP-Marketplace imported assets and links to local targets
-- Date: 2026-02-27

CREATE TABLE IF NOT EXISTS marketplace_imports (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  provider_id TEXT,                 -- mcp_providers.id (optional)
  asset_id TEXT NOT NULL,
  asset_kind TEXT,                  -- e.g. 'presentation_template' | 'tool_template' | 'visual_asset'
  target_type TEXT,                 -- e.g. 'presentation_template' | 'tool_work' | 'attachment'
  target_id TEXT,                   -- local id
  source_url TEXT,
  imported_by TEXT,
  imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  asset_json TEXT NOT NULL,
  FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_marketplace_imports_org ON marketplace_imports(organization_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_imports_asset ON marketplace_imports(asset_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_imports_target ON marketplace_imports(target_type, target_id);

