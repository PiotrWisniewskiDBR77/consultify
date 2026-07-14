-- Activate the Value Chain Analysis tool (golden-vertical of the Tools concept rework).
-- The runtime "Active" gate is ACTIVE_KNOWN_TOOL_TYPES (code) AND is_active=1 (DB);
-- the library "Coming soon" badge is driven by is_coming_soon (DB column).
-- Existing rows are never re-seeded by ensureToolsSeedOnce, so flip them here.
-- FRESH-DB GUARD (2026-07-14): tools is created by 559_tools_known_tools_library.sql,
-- which sorts AFTER this file on a fresh replay (rows are seeded at runtime by
-- ensureToolsSeedOnce, so this UPDATE is a 0-row no-op on a fresh DB either way).
-- Skip when the table does not exist yet; unchanged on already-migrated DBs.
DO $$ BEGIN
  IF to_regclass('public.tools') IS NOT NULL THEN
    UPDATE tools
    SET is_active = 1,
        is_coming_soon = 0
    WHERE tool_type = 'value-chain';
  END IF;
END $$;
