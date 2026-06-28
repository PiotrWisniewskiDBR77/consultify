-- Activate the Capability Mapper tool (2nd replication of the Tools golden-vertical recipe).
-- ensureToolsSeedOnce never re-seeds existing rows, so flip is_active / is_coming_soon here.
UPDATE tools
SET is_active = 1,
    is_coming_soon = 0
WHERE tool_type = 'capability-mapper';
