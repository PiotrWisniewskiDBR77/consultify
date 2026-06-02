-- Migration: 120_settings_enhancement_tables.sql
-- Description: Add tables for enhanced settings functionality
-- Date: 2026-01-01

-- User connected accounts for SSO
CREATE TABLE IF NOT EXISTS user_connected_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_user_id TEXT,
    email TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at DATETIME,
    status TEXT DEFAULT 'active',
    connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, provider),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Account deletion requests for GDPR compliance
CREATE TABLE IF NOT EXISTS account_deletion_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending', -- pending, approved, completed, rejected
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    processed_by TEXT,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Ensure data_export_requests exists with proper structure
CREATE TABLE IF NOT EXISTS data_export_requests (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    user_id TEXT NOT NULL,
    format TEXT DEFAULT 'json',
    export_type TEXT DEFAULT 'gdpr',
    include_data TEXT,
    include_data_types TEXT,
    exclude_data TEXT,
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed, expired
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    download_url TEXT,
    file_url TEXT,
    file_path TEXT,
    expires_at DATETIME,
    file_expires_at DATETIME,
    file_size INTEGER,
    error_message TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Ensure user_api_keys has proper structure
CREATE TABLE IF NOT EXISTS user_api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    permissions TEXT DEFAULT '[]',
    rate_limit INTEGER DEFAULT 1000,
    last_used_at DATETIME,
    expires_at DATETIME,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_connected_accounts_user ON user_connected_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_user ON account_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_status ON account_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_data_export_requests_user ON data_export_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_hash ON user_api_keys(key_hash);



















