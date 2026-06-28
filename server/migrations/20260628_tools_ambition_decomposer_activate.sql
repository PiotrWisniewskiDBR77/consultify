-- Activate the Ambition Decomposer tool (3rd replication of the Tools golden-vertical recipe).
-- NOTE: the --safe migration runner records DML migrations as applied WITHOUT executing them;
-- on demo/prod also apply this UPDATE directly (pg + DATABASE_PUBLIC_URL) to be certain.
UPDATE tools
SET is_active = 1,
    is_coming_soon = 0
WHERE tool_type = 'ambition-decomposer';
