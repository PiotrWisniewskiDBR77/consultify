-- =============================================================================
-- Migration: 730_partner_users_uuid_columns.sql
-- Description: Normalize legacy partner_users.partner_org_id to UUID for joins with partner_organizations.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'partner_users'
      AND column_name = 'partner_org_id'
      AND data_type <> 'uuid'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM partner_users
      WHERE partner_org_id IS NOT NULL
        AND NOT (partner_org_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
    ) THEN
      RAISE EXCEPTION 'partner_users.partner_org_id contains non-UUID values; aborting UUID type migration';
    END IF;

    ALTER TABLE partner_users
      ALTER COLUMN partner_org_id TYPE UUID USING partner_org_id::uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'partner_users_partner_org_id_fkey'
  ) THEN
    ALTER TABLE partner_users
      ADD CONSTRAINT partner_users_partner_org_id_fkey
      FOREIGN KEY (partner_org_id) REFERENCES partner_organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

