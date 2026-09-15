-- Z-63 / DEC-513 additive rollback.
-- The nullable column is intentionally retained so rolling application code back
-- cannot destroy names already written by a newer version.
SELECT 1;

