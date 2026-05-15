-- Migration: 603_mcp_providers_registry.sql
-- Purpose: MCP providers registry (org-scoped) + tool allowlist
-- Date: 2026-02-26

-- MCP Providers (external MCP servers configured per organization)
CREATE TABLE IF NOT EXISTS mcp_providers (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,              -- 'streamable_http' | 'stdio' (future)
    status TEXT DEFAULT 'active',    -- 'active' | 'disabled' | 'error'
    config TEXT DEFAULT '{}',        -- JSON: baseUrl, mcpPath, headers, secretsRef, etc.
    last_test_at DATETIME,
    last_error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, name),
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mcp_providers_org ON mcp_providers(organization_id);
CREATE INDEX IF NOT EXISTS idx_mcp_providers_status ON mcp_providers(status);

-- Tool allowlist per provider (can be '*' or explicit list)
CREATE TABLE IF NOT EXISTS mcp_provider_allowlist (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    mode TEXT DEFAULT 'allow',         -- 'allow' (default) | 'deny'
    tools_json TEXT DEFAULT '["*"]',   -- JSON array of tool names (or ["*"])
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider_id),
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(provider_id) REFERENCES mcp_providers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mcp_allowlist_org ON mcp_provider_allowlist(organization_id);

-- Optional cache for remote tool list (best-effort)
CREATE TABLE IF NOT EXISTS mcp_provider_tools_cache (
    provider_id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    tools_json TEXT NOT NULL,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(provider_id) REFERENCES mcp_providers(id) ON DELETE CASCADE,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mcp_tools_cache_org ON mcp_provider_tools_cache(organization_id);

