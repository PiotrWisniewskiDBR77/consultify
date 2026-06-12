-- Migration: 548_audit_log_api_keys_compatibility.sql
-- Adds compatibility columns to audit_log and api_keys for PostgresDatabase indexes
-- and routes that expect them (auditLog.routes, apiKeyService).
-- Fixes: column "user_id" does not exist, column "action_type" does not exist,
--        column "created_at" does not exist, column "status" does not exist
-- Date: 2026-02-18

-- audit_log: migration 259 creates audit_log with actor_id/action/timestamp;
-- auditLog.routes and services expect user_id, action_type, created_at
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_log') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'user_id') THEN
      ALTER TABLE audit_log ADD COLUMN user_id TEXT;
      UPDATE audit_log SET user_id = actor_id WHERE actor_type = 'user';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'action_type') THEN
      ALTER TABLE audit_log ADD COLUMN action_type TEXT;
      UPDATE audit_log SET action_type = action WHERE action_type IS NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'created_at') THEN
      ALTER TABLE audit_log ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      UPDATE audit_log SET created_at = COALESCE(audit_log.timestamp, CURRENT_TIMESTAMP) WHERE created_at IS NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'details') THEN
      ALTER TABLE audit_log ADD COLUMN details TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'ip_address') THEN
      ALTER TABLE audit_log ADD COLUMN ip_address TEXT;
      UPDATE audit_log SET ip_address = actor_ip WHERE ip_address IS NULL AND actor_ip IS NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'user_agent') THEN
      ALTER TABLE audit_log ADD COLUMN user_agent TEXT;
      UPDATE audit_log SET user_agent = actor_user_agent WHERE user_agent IS NULL AND actor_user_agent IS NOT NULL;
    END IF;
  END IF;
END $$;

-- api_keys: initdb creates api_keys with is_active; apiKeyService and indexes expect status
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'api_keys') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'api_keys' AND column_name = 'status') THEN
      ALTER TABLE api_keys ADD COLUMN status TEXT DEFAULT 'active';
      UPDATE api_keys SET status = CASE
        WHEN revoked_at IS NOT NULL THEN 'revoked'
        WHEN COALESCE(is_active, TRUE) = FALSE THEN 'revoked'
        WHEN expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP THEN 'expired'
        ELSE 'active'
      END;
    END IF;
  END IF;
END $$;
