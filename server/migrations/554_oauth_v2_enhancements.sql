-- 553: OAuth V2 enhancements for T110-T112
-- Adds missing columns to oauth_links for V2 connect flow

-- Ensure base table exists (older DBs may not have security module baseline)
CREATE TABLE IF NOT EXISTS oauth_links (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    provider_email TEXT,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,
    linked_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMPTZ,
    display_name TEXT,
    revoked_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, provider),
    UNIQUE(provider, provider_user_id)
);

DO $$
BEGIN
    -- linked_at may already exist from 055, but ensure it's there
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'oauth_links' AND column_name = 'linked_at'
    ) THEN
        ALTER TABLE oauth_links ADD COLUMN linked_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- display_name for showing in UI
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'oauth_links' AND column_name = 'display_name'
    ) THEN
        ALTER TABLE oauth_links ADD COLUMN display_name TEXT;
    END IF;

    -- revoked_at for soft-delete on disconnect
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'oauth_links' AND column_name = 'revoked_at'
    ) THEN
        ALTER TABLE oauth_links ADD COLUMN revoked_at TIMESTAMPTZ;
    END IF;
END $$;

-- Indexes for V2 queries
CREATE INDEX IF NOT EXISTS idx_oauth_links_user_provider ON oauth_links(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_oauth_links_provider_uid ON oauth_links(provider, provider_user_id);
