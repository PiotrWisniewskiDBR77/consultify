-- Migration 729: Fix boolean columns that receive integer values from seed migrations
-- Some columns were created as BOOLEAN but seed data uses 0/1 integers.

DO $$
BEGIN
  -- tools.is_active
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tools' AND column_name='is_active' AND data_type='boolean') THEN
    ALTER TABLE tools ALTER COLUMN is_active DROP DEFAULT;
    ALTER TABLE tools ALTER COLUMN is_active TYPE INTEGER USING CASE WHEN is_active THEN 1 ELSE 0 END;
    ALTER TABLE tools ALTER COLUMN is_active SET DEFAULT 1;
  END IF;

  -- tools.is_coming_soon
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tools' AND column_name='is_coming_soon' AND data_type='boolean') THEN
    ALTER TABLE tools ALTER COLUMN is_coming_soon DROP DEFAULT;
    ALTER TABLE tools ALTER COLUMN is_coming_soon TYPE INTEGER USING CASE WHEN is_coming_soon THEN 1 ELSE 0 END;
    ALTER TABLE tools ALTER COLUMN is_coming_soon SET DEFAULT 0;
  END IF;

  -- initiative_templates.is_public
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='initiative_templates' AND column_name='is_public' AND data_type='boolean') THEN
    ALTER TABLE initiative_templates ALTER COLUMN is_public DROP DEFAULT;
    ALTER TABLE initiative_templates ALTER COLUMN is_public TYPE INTEGER USING CASE WHEN is_public THEN 1 ELSE 0 END;
    ALTER TABLE initiative_templates ALTER COLUMN is_public SET DEFAULT 0;
  END IF;
END $$;
