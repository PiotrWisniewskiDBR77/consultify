-- Day 67 / P2: make fresh PostgreSQL match the runtime contracts exercised by
-- organization creation and durable Slack deduplication.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS created_by_user_id TEXT;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS ai_assertiveness_level TEXT DEFAULT 'MEDIUM';
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS ai_autonomy_level TEXT DEFAULT 'SUGGEST_ONLY';
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS attribution_data TEXT;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS domain TEXT;

-- This table is created lazily by SlackRouter on first use, so a fresh database
-- legitimately does not have it during the migration pass. Upgrade existing
-- installations without making fresh installs order-dependent on runtime DDL.
DO $$
BEGIN
  IF to_regclass('public.slack_router_dedupe') IS NOT NULL THEN
    ALTER TABLE slack_router_dedupe
      ALTER COLUMN last_sent_at TYPE TIMESTAMPTZ
      USING last_sent_at AT TIME ZONE 'UTC';
  END IF;
END $$;
