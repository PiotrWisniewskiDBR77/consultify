-- Activate the Value Chain Analysis tool (golden-vertical of the Tools concept rework).
-- The runtime "Active" gate is ACTIVE_KNOWN_TOOL_TYPES (code) AND is_active=1 (DB);
-- the library "Coming soon" badge is driven by is_coming_soon (DB column).
-- Existing rows are never re-seeded by ensureToolsSeedOnce, so flip them here.
UPDATE tools
SET is_active = 1,
    is_coming_soon = 0
WHERE tool_type = 'value-chain';
