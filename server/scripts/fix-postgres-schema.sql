-- One-time fix for Postgres schemas missing initiatives columns and pmo_audit_trail
-- Run with: psql $DATABASE_URL -f server/scripts/fix-postgres-schema.sql
-- Or: DB_TYPE=postgres DATABASE_URL="..." npx tsx -e "
--   const { Pool } = require('pg');
--   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
--   pool.query(`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS created_by TEXT`);
--   pool.query(`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS updated_by TEXT`);
--   pool.query(`CREATE TABLE IF NOT EXISTS pmo_audit_trail (...)`);
-- "

-- Initiatives: add created_by and updated_by if missing
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- audit_log: add compatibility columns (migration 259 creates audit_log without these;
-- auditLog.routes and services expect user_id, action_type, created_at)
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
      UPDATE audit_log SET created_at = timestamp WHERE created_at IS NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'details') THEN
      ALTER TABLE audit_log ADD COLUMN details TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'ip_address') THEN
      ALTER TABLE audit_log ADD COLUMN ip_address TEXT;
      UPDATE audit_log SET ip_address = actor_ip WHERE ip_address IS NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'user_agent') THEN
      ALTER TABLE audit_log ADD COLUMN user_agent TEXT;
      UPDATE audit_log SET user_agent = actor_user_agent WHERE user_agent IS NULL;
    END IF;
  END IF;
END $$;

-- api_keys: add status column (initdb creates api_keys with is_active, not status;
-- apiKeyService and indexes expect status)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'api_keys') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'api_keys' AND column_name = 'status') THEN
      ALTER TABLE api_keys ADD COLUMN status TEXT DEFAULT 'active';
      UPDATE api_keys SET status = CASE
        WHEN revoked_at IS NOT NULL THEN 'revoked'
        WHEN COALESCE(is_active, 1) = 0 THEN 'revoked'
        WHEN expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP THEN 'expired'
        ELSE 'active'
      END;
    END IF;
  END IF;
END $$;

-- PMO Audit Trail (used by TaskController, taskAssignmentService, projectMemberService)
CREATE TABLE IF NOT EXISTS pmo_audit_trail (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    pmo_domain_id TEXT,
    pmo_phase TEXT,
    object_type TEXT,
    object_id TEXT,
    action TEXT,
    actor_id TEXT,
    iso21500_mapping TEXT,
    pmbok_mapping TEXT,
    prince2_mapping TEXT,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
