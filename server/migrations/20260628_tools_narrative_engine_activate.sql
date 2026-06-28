-- Activate the Narrative Engine tool (5th replication of the Tools golden-vertical recipe).
-- NOTE: --safe runner records DML migrations as applied WITHOUT executing; also apply
-- this UPDATE directly (pg + DATABASE_PUBLIC_URL) on demo/prod to be certain.
UPDATE tools
SET is_active = 1,
    is_coming_soon = 0
WHERE tool_type = 'narrative-engine';
