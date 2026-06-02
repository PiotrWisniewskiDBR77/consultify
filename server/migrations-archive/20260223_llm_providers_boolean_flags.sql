-- Fix llm_providers boolean flags (Postgres-only)
-- Some legacy schemas created is_active/is_default as INTEGER (0/1).
-- The Postgres adapter normalizes 0/1 to TRUE/FALSE in queries, so columns must be BOOLEAN.

ALTER TABLE llm_providers
  ALTER COLUMN is_active DROP DEFAULT;

ALTER TABLE llm_providers
  ALTER COLUMN is_default DROP DEFAULT;

ALTER TABLE llm_providers
  ALTER COLUMN is_active TYPE BOOLEAN
  USING (CASE WHEN COALESCE(is_active::text,'') IN ('1','t','true','y','yes','on') THEN TRUE ELSE FALSE END);

ALTER TABLE llm_providers
  ALTER COLUMN is_default TYPE BOOLEAN
  USING (CASE WHEN COALESCE(is_default::text,'') IN ('1','t','true','y','yes','on') THEN TRUE ELSE FALSE END);

ALTER TABLE llm_providers
  ALTER COLUMN is_active SET DEFAULT TRUE;

ALTER TABLE llm_providers
  ALTER COLUMN is_default SET DEFAULT FALSE;

